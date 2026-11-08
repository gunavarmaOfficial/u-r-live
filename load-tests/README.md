# Load tests (k6)

Design target: **1,000,000 visits/month** (~33k/day, ~140 visits/min in the evening
peak) which we size as roughly **2,500 concurrent WebSocket connections**,
**600 concurrent calls** and **1,500 signaling messages/second**, with at least
2x headroom on Cloud Run (`--min-instances=2 --max-instances=10 --cpu=1 --concurrency=250`).
Media is peer-to-peer, so the server only carries signaling; TURN relay is the
only media cost and is monitored separately.

## Profiles

| File | What it proves | Thresholds |
|---|---|---|
| `browse.js` | Prerendered HTML pages scale behind the CDN (500 VUs) | failed < 1%, p95 < 800 ms, p99 < 2 s |
| `matchmaking.js` | 2,000 concurrent sockets log in, match, exchange SDP/ICE, chat, skip | match p95 < 400 ms, match error rate < 1%, WS connect p95 < 1 s |
| `health.js` | Health endpoint sustains 200 rps | p95 < 150 ms, p99 < 400 ms, failed < 0.1% |

## Running

Install k6 once: `brew install k6` (or see https://k6.io/docs/get-started/installation/).

```bash
# Local or staging server started with a real Redis + Postgres:
DATABASE_URL=... REDIS_URL=... NODE_ENV=production npm run build && npm start

# In another shell:
BASE_URL=http://localhost:8080 k6 run load-tests/browse.js
BASE_URL=http://localhost:8080 k6 run load-tests/health.js
BASE_URL=http://localhost:8080 k6 run load-tests/matchmaking.js
```

`WS_URL` defaults to `BASE_URL` with the scheme swapped to `ws` plus `/ws`.
Override it when the WebSocket endpoint lives on a different host (the HTTPS
load balancer path is fine; WebSockets are proxied).

## Before you run

- **Staging only.** The matchmaking profile creates real guest users and real
  sessions. Never point it at production without coordinating with on-call.
- **Synthetic client IPs.** The server keys rate limits on the first
  `X-Forwarded-For` hop, so each VU sends a unique `10.x.y.z`. This requires a
  proxy in front of the target that appends to `X-Forwarded-For` (Cloud Run
  does). Running the app directly with `X-Forwarded-For` spoofable is a
  staging-only convenience.
- **Redis configured.** With `REDIS_URL` unset each Cloud Run instance keeps its
  own queue, so the profile would match only within an instance. Set it.
- **Clean up guest rows** after a run so the staging database does not grow
  unbounded:
  `DELETE FROM users WHERE auth_provider = 'guest' AND created_at < now() - interval '1 day';`

## Chaos check (required before launch)

While `matchmaking.js` is in its steady stage, roll the service so an instance
is drained and replaced:

```bash
gcloud run services update u-r-live --region=asia-south1 \
  --update-env-vars=CHAOS_ROLL=$(date +%s)
```

Expected: SIGTERM drains sockets with close code 1001, clients reconnect with
backoff, re-join the queue and still match. Match error rate must stay below
1%; nobody should need a manual refresh.

## Results

Record each run here so capacity numbers are traceable.

| Date | Profile | Instances | VUs / rps | p95 | Error rate | Notes |
|---|---|---|---|---|---|---|
| _pending_ | browse | 2 | 500 VUs | | | |
| _pending_ | health | 2 | 200 rps | | | |
| _pending_ | matchmaking | 2 | 2,000 VUs | | | |
| _pending_ | matchmaking + instance roll | 2 | 2,000 VUs | | | |

Sizing rule after a run: `instances = ceil(peak_concurrency / measured_concurrency_per_instance) * 1.5`
for headroom, bounded by the `--max-instances=10` ceiling. Watch Postgres pool
saturation (must stay < 70%) and Redis CPU during the run.

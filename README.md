# OmeLive — Random Video Chat Platform

An adult-only (18+) random video chat web application built with WebRTC peer-to-peer streaming, server-authoritative matchmaking, free gender/country/language filters, and safety moderation controls.

---

## 1. Architecture Overview

### Frontend
- **Framework**: React 19 SPA with TypeScript.
- **Styling**: Tailwind CSS v4, dark minimalist design system, Plus Jakarta Sans display typography, JetBrains Mono for metrics and timers.
- **Video Engine**: Standard WebRTC (`RTCPeerConnection`, `getUserMedia`, ICE candidate negotiation, data channels, and audio/video track controls).
- **Navigation & Views**: Top Bar with 3-zone contract, Landing Page with live telemetry, Video Chat view with split/PiP viewport, Safety & Rules centre, and Admin Console.

### Backend
- **Server**: Express.js HTTP server running on port 3000 alongside WebSocket Server (`ws`).
- **Matchmaking Engine (`server/matchmaker.ts`)**:
  - Ephemeral in-memory queue with atomic candidate reservation to prevent race conditions.
  - Server-side preference validation: everyone can filter by preferred gender, country and language.
  - Automatic exclusion of blocked user pairs (`server/db.ts`).
  - Stale queue entry eviction and heartbeat sweep.
- **Signaling Server (`server/webrtc.ts`)**:
  - WebRTC SDP offer, answer, and ICE candidate relays strictly isolated to verified match sessions.
  - Skip / Next button support with peer disconnect notification and immediate re-enqueuing.
- **Moderation Engine (`server/db.ts`)**:
  - Immediate peer blocking upon submission.
  - Structured categorization (Harassment, Underage, Nudity, Violence, Spam, etc.).
  - Admin moderation actions: Warning, Account Suspension, Permanent Ban with audit logs.

---

## 2. Key Product Principles & Safety

1. **Zero Media Storage Guarantee**: Media streams are strictly peer-to-peer (P2P). No video frames or audio buffers ever touch application servers or databases.
2. **Adult-Only (18+) Gate**: Mandatory declaration checkpoint prior to initializing camera or accessing the queue.
3. **No Fake Counters**: Platform queue size, active connections, and latency counters reflect genuine server metrics.
4. **Server-Authoritative Matching**: Client-side parameter spoofing cannot bypass match filters.

---

## 3. Environment Configuration

Copy `.env.example` to `.env`:

```bash
# Optional Managed TURN Relay Server
TURN_URL="turn:turn.example.com:3478"
TURN_USERNAME="turn_user"
TURN_CREDENTIAL="turn_credential"
```

---

## 4. Development & Running Tests

### Start Development Server
```bash
npm run dev
```
Starts Express + WebSockets + Vite on `http://localhost:3000`.

### Run Automated Tests
```bash
npm test
```
Executes the Vitest suite validating:
- Match preference filtering & self-match prevention
- Blocked-user isolation
- Moderation report & ban lifecycle

---

## 5. Estimated Infrastructure Costs (Assumptions)

| Service | Provider Tier | Estimated Monthly Cost | Notes |
| :--- | :--- | :--- | :--- |
| **Compute / Signaling** | Single Cloud Run container (1 vCPU, 1 GB RAM) | $0 – $15 / month | Persistent WebSockets handle thousands of concurrent matches |
| **STUN Servers** | Public Google STUN pool | $0 / month | Handles ~80–85% of standard NAT traversal directly |
| **TURN Relay Fallback** | Coturn on $5/mo VPS or Cloudflare Calls / Twilio | ~$10 – $35 / month | Only ~15% of symmetric NATs require TURN relay |
| **Database** | PostgreSQL / Local JSON persistent store | $0 – $25 / month | Ephemeral queue is in RAM; only profiles/reports persisted |


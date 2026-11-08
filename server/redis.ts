/**
 * Redis connection management for horizontal scale-out.
 *
 * Redis holds the shared matchmaking queue, presence and cross-instance
 * signaling relay. When REDIS_URL is not configured the server runs in its
 * single-process mode (development, tests) with no behavioural change.
 */
import Redis from 'ioredis';

let commandClient: Redis | null = null;
let subscriberClient: Redis | null = null;
let lastError: string | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

function buildClient(): Redis {
  const client = new Redis(process.env.REDIS_URL as string, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    connectTimeout: 5000,
    // Cap reconnect backoff at 5s so a brief Redis blip does not stall signaling
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });

  client.on('error', (err) => {
    lastError = err.message;
    console.error('[Redis] Connection error:', err.message);
  });
  client.on('ready', () => {
    lastError = null;
  });

  return client;
}

/** Shared command connection (lazily created). */
export function getRedis(): Redis | null {
  if (!isRedisConfigured()) return null;
  if (!commandClient) commandClient = buildClient();
  return commandClient;
}

/** Dedicated subscriber connection; Redis forbids commands on a subscribed client. */
export function getRedisSubscriber(): Redis | null {
  if (!isRedisConfigured()) return null;
  if (!subscriberClient) subscriberClient = buildClient();
  return subscriberClient;
}

export async function pingRedis(): Promise<boolean> {
  const client = getRedis();
  if (!client) return true;
  try {
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

export function getRedisStatus(): 'disabled' | 'ready' | 'error' {
  if (!isRedisConfigured()) return 'disabled';
  if (!commandClient) return 'ready';
  if (lastError) return 'error';
  return commandClient.status === 'ready' ? 'ready' : 'error';
}

export async function closeRedis(): Promise<void> {
  const closing: Promise<unknown>[] = [];
  if (subscriberClient) {
    closing.push(subscriberClient.quit().catch(() => subscriberClient?.disconnect()));
    subscriberClient = null;
  }
  if (commandClient) {
    closing.push(commandClient.quit().catch(() => commandClient?.disconnect()));
    commandClient = null;
  }
  await Promise.all(closing);
}

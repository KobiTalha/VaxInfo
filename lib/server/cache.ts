type MemoryEntry = {
  value: string;
  expiresAt: number;
};

const memoryCache = new Map<string, MemoryEntry>();

function getRedisConfig() {
  const url = process.env.REDIS_REST_URL;
  const token = process.env.REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

async function executeRedisCommand<T>(command: unknown[]): Promise<T | null> {
  const config = getRedisConfig();
  if (!config) {
    return null;
  }

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(command),
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      result?: T;
      error?: string;
    };

    if (payload.error) {
      return null;
    }

    return payload.result ?? null;
  } catch {
    return null;
  }
}

function getFromMemory(key: string) {
  const entry = memoryCache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return entry.value;
}

function setInMemory(key: string, value: string, ttlSeconds: number) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const redisValue = await executeRedisCommand<string | null>(["GET", key]);

  if (typeof redisValue === "string") {
    try {
      return JSON.parse(redisValue) as T;
    } catch {
      return null;
    }
  }

  const memoryValue = getFromMemory(key);
  if (!memoryValue) {
    return null;
  }

  try {
    return JSON.parse(memoryValue) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds: number) {
  const encoded = JSON.stringify(value);

  const redisResult = await executeRedisCommand(["SET", key, encoded, "EX", ttlSeconds]);
  if (redisResult === null) {
    setInMemory(key, encoded, ttlSeconds);
  }
}

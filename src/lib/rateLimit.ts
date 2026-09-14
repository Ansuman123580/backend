// In-memory sliding window rate limiter for abuse and spam protection

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale keys every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < 60000);
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, 300000);
}

export function checkRateLimit(
  identifier: string,
  action: "create_room" | "join_room" | "send_message",
  maxRequests: number,
  windowMs = 60000
): { allowed: boolean; remaining: number; retryAfterMs?: number } {
  const key = `${action}:${identifier}`;
  const now = Date.now();
  const record = rateLimitStore.get(key) || { timestamps: [] };

  // Filter timestamps within window
  const validTimestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= maxRequests) {
    const oldest = validTimestamps[0];
    const retryAfterMs = Math.max(0, windowMs - (now - oldest));
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  validTimestamps.push(now);
  rateLimitStore.set(key, { timestamps: validTimestamps });

  return {
    allowed: true,
    remaining: maxRequests - validTimestamps.length,
  };
}


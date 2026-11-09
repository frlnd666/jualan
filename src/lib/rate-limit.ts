/**
 * Rate limiter in-memory sederhana (fixed window per key).
 *
 * Catatan jujur soal batasnya: state hidup di memori instance server,
 * jadi di deployment serverless multi-instance limit ini bersifat
 * per-instance, bukan global. Cukup untuk menahan spam checkout kasar;
 * untuk proteksi keras gunakan limiter terdistribusi (mis. Upstash).
 */

interface WindowState {
  count: number
  windowStart: number
}

const buckets = new Map<string, WindowState>()
const MAX_BUCKETS = 10_000

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const state = buckets.get(key)

  if (!state || now - state.windowStart >= windowMs) {
    if (buckets.size >= MAX_BUCKETS) {
      // P2-02: JANGAN clear-all — penyerang bisa membanjiri dengan
      // 10.000 key berbeda untuk me-reset limit semua orang. Buang
      // satu entri tertua saja (Map menjaga urutan sisip).
      const oldestKey = buckets.keys().next().value
      if (oldestKey !== undefined) buckets.delete(oldestKey)
    }
    buckets.set(key, { count: 1, windowStart: now })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (state.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((state.windowStart + windowMs - now) / 1000)
      ),
    }
  }

  state.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}

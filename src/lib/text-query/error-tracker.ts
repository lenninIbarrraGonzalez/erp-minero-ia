const errorLog: Array<{ code: string; ts: number }> = [];
const WINDOW_MS = 60_000;
const ALERT_THRESHOLD = 5;

export function recordError(code: string): void {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  while (errorLog.length > 0 && errorLog[0].ts < cutoff) errorLog.shift();
  errorLog.push({ code, ts: now });
  if (errorLog.length >= ALERT_THRESHOLD) {
    console.error(
      JSON.stringify({
        level: "ALERT",
        event: "error_rate_threshold_exceeded",
        count: errorLog.length,
        window_ms: WINDOW_MS,
        recent_codes: errorLog.map((e) => e.code),
      })
    );
  }
}

export function getStats(): { total: number; byCode: Record<string, number>; windowMs: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const recent = errorLog.filter((e) => e.ts >= cutoff);
  const byCode: Record<string, number> = {};
  for (const e of recent) {
    byCode[e.code] = (byCode[e.code] ?? 0) + 1;
  }
  return { total: recent.length, byCode, windowMs: WINDOW_MS };
}

export function __resetForTest(): void {
  errorLog.length = 0;
}

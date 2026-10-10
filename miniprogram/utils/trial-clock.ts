/** Wall-clock based countdown survives backgrounding without leaking timers. */
export function trialClock(startedAt: number, durationSeconds: number, now = Date.now()) {
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const remaining = Math.max(0, durationSeconds - elapsed);
  return { remaining, label: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`,
    progress: Math.min(100, Math.floor(elapsed / durationSeconds * 100)), expired: remaining === 0 };
}

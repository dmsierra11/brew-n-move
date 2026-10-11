export const confirmationDurationMs = 5 * 60 * 1000;

export function remainingConfirmationMs(redeemedAt: string, nowMs: number) {
  const start = Date.parse(redeemedAt);
  if (!Number.isFinite(start)) {
    return 0;
  }

  return Math.max(0, confirmationDurationMs - (nowMs - start));
}

export function isConfirmationExpired(redeemedAt: string, nowMs: number) {
  return remainingConfirmationMs(redeemedAt, nowMs) === 0;
}

export function formatCountdown(remainingMs: number) {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatRedeemedAt(redeemedAt: string) {
  const date = new Date(redeemedAt);
  if (Number.isNaN(date.getTime())) {
    return redeemedAt;
  }

  return new Intl.DateTimeFormat('en-IE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

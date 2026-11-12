export const QUIZ_DURATION_MS = 15 * 60 * 1000;

export function remainingSeconds(startedAt, now = Date.now()) {
  return Math.max(0, Math.min(QUIZ_DURATION_MS / 1000, Math.ceil((startedAt + QUIZ_DURATION_MS - now) / 1000)));
}

export function finishTime(startedAt, now = Date.now()) {
  return Math.max(startedAt, Math.min(now, startedAt + QUIZ_DURATION_MS));
}

export function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

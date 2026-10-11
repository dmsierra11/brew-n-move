export function localDateInTimeZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error('The local date could not be read.');
  }

  return `${year}-${month}-${day}`;
}

export function deviceLocalDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function offsetMs(utcMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(new Date(utcMs));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const hour = read('hour');
  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    hour === 24 ? 0 : hour,
    read('minute'),
    read('second'),
  );
  return asUtc - utcMs;
}

export function zonedMidnightMs(localDate: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) {
    throw new Error('The local date is not valid.');
  }

  const utcGuess = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  let midnight = utcGuess - offsetMs(utcGuess, timeZone);
  const adjusted = utcGuess - offsetMs(midnight, timeZone);
  if (adjusted !== midnight) {
    midnight = adjusted;
  }

  return midnight;
}

export function dayWindow(localDate: string, timeZone: string) {
  const start = zonedMidnightMs(localDate, timeZone);
  const nextLocal = localDateInTimeZone(new Date(start + 36 * 60 * 60 * 1000), timeZone);
  return { end: zonedMidnightMs(nextLocal, timeZone), start };
}

export function windowsOverlap(
  left: { end: number; start: number },
  right: { end: number; start: number },
) {
  return left.start < right.end && right.start < left.end;
}

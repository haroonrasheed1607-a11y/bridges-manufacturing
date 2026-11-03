// utils/dates.js


var formatDate = e => e ? new Date(e.length === 10 ? e + `T12:00:00` : e).toLocaleDateString(`en-US`, {
  month: `short`,
  day: `numeric`,
  year: `numeric`
}) : `—`;
var formatTimestamp = e => e ? new Date(e).toLocaleString(`en-US`, {
  timeZone: `America/Chicago`,
  timeZoneName: `short`
}) : `—`;
function manufacturingToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}
function manufacturingDate(value) {
  const d = new Date(value + 'T12:00:00Z');
  return Number.isNaN(d.getTime()) ? null : d;
}
function manufacturingDateText(date) {
  return date.toISOString().slice(0, 10);
}
function manufacturingWeekdays(start, end) {
  let a = manufacturingDate(start),
    b = manufacturingDate(end);
  if (!a || !b || b < a) return 0;
  const count = Math.floor((b - a) / 86400000) + 1,
    weeks = Math.floor(count / 7);
  let days = weeks * 5;
  for (let i = 0; i < count % 7; i++) {
    const day = (a.getUTCDay() + i) % 7;
    if (day !== 0 && day !== 6) days++;
  }
  return days;
}
function manufacturingFinish(start, days) {
  let date = manufacturingDate(start);
  if (!date || !Number.isFinite(days) || days < 1) return '';
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  let remaining = Math.ceil(days) - 1;
  date.setUTCDate(date.getUTCDate() + Math.floor(remaining / 5) * 7);
  remaining %= 5;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (![0, 6].includes(date.getUTCDay())) remaining--;
  }
  return manufacturingDateText(date);
}
function manufacturingDayOffset(start, offset) {
  const date = manufacturingDate(start);
  if (!date) return '';
  date.setUTCDate(date.getUTCDate() + offset);
  return manufacturingDateText(date);
}

export { formatDate, formatTimestamp, manufacturingToday, manufacturingDate, manufacturingDateText, manufacturingWeekdays, manufacturingFinish, manufacturingDayOffset };

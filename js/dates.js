function countBusinessDays(start, end) {
  return enumerateDays(start, end).filter((day) => !isWeekendIso(day)).length;
}

function diffCalendarDays(fromIso, toIso) {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function addBusinessDays(isoDate, count) {
  let date = parseIsoDate(isoDate);
  let remaining = Math.abs(count);
  const direction = count < 0 ? -1 : 1;

  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + direction);
    if (isBusinessDay(date)) remaining -= 1;
  }

  return toIsoDate(date);
}

function addCalendarDays(isoDate, count) {
  const date = parseIsoDate(isoDate);
  date.setUTCDate(date.getUTCDate() + count);
  return toIsoDate(date);
}

function enumerateDays(startIso, endIso) {
  const days = [];
  let cursor = startIso;
  while (compareDates(cursor, endIso) <= 0) {
    days.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return days;
}

function isBusinessDay(date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function isWeekendIso(isoDate) {
  return !isBusinessDay(parseIsoDate(isoDate));
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseIsoDate(value);
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === value;
}

function parseIsoDate(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`);
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function compareDates(a, b) {
  return a.localeCompare(b);
}

function formatShortDate(isoDate) {
  if (!isIsoDate(isoDate)) return "";
  const date = parseIsoDate(isoDate);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatMonthLabel(isoDate) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(parseIsoDate(isoDate));
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function weekdayLabel(isoDate) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(parseIsoDate(isoDate)).slice(0, 2);
}


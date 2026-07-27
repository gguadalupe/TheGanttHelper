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

function normalizePlanningMonth(value, fallbackDate = "") {
  if (typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  return isIsoDate(fallbackDate) ? fallbackDate.slice(0, 7) : "";
}

function comparePlanningMonths(a, b) {
  return a.localeCompare(b);
}

function addMonths(month, count) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + count, 1));
  return date.toISOString().slice(0, 7);
}

function formatPlanningMonth(month) {
  const date = parseIsoDate(`${month}-01`);
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function getBusinessDaysInMonth(month) {
  const start = `${month}-01`;
  const end = addCalendarDays(`${addMonths(month, 1)}-01`, -1);
  return countBusinessDays(start, end);
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


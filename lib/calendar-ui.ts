export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function getLocalISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDateFromISO(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`);
}

export function getWeekStart(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getWeekDays(date: Date) {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

export function shiftISODate(isoDate: string, days: number) {
  const date = getDateFromISO(isoDate);
  date.setDate(date.getDate() + days);
  return getLocalISODate(date);
}

export function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  let startDayOfWeek = firstDay.getDay() - 1; // Monday = 0
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];

  for (let index = 0; index < startDayOfWeek; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

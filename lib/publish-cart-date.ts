export function pacificCartDates(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const today = new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
  const format = (date: Date) => date.toISOString().slice(0, 10);
  const tomorrow = new Date(today); tomorrow.setUTCDate(today.getUTCDate() + 1);
  return [format(today), format(tomorrow)] as const;
}

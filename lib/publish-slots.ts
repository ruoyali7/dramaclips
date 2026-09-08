export const PACIFIC_PUBLISH_TIMES = [
  "07:00", "07:10", "12:00", "12:10", "12:20",
  "18:00", "18:10", "21:30", "21:40", "21:50",
] as const;

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

export function pacificLocalToIso(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number); const [hour, minute] = time.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let result = new Date(desired);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = zonedParts(result);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    result = new Date(result.getTime() + desired - represented);
  }
  return result.toISOString();
}

export function availablePacificPublishSlots(date: string, count: number, now = new Date()) {
  const slots = futurePacificPublishSlots(date, now);
  if (count > slots.length) throw new Error(`Only ${slots.length} future publish slots remain for ${date}`);
  return slots.slice(0, count);
}

export function futurePacificPublishSlots(date: string, now = new Date()) {
  return PACIFIC_PUBLISH_TIMES.map((time) => pacificLocalToIso(date, time)).filter((iso) => new Date(iso).getTime() > now.getTime());
}

export function snapIsoToHalfHour(value: string) {
  const date = new Date(value);
  date.setUTCMinutes(date.getUTCMinutes() < 30 ? 0 : 30, 0, 0);
  return date.toISOString();
}

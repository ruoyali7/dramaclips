export function snapIsoToTenMinutes(value: string) {
  const date = new Date(value);
  date.setUTCMinutes(Math.floor(date.getUTCMinutes() / 10) * 10, 0, 0);
  return date.toISOString();
}

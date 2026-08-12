export function snapLocalDateTimeToHalfHour(value: string) {
  return value.replace(/T(\d{2}):(\d{2})(?::\d{2})?$/, (_match, hour: string, minute: string) =>
    `T${hour}:${Number(minute) < 30 ? "00" : "30"}`,
  );
}

export function snapIsoToHalfHour(value: string) {
  const date = new Date(value);
  date.setUTCMinutes(date.getUTCMinutes() < 30 ? 0 : 30, 0, 0);
  return date.toISOString();
}

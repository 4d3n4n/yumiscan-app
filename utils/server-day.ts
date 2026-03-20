export function getServerDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

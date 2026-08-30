/** Today's date as YYYY-MM-DD in the device's local timezone, matching a Postgres `date` column. */
export function getTodayDateString(): string {
  return toDateString(new Date());
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** `count` consecutive YYYY-MM-DD strings starting today (count=1 is just today). */
export function getDateRangeStrings(count: number): string[] {
  const dates: string[] = [];
  const cursor = new Date();
  for (let i = 0; i < count; i++) {
    dates.push(toDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

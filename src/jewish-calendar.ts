/**
 * Jewish holiday calendar lookup for Gregorian years 2015–2030.
 * Dates represent the start of each holiday in ISO format (YYYY-MM-DD).
 * Holiday season windows are start + duration days.
 */

export interface HolidayWindow {
  /** Start date in YYYY-MM-DD */
  start: string;
  /** Number of days the holiday/season spans */
  days: number;
  /** Taxonomy event id */
  eventId: string;
}

/** Pre-computed holiday windows per year (years 2015–2030). */
const HOLIDAY_WINDOWS_BY_YEAR: Record<number, HolidayWindow[]> = {
  2015: [
    { start: "2015-02-03", days: 1, eventId: "purim" },
    { start: "2015-04-03", days: 8, eventId: "pesach" },
    { start: "2015-05-23", days: 2, eventId: "shavuot" },
    { start: "2015-09-13", days: 2, eventId: "rosh_hashanah" },
    { start: "2015-09-27", days: 9, eventId: "sukkot" },
    { start: "2015-12-06", days: 8, eventId: "chanukah" },
  ],
  2016: [
    { start: "2016-03-23", days: 1, eventId: "purim" },
    { start: "2016-04-22", days: 8, eventId: "pesach" },
    { start: "2016-06-11", days: 2, eventId: "shavuot" },
    { start: "2016-10-02", days: 2, eventId: "rosh_hashanah" },
    { start: "2016-10-16", days: 9, eventId: "sukkot" },
    { start: "2016-12-24", days: 8, eventId: "chanukah" },
  ],
  2017: [
    { start: "2017-03-11", days: 1, eventId: "purim" },
    { start: "2017-04-10", days: 8, eventId: "pesach" },
    { start: "2017-05-30", days: 2, eventId: "shavuot" },
    { start: "2017-09-20", days: 2, eventId: "rosh_hashanah" },
    { start: "2017-10-04", days: 9, eventId: "sukkot" },
    { start: "2017-12-12", days: 8, eventId: "chanukah" },
  ],
  2018: [
    { start: "2018-03-01", days: 1, eventId: "purim" },
    { start: "2018-03-30", days: 8, eventId: "pesach" },
    { start: "2018-05-19", days: 2, eventId: "shavuot" },
    { start: "2018-09-09", days: 2, eventId: "rosh_hashanah" },
    { start: "2018-09-23", days: 9, eventId: "sukkot" },
    { start: "2018-12-02", days: 8, eventId: "chanukah" },
  ],
  2019: [
    { start: "2019-03-20", days: 1, eventId: "purim" },
    { start: "2019-04-19", days: 8, eventId: "pesach" },
    { start: "2019-06-08", days: 2, eventId: "shavuot" },
    { start: "2019-09-29", days: 2, eventId: "rosh_hashanah" },
    { start: "2019-10-13", days: 9, eventId: "sukkot" },
    { start: "2019-12-22", days: 8, eventId: "chanukah" },
  ],
  2020: [
    { start: "2020-03-09", days: 1, eventId: "purim" },
    { start: "2020-04-08", days: 8, eventId: "pesach" },
    { start: "2020-05-28", days: 2, eventId: "shavuot" },
    { start: "2020-09-18", days: 2, eventId: "rosh_hashanah" },
    { start: "2020-10-02", days: 9, eventId: "sukkot" },
    { start: "2020-12-10", days: 8, eventId: "chanukah" },
  ],
  2021: [
    { start: "2021-02-25", days: 1, eventId: "purim" },
    { start: "2021-03-27", days: 8, eventId: "pesach" },
    { start: "2021-05-16", days: 2, eventId: "shavuot" },
    { start: "2021-09-06", days: 2, eventId: "rosh_hashanah" },
    { start: "2021-09-20", days: 9, eventId: "sukkot" },
    { start: "2021-11-28", days: 8, eventId: "chanukah" },
  ],
  2022: [
    { start: "2022-03-16", days: 1, eventId: "purim" },
    { start: "2022-04-15", days: 8, eventId: "pesach" },
    { start: "2022-06-04", days: 2, eventId: "shavuot" },
    { start: "2022-09-25", days: 2, eventId: "rosh_hashanah" },
    { start: "2022-10-09", days: 9, eventId: "sukkot" },
    { start: "2022-12-18", days: 8, eventId: "chanukah" },
  ],
  2023: [
    { start: "2023-03-06", days: 1, eventId: "purim" },
    { start: "2023-04-05", days: 8, eventId: "pesach" },
    { start: "2023-05-25", days: 2, eventId: "shavuot" },
    { start: "2023-09-15", days: 2, eventId: "rosh_hashanah" },
    { start: "2023-09-29", days: 9, eventId: "sukkot" },
    { start: "2023-12-07", days: 8, eventId: "chanukah" },
  ],
  2024: [
    { start: "2024-03-23", days: 1, eventId: "purim" },
    { start: "2024-04-22", days: 8, eventId: "pesach" },
    { start: "2024-06-11", days: 2, eventId: "shavuot" },
    { start: "2024-10-02", days: 2, eventId: "rosh_hashanah" },
    { start: "2024-10-16", days: 9, eventId: "sukkot" },
    { start: "2024-12-25", days: 8, eventId: "chanukah" },
  ],
  2025: [
    { start: "2025-03-13", days: 1, eventId: "purim" },
    { start: "2025-04-12", days: 8, eventId: "pesach" },
    { start: "2025-06-01", days: 2, eventId: "shavuot" },
    { start: "2025-09-22", days: 2, eventId: "rosh_hashanah" },
    { start: "2025-10-06", days: 9, eventId: "sukkot" },
    { start: "2025-12-14", days: 8, eventId: "chanukah" },
  ],
  2026: [
    { start: "2026-03-03", days: 1, eventId: "purim" },
    { start: "2026-04-01", days: 8, eventId: "pesach" },
    { start: "2026-05-21", days: 2, eventId: "shavuot" },
    { start: "2026-09-11", days: 2, eventId: "rosh_hashanah" },
    { start: "2026-09-25", days: 9, eventId: "sukkot" },
    { start: "2026-12-04", days: 8, eventId: "chanukah" },
  ],
  2027: [
    { start: "2027-03-22", days: 1, eventId: "purim" },
    { start: "2027-04-21", days: 8, eventId: "pesach" },
    { start: "2027-06-10", days: 2, eventId: "shavuot" },
    { start: "2027-10-01", days: 2, eventId: "rosh_hashanah" },
    { start: "2027-10-15", days: 9, eventId: "sukkot" },
    { start: "2027-12-24", days: 8, eventId: "chanukah" },
  ],
  2028: [
    { start: "2028-03-11", days: 1, eventId: "purim" },
    { start: "2028-04-10", days: 8, eventId: "pesach" },
    { start: "2028-05-30", days: 2, eventId: "shavuot" },
    { start: "2028-09-20", days: 2, eventId: "rosh_hashanah" },
    { start: "2028-10-04", days: 9, eventId: "sukkot" },
    { start: "2028-12-12", days: 8, eventId: "chanukah" },
  ],
  2029: [
    { start: "2029-03-01", days: 1, eventId: "purim" },
    { start: "2029-03-30", days: 8, eventId: "pesach" },
    { start: "2029-05-18", days: 2, eventId: "shavuot" },
    { start: "2029-09-09", days: 2, eventId: "rosh_hashanah" },
    { start: "2029-09-23", days: 9, eventId: "sukkot" },
    { start: "2029-12-01", days: 8, eventId: "chanukah" },
  ],
  2030: [
    { start: "2030-03-19", days: 1, eventId: "purim" },
    { start: "2030-04-17", days: 8, eventId: "pesach" },
    { start: "2030-06-07", days: 2, eventId: "shavuot" },
    { start: "2030-09-27", days: 2, eventId: "rosh_hashanah" },
    { start: "2030-10-11", days: 9, eventId: "sukkot" },
    { start: "2030-12-20", days: 8, eventId: "chanukah" },
  ],
};

/**
 * Return the event IDs active on a given date (YYYY-MM-DD), with a lookahead
 * window so photos taken a few days before a holiday still match.
 */
export function getHolidaysForDate(
  dateStr: string,
  lookbackDays = 1,
  lookaheadDays = 2
): string[] {
  const d = new Date(dateStr + "T12:00:00Z");
  if (isNaN(d.getTime())) return [];

  const year = d.getUTCFullYear();
  const results: string[] = [];

  // Check current year, previous year (year-end photos sometimes mislabeled), next year
  for (const y of [year - 1, year, year + 1]) {
    const windows = HOLIDAY_WINDOWS_BY_YEAR[y];
    if (!windows) continue;

    for (const win of windows) {
      const start = new Date(win.start + "T00:00:00Z");
      const end = new Date(start.getTime() + win.days * 86400000);

      // Expand window with lookahead/lookback
      const windowStart = new Date(start.getTime() - lookbackDays * 86400000);
      const windowEnd = new Date(end.getTime() + lookaheadDays * 86400000);

      if (d >= windowStart && d < windowEnd) {
        if (!results.includes(win.eventId)) {
          results.push(win.eventId);
        }
      }
    }
  }

  return results;
}

/** Format a holiday window for display. */
export function describeHolidayWindow(eventId: string, year: number): string | null {
  const windows = HOLIDAY_WINDOWS_BY_YEAR[year];
  if (!windows) return null;
  const win = windows.find((w) => w.eventId === eventId);
  if (!win) return null;
  return `${win.start} (+${win.days} days)`;
}

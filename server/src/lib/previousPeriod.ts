// Work out the "previous period" to compare a report against.
//
// The naive approach — look back the same number of milliseconds —
// breaks for month-to-month comparison because months have different
// lengths: comparing a 31-day July against "the previous 31 days"
// reaches back into May and misses a clean June. So:
//
//   - If the period is a WHOLE calendar month (starts on the 1st and
//     ends on the last day of that same month), the previous period is
//     the previous whole calendar month — 28, 29, 30 or 31 days as
//     appropriate. This is the normal case (managers review by month).
//
//   - Otherwise (a custom range like 1–15 June), fall back to the
//     same-length window immediately before it.
//
// Returns UTC ISO timestamps for the previous period's start and end,
// ready to feed straight into a `.gte(start).lte(end)` query on
// submitted_at.

export interface PrevPeriod { prevStartIso: string; prevEndIso: string; }

// fromStr / toStr are 'YYYY-MM-DD'. Returns the previous period bounds.
export function previousPeriodBounds(fromStr: string, toStr: string): PrevPeriod {
  const fromIso = `${fromStr}T00:00:00.000Z`;
  const startMs = new Date(fromIso).getTime();
  const prevEndIso = new Date(startMs - 1).toISOString(); // 1ms before this period

  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);
  // Last day of the "to" month, computed in UTC.
  const lastDayOfToMonth = new Date(Date.UTC(ty, tm, 0)).getUTCDate();

  const isWholeMonth = fd === 1 && fy === ty && fm === tm && td === lastDayOfToMonth;

  if (isWholeMonth) {
    // Previous calendar month: month fm-1 (1-indexed), rolling the
    // year back at January. Date.UTC handles month = 0 → December.
    const prevMonthStart = new Date(Date.UTC(fy, fm - 2, 1));
    const prevStartIso = prevMonthStart.toISOString();
    return { prevStartIso, prevEndIso };
  }

  // Custom range — same-length window immediately before.
  const toIso = `${toStr}T23:59:59.999Z`;
  const periodMs = new Date(toIso).getTime() - startMs;
  const prevStartIso = new Date(startMs - periodMs - 1).toISOString();
  return { prevStartIso, prevEndIso };
}

/**
 * cycle-calculator.js
 *
 * Pure calculation functions — ZERO DOM access in this file.
 * All dates are represented and returned as ISO-8601 strings (YYYY-MM-DD)
 * for consistency, easy comparison, and safe JSON serialisation.
 *
 * All arithmetic uses UTC to avoid Daylight Saving Time drift
 * (e.g. a "add 28 days" operation in a DST transition could land
 * 27 or 29 hours off if done with local time).
 */

/* ============================================================
   PRIVATE HELPERS
   ============================================================ */

/**
 * Parse any sensible date input into a UTC-midnight Date object.
 * Accepts:
 *   - ISO string  "YYYY-MM-DD"
 *   - JS Date     (local parts are re-anchored to UTC midnight)
 *
 * @param {string|Date} input
 * @returns {Date} UTC-midnight Date
 */
function _parseDate(input) {
  if (input instanceof Date) {
    // Re-anchor local date parts to UTC midnight to avoid offset confusion.
    return new Date(Date.UTC(
      input.getFullYear(),
      input.getMonth(),
      input.getDate()
    ));
  }
  if (typeof input === "string") {
    // "YYYY-MM-DD" — split manually rather than relying on Date.parse,
    // which has historically inconsistent timezone behaviour across browsers.
    const [y, m, d] = input.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  throw new TypeError(`_parseDate: unsupported input type "${typeof input}"`);
}

/**
 * Add n days (may be negative) to a UTC-midnight Date.
 * Returns a new Date; does not mutate the input.
 *
 * @param {Date} utcDate
 * @param {number} n  Integer number of days
 * @returns {Date}
 */
function _addDays(utcDate, n) {
  return new Date(utcDate.getTime() + n * 86_400_000);
}

/**
 * Format a UTC-midnight Date as an ISO string "YYYY-MM-DD".
 *
 * @param {Date} utcDate
 * @returns {string}
 */
function _toISO(utcDate) {
  const y  = utcDate.getUTCFullYear();
  const m  = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const d  = String(utcDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Build an inclusive array of ISO strings from startDate to endDate.
 * If end < start (can happen with short/unusual cycles), returns [].
 *
 * @param {Date} startDate UTC-midnight
 * @param {Date} endDate   UTC-midnight
 * @returns {string[]}
 */
function _dateRange(startDate, endDate) {
  const result = [];
  let cur = startDate;
  while (cur <= endDate) {
    result.push(_toISO(cur));
    cur = _addDays(cur, 1);
  }
  return result;
}

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Calculate projected cycle data for a given number of future cycles.
 *
 * Formulas (i = 0-indexed cycle number):
 *   cycleStart        = lastPeriodStart + (i × cycleLength) days
 *   periodDays        = cycleStart … cycleStart + periodLength − 1
 *   ovulationDay      = cycleStart + (cycleLength − 14)
 *   fertileWindowStart = ovulationDay − 5
 *   fertileWindowEnd   = ovulationDay + 1
 *   peakDays          = [ovulationDay − 1, ovulationDay]
 *   nextCycleStart    = cycleStart + cycleLength
 *   pmsStart          = nextCycleStart − 7
 *   pmsEnd            = nextCycleStart − 1
 *
 * Edge-case behaviour:
 *   - Month/year rollovers and leap years are handled automatically
 *     by using millisecond arithmetic (UTC).
 *   - For short cycles (e.g. 21 days) the fertile/period/PMS windows
 *     may overlap. The function lets them overlap — it does NOT clamp
 *     or reorder windows. Callers should be aware of this.
 *
 * @param {string|Date} lastPeriodStart  First day of the most recent period
 * @param {number}      cycleLength      Average cycle length in days (default 28)
 * @param {number}      periodLength     Average period length in days (default 5)
 * @param {number}      numberOfCycles   How many cycles to project  (default 6)
 *
 * @returns {Array<{
 *   cycleNumber:         number,   // 1-indexed for display
 *   cycleStart:          string,   // ISO "YYYY-MM-DD"
 *   periodDays:          string[], // inclusive array of ISO dates
 *   ovulationDay:        string,
 *   fertileWindowStart:  string,
 *   fertileWindowEnd:    string,
 *   fertileWindowDays:   string[], // inclusive array of ISO dates
 *   peakDays:            string[], // [ovulationDay − 1, ovulationDay]
 *   nextCycleStart:      string,
 *   pmsStart:            string,
 *   pmsEnd:              string,
 *   pmsDays:             string[], // inclusive array of ISO dates
 * }>}
 */
function calculateCycles(
  lastPeriodStart,
  cycleLength     = 28,
  periodLength    = 5,
  numberOfCycles  = 6
) {
  // ---- Input validation ----
  if (!lastPeriodStart) {
    throw new Error("calculateCycles: lastPeriodStart is required");
  }
  if (!Number.isInteger(cycleLength) || cycleLength < 1) {
    throw new RangeError(`calculateCycles: cycleLength must be a positive integer, got ${cycleLength}`);
  }
  if (!Number.isInteger(periodLength) || periodLength < 1) {
    throw new RangeError(`calculateCycles: periodLength must be a positive integer, got ${periodLength}`);
  }
  if (!Number.isInteger(numberOfCycles) || numberOfCycles < 1) {
    throw new RangeError(`calculateCycles: numberOfCycles must be a positive integer, got ${numberOfCycles}`);
  }

  const anchor = _parseDate(lastPeriodStart); // UTC-midnight reference date

  const cycles = [];

  for (let i = 0; i < numberOfCycles; i++) {
    // --- Core dates ---
    const cycleStart     = _addDays(anchor, i * cycleLength);
    const periodEnd      = _addDays(cycleStart, periodLength - 1);
    const ovulationDate  = _addDays(cycleStart, cycleLength - 14);
    const fwStart        = _addDays(ovulationDate, -5);
    const fwEnd          = _addDays(ovulationDate, 1);
    const peak1          = _addDays(ovulationDate, -1);
    const peak2          = ovulationDate; // same object is fine; _toISO is pure
    const nextStart      = _addDays(cycleStart, cycleLength);
    const pmsStartDate   = _addDays(nextStart, -7);
    const pmsEndDate     = _addDays(nextStart, -1);

    cycles.push({
      cycleNumber:        i + 1,                          // 1-indexed
      cycleStart:         _toISO(cycleStart),
      periodDays:         _dateRange(cycleStart, periodEnd),
      ovulationDay:       _toISO(ovulationDate),
      fertileWindowStart: _toISO(fwStart),
      fertileWindowEnd:   _toISO(fwEnd),
      fertileWindowDays:  _dateRange(fwStart, fwEnd),
      peakDays:           [_toISO(peak1), _toISO(peak2)],
      nextCycleStart:     _toISO(nextStart),
      pmsStart:           _toISO(pmsStartDate),
      pmsEnd:             _toISO(pmsEndDate),
      pmsDays:            _dateRange(pmsStartDate, pmsEndDate),
    });
  }

  return cycles;
}

/* ============================================================
   SELF-CHECK  (Phase 2 verification — remove or gate in production)
   Expected for March 1 2026, cycle 28, period 5:
     period     Mar 01–05
     ovulation  Mar 15
     fertile    Mar 10–16  (peak Mar 14–15)
     PMS        Mar 22–28
     next start Mar 29
   ============================================================ */
(function selfCheck() {
  const results = calculateCycles("2026-03-01", 28, 5, 1);
  const c = results[0];

  const pass = (label, actual, expected) => {
    const ok = actual === expected;
    console.log(
      `%c${ok ? "✅" : "❌"} ${label}`,
      `color:${ok ? "green" : "red"}`,
      `→ ${actual}${ok ? "" : `  (expected ${expected})`}`
    );
    return ok;
  };

  const passArr = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(
      `%c${ok ? "✅" : "❌"} ${label}`,
      `color:${ok ? "green" : "red"}`,
      `→ [${actual.join(", ")}]${ok ? "" : `\n  expected [${expected.join(", ")}]`}`
    );
    return ok;
  };

  console.group("🔬 cycle-calculator self-check  (Mar 1 2026, 28-day cycle, 5-day period)");

  const allPass = [
    pass   ("cycleStart",         c.cycleStart,         "2026-03-01"),
    passArr("periodDays",         c.periodDays,         ["2026-03-01","2026-03-02","2026-03-03","2026-03-04","2026-03-05"]),
    pass   ("ovulationDay",       c.ovulationDay,       "2026-03-15"),
    pass   ("fertileWindowStart", c.fertileWindowStart, "2026-03-10"),
    pass   ("fertileWindowEnd",   c.fertileWindowEnd,   "2026-03-16"),
    passArr("peakDays",           c.peakDays,           ["2026-03-14","2026-03-15"]),
    pass   ("pmsStart",           c.pmsStart,           "2026-03-22"),
    pass   ("pmsEnd",             c.pmsEnd,             "2026-03-28"),
    pass   ("nextCycleStart",     c.nextCycleStart,     "2026-03-29"),
  ].every(Boolean);

  console.log(allPass
    ? "%c✅ All checks passed!"
    : "%c❌ One or more checks FAILED — review the formulas above.",
    `font-weight:bold; color:${allPass ? "green" : "red"}`
  );

  console.groupEnd();
})();

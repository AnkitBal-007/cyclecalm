/**
 * calendar.js
 *
 * Renders a monthly calendar grid with cycle-phase color-coding,
 * and an adjacent info panel that summarises the currently-viewed cycle.
 *
 * Public API (attached to window):
 *   window.initCalendar(containerId, cycleData)
 */

(function () {
  "use strict";

  /* ============================================================
     CONSTANTS
     ============================================================ */

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  /* ============================================================
     MODULE STATE  (private to this IIFE)
     ============================================================ */

  let _containerId = null;
  let _year = null;
  let _month = null;      // 0-indexed
  let _sets = null;      // { period, fertile, peak, pms, ovulation }
  let _cycleData = null;      // full array from calculateCycles()

  /* ============================================================
     HELPERS — DATE MATHS
     ============================================================ */

  /** Zero-pad integer n to width w. */
  function pad(n, w) { return String(n).padStart(w, "0"); }

  /** Format a calendar cell date as "YYYY-MM-DD". */
  function toISO(year, month, day) {
    return `${year}-${pad(month + 1, 2)}-${pad(day, 2)}`;
  }

  /** Today's date as "YYYY-MM-DD" in local time (display only — no timezone drift risk). */
  function todayISO() {
    const t = new Date();
    return `${t.getFullYear()}-${pad(t.getMonth() + 1, 2)}-${pad(t.getDate(), 2)}`;
  }

  /* ============================================================
     HELPERS — DISPLAY FORMATTING
     ============================================================ */

  /**
   * "2026-03-15" → "March 15, 2026"
   * Uses local-time Date constructor to avoid UTC offset on midnight dates.
   */
  function formatDate(isoString) {
    const [y, m, d] = isoString.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  /**
   * Format a date range compactly.
   *   Same month+year : "March 10–16, 2026"
   *   Same year       : "March 10 – April 5, 2026"
   *   Different years : "December 28, 2026 – January 3, 2027"
   */
  function formatDateRange(isoStart, isoEnd) {
    const [y1, m1, d1] = isoStart.split("-").map(Number);
    const [y2, m2, d2] = isoEnd.split("-").map(Number);
    const start = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);

    if (y1 === y2 && m1 === m2) {
      // "March 10–16, 2026"
      const s = start.toLocaleDateString("en-US", { month: "long", day: "numeric" });
      const e = end.toLocaleDateString("en-US", { day: "numeric", year: "numeric" });
      return `${s}–${e}`;
    }
    if (y1 === y2) {
      // "March 10 – April 5, 2026"
      const s = start.toLocaleDateString("en-US", { month: "long", day: "numeric" });
      const e = end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      return `${s} – ${e}`;
    }
    // "December 28, 2026 – January 3, 2027"
    return `${formatDate(isoStart)} – ${formatDate(isoEnd)}`;
  }

  /* ============================================================
     CYCLE SELECTION — which cycle to show in the info panel
     ============================================================ */

  /**
   * Return the most relevant cycle for the given month/year.
   *
   * Strategy: the last cycle (sorted ascending) whose cycleStart is
   * ≤ the first day of the viewed month.  This means:
   *   - March 2026 (Cycle 1 starts Mar 1,  Cycle 2 starts Mar 29)
   *     → firstOfMonth = "2026-03-01", Cycle 1 matches, Cycle 2 does not → Cycle 1 ✓
   *   - April 2026  → both Cycle 1 & 2 match, Cycle 2 is later → Cycle 2 ✓
   *   - May 2026    → Cycles 1–3 match, Cycle 3 is latest     → Cycle 3 ✓
   *
   * ISO strings compare lexicographically correctly (YYYY-MM-DD).
   *
   * @param {number} year
   * @param {number} month  0-indexed
   * @param {Array}  cycleData
   * @returns {Object|null} cycle object, or null if no data
   */
  function getCycleForMonth(year, month, cycleData) {
    if (!cycleData || cycleData.length === 0) return null;

    const firstOfMonth = `${year}-${pad(month + 1, 2)}-01`;

    let best = null;
    for (let i = 0; i < cycleData.length; i++) {
      if (cycleData[i].cycleStart <= firstOfMonth) {
        best = cycleData[i]; // keep updating — the last match is the latest
      } else {
        break; // cycleData is sorted ascending, so stop early
      }
    }

    // If no cycle has started by this month, fall back to the first one
    return best || cycleData[0];
  }

  /* ============================================================
     CALENDAR SETS
     ============================================================ */

  /**
   * Build Set-based lookups from calculateCycles() output for fast O(1) per-day lookup.
   */
  function buildSets(cycleData) {
    const period = new Set();
    const fertile = new Set();
    const peak = new Set();
    const pms = new Set();
    const ovulation = new Set();

    cycleData.forEach(function (cycle) {
      cycle.periodDays.forEach(function (d) { period.add(d); });
      cycle.fertileWindowDays.forEach(function (d) { fertile.add(d); });
      cycle.peakDays.forEach(function (d) { peak.add(d); });
      cycle.pmsDays.forEach(function (d) { pms.add(d); });
      ovulation.add(cycle.ovulationDay);
    });

    return { period, fertile, peak, pms, ovulation };
  }

  /**
   * Classify a single day.
   * Priority: period > peak > fertile > pms > normal
   */
  function classifyDay(isoDate, sets) {
    if (sets.period.has(isoDate)) return "period";
    if (sets.peak.has(isoDate)) return "peak";
    if (sets.fertile.has(isoDate)) return "fertile";
    if (sets.pms.has(isoDate)) return "pms";
    return "normal";
  }

  /* ============================================================
     INFO PANEL RENDERER
     ============================================================ */

  function renderInfoPanel() {
    const panel = document.getElementById("info-panel");
    if (!panel) return;

    const cycle = getCycleForMonth(_year, _month, _cycleData);

    if (!cycle) {
      panel.innerHTML = `<p class="info-panel__empty">No cycle data for this month.<br>
        Navigate back to the projected range.</p>`;
      return;
    }

    panel.innerHTML = `
      <div class="info-panel__card">
        <h3 class="info-panel__title">Cycle ${cycle.cycleNumber} overview</h3>

        <div class="info-panel__row">
          <span class="info-panel__icon" aria-hidden="true">🩸</span>
          <div>
            <div class="info-panel__label">Next period expected</div>
            <div class="info-panel__value">${formatDate(cycle.nextCycleStart)}</div>
          </div>
        </div>

        <div class="info-panel__row">
          <span class="info-panel__icon" aria-hidden="true">🥚</span>
          <div>
            <div class="info-panel__label">Estimated ovulation</div>
            <div class="info-panel__value">${formatDate(cycle.ovulationDay)}</div>
          </div>
        </div>

        <div class="info-panel__row">
          <span class="info-panel__icon" aria-hidden="true">🌱</span>
          <div>
            <div class="info-panel__label">Fertile window</div>
            <div class="info-panel__value">${formatDateRange(cycle.fertileWindowStart, cycle.fertileWindowEnd)}</div>
          </div>
        </div>

        <div class="info-panel__row info-panel__row--peak">
          <span class="info-panel__icon" aria-hidden="true">🤰</span>
          <div>
            <div class="info-panel__label">Best days for conception</div>
            <div class="info-panel__value">${formatDateRange(cycle.peakDays[0], cycle.peakDays[1])}</div>
            <div class="info-panel__note">Highest chance of conception</div>
          </div>
        </div>

        <div class="info-panel__row">
          <span class="info-panel__icon" aria-hidden="true">😣</span>
          <div>
            <div class="info-panel__label">PMS window</div>
            <div class="info-panel__value">${formatDateRange(cycle.pmsStart, cycle.pmsEnd)}</div>
          </div>
        </div>

        <p class="info-panel__disclaimer">
          ⚠️ Calendar-based estimates only — <strong>not medical advice</strong>
          and <strong>not a reliable method of contraception</strong>.
          Consult a healthcare professional for guidance.
        </p>
      </div>`;
  }

  /* ============================================================
     CALENDAR GRID RENDERER
     ============================================================ */

  function render() {
    const container = document.getElementById(_containerId);
    if (!container) {
      console.warn("calendar.js: container not found:", _containerId);
      return;
    }

    const sets = _sets;
    const year = _year;
    const month = _month;
    const today = todayISO();
    const firstWeekday = new Date(year, month, 1).getDay();    // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthLabel = `${MONTH_NAMES[month]} ${year}`;

    /* ----- Day-of-week header row ----- */
    const headerCells = DAY_HEADERS.map(function (name) {
      return `<div class="cal-dow" role="columnheader" aria-label="${name}">${name}</div>`;
    }).join("");

    /* ----- Leading empty cells ----- */
    const emptyCells = Array.from({ length: firstWeekday }, function () {
      return `<div class="cal-day cal-day--empty" aria-hidden="true"></div>`;
    }).join("");

    /* ----- Day cells ----- */
    const dayCells = Array.from({ length: daysInMonth }, function (_, i) {
      const day = i + 1;
      const iso = toISO(year, month, day);
      const type = classifyDay(iso, sets);

      const isToday = iso === today;
      const isOvulation = sets.ovulation.has(iso);
      const isPeak = type === "peak";

      // Human-readable label for screen readers
      const typeLabel = {
        period: "period day",
        fertile: "fertile day",
        peak: isOvulation ? "ovulation day (peak)" : "peak fertile day",
        pms: "PMS window",
        normal: "",
      }[type];

      const ariaLabel = [
        `${MONTH_NAMES[month]} ${day}`,
        typeLabel,
        isToday ? "today" : "",
      ].filter(Boolean).join(", ");

      // Badge: ● ovulation day, ★ other peak day;
      // For non-peak cells: distinct shapes so color-blind users can identify phases
      // without relying on color alone. All badges are aria-hidden (cell aria-label
      // already names the phase for screen readers).
      let badge = "";
      if (isOvulation) {
        badge = `<span class="cal-badge cal-badge--ovulation" aria-hidden="true" title="Ovulation day">●</span>`;
      } else if (isPeak) {
        badge = `<span class="cal-badge cal-badge--peak" aria-hidden="true" title="Peak fertile day">★</span>`;
      } else if (type === "period") {
        badge = `<span class="cal-badge cal-badge--period-a11y" aria-hidden="true">◆</span>`;
      } else if (type === "fertile") {
        badge = `<span class="cal-badge cal-badge--fertile-a11y" aria-hidden="true">◇</span>`;
      } else if (type === "pms") {
        badge = `<span class="cal-badge cal-badge--pms-a11y" aria-hidden="true">▲</span>`;
      }

      return `<div class="cal-day cal-day--${type}${isToday ? " cal-day--today" : ""}"
                   role="gridcell"
                   aria-label="${ariaLabel}"
                   data-date="${iso}">
                <span class="cal-day-num">${day}</span>
                ${badge}
              </div>`;
    }).join("");

    /* ----- Legend ----- */
    const legend = `
      <div class="cal-legend" role="list" aria-label="Calendar colour legend">
        <div class="cal-legend-item" role="listitem">
          <span class="cal-legend-swatch cal-legend-swatch--period" aria-hidden="true"></span>
          <span>Period <span class="cal-legend-symbol" aria-hidden="true">◆</span></span>
        </div>
        <div class="cal-legend-item" role="listitem">
          <span class="cal-legend-swatch cal-legend-swatch--fertile" aria-hidden="true"></span>
          <span>Fertile window <span class="cal-legend-symbol" aria-hidden="true">◇</span></span>
        </div>
        <div class="cal-legend-item" role="listitem">
          <span class="cal-legend-swatch cal-legend-swatch--peak" aria-hidden="true"></span>
          <span>Peak days ★ ● <em>(best for conception)</em></span>
        </div>
        <div class="cal-legend-item" role="listitem">
          <span class="cal-legend-swatch cal-legend-swatch--pms" aria-hidden="true"></span>
          <span>PMS window <span class="cal-legend-symbol" aria-hidden="true">▲</span></span>
        </div>
      </div>`;

    /* ----- Assemble ----- */
    container.innerHTML = `
      <div class="cal-wrapper">
        <div class="cal-header">
          <button class="cal-nav" id="cal-prev" aria-label="Go to previous month">&#8249;</button>
          <h3 class="cal-month-title" aria-live="polite" aria-atomic="true">${monthLabel}</h3>
          <button class="cal-nav" id="cal-next" aria-label="Go to next month">&#8250;</button>
        </div>

        <div class="cal-grid" role="grid" aria-label="${monthLabel} calendar">
          ${headerCells}
          ${emptyCells}
          ${dayCells}
        </div>

        ${legend}
      </div>`;

    /* ----- Wire navigation ----- */
    document.getElementById("cal-prev").addEventListener("click", function () {
      _month--;
      if (_month < 0) { _month = 11; _year--; }
      render();
      renderInfoPanel();
    });

    document.getElementById("cal-next").addEventListener("click", function () {
      _month++;
      if (_month > 11) { _month = 0; _year++; }
      render();
      renderInfoPanel();
    });
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */

  /**
   * Initialise (or reinitialise) the calendar and info panel.
   * Starts on the month of the first cycle's start date.
   *
   * @param {string} containerId  ID of the DOM element for the grid
   * @param {Array}  cycleData    Return value of calculateCycles()
   */
  window.initCalendar = function (containerId, cycleData) {
    if (!cycleData || cycleData.length === 0) {
      console.warn("calendar.js: no cycle data provided");
      return;
    }

    // Append T00:00:00 to avoid UTC-offset interpretation on some browsers
    const startDate = new Date(cycleData[0].cycleStart + "T00:00:00");

    _containerId = containerId;
    _year = startDate.getFullYear();
    _month = startDate.getMonth();
    _sets = buildSets(cycleData);
    _cycleData = cycleData;

    render();
    renderInfoPanel();
  };

})();

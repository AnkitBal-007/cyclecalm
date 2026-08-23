/**
 * app.js
 *
 * Phase 3: Form wiring + client-side validation.
 * Phase 4: Calls initCalendar(), reveals calendar section.
 * Phase 6: localStorage persistence (save / load / clear). No auto-submit on load.
 */

console.log("app loaded");

/* ============================================================
   CONSTANTS
   ============================================================ */

const STORAGE_KEY = "cyclecalm_prefs";

/* ============================================================
   DOM REFERENCES
   ============================================================ */

const form              = document.getElementById("cycle-form");
const lastPeriodEl      = document.getElementById("last-period");
const cycleLengthEl     = document.getElementById("cycle-length");
const periodLengthEl    = document.getElementById("period-length");

const lastPeriodErr     = document.getElementById("last-period-error");
const cycleLengthErr    = document.getElementById("cycle-length-error");
const periodLengthErr   = document.getElementById("period-length-error");

const calendarSection   = document.getElementById("calendar-section");
const clearDataBtn      = document.getElementById("clear-data-btn");

/* ============================================================
   LOCALSTORAGE — save / load / clear
   All wrapped in try/catch: private-browsing contexts may reject
   localStorage calls with a SecurityError.
   ============================================================ */

function savePrefs(values) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch (err) {
    console.warn("CycleCalm: could not save to localStorage —", err.message);
  }
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("CycleCalm: could not read from localStorage —", err.message);
    return null;
  }
}

function clearPrefs() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("CycleCalm: could not clear localStorage —", err.message);
  }
}

/* Pre-fill form from localStorage on page load (no auto-submit). */
(function prefillOnLoad() {
  const prefs = loadPrefs();
  if (!prefs) return;
  if (prefs.lastPeriodStart) lastPeriodEl.value  = prefs.lastPeriodStart;
  if (prefs.cycleLength)     cycleLengthEl.value  = String(prefs.cycleLength);
  if (prefs.periodLength)    periodLengthEl.value = String(prefs.periodLength);
})();

/* ============================================================
   VALIDATION HELPERS
   ============================================================ */

function clearError(inputEl, errorEl) {
  inputEl.classList.remove("is-invalid");
  errorEl.textContent = "";
}

function showError(inputEl, errorEl, message) {
  inputEl.classList.add("is-invalid");
  errorEl.textContent = message;
}

function validateForm() {
  clearError(lastPeriodEl,   lastPeriodErr);
  clearError(cycleLengthEl,  cycleLengthErr);
  clearError(periodLengthEl, periodLengthErr);

  let valid = true;
  const values = {};

  // Last period start (required)
  const rawDate = lastPeriodEl.value.trim();
  if (!rawDate) {
    showError(lastPeriodEl, lastPeriodErr, "Please enter the first day of your last period.");
    valid = false;
  } else {
    values.lastPeriodStart = rawDate;
  }

  // Cycle length (21–45)
  const cycleLength = parseInt(cycleLengthEl.value, 10);
  if (isNaN(cycleLength) || cycleLength < 21 || cycleLength > 45) {
    showError(cycleLengthEl, cycleLengthErr, "Cycle length must be between 21 and 45 days.");
    valid = false;
  } else {
    values.cycleLength = cycleLength;
  }

  // Period length (2–10)
  const periodLength = parseInt(periodLengthEl.value, 10);
  if (isNaN(periodLength) || periodLength < 2 || periodLength > 10) {
    showError(periodLengthEl, periodLengthErr, "Period length must be between 2 and 10 days.");
    valid = false;
  } else {
    values.periodLength = periodLength;
  }

  return { valid, values };
}

/* ============================================================
   FORM SUBMIT HANDLER
   ============================================================ */

form.addEventListener("submit", function (e) {
  e.preventDefault();

  const { valid, values } = validateForm();
  if (!valid) return;

  // Persist valid values to localStorage
  savePrefs(values);

  // Calculate 6 projected cycles
  const cycles = calculateCycles(
    values.lastPeriodStart,
    values.cycleLength,
    values.periodLength,
    6
  );

  // Debug log
  console.group("📅 calculateCycles() result");
  cycles.forEach(function (cycle) {
    console.log(
      "Cycle " + cycle.cycleNumber + ":",
      "start=" + cycle.cycleStart,
      "period=" + cycle.periodDays[0] + "→" + cycle.periodDays.at(-1),
      "ovulation=" + cycle.ovulationDay,
      "fertile=" + cycle.fertileWindowStart + "→" + cycle.fertileWindowEnd,
      "peak=[" + cycle.peakDays.join(", ") + "]",
      "PMS=" + cycle.pmsStart + "→" + cycle.pmsEnd
    );
  });
  console.groupEnd();

  // Render calendar + info panel, reveal section
  initCalendar("calendar-container", cycles);
  calendarSection.classList.remove("hidden");
  calendarSection.scrollIntoView({ behavior: "smooth", block: "start" });
});

/* ============================================================
   CLEAR DATA BUTTON
   ============================================================ */

clearDataBtn.addEventListener("click", function () {
  clearPrefs();

  // Reset form to defaults
  lastPeriodEl.value    = "";
  cycleLengthEl.value   = "28";
  periodLengthEl.value  = "5";

  // Clear any active validation errors
  clearError(lastPeriodEl,   lastPeriodErr);
  clearError(cycleLengthEl,  cycleLengthErr);
  clearError(periodLengthEl, periodLengthErr);

  // Brief "Cleared!" feedback on the button
  const original = clearDataBtn.textContent;
  clearDataBtn.textContent = "Cleared!";
  clearDataBtn.disabled = true;
  setTimeout(function () {
    clearDataBtn.textContent = original;
    clearDataBtn.disabled = false;
  }, 2000);
});

/* ============================================================
   REAL-TIME: clear error as soon as the user starts correcting
   ============================================================ */

lastPeriodEl.addEventListener("input",   function () { clearError(lastPeriodEl,   lastPeriodErr); });
cycleLengthEl.addEventListener("input",  function () { clearError(cycleLengthEl,  cycleLengthErr); });
periodLengthEl.addEventListener("input", function () { clearError(periodLengthEl, periodLengthErr); });

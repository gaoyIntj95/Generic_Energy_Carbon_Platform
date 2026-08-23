export const ENERGY_ANALYSIS_CURRENT_YEAR = 2026;
export const ENERGY_ANALYSIS_REPORTED_MONTH = 6;

/** Current-year annual analysis uses the same reported-to-date cutoff as consumption query. */
export function effectiveAnalysisMonth(year: number, requestedMonth = 12) {
  if (year === ENERGY_ANALYSIS_CURRENT_YEAR) return ENERGY_ANALYSIS_REPORTED_MONTH;
  return Math.min(Math.max(requestedMonth, 1), 12);
}

export function isYearToDateAnalysis(year: number) {
  return effectiveAnalysisMonth(year) < 12;
}

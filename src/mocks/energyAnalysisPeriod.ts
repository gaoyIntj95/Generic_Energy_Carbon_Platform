import { listV11EnergyRecords } from './dataManagementV11Store';

function recordReportsMonth(record: ReturnType<typeof listV11EnergyRecords>[number], monthIndex: number) {
  if (record.entryMode !== 'monthly') return false;
  return record.monthlyReportedMonths?.[monthIndex] ?? (record.monthlyAmounts[monthIndex] ?? 0) !== 0;
}

export function getLatestAnalysisYear() {
  const years = listV11EnergyRecords().map((record) => record.year).filter(Number.isFinite);
  return years.length ? Math.max(...years) : new Date().getFullYear();
}

/** Current-year cutoff: the last continuously reported month from January. */
export function getLatestReportedMonth(year = getLatestAnalysisYear()) {
  const enterpriseRecords = listV11EnergyRecords().filter((record) =>
    record.year === year && record.scopeLevel === '企业' && record.energyRole === '能源消费');
  if (!enterpriseRecords.length) {
    return year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
  }
  let latest = 0;
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    if (!enterpriseRecords.every((record) => recordReportsMonth(record, monthIndex))) break;
    latest = monthIndex + 1;
  }
  if (latest > 0) return latest;
  return year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
}

export function listAnalysisYears() {
  const years = [...new Set(listV11EnergyRecords().map((record) => record.year))].sort((a, b) => b - a);
  return years.length ? years : [getLatestAnalysisYear()];
}

export const ENERGY_ANALYSIS_CURRENT_YEAR = getLatestAnalysisYear();
export const ENERGY_ANALYSIS_REPORTED_MONTH = getLatestReportedMonth(ENERGY_ANALYSIS_CURRENT_YEAR);
export const ENERGY_ANALYSIS_DEFAULT_MONTH = `${ENERGY_ANALYSIS_CURRENT_YEAR}-${String(ENERGY_ANALYSIS_REPORTED_MONTH).padStart(2, '0')}`;

/** Current-year annual analysis uses the same reported-to-date cutoff as consumption query. */
export function effectiveAnalysisMonth(year: number, requestedMonth = 12) {
  if (year === ENERGY_ANALYSIS_CURRENT_YEAR) return ENERGY_ANALYSIS_REPORTED_MONTH;
  return Math.min(Math.max(requestedMonth, 1), 12);
}

export function isYearToDateAnalysis(year: number) {
  return effectiveAnalysisMonth(year) < 12;
}

import {
  listV11EnergyRecords,
  listV11EnergyTypes,
  v11EnergyRecordAnnualAmount,
  v11RecordScopeType,
} from './dataManagementV11Store';
import { listEnergyUnits } from './energyUnitMockStore';
import type { EnergyQueryDataset, EnergyQueryRow } from './energyAnalysisV4Mock';

const colors = ['#2878FF', '#14AA72', '#FF8A00', '#7657F6', '#8D98A8'];
const ENERGY_CONSUMPTION_ROLE = listV11EnergyRecords()[0]?.energyRole;
export const ENERGY_QUERY_CURRENT_YEAR = 2026;
export const ENERGY_QUERY_REPORTED_MONTH = 6;

function standardCoalAmount(amount: number, energyTypeId: string) {
  const type = listV11EnergyTypes().find((item) => item.energyTypeId === energyTypeId);
  if (!type) return 0;
  const converted = amount * type.standardCoalFactor;
  return type.standardCoalFactorUnit.startsWith('kgce') ? converted / 1000 : converted;
}

function amountAt(record: ReturnType<typeof listV11EnergyRecords>[number], period: 'month' | 'year', month: number) {
  if (period === 'month') return record.monthlyAmounts[month - 1] ?? 0;
  if (month < 12) return record.monthlyAmounts.slice(0, month).reduce((sum, value) => sum + value, 0);
  return v11EnergyRecordAnnualAmount(record);
}

function datasetForPeriod(year: number, period: 'month' | 'year', month: number, energyUnitId?: string) {
  const effectiveMonth = period === 'year' && year === ENERGY_QUERY_CURRENT_YEAR
    ? ENERGY_QUERY_REPORTED_MONTH
    : month;
  const types = listV11EnergyTypes();
  const units = listEnergyUnits();
  const records = listV11EnergyRecords().filter((record) => (
    record.year === year
    && record.energyRole === ENERGY_CONSUMPTION_ROLE
    && v11RecordScopeType(record) !== 'device'
    && (energyUnitId
      ? record.energyUnitId === energyUnitId
      : v11RecordScopeType(record) === 'enterprise')
  ));
  const total = records.reduce((sum, record) => sum + standardCoalAmount(amountAt(record, period, effectiveMonth), record.energyTypeId), 0);
  const grouped = new Map<string, { amount: number; standardCoal: number; unitName: string }>();
  records.forEach((record) => {
    const type = types.find((item) => item.energyTypeId === record.energyTypeId);
    if (!type) return;
    const key = `${record.energyUnitId ?? 'enterprise'}:${record.energyTypeId}`;
    const item = grouped.get(key) ?? { amount: 0, standardCoal: 0, unitName: units.find((unit) => unit.energyUnitId === record.energyUnitId)?.energyUnitName ?? '全企业' };
    const amount = amountAt(record, period, effectiveMonth);
    item.amount += amount;
    item.standardCoal += standardCoalAmount(amount, record.energyTypeId);
    grouped.set(key, item);
  });
  const rows: EnergyQueryRow[] = [...grouped.entries()].map(([key, item]) => {
    const [, energyTypeId] = key.split(':');
    const type = types.find((entry) => entry.energyTypeId === energyTypeId)!;
    return {
      energyQueryRowId: `calculated:${year}:${period}:${effectiveMonth}:${key}`,
      energyUnitName: item.unitName,
      analysisCategory: type.analysisCategory,
      energyTypeName: type.energyTypeName,
      physicalAmount: item.amount,
      measurementUnit: type.measurementUnit,
      standardCoalAmount: item.standardCoal,
      share: total ? item.standardCoal / total * 100 : 0,
      yearOnYear: 0,
      ...(period === 'month' ? { monthOnMonth: 0 } : {}),
      dailyDataAvailable: false,
      sourceDescription: `数据管理｜能源数据｜${item.unitName}｜${type.energyTypeName}｜${year}${period === 'month' ? `年${month}月` : year === ENERGY_QUERY_CURRENT_YEAR ? `年1—${effectiveMonth}月累计` : '年度'}`,
    };
  }).sort((a, b) => b.standardCoalAmount - a.standardCoalAmount);
  const structure = new Map<string, number>();
  rows.forEach((row) => structure.set(row.energyTypeName, (structure.get(row.energyTypeName) ?? 0) + row.standardCoalAmount));
  return { total, rows, structure: [...structure.entries()].map(([label, amount], index) => ({ color: colors[index % colors.length], label, amount, share: total ? amount / total * 100 : 0 })) };
}

export function buildEnergyQueryDataset({ year, period, month = 6, energyUnitId }: { year: number; period: 'month' | 'year'; month?: number; energyUnitId?: string }): EnergyQueryDataset {
  const current = datasetForPeriod(year, period, month, energyUnitId);
  const comparisonMonth = period === 'year' && year === ENERGY_QUERY_CURRENT_YEAR
    ? ENERGY_QUERY_REPORTED_MONTH
    : month;
  const previous = datasetForPeriod(year - 1, period, comparisonMonth, energyUnitId);
  const previousPeriod = period === 'month' && month > 1 ? datasetForPeriod(year, 'month', month - 1, energyUnitId) : null;
  const rowKey = (row: EnergyQueryRow) => row.energyQueryRowId.split(':').at(-1) ?? '';
  const rows = current.rows.map((row) => {
    const key = rowKey(row);
    const previousRow = previous.rows.find((item) => rowKey(item) === key);
    const previousMonthRow = previousPeriod?.rows.find((item) => rowKey(item) === key);
    return {
      ...row,
      yearOnYear: previousRow?.standardCoalAmount ? (row.standardCoalAmount - previousRow.standardCoalAmount) / previousRow.standardCoalAmount * 100 : 0,
      ...(period === 'month' ? {
        monthOnMonth: previousMonthRow?.standardCoalAmount ? (row.standardCoalAmount - previousMonthRow.standardCoalAmount) / previousMonthRow.standardCoalAmount * 100 : 0,
      } : {}),
    };
  });
  const values = period === 'month'
    ? Array.from({ length: month }, (_, index) => datasetForPeriod(year, 'month', index + 1, energyUnitId).total)
    : Array.from({ length: 5 }, (_, index) => {
      const trendYear = year - 4 + index;
      return datasetForPeriod(trendYear, 'year', trendYear === ENERGY_QUERY_CURRENT_YEAR ? ENERGY_QUERY_REPORTED_MONTH : 12, energyUnitId).total;
    });
  const labels = period === 'month'
    ? Array.from({ length: month }, (_, index) => `${index + 1}月`)
    : Array.from({ length: 5 }, (_, index) => {
      const trendYear = year - 4 + index;
      return trendYear === ENERGY_QUERY_CURRENT_YEAR ? `${trendYear}年（截至${ENERGY_QUERY_REPORTED_MONTH}月）` : `${trendYear}年`;
    });
  return {
    total: current.total,
    yearOnYear: previous.total ? (current.total - previous.total) / previous.total * 100 : 0,
    ...(period === 'month' ? { monthOnMonth: previousPeriod?.total ? (current.total - previousPeriod.total) / previousPeriod.total * 100 : 0 } : {}),
    trend: values,
    labels,
    structure: current.structure,
    rows,
  };
}

export function getEnergyQueryMonthlyAmounts(row: EnergyQueryRow) {
  const parts = row.energyQueryRowId.split(':');
  const year = Number(parts[1]);
  const energyUnitId = parts[4] === 'enterprise' ? null : parts[4];
  const energyTypeId = parts[5];
  const records = listV11EnergyRecords().filter((record) =>
    record.year === year
    && record.energyRole === ENERGY_CONSUMPTION_ROLE
    && v11RecordScopeType(record) !== 'device'
    && record.energyUnitId === energyUnitId
    && record.energyTypeId === energyTypeId);
  const monthCount = year === ENERGY_QUERY_CURRENT_YEAR ? ENERGY_QUERY_REPORTED_MONTH : 12;
  return {
    physical: records.reduce((months, record) => months.map((value, index) => value + (record.monthlyAmounts[index] ?? 0)), Array(monthCount).fill(0) as number[]),
    standardCoal: records.reduce((months, record) => months.map((value, index) => value + standardCoalAmount(record.monthlyAmounts[index] ?? 0, record.energyTypeId)), Array(monthCount).fill(0) as number[]),
  };
}

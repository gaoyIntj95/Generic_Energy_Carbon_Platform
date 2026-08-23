import type { FlowPeriod } from './energyFlowSelector';

export type BalanceTaskStatus = '待核查' | '处理中' | '已完成';

export interface BalanceTaskRecord {
  status: BalanceTaskStatus;
  handlingNote: string;
  completionEvidence: string;
  completedAt?: string;
}

const taskRecords = new Map<string, BalanceTaskRecord>();

function taskKey(period: FlowPeriod, energyUnitId: string) {
  return `${period.year}:${period.grain}:${period.grain === 'month' ? period.month : 'year'}:${energyUnitId}`;
}

export function listBalanceTaskStatuses(period: FlowPeriod) {
  const prefix = `${period.year}:${period.grain}:${period.grain === 'month' ? period.month : 'year'}:`;
  return Object.fromEntries([...taskRecords.entries()]
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, record]) => [key.slice(prefix.length), record.status]));
}

export function saveBalanceTaskStatus(period: FlowPeriod, energyUnitId: string, status: BalanceTaskStatus) {
  const key = taskKey(period, energyUnitId);
  const previous = taskRecords.get(key);
  taskRecords.set(key, {
    status,
    handlingNote: previous?.handlingNote ?? '',
    completionEvidence: previous?.completionEvidence ?? '',
    completedAt: status === '已完成' ? previous?.completedAt ?? new Date().toLocaleString('zh-CN', { hour12: false }) : undefined,
  });
}

export function listBalanceTaskRecords(period: FlowPeriod) {
  const prefix = `${period.year}:${period.grain}:${period.grain === 'month' ? period.month : 'year'}:`;
  return Object.fromEntries([...taskRecords.entries()]
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, record]) => [key.slice(prefix.length), record]));
}

export function saveBalanceTaskRecord(period: FlowPeriod, energyUnitId: string, record: BalanceTaskRecord): BalanceTaskRecord {
  const savedRecord = {
    ...record,
    completedAt: record.status === '已完成'
      ? record.completedAt ?? new Date().toLocaleString('zh-CN', { hour12: false })
      : undefined,
  };
  taskRecords.set(taskKey(period, energyUnitId), savedRecord);
  return savedRecord;
}

export function resetBalanceOptimizationStore() {
  taskRecords.clear();
}

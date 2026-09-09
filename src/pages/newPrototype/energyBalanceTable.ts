import type { FlowLevelOneBalanceRow } from '../../mocks/energyFlowSelector';

export const balanceSourceColumns = [
  { key: 'externalInputStandardAmount', label: '外部输入', note: '从企业外部购入或调入的能源' },
  { key: 'internalRecoveryStandardAmount', label: '过程回收', note: '生产过程中回收并作为回收装置投入的余热、余压等' },
  { key: 'conversionOutputStandardAmount', label: '转换产出', note: '发电、供汽、空压及回收装置产出的能源' },
] as const;

export const balanceUseColumns = [
  { key: 'conversionInputStandardAmount', label: '转换投入', note: '用于发电、供汽、空压及回收装置的能源' },
  { key: 'distributionStandardAmount', label: '用能单元消耗', note: '已归集到一级用能单元的能源消耗' },
  { key: 'externalOutputStandardAmount', label: '对外输出', note: '供应企业外部的能源' },
  { key: 'confirmedConversionLossStandardAmount', label: '已确认损失', note: '台账已登记的转换损失，不以投入产出差额推定' },
] as const;

const columns = [...balanceSourceColumns, ...balanceUseColumns];

// 与两位小数的显示精度一致；仅用于本表提示，不作为计量允差。
export function roundedBalanceAmount(amount: number) {
  const magnitude = Math.round((Math.abs(amount) + Number.EPSILON) * 100) / 100;
  return magnitude === 0 ? 0 : Math.sign(amount) * magnitude;
}

export function formatBalanceAmount(amount: number, signed = false) {
  const rounded = roundedBalanceAmount(amount);
  return `${signed && rounded > 0 ? '+' : ''}${rounded.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function balanceRow(row: FlowLevelOneBalanceRow) {
  const sourceTotal = balanceSourceColumns.reduce((total, column) => total + row[column.key], 0);
  const useTotal = balanceUseColumns.reduce((total, column) => total + row[column.key], 0);
  const difference = sourceTotal - useTotal;
  const displayedDifference = roundedBalanceAmount(difference);
  const status = displayedDifference > 0 ? '待分配' : displayedDifference < 0 ? '超分配'
    : columns.every((column) => roundedBalanceAmount(row[column.key]) === 0) ? '无可核对量' : '收支相符';
  return { ...row, sourceTotal, useTotal, difference, status };
}

export function buildEnergyBalanceTable(sourceRows: FlowLevelOneBalanceRow[]) {
  const rows = sourceRows.map(balanceRow);
  // 按未舍入的分项求合计，避免将已格式化的字符串再次求和。
  const totals = {
    sourceValues: balanceSourceColumns.map((column) => rows.reduce((total, row) => total + row[column.key], 0)),
    useValues: balanceUseColumns.map((column) => rows.reduce((total, row) => total + row[column.key], 0)),
    sourceTotal: rows.reduce((total, row) => total + row.sourceTotal, 0),
    useTotal: rows.reduce((total, row) => total + row.useTotal, 0),
    difference: rows.reduce((total, row) => total + row.difference, 0),
  };
  const pendingRows = rows.filter((row) => row.status === '待分配');
  const excessRows = rows.filter((row) => row.status === '超分配');
  const issueRows = [...pendingRows, ...excessRows];
  const totalStatus = issueRows.length ? '分项待核对' : rows.some((row) => row.status === '收支相符') ? '收支相符' : '无可核对量';
  return { rows, totals, issueRows, totalStatus };
}

export function energyBalanceCsvRows(sourceRows: FlowLevelOneBalanceRow[], scopeLabel: string): (string | number)[][] {
  const { rows, totals, totalStatus } = buildEnergyBalanceTable(sourceRows);
  return [
    ['分析范围', scopeLabel],
    ['单位', '吨标准煤（tce）'],
    ['能源品种', ...balanceSourceColumns.map((column) => column.label), '来源合计', ...balanceUseColumns.map((column) => column.label), '去向合计', '收支差额', '核对结果'],
    ...rows.map((row) => [row.energyTypeName, ...balanceSourceColumns.map((column) => formatBalanceAmount(row[column.key])), formatBalanceAmount(row.sourceTotal), ...balanceUseColumns.map((column) => formatBalanceAmount(row[column.key])), formatBalanceAmount(row.useTotal), formatBalanceAmount(row.difference, true), row.status]),
    ['分项合计', ...totals.sourceValues.map((value) => formatBalanceAmount(value)), formatBalanceAmount(totals.sourceTotal), ...totals.useValues.map((value) => formatBalanceAmount(value)), formatBalanceAmount(totals.useTotal), formatBalanceAmount(totals.difference, true), totalStatus],
    ['核对口径', '收支差额 = 来源合计 − 已登记去向合计；正值待分配，负值超分配，不代表物理损失。'],
    ['合计说明', '包含厂内转换与回收过程，不等同于企业外购能源或综合能耗；分项正负差额不相互抵消判定。'],
    ['显示精度', '保留两位小数；差额提示按相同精度判断，不作为计量允差。'],
  ];
}

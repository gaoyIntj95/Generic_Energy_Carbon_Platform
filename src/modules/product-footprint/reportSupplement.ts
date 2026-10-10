export const reportSupplementFields = [
  { key: 'companyName', label: '企业名称', required: true },
  { key: 'standard', label: '核算依据', required: true, hint: '填写实际采用的标准名称及版本；如适用，也写明 PCR。' },
  { key: 'gwpVersion', label: 'GWP 来源版本', readOnly: true },
  { key: 'gwpHorizon', label: 'GWP 时间尺度', readOnly: true },
  { key: 'productionAddress', label: '生产地址' },
  { key: 'dataLimitations', label: '数据局限及其影响', required: true, multiline: true, hint: '据实说明估算、数据库因子或分配方法可能怎样影响结果。' },
] as const;

export type ReportFieldKey = typeof reportSupplementFields[number]['key'];
export const defaultGwp = { gwpVersion: 'AR6', gwpHorizon: '100 年（GWP100）' } as const;
export type ProductReportInfo = {
  values: Record<ReportFieldKey, string>;
  reportDate: string;
};

export function emptyProductReportInfo(): ProductReportInfo {
  return {
    values: { ...Object.fromEntries(reportSupplementFields.map(({ key }) => [key, ''])), ...defaultGwp } as ProductReportInfo['values'],
    reportDate: '',
  };
}

export function missingReportFields(info: ProductReportInfo) {
  return reportSupplementFields.filter((field) => 'required' in field && !info.values[field.key].trim());
}

export function normalizeReportInfo(info: ProductReportInfo): ProductReportInfo {
  return {
    values: { ...Object.fromEntries(reportSupplementFields.map(({ key }) => [key, info.values[key].trim()])), ...defaultGwp } as ProductReportInfo['values'],
    reportDate: new Date().toLocaleDateString('sv-SE'),
  };
}

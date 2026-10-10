export const cutoffExample = `示例：
本报告以 1 m³ HMX-180 规整填料为功能单位。原材料、制造和产品配送环节均执行取舍评估：单项辅材质量占产品质量不足 1%，合计占比为 1.5%，因此未纳入上游生产数据；粉煤灰、矿渣等低价值废物原料不追溯其上游环境负荷；厂房、生产设备和生活设施等资本性资产排放不计入。
已知且属于本次环境影响评价范围的排放数据不予取舍。配送环节中，对单次且无法可靠追溯距离的零散运输记录予以剔除，剔除部分对应产品质量占配送总量约 3%。`;

export const allocationExample = `示例：
目标产品 HMX-180 为规整填料。原辅材料按照生产期间原辅料投入总量与合格填料总产量的比例折算，形成单位功能产品的物料消耗量及 BOM。
能源环节仅核算电力，包括填料车间直接用电和该车间使用压缩空气对应的空压机用电。空压机用电先按填料车间用电量占全厂用电量的比例分配至填料生产，再按 HMX-180 产量占填料总产量的比例分配至目标产品。
制造环节中，卷材冲压按合格率 89% 计入材料利用，11% 的边角料作为生产废料；不合格品按填料产品 4% 的平均不合格率折算目标产品报废量。`;

export const reportSupplementFields = [
  { key: 'cutoff', label: '取舍情况', section: '1）取舍情况', hint: '请说明实际取舍项目、占比和依据；不涉及取舍时请据实说明。', example: cutoffExample },
  { key: 'allocation', label: '多产品分配方法及依据', section: '2）多产品分配方法及依据', hint: '请填写多产品分配方法及依据；不涉及多产品分配时请据实说明。', example: allocationExample },
] as const;
export const uncertaintyGrades = [
  { value: 'A', label: 'A  优（平均分值 ≥ 5.0）' },
  { value: 'B', label: 'B  良（5.0 ＞ 平均分值 ≥ 4.0）' },
  { value: 'C', label: 'C  中（4.0 ＞ 平均分值 ≥ 3.0）' },
  { value: 'D', label: 'D  较低（3.0 ＞ 平均分值 ≥ 2.0）' },
  { value: 'E', label: 'E  低（平均分值 ＜ 2.0）' },
] as const;
export type ProductReportInfo = {
  values: Record<typeof reportSupplementFields[number]['key'] | 'uncertaintyGrade', string>;
  uncertaintyFile?: { name: string; dataUrl: string };
  reportDate: string;
};
export function emptyProductReportInfo(): ProductReportInfo {
  return { values: { cutoff: '', allocation: '', uncertaintyGrade: '' }, reportDate: '' };
}
export function missingReportFields(info: ProductReportInfo) {
  const missing: Array<{ key: string; label: string }> = reportSupplementFields.filter(field => !info.values[field.key].trim());
  if (!uncertaintyGrades.some(grade => grade.value === info.values.uncertaintyGrade)) missing.push({ key: 'uncertaintyGrade', label: '评价等级' });
  if (!info.uncertaintyFile) missing.push({ key: 'uncertaintyFile', label: '不确定性评价计算表' });
  return missing;
}
export function normalizeReportInfo(info: ProductReportInfo): ProductReportInfo {
  return { ...info, values: { cutoff: info.values.cutoff.trim(), allocation: info.values.allocation.trim(), uncertaintyGrade: info.values.uncertaintyGrade }, reportDate: new Date().toLocaleDateString('sv-SE') };
}

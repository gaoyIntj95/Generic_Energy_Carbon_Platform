export type ComplianceForecastMethod = '历史趋势预测' | '业务增长预测' | '自定义调整';

export interface ComplianceDemandForecast {
  forecastCycle: string;
  forecastScope: string;
  baselineEmission: number;
  expectedBusinessChangeRate: number;
  expectedReduction: number;
  forecastMethod: ComplianceForecastMethod;
  forecastEmission: number;
  availableCarbonAssets: number;
  expectedAssetGap: number;
  baselineSource: string;
  businessChangeSource: string;
  reductionSource: string;
  assetSource: string;
}

export type ComplianceDemandForecastInput = Omit<
  ComplianceDemandForecast,
  'forecastEmission' | 'expectedAssetGap'
>;

const roundToPlanningPrecision = (value: number) => Math.round(value / 1000) * 1000;

export function calculateComplianceDemandForecast(
  input: ComplianceDemandForecastInput,
): ComplianceDemandForecast {
  const businessAdjustedEmission =
    input.baselineEmission * (1 + input.expectedBusinessChangeRate / 100);
  const forecastEmission = Math.max(
    0,
    roundToPlanningPrecision(businessAdjustedEmission - input.expectedReduction),
  );

  return {
    ...input,
    forecastEmission,
    expectedAssetGap: Math.max(0, forecastEmission - input.availableCarbonAssets),
  };
}

export function createComplianceDemandForecastMock(): ComplianceDemandForecast {
  return calculateComplianceDemandForecast({
    forecastCycle: '2027年度',
    forecastScope: '全企业',
    baselineEmission: 98_500,
    expectedBusinessChangeRate: 1.1,
    expectedReduction: 500,
    forecastMethod: '业务增长预测',
    availableCarbonAssets: 95_000,
    baselineSource: '碳排放核算—2026年度正式核算结果',
    businessChangeSource: '数据管理—运营数据及企业生产计划',
    reductionSource: '企业节能改造、能源替代及减排计划（Mock）',
    assetSource: '碳资产台账—当前用于新周期规划的资产规模',
  });
}

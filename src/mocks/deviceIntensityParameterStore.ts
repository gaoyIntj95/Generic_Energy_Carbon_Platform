export type DeviceIntensityMetricCode = 'compressed-air-electricity' | 'boiler-standard-coal' | 'waste-heat-power-efficiency' | 'custom-device-work';

export interface DeviceIntensityTemplateConfig {
  metricCode: DeviceIntensityMetricCode;
  metricName: string;
  energyTypeId: string;
  denominatorName: string;
  denominatorUnit: string;
  metricUnit: string;
  formula: string;
}

export interface DeviceIntensityParameter {
  deviceId: string;
  year: number;
  metricCode: DeviceIntensityMetricCode;
  value: number;
  unit: string;
  source?: string;
}

export interface DeviceIntensityTemplateAssignment {
  deviceId: string;
  year: number;
  metricCode: DeviceIntensityMetricCode;
  config?: DeviceIntensityTemplateConfig;
}

let parameters: DeviceIntensityParameter[] = [
  {
    deviceId: 'v11-device-62',
    year: 2026,
    metricCode: 'compressed-air-electricity',
    value: 10080000,
    unit: 'Nm³',
    source: '设备运行台账—年度供气量',
  },
];
let templateAssignments: DeviceIntensityTemplateAssignment[] = [];

export function getDeviceIntensityParameter(deviceId: string, year: number, metricCode: DeviceIntensityMetricCode) {
  return parameters.find((item) => item.deviceId === deviceId && item.year === year && item.metricCode === metricCode);
}

export function saveDeviceIntensityParameter(input: DeviceIntensityParameter) {
  const index = parameters.findIndex((item) => item.deviceId === input.deviceId && item.year === input.year && item.metricCode === input.metricCode);
  if (index >= 0) parameters[index] = { ...input };
  else parameters.push({ ...input });
  return { ok: true as const };
}

export function getDeviceIntensityTemplate(deviceId: string, year: number) {
  return templateAssignments.find((item) => item.deviceId === deviceId && item.year === year)?.metricCode;
}

export function getDeviceIntensityTemplateConfig(deviceId: string, year: number) {
  return templateAssignments.find((item) => item.deviceId === deviceId && item.year === year)?.config;
}

export function saveDeviceIntensityTemplate(input: DeviceIntensityTemplateAssignment) {
  const index = templateAssignments.findIndex((item) => item.deviceId === input.deviceId && item.year === input.year);
  if (index >= 0) templateAssignments[index] = { ...input };
  else templateAssignments.push({ ...input });
  return { ok: true as const };
}

export function resetDeviceIntensityParameters() {
  parameters = [{ deviceId: 'v11-device-62', year: 2026, metricCode: 'compressed-air-electricity', value: 10080000, unit: 'Nm³', source: '设备运行台账—年度供气量' }];
  templateAssignments = [];
}

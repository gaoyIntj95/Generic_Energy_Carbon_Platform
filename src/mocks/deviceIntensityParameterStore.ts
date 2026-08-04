export type DeviceIntensityMetricCode = 'compressed-air-electricity' | 'boiler-standard-coal';

export interface DeviceIntensityParameter {
  deviceId: string;
  year: number;
  metricCode: DeviceIntensityMetricCode;
  value: number;
  unit: 'Nm³' | 't';
  source?: string;
}

let parameters: DeviceIntensityParameter[] = [];

export function getDeviceIntensityParameter(deviceId: string, year: number, metricCode: DeviceIntensityMetricCode) {
  return parameters.find((item) => item.deviceId === deviceId && item.year === year && item.metricCode === metricCode);
}

export function saveDeviceIntensityParameter(input: DeviceIntensityParameter) {
  const index = parameters.findIndex((item) => item.deviceId === input.deviceId && item.year === input.year && item.metricCode === input.metricCode);
  if (index >= 0) parameters[index] = { ...input };
  else parameters.push({ ...input });
  return { ok: true as const };
}

export function resetDeviceIntensityParameters() {
  parameters = [];
}

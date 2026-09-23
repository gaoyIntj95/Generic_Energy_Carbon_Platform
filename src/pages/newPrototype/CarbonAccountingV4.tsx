/* eslint-disable no-irregular-whitespace */
import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { FileDropzone } from '../../components/FileDropzone';
import {
  carbonFactorsV4,
  carbonFactorLibraryCategoryTree,
  carbonFactorLibraryChildCode,
  carbonFactorLibraryLookupTables,
  deleteTenantCustomCarbonFactorV4,
  getCarbonFactorV4,
  listCarbonFactorLibraryV4,
  listCarbonFactorsV4,
  listTenantCustomCarbonFactorsV4,
  saveTenantCustomCarbonFactorV4,
  saveCarbonFactorV4,
  supportBasicV4,
  type CarbonFactor,
  type CarbonFactorEvidenceFile,
  type CarbonFactorParameter,
  type TenantCustomCarbonFactor,
  type TenantCustomFactorAttachment,
  type TenantCustomFactorSourceType,
} from '../../mocks/carbonAccountingV4Mock';
import {
  deleteEmissionSource,
  getCarbonAccountingTask,
  listCarbonAccountingTasks,
  listCarbonSnapshots,
  listEmissionSources,
  latestCarbonSnapshotForTask,
  publishCarbonSnapshot,
  replaceEmissionSourcesForTask,
  saveCarbonAccountingTask,
  saveEmissionSource,
} from '../../mocks/platformMockStore';
import {
  createCarbonReportMock,
  listCarbonReportMocks,
  type CarbonReportBasicInfo,
  type CarbonReportRecord,
} from '../../mocks/carbonReportMock';
import type { CarbonAccountingTask, EmissionSource } from '../../types/platformDomain';
import { listV11EnergyRecords, listV11EnergyTypes, listV11KeyDevices, v11EnergyRecordAnnualAmount, v11RecordScopeType, type V11EnergyRecord } from '../../mocks/dataManagementV11Store';
import { listEnergyUnits } from '../../mocks/energyUnitMockStore';
import { downloadHtmlReport } from '../../utils/reportDownload';
import { EVIDENCE_FILE_ACCEPT, filterEvidenceFiles } from '../../utils/evidenceFile';
import styles from './CarbonAccountingV4.module.css';

type TaskState = 'draft' | 'confirmed' | 'pending';
type SourceMode = 'view' | 'edit';
type SupportItem = {
  id?: string;
  group: string;
  type?: string;
  item: string;
  activity: string;
  activityDataSources: string;
  materials: number;
  state: '待确认' | '待补充' | '已完成';
  emission?: EmissionSource;
  evidenceFiles?: { evidenceFileId: string; fileName: string; activityDataSource: string }[];
  supportRemark?: string;
};
type DialogState =
  | { kind: 'settings' | 'newSource' | 'enterpriseFactor' | 'importFactor' }
  | { kind: 'draftPreview'; year: number; sources: EmissionSource[] }
  | { kind: 'deleteSource'; row: EmissionSource }
  | { kind: 'deleteSupport'; item: SupportItem }
  | { kind: 'deleteSupportFile'; item: SupportItem; file: { evidenceFileId: string; fileName: string; activityDataSource: string } }
  | { kind: 'viewSupport'; item: SupportItem }
  | { kind: 'factorDetail'; factor: CarbonFactor; mode?: 'view' | 'edit' }
  | { kind: 'factorSelect'; row: EmissionSource }
  | { kind: 'completeUpdate' | 'cancelUpdate' }
  | null;
type DrawerState =
  | { kind: 'source'; row: EmissionSource; mode: SourceMode; factorId?: string }
  | { kind: 'support'; item: SupportItem; manage: boolean; upload?: boolean }
  | { kind: 'history' }
  | { kind: 'changes'; baseline: EmissionSource[]; draft: EmissionSource[]; version: number }
  | null;

const format = (value: number, digits = 2) =>
  value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const createTarBlob = (files: Array<{ name: string; content: string }>) => {
  const encoder = new TextEncoder();
  const blocks: Uint8Array[] = [];
  const writeText = (target: Uint8Array, offset: number, length: number, value: string) => {
    target.set(encoder.encode(value).slice(0, length), offset);
  };
  const writeOctal = (target: Uint8Array, offset: number, length: number, value: number) => {
    writeText(target, offset, length, value.toString(8).padStart(length - 1, '0') + '\0');
  };
  files.forEach((file) => {
    const content = encoder.encode(file.content);
    const header = new Uint8Array(512);
    writeText(header, 0, 100, file.name);
    writeOctal(header, 100, 8, 0o644);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, content.length);
    writeOctal(header, 136, 12, Math.floor(Date.now() / 1000));
    header.fill(32, 148, 156);
    header[156] = '0'.charCodeAt(0);
    writeText(header, 257, 6, 'ustar\0');
    writeText(header, 263, 2, '00');
    writeOctal(header, 148, 8, header.reduce((sum, byte) => sum + byte, 0));
    blocks.push(header, content);
    const remainder = content.length % 512;
    if (remainder) blocks.push(new Uint8Array(512 - remainder));
  });
  blocks.push(new Uint8Array(1024));
  return new Blob(blocks as BlobPart[], { type: 'application/x-tar' });
};

const numberFromActivity = (value: string) => Number(value.replace(/[^\d.]/g, '')) || 0;
const unitFromActivity = (value: string) =>
  value.match(/(人·天(?:\/年)?|万Nm³|Nm³|m³(?:\/年)?|MWh|GJ|kg|t·km|t)$/)?.[1] ?? 't';

const resultCategory = (emissionCategory: string) => {
  if (emissionCategory === '购入电力与热力产生的排放' || emissionCategory === '购入的电力与热力产生的排放') return 'purchased';
  if (['化石燃料燃烧排放', '生产过程排放', '废弃物处理处置排放', '逸散排放'].includes(emissionCategory)) return 'direct';
  return 'other';
};

const emissionCategoryDictionary = ['化石燃料燃烧排放', '生产过程排放', '废弃物处理处置排放', '逸散排放', '购入的电力与热力产生的排放', '交通运输产生的排放', '所使用的产品和服务隐含的排放', '所生产的产品和服务的排放', '其他排放', '特殊排放'];

const emissionScopeDictionary = [
  { id: 'scope-1', label: '范围一：直接排放', categories: ['化石燃料燃烧排放', '生产过程排放', '废弃物处理处置排放', '逸散排放'] },
  { id: 'scope-2', label: '范围二：间接排放', categories: ['购入的电力与热力产生的排放'] },
  { id: 'scope-3', label: '范围三：其他间接排放', categories: ['交通运输产生的排放', '所使用的产品和服务隐含的排放', '所生产的产品和服务的排放'] },
  { id: 'other', label: '其他排放', categories: ['其他排放'] },
  { id: 'special', label: '特殊排放', categories: ['特殊排放'] },
] as const;

const emissionSourceMapping: Record<string, Array<{ sourceType: string; sources: string[] }>> = {
  化石燃料燃烧排放: [
    { sourceType: '固定燃烧源', sources: ['电站锅炉', '燃气轮机', '工业锅炉', '熔炼炉'] },
    { sourceType: '移动燃烧源', sources: ['汽车', '火车', '船舶', '飞机'] },
  ],
  生产过程排放: [{ sourceType: '生产活动中的过程排放', sources: ['氧化铝回转炉', '合成氨造气炉', '水泥回转窑', '水泥立窑', '工艺放空'] }],
  废弃物处理处置排放: [{ sourceType: '废弃物处理处置过程排放', sources: ['污水处理系统', '石化、化工火炬系统'] }],
  逸散排放: [{ sourceType: '边界内逸散排放', sources: ['冷媒', '灭火器', '六氟化硫', '自定义'] }],
  购入的电力与热力产生的排放: [{ sourceType: '购入的电力与热力排放', sources: ['电加热炉窑', '电动机系统', '泵系统', '风机系统', '变压器、调压器', '压缩机', '制热设备', '制冷设备', '交流电焊机', '照明设备'] }],
  交通运输产生的排放: [{ sourceType: '运输活动排放', sources: ['飞机', '火车', '汽车', '船舶'] }],
  所使用的产品和服务隐含的排放: [{ sourceType: '采购的产品和服务隐含排放', sources: ['原材料', '制造设备生产商'] }],
  所生产的产品和服务的排放: [{ sourceType: '产品或服务使用阶段排放', sources: ['产品或服务'] }],
  其他排放: [{ sourceType: '其他边界外排放', sources: ['通勤', '差旅', '投资', '甲烷回收与销毁量', '二氧化碳回收利用量'] }],
  特殊排放: [
    { sourceType: '生物质燃料燃烧排放', sources: ['生物质燃料汽车', '生物质燃料飞机', '生物质锅炉'] },
    { sourceType: '温室气体清除（碳清除）', sources: ['钢铁、水泥等产品', '碳捕集、碳封存（人工）', '林业碳汇等（自然）'] },
  ],
};

type ValidationIssue = { emissionSourceId: string; message: string };

const validateInventory = (inventory: EmissionSource[]): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const duplicateKeys = new Set<string>();
  const seen = new Set<string>();
  inventory.forEach((row) => {
    const unit = row.activityData.match(/(人·天(?:\/年)?|万Nm³|Nm³|m³(?:\/年)?|MWh|GJ|kg\s*COD|kg|t·km|t)$/)?.[1];
    const factor = getCarbonFactorV4(row.emissionFactorId);
    const key = `${row.emissionGroup}|${row.sourceType}|${row.sourceName}`;
    if (!row.activityData || !Number.isFinite(numberFromActivity(row.activityData))) issues.push({ emissionSourceId: row.emissionSourceId, message: '活动数据缺失或无法识别' });
    if (!unit) issues.push({ emissionSourceId: row.emissionSourceId, message: '活动数据单位不完整' });
    if (!factor) issues.push({ emissionSourceId: row.emissionSourceId, message: '未匹配排放因子或计算参数' });
    if (factor && unit && !['processParameter', 'wastewaterParameter', 'recoveryParameter'].includes(factor.calculationType) && !factor.unit.includes(`/${unit}`) && !(unit === 't' && factor.unit.includes('/t'))) issues.push({ emissionSourceId: row.emissionSourceId, message: '活动数据单位与因子单位不匹配' });
    if (factor?.scope === 'enterprise') {
      const unitError = validateFactorUnit(factor.unit, unit);
      if (unitError) issues.push({ emissionSourceId: row.emissionSourceId, message: `自定义因子单位校验失败：${unitError}` });
    }
    if (!Number.isFinite(row.emissionAmount)) issues.push({ emissionSourceId: row.emissionSourceId, message: '排放量无法计算' });
    if (factor?.parameters?.some((parameter) => !Number.isFinite(Number(parameter.value)))) issues.push({ emissionSourceId: row.emissionSourceId, message: '参数化计算参数不完整' });
    if (seen.has(key)) duplicateKeys.add(key); else seen.add(key);
  });
  if (duplicateKeys.size) inventory.filter((row) => duplicateKeys.has(`${row.emissionGroup}|${row.sourceType}|${row.sourceName}`)).forEach((row) => issues.push({ emissionSourceId: row.emissionSourceId, message: '存在重复排放源记录' }));
  return issues;
};

const changed = (previous: EmissionSource, next: EmissionSource) =>
  previous.sourceType !== next.sourceType
  || previous.sourceName !== next.sourceName
  || previous.activityData !== next.activityData
  || previous.emissionFactorId !== next.emissionFactorId
  || previous.emissionAmount !== next.emissionAmount;

const calculationParameters = (factorId: string): CarbonFactorParameter[] =>
  getCarbonFactorV4(factorId)?.parameters?.map((item) => ({ ...item })) ?? [];

/**
 * All factor scenarios are rendered through this adapter. Public direct factors
 * do not always persist a parameter array, but they still need an auditable
 * breakdown in the factor and inventory detail views.
 */
const displayParameters = (factor: CarbonFactor): CarbonFactorParameter[] => {
  if (factor.parameters?.length) return factor.parameters.map((item) => ({ ...item }));
  const direct = (key: string, name: string, unit: string, sourceType = '结果因子', source = factor.source): CarbonFactorParameter => ({
    key, name, value: Number(factor.value) || 0, display: factor.value.replace(/^折算因子\s*/, ''), unit, sourceType, source, editable: false,
  });
  if (factor.factorId === 'pf-waste') return factor.parameters?.map((item) => ({ ...item })) ?? [];
  if (factor.factorId === 'pf-transport') return [direct('transportFactor', '运输排放因子', factor.unit, '标准推荐值')];
  if (factor.factorId === 'pf-r134a') return [direct('gwp', '制冷剂全球变暖潜势（GWP100）', factor.unit, '方法学常数', factor.source)];
  if (factor.factorId === 'pf-power') return [direct('powerFactor', '电力排放因子', factor.unit, '年度发布值')];
  if (factor.factorId === 'pf-heat') return [direct('heatFactor', '热力排放因子', factor.unit, '标准推荐值')];
  return [direct('resultFactor', '结果因子/折算值', factor.unit)];
};

const factorSummary = (row: EmissionSource, factorId = row.emissionFactorId) => {
  const factor = getCarbonFactorV4(factorId);
  if (!factor) return '—';
  if (factor.calculationType === 'processParameter') {
    const activity = Number(row.activityValue);
    const effectiveValue = activity > 0 ? row.emissionAmount / activity : 0;
    return `${Number(effectiveValue.toFixed(6))} ${factor.gas}/${row.activityUnit}`;
  }
  if (factor.calculationType === 'wastewaterParameter') {
    const parameters = new Map((factor.parameters ?? []).map((parameter) => [parameter.key, parameter.value]));
    const factorValue = (parameters.get('bo') ?? 0.25) * (parameters.get('mcf') ?? 0) * (parameters.get('gwp') ?? 21) / 1000;
    return `${format(factorValue, 3)} tCO₂e/kg COD`;
  }
  if (factor.calculationType === 'recoveryParameter') return factor.factorId === 'pf-ch4-recovery' ? '回收量 × 浓度 × 密度 × 效率' : '回收量 × CO₂纯度 × 密度';
  return `${factor.value.replace(/^折算因子\s*/, '')} ${factor.unit}`;
};

const factorNameForRow = (row: EmissionSource) => getCarbonFactorV4(row.emissionFactorId)?.name ?? row.factorName;
const factorGasForRow = (factor: CarbonFactor) => factor.ghgType ?? factor.gas;

const isCompositeCalculationFactor = (factor?: CarbonFactor) => Boolean(
  factor && ['fuelParameter', 'processParameter', 'wastewaterParameter', 'recoveryParameter'].includes(factor.calculationType),
);

const calculationFactorDisplay = (row: EmissionSource, factorId = row.emissionFactorId) => {
  const factor = getCarbonFactorV4(factorId);
  if (!factor) return '待补充';
  if (factor.calculationType === 'wastewaterParameter' || factor.calculationType === 'recoveryParameter') return '综合核算';
  if (factor.factorId === 'pf-r134a') {
    const numericValue = Number(factor.value.replace(/^折算因子\s*/, ''));
    return Number.isFinite(numericValue) ? `GWP100：${format(numericValue * 1000, 0)} kgCO₂e/kg` : `GWP100：${factor.value}`;
  }
  return factorSummary(row, factorId);
};

const inventoryActivityDisplay = (activityData: string) => activityData.replace(/^原料消耗量[：:]\s*/, '');

const factorBriefText = (row: EmissionSource, factorId = row.emissionFactorId) => {
  const factor = getCarbonFactorV4(factorId);
  if (!factor) return '尚未匹配核算因子';
  const standard = factor.standard && !['官方缺省值', '方法学参数'].includes(factor.standard) ? factor.standard : '按适用核算方法';
  const source = `${factor.source}${factor.reference ? ` ${factor.reference}` : ''}`;
  const formula = isCompositeCalculationFactor(factor) || factor.factorId === 'pf-r134a' ? `\n计算关系：${factor.formula ?? '按核算参数计算'}` : '';
  return `因子名称：${factor.factorObject ?? factor.name}\n因子值：${calculationFactorDisplay(row, factorId)}\n标准与来源：${standard}；${source}${formula}`;
};

const isInternalCalculationParameter = (factor: CarbonFactor) =>
  factor.calculationType === 'parameter'
  || factor.objectType === '基础核算参数'
  || factor.objectType === '方法学常数'
  || Boolean(factor.libraryLookupKey)
  || factor.factorId.startsWith('p-');

const selectionContextText = (row: FactorSelectionRow) => `${row.emissionCategory ?? ''} ${row.sourceType ?? ''} ${row.sourceName ?? ''}`;

const factorSelectionCategory = (factor: CarbonFactor) => {
  if (factor.calculationScenario === 'purchasedElectricity') return '购入能源 · 电力';
  if (factor.calculationScenario === 'purchasedHeat') return '购入能源 · 热力';
  if (factor.calculationType === 'fuelParameter') return `化石燃料 · ${factor.factorObject ?? factor.activity}`;
  if (factor.calculationType === 'processParameter') return '碳酸盐';
  if (factor.calculationType === 'wastewaterParameter') return '工业废水';
  if (factor.factorId === 'pf-r134a') return '逸散排放 · 制冷剂 GWP100';
  if (factor.catalogCategory) return factor.catalogCategory;
  return factor.activity || '其他核算场景';
};

const scopeLabel = (category: 'direct' | 'purchased' | 'other') =>
  category === 'direct' ? '范围一：直接排放' : category === 'purchased' ? '范围二：购入能源间接排放' : '范围三：其他间接排放';

const normalizeUnit = (unit: string) => unit.trim().replace(/CO2/g, 'CO₂').replace(/\s+/g, '');

const validateFactorUnit = (unit: string, activityUnit?: string) => {
  const normalized = normalizeUnit(unit);
  const separator = normalized.indexOf('/');
  if (separator <= 0 || separator === normalized.length - 1) return '单位必须使用“排放量单位/活动数据单位”格式，例如 kgCO₂/Nm³。';
  const outputUnit = normalized.slice(0, separator);
  const inputUnit = normalized.slice(separator + 1);
  if (!/^(?:g|kg|t)CO₂e?$/.test(outputUnit) || !/^[\u4e00-\u9fa5A-Za-z0-9·³²/_-]+$/.test(inputUnit)) return '单位格式不正确，排放量单位应为 gCO₂、kgCO₂、tCO₂ 或对应 CO₂e 单位。';
  if (activityUnit && normalizeUnit(activityUnit) !== inputUnit) return `因子分母单位“${inputUnit}”与活动数据单位“${activityUnit}”不一致。`;
  return '';
};

const recalculate = (activity: number, unit: string, factor: CarbonFactor) => {
  const parameters = new Map((factor.parameters ?? []).map((parameter) => [parameter.key, parameter.value]));
  if (factor.calculationType === 'wastewaterParameter') {
    const cod = activity;
    const sludgeCod = parameters.get('sludgeCod') ?? 0;
    const bo = parameters.get('bo') ?? 0.25;
    const mcf = parameters.get('mcf') ?? 0;
    const gwp = parameters.get('gwp') ?? 21;
    return Math.max(cod - sludgeCod, 0) * bo * mcf * gwp / 1000;
  }
  if (factor.factorId === 'pf-ch4-recovery') {
    const density = 7.17;
    const selfUse = (parameters.get('selfUseVolume') ?? 0) * (parameters.get('selfUseConcentration') ?? 0) / 100 * density * (parameters.get('selfUseOxidation') ?? 0) / 100;
    const external = (parameters.get('externalVolume') ?? 0) * (parameters.get('externalConcentration') ?? 0) / 100 * density;
    const flare = (parameters.get('flareVolume') ?? 0) * (parameters.get('flareConcentration') ?? 0) / 100 * density * (parameters.get('flareEfficiency') ?? 0) / 100;
    return selfUse + external + flare;
  }
  if (factor.factorId === 'pf-co2-recovery') {
    const density = 19.77;
    return ((parameters.get('externalVolume') ?? 0) * (parameters.get('externalPurity') ?? 0) + (parameters.get('selfUseVolume') ?? 0) * (parameters.get('selfUsePurity') ?? 0)) / 100 * density;
  }
  if (factor.calculationType === 'fuelParameter') {
    const ncv = parameters.get('ncv') ?? 0;
    const cc = parameters.get('cc') ?? 0;
    const oxidationRate = (parameters.get('of') ?? 0) / 100;
    const molecularWeight = parameters.get('mw') ?? 44 / 12;
    const composite = ncv * cc * oxidationRate * molecularWeight;
    return factor.unit.startsWith('kg') ? activity * composite / 1000 : activity * composite;
  }
  if (factor.calculationType === 'processParameter') {
    const purity = (parameters.get('purity') ?? 0) / 100;
    const co2Factor = parameters.get('co2Factor') ?? 0;
    return activity * purity * co2Factor;
  }
  const factorValue = Number(factor.value);
  if (!Number.isFinite(factorValue)) return 0;
  if (factor.unit === '%') {
    const gwp = parameters.get('fugitiveGwp') ?? 0;
    return activity * factorValue / 100 * gwp / 1000;
  }
  return factor.unit.startsWith('kg') ? activity * factorValue / 1000 : activity * factorValue;
};

const energyFactorMap: Record<string, { factorId: string; category: string; group: string; sourceType: string; gas: string }> = {
  'energy-electricity': {
    factorId: 'pf-power', category: '购入的电力与热力产生的排放', group: '购入的电力与热力产生的排放', sourceType: '购入电力', gas: 'CO₂e',
  },
  'energy-steam': {
    factorId: 'pf-heat', category: '购入的电力与热力产生的排放', group: '购入的电力与热力产生的排放', sourceType: '购入热力', gas: 'CO₂',
  },
  'energy-natural-gas': {
    factorId: 'pf-ng', category: '化石燃料燃烧排放', group: '化石燃料燃烧排放', sourceType: '固定燃烧源', gas: 'CO₂',
  },
  'energy-coal': {
    factorId: 'pf-coal', category: '化石燃料燃烧排放', group: '化石燃料燃烧排放', sourceType: '固定燃烧源', gas: 'CO₂',
  },
  'energy-rdf': {
    factorId: 'pf-rdf', category: '化石燃料燃烧排放', group: '化石燃料燃烧排放', sourceType: '固定燃烧源', gas: 'CO₂e',
  },
};

const energyContext = (record: V11EnergyRecord) => {
  const unit = record.energyUnitId ? listEnergyUnits(record.year).find((item) => item.energyUnitId === record.energyUnitId) : undefined;
  const device = record.scopeType === 'device' && record.scopeId ? listV11KeyDevices(record.year).find((item) => item.deviceId === record.scopeId) : undefined;
  return {
    objectName: device?.deviceName ?? unit?.energyUnitName ?? '企业整体',
    objectType: device?.deviceType ?? unit?.unitType ?? record.scopeLevel,
  };
};

const selectEnergySourceRecords = (year: number) => {
  const records = listV11EnergyRecords().filter((record) => record.year === year && record.energyRole === '能源消费');
  const selected: V11EnergyRecord[] = [];
  const typeIds = [...new Set(records.map((record) => record.energyTypeId))];
  typeIds.forEach((energyTypeId) => {
    const candidates = records.filter((record) => record.energyTypeId === energyTypeId);
    const enterprise = candidates.filter((record) => v11RecordScopeType(record) === 'enterprise');
    const energyUnits = candidates.filter((record) => v11RecordScopeType(record) === 'energyUnit');
    const purchasedEnergy = ['v11-energy-electricity', 'v11-energy-steam'].includes(energyTypeId);
    selected.push(...(purchasedEnergy ? enterprise.length ? enterprise : energyUnits : energyUnits.length ? energyUnits : enterprise));
  });
  return selected;
};

const resolveEnergyRule = (record: V11EnergyRecord, energyTypeName: string) => {
  const logicalTypeIds: Record<string, string> = {
    'v11-energy-electricity': 'energy-electricity',
    'v11-energy-steam': 'energy-steam',
    'v11-energy-natural-gas': 'energy-natural-gas',
    'v11-energy-coal': 'energy-coal',
    'v11-energy-rdf': 'energy-rdf',
  };
  const context = energyContext(record);
  const logicalTypeId = logicalTypeIds[record.energyTypeId];
  if (logicalTypeId === 'energy-electricity' || logicalTypeId === 'energy-steam') return { rule: energyFactorMap[logicalTypeId], context };
  const fixedUse = /锅炉|加热炉|窑|发电机/.test(`${context.objectName}${context.objectType}`);
  const mobileUse = /车辆|运输|叉车|装载机/.test(`${context.objectName}${context.objectType}`);
  if (energyTypeName.includes('柴油') && mobileUse) return { rule: { factorId: 'pf-diesel', category: '化石燃料燃烧排放', group: '化石燃料燃烧排放', sourceType: '移动燃烧源', gas: 'CO₂' }, context };
  if (logicalTypeId && fixedUse) return { rule: energyFactorMap[logicalTypeId], context };
  return { rule: undefined, context };
};

function buildEnergyDraftSources(year: number): EmissionSource[] {
  const types = new Map(listV11EnergyTypes(year).map((item) => [item.energyTypeId, item]));
  return selectEnergySourceRecords(year)
    .map<EmissionSource | null>((record) => {
      const energyType = types.get(record.energyTypeId);
      const { rule, context } = resolveEnergyRule(record, energyType?.energyTypeName ?? '');
      const factor = rule ? getCarbonFactorV4(rule.factorId) : undefined;
      if (!rule || !factor) return null;
      const factorValue = factor ? Number(factor.value.match(/[\d.]+/)?.[0] ?? 0) : 0;
      const annualPhysicalAmount = v11EnergyRecordAnnualAmount(record);
      const activityValue = rule?.factorId === 'pf-power' ? annualPhysicalAmount / 1000 : annualPhysicalAmount;
      const emissionAmount = factor && factor.calculationType !== 'fuelParameter'
        ? Number((activityValue * factorValue).toFixed(2))
        : factor
          ? Number((activityValue * factorValue / (factor.unit.startsWith('kg') ? 1000 : 1)).toFixed(2))
          : 0;
      return {
        emissionSourceId: `draft-energy-${year}-${record.energyRecordId}`,
        carbonTaskId: `ct-${year}`,
        organizationBoundary: '企业法人边界',
        emissionCategory: rule.category,
        emissionGroup: rule.group,
        sourceType: rule.sourceType,
        sourceName: `${rule.factorId === 'pf-power' ? '外购电力' : rule.factorId === 'pf-heat' ? '外购热力' : `${energyType?.energyTypeName ?? record.energyTypeId}燃烧`}（${context.objectName}）`,
        greenhouseGasSpecies: [factorGasForRow(factor)],
        activityValue,
        activityUnit: rule?.factorId === 'pf-power' ? 'MWh' : energyType?.measurementUnit ?? '—',
        activityData: `${activityValue.toLocaleString('zh-CN')} ${rule?.factorId === 'pf-power' ? 'MWh' : energyType?.measurementUnit ?? '—'}`,
        activityDataSource: '数据管理·能源消费',
        factorName: factor.name,
        emissionFactorId: rule.factorId,
        recordGenerationType: 'system',
        sourceModule: '数据管理—能源数据',
        sourceRecordId: record.energyRecordId,
        factorObjectId: factor.factorObject ?? factor.factorId,
        factorVersionId: factor.version,
        createdBy: '系统',
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
        recommendedActivityDataSources: ['企业能源平衡表'],
        confirmedActivityDataSources: [],
        customActivityDataSources: [],
        evidenceFiles: [],
        evidenceStatus: '待补充',
        relatedEnergyRecordId: record.energyRecordId,
        emissionAmount,
        entryMode: 'system',
      };
    })
    .filter((source): source is EmissionSource => source !== null);
}

function buildInitialInventorySources(year: number): EmissionSource[] {
  const energySources = buildEnergyDraftSources(year);
  // 能源模块生成能源消费类排放源，其余常见工业排放源沿用已有上游关联示例，避免重复生成电力、热力和天然气。
  const supplementalSources = listEmissionSources().filter((source) => !source.emissionSourceId.startsWith('draft-energy-') && !['es-natural-gas', 'es-electricity', 'es-steam'].includes(source.emissionSourceId));
  return [...energySources, ...supplementalSources.map((source) => ({ ...source, carbonTaskId: `ct-${year}` }))];
}

const isEnergyLinkedSource = (source: EmissionSource) => source.sourceModule === '数据管理—能源数据' || Boolean(source.relatedEnergyRecordId);

const mergeEnergySources = (inventory: EmissionSource[], energySources: EmissionSource[], task: CarbonAccountingTask) => [
  ...inventory.filter((source) => !isEnergyLinkedSource(source)),
  ...energySources.map((source) => ({ ...source, carbonTaskId: task.carbonTaskId, organizationBoundary: task.organizationBoundary })),
];

const sameInventories = (left: EmissionSource[], right: EmissionSource[]) => {
  const rightById = new Map(right.map((source) => [source.emissionSourceId, source]));
  return left.length === right.length
    && left.every((source) => {
      const peer = rightById.get(source.emissionSourceId);
      return peer ? !changed(source, peer) : false;
    });
};

function Button({
  children,
  primary,
  outline,
  danger,
  compact,
  disabled,
  onClick,
  type = 'button',
}: {
  children: ReactNode;
  primary?: boolean;
  outline?: boolean;
  danger?: boolean;
  compact?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${styles.button} ${primary ? styles.primary : ''} ${outline ? styles.outline : ''} ${danger ? styles.danger : ''} ${compact ? styles.compact : ''}`}
    >
      {children}
    </button>
  );
}

function CarbonContextBar({
  className = '',
  actions,
  onQuery,
  showQuery = true,
  task,
  tasks = [],
  onTaskChange,
}: {
  className?: string;
  actions?: ReactNode;
  onQuery?: () => void;
  showQuery?: boolean;
  task?: CarbonAccountingTask;
  tasks?: CarbonAccountingTask[];
  onTaskChange?: (taskId: string) => void;
}) {
  const currentTask = task ?? { carbonTaskId: 'ct-2026', taskName: '2026年度组织温室气体核算', year: 2026, organizationName: 'XX科技有限公司', industry: '通用工业企业', standardName: 'GB/T 32150—2025', organizationBoundary: '企业法人边界', status: 'confirmed' as const };
  const statusLabel = currentTask.status === 'confirmed' ? '已确认' : currentTask.status === 'pending' ? '修订中' : '草稿';
  return <section className={`${styles.card} ${styles.carbonContextBar} ${className}`}>
    <div className={styles.taskLeft}>
      <div className={styles.taskIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg></div>
      <div className={styles.taskInfo}><div className={styles.taskLine}>
        <span className={styles.taskLabel}>核算年度</span>
        <select aria-label="核算年度" value={currentTask.carbonTaskId} onChange={(event) => onTaskChange?.(event.target.value)}>{tasks.length ? tasks.map((item) => <option key={item.carbonTaskId} value={item.carbonTaskId}>{item.year}年</option>) : <option value={currentTask.carbonTaskId}>{currentTask.year}年</option>}</select>
        <span className={styles.taskInlineMeta}><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 19 6v5c0 4.6-2.9 8.1-7 10-4.1-1.9-7-5.4-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg></i><span>依据标准：</span><b>{currentTask.standardName}</b><em aria-hidden="true">i</em></span>
      </div><div className={styles.taskMetaGrid}><div><span>状态</span><b>{statusLabel}</b></div><div><span>核算组织</span><b>{currentTask.organizationName}</b></div><div><span>行业类型</span><b>{currentTask.industry}</b></div><div><span>组织边界</span><b>{currentTask.organizationBoundary}</b></div></div></div>
    </div>
    <div className={styles.carbonContextRight}>
      {showQuery && <Button primary compact onClick={onQuery}>查询</Button>}
      {actions && <div className={styles.taskActions}>{actions}</div>}
    </div>
  </section>;
}

function Tag({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'blue' | 'orange' | 'gray' | 'red' }) {
  return <span className={`${styles.tag} ${styles[`tag${tone}`]}`}>{children}</span>;
}

function Dialog({
  title,
  children,
  footer,
  wide,
  className,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
  className?: string;
  onClose: () => void;
}) {
  return (
    <div className={styles.overlay} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`${styles.modal} ${wide ? styles.modalWide : ''} ${className ?? ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button type="button" onClick={onClose}>×</button></header>
        <div className={styles.modalBody}>{children}</div>
        <footer>{footer}</footer>
      </section>
    </div>
  );
}

function ReportInfoDialog({
  info,
  close,
  confirm,
  setInfo,
}: {
  info: CarbonReportBasicInfo;
  close: () => void;
  confirm: () => void;
  setInfo: (info: CarbonReportBasicInfo) => void;
}) {
  const update = (key: keyof CarbonReportBasicInfo, value: string) => setInfo({ ...info, [key]: value });
  return <Dialog title="确认报告基础信息" className={styles.reportInfoDialog} onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={confirm}>确认并生成报告</Button></>}>
    <div className={styles.reportInfoHint}>请确认本次报告中的企业主体、联系人及责任人信息。确认后将生成当前正式核算版本的报告。</div>
    <div className={styles.formGrid}>
      <Field label="企业名称"><input value={info.organizationName} onChange={(event) => update('organizationName', event.target.value)} /></Field>
      <Field label="统一社会信用代码"><input value={info.unifiedSocialCreditCode} onChange={(event) => update('unifiedSocialCreditCode', event.target.value)} /></Field>
      <Field label="注册地址" full><input value={info.registeredAddress} onChange={(event) => update('registeredAddress', event.target.value)} placeholder="请输入注册地址" /></Field>
      <Field label="公司法人"><input value={info.legalRepresentative} onChange={(event) => update('legalRepresentative', event.target.value)} placeholder="示例：张三" /></Field>
      <Field label="行业类别（国民经济行业分类（GB/T 4754-2017））"><input value={info.industryCategory} onChange={(event) => update('industryCategory', event.target.value)} placeholder="示例：M7590 其他科技推广服务业" /></Field>
      <Field label="组织经营范围" full><textarea value={info.businessScope} onChange={(event) => update('businessScope', event.target.value)} placeholder="示例：一般项目：计算机软硬件、网络、电信专业领域内的技术服务、技术咨询、技术开发、技术转让；商务信息咨询；计算机软硬件销售（除依法须经批准的项目外，凭营业执照依法自主开展经营活动）。" /></Field>
      <Field label="报告编制人"><input value={info.preparer} onChange={(event) => update('preparer', event.target.value)} placeholder="示例：王五" /></Field>
      <Field label="部门"><input value={info.preparerDepartment} onChange={(event) => update('preparerDepartment', event.target.value)} placeholder="示例：碳排放管理部" /></Field>
      <Field label="联系电话"><input value={info.preparerPhone} onChange={(event) => update('preparerPhone', event.target.value)} placeholder="示例：13800000000" /></Field>
      <Field label="报告审核人"><input value={info.reviewer} onChange={(event) => update('reviewer', event.target.value)} placeholder="示例：李四" /></Field>
      <Field label="组织边界说明" full><textarea value={info.boundaryDescription} onChange={(event) => update('boundaryDescription', event.target.value)} placeholder="示例：本公司按照营运控制的方式对XX有限公司的盘查地址（XX省XX市XX区XX路451号）内的所有设施作为组织边界，对组织边界内的排放源及排放量给予盘查和报告。" /></Field>
    </div>
  </Dialog>;
}

function Drawer({
  title,
  children,
  footer,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className={styles.overlay} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button type="button" onClick={onClose}>×</button></header>
        <div className={styles.drawerBody}>{children}</div>
        <footer>{footer}</footer>
      </aside>
    </div>
  );
}

function Preview({
  inventory,
  task,
  tasks,
  onTaskChange,
  state,
  version,
  confirmedAt,
}: {
  inventory: EmissionSource[];
  task?: CarbonAccountingTask;
  tasks?: CarbonAccountingTask[];
  onTaskChange?: (taskId: string) => void;
  state: TaskState;
  version: number;
  confirmedAt?: string;
}) {
  const total = inventory.reduce((sum, row) => sum + row.emissionAmount, 0);
  const direct = inventory.filter((row) => resultCategory(row.emissionCategory) === 'direct').reduce((sum, row) => sum + row.emissionAmount, 0);
  const purchased = inventory.filter((row) => resultCategory(row.emissionCategory) === 'purchased').reduce((sum, row) => sum + row.emissionAmount, 0);
  const other = total - direct - purchased;
  const cards = [
    { icon: <svg className={styles.summaryIconSvg} viewBox="0 0 32 32" aria-hidden="true"><path d="M7.2 24.5a5.1 5.1 0 0 1-.1-10.2 7.1 7.1 0 0 1 13.5-.8 5.5 5.5 0 1 1 1.7 10.9H7.2Z" /><text x="7.1" y="21.5">CO₂</text></svg>, label: '温室气体排放总量', value: total, sub: <span>较上年　<em>↓ 2.30%</em></span> },
    { icon: <svg className={styles.summaryIconSvg} viewBox="0 0 32 32" aria-hidden="true"><path d="M3.5 26h25v2h-25zM5.5 25V14.2l5 2.2v-5.2l5 2.2V9l6 2.7V7.5h3v17.5h3v2h-22Z" /><path d="M22 5.8c.2-1.6 1.1-2.6 2.8-3.2-.2 1.3.1 2.2 1.2 2.8-1.5.1-2.8.3-4 .4Z" /><path fill="#fff" d="M8 21h2v4H8zm5 1h2v3h-2zm6-2h2v5h-2z" /></svg>, label: '范围一：直接排放', value: direct, sub: `占比　${format(direct / total * 100)}%` },
    { icon: <svg className={styles.summaryIconSvg} viewBox="0 0 32 32" aria-hidden="true"><path d="m18.4 2.4-11 16h7.1l-1.4 11.2 11-16H17l1.4-11.2Z" /></svg>, label: '范围二：购入能源间接排放', value: purchased, sub: `占比　${format(purchased / total * 100)}%` },
    { icon: <svg className={styles.summaryIconSvg} viewBox="0 0 32 32" aria-hidden="true"><path d="M27.5 4.2C17.1 4.7 9.3 8.8 7.6 16.3c-.7 3.4.7 6.6 3.8 8.2 3.1 1.6 6.8.8 9.2-1.7 3.4-3.5 5-9.4 6.9-18.6Z" /><path d="M5.2 28c4.2-7.2 9.4-12.2 17.1-16.5" /></svg>, label: '范围三：其他间接排放', value: other, sub: `占比　${format(other / total * 100)}%` },
  ];
  const slices = [
    { label: scopeLabel('direct'), value: direct, color: '#16a36f' },
    { label: scopeLabel('purchased'), value: purchased, color: '#4b9dec' },
    { label: scopeLabel('other'), value: other, color: '#d6a85f' },
  ];
  const trend = [
    { direct: 610.2, purchased: 10930.1, other: 280.0 },
    { direct: 632.4, purchased: 11285.2, other: 293.2 },
    { direct: 658.7, purchased: 11780.5, other: 301.3 },
    { direct: 671.5, purchased: 12315.8, other: 302.8 },
    { direct, purchased, other },
  ];
  const trendValues = trend.map((item) => item.direct + item.purchased + item.other);
  const trendMax = Math.max(...trendValues) * 1.08;
  const ranked = [...inventory].sort((a, b) => b.emissionAmount - a.emissionAmount).slice(0, 5);
  const directEnd = direct / total * 100;
  const purchasedEnd = directEnd + purchased / total * 100;
  const summaryRows = [...new Set(inventory.map((row) => row.emissionCategory))].map((emissionCategory) => {
    const rows = inventory.filter((row) => row.emissionCategory === emissionCategory);
    const emission = rows.reduce((sum, row) => sum + row.emissionAmount, 0);
    const category = resultCategory(emissionCategory);
    const resultCategoryName = scopeLabel(category);
    const displayEmissionCategory = emissionCategory === '购入的电力与热力产生的排放'
      ? '购入电力与热力产生的排放'
      : emissionCategory;
    return { emissionCategory, resultCategoryName, displayEmissionCategory, count: rows.length, emission };
  }).sort((left, right) => {
    const scopeOrder = { direct: 0, purchased: 1, other: 2 } as const;
    return scopeOrder[resultCategory(left.emissionCategory)] - scopeOrder[resultCategory(right.emissionCategory)];
  });
  const hasFormalVersion = state !== 'draft';
  const confirmedTime = confirmedAt?.slice(0, 16);
  const exportSummary = () => {
    const taskRows = [
      ['核算年度', `${task?.year ?? 2026}年`],
      ['核算组织', task?.organizationName ?? 'XX科技有限公司'],
      ['组织边界', task?.organizationBoundary ?? '企业法人边界'],
      ['正式清单', hasFormalVersion ? '当前正式清单' : '尚未生成'],
      ['确认人', hasFormalVersion ? '管理员' : '—'],
      ['确认时间', hasFormalVersion ? confirmedTime ?? '—' : '—'],
      [],
      ['排放范围', '排放类别', '排放源数量', '排放量（tCO₂e）', '占比'],
      ...summaryRows.map((row) => [
        row.resultCategoryName,
        row.displayEmissionCategory,
        `${row.count}项`,
        format(row.emission),
        `${format(row.emission / total * 100)}%`,
      ]),
      ['合计', '—', `${inventory.length}项`, format(total), '100.00%'],
    ];
    const csv = '\ufeff' + taskRows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${task?.organizationName ?? '当前组织'}_${task?.year ?? 2026}年度核算结果汇总.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      <CarbonContextBar className={styles.previewTask} task={task} tasks={tasks} onTaskChange={onTaskChange} showQuery={false} />

      <div className={styles.summaryGrid}>
        {cards.map((card, index) => <section className={`${styles.card} ${styles.summaryCard}`} data-summary-tone={index === 0 ? 'total' : `scope-${index}`} key={card.label}><div className={styles.summaryIcon}>{card.icon}</div><div><b>{card.label}</b><strong>{format(card.value)} <small>tCO₂e</small></strong><span>{card.sub}</span></div></section>)}
      </div>

      <div className={styles.analysisGrid}>
        <section className={`${styles.card} ${styles.analysisCard}`}>
          <h3>排放构成（按排放范围）</h3><small>单位：tCO₂e</small>
          <div className={styles.donutWrap}>
            <div
              className={styles.donut}
              style={{ background: `conic-gradient(#16a36f 0 ${directEnd}%, #4b9dec ${directEnd}% ${purchasedEnd}%, #d6a85f ${purchasedEnd}% 100%)` }}
            ><div><b>{format(total)}</b><span>tCO₂e</span></div></div>
            <div className={styles.legend}>{slices.map((slice) => <div key={slice.label}><i style={{ background: slice.color }} /><span>{slice.label}<small>{format(slice.value)} tCO₂e（{format(slice.value / total * 100)}%）</small></span></div>)}</div>
          </div>
        </section>
        <section className={`${styles.card} ${styles.analysisCard}`}>
          <div className={styles.analysisTitleRow}><div><h3>排放趋势（近5年）</h3><small>柱顶为排放总量，柱体按范围构成 · 单位：tCO₂e</small><div className={styles.chartLegend}><span><i className={styles.legendDirect} />范围一</span><span><i className={styles.legendPurchased} />范围二</span><span><i className={styles.legendOther} />范围三</span></div></div></div>
          <div className={styles.barChart}>{trendValues.map((value, index) => {
            const scopeTrend = trend[index];
            const year = 2022 + index;
            return <div key={`${value}-${index}`} data-trend-year={year}><span>{format(value)}</span><i className={`${styles.barStack} ${index === 4 ? styles.barCurrent : ''}`} style={{ height: `${value / trendMax * 100}%` }} aria-label={`${year}年：范围一 ${format(scopeTrend.direct)}，范围二 ${format(scopeTrend.purchased)}，范围三 ${format(scopeTrend.other)} tCO₂e`}><b data-scope-segment="scope-3" title={`范围三：${format(scopeTrend.other)} tCO₂e`} style={{ flex: scopeTrend.other }} /><b data-scope-segment="scope-2" title={`范围二：${format(scopeTrend.purchased)} tCO₂e`} style={{ flex: scopeTrend.purchased }} /><b data-scope-segment="scope-1" title={`范围一：${format(scopeTrend.direct)} tCO₂e`} style={{ flex: scopeTrend.direct }} /></i><small>{year}年</small></div>;
          })}</div>
        </section>
      </div>

      <div className={styles.previewLowerGrid}>
        <section className={`${styles.card} ${styles.snapshotCard}`}>
        <header className={styles.snapshotHeader}>
          <h3>本次核算排放汇总</h3>
          <div className={styles.snapshotActions}>
            {hasFormalVersion ? <Button primary compact onClick={exportSummary}>导出核算结果</Button> : <Button outline compact onClick={() => window.history.back()}>返回核算清单继续完善</Button>}
          </div>
        </header>
        <table className={styles.snapshotTable}>
          <colgroup><col style={{ width: '22%' }} /><col style={{ width: '38%' }} /><col style={{ width: '24%' }} /><col style={{ width: '16%' }} /></colgroup>
          <thead><tr><th>排放范围</th><th>排放类别</th><th className={styles.snapshotAmountCell}>排放量</th><th className={styles.snapshotPercentCell}>占比</th></tr></thead>
          <tbody>
            {summaryRows.map((row, index) => {
              const firstIndex = summaryRows.findIndex((item) => item.resultCategoryName === row.resultCategoryName);
              const rowSpan = summaryRows.filter((item) => item.resultCategoryName === row.resultCategoryName).length;
              return (
                <tr key={row.emissionCategory}>
                  {firstIndex === index && <td className={styles.snapshotResultCategory} rowSpan={rowSpan}>{row.resultCategoryName}</td>}
                  <td>{row.displayEmissionCategory}</td>
                  <td className={styles.snapshotAmountCell}>{format(row.emission)} tCO₂e</td>
                  <td className={styles.snapshotPercentCell}>{format(row.emission / total * 100)}%</td>
                </tr>
              );
            })}
            <tr className={styles.snapshotTotalRow}>
              <td>合计</td><td>—</td><td className={styles.snapshotAmountCell}>{format(total)} tCO₂e</td><td className={styles.snapshotPercentCell}>100.00%</td>
            </tr>
          </tbody>
        </table>
        </section>
        <section className={`${styles.card} ${styles.analysisCard} ${styles.rankAnalysisCard}`}>
          <h3>主要排放源排行</h3><small>单位：tCO₂e</small>
          <table className={styles.rankTable}><thead><tr><th>排名</th><th>排放源</th><th>排放量</th><th>占比</th></tr></thead><tbody>
            {ranked.map((row, index) => <tr key={row.emissionSourceId}><td>{['🥇', '🥈', '🥉', '4', '5'][index]}</td><td>{row.sourceName.replace(/（.*?）/, '')}</td><td>{format(row.emissionAmount)}</td><td>{format(row.emissionAmount / total * 100)}%</td></tr>)}
          </tbody></table>
        </section>
      </div>
    </div>
  );
}

function Inventory({
  inventory,
  formalInventory,
  task,
  tasks,
  onTaskChange,
  taskState,
  keyword,
  boundary,
  collapsed,
  collapsedScopes,
  setKeyword,
  setBoundary,
  toggleGroup,
  toggleScope,
  openSource,
  openDialog,
  confirmUpdate,
  cancelUpdate,
  openChanges,
  undoChange,
  exportInventory,
  invalidSourceIds,
  validationMessages,
}: {
  inventory: EmissionSource[];
  formalInventory: EmissionSource[];
  task: CarbonAccountingTask | undefined;
  tasks: CarbonAccountingTask[];
  onTaskChange: (taskId: string) => void;
  taskState: TaskState;
  keyword: string;
  boundary: string;
  collapsed: Set<string>;
  collapsedScopes: Set<string>;
  setKeyword: (value: string) => void;
  setBoundary: (value: string) => void;
  toggleGroup: (value: string) => void;
  toggleScope: (value: string) => void;
  openSource: (row: EmissionSource, mode: SourceMode) => void;
  openDialog: (dialog: DialogState) => void;
  confirmUpdate: () => void;
  cancelUpdate: () => void;
  openChanges: () => void;
  undoChange: (sourceId: string) => void;
  exportInventory: () => void;
  invalidSourceIds: Set<string>;
  validationMessages: Record<string, string[]>;
}) {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'energy' | 'manual'>('all');
  const [keywordInput, setKeywordInput] = useState(keyword);
  const [boundaryInput, setBoundaryInput] = useState(boundary);
  const formalRows = taskState === 'confirmed' ? formalInventory : inventory;
  const baselineRows = formalInventory.length ? formalInventory : formalRows;
  const baselineById = new Map(baselineRows.map((row) => [row.emissionSourceId, row]));
  const inventoryById = new Map(inventory.map((row) => [row.emissionSourceId, row]));
  const changeRows = [
    ...inventory.filter((row) => !baselineById.has(row.emissionSourceId)).map((row) => ({ kind: 'add' as const, row, before: undefined })),
    ...inventory.filter((row) => { const before = baselineById.get(row.emissionSourceId); return before ? changed(before, row) : false; }).map((row) => ({ kind: 'update' as const, row, before: baselineById.get(row.emissionSourceId) })),
    ...baselineRows.filter((row) => !inventoryById.has(row.emissionSourceId)).map((row) => ({ kind: 'delete' as const, row, before: row })),
  ];
  const pendingAddCount = changeRows.filter((item) => item.kind === 'add').length;
  const pendingEnergyCount = changeRows.filter((item) => item.kind !== 'add' && isEnergyLinkedSource(item.row)).length;
  const changedTargetIds = new Set(changeRows.filter((item) => item.kind !== 'add').map((item) => item.row.emissionSourceId));
  const groups = [...new Set(formalRows.map((row) => row.emissionCategory))];
  const visibleScopes = emissionScopeDictionary.map((scope) => ({
    ...scope,
    categories: scope.categories.filter((category) => groups.includes(category)),
  })).filter((scope) => scope.categories.length > 0);
  const energySourceCount = inventory.filter(isEnergyLinkedSource).length;
  const filtered = formalRows.filter((row) => {
    const matchKeyword = !keyword || [row.sourceName, row.sourceType, factorNameForRow(row), factorSummary(row), row.activityData].some((text) => text.includes(keyword));
    const matchSource = sourceFilter === 'all' || (sourceFilter === 'energy' ? isEnergyLinkedSource(row) : row.recordGenerationType === 'manual');
    return matchKeyword && matchSource && (!boundary || row.emissionCategory === boundary);
  });
  return (
    <div className={`${styles.page} ${styles.inventoryPage}`}>
      <CarbonContextBar className={styles.inventoryTask} task={task} tasks={tasks} onTaskChange={onTaskChange} showQuery={false} actions={<>
        <div className={styles.taskSecondaryActions}>{taskState === 'confirmed' && <Button outline onClick={exportInventory}>导出</Button>}</div>
        <Button outline onClick={() => openDialog({ kind: 'newSource' })}>＋ 新增排放源</Button>
        {taskState !== 'confirmed' && <Button primary onClick={confirmUpdate}>确认正式清单</Button>}
      </>} />
      <section className={`${styles.card} ${styles.syncOverview}`}>
        <strong>能源数据同步</strong>
        <span>系统按后台预置规则，将能源消费数据自动映射为对应排放源。</span>
        <Tag tone="green">● {energySourceCount} 项能源数据已纳入核算</Tag>
      </section>
      {taskState === 'confirmed' && changeRows.length > 0 && <section className={`${styles.card} ${styles.pendingChangeBar}`}>
        <div><strong>当前有 {changeRows.length} 项修改待确认</strong><span>包括：{pendingEnergyCount ? `${pendingEnergyCount} 项能源源数据更新` : ''}{pendingEnergyCount && pendingAddCount ? '，' : ''}{pendingAddCount ? `${pendingAddCount} 项新增排放源` : ''}{!pendingEnergyCount && !pendingAddCount ? '手工排放源变更' : ''}。正式清单仍保持已确认值。</span></div>
        <div><Button outline onClick={openChanges}>查看修改</Button><Button outline onClick={() => openDialog({ kind: 'cancelUpdate' })}>取消本次修改</Button><Button primary onClick={confirmUpdate}>确认并更新正式清单</Button></div>
      </section>}
      <>
      <section className={`${styles.card} ${styles.filterbar}`}>
        <div className={styles.search}><input value={keywordInput} onChange={(event) => { setKeywordInput(event.target.value); setKeyword(event.target.value.trim()); }} placeholder="搜索排放源、能源品种或使用对象" /></div>
        <label>排放类别<select aria-label="排放类别" value={boundaryInput} onChange={(event) => { setBoundaryInput(event.target.value); setBoundary(event.target.value); }}><option value="">全部</option>{groups.map((group) => <option key={group}>{group}</option>)}</select></label>
        <label>数据来源<select aria-label="数据来源" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}><option value="all">全部</option><option value="energy">能源数据</option><option value="manual">手工补充</option></select></label>
      </section>
      {!inventory.length && <div className={styles.infoBox}><b>当前年度暂无草稿清单</b><span>当前年度尚未关联可生成的上游数据。补充上游数据后可重新生成草稿清单。</span></div>}
      <section className={`${styles.card} ${styles.inventoryShell}`}>
        {visibleScopes.map((scope) => {
          const visibleCategories = scope.categories.filter((category) => {
            if (boundary && category !== boundary) return false;
            return !keyword || filtered.some((row) => row.emissionCategory === category);
          });
          if (!visibleCategories.length) return null;
          const scopeRows = filtered.filter((row) => (visibleCategories as readonly string[]).includes(row.emissionCategory));
          return <section className={styles.scopeSection} key={scope.id} data-scope-title={scope.label}>
            <button type="button" className={styles.scopeHead} aria-expanded={!collapsedScopes.has(scope.id)} onClick={() => toggleScope(scope.id)}>
              <span className={styles.scopeToggle} aria-hidden="true">{collapsedScopes.has(scope.id) ? '▸' : '▾'}</span>
              <b>{scope.label}</b>
              <span className={styles.scopeSummary}><small>合计</small><strong>{format(scopeRows.reduce((sum, row) => sum + row.emissionAmount, 0))} tCO₂e</strong></span>
            </button>
            {!collapsedScopes.has(scope.id) && visibleCategories.map((group) => {
              const rows = filtered.filter((row) => row.emissionCategory === group);
              return <div className={styles.groupCard} key={group} data-category-title={group}>
            <button
              type="button"
              className={styles.groupHead}
              aria-expanded={!collapsed.has(group)}
              onClick={() => toggleGroup(group)}
            >
              <span className={styles.groupToggle} aria-hidden="true">{collapsed.has(group) ? '▸' : '▾'}</span>
              <b className={styles.groupTitle}>{group}</b>
              <span className={styles.groupSummary}><small>小计</small><strong>{format(rows.reduce((sum, row) => sum + row.emissionAmount, 0))} tCO₂e</strong></span>
            </button>
            {!collapsed.has(group) && <div className={styles.groupTableWrap}><table className={styles.groupTable}>
              <colgroup><col style={{ width: '13%' }} /><col style={{ width: '20%' }} /><col style={{ width: '13%' }} /><col style={{ width: '15%' }} /><col style={{ width: '15%' }} /><col style={{ width: '14%' }} /><col style={{ width: '10%' }} /></colgroup>
              <thead><tr><th>温室气体源类型</th><th>排放源</th><th>数据来源</th><th>活动数据</th><th>核算因子</th><th>排放量（tCO₂e）</th><th>操作</th></tr></thead>
              <tbody>{rows.length ? rows.map((row) => <tr key={row.emissionSourceId} className={invalidSourceIds.has(row.emissionSourceId) ? styles.invalidRow : ''}>
                <td className={styles.sourceTypeCell} data-column="source-type">{row.sourceType}</td>
                <td className={styles.sourceCell} data-column="source"><b>{row.sourceName}</b>{changedTargetIds.has(row.emissionSourceId) && <span className={styles.pendingChangeBadge}>有待确认修改</span>}{validationMessages[row.emissionSourceId]?.map((message) => <span className={styles.validationMessage} key={message}>{message}</span>)}</td>
                <td><Tag tone={isEnergyLinkedSource(row) ? 'green' : 'blue'}>{isEnergyLinkedSource(row) ? '能源数据' : '手工补充'}</Tag></td>
                <td className={styles.activityCell} data-column="activity"><b>{inventoryActivityDisplay(row.activityData)}</b>{taskState === 'confirmed' && isEnergyLinkedSource(row) && <span className={styles.compactMeta}>正式清单值</span>}</td>
                <td className={styles.factorCell} data-column="emission-factor">
                  <button type="button" className={styles.factorInlineButton} title={factorBriefText(row)} onClick={() => openSource(row, 'view')}>
                    <b>{calculationFactorDisplay(row)}</b>
                  </button>
                </td>
                <td className={styles.emissionCell} data-column="emission"><b>{format(row.emissionAmount)}</b></td>
                <td className={styles.rowActions} data-column="actions"><button type="button" onClick={() => openSource(row, 'view')}>详情</button>{row.recordGenerationType === 'manual' && <button type="button" onClick={() => openSource(row, 'edit')}>编辑</button>}{taskState !== 'confirmed' && (row.entryMode === 'manual' || row.emissionCategory === '废弃物处理处置排放') && <button type="button" className={styles.deleteLink} onClick={() => openDialog({ kind: 'deleteSource', row })}>删除</button>}</td>
              </tr>) : <tr><td colSpan={7} className={styles.emptyRow}>暂无排放源</td></tr>}</tbody>
            </table></div>}
              </div>;
            })}
          </section>;
        })}
        <section className={`${styles.card} ${styles.inventoryTotal}`} aria-label="清单汇总">
          <span>{taskState === 'confirmed' ? '正式清单汇总' : '当前清单汇总'}</span>
          <strong>{format(formalRows.reduce((sum, row) => sum + row.emissionAmount, 0))} tCO₂e</strong>
        </section>
      </section>
      </>
    </div>
  );
}

const materialType = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'PDF';
  if (extension === 'xls' || extension === 'xlsx') return 'Excel';
  if (extension === 'doc' || extension === 'docx') return 'Word';
  if (extension === 'png' || extension === 'jpg' || extension === 'jpeg') return '图片';
  return '文件';
};

const downloadEvidencePackage = (items: SupportItem[], year: string) => {
  const completed = items.filter((item) => item.evidenceFiles?.length).length;
  const manifestRows = items.map((item) => [
    item.emission ? '排放源证明材料' : '核算基础材料',
    item.group,
    item.item,
    item.activity,
    item.activityDataSources,
    item.evidenceFiles?.map((file) => file.fileName).join('、') || '待补充',
    item.evidenceFiles?.length ? '已上传' : '待补充',
  ]);
  const csv = '\ufeff' + [['材料类别', '排放类别/分组', '核查事项/排放源', '活动数据', '活动数据来源', '证明材料', '材料状态'], ...manifestRows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const missing = items.filter((item) => !item.evidenceFiles?.length)
    .map((item) => `${item.emission ? '排放源' : '基础材料'}\t${item.group}\t${item.item}\t${item.activityDataSources}`)
    .join('\n');
  const files = [
    { name: '00_材料目录.csv', content: csv },
    { name: '05_缺口清单.tsv', content: missing ? `材料类别\t分组\t核查事项\t活动数据来源\n${missing}` : '当前没有待补充材料。' },
    { name: 'README.txt', content: `核查证据包（演示）\n核算年度：${year}\n材料事项完成：${completed}/${items.length}\n说明：包内文件为当前原型中的材料占位内容，实际文件由统一文件服务提供。\n` },
    ...items.flatMap((item) => (item.evidenceFiles ?? []).map((file) => ({
      name: `材料/${file.fileName}`,
      content: `证明材料（演示文件）\n文件名：${file.fileName}\n关联事项：${item.item}\n关联来源：${file.activityDataSource}\n`,
    }))),
  ];
  const url = URL.createObjectURL(createTarBlob(files));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `XX科技有限公司_${year}年度核查证据包.tar`;
  anchor.click();
  URL.revokeObjectURL(url);
};

function SupportPage({
  inventory,
  task,
  tasks,
  onTaskChange,
  basicItems,
  basicOverrides,
  openDrawer,
  openDialog,
}: {
  inventory: EmissionSource[];
  task?: CarbonAccountingTask;
  tasks?: CarbonAccountingTask[];
  onTaskChange?: (taskId: string) => void;
  basicItems: SupportItem[];
  basicOverrides: Record<string, Pick<SupportItem, 'evidenceFiles' | 'supportRemark' | 'materials'>>;
  openDrawer: (drawer: DrawerState) => void;
  openDialog: (dialog: Extract<DialogState, { kind: 'deleteSupport' | 'deleteSupportFile' | 'viewSupport' }>) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [state, setState] = useState('');
  const [stateInput, setStateInput] = useState('');
  const [appliedYear, setAppliedYear] = useState('2026');
  const sourceRows: SupportItem[] = inventory.map((row) => ({
    id: row.emissionSourceId,
    group: row.emissionCategory,
    type: row.sourceType,
    item: row.sourceName,
    activity: row.activityData,
    activityDataSources: row.emissionSourceId === 'es-r134a' ? '设备铭牌' : row.confirmedActivityDataSources.length ? row.confirmedActivityDataSources.join('、') : '待确认',
    materials: row.evidenceFiles.length,
    state: row.evidenceStatus === '已完成' ? '已完成' : '待补充',
    evidenceFiles: row.evidenceFiles,
    emission: row,
  }));
  const basicRowsWithFiles = basicItems.map((item) => ({
    ...item,
    id: item.item,
    ...(basicOverrides[item.item] ?? {}),
    evidenceFiles: basicOverrides[item.item]?.evidenceFiles ?? item.evidenceFiles ?? Array.from({ length: item.materials }, (_, index) => ({ evidenceFileId: `${item.item}-${index}`, fileName: `基础材料-${index + 1}.pdf`, activityDataSource: item.activityDataSources })),
  }));
  const matchesFilters = (item: SupportItem) => (!keyword || [item.item, item.group, item.activity, ...(item.evidenceFiles ?? []).map((file) => file.fileName)].some((text) => text.includes(keyword))) && (!state || item.state === state);
  const filteredBasicRows = basicRowsWithFiles.filter(matchesFilters);
  const filteredSourceRows = sourceRows.filter(matchesFilters);
  const allSupportRows = [...basicRowsWithFiles, ...sourceRows];
  const completedSupportCount = allSupportRows.filter((item) => item.evidenceFiles?.length).length;
  const missingSupportCount = allSupportRows.length - completedSupportCount;
  const supportProgress = allSupportRows.length ? Math.round((completedSupportCount / allSupportRows.length) * 100) : 0;
  const scopeLabelFor = (group: string) => emissionScopeDictionary.find((scope) => scope.categories.some((category) => category === group))?.label ?? '其他排放';
  const renderSupportRow = (item: SupportItem) => <tr key={`${item.group}-${item.item}`}>
    <td className={styles.supportEmissionCell}><b>{item.item}</b></td>
    <td className={styles.supportActivityValue}>{item.activity}</td>
    <td>{item.evidenceFiles?.length ? <div className={styles.materialCell}><div className={styles.materialPrimary}><b title={item.evidenceFiles[0].fileName}>{item.evidenceFiles[0].fileName}</b><span>{materialType(item.evidenceFiles[0].fileName)}</span></div>{item.evidenceFiles.length > 1 && <small>等 {item.evidenceFiles.length} 份材料</small>}</div> : <span className={styles.materialEmpty}>未上传材料</span>}</td>
    <td><Tag tone={item.state === '已完成' ? 'green' : 'orange'}>{item.state === '已完成' ? '已上传' : item.state}</Tag></td>
    <td className={styles.rowActions}><button type="button" onClick={() => openDialog({ kind: 'viewSupport', item })}>查看</button><button type="button" onClick={() => openDrawer({ kind: 'support', item, manage: true, upload: true })}>上传</button><button type="button" className={styles.deleteLink} onClick={() => openDialog({ kind: 'deleteSupport', item })}>删除</button></td>
  </tr>;
  const sourceGroups = [...new Set(filteredSourceRows.map((item) => scopeLabelFor(item.group)))];
  const renderBasicRow = (item: SupportItem) => <tr key={`${item.group}-${item.item}`}>
    <td><div className={styles.chainCell}><b>{item.item}</b></div></td>
    <td>{item.evidenceFiles?.length ? <div className={styles.materialCell}><div className={styles.materialPrimary}><b>{item.evidenceFiles[0].fileName}</b><span>{materialType(item.evidenceFiles[0].fileName)}</span></div>{item.evidenceFiles.length > 1 && <small>等 {item.evidenceFiles.length} 份材料</small>}</div> : <span className={styles.materialEmpty}>未上传材料</span>}</td>
    <td><Tag tone={item.state === '已完成' ? 'green' : 'orange'}>{item.state === '已完成' ? '已上传' : item.state}</Tag></td>
    <td className={styles.rowActions}><button type="button" onClick={() => openDialog({ kind: 'viewSupport', item })}>查看</button><button type="button" onClick={() => openDrawer({ kind: 'support', item, manage: true, upload: true })}>上传</button><button type="button" className={styles.deleteLink} onClick={() => openDialog({ kind: 'deleteSupport', item })}>删除</button></td>
  </tr>;
  return (
    <div className={`${styles.page} ${styles.supportPage}`} data-applied-year={appliedYear}>
      <CarbonContextBar className={styles.supportHead} task={task} tasks={tasks} onTaskChange={onTaskChange} showQuery={false} onQuery={() => setAppliedYear(String(task?.year ?? 2026))} />
      <section className={`${styles.card} ${styles.supportPanel}`}>
        <div className={styles.supportInfo}><span className={styles.supportInfoIcon} aria-hidden="true">i</span><span>基础材料用于证明核算主体、组织边界和数据质量制度；排放源、活动数据及因子信息由正式碳核算清单自动带入并保持只读。用户仅需维护对应的证明材料。</span></div>
        <div className={styles.supportOverview} aria-label="材料准备概览">
          <div className={styles.supportOverviewHeading}><div><span>核查准备</span><b>材料准备概览</b></div><Button outline compact onClick={() => downloadEvidencePackage(allSupportRows, appliedYear)}>⇩ 下载核查证据包</Button></div>
          <div className={styles.supportOverviewBody}>
            <div className={styles.supportProgressBlock}><div className={styles.supportProgressMeta}><span>材料准备进度</span><strong>{supportProgress}%</strong></div><div className={styles.supportProgressTrack}><span style={{ width: `${supportProgress}%` }} /></div><small>按核算基础材料和排放源证据条目统计</small></div>
            <div className={styles.supportOverviewMetric}><span>已完成</span><b>{completedSupportCount} <em>/ {allSupportRows.length}</em></b></div>
            <div className={`${styles.supportOverviewMetric} ${missingSupportCount ? styles.supportOverviewMetricWarn : ''}`}><span>待补充</span><b>{missingSupportCount}</b></div>
          </div>
        </div>
        <div className={styles.supportToolbar}><div className={styles.search}><input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="搜索核查事项、排放源或材料名称" /></div><label>材料状态<select value={stateInput} onChange={(event) => setStateInput(event.target.value)}><option value="">全部</option><option value="待补充">待补充</option><option value="已完成">已上传</option></select></label><Button primary compact onClick={() => { setKeyword(keywordInput.trim()); setState(stateInput); }}>查询</Button></div>
        <div className={`${styles.supportSectionTitle} ${styles.supportBasicSectionTitle}`}><b>核算基础材料</b><span>核算主体、组织边界与管理制度材料</span></div>
        <div className={styles.supportTableWrap}><table className={styles.supportTable} data-support-table="basic">
          <colgroup><col style={{ width: '32%' }} /><col style={{ width: '35%' }} /><col style={{ width: '18%' }} /><col style={{ width: '15%' }} /></colgroup>
          <thead><tr><th>材料事项</th><th>证明材料</th><th>材料状态</th><th>操作</th></tr></thead>
          <tbody>{filteredBasicRows.length ? filteredBasicRows.map(renderBasicRow) : <tr><td colSpan={4} className={styles.emptyRow}>暂无符合条件的基础材料</td></tr>}</tbody>
        </table></div>
        <div className={`${styles.supportSectionTitle} ${styles.supportSourceSectionTitle}`}><b>排放源证明材料</b><span>按排放范围分组展示</span></div>
        <div className={styles.supportTableWrap}><table className={styles.supportTable} data-support-table="source">
          <colgroup><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /></colgroup>
          <thead><tr><th>排放源</th><th>活动数据项</th><th>证明材料</th><th>材料状态</th><th>操作</th></tr></thead>
          <tbody>{filteredSourceRows.length ? sourceGroups.map((scope) => <Fragment key={scope}>
            <tr className={styles.supportScope}><td colSpan={5}><div className={styles.supportScopeTitle}><span>⌄</span><b>{scope}</b><small>{filteredSourceRows.filter((item) => scopeLabelFor(item.group) === scope).length} 个排放源</small></div></td></tr>
            {filteredSourceRows.filter((item) => scopeLabelFor(item.group) === scope).map(renderSupportRow)}
          </Fragment>) : <tr><td colSpan={5} className={styles.emptyRow}>暂无符合条件的排放源证明材料</td></tr>}</tbody>
        </table></div>
      </section>
    </div>
  );
}

type FactorLibraryCategory = '企业专属因子' | '化石燃料' | '碳酸盐' | '工业废水' | '购入能源' | '逸散排放' | '全球变暖潜势' | '系统常数与热工参数';
type FactorCatalogNode = { key: string; label: string; children?: FactorCatalogNode[] };

const factorLibraryTree: FactorCatalogNode[] = [
  { key: 'TENANT_CUSTOM_FACTOR', label: '企业专属因子' },
  ...carbonFactorLibraryCategoryTree.map((node) => ({ key: node.code, label: node.name, children: node.children?.map((child) => ({ key: child.code, label: child.name })) })),
];

const libraryTopCodeBySeedCode: Record<string, string> = {
  'CAT-01': 'FOSSIL_FUEL', 'CAT-02': 'CARBONATE', 'CAT-03': 'INDUSTRIAL_WASTEWATER', 'CAT-04': 'PURCHASED_ENERGY',
  'CAT-05': 'FUGITIVE_EMISSION', 'CAT-06': 'GWP', 'CAT-07': 'SYSTEM_AND_THERMAL',
};

const factorLibraryCategory = (factor: CarbonFactor): FactorLibraryCategory | undefined => {
  if (factor.libraryCategoryName) return factor.libraryCategoryName as FactorLibraryCategory;
  if (factor.objectType === 'GWP值' || factor.factorId === 'pf-r134a') return '全球变暖潜势';
  if (factor.activity === '逸散排放') return '逸散排放';
  if (factor.calculationType === 'wastewaterParameter' || factor.calculationScenario === 'wastewaterAnaerobic' || /废水|污水|Bo|MCF/.test(`${factor.name} ${factor.activity}`)) return '工业废水';
  if (factor.calculationType === 'processParameter' || factor.calculationScenario === 'carbonateProcess' || /碳酸盐/.test(`${factor.name} ${factor.activity}`)) return '碳酸盐';
  if (factor.calculationType === 'fuelParameter' || factor.calculationScenario === 'fuelCombustion' || /燃烧|燃料|柴油|汽油|煤油|天然气|煤炭|焦炭/.test(`${factor.name} ${factor.activity}`)) return '化石燃料';
  if (factor.calculationScenario === 'purchasedElectricity' || factor.calculationScenario === 'purchasedHeat' || /购入电力|购入热力|外购电力|外购热力/.test(`${factor.name} ${factor.activity}`)) return '购入能源';
  if (factor.calculationType === 'parameter' || factor.objectType === '基础核算参数' || factor.objectType === '方法学常数' || /系统常数|热焓|NCV|CC|氧化率|分子量|摩尔体积/.test(factor.name)) return '系统常数与热工参数';
  return undefined;
};

const factorLibraryChild = (factor: CarbonFactor): string | undefined => {
  if (factor.libraryCategoryCode) return carbonFactorLibraryChildCode(factor.libraryCategoryCode);
  const category = factorLibraryCategory(factor);
  if (category === '化石燃料') {
    if (/天然气|煤气|气体燃料|石油气/.test(factor.name)) return 'fuel-gas';
    if (/柴油|汽油|煤油|原油|燃料油|石脑油|焦油|液体燃料/.test(factor.name)) return 'fuel-liquid';
    return 'fuel-solid';
  }
  if (category === '工业废水') {
    if (/MCF/.test(factor.name)) return 'wastewater-mcf';
    if (/Bo/.test(factor.name)) return 'wastewater-bo';
  }
  if (category === '购入能源') {
    if (/电力/.test(`${factor.name} ${factor.activity}`)) return 'purchased-electricity';
    if (/热力/.test(`${factor.name} ${factor.activity}`)) return 'purchased-heat';
  }
  if (category === '逸散排放') return factor.libraryCategoryChildName === '制冷剂逸散' ? 'REFRIGERANT_FUGITIVE' : factor.libraryCategoryChildName === 'SF₆逸散' ? 'SF6_FUGITIVE' : 'FIRE_SUPPRESSANT_FUGITIVE';
  if (category === '系统常数与热工参数') return /蒸汽热焓/.test(factor.name) ? 'steam-enthalpy' : 'system-constant';
  return undefined;
};

function FactorCatalogTree({
  nodes,
  selected,
  select,
  expanded,
  toggle,
  depth = 0,
}: {
  nodes: FactorCatalogNode[];
  selected: string;
  select: (label: string) => void;
  expanded: Record<string, boolean>;
  toggle: (key: string) => void;
  depth?: number;
}) {
  return <div>{nodes.map((node) => {
    const key = node.key;
    const hasChildren = Boolean(node.children?.length);
    const open = expanded[key] ?? depth === 0;
    return <div key={key}>
      <button className={`${styles.factorCatalogNode} ${selected === node.key ? styles.selectedCatalogNode : ''}`} style={{ paddingLeft: `${12 + depth * 20}px` }} onClick={() => select(node.key)}>
        <span className={styles.factorCatalogChevron} onClick={(event) => { if (hasChildren) { event.stopPropagation(); toggle(key); } }}>{hasChildren ? (open ? '⌄' : '›') : '　'}</span><span className={styles.factorCatalogFolder}>▰</span>{node.label}
      </button>
      {hasChildren && open ? <FactorCatalogTree nodes={node.children!} selected={selected} select={select} expanded={expanded} toggle={toggle} depth={depth + 1} /> : null}
    </div>;
  })}</div>;
}

const ar6GwpRows: { type: string; gas: string; value: number }[] = [
  { type: '二氧化碳（CO₂）', gas: 'CO₂', value: 1 },
  { type: '甲烷（CH₄）', gas: 'CH₄（生物源）', value: 27.0 },
  { type: '甲烷（CH₄）', gas: 'CH₄（化石燃料燃烧）', value: 27.0 },
  { type: '甲烷（CH₄）', gas: 'CH₄（化石燃料逸散及工艺过程）', value: 29.8 },
  { type: '氧化亚氮（N₂O）', gas: 'N₂O', value: 273 },
  { type: '含氢氟碳化合物（HFCs）', gas: 'HFC-32', value: 770 },
  { type: '含氢氟碳化合物（HFCs）', gas: 'HFC-143a', value: 5807 },
  { type: '含氢氟碳化合物（HFCs）', gas: 'HFC-125', value: 3744 },
  { type: '含氢氟碳化合物（HFCs）', gas: 'HFC-134a', value: 1526 },
  { type: '含氢氟碳化合物（HFCs）', gas: 'HFC-152a', value: 164 },
  { type: '含氢氟碳化合物（HFCs）', gas: 'HFC-227ea', value: 3602 },
  { type: '含氢氟碳化合物（HFCs）', gas: 'HFC-23', value: 14590 },
  { type: '含氢氟碳化合物（HFCs）', gas: 'HFC-236fa', value: 8689 },
  { type: '含氢氟碳化合物（HFCs）', gas: 'HFC-245fa', value: 962 },
  { type: '含氢氟碳化合物（HFCs）', gas: 'HFC-365mfc', value: 913 },
  { type: '含氢氟碳化合物（HFCs）', gas: 'HFC-43-10-mee', value: 1599 },
  { type: '全氟碳化合物（PFCs）', gas: 'CF₄', value: 7379 },
  { type: '全氟碳化合物（PFCs）', gas: 'C₂F₆', value: 12410 },
  { type: '全氟碳化合物（PFCs）', gas: 'C₃F₈', value: 9289 },
  { type: '全氟碳化合物（PFCs）', gas: 'C₄F₁₀', value: 10022 },
  { type: '全氟碳化合物（PFCs）', gas: 'C₅F₁₂', value: 9218 },
  { type: '全氟碳化合物（PFCs）', gas: 'C₆F₁₄', value: 8617 },
  { type: '全氟碳化合物（PFCs）', gas: 'C₇F₁₆', value: 8409 },
  { type: '全氟碳化合物（PFCs）', gas: 'c-C₄F₈', value: 13902 },
  { type: '六氟化硫（SF₆）', gas: 'SF₆', value: 25184 },
  { type: '三氟化氮（NF₃）', gas: 'NF₃', value: 17423 },
];

const ar6GwpLifetimeYears: Record<string, number | undefined> = {
  'CO₂': undefined,
  'CH₄（生物源）': 11.8,
  'CH₄（化石燃料燃烧）': 11.8,
  'CH₄（化石燃料逸散及工艺过程）': 11.8,
  'N₂O': 109,
  'HFC-32': 5.4,
  'HFC-143a': 51,
  'HFC-125': 30,
  'HFC-134a': 14,
  'HFC-152a': 1.6,
  'HFC-227ea': 36,
  'HFC-23': 228,
  'HFC-236fa': 213,
  'HFC-245fa': 7.9,
  'HFC-365mfc': 8.9,
  'HFC-43-10-mee': 17,
  'CF₄': 50000,
  'C₂F₆': 10000,
  'C₃F₈': 2600,
  'C₄F₁₀': 2600,
  'C₅F₁₂': 4100,
  'C₆F₁₄': 3100,
  'C₇F₁₆': 3000,
  'c-C₄F₈': 3000,
  'SF₆': 3200,
  'NF₃': 569,
};

const ar6GwpLibraryRows: CarbonFactor[] = ar6GwpRows.map((row, index) => ({
  factorId: `AR6-GWP100-${String(index + 1).padStart(2, '0')}`,
  scope: 'public', name: `${row.gas} 全球变暖潜势（GWP100）`, factorObject: row.gas,
  objectType: 'GWP值', activity: '全球变暖潜势', gas: row.gas, value: String(row.value), unit: `tCO₂e/t${row.gas.split('（')[0]}`,
  source: 'IPCC AR6 WGI（Forster 等，2021）', standard: 'IPCC AR6 WGI', applicability: '100年时间尺度', version: 'AR6 GWP100', geo: '全球', industry: '通用工业', validity: '当前有效', raw: `${row.value} tCO₂e/t${row.gas.split('（')[0]}`,
  quality: '国际权威参数', effective: '长期有效', reference: 'Table 9｜GWP100 values and atmospheric lifetimes', formula: 'CO₂e = 温室气体排放量 × 全球变暖潜势（GWP）', selectable: false, calculationType: 'parameter', catalogCategory: '全球变暖潜势', libraryCategoryCode: 'CAT-06', libraryCategoryName: '全球变暖潜势', libraryCalculationMode: 'CONSTANT', libraryDisplayValue: String(row.value), libraryMedium: row.gas, libraryLifetimeYears: ar6GwpLifetimeYears[row.gas], librarySourceId: 'IPCC-AR6-WGI', librarySourceLocation: 'Table 9',
}));

const factorLibrarySourceText = (factor: CarbonFactor) => `${factor.source}${factor.librarySourceLocation ?? factor.reference ? ` ${factor.librarySourceLocation ?? factor.reference}` : ''}`.trim();
const factorLibraryParameters = (factor: CarbonFactor) => {
  const parameters = factor.parameters ?? displayParameters(factor);
  if (factorLibraryCategory(factor) === '化石燃料') return parameters.filter((parameter) => ['ncv', 'cc', 'of', 'mw'].includes(parameter.key));
  if (factorLibraryCategory(factor) === '工业废水') return parameters.filter((parameter) => ['bo', 'mcf'].includes(parameter.key));
  if (factorLibraryCategory(factor) === '全球变暖潜势') return [
    { key: 'gas', name: '温室气体', value: 0, display: factor.gas || '—', unit: '—', sourceType: '官方缺省值', source: factor.source, editable: false },
    { key: 'timescale', name: '时间尺度', value: 100, display: '100年', unit: '年', sourceType: '官方缺省值', source: factor.source, editable: false },
    { key: 'gwp', name: '全球变暖潜势 GWP', value: Number(factor.value) || 0, display: factor.libraryDisplayValue ?? factor.value, unit: factor.unit, sourceType: '官方缺省值', source: factor.source, editable: false },
    ...(factor.libraryLifetimeYears === undefined ? [] : [{ key: 'lifetime', name: '大气寿命', value: factor.libraryLifetimeYears, display: String(factor.libraryLifetimeYears), unit: '年', sourceType: '官方缺省值', source: factor.source, editable: false }]),
  ];
  return parameters;
};

const factorLibraryCompositeValue = (factor: CarbonFactor) => {
  const values = new Map(factorLibraryParameters(factor).map((parameter) => [parameter.key, Number(parameter.value)]));
  const of = values.get('of') ?? 0;
  const ratio = of > 1 ? of / 100 : of;
  return (values.get('ncv') ?? 0) * (values.get('cc') ?? 0) / 1000 * ratio * 44 / 12;
};
const factorLibraryValue = (factor: CarbonFactor): number | string => factor.libraryCalculationMode === 'COMPOSITE' ? factorLibraryCompositeValue(factor) : factor.libraryDisplayValue ?? factor.value.replace(/^折算因子\s*/, '');
const factorLibraryDisplayUnit = (factor: CarbonFactor) => factor.unit === 'ratio' ? '%' : factor.unit || '—';
const formatFactorValue = (value: number | string) => typeof value === 'number' ? value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') : value;

const factorMatchesLibraryNode = (factor: CarbonFactor, key: string) => {
  if (!factorLibraryCategory(factor)) return false;
  if (key === 'TENANT_CUSTOM_FACTOR') return factor.libraryCategoryCode === 'TENANT_CUSTOM_FACTOR';
  if (key === 'all') return true;
  if (factor.libraryCategoryCode) {
    const top = factor.libraryCategoryCode.split('-').slice(0, 2).join('-');
    return libraryTopCodeBySeedCode[top] === key || factorLibraryChild(factor) === key;
  }
  const category = factorLibraryCategory(factor);
  if (key === 'FOSSIL_FUEL') return category === '化石燃料';
  if (key === 'CARBONATE') return category === '碳酸盐';
  if (key === 'INDUSTRIAL_WASTEWATER') return category === '工业废水';
  if (key === 'PURCHASED_ENERGY') return category === '购入能源';
  if (key === 'FUGITIVE_EMISSION') return category === '逸散排放';
  if (key === 'GWP') return category === '全球变暖潜势';
  if (key === 'SYSTEM_AND_THERMAL') return category === '系统常数与热工参数';
  return factorLibraryChild(factor) === key;
};

const tenantSourceLabel = (sourceType: TenantCustomFactorSourceType) => ({ ENTERPRISE: '企业数据', SUPPLIER: '供应商数据', EXTERNAL_PUBLIC: '外部公开来源', OTHER: '其他来源' }[sourceType]);
const tenantCustomFactorToCarbonFactor = (factor: TenantCustomCarbonFactor): CarbonFactor => ({
  factorId: `tenant-${factor.id}`, scope: 'enterprise', name: factor.factorName, factorObject: undefined,
  objectType: '综合排放因子', activity: '企业专属因子', gas: factor.greenhouseGasLabel ?? factor.greenhouseGas,
  value: String(factor.factorValue), unit: factor.unit, source: tenantSourceLabel(factor.sourceType), standard: '企业专属因子',
  applicability: `适用年度：${factor.effectiveYear}`, version: String(factor.effectiveYear), geo: '当前企业', industry: '当前企业', validity: '当前有效',
  raw: `${factor.factorValue} ${factor.unit}`, quality: '企业专属', effective: `${factor.effectiveYear}年度`,
  reference: `${factor.sourceEvidence}${factor.attachments.length ? `；证据材料：${factor.attachments.map((item) => item.fileName).join('、')}` : ''}`,
  formula: '排放量 = 活动数据 × 企业专属因子', selectable: true, calculationType: 'direct', publishedYear: factor.effectiveYear,
  catalogCategory: '企业专属因子', libraryCategoryCode: 'TENANT_CUSTOM_FACTOR', libraryCategoryName: '企业专属因子', libraryCalculationMode: 'DIRECT', libraryDisplayValue: String(factor.factorValue),
});

function FactorPage({
  factors,
  tenantFactors,
  setTenantFactors,
}: {
  factors: CarbonFactor[];
  tenantFactors: TenantCustomCarbonFactor[];
  setTenantFactors: (value: TenantCustomCarbonFactor[]) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState('TENANT_CUSTOM_FACTOR');
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ FOSSIL_FUEL: true, INDUSTRIAL_WASTEWATER: true, PURCHASED_ENERGY: true, FUGITIVE_EMISSION: true, SYSTEM_AND_THERMAL: true });
  const [electricityYear, setElectricityYear] = useState('all');
  const [electricityScope, setElectricityScope] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CarbonFactor | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<TenantCustomFactorAttachment>();
  const [addOpen, setAddOpen] = useState(false);
  const [editingTenantFactor, setEditingTenantFactor] = useState<TenantCustomCarbonFactor>();
  const [pendingDelete, setPendingDelete] = useState<TenantCustomCarbonFactor>();
  const [savedMessage, setSavedMessage] = useState('');
  const pageSize = 10;
  const searchable = (factor: CarbonFactor) => [factor.name, factor.source, factor.reference, factor.activity, factor.libraryMedium, factor.libraryFacilityType, factor.libraryScopeName, ...factorLibraryParameters(factor).map((parameter) => `${parameter.name} ${parameter.value}`)].join(' ').toLowerCase();
  const selectedElectricity = selectedCategory === 'PURCHASED_ELECTRICITY';
  const tenantRows: CarbonFactor[] = tenantFactors.map((factor): CarbonFactor => ({
    factorId: factor.id, scope: 'enterprise' as const, name: factor.factorName, factorObject: factor.factorName, objectType: '基础核算参数' as const,
    activity: '企业专属因子', gas: factor.greenhouseGasLabel ?? factor.greenhouseGas, value: String(factor.factorValue), unit: factor.unit, source: tenantSourceLabel(factor.sourceType),
    version: String(factor.effectiveYear), geo: factor.tenantId, industry: '当前企业', validity: '当前有效' as const, raw: String(factor.factorValue) + ' ' + factor.unit,
    quality: '企业专属', effective: String(factor.effectiveYear), reference: factor.sourceEvidence + (factor.attachments.length ? '；证据材料：' + factor.attachments.map((item) => item.fileName).join('、') : ''), selectable: false,
    calculationType: 'direct' as const, catalogCategory: '企业专属因子', libraryCategoryCode: 'TENANT_CUSTOM_FACTOR', libraryCategoryName: '企业专属因子', libraryCalculationMode: 'DIRECT' as const,
    libraryDisplayValue: String(factor.factorValue), libraryEffectiveYear: factor.effectiveYear,
  } satisfies CarbonFactor));
  const libraryRows = [...tenantRows, ...factors.filter((factor) => factor.libraryCategoryCode !== 'CAT-06'), ...ar6GwpLibraryRows];
  const filtered = libraryRows.filter((factor) => (selectedCategory === 'TENANT_CUSTOM_FACTOR' ? factor.libraryCategoryCode === 'TENANT_CUSTOM_FACTOR' : factor.scope === 'public' && factorMatchesLibraryNode(factor, selectedCategory)) && (!selectedElectricity || (electricityYear === 'all' || String(factor.libraryEffectiveYear) === electricityYear) && (electricityScope === 'all' || factor.libraryScopeType === electricityScope)) && (!keyword.trim() || searchable(factor).includes(keyword.trim().toLowerCase())));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const saveFactor = (factor: TenantCustomCarbonFactor) => { saveTenantCustomCarbonFactorV4(factor); setTenantFactors([factor, ...tenantFactors.filter((item) => item.id !== factor.id)]); setSavedMessage(editingTenantFactor ? '企业专属因子已更新' : '企业专属因子已保存'); setAddOpen(false); setEditingTenantFactor(undefined); window.setTimeout(() => setSavedMessage(''), 2200); };
  const deleteFactor = () => { if (!pendingDelete) return; deleteTenantCustomCarbonFactorV4(pendingDelete.id); setTenantFactors(tenantFactors.filter((item) => item.id !== pendingDelete.id)); setSelected(null); setPendingDelete(undefined); setSavedMessage('企业专属因子已删除'); window.setTimeout(() => setSavedMessage(''), 2200); };
  const years = Array.from(new Set(factors.filter((factor) => factor.libraryCategoryChildName === '电力' || factor.libraryCategoryChildName === '外购电力').map((factor) => String(factor.libraryEffectiveYear)).filter(Boolean))).sort();
  const scopes = Array.from(new Set(factors.filter((factor) => factor.libraryCategoryChildName === '电力').map((factor) => factor.libraryScopeType).filter(Boolean)));
  return <div className={styles.page}>
    <section className={`${styles.card} ${styles.factorLibraryHeader}`}><div><h2>碳排放因子库 <small>共 {filtered.length} 项</small></h2><p>按基础因子类别维护可跨核算期复用的缺省参数、系统常数与 GWP。</p></div><Button primary onClick={() => { setEditingTenantFactor(undefined); setAddOpen(true); }}>新增企业因子</Button></section>
    <section className={`${styles.card} ${styles.factorLibrary}`}>
      <aside className={styles.factorCatalog}><div className={styles.factorCatalogSearch}><input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} placeholder="请输入类别或因子名称" /><Button compact onClick={() => setPage(1)}>⌕</Button></div><div className={styles.factorCatalogTree}><FactorCatalogTree nodes={factorLibraryTree} selected={selectedCategory} select={(key) => { setSelectedCategory(key); setPage(1); }} expanded={expanded} toggle={(key) => setExpanded((current) => ({ ...current, [key]: !(current[key] ?? true) }))} /></div></aside>
      <main className={styles.factorLibraryMain}>{selectedElectricity && <div className={styles.factorLibraryFilters}><label>年份<select value={electricityYear} onChange={(event) => { setElectricityYear(event.target.value); setPage(1); }}><option value="all">全部年份</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label><label>口径<select value={electricityScope} onChange={(event) => { setElectricityScope(event.target.value); setPage(1); }}><option value="all">全部口径</option>{scopes.map((scope) => <option key={scope} value={scope}>{scope}</option>)}</select></label></div>}<div className={styles.factorTableWrap}><table className={styles.factorTable}><thead><tr><th>因子名称</th><th>因子值</th><th>单位</th><th>因子来源</th><th>操作</th></tr></thead><tbody>{pageRows.length ? pageRows.map((factor) => { const tenantFactor = factor.libraryCategoryCode === 'TENANT_CUSTOM_FACTOR' ? tenantFactors.find((item) => item.id === factor.factorId) : undefined; return <tr key={factor.factorId}><td><b className={styles.factorNamePrimary}>{factor.factorObject ?? factor.name}</b></td><td className={styles.factorValue}>{factor.libraryCalculationMode === 'LOOKUP' ? '—' : formatFactorValue(factorLibraryValue(factor))}</td><td>{factorLibraryDisplayUnit(factor)}</td><td><span className={styles.factorSource}>{factorLibrarySourceText(factor)}</span></td><td className={styles.rowActions}><button type="button" onClick={() => setSelected(factor)}>查看</button>{tenantFactor && <><button type="button" onClick={() => { setEditingTenantFactor(tenantFactor); setAddOpen(true); }}>编辑</button><button type="button" className={styles.deleteLink} onClick={() => setPendingDelete(tenantFactor)}>删除</button></>}</td></tr>; }) : <tr><td colSpan={5} className={styles.emptyRow}>未找到符合条件的因子。</td></tr>}</tbody></table></div><div className={styles.pagination}><div><button disabled={currentPage === 1} onClick={() => setPage(Math.max(1, currentPage - 1))}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 7).map((item) => <button key={item} className={item === currentPage ? styles.currentPage : ''} onClick={() => setPage(item)}>{item}</button>)}<button disabled={currentPage === totalPages} onClick={() => setPage(Math.min(totalPages, currentPage + 1))}>›</button></div><span>共 {filtered.length} 项</span></div></main>
    </section>
    {selected && <FactorLibraryDetailModal factor={selected} tenantFactor={tenantFactors.find((item) => item.id === selected.factorId)} onClose={() => setSelected(null)} onPreviewAttachment={setPreviewAttachment} />}
    {previewAttachment && <TenantFactorAttachmentPreviewDialog attachment={previewAttachment} close={() => setPreviewAttachment(undefined)} />}
    {addOpen && <FactorLibraryAddModal initialFactor={editingTenantFactor} onClose={() => { setAddOpen(false); setEditingTenantFactor(undefined); }} onSubmit={saveFactor} />}
    {pendingDelete && <Dialog title="删除企业专属因子" onClose={() => setPendingDelete(undefined)} footer={<><Button onClick={() => setPendingDelete(undefined)}>取消</Button><Button danger onClick={deleteFactor}>确认删除</Button></>}><div className={styles.confirmBox}>确认删除企业专属因子“{pendingDelete.factorName}”吗？删除后该因子及其已关联附件将从当前企业因子库中移除。</div></Dialog>}
    {savedMessage && <div className={styles.toast}>{savedMessage}</div>}
  </div>;
}

function FactorLibraryDetailModal({ factor, tenantFactor, onClose, onPreviewAttachment }: { factor: CarbonFactor; tenantFactor?: TenantCustomCarbonFactor; onClose: () => void; onPreviewAttachment: (attachment: TenantCustomFactorAttachment) => void }) {
  const category = factorLibraryCategory(factor) ?? '系统常数与热工参数';
  const parameters = [...factorLibraryParameters(factor)];
  if (category === '化石燃料' && !parameters.some((parameter) => parameter.key === 'mw')) {
    parameters.push({ key: 'mw', name: 'CO₂/C转换系数', value: 44 / 12, display: '44/12', unit: '—', sourceType: '官方缺省值', source: factor.source, editable: false });
  }
  const value = factorLibraryValue(factor);
  const formula = factor.formula ?? (category === '化石燃料' ? '综合 CO₂ 因子 = NCV × CC ÷ 1000 × OF × 44/12' : '按官方缺省值直接采用');
  const lookupRows = factor.libraryLookupKey === 'saturatedSteamEnthalpy' ? carbonFactorLibraryLookupTables.saturatedSteamEnthalpy : undefined;
  const lookupMatrix = factor.libraryLookupKey === 'superheatedSteamEnthalpy' ? carbonFactorLibraryLookupTables.superheatedSteamEnthalpy : undefined;
  return <Dialog title="查看因子" className={styles.factorLibraryDialog} onClose={onClose} footer={<Button onClick={onClose}>关闭</Button>}>
    <section className={styles.factorLibrarySection}><h3>1. 基础信息</h3><div className={styles.factorLibraryKvGrid}>
      <div><span>因子分类</span><b>{category}</b></div><div><span>因子名称</span><b>{factor.factorObject ?? factor.name}</b></div>
    </div></section>
    <section className={styles.factorLibrarySection}><h3>2. 因子值</h3><div className={styles.factorLibraryValueCard}><span>官方缺省值</span><strong>{formatFactorValue(value)}</strong><em>{factorLibraryDisplayUnit(factor)}</em></div></section>
    <section className={styles.factorLibrarySection}><h3>3. 核算参数</h3><table className={styles.factorLibraryParameterTable}><thead><tr><th>参数</th><th>官方缺省值</th><th>单位</th></tr></thead><tbody>{parameters.length ? parameters.map((parameter) => <tr key={parameter.key}><td>{parameter.name}</td><td>{parameter.display || parameter.value}</td><td>{parameter.unit || '—'}</td></tr>) : <tr><td colSpan={3}>该因子不包含独立核算参数。</td></tr>}</tbody></table></section>
    <section className={styles.factorLibrarySection}><h3>4. 计算关系</h3><div className={styles.factorLibraryFormula}>{formula}</div>{lookupRows ? <div className={styles.factorLookupTableWrap}><table className={styles.factorLibraryParameterTable}><thead><tr><th>压力（MPa）</th><th>温度（℃）</th><th>焓（kJ/kg）</th></tr></thead><tbody>{lookupRows.map((row) => <tr key={row.lookup_id}><td>{row.pressure_mpa}</td><td>{row.temperature_c}</td><td>{row.enthalpy_kj_per_kg}</td></tr>)}</tbody></table></div> : null}{lookupMatrix ? <div className={styles.factorLookupTableWrap}><table className={styles.factorLibraryParameterTable}><thead><tr>{lookupMatrix.columns.slice(0, -2).map((column) => <th key={column}>{column === 'temperature_c' ? '温度（℃）' : column.replace('p_', '').replace('_mpa', ' MPa')}</th>)}</tr></thead><tbody>{lookupMatrix.rows.map((row, index) => <tr key={index}>{row.slice(0, -2).map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div> : null}</section>
    <section className={styles.factorLibrarySection}><h3>5. 标准与来源</h3><div className={styles.factorLibraryKvGrid}><div><span>核算标准</span><b>{factor.standard ?? 'GB/T 32150—2025'}</b></div><div><span>因子来源</span><b>{factorLibrarySourceText(factor)}</b></div></div></section>
    {tenantFactor && <section className={styles.factorLibrarySection}><h3>6. 已上传附件</h3>{tenantFactor.attachments.length ? <div className={styles.tenantFactorPreviewList}>{tenantFactor.attachments.map((attachment) => <div className={styles.tenantFactorPreviewRow} key={attachment.attachmentId}><div><b>{attachment.fileName}</b><small>{attachment.fileType} · {formatAttachmentSize(attachment.size)}</small></div><button type="button" onClick={() => onPreviewAttachment(attachment)}>预览</button></div>)}</div> : <div className={styles.emptyMaterialPanel}>暂无已上传附件</div>}</section>}
  </Dialog>;
}

const formatAttachmentSize = (size: number) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;

function TenantFactorAttachmentPreviewDialog({ attachment, close }: { attachment: TenantCustomFactorAttachment; close: () => void }) {
  return <Dialog title={`预览附件：${attachment.fileName}`} className={styles.factorLibraryDialog} onClose={close} footer={<Button onClick={close}>关闭</Button>}>
    <section className={styles.factorLibrarySection}><h3>附件信息</h3><div className={styles.factorLibraryKvGrid}><div><span>文件名称</span><b>{attachment.fileName}</b></div><div><span>文件类型</span><b>{attachment.fileType || '未知类型'}</b></div><div><span>文件大小</span><b>{formatAttachmentSize(attachment.size)}</b></div></div></section>
    <div className={styles.tenantFactorAttachmentPreview}>当前为原型预览。正式接入文件服务后，此处展示 PDF 或图片内容。</div>
  </Dialog>;
}

function LegacyFactorLibraryAddModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (factor: CarbonFactor) => void }) {
  const categories: FactorLibraryCategory[] = ['化石燃料', '碳酸盐', '工业废水', '购入能源', '逸散排放', '全球变暖潜势', '系统常数与热工参数'];
  const [category, setCategory] = useState<FactorLibraryCategory>('化石燃料');
  const [name, setName] = useState('');
  const [ncv, setNcv] = useState('42.652');
  const [cc, setCc] = useState('20.2');
  const [of, setOf] = useState('98');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('tCO₂/t');
  const [wastewaterType, setWastewaterType] = useState<'Bo' | 'MCF'>('Bo');
  const [applicability, setApplicability] = useState('');
  const [energyType, setEnergyType] = useState<'电力' | '热力'>('电力');
  const [effectiveYear, setEffectiveYear] = useState('2023');
  const [scopeType, setScopeType] = useState('全国平均');
  const [scopeName, setScopeName] = useState('全国');
  const [medium, setMedium] = useState('HFCs/PFCs');
  const [facilityType, setFacilityType] = useState('');
  const [fugitiveRate, setFugitiveRate] = useState('5.5');
  const [systemMode, setSystemMode] = useState<'constant' | 'saturatedSteamEnthalpy' | 'superheatedSteamEnthalpy'>('constant');
  const [gas, setGas] = useState('CH₄');
  const [gwpValue, setGwpValue] = useState('21');
  const [standard, setStandard] = useState('GB/T 32150—2025');
  const [sourceFile, setSourceFile] = useState('');
  const [sourceLocation, setSourceLocation] = useState('');
  const numeric = (input: string) => Number(input) || 0;
  const fuelValue = numeric(ncv) * numeric(cc) / 1000 * (numeric(of) / 100) * 44 / 12;
  const preview = category === '化石燃料' ? fuelValue : category === '全球变暖潜势' ? numeric(gwpValue) : category === '逸散排放' ? numeric(fugitiveRate) : numeric(value);
  const previewUnit = category === '化石燃料' ? unit : category === '全球变暖潜势' ? 'tCO₂e/tCH₄' : category === '逸散排放' ? '%' : unit;
  const submit = () => {
    const finalName = name.trim() || (category === '工业废水' ? `甲烷${wastewaterType === 'Bo' ? '最大生产能力 Bo' : '修正因子 MCF'}` : category === '购入能源' ? `外购${energyType}` : category === '全球变暖潜势' ? `${gas} 全球变暖潜势` : category === '逸散排放' ? `${facilityType || '设备'} ${medium} 缺省逸散率` : systemMode === 'saturatedSteamEnthalpy' ? '饱和蒸汽热焓表' : systemMode === 'superheatedSteamEnthalpy' ? '过热蒸汽热焓表' : '自定义因子');
    const source = sourceFile.trim() || '自定义录入';
    const reference = sourceLocation.trim() || '自定义录入';
    const fuelParams: CarbonFactorParameter[] = [
      { key: 'ncv', name: '低位发热量 NCV', value: numeric(ncv), display: ncv, unit: 'GJ/t', sourceType: '官方缺省值', source, editable: true },
      { key: 'cc', name: '单位热值含碳量 CC', value: numeric(cc), display: cc, unit: 'tC/TJ', sourceType: '官方缺省值', source, editable: true },
      { key: 'of', name: '碳氧化率 OF', value: numeric(of), display: of, unit: '%', sourceType: '官方缺省值', source, editable: true },
      { key: 'mw', name: 'CO₂/C转换系数', value: 44 / 12, display: '44/12', unit: '—', sourceType: '官方缺省值', source, editable: false },
    ];
    const params = category === '化石燃料' ? fuelParams : category === '工业废水' ? [{ key: wastewaterType.toLowerCase(), name: wastewaterType === 'Bo' ? '甲烷最大生产能力 Bo' : '甲烷修正因子 MCF', value: numeric(value), display: value || '0', unit: unit || '—', sourceType: '官方缺省值', source, editable: true }] : undefined;
    const calculationType: CarbonFactor['calculationType'] = category === '化石燃料' ? 'fuelParameter' : category === '工业废水' ? 'wastewaterParameter' : category === '碳酸盐' ? 'processParameter' : category === '系统常数与热工参数' ? 'parameter' : 'direct';
    const calculationScenario: CarbonFactor['calculationScenario'] = category === '化石燃料' ? 'fuelCombustion' : category === '工业废水' ? 'wastewaterAnaerobic' : category === '碳酸盐' ? 'carbonateProcess' : category === '购入能源' ? (energyType === '电力' ? 'purchasedElectricity' : 'purchasedHeat') : undefined;
    const objectType: CarbonFactor['objectType'] = category === '化石燃料' ? '参数组/公式模板' : category === '全球变暖潜势' ? 'GWP值' : category === '系统常数与热工参数' ? '方法学常数' : category === '购入能源' ? '综合排放因子' : '基础核算参数';
    const libraryCategoryCode = category === '化石燃料' ? 'CAT-01-02' : category === '碳酸盐' ? 'CAT-02' : category === '工业废水' ? (wastewaterType === 'Bo' ? 'CAT-03-01' : 'CAT-03-02') : category === '购入能源' ? (energyType === '电力' ? 'CAT-04-01' : 'CAT-04-02') : category === '逸散排放' ? 'CAT-05-01' : category === '全球变暖潜势' ? 'CAT-06' : systemMode === 'constant' ? 'CAT-07-01' : 'CAT-07-02';
    const factor: CarbonFactor = {
      factorId: `custom-${Date.now()}`, scope: 'public', name: finalName, factorObject: finalName, objectType, standard: standard.trim() || 'GB/T 32150—2025', applicability: applicability.trim() || undefined,
      activity: category === '购入能源' ? `购入${energyType}` : category, gas: category === '全球变暖潜势' ? gas : category === '工业废水' ? 'CH₄' : 'CO₂',
      value: String(category === '逸散排放' ? numeric(fugitiveRate) / 100 : preview), unit: previewUnit, source, version: effectiveYear || '自定义录入', geo: scopeName || '全国', industry: '通用工业', validity: '当前有效', raw: `${preview} ${previewUnit}`, quality: '平台录入', effective: effectiveYear ? `${effectiveYear}年度` : '长期有效', reference, selectable: category !== '系统常数与热工参数', calculationType, calculationScenario, parameters: params,
      formula: category === '化石燃料' ? '综合 CO₂ 因子 = NCV × CC ÷ 1000 × OF × 44/12' : category === '全球变暖潜势' ? 'CO₂e = 温室气体排放量 × 全球变暖潜势（GWP）' : undefined,
      catalogCategory: category, libraryCategoryCode, libraryCategoryName: category, libraryCategoryChildName: category === '逸散排放' ? '制冷剂逸散' : category === '购入能源' ? energyType : undefined, libraryCalculationMode: category === '化石燃料' ? 'COMPOSITE' : category === '系统常数与热工参数' && systemMode !== 'constant' ? 'LOOKUP' : category === '全球变暖潜势' ? 'CONSTANT' : 'DIRECT', libraryDisplayValue: category === '逸散排放' ? `${numeric(fugitiveRate).toFixed(2)}%` : systemMode === 'constant' ? String(preview) : '查表', libraryEffectiveYear: category === '购入能源' && energyType === '电力' ? effectiveYear : undefined, libraryScopeType: category === '购入能源' && energyType === '电力' ? scopeType : undefined, libraryScopeName: category === '购入能源' && energyType === '电力' ? scopeName : undefined, libraryMedium: category === '逸散排放' ? medium : undefined, libraryFacilityType: category === '逸散排放' ? facilityType : undefined, libraryLookupKey: systemMode === 'constant' ? undefined : systemMode,
    };
    onSubmit(factor);
  };
  return <Dialog title="新增因子" wide className={styles.factorLibraryAddDialog} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button primary onClick={submit}>保存因子</Button></>}>
    <section className={styles.factorLibrarySection}><h3>1. 基础信息</h3><div className={styles.factorLibraryFormGrid}><label className={styles.factorLibraryField}><span>因子分类</span><select value={category} onChange={(event) => setCategory(event.target.value as FactorLibraryCategory)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label className={styles.factorLibraryField}><span>因子名称</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="请输入因子名称" /></label></div></section>
    <section className={styles.factorLibrarySection}><h3>2. 因子参数</h3>{category === '化石燃料' && <div className={styles.factorLibraryFormGrid}><label className={styles.factorLibraryField}><span>低位发热量 NCV</span><input type="number" value={ncv} onChange={(event) => setNcv(event.target.value)} /></label><label className={styles.factorLibraryField}><span>单位热值含碳量 CC</span><input type="number" value={cc} onChange={(event) => setCc(event.target.value)} /></label><label className={styles.factorLibraryField}><span>碳氧化率 OF（%）</span><input type="number" value={of} onChange={(event) => setOf(event.target.value)} /></label><label className={styles.factorLibraryField}><span>CO₂/C转换系数</span><input className={styles.factorLibraryReadOnly} value="44/12" readOnly /></label></div>}{category === '碳酸盐' && <div className={styles.factorLibraryFormGrid}><label className={styles.factorLibraryField}><span>CO₂排放因子</span><input type="number" value={value} onChange={(event) => setValue(event.target.value)} /></label><label className={styles.factorLibraryField}><span>单位</span><input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="如：tCO₂/t" /></label></div>}{category === '工业废水' && <div className={styles.factorLibraryFormGrid}><label className={styles.factorLibraryField}><span>参数类型</span><select value={wastewaterType} onChange={(event) => setWastewaterType(event.target.value as 'Bo' | 'MCF')}><option>Bo</option><option>MCF</option></select></label><label className={styles.factorLibraryField}><span>参数值</span><input type="number" value={value} onChange={(event) => setValue(event.target.value)} /></label><label className={styles.factorLibraryField}><span>单位</span><input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="请输入单位" /></label><label className={`${styles.factorLibraryField} ${styles.factorLibraryFieldFull}`}><span>适用说明</span><textarea value={applicability} onChange={(event) => setApplicability(event.target.value)} placeholder="请输入适用说明" /></label></div>}{category === '购入能源' && <div className={styles.factorLibraryFormGrid}><label className={styles.factorLibraryField}><span>能源类型</span><select value={energyType} onChange={(event) => setEnergyType(event.target.value as '电力' | '热力')}><option>电力</option><option>热力</option></select></label><label className={styles.factorLibraryField}><span>因子值</span><input type="number" value={value} onChange={(event) => setValue(event.target.value)} /></label><label className={styles.factorLibraryField}><span>单位</span><input value={unit} onChange={(event) => setUnit(event.target.value)} /></label>{energyType === '电力' && <><label className={styles.factorLibraryField}><span>年份</span><input value={effectiveYear} onChange={(event) => setEffectiveYear(event.target.value)} /></label><label className={styles.factorLibraryField}><span>口径</span><select value={scopeType} onChange={(event) => setScopeType(event.target.value)}><option>全国平均</option><option>区域平均</option><option>省级平均</option><option>其他口径</option></select></label><label className={styles.factorLibraryField}><span>口径名称</span><input value={scopeName} onChange={(event) => setScopeName(event.target.value)} /></label></>}</div>}{category === '逸散排放' && <div className={styles.factorLibraryFormGrid}><label className={styles.factorLibraryField}><span>气体/介质</span><input value={medium} onChange={(event) => setMedium(event.target.value)} /></label><label className={styles.factorLibraryField}><span>设施类型</span><input value={facilityType} onChange={(event) => setFacilityType(event.target.value)} /></label><label className={styles.factorLibraryField}><span>缺省逸散率（%）</span><input type="number" value={fugitiveRate} onChange={(event) => setFugitiveRate(event.target.value)} /></label></div>}{category === '全球变暖潜势' && <div className={styles.factorLibraryFormGrid}><label className={styles.factorLibraryField}><span>温室气体</span><select value={gas} onChange={(event) => setGas(event.target.value)}><option>CH₄</option></select></label><label className={styles.factorLibraryField}><span>时间尺度</span><input className={styles.factorLibraryReadOnly} value="100年" readOnly /></label><label className={styles.factorLibraryField}><span>GWP值</span><input type="number" value={gwpValue} onChange={(event) => setGwpValue(event.target.value)} /></label><label className={styles.factorLibraryField}><span>单位</span><input className={styles.factorLibraryReadOnly} value="tCO₂e/tCH₄" readOnly /></label></div>}{category === '系统常数与热工参数' && <div className={styles.factorLibraryFormGrid}><label className={styles.factorLibraryField}><span>参数值/查表</span><select value={systemMode} onChange={(event) => setSystemMode(event.target.value as typeof systemMode)}><option value="constant">系统常数</option><option value="saturatedSteamEnthalpy">饱和蒸汽热焓表</option><option value="superheatedSteamEnthalpy">过热蒸汽热焓表</option></select></label><label className={styles.factorLibraryField}><span>参数值</span><input value={value} onChange={(event) => setValue(event.target.value)} disabled={systemMode !== 'constant'} /></label><label className={styles.factorLibraryField}><span>单位</span><input value={unit} onChange={(event) => setUnit(event.target.value)} /></label></div>}</section>
    <section className={styles.factorLibrarySection}><h3>3. 因子值预览</h3><div className={styles.factorLibraryValueCard}><span>当前计算值</span><strong>{preview ? preview.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') : '—'}</strong><em>{previewUnit}</em></div></section>
    <section className={styles.factorLibrarySection}><h3>4. 计算关系</h3><div className={styles.factorLibraryFormula}>{category === '化石燃料' ? '综合 CO₂ 因子 = NCV × CC ÷ 1000 × OF × 44/12' : category === '全球变暖潜势' ? 'CO₂e = 温室气体排放量 × 全球变暖潜势（GWP）' : '按因子值直接采用'}</div></section>
    <section className={styles.factorLibrarySection}><h3>5. 标准与来源</h3><div className={styles.factorLibraryFormGrid}><label className={styles.factorLibraryField}><span>核算标准</span><input value={standard} onChange={(event) => setStandard(event.target.value)} /></label><label className={styles.factorLibraryField}><span>来源文件</span><input value={sourceFile} onChange={(event) => setSourceFile(event.target.value)} placeholder="请输入来源文件" /></label><label className={`${styles.factorLibraryField} ${styles.factorLibraryFieldFull}`}><span>来源位置</span><input value={sourceLocation} onChange={(event) => setSourceLocation(event.target.value)} placeholder="如：附录二 表2.1" /></label></div></section>
  </Dialog>;
}

const tenantFactorSourceOptions: Array<{ value: TenantCustomFactorSourceType; label: string }> = [
  { value: 'ENTERPRISE', label: '企业数据' },
  { value: 'SUPPLIER', label: '供应商数据' },
  { value: 'EXTERNAL_PUBLIC', label: '外部公开来源' },
  { value: 'OTHER', label: '其他来源' },
];

function FactorLibraryAddModal({ initialFactor, onClose, onSubmit }: { initialFactor?: TenantCustomCarbonFactor; onClose: () => void; onSubmit: (factor: TenantCustomCarbonFactor) => void }) {
  const currentYear = new Date().getFullYear();
  const [factorName, setFactorName] = useState(initialFactor?.factorName ?? '');
  const [factorValue, setFactorValue] = useState(initialFactor ? String(initialFactor.factorValue) : '');
  const [unit, setUnit] = useState(initialFactor?.unit ?? '');
  const [sourceType, setSourceType] = useState<TenantCustomFactorSourceType>(initialFactor?.sourceType ?? 'ENTERPRISE');
  const [effectiveYear, setEffectiveYear] = useState(initialFactor ? String(initialFactor.effectiveYear) : String(currentYear));
  const [sourceEvidence, setSourceEvidence] = useState(initialFactor?.sourceEvidence ?? '');
  const [existingAttachments, setExistingAttachments] = useState<TenantCustomFactorAttachment[]>(initialFactor?.attachments ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const sourceConfig: Record<TenantCustomFactorSourceType, { placeholder: string; title: string; helper: string }> = {
    ENTERPRISE: { placeholder: '例如：企业检测报告2026-01号 / 内部计算说明', title: '上传企业证据材料', helper: '企业数据建议至少上传一份检测报告、计算说明或相关技术文件。' },
    SUPPLIER: { placeholder: '例如：XX供应商检测报告 / 产品碳数据证明', title: '上传供应商证明', helper: '供应商数据建议上传供应商证明、产品资料或检测报告。' },
    EXTERNAL_PUBLIC: { placeholder: '例如：《XX标准》第5.2条 / XX数据库记录 / 研究报告表3', title: '上传参考文件（可选）', helper: '公开标准、指南、报告或数据库可直接在“来源依据”中填写完整出处，附件可选。' },
    OTHER: { placeholder: '例如：集团内部规则《XX规则》第3条', title: '上传证据材料', helper: '其他来源建议上传能够证明因子取值依据的文件。' },
  };
  const submit = () => {
    const numericValue = Number(factorValue);
    if (!factorName.trim()) return setError('请填写因子名称。');
    if (!factorValue.trim() || !Number.isFinite(numericValue)) return setError('请填写有效的因子值。');
    if (!unit.trim()) return setError('请填写单位。');
    if (!effectiveYear) return setError('请选择适用年度。');
    if (!sourceEvidence.trim()) return setError('请填写来源依据。');
    if (sourceType !== 'EXTERNAL_PUBLIC' && existingAttachments.length + files.length === 0) return setError('当前数据来源请至少上传一份证据材料。');
    const attachments: TenantCustomFactorAttachment[] = [...existingAttachments, ...files.map((file, index) => ({
      attachmentId: 'tenant-factor-file-' + Date.now() + '-' + index,
      fileName: file.name,
      fileType: file.type || '未知类型',
      size: file.size,
    }))];
    onSubmit({
      id: initialFactor?.id ?? 'tenant-factor-' + Date.now(),
      libraryCategory: 'TENANT_CUSTOM_FACTOR',
      factorName: factorName.trim(),
      greenhouseGas: 'CO2',
      greenhouseGasLabel: undefined,
      factorValue: numericValue,
      unit: unit.trim(),
      sourceType,
      effectiveYear: Number(effectiveYear),
      sourceEvidence: sourceEvidence.trim(),
      attachments,
      tenantId: 'tenant-current',
      createdAt: initialFactor?.createdAt ?? new Date().toISOString(),
      createdBy: initialFactor?.createdBy ?? '当前用户',
      status: 'ACTIVE',
    });
  };
  return <Dialog title={initialFactor ? '编辑企业专属因子' : '新增企业专属因子'} wide className={`${styles.factorLibraryAddDialog} ${styles.tenantFactorDialog}`} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button primary onClick={submit}>{initialFactor ? '保存修改' : '保存因子'}</Button></>}>
    <div className={styles.tenantFactorSubtitle}>新增内容仅归入当前企业的专属因子库，不修改系统公共基础库。</div>
    <div className={styles.tenantFactorNotice}>公共基础因子保持只读；企业新增的特殊因子需保留来源和证据材料，便于后续核查追溯。</div>
    <section className={styles.factorLibrarySection}><h3>1. 基础信息</h3><div className={styles.factorLibraryFormGrid}>
      <label className={styles.factorLibraryField + ' ' + styles.factorLibraryFieldFull}><span>因子名称 <i>*</i></span><input value={factorName} onChange={(event) => setFactorName(event.target.value)} placeholder="例如：某特殊原料生产排放因子" /></label>
      <label className={styles.factorLibraryField}><span>因子值 <i>*</i></span><input type="number" step="any" value={factorValue} onChange={(event) => setFactorValue(event.target.value)} placeholder="请输入" /></label>
      <label className={styles.factorLibraryField}><span>单位 <i>*</i></span><input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="例如：tCO₂/t、kgCO₂e/kg" /></label>
    </div></section>
    <section className={styles.factorLibrarySection}><h3>2. 因子依据</h3><div className={styles.factorLibraryFormGrid}>
      <label className={styles.factorLibraryField}><span>数据来源 <i>*</i></span><select value={sourceType} onChange={(event) => setSourceType(event.target.value as TenantCustomFactorSourceType)}>{tenantFactorSourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className={styles.factorLibraryField}><span>适用年度 <i>*</i></span><select value={effectiveYear} onChange={(event) => setEffectiveYear(event.target.value)}>{Array.from({ length: 7 }, (_, index) => currentYear + 1 - index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
      <label className={styles.factorLibraryField + ' ' + styles.factorLibraryFieldFull}><span>来源依据 <i>*</i></span><input value={sourceEvidence} onChange={(event) => setSourceEvidence(event.target.value)} placeholder={sourceConfig[sourceType].placeholder} /></label>
    </div></section>
    <section className={styles.factorLibrarySection}><h3>3. 证据材料</h3>
      <FileDropzone title={sourceConfig[sourceType].title} hint="仅支持 PDF 或图片，可一次上传多个文件" accept={EVIDENCE_FILE_ACCEPT} multiple onFiles={(selectedFiles) => { const validFiles = filterEvidenceFiles(selectedFiles); if (validFiles.length) setFiles((current) => [...current, ...validFiles]); }} />
      <div className={styles.tenantFactorFileList}>{existingAttachments.map((file) => <div className={styles.tenantFactorFile} key={file.attachmentId}><span>{file.fileName}</span><div className={styles.tenantFactorFileActions}><small>已上传</small><button type="button" onClick={() => setExistingAttachments((current) => current.filter((item) => item.attachmentId !== file.attachmentId))}>删除</button></div></div>)}{files.map((file, index) => <div className={styles.tenantFactorFile} key={file.name + '-' + index}><span>{file.name}</span><div className={styles.tenantFactorFileActions}><small>待上传</small><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>删除</button></div></div>)}</div>
      <p className={styles.tenantFactorUploadHelper}>{sourceConfig[sourceType].helper}</p>
    </section>
    {error && <div className={styles.tenantFactorError}>{error}</div>}
  </Dialog>;
}

function SourceDrawer({
  state,
  allowEdit,
  close,
  save,
  edit,
  chooseFactor,
}: {
  state: Extract<DrawerState, { kind: 'source' }>;
  allowEdit: boolean;
  close: () => void;
  save: (input: Omit<EmissionSource, 'emissionSourceId'>, id: string) => void;
  edit: () => void;
  chooseFactor: (row: EmissionSource) => void;
}) {
  const row = state.row;
  const [activity, setActivity] = useState(String(numberFromActivity(row.activityData)));
  const [unit, setUnit] = useState(unitFromActivity(row.activityData));
  const factor = getCarbonFactorV4(state.factorId ?? row.emissionFactorId);
  const readOnly = state.mode === 'view';
  const energyLinked = isEnergyLinkedSource(row);
  const result = factor ? recalculate(Number(activity), unit, factor) : 0;
  const isNetPurchased = factor?.calculationScenario === 'purchasedElectricity' || factor?.calculationScenario === 'purchasedHeat';
  const submit = () => factor && save({ ...row, factorName: factor.name, greenhouseGasSpecies: [factorGasForRow(factor)], emissionFactorId: factor.factorId, factorObjectId: factor.factorObject ?? factor.factorId, factorVersionId: factor.version, activityValue: Number(activity), activityUnit: unit, activityData: `${Number(activity).toLocaleString('zh-CN')} ${unit}`, emissionAmount: result }, row.emissionSourceId);
  return <Dialog title={readOnly ? '排放源详情' : '编辑排放源'} className={styles.sourceDetailDialog} onClose={close} footer={<><Button onClick={close}>{readOnly ? '关闭' : '取消'}</Button>{readOnly && allowEdit ? <Button primary onClick={edit}>编辑</Button> : !readOnly && allowEdit ? <Button primary onClick={submit}>保存并重新计算</Button> : null}</>}>
    <DetailBlock title="基本信息"><div className={styles.basicInfoGrid}><div><span>排放类别</span><b>{row.emissionCategory}</b></div><div><span>温室气体源类型</span><b>{row.sourceType}</b></div><div><span>排放源</span><b>{row.sourceName}</b></div><div><span>温室气体种类</span><b>{row.greenhouseGasSpecies.join('、')}</b></div></div></DetailBlock>
    <DetailBlock title="核算数据"><div className={styles.calculationGrid}><div className={styles.activityPane}>{readOnly || energyLinked ? <><span>{isNetPurchased ? '净购入量' : '活动数据'}</span><b>{row.activityData}</b><small>{isNetPurchased && row.purchasedAmount !== undefined ? `净购入量 = 购入量 ${format(row.purchasedAmount, 2)} − 外供量 ${format(row.exportedAmount ?? 0, 2)} ${unit}` : ''}{energyLinked ? '能源数据自动同步 · 活动数据只读' : row.activityDataSource}</small></> : <div className={styles.activityInputs}><Field label="活动数据值"><input type="number" min="0" value={activity} onChange={(event) => setActivity(event.target.value)} /></Field><Field label="单位"><input value={unit} onChange={(event) => setUnit(event.target.value)} /></Field></div>}</div><div className={styles.resultPane}><div><span>核算因子</span><b>{factor ? calculationFactorDisplay(row, factor.factorId) : '待补充'}</b></div><div><span>排放量</span><b>{format(readOnly ? row.emissionAmount : result)} tCO₂e</b></div></div></div></DetailBlock>
    <FactorCalculationDetails factor={factor} row={row} />
    {!readOnly && allowEdit && <div className={styles.factorActions}><Button outline compact onClick={() => chooseFactor(row)}>{factor ? '更换核算因子' : '选择核算因子'}</Button></div>}
  </Dialog>;
}

function LegacySourceDrawer({
  state,
  allowEdit,
  close,
  save,
  chooseFactor,
  goSupport,
  goUpstream,
}: {
  state: Extract<DrawerState, { kind: 'source' }>;
  allowEdit: boolean;
  close: () => void;
  save: (input: Omit<EmissionSource, 'emissionSourceId'>, id: string) => void;
  chooseFactor: (row: EmissionSource) => void;
  goSupport: () => void;
  goUpstream: () => void;
}) {
  const row = state.row;
  const [activity, setActivity] = useState(String(numberFromActivity(row.activityData)));
  const factor = getCarbonFactorV4(state.factorId ?? row.emissionFactorId);
  const unit = unitFromActivity(row.activityData);
  const readOnly = state.mode === 'view';
  const system = row.entryMode === 'system';
  const energyRecord = isEnergyLinkedSource(row) ? listV11EnergyRecords().find((record) => record.energyRecordId === (row.relatedEnergyRecordId ?? row.sourceRecordId)) : undefined;
  const energyType = energyRecord ? listV11EnergyTypes(energyRecord.year).find((item) => item.energyTypeId === energyRecord.energyTypeId) : undefined;
  const sourceContext = energyRecord ? energyContext(energyRecord) : undefined;
  const originalActivity = energyRecord && energyType ? `${v11EnergyRecordAnnualAmount(energyRecord).toLocaleString('zh-CN')} ${energyType.measurementUnit}` : row.activityData;
  const sourceYear = energyRecord?.year ?? Number(row.emissionSourceId.match(/20\d{2}/)?.[0] ?? 0);
  const sourceObject = sourceContext?.objectName ?? row.sourceName.match(/（(.+?)(?:，使用场景待确认)?）/)?.[1] ?? '待确认';
  const result = factor ? recalculate(Number(activity), unit, factor) : 0;
  const submit = () => factor && save({ ...row, factorName: factor.name, greenhouseGasSpecies: [factorGasForRow(factor)], emissionFactorId: factor.factorId, factorObjectId: factor.factorObject ?? factor.factorId, factorVersionId: factor.version, activityValue: Number(activity), activityUnit: unit, activityData: `${row.emissionSourceId === 'es-clinker' ? '原料消耗量：' : ''}${Number(activity).toLocaleString('zh-CN')} ${unit}`, emissionAmount: result }, row.emissionSourceId);
  return (
    <Drawer title={readOnly ? '排放源详情' : '编辑排放源'} onClose={close} footer={<><Button onClick={close}>{readOnly ? '关闭' : '取消'}</Button>{readOnly && allowEdit ? <Button primary onClick={() => save(row, row.emissionSourceId)}>编辑</Button> : !readOnly ? <Button primary onClick={submit}>保存并重新计算</Button> : null}</>}>
      <DetailBlock title="基本信息"><div className={styles.basicInfoGrid}><div><span>排放类别</span><b>{row.emissionCategory}</b></div><div><span>温室气体源类型</span><b>{row.sourceType}</b></div><div><span>排放源</span><b>{row.sourceName}</b></div><div><span>温室气体种类</span><b>{row.greenhouseGasSpecies.join('、')}</b></div></div></DetailBlock>
      <DetailBlock title="核算数据">
        <div className={styles.calculationGrid}><div className={styles.activityPane}>{readOnly || system ? <><span>活动数据</span><b>{row.activityData}</b><small>{isEnergyLinkedSource(row) ? `能源数据自动同步｜数据来源：数据管理 / 能源消费数据｜数据期间：${sourceYear ? `${sourceYear}年度` : '待确认'}｜能源品种：${energyType?.energyTypeName ?? factor?.activity ?? row.factorName}｜使用对象 / 用能单元：${sourceObject}｜原始活动数据：${originalActivity}` : row.activityDataSource}{!readOnly && system ? ' · 数据由上游模块关联，只读' : ''}</small></> : <div className={styles.activityInputs}><Field label="活动数据值"><input type="number" min="0" value={activity} onChange={(event) => setActivity(event.target.value)} /></Field><Field label="单位"><input value={unit} readOnly /></Field></div>}</div><div className={styles.resultPane}><div><span>结果因子/折算值</span><b>{factor ? factorSummary(row, factor.factorId) : '待补充'}</b></div><div><span>排放量</span><b>{format(readOnly ? row.emissionAmount : result)} tCO₂e</b></div></div></div>
      </DetailBlock>
      <DetailBlock title="因子来源"><div className={styles.factorSourceLayout}><div className={styles.sourceCard}><span>名称</span><b>{factor?.name ?? '尚未匹配排放因子'}</b><span>来源与版本</span><span>{factor ? `${factor.source} · ${factor.version}` : '请从因子库选择或新增自定义因子'}</span></div>{!readOnly && <div className={styles.factorActions}><Button outline compact onClick={() => chooseFactor(row)}>{factor ? '更换因子/参数' : '选择因子/参数'}</Button></div>}</div></DetailBlock>
      <FactorCalculationDetails factor={factor} row={row} />
      <DetailBlock title="数据追溯信息"><div className={styles.kv}><span>记录生成方式</span><span>{row.recordGenerationType === 'system' ? '系统识别' : '人工新增'}</span><span>上游数据模块</span><span>{row.sourceModule}</span><span>上游记录编号</span><span>{row.sourceRecordId}</span><span>因子或参数对象</span><span>{row.factorObjectId}</span><span>因子版本</span><span>{row.factorVersionId}</span><span>创建人</span><span>{row.createdBy}</span><span>创建时间</span><span>{row.createdAt}</span></div>{system && <Button outline compact onClick={goUpstream}>前往上游数据</Button>}</DetailBlock>
      <DetailBlock title="来源与材料"><div className={styles.sourceCard}><span>活动数据来源</span><b>{row.activityDataSource}</b><span>因子/参数来源</span><span>{factor ? `${factor.source} · ${factor.version}` : '待补充'}</span><span>证明材料</span><span><Tag>已关联材料</Tag>　<button className={styles.textButton} onClick={goSupport}>前往核查支撑</button></span></div></DetailBlock>
    </Drawer>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.detailBlock}><h3>{title}</h3>{children}</section>;
}

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return <label className={`${styles.field} ${full ? styles.fieldFull : ''}`}><span>{label}</span>{children}</label>;
}

function FactorCalculationDetails({ factor, row }: { factor?: CarbonFactor; row?: EmissionSource }) {
  if (!factor) return null;
  const standard = factor.standard && !['官方缺省值', '方法学参数'].includes(factor.standard) ? factor.standard : '按适用核算方法';
  const source = `${factor.source}${factor.reference ? ` ${factor.reference}` : ''}`;
  if (factor.factorId === 'pf-waste' && row) {
    const parameters = new Map((factor.parameters ?? []).map((parameter) => [parameter.key, parameter.value]));
    const cod = row.activityValue;
    const sludgeCod = parameters.get('sludgeCod') ?? 0;
    const bo = parameters.get('bo') ?? 0.25;
    const mcf = parameters.get('mcf') ?? 0;
    const gwp = parameters.get('gwp') ?? 21;
    const methane = Math.max(cod - sludgeCod, 0) * bo * mcf;
    const methodResult = methane * gwp / 1000;
    return <DetailBlock title="核算依据"><div className={styles.sourceCard}><span>核算因子</span><b>工业废水综合核算</b><span>标准与来源</span><span>{standard} {source}</span></div><div className={styles.wastewaterMethodBox}>
      <div className={styles.wastewaterMethodHeader}><b>核查口径：COD去除量法 + Bo/MCF</b><span>按厌氧处理系统去除的 COD 量扣除污泥清除 COD，再计算 CH₄ 排放并折算 CO₂e。</span></div>
      <div className={styles.wastewaterMethodGrid}>
        <div><span>厌氧系统去除 COD</span><b>{format(cod, 2)} kg COD</b></div>
        <div><span>污泥清除 COD</span><b>{format(sludgeCod, 2)} kg COD</b></div>
        <div><span>Bo × MCF</span><b>{bo} × {mcf} = {(bo * mcf).toFixed(4)} kg CH₄/kg COD</b></div>
        <div><span>CH₄ GWP</span><b>{gwp}</b></div>
      </div>
      <div className={styles.formulaBox}><span>计算关系</span><br />CH₄ =（COD总量 − 污泥清除COD量）× Bo × MCF = {format(methane, 2)} kg CH₄<br />CO₂e = CH₄ × GWP ÷ 1,000 = {format(methodResult)} tCO₂e</div>
    </div></DetailBlock>;
  }
  const parameters = displayParameters(factor);
  const showParameters = isCompositeCalculationFactor(factor) || factor.factorId === 'pf-r134a';
  return <DetailBlock title="核算依据"><div className={styles.sourceCard}><span>核算因子</span><b>{factor.factorObject ?? factor.name}</b><span>核算结果值</span><span>{row ? calculationFactorDisplay(row, factor.factorId) : factor.value} · {factor.unit}</span><span>标准与来源</span><span>{standard} {source}</span></div>{factor.formula && <div className={styles.formulaBox}><span>计算关系</span><br />{factor.formula}</div>}{showParameters && <><h4 className={styles.calculationBasisHeading}>核算参数</h4><div className={styles.factorBreakdown}><div className={styles.breakdownHeader}><span>参数</span><span>数值</span><span>单位</span></div>{parameters.map((parameter) => <div className={styles.breakdownRow} key={parameter.key}><div><b>{parameter.name}</b></div><b>{parameter.display}</b><span>{parameter.unit}</span></div>)}</div></>}</DetailBlock>;
}

function CarbonReportPage({
  tasks,
  notify,
}: {
  tasks: CarbonAccountingTask[];
  notify: (message: string) => void;
}) {
  const [reports, setReports] = useState<CarbonReportRecord[]>(() => listCarbonReportMocks());
  const [year, setYear] = useState(2026);
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState(() => listCarbonReportMocks()[0]?.carbonReportId ?? '');
  const [selectedTaskId, setSelectedTaskId] = useState('ct-2026');
  const [selectedVersion, setSelectedVersion] = useState(1);
  const [reportInfoOpen, setReportInfoOpen] = useState(false);
  const [reportInfo, setReportInfo] = useState<CarbonReportBasicInfo>(() => ({
    organizationName: listCarbonReportMocks()[0]?.organizationName ?? 'XX科技有限公司',
    unifiedSocialCreditCode: '9132XXXXXXXXXXXXXX',
    registeredAddress: '',
    industryCategory: '',
    businessScope: '',
    legalRepresentative: '',
    preparerPhone: '',
    preparer: '',
    preparerDepartment: '',
    reviewer: '',
    boundaryDescription: '',
  }));
  const snapshots = listCarbonSnapshots();
  const visibleReports = reports.filter((report) =>
    report.year === year && report.reportName.includes(keyword.trim()));
  const selectedReport = reports.find((report) => report.carbonReportId === selectedId)
    ?? visibleReports[0]
    ?? reports[0];
  const reportDateParts = selectedReport?.generatedAt.slice(0, 10).split('-') ?? [];
  const reportDate = reportDateParts.length === 3
    ? `${reportDateParts[0]} 年 ${reportDateParts[1]} 月 ${reportDateParts[2]} 日`
    : selectedReport?.generatedAt.slice(0, 10) ?? '—';
  const selectedSnapshot = snapshots.find((snapshot) =>
    snapshot.carbonSnapshotId === selectedReport?.carbonSnapshotId)
    ?? snapshots.find((snapshot) =>
      snapshot.year === selectedReport?.year && snapshot.version === selectedReport?.version);
  const reportInventory = selectedSnapshot?.sourceItems ?? [];
  const totalEmission = selectedSnapshot?.totalEmission ?? 0;
  const defaultReportInfo = (report?: CarbonReportRecord): CarbonReportBasicInfo => ({
    organizationName: report?.organizationName ?? 'XX科技有限公司',
    unifiedSocialCreditCode: '9132XXXXXXXXXXXXXX',
    registeredAddress: '',
    industryCategory: '',
    businessScope: '',
    legalRepresentative: '',
    preparerPhone: '',
    preparer: '',
    preparerDepartment: '',
    reviewer: '',
    boundaryDescription: '',
  });
  const selectedBasicInfo = selectedReport?.basicInfo ?? reportInfo;
  const categoryRows = [...new Set(reportInventory.map((row) => row.emissionCategory))].map((category) => {
    const rows = reportInventory.filter((row) => row.emissionCategory === category);
    return {
      category,
      count: rows.length,
      amount: rows.reduce((total, row) => total + row.emissionAmount, 0),
    };
  });
  const amountFor = (keyword: string) => categoryRows.find((row) => row.category.includes(keyword))?.amount ?? 0;
  const inventoryRowsFor = (keyword: string, activity?: string) => reportInventory.filter((row) => row.emissionCategory.includes(keyword) && (!activity || getCarbonFactorV4(row.emissionFactorId)?.activity === activity));
  const reportGasFor = (keyword: string, fallback: string, activity?: string) => {
    const gases = [...new Set(inventoryRowsFor(keyword, activity).map((row) => getCarbonFactorV4(row.emissionFactorId)?.ghgType ?? getCarbonFactorV4(row.emissionFactorId)?.gas ?? row.greenhouseGasSpecies[0]).filter(Boolean))];
    return gases.length ? gases.join('、') : fallback;
  };
  const reportGwpFor = (keyword: string, fallback: string, activity?: string) => {
    const values = [...new Set(inventoryRowsFor(keyword, activity).flatMap((row) => {
      const factor = getCarbonFactorV4(row.emissionFactorId);
      const parameter = factor?.parameters?.find((item) => item.key === 'gwp');
      if (parameter) return [parameter.display];
      if (factor?.objectType === 'GWP值') {
        const value = Number(factor.value);
        return Number.isFinite(value) ? [String(factor.unit.includes('/kg') ? value * 1000 : value)] : [];
      }
      return factor && ['CO₂', 'CO₂e'].includes(factorGasForRow(factor)) ? ['1'] : [];
    }))];
    return values.length ? values.join('、') : fallback;
  };
  const reportSourceRows = [
    { source: '化石燃料燃烧', scope: '范围一', gas: reportGasFor('化石燃料', 'CO₂'), gwp: reportGwpFor('化石燃料', '1'), amount: amountFor('化石燃料') },
    { source: '生产过程排放', scope: '范围一', gas: reportGasFor('生产过程', 'CO₂'), gwp: reportGwpFor('生产过程', '1'), amount: amountFor('生产过程') },
    { source: '废弃物处理处置排放', scope: '范围一', gas: reportGasFor('废弃物', 'CH₄'), gwp: reportGwpFor('废弃物', '—'), amount: amountFor('废弃物') },
    { source: '逸散排放', scope: '范围一', gas: reportGasFor('逸散', '—'), gwp: reportGwpFor('逸散', '—'), amount: amountFor('逸散') },
    { source: '购入电力', scope: '范围二', gas: reportGasFor('购入的电力', 'CO₂', '购入电力'), gwp: reportGwpFor('购入的电力', '1', '购入电力'), amount: amountFor('购入的电力') },
    { source: '购入热力', scope: '范围二', gas: reportGasFor('购入的电力', 'CO₂', '购入热力'), gwp: reportGwpFor('购入的电力', '1', '购入热力'), amount: amountFor('购入的电力') },
    { source: '其他排放源', scope: '范围三', gas: '—', gwp: '—', amount: 0 },
  ];
  const selectYear = (nextYear: number) => {
    setYear(nextYear);
    const next = reports.find((report) => report.year === nextYear);
    if (next) {
      setSelectedId(next.carbonReportId);
      setReportInfo(next.basicInfo ?? defaultReportInfo(next));
    }
    const nextTaskId = next?.carbonTaskId ?? tasks.find((task) => task.year === nextYear)?.carbonTaskId ?? '';
    const nextVersions = snapshots.filter((snapshot) => snapshot.carbonTaskId === nextTaskId).sort((left, right) => right.version - left.version);
    setSelectedTaskId(nextTaskId);
    setSelectedVersion(next?.version ?? nextVersions[0]?.version ?? 0);
  };
  const confirmGenerateReport = () => {
    const snapshot = snapshots.find((item) => item.carbonTaskId === selectedTaskId && item.version === selectedVersion);
    if (!snapshot) {
      notify('所选核算任务没有对应正式版本，无法生成报告');
      return;
    }
    const task = tasks.find((item) => item.carbonTaskId === selectedTaskId);
    const generatedAt = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).replace(/\//g, '-');
    const report = createCarbonReportMock({
      carbonTaskId: selectedTaskId,
      taskName: task?.taskName ?? `核算任务 ${selectedTaskId}`,
      carbonSnapshotId: snapshot.carbonSnapshotId,
      year: snapshot.year,
      version: snapshot.version,
      generatedAt,
      basicInfo: reportInfo,
    });
    setReports((items) => [report, ...items]);
    setSelectedId(report.carbonReportId);
    setReportInfoOpen(false);
    notify('已基于所选正式核算版本生成排放报告');
  };
  const generateReport = () => setReportInfoOpen(true);
  const selectReport = (report: CarbonReportRecord) => {
    setSelectedId(report.carbonReportId);
    setReportInfo(report.basicInfo ?? defaultReportInfo(report));
  };
  const exportReport = () => {
    if (!selectedReport) return;
    downloadHtmlReport({
      filename: `${selectedReport.reportName}.html`,
      title: selectedReport.reportName,
      content: `<p>报告名称：${selectedReport.reportName}</p><p>核算年度：${selectedReport.year}年　核算主体：${selectedReport.organizationName}</p><p>核算任务：${selectedReport.taskName}　正式版本：V${selectedReport.version}　生成时间：${selectedReport.generatedAt}</p><h2>排放报告</h2><p>排放总量：${format(totalEmission)} tCO₂e</p><table><thead><tr><th>排放类别</th><th>排放源数量</th><th>排放量（tCO₂e）</th></tr></thead><tbody>${categoryRows.map((row) => `<tr><td>${row.category}</td><td>${row.count}</td><td>${format(row.amount)}</td></tr>`).join('')}</tbody></table>`,
    });
    notify('报告已下载');
  };

  return <div className={`${styles.page} ${styles.reportPage}`}>
    <section className={styles.reportWorkbench}>
      <aside className={styles.reportSidebar}>
        <label className={styles.reportYearField}><span>选择年份</span><span className={styles.reportYearInput}><input type="number" value={year} onChange={(event) => selectYear(Number(event.target.value))} /><i>▣</i></span></label>
        <Button primary onClick={generateReport}>生成报告</Button>
        <div className={styles.reportSearch}>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="请输入报告名称"
            aria-label="搜索报告"
          />
          <span>⌕</span>
        </div>
        <div className={styles.reportList}>
          {([['7天内', '今天'], ['30天内', '更早']] as const).map(([group, label]) => {
            const groupReports = visibleReports.filter((report) => report.recentGroup === group);
            if (!groupReports.length) return null;
            return <section key={group}>
              <h3><span>⌁</span>{label}</h3>
              {groupReports.map((report) =>
                <button
                  type="button"
                  key={report.carbonReportId}
                  className={report.carbonReportId === selectedReport?.carbonReportId ? styles.reportListActive : ''}
                  onClick={() => selectReport(report)}
                  title={report.reportName}
                >
                  <b>{report.reportName}</b>
                </button>)}
            </section>;
          })}
          {!visibleReports.length && <div className={styles.reportListEmpty}>未找到匹配的报告</div>}
        </div>
      </aside>
      <main className={styles.reportPreviewPane}>
        <div className={styles.reportPreviewActions}>
          <Button primary compact onClick={exportReport}>⇩ 下载报告</Button>
        </div>
        {selectedReport ? <article className={styles.carbonReportPaper}>
          <header>
            <h1>企业温室气体排放报告</h1>
            <p>（{selectedReport.templateName}）</p>
            <p>依据《{selectedReport.standardName}》及《工业其他行业企业温室气体排放核算方法与报告指南（试行）》编制</p>
            <p>报告主体：{selectedBasicInfo.organizationName}</p>
            <p>报告年度：{selectedReport.year} 年</p>
            <p>编制日期：{reportDate}</p>
          </header>
          <h2>一、企业基本情况</h2>
          <h3>1.1 报告主体基本信息</h3>
          <table><thead><tr><th>项目</th><th>内容</th></tr></thead><tbody>
            <tr><td>报告主体名称</td><td>{selectedBasicInfo.organizationName}</td></tr>
            <tr><td>统一社会信用代码</td><td>{selectedBasicInfo.unifiedSocialCreditCode || '—'}</td></tr>
            <tr><td>注册地址</td><td>{selectedBasicInfo.registeredAddress || '—'}</td></tr>
            <tr><td>公司法人</td><td>{selectedBasicInfo.legalRepresentative || '—'}</td></tr>
            <tr><td>行业类别（国民经济行业分类（GB/T 4754-2017））</td><td>{selectedBasicInfo.industryCategory || '—'}</td></tr>
            <tr><td>组织经营范围</td><td>{selectedBasicInfo.businessScope || '—'}</td></tr>
            <tr><td>报告编制人</td><td>{selectedBasicInfo.preparer || '—'}</td></tr>
            <tr><td>部门</td><td>{selectedBasicInfo.preparerDepartment || '—'}</td></tr>
            <tr><td>联系电话</td><td>{selectedBasicInfo.preparerPhone || '—'}</td></tr>
            <tr><td>报告审核人</td><td>{selectedBasicInfo.reviewer || '—'}</td></tr>
            <tr><td>组织边界说明</td><td>{selectedBasicInfo.boundaryDescription || '—'}</td></tr>
            <tr><td>报告年度</td><td>{selectedReport.year}</td></tr>
            <tr><td>核算标准</td><td>{selectedReport.standardName}</td></tr>
            <tr><td>核算任务</td><td>{selectedReport.taskName}</td></tr>
            <tr><td>正式版本</td><td>V{selectedReport.version}</td></tr>
          </tbody></table>
          <h3>1.2 核算边界说明</h3>
          <p>{selectedBasicInfo.boundaryDescription || '—'}</p>
          <p>排放源、活动数据和排放因子均读取已确认的正式核算清单，报告生成后不随编辑副本实时变化。报告期内组织边界未发生变化。</p>

          <h2>二、核算依据与规范性引用文件</h2>
          <p>本报告依据以下文件编制：</p>
          <ol><li>{selectedReport.standardName}《工业企业温室气体排放核算和报告通则》；</li><li>《工业其他行业企业温室气体排放核算方法与报告指南（试行）》；</li><li>《碳排放权交易管理办法（试行）》及相关行业标准；</li><li>与燃料热值、天然气计量和碳含量测定相关的国家标准。</li></ol>

          <h2>三、温室气体排放源识别</h2>
          <p>根据企业实际从事的产业活动和设施类型，识别本次核算范围内的排放源和温室气体种类。本报告核算的温室气体包括二氧化碳（CO₂）、甲烷（CH₄）及其他适用温室气体。</p>
          <h3>3.1 排放源识别结果</h3>
          <p>本企业报告边界内的排放源清单如下：</p>
          <table className={styles.reportWideTable}><thead><tr><th>排放源类别</th><th>所属范围</th><th>是否核算</th><th>排放量（t）</th><th>备注</th></tr></thead><tbody>
            {reportSourceRows.map((row) => <tr key={row.source}><td>{row.source}</td><td>{row.scope}</td><td>☑ 是　□ 不涉及</td><td>{format(row.amount)}</td><td>{row.amount ? '纳入正式核算清单' : '本企业不涉及此排放源'}</td></tr>)}
          </tbody></table>

          <h2>四、温室气体排放量核算</h2>
          <h3>4.1 范围一：直接排放核算</h3>
          <p>化石燃料燃烧、生产过程、废弃物处理及逸散排放按照正式核算清单中的活动数据与排放因子计算。</p>
          <p className={styles.reportFormula}>排放量 = 活动数据 × 排放因子 × GWP</p>
          {reportInventory.filter((row) => row.emissionCategory !== '购入的电力与热力产生的排放').map((row) => <p key={row.emissionSourceId}>本企业{row.sourceName}排放量：{format(row.emissionAmount)} tCO₂e。</p>)}
          <h3>4.2 范围二：间接排放核算</h3>
          <p>范围二包括企业净购入的电力和热力隐含的 CO₂ 排放。</p>
          <p className={styles.reportFormula}>购入电力排放量 = 净购入电量 × 电力排放因子</p>
          <p>本企业范围二排放量：{format(amountFor('购入的电力'))} tCO₂e。</p>
          <h3>4.3 排放总量汇总</h3>
          <p>本企业报告年度温室气体排放总量汇总如下：</p>
          <table><thead><tr><th>排放源</th><th>范围</th><th>气体</th><th>GWP</th><th>排放量（吨）</th><th>折算 CO₂e（吨）</th></tr></thead><tbody>
            {reportSourceRows.map((row) => <tr key={`${row.source}-summary`}><td>{row.source}</td><td>{row.scope}</td><td>{row.gas}</td><td>{row.gwp}</td><td>{row.amount ? format(row.amount) : '—'}</td><td>{row.amount ? format(row.amount) : '—'}</td></tr>)}
            <tr className={styles.reportTotalRow}><td>范围一+范围二合计</td><td>—</td><td>—</td><td>—</td><td>—</td><td>{format(totalEmission)}</td></tr>
          </tbody></table>
          <p className={styles.reportFormula}>排放总量 = 范围一排放 + 范围二排放 + 范围三排放（如适用）</p>

          <h2>五、活动水平数据及来源说明</h2>
          <p>本企业各排放源活动水平数据及来源说明如下：</p>
          <ol>{reportInventory.map((row) => <li key={`${row.emissionSourceId}-activity`}><strong>{row.sourceName}：</strong>{row.activityData}；数据来源：{row.activityDataSource}。</li>)}</ol>

          <h2>六、排放因子数据及来源说明</h2>
          <ol>{reportInventory.map((row) => <li key={`${row.emissionSourceId}-factor`}><strong>{factorNameForRow(row)}：</strong>{factorSummary(row, row.emissionFactorId)}；来源：{row.sourceModule || '碳排放因子库'}。</li>)}</ol>

          <h2>七、声明与签字盖章</h2>
          <p>本单位郑重承诺：本报告所填写的全部数据和信息真实、完整、准确，核算方法符合国家相关标准和指南要求。如报告中的信息与实际情况不符，本企业将承担相应的法律责任。</p>
          <p className={styles.reportSignature}>法人（签字）：____________________</p>
          <p className={styles.reportSignature}>日期：________ 年 ____ 月 ____ 日</p>
          <p className={styles.reportSignature}>单位盖章：</p>

          <h2>附表</h2>
          <h3>附表1 报告主体 {selectedReport.year} 年温室气体排放汇总表</h3>
          <table><thead><tr><th>源类别</th><th>排放量（单位：吨）</th><th>温室气体排放量（单位：吨 CO₂e）</th></tr></thead><tbody>
            {reportSourceRows.map((row) => <tr key={`${row.source}-appendix`}><td>{row.source}</td><td>{row.amount ? format(row.amount) : '—'}</td><td>{row.amount ? format(row.amount) : '—'}</td></tr>)}
            <tr className={styles.reportTotalRow}><td>企业温室气体排放总量</td><td>—</td><td>{format(totalEmission)}</td></tr>
          </tbody></table>
          <h3>附表2 排放源活动水平和排放因子数据一览表</h3>
          <table><thead><tr><th>排放源</th><th>活动数据</th><th>单位</th><th>排放因子</th><th>来源</th></tr></thead><tbody>
            {reportInventory.map((row) => <tr key={`${row.emissionSourceId}-appendix-factor`}><td>{row.sourceName}</td><td>{row.activityValue}</td><td>{row.activityUnit}</td><td>{factorSummary(row, row.emissionFactorId)}</td><td>{row.sourceModule || '碳排放因子库'}</td></tr>)}
          </tbody></table>
          <p className={styles.reportDocumentFoot}>数据来源：{selectedReport.taskName} · 正式版本 V{selectedReport.version}　报告生成时间：{selectedReport.generatedAt}</p>
        </article> : <div className={styles.reportDocumentEmpty}>请选择或生成报告</div>}
      </main>
    </section>
    {reportInfoOpen && <ReportInfoDialog info={reportInfo} setInfo={setReportInfo} close={() => setReportInfoOpen(false)} confirm={confirmGenerateReport} />}
  </div>;
}

export function CarbonAccountingV4({ pathname }: { pathname: string }) {
  const page = pathname.split('/').pop();
  const inventoryPage = page === 'inventory';
  const [tasks, setTasks] = useState(() => listCarbonAccountingTasks());
  const [currentTaskId, setCurrentTaskId] = useState('ct-2026');
  const currentTask = tasks.find((item) => item.carbonTaskId === currentTaskId) ?? tasks[0];
  const [inventory, setInventory] = useState(() => {
    if (!inventoryPage) return listEmissionSources();
    // 清单页以正式快照为基准；上游能源变化和手工修改写入同年度编辑副本。
    return currentTask ? latestCarbonSnapshotForTask(currentTask.carbonTaskId)?.sourceItems ?? listEmissionSources().filter((row) => row.carbonTaskId === currentTask.carbonTaskId) : [];
  });
  const [taskState, setTaskState] = useState<TaskState>('confirmed');
  const [version, setVersion] = useState(() => currentTask ? latestCarbonSnapshotForTask(currentTask.carbonTaskId)?.version ?? 0 : 0);
  const [formalSnapshot, setFormalSnapshot] = useState(() => currentTask ? latestCarbonSnapshotForTask(currentTask.carbonTaskId) : undefined);
  const [baseline, setBaseline] = useState<EmissionSource[] | null>(null);
  const [history, setHistory] = useState<{ version: number; time: string; total: number; count: number }[]>(() => inventoryPage ? [] : [{
    version: 1,
    time: '2026-06-30 18:00:00',
    total: inventory.reduce((sum, row) => sum + row.emissionAmount, 0),
    count: inventory.length,
  }]);
  const [keyword, setKeyword] = useState('');
  const [boundary, setBoundary] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [collapsedScopes, setCollapsedScopes] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [toast, setToast] = useState('');
  const [invalidSourceIds, setInvalidSourceIds] = useState<Set<string>>(new Set());
  const [validationMessages, setValidationMessages] = useState<Record<string, string[]>>({});
  const [supportOverrides, setSupportOverrides] = useState<Record<string, EmissionSource>>({});
  const [basicSupportOverrides, setBasicSupportOverrides] = useState<Record<string, Pick<SupportItem, 'evidenceFiles' | 'supportRemark' | 'materials'>>>({});
  const [factors, setFactors] = useState<CarbonFactor[]>(() => listCarbonFactorsV4().map((factor) => ({ ...factor, parameters: factor.parameters?.map((parameter) => ({ ...parameter })) })));
  const [libraryFactors] = useState<CarbonFactor[]>(() => listCarbonFactorLibraryV4().map((factor) => ({ ...factor, parameters: factor.parameters?.map((parameter) => ({ ...parameter })) })));
  const [tenantFactors, setTenantFactors] = useState<TenantCustomCarbonFactor[]>(() => listTenantCustomCarbonFactorsV4());
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200); };
  const saveTenantFactorForAccounting = (factor: TenantCustomCarbonFactor) => {
    saveTenantCustomCarbonFactorV4(factor);
    setTenantFactors((items) => [factor, ...items.filter((item) => item.id !== factor.id)]);
    const accountingFactor = tenantCustomFactorToCarbonFactor(factor);
    saveCarbonFactorV4(accountingFactor);
    setFactors((items) => [accountingFactor, ...items.filter((item) => item.factorId !== accountingFactor.factorId)]);
    notify('企业专属因子已保存并应用');
    return accountingFactor;
  };
  useEffect(() => {
    const task = getCarbonAccountingTask(currentTaskId);
    const snapshot = task ? latestCarbonSnapshotForTask(task.carbonTaskId) : undefined;
    if (inventoryPage) {
      const storedInventory = listEmissionSources().filter((row) => row.carbonTaskId === currentTaskId);
      if (task && task.status !== 'confirmed') {
        const merged = mergeEnergySources(storedInventory.length ? storedInventory : snapshot?.sourceItems ?? [], buildEnergyDraftSources(task.year), task);
        replaceEmissionSourcesForTask(task.carbonTaskId, merged);
        setInventory(merged);
        setBaseline(snapshot?.sourceItems.map((source) => ({ ...source })) ?? []);
      } else {
        const formalRows = snapshot?.sourceItems ?? storedInventory;
        if (task) {
          const storedDraft = storedInventory.length && !sameInventories(storedInventory, formalRows) ? storedInventory : formalRows;
          const merged = mergeEnergySources(storedDraft, buildEnergyDraftSources(task.year), task);
          if (!sameInventories(merged, formalRows)) {
            replaceEmissionSourcesForTask(task.carbonTaskId, merged);
            setInventory(merged);
          } else {
            setInventory(formalRows);
          }
          setBaseline(formalRows.map((source) => ({ ...source })));
        } else {
          setInventory(formalRows);
          setBaseline(null);
        }
      }
      setFormalSnapshot(snapshot);
      setTaskState(task?.status ?? 'draft');
      setVersion(snapshot?.version ?? 0);
      return;
    }
    setFormalSnapshot(snapshot);
    setTaskState('confirmed');
    setVersion(snapshot?.version ?? 0);
    setHistory(snapshot ? [{
      version: snapshot.version,
      time: '2026-06-30 18:00:00',
      total: snapshot.totalEmission,
      count: snapshot.sourceItems.length,
    }] : []);
  }, [inventoryPage, currentTaskId]);
  // 预览、报告和核查支撑只读取正式快照；inventory 仅用于清单编辑页。
  const officialInventory = inventoryPage && taskState !== 'confirmed' ? inventory : formalSnapshot?.sourceItems ?? inventory;
  // 支撑页必须始终绑定当前正式清单；快照为空时回退到任务清单，避免只渲染空状态而丢失排放源材料。
  const supportSourceInventory = officialInventory.length ? officialInventory : inventory;
  const supportInventory = supportSourceInventory.map((row) => supportOverrides[row.emissionSourceId] ?? row);
  const refresh = () => setInventory(listEmissionSources().filter((row) => row.carbonTaskId === currentTaskId));
  const changeTask = (taskId: string) => {
    setCurrentTaskId(taskId);
    setKeyword('');
    setBoundary('');
    setBaseline(null);
  };
  const updateCurrentTask = (patch: Partial<CarbonAccountingTask>) => {
    if (!currentTask) return;
    const next = { ...currentTask, ...patch };
    saveCarbonAccountingTask(next);
    setTasks((items) => items.map((item) => item.carbonTaskId === next.carbonTaskId ? next : item));
  };
  const toggleGroup = (group: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(group)) next.delete(group); else next.add(group);
    return next;
  });
  const toggleScope = (scope: string) => setCollapsedScopes((current) => {
    const next = new Set(current);
    if (next.has(scope)) next.delete(scope); else next.add(scope);
    return next;
  });
  const openSource = (row: EmissionSource, mode: SourceMode) => setDrawer({ kind: 'source', row, mode });
  const saveSource = (input: Omit<EmissionSource, 'emissionSourceId'>, id?: string) => {
    if (taskState === 'confirmed' && !baseline) setBaseline((formalSnapshot?.sourceItems ?? inventory).map((source) => ({ ...source })));
    const result = saveEmissionSource({ ...input, carbonTaskId: currentTaskId, organizationBoundary: currentTask?.organizationBoundary ?? input.organizationBoundary, sourceRecordId: input.sourceRecordId.replace(/20\d{2}/, String(currentTask?.year ?? 2026)) }, id);
    if (!result.ok) { notify(result.error); return false; }
    refresh();
    setDrawer(null);
    notify(id ? '排放源已保存并重新计算' : '排放源已新增');
    return true;
  };
  const completeUpdate = () => {
    const snapshot = publishCarbonSnapshot(currentTaskId, currentTask?.year ?? 2026);
    setFormalSnapshot(snapshot);
    const displayVersion = version + 1;
    setVersion(displayVersion);
    setTaskState('confirmed');
    updateCurrentTask({ status: 'confirmed', currentSnapshotId: snapshot.carbonSnapshotId });
    setBaseline(null);
    setInvalidSourceIds(new Set());
    setValidationMessages({});
    setHistory((items) => [{ version: displayVersion, time: new Date().toLocaleString('zh-CN', { hour12: false }), total: snapshot.totalEmission, count: snapshot.sourceItems.length }, ...items]);
    setDialog(null);
    notify(`正式核算清单已更新为 V${displayVersion}`);
  };
  const cancelUpdate = () => {
    const restored = replaceEmissionSourcesForTask(currentTaskId, baseline ?? inventory);
    setInventory(restored.filter((source) => source.carbonTaskId === currentTaskId));
    setBaseline(null);
    setTaskState('confirmed');
    updateCurrentTask({ status: 'confirmed' });
    setInvalidSourceIds(new Set());
    setValidationMessages({});
    setDialog(null);
    notify('已恢复正式清单');
  };
  const undoChange = (sourceId: string) => {
    const formalRows = baseline ?? formalSnapshot?.sourceItems ?? [];
    const formalRow = formalRows.find((source) => source.emissionSourceId === sourceId);
    const next = formalRow
      ? [...inventory.filter((source) => source.emissionSourceId !== sourceId), { ...formalRow }]
      : inventory.filter((source) => source.emissionSourceId !== sourceId);
    const stored = replaceEmissionSourcesForTask(currentTaskId, next);
    setInventory(stored.filter((source) => source.carbonTaskId === currentTaskId));
    notify('已撤销该项修改');
  };
  const exportInventory = () => {
    const header = ['核算边界', '温室气体源类型', '排放源', '活动数据', '因子/参数', '排放量（tCO₂e）'];
    const csv = '\ufeff' + [header, ...officialInventory.map((row) => [row.emissionGroup, row.sourceType, row.sourceName, row.activityData, factorNameForRow(row), format(row.emissionAmount)])].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${currentTask?.organizationName ?? '当前组织'}_${currentTask?.year ?? 2026}年度碳核算清单.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify('正式核算清单已导出');
  };
  const requestUpdateConfirmation = () => {
    const issues = validateInventory(inventory);
    setInvalidSourceIds(new Set(issues.map((issue) => issue.emissionSourceId)));
    setValidationMessages(Object.fromEntries(issues.reduce((groups, issue) => {
      const current = groups.get(issue.emissionSourceId) ?? [];
      groups.set(issue.emissionSourceId, [...current, issue.message]);
      return groups;
    }, new Map<string, string[]>())));
    if (issues.length) { notify(`当前有${new Set(issues.map((issue) => issue.emissionSourceId)).size}项数据未通过校验，请完善后再确认正式清单。`); return; }
    setDialog({ kind: 'completeUpdate' });
  };

  let content: ReactNode;
  if (page === 'preview') content = <Preview task={currentTask} tasks={tasks} onTaskChange={changeTask} inventory={officialInventory} state={taskState} version={version} confirmedAt={history[0]?.time} />;
  else if (page === 'inventory') content = <Inventory key={currentTask?.carbonTaskId} task={currentTask} tasks={tasks} onTaskChange={changeTask} inventory={inventory} formalInventory={formalSnapshot?.sourceItems ?? []} taskState={taskState} keyword={keyword} boundary={boundary} collapsed={collapsed} collapsedScopes={collapsedScopes} setKeyword={setKeyword} setBoundary={setBoundary} toggleGroup={toggleGroup} toggleScope={toggleScope} openSource={openSource} openDialog={setDialog} confirmUpdate={requestUpdateConfirmation} cancelUpdate={cancelUpdate} openChanges={() => setDrawer({ kind: 'changes', baseline: baseline ?? formalSnapshot?.sourceItems ?? [], draft: inventory, version })} undoChange={undoChange} exportInventory={exportInventory} invalidSourceIds={invalidSourceIds} validationMessages={validationMessages} />;
  else if (page === 'support') content = <SupportPage task={currentTask} tasks={tasks} onTaskChange={changeTask} inventory={supportInventory} basicItems={supportBasicV4.map((item) => ({ ...item, id: item.item, activityDataSources: item.origin, state: item.state === '已上传' ? '已完成' : '待补充' }))} basicOverrides={basicSupportOverrides} openDrawer={setDrawer} openDialog={setDialog} />;
  else if (page === 'factors') content = <FactorPage factors={libraryFactors} tenantFactors={tenantFactors} setTenantFactors={setTenantFactors} />;
  else content = <CarbonReportPage
    tasks={tasks}
    notify={notify}
  />;

  return <>{content}{toast && <div className={styles.toast}>{toast}</div>}
    {dialog?.kind === 'settings' && <SettingsDialog close={() => setDialog(null)} save={() => { setDialog(null); notify('核算设置已保存'); }} />}
    {dialog?.kind === 'draftPreview' && <DraftPreviewDialog
      year={dialog.year}
      sources={dialog.sources}
      close={() => setDialog(null)}
      confirm={() => {
        const next = replaceEmissionSourcesForTask(currentTaskId, dialog.sources);
        setInventory(next.filter((row) => row.carbonTaskId === currentTaskId));
        setTaskState('draft');
        setVersion(0);
        setFormalSnapshot(undefined);
        setBaseline(null);
        setHistory([]);
        setDialog(null);
        notify(`已生成${dialog.year}年度草稿清单，当前清单已保留为草稿状态`);
      }}
    />}
    {dialog?.kind === 'newSource' && <NewSourceDialog groups={emissionCategoryDictionary} factors={factors} close={() => setDialog(null)} save={(input) => { if (saveSource(input)) setDialog(null); }} onCreateTenantFactor={saveTenantFactorForAccounting} />}
    {dialog?.kind === 'deleteSource' && <Dialog title="删除排放源记录" onClose={() => setDialog(null)} footer={<><Button onClick={() => setDialog(null)}>取消</Button><Button danger onClick={() => { const result = deleteEmissionSource(dialog.row.emissionSourceId); if (!result.ok) { notify(result.error); return; } refresh(); setDialog(null); notify('排放源及其核算记录已删除'); }}>确认删除</Button></>}><div className={styles.confirmBox}>删除后，将从当前核算清单中移除该排放源及其在碳核算模块中的活动数据和核算记录；不会删除能源、运营等上游模块的原始数据。</div><p><b>{dialog.row.sourceName}</b></p></Dialog>}
    {dialog?.kind === 'deleteSupport' && <Dialog title="删除证明材料" onClose={() => setDialog(null)} footer={<><Button onClick={() => setDialog(null)}>取消</Button><Button danger onClick={() => { const item = dialog.item; if (item.emission) setSupportOverrides((items) => ({ ...items, [item.emission!.emissionSourceId]: { ...item.emission!, evidenceFiles: [], evidenceStatus: item.emission!.confirmedActivityDataSources.length ? '待补充' : '待确认' } })); else setBasicSupportOverrides((items) => ({ ...items, [item.item]: { evidenceFiles: [], supportRemark: item.supportRemark, materials: 0 } })); setDialog(null); notify('证明材料已删除'); }}>确认删除</Button></>}><div className={styles.confirmBox}>确认删除“{dialog.item.item}”的全部证明材料吗？删除后材料将从该条目中移除。</div></Dialog>}
    {dialog?.kind === 'viewSupport' && <SupportViewDialog item={dialog.item} close={() => setDialog(null)} openDialog={setDialog} />}
    {dialog?.kind === 'factorDetail' && <FactorDetailDialog factor={dialog.factor} mode={dialog.mode ?? 'view'} close={() => setDialog(null)} onParametersChange={(parameters) => { const nextFactor = { ...dialog.factor, parameters }; saveCarbonFactorV4(nextFactor); setFactors((items) => items.map((item) => item.factorId === nextFactor.factorId ? nextFactor : item)); }} save={(factor) => { saveCarbonFactorV4(factor); setFactors((items) => items.map((item) => item.factorId === factor.factorId ? factor : item)); setDialog(null); notify('企业实测参数已保存为当前企业参数'); }} />}
    {dialog?.kind === 'deleteSupportFile' && <Dialog title="删除证明材料" onClose={() => setDialog(null)} footer={<><Button onClick={() => setDialog(null)}>取消</Button><Button danger onClick={() => { const item = dialog.item; const files = (item.evidenceFiles ?? []).filter((file) => file.evidenceFileId !== dialog.file.evidenceFileId); if (item.emission) setSupportOverrides((items) => ({ ...items, [item.emission!.emissionSourceId]: { ...item.emission!, evidenceFiles: files, evidenceStatus: files.length ? '已完成' : '待补充' } })); else setBasicSupportOverrides((items) => ({ ...items, [item.item]: { evidenceFiles: files, supportRemark: item.supportRemark, materials: files.length } })); setDialog(null); notify('证明材料已删除'); }}>确认删除</Button></>}><div className={styles.confirmBox}>确认删除文件“{dialog.file.fileName}”吗？</div></Dialog>}
    {dialog?.kind === 'completeUpdate' && <ConfirmSnapshot title="确认更新正式核算清单" previousVersion={version} version={version + 1} baseline={baseline ?? []} inventory={inventory} close={() => setDialog(null)} confirm={completeUpdate} />}
    {dialog?.kind === 'cancelUpdate' && <Dialog title="取消本次修改" onClose={() => setDialog(null)} footer={<><Button onClick={() => setDialog(null)}>继续编辑</Button><Button danger onClick={cancelUpdate}>确认取消</Button></>}><div className={styles.confirmBox}>取消后将恢复当前正式清单，本次编辑副本中的修改不会保留。</div></Dialog>}
    {dialog?.kind === 'factorSelect' && <FactorSelectDialog row={dialog.row} factors={factors} close={() => setDialog(null)} choose={(factorId) => { setDialog(null); setDrawer({ kind: 'source', row: dialog.row, mode: 'edit', factorId }); notify('已切换计算因子/参数组'); }} onCreateTenantFactor={(tenantFactor) => { const factor = saveTenantFactorForAccounting(tenantFactor); setDialog(null); setDrawer({ kind: 'source', row: dialog.row, mode: 'edit', factorId: factor.factorId }); }} />}
    {dialog?.kind === 'enterpriseFactor' && <FactorLibraryAddModal onClose={() => setDialog(null)} onSubmit={(factor) => { saveTenantFactorForAccounting(factor); setDialog(null); }} />}
    {dialog?.kind === 'importFactor' && <Dialog title="导入企业因子/参数" onClose={() => setDialog(null)} footer={<><Button onClick={() => setDialog(null)}>取消</Button><Button primary onClick={() => { setDialog(null); notify('企业因子导入校验已启动（演示）'); }}>开始导入</Button></>}><div className={styles.infoBox}>仅导入当前企业的实测因子、核算参数或参数组。公共因子由平台管理员通过受控流程统一导入、校验和发布。</div><div className={styles.importBox}><b>导入文件 *</b><Button outline>选择Excel文件</Button><small>导入后将执行字段、单位、重复项、适用年度和依据材料校验。</small></div></Dialog>}
    {drawer?.kind === 'source' && <SourceDrawer state={drawer} allowEdit={!isEnergyLinkedSource(drawer.row) && drawer.row.recordGenerationType === 'manual'} close={() => setDrawer(null)} save={(input, id) => { if (drawer.mode !== 'view') saveSource(input, id); }} edit={() => setDrawer({ ...drawer, mode: 'edit' })} chooseFactor={(row) => setDialog({ kind: 'factorSelect', row })} />}
    {drawer?.kind === 'support' && <SupportDrawer state={drawer} close={() => setDrawer(null)} manage={() => setDrawer({ ...drawer, manage: true, upload: true })} save={(item) => { if (item.emission) setSupportOverrides((items) => ({ ...items, [item.emission!.emissionSourceId]: item.emission! })); else setBasicSupportOverrides((items) => ({ ...items, [item.item]: { evidenceFiles: item.evidenceFiles ?? [], supportRemark: item.supportRemark, materials: item.evidenceFiles?.length ?? 0 } })); setDrawer(null); notify('支撑信息已保存'); }} />}
    {drawer?.kind === 'history' && <HistoryDrawer history={history} close={() => setDrawer(null)} />}
    {drawer?.kind === 'changes' && <ChangeDrawer baseline={drawer.baseline} draft={drawer.draft} version={drawer.version} close={() => setDrawer(null)} />}
  </>;
}

function SettingsDialog({ close, save }: { close: () => void; save: () => void }) {
  return <Dialog title="核算设置" onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={save}>保存设置</Button></>}><div className={styles.orgBox}><span><b>核算组织：XX科技有限公司</b><small>组织信息来自企业档案与当前年度配置，不可在此直接修改。</small></span><Tag>只读</Tag></div><div className={styles.formGrid}><Field label="核算年度"><input value="2026年" readOnly /></Field><Field label="行业核算方法"><select><option>通用工业企业</option><option>其他适用行业方法</option></select></Field><Field label="核算范围" full><select><option>全部组织与设施</option><option>指定组织或设施</option></select></Field><Field label="核算用途" full><select><option>企业年度盘查</option><option>第三方核查</option><option>对外披露</option></select></Field><Field label="边界说明" full><textarea placeholder="如存在特殊边界情况，请填写说明" /></Field></div></Dialog>;
}

function DraftPreviewDialog({ year, sources, close, confirm }: { year: number; sources: EmissionSource[]; close: () => void; confirm: () => void }) {
  const groupedSources = [...new Set(sources.map((source) => source.emissionCategory))].map((category) => ({
    category,
    rows: sources.filter((source) => source.emissionCategory === category),
  }));
  return <Dialog title={`${year}年度草稿清单生成预览`} onClose={close} wide footer={<><Button onClick={close}>返回修改核算设置</Button><Button primary onClick={confirm} disabled={!sources.length}>确认生成草稿清单</Button></>}>
    <div className={styles.infoBox}>以下为系统即将生成的草稿清单，共 {sources.length} 项排放源。产品产量、产值等运营指标不会生成排放源。</div>
    <div className={styles.previewInventoryShell}>
      {groupedSources.map(({ category, rows }) => {
        const subtotal = rows.reduce((sum, row) => sum + row.emissionAmount, 0);
        return <div className={styles.groupCard} key={category}>
          <div className={styles.groupHead}><span className={styles.groupToggle} aria-hidden="true">⌄</span><b className={styles.groupTitle}>{category}</b><span className={styles.groupSummary}><small>小计</small><strong>{format(subtotal)} tCO₂e</strong></span></div>
          <div className={styles.groupTableWrap}><table className={styles.groupTable}>
            <colgroup><col style={{ width: '18%' }} /><col style={{ width: '28%' }} /><col style={{ width: '24%' }} /><col style={{ width: '16%' }} /><col style={{ width: '14%' }} /></colgroup>
            <thead><tr><th>温室气体源类型</th><th>排放源</th><th>活动数据</th><th>碳排放因子</th><th>排放量（tCO₂e）</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.emissionSourceId}>
              <td>{row.sourceType}</td><td><b>{row.sourceName}</b></td><td><b>{row.activityData}</b></td><td><b>{factorSummary(row)}</b></td><td><b>{format(row.emissionAmount)}</b></td>
            </tr>)}</tbody>
          </table></div>
        </div>;
      })}
      {!sources.length && <div className={styles.emptyRow}>该年度暂无可关联的能源消费记录，未生成草稿清单。</div>}
    </div>
  </Dialog>;
}

function NewSourceDialog({ groups, factors, close, save, onCreateTenantFactor }: { groups: string[]; factors: CarbonFactor[]; close: () => void; save: (input: Omit<EmissionSource, 'emissionSourceId'>) => void; onCreateTenantFactor: (factor: TenantCustomCarbonFactor) => CarbonFactor }) {
  const availableScopes = emissionScopeDictionary.map((scope) => ({
    ...scope,
    categories: scope.categories.filter((category) => groups.includes(category)),
  })).filter((scope) => scope.categories.length > 0);
  const [scopeId, setScopeId] = useState<string>(availableScopes[0]?.id ?? emissionScopeDictionary[0].id);
  const selectedScope = availableScopes.find((scope) => scope.id === scopeId) ?? availableScopes[0];
  const availableCategories = selectedScope?.categories ?? [];
  const [group, setGroup] = useState<string>(availableCategories[0] ?? emissionCategoryDictionary[0]);
  const mappedTypes = emissionSourceMapping[group] ?? [];
  const [sourceType, setSourceType] = useState(mappedTypes[0]?.sourceType ?? '');
  const [sourceName, setSourceName] = useState('');
  const [customSourceName, setCustomSourceName] = useState('');
  const [activity, setActivity] = useState('');
  const [unit, setUnit] = useState('');
  const [factorId, setFactorId] = useState('');
  const [factorPickerOpen, setFactorPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const factor = factorId ? getCarbonFactorV4(factorId) : undefined;
  const selectedType = mappedTypes.find((item) => item.sourceType === sourceType);
  const sourceOptions = selectedType?.sources ?? [];
  const customSource = sourceType === '其他/自定义' || sourceOptions.length === 0 || sourceName === '__custom__';
  const changeScope = (value: string) => {
    const nextScope = availableScopes.find((scope) => scope.id === value);
    const nextGroup = nextScope?.categories[0] ?? emissionCategoryDictionary[0];
    const nextTypes = emissionSourceMapping[nextGroup] ?? [];
    setScopeId(value);
    setGroup(nextGroup);
    setSourceType(nextTypes[0]?.sourceType ?? '');
    setSourceName('');
    setCustomSourceName('');
  };
  const changeGroup = (value: string) => {
    const nextTypes = emissionSourceMapping[value] ?? [];
    setGroup(value);
    setSourceType(nextTypes[0]?.sourceType ?? '');
    setSourceName('');
    setCustomSourceName('');
  };
  const changeSourceType = (value: string) => { setSourceType(value); setSourceName(''); setCustomSourceName(''); };
  const changeSourceName = (value: string) => { setSourceName(value === '自定义' ? '__custom__' : value); if (value !== '自定义' && value !== '__custom__') setCustomSourceName(''); };
  const submit = () => {
    const finalSourceName = sourceName === '__custom__' ? customSourceName : sourceName;
    if (!sourceType || !finalSourceName.trim() || !activity.trim() || !unit.trim() || !factor) {
      setError(!factor ? '请先选择适用的核算因子后再保存' : '请补齐排放源类型、排放源名称、活动数据值和单位后再保存');
      return;
    }
    setError('');
    save({ carbonTaskId: 'ct-2026', organizationBoundary: '企业法人边界', emissionCategory: group, emissionGroup: group, sourceType: sourceType || '人工新增排放源', sourceName: finalSourceName.trim(), greenhouseGasSpecies: [factorGasForRow(factor)], activityValue: Number(activity), activityUnit: unit, activityData: `${Number(activity).toLocaleString('zh-CN')} ${unit}`, activityDataSource: '核算清单·在线录入', factorName: factor.name, emissionFactorId: factor.factorId, recordGenerationType: 'manual', sourceModule: '核算清单—在线录入', sourceRecordId: `CARBON-2026-${Date.now()}`, factorObjectId: factor.factorObject ?? factor.factorId, factorVersionId: factor.version, createdBy: '管理员', createdAt: new Date().toLocaleString('zh-CN', { hour12: false }), recommendedActivityDataSources: ['企业报告（可选）'], confirmedActivityDataSources: [], customActivityDataSources: [], evidenceFiles: [], evidenceStatus: '待确认', emissionAmount: recalculate(Number(activity), unit, factor), entryMode: 'manual' });
  };
  return <><Dialog title="新增排放源" onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={submit}>保存排放源</Button></>}><form className={styles.formGrid} onSubmit={(event: FormEvent) => { event.preventDefault(); submit(); }}>
    <Field label="排放范围 *"><select aria-label="排放范围" value={scopeId} onChange={(event) => changeScope(event.target.value)}>{availableScopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.label}</option>)}</select></Field>
    <Field label="排放类别 *"><select aria-label="排放类别" value={group} onChange={(event) => changeGroup(event.target.value)}>{availableCategories.map((value) => <option key={value}>{value}</option>)}</select></Field>
    <Field label="温室气体源类型 *"><select value={sourceType} onChange={(event) => changeSourceType(event.target.value)}>{mappedTypes.map((item) => <option key={item.sourceType}>{item.sourceType}</option>)}<option value="其他/自定义">其他/自定义</option></select></Field>
    <Field label="排放源名称 *">{customSource ? <input required value={sourceName === '__custom__' ? customSourceName : sourceName} onChange={(event) => { setCustomSourceName(event.target.value); setSourceName('__custom__'); }} placeholder="请输入具体排放源名称" /> : <select required value={sourceName} onChange={(event) => changeSourceName(event.target.value)}><option value="">请选择设施/来源</option>{sourceOptions.map((value) => <option key={value}>{value}</option>)}{!sourceOptions.includes('自定义') && <option value="__custom__">自定义排放源</option>}</select>}</Field>
    <Field label="活动数据值 *"><input required type="number" value={activity} onChange={(event) => setActivity(event.target.value)} /></Field>
    <Field label="单位 *"><input required value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="例如：kg、t、MWh" /></Field>
    <Field label="核算因子" full><div className={styles.factorSelection}><Button outline onClick={() => setFactorPickerOpen(true)}>{factor ? '更换核算因子' : '选择核算因子'}</Button>{factor ? <div className={styles.factorSelectionSummary}><b>{factor.factorObject ?? factor.name}</b><small title={factor.reference}>{calculationFactorDisplay({ emissionSourceId: 'new-source', emissionFactorId: factor.factorId, activityValue: Number(activity) || 0, activityUnit: unit } as EmissionSource, factor.factorId)} · {factor.source}</small></div> : <div className={styles.factorSelectionEmpty}>请先选择适用的核算因子</div>}</div></Field>
    {error && <div className={`${styles.infoBox} ${styles.fieldFull}`}><span>{error}</span></div>}
    <button type="submit" className={styles.hiddenSubmit}>保存</button>
  </form></Dialog>{factorPickerOpen && <FactorSelectDialog row={{ emissionSourceId: 'new-source', emissionFactorId: factorId, sourceType, activityUnit: unit, sourceName: sourceName === '__custom__' ? customSourceName : sourceName, emissionCategory: group }} factors={factors} close={() => setFactorPickerOpen(false)} choose={(nextFactorId) => { setFactorId(nextFactorId); setFactorPickerOpen(false); }} onCreateTenantFactor={(tenantFactor) => { const factor = onCreateTenantFactor(tenantFactor); setFactorId(factor.factorId); setFactorPickerOpen(false); }} />}</>;
}

function LegacyNewSourceDialog({ groups, close, save }: { groups: string[]; close: () => void; save: (input: Omit<EmissionSource, 'emissionSourceId'>) => void }) {
  const [group, setGroup] = useState(groups[0]);
  const [sourceType, setSourceType] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [activity, setActivity] = useState('');
  const [unit, setUnit] = useState('');
  const factor = getCarbonFactorV4('pf-r134a')!;
  const submit = () => {
    if (!sourceName.trim() || !unit.trim()) return;
    save({ carbonTaskId: 'ct-2026', organizationBoundary: '企业法人边界', emissionCategory: group, emissionGroup: group, sourceType: sourceType || '人工新增排放源', sourceName: sourceName.trim(), greenhouseGasSpecies: ['CO₂e'], activityValue: Number(activity), activityUnit: unit, activityData: `${Number(activity).toLocaleString('zh-CN')} ${unit}`, activityDataSource: '核算清单·在线录入', factorName: factor.name, emissionFactorId: factor.factorId, recordGenerationType: 'manual', sourceModule: '核算清单—在线录入', sourceRecordId: `CARBON-2026-${Date.now()}`, factorObjectId: factor.factorId, factorVersionId: factor.version, createdBy: '管理员', createdAt: new Date().toLocaleString('zh-CN', { hour12: false }), recommendedActivityDataSources: ['企业报告（可选）'], confirmedActivityDataSources: [], customActivityDataSources: [], evidenceFiles: [], evidenceStatus: '待确认', emissionAmount: recalculate(Number(activity), unit, factor), entryMode: 'manual' });
  };
  return <Dialog title="新增排放源" onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={submit}>保存排放源</Button></>}><form className={styles.formGrid} onSubmit={(event: FormEvent) => { event.preventDefault(); submit(); }}><Field label="排放类别 *"><select value={group} onChange={(event) => setGroup(event.target.value)}>{emissionCategoryDictionary.map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="温室气体源类型 *"><input value={sourceType} onChange={(event) => setSourceType(event.target.value)} placeholder="例如：制冷剂逸散源" /></Field><Field label="排放源名称 *" full><input required value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="请输入排放源名称" /></Field><Field label="活动数据值 *"><input required type="number" value={activity} onChange={(event) => setActivity(event.target.value)} /></Field><Field label="单位 *"><input required value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="例如：kg、t、MWh" /></Field><Field label="排放因子/参数" full><Button outline>从因子库选择</Button></Field><button type="submit" className={styles.hiddenSubmit}>保存</button></form></Dialog>;
}

function ConfirmSnapshot({ title, previousVersion, version, baseline, inventory, close, confirm }: { title: string; previousVersion: number; version: number; baseline: EmissionSource[]; inventory: EmissionSource[]; close: () => void; confirm: () => void }) {
  const baselineById = new Map(baseline.map((row) => [row.emissionSourceId, row]));
  const inventoryById = new Map(inventory.map((row) => [row.emissionSourceId, row]));
  const added = inventory.filter((row) => !baselineById.has(row.emissionSourceId)).length;
  const modified = inventory.filter((row) => { const before = baselineById.get(row.emissionSourceId); return before ? changed(before, row) : false; }).length;
  const deleted = baseline.filter((row) => !inventoryById.has(row.emissionSourceId)).length;
  const previousTotal = baseline.reduce((sum, row) => sum + row.emissionAmount, 0);
  const total = inventory.reduce((sum, row) => sum + row.emissionAmount, 0);
  const delta = total - previousTotal;
  const hasChanges = version === 1 || added > 0 || modified > 0 || deleted > 0;
  const changeSummary = version > 1 ? `${added} 项新增 · ${modified} 项修改 · ${deleted} 项删除` : `共 ${inventory.length} 个排放源`;
  const deltaText = `${delta >= 0 ? '+' : ''}${format(delta)} tCO₂e`;

  return <Dialog title={title} onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary onClick={confirm}>{version === 1 ? '确认生成' : '确认更新'}</Button></>}>
    <div className={styles.confirmLead}>
      <strong>{version === 1 ? '确认生成首个正式核算清单？' : '确认用本次修改更新正式核算清单？'}</strong>
      <span>{version === 1 ? `系统将保存当前 ${inventory.length} 个排放源及其核算结果。` : hasChanges ? '系统将以当前编辑副本生成新的正式版本。' : '当前没有检测到排放源数据变化。'}</span>
    </div>
    <div className={styles.confirmSummary}>
      <div><span>更新后状态</span><b>当前正式清单</b></div>
      <div><span>{version === 1 ? '排放源数量' : '本次变更'}</span><b>{changeSummary}</b></div>
      <div><span>{version === 1 ? '排放总量' : '排放量变化'}</span><b>{version === 1 ? `${format(total)} tCO₂e` : deltaText}</b></div>
    </div>
    {version > 1 && hasChanges && <div className={styles.confirmChangeHint}>发布后将同步更新碳排放预览、核查支撑清单及导出数据，历史正式版本将保留。</div>}
    {version > 1 && !hasChanges && <div className={styles.confirmNoChanges}>当前没有检测到排放源数据变化，确认后仍将保存本次更新记录。</div>}
  </Dialog>;
}

function ChangeDrawer({ baseline, draft, version, close }: { baseline: EmissionSource[]; draft: EmissionSource[]; version: number; close: () => void }) {
  const baselineById = new Map(baseline.map((row) => [row.emissionSourceId, row]));
  const draftById = new Map(draft.map((row) => [row.emissionSourceId, row]));
  const rows = [
    ...draft.filter((row) => !baselineById.has(row.emissionSourceId)).map((row) => ({ type: '新增', name: row.sourceName, before: '—', after: format(row.emissionAmount) })),
    ...draft.filter((row) => { const before = baselineById.get(row.emissionSourceId); return before ? changed(before, row) : false; }).map((row) => ({ type: '修改', name: row.sourceName, before: format(baselineById.get(row.emissionSourceId)!.emissionAmount), after: format(row.emissionAmount) })),
    ...baseline.filter((row) => !draftById.has(row.emissionSourceId)).map((row) => ({ type: '删除', name: row.sourceName, before: format(row.emissionAmount), after: '—' })),
  ];
  const totalBefore = baseline.reduce((sum, row) => sum + row.emissionAmount, 0);
  const totalAfter = draft.reduce((sum, row) => sum + row.emissionAmount, 0);
  return <Drawer title="本次修改详情" onClose={close} footer={<Button onClick={close}>关闭</Button>}><div className={styles.calcSummary}><div><span>当前基准</span><b>当前正式清单</b></div><div><span>排放总量变化</span><b>{totalAfter - totalBefore >= 0 ? '+' : ''}{format(totalAfter - totalBefore)} tCO₂e</b></div><div><span>变更记录</span><b>{rows.length} 项</b></div></div><DetailBlock title="具体变更记录"><table className={styles.changeTable}><thead><tr><th>变更类型</th><th>排放源</th><th>变更前排放量</th><th>变更后排放量</th></tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={`${row.type}-${row.name}-${index}`}><td>{row.type}</td><td>{row.name}</td><td>{row.before === '—' ? row.before : `${row.before} tCO₂e`}</td><td>{row.after === '—' ? row.after : `${row.after} tCO₂e`}</td></tr>) : <tr><td colSpan={4} className={styles.emptyRow}>当前编辑副本暂无变更</td></tr>}</tbody></table></DetailBlock></Drawer>;
}

type FactorSelectionRow = Pick<EmissionSource, 'emissionSourceId' | 'emissionFactorId' | 'sourceType' | 'activityUnit'> & Partial<Pick<EmissionSource, 'sourceName' | 'emissionCategory' | 'greenhouseGasSpecies' | 'activityValue'>>;

const normalizeSourceType = (value?: string) => (value ?? '')
  .replace(/源$/, '')
  .replace(/排放$/, '')
  .replace('制冷剂逸散', '逸散')
  .replace('废弃物处理处置', '废弃物处理');
const basisLabel: Record<NonNullable<CarbonFactor['calculationBasis']>, string> = { volume: '按体积', mass: '按质量', heat: '按热值', electricity: '按电量', process: '按工艺参数', other: '其他口径' };
const factorObjectForRow = (row: FactorSelectionRow, current?: CarbonFactor) => {
  if (current?.factorObject) return current.factorObject;
  const sourceName = row.sourceName ?? '';
  return ['外购电力', '外购热力', '天然气', '原煤', 'RDF', '柴油'].find((token) => sourceName.includes(token));
};
const factorActivityUnit = (factor: CarbonFactor) => factor.activityUnit ?? factor.unit.match(/\/(?:tCO₂e?|kgCO₂e?|kgCO₂|t|MWh|GJ|Nm³|万Nm³|m³|kg|t·km|人·天\/年)$/)?.[0]?.slice(1);
const compatibleFactor = (factor: CarbonFactor, row: FactorSelectionRow, current?: CarbonFactor) => {
  if (factor.validity !== '当前有效' || !factor.selectable) return false;
  const object = factorObjectForRow(row, current);
  const isNewSource = row.emissionSourceId === 'new-source';
  if (factor.libraryCategoryCode === 'TENANT_CUSTOM_FACTOR') return true;
  const context = selectionContextText(row);
  const isWastewater = /废水|污水|COD/.test(context);
  const isFugitive = /逸散|制冷剂|冷媒|R134a|含氟/.test(context);
  const isPurchasedElectricity = /购入电力|外购电力|电力/.test(context);
  const isPurchasedHeat = /购入热力|外购热力|热力|蒸汽/.test(context);
  const isProcess = /生产过程|碳酸盐|原料分解/.test(context);
  if (isInternalCalculationParameter(factor)) return false;
  if (isWastewater) return factor.calculationType === 'wastewaterParameter' || factor.factorId === 'pf-waste';
  if (isFugitive) return factor.factorId === 'pf-r134a' || factor.activity === '逸散排放';
  if (isPurchasedElectricity) return factor.calculationScenario === 'purchasedElectricity' || factor.factorId === 'pf-power';
  if (isPurchasedHeat) return factor.calculationScenario === 'purchasedHeat' || factor.factorId === 'pf-heat';
  if (isProcess) return factor.calculationType === 'processParameter' || factor.calculationScenario === 'carbonateProcess' || factor.factorId === 'pf-process';
  if (!isNewSource && object && factor.factorObject && object !== factor.factorObject) return false;
  if (!isNewSource && row.sourceType && row.sourceType !== '其他/自定义' && factor.emissionSourceType && normalizeSourceType(row.sourceType) !== normalizeSourceType(factor.emissionSourceType)) return false;
  if (row.activityUnit && factorActivityUnit(factor) !== row.activityUnit) return false;
  if (row.greenhouseGasSpecies?.length && factor.ghgType && !row.greenhouseGasSpecies.includes(factor.ghgType)) return false;
  return true;
};

function FactorSelectDialog({ row, factors, close, choose, onCreateTenantFactor }: { row: FactorSelectionRow; factors: CarbonFactor[]; close: () => void; choose: (factorId: string) => void; onCreateTenantFactor: (factor: TenantCustomCarbonFactor) => void }) {
  const current = getCarbonFactorV4(row.emissionFactorId);
  const candidates = factors.filter((factor) => compatibleFactor(factor, row, current));
  const [selected, setSelected] = useState(row.emissionFactorId);
  const [keyword, setKeyword] = useState('');
  const [factorScope, setFactorScope] = useState<'all' | 'public' | 'enterprise'>('all');
  const [region, setRegion] = useState<'all' | 'current' | 'national'>('all');
  const [publishedYear, setPublishedYear] = useState('all');
  const [customOpen, setCustomOpen] = useState(false);
  const visible = candidates.filter((factor) => (!keyword || [factor.name, factor.source, factor.version, factor.reference, String(factor.publishedYear ?? '')].some((value) => value.includes(keyword))) && (factorScope === 'all' || factor.scope === factorScope) && (region === 'all' || (region === 'current' ? factor.geo === '当前企业' : factor.geo === '全国')) && (publishedYear === 'all' || String(factor.publishedYear) === publishedYear));
  const object = factorObjectForRow(row, current) ?? '当前排放源';
  const contextType = row.sourceType?.replace(/源$/, '') ?? current?.emissionSourceType ?? '—';
  const contextUnit = row.activityUnit ?? current?.activityUnit ?? '—';
  const contextGas = row.greenhouseGasSpecies?.join('、') ?? current?.ghgType ?? '—';
  const contextBasis = current?.calculationBasis ? basisLabel[current.calculationBasis] : contextUnit === 'Nm³' ? '按体积' : contextUnit === 'GJ' ? '按热值' : contextUnit === 'MWh' ? '按电量' : contextUnit === 't' ? '按质量' : '按当前活动数据';
  const displayValue = (factor: CarbonFactor) => factor.unit === '参数组' ? `参数组（${displayParameters(factor).length}项）` : factor.value.replace(/^折算因子\s*/, '');
  const renderFactor = (factor: CarbonFactor) => <label key={factor.factorId} className={selected === factor.factorId ? styles.selectedChoice : ''}><input type="radio" checked={selected === factor.factorId} onChange={() => setSelected(factor.factorId)} /><span className={styles.factorChoiceContent}><b>{factor.factorObject ?? factor.name}</b><span className={styles.factorChoiceSimpleMeta}>{calculationFactorDisplay({ ...row, activityValue: row.activityValue ?? 0 } as EmissionSource, factor.factorId)} · {factor.unit === '参数组' ? '综合核算' : factor.unit}</span><small className={styles.factorChoiceType}>{factorSelectionCategory(factor)} · {factor.standard && !['官方缺省值', '方法学参数'].includes(factor.standard) ? factor.standard : factor.source}{factor.publishedYear ? ` · ${factor.publishedYear}年度` : ''}{factor.geo ? ` · ${factor.geo}` : ''}</small></span>{factor.factorId === current?.factorId && <span className={styles.currentFactorTag}>当前使用</span>}</label>;
  if (customOpen) return <FactorLibraryAddModal onClose={() => setCustomOpen(false)} onSubmit={onCreateTenantFactor} />;
  return <Dialog title="选择核算因子" wide className={styles.factorDialog} onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary disabled={!selected} onClick={() => choose(selected)}>确认选择</Button></>}>
    <div className={styles.factorContext}><div><span>当前排放源</span><b>{row.sourceName ?? '当前排放源'}</b></div><div><span>排放类别</span><b>{row.emissionCategory ?? '—'}</b></div><div><span>排放源类型</span><b>{contextType}</b></div><div><span>活动数据</span><b>{row.activityValue !== undefined ? `${row.activityValue.toLocaleString('zh-CN')} ${contextUnit}` : contextUnit}</b></div><div className={styles.factorMatch}><span>匹配条件</span><b>{object} / {contextType} / {contextBasis} / {contextUnit} / {contextGas}</b></div></div><div className={styles.factorPickerFilters}><select aria-label="因子类型" value={factorScope} onChange={(event) => setFactorScope(event.target.value as typeof factorScope)}><option value="all">因子类型　全部</option><option value="public">公共因子</option><option value="enterprise">企业因子</option></select><select aria-label="适用地区" value={region} onChange={(event) => setRegion(event.target.value as typeof region)}><option value="all">适用地区　全部</option><option value="current">当前企业</option><option value="national">全国</option></select><select aria-label="发布年度" value={publishedYear} onChange={(event) => setPublishedYear(event.target.value)}><option value="all">发布年度　全部</option>{[...new Set(candidates.map((factor) => factor.publishedYear).filter(Boolean))].map((year) => <option key={year} value={year}>{year}</option>)}</select><div className={styles.search}><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索因子名称、来源或版本" /></div></div><div className={styles.factorPickerSummary}>当前排放源适用的核算因子 {visible.length} 个{current ? ` · 当前使用：${current.name}` : ''}</div><div className={styles.factorGroups}>{visible.length ? <div className={styles.factorChoices}>{visible.map(renderFactor)}</div> : <div className={styles.emptyRow}>当前排放源没有兼容的核算因子。内部参数、GWP 和查表数据由系统自动关联。</div>}</div><div className={styles.factorPickerActions}><span><b>未找到适用因子？</b>可录入当前企业的实测或供应商核算因子，并填写可核验依据。</span><Button outline onClick={() => setCustomOpen(true)}>新增企业专属因子</Button></div>
  </Dialog>;
}

type FactorTemplateKey = 'fuel' | 'direct' | 'process' | 'wastewater' | 'balance' | 'fugitive' | 'recovery' | 'measured';
const factorLibraryTemplateKeys: FactorTemplateKey[] = ['fuel', 'direct', 'process', 'wastewater', 'fugitive'];

const factorTemplateMeta: Record<FactorTemplateKey, { label: string; title: string; activity: string; gas: string; scenario: string; notice: string; formula: string }> = {
  fuel: { label: '参数合成因子型｜燃料燃烧', title: '柴油—移动燃烧（按质量）', activity: '移动燃烧', gas: 'CO₂', scenario: '化石燃料燃烧', notice: '因子库维护 NCV、CC、OF 和 44/12 等可跨核算期复用的参数；燃料消费量属于核算期活动数据，不在因子库录入。', formula: '排放量 = 燃料消耗量 × NCV × CC ÷ 1000 × OF × 44/12' },
  direct: { label: '直接因子型｜电力、热力、运输', title: '外购电力—购入电力', activity: '购入电力', gas: 'CO₂e', scenario: '购入能源或运输活动', notice: '直接因子本身已经是可直接用于核算的综合因子；企业可以覆盖最终因子值，并上传检测报告、供应商证明或年度发布文件。', formula: '排放量 = 活动数据 × 结果因子' },
  process: { label: '工艺参数型｜碳酸盐分解', title: '碳酸盐原料—生产过程（按质量）', activity: '工业过程', gas: 'CO₂', scenario: '碳酸盐使用过程', notice: '碳酸盐过程按原料消耗量、碳酸盐纯度和 CO₂ 排放因子拆解。不同原料应作为不同的综合核算配置维护。', formula: '排放量 = Σ（碳酸盐消耗量 × 纯度 × CO₂排放因子）' },
  wastewater: { label: '废水参数型｜厌氧处理', title: '工业废水—厌氧处理', activity: '废水厌氧处理', gas: 'CH₄', scenario: 'COD 去除量法', notice: '废水排放参数与排放源活动数据分离：COD 去除量、污泥清除量可录入企业监测值，Bo、MCF、GWP 使用缺省值或经核验的企业参数；实际回收/销毁量另行扣除。', formula: '排放量 =（COD去除量 − 污泥清除COD量）× Bo × MCF × GWP' },
  balance: { label: '物料平衡型｜含碳原料/产品', title: '物料平衡—碳输入输出', activity: '物料平衡', gas: 'CO₂', scenario: '碳元素输入输出', notice: '适用于以碳输入量与碳输出量核算的场景。输入、输出、库存变化等活动数据应保留各自来源和计量依据。', formula: '排放量 =（碳输入量 CCI − 碳输出量 CCO）× 44/12' },
  fugitive: { label: '逸散型｜冷媒/灭火器/六氟化硫', title: '制冷剂/含氟气体常规逸散', activity: '逸散排放', gas: 'CO₂e', scenario: '制冷剂补充/泄漏量', notice: '填充量、补充量或泄漏量是活动数据；因子为按设备/物质选择的常规逸散率，逸散质量再按对应物质的 GWP100 折算 CO₂e。', formula: '排放量 = 活动数据 × 逸散系数 × 对应GWP' },
  recovery: { label: '回收/销毁扣减型｜CH₄回收与火炬销毁', title: '甲烷回收与销毁', activity: 'CH₄回收与销毁', gas: 'CH₄', scenario: '回收利用、外供及火炬销毁', notice: '回收/销毁是核算模板，不作为普通因子新增。因子库仅可维护氧化系数、销毁效率等可复用参数；回收量、外供量、火炬气量和浓度属于核算期活动或监测数据。', formula: '回收与销毁量 = 自用回收量 + 外供回收量 + 火炬销毁量' },
  measured: { label: '实测型｜CEMS 连续监测', title: 'CEMS—烟气连续排放监测', activity: '连续排放监测', gas: 'CO₂', scenario: '浓度 × 流量 × 时间', notice: 'CEMS 是实测核算配置，不作为普通因子库新增条目。系统展示监测设备、校准状态、数据完整性和实测排放结果。', formula: '排放量 = 污染物浓度 × 烟气流量 × 运行时间' },
};

const factorValueResult = (template: FactorTemplateKey, parameters: CarbonFactorParameter[], fallback: string) => {
  const values = new Map(parameters.map((parameter) => [parameter.key, Number(parameter.value)]));
  const value = (key: string, defaultValue = 0) => values.get(key) ?? defaultValue;
  if (template === 'fuel') return value('ncv') * value('cc') * value('of') / 100 * value('mw', 44 / 12) / 1000;
  if (template === 'process') return value('purity') / 100 * value('co2Factor');
  if (template === 'wastewater') return value('bo', 0.25) * value('mcf') * value('gwp', 21) / 1000;
  if (template === 'fugitive') return value('fugitiveRate') / 100 * value('fugitiveGwp');
  if (template === 'direct') return value('resultFactor', Number(fallback) || 0);
  return Number(fallback) || 0;
};

const factorValueUnit = (template: FactorTemplateKey, unit: string, parameters: CarbonFactorParameter[]) => {
  if (template === 'process') return parameters.find((parameter) => parameter.key === 'co2Factor')?.unit || unit || '—';
  if (template === 'fugitive') return parameters.find((parameter) => parameter.key === 'fugitiveGwp')?.unit || unit || '—';
  if (template === 'wastewater') return 'tCO₂e/kg COD';
  return unit || '—';
};

type FactorFormMeta = { name: string; value: string; unit: string; source: string; sourceType: string; year: string; organization: string; remark: string; activity: string; scenario: string };
type FactorActivityOption = { activity: string; scenarios: string[] };

const factorActivityOptions: Record<FactorTemplateKey, FactorActivityOption[]> = {
  fuel: [
    { activity: '固定燃烧', scenarios: ['煤炭 · t', '天然气 · Nm³', '燃料油 · t', 'RDF · t'] },
    { activity: '移动燃烧', scenarios: ['柴油 · t', '汽油 · t', '航空煤油 · t', '船用燃料油 · t'] },
    { activity: '火炬燃烧', scenarios: ['天然气 · Nm³', '炼厂气 · Nm³', '火炬气 · Nm³'] },
  ],
  direct: [
    { activity: '购入电力', scenarios: ['全国电网 · MWh', '区域电网 · MWh', '企业购电合同 · MWh'] },
    { activity: '购入热力', scenarios: ['蒸汽 · GJ', '热水 · GJ'] },
    { activity: '交通运输', scenarios: ['公路货运 · t·km', '铁路货运 · t·km', '水路货运 · t·km', '航空运输 · t·km'] },
  ],
  process: [{ activity: '工业过程', scenarios: ['碳酸盐 · t', '熟料生产 · t', '化工原料 · t'] }],
  wastewater: [
    { activity: '工业废水处理', scenarios: ['工业废水 · COD', '工业废水 · m³'] },
    { activity: '生活污水处理', scenarios: ['生活污水 · 人·天', '生活污水 · m³'] },
  ],
  balance: [{ activity: '物料平衡', scenarios: ['含碳原料输入/输出 · tC', '产品碳含量平衡 · tC'] }],
  fugitive: [
    { activity: '制冷剂逸散', scenarios: ['制冷剂 · kg', '制冷剂 · t'] },
    { activity: '含氟气体逸散', scenarios: ['SF₆ · kg', '含氟气体 · kg'] },
  ],
  recovery: [{ activity: '回收与销毁', scenarios: ['CH₄回收与销毁 · Nm³', 'CO₂回收利用 · 万Nm³'] }],
  measured: [{ activity: '连续排放监测', scenarios: ['CEMS · CO₂', 'CEMS · CH₄', 'CEMS · N₂O'] }],
};

const activityOptionsFor = (template: FactorTemplateKey) => factorActivityOptions[template];
const scenarioOptionsFor = (template: FactorTemplateKey, activity: string) => activityOptionsFor(template).find((option) => option.activity === activity)?.scenarios ?? [];
const initialTemplateSelection = (template: FactorTemplateKey) => {
  const options = activityOptionsFor(template);
  const selected = options.find((option) => option.activity === factorTemplateMeta[template].activity) ?? options[0];
  return { activity: selected?.activity ?? '', scenario: selected?.scenarios[0] ?? '' };
};

const templateForFactor = (factor: CarbonFactor): FactorTemplateKey => {
  if (factor.calculationScenario === 'fuelCombustion' || factor.calculationType === 'fuelParameter') return 'fuel';
  if (factor.calculationScenario === 'carbonateProcess' || factor.calculationType === 'processParameter') return 'process';
  if (factor.calculationScenario === 'wastewaterAnaerobic' || factor.calculationType === 'wastewaterParameter') return 'wastewater';
  if (factor.calculationScenario === 'methaneRecovery' || factor.calculationScenario === 'co2Recovery' || factor.calculationType === 'recoveryParameter') return 'recovery';
  if (factor.activity === '逸散排放' || factor.objectType === 'GWP值' || factor.unit === '%') return 'fugitive';
  return 'direct';
};

const templateForSelectionRow = (row: FactorSelectionRow, current?: CarbonFactor): FactorTemplateKey => {
  if (current) return templateForFactor(current);
  const context = `${row.sourceName ?? ''} ${row.sourceType ?? ''} ${row.greenhouseGasSpecies?.join(' ') ?? ''}`;
  if (/废水|污水|COD/.test(context)) return 'wastewater';
  if (/回收|销毁/.test(context)) return 'recovery';
  if (/制冷剂|含氟|R134a|SF₆|HFC|PFC/.test(context)) return 'fugitive';
  if (/燃烧|锅炉|窑|燃料/.test(context)) return 'fuel';
  if (/工艺|碳酸盐|熟料/.test(context)) return 'process';
  return 'direct';
};

const templateTypeLabel = (template: FactorTemplateKey) => factorTemplateMeta[template].label.split('｜')[0];
const templateUseCase = (template: FactorTemplateKey, activity?: string, scenario?: string) => {
  if (scenario) return scenario;
  const selectedActivity = activity ?? initialTemplateSelection(template).activity;
  return scenarioOptionsFor(template, selectedActivity)[0] ?? factorTemplateMeta[template].scenario;
};
const directParameterName = (activity: string) => activity.includes('热力') ? '热力排放因子' : activity.includes('运输') ? '运输排放因子' : '电力排放因子';
const directFactorOptions = [
  { name: '电力排放因子', activity: '购入电力', scenario: '全国电网 · MWh', unit: 'tCO₂e/MWh' },
  { name: '热力排放因子', activity: '购入热力', scenario: '蒸汽 · GJ', unit: 'tCO₂/GJ' },
  { name: '运输排放因子', activity: '交通运输', scenario: '公路货运 · t·km', unit: 'kgCO₂e/t·km' },
];
const directFactorOption = (name: string) => directFactorOptions.find((option) => option.name === name) ?? directFactorOptions[0];
const fugitiveFactorOptions = [
  { name: '冷媒逸散率｜冰箱', activity: '制冷剂逸散', scenario: '制冷剂补充量 · kg', value: 0.3, display: '0.30', unit: '%' },
  { name: '冷媒逸散率｜空调', activity: '制冷剂逸散', scenario: '制冷剂补充量 · kg', value: 5.5, display: '5.50', unit: '%' },
  { name: '冷媒逸散率｜汽车空调', activity: '制冷剂逸散', scenario: '制冷剂补充量 · kg', value: 15, display: '15.00', unit: '%' },
  { name: '冷媒逸散率｜冷冻机', activity: '制冷剂逸散', scenario: '制冷剂补充量 · kg', value: 8.5, display: '8.50', unit: '%' },
  { name: '冷媒逸散率｜恒温恒压机', activity: '制冷剂逸散', scenario: '制冷剂补充量 · kg', value: 8, display: '8.00', unit: '%' },
  { name: 'SF₆逸散率｜高压电柜', activity: '含氟气体逸散', scenario: 'SF₆补充量 · kg', value: 0.5, display: '0.50', unit: '%' },
  { name: 'FM200逸散率｜中央系统灭火器', activity: '含氟气体逸散', scenario: 'FM200补充量 · kg', value: 2, display: '2.00', unit: '%' },
  { name: 'CO₂逸散率｜便携式灭火器', activity: '含氟气体逸散', scenario: 'CO₂补充量 · kg', value: 4, display: '4.00', unit: '%' },
];
const fugitiveFactorOption = (name: string) => fugitiveFactorOptions.find((option) => option.name === name) ?? fugitiveFactorOptions[0];
const fugitiveGwpOptions = ar6GwpRows.map((row) => ({ name: `GWP100｜${row.gas}`, gas: row.gas, value: row.value, display: String(row.value), unit: 'kgCO₂e/kg' }));
const fugitiveGwpOption = (name: string) => fugitiveGwpOptions.find((option) => option.name === name) ?? fugitiveGwpOptions.find((option) => option.gas === 'HFC-134a') ?? fugitiveGwpOptions[0];
const directScenarioParts = (scenario: string) => {
  const [object, unit] = scenario.split(' · ');
  return { object, unit: unit || '按活动数据单位' };
};
const directScenarioFor = (activity: string, unit?: string) => scenarioOptionsFor('direct', activity).find((scenario) => directScenarioParts(scenario).unit === unit) ?? scenarioOptionsFor('direct', activity)[0] ?? '';

const templateSeed = (template: FactorTemplateKey) => {
  const candidates: Record<FactorTemplateKey, string | undefined> = {
    fuel: 'pf-diesel', direct: undefined, process: 'pf-process', wastewater: 'pf-waste', balance: undefined,
    fugitive: 'pf-r134a', recovery: 'pf-ch4-recovery', measured: undefined,
  };
  return candidates[template] ? carbonFactorsV4.find((factor) => factor.factorId === candidates[template]) : undefined;
};

const reusableParametersForTemplate = (template: FactorTemplateKey, parameters: CarbonFactorParameter[]) => {
  if (template === 'recovery') return parameters.filter((parameter) => ['selfUseOxidation', 'flareEfficiency'].includes(parameter.key));
  if (template === 'balance') return parameters.filter((parameter) => parameter.key === 'mw');
  if (template === 'measured') return [];
  return parameters;
};

const templateParameters = (template: FactorTemplateKey, factor?: CarbonFactor, allowDirectEdit = false): CarbonFactorParameter[] => {
  if (factor?.parameters?.length) return reusableParametersForTemplate(template, template === 'wastewater' ? displayParameters(factor).filter((parameter) => ['bo', 'mcf', 'gwp'].includes(parameter.key)) : displayParameters(factor));
  if (template === 'direct' && factor) return displayParameters(factor).map((parameter) => ({ ...parameter, key: 'resultFactor', editable: allowDirectEdit }));
  const seed = templateSeed(template);
  if (seed && template !== 'fugitive') return reusableParametersForTemplate(template, template === 'wastewater' ? displayParameters(seed).filter((parameter) => ['bo', 'mcf', 'gwp'].includes(parameter.key)) : displayParameters(seed));
  const parameter = (key: string, name: string, value: number, display: string, unit: string, editable = true): CarbonFactorParameter => ({ key, name, value, display, unit, sourceType: '官方缺省值', source: '方法学参数', editable, valueMode: editable ? '缺省值' : '方法学常数', evidenceRequired: editable });
  if (template === 'balance') return [parameter('mw', '碳转化为二氧化碳系数', 44 / 12, '44/12', '—', false)];
  if (template === 'measured') return [parameter('concentration', '污染物浓度', 0, '0', 'mg/Nm³'), parameter('flow', '烟气流量', 0, '0', 'Nm³/h'), parameter('hours', '运行时间', 0, '0', 'h')];
  if (template === 'fugitive') { const rate = fugitiveFactorOptions[0]; const gwp = fugitiveGwpOption('GWP100｜HFC-134a'); return [parameter('fugitiveRate', rate.name, rate.value, rate.display, rate.unit), parameter('fugitiveGwp', gwp.name, gwp.value, gwp.display, gwp.unit)]; }
  return [parameter('resultFactor', directFactorOptions[0].name, 0, '', directFactorOptions[0].unit)];
};

const sourceTypeOptions = ['官方缺省值', '企业实测', '供应商数据'];
const methodOptions = (sourceType: string) => sourceType === '企业实测' || sourceType === '企业数据' ? ['检测值', '计算值'] : sourceType === '供应商数据' ? ['直接采用'] : ['缺省值'];
const normalizedParameterSourceType = (sourceType: string) => sourceType === '方法学常数' ? '方法学常数' : sourceType.includes('供应商') ? '供应商数据' : /标准|官方|年度|国家|指南|缺省/.test(sourceType) ? '官方缺省值' : '企业实测';
const factorYearOptions = ['2024年度', '2025年度', '2026年度', '2027年度', '2028年度', '2029年度', '2030年度'];

const evidenceFileName = (parameter: CarbonFactorParameter) => parameter.source.startsWith('证明材料：') ? parameter.source.replace('证明材料：', '') : parameter.source.includes('依据材料：') ? parameter.source.split('依据材料：')[1] : parameter.source.includes('检测报告') || parameter.source.includes('供应商证明') ? parameter.source : '';
const factorEvidenceFileType = (fileName: string) => fileName.split('.').pop()?.toUpperCase() || '文件';
const factorEvidenceFiles = (parameter: CarbonFactorParameter): CarbonFactorEvidenceFile[] => {
  if (parameter.evidenceFiles?.length) return parameter.evidenceFiles;
  const fileName = evidenceFileName(parameter);
  return fileName ? fileName.split('、').map((name) => name.trim()).filter(Boolean).map((name, index) => ({ evidenceFileId: `legacy-${parameter.key}-${index}-${name}`, fileName: name, fileType: factorEvidenceFileType(name) })) : [];
};

function ParameterEvidenceDialog({ parameter, mode, close, save, change }: { parameter: CarbonFactorParameter; mode: 'view' | 'edit'; close: () => void; save: (files: CarbonFactorEvidenceFile[]) => void; change: (files: CarbonFactorEvidenceFile[]) => void }) {
  const [files, setFiles] = useState(() => factorEvidenceFiles(parameter));
  const [dragging, setDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'file'; file: CarbonFactorEvidenceFile } | { kind: 'all' }>();
  const addFiles = (selectedFiles: File[]) => {
    const acceptedFiles = filterEvidenceFiles(selectedFiles);
    if (!acceptedFiles.length) return;
    setFiles((items) => [...items, ...acceptedFiles.map((file, index) => ({ evidenceFileId: `factor-${Date.now()}-${index}`, fileName: file.name, fileType: factorEvidenceFileType(file.name) }))]);
  };
  const downloadFile = (file: CarbonFactorEvidenceFile) => { const url = URL.createObjectURL(new Blob([`证明材料：${file.fileName}`], { type: 'text/plain;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.fileName; anchor.click(); URL.revokeObjectURL(url); };
  const requestDelete = (pending: { kind: 'file'; file: CarbonFactorEvidenceFile } | { kind: 'all' }) => setPendingDelete(pending);
  const confirmDelete = () => {
    if (!pendingDelete) return;
    const nextFiles = pendingDelete.kind === 'all' ? [] : files.filter((file) => file.evidenceFileId !== pendingDelete.file.evidenceFileId);
    setFiles(nextFiles);
    if (mode === 'view') change(nextFiles);
    setPendingDelete(undefined);
  };
  const fileCountLabel = files.length ? `${files.length} 份材料` : '暂无已上传材料';
  return <div className={styles.factorEvidenceMask} role="dialog" aria-modal="true" aria-label={`${parameter.name} · 证明材料`}>
    <section className={styles.factorEvidenceDialog}><header><h3>{parameter.name} · 证明材料</h3><button type="button" onClick={close}>×</button></header><div className={styles.factorEvidenceBody}><p>{mode === 'view' ? '查看该参数已关联的检测报告、供应商证明、监测台账或适用方法学证明材料。' : '上传该参数对应的检测报告、供应商证明、监测台账或适用方法学证明材料。'}</p><div className={styles.factorEvidenceUpload}><div className={styles.factorEvidenceListHeading}><span>证明材料（{fileCountLabel}）</span>{files.length > 0 && <button type="button" className={styles.factorEvidenceDeleteAll} onClick={() => requestDelete({ kind: 'all' })}>删除全部材料</button>}</div>{mode === 'edit' && <div className={`${styles.factorEvidenceDropzone} ${dragging ? styles.factorEvidenceDropzoneActive : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}><strong>↑</strong><span>点击或拖拽文件到此处上传</span><small>仅支持 PDF 或图片，可一次上传多个文件</small><label><input type="file" multiple accept={EVIDENCE_FILE_ACCEPT} onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />选择文件</label></div>}{files.length ? <div className={styles.factorEvidenceFileList}>{files.map((file) => <div className={styles.factorEvidenceFile} key={file.evidenceFileId}><span>{file.fileType ?? factorEvidenceFileType(file.fileName)}</span><b title={file.fileName}>{file.fileName}</b><button type="button" className={styles.factorEvidenceDownload} onClick={() => downloadFile(file)}>下载材料</button><button type="button" onClick={() => requestDelete({ kind: 'file', file })}>删除</button></div>)}</div> : <div className={styles.factorEvidenceEmpty}>暂无已上传材料</div>}</div></div><footer><Button onClick={close}>{mode === 'view' ? '关闭' : '取消'}</Button>{mode === 'edit' && <Button primary onClick={() => save(files)}>保存材料</Button>}</footer></section>
    {pendingDelete && <Dialog title="删除证明材料" onClose={() => setPendingDelete(undefined)} footer={<><Button onClick={() => setPendingDelete(undefined)}>取消</Button><Button danger onClick={confirmDelete}>确认删除</Button></>}><div className={styles.confirmBox}>{pendingDelete.kind === 'all' ? `确认删除“${parameter.name}”的全部证明材料吗？删除后该参数将不再保留任何已上传材料。` : `确认删除文件“${pendingDelete.file.fileName}”吗？删除后该文件将从该参数的证明材料中移除。`}</div></Dialog>}
  </div>;
}

function UnifiedParameterTable({ parameters, editable, onUpdate, onEvidence }: { parameters: CarbonFactorParameter[]; editable: boolean; onUpdate: (key: string, patch: Partial<CarbonFactorParameter>) => void; onEvidence: (parameter: CarbonFactorParameter, mode: 'view' | 'edit') => void }) {
  return <div className={styles.factorParameterScroll}><table className={styles.factorUnifiedParamTable}><thead><tr><th>参数</th><th>来源类型</th><th>数值</th><th>单位</th><th>证明材料</th><th>材料状态</th><th>操作</th></tr></thead><tbody>{parameters.map((parameter) => {
    const sourceType = sourceTypeOptions.includes(parameter.sourceType) ? parameter.sourceType : normalizedParameterSourceType(parameter.sourceType);
    const sourceTypeLabel = sourceType;
    const evidenceFiles = factorEvidenceFiles(parameter);
    const fileName = evidenceFiles[0]?.fileName ?? '';
    const needsEvidence = sourceType === '企业实测' || sourceType === '供应商数据';
    return <tr key={parameter.key}><td>{editable && parameter.editable && parameter.key === 'resultFactor' ? <select value={parameter.name} onChange={(event) => { const selected = directFactorOption(event.target.value); onUpdate(parameter.key, { name: selected.name, unit: selected.unit }); }}><option>{directFactorOptions[0].name}</option><option>{directFactorOptions[1].name}</option><option>{directFactorOptions[2].name}</option></select> : editable && parameter.editable && parameter.key === 'fugitiveRate' ? <select value={parameter.name} onChange={(event) => { const selected = fugitiveFactorOption(event.target.value); onUpdate(parameter.key, { name: selected.name, value: selected.value, display: selected.display, unit: selected.unit }); }}>{fugitiveFactorOptions.map((option) => <option key={option.name}>{option.name}</option>)}</select> : editable && parameter.editable && parameter.key === 'fugitiveGwp' ? <select value={parameter.name} onChange={(event) => { const selected = fugitiveGwpOption(event.target.value); onUpdate(parameter.key, { name: selected.name, value: selected.value, display: selected.display, unit: selected.unit }); }}>{fugitiveGwpOptions.map((option) => <option key={option.name}>{option.name}</option>)}</select> : <b>{parameter.name}</b>}</td><td>{editable && parameter.editable && parameter.key !== 'fugitiveGwp' ? <select value={sourceType} onChange={(event) => { const next = event.target.value; onUpdate(parameter.key, { sourceType: next, valueMode: methodOptions(next)[0] as CarbonFactorParameter['valueMode'] }); }}><option>{sourceTypeOptions[0]}</option><option>{sourceTypeOptions[1]}</option><option>{sourceTypeOptions[2]}</option></select> : <span>{sourceTypeLabel}</span>}</td><td>{editable && parameter.editable && parameter.key !== 'fugitiveGwp' ? <input type="number" step="any" value={parameter.display.replace(/,/g, '')} onChange={(event) => { const numericValue = Number(event.target.value); onUpdate(parameter.key, { value: Number.isFinite(numericValue) ? numericValue : 0, display: event.target.value }); }} /> : <b>{parameter.display}</b>}</td><td>{parameter.unit}</td>{needsEvidence ? <><td>{fileName ? <><span className={styles.factorEvidenceName} title={fileName}>{fileName}</span>{evidenceFiles.length > 1 && <small>等 {evidenceFiles.length} 份材料</small>}</> : <span className={styles.factorEvidenceMissing}>未上传材料</span>}</td><td><span className={fileName ? styles.factorEvidenceUploaded : styles.factorEvidencePending}>{fileName ? `已上传${evidenceFiles.length > 1 ? `（${evidenceFiles.length}份）` : ''}` : '待补充'}</span></td><td><div className={styles.factorEvidenceActions}><button type="button" className={styles.factorEvidenceLink} disabled={!fileName} onClick={() => onEvidence(parameter, 'view')}>查看</button>{editable && parameter.editable && <><button type="button" className={styles.factorEvidenceLink} onClick={() => onEvidence(parameter, 'edit')}>{fileName ? '编辑' : '上传'}</button><button type="button" className={`${styles.factorEvidenceLink} ${styles.factorEvidenceDelete}`} disabled={!fileName} onClick={() => onEvidence(parameter, 'view')}>删除</button></>}</div></td></> : <><td><span className={styles.factorEvidenceNotRequired}>不适用</span></td><td><span className={styles.factorEvidenceNotRequired}>无需上传</span></td><td><span className={styles.factorEvidenceNotRequired}>—</span></td></>}</tr>;
  })}</tbody></table></div>;
}

function UnifiedFactorSections({ template, mode, parameters, setParameters, meta, setMeta, onTemplateChange, onParametersChange }: { template: FactorTemplateKey; mode: 'view' | 'edit' | 'add'; parameters: CarbonFactorParameter[]; setParameters: (parameters: CarbonFactorParameter[]) => void; meta: FactorFormMeta; setMeta: (meta: FactorFormMeta) => void; onTemplateChange?: (template: FactorTemplateKey) => void; onParametersChange?: (parameters: CarbonFactorParameter[]) => void }) {
  const [evidenceParameter, setEvidenceParameter] = useState<CarbonFactorParameter>();
  const [evidenceMode, setEvidenceMode] = useState<'view' | 'edit'>('edit');
  const editable = mode !== 'view';
  const update = (key: string, patch: Partial<CarbonFactorParameter>) => {
    const next = parameters.map((parameter) => parameter.key === key ? { ...parameter, ...patch } : parameter);
    setParameters(next);
    onParametersChange?.(next);
    if (template === 'direct' && key === 'resultFactor') {
      const selected = directFactorOption(patch.name ?? parameters.find((parameter) => parameter.key === key)?.name ?? directFactorOptions[0].name);
      setMeta({ ...meta, value: patch.display ?? meta.value, unit: selected.unit, activity: selected.activity, scenario: selected.scenario });
    }
    if (template === 'fugitive' && key === 'fugitiveRate') {
      const selected = fugitiveFactorOption(patch.name ?? parameters.find((parameter) => parameter.key === key)?.name ?? fugitiveFactorOptions[0].name);
      setMeta({ ...meta, value: patch.display ?? selected.display, unit: selected.unit, activity: selected.activity, scenario: selected.scenario });
    }
  };
  const metaInfo = factorTemplateMeta[template];
  const result = factorValueResult(template, parameters, meta.value);
  return <>
    <div className={styles.factorTemplateBox}><div className={styles.factorTemplateFormGrid}><label>因子名称 *{mode === 'add' ? <input value={meta.name} placeholder={template === 'recovery' ? '示例：污水处理 CH₄ 回收与销毁' : '示例：柴油'} onChange={(event) => setMeta({ ...meta, name: event.target.value })} /> : <span className={styles.factorTemplateValue}>{meta.name}</span>}</label><label>因子类型 *{mode === 'add' ? <select value={template} onChange={(event) => onTemplateChange?.(event.target.value as FactorTemplateKey)}>{factorLibraryTemplateKeys.map((key) => <option key={key} value={key}>{factorTemplateMeta[key].label}</option>)}</select> : <span className={styles.factorTemplateValue}>{factorTemplateMeta[template].label}</span>}</label></div><p>{metaInfo.notice}</p></div>
    <DetailBlock title="核算参数"><UnifiedParameterTable parameters={parameters} editable={editable} onUpdate={update} onEvidence={(parameter, nextMode) => { setEvidenceMode(nextMode); setEvidenceParameter(parameter); }} /></DetailBlock>
    <DetailBlock title="因子值"><div className={styles.factorValueResult}><span>计算结果</span><strong>{format(result, 3)}</strong><b>{factorValueUnit(template, meta.unit, parameters)}</b></div></DetailBlock>
    <DetailBlock title="计算关系"><div className={styles.factorUnifiedFormula}>{metaInfo.formula}</div></DetailBlock>
    <DetailBlock title="适用与来源"><div className={styles.factorUnifiedSourceGrid}><label>适用年度<select value={meta.year} onChange={(event) => setMeta({ ...meta, year: event.target.value })} disabled={mode === 'view'}>{factorYearOptions.map((year) => <option key={year}>{year}</option>)}</select></label><label>因子来源<select value={meta.sourceType} onChange={(event) => setMeta({ ...meta, sourceType: event.target.value, source: event.target.value })} disabled={mode === 'view'}>{sourceTypeOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label>备注<textarea value={meta.remark} onChange={(event) => setMeta({ ...meta, remark: event.target.value })} placeholder="请输入适用边界、数据口径或其他说明" readOnly={mode === 'view'} />{mode === 'view' && !meta.remark && <small>暂无备注</small>}</label></div></DetailBlock>
    {evidenceParameter && <ParameterEvidenceDialog parameter={evidenceParameter} mode={evidenceMode} close={() => setEvidenceParameter(undefined)} change={(files) => update(evidenceParameter.key, { source: files.length ? `证明材料：${files.map((file) => file.fileName).join('、')}` : '企业证明材料待补充', evidenceFiles: files, evidenceRequired: true })} save={(files) => { update(evidenceParameter.key, { source: files.length ? `证明材料：${files.map((file) => file.fileName).join('、')}` : '企业证明材料待补充', evidenceFiles: files, evidenceRequired: true }); setEvidenceParameter(undefined); }} />}
  </>;
}

function createTemplateFactor(template: FactorTemplateKey, parameters: CarbonFactorParameter[], meta: FactorFormMeta, context?: FactorSelectionRow): CarbonFactor {
  const metaInfo = factorTemplateMeta[template];
  const [factorObject, activityUnit] = meta.scenario.split(' · ');
  const current = context ? getCarbonFactorV4(context.emissionFactorId) : undefined;
  const contextObject = context ? factorObjectForRow(context, current) : undefined;
  const contextUnit = context?.activityUnit || current?.activityUnit;
  const resolvedActivityUnit = contextUnit || activityUnit || '按活动数据单位';
  const resolvedActivity = current?.activity ?? meta.activity;
  const resolvedSourceType = context?.sourceType && context.sourceType !== '其他/自定义' ? normalizeSourceType(context.sourceType) : meta.activity;
  const resolvedGas = context?.greenhouseGasSpecies?.[0] ?? current?.ghgType ?? metaInfo.gas;
  const resolvedBasis = current?.calculationBasis ?? (resolvedActivityUnit === 'Nm³' || resolvedActivityUnit === '万Nm³' ? 'volume' : resolvedActivityUnit === 'GJ' ? 'heat' : resolvedActivityUnit === 'MWh' ? 'electricity' : resolvedActivityUnit === 't' || resolvedActivityUnit === 'kg' ? 'mass' : 'other');
  const fugitiveRate = parameters.find((parameter) => parameter.key === 'fugitiveRate');
  const factorValue = template === 'fugitive' && fugitiveRate ? fugitiveRate.display : meta.value.trim() || '0';
  const factorUnit = template === 'fugitive' && fugitiveRate ? fugitiveRate.unit : meta.unit.trim() || '参数组';
  const factorId = `ef-${Date.now()}`;
  const calculationType = template === 'fuel' ? 'fuelParameter' : template === 'process' ? 'processParameter' : template === 'wastewater' ? 'wastewaterParameter' : template === 'recovery' ? 'recoveryParameter' : 'direct';
  return { factorId, scope: 'enterprise', name: meta.name.trim() || factorObject || metaInfo.title, objectType: template === 'direct' || template === 'fugitive' ? '综合排放因子' : '参数组/公式模板', activity: resolvedActivity, gas: resolvedGas, value: factorValue, unit: factorUnit, source: meta.sourceType.trim() || '官方缺省值', version: meta.year, geo: meta.organization, industry: '通用工业企业', validity: '当前有效', raw: `${factorValue} ${factorUnit}`, quality: '企业参数覆盖', effective: meta.year, reference: meta.remark || '企业新增核算配置', formula: metaInfo.formula, parameters, selectable: true, calculationType, calculationScenario: template === 'fuel' ? 'fuelCombustion' : template === 'process' ? 'carbonateProcess' : template === 'wastewater' ? 'wastewaterAnaerobic' : template === 'recovery' ? 'methaneRecovery' : 'extension', approval: '待审核', factorObject: contextObject ?? factorObject ?? metaInfo.title.split('—')[0], emissionSourceType: resolvedSourceType, activityUnit: resolvedActivityUnit, ghgType: resolvedGas, calculationBasis: resolvedBasis, publishedYear: Number(meta.year.replace(/\D/g, '')) || 2026, enterpriseId: 'org-xx-tech', catalogCategory: '其他' };
}

function FactorTemplateDialog({ close, save, context, onBack }: { close: () => void; save: (factor: CarbonFactor) => void; context?: FactorSelectionRow; onBack?: () => void }) {
  const current = context ? getCarbonFactorV4(context.emissionFactorId) : undefined;
  const initialTemplate = context ? templateForSelectionRow(context, current) : 'fuel';
  const initialSeed = templateSeed(initialTemplate);
  const initialSelection = initialTemplateSelection(initialTemplate);
  const [template, setTemplate] = useState<FactorTemplateKey>(initialTemplate);
  const [parameters, setParameters] = useState(() => templateParameters(initialTemplate, current, true));
  const [meta, setMeta] = useState<FactorFormMeta>({ name: '', value: initialTemplate === 'fugitive' ? fugitiveFactorOptions[0].display : current?.value.replace(/^折算因子\s*/, '') ?? initialSeed?.value.replace(/^折算因子\s*/, '') ?? '0', unit: initialTemplate === 'fugitive' ? '%' : current?.unit ?? initialSeed?.unit ?? (initialTemplate === 'direct' ? 'tCO₂e/活动单位' : '参数组'), source: '官方缺省值', sourceType: '官方缺省值', year: '2026年度', organization: 'XX科技有限公司', remark: '', ...initialSelection, ...(current ? { activity: current.activity, scenario: initialTemplate === 'direct' ? directScenarioFor(current.activity, current.activityUnit) : initialTemplate === 'fugitive' ? fugitiveFactorOptions[0].scenario : templateUseCase(initialTemplate, current.activity) } : {}) });
  const [error, setError] = useState('');
  const changeTemplate = (next: FactorTemplateKey) => { const seed = templateSeed(next); const selection = initialTemplateSelection(next); const selectedUnit = next === 'direct' ? directScenarioParts(selection.scenario).unit : undefined; const nextParameters = templateParameters(next); setTemplate(next); setParameters(next === 'direct' ? nextParameters.map((parameter) => ({ ...parameter, name: directParameterName(selection.activity), unit: `tCO₂e/${selectedUnit}` })) : nextParameters); setMeta({ name: '', value: next === 'direct' ? '' : next === 'fugitive' ? fugitiveFactorOptions[0].display : seed?.value.replace(/^折算因子\s*/, '') ?? '0', unit: next === 'direct' ? `tCO₂e/${selectedUnit}` : next === 'fugitive' ? '%' : seed?.unit ?? '参数组', source: '官方缺省值', sourceType: '官方缺省值', year: '2026年度', organization: 'XX科技有限公司', remark: '', ...selection, ...(next === 'fugitive' ? { activity: fugitiveFactorOptions[0].activity, scenario: fugitiveFactorOptions[0].scenario } : {}) }); };
  const submit = () => { if (!factorLibraryTemplateKeys.includes(template)) { setError('回收销毁、物料平衡和实测属于核算模板，不在因子库新增'); return; } if (!meta.name.trim() || !meta.value.trim() || !meta.unit.trim()) { setError('请补齐名称、当前值和单位'); return; } setError(''); save(createTemplateFactor(template, parameters, meta, context)); };
  return <Dialog title={context ? '新增自定义因子' : meta.name || '新增企业因子'} className={styles.factorDetailDialog} onClose={close} footer={<><Button onClick={onBack ?? close}>{onBack ? '返回因子列表' : '取消'}</Button><Button primary disabled={!factorLibraryTemplateKeys.includes(template)} onClick={submit}>{!factorLibraryTemplateKeys.includes(template) ? '不在因子库新增' : context ? '保存并应用自定义因子' : '保存企业因子'}</Button></>}>
    {context && <div className={`${styles.infoBox} ${styles.customFactorHint}`}>自定义因子仅适用于当前企业，并将按当前排放源的适用对象、活动单位和温室气体类型参与匹配。</div>}
    {context && <div className={styles.factorContext}><div><span>当前排放源</span><b>{context.sourceName ?? '当前排放源'}</b></div><div><span>适用对象</span><b>{factorObjectForRow(context, current) ?? '当前排放源'}</b></div><div><span>使用场景</span><b>{context.sourceType ?? current?.emissionSourceType ?? '—'}</b></div><div><span>活动单位</span><b>{context.activityUnit ?? current?.activityUnit ?? '—'}</b></div><div><span>温室气体</span><b>{context.greenhouseGasSpecies?.join('、') ?? current?.ghgType ?? factorTemplateMeta[template].gas}</b></div></div>}
    <UnifiedFactorSections template={template} mode="add" parameters={parameters} setParameters={setParameters} meta={meta} setMeta={setMeta} onTemplateChange={changeTemplate} />
    {error && <div className={styles.infoBox}>{error}</div>}
  </Dialog>;
}

function SupportViewDialog({ item, close, openDialog }: { item: SupportItem; close: () => void; openDialog: (dialog: Extract<DialogState, { kind: 'deleteSupport' | 'deleteSupportFile' | 'viewSupport' }>) => void }) {
  const files = item.evidenceFiles ?? [];
  const scope = item.emission ? emissionScopeDictionary.find((entry) => entry.categories.some((category) => category === item.emission?.emissionCategory))?.label : undefined;
  const [previewFile, setPreviewFile] = useState<{ fileName: string }>();
  return <>
    <Dialog title="查看核查材料" onClose={close} footer={<><Button onClick={close}>关闭</Button>{files.length > 0 && <Button danger onClick={() => openDialog({ kind: 'deleteSupport', item })}>删除全部材料</Button>}</>}>
    <div className={styles.viewMaterialMeta}><div><span>材料类别</span><b>{item.emission ? '排放源证明材料' : '核算基础材料'}</b></div><div><span>材料说明</span><b>{item.item}</b></div>{item.emission && <div><span>清单属性</span><b>{scope} · {item.emission.emissionCategory} · {item.emission.sourceType}</b></div>}</div>
    <div className={styles.viewMaterialLabel}>文件列表</div>
    {files.length ? <div className={styles.materialFileTable}><div className={styles.materialFileHeader}><b>文件名称</b><b>文件类型</b><b>操作</b></div>{files.map((file) => <div className={styles.materialFileRow} key={file.evidenceFileId}><span>{file.fileName}</span><span>{materialType(file.fileName)}</span><div className={styles.materialFileActions}><button type="button" className={styles.downloadButton} onClick={() => setPreviewFile(file)}>预览</button><button type="button" className={styles.fileDeleteButton} onClick={() => openDialog({ kind: 'deleteSupportFile', item, file })}>删除</button></div></div>)}</div> : <div className={styles.emptyMaterialPanel}>暂无证明材料</div>}
    </Dialog>
    {previewFile && <Dialog title={`预览材料：${previewFile.fileName}`} onClose={() => setPreviewFile(undefined)} footer={<Button onClick={() => setPreviewFile(undefined)}>关闭</Button>}><div className={styles.confirmBox}>当前为原型预览。正式接入文件服务后，此处展示 PDF 或图片内容。</div><div className={styles.viewMaterialMeta}><div><span>文件名称</span><b>{previewFile.fileName}</b></div><div><span>文件类型</span><b>{materialType(previewFile.fileName)}</b></div></div></Dialog>}
  </>;
}

function SupportDrawer(props: { state: Extract<DrawerState, { kind: 'support' }>; close: () => void; manage: () => void; save: (item: SupportItem) => void }) {
  if (props.state.upload) return <SupportUploadDrawer state={props.state} close={props.close} save={props.save} />;
  return <SupportDetailDrawer {...props} />;
}

function SupportUploadDrawer({ state, close, save }: { state: Extract<DrawerState, { kind: 'support' }>; close: () => void; save: (item: SupportItem) => void }) {
  const item = state.item;
  const [files, setFiles] = useState<{ evidenceFileId: string; fileName: string; activityDataSource: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputId = `support-upload-dialog-${item.id ?? item.item}`;
  const addFiles = (selectedFiles: File[]) => {
    const acceptedFiles = filterEvidenceFiles(selectedFiles);
    if (!acceptedFiles.length) return;
    setFiles((items) => [...items, ...acceptedFiles.map((file, index) => ({ evidenceFileId: `upload-${Date.now()}-${index}`, fileName: file.name, activityDataSource: item.activityDataSources }))]);
  };
  const submit = () => {
    if (!files.length) return;
    const nextFiles = [...(item.evidenceFiles ?? []), ...files];
    save(item.emission
      ? { ...item, materials: nextFiles.length, evidenceFiles: nextFiles, state: '已完成', emission: { ...item.emission, evidenceFiles: nextFiles, evidenceStatus: '已完成' } }
      : { ...item, materials: nextFiles.length, evidenceFiles: nextFiles, state: '已完成' });
  };
  return <Dialog title="上传证明材料" onClose={close} footer={<><Button onClick={close}>取消</Button><Button primary disabled={!files.length} onClick={submit}>确认上传</Button></>}>
    <div className={styles.uploadForm}>
      <div className={styles.uploadFormRow}><span>材料类别</span><b>{item.emission ? '排放源证明材料' : '核算基础材料'}</b></div>
      <div className={styles.uploadFormRow}><span>材料说明</span><b>{item.item}</b></div>
      <div className={styles.uploadFormLabel}>上传文件</div>
      <input id={inputId} className={styles.hiddenFileInput} type="file" multiple accept={EVIDENCE_FILE_ACCEPT} onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      <div className={`${styles.uploadDropzone} ${styles.uploadDropzoneLarge} ${dragging ? styles.uploadDropzoneActive : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}>
        <strong>↑</strong><span>点击或拖拽文件到此处上传</span><small>仅支持 PDF 或图片，可一次上传多个文件</small><label className={styles.uploadButton} htmlFor={inputId}>选择文件</label>
      </div>
      {!!files.length && <div className={styles.uploadQueue}>{files.map((file) => <div className={styles.uploadQueueItem} key={file.evidenceFileId}><span>{file.fileName}</span><small>待上传</small></div>)}</div>}
    </div>
  </Dialog>;
}

function SupportDetailDrawer({ state, close, manage, save }: { state: Extract<DrawerState, { kind: 'support' }>; close: () => void; manage: () => void; save: (item: SupportItem) => void }) {
  const item = state.item;
  const source = item.emission;
  const [files, setFiles] = useState(source?.evidenceFiles ?? item.evidenceFiles ?? []);
  const [remark, setRemark] = useState(source?.supportRemark ?? item.supportRemark ?? '');
  const [dragging, setDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ evidenceFileId: string; fileName: string }>();
  const [previewFile, setPreviewFile] = useState<{ fileName: string; activityDataSource: string }>();
  const uploadInputId = `support-upload-${item.id ?? item.item}`;
  const submit = () => source
    ? save({ ...item, emission: { ...source, evidenceFiles: files, evidenceStatus: files.length ? '已完成' : '待补充', supportRemark: remark } })
    : save({ ...item, evidenceFiles: files, materials: files.length, state: files.length ? '已完成' : '待补充', supportRemark: remark });
  const addFiles = (selectedFiles: File[]) => {
    const acceptedFiles = filterEvidenceFiles(selectedFiles);
    if (!acceptedFiles.length) return;
    setFiles((items) => [...items, ...acceptedFiles.map((file, index) => ({ evidenceFileId: `ev-${Date.now()}-${index}`, fileName: file.name, activityDataSource: item.activityDataSources }))]);
  };
  const fileSection = <DetailBlock title="证明材料和备注">{files.map((file) => <div className={styles.fileRow} key={file.evidenceFileId}><i>FILE</i><span><b>{file.fileName}</b><small>关联来源：{file.activityDataSource}</small></span><button type="button" className={styles.downloadButton} onClick={() => setPreviewFile(file)}>预览</button>{state.manage && <button type="button" className={`${styles.textButton} ${styles.fileDeleteButton}`} onClick={() => setPendingDelete({ evidenceFileId: file.evidenceFileId, fileName: file.fileName })}>删除</button>}</div>)}{state.manage && <><input id={uploadInputId} className={styles.hiddenFileInput} type="file" multiple accept={EVIDENCE_FILE_ACCEPT} onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} /><div className={`${styles.uploadDropzone} ${dragging ? styles.uploadDropzoneActive : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}><span>将文件拖到此处，或</span><label className={styles.uploadButton} htmlFor={uploadInputId}>选择文件</label><small>仅支持 PDF 或图片，可一次上传多个文件</small></div></>}<textarea className={styles.textarea} value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="填写数据口径、年度汇总方法、缺失月份处理或来源差异说明" readOnly={!state.manage} />{state.manage && source && <Button primary onClick={submit}>保存证明材料</Button>}</DetailBlock>;
  const previewDialog = previewFile && <Dialog title={`预览材料：${previewFile.fileName}`} onClose={() => setPreviewFile(undefined)} footer={<Button onClick={() => setPreviewFile(undefined)}>关闭</Button>}><div className={styles.confirmBox}>当前为原型预览。正式接入文件服务后，此处展示 PDF 或图片内容。</div><div className={styles.viewMaterialMeta}><div><span>文件名称</span><b>{previewFile.fileName}</b></div><div><span>文件类型</span><b>{materialType(previewFile.fileName)}</b></div><div><span>关联来源</span><b>{previewFile.activityDataSource}</b></div></div></Dialog>;
  const deleteDialog = pendingDelete && <Dialog title="删除证明材料" onClose={() => setPendingDelete(undefined)} footer={<><Button onClick={() => setPendingDelete(undefined)}>取消</Button><Button danger onClick={() => { setFiles((items) => items.filter((file) => file.evidenceFileId !== pendingDelete.evidenceFileId)); setPendingDelete(undefined); }}>确认删除</Button></>}><div className={styles.confirmBox}>确认删除文件“{pendingDelete.fileName}”吗？删除后请点击“保存证明材料”使修改生效。</div></Dialog>;
  if (!source) return <><Drawer title={state.upload ? '上传基础材料' : '基础材料详情'} onClose={close} footer={<><Button onClick={close}>关闭</Button>{state.manage ? <Button primary onClick={submit}>保存上传材料</Button> : <Button outline onClick={manage}>上传</Button>}</>}><DetailBlock title={item.item}><div className={styles.kv}><span>核查事项</span><span>{item.group}</span><span>材料数量</span><b>{files.length} 份</b></div></DetailBlock>{fileSection}</Drawer>{previewDialog}{deleteDialog}</>;
  const scope = emissionScopeDictionary.find((entry) => entry.categories.some((category) => category === source.emissionCategory))?.label;
  return <><Drawer title={state.upload ? '上传证明材料' : '证明材料详情'} onClose={close} footer={<><Button onClick={close}>关闭</Button>{state.manage ? <Button primary onClick={submit}>保存上传材料</Button> : <Button outline onClick={manage}>上传</Button>}</>}><DetailBlock title="核算数据（只读）"><div className={styles.kv}><span>排放源</span><b>{source.sourceName}</b><span>清单属性</span><span>{scope} · {source.emissionCategory} · {source.sourceType}</span><span>活动数据</span><b>{source.activityData}</b><span>温室气体种类</span><span>{source.greenhouseGasSpecies.join('、')}</span><span>清单状态</span><span>当前正式清单</span></div></DetailBlock>{fileSection}</Drawer>{previewDialog}{deleteDialog}</>;
}

function FactorDetailDialog({ factor, mode, close, save, onParametersChange }: { factor: CarbonFactor; mode: 'view' | 'edit'; close: () => void; save: (factor: CarbonFactor) => void; onParametersChange?: (parameters: CarbonFactorParameter[]) => void }) {
  const template = templateForFactor(factor);
  const [parameters, setParameters] = useState(() => templateParameters(template, factor));
  const [meta, setMeta] = useState<FactorFormMeta>({ name: factor.factorObject ?? factor.name, value: factor.value.replace(/^折算因子\s*/, ''), unit: factor.unit, source: factor.source, sourceType: normalizedParameterSourceType(factor.source), year: factor.version, organization: factor.scope === 'enterprise' && factor.geo === '当前企业' ? 'XX科技有限公司' : factor.geo, remark: factor.reference, activity: factor.activity, scenario: template === 'direct' ? directScenarioFor(factor.activity, factor.activityUnit) : factor.factorObject && factor.activityUnit ? `${factor.factorObject} · ${factor.activityUnit}` : templateUseCase(template, factor.activity) });
  const editable = mode === 'edit' && parameters.some((parameter) => parameter.editable);
  const submit = () => save({ ...factor, name: meta.name, value: meta.value, unit: meta.unit, source: meta.source, version: meta.year, geo: meta.organization, reference: meta.remark, scope: 'enterprise', quality: '企业参数覆盖', approval: '待审核', parameters });
  return <Dialog title={`${factor.factorObject ?? factor.name} · ${mode === 'edit' ? '编辑企业因子' : '详情'}`} className={styles.factorDetailDialog} onClose={close} footer={<><Button onClick={close}>{mode === 'edit' ? '取消' : '关闭'}</Button>{mode === 'edit' && <Button primary disabled={!editable} onClick={submit}>保存企业参数</Button>}</>}>
    <UnifiedFactorSections template={template} mode={mode} parameters={parameters} setParameters={setParameters} meta={meta} setMeta={setMeta} onParametersChange={onParametersChange} />
    {mode === 'edit' && !editable && <div className={styles.infoBox}>当前记录没有可编辑参数；公共电力、热力等因子应使用主管部门发布值。</div>}
  </Dialog>;
}

function HistoryDrawer({ history, close }: { history: { version: number; time: string; total: number; count: number }[]; close: () => void }) {
  return <Drawer title="核算清单更新记录" onClose={close} footer={<Button onClick={close}>关闭</Button>}><div className={styles.infoBox}>页面仅展示当前状态和变更摘要；系统后台保留完整的更新记录和数据快照。</div><div className={styles.versionList}>{history.length ? history.map((item, index) => <div className={index === 0 ? styles.currentVersion : ''} key={item.version}><strong>正式清单</strong><span><b>{index === 0 ? '当前正式清单' : '历史正式清单'}</b><small>确认时间：{item.time}｜确认人：管理员</small><small>排放源 {item.count} 项｜排放总量 {format(item.total)} tCO₂e</small></span><Tag tone={index === 0 ? 'green' : 'gray'}>{index === 0 ? '当前' : '历史'}</Tag></div>) : <p className={styles.note}>尚未生成正式清单。</p>}</div></Drawer>;
}

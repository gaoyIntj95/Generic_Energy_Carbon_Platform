import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { PlatformPage } from '../pages/PlatformPage';

export type NavItem = { label: string; path: string; description: string };
export type NavSection = { label: string; key: string; items: NavItem[] };
export type NavDisplayEntry = NavItem | NavSection;
export type NavGroup = {
  label: string;
  key: string;
  items: NavItem[];
  display?: NavDisplayEntry[];
};

const dataManagementItems: NavItem[] = [
  { label: '用能单元管理', path: '/data-management/units', description: '配置企业用能单元及上下级关系，用于能源数据归属、查询与分析。' },
  { label: '能源品种', path: '/data-management/energy-types', description: '管理企业实际使用的能源品种、计量单位及默认折标参数。' },
  { label: '能源量数据', path: '/data-management/energy-consumption', description: '按数据角色和组织层级录入能源量数据，系统自动形成输入、分配、利用和外部输出。' },
  { label: '能源成本', path: '/data-management/energy-costs', description: '按能源品种录入月度成本，并自动汇总年度成本。' },
  { label: '能源转换关系', path: '/data-management/energy-relations', description: '配置锅炉、余热发电、自发电等真实能源转换关系。' },
  { label: '运营数据', path: '/data-management/operations', description: '录入产量、业务量和经济指标，支撑能耗强度、能效对标与预算分析。' },
  { label: '重点设备', path: '/data-management/devices', description: '维护重点设备基础档案及其用能归属，为后续设备级分析提供基础。' },
];

const energyAnalysisItems: NavItem[] = [
  { label: '能耗查询', path: '/energy-analysis/consumption-query', description: '查询和分析能源消费数据，掌握能耗趋势与能源结构。' },
  { label: '能耗强度指标', path: '/energy-analysis/intensity', description: '基于能源消费数据与运营数据自动计算能耗强度指标，支持查看指标结果及数据来源。' },
  { label: '能效对标', path: '/energy-analysis/benchmarking', description: '将实际能效指标与目标值进行对比，识别未达标对象，支撑节能管理。' },
  { label: '能流分析', path: '/energy-analysis/flow-analysis', description: '通过桑基图和能源平衡表，对能源输入、转换、分配、利用及外部输出进行管理口径分析。' },
];

const carbonAccountingItems: NavItem[] = [
  { label: '碳排放预览', path: '/carbon-accounting/preview', description: '查看当前核算任务的碳排放结果、构成与趋势。' },
  { label: '碳核算清单', path: '/carbon-accounting/inventory', description: '维护核算边界、排放源活动数据与排放结果。' },
  { label: '碳核查支撑', path: '/carbon-accounting/support', description: '维护核算基础材料和排放源支撑材料。' },
  { label: '碳排报告', path: '/carbon-accounting/report', description: '按原型保留碳排报告入口与一期范围说明。' },
  { label: '碳因子与参数库', path: '/carbon-accounting/factors', description: '管理综合因子、基础参数、参数组、企业实测值和历史版本。' },
];

const assetStrategyItems: NavItem[] = [
  { label: '能效平衡与优化', path: '/asset-strategy/balance', description: '基于能源输入、终端利用、回收利用和外部输出识别平衡偏差，支撑能效优化。' },
  { label: '用能分析与策略推荐', path: '/asset-strategy/analysis', description: '基于用能数据，分析能源消费结构、成本结构和能效表现，识别重点用能单元并提供策略建议。' },
  { label: '用能与碳排放预算管理', path: '/asset-strategy/budget', description: '对一个时间周期内的能源消费和碳排放进行分析预测，实现预算目标、执行监控、预测预警和动态调整。' },
  { label: '碳资产管理', path: '/asset-strategy/assets', description: '实现对碳配额、CCER等碳资产的分析展示，支持履约周期资产录入、新周期配额测算及配额使用预测预警。' },
];

export const navigation: NavGroup[] = [
  { key: 'energy-analysis', label: '能源监测与分析', items: energyAnalysisItems },
  {
    key: 'carbon-accounting',
    label: '碳排核算与合规',
    items: carbonAccountingItems,
    display: [
      { key: 'carbon-calculation', label: '碳排放核算', items: carbonAccountingItems.slice(0, 4) },
      carbonAccountingItems[4],
      { key: 'supply-chain-carbon', label: '供应链碳管理', items: [] },
    ],
  },
  { key: 'asset-strategy', label: '能碳资产运营与策略', items: assetStrategyItems },
  {
    key: 'data-management',
    label: '数据管理',
    items: dataManagementItems,
    display: [
      dataManagementItems[0],
      dataManagementItems[1],
      { key: 'energy-data', label: '能源数据', items: dataManagementItems.slice(2, 5) },
      dataManagementItems[5],
      dataManagementItems[6],
    ],
  },
];

export const allNavItems = navigation.flatMap((group) => group.items);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to={allNavItems[0].path} replace /> },
      ...allNavItems.map((item) => ({ path: item.path.slice(1), element: <PlatformPage /> })),
      { path: 'data-collection/energy-carbon', element: <Navigate to="/data-management/units" replace /> },
      { path: '*', element: <Navigate to={allNavItems[0].path} replace /> },
    ],
  },
]);

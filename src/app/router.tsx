import { createBrowserRouter, createHashRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { PlatformPage } from '../pages/PlatformPage';

export type NavItem = { label: string; path: string; description: string; pageTitle?: string };
export type NavPlaceholder = { label: string; key: string; description: string; planned: true; badge: string };
export type NavSection = { label: string; key: string; items: Array<NavItem | NavPlaceholder> };
export type NavDisplayEntry = NavItem | NavSection | NavPlaceholder;
export type NavGroup = {
  label: string;
  key: string;
  items: NavItem[];
  display?: NavDisplayEntry[];
};

const dataManagementItems: NavItem[] = [
  { label: '用能单元', pageTitle: '用能单元管理', path: '/data-management/units', description: '配置企业用能单元及上下级关系，用于能源数据归属、查询与分析。' },
  { label: '能源品种', path: '/data-management/energy-types', description: '管理企业实际使用的能源品种、计量单位及默认折标参数。' },
  { label: '重点设备', path: '/data-management/devices', description: '维护重点设备基础档案及其用能归属，为后续设备级分析提供基础。' },
  { label: '能源数据', path: '/data-management/energy-data', description: '按企业及用能单元层级维护能源量和能源成本；锅炉、余热发电、自发电、回收利用及外供统一在能源转换与输出中维护。' },
  { label: '运营数据', path: '/data-management/operations', description: '录入产品产量和经济指标，支撑能耗强度、能效对标与预算分析。' },
];

const energyAnalysisItems: NavItem[] = [
  { label: '能耗查询', path: '/energy-analysis/consumption-query', description: '查询和分析能源消费数据，掌握能耗趋势与能源结构。' },
  { label: '能耗指标', path: '/energy-analysis/intensity', description: '基于能源消费数据、产品产量及经济指标自动计算典型能耗指标，支持查看结果、计算口径及数据来源。' },
  { label: '能效对标', path: '/energy-analysis/benchmarking', description: '将实际能效指标与目标值进行对比，识别未达标对象，支撑节能管理。' },
  { label: '能流分析', path: '/energy-analysis/flow-analysis', description: '通过桑基图、能源平衡表和流向明细，分析企业能源输入、转换及一级分配。' },
];

const carbonAccountingItems: NavItem[] = [
  { label: '碳排放预览', path: '/carbon-accounting/preview', description: '查看当前核算任务的碳排放结果、构成与趋势。' },
  { label: '碳核算清单', path: '/carbon-accounting/inventory', description: '按排放类别维护排放源活动数据、计算参数与排放结果。' },
  { label: '碳核查支撑', path: '/carbon-accounting/support', description: '维护核算基础材料和排放源支撑材料。' },
  { label: '碳排放报告', path: '/carbon-accounting/report', description: '基于正式核算清单生成企业温室气体排放报告，并导出报告及核查凭证资料。' },
  { label: '碳因子参数', path: '/carbon-accounting/factors', description: '管理综合因子、基础参数、参数组、企业实测值和历史版本。' },
];

const carbonFootprintPlanning: NavPlaceholder = {
  key: 'carbon-footprint-accounting',
  label: '碳足迹核算',
  description: '产品碳足迹核算能力规划入口，当前版本暂不开发。',
  planned: true,
  badge: '规划中',
};

const supplyChainPlanning: NavPlaceholder = {
  key: 'supply-chain-carbon',
  label: '供应链碳管理',
  description: '供应链碳管理能力规划入口，当前版本暂不开发。',
  planned: true,
  badge: '规划中',
};

const assetStrategyItems: NavItem[] = [
  { label: '能源平衡与优化', path: '/asset-strategy/balance', description: '综合能源输入、终端利用、回收利用与外部输出，识别重点偏差对象并提供优化建议。' },
  { label: '用能分析与策略推荐', path: '/asset-strategy/analysis', description: '基于用能数据，分析能源消费结构、成本结构和能效表现，识别重点用能单元并提供策略建议。' },
  { label: '用能与碳排放预算管理', path: '/asset-strategy/budget', description: '对一个时间周期内的能源消费和碳排放进行分析预测，实现预算目标、执行监控、预测预警和动态调整。' },
  { label: '碳资产管理', path: '/asset-strategy/assets', description: '支持履约周期资产管理、未来排放预测及履约风险预警。' },
];

export const navigation: NavGroup[] = [
  { key: 'energy-analysis', label: '能源监测与分析', items: energyAnalysisItems },
  {
    key: 'carbon-accounting',
    label: '碳排放核算与合规',
    items: carbonAccountingItems,
    display: [
      {
        key: 'carbon-calculation',
        label: '碳排放核算',
        items: [
          carbonAccountingItems[0],
          carbonAccountingItems[1],
          carbonAccountingItems[2],
          carbonAccountingItems[3],
        ],
      },
      carbonAccountingItems[4],
      supplyChainPlanning,
      carbonFootprintPlanning,
    ],
  },
  { key: 'asset-strategy', label: '能碳资产运营与策略', items: assetStrategyItems },
  {
    key: 'data-management',
    label: '数据管理',
    items: dataManagementItems,
    display: dataManagementItems,
  },
];

export const allNavItems = navigation.flatMap((group) => group.items);

// GitHub Pages cannot rewrite arbitrary application paths back to index.html.
// Keep clean browser routes during local development and use hash routes for
// the production static build so refreshes and deep links remain available.
const createAppRouter = import.meta.env.PROD ? createHashRouter : createBrowserRouter;

export const router = createAppRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to={allNavItems[0].path} replace /> },
      ...allNavItems.map((item) => ({ path: item.path.slice(1), element: <PlatformPage /> })),
      { path: 'data-management/energy-consumption', element: <Navigate to="/data-management/energy-data" replace /> },
      { path: 'data-management/energy-costs', element: <Navigate to="/data-management/energy-data?tab=costs" replace /> },
      { path: 'data-management/energy-relations', element: <Navigate to="/data-management/energy-data?tab=conversion" replace /> },
      { path: 'data-collection/energy-carbon', element: <Navigate to="/data-management/units" replace /> },
      { path: '*', element: <Navigate to={allNavItems[0].path} replace /> },
    ],
  },
]);

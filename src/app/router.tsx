import { createBrowserRouter, createHashRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { PlatformPage } from '../pages/PlatformPage';

export type NavItem = { label: string; path: string; description: string; pageTitle?: string; disabled?: boolean };
export type NavPlaceholder = { label: string; key: string; description: string; planned: true; badge: string };
export type NavSection = { label: string; key: string; items: Array<NavItem | NavPlaceholder> };
export type NavDisplayEntry = NavItem | NavSection | NavPlaceholder;
export type NavGroup = {
  label: string;
  key: string;
  items: NavItem[];
  display?: NavDisplayEntry[];
};

export function navItemMatches(item: NavItem, pathname: string, search: string) {
  const [itemPath, itemQuery] = item.path.split('?');
  if (itemPath !== pathname) return false;
  const currentParams = new URLSearchParams(search);
  if (!itemQuery) return !currentParams.has('tab');
  const expectedParams = new URLSearchParams(itemQuery);
  return [...expectedParams.entries()].every(([key, value]) => currentParams.get(key) === value);
}

const dataManagementItems: NavItem[] = [
  { label: '能源品种', path: '/data-management/energy-types', description: '管理企业实际使用的能源品种、计量单位及默认折标参数。' },
  { label: '用能单元', pageTitle: '用能单元管理', path: '/data-management/units', description: '配置企业用能单元及上下级关系，用于能源数据归属、查询与分析。' },
  { label: '重点设备', path: '/data-management/devices', description: '维护重点设备基础档案及其用能归属，为后续设备级分析提供基础。' },
  { label: '设备产出数据', path: '/data-management/device-output', description: '自动继承全部重点设备，优先展示已有产出；缺失数据可在此按月或按年度补录。' },
      { label: '能源数据', path: '/data-management/energy-data', description: '按企业及用能单元层级维护能源消费、能源转换和能源成本数据。' },
  { label: '运营数据', path: '/data-management/operations', description: '录入产品产量和经济指标，支撑能耗强度、能效对标与预算分析。' },
];

const energyAnalysisItems: NavItem[] = [
  { label: '能耗查询', path: '/energy-analysis/consumption-query', description: '查询和分析能源消费数据，掌握能耗趋势与能源结构。' },
  { label: '能耗指标', path: '/energy-analysis/intensity', description: '基于能源消费数据、产品产量及经济指标自动计算典型能耗指标，支持查看结果、计算口径及数据来源。' },
  { label: '能效对标', path: '/energy-analysis/benchmarking', description: '将实际能效指标与目标值进行对比，识别未达标对象，支撑节能管理。' },
  { label: '能流分析', path: '/energy-analysis/flow-analysis', description: '通过桑基图和能源平衡表，分析企业能源输入、转换及一级分配。' },
];

const carbonAccountingItems: NavItem[] = [
  { label: '碳排放预览', path: '/carbon-accounting/preview', description: '查看当前核算任务的碳排放结果、构成与趋势。' },
  { label: '碳核算清单', path: '/carbon-accounting/inventory', description: '按排放类别维护排放源活动数据、计算参数与排放结果。' },
  { label: '碳核查支撑', path: '/carbon-accounting/support', description: '维护核算基础材料和排放源证明材料。' },
  { label: '碳排放报告', path: '/carbon-accounting/report', description: '基于正式核算清单生成企业温室气体排放报告，并导出报告及核查凭证资料。' },
  { label: '碳排放因子库', path: '/carbon-accounting/factors', description: '按排放源类别和行业企业类别管理碳排放因子及参数。' },
];

const productCarbonFootprintItems: NavItem[] = [
  { label: '碳足迹项目管理', pageTitle: '产品碳足迹项目', path: '/product-carbon-footprint/projects', description: '以产品项目为中心管理生命周期模型、活动数据、核算结果和报告。' },
  { label: '碳足迹核算清单', pageTitle: '碳足迹核算清单', path: '/product-carbon-footprint/activity', description: '按生命周期过程维护活动数据、排放因子和单位产品排放结果。' },
  { label: '碳足迹核算结果', pageTitle: '产品碳足迹核算结果', path: '/product-carbon-footprint/results', description: '按产品查看单位碳足迹、生命周期贡献和主要排放来源。' },
  { label: '碳足迹报告管理', pageTitle: '产品碳足迹报告', path: '/product-carbon-footprint/reports', description: '生成、预览和下载产品碳足迹量化报告。' },
  { label: '碳足迹因子库', path: '/product-carbon-footprint/factors', description: '维护产品碳足迹核算所用的排放因子与数据来源。' },
];

const supplyChainCarbonItems: NavItem[] = [
  { label: '供应商碳数据采集', pageTitle: '供应链碳管理', path: '/supply-chain-carbon/suppliers', description: '采集并维护供应商提供的材料/产品碳数据、业务数据及证明材料。' },
  { label: '产品碳足迹披露', pageTitle: '供应链碳管理', path: '/supply-chain-carbon/delivery', description: '登记产品碳足迹报告向下游客户的对外披露情况。' },
];

const assetStrategyItems: NavItem[] = [
  { label: '能效平衡与优化', path: '/asset-strategy/balance', description: '基于能源流向、能效指标和异常诊断结果，识别能源管理问题并辅助发现优化机会。' },
  { label: '用能分析与策略推荐', path: '/asset-strategy/analysis', description: '基于用能数据，分析能源消费结构、成本结构和能效表现，识别重点用能单元并提供策略建议。' },
  { label: '用能与碳排放预算管理', path: '/asset-strategy/budget', description: '对一个时间周期内的能源消费和碳排放进行分析预测，实现预算目标、执行监控、预测预警和动态调整。' },
  { label: '碳资产管理', path: '/asset-strategy/assets', description: '支持履约周期资产管理、未来排放预测及履约风险预警。' },
];

export const navigation: NavGroup[] = [
  { key: 'energy-analysis', label: '能源监测与分析', items: energyAnalysisItems },
  {
    key: 'carbon-accounting',
    label: '碳排放核算与合规',
    items: [...carbonAccountingItems, ...productCarbonFootprintItems, ...supplyChainCarbonItems],
    display: [
      {
        key: 'carbon-calculation',
        label: '碳排放核算',
        items: [
          carbonAccountingItems[0],
          carbonAccountingItems[1],
          carbonAccountingItems[2],
          carbonAccountingItems[3],
          carbonAccountingItems[4],
        ],
      },
      { key: 'supply-chain-carbon', label: '供应链碳管理', items: supplyChainCarbonItems },
      { key: 'product-carbon-footprint', label: '产品碳足迹', items: productCarbonFootprintItems },
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
      dataManagementItems[2],
      dataManagementItems[3],
      {
        key: 'energy-data-submenu',
        label: '能源数据',
        items: [
          { ...dataManagementItems[4], label: '能源消费', path: '/data-management/energy-data' },
          { ...dataManagementItems[4], label: '能源成本', path: '/data-management/energy-data?tab=costs' },
          { ...dataManagementItems[4], label: '能源转换回收与外供', path: '/data-management/energy-data?tab=recovery' },
        ],
      },
      dataManagementItems[5],
    ],
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
      { path: 'product-carbon-footprint/projects/:projectId', element: <PlatformPage /> },
      { path: 'data-management/energy-consumption', element: <Navigate to="/data-management/energy-data" replace /> },
      { path: 'data-management/energy-costs', element: <Navigate to="/data-management/energy-data?tab=costs" replace /> },
      { path: 'data-management/energy-relations', element: <Navigate to="/data-management/energy-data?tab=conversion" replace /> },
      { path: 'data-collection/energy-carbon', element: <Navigate to="/data-management/units" replace /> },
      { path: 'energy-analysis/efficiency-optimization', element: <Navigate to="/asset-strategy/balance" replace /> },
      { path: '*', element: <Navigate to={allNavItems[0].path} replace /> },
    ],
  },
]);

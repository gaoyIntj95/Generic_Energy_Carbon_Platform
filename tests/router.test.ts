import { describe, expect, it } from 'vitest';
import { allNavItems, navigation, navItemMatches, type NavItem } from '../src/app/router';

describe('navigation manifest', () => {
  it('contains every confirmed page as a unique route', () => {
    expect(allNavItems).toHaveLength(26);
    expect(new Set(allNavItems.map((item) => item.path)).size).toBe(26);
    expect(navigation.map((group) => group.label)).toEqual([
      '能源监测与分析',
      '企业组织碳管理',
      '产品与供应链碳管理',
      '能碳资产运营与策略',
      '数据管理',
    ]);
    expect(allNavItems.map((item) => item.label)).toEqual(expect.arrayContaining([
      '能耗指标',
      '碳排放因子库',
      '用能与碳排放预算管理',
      '用能单元',
      '能源数据',
      '重点设备',
      '设备产出数据',
      '碳足迹核算清单',
    ]));
    expect(allNavItems.some((item) => item.label === '能碳数据采集')).toBe(false);
    expect(navigation.find((group) => group.key === 'data-management')?.items.map((item) => item.label)).toEqual([
      '能源品种',
      '用能单元',
      '重点设备',
      '设备产出数据',
      '能源数据',
      '运营数据',
    ]);
    const enterpriseCarbon = navigation.find((group) => group.key === 'enterprise-carbon');
    expect(enterpriseCarbon?.display?.map((entry) => entry.label)).toEqual([
      '碳排放概览',
      '碳核算清单',
      '碳核查支撑',
      '碳排放报告',
      '碳排放因子库',
    ]);
    const productSupplyCarbon = navigation.find((group) => group.key === 'product-supply-carbon')?.display;
    expect(productSupplyCarbon?.map((entry) => entry.label)).toEqual([
      '供应链碳管理',
      '产品碳足迹',
    ]);
    const supplyChain = productSupplyCarbon?.find((entry) => entry.key === 'supply-chain-carbon');
    expect(supplyChain && 'items' in supplyChain ? supplyChain.items.map((item) => item.label) : []).toEqual([
      '供应商碳数据采集',
      '碳数据披露',
    ]);
    expect(productSupplyCarbon?.filter((entry) => 'items' in entry).map((entry) => entry.key)).toEqual([
      'supply-chain-carbon',
      'product-carbon-footprint',
    ]);
    const productFootprint = productSupplyCarbon?.find((entry) => entry.key === 'product-carbon-footprint');
    expect(productFootprint && 'items' in productFootprint ? productFootprint.items.map((item) => item.label) : []).toEqual([
      '碳足迹项目管理',
      '碳足迹核算清单',
      '碳足迹核算结果',
      '碳足迹报告管理',
      '碳足迹因子库',
    ]);
  });

  it('distinguishes energy data submenu entries by query string', () => {
    const energySubmenu = navigation
      .find((group) => group.key === 'data-management')?.display
      ?.find((entry) => 'items' in entry && entry.key === 'energy-data-submenu');
    const items = energySubmenu && 'items' in energySubmenu ? energySubmenu.items as NavItem[] : [];

    expect(navItemMatches(items[0], '/data-management/energy-data', '')).toBe(true);
    expect(navItemMatches(items[0], '/data-management/energy-data', '?year=2026&scope=enterprise')).toBe(true);
    expect(navItemMatches(items[0], '/data-management/energy-data', '?tab=costs')).toBe(false);
    expect(navItemMatches(items[1], '/data-management/energy-data', '?tab=costs')).toBe(true);
    expect(navItemMatches(items[1], '/data-management/energy-data', '?tab=costs&year=2026')).toBe(true);
    expect(navItemMatches(items[2], '/data-management/energy-data', '?tab=recovery')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { allNavItems, navigation, navItemMatches, type NavItem } from '../src/app/router';

describe('navigation manifest', () => {
  it('contains every confirmed page as a unique route', () => {
    expect(allNavItems).toHaveLength(26);
    expect(new Set(allNavItems.map((item) => item.path)).size).toBe(26);
    expect(navigation.map((group) => group.label)).toEqual([
      '能源监测与分析',
      '碳排放核算与合规',
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
    ]));
    expect(allNavItems.some((item) => item.label === '能碳数据采集')).toBe(false);
    expect(navigation.find((group) => group.key === 'data-management')?.items.map((item) => item.label)).toEqual([
      '用能单元',
      '能源品种',
      '重点设备',
      '设备产出数据',
      '能源数据',
      '运营数据',
    ]);
    const carbonDisplay = navigation.find((group) => group.key === 'carbon-accounting')?.display;
    const carbonCalculation = carbonDisplay?.find((entry) => 'items' in entry);
    expect(carbonCalculation && 'items' in carbonCalculation
      ? carbonCalculation.items.map((item) => item.label)
      : []).toEqual([
      '碳排放预览',
      '碳核算清单',
      '碳核查支撑',
      '碳排放报告',
      '碳排放因子库',
    ]);
    expect(carbonDisplay?.map((entry) => entry.label)).toEqual([
      '碳排放核算',
      '供应链碳管理',
      '产品碳足迹',
    ]);
    expect(carbonDisplay?.some((entry) => entry.label === '碳排放因子库')).toBe(false);
    const supplyChain = carbonDisplay?.find((entry) => entry.key === 'supply-chain-carbon');
    expect(supplyChain && 'items' in supplyChain ? supplyChain.items.map((item) => item.label) : []).toEqual([
      '上游供应商碳数据',
      '下游产品碳足迹交付',
    ]);
    expect(carbonDisplay?.filter((entry) => 'items' in entry).map((entry) => entry.key)).toEqual([
      'carbon-calculation',
      'supply-chain-carbon',
      'product-carbon-footprint',
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

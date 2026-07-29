import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  listV11EnergyCosts,
  listV11EnergyRecords,
  listV11EnergyTypes,
  resetDataManagementV11Store,
  saveV11EnergyCost,
  saveV11EnergyRecord,
} from '../src/mocks/dataManagementV11Store';
import { DataManagementV11 } from '../src/pages/newPrototype/DataManagementV11';

let container: HTMLDivElement;
let root: Root;

function button(text: string) {
  const result = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text));
  if (!result) throw new Error(`未找到按钮：${text}`);
  return result as HTMLButtonElement;
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

async function render(pathname: string) {
  await act(async () => root.render(
    <MemoryRouter initialEntries={[pathname]}>
      <DataManagementV11 pathname={pathname} />
    </MemoryRouter>,
  ));
}

describe('DataManagementV11 fidelity and data behavior', () => {
  beforeEach(() => {
    resetDataManagementV11Store();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders the V11 energy type columns without prototype-external state fields', async () => {
    await render('/data-management/energy-types');
    const headers = [...container.querySelectorAll('th')].map((item) => item.textContent);
    expect(headers).toEqual(['分析类别', '能源品种', '计量单位', '折标系数', '折标单位', '操作']);
    expect(container.textContent).toContain('压缩空气');
    expect(container.textContent).not.toContain('参数来源');
    expect(container.textContent).not.toContain('启用');
  });

  it('switches energy roles and exposes monthly details inline', async () => {
    await render('/data-management/energy-consumption');
    expect(container.textContent).toContain('能源输入 / 能源分配 / 能源利用');
    expect(container.textContent).toContain('52,350,000');

    await click(button('回收能源'));
    expect(container.textContent).toContain('余热发电系统');
    expect(container.textContent).toContain('能源回收');

    await click(button('查看'));
    expect(container.textContent).toContain('月度明细');
    expect(container.textContent).toContain('6,200');
  });

  it('keeps V11 records centrally mutable with stable IDs and monthly values', () => {
    const originalTypeCount = listV11EnergyTypes().length;
    const originalRecordCount = listV11EnergyRecords().length;
    const originalCostCount = listV11EnergyCosts().length;
    const typeId = listV11EnergyTypes()[0].energyTypeId;

    const recordResult = saveV11EnergyRecord({
      year: 2025,
      energyRole: '能源消费',
      scopeLevel: '企业',
      energyUnitId: null,
      energyTypeId: typeId,
      entryMode: 'annual',
      monthlyAmounts: [],
      annualAmount: 100,
    });
    const costResult = saveV11EnergyCost({
      year: 2025,
      energyTypeId: typeId,
      monthlyCosts: Array(12).fill(10),
    });

    expect(recordResult.ok).toBe(true);
    expect(costResult.ok).toBe(true);
    expect(listV11EnergyRecords()).toHaveLength(originalRecordCount + 1);
    expect(listV11EnergyCosts()).toHaveLength(originalCostCount + 1);
    expect(listV11EnergyTypes()).toHaveLength(originalTypeCount);
    expect(listV11EnergyRecords().at(-1)?.energyRecordId).toMatch(/^v11-er-/);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { resetDataManagementV11Store } from '../src/mocks/dataManagementV11Store';
import { buildFlowAnalysisDataset, selectFlowRelations, buildFlowViewTables, type FlowAnalysisDataset, type FlowDetailRow, type FlowLink, type FlowNode } from '../src/mocks/energyFlowSelector';

const period = { year: 2026, grain: 'month' as const, month: 6 };
const node = (nodeId: string, stage: FlowNode['stage']): FlowNode => ({ nodeId, stage, name: nodeId, valueLabel: '10 tce', standardCoalAmount: 10, nodeType: stage, share: 10 });
const link = (linkId: string, sourceNodeId: string, targetNodeId: string, flowType?: FlowLink['flowType']): FlowLink => ({ linkId, sourceNodeId, targetNodeId, standardCoalAmount: 10, flowType });
const detail = (edge: FlowLink): FlowDetailRow => ({ flowDetailId: edge.linkId, stage: '能源分配', source: edge.sourceNodeId, target: edge.targetNodeId, energyTypeName: '电力', amount: 10, amountUnit: 'tce', standardCoalAmount: 10, energyUnitName: '全厂', sourceRecordIds: [], traceDescription: '', traceRecords: [], abnormal: false, relatedNodeIds: [edge.sourceNodeId, edge.targetNodeId], relatedLinkIds: [edge.linkId] });
function fixture(): Pick<FlowAnalysisDataset, 'nodes' | 'links' | 'detailRows'> {
  const nodes = [node('input', 'input'), node('other-input', 'input'), node('pool', 'medium'), node('other-pool', 'medium'), node('unit', 'distribution'), node('other-unit', 'distribution'), node('recovery', 'recovery'), node('external', 'external'), node('unallocated', 'unallocated')];
  const links = [link('input-pool', 'input', 'pool'), link('other-input-pool', 'other-input', 'other-pool'), link('pool-unit', 'pool', 'unit'), link('other-pool-unit', 'other-pool', 'unit'), link('pool-other-unit', 'pool', 'other-unit'), link('unit-recovery', 'unit', 'recovery', 'recovery_input'), link('recovery-pool', 'recovery', 'pool', 'recovery_output'), link('pool-external', 'pool', 'external'), link('pool-unallocated', 'pool', 'unallocated')];
  return { nodes, links, detailRows: links.map(detail) };
}
const ids = (data: ReturnType<typeof selectFlowRelations>) => data.links.map((edge) => edge.linkId).sort();

describe('node-focused energy flow relations', () => {
  beforeEach(() => resetDataManagementV11Store());

  it('keeps input downstream paths without expanding a consuming unit into other energy types or recovery', () => {
    const result = selectFlowRelations(fixture(), 'input');
    expect(ids(result)).toEqual(['input-pool', 'pool-external', 'pool-other-unit', 'pool-unallocated', 'pool-unit']);
    expect(result.nodes.some((item) => item.nodeId === 'other-pool')).toBe(false);
  });

  it('traces a unit in both directions and stops its return at the energy pool', () => {
    const result = selectFlowRelations(fixture(), 'unit');
    expect(ids(result)).toEqual(['input-pool', 'other-input-pool', 'other-pool-unit', 'pool-unit', 'recovery-pool', 'unit-recovery']);
    expect(result.nodes.map((item) => item.nodeId)).not.toContain('other-unit');
    expect(result.nodes.map((item) => item.nodeId)).not.toContain('external');
    expect(result.detailRows.map((row) => row.flowDetailId).sort()).toEqual(ids(result));
  });

  it('shows only the registered recovery source and return, without inferring redistribution', () => {
    expect(ids(selectFlowRelations(fixture(), 'recovery'))).toEqual(['recovery-pool', 'unit-recovery']);
  });

  it('excludes sibling branches for an external terminal even when they share an upstream pool', () => {
    const result = selectFlowRelations(fixture(), 'external');
    expect(ids(result)).toEqual(['input-pool', 'pool-external', 'recovery-pool', 'unit-recovery']);
    expect(result.detailRows.some((row) => row.flowDetailId === 'pool-unit')).toBe(false);
  });

  it('filters zero/dangling edges, handles cycles and invalid selections, and leaves source amounts unchanged', () => {
    const data = fixture();
    data.links.push({ ...link('zero', 'pool', 'other-unit'), standardCoalAmount: 0 }, link('dangling', 'pool', 'missing'));
    const before = structuredClone(data);
    const result = selectFlowRelations(data, 'pool', false);
    expect(result.nodes.some((item) => item.stage === 'external')).toBe(false);
    expect(ids(result)).not.toContain('pool-external');
    expect(ids(result)).not.toContain('zero');
    expect(ids(result)).not.toContain('dangling');
    expect(data).toEqual(before);
    expect(selectFlowRelations(data, 'missing').nodes).toEqual(data.nodes);
    expect(selectFlowRelations({ nodes: [], links: [], detailRows: [] }, 'pool')).toEqual({ nodes: [], links: [], detailRows: [] });
  });

  it('keeps parallel registered links and their individual detail rows', () => {
    const data = fixture();
    const extra = link('pool-unit-second-record', 'pool', 'unit');
    data.links.push(extra); data.detailRows.push(detail(extra));
    const result = selectFlowRelations(data, 'unit');
    expect(ids(result)).toContain('pool-unit-second-record');
    expect(result.detailRows.some((row) => row.flowDetailId === extra.linkId)).toBe(true);
  });

  it('restricts actual office allocation records to office flows while preserving registered upstream sources', () => {
    const data = buildFlowAnalysisDataset(period, 'level1');
    const office = data.nodes.find((item) => item.name === '办公区域')!;
    const result = selectFlowRelations(data, office.nodeId);
    expect(result.links.length).toBeGreaterThan(0);
    expect(result.links.length).toBeLessThan(data.links.length);
    expect(result.detailRows.filter((row) => row.stage === '能源分配').every((row) => row.target === office.name)).toBe(true);
    expect(result.detailRows.some((row) => row.stage === '能源输入')).toBe(true);
    expect(result.nodes.find((item) => item.nodeId === office.nodeId)?.standardCoalAmount).toBe(office.standardCoalAmount);
    expect(result.nodes.some((item) => item.name === '厂内RDF')).toBe(false);
  });

  it('maps every positive real level-one flow to a source detail and restricts details to displayed links', () => {
    const data = buildFlowAnalysisDataset(period, 'level1');
    for (const edge of data.links.filter((item) => item.standardCoalAmount > 0)) {
      expect(data.detailRows.some((row) => row.relatedLinkIds.includes(edge.linkId)), edge.linkId).toBe(true);
    }
    for (const selected of data.nodes) {
      const result = selectFlowRelations(data, selected.nodeId);
      const linkIds = new Set(result.links.map((edge) => edge.linkId));
      expect(result.detailRows.every((row) => row.relatedLinkIds.some((id) => linkIds.has(id))), selected.name).toBe(true);
      expect(result.links.every((edge) => result.nodes.some((item) => item.nodeId === edge.sourceNodeId) && result.nodes.some((item) => item.nodeId === edge.targetNodeId))).toBe(true);
    }
  });
});

describe('energy flow tab data follows displayed relations', () => {
  beforeEach(() => resetDataManagementV11Store());

  it('separates pressure recovery input and output with their own energy types and amounts', () => {
    const data = buildFlowAnalysisDataset(period, 'level1');
    const recovery = data.nodes.find((node) => node.name === '余压回收系统')!;
    const view = selectFlowRelations(data, recovery.nodeId);
    const tables = buildFlowViewTables(data, view);
    expect(tables.balanceRows).toHaveLength(3);
    expect(tables.detailRows).toHaveLength(2);
    const input = tables.detailRows.find((row) => row.flowStageLabel === '回收投入')!;
    const output = tables.detailRows.find((row) => row.flowStageLabel === '回收回流')!;
    expect(input).toMatchObject({ source: '动力中心', target: '余压回收系统', energyTypeName: '余压' });
    expect(output).toMatchObject({ source: '余压回收系统', target: '厂内压缩空气', energyTypeName: '压缩空气' });
    expect(input.standardCoalAmount).toBeCloseTo(3.5, 1);
    expect(output.standardCoalAmount).toBeCloseTo(2.8, 1);
    const balance = tables.balanceRows.find((row) => row.nodeId === recovery.nodeId)!;
    expect(balance.incoming).toBe(input.standardCoalAmount);
    expect(balance.outgoing).toBe(output.standardCoalAmount);
    expect(balance.difference).toBeCloseTo(input.standardCoalAmount - output.standardCoalAmount);
    expect(tables.balanceRows.find((row) => row.name === '厂内压缩空气')).toMatchObject({ difference: null, note: '部分来源未展开；部分去向未展开' });
  });

  it('does not include unrelated allocations or whole-record amounts in office flow details', () => {
    const data = buildFlowAnalysisDataset(period, 'level1');
    const office = data.nodes.find((node) => node.name === '办公区域')!;
    const view = selectFlowRelations(data, office.nodeId);
    const { detailRows, balanceRows } = buildFlowViewTables(data, view);
    const allocations = detailRows.filter((row) => row.stage === '能源分配');
    expect(allocations.length).toBeGreaterThan(0);
    expect(allocations.every((row) => row.target === '办公区域')).toBe(true);
    expect(balanceRows.find((row) => row.nodeId === office.nodeId)?.incoming).toBeCloseTo(office.standardCoalAmount);
    for (const row of detailRows) {
      expect(row.standardCoalAmount).toBe(view.links.find((link) => link.linkId === row.flowDetailId)?.standardCoalAmount);
    }
  });

  it('keeps both tabs in the visible scope when external branches are hidden, without inventing a loss', () => {
    const data = buildFlowAnalysisDataset(period, 'level1');
    const view = selectFlowRelations(data, '', false);
    const tables = buildFlowViewTables(data, view);
    expect(tables.detailRows.some((row) => row.stage === '外部输出')).toBe(false);
    expect(tables.balanceRows.some((row) => row.nodeType === '外部输出')).toBe(false);
    const electric = tables.balanceRows.find((row) => row.name === '厂内电力')!;
    expect(electric.difference).toBeNull();
    expect(electric.note).toContain('去向未展开');
    const full = buildFlowViewTables(data, selectFlowRelations(data));
    expect(full.detailRows.some((row) => row.stage === '外部输出')).toBe(true);
    expect(full.detailRows).toHaveLength(data.links.filter((link) => link.standardCoalAmount > 0).length);
  });

  it('reconciles every displayed node against its exact detail lines for every focus without mutating the source', () => {
    const data = buildFlowAnalysisDataset(period, 'level1');
    const before = structuredClone(data);
    for (const node of data.nodes) {
      const view = selectFlowRelations(data, node.nodeId);
      const tables = buildFlowViewTables(data, view);
      expect(tables.detailRows).toHaveLength(view.links.length);
      expect(tables.detailRows.every((row) => row.energyTypeName !== '未标明')).toBe(true);
      for (const row of tables.balanceRows) {
        expect(row.incoming).toBeCloseTo(tables.detailRows.filter((detail) => detail.relatedNodeIds[1] === row.nodeId).reduce((sum, detail) => sum + detail.standardCoalAmount, 0));
        expect(row.outgoing).toBeCloseTo(tables.detailRows.filter((detail) => detail.relatedNodeIds[0] === row.nodeId).reduce((sum, detail) => sum + detail.standardCoalAmount, 0));
      }
    }
    expect(data).toEqual(before);
    expect(buildFlowViewTables(data, { nodes: [], links: [] })).toEqual({ balanceRows: [], detailRows: [] });
  });
});

describe('inline physical quantities and coal-equivalent factors', () => {
  beforeEach(() => resetDataManagementV11Store());

  it('uses the current branch quantity with the energy type factor, including kgce and tce units', () => {
    const data = buildFlowAnalysisDataset(period, 'level1');
    const { detailRows } = buildFlowViewTables(data, selectFlowRelations(data));
    expect(detailRows.every((row) => row.calculation)).toBe(true);
    for (const row of detailRows) {
      const calculation = row.calculation!;
      const coalEquivalent = calculation.physicalAmount * calculation.standardCoalFactor
        / (calculation.standardCoalFactorUnit.startsWith('kgce') ? 1000 : 1);
      expect(coalEquivalent).toBeCloseTo(row.standardCoalAmount, 6);
    }
    const electric = detailRows.find((row) => row.energyTypeName === '电力' && row.target === '办公区域')!;
    expect(electric.calculation).toMatchObject({ physicalUnit: 'kWh', standardCoalFactor: .1229, standardCoalFactorUnit: 'kgce/kWh' });
    const coal = detailRows.find((row) => row.energyTypeName === '原煤' && row.flowStageLabel === '转换投入')!;
    expect(coal.calculation).toMatchObject({ physicalUnit: 't', standardCoalFactor: .7143, standardCoalFactorUnit: 'tce/t' });
    expect(coal.calculation!.physicalAmount).toBeCloseTo(168, 1);
    expect(coal.calculation!.physicalAmount).toBeLessThan(coal.traceRecords[0].originalAmount);
  });

  it('keeps recovery input and returned compressed air in their correct physical units', () => {
    const data = buildFlowAnalysisDataset(period, 'level1');
    const recovery = data.nodes.find((node) => node.name === '余压回收系统')!;
    const { detailRows } = buildFlowViewTables(data, selectFlowRelations(data, recovery.nodeId));
    const input = detailRows.find((row) => row.flowStageLabel === '回收投入')!;
    const output = detailRows.find((row) => row.flowStageLabel === '回收回流')!;
    expect(input.calculation).toMatchObject({ physicalUnit: 'tce', standardCoalFactor: 1, standardCoalFactorUnit: 'tce/tce' });
    expect(input.calculation!.physicalAmount).toBeCloseTo(3.5, 1);
    expect(output.calculation).toMatchObject({ physicalUnit: 'Nm³', standardCoalFactor: .04, standardCoalFactorUnit: 'kgce/Nm³' });
    expect(output.calculation!.physicalAmount).toBeCloseTo(70000, 1);
  });

  it('does not fabricate a physical quantity or factor when a link has no calculation basis', () => {
    const data = fixture();
    const tables = buildFlowViewTables(data, data);
    expect(tables.detailRows.every((row) => row.calculation === undefined)).toBe(true);
    expect(tables.detailRows.every((row) => Number.isFinite(row.standardCoalAmount))).toBe(true);
  });
});

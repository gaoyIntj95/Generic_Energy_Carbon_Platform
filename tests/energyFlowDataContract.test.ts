import { beforeEach, describe, expect, it } from 'vitest';
import { listV11ConversionOutputs, listV11ExternalSupplyRecords, resetDataManagementV11Store, saveV11ConversionOutput, saveV11EnergyRecord, saveV11ExternalSupplyRecord } from '../src/mocks/dataManagementV11Store';
import { buildFlowAnalysisDataset } from '../src/mocks/energyFlowSelector';
import { buildEnergyQueryDataset } from '../src/mocks/energyQuerySelector';

describe('energy flow phase-one data contract', () => {
  beforeEach(() => {
    resetDataManagementV11Store();
  });

  it('does not spread annual-only records into a monthly flow', () => {
    const saved = saveV11EnergyRecord({
      year: 2027,
      scopeLevel: '一级用能单元',
      scopeType: 'energyUnit',
      scopeId: 'eu-clinker-line-1',
      energyUnitId: 'eu-clinker-line-1',
      energyRole: '能源消费',
      energyTypeId: 'v11-energy-electricity',
      entryMode: 'annual',
      annualAmount: 120000,
      monthlyAmounts: Array(12).fill(0),
    });
    expect(saved.ok).toBe(true);

    const result = buildFlowAnalysisDataset({ year: 2027, grain: 'month', month: 6 }, 'level1');

    expect(result.nodes).toHaveLength(0);
    expect(result.links).toHaveLength(0);
    expect(result.inputStandardCoalAmount).toBe(0);
    expect(result.dataNotice).toContain('当前月份有');
  });

  it('does not spread manual annual conversion output into a monthly flow', () => {
    const saved = saveV11ConversionOutput({
      year: 2027,
      recordType: '回收利用',
      conversionEnergyUnitId: 'eu-waste-heat-power',
      inputMode: 'recovery',
      recoveryEnergyName: '余热',
      recoveryAmount: 120,
      recoveryUnit: 'GJ',
      outputAnalysisCategory: '电力',
      outputEnergyTypeId: 'v11-energy-electricity',
      outputEnergyName: '电力',
      outputUnit: 'kWh',
      outputAmount: 100,
      internalAmount: 100,
      externalAmount: 0,
      lossAmount: 0,
    });
    expect(saved.ok).toBe(true);

    const result = buildFlowAnalysisDataset({ year: 2027, grain: 'month', month: 6 }, 'level1');

    expect(result.nodes.some((node) => node.stage === 'conversion')).toBe(false);
    expect(result.dataNotice).toContain('没有月度投入数据');
  });

  it('keeps the corrected self-generation source out of same-energy conversion warnings', () => {
    const result = buildFlowAnalysisDataset({ year: 2026, grain: 'year', month: 6 }, 'level1');

    expect(result.dataNotice).not.toContain('同品种转换');
  });

  it('maps monthly boiler and waste-heat conversions into the flow view', () => {
    const result = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level1');
    const conversionNames = result.nodes
      .filter((node) => node.stage === 'conversion')
      .map((node) => node.name);

    expect(conversionNames).toEqual(expect.arrayContaining(['锅炉系统', '余热发电机组', '余热回收利用系统']));
    expect(conversionNames).not.toContain('配电系统');
    expect(result.dataNotice).not.toContain('余热发电没有月度投入数据');
  });

  it('exposes conversion input and output amounts on conversion nodes', () => {
    const result = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level1');
    const conversion = result.nodes.find((node) => node.stage === 'conversion' && node.name === '锅炉系统');

    expect(conversion?.detailLabel).toMatch(/投入 .* tce/);
    expect(conversion?.detailLabelSecondary).toMatch(/产出 .* tce/);
  });
  it('distinguishes internal recovery from enterprise-boundary input', () => {
    const result = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level1');
    const recovery = result.nodes.find((node) => node.nodeId === 'input:v11-energy-waste-heat');

    expect(recovery?.name).toBe('内部回收·余热');
    expect(recovery?.nodeType).toBe('内部回收能源');
  });
  it('rejects conversion external supply that exceeds the output ledger', () => {
    const result = saveV11ExternalSupplyRecord({
      year: 2026,
      conversionOutputId: 'v11-output-200',
      energyTypeId: 'v11-energy-electricity',
      amount: 17_000_000,
      unit: 'kWh',
      receiver: '测试接收方',
      remark: '',
    });

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain('扣除内部使用和损失后的可外供量');
  });
  it('does not double count boiler steam with the downstream allocation ledger', () => {
    const result = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level1');
    const steam = result.levelOneBalanceRows.find((row) => row.energyTypeId === 'v11-energy-steam');

    expect(steam?.distributionAmount).toBe(5450);
    expect(steam?.overAllocatedAmount).toBe(0);
    expect(result.links.some((link) => link.linkId === 'conversion-distribution:v11-output-201')).toBe(false);
  });
  it('closes compressed-air allocation through an electricity conversion source', () => {
    const result = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level1');

    expect(result.nodes.some((node) => node.stage === 'conversion' && node.name === '空压系统')).toBe(true);
    expect(result.dataNotice).not.toContain('压缩空气');
    expect(result.levelOneBalanceRows.find((row) => row.energyTypeId === 'v11-energy-compressed-air')?.overAllocatedAmount).toBe(0);
  });
  it('keeps external supply as an independent ledger linked to conversion output', () => {
    const conversionOutputId = 'v11-output-200';
    expect(listV11ExternalSupplyRecords().some((item) => item.conversionOutputId === conversionOutputId)).toBe(true);
    const saved = saveV11ExternalSupplyRecord({
      year: 2026,
      conversionOutputId,
      energyTypeId: 'v11-energy-electricity',
      amount: 100,
      unit: 'kWh',
      receiver: '测试接收方',
      remark: '',
    });
    expect(saved).toMatchObject({ ok: false });
    if (!saved.ok) expect(saved.error).toContain('扣除内部使用和损失后的可外供量');
  });

  it('keeps annual energy query and flow boundary input on the same reported-period cutoff', () => {
    for (const year of [2026, 2025]) {
      const query = buildEnergyQueryDataset({ year, period: 'year', month: 12 });
      const flow = buildFlowAnalysisDataset({ year, grain: 'year', month: 6 }, 'level1');
      const flowBoundaryInput = flow.levelOneBalanceRows.reduce(
        (total, row) => total + row.externalInputStandardAmount,
        0,
      );

      expect(flowBoundaryInput).toBeCloseTo(query.total, 8);
    }
  });

  it('keeps historical conversion outputs linked to historical energy records', () => {
    const historicalConversions = listV11ConversionOutputs().filter((item) => item.year === 2025);
    expect(historicalConversions).toHaveLength(3);
    expect(historicalConversions.every((item) => item.inputEnergyRecordId?.endsWith('-2025'))).toBe(true);

    const flow = buildFlowAnalysisDataset({ year: 2025, grain: 'year', month: 6 }, 'level1');
    expect(flow.nodes.filter((node) => node.stage === 'conversion').map((node) => node.name))
      .toEqual(expect.arrayContaining(['锅炉系统', '余热发电机组', '余热回收利用系统']));
  });

  it('renders direct enterprise external supply as a flow edge from the energy medium', () => {
    const saved = saveV11ExternalSupplyRecord({
      year: 2026,
      inputEnergyRecordId: 'v11-er-30',
      energyTypeId: 'v11-energy-electricity',
      amount: 120,
      unit: 'kWh',
      monthlyAmounts: Array(12).fill(10),
      receiver: '电网',
      remark: '',
    });
    expect(saved.ok).toBe(true);

    const result = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level1');
    expect(result.nodes.some((node) => node.nodeId === 'external:v11-energy-electricity')).toBe(true);
    if (saved.ok) {
      const directSupply = listV11ExternalSupplyRecords().find((item) => item.receiver === '电网');
      expect(directSupply).toBeDefined();
      expect(result.links.some((link) => link.linkId === `external:direct:${directSupply?.externalSupplyId}`)).toBe(true);
      expect(result.externalStandardCoalAmount).toBeCloseTo(
        result.levelOneBalanceRows.reduce((total, row) => total + row.externalOutputStandardAmount, 0),
        8,
      );
    }
  });

  it('rejects direct external supply sourced from an internal-use-unit record', () => {
    const result = saveV11ExternalSupplyRecord({
      year: 2026,
      inputEnergyRecordId: 'v11-er-36',
      energyTypeId: 'v11-energy-natural-gas',
      amount: 100,
      unit: 'Nm³',
      receiver: '园区用户',
      remark: '',
    });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain('企业级能源输入');
  });

  it('prevents a recovery source from being used by multiple conversion records', () => {
    const result = saveV11ConversionOutput({
      year: 2026,
      recordType: '其他转换',
      conversionEnergyUnitId: 'eu-raw-material',
      inputMode: 'linked',
      inputEnergyRecordId: 'v11-er-49',
      outputAnalysisCategory: '热力',
      outputEnergyTypeId: 'v11-energy-steam',
      outputEnergyName: '蒸汽',
      outputUnit: 'GJ',
      outputAmount: 100,
      internalAmount: 100,
      externalAmount: 0,
      lossAmount: 0,
      outputTargetEnergyUnitId: 'eu-clinker-line-1',
    });

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain('同一回收能源来源');
  });

  it('prevents direct supply from exceeding a source record in aggregate or by month', () => {
    const first = saveV11ExternalSupplyRecord({
      year: 2026,
      inputEnergyRecordId: 'v11-er-30',
      energyTypeId: 'v11-energy-electricity',
      amount: 12_710_000,
      unit: 'kWh',
      monthlyAmounts: [12_710_000, ...Array(11).fill(0)],
      receiver: '用户甲',
      remark: '',
    });
    expect(first.ok).toBe(true);

    const second = saveV11ExternalSupplyRecord({
      year: 2026,
      inputEnergyRecordId: 'v11-er-30',
      energyTypeId: 'v11-energy-electricity',
      amount: 1,
      unit: 'kWh',
      monthlyAmounts: [1, ...Array(11).fill(0)],
      receiver: '用户乙',
      remark: '',
    });
    expect(second).toMatchObject({ ok: false });
    if (!second.ok) expect(second.error).toContain('月度合计不能超过');
  });

  it('reconciles KPI, balance rows, flow details, and the diagram internal-energy pool', () => {
    const result = buildFlowAnalysisDataset({ year: 2026, grain: 'month', month: 6 }, 'level1');
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

    expect(result.inputStandardCoalAmount).toBeCloseTo(sum(result.levelOneBalanceRows.map(
      (row) => row.externalInputStandardAmount + row.internalRecoveryStandardAmount,
    )), 8);
    expect(result.internalAvailableStandardCoalAmount).toBeCloseTo(sum(result.levelOneBalanceRows.map(
      (row) => row.availableStandardAmount,
    )), 8);
    expect(result.internalAvailableStandardCoalAmount).toBeCloseTo(sum(result.nodes
      .filter((node) => node.stage === 'medium')
      .map((node) => node.standardCoalAmount)), 8);
    expect(result.utilizationStandardCoalAmount).toBeCloseTo(sum(result.levelOneBalanceRows.map(
      (row) => row.distributionStandardAmount,
    )), 8);
    expect(result.externalStandardCoalAmount).toBeCloseTo(sum(result.levelOneBalanceRows.map(
      (row) => row.externalOutputStandardAmount,
    )), 8);
    expect(result.externalStandardCoalAmount).toBeCloseTo(sum(result.detailRows
      .filter((row) => row.stage === '外部输出')
      .map((row) => row.standardCoalAmount)), 8);
    expect(result.utilizationStandardCoalAmount).toBeCloseTo(sum(result.detailRows
      .filter((row) => row.stage === '能源分配')
      .map((row) => row.standardCoalAmount)), 8);
    const generatedDistribution = result.detailRows.find((row) =>
      row.flowDetailId === 'distribution:conversion:v11-output-202');
    expect(generatedDistribution).toMatchObject({
      stage: '能源分配',
      target: '生产车间B',
      traceDescription: '根据转换记录的内部使用量自动生成的一级分配记录',
    });
    result.levelOneBalanceRows.forEach((row) => {
      const mediumNodeId = `medium:${row.energyTypeId}`;
      const medium = result.nodes.find((node) => node.nodeId === mediumNodeId);
      if (!medium) return;
      expect(medium.standardCoalAmount).toBeCloseTo(row.availableStandardAmount, 8);
      expect(sum(result.links
        .filter((link) => link.sourceNodeId === mediumNodeId)
        .map((link) => link.standardCoalAmount))).toBeCloseTo(medium.standardCoalAmount, 8);
      const unallocatedLink = result.links.find((link) => link.linkId === `unallocated:${row.energyTypeId}`);
      expect(unallocatedLink?.standardCoalAmount ?? 0).toBeCloseTo(row.unallocatedStandardAmount, 8);
      const income = row.externalInputStandardAmount
        + row.internalRecoveryStandardAmount
        + row.conversionOutputStandardAmount
        + row.overAllocatedStandardAmount;
      const expense = row.conversionInputStandardAmount
        + row.distributionStandardAmount
        + row.externalOutputStandardAmount
        + row.confirmedConversionLossStandardAmount
        + row.unallocatedStandardAmount;
      expect(income).toBeCloseTo(expense, 8);
    });
  });
});

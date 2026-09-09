import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL('C:/Users/340710/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs').href);

const inputPath = 'C:/Users/340710/Desktop/功能清单.xlsx';
const outputDir = 'D:/Project/Generic_Energy_Carbon_Platform/artifacts/feature-list-update';
const outputPath = `${outputDir}/功能清单_按当前项目修订版.xlsx`;
const desktopPath = 'C:/Users/340710/Desktop/功能清单_按当前项目修订版.xlsx';
await fs.mkdir(outputDir, { recursive: true });

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const sheet = workbook.worksheets.getItemAt(0);
const used = sheet.getUsedRange();
const values = used.values;

// Correct descriptions that still expose implementation details or stale wording.
const replacements = new Map([
  [20, '无下级且无业务引用时，弹出二次确认；确认后删除该用能单元并即时刷新列表。'],
  [21, '用能单元以唯一标识关联能源数据、运营数据、重点设备和能源转换关系，保证跨页面统计口径一致。'],
  [36, '能源记录引用已维护的能源品种，自动带出计量单位和折标参数，保证录入与分析口径一致。'],
  [53, '新增时选择企业、用能单元或重点设备作为归属对象，页面根据所选范围提供对应的录入字段。'],
  [56, '校验归属对象、能源品种、单位和月度数值；保存后刷新能源数据列表及相关分析结果。'],
  [64, '能源数据按用能单元归集，支撑一级能源分配、二级能源利用和单元能耗分析。'],
  [65, '重点设备作为设备级统计对象，可关联设备能源数据并参与设备指标和能效对标。'],
  [107, '能效对标中的设备对象直接读取重点设备档案及其设备级能源数据，避免重复维护设备清单。'],
  [112, '能耗查询'],
  [165, '当前页面以全厂能源流向为主视图，支持一级/二级展示层级切换，不单独生成用能单元独立页面。'],
]);
for (const [row, text] of replacements) values[row - 1][4] = text;
sheet.getRange('A1:E184').values = values;

const rows = [];
const addPage = (module, page, groups) => {
  let firstPage = true;
  for (const [group, items] of groups) {
    let firstGroup = true;
    for (const [name, description] of items) {
      rows.push([firstPage && firstGroup ? module : null, firstGroup ? page : null, group, name, description]);
      firstGroup = false;
      firstPage = false;
    }
  }
};

addPage('碳排放核算与合规', '碳排放预览', [
  ['结果摘要', [
    ['排放总量', '展示当前正式核算清单的温室气体排放总量及计量单位。'],
    ['排放分类', '按排放类别汇总排放量和占比，帮助用户快速识别主要排放来源。'],
    ['排放源排名', '按排放量展示主要排放源，支持进入核算清单查看明细。'],
  ]],
  ['核算入口', [
    ['核算设置', '进入核算设置，维护核算年度、适用行业方法、核算范围、核算用途和边界说明。'],
    ['查看核算清单', '从结果预览跳转至当前核算清单，继续补充活动数据或核对排放源。'],
  ]],
]);
addPage(null, '碳核算清单', [
  ['任务与设置', [
    ['新建核算任务', '按核算年度、行业核算方法、核算范围、核算用途和边界说明创建核算任务。'],
    ['生成草稿清单', '根据能源数据、运营数据及任务设置预览系统识别的排放源，确认后生成草稿清单。'],
    ['正式清单更新', '对草稿修改进行变更预览，确认后生成新的正式核算清单，并保留历史版本摘要。'],
  ]],
  ['排放源维护', [
    ['系统识别排放源', '根据上游能源和运营数据生成对应排放源及活动数据，标识当前清单状态。'],
    ['新增排放源', '补充系统未自动识别的排放源，录入排放类别、源类型、名称、活动数据、单位及因子/参数。'],
    ['查看与补充数据', '通过详情抽屉查看活动数据、排放因子、计算结果和支撑材料，并补充缺失信息。'],
    ['编辑与删除', '支持编辑可维护排放源；删除前二次确认，系统识别的排放源按页面规则限制删除。'],
  ]],
  ['核算结果', [
    ['排放量计算', '按活动数据与排放因子/参数计算排放量，展示结果、数据状态和适用口径。'],
    ['核算明细', '按排放类别分组展示排放源、活动数据、排放因子/参数、排放量和操作入口。'],
  ]],
]);
addPage(null, '碳核查支撑', [
  ['材料筛选', [
    ['关键字与状态筛选', '按关键字、材料状态和核算年度筛选基础材料及排放源支撑材料。'],
    ['分区展示', '同页展示核算基础材料和排放源支撑材料，排放源材料由核算清单自动带出。'],
  ]],
  ['材料管理', [
    ['查看材料', '查看核查事项、排放源、活动数据来源、已上传文件和备注。'],
    ['上传材料', '通过材料管理抽屉上传一个或多个支撑文件，并填写数据口径、年度汇总方法或差异说明。'],
    ['删除材料', '支持删除整条材料或单个文件，并同步更新材料数量和状态。'],
    ['只读核算数据', '排放类别、排放源和活动数据从正式核算清单读取，在核查支撑页面只读展示。'],
  ]],
]);
addPage(null, '碳排放报告', [
  ['报告生成', [
    ['报告列表', '展示已生成的企业温室气体排放报告及报告名称、年度、状态和排放总量。'],
    ['报告预览', '预览企业基本情况、温室气体排放汇总和排放类别明细。'],
    ['下载与打印', '支持下载HTML报告，并通过打印或另存为PDF形成可交付文件。'],
  ]],
]);
addPage(null, '碳因子参数', [
  ['查询与分类', [
    ['关键字查询', '按因子/参数名称、排放活动或编码检索记录。'],
    ['类型与状态筛选', '按综合排放因子、基础核算参数、参数组/公式模板及有效状态筛选。'],
    ['公共与企业数据', '区分公共因子和当前企业维护的实测因子、核算参数及参数组。'],
  ]],
  ['因子维护', [
    ['查看因子详情', '查看因子值、单位、排放活动、温室气体、参数组成、公式模板、来源依据和适用期。'],
    ['新增企业因子/参数', '录入对象名称、类型、排放活动、温室气体、数值/参数摘要、单位、适用年度、取值方式和来源依据。'],
    ['选择并应用因子', '在排放源维护中选择可用因子或参数组，也可新建企业自定义因子后应用。'],
    ['导入企业数据', '通过Excel文件导入当前企业因子、核算参数或参数组，并执行字段、单位、重复项和依据材料校验。'],
  ]],
]);

addPage('能碳资产运营与策略', '能效平衡与优化', [
  ['分析条件', [
    ['周期与范围', '按月度或年度、年份、月份和组织范围查询能源平衡与异常诊断结果。'],
    ['查询与重置', '根据当前条件刷新平衡概览、异常清单和重点对象排行；重置恢复默认条件。'],
  ]],
  ['平衡诊断', [
    ['能源平衡概览', '展示能源输入、一级分配、二级归集、未分配量及异常对象等平衡指标。'],
    ['平衡问题构成', '按一级分配、二级归集、指标、数据完整性等问题来源汇总异常数量。'],
    ['异常对象TOP5', '按异常幅度展示重点用能单元或二级对象排行，辅助确定优先核查对象。'],
    ['诊断清单', '展示对象、问题类型、诊断依据、建议动作和处理状态，支持查看诊断详情及处理记录。'],
    ['规则说明', '查看能源平衡计算口径、异常识别规则和处置建议，明确管理差额不等同于设备效率损失。'],
  ]],
]);
addPage(null, '用能分析与策略推荐', [
  ['分析条件', [
    ['周期与范围', '按月度或年度、组织或用能单元和月份查看能源消费、成本和能效表现。'],
    ['查询与重置', '按当前条件更新分析结果，重置恢复默认统计周期和范围。'],
  ]],
  ['分析结果', [
    ['核心指标', '展示能源消费总量、综合能源成本、单位综合用能成本和单位产品综合能耗。'],
    ['能源—成本结构对比', '对比各能源品种的能耗占比、成本占比及单位用能成本，识别结构偏差。'],
    ['重点用能单元', '集中展示各用能单元的能耗、能效和成本情况，标记需要关注的对象。'],
    ['本期核心发现', '从能源结构、成本结构和单位成本角度列出当前周期的重点发现。'],
  ]],
  ['策略建议', [
    ['查看用能分析详情', '查看对象的能耗、成本、能效、同比变化和关联数据来源。'],
    ['查看建议动作', '基于当前数据提供用能配置、运行方式或清洁能源使用方向的辅助建议，正式执行前需结合现场条件确认。'],
  ]],
]);
addPage(null, '用能与碳排放预算管理', [
  ['预算类型', [
    ['能源预算', '按能源消费量维护预算目标、累计执行量、预计全年值、偏差和预算状态。'],
    ['碳排放预算', '按碳排放量维护预算目标、累计执行量、预计全年值、偏差和预算状态。'],
  ]],
  ['预算执行', [
    ['年度目标', '展示企业或一级用能单元的年度目标，并支持配置或调整目标。'],
    ['月度目标', '可选配置月度目标；未配置时按年度目标平均分配用于趋势与状态展示。'],
    ['累计趋势', '以趋势图对比实际累计值、预测累计值和年度目标线。'],
    ['执行分解表', '展示管理对象、年度目标、当前累计、预计全年、偏差、偏差率和状态。'],
    ['执行详情', '点击行查看目标、累计、执行率、预测、偏差、判断结论和建议动作。'],
  ]],
  ['预测与调整', [
    ['开始/重新预测', '根据最新能源或碳排放数据生成全年预测，并更新趋势图、偏差和状态。'],
    ['预算配置', '录入年度目标、可选月度目标和调整说明，保存后应用于当前预算分析。'],
  ]],
]);
addPage(null, '碳资产管理', [
  ['履约概览', [
    ['履约覆盖情况', '展示预计履约需求、已确认可用资产、履约覆盖率及预计结余或缺口。'],
    ['履约状态提示', '根据当前周期需求与已确认资产判断覆盖是否充足，并提示待核验资产和下一周期风险。'],
    ['资产构成', '按资产类型展示取得量、已使用量和当前可用量，点击资产类型可联动台账筛选。'],
  ]],
  ['资产台账', [
    ['录入碳资产', '录入资产类型、履约周期、来源、取得量、履约属性及凭证等信息。'],
    ['台账明细', '展示资产类型、履约周期、来源、取得量、已使用、当前可用、履约属性和操作。'],
    ['查看与编辑凭证', '查看或维护资产详情、履约属性和相关凭证，确保资产可用性有据可查。'],
    ['导出报告', '导出当前履约周期的碳资产台账和履约分析结果。'],
  ]],
  ['下一履约周期预测', [
    ['情景假设', '调整预计产量、单位产品排放强度和行业平衡值等情景参数。'],
    ['重新测算', '按当前情景重新测算预计排放、预计配额、可结转资产和预计履约余量/缺口。'],
    ['测算说明', '查看配额测算规则、参数来源和适用边界；测算结果用于履约准备分析，不代表主管部门最终核定配额。'],
  ]],
]);

const startRow = 185;
sheet.getRange(String.fromCharCode(65,49,56,53)+String.fromCharCode(58)+String.fromCharCode(69)+(184 + rows.length)).values = rows;

const finalRange = sheet.getUsedRange();
finalRange.format.wrapText = true;
finalRange.format.autofitRows();
sheet.getRange(`E1:E${finalRange.values.length}`).format.columnWidth = 78;
sheet.getRange(`A1:D${finalRange.values.length}`).format.columnWidth = 18;
sheet.getRange('A1:E1').format.font = { bold: true };

const errorScan = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A', options: { useRegex: true, maxResults: 100 }, summary: 'final formula error scan' });
console.log(`APPENDED_ROWS=${rows.length}`);
console.log(errorScan.ndjson);
const preview = await workbook.render({ sheetName: sheet.name, range: `A1:E${finalRange.values.length}`, scale: 1, format: 'png' });
await fs.writeFile(`${outputDir}/功能清单预览.png`, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
await fs.copyFile(outputPath, desktopPath);
console.log(`OUTPUT=${outputPath}`);
console.log(`DESKTOP_COPY=${desktopPath}`);

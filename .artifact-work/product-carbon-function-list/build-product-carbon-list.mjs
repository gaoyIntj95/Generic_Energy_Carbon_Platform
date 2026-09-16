import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const outputPath = 'D:/Project/Generic_Energy_Carbon_Platform/outputs/20260916-product-carbon-footprint-function-list/产品碳足迹模块功能清单（仅当前功能）.xlsx';
const rows = [
  ['一级功能', '二级功能', '三级功能', '四级功能', '需求描述'],
  ['产品碳足迹', '碳足迹项目管理', '项目查询与列表', '项目筛选与重置', '按产品名称、产品类别、核算年度筛选项目；重置后恢复默认条件并显示完整项目列表。'],
  ['', '', '', '项目台账', '展示产品名称、类别、功能单位、系统边界、核算年度、单位产品碳足迹、更新时间、状态及操作入口。'],
  ['', '', '', '项目状态与分页', '项目以“已完成”或“数据待完善”展示核算进度；列表显示记录总数及分页信息。'],
  ['', '', '新建与编辑项目', '产品基础信息', '维护产品名称、规格型号、产品类别（含自定义类别）和功能单位。'],
  ['', '', '', '核算周期', '支持自然年度或自定义起止日期；自定义周期校验结束日期不得早于开始日期。'],
  ['', '', '', '系统边界', '支持选择摇篮到大门或摇篮到坟墓作为项目系统边界。'],
  ['', '', '', '生产工艺材料', '支持上传工艺图及相关附件，文件类型覆盖 PDF、XLSX、DOCX、JPG、PNG，可多选。'],
  ['', '', '', '取舍规则说明', '页面展示物料质量阈值、低价值废物、固定资产及已知排放等项目取舍规则。'],
  ['', '', '项目操作与生命周期范围', '进入项目', '从项目列表进入核算清单，并将当前项目作为核算对象。'],
  ['', '', '', '编辑与删除', '支持编辑项目信息；删除项目需二次确认，并提示删除后不可恢复。'],
  ['', '', '', '生命周期模型', '按原材料获取、产品制造、产品配送展示可录入阶段及其活动分组；使用阶段和生命周期末端仅显示范围说明，不提供录入入口。'],
  ['', '碳足迹核算清单', '项目口径与生命周期引导', '当前项目摘要', '显示核算产品、功能单位、核算边界、核算项总数、已完成数、待完善数及当前累计排放量。'],
  ['', '', '', '生命周期导航', '按原材料获取、产品制造、产品配送分阶段引导；细分为原辅材料、入厂运输、能源消耗、工艺过程排放、废弃物处理和产品运输。'],
  ['', '', '核算项查询与展示', '分组查询与重置', '在当前活动分组内按核算项、因子或来源检索；查询和重置不改变当前生命周期分组。'],
  ['', '', '', '核算清单台账', '展示核算项、活动数据、因子名称、因子值、排放量、证明材料、数据状态及操作入口。'],
  ['', '', '', '阶段小计', '按当前生命周期活动分组计算阶段排放小计，单位为 kgCO₂e。'],
  ['', '', '', '完整度状态', '依据活动数据和排放因子的完备情况，显示已完成、数据缺失、因子缺失或数据与因子缺失。'],
  ['', '', '活动数据维护', '新增与编辑活动', '支持按当前生命周期分组新增或编辑原辅材料、能源、运输、工艺排放、废弃物等核算项；录入数据均对应 1 个功能单位产品。'],
  ['', '', '', '常规活动数据', '维护材料/活动名称、每功能单位用量、单位、数据来源、备注及可选供应商信息；单位支持自定义。'],
  ['', '', '', '运输数据换算', '维护运输方式、每功能单位运输重量和距离，自动计算运输周转量（t·km），作为因子匹配与核算依据。'],
  ['', '', '', '生产过程排放', '支持选择预设或其他生产过程、温室气体种类、排放量获取方式、活动数据、数据来源和高级核算说明。'],
  ['', '', '', '证明材料与备注', '支持每条活动数据上传多份证明材料（PDF、XLSX、DOCX、JPG、PNG），并维护特殊数据口径、来源或说明。'],
  ['', '', '排放因子匹配与核算确认', '因子选择与更换', '为核算项从因子选择器匹配排放因子并写入因子值；已匹配记录支持更换因子。'],
  ['', '', '', '排放量计算', '按活动数据 × 排放因子自动计算单条排放量，并汇总到生命周期阶段及项目总量。'],
  ['', '', '', '待完善提示', '存在活动数据或排放因子缺失时，明确提示待补充数量，并禁用确认核算清单。'],
  ['', '', '', '确认核算清单', '完成后将当前清单确认并固化为项目正式核算清单快照，供结果和报告页面读取。'],
  ['', '碳足迹核算结果', '结果选择与状态', '项目切换', '按项目切换查看核算结果，并显示结果依据为已确认的核算清单快照。'],
  ['', '', '', '空状态引导', '项目尚无正式清单快照时，提示需先在核算清单补齐数据并确认。'],
  ['', '', '结果汇总与分析', '单位产品碳足迹', '展示当前项目的产品碳足迹总量及 kgCO₂e/功能单位。'],
  ['', '', '', '核算范围信息', '展示产品名称、功能单位、产品规格、系统边界、核算期间及确认清单快照状态。'],
  ['', '', '', '生命周期贡献', '以环图及明细展示原材料获取、生产制造、分销与运输的排放量和占比。'],
  ['', '', '', '主要排放来源', '按单条活动排放量降序展示 TOP5 排放来源、排放量及贡献占比。'],
  ['', '', '', '活动明细与合计', '逐条展示生命周期阶段、排放活动、活动数据、排放因子、因子来源、排放量和占比，并提供已核算合计。'],
  ['', '碳足迹报告管理', '报告生成与版本入口', '生成条件控制', '只有项目存在已确认核算清单快照时才可生成报告；无正式结果时展示明确空状态。'],
  ['', '', '', '报告列表', '按已生成项目列出产品碳足迹报告，并标识报告基于已确认清单快照。'],
  ['', '', '', '生成与重新生成', '支持生成当前项目报告，以及基于当前已确认清单快照重新生成。'],
  ['', '', '报告预览内容', '报告封面与摘要', '预览报告编号、报告版本、功能单位、系统边界、核算周期、单位产品碳足迹及生命周期阶段贡献。'],
  ['', '', '', '目标、范围与方法', '预览核算目标、产品信息、纳入的系统边界、数据来源、因子来源及“活动数据 × 排放因子”的计算方法。'],
  ['', '', '', '结果、质量与热点', '预览活动排放明细及合计、数据完整性和初级数据覆盖率、数据质量等级、TOP3 热点及减排建议。'],
  ['', '', '', '报告下载', '支持将当前产品碳足迹报告下载为 HTML 文件。'],
  ['', '碳足迹因子库', '因子检索与列表', '分类与来源导航', '支持按业务类别或数据来源切换因子目录；业务类别包含原辅材料、能源与燃料、运输、工艺过程排放、废弃物处理。'],
  ['', '', '', '名称检索', '按因子名称关键字筛选因子，并支持重置查询条件。'],
  ['', '', '', '因子台账', '展示因子名称、分类、因子值、因子单位、适用区域、数据年份、来源及详情入口。'],
  ['', '', '因子详情与维护', '因子详情', '查看因子值、功能单位、核算边界、适用区域、数据年份、数据来源、技术代表性、数据质量及生命周期阶段足迹结构。'],
  ['', '', '', '新增因子', '支持新增企业特定或经核验的因子，维护因子名称、分类、因子值、单位、适用区域、数据年份和数据来源及依据。'],
];

const workbook = Workbook.create();
const sheet = workbook.worksheets.add('产品碳足迹');
sheet.showGridlines = false;
sheet.getRange(`A1:E${rows.length}`).values = rows;

sheet.getRange('A1:E1').format = {
  fill: '#F6C744', font: { bold: true, color: '#1E2E2B', size: 11 }, horizontal_alignment: 'center', vertical_alignment: 'center', wrap_text: true,
  borders: { style: 'continuous', color: '#8A8A8A' },
};
sheet.getRange(`A2:E${rows.length}`).format = {
  fill: '#FFFFFF', font: { color: '#293B38', size: 10 }, vertical_alignment: 'center', wrap_text: true,
  borders: { style: 'continuous', color: '#B7BFBD' },
};
sheet.getRange(`A2:D${rows.length}`).format.horizontal_alignment = 'center';
sheet.getRange(`E2:E${rows.length}`).format.horizontal_alignment = 'left';
sheet.getRange('A:A').format.columnWidth = 18;
sheet.getRange('B:B').format.columnWidth = 22;
sheet.getRange('C:C').format.columnWidth = 28;
sheet.getRange('D:D').format.columnWidth = 24;
sheet.getRange('E:E').format.columnWidth = 92;
sheet.getRange('1:1').format.rowHeight = 26;
sheet.getRange(`2:${rows.length}`).format.rowHeight = 36;

const merges = [
  'A2:A46',
  'B2:B12', 'B13:B27', 'B28:B34', 'B35:B41', 'B42:B46',
  'C2:C4', 'C5:C9', 'C10:C12',
  'C13:C14', 'C15:C18', 'C19:C23', 'C24:C27',
  'C28:C29', 'C30:C34',
  'C35:C37', 'C38:C41',
  'C42:C44', 'C45:C46',
];
for (const range of merges) sheet.mergeCells(range);

for (const range of ['A2:A46', 'B2:B12', 'B13:B27', 'B28:B34', 'B35:B41', 'B42:B46']) {
  sheet.getRange(range).format = { fill: '#F3F8F6', font: { bold: true, color: '#123E33', size: 11 }, horizontal_alignment: 'center', vertical_alignment: 'center', wrap_text: true, borders: { style: 'continuous', color: '#B7BFBD' } };
}
for (const range of ['C2:C4', 'C5:C9', 'C10:C12', 'C13:C14', 'C15:C18', 'C19:C23', 'C24:C27', 'C28:C29', 'C30:C34', 'C35:C37', 'C38:C41', 'C42:C44', 'C45:C46']) {
  sheet.getRange(range).format = { fill: '#FAFCFB', font: { bold: true, color: '#244D42', size: 10 }, horizontal_alignment: 'center', vertical_alignment: 'center', wrap_text: true, borders: { style: 'continuous', color: '#B7BFBD' } };
}

const noteRow = rows.length + 1;
sheet.getRange(`A${noteRow}:E${noteRow}`).merge();
sheet.getRange(`A${noteRow}`).values = [['编制口径：仅基于当前前端页面已具备的产品碳足迹项目、清单、结果、报告及因子库功能梳理；不包含规划或待建设功能。']];
sheet.getRange(`A${noteRow}:E${noteRow}`).format = { fill: '#E8F4EF', font: { italic: true, color: '#37655B', size: 10 }, horizontal_alignment: 'left', vertical_alignment: 'center', wrap_text: true, borders: { style: 'continuous', color: '#B7D6CB' } };
sheet.getRange(`${noteRow}:${noteRow}`).format.rowHeight = 32;
sheet.freezePanes.freezeRows(1);

workbook.recalculate();
const check = await workbook.inspect({ kind: 'table', range: `产品碳足迹!A1:E${noteRow}`, include: 'values,formulas', table_max_rows: noteRow, table_max_cols: 5 });
console.log(check.ndjson);
const errors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A', options: { use_regex: true, max_results: 100 }, summary: 'final formula error scan' });
console.log(errors.ndjson);
const image = await workbook.render({ sheetName: '产品碳足迹', range: `A1:E${noteRow}`, scale: 1.15 });
await fs.writeFile('D:/Project/Generic_Energy_Carbon_Platform/.artifact-work/product-carbon-function-list/product-carbon-list-preview.png', Buffer.from(await image.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`OUTPUT=${outputPath}`);

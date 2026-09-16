import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const outputPath = 'D:/Project/Generic_Energy_Carbon_Platform/outputs/20260916-supply-chain-carbon-function-list/供应链碳管理模块功能清单（仅当前功能）.xlsx';

const allRows = [
  ['一级功能', '二级功能', '三级功能', '四级功能', '需求描述'],
  ['供应链碳管理', '供应商碳数据采集', '供应商碳数据台账与筛选', '筛选条件', '【当前已具备】按数据年度、供应商名称/材料或产品关键词、材料/产品类别、数据状态筛选供应商碳数据；状态包含完整、待补碳数据、待补证明。'],
  ['', '', '', '查询与重置', '【当前已具备】点击查询后按已输入条件刷新台账；重置恢复默认筛选条件并回显完整数据集。'],
  ['', '', '', '汇总指标', '【当前已具备】展示供应商数量、材料/产品数据数量、已提供碳足迹数量及待补充数据数量，用于识别采集覆盖度与缺口。'],
  ['', '', '', '台账字段', '【当前已具备】列表展示供应商名称、材料/产品、生产基地、数据年度、采购量、碳足迹结果、生命周期边界、证明材料、数据状态及操作入口。'],
  ['', '', '供应商材料/产品碳数据维护', '基础信息', '【当前已具备】新增或编辑供应商名称、生产基地、材料/产品、材料/产品类别、规格型号、联系人、数据年度和数据期间；核心识别字段必填。'],
  ['', '', '', '采购业务数据', '【当前已具备】维护采购量及计量单位，作为本企业采购业务数据；页面不要求录入供应商全部生产过程活动数据。'],
  ['', '', '', '碳足迹结果', '【当前已具备】维护产品/材料碳足迹结果、结果单位、生命周期边界、核算标准、数据来源与有效期；碳足迹结果允许待后续补充。'],
  ['', '', '', '完整度状态', '【当前已具备】根据碳足迹结果和证明材料自动区分完整、待补碳数据、待补证明；不把不完整记录伪装为可用的完整数据。'],
  ['', '', '证明材料与备注', '文件上传', '【当前已具备】支持上传PDF、XLSX、DOCX、JPG、PNG等多份佐证材料，并允许在维护时补充备注。'],
  ['', '', '', '证明材料查看', '【当前已具备】从台账记录查看供应商碳数据佐证材料；无文件时明确展示空状态和补充入口。'],
  ['', '', '', '备注维护', '【当前已具备】记录供应商碳数据的补充说明、数据口径或沟通备注，便于后续核查。'],
  ['', '', '记录操作与边界', '编辑与删除', '【当前已具备】支持查看、编辑和删除供应商记录；删除前进行二次确认，删除后同步更新台账及汇总。'],
  ['', '', '', '数据边界', '【当前已具备】一条记录以供应商、生产基地、材料/产品和数据年度为核心维度管理，避免同一业务对象重复登记。'],
  ['', '', '模板化数据采集', '模板下载', '【需求规划｜CA-06-01｜P0】提供统一供应商碳数据采集模板下载，明确模板版本、填报字段和适用范围。'],
  ['', '', '', 'Excel解析与校验', '【需求规划｜CA-06-02｜P0】上传模板后校验模板版本、文件格式和必填字段；解析不通过的记录不可进入正式数据使用范围。'],
  ['', '', '', '异常定位与隔离', '【需求规划｜CA-06-02｜P0】对格式、字段或数据异常返回可定位的错误信息，并将异常记录与正式记录隔离，支持修正后重传。'],
  ['', '', '', '文件服务规则', '【需求规划｜CA-06-03｜P1】文件类型、大小、权限和失败重试由统一文件服务约束；支持详情查询及文件管理。'],
  ['', '产品碳足迹披露', '披露记录台账与查询', '筛选条件', '【当前已具备】按数据年度、产品名称和接收方筛选披露记录；点击查询应用条件，重置恢复默认条件。'],
  ['', '', '', '汇总指标', '【当前已具备】展示披露记录数、已披露产品数、接收方数和披露完成率，快速掌握当前披露覆盖情况。'],
  ['', '', '', '台账字段', '【当前已具备】列表展示产品名称、规格型号、数据年度、生命周期范围、碳足迹结果、接收方、披露方式、披露时间和操作入口。'],
  ['', '', '新增与编辑披露记录', '选择产品碳足迹报告', '【当前已具备】从已完成的产品碳足迹报告中选择待披露产品；自动带出规格型号、数据年度、生命周期范围、碳足迹结果和报告文件。'],
  ['', '', '', '披露对象信息', '【当前已具备】维护接收方名称、接收方联系人及联系方式；接收方为必填，确保每次对外披露可追溯。'],
  ['', '', '', '披露方式', '【当前已具备】支持邮件、接收方平台、即时通讯、线下及其他披露方式，并保留用户填写的方式说明。'],
  ['', '', '', '披露时间与说明', '【当前已具备】记录披露时间及补充说明；披露时间可按实际业务补录。'],
  ['', '', '材料与留痕', '披露凭证上传', '【当前已具备】支持上传邮件回执、平台截图、签收单等多份披露佐证材料，文件类型覆盖PDF、XLSX、DOCX、JPG、PNG。'],
  ['', '', '', '凭证查看', '【当前已具备】在披露记录中查看已上传的佐证材料；无材料时展示明确空状态，允许后续补传。'],
  ['', '', '', '逐次披露留痕', '【当前已具备】每次向下游披露单独形成一条记录，关联产品、数据年度、碳足迹报告与接收方，不因同一产品多次披露而覆盖历史记录。'],
  ['', '', '记录操作与关联约束', '查看、编辑与删除', '【当前已具备】支持查看材料、编辑和删除披露记录；删除前二次确认，防止误删披露留痕。'],
  ['', '', '', '报告版本关联', '【需求规划｜CA-07-02｜P0】披露记录应关联产品、数据期间及碳足迹报告版本；后续应在台账和详情中明确展示版本信息。'],
  ['', '', '发送、导出与审计', '发送或线下登记', '【需求规划｜CA-07-03｜P1】支持通过发送服务对外发送报告，或登记线下披露；应保留发送状态、时间和失败原因。'],
  ['', '', '', '导出当前筛选台账', '【需求规划｜CA-07-03｜P1】按当前已生效筛选条件导出披露记录台账，导出内容与页面台账口径一致。'],
  ['', '', '', '操作历史与审计日志', '【需求规划｜CA-07-01/03｜P0/P1】记录新增、编辑、删除、发送及文件操作历史，支持按记录追溯操作者和时间。'],
  ['', '', '', '披露状态筛选', '【需求规划｜CA-07-01｜P0】补充披露状态维度的筛选与展示，区分待披露、已披露、发送失败等业务状态。'],
];
const rows = [allRows[0], ...allRows.slice(1).filter((row) => !row[4]?.startsWith('【需求规划'))];

const workbook = Workbook.create();
const sheet = workbook.worksheets.add('供应链碳管理');
sheet.showGridlines = false;
sheet.getRange(`A1:E${rows.length}`).values = rows;

const header = sheet.getRange('A1:E1');
header.format = {
  fill: '#F6C744',
  font: { bold: true, color: '#1E2E2B', size: 11 },
  horizontal_alignment: 'center',
  vertical_alignment: 'center',
  wrap_text: true,
  borders: { style: 'continuous', color: '#8A8A8A' },
};

const body = sheet.getRange(`A2:E${rows.length}`);
body.format = {
  fill: '#FFFFFF',
  font: { color: '#293B38', size: 10 },
  vertical_alignment: 'center',
  wrap_text: true,
  borders: { style: 'continuous', color: '#B7BFBD' },
};

sheet.getRange(`A2:D${rows.length}`).format.horizontal_alignment = 'center';
sheet.getRange(`E2:E${rows.length}`).format.horizontal_alignment = 'left';
sheet.getRange('A:A').format.columnWidth = 18;
sheet.getRange('B:B').format.columnWidth = 21;
sheet.getRange('C:C').format.columnWidth = 25;
sheet.getRange('D:D').format.columnWidth = 22;
sheet.getRange('E:E').format.columnWidth = 88;
sheet.getRange('1:1').format.rowHeight = 26;
sheet.getRange(`2:${rows.length}`).format.rowHeight = 36;

const groupRanges = [
  'A2:A25',
  'B2:B14', 'B15:B25',
  'C2:C5', 'C6:C9', 'C10:C12', 'C13:C14',
  'C15:C17', 'C18:C21', 'C22:C24',
];
for (const range of groupRanges) sheet.mergeCells(range);

for (const range of ['A2:A25', 'B2:B14', 'B15:B25']) {
  sheet.getRange(range).format = {
    fill: '#F3F8F6',
    font: { bold: true, color: '#123E33', size: 11 },
    horizontal_alignment: 'center',
    vertical_alignment: 'center',
    wrap_text: true,
    borders: { style: 'continuous', color: '#B7BFBD' },
  };
}
for (const range of ['C2:C5', 'C6:C9', 'C10:C12', 'C13:C14', 'C15:C17', 'C18:C21', 'C22:C24', 'C25']) {
  sheet.getRange(range).format = {
    fill: '#FAFCFB',
    font: { bold: true, color: '#244D42', size: 10 },
    horizontal_alignment: 'center',
    vertical_alignment: 'center',
    wrap_text: true,
    borders: { style: 'continuous', color: '#B7BFBD' },
  };
}

sheet.getRange('A:A').format.columnWidth = 20;
sheet.getRange('B:B').format.columnWidth = 22;
sheet.getRange('C:C').format.columnWidth = 28;
sheet.getRange('D:D').format.columnWidth = 24;
sheet.getRange('E:E').format.columnWidth = 90;
sheet.getRange(`A${rows.length + 1}:E${rows.length + 1}`).merge();
sheet.getRange(`A${rows.length + 1}`).values = [[
  '编制口径：仅基于当前前端页面已具备的供应商碳数据采集和产品碳足迹披露能力梳理；不包含规划或待建设功能。'
]];
sheet.getRange(`A${rows.length + 1}:E${rows.length + 1}`).format = {
  fill: '#E8F4EF',
  font: { italic: true, color: '#37655B', size: 10 },
  horizontal_alignment: 'left',
  vertical_alignment: 'center',
  wrap_text: true,
  borders: { style: 'continuous', color: '#B7D6CB' },
};
sheet.getRange(`${rows.length + 1}:${rows.length + 1}`).format.rowHeight = 32;

sheet.freezePanes.freezeRows(1);
workbook.recalculate();

const check = await workbook.inspect({
  kind: 'table',
  range: `供应链碳管理!A1:E${rows.length + 1}`,
  include: 'values,formulas',
  table_max_rows: rows.length + 1,
  table_max_cols: 5,
});
console.log(check.ndjson);
const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { use_regex: true, max_results: 100 },
  summary: 'final formula error scan',
});
console.log(errors.ndjson);

const rendered = await workbook.render({ sheetName: '供应链碳管理', range: `A1:E${rows.length + 1}`, scale: 1.25 });
await fs.writeFile('D:/Project/Generic_Energy_Carbon_Platform/.artifact-work/supply-chain-carbon-list/function-list-preview.png', Buffer.from(await rendered.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`OUTPUT=${outputPath}`);

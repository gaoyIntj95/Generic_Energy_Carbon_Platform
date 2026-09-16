import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const outputDir = 'D:/Project/Generic_Energy_Carbon_Platform/outputs/20260915-supply-chain-carbon-function-list';
const outputPath = `${outputDir}/供应链碳管理与产品碳足迹功能清单.xlsx`;
const font = 'Arial';

const rows = [
  ['供应链碳管理', '供应商碳数据采集', '查询与概览', '年度、关键词、类别、状态筛选', '按数据年度、供应商或材料/产品名称、材料/产品类别及数据状态查询；支持一键重置。', '已实现'],
  ['供应链碳管理', '供应商碳数据采集', '查询与概览', '供应商碳数据概览', '展示供应商数量、材料/产品数据条数、已提供碳足迹条数及待补充数据条数。', '已实现'],
  ['供应链碳管理', '供应商碳数据采集', '记录管理', '供应商碳数据列表', '以“供应商 + 生产基地 + 材料/产品 + 数据年度”为一条记录，展示采购量、碳足迹结果、生命周期边界、证明材料和状态。', '已实现'],
  ['供应链碳管理', '供应商碳数据采集', '记录管理', '新增与编辑供应商碳数据', '维护供应商、生产基地、材料/产品、类别、规格、年度、联系人及数据期间等基础信息。', '已实现'],
  ['供应链碳管理', '供应商碳数据采集', '业务与碳数据', '采购业务数据维护', '录入采购量及数量单位，仅保留供应链碳管理所需业务数据。', '已实现'],
  ['供应链碳管理', '供应商碳数据采集', '业务与碳数据', '碳足迹数据维护', '维护碳足迹结果、结果单位、生命周期边界、核算标准、碳数据来源及报告/数据有效期。', '已实现'],
  ['供应链碳管理', '供应商碳数据采集', '凭证与状态', '证明材料上传与查看', '上传或查看 PDF、XLSX、DOCX、JPG、PNG 等证明材料；支持多文件。', '已实现'],
  ['供应链碳管理', '供应商碳数据采集', '凭证与状态', '数据完整性状态', '碳足迹结果或证明材料缺失时，分别标记为“待补碳数据”或“待补证明”。', '已实现'],
  ['供应链碳管理', '供应商碳数据采集', '记录管理', '查看、删除与二次确认', '支持查看佐证材料、编辑和删除记录；删除前进行不可恢复提示。', '已实现'],
  ['供应链碳管理', '供应商碳数据采集', '规划扩展', '模板下载、Excel 上传解析与校验', '需求文档规划标准模板下载、模板版本/格式/必填项校验和错误定位；当前页面以直接录入为主。', '规划扩展'],
  ['供应链碳管理', '产品碳足迹披露', '查询与概览', '年度、产品、接收方筛选', '按数据年度、产品名称和接收方名称筛选披露记录；支持查询与重置。', '已实现'],
  ['供应链碳管理', '产品碳足迹披露', '查询与概览', '披露概览', '展示披露记录数、已披露产品数、已披露客户数及披露完成率。', '已实现'],
  ['供应链碳管理', '产品碳足迹披露', '记录管理', '披露记录台账', '按每次对外披露留存独立记录，展示产品、规格、年度、边界、碳足迹结果、接收方、方式和时间。', '已实现'],
  ['供应链碳管理', '产品碳足迹披露', '新建披露', '选择已完成碳足迹报告', '从已完成且已生成报告的产品碳足迹中选择产品，并预览规格、年度、边界、结果和报告文件。', '已实现'],
  ['供应链碳管理', '产品碳足迹披露', '新建披露', '接收方与披露方式维护', '维护接收方名称、联系人、联系方式、披露方式、披露时间和说明。', '已实现'],
  ['供应链碳管理', '产品碳足迹披露', '凭证与追溯', '披露凭证上传与查看', '上传或查看邮件回执、平台截图、签收单等披露凭证，保留披露留痕。', '已实现'],
  ['供应链碳管理', '产品碳足迹披露', '记录管理', '查看、编辑、删除', '支持查看凭证、编辑与删除披露记录；删除前进行二次确认。', '已实现'],
  ['供应链碳管理', '产品碳足迹披露', '规划扩展', '发送、导出与操作日志', '需求文档规划按权限发送报告或登记线下披露、按筛选条件导出及记录操作日志。', '规划扩展'],
  ['产品碳足迹', '碳足迹项目管理', '查询与项目台账', '项目筛选与列表', '按产品名称、产品类别和核算年度查询项目，展示功能单位、系统边界、碳足迹、更新时间和状态。', '已实现'],
  ['产品碳足迹', '碳足迹项目管理', '项目配置', '新建与编辑项目', '维护产品名称、规格型号、产品类别、功能单位、核算周期、系统边界和工艺流程图。', '已实现'],
  ['产品碳足迹', '碳足迹项目管理', '项目配置', '核算边界与取舍规则', '支持“摇篮到大门/摇篮到坟墓”边界，并在项目创建时展示物料、废物和设施等取舍规则。', '已实现'],
  ['产品碳足迹', '碳足迹项目管理', '项目配置', '工艺图上传', '上传 PDF、XLSX、DOCX、JPG、PNG 等工艺图及相关文件，支持多选。', '已实现'],
  ['产品碳足迹', '碳足迹项目管理', '项目管理', '进入项目、编辑与删除', '从项目台账进入核算清单；支持编辑和删除，删除前提示不可恢复。', '已实现'],
  ['产品碳足迹', '碳足迹核算清单', '生命周期导航', '生命周期阶段引导', '按原材料获取、产品制造、产品配送组织原辅材料、入厂运输、能源、工艺排放、废弃物和产品运输。', '已实现'],
  ['产品碳足迹', '碳足迹核算清单', '清单维护', '分组检索与阶段小计', '按当前分组搜索核算项、因子或来源；展示分组记录数与阶段排放小计。', '已实现'],
  ['产品碳足迹', '碳足迹核算清单', '清单维护', '新增与编辑活动数据', '按原辅材料、能源、运输、工艺排放、废弃物录入活动数据；数据统一对应 1 个功能单位产品。', '已实现'],
  ['产品碳足迹', '碳足迹核算清单', '清单维护', '运输周转量计算', '录入每 1 个功能单位的运输重量、运输方式和距离，自动计算 t·km 并用于因子匹配与核算。', '已实现'],
  ['产品碳足迹', '碳足迹核算清单', '清单维护', '生产过程排放数据', '按排放活动和温室气体选择固定获取方式，录入对应 1 个功能单位的活动数据或直接排放量。', '已实现'],
  ['产品碳足迹', '碳足迹核算清单', '因子与凭证', '排放因子选择与自定义因子', '按活动分类筛选因子，展示因子值和来源；可录入企业实测或供应商自定义因子。', '已实现'],
  ['产品碳足迹', '碳足迹核算清单', '因子与凭证', '证明材料管理', '上传、查看和下载活动数据证明材料；材料数量在清单中汇总展示。', '已实现'],
  ['产品碳足迹', '碳足迹核算清单', '核算确认', '完整性校验与清单快照', '数据或因子缺失时阻止确认；确认后保存清单快照，作为核算结果与报告的数据依据。', '已实现'],
  ['产品碳足迹', '碳足迹核算结果', '结果查看', '确认前置校验', '未确认核算清单时提示先补齐并确认清单，避免展示非正式结果。', '已实现'],
  ['产品碳足迹', '碳足迹核算结果', '结果查看', '产品足迹与生命周期贡献', '展示单位产品碳足迹、生命周期阶段贡献、活动排放明细和排放热点。', '已实现'],
  ['产品碳足迹', '碳足迹报告管理', '报告管理', '报告生成与预览', '基于已确认清单快照生成产品碳足迹报告，汇集范围、方法、数据来源、结果和热点建议。', '已实现'],
  ['产品碳足迹', '碳足迹报告管理', '报告管理', '报告下载', '下载产品碳足迹量化报告；生成条件由正式核算清单控制。', '已实现'],
  ['产品碳足迹', '碳足迹因子库', '因子管理', '因子筛选与列表', '按业务类别或数据来源筛选碳足迹因子，展示因子值、单位、区域、年份和来源。', '已实现'],
  ['产品碳足迹', '碳足迹因子库', '因子管理', '因子详情', '查看产品碳足迹因子的基本信息、适用区域、数据年份、技术代表性和生命周期阶段足迹。', '已实现'],
  ['产品碳足迹', '碳足迹因子库', '因子管理', '新增企业特定因子', '录入因子名称、分类、值、单位、适用区域、年份和来源及依据。', '已实现'],
];

const workbook = Workbook.create();
const sheet = workbook.worksheets.add('功能清单');
sheet.showGridlines = false;
sheet.getRange('A1:F1').merge();
sheet.getRange('A1').values = [['供应链碳管理与产品碳足迹功能清单']];
sheet.getRange('A2:F2').merge();
sheet.getRange('A2').values = [['依据当前前端页面与需求文档整理。状态为“规划扩展”的能力尚未在当前页面完整实现。']];
sheet.getRange('A4:F4').values = [['模块', '页面', '功能分类', '功能点', '功能说明', '页面状态']];
sheet.getRange(`A5:F${rows.length + 4}`).values = rows;

sheet.getRange('A1:F1').format = { font: { name: font, size: 16, bold: true, color: '#183A32' }, horizontalAlignment: 'left', verticalAlignment: 'center' };
sheet.getRange('A2:F2').format = { font: { name: font, size: 10, italic: true, color: '#5D746B' }, horizontalAlignment: 'left', verticalAlignment: 'center' };
sheet.getRange('A4:F4').format = { fill: '#0A8F68', font: { name: font, size: 10, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center' };
sheet.getRange(`A5:F${rows.length + 4}`).format = { font: { name: font, size: 10, color: '#243D34' }, verticalAlignment: 'top', wrapText: true };
sheet.getRange(`A5:C${rows.length + 4}`).format.horizontalAlignment = 'left';
sheet.getRange(`F5:F${rows.length + 4}`).format.horizontalAlignment = 'center';
sheet.getRange(`A5:F${rows.length + 4}`).format.borders = { style: 'continuous', color: '#DCE8E3' };
sheet.getRange(`F5:F${rows.length + 4}`).conditionalFormats.addCustom('=F5="已实现"', { fill: '#E6F6EE', font: { color: '#087E59', bold: true } });
sheet.getRange(`F5:F${rows.length + 4}`).conditionalFormats.addCustom('=F5="规划扩展"', { fill: '#FFF5E5', font: { color: '#9A6512', bold: true } });
sheet.getRange('A:A').format.columnWidth = 16;
sheet.getRange('B:B').format.columnWidth = 20;
sheet.getRange('C:C').format.columnWidth = 16;
sheet.getRange('D:D').format.columnWidth = 28;
sheet.getRange('E:E').format.columnWidth = 66;
sheet.getRange('F:F').format.columnWidth = 14;
sheet.getRange('1:1').format.rowHeight = 28;
sheet.getRange('2:2').format.rowHeight = 22;
sheet.getRange('4:4').format.rowHeight = 24;
sheet.getRange(`5:${rows.length + 4}`).format.rowHeight = 34;
sheet.freezePanes.freezeRows(4);
sheet.tables.add(`A4:F${rows.length + 4}`, true, 'FunctionListTable');

const notes = workbook.worksheets.add('说明与范围');
notes.showGridlines = false;
notes.getRange('A1:D1').merge();
notes.getRange('A1').values = [['功能清单使用说明']];
notes.getRange('A3:B8').values = [
  ['项目', '说明'],
  ['覆盖模块', '供应链碳管理、产品碳足迹'],
  ['覆盖页面', '供应商碳数据采集、产品碳足迹披露、碳足迹项目管理、核算清单、核算结果、报告管理、因子库'],
  ['颗粒度', '模块 → 页面 → 功能分类 → 功能点 → 功能说明'],
  ['状态口径', '已实现：当前前端页面可见并可操作；规划扩展：需求文档已提出但当前页面尚未完整实现。'],
  ['来源', '当前项目 src/app/router.tsx、src/pages/newPrototype/SupplierCarbonManagement.tsx、src/pages/newPrototype/ProductCarbonFootprint.tsx、docs/08-prd-20260818.md'],
];
notes.getRange('A1:D1').format = { font: { name: font, size: 16, bold: true, color: '#183A32' }, horizontalAlignment: 'left', verticalAlignment: 'center' };
notes.getRange('A3:B3').format = { fill: '#0A8F68', font: { name: font, size: 10, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center' };
notes.getRange('A4:B8').format = { font: { name: font, size: 10, color: '#243D34' }, verticalAlignment: 'top', wrapText: true, borders: { style: 'continuous', color: '#DCE8E3' } };
notes.getRange('A:A').format.columnWidth = 18;
notes.getRange('B:B').format.columnWidth = 95;
notes.getRange('1:1').format.rowHeight = 28;
notes.getRange('3:3').format.rowHeight = 24;
notes.getRange('4:7').format.rowHeight = 34;
notes.getRange('8:8').format.rowHeight = 52;

workbook.recalculate();
const check = await workbook.inspect({ kind: 'table', range: `功能清单!A1:F${rows.length + 4}`, include: 'values,formulas', tableMaxRows: 50, tableMaxCols: 6 });
console.log(check.ndjson);
const errors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 100 }, summary: 'final formula error scan' });
console.log(errors.ndjson);
const preview = await workbook.render({ sheetName: '功能清单', range: `A1:F${rows.length + 4}`, scale: 1 });
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(`${outputDir}/功能清单预览.png`, new Uint8Array(await preview.arrayBuffer()));
const notesPreview = await workbook.render({ sheetName: '说明与范围', range: 'A1:D8', scale: 1 });
await fs.writeFile(`${outputDir}/说明与范围预览.png`, new Uint8Array(await notesPreview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);

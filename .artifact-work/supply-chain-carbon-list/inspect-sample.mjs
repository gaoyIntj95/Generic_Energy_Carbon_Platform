import fs from 'node:fs/promises';
import { SpreadsheetFile } from '@oai/artifact-tool';

const inputPath = 'C:/Users/340710/Desktop/曲靖零碳园区项目/能源监测与分析_能耗查询.xlsx';
const outputPath = 'D:/Project/Generic_Energy_Carbon_Platform/.artifact-work/supply-chain-carbon-list/sample-preview.png';

const workbook = await SpreadsheetFile.importXlsx(await fs.readFile(inputPath));
const sheetInfo = await workbook.inspect({ kind: 'sheet', include: 'id,name' });
console.log('SHEETS');
console.log(sheetInfo.ndjson);

const firstSheet = workbook.worksheets.items[0];
const tableInfo = await workbook.inspect({
  kind: 'table',
  range: `${firstSheet.name}!A1:H90`,
  include: 'values,formulas',
  table_max_rows: 90,
  table_max_cols: 8,
});
console.log('FIRST_SHEET_CONTENT');
console.log(tableInfo.ndjson);

const image = await workbook.render({ sheetName: firstSheet.name, range: 'A1:H55', scale: 1.5 });
await fs.writeFile(outputPath, Buffer.from(await image.arrayBuffer()));
console.log(`PREVIEW=${outputPath}`);

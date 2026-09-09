import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL('C:/Users/340710/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/index.js').href);
const inputPath = 'C:/Users/340710/Desktop/功能清单.xlsx';
const outDir = 'D:/Project/Generic_Energy_Carbon_Platform/artifacts/feature-list-update';
await fs.mkdir(outDir, { recursive: true });
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const summary = await workbook.inspect({ kind: 'workbook,sheet,table', maxChars: 12000, tableMaxRows: 40, tableMaxCols: 20, tableMaxCellChars: 120 });
console.log(summary.ndjson);
for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange();
  console.log(`SHEET:${sheet.name}`);
  console.log(JSON.stringify({ values: used?.values, formulas: used?.formulas }, null, 2));
  const preview = await workbook.render({ sheetName: sheet.name, autoCrop: 'all', scale: 1, format: 'png' });
  await fs.writeFile(`${outDir}/${sheet.name.replace(/[\\/:*?"<>|]/g, '_')}.png`, new Uint8Array(await preview.arrayBuffer()));
}

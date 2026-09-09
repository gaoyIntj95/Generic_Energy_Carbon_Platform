import { pathToFileURL } from 'node:url';
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL('C:/Users/340710/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs').href);
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/340710/Desktop/功能清单.xlsx'));
console.log(wb.help('table.rows.add', { include: 'index,examples,notes', maxChars: 4000 }).ndjson);
console.log(wb.help('worksheet.tables', { include: 'index,examples,notes', maxChars: 4000 }).ndjson);

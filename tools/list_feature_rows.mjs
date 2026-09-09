import { pathToFileURL } from 'node:url';
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL('C:/Users/340710/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs').href);
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/340710/Desktop/功能清单.xlsx'));
const rows = wb.worksheets.getItemAt(0).getUsedRange().values;
rows.forEach((r, i) => console.log(`${i + 1}\t${r.slice(0, 4).map(v => v ?? '').join(' | ')}\t${r[4] ?? ''}`));

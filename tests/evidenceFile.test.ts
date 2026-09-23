import { describe, expect, it } from 'vitest';
import { filterEvidenceFiles, isEvidenceFile } from '../src/utils/evidenceFile';

describe('evidence file restrictions', () => {
  it('accepts PDF and common image files', () => {
    expect(isEvidenceFile(new File(['pdf'], 'report.pdf', { type: 'application/pdf' }))).toBe(true);
    expect(isEvidenceFile(new File(['image'], 'receipt.JPG', { type: 'image/jpeg' }))).toBe(true);
    expect(isEvidenceFile(new File(['image'], 'receipt.png', { type: 'image/png' }))).toBe(true);
  });

  it('rejects office documents and filters them out', () => {
    const files = [
      new File(['xlsx'], 'data.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      new File(['docx'], 'note.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      new File(['pdf'], 'report.pdf', { type: 'application/pdf' }),
    ];

    expect(filterEvidenceFiles(files).map((file) => file.name)).toEqual(['report.pdf']);
  });
});

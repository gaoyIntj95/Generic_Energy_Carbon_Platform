const IMAGE_EXTENSIONS = new Set(['bmp', 'gif', 'jpeg', 'jpg', 'png', 'tif', 'tiff', 'webp']);

export const EVIDENCE_FILE_ACCEPT = 'application/pdf,image/*';

export function isEvidenceFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return extension === 'pdf' || IMAGE_EXTENSIONS.has(extension);
}

export function filterEvidenceFiles(files: File[]) {
  return files.filter(isEvidenceFile);
}

export function isEvidenceFileName(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return extension === 'pdf' || IMAGE_EXTENSIONS.has(extension);
}

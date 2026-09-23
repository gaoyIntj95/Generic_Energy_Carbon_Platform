import type { DragEvent, ChangeEvent } from 'react';
import styles from './FileDropzone.module.css';

type FileDropzoneProps = {
  title: string;
  hint: string;
  name?: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  clearAfterChange?: boolean;
  onFiles: (files: File[]) => void;
};

export function FileDropzone({ title, hint, name, accept, multiple = false, required = false, clearAfterChange = true, onFiles }: FileDropzoneProps) {
  const normalizedHint = hint.replace(/支持 PDF、XLSX、DOCX、JPG、PNG/g, '仅支持 PDF 或图片');
  const displayHint = normalizedHint.includes('仅支持 PDF 或图片') ? normalizedHint : `${normalizedHint}（仅支持 PDF 或图片）`;
  const handleFiles = (files: FileList | File[]) => onFiles(Array.from(files));
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) handleFiles(event.target.files);
    if (clearAfterChange) event.target.value = '';
  };
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files.length) handleFiles(event.dataTransfer.files);
  };
  return <label className={styles.dropzone} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
    <input className={styles.input} name={name} type="file" accept={accept} multiple={multiple} required={required} onChange={handleChange} />
    <span className={styles.icon} aria-hidden="true">↑</span>
    <strong>{title}{required && <em>*</em>}</strong>
    <small>{displayHint}</small>
    <span className={styles.choose}>选择文件</span>
  </label>;
}

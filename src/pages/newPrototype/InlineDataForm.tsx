import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Button, Modal } from './PrototypeUI';
import styles from './DataManagementV11.module.css';

export function InlineDataForm({ title, description, children, onClose, onSubmit, footer, submitText = '保存', draft, onDirtyChange }: ComponentProps<typeof Modal> & { draft?: unknown; onDirtyChange?: (dirty: boolean) => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [initialDraft] = useState(() => JSON.stringify(draft));
  const dirty = JSON.stringify(draft) !== initialDraft;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    const section = ref.current?.parentElement;
    ref.current?.querySelector<HTMLElement>('input:not([readonly]):not(:disabled), select:not(:disabled), textarea:not([readonly])')?.focus();
    return () => { queueMicrotask(() => { if (section?.isConnected && !section.querySelector('form')) section.querySelector<HTMLElement>('button')?.focus(); }); };
  }, []);
  return <form ref={ref} className={styles.inlineDataForm} data-inline-editor aria-label={title} onSubmit={(event) => { event.preventDefault(); if (event.currentTarget.reportValidity()) onSubmit?.(); }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <header><h3>{title}</h3>{description && <p>{description}</p>}</header>
    {children}
    <footer>{footer ?? <><Button onClick={onClose}>取消</Button><Button primary type="submit">{submitText}</Button></>}</footer>
  </form>;
}

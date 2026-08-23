import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className={styles.header}>
      <h1>{title}</h1>
      {description && <p title={description}>{description}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

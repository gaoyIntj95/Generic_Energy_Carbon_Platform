import styles from './PageHeader.module.css';

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className={styles.header}>
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
    </header>
  );
}

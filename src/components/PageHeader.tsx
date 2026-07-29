import styles from './PageHeader.module.css';

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return <div className={styles.header}><div><h1>{title}</h1><p>{description}</p></div></div>;
}

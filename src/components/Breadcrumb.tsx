import styles from './Breadcrumb.module.css';

export function Breadcrumb({ items }: { items: string[] }) {
  return (
    <nav className={styles.breadcrumb} aria-label="面包屑">
      {items.map((item, index) => (
        <span className={styles.item} key={`${item}-${index}`}>
          {index > 0 && <span className={styles.separator} aria-hidden="true">/</span>}
          <span>{item}</span>
        </span>
      ))}
    </nav>
  );
}

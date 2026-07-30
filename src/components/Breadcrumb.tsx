import styles from './Breadcrumb.module.css';

export function Breadcrumb({ group, page }: { group: string; page: string }) {
  return <div className={styles.breadcrumb} aria-label="面包屑"><span>工业企业能碳管理平台</span><span className={styles.separator}>/</span><span>{group}</span><span className={styles.separator}>/</span><strong>{page}</strong></div>;
}

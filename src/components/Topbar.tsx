import styles from './Topbar.module.css';

export function Topbar() {
  return <header className={styles.topbar}>
    <div className={styles.tools}><button type="button" aria-label="打开菜单">☰</button></div>
    <div className={styles.actions}><button type="button" aria-label="消息">♧</button><button type="button" aria-label="应用">▥</button><button type="button" aria-label="帮助">?</button><span className={styles.avatar}>管</span></div>
  </header>;
}

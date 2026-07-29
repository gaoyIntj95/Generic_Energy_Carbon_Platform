import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { navigation, type NavDisplayEntry, type NavItem, type NavSection } from '../app/router';
import styles from './Sidebar.module.css';

function isSection(entry: NavDisplayEntry): entry is NavSection {
  return 'items' in entry;
}

function MenuLink({ item, nested = false }: { item: NavItem; nested?: boolean }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => `${styles.item} ${nested ? styles.nestedItem : ''} ${isActive ? styles.active : ''}`}
    >
      {item.label}
    </NavLink>
  );
}

export function Sidebar() {
  const location = useLocation();
  const activeGroupKey = useMemo(
    () => navigation.find((group) => group.items.some((item) => item.path === location.pathname))?.key,
    [location.pathname],
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>({ 'supply-chain-carbon': true });
  const [compact, setCompact] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    window.requestAnimationFrame(() => {
      navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
    });
  }, [location.pathname]);
  const toggleCompact = () => {
    const next = !compact;
    setCompact(next);
    document.documentElement.style.setProperty('--sidebar-width', next ? '72px' : '214px');
  };

  return (
    <aside className={`${styles.sidebar} ${compact ? styles.compact : ''}`} aria-label="主导航">
      <div className={styles.brand}><span className={styles.logo}>▥</span><span>通用能碳平台</span></div>
      <nav className={styles.nav} ref={navRef}>
        {navigation.map((group) => {
          const isCollapsed = group.key === activeGroupKey ? false : collapsed[group.key] ?? false;
          const isActiveGroup = group.key === activeGroupKey;
          const entries = group.display ?? group.items;
          return (
            <div className={styles.group} key={group.key}>
              <button
                className={`${styles.groupButton} ${isActiveGroup ? styles.groupActive : ''}`}
                onClick={() => setCollapsed((value) => ({ ...value, [group.key]: !isCollapsed }))}
                aria-expanded={!isCollapsed}
              >
                <span className={styles.chevron}>{isCollapsed ? '›' : '⌄'}</span>
                <span>{group.label}</span>
              </button>
              {!isCollapsed && (
                <div className={styles.items}>
                  {entries.map((entry) => {
                    if (!isSection(entry)) return <MenuLink key={entry.path} item={entry} />;
                    const sectionClosed = sectionCollapsed[entry.key] ?? false;
                    const sectionActive = entry.items.some((item) => item.path === location.pathname);
                    return (
                      <div className={styles.section} key={entry.key}>
                        <button
                          className={`${styles.sectionButton} ${sectionActive ? styles.sectionActive : ''}`}
                          type="button"
                          onClick={() => setSectionCollapsed((value) => ({ ...value, [entry.key]: !sectionClosed }))}
                          aria-expanded={!sectionClosed}
                        >
                          <span>{sectionClosed ? '›' : '⌄'}</span>{entry.label}
                        </button>
                        {!sectionClosed && entry.items.map((item) => <MenuLink nested key={item.path} item={item} />)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <button className={styles.collapseButton} type="button" onClick={toggleCompact} aria-label={compact ? '展开菜单' : '收起菜单'}>{compact ? '≫' : '≪　收起菜单'}</button>
    </aside>
  );
}

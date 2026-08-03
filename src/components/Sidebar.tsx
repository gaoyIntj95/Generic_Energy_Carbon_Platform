import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  navigation,
  type NavDisplayEntry,
  type NavItem,
  type NavPlaceholder,
  type NavSection,
} from '../app/router';
import styles from './Sidebar.module.css';

function isSection(entry: NavDisplayEntry): entry is NavSection {
  return 'items' in entry;
}

function isPlaceholder(item: NavDisplayEntry): item is NavPlaceholder {
  return 'planned' in item;
}

const iconNames: Record<string, string> = {
  能源监测与分析: 'energy',
  碳排放核算与合规: 'carbon',
  能碳资产运营与策略: 'asset',
  数据管理: 'data',
  碳排放核算: 'calculation',
  碳因子参数: 'factor',
  供应链碳管理: 'supply',
  碳排放预览: 'preview',
  碳核算清单: 'inventory',
  碳核查支撑: 'support',
  碳排放报告: 'report',
  碳足迹核算: 'footprint',
  能耗查询: 'preview',
  能耗强度指标: 'analysis',
  能效对标: 'balance',
  能流分析: 'energyData',
  能源平衡与优化: 'balance',
  用能分析与策略推荐: 'analysis',
  用能与碳排放预算管理: 'budget',
  碳资产管理: 'assetManagement',
  用能单元: 'units',
  能源品种: 'energyType',
  能源数据: 'energyData',
  运营数据: 'operation',
  重点设备: 'device',
};

function MenuIcon({ name }: { name: string }) {
  const type = iconNames[name] ?? 'default';
  if (type === 'brand') return null;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {type === 'energy' && <><path d="M4 18V9m5 9V5m5 13v-7m5 7V3" /><path d="M3 21h18" /></>}
      {type === 'carbon' && <><path d="M7 3h10l3 4v10l-3 4H7l-3-4V7z" /><path d="M9 12l2 2 4-5" /></>}
      {type === 'asset' && <><path d="M12 3v9h9" /><path d="M20 15a9 9 0 1 1-11-11" /></>}
      {type === 'data' && <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 12l9 5 9-5M3 16l9 5 9-5" /></>}
      {type === 'calculation' && <><path d="M18.5 4.5C12 4 7.5 7.4 7 13.5c5.8.5 9.8-2.6 11.5-9z" /><path d="M6 20c1-5 4-8 8-10" /></>}
      {type === 'factor' && <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>}
      {type === 'supply' && <><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>}
      {type === 'preview' && <><path d="M4 5h16v12H4zM8 21h8M12 17v4" /><path d="M7 13l3-3 2 2 4-5" /></>}
      {type === 'inventory' && <><path d="M8 4h8v3H8z" /><path d="M6 5H4v16h16V5h-2M8 11h8M8 15h8" /></>}
      {type === 'support' && <><path d="M12 3l8 4v5c0 4.5-3.2 7.5-8 9-4.8-1.5-8-4.5-8-9V7z" /><path d="M8.5 12l2.2 2.2L16 9" /></>}
      {type === 'report' && <><path d="M5 3h10l4 4v14H5zM15 3v5h4" /><path d="M8 12h6M8 16h4" /><circle cx="17" cy="16" r="3" /></>}
      {type === 'footprint' && <><path d="M11 8c1-3 0-5-2-5S6 6 7 9s3 4 4-1zM16 13c3-1 5 0 5 2s-3 3-6 2-4-3 1-4z" /><path d="M5 12c3-1 6 1 8 4 1 2 0 5-3 5-4 0-8-4-8-7 0-1 1-2 3-2z" /></>}
      {type === 'balance' && <><path d="M4 18h16M6 15l3-4 3 2 5-7" /><circle cx="17" cy="6" r="2" /></>}
      {type === 'analysis' && <><path d="M4 19l5-6 4 3 7-10" /><path d="M15 6h5v5" /></>}
      {type === 'budget' && <><path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h3" /><path d="M16 15l3 3" /></>}
      {type === 'database' && <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>}
      {type === 'assetManagement' && <><path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M4 7V5a2 2 0 0 1 2-2h10" /><path d="M15 11h5v6h-5a3 3 0 0 1 0-6z" /><circle cx="16" cy="14" r=".8" /></>}
      {type === 'units' && <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>}
      {type === 'energyType' && <><path d="M13 2L5 14h7l-1 8 8-12h-7z" /></>}
      {type === 'energyData' && <><path d="M4 19V9m5 10V5m5 14v-7m5 7V3" /><path d="M3 21h18" /></>}
      {type === 'operation' && <><circle cx="12" cy="12" r="9" /><path d="M12 3v9h9" /></>}
      {type === 'device' && <><rect x="3" y="6" width="14" height="12" rx="2" /><path d="M17 10h4v4h-4M7 10h6v4H7z" /></>}
      {type === 'default' && <><circle cx="12" cy="12" r="8" /><path d="M8 12h8" /></>}
    </svg>
  );
}

function MenuLink({ item, nested = false }: { item: NavItem; nested?: boolean }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => `${styles.item} ${nested ? styles.nestedItem : ''} ${isActive ? styles.active : ''}`}
      title={item.label}
    >
      <span className={styles.branchDot} />
      <span className={styles.itemIcon}><MenuIcon name={item.label} /></span>
      <span className={styles.itemLabel}>{item.label}</span>
    </NavLink>
  );
}

function PlannedMenuItem({ item, nested = false }: { item: NavPlaceholder; nested?: boolean }) {
  return (
    <div className={`${styles.item} ${nested ? styles.nestedItem : ''} ${styles.plannedItem}`} aria-disabled="true" title={item.description}>
      <span className={styles.branchDot} />
      <span className={styles.itemIcon}><MenuIcon name={item.label} /></span>
      <span className={styles.itemLabel}>{item.label}</span>
      <span className={styles.plannedBadge}>{item.badge}</span>
    </div>
  );
}

export function Sidebar() {
  const location = useLocation();
  const activeGroupKey = useMemo(
    () => navigation.find((group) => group.items.some((item) => item.path === location.pathname))?.key,
    [location.pathname],
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>({});
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
    document.documentElement.style.setProperty('--sidebar-width', next ? '72px' : '300px');
  };

  return (
    <aside className={`${styles.sidebar} ${compact ? styles.compact : ''}`} aria-label="主导航">
      <div className={styles.brand}><span className={styles.logo}><span /><span /></span><span>工业企业能碳管理平台</span></div>
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
                <span className={styles.groupIcon}><MenuIcon name={group.label} /></span>
                <span className={styles.groupLabel}>{group.label}</span>
                <span className={styles.chevron}>{isCollapsed ? '⌄' : '⌃'}</span>
              </button>
              {!isCollapsed && (
                <div className={styles.items}>
                  {entries.map((entry) => {
                    if (isPlaceholder(entry)) return <PlannedMenuItem key={entry.key} item={entry} />;
                    if (!isSection(entry)) return <MenuLink key={entry.path} item={entry} />;
                    const sectionClosed = sectionCollapsed[entry.key] ?? false;
                    const sectionActive = entry.items.some((item) => !isPlaceholder(item) && item.path === location.pathname);
                    return (
                      <div className={`${styles.section} ${sectionClosed ? '' : styles.sectionOpen}`} key={entry.key}>
                        <button
                          className={`${styles.sectionButton} ${sectionActive ? styles.sectionActive : ''}`}
                          type="button"
                          onClick={() => setSectionCollapsed((value) => ({ ...value, [entry.key]: !sectionClosed }))}
                          aria-expanded={!sectionClosed}
                        >
                          <span className={styles.sectionIcon}><MenuIcon name={entry.label} /></span>
                          <span className={styles.sectionLabel}>{entry.label}</span>
                          <span className={styles.sectionChevron}>{sectionClosed ? '⌄' : '⌃'}</span>
                        </button>
                        {!sectionClosed && (
                          <div className={styles.sectionItems}>
                            {entry.items.map((item) => isPlaceholder(item)
                              ? <PlannedMenuItem nested key={item.key} item={item} />
                              : <MenuLink nested key={item.path} item={item} />)}
                          </div>
                        )}
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

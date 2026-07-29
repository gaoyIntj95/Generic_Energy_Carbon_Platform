import { Outlet, useLocation } from 'react-router-dom';
import { navigation } from '../app/router';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageHeader } from '../components/PageHeader';
import styles from './AppShell.module.css';

export function AppShell() {
  const location = useLocation();
  const active = navigation.flatMap((group) => group.items).find((item) => item.path === location.pathname);
  const activeGroup = navigation.find((group) => group.items.some((item) => item.path === location.pathname));
  const isEnergyDataPage = [
    '/data-management/energy-consumption',
    '/data-management/energy-costs',
    '/data-management/energy-relations',
  ].includes(location.pathname);
  const pageTitle = location.pathname === '/carbon-accounting/factors'
    ? '碳排放因子与参数库'
    : isEnergyDataPage
      ? '能源数据'
      : active?.label ?? '页面';
  const pageDescription = isEnergyDataPage
    ? '按数据角色和组织层级录入能源量数据，系统自动形成输入、分配、利用和外部输出，仅对锅炉、余热发电等配置转换关系。'
    : active?.description;

  return (
    <div className={styles.app}>
      <Sidebar />
      <div className={styles.main}>
        <Topbar />
        <main className={styles.content}>
          <Breadcrumb group={activeGroup?.label ?? '平台'} page={active?.label ?? '页面'} />
          <PageHeader title={pageTitle} description={pageDescription} />
          <section className={styles.pageSurface} aria-label="页面内容">
            <Outlet />
          </section>
        </main>
      </div>
    </div>
  );
}

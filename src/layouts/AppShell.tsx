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
    '/data-management/energy-data',
    '/data-management/energy-consumption',
    '/data-management/energy-costs',
    '/data-management/energy-relations',
  ].includes(location.pathname);
  const pageTitle = isEnergyDataPage
    ? '能源数据'
    : active?.pageTitle ?? active?.label ?? '页面';
  const pageDescription = isEnergyDataPage
    ? '按企业及用能单元层级维护能源量和能源成本；锅炉、余热发电、自发电、回收利用及外供统一在能源转换与输出中维护。'
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

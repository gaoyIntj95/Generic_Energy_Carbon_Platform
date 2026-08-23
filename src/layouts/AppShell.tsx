import { useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { navItemMatches, navigation } from '../app/router';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageHeader } from '../components/PageHeader';
import { PageHeaderActionsProvider } from '../components/PageHeaderActionsContext';
import styles from './AppShell.module.css';

export function AppShell() {
  const [pageHeaderActions, setPageHeaderActions] = useState<ReactNode>(null);
  const location = useLocation();
  const active = navigation.flatMap((group) => group.items).find((item) => navItemMatches(item, location.pathname, location.search));
  const activeGroup = navigation.find((group) => group.items.some((item) => (
    navItemMatches(item, location.pathname, location.search)
    || item.path.split('?')[0] === location.pathname
  )));
  const isEnergyDataPage = [
    '/data-management/energy-data',
    '/data-management/energy-consumption',
    '/data-management/energy-costs',
    '/data-management/energy-relations',
  ].includes(location.pathname);
  const energyDataView = new URLSearchParams(location.search).get('tab');
  const energyDataMeta = energyDataView === 'costs'
    ? { title: '能源成本', description: '维护企业能源品种的采购及使用成本，为成本分析、预算与优化提供数据基础。' }
    : energyDataView === 'conversion' || energyDataView === 'recovery'
      ? { title: '能源回收、转换与外供', description: '维护能源回收、能源转换和能源外供数据，为能流图、平衡表和流向明细提供数据支撑。' }
      : { title: '能源消费', description: '按企业及用能单元层级维护能源消费量，用于能源输入、分配和利用分析。' };
  const pageTitle = isEnergyDataPage
    ? energyDataMeta.title
    : active?.pageTitle ?? active?.label ?? '页面';
  const pageDescription = isEnergyDataPage
    ? energyDataMeta.description
    : active?.description;
  const breadcrumbItems = [
    activeGroup?.label ?? '平台',
    ...(isEnergyDataPage ? ['能源数据'] : []),
  ];
  return (
    <PageHeaderActionsProvider setActions={setPageHeaderActions}>
      <div className={styles.app}>
      <Sidebar />
      <div className={styles.main}>
        <Topbar />
        <main className={styles.content}>
          <div className={styles.pageIntro}>
            <Breadcrumb items={breadcrumbItems} />
            <span className={styles.pathSeparator} aria-hidden="true">/</span>
            <PageHeader title={pageTitle} description={pageDescription} actions={pageHeaderActions} />
          </div>
          <section className={styles.pageSurface} aria-label="页面内容">
            <Outlet />
          </section>
        </main>
      </div>
      </div>
    </PageHeaderActionsProvider>
  );
}

import { useState } from 'react';
import { collectSourceNow, listCollectionSources } from '../../mocks/platformMockStore';
import type { DataCollectionSource } from '../../types/platformDomain';
import { Button, Card, DataTable, Drawer, Field, FilterBar, SectionHead, Tag, Toast, s, type TableColumn } from './PrototypeUI';

export function DataCollectionPage() {
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [state, setState] = useState('全部');
  const [appliedState, setAppliedState] = useState('全部');
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState('');
  const [detail, setDetail] = useState<DataCollectionSource | null>(null);
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 1800);
  };
  const data = listCollectionSources().filter((source) => (!query || source.sourceName.includes(query)) && (appliedState === '全部' || source.collectionState === appliedState));
  const columns: TableColumn<DataCollectionSource>[] = [
    { key: 'sourceName', title: '数据来源', width: 180 },
    { key: 'sourceType', title: '来源模块', width: 130 },
    { key: 'relatedDomain', title: '关联领域对象', width: 180 },
    { key: 'recordCount', title: '记录数量', width: 110 },
    { key: 'lastCollectedAt', title: '最近采集时间', width: 170 },
    { key: 'collectionState', title: '采集状态', width: 100, render: (source) => <Tag tone={source.collectionState === '正常' ? 'green' : 'orange'}>{source.collectionState}</Tag> },
    { key: 'action', title: '操作', width: 190, render: (source) => <><button className={s.link} onClick={() => setDetail(source)}>查看</button><button className={s.link} onClick={() => { collectSourceNow(source.collectionSourceId); setVersion((value) => value + 1); notify(`${source.sourceName}已完成演示采集`); }}>立即采集</button></> },
  ];
  void version;
  return <div className={s.page}>
    <FilterBar onSearch={() => { setQuery(keyword.trim()); setAppliedState(state); }} onReset={() => { setKeyword(''); setQuery(''); setState('全部'); setAppliedState('全部'); }}>
      <Field label="关键字"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="数据来源名称" /></Field>
      <Field label="采集状态"><select value={state} onChange={(event) => setState(event.target.value)}><option>全部</option><option>正常</option><option>待补传</option><option>需核验</option></select></Field>
    </FilterBar>
    <Card className={s.cardPad}><SectionHead title="能碳数据采集" sub="菜单来源于最新确认截图；reference/new 当前无独立数据采集 HTML。" actions={<Button primary onClick={() => { listCollectionSources().forEach((source) => collectSourceNow(source.collectionSourceId)); setVersion((value) => value + 1); notify('全部来源已完成演示采集'); }}>全部采集</Button>} /><DataTable columns={columns} data={data} rowKey={(source) => source.collectionSourceId} /></Card>
    <Toast message={toast} />
    {detail && <Drawer title={`${detail.sourceName}｜采集详情`} width={500} onClose={() => setDetail(null)}><div className={s.summary}><div><span>关联领域对象</span><strong>{detail.relatedDomain}</strong></div><div><span>记录数量</span><strong>{detail.recordCount}</strong></div><div><span>采集状态</span><strong>{detail.collectionState}</strong></div></div><h3 className={s.dividerTitle}>数据说明</h3><div className={s.info}>本页只读取集中式前端 Mock 数据，立即采集会更新采集时间与采集状态，不连接后端任务。</div></Drawer>}
  </div>;
}

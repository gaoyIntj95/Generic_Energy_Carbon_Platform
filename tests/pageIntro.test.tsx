import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Breadcrumb } from '../src/components/Breadcrumb';
import { PageHeader } from '../src/components/PageHeader';

describe('unified page introduction', () => {
  it('keeps the current page out of a single-level parent breadcrumb', () => {
    const markup = renderToStaticMarkup(<Breadcrumb items={['能源监测与分析']} />);

    expect(markup).toContain('aria-label="面包屑"');
    expect(markup).toContain('能源监测与分析');
    expect(markup).not.toContain('能耗查询');
    expect(markup).not.toContain('工业企业能碳管理平台');
  });

  it('shows the full parent path for a nested menu page', () => {
    const markup = renderToStaticMarkup(<Breadcrumb items={['数据管理', '能源数据']} />);

    expect(markup).toContain('数据管理');
    expect(markup).toContain('能源数据');
    expect(markup).not.toContain('能源成本');
  });

  it('renders the page title and its lightweight description together', () => {
    const description = '查询和分析能源消费数据，掌握能耗趋势与能源结构。';
    const markup = renderToStaticMarkup(<PageHeader title="能耗查询" description={description} />);

    expect(markup).toContain('<h1>能耗查询</h1>');
    expect(markup).toContain(`title="${description}"`);
    expect(markup).toContain(`<p title="${description}">${description}</p>`);
  });
});

# 工业企业能碳管理平台

面向工业企业的能碳 SaaS 前端原型，采用 React、TypeScript 与 Vite 构建。项目包含数据管理、能源监测与分析、碳排放核算与合规、能碳资产运营与策略四个模块，并使用集中式 Mock 数据支撑演示交互。

## 目录

- `docs/`：产品范围、页面、设计、交互、数据与验收文档
- `reference/`：参考 HTML 页面与截图
- `src/`：应用、布局、组件、图表、业务模块及基础设施
- `tests/`：交互测试与视觉测试

## 本地运行

```bash
npm install
npm run dev
```

质量检查命令：`npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`。

## GitHub Pages

推送到 `main` 分支后，`.github/workflows/deploy-pages.yml` 会自动执行质量检查、构建并发布 `dist`。线上版本使用 Hash 路由，确保 GitHub Pages 刷新业务页面时不会返回 404。

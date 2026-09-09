# 项目交接包

> 交接基线：2026-08-31。本文基于当前工作树、`docs/` 业务文档、`src/` 源码、`tests/` 测试及本地质量检查整理。它描述的是“当前实现”，不是后端接口或最终产品规格。

## 1. 一句话定位

这是一个面向工业企业的能碳管理 SaaS 前端高保真交互原型，使用 React 19 + TypeScript + Vite 构建。当前没有真实 API、数据库、登录鉴权或服务端计算；页面行为由进程内 Mock Store 和页面局部状态驱动。

## 2. 当前功能地图

统一壳层位于 `src/layouts/AppShell.tsx`，导航定义位于 `src/app/router.tsx`，页面由 `src/pages/PlatformPage.tsx` 按路径分发。

| 模块 | 路由 | 当前实现 |
| --- | --- | --- |
| 数据管理 | `/data-management/units` | 两级用能单元树，新增、编辑、删除、同级排序及引用阻断 |
| 数据管理 | `/data-management/energy-types` | 能源品种、计量单位、折标系数及引用关系 |
| 数据管理 | `/data-management/energy-data` | 能源消费、能源成本、能源回收/转换/外供三个 Tab；支持年度/月度录入和明细 |
| 数据管理 | `/data-management/operations` | 产量、经济指标等运营数据 |
| 数据管理 | `/data-management/devices` | 重点设备档案及设备能源数据入口 |
| 能源监测与分析 | `/energy-analysis/consumption-query` | 能耗查询、月度/年度结果和明细 |
| 能源监测与分析 | `/energy-analysis/intensity` | 能耗强度指标、趋势、计算口径、产品/设备等对象 |
| 能源监测与分析 | `/energy-analysis/benchmarking` | 实际值与目标值对标 |
| 能源监测与分析 | `/energy-analysis/flow-analysis` | 能流图、能源平衡表、流向明细，当前一期为企业/一级用能单元口径 |
| 碳排放核算与合规 | `/carbon-accounting/preview` | 排放总量、构成及趋势 |
| 碳排放核算与合规 | `/carbon-accounting/inventory` | 核算清单、排放源、活动数据、正式快照 |
| 碳排放核算与合规 | `/carbon-accounting/support` | 核算基础材料和排放源支撑材料 |
| 碳排放核算与合规 | `/carbon-accounting/report` | 报告列表及核查资料包导出原型 |
| 碳排放核算与合规 | `/carbon-accounting/factors` | 公共/企业/历史因子、启停用、复制和导入原型 |
| 能碳资产运营与策略 | `/asset-strategy/balance` | 能效平衡、异常诊断、任务处理和 AI 深度诊断抽屉 |
| 能碳资产运营与策略 | `/asset-strategy/analysis` | 用能、成本、强度分析及策略建议 |
| 能碳资产运营与策略 | `/asset-strategy/budget` | 能源/碳排预算、目标配置、预测、执行详情 |
| 能碳资产运营与策略 | `/asset-strategy/assets` | 碳配额、CCER、绿证折算减排量和履约测算 |

“碳足迹核算”和“供应链碳管理”已在导航中作为规划中占位，不应当作可用页面。旧路径会通过 `Navigate` 重定向到当前页面；生产环境使用 Hash Router，开发环境使用 Browser Router。

## 3. 代码组织与数据边界

- `src/app/`：应用入口、Provider 占位、路由与导航元数据。
- `src/layouts/`、`src/components/`：后台壳层、侧栏、顶部栏、面包屑、页面标题。
- `src/pages/newPrototype/`：当前主页面实现。文件较大，V4/V11/V2 后缀对应原型迭代版本，不代表后端版本。
- `src/mocks/platformMockStore.ts`：跨模块老版/通用 Mock Store，包含能源、碳核算、预算、策略、资产、采集源等对象及增删改查。
- `src/mocks/dataManagementV11Store.ts`：数据管理 V11 的新数据模型和写入逻辑。
- `src/mocks/energyFlowSelector.ts`：能流分析共享数据集、平衡计算、月份/年度口径。
- `src/mocks/energyIntensitySelector.ts`、`energyBenchmarkSelector.ts`：指标对象、计算和对标数据选择器。
- `src/mocks/energyUnitMockStore.ts`：两级用能单元及删除/排序/引用校验。
- `src/mocks/balanceOptimizationStore.ts`：能效平衡问题处理状态，使用模块级 `Map`。
- `src/types/platformDomain.ts`：跨模块领域类型；`src/types/energyUnit.ts`、`product.ts` 为专项类型。
- `src/pages/newPrototype/PrototypeUI.tsx`：原型共享 UI（Card、Button、Tabs、FilterBar、Modal、Drawer、Table、KPI、图表等）。

Mock Store 都是模块级变量：刷新页面会回到种子数据，测试之间通常依赖各 Store 的 `reset...Store()`。它们不是浏览器持久化，也不是可直接替换成 API 的 repository 层；接入真实服务时建议先抽取 service/repository 和 query/mutation 边界。

## 4. 业务口径（交接时不可随意改动）

### 能流一期

- 主口径为折标量 `tce`，流向明细同时展示实物量、原始单位、折标量和折标系数。
- 企业级能源消费是企业边界输入；一级用能单元消费是一级分配；二级用能单元和设备一期不纳入能流分析。
- 年度优先使用年度值；没有年度补录值时才汇总已填月度值。年度值不能自动平均或静默分摊到月度。
- 月度缺失必须显示数据质量提示；不得把年度值伪装成当前月数据。
- 转换关系通过上游能源记录 ID、转换系统 ID 和内部产出去向 ID 追踪，避免重复计入企业输入。
- 平衡式：`外部输入 + 内部回收 + 转换产出 = 转换投入 + 一级内部配置 + 外部输出 + 未分配量`。
- 未分配量是管理口径差额，不等同于物理损失；能流图、KPI、TOP5、平衡表、流向明细必须引用同一分析数据集。

### 能效平衡诊断

- AI 不参与异常判定；结构化规则先产生 `DiagnosticIssue`，AI 只解释原因、方向和行动建议。
- 一期只计算全企业级未匹配能源，不生成对象级能源分配异常。
- A 类为对标偏差，B 类为同比/环比趋势，C 类为数据完整性；详情弹窗必须保留诊断类型。
- 默认关注阈值为 8%，高风险阈值为 15%；未配置目标、不完整和不适用不能直接判为异常。
- 规则编码、动作编码和字段映射以 `docs/09-balance-diagnosis-rule-contract.md` 为准。

### 碳核算与资产

- 排放量基本关系为活动数据 × 排放因子；正式发布通过 `publishCarbonSnapshot()` 固化版本快照，避免草稿修改影响历史结果。
- 自动识别的能源关联排放源通常不可直接删除；手动源、支撑材料、活动记录和因子版本存在关联。
- 预算目标保存会将同口径旧的生效版本标为历史版本，再创建新版本。
- 碳资产保存会校验锁定量/使用量不超过总量，计算“可用/部分使用/已用尽/待核验”状态；有使用量或锁定量的资产不能删除。

## 5. 本地开发与发布

```bash
npm install
npm run dev

# 质量检查
npm run typecheck
npm run lint
npm run test
npm run build
```

开发端口为 `5173`，预览端口为 `4173`。`vite.config.ts` 的生产 base 为 `/Generic_Energy_Carbon_Platform/`。GitHub Pages 工作流位于 `.github/workflows/deploy-pages.yml`，仅对 `main` 推送自动发布，并要求 typecheck、lint、test、build 全部通过。

## 6. 质量基线（2026-08-31 本地执行）

- `npm run typecheck`：通过。
- `npm run build`：通过；产物 JS 约 987 kB，Vite 给出超过 500 kB 的 chunk 警告，后续可做路由级懒加载/拆包。
- `npm run lint`：失败，84 errors / 13 warnings。主要包括未使用变量/组件、Hook 依赖、effect 内同步 setState，以及 `tools/*.mjs` 在当前 ESLint 环境下的 `console` 未定义。该问题会阻断现有 GitHub Actions。
- `npm run test -- --run`：失败，10 个测试文件中 5 个失败；110 个测试中 77 通过、33 失败。失败集中在 `energyUnitsPage.test.tsx`、`carbonAccountingV4.test.tsx`、`energyAnalysisV4.test.tsx`、`dataManagementV11.test.tsx` 和相关交互/文案/选择器契约，测试过程伴随 React 19 `act(...)` 环境警告。

失败测试应先区分两类：一类是实现与最新原型/测试契约漂移（例如文案、按钮、选择器、数据记录数量）；另一类是测试环境/React 19 act 警告。不要为了“全绿”直接删掉业务断言，先确认以 `docs/`、最新 reference 原型还是当前产品决定为准。

## 7. 当前工作树注意事项

交接扫描时分支为 `2026-08-23`，HEAD 为 `af910f3c`（“更新碳核查支撑与报告导出页面”），与 `origin/2026-08-23` 同步。工作树存在用户已有改动和未跟踪文件，主要包括：

- 已修改：`src/pages/newPrototype/AssetOperationsV2.tsx`、一个 2026-08-23 修订版 PRD docx。
- 未跟踪：`.codex/`、若干 PRD/架构图导出文件，以及 `tools/inspect_feature_list*.mjs`、`list_feature_rows.mjs`、`table_help.mjs`、`update_feature_list.mjs`、`verify_feature_list.mjs`。

这些文件不是本次交接整理创建的内容，后续开发不要用 reset/checkout 覆盖；提交前应由负责人决定是否纳入版本库、归档或加入 `.gitignore`。

## 8. 已知风险与推荐接手顺序

1. 先确认产品事实源：`docs/` 中 `01-product-scope.md` 与 `06-acceptance-checklist.md` 仍是“待补充”，而 `02`—`09` 是审计/契约和当前迭代约束；四份 `reference/new/` HTML 是高保真交互参考。
2. 先修质量门禁：清理 lint 错误，并逐组修复 33 个失败测试；每次修复后重新运行单文件测试，避免大文件页面继续积累废弃组件。
3. 稳定数据契约：统一 `platformMockStore` 与 `dataManagementV11Store`，明确哪些是兼容层，避免同一业务对象由两套种子数据产生不同结果。
4. 抽取真实后端边界：组织、用户权限、任务、导入导出、附件、版本锁定、因子审批、审计日志、API 错误处理目前都未落地。
5. 再做性能和可维护性：按路由动态加载页面，拆分超大 TSX/CSS 文件，补充错误边界、空态、加载态和可访问性回归。
6. 最后补齐发布验收：GitHub Pages workflow 当前会被 lint/test 失败阻断；发布前需要确认 Hash Router、base 路径和深链接刷新行为。

## 9. 交接入口文件

新开发者建议按以下顺序阅读：

1. `README.md`、本文件、`AGENTS.md`
2. `docs/01-product-scope.md`、`docs/02-page-inventory.md`、`docs/07-energy-flow-data-contract.md`、`docs/09-balance-diagnosis-rule-contract.md`
3. `src/app/router.tsx`、`src/pages/PlatformPage.tsx`、`src/layouts/AppShell.tsx`
4. 对应页面文件和对应 Mock Store
5. 对应 `tests/*.test.tsx` / `tests/*.test.ts`

交接原则：先保持既有页面行为和业务口径，再引入后端；任何修改能流、碳快照、预算版本或诊断规则的代码，都必须同时更新契约文档和测试。

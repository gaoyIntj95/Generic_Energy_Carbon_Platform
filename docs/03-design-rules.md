# 设计规则审计

## 已从原型提取的规则

- 整体为左侧固定导航 + 顶部栏 + 内容区的后台布局；数据管理原型使用约 220px 左侧导航，资产策略原型约 220px，能源监测原型采用同类固定侧栏。
- 主色以绿色为核心，能源监测、碳排结果、警告和因子类型使用蓝、橙、红、紫等语义色。不同 HTML 的色值并不完全统一，不能直接视为最终设计 Token。
- 默认字体为中文无衬线字体，原型中主要使用 `Microsoft YaHei`、`PingFang SC`、Arial。
- 页面普遍使用白色卡片、浅灰背景、浅边框、圆角 6—10px 和轻阴影。
- 交互控件以 35—37px 高的输入框/按钮为主；表格行高约 38—48px。
- 页面结构通常为：页面标题/描述 → 筛选区 → KPI 或 Tab → 图表/列表/表格 → AI 或说明区域。
- 标签页使用底部 2px 色条或浅色背景表示激活；状态使用绿色（正常/已上传/启用）、橙色（待补充/关注）、红色（异常/风险）、灰色（停用）等语义色。
- 弹窗居中显示，遮罩覆盖页面；抽屉从右侧打开；二者均支持关闭按钮、底部操作区和遮罩点击关闭。
- 数据管理页面支持表格横向滚动；资产策略原型设置了最小内容宽度约 1040px，并存在大屏/桌面端优先假设。

## 可提取的公共组件

布局：`AppShell`、`Sidebar`、`Topbar`、`Breadcrumb`、`PageHeader`、`PageTabs`。

数据录入：`FilterBar`、`SelectField`、`SegmentedControl`、`FormGrid`、`Modal`、`Drawer`、`Toast`。

数据展示：`Card`、`KpiCard`、`StatusTag`、`DataTable`、`Pagination`、`EmptyState`、`GroupedTable`、`RankList`、`ProgressBar`、`Legend`。

分析可视化：`DonutChart`、`BarChart`、`LineChart`、`Sankey/FlowDiagram`、`EnergyBalanceDiagram`、`AiSuggestionCard`。

## 仍需设计确认

四个 HTML 原型的绿色、蓝色、字号、边距、导航宽度和表格样式存在差异；在未有正式设计 Token 或效果图前，只能作为参考规则，不能当作最终规范。

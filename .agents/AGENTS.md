# AGENTS.md

## 1. Project goal

Build an engineering-grade, high-fidelity interactive frontend prototype
for a generic enterprise energy and carbon management SaaS platform.

The application is a frontend prototype, not a production backend system.

## 2. Source-of-truth priority

When references conflict, follow this order:

1. Confirmed screenshots under `reference/screenshots`
   - source of truth for visual layout, spacing, hierarchy and page density
2. Existing HTML prototypes under `reference/html`
   - source of truth for fields, content, buttons and interaction behavior
3. Documents under `docs`
   - source of truth for business logic and module boundaries
4. Do not invent major features, fields, buttons, pages or workflows

## 3. Confirmed modules

The application contains four primary modules:

1. Data management
2. Energy monitoring and analysis
3. Carbon accounting and compliance
4. Energy and carbon asset operations and strategy

All confirmed pages in the reference HTML must remain accessible.

## 4. Engineering stack

Use:

- React
- TypeScript
- Vite
- React Router
- ECharts
- CSS variables and reusable components
- Local mock data and typed service adapters

Do not add:

- A real backend
- A database
- Authentication
- Micro-frontends
- Complex global state libraries unless clearly necessary
- Unconfirmed business modules

## 5. UI constraints

- Use Chinese UI text.
- Use the confirmed green/blue enterprise SaaS visual system.
- Keep the sidebar, top bar, breadcrumb and content spacing consistent.
- Distinguish clearly between:
  - full pages
  - modal dialogs
  - right-side drawers
  - tabs
- Select fields must look like selects.
- Tabs must look clickable and have an obvious active state.
- Preserve confirmed edit, detail, add, delete and export actions.
- Do not replace real charts with text placeholders.
- Do not replace tables with summary cards.
- Do not show unsupported AI conclusions as verified facts.

## 6. Component rules

Reuse shared components for:

- App shell
- Sidebar
- Top bar
- Breadcrumbs
- Page header
- Filter bar
- KPI cards
- Status tags
- Data tables
- Empty states
- Modal forms
- Detail drawers
- AI analysis cards
- ECharts containers

Do not create separate visual implementations of the same component
inside different modules.

## 7. Data and interaction rules

- Use typed mock data.
- Filters must change visible data.
- Tabs must change the corresponding content.
- Modal forms must validate required fields.
- Saved changes may persist in memory or localStorage.
- Buttons must have visible feedback.
- Export may generate a mock file or display a clear prototype message.
- Detail buttons must open the correct drawer or modal.

## 8. Validation

Before declaring a task complete, run:

- npm run typecheck
- npm run lint
- npm run test
- npm run build

For page implementation tasks:

- Run visual screenshot generation.
- Compare the screenshot with the reference image.
- Report remaining visual differences honestly.

## 9. Change discipline

- Do not refactor unrelated modules.
- Do not remove confirmed fields or actions.
- Do not rename business terminology without explicit instruction.
- Keep each task focused and reviewable.
- Summarize changed files and validation results after every task.
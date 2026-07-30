import { useMemo, useState } from 'react';
import {
  addChildEnergyUnit,
  createEnergyUnit,
  deleteEnergyUnit,
  getEnergyUnit,
  inspectEnergyUnitDeletion,
  listEnergyUnits,
  updateEnergyUnit,
} from '../../mocks/energyUnitMockStore';
import type {
  EnergyConversionScene,
  EnergyUnit,
  EnergyUnitLevel,
  EnergyUnitReferenceSummary,
  EnergyUnitType,
  EnergyUnitWriteInput,
} from '../../types/energyUnit';
import {
  Button,
  Card,
  DataTable,
  Field,
  FilterBar,
  Modal,
  Toast,
  type TableColumn,
} from './PrototypeUI';
import styles from './EnergyUnitsPage.module.css';

const unitTypeOptions: EnergyUnitType[] = ['生产单元', '工序/环节', '公辅系统', '建筑/区域', '其他'];
const rootUnitTypeOptions: EnergyUnitType[] = ['生产单元', '公辅系统', '建筑/区域', '其他'];
const childUnitTypeOptions: EnergyUnitType[] = ['工序/环节', '公辅系统', '建筑/区域', '其他'];
const conversionSceneOptions: EnergyConversionScene[] = [
  '锅炉产汽/产热',
  '余能回收',
  '电力转换/分配',
  '其他转换',
];
const conversionUnitTypes = new Set<EnergyUnitType>(['公辅系统', '其他']);

const levelLabels: Record<EnergyUnitLevel, string> = {
  enterprise: '企业',
  level1: '一级用能单元',
  level2: '二级用能单元',
  level3: '三级用能单元',
};

type DialogState =
  | { type: 'addRoot' }
  | { type: 'addChild'; parentEnergyUnitId: string }
  | { type: 'edit'; energyUnitId: string }
  | { type: 'deleteBlocked'; unit: EnergyUnit; references: EnergyUnitReferenceSummary }
  | { type: 'deleteConfirm'; unit: EnergyUnit }
  | null;

interface FilterState {
  keyword: string;
  unitType: EnergyUnitType | '';
}

interface DisplayRow {
  unit: EnergyUnit;
  depth: number;
  childCount: number;
}

const emptyFilter: FilterState = { keyword: '', unitType: '' };

function nextLevel(level: EnergyUnitLevel) {
  if (level === 'enterprise') return 'level1';
  if (level === 'level1') return 'level2';
  if (level === 'level2') return 'level3';
  return null;
}

function formUnitTypes(level: EnergyUnitLevel) {
  return level === 'level1' ? rootUnitTypeOptions : childUnitTypeOptions;
}

function initialExpanded(units: EnergyUnit[]) {
  return new Set(
    units
      .filter((unit) => units.some((child) => child.parentEnergyUnitId === unit.energyUnitId))
      .map((unit) => unit.energyUnitId),
  );
}

function makeDisplayRows(
  units: EnergyUnit[],
  filter: FilterState,
  expanded: Set<string>,
): DisplayRow[] {
  const childrenByParent = new Map<string | null, EnergyUnit[]>();
  units.forEach((unit) => {
    const siblings = childrenByParent.get(unit.parentEnergyUnitId) ?? [];
    siblings.push(unit);
    childrenByParent.set(unit.parentEnergyUnitId, siblings);
  });

  const hasFilter = Boolean(filter.keyword || filter.unitType);
  const directMatches = new Set(
    units
      .filter(
        (unit) =>
          (!filter.keyword || unit.energyUnitName.includes(filter.keyword)) &&
          (!filter.unitType || unit.unitType === filter.unitType),
      )
      .map((unit) => unit.energyUnitId),
  );
  const visibleIds = new Set(directMatches);

  if (hasFilter) {
    directMatches.forEach((energyUnitId) => {
      let current = units.find((unit) => unit.energyUnitId === energyUnitId);
      while (current?.parentEnergyUnitId) {
        visibleIds.add(current.parentEnergyUnitId);
        current = units.find((unit) => unit.energyUnitId === current?.parentEnergyUnitId);
      }
    });
  }

  const rows: DisplayRow[] = [];
  const visit = (unit: EnergyUnit, depth: number) => {
    if (hasFilter && !visibleIds.has(unit.energyUnitId)) return;
    const children = childrenByParent.get(unit.energyUnitId) ?? [];
    rows.push({ unit, depth, childCount: children.length });
    if (hasFilter || expanded.has(unit.energyUnitId)) {
      children.forEach((child) => visit(child, depth + 1));
    }
  };
  (childrenByParent.get(null) ?? []).forEach((root) => visit(root, 0));
  return rows;
}

export function EnergyUnitsPage() {
  const [units, setUnits] = useState(() => listEnergyUnits());
  const [draftFilter, setDraftFilter] = useState<FilterState>(emptyFilter);
  const [activeFilter, setActiveFilter] = useState<FilterState>(emptyFilter);
  const [expanded, setExpanded] = useState(() => initialExpanded(listEnergyUnits()));
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState('');

  const rows = useMemo(
    () => makeDisplayRows(units, activeFilter, expanded),
    [activeFilter, expanded, units],
  );

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 1800);
  };

  const refreshUnits = () => setUnits(listEnergyUnits());

  const openDelete = (unit: EnergyUnit) => {
    const references = inspectEnergyUnitDeletion(unit.energyUnitId);
    if (Object.values(references).some((count) => count > 0)) {
      setDialog({ type: 'deleteBlocked', unit, references });
      return;
    }
    setDialog({ type: 'deleteConfirm', unit });
  };

  const columns: TableColumn<DisplayRow>[] = [
    {
      key: 'energyUnitName',
      title: '用能单元',
      width: 350,
      render: ({ unit, depth, childCount }) => (
        <div
          className={`${styles.unitCell} ${depth ? styles.childName : ''} ${
            depth === 1 ? styles.level2 : depth >= 2 ? styles.level3 : ''
          }`}
        >
          {childCount ? (
            <button
              aria-label={`${expanded.has(unit.energyUnitId) ? '收起' : '展开'}${unit.energyUnitName}`}
              className={styles.toggle}
              type="button"
              onClick={() =>
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(unit.energyUnitId)) next.delete(unit.energyUnitId);
                  else next.add(unit.energyUnitId);
                  return next;
                })
              }
            >
              {expanded.has(unit.energyUnitId) ? '−' : '+'}
            </button>
          ) : (
            depth === 0 && <span className={styles.togglePlaceholder} />
          )}
          <span className={depth === 0 ? styles.unitName : ''}>{unit.energyUnitName}</span>
          {childCount > 0 && <span className={styles.childCount}>{childCount}个下级</span>}
        </div>
      ),
    },
    {
      key: 'unitLevel',
      title: '层级',
      width: 140,
      render: ({ unit }) => (
        <span
          className={`${styles.levelTag} ${
            unit.unitLevel === 'level2'
              ? styles.levelTagSecondary
              : unit.unitLevel === 'level3'
                ? styles.levelTagTertiary
                : ''
          }`}
        >
          {unit.unitLevel === 'level1' ? '一级' : unit.unitLevel === 'level2' ? '二级' : '三级'}
        </span>
      ),
    },
    { key: 'unitType', title: '单元类型', width: 190, render: ({ unit }) => unit.unitType },
    {
      key: 'conversionScene',
      title: '能源转换场景',
      width: 210,
      render: ({ unit }) =>
        unit.conversionScene ? (
          <span className={styles.conversion}>{unit.conversionScene}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 250,
      render: ({ unit }) => (
        <div className={styles.actions}>
          {unit.unitLevel === 'level1' && <button
              className={styles.action}
              type="button"
              onClick={() => setDialog({ type: 'addChild', parentEnergyUnitId: unit.energyUnitId })}
            >
              添加下级
            </button>}
          <button
            className={styles.action}
            type="button"
            onClick={() => setDialog({ type: 'edit', energyUnitId: unit.energyUnitId })}
          >
            编辑
          </button>
          <button className={styles.dangerAction} type="button" onClick={() => openDelete(unit)}>
            删除
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <FilterBar
        onSearch={() => setActiveFilter({ ...draftFilter, keyword: draftFilter.keyword.trim() })}
        onReset={() => {
          setDraftFilter(emptyFilter);
          setActiveFilter(emptyFilter);
        }}
        actions={
          <Button primary onClick={() => setDialog({ type: 'addRoot' })}>
            ＋ 新增一级用能单元
          </Button>
        }
      >
        <Field label="关键字">
          <input
            className={styles.filterKeyword}
            aria-label="关键字"
            value={draftFilter.keyword}
            placeholder="搜索用能单元名称"
            onChange={(event) =>
              setDraftFilter((current) => ({ ...current, keyword: event.target.value }))
            }
          />
        </Field>
        <Field label="单元类型">
          <select
            className={styles.filterType}
            aria-label="单元类型"
            value={draftFilter.unitType}
            onChange={(event) =>
              setDraftFilter((current) => ({
                ...current,
                unitType: event.target.value as EnergyUnitType | '',
              }))
            }
          >
            <option value="">全部</option>
            {unitTypeOptions.map((unitType) => (
              <option value={unitType} key={unitType}>
                {unitType}
              </option>
            ))}
          </select>
        </Field>
      </FilterBar>

      <Card className={styles.tableCard}>
        <div className={styles.notice}>
          一期采用两级结构。仅涉及能源转换或自产能源的系统需要设置能源转换场景，普通生产单元无需配置。
        </div>
        <div className={styles.tableArea}>
          <DataTable
            columns={columns}
            data={rows}
            rowKey={({ unit }) => unit.energyUnitId}
            rowClassName={({ childCount }) => (childCount ? styles.parentRow : '')}
            emptyText="暂无匹配数据"
          />
        </div>
        <div className={styles.pagination}>
          <span>共 {rows.length} 条</span>
          <span className={styles.pageDot}>1</span>
        </div>
      </Card>

      {(dialog?.type === 'addRoot' ||
        dialog?.type === 'addChild' ||
        dialog?.type === 'edit') && (
        <EnergyUnitFormDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onSaved={(message, expandedParentId) => {
            refreshUnits();
            if (expandedParentId) {
              setExpanded((current) => new Set(current).add(expandedParentId));
            }
            setDialog(null);
            notify(message);
          }}
        />
      )}

      {dialog?.type === 'deleteBlocked' && (
        <DeleteBlockedDialog
          unit={dialog.unit}
          references={dialog.references}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.type === 'deleteConfirm' && (
        <Modal
          title="删除用能单元"
          width={520}
          submitText="确认删除"
          onClose={() => setDialog(null)}
          onSubmit={() => {
            const result = deleteEnergyUnit(dialog.unit.energyUnitId);
            if (result.ok) {
              refreshUnits();
              setDialog(null);
              notify('用能单元已删除');
            }
          }}
        >
          <div className={styles.confirmBox}>
            确认删除用能单元“<strong>{dialog.unit.energyUnitName}</strong>”吗？
            <br />
            删除后该记录将从当前前端Mock数据中移除。
          </div>
        </Modal>
      )}

      <Toast message={toast} />
    </div>
  );
}

function EnergyUnitFormDialog({
  dialog,
  onClose,
  onSaved,
}: {
  dialog: Exclude<DialogState, null | { type: 'deleteBlocked' } | { type: 'deleteConfirm' }>;
  onClose: () => void;
  onSaved: (message: string, expandedParentId?: string) => void;
}) {
  const target = dialog.type === 'edit' ? getEnergyUnit(dialog.energyUnitId) : undefined;
  const parent = dialog.type === 'addChild' ? getEnergyUnit(dialog.parentEnergyUnitId) : undefined;
  const level: EnergyUnitLevel =
    dialog.type === 'addRoot'
      ? 'level1'
      : dialog.type === 'edit'
        ? target?.unitLevel ?? 'level1'
        : nextLevel(parent?.unitLevel ?? 'level3') ?? 'level3';
  const availableTypes = formUnitTypes(level);

  const [form, setForm] = useState<EnergyUnitWriteInput>({
    unitType: target?.unitType ?? ('' as EnergyUnitType),
    energyUnitName: target?.energyUnitName ?? '',
    conversionScene: target?.conversionScene ?? null,
    remark: target?.remark ?? '',
  });
  const [error, setError] = useState('');

  const title =
    dialog.type === 'addRoot'
      ? '新增一级用能单元'
      : dialog.type === 'addChild'
        ? '添加下级用能单元'
        : target?.unitLevel === 'level1'
          ? '编辑一级用能单元'
          : '编辑下级用能单元';
  const showConversion = conversionUnitTypes.has(form.unitType);

  const save = () => {
    setError('');
    if (!form.unitType || !form.energyUnitName.trim()) {
      setError('请选择单元类型并填写用能单元名称。');
      return;
    }
    const normalizedForm = {
      ...form,
      conversionScene: showConversion ? form.conversionScene : null,
    };
    const result =
      dialog.type === 'addRoot'
        ? createEnergyUnit(normalizedForm)
        : dialog.type === 'addChild'
          ? addChildEnergyUnit(dialog.parentEnergyUnitId, normalizedForm)
          : updateEnergyUnit(dialog.energyUnitId, normalizedForm);

    if (!result.ok) {
      setError(
        result.error === 'duplicateName'
          ? '用能单元名称已存在，请使用其他名称。'
          : result.error === 'maxLevel'
            ? '当前记录已达到系统允许的最大三级层级，不能继续添加下级。'
            : '保存失败，请检查当前记录是否仍然存在。',
      );
      return;
    }
    onSaved(
      dialog.type === 'edit' ? '用能单元已更新' : '用能单元已新增',
      dialog.type === 'addChild' ? dialog.parentEnergyUnitId : undefined,
    );
  };

  return (
    <Modal title={title} width={760} onClose={onClose} onSubmit={save}>
      <div className={styles.formGrid}>
        {dialog.type === 'addChild' && parent && (
          <div className={styles.context}>
            <div>
              <span>所属单元</span>
              <strong>{parent.energyUnitName}</strong>
            </div>
            <div>
              <span>所属层级</span>
              <strong>{levelLabels[level]}</strong>
            </div>
          </div>
        )}
        <Field label="单元类型" required>
          <select
            aria-label="单元类型"
            required
            value={form.unitType}
            onChange={(event) => {
              const unitType = event.target.value as EnergyUnitType;
              setForm((current) => ({
                ...current,
                unitType,
                conversionScene: conversionUnitTypes.has(unitType)
                  ? current.conversionScene
                  : null,
              }));
            }}
          >
            <option value="" disabled>
              请选择单元类型
            </option>
            {availableTypes.map((unitType) => (
              <option value={unitType} key={unitType}>
                {unitType}
              </option>
            ))}
          </select>
        </Field>
        <Field label="用能单元名称" required>
          <input
            aria-label="用能单元名称"
            required
            value={form.energyUnitName}
            placeholder={namePlaceholder(form.unitType)}
            onChange={(event) =>
              setForm((current) => ({ ...current, energyUnitName: event.target.value }))
            }
          />
        </Field>
        {showConversion && (
          <div className={styles.full}>
            <Field label="能源转换场景">
              <select
                aria-label="能源转换场景"
                value={form.conversionScene ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    conversionScene: (event.target.value || null) as EnergyConversionScene | null,
                  }))
                }
              >
                <option value="">不涉及能源转换</option>
                {conversionSceneOptions.map((scene) => (
                  <option value={scene} key={scene}>
                    {scene}
                  </option>
                ))}
              </select>
            </Field>
            <div className={styles.help}>
              只有该单元涉及能源转换或自产能源时才设置，普通生产单元无需配置。
            </div>
          </div>
        )}
        <div className={styles.full}>
          <Field label="备注">
            <textarea
              aria-label="备注"
              value={form.remark}
              placeholder="选填"
              onChange={(event) =>
                setForm((current) => ({ ...current, remark: event.target.value }))
              }
            />
          </Field>
        </div>
        {error && (
          <div className={`${styles.full} ${styles.error}`} role="alert">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}

function namePlaceholder(unitType: EnergyUnitType | '') {
  const placeholders: Partial<Record<EnergyUnitType, string>> = {
    生产单元: '如：生产车间A、生产车间B',
    '工序/环节': '如：加工工段、装配工段',
    公辅系统: '如：锅炉系统、空压系统',
    '建筑/区域': '如：办公区域、仓储物流区域',
    其他: '请输入具体用能单元名称',
  };
  return unitType ? (placeholders[unitType] ?? '请输入用能单元名称') : '请先选择单元类型';
}

function DeleteBlockedDialog({
  unit,
  references,
  onClose,
}: {
  unit: EnergyUnit;
  references: EnergyUnitReferenceSummary;
  onClose: () => void;
}) {
  const reasons = [
    references.childCount > 0 && `包含 ${references.childCount} 个下级用能单元`,
    references.energyRecordCount > 0 && `被 ${references.energyRecordCount} 条能源记录引用`,
    references.operationRecordCount > 0 && `被 ${references.operationRecordCount} 条运营数据引用`,
    references.deviceCount > 0 && `被 ${references.deviceCount} 台重点设备引用`,
    references.conversionRelationCount > 0 &&
      `被 ${references.conversionRelationCount} 条能源转换关系引用`,
  ].filter(Boolean);

  return (
    <Modal title="无法删除用能单元" width={560} cancelText="我知道了" onClose={onClose}>
      <p className={styles.blockerIntro}>
        用能单元“{unit.energyUnitName}”当前仍被以下数据使用，不能删除：
      </p>
      <ul className={styles.blockerList}>
        {reasons.map((reason) => (
          <li key={String(reason)}>{reason}</li>
        ))}
      </ul>
    </Modal>
  );
}

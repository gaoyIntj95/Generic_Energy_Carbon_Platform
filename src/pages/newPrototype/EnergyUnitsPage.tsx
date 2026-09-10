import { energyConversionPresets, energyConversionFields, energyRelationError } from '../../modules/data-management/energyConversionRelations';
import { listV11EnergyTypes } from '../../mocks/dataManagementV11Store';
import { useDataYear } from './useDataYear';
import { DATA_YEARS } from '../../mocks/annualData';
import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addChildEnergyUnit,
  createEnergyUnit,
  deleteEnergyUnit,
  getEnergyUnit,
  inspectEnergyUnitDeletion,
  listEnergyUnits,
  reorderEnergyUnits,
  updateEnergyUnit,
} from '../../mocks/energyUnitMockStore';
import type {
  EnergyUnit,
  EnergyUnitLevel,
  EnergyUnitReferenceSummary,
  EnergyUnitType,
  EnergyUnitWriteInput,
  ConversionScenario,
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
const conversionScenarioOptions: ConversionScenario[] = ['锅炉产汽/产热', '余热发电', '空压产气/压缩空气', '回收利用', '其他转换'];
const rootCategoryOptions = ['生产类用能单元', '非生产类用能单元'] as const;
const nonProductionTypeOptions: EnergyUnitType[] = ['公辅系统', '建筑/区域', '其他'];

type RootCategory = typeof rootCategoryOptions[number];

function rootCategoryOf(unitType: EnergyUnitType | ''): RootCategory | '' {
  if (unitType === '生产单元') return '生产类用能单元';
  if (nonProductionTypeOptions.includes(unitType as EnergyUnitType)) return '非生产类用能单元';
  return '';
}

const childTypeRules: Record<EnergyUnitType, { defaultType: EnergyUnitType; options: EnergyUnitType[] }> = {
  生产单元: { defaultType: '工序/环节', options: ['工序/环节', '公辅系统', '其他'] },
  '工序/环节': { defaultType: '工序/环节', options: ['工序/环节', '公辅系统', '其他'] },
  公辅系统: { defaultType: '公辅系统', options: ['公辅系统', '其他'] },
  '建筑/区域': { defaultType: '建筑/区域', options: ['建筑/区域', '公辅系统', '其他'] },
  其他: { defaultType: '其他', options: ['其他', '工序/环节', '公辅系统', '建筑/区域'] },
};

const levelLabels: Record<EnergyUnitLevel, string> = {
  enterprise: '企业',
  level1: '一级用能单元',
  level2: '二级用能单元',
};

type DialogState =
  | { type: 'addRoot' }
  | { type: 'addChild'; parentEnergyUnitId: string }
  | { type: 'edit'; energyUnitId: string }
  | { type: 'reorder'; parentEnergyUnitId: string | null }
  | { type: 'deleteBlocked'; unit: EnergyUnit; references: EnergyUnitReferenceSummary }
  | { type: 'deleteConfirm'; unit: EnergyUnit }
  | null;

interface FilterState {
  year: string;
  keyword: string;
  unitType: EnergyUnitType | '';
}

interface DisplayRow {
  unit: EnergyUnit;
  depth: number;
  childCount: number;
}

const yearOptions = DATA_YEARS.map(String);

function formUnitTypes(level: EnergyUnitLevel) {
  return level === 'level1' ? rootUnitTypeOptions : childUnitTypeOptions;
}

function childTypeRule(parent?: EnergyUnit) {
  return parent
    ? childTypeRules[parent.unitType]
    : { defaultType: '工序/环节' as const, options: childUnitTypeOptions };
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
          (!filter.unitType || unit.unitType === filter.unitType)
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
  const [year] = useDataYear();
  return <AnnualEnergyUnitsPage key={year} />;
}
function AnnualEnergyUnitsPage() {
  const [year, setYear] = useDataYear();
  const emptyFilter: FilterState = { year, keyword: '', unitType: '' };
  const [units, setUnits] = useState(() => listEnergyUnits(Number(year)));
  const [draftFilter, setDraftFilter] = useState<FilterState>(emptyFilter);
  const [activeFilter, setActiveFilter] = useState<FilterState>(emptyFilter);
  const [expanded, setExpanded] = useState(() => initialExpanded(listEnergyUnits(Number(year))));
  const [dialog, setDialog] = useState<DialogState>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [toast, setToast] = useState('');
  const [draggingUnitId, setDraggingUnitId] = useState<string | null>(null);
  const [dropTargetUnitId, setDropTargetUnitId] = useState<string | null>(null);

  const rows = useMemo(
    () => makeDisplayRows(units, activeFilter, expanded),
    [activeFilter, expanded, units],
  );

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 1800);
  };

  const refreshUnits = () => setUnits(listEnergyUnits(Number(year)));
  const canReorder = !activeFilter.keyword && !activeFilter.unitType;
  const groupedRows = [
    { category: '生产类', rows: rows.filter(({ unit }) => unitCategory(unit) === '生产类') },
    { category: '非生产类', rows: rows.filter(({ unit }) => unitCategory(unit) === '非生产类') },
  ].filter((group) => group.rows.length > 0);

  const reorderFromDrop = (sourceId: string, targetId: string) => {
    const source = units.find((unit) => unit.energyUnitId === sourceId);
    const target = units.find((unit) => unit.energyUnitId === targetId);
    if (!source || !target || sourceId === targetId) return;
    if (source.parentEnergyUnitId !== target.parentEnergyUnitId) {
      notify('只能在同级用能单元之间调整顺序');
      return;
    }
    const siblings = units
      .filter((unit) => unit.parentEnergyUnitId === source.parentEnergyUnitId)
      .sort((left, right) => left.displayOrder - right.displayOrder);
    const nextIds = siblings.map((unit) => unit.energyUnitId);
    const sourceIndex = nextIds.indexOf(sourceId);
    const targetIndex = nextIds.indexOf(targetId);
    const [moved] = nextIds.splice(sourceIndex, 1);
    nextIds.splice(targetIndex, 0, moved);
    const result = reorderEnergyUnits(source.parentEnergyUnitId, nextIds, Number(year));
    if (result.ok) {
      refreshUnits();
      notify('用能单元顺序已更新');
    }
  };

  const openDelete = (unit: EnergyUnit) => {
    const references = inspectEnergyUnitDeletion(unit.energyUnitId, Number(year));
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
            depth === 1 ? styles.level2 : ''
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
            unit.unitLevel === 'level2' ? styles.levelTagSecondary : ''
          }`}
        >
          {unit.unitLevel === 'level1' ? '一级' : '二级'}
        </span>
      ),
    },
    { key: 'unitType', title: '单元类型', width: 190, render: ({ unit }) => unit.unitType },
    {
      key: 'actions',
      title: '操作',
      width: 330,
      render: ({ unit, childCount }) => (
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
          <>
            <Button primary onClick={() => setDialog({ type: 'addRoot' })}>
              ＋ 新增一级用能单元
            </Button>
          </>
        }
      >
        <Field label="年度">
          <select
            aria-label="用能单元年度"
            value={draftFilter.year}
            onChange={(event) => setYear(event.target.value)}
          >
            {yearOptions.map((year) => <option key={year}>{year}</option>)}
          </select>
        </Field>
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
          <div><strong>{year} 年度用能单元：独立维护本年度的层级和归属，修改不影响其他年度。</strong><span>一期仅支持两级；能流分析不汇总二级能源消费记录。</span></div>
          <button type="button" className={styles.noticeLink} onClick={() => setShowHelp(true)}>查看说明</button>
        </div>
        <div className={styles.tableArea}>
          {groupedRows.map(({ category, rows: categoryRows }) => <section key={category} className={styles.categorySection}>
            <div className={styles.categoryHeader}><strong>{category}用能单元</strong><span>{category === '生产类' ? '按产量等生产指标分析能耗。' : '按运行、建筑或物流等指标分析能耗。'}</span></div>
            <DataTable
            columns={columns}
            data={categoryRows}
            rowKey={({ unit }) => unit.energyUnitId}
            rowClassName={({ unit, childCount }) => `${childCount ? styles.parentRow : ''} ${draggingUnitId === unit.energyUnitId ? styles.unitRowDragging : ''} ${dropTargetUnitId === unit.energyUnitId ? styles.unitRowDropTarget : ''}`}
            rowProps={({ unit }) => ({
              draggable: canReorder,
              onDragStart: (event) => {
                if (!canReorder) return;
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', unit.energyUnitId);
                setDraggingUnitId(unit.energyUnitId);
              },
              onDragOver: (event) => {
                if (!canReorder || !draggingUnitId || draggingUnitId === unit.energyUnitId) return;
                const source = units.find((item) => item.energyUnitId === draggingUnitId);
                if (!source || source.parentEnergyUnitId !== unit.parentEnergyUnitId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDropTargetUnitId(unit.energyUnitId);
              },
              onDrop: (event) => {
                event.preventDefault();
                const sourceId = event.dataTransfer.getData('text/plain') || draggingUnitId;
                if (sourceId) reorderFromDrop(sourceId, unit.energyUnitId);
                setDraggingUnitId(null);
                setDropTargetUnitId(null);
              },
              onDragEnd: () => {
                setDraggingUnitId(null);
                setDropTargetUnitId(null);
              },
            })}
            emptyText="暂无匹配数据"
            />
          </section>)}
        </div>
        <div className={styles.pagination}>
          <span>共 {rows.length} 条</span>
          <span className={styles.pageDot}>1</span>
        </div>
      </Card>

      {showHelp && (
        <Modal title="用能单元说明" width={560} onClose={() => setShowHelp(false)}>
          <div className={styles.helpContent}>
            <section>
              <strong>层级与归属</strong>
              <p>一期仅支持两级树形结构。一级用能单元通常对应车间或区域，二级用能单元对应工序、系统或环节；二级不能继续添加下级。能源数据、运营数据和重点设备都需要关联到具体用能单元。</p>
              <p>生产类/非生产类仅为展示分组，正式业务属性以单元类型字典为准。不同一级单元下允许存在相同的二级类型，同一父级下名称必须唯一但类型可以重复。</p>
            </section>
            <section>
              <strong>排序</strong>
              <p>未设置关键字或类型筛选时，可以拖拽调整同级用能单元的顺序，不能跨层级调整。</p>
            </section>
            <section>
              <strong>其他能源业务</strong>
              <p>能源转换与外供请前往“数据管理 &gt; 能源数据 &gt; 能源转换与外供”维护。</p>
            </section>
            <section>
              <strong>转换场景</strong>
              <p>二级公辅系统可维护适用转换场景，转换页面仅从已配置对应场景的系统中筛选候选；该属性不表达能流关系。</p>
            </section>
          </div>
        </Modal>
      )}

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
            const result = deleteEnergyUnit(dialog.unit.energyUnitId, Number(year));
            if (result.ok) {
              refreshUnits();
              setDialog(null);
              notify('用能单元已删除');
            }
          }}
        >
          <div className={styles.confirmBox}>
            确认删除用能单元“<strong>{dialog.unit.energyUnitName}</strong>”吗？
          </div>
        </Modal>
      )}

      <Toast message={toast} />
    </div>
  );
}

function ReorderEnergyUnitsDialog({
  parentEnergyUnitId,
  onClose,
  onSaved,
}: {
  parentEnergyUnitId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [year] = useDataYear();
  const parent = parentEnergyUnitId ? getEnergyUnit(parentEnergyUnitId, Number(year)) : undefined;
  const [orderedUnits, setOrderedUnits] = useState(() =>
    listEnergyUnits(Number(year)).filter((unit) => unit.parentEnergyUnitId === parentEnergyUnitId),
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const moveTo = (draggedId: string, targetId: string) => {
    setOrderedUnits((current) => {
      const sourceIndex = current.findIndex((unit) => unit.energyUnitId === draggedId);
      const targetIndex = current.findIndex((unit) => unit.energyUnitId === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };
  return (
    <Modal
      title={parent ? `调整“${parent.energyUnitName}”下级顺序` : '调整一级用能单元顺序'}
      width={680}
      submitText="保存顺序"
      onClose={onClose}
      onSubmit={() => {
        const result = reorderEnergyUnits(parentEnergyUnitId, orderedUnits.map((unit) => unit.energyUnitId), Number(year));
        if (result.ok) onSaved();
      }}
    >
      <div className={styles.reorderIntro}>
        按住用能单元整行拖动到目标位置即可调整同级展示顺序，不改变父子关系、能源数据归属或能流计算结果。
      </div>
      <div className={styles.reorderList}>
        {orderedUnits.map((unit, index) => (
          <div
            className={`${styles.reorderItem} ${draggingId === unit.energyUnitId ? styles.reorderItemDragging : ''} ${dropTargetId === unit.energyUnitId ? styles.reorderItemDropTarget : ''}`}
            key={unit.energyUnitId}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', unit.energyUnitId);
              setDraggingId(unit.energyUnitId);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              if (draggingId !== unit.energyUnitId) setDropTargetId(unit.energyUnitId);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const sourceId = event.dataTransfer.getData('text/plain') || draggingId;
              if (sourceId) moveTo(sourceId, unit.energyUnitId);
              setDraggingId(null);
              setDropTargetId(null);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDropTargetId(null);
            }}
          >
            <span className={styles.reorderDragHandle} aria-hidden="true">⋮⋮</span>
            <span className={styles.reorderIndex}>{index + 1}</span>
            <div><strong>{unit.energyUnitName}</strong><small>{unit.unitType}</small></div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function EnergyUnitFormDialog({
  dialog,
  onClose,
  onSaved,
}: {
  dialog: Exclude<
    DialogState,
    null | { type: 'deleteBlocked' } | { type: 'deleteConfirm' } | { type: 'reorder' }
  >;
  onClose: () => void;
  onSaved: (message: string, expandedParentId?: string) => void;
}) {
  const [year] = useDataYear();
  const target = dialog.type === 'edit' ? getEnergyUnit(dialog.energyUnitId, Number(year)) : undefined;
  const parent = dialog.type === 'addChild' ? getEnergyUnit(dialog.parentEnergyUnitId, Number(year)) : undefined;
  const level: EnergyUnitLevel =
    dialog.type === 'addRoot'
      ? 'level1'
      : dialog.type === 'edit'
        ? target?.unitLevel ?? 'level1'
        : 'level2';
  const isAddingChild = dialog.type === 'addChild';
  const isRootForm = level === 'level1' && !isAddingChild;
  const inheritedChildTypeRule = childTypeRule(parent);
  const availableTypes = isAddingChild ? inheritedChildTypeRule.options : formUnitTypes(level);

  const [form, setForm] = useState<EnergyUnitWriteInput>({
    unitType: target?.unitType ?? (isAddingChild ? inheritedChildTypeRule.defaultType : ('' as EnergyUnitType)),
    energyUnitName: target?.energyUnitName ?? '',
    remark: target?.remark ?? '',
    conversionScenarios: target?.conversionScenarios ?? [],
    energyRelations: target?.energyRelations ?? [{ inputEnergyTypeId: '', outputEnergyTypeId: '' }],
  });
  const [rootCategory, setRootCategory] = useState<RootCategory | ''>(
    isRootForm ? rootCategoryOf(target?.unitType ?? '') : '',
  );
  const [nonProductionType, setNonProductionType] = useState<EnergyUnitType | ''>(
    isRootForm && target?.unitType && nonProductionTypeOptions.includes(target.unitType)
      ? target.unitType
      : '',
  );
  const isPowerCenterForm = (parent?.energyUnitId ?? target?.parentEnergyUnitId) === 'eu-utilities';
  const isPowerCenterSecondaryUnit = isPowerCenterForm && form.unitType === '公辅系统';
  const energyTypes = listV11EnergyTypes(Number(year));
  const selectedRelationFields = energyConversionFields(form.energyRelations, energyTypes);
  const availablePresets = energyConversionPresets.flatMap((preset) => {
    const input = energyTypes.find((type) => type.energyTypeName === preset.input);
    const output = energyTypes.find((type) => type.energyTypeName === preset.output);
    return input && output ? [{ ...preset, inputEnergyTypeId: input.energyTypeId, outputEnergyTypeId: output.energyTypeId }] : [];
  });
  const relation = form.energyRelations?.[0] ?? { inputEnergyTypeId: '', outputEnergyTypeId: '' };
  const presetIndex = availablePresets.findIndex((preset) => preset.inputEnergyTypeId === relation.inputEnergyTypeId && preset.outputEnergyTypeId === relation.outputEnergyTypeId);
  const [isCustomRelation, setIsCustomRelation] = useState(() => Boolean(relation.inputEnergyTypeId || relation.outputEnergyTypeId) && presetIndex < 0);
  const hasMultipleRelations = isPowerCenterForm && (form.energyRelations?.length ?? 0) > 1;
  const relationHintId = useId();
  const relationTooltipId = useId();
  const [showRelationHelp, setShowRelationHelp] = useState(false);
  const [error, setError] = useState('');
  const [isChangingChildType, setIsChangingChildType] = useState(false);

  const title =
    dialog.type === 'addRoot'
      ? '新增一级用能单元'
      : dialog.type === 'addChild'
        ? '添加下级用能单元'
        : target?.unitLevel === 'level1'
          ? '编辑一级用能单元'
          : '编辑下级用能单元';
  const save = () => {
    setError('');
    if (hasMultipleRelations) {
      setError('此单元包含多条历史转换关系，当前版本暂不支持编辑，原有数据已保留。');
      return;
    }
    if (isPowerCenterSecondaryUnit && !isCustomRelation && presetIndex < 0) {
      setError('请选择常用能源转换关系，或切换到自定义。');
      return;
    }
    if ((isRootForm && (!rootCategory || (rootCategory === '非生产类用能单元' && !nonProductionType))) || (!isRootForm && !form.unitType) || !form.energyUnitName.trim()) {
      setError('请选择单元类型并填写用能单元名称。');
      return;
    }
    if (isPowerCenterSecondaryUnit && !selectedRelationFields) {
      setError(energyRelationError(form.energyRelations, energyTypes) ?? '请检查能源转换关系。');
      return;
    }
    const normalizedForm = {
      ...form,
      energyRelations: isPowerCenterSecondaryUnit ? selectedRelationFields?.energyRelations : undefined,
      conversionScenarios: isPowerCenterSecondaryUnit ? selectedRelationFields?.conversionScenarios : form.conversionScenarios,
    };
    const submitForm = isRootForm
      ? { ...normalizedForm, unitType: rootCategory === '生产类用能单元' ? '生产单元' as const : nonProductionType as EnergyUnitType, conversionScenarios: [] }
      : level === 'level2' && form.unitType === '公辅系统'
        ? normalizedForm
        : { ...normalizedForm, conversionScenarios: [] };
    const result =
      dialog.type === 'addRoot'
        ? createEnergyUnit(submitForm, Number(year))
        : dialog.type === 'addChild'
          ? addChildEnergyUnit(dialog.parentEnergyUnitId, submitForm, Number(year))
          : updateEnergyUnit(dialog.energyUnitId, submitForm, Number(year));

    if (!result.ok) {
      setError(
        result.error === 'duplicateName'
          ? '同一所属单元下已存在该名称，请使用其他名称。'
          : result.error === 'invalidEnergyRelation'
            ? '请补全能源转换关系，并检查是否存在重复组合或无效能源品种。'
          : result.error === 'maxLevel'
            ? '用能单元最多设置为两级，二级单元不能继续添加下级。'
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
    <Modal title={`${title}（${year}年度）`} width={isPowerCenterForm ? 620 : 760} onClose={onClose} onSubmit={save}>
      <div className={[styles.formGrid, isPowerCenterForm ? styles.compactForm : ''].join(' ')}>
        {isPowerCenterForm && parent ? (
          <div className={styles.compactContext}>
            <span>所属单元：<strong>{parent.energyUnitName}</strong></span>
            <span>{levelLabels[level]}</span>
            <span>{form.unitType}</span>
            {!isChangingChildType && <button type="button" className={styles.action} onClick={() => setIsChangingChildType(true)}>修改类型</button>}
          </div>
        ) : dialog.type === 'addChild' && parent && (
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
        {(!isPowerCenterForm || !isAddingChild || isChangingChildType) && <Field label="单元类型" required>
          {isRootForm ? (
            <div className={styles.rootTypeFields}>
              <select aria-label="单元类型" required value={rootCategory} onChange={(event) => {
                const category = event.target.value as RootCategory;
                setRootCategory(category);
                setNonProductionType('');
                setForm((current) => ({ ...current, unitType: category === '生产类用能单元' ? '生产单元' : '' as EnergyUnitType }));
              }}>
                <option value="" disabled>请选择单元类型</option>
                {rootCategoryOptions.map((category) => <option value={category} key={category}>{category}</option>)}
              </select>
              {rootCategory === '非生产类用能单元' && (
                <select aria-label="非生产类用能单元类型" required value={nonProductionType} onChange={(event) => {
                  const type = event.target.value as EnergyUnitType;
                  setNonProductionType(type);
                  setForm((current) => ({ ...current, unitType: type }));
                }}>
                  <option value="" disabled>请选择非生产类型</option>
                  {nonProductionTypeOptions.map((type) => <option value={type} key={type}>{type}</option>)}
                </select>
              )}
            </div>
          ) : isAddingChild && !isChangingChildType ? (
            <div className={styles.defaultTypeField}>
              <div>
                <span>系统默认</span>
                <strong>{form.unitType}</strong>
              </div>
              {availableTypes.length > 1 && (
                <button type="button" onClick={() => setIsChangingChildType(true)}>
                  修改类型
                </button>
              )}
            </div>
          ) : (
            <div className={styles.typeSelectField}>
              <select
                aria-label="单元类型"
                required
                value={form.unitType}
                onChange={(event) => {
                  const unitType = event.target.value as EnergyUnitType;
                  setForm((current) => ({ ...current, unitType }));
                }}
              >
                {!isAddingChild && (
                  <option value="" disabled>
                    请选择单元类型
                  </option>
                )}
                {availableTypes.map((unitType) => (
                  <option value={unitType} key={unitType}>
                    {unitType}
                  </option>
                ))}
              </select>
              {isAddingChild && (
                <button
                  type="button"
                  className={styles.resetType}
                  onClick={() => {
                    setForm((current) => ({ ...current, unitType: inheritedChildTypeRule.defaultType }));
                    setIsChangingChildType(false);
                  }}
                >
                  恢复默认
                </button>
              )}
            </div>
          )}
        </Field>}
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
        {isPowerCenterSecondaryUnit && (
          <fieldset className={styles.energyRelationGroup} aria-label="能源转换关系" aria-describedby={relationHintId}>
            <legend>
              <span className={styles.requiredMark} aria-hidden="true">*</span> 能源转换关系
              <span className={styles.relationHelp} onMouseEnter={() => setShowRelationHelp(true)} onMouseLeave={() => setShowRelationHelp(false)}>
                <button
                  type="button"
                  aria-label="能源转换关系选择说明"
                  aria-describedby={showRelationHelp ? relationTooltipId : undefined}
                  onFocus={() => setShowRelationHelp(true)}
                  onBlur={() => setShowRelationHelp(false)}
                  onClick={() => setShowRelationHelp(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') { event.stopPropagation(); setShowRelationHelp(false); }
                  }}
                >?</button>
                {showRelationHelp && <span id={relationTooltipId} role="tooltip" className={styles.relationTooltip}>请按实际投入和产出的能源配置，不限定企业的单元名称。一期每个单元配置一种投入和一种产出。关系配置不代替数量填报，也不会自动重复计入投入。自定义组合从本年度能源品种中选择，缺少品种时请先在“能源品种”维护。余热产汽的产出同样选择“蒸汽”，回收来源由投入能源及转换记录保留。</span>}
              </span>
            </legend>
            <p id={relationHintId}>选择一种投入能源和一种产出能源。</p>
            {hasMultipleRelations ? (
              <p>此单元包含多条历史转换关系，当前版本暂不支持编辑，原有数据已保留。</p>
            ) : (
              <>
                <div className={styles.relationMode} role="group" aria-label="关系配置方式">
                  <button type="button" aria-pressed={!isCustomRelation} onClick={() => { setIsCustomRelation(false); setError(''); }}>常用关系</button>
                  <button type="button" aria-pressed={isCustomRelation} onClick={() => { setIsCustomRelation(true); setError(''); }}>自定义</button>
                </div>
                {isCustomRelation ? (
                  <div className={styles.customRelationFields}>
                    <Field label="投入能源"><select aria-label="投入能源" aria-required="true" value={relation.inputEnergyTypeId} onChange={(event) => {
                      setForm((current) => ({ ...current, energyRelations: [{ ...relation, inputEnergyTypeId: event.target.value }] }));
                      setError('');
                    }}><option value="">请选择投入能源</option>{energyTypes.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>
                    <span aria-hidden="true">→</span>
                    <Field label="产出能源"><select aria-label="产出能源" aria-required="true" value={relation.outputEnergyTypeId} onChange={(event) => {
                      setForm((current) => ({ ...current, energyRelations: [{ ...relation, outputEnergyTypeId: event.target.value }] }));
                      setError('');
                    }}><option value="">请选择产出能源</option>{energyTypes.map((type) => <option key={type.energyTypeId} value={type.energyTypeId}>{type.energyTypeName}</option>)}</select></Field>
                  </div>
                ) : (
                  <select aria-label="常用能源转换关系" aria-required="true" value={presetIndex >= 0 ? String(presetIndex) : ''} onChange={(event) => {
                    const preset = availablePresets[Number(event.target.value)];
                    setForm((current) => ({ ...current, energyRelations: [{ inputEnergyTypeId: preset.inputEnergyTypeId, outputEnergyTypeId: preset.outputEnergyTypeId }] }));
                    setError('');
                  }}>
                    <option value="" disabled>请选择能源转换关系</option>
                    {[...new Set(availablePresets.map((preset) => preset.output))].map((output) => (
                      <optgroup key={output} label={'产出' + output}>
                        {availablePresets.map((preset, optionIndex) => preset.output === output && (
                          <option key={optionIndex} value={optionIndex}>{preset.input} → {preset.output}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
              </>
            )}
          </fieldset>
        )}
        {!isPowerCenterSecondaryUnit && level === 'level2' && form.unitType === '公辅系统' && (
          <div className={styles.full}>
            <Field label="适用转换场景">
              <div className={styles.checkboxGroup}>
                {conversionScenarioOptions.map((scenario) => (
                  <label key={scenario}>
                    <input
                      type="checkbox"
                      checked={form.conversionScenarios?.includes(scenario) ?? false}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        conversionScenarios: event.target.checked
                          ? [...(current.conversionScenarios ?? []), scenario]
                          : (current.conversionScenarios ?? []).filter((item) => item !== scenario),
                      }))}
                    />
                    {scenario}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        )}
        {isPowerCenterForm ? (
          <details className={styles.optionalRemark} open={target?.remark ? true : undefined}>
            <summary>备注（选填）</summary>
            <textarea aria-label="备注" value={form.remark} placeholder="填写补充说明" rows={2} onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))} />
          </details>
        ) : (
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
        )}
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
  const [year] = useDataYear();
  const navigate = useNavigate();
  const referenceItems = [
    { label: '下级用能单元', count: references.childCount, path: '/data-management/units' },
    { label: '能源消费数据', count: references.energyRecordCount, path: '/data-management/energy-data' },
    { label: '运营数据', count: references.operationRecordCount, path: '/data-management/operations' },
    { label: '重点设备档案', count: references.deviceCount, path: '/data-management/devices' },
    { label: '能源流转关系', count: references.conversionRelationCount, path: '/data-management/energy-data?tab=recovery' },
  ].filter((item) => item.count > 0);

  return (
    <Modal title={`无法删除用能单元（${year}年度）`} width={560} cancelText="我知道了" onClose={onClose}>
      <p className={styles.blockerIntro}>
        用能单元“{unit.energyUnitName}”已关联数据，无法删除。
      </p>
      <ul className={styles.blockerList}>
        {referenceItems.map((item) => (
          <li key={item.label}>
            <span>{item.label}</span>
            <span className={styles.blockerAction}>
              <strong>{item.count} 项</strong>
              <button type="button" onClick={() => navigate(`${item.path}${item.path.includes('?') ? '&' : '?'}year=${year}&unitId=${unit.energyUnitId}`)}>去处理</button>
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
function unitCategory(unit: EnergyUnit) {
  return unit.unitType === '生产单元' || unit.unitType === '工序/环节' ? '生产类' : '非生产类';
}

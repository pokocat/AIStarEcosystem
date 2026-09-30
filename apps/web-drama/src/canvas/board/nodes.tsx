"use client";

// 画布上的六种节点：角色分组、场景分组、造型卡、场景卡、素材图、文字。
// 每张卡都 React.memo，比较的是 data 引用（derive.ts 的 stabilizeNodes 保证没变的 data 引用不变）。
// 卡片尺寸定死（auto-layout.ts CARD），样式在 canvas-board.css。
//
// 连线：卡片右边一个出线点（拖出去连到别的卡片）；整张卡片是一个「接线区」（React Flow 的 target handle 铺满卡片，
// 平时不接鼠标，只有正在拖线时才接，见 canvas-board.css .cvb-drop）。分组和文字也有接线区 —— 为的是拖到上面时
// 能说一句「这里连不上」，而不是什么都不发生。
import * as React from "react";
import { Handle, Position, type NodeProps, type NodeTypes } from "@xyflow/react";
import { ChevronDown, ChevronRight, ImageIcon, Loader2, MoreHorizontal, Plus, Trash2, Type } from "lucide-react";
import { CanvasImage } from "@/canvas/shell";
import { useBoardActions, type RenameTarget } from "./board-context";
import type {
  CharGroupNode,
  ImageMaterialNode,
  LookNode,
  RunBusy,
  SceneGroupNode,
  SceneNode,
  TextMaterialNode,
} from "./derive";

const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

/** 卡片上按钮的点击：不冒泡到节点（否则同时触发「选中卡片」）。 */
function stop(fn: () => void) {
  return (e: React.SyntheticEvent) => {
    e.stopPropagation();
    fn();
  };
}

type AnyNodeProps = { data: unknown; selected?: boolean; dragging?: boolean; isConnectable?: boolean; width?: number; height?: number };

/** memo 比较：位置变了不用重画（React Flow 在外层 transform），只看数据、选中、拖动、尺寸。 */
function nodePropsEqual(a: AnyNodeProps, b: AnyNodeProps): boolean {
  return (
    a.data === b.data &&
    a.selected === b.selected &&
    a.dragging === b.dragging &&
    a.isConnectable === b.isConnectable &&
    a.width === b.width &&
    a.height === b.height
  );
}

// ── 小零件 ───────────────────────────────────────────────────────────────────

/** 名字：双击改名（只读时不给改）。 */
function InlineName({
  value,
  target,
  className,
  label,
}: {
  value: string;
  target: RenameTarget;
  className?: string;
  /** 输入框的读屏名（「角色名」「场景名」）。 */
  label: string;
}) {
  const a = useBoardActions();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const commit = () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== value) a.rename(target, name);
  };
  if (editing && !a.readOnly) {
    return (
      <input
        className="cvb-name-input nodrag"
        autoFocus
        value={draft}
        maxLength={30}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <span
      className={cx(className, "cv-ellipsis")}
      title={a.readOnly ? value : `${value}（双击改名）`}
      onDoubleClick={
        a.readOnly
          ? undefined
          : (e) => {
              e.stopPropagation();
              setDraft(value);
              setEditing(true);
            }
      }
    >
      {value}
    </span>
  );
}

function BusyVeil({ busy }: { busy: RunBusy }) {
  if (!busy) return null;
  return (
    <div className="cvb-busy" role="status">
      <Loader2 size={16} className="cv-spin" />
      <span>{busy === "queued" ? "排队中" : "生成中"}</span>
    </div>
  );
}

function Placeholder({ text = "待生成" }: { text?: string }) {
  return (
    <div className="cvb-ph">
      <ImageIcon size={18} />
      <span>{text}</span>
    </div>
  );
}

/** 接线区。withDot = 在卡片左边中间画一个进线的小圆点（只是画出来看的；真正接线的是铺满卡片的 handle）。
 *  分组、文字不能当参考的去处，不画点。 */
function DropZone({ withDot = true }: { withDot?: boolean }) {
  return (
    <>
      <Handle type="target" position={Position.Left} className="cvb-drop" isConnectableStart={false} />
      {withDot && <span className="cvb-in" aria-hidden />}
    </>
  );
}

function OutPoint() {
  return <Handle type="source" position={Position.Right} className="cvb-out" title="拖出去连到别的卡片，给它当参考" />;
}

function FailLine({ failed }: { failed?: string }) {
  if (!failed) return null;
  return (
    <div className="cvb-fail cv-ellipsis" title={failed}>
      上次没生成出来：{failed}
    </div>
  );
}

// ── 造型卡 ───────────────────────────────────────────────────────────────────

function LookNodeView({ data, selected }: NodeProps<LookNode>) {
  const a = useBoardActions();
  return (
    <div className={cx("cvb-card cvb-look", selected && "is-selected", data.highlighted && !selected && "is-highlighted")}>
      <DropZone />
      <div className="cvb-media cvb-look-media">
        <CanvasImage asset={data.image} alt={data.label} fit="cover" className="cvb-img" placeholder={<Placeholder />} />
        <BusyVeil busy={data.busy} />
        {data.imageCount > 1 && (
          <button type="button" className="cvb-count nodrag" title="有几张候选，点开挑一张" onClick={stop(() => a.openLookDetail(data.lookId))}>
            {data.imageCount} 张
          </button>
        )}
        {!a.readOnly && (
          <button
            type="button"
            className="cvb-del hover-reveal nodrag"
            aria-label="删除这个造型"
            title="删除这个造型"
            onClick={stop(() => a.requestDelete(data.lookId))}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div className="cvb-body">
        <div className="cvb-title-row">
          <span className="cvb-title cv-ellipsis" title={data.label}>
            {data.label}
          </span>
          <button type="button" className="cvb-more nodrag" aria-label="造型详情" title="造型详情" onClick={stop(() => a.openLookDetail(data.lookId))}>
            <MoreHorizontal size={16} />
          </button>
        </div>
        <div className="cvb-meta cv-ellipsis" title={data.episodesText}>
          {data.episodesText}
        </div>
        <FailLine failed={data.failed} />
      </div>
      <OutPoint />
    </div>
  );
}

// ── 场景卡 ───────────────────────────────────────────────────────────────────

function SceneNodeView({ data, selected }: NodeProps<SceneNode>) {
  const a = useBoardActions();
  return (
    <div className={cx("cvb-card cvb-scene", selected && "is-selected", data.highlighted && !selected && "is-highlighted")}>
      <DropZone />
      <div className="cvb-media cvb-scene-media">
        <CanvasImage asset={data.image} alt={data.name} fit="cover" className="cvb-img" placeholder={<Placeholder />} />
        <BusyVeil busy={data.busy} />
        {data.imageCount > 1 && (
          <button type="button" className="cvb-count nodrag" title="有几张候选，选中这张卡片后挑一张" onClick={stop(() => a.select(data.sceneId))}>
            {data.imageCount} 张
          </button>
        )}
        {!a.readOnly && (
          <button
            type="button"
            className="cvb-del hover-reveal nodrag"
            aria-label="删除这个场景"
            title="删除这个场景"
            onClick={stop(() => a.requestDelete(data.sceneId))}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div className="cvb-body">
        <div className="cvb-title-row">
          <InlineName className="cvb-title" value={data.name} target={{ kind: "scene", id: data.sceneId }} label="场景名" />
        </div>
        <div className="cvb-meta cv-ellipsis" title={data.episodesText}>
          {data.episodesText}
        </div>
        <FailLine failed={data.failed} />
      </div>
      <OutPoint />
    </div>
  );
}

// ── 素材图 ───────────────────────────────────────────────────────────────────

function ImageMaterialNodeView({ data, selected }: NodeProps<ImageMaterialNode>) {
  const a = useBoardActions();
  return (
    <div className={cx("cvb-card cvb-image", selected && "is-selected", data.highlighted && !selected && "is-highlighted")}>
      <DropZone />
      <div className="cvb-media cvb-image-media">
        <CanvasImage asset={data.image} alt={data.name} fit="contain" className="cvb-img" placeholder={<Placeholder text="还没有图" />} />
        <BusyVeil busy={data.busy} />
        {data.imageCount > 1 && (
          <button type="button" className="cvb-count nodrag" title="有几张候选，选中这张卡片后挑一张" onClick={stop(() => a.select(data.materialId))}>
            {data.imageCount} 张
          </button>
        )}
        {!a.readOnly && (
          <button
            type="button"
            className="cvb-del hover-reveal nodrag"
            aria-label="删除这张素材图"
            title="删除这张素材图"
            onClick={stop(() => a.requestDelete(data.materialId))}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div className="cvb-body">
        <div className="cvb-title-row">
          <span className="cvb-kind">素材图</span>
          <InlineName className="cvb-title" value={data.name} target={{ kind: "material", id: data.materialId }} label="素材图名字" />
        </div>
        <FailLine failed={data.failed} />
      </div>
      <OutPoint />
    </div>
  );
}

// ── 文字 ─────────────────────────────────────────────────────────────────────

function TextMaterialNodeView({ data, selected }: NodeProps<TextMaterialNode>) {
  const a = useBoardActions();
  return (
    <div className={cx("cvb-card cvb-text", selected && "is-selected", data.highlighted && !selected && "is-highlighted")}>
      <DropZone withDot={false} />
      <div className="cvb-text-head">
        <Type size={14} className="cvb-text-icon" />
        <InlineName className="cvb-title" value={data.name} target={{ kind: "material", id: data.materialId }} label="文字的名字" />
        {!a.readOnly && (
          <button
            type="button"
            className="cvb-icon-btn hover-reveal nodrag"
            aria-label="删除这段文字"
            title="删除这段文字"
            onClick={stop(() => a.requestDelete(data.materialId))}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <textarea
        className="cvb-text-input nodrag nowheel"
        value={data.text}
        readOnly={a.readOnly}
        maxLength={2000}
        aria-label={`${data.name}的内容`}
        placeholder="写一段话，连给造型、场景或素材图，出图时会拼进它的描述里"
        onChange={(e) => a.setMaterialText(data.materialId, e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />
      <OutPoint />
    </div>
  );
}

// ── 分组 ─────────────────────────────────────────────────────────────────────

function CollapseToggle({ collapsed, name, groupId }: { collapsed: boolean; name: string; groupId: string }) {
  const a = useBoardActions();
  return (
    <button
      type="button"
      className="cvb-icon-btn nodrag"
      aria-expanded={!collapsed}
      aria-label={collapsed ? `展开${name}` : `收起${name}`}
      title={collapsed ? "展开" : "收起"}
      disabled={a.readOnly}
      onClick={stop(() => a.toggleCollapsed(groupId))}
    >
      {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
    </button>
  );
}

function CharGroupNodeView({ id, data }: NodeProps<CharGroupNode>) {
  const a = useBoardActions();
  return (
    <div className={cx("cvb-group", data.collapsed && "is-collapsed")}>
      <DropZone withDot={false} />
      <div className="cvb-group-head">
        <CollapseToggle collapsed={data.collapsed} name={data.name} groupId={id} />
        <InlineName className="cvb-group-name" value={data.name} target={{ kind: "character", id: data.characterId }} label="角色名" />
        {data.role === "lead" && <span className="tag tag-accent cvb-group-tag">主要角色</span>}
        {data.collapsed && <span className="cvb-group-count">{data.lookCount} 个造型</span>}
        <span className="cvb-spacer" />
        {!a.readOnly && !data.collapsed && (
          <button type="button" className="cvb-group-add nodrag" onClick={stop(() => a.addLookTo(data.characterId))}>
            <Plus size={14} />
            加一个造型
          </button>
        )}
        {!a.readOnly && (
          <button
            type="button"
            className="cvb-icon-btn cvb-group-del hover-reveal nodrag"
            aria-label={`删除角色${data.name}`}
            title="删除这个角色"
            onClick={stop(() => a.requestDelete(id))}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function SceneGroupNodeView({ id, data }: NodeProps<SceneGroupNode>) {
  const a = useBoardActions();
  return (
    <div className={cx("cvb-group cvb-group-scenes", data.collapsed && "is-collapsed")}>
      <DropZone withDot={false} />
      <div className="cvb-group-head">
        <CollapseToggle collapsed={data.collapsed} name="场景" groupId={id} />
        <span className="cvb-group-name">场景</span>
        <span className="cvb-group-count">{data.count} 个</span>
        <span className="cvb-spacer" />
        {!a.readOnly && !data.collapsed && (
          <button type="button" className="cvb-group-add nodrag" onClick={stop(() => a.addScene())}>
            <Plus size={14} />
            加一个场景
          </button>
        )}
      </div>
    </div>
  );
}

/** 给 <ReactFlow nodeTypes>：模块级常量（每次渲染换一个对象 React Flow 会报警并重建所有节点）。 */
export const NODE_TYPES = {
  charGroup: React.memo(CharGroupNodeView, nodePropsEqual),
  sceneGroup: React.memo(SceneGroupNodeView, nodePropsEqual),
  look: React.memo(LookNodeView, nodePropsEqual),
  scene: React.memo(SceneNodeView, nodePropsEqual),
  imageMaterial: React.memo(ImageMaterialNodeView, nodePropsEqual),
  textMaterial: React.memo(TextMaterialNodeView, nodePropsEqual),
} as unknown as NodeTypes;

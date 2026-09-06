"use client";

// source / style / look / reference / publish 五种节点的属性面板。

import * as React from "react";
import { Check, ExternalLink } from "lucide-react";
import type { IpNode, IpStylePreset } from "@ai-star-eco/types";
import { useCanvasStore } from "@/lib/canvas-store";
import { Collapsible, Field, ImageUploadField, TextAreaInput, TextInput } from "./fields";

const AIAVATAR_URL = process.env.NEXT_PUBLIC_AIAVATAR_URL ?? "http://localhost:3013";

export function SourceInspector({
  node, uploading, onUpload,
}: {
  node: IpNode & { type: "source" };
  uploading: boolean;
  onUpload: (nodeId: string, file: File) => void;
}) {
  return (
    <div className="space-y-3.5">
      <div className="px-2.5 py-2 rounded-xl text-[10.5px] leading-relaxed" style={{ background: "var(--primary-tint)", color: "var(--ink-2)" }}>
        一张正脸、光线均匀、没有重度滤镜的照片效果最好 —— 这张图决定了整套 IP 长什么样。
      </div>
      <ImageUploadField
        label="身份照片"
        imageUrl={node.data.imageUrl}
        fileName={node.data.fileName}
        uploading={uploading}
        onPick={(file) => onUpload(node.id, file)}
      />
    </div>
  );
}

export function StyleInspector({
  node, styles,
}: {
  node: IpNode & { type: "style" };
  styles: IpStylePreset[];
}) {
  const patchNodeData = useCanvasStore((s) => s.patchNodeData);

  return (
    <div className="space-y-3.5">
      <div>
        <span className="field-label block mb-1.5">内置风格</span>
        <div className="space-y-1.5">
          {styles.map((s) => {
            const active = node.data.presetId === s.id && !node.data.custom;
            return (
              <button
                key={s.id}
                onClick={() =>
                  patchNodeData(node.id, "style", {
                    presetId: s.id,
                    name: s.name,
                    promptEn: s.promptEn,
                    negativeEn: s.negativeEn,
                    custom: false,
                  })
                }
                className="w-full flex items-start gap-2 px-2.5 py-2 rounded-xl text-left transition"
                style={active
                  ? { background: "var(--primary-soft)", border: "1px solid var(--primary)" }
                  : { background: "var(--surface-2)", border: "1px solid var(--line-2)" }}
                aria-pressed={active}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-bold truncate" style={{ color: "var(--ink)" }}>{s.name}</span>
                  <span className="block text-[10px] leading-snug line-clamp-2" style={{ color: "var(--ink-3)" }}>{s.summary}</span>
                </span>
                {active && <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--primary-700)" }} />}
              </button>
            );
          })}
          {styles.length === 0 && (
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
              内置风格还没加载出来，稍后再试，或在下面自己写一段风格描述。
            </p>
          )}
        </div>
      </div>

      <Collapsible
        title="自定义风格描述"
        defaultOpen={node.data.custom}
        meta={node.data.custom ? <span className="text-[10px] font-bold shrink-0" style={{ color: "var(--primary-700)" }}>正在用</span> : undefined}
      >
        <div className="space-y-2.5">
          <Field label="风格名（给自己看）">
            <TextInput
              value={node.data.name}
              placeholder="例如：奶油玻璃质感"
              onChange={(e) => patchNodeData(node.id, "style", { name: e.target.value, custom: true, presetId: undefined })}
            />
          </Field>
          <Field label="风格描述（英文，会逐字进提示词）">
            <TextAreaInput
              rows={4}
              value={node.data.promptEn}
              placeholder="glossy cream glass material, soft rim light, …"
              onChange={(e) => patchNodeData(node.id, "style", { promptEn: e.target.value, custom: true, presetId: undefined })}
              style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}
            />
          </Field>
          <Field label="不要出现什么（英文，可留空）">
            <TextAreaInput
              rows={2}
              value={node.data.negativeEn ?? ""}
              placeholder="text, watermark, extra fingers"
              onChange={(e) => patchNodeData(node.id, "style", { negativeEn: e.target.value })}
              style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}
            />
          </Field>
        </div>
      </Collapsible>
    </div>
  );
}

const LOOK_FIELDS: Array<{ key: "outfit" | "pose" | "expression" | "details" | "props"; label: string; placeholder: string; rows: number }> = [
  { key: "outfit", label: "服装", placeholder: "米色粗针织毛衣、浅色直筒牛仔裤", rows: 2 },
  { key: "pose", label: "姿势", placeholder: "站姿，双手捧着手机低头看屏幕", rows: 2 },
  { key: "expression", label: "表情", placeholder: "嘴角微扬，眼神专注", rows: 2 },
  { key: "details", label: "细节", placeholder: "毛衣纹理清晰，屏幕有微弱冷光", rows: 2 },
  { key: "props", label: "道具（可留空）", placeholder: "一部白色手机", rows: 1 },
];

export function LookInspector({ node }: { node: IpNode & { type: "look" } }) {
  const patchNodeData = useCanvasStore((s) => s.patchNodeData);

  return (
    <div className="space-y-3">
      <Field label="造型名">
        <TextInput
          value={node.data.title}
          placeholder="例如：针织衫拿手机"
          onChange={(e) => patchNodeData(node.id, "look", { title: e.target.value })}
        />
      </Field>
      {LOOK_FIELDS.map((f) => (
        <Field key={f.key} label={f.label}>
          <TextAreaInput
            rows={f.rows}
            value={node.data[f.key] ?? ""}
            placeholder={f.placeholder}
            onChange={(e) => patchNodeData(node.id, "look", { [f.key]: e.target.value })}
          />
        </Field>
      ))}
    </div>
  );
}

export function ReferenceInspector({
  node, uploading, onUpload,
}: {
  node: IpNode & { type: "reference" };
  uploading: boolean;
  onUpload: (nodeId: string, file: File) => void;
}) {
  const patchNodeData = useCanvasStore((s) => s.patchNodeData);

  return (
    <div className="space-y-3.5">
      <ImageUploadField
        label="参考图"
        aspect="1/1"
        imageUrl={node.data.imageUrl}
        uploading={uploading}
        onPick={(file) => onUpload(node.id, file)}
      />
      <Field label="只参考哪一部分" hint="写清楚参考范围，模型才不会把整张图都抄过去。">
        <TextAreaInput
          rows={3}
          value={node.data.note}
          placeholder="例如：只参考帽子的款式与配色，不参考人物"
          onChange={(e) => patchNodeData(node.id, "reference", { note: e.target.value })}
        />
      </Field>
    </div>
  );
}

export function PublishInspector({ node }: { node: IpNode & { type: "publish" } }) {
  const patchNodeData = useCanvasStore((s) => s.patchNodeData);
  const published = Boolean(node.data.avatarId);

  return (
    <div className="space-y-3.5">
      <Field label="资产名" hint="发布后在数字资产平台里就用这个名字。">
        <TextInput
          value={node.data.avatarName}
          placeholder="例如：小柚"
          disabled={published}
          onChange={(e) => patchNodeData(node.id, "publish", { avatarName: e.target.value })}
        />
      </Field>

      {published ? (
        <div className="p-3 rounded-xl" style={{ background: "var(--ok-soft)" }}>
          <div className="text-[12px] font-bold mb-1" style={{ color: "var(--ok)" }}>已发布为数字资产</div>
          <div className="reg mb-2.5" style={{ color: "var(--ok)" }}>{node.data.avatarId}</div>
          <a
            href={`${AIAVATAR_URL}/assets/${node.data.avatarId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold"
            style={{ color: "var(--ok)" }}
          >
            去数字资产平台查看 <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : (
        <p className="text-[10.5px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
          形象都定稿之后，用上方工作栏的「发布」按钮选主形象与要一起带上的造型。
        </p>
      )}
    </div>
  );
}

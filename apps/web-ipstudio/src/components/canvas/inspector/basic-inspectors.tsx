"use client";

// source / style / look / reference / publish 五种节点的属性面板。

import * as React from "react";
import { Check, ExternalLink } from "lucide-react";
import type { IpNode, IpPromptGroup, IpStylePreset } from "@ai-star-eco/types";
import { useCanvasStore } from "@/lib/canvas-store";
import { LEGACY_LOOK_KEYS } from "@/lib/graph";
import { AIAVATAR_URL } from "@/lib/external";
import { Collapsible, Field, ImageUploadField, TextAreaInput, TextInput } from "./fields";



export function SourceInspector({
  node, uploading, onUpload,
}: {
  node: IpNode & { type: "source" };
  uploading: boolean;
  onUpload: (nodeId: string, file: File) => void;
}) {
  return (
    <div className="space-y-3.5">
      <div className="px-3 py-2.5 rounded-xl text-[14px] leading-[1.7]" style={{ background: "var(--primary-tint)", color: "var(--ink-2)" }}>
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
                  <span className="block text-[14px] font-bold truncate" style={{ color: "var(--ink)" }}>{s.name}</span>
                  {/* 说明文字 ≥14px 且允许换行（评审：不靠缩小字号解决）；选中态底是
                      primary-soft，ink-3 在它上面余量不足，所以统一走 ink-2 */}
                  <span className="block mt-0.5 text-[14px] leading-[1.6]" style={{ color: "var(--ink-2)" }}>{s.summary}</span>
                </span>
                {active && <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--primary-700)" }} />}
              </button>
            );
          })}
          {styles.length === 0 && (
            <p className="text-[14px] leading-[1.7]" style={{ color: "var(--ink-2)" }}>
              内置风格还没加载出来，稍后再试，或在下面自己写一段风格描述。
            </p>
          )}
        </div>
      </div>

      <Collapsible
        title="自定义风格描述"
        defaultOpen={node.data.custom}
        meta={node.data.custom ? <span className="text-[12px] font-bold shrink-0" style={{ color: "var(--primary-700)" }}>正在用</span> : undefined}
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
              style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
            />
          </Field>
          <Field label="不要出现什么（英文，可留空）">
            <TextAreaInput
              rows={2}
              value={node.data.negativeEn ?? ""}
              placeholder="text, watermark, extra fingers"
              onChange={(e) => patchNodeData(node.id, "style", { negativeEn: e.target.value })}
              style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
            />
          </Field>
        </div>
      </Collapsible>
    </div>
  );
}

/**
 * 形象卡属性面板 —— 一个提示词框 + 下面的常见选项。
 *
 * v0.151 是「服装 / 姿势 / 表情 / 细节 / 道具」五个固定框，等于替用户规定了造型只能这么描述；
 * 现在改成一段自由文字，内置模板只负责把词填进去。老画布的五字段不迁移、原样保留读取
 * （服务端 IpRunService.lookText 按老顺序拼接回落），所以升级不会让任何人的旧项目变空。
 */
export function LookInspector({
  node, promptGroups,
}: {
  node: IpNode & { type: "look" };
  promptGroups: IpPromptGroup[];
}) {
  const patchNodeData = useCanvasStore((s) => s.patchNodeData);
  const [gender, setGender] = React.useState<"female" | "male">("female");

  const legacy = LEGACY_LOOK_KEYS.map((k) => (node.data[k] ?? "").trim()).filter(Boolean).join("，");
  const prompt = node.data.prompt ?? "";

  // 点模板 = 往输入框里追加一句，不覆盖用户已经写的东西。
  const append = (text: string) => {
    const cur = prompt.trim();
    patchNodeData(node.id, "look", { prompt: cur ? `${cur}，${text}` : text });
  };

  return (
    <div className="space-y-3.5">
      <Field label="造型名">
        <TextInput
          value={node.data.title}
          placeholder="例如：针织衫拿手机"
          onChange={(e) => patchNodeData(node.id, "look", { title: e.target.value })}
        />
      </Field>

      <Field label="这个造型长什么样" hint="一段话说清楚就行：穿什么、什么表情、在干嘛。下面的常见选项点一下就填进来。">
        <TextAreaInput
          rows={5}
          value={prompt}
          placeholder="例如：米色粗针织毛衣配浅色直筒牛仔裤，站着低头看手机，嘴角微扬"
          onChange={(e) => patchNodeData(node.id, "look", { prompt: e.target.value })}
        />
      </Field>

      {/* 老画布升上来的：五个字段还在，但不再提供编辑入口 —— 一处编辑，避免两份真值打架。 */}
      {!prompt.trim() && legacy && (
        <div className="px-3 py-2.5 rounded-xl text-[13px] leading-[1.7]" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
          <div className="mb-1.5" style={{ color: "var(--ink-3)" }}>这个造型是旧版填的，出图时仍按原内容：</div>
          {/* 老文档里可能是一整段没有空格的长文本，侧栏很窄 —— 必须强制断行，否则撑破布局 */}
          <div style={{ color: "var(--ink)", overflowWrap: "anywhere", wordBreak: "break-word" }}>{legacy}</div>
          <button
            className="mt-2 text-[13px] underline underline-offset-2"
            style={{ color: "var(--primary)" }}
            onClick={() => patchNodeData(node.id, "look", { prompt: legacy })}
          >
            搬到上面的输入框继续编辑
          </button>
        </div>
      )}

      {promptGroups.map((group) => {
        const isOutfit = group.presets.some((p) => p.gender !== "any");
        const presets = isOutfit ? group.presets.filter((p) => p.gender === gender || p.gender === "any") : group.presets;
        return (
          <div key={group.id}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="field-label">{group.name}</span>
              {isOutfit && (
                <span className="flex gap-1 ml-auto">
                  {(["female", "male"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className="px-2 py-[3px] rounded-full text-[12px] leading-none transition-colors"
                      style={{
                        background: gender === g ? "var(--primary)" : "var(--surface-2)",
                        color: gender === g ? "#fff" : "var(--ink-3)",
                      }}
                    >
                      {g === "female" ? "女" : "男"}
                    </button>
                  ))}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => append(p.prompt)}
                  title={p.prompt}
                  className="px-2.5 py-[5px] rounded-full text-[13px] leading-none max-w-full truncate transition-colors hover:opacity-80"
                  style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1px solid var(--line)" }}
                >
                  {p.name}
                </button>
              ))}
              {!presets.length && (
                <span className="text-[13px]" style={{ color: "var(--ink-4)" }}>这一组暂时没有可选项</span>
              )}
            </div>
          </div>
        );
      })}
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
        <div className="p-3.5 rounded-xl" style={{ background: "var(--ok-soft)" }}>
          <div className="text-[14px] font-bold mb-1" style={{ color: "var(--ok)" }}>已发布为数字资产</div>
          <div className="reg mb-2.5" style={{ color: "var(--ok)" }}>{node.data.avatarId}</div>
          <a
            href={`${AIAVATAR_URL}/assets/${node.data.avatarId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[14px] font-semibold"
            style={{ color: "var(--ok)" }}
          >
            去数字资产平台查看 <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      ) : (
        <p className="text-[14px] leading-[1.7]" style={{ color: "var(--ink-2)" }}>
          形象都定稿之后，用上方工作栏的「发布」按钮选主形象与要一起带上的造型。
        </p>
      )}
    </div>
  );
}

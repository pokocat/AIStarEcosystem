"use client";

// IP Studio 模型：剧本、图片、视频各用哪些模型、默认哪个、多少积分。保存后新请求立刻按新配置走，已提交的任务不受影响。

import * as React from "react";
import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Card } from "@ai-star-eco/ui/ui/card";
import { Input } from "@ai-star-eco/ui/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ai-star-eco/ui/ui/select";
import type { AiModelEndpoint, AiSceneCatalogRow, AiSceneModelPolicy } from "@ai-star-eco/types/ai-model-config";
import { ModelConfigApi } from "@/lib/api";
import { modelKind, sameJson, scenePolicyChanges } from "@/lib/model-config";
import { useConfirmDialog } from "@/components/use-confirm-dialog";
import { AffectedList, errorText, Field, functionNames, Notice, unitLabel, type ModelConfigData } from "./shared";

const SCENE_TITLE: Record<string, string> = { script: "剧本与文字", image: "图片生成" };

/** 编辑中价格可以是空：0 表示免费，新加的模型不能默认成 0。 */
type DraftPolicy = Omit<AiSceneModelPolicy, "candidates"> & { candidates: { endpointId: string; creditCost: number | null; billingUnit: string }[] };
const FOLLOW = "__follow";

export function StudioModels({ data, reload }: { data: ModelConfigData; reload: () => Promise<void> }) {
  return (
    <div className="space-y-4">
      {data.scenes.map((scene) => <SceneCard key={scene.scene} scene={scene} data={data} reload={reload} />)}
      <DirectorDefaultCard data={data} reload={reload} />
      <VideoCard data={data} reload={reload} />
    </div>
  );
}

function ChangeList({ lines }: { lines: string[] }) {
  return <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-700">{lines.map((line) => <li key={line}>{line}</li>)}</ul>;
}

function SceneCard({ scene, data, reload }: { scene: AiSceneCatalogRow; data: ModelConfigData; reload: () => Promise<void> }) {
  const empty: AiSceneModelPolicy = { appCode: scene.appCode, scene: scene.scene, mode: "selectable", defaultEndpointId: "", candidates: [] };
  const { confirm, dialog } = useConfirmDialog();
  const [draft, setDraft] = React.useState<DraftPolicy>(scene.policy ?? empty);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => { setDraft(scene.policy ?? empty); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [scene.policy]);

  const endpoint = (id: string) => data.endpoints.find((item) => item.id === id);
  const access = (id: string) => data.access.find((row) => row.endpointId === id)?.policy;
  const unit = unitLabel(scene.billingUnit);
  const dirty = !sameJson(draft, scene.policy ?? empty);
  const addable = scene.endpoints.filter((item) => {
    if (draft.candidates.some((candidate) => candidate.endpointId === item.id)) return false;
    const kind = modelKind(item, access(item.id));
    return kind === "unclassified" || kind === (scene.scene === "image" ? "image" : "text");
  });

  const unpriced = draft.candidates.find((candidate) => candidate.creditCost === null);
  const problem = !draft.candidates.length ? "至少选一个模型" : !draft.defaultEndpointId ? "请选择默认模型"
    : unpriced ? `请填写「${endpoint(unpriced.endpointId)?.name ?? unpriced.endpointId}」的积分价`
    : draft.mode === "fixed" && draft.candidates.length !== 1 ? "固定一个模型时，只能留一个" : "";

  const save = async () => {
    const changes = scenePolicyChanges(scene.policy, draft, (id) => endpoint(id)?.name ?? id, unit);
    if (!await confirm(`保存${SCENE_TITLE[scene.scene]}的改动？`, <div><p>保存后立刻对新的生成生效：</p><ChangeList lines={changes} /></div>, "确认保存")) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      // 新加的模型要先进这项能力的候选（或重新启用），否则服务端不收。
      for (const candidate of draft.candidates) {
        const known = scene.candidates.find((item) => item.endpointId === candidate.endpointId);
        if (!known || !known.enabled) {
          await ModelConfigApi.command("sceneCandidatePrepare", { appCode: scene.appCode, scene: scene.scene, endpointId: candidate.endpointId, value: { enabled: true } });
        }
      }
      await ModelConfigApi.command("scenePolicySave", { value: draft });
      await reload();
      setSaved(true);
    } catch (e) { setError(errorText(e)); await reload(); } finally { setSaving(false); }
  };

  return (
    <Card className="gap-0 p-0">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{SCENE_TITLE[scene.scene] ?? scene.scene}</h2>
          {!scene.policy && <p className="text-xs text-slate-500">还没有单独配置，现在按共用配置走。</p>}
        </div>
        <Select value={draft.mode} onValueChange={(mode) => setDraft({ ...draft, mode: mode as AiSceneModelPolicy["mode"] })}>
          <SelectTrigger aria-label={`${SCENE_TITLE[scene.scene]}的选择方式`} className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="selectable">用户可选</SelectItem><SelectItem value="fixed">固定一个模型</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b text-left text-xs text-slate-500">
            <th className="px-4 py-2 font-medium">模型</th><th className="px-3 py-2 font-medium">默认</th><th className="px-3 py-2 font-medium">积分 / {unit}</th><th className="w-12 px-4 py-2" />
          </tr></thead>
          <tbody>
            {draft.candidates.map((candidate) => {
              const item = endpoint(candidate.endpointId);
              return (
                <tr key={candidate.endpointId} className="border-b last:border-b-0">
                  <td className="max-w-80 px-4 py-2.5">
                    <p className="truncate font-medium text-slate-900">{item?.name ?? candidate.endpointId}</p>
                    {!item ? <p className="text-xs text-rose-600">模型已删除</p> : !item.enabled ? <p className="text-xs text-rose-600">模型已停用，用户选不到</p> : <p className="truncate font-mono text-xs text-slate-500">{item.model}</p>}
                  </td>
                  <td className="px-3 py-2.5"><input type="radio" name={`default-${scene.scene}`} aria-label={`把 ${item?.name ?? candidate.endpointId} 设为默认`} checked={draft.defaultEndpointId === candidate.endpointId} onChange={() => setDraft({ ...draft, defaultEndpointId: candidate.endpointId })} /></td>
                  <td className="px-3 py-2.5"><Input aria-label={`${item?.name ?? candidate.endpointId} 的积分价`} inputMode="numeric" className="h-8 w-24" placeholder="必填" value={candidate.creditCost === null ? "" : String(candidate.creditCost)}
                    onChange={(event) => { const raw = event.target.value.trim(); const value = Number(raw); if (raw === "" || (Number.isSafeInteger(value) && value >= 0)) setDraft({ ...draft, candidates: draft.candidates.map((row) => row.endpointId === candidate.endpointId ? { ...row, creditCost: raw === "" ? null : value } : row) }); }} /></td>
                  <td className="px-4 py-2.5 text-right"><Button variant="ghost" size="icon" aria-label={`移除 ${item?.name ?? candidate.endpointId}`} onClick={() => setDraft({ ...draft, candidates: draft.candidates.filter((row) => row.endpointId !== candidate.endpointId), defaultEndpointId: draft.defaultEndpointId === candidate.endpointId ? "" : draft.defaultEndpointId })}><Trash2 className="size-4" /></Button></td>
                </tr>
              );
            })}
            {!draft.candidates.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">还没有选模型</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
        <Select value="" onValueChange={(id) => setDraft({ ...draft, candidates: [...draft.candidates, { endpointId: id, creditCost: null, billingUnit: scene.billingUnit }], defaultEndpointId: draft.defaultEndpointId || id })}>
          <SelectTrigger aria-label={`给${SCENE_TITLE[scene.scene]}添加模型`} className="w-64"><SelectValue placeholder="添加模型" /></SelectTrigger>
          <SelectContent>{addable.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}{item.enabled ? "" : "（已停用）"}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex flex-wrap items-center gap-3">
          {dirty && problem && <span className="text-xs text-rose-600">{problem}</span>}
          {saved && !dirty && <span className="text-xs text-emerald-700">已保存</span>}
          <Button disabled={!dirty || !!problem || saving} onClick={() => void save()}>{saving && <Loader2 className="size-4 animate-spin" />}保存</Button>
        </div>
      </div>
      {error && <div className="border-t px-4 py-3"><Notice tone="error">{error}</Notice></div>}
    </Card>
  );
}

function DirectorDefaultCard({ data, reload }: { data: ModelConfigData; reload: () => Promise<void> }) {
  const image = data.scenes.find((scene) => scene.scene === "image");
  const [value, setValue] = React.useState(data.directorDefault ?? FOLLOW);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => setValue(data.directorDefault ?? FOLLOW), [data.directorDefault]);
  const name = (id: string) => data.endpoints.find((item) => item.id === id)?.name ?? id;
  const options = image?.policy?.candidates ?? [];
  const save = async () => {
    setSaving(true); setError("");
    try { await ModelConfigApi.command("directorImageDefaultSave", { endpointId: value }); await reload(); }
    catch (e) { setError(errorText(e)); } finally { setSaving(false); }
  };
  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label="AI 导演台默认图片模型" hint="作品没有单独选模型时用它。只能选上面图片生成里的模型。" className="min-w-64 flex-1">
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {value === FOLLOW && <SelectItem value={FOLLOW}>跟随图片生成的默认模型</SelectItem>}
              {options.map((candidate) => <SelectItem key={candidate.endpointId} value={candidate.endpointId}>{name(candidate.endpointId)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Button disabled={saving || value === FOLLOW || value === data.directorDefault} onClick={() => void save()}>{saving && <Loader2 className="size-4 animate-spin" />}保存</Button>
      </div>
      {data.directorDefault && !options.some((candidate) => candidate.endpointId === data.directorDefault) && <Notice tone="warn">「{name(data.directorDefault)}」已不在图片生成里，请重新选择。</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}

function VideoCard({ data, reload }: { data: ModelConfigData; reload: () => Promise<void> }) {
  const { confirm, dialog } = useConfirmDialog();
  const row = data.functions.find((item) => item.appCode === "studio" && item.feature === "video");
  const candidates = row?.candidates ?? [];
  const names = React.useMemo(() => functionNames(data.functions), [data.functions]);
  const currentDefault = candidates.find((candidate) => candidate.isDefault)?.endpointId ?? "";
  const [defaultId, setDefaultId] = React.useState(currentDefault);
  const initialPrices = React.useMemo(() => Object.fromEntries(candidates.map((candidate) => [candidate.endpointId, candidate.creditCostOverride == null ? "" : String(candidate.creditCostOverride)])), [candidates]);
  const [prices, setPrices] = React.useState(initialPrices);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => { setDefaultId(currentDefault); setPrices(initialPrices); }, [currentDefault, initialPrices]);

  const changedPrices = candidates.filter((candidate) => (prices[candidate.endpointId] ?? "") !== initialPrices[candidate.endpointId]);
  const invalid = changedPrices.some((candidate) => { const raw = prices[candidate.endpointId]; return raw !== "" && !(Number.isSafeInteger(Number(raw)) && Number(raw) >= 1); });
  const dirty = defaultId !== currentDefault || changedPrices.length > 0;

  const nameOf = (id: string) => data.endpoints.find((item) => item.id === id)?.name ?? id;
  const save = async () => {
    const lines = [
      ...(defaultId !== currentDefault ? [`默认模型改为「${nameOf(defaultId)}」`] : []),
      ...changedPrices.map((candidate) => `「${nameOf(candidate.endpointId)}」的每秒价从 ${initialPrices[candidate.endpointId] || "未定价"} 改为 ${prices[candidate.endpointId] || "未定价"}`),
    ];
    const ok = await confirm("保存视频生成的改动？", <div><p>保存后立刻对新的生成生效：</p><ChangeList lines={lines} />{changedPrices.length > 0 && row && <><p className="mt-3">按秒价是共用的，同时影响：</p><AffectedList keys={row.affectedFeatures} names={names} /></>}</div>, "确认保存");
    if (!ok) return;
    setSaving(true); setError("");
    try {
      if (defaultId !== currentDefault) {
        // 旧分组里其他模型留着：没有单独开放范围的老模型还靠它显示。
        const keep = (data.videoGroup?.endpointIds ?? []).filter((id) => data.endpoints.some((item) => item.id === id && item.enabled));
        const endpointIds = [...new Set([...candidates.map((candidate) => candidate.endpointId), ...keep])];
        await ModelConfigApi.command("studioVideoGroupSave", { value: { defaultEndpointId: defaultId, endpointIds } });
      }
      for (const candidate of changedPrices) {
        const raw = prices[candidate.endpointId];
        await ModelConfigApi.command("functionCandidatePriceSave", { appCode: "studio", feature: "video", endpointId: candidate.endpointId, creditCostOverride: raw === "" ? null : Number(raw), acknowledgedAffectedFeatures: row?.affectedFeatures ?? [] });
      }
      await reload();
    } catch (e) { setError(errorText(e)); await reload(); } finally { setSaving(false); }
  };

  const specModes = (item: AiModelEndpoint | undefined) => (item && !item.videoRequestSpec ? "内置规格" : "");

  return (
    <Card className="gap-0 p-0">
      {dialog}
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold text-slate-900">视频生成</h2>
        <p className="text-xs text-slate-500">要加模型，在<Link href="/models?tab=access" className="mx-1 text-[#4f6692] underline-offset-2 hover:underline">模型接入</Link>里把它开放给 IP Studio。</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b text-left text-xs text-slate-500"><th className="px-4 py-2 font-medium">模型</th><th className="px-3 py-2 font-medium">默认</th><th className="px-4 py-2 font-medium">积分 / 秒</th></tr></thead>
          <tbody>
            {candidates.map((candidate) => {
              const item = data.endpoints.find((endpoint) => endpoint.id === candidate.endpointId);
              return (
                <tr key={candidate.endpointId} className="border-b last:border-b-0">
                  <td className="max-w-80 px-4 py-2.5">
                    <p className="truncate font-medium text-slate-900">{item?.name ?? candidate.endpointName ?? candidate.endpointId}</p>
                    <p className="truncate font-mono text-xs text-slate-500">{item?.model}{specModes(item) && <span className="ml-2 font-sans text-slate-400">{specModes(item)}</span>}</p>
                    {candidate.available === false && <p className="text-xs text-rose-600">缺规格或价格，用户现在选不到</p>}
                  </td>
                  <td className="px-3 py-2.5"><input type="radio" name="default-video" aria-label={`把 ${item?.name ?? candidate.endpointId} 设为默认`} checked={defaultId === candidate.endpointId} onChange={() => setDefaultId(candidate.endpointId)} /></td>
                  <td className="px-4 py-2.5"><Input aria-label={`${item?.name ?? candidate.endpointId} 的每秒积分`} inputMode="numeric" className="h-8 w-24" placeholder="未单独定价" value={prices[candidate.endpointId] ?? ""} onChange={(event) => setPrices((current) => ({ ...current, [candidate.endpointId]: event.target.value }))} /></td>
                </tr>
              );
            })}
            {!candidates.length && <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">还没有开放给 IP Studio 的视频模型</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t px-4 py-3">
        {invalid && <span className="text-xs text-rose-600">每秒积分要填不小于 1 的整数，或留空</span>}
        <Button disabled={!dirty || invalid || saving || !defaultId} onClick={() => void save()}>{saving && <Loader2 className="size-4 animate-spin" />}保存</Button>
      </div>
      {error && <div className="border-t px-4 py-3"><Notice tone="error">{error}</Notice></div>}
    </Card>
  );
}

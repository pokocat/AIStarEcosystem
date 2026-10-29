"use client";

// Studio 场景模板 —— AI 图片、AI 视频两页左侧的场景（docs/studio-scene-creation.md §9）。
// 对应 server 后台场景接口（/api/admin/studio/scenes）。整份目录一次保存，带上读到的版本号；别人先存过就拒绝，不覆盖。
// 改完对新打开的页面生效；已经提交的生成不受影响。下架的场景用户端看不到，旧草稿照常打开。

import * as React from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirm, useToast } from "@/components/feedback";
import { ApiError, StudioScenesApi } from "@/api";
import { cn } from "@/lib/utils";
import type { StudioImageScene, StudioSceneAdminView, StudioSceneCatalog, StudioSceneGroup, StudioSceneMedia, StudioVideoScene } from "@/types/studio-scenes";

type Kind = "image" | "video";
const IMAGE_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"];
const DURATION_CHOICES = [5, 10, 15, 20, 25, 30, 45, 60];
const SKILL_LABEL: Record<string, string> = { "video-generation": "编导写脚本后一次出片", "reference-video-recreation": "爆款复刻（先拉片，交给创作助手）" };
const errorText = (e: unknown) => e instanceof Error ? e.message : "操作没有成功，请重试";

/** 新场景的起点：照着现成场景的格式，空着的地方运营自己填。 */
function blankScene(kind: Kind, group: string, id: string): StudioImageScene | StudioVideoScene {
  return kind === "image"
    ? { id, group, title: "新场景", description: "一句话说清这个场景做什么", refs: [{ label: "参考图", required: true, hint: null }], prompt: "以图1为准，", hint: "可以补充想要的细节", ratio: "1:1", enabled: false }
    : { id, group, title: "新场景", description: "一句话说清这类视频", images: { label: "商品图", required: false, max: 4 }, video: null, character: false, voice: false,
      placeholder: "说说想拍什么", textRequired: false, durations: [15, 25, 30], duration: 25, ratio: "9:16", structure: "开头……中间……结尾……", ideas: [], skill: "video-generation", enabled: false };
}

export default function StudioScenesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [view, setView] = React.useState<StudioSceneAdminView | null>(null);
  const [catalog, setCatalog] = React.useState<StudioSceneCatalog | null>(null);
  const [kind, setKind] = React.useState<Kind>("video");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [stale, setStale] = React.useState(false);
  // 地址会过期、保存时服务端也不收：新传的文件只在页面上用它预览。
  const [previews, setPreviews] = React.useState<Record<string, StudioSceneMedia>>({});

  const load = React.useCallback(async () => {
    try {
      const next = await StudioScenesApi.getStudioScenes();
      setView(next); setCatalog(next.catalog); setError(""); setStale(false);
      setActiveId(prev => [...next.catalog.image, ...next.catalog.video].some(s => s.id === prev) ? prev : next.catalog.video[0]?.id ?? null);
    } catch (e) { toast.danger({ title: "场景目录没有加载出来", description: errorText(e) }); }
  }, [toast]);
  React.useEffect(() => { void load(); }, [load]);

  const dirty = !!view && !!catalog && JSON.stringify(view.catalog) !== JSON.stringify(catalog);
  const scenes = catalog ? (kind === "image" ? catalog.image : catalog.video) : [];
  const groups = catalog ? (kind === "image" ? catalog.imageGroups : catalog.videoGroups) : [];
  const active = scenes.find(s => s.id === activeId) ?? null;
  // 存过的场景编号不让改：用户的草稿按它记场景。
  const savedIds = React.useMemo(() => new Set(view ? [...view.catalog.image, ...view.catalog.video].map(s => s.id) : []), [view]);

  const setScenes = (fn: (list: (StudioImageScene | StudioVideoScene)[]) => (StudioImageScene | StudioVideoScene)[]) =>
    setCatalog(c => c && (kind === "image" ? { ...c, image: fn(c.image) as StudioImageScene[] } : { ...c, video: fn(c.video) as StudioVideoScene[] }));
  const patch = (changes: Partial<StudioImageScene> | Partial<StudioVideoScene>) =>
    setScenes(list => list.map(s => s.id === activeId ? { ...s, ...changes } as StudioImageScene | StudioVideoScene : s));
  const setGroups = (next: StudioSceneGroup[]) => setCatalog(c => c && (kind === "image" ? { ...c, imageGroups: next } : { ...c, videoGroups: next }));

  const move = (id: string, by: -1 | 1) => setScenes(list => {
    const i = list.findIndex(s => s.id === id), j = i + by;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const add = () => {
    if (!catalog || !groups[0]) return;
    const all = new Set([...catalog.image, ...catalog.video].map(s => s.id));
    let n = 1; while (all.has(`${kind}-new-${n}`)) n++;
    const scene = blankScene(kind, groups[0].id, `${kind}-new-${n}`);
    setScenes(list => [...list, scene]); setActiveId(scene.id);
  };
  const remove = async () => {
    if (!active) return;
    const r = await confirm({ title: `删除「${active.title}」？`, description: "保存后这个场景从页面上消失。用户已经建的草稿还在，只是不再出现在这个场景下。只想暂时不给用户看，可以改成下架。", confirmLabel: "删除", tone: "danger" });
    if (!r.ok) return;
    setScenes(list => list.filter(s => s.id !== active.id)); setActiveId(scenes.find(s => s.id !== active.id)?.id ?? null);
  };

  const save = async () => {
    if (!view || !catalog || saving) return;
    setSaving(true); setError(""); setStale(false);
    try {
      const next = await StudioScenesApi.saveStudioScenes(catalog, view.version);
      setView(next); setCatalog(next.catalog); setPreviews({});
      toast.success({ title: "已保存", description: "新打开的 AI 图片、AI 视频页会用这份场景" });
    } catch (e) {
      if (e instanceof ApiError && e.code === "STUDIO_SCENE_CATALOG_STALE") setStale(true);
      setError(errorText(e));
    } finally { setSaving(false); }
  };
  const reset = async () => {
    if (!view) return;
    const r = await confirm({ title: "恢复内置的场景？", description: "运营改过的场景、封面和示例都会回到随版本发布的那一份。已经上传的文件不会删。", confirmLabel: "恢复默认", tone: "warning" });
    if (!r.ok) return;
    try { const next = await StudioScenesApi.resetStudioScenes(view.version); setView(next); setCatalog(next.catalog); setError(""); toast.success({ title: "已恢复内置场景" }); }
    catch (e) { if (e instanceof ApiError && e.code === "STUDIO_SCENE_CATALOG_STALE") setStale(true); setError(errorText(e)); }
  };

  const upload = async (file: File, target: "cover" | "example") => {
    if (!active) return;
    try {
      const uploaded = await StudioScenesApi.uploadStudioSceneMedia(file);
      setPreviews(p => ({ ...p, [uploaded.key]: { url: uploaded.url, mediaType: uploaded.mediaType } }));
      if (target === "cover") patch({ coverKey: uploaded.key });
      else patch({ exampleKeys: [...(active.exampleKeys ?? []), uploaded.key].slice(0, 6) });
    } catch (e) { toast.danger({ title: "文件没传上去", description: errorText(e) }); }
  };
  /** 看得到的地址：刚传的用本地预览，存过的用服务端签出来的。 */
  const mediaOf = (key: string | null | undefined, scene: StudioImageScene | StudioVideoScene): StudioSceneMedia | undefined => {
    if (!key) return undefined;
    if (previews[key]) return previews[key];
    if (key === scene.coverKey && scene.coverUrl) return { url: scene.coverUrl, mediaType: "image" };
    const i = scene.exampleKeys?.indexOf(key) ?? -1;
    return i >= 0 ? scene.examples?.[i] ?? undefined : undefined;
  };

  return <div>
    <PageHeader title="Studio 场景模板" description="AI 图片、AI 视频两页左侧的场景：名称、要用户放什么素材、写好的描述和拍法、封面和参考示例。保存后新打开的页面生效，已经提交的生成不受影响。"
      meta={view ? <Badge tone={view.source === "default" ? "neutral" : "info"}>{view.source === "default" ? "正在用内置场景" : `运营改过 · 第 ${view.version} 版`}</Badge> : null}
      actions={<>
        <Button variant="outline" onClick={() => void reset()} disabled={!view || view.source === "default"}><RotateCcw className="mr-1.5 h-4 w-4"/>恢复内置</Button>
        <Button onClick={() => void save()} disabled={!dirty || saving}><Save className="mr-1.5 h-4 w-4"/>{saving ? "正在保存" : dirty ? "保存" : "没有改动"}</Button>
      </>}/>

    {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <span className="min-w-0 flex-1 break-words">{error}</span>
      {stale && <Button size="sm" variant="outline" onClick={() => void load()}>刷新（丢掉这次的修改）</Button>}
    </div>}

    {!catalog ? <p className="text-sm text-muted-foreground">正在加载</p> : <>
      <Tabs value={kind} onValueChange={v => { setKind(v as Kind); setActiveId((v === "image" ? catalog.image : catalog.video)[0]?.id ?? null); }}>
        <TabsList><TabsTrigger value="video">AI 视频（{catalog.video.length}）</TabsTrigger><TabsTrigger value="image">AI 图片（{catalog.image.length}）</TabsTrigger></TabsList>
      </Tabs>

      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">场景</CardTitle>
            <Button size="sm" variant="outline" onClick={add} disabled={!groups.length}><Plus className="mr-1 h-4 w-4"/>新增</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {groups.map(g => <section key={g.id}>
              <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">{g.title}</h3>
              <ul className="space-y-1" aria-label={g.title}>
                {scenes.filter(s => s.group === g.id).map(s => <li key={s.id} className="flex items-center gap-1">
                  <button type="button" onClick={() => setActiveId(s.id)} aria-current={s.id === activeId ? "true" : undefined}
                    className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", s.id === activeId && "bg-muted font-medium")}>
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    {s.enabled === false && <Badge tone="warning" className="shrink-0">下架</Badge>}
                  </button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`上移「${s.title}」`} onClick={() => move(s.id, -1)}><ArrowUp className="h-3.5 w-3.5"/></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`下移「${s.title}」`} onClick={() => move(s.id, 1)}><ArrowDown className="h-3.5 w-3.5"/></Button>
                </li>)}
              </ul>
            </section>)}
            <GroupsEditor groups={groups} used={new Set(scenes.map(s => s.group))} onChange={setGroups}/>
          </CardContent>
        </Card>

        {active ? <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="min-w-0 truncate text-base">{active.title}</CardTitle>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">上架<Switch checked={active.enabled !== false} onCheckedChange={v => patch({ enabled: v })} aria-label="上架"/></label>
              <Button size="sm" variant="outline" onClick={() => void remove()}><Trash2 className="mr-1 h-4 w-4"/>删除</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="名称"><Input aria-label="名称" value={active.title} maxLength={20} onChange={e => patch({ title: e.target.value })}/></Field>
              <Field label="编号" hint="小写字母、数字和横线；用户的草稿按它记场景，保存后不能再改。">
                <Input aria-label="编号" value={active.id} maxLength={48} disabled={savedIds.has(active.id)} onChange={e => { const id = e.target.value; patch({ id }); setActiveId(id); }}/></Field>
              <Field label="分组"><NativeSelect label="分组" value={active.group} options={groups.map(g => [g.id, g.title])} onChange={v => patch({ group: v })}/></Field>
              <Field label="一句说明"><Input aria-label="一句说明" value={active.description} maxLength={40} onChange={e => patch({ description: e.target.value })}/></Field>
            </div>

            <MediaEditor scene={active} mediaOf={mediaOf} onUpload={(f, t) => void upload(f, t)}
              onClearCover={() => patch({ coverKey: null, coverUrl: null })} onRemoveExample={key => patch({ exampleKeys: (active.exampleKeys ?? []).filter(k => k !== key) })}/>

            {kind === "image" ? <ImageFields scene={active as StudioImageScene} patch={patch}/>
              : <VideoFields scene={active as StudioVideoScene} patch={patch} skills={view?.skills ?? []}/>}
          </CardContent>
        </Card> : <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">左边选一个场景，或者新增一个。</CardContent></Card>}
      </div>
    </>}
  </div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><div className="text-sm font-medium">{label}</div>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}

function NativeSelect({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (v: string) => void }) {
  return <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}
    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">{options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select>;
}

function MediaEditor({ scene, mediaOf, onUpload, onClearCover, onRemoveExample }: {
  scene: StudioImageScene | StudioVideoScene; mediaOf: (key: string | null | undefined, s: StudioImageScene | StudioVideoScene) => StudioSceneMedia | undefined;
  onUpload: (file: File, target: "cover" | "example") => void; onClearCover: () => void; onRemoveExample: (key: string) => void;
}) {
  const cover = React.useRef<HTMLInputElement>(null), example = React.useRef<HTMLInputElement>(null);
  const shownCover = mediaOf(scene.coverKey, scene);
  const pick = (input: HTMLInputElement | null) => input?.click();
  return <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
    <Field label="封面" hint="方图效果最好。不传就用内置封面（按编号），再没有就显示名称的第一个字。">
      <div className="relative h-36 w-36 overflow-hidden rounded-lg border bg-muted">
        {shownCover ? <img src={shownCover.url} alt="封面" className="h-full w-full object-cover"/> : <span className="grid h-full place-items-center text-xs text-muted-foreground">用内置封面</span>}
        {scene.coverKey && <button type="button" aria-label="移除封面" onClick={onClearCover} className="absolute right-1 top-1 rounded-full bg-background/90 p-1"><X className="h-3.5 w-3.5"/></button>}
      </div>
      <Button size="sm" variant="outline" onClick={() => pick(cover.current)}><ImagePlus className="mr-1 h-4 w-4"/>上传封面</Button>
      <input ref={cover} type="file" accept=".jpg,.jpeg,.png,.webp" hidden aria-label="封面文件" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f, "cover"); }}/>
    </Field>
    <Field label="参考示例" hint="用户在结果区「参考示例」里看到的样子：图片或 MP4，最多 6 个。不传就放封面。">
      <div className="flex flex-wrap gap-2">
        {(scene.exampleKeys ?? []).map(key => { const m = mediaOf(key, scene); return <div key={key} className="relative h-28 w-24 overflow-hidden rounded-md border bg-muted">
          {m?.mediaType === "video" ? <video src={m.url} muted className="h-full w-full object-cover"/> : m ? <img src={m.url} alt="示例" className="h-full w-full object-cover"/> : null}
          <button type="button" aria-label="移除这个示例" onClick={() => onRemoveExample(key)} className="absolute right-1 top-1 rounded-full bg-background/90 p-1"><X className="h-3.5 w-3.5"/></button>
        </div>; })}
        {(scene.exampleKeys?.length ?? 0) < 6 && <button type="button" onClick={() => pick(example.current)} className="grid h-28 w-24 place-items-center rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted">
          <span className="flex flex-col items-center gap-1"><Plus className="h-4 w-4"/>添加示例</span></button>}
      </div>
      <input ref={example} type="file" accept=".jpg,.jpeg,.png,.webp,.mp4" hidden aria-label="示例文件" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f, "example"); }}/>
    </Field>
  </div>;
}

function ImageFields({ scene, patch }: { scene: StudioImageScene; patch: (p: Partial<StudioImageScene>) => void }) {
  const setRef = (i: number, changes: Partial<StudioImageScene["refs"][number]>) => patch({ refs: scene.refs.map((r, j) => j === i ? { ...r, ...changes } : r) });
  return <>
    <Field label="参考图位" hint="按顺序是图1、图2……出图描述里写「图1」就指第一个位。第一个位必须是必填。">
      <div className="space-y-2">
        {scene.refs.map((r, i) => <div key={i} className="flex flex-wrap items-center gap-2">
          <span className="w-8 text-sm text-muted-foreground">图{i + 1}</span>
          <Input aria-label={`图${i + 1}名称`} className="w-40" value={r.label} maxLength={12} onChange={e => setRef(i, { label: e.target.value })}/>
          <Input aria-label={`图${i + 1}提示`} className="min-w-[160px] flex-1" placeholder="给用户的提示（可选）" value={r.hint ?? ""} onChange={e => setRef(i, { hint: e.target.value || null })}/>
          <label className="flex items-center gap-1.5 text-sm"><Switch checked={r.required} onCheckedChange={v => setRef(i, { required: v })} aria-label={`图${i + 1}必填`}/>必填</label>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`删除图${i + 1}`} onClick={() => patch({ refs: scene.refs.filter((_, j) => j !== i) })}><X className="h-4 w-4"/></Button>
        </div>)}
        {scene.refs.length < 6 && <Button size="sm" variant="outline" onClick={() => patch({ refs: [...scene.refs, { label: "参考图", required: false, hint: null }] })}><Plus className="mr-1 h-4 w-4"/>加一个参考图位</Button>}
      </div>
    </Field>
    <Field label="出图描述" hint="用户看不到这段，只看到场景名和「补充要求」输入框。不要留【…】这种空位，用户要补的写「按补充要求……」。">
      <Textarea aria-label="出图描述" rows={6} value={scene.prompt} onChange={e => patch({ prompt: e.target.value })}/></Field>
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="补充要求输入框的提示"><Input aria-label="补充要求提示" value={scene.hint} onChange={e => patch({ hint: e.target.value })}/></Field>
      <Field label="默认比例"><NativeSelect label="默认比例" value={scene.ratio} options={IMAGE_RATIOS.map(r => [r, r])} onChange={v => patch({ ratio: v })}/></Field>
    </div>
  </>;
}

function VideoFields({ scene, patch, skills }: { scene: StudioVideoScene; patch: (p: Partial<StudioVideoScene>) => void; skills: string[] }) {
  const toggleDuration = (d: number) => {
    const next = scene.durations.includes(d) ? scene.durations.filter(x => x !== d) : [...scene.durations, d].sort((a, b) => a - b);
    patch({ durations: next, ...(next.includes(scene.duration) ? {} : { duration: next[0] ?? scene.duration }) });
  };
  return <>
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="图片素材叫什么"><Input aria-label="图片素材名称" value={scene.images.label} maxLength={10} onChange={e => patch({ images: { ...scene.images, label: e.target.value } })}/></Field>
      <Field label="最多几张"><Input aria-label="最多几张" type="number" min={1} max={9} value={scene.images.max ?? 4} onChange={e => patch({ images: { ...scene.images, max: Number(e.target.value) || 1 } })}/></Field>
      <Field label="图片必须放"><Switch checked={scene.images.required} onCheckedChange={v => patch({ images: { ...scene.images, required: v } })} aria-label="图片必须放"/></Field>
    </div>
    <div className="flex flex-wrap gap-6 text-sm">
      <label className="flex items-center gap-2"><Switch checked={scene.character} onCheckedChange={v => patch({ character: v })} aria-label="可以放出镜人物"/>可以放出镜人物</label>
      <label className="flex items-center gap-2"><Switch checked={scene.voice} onCheckedChange={v => patch({ voice: v })} aria-label="可以放声音"/>可以放声音</label>
      <label className="flex items-center gap-2"><Switch checked={!!scene.video} onCheckedChange={v => patch({ video: v ? { label: "参考视频", required: true } : null })} aria-label="要参考视频"/>要参考视频（复刻类）</label>
      <label className="flex items-center gap-2"><Switch checked={scene.textRequired} onCheckedChange={v => patch({ textRequired: v })} aria-label="必须写一句"/>必须写一句要求</label>
    </div>
    <Field label="输入框里的示例"><Input aria-label="输入框示例" value={scene.placeholder} onChange={e => patch({ placeholder: e.target.value })}/></Field>
    <Field label="拍法" hint="这类视频通常怎么拍。编导写脚本、助手出方案都按它来；用户看不到原文。">
      <Textarea aria-label="拍法" rows={4} value={scene.structure} onChange={e => patch({ structure: e.target.value })}/></Field>
    <Field label="常用开头" hint="一行一个，最多 8 个；用户点一下就填进输入框。">
      <Textarea aria-label="常用开头" rows={4} value={scene.ideas.join("\n")} onChange={e => patch({ ideas: e.target.value.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 8) })}/></Field>
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="默认画面"><NativeSelect label="默认画面" value={scene.ratio} options={[["9:16", "竖屏 9:16"], ["16:9", "横屏 16:9"]]} onChange={v => patch({ ratio: v as StudioVideoScene["ratio"] })}/></Field>
      <Field label="默认时长" hint="超过所选视频模型上限时，按模型最长时长出。">
        <NativeSelect label="默认时长" value={String(scene.duration)} options={scene.durations.map(d => [String(d), `${d} 秒`])} onChange={v => patch({ duration: Number(v) })}/></Field>
      <Field label="做法"><NativeSelect label="做法" value={scene.skill} options={skills.map(k => [k, SKILL_LABEL[k] ?? k])} onChange={v => patch({ skill: v })}/></Field>
    </div>
    <Field label="交给创作助手时可选的时长" hint="长片和复刻交给画布里的创作助手分段做时，给用户选的时长。">
      <div className="flex flex-wrap gap-2" role="group" aria-label="可选时长">{DURATION_CHOICES.map(d => <Button key={d} size="sm" variant={scene.durations.includes(d) ? "default" : "outline"}
        aria-pressed={scene.durations.includes(d)} onClick={() => toggleDuration(d)}>{d} 秒</Button>)}</div></Field>
  </>;
}

/** 分组：改名、新增；还有场景在用的分组不能删。 */
function GroupsEditor({ groups, used, onChange }: { groups: StudioSceneGroup[]; used: Set<string>; onChange: (g: StudioSceneGroup[]) => void }) {
  const [open, setOpen] = React.useState(false);
  if (!open) return <Button size="sm" variant="ghost" className="px-0 text-muted-foreground" onClick={() => setOpen(true)}>管理分组</Button>;
  return <div className="space-y-2 rounded-md border p-2">
    {groups.map((g, i) => <div key={i} className="flex items-center gap-1.5">
      <Input aria-label={`分组名称 ${i + 1}`} className="h-8" value={g.title} onChange={e => onChange(groups.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}/>
      <Input aria-label={`分组编号 ${i + 1}`} className="h-8 w-24" value={g.id} disabled={used.has(g.id)} onChange={e => onChange(groups.map((x, j) => j === i ? { ...x, id: e.target.value } : x))}/>
      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={used.has(g.id)} aria-label={`删除分组 ${g.title}`} title={used.has(g.id) ? "还有场景在用这个分组" : undefined}
        onClick={() => onChange(groups.filter((_, j) => j !== i))}><X className="h-4 w-4"/></Button>
    </div>)}
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => { let n = 1; while (groups.some(g => g.id === `group-${n}`)) n++; onChange([...groups, { id: `group-${n}`, title: "新分组" }]); }}><Plus className="mr-1 h-4 w-4"/>新增分组</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>收起</Button>
    </div>
  </div>;
}

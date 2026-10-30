"use client";

// 场景模板 —— AI 图片、AI 视频两页左侧的场景（docs/studio-scene-creation.md §9）。
// 对应 server 后台场景接口（/api/admin/studio/scenes，超管和平台运营）。整份目录一次保存，带上读到的版本号；
// 别人先存过就拒绝，不覆盖。改完对新打开的页面生效；已经提交的生成不受影响。下架的场景用户端看不到，旧草稿照常打开。

import * as React from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ai-star-eco/ui/ui/card";
import { Input } from "@ai-star-eco/ui/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ai-star-eco/ui/ui/select";
import { Switch } from "@ai-star-eco/ui/ui/switch";
import { Textarea } from "@ai-star-eco/ui/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@ai-star-eco/ui/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@ai-star-eco/ui/ui/alert-dialog";
import { cn } from "@ai-star-eco/ui/ui/utils";
import type {
  StudioSceneBrief,
  StudioImageScene, StudioSceneAdminView, StudioSceneCatalog, StudioSceneGroup, StudioSceneHomeGoal, StudioSceneMedia, StudioSceneOptionGroup, StudioVideoScene,
} from "@ai-star-eco/types/ip-studio-scenes";
import { ApiError, StudioScenesApi } from "@/lib/api";

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

/** 不用浏览器原生 confirm：一个 AlertDialog，返回用户点没点确定。 */
type ConfirmRequest = { title: string; description: string; confirmLabel: string; resolve: (ok: boolean) => void };
function useConfirmDialog() {
  const [request, setRequest] = React.useState<ConfirmRequest | null>(null);
  const confirm = (title: string, description: string, confirmLabel: string) => new Promise<boolean>(resolve => setRequest({ title, description, confirmLabel, resolve }));
  const close = (ok: boolean) => { request?.resolve(ok); setRequest(null); };
  const dialog = <AlertDialog open={!!request} onOpenChange={open => { if (!open) close(false); }}>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{request?.title}</AlertDialogTitle><AlertDialogDescription>{request?.description}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel onClick={() => close(false)}>取消</AlertDialogCancel><AlertDialogAction onClick={() => close(true)}>{request?.confirmLabel}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
  return { confirm, dialog };
}

export function StudioScenes() {
  const { confirm, dialog } = useConfirmDialog();
  const [notice, setNotice] = React.useState("");
  const [view, setView] = React.useState<StudioSceneAdminView | null>(null);
  const [catalog, setCatalog] = React.useState<StudioSceneCatalog | null>(null);
  const [kind, setKind] = React.useState<Kind>("video");
  // 第三个标签「首页卡片」：编辑首页「你想做什么？」那一排，不是某一个场景。
  const [homeTab, setHomeTab] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [stale, setStale] = React.useState(false);
  // 地址会过期、保存时服务端也不收：新传的文件只在页面上用它预览。
  const [previews, setPreviews] = React.useState<Record<string, StudioSceneMedia>>({});

  const load = React.useCallback(async () => {
    try {
      const next = await StudioScenesApi.get();
      setView(next); setCatalog(next.catalog); setError(""); setStale(false);
      setActiveId(prev => [...next.catalog.image, ...next.catalog.video].some(s => s.id === prev) ? prev : next.catalog.video[0]?.id ?? null);
    } catch (e) { setError(`场景目录没有加载出来：${errorText(e)}`); }
  }, []);
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
    if (!await confirm(`删除「${active.title}」？`, "保存后这个场景从页面上消失。用户已经建的草稿还在，只是不再出现在这个场景下。只想暂时不给用户看，可以改成下架。", "删除")) return;
    setScenes(list => list.filter(s => s.id !== active.id)); setActiveId(scenes.find(s => s.id !== active.id)?.id ?? null);
  };

  const save = async () => {
    if (!view || !catalog || saving) return;
    setSaving(true); setError(""); setStale(false); setNotice("");
    try {
      const next = await StudioScenesApi.save(catalog, view.version);
      setView(next); setCatalog(next.catalog); setPreviews({});
      setNotice("已保存。新打开的 AI 图片、AI 视频页会用这份场景。");
    } catch (e) {
      if (e instanceof ApiError && e.code === "STUDIO_SCENE_CATALOG_STALE") setStale(true);
      setError(errorText(e));
    } finally { setSaving(false); }
  };
  const reset = async () => {
    if (!view) return;
    if (!await confirm("恢复内置的场景？", "运营改过的场景、封面和示例都会回到随版本发布的那一份。已经上传的文件不会删。", "恢复内置")) return;
    try { const next = await StudioScenesApi.reset(view.version); setView(next); setCatalog(next.catalog); setError(""); setNotice("已恢复内置场景。"); }
    catch (e) { if (e instanceof ApiError && e.code === "STUDIO_SCENE_CATALOG_STALE") setStale(true); setError(errorText(e)); }
  };

  const upload = async (file: File, target: "cover" | "example") => {
    if (!active) return;
    try {
      const uploaded = await StudioScenesApi.upload(file);
      setPreviews(p => ({ ...p, [uploaded.key]: { url: uploaded.url, mediaType: uploaded.mediaType } }));
      if (target === "cover") patch({ coverKey: uploaded.key });
      else patch({ exampleKeys: [...(active.exampleKeys ?? []), uploaded.key].slice(0, 6) });
    } catch (e) { setError(`文件没传上去：${errorText(e)}`); }
  };
  /** 看得到的地址：刚传的用本地预览，存过的用服务端签出来的。 */
  const mediaOf = (key: string | null | undefined, scene: StudioImageScene | StudioVideoScene): StudioSceneMedia | undefined => {
    if (!key) return undefined;
    if (previews[key]) return previews[key];
    if (key === scene.coverKey && scene.coverUrl) return { url: scene.coverUrl, mediaType: "image" };
    const i = scene.exampleKeys?.indexOf(key) ?? -1;
    return i >= 0 ? scene.examples?.[i] ?? undefined : undefined;
  };

  return <div className="mx-auto max-w-[1440px] space-y-4 p-4 md:p-6">
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-950">场景模板</h2>
          {view && <Badge variant="outline">{view.source === "default" ? "正在用内置场景" : `运营改过 · 第 ${view.version} 版`}</Badge>}
        </div>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">AI 图片、AI 视频两页左侧的场景：名称、要用户放什么素材、写好的描述和拍法、封面和参考示例。保存后新打开的页面生效，已经提交的生成不受影响。</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => void reset()} disabled={!view || view.source === "default"}><RotateCcw className="mr-1.5 h-4 w-4"/>恢复内置</Button>
        <Button onClick={() => void save()} disabled={!dirty || saving}><Save className="mr-1.5 h-4 w-4"/>{saving ? "正在保存" : dirty ? "保存" : "没有改动"}</Button>
      </div>
    </div>

    {notice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
    {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <span className="min-w-0 flex-1 break-words">{error}</span>
      {stale && <Button size="sm" variant="outline" onClick={() => void load()}>刷新（丢掉这次的修改）</Button>}
    </div>}

    {!catalog ? (!error && <p className="text-sm text-muted-foreground">正在加载</p>) : <>
      <Tabs value={homeTab ? "home" : kind} onValueChange={v => {
        if (v === "home") { setHomeTab(true); return; }
        setHomeTab(false); setKind(v as Kind); setActiveId((v === "image" ? catalog.image : catalog.video)[0]?.id ?? null);
      }}>
        <TabsList><TabsTrigger value="video">AI 视频（{catalog.video.length}）</TabsTrigger><TabsTrigger value="image">AI 图片（{catalog.image.length}）</TabsTrigger>
          <TabsTrigger value="home">首页卡片（{catalog.homeGoals?.length ?? 0}）</TabsTrigger></TabsList>
      </Tabs>

      {homeTab ? <HomeGoalsEditor catalog={catalog} onChange={homeGoals => setCatalog(c => c && { ...c, homeGoals })}/> :
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
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
                    {s.enabled === false && <Badge variant="secondary" className="shrink-0">下架</Badge>}
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
              <Field label="分组"><ChoiceSelect label="分组" value={active.group} options={groups.map(g => [g.id, g.title])} onChange={v => patch({ group: v })}/></Field>
              <Field label="一句说明"><Input aria-label="一句说明" value={active.description} maxLength={40} onChange={e => patch({ description: e.target.value })}/></Field>
            </div>

            <MediaEditor scene={active} mediaOf={mediaOf} onUpload={(f, t) => void upload(f, t)}
              onClearCover={() => patch({ coverKey: null, coverUrl: null })} onRemoveExample={key => patch({ exampleKeys: (active.exampleKeys ?? []).filter(k => k !== key) })}/>

            <OptionsEditor groups={active.options ?? []} onChange={options => patch({ options })}/>

            {kind === "image" ? <ImageFields scene={active as StudioImageScene} patch={patch}/>
              : <VideoFields scene={active as StudioVideoScene} patch={patch} skills={view?.skills ?? []}/>}
          </CardContent>
        </Card> : <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">左边选一个场景，或者新增一个。</CardContent></Card>}
      </div>}
    </>}
    {dialog}
  </div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><div className="text-sm font-medium">{label}</div>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}

/** 共用的下拉（不用浏览器原生 select，select-field-wiring 测试守着）。 */
function ChoiceSelect({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (v: string) => void }) {
  return <Select value={value} onValueChange={onChange}>
    <SelectTrigger aria-label={label}><SelectValue/></SelectTrigger>
    <SelectContent>{options.map(([v, text]) => <SelectItem key={v} value={v}>{text}</SelectItem>)}</SelectContent>
  </Select>;
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
      <Field label="默认比例"><ChoiceSelect label="默认比例" value={scene.ratio} options={IMAGE_RATIOS.map(r => [r, r])} onChange={v => patch({ ratio: v })}/></Field>
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
    <BriefEditor brief={scene.brief ?? null} onChange={brief => patch({ brief })}/>
    <Field label="拍法" hint="这类视频通常怎么拍。编导写脚本、助手出方案都按它来；用户看不到原文。">
      <Textarea aria-label="拍法" rows={4} value={scene.structure} onChange={e => patch({ structure: e.target.value })}/></Field>
    <Field label="常用开头" hint="一行一个，最多 8 个；用户点一下就填进输入框。">
      <Textarea aria-label="常用开头" rows={4} value={scene.ideas.join("\n")} onChange={e => patch({ ideas: e.target.value.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 8) })}/></Field>
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="默认画面"><ChoiceSelect label="默认画面" value={scene.ratio} options={[["9:16", "竖屏 9:16"], ["16:9", "横屏 16:9"]]} onChange={v => patch({ ratio: v as StudioVideoScene["ratio"] })}/></Field>
      <Field label="默认时长" hint="超过所选视频模型上限时，按模型最长时长出。">
        <ChoiceSelect label="默认时长" value={String(scene.duration)} options={scene.durations.map(d => [String(d), `${d} 秒`])} onChange={v => patch({ duration: Number(v) })}/></Field>
      <Field label="做法"><ChoiceSelect label="做法" value={scene.skill} options={skills.map(k => [k, SKILL_LABEL[k] ?? k])} onChange={v => patch({ skill: v })}/></Field>
    </div>
    <Field label="交给创作助手时可选的时长" hint="长片和复刻交给画布里的创作助手分段做时，给用户选的时长。">
      <div className="flex flex-wrap gap-2" role="group" aria-label="可选时长">{DURATION_CHOICES.map(d => <Button key={d} size="sm" variant={scene.durations.includes(d) ? "default" : "outline"}
        aria-pressed={scene.durations.includes(d)} onClick={() => toggleDuration(d)}>{d} 秒</Button>)}</div></Field>
  </>;
}

/**
 * 这类视频要做到什么、要用户给哪些信息。编导和助手都按它写；信息在场景页上是一排小标签，点一下往输入框里起一行。
 * 必须给的没给：编导先写「还缺：……」并用【待补】占位（页面上不让出片），助手先问。不填这一块就照原来「只引导关注或下单」。
 */
function BriefEditor({ brief, onChange }: { brief: StudioSceneBrief | null; onChange: (b: StudioSceneBrief | null) => void }) {
  const b: StudioSceneBrief = brief ?? { goal: "", facts: [], ending: "", fiction: "story" };
  const set = (p: Partial<StudioSceneBrief>) => onChange({ ...b, ...p });
  const setFact = (i: number, p: Partial<StudioSceneBrief["facts"][number]>) => set({ facts: b.facts.map((f, j) => j === i ? { ...f, ...p } : f) });
  const required = b.facts.filter(f => f.required).length;
  return <div className="space-y-3 rounded-md border p-3" role="group" aria-label="这条要做到什么">
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="这一条要做到" hint="一句话，看的人看完要做什么。例如：让附近的人买下套餐，到店来用。">
        <Input aria-label="这一条要做到" value={b.goal} maxLength={60} onChange={e => set({ goal: e.target.value })}/></Field>
      <Field label="结尾" hint="结尾要观众做什么，可以不填。">
        <Input aria-label="结尾" value={b.ending ?? ""} maxLength={40} onChange={e => set({ ending: e.target.value || null })}/></Field>
    </div>
    <Field label="能不能编" hint="「只用给的」适合到店实录这类：人物也不能写成真实顾客。">
      <ChoiceSelect label="能不能编" value={b.fiction ?? "story"} options={[["story", "可以编人物和情节，不编品牌事实"], ["none", "只用给的，不编故事"]]}
        onChange={v => set({ fiction: v as "none" | "story" })}/></Field>
    <Field label="要用户给的信息" hint="最多 6 条、必填最多 4 条。不要写数字或「真实评价」这类会引着模型编的词。">
      <div className="space-y-2">{b.facts.map((f, i) => <div key={i} className="flex flex-wrap items-center gap-2">
        <Input aria-label={`信息 ${i + 1} 名称`} className="w-44" placeholder="如：团购价" value={f.label} maxLength={16} onChange={e => setFact(i, { label: e.target.value })}/>
        <Input aria-label={`信息 ${i + 1} 怎么用`} className="min-w-[160px] flex-1" placeholder="怎么用（可选），如：有原价才做对比" value={f.use ?? ""} maxLength={24} onChange={e => setFact(i, { use: e.target.value || null })}/>
        <label className="flex items-center gap-1.5 text-sm"><Switch checked={f.required} disabled={!f.required && required >= 4} onCheckedChange={v => setFact(i, { required: v })} aria-label={`信息 ${i + 1} 必填`}/>必填</label>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`删除信息 ${i + 1}`} onClick={() => set({ facts: b.facts.filter((_, j) => j !== i) })}><X className="h-4 w-4"/></Button>
      </div>)}
        {b.facts.length < 6 && <Button size="sm" variant="outline" onClick={() => set({ facts: [...b.facts, { label: "", required: false }] })}><Plus className="mr-1 h-3.5 w-3.5"/>加一条</Button>}
      </div></Field>
    {brief && <Button size="sm" variant="ghost" onClick={() => onChange(null)}>不要这一块</Button>}
  </div>;
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

/**
 * 选项组（照参考站）：用户点选，不用写字。每组 2 到 8 个选项、一个默认；选中那项的「拼进去的话」由服务端加进描述或编导的要求。
 */
function OptionsEditor({ groups, onChange }: { groups: StudioSceneOptionGroup[]; onChange: (g: StudioSceneOptionGroup[]) => void }) {
  const setGroup = (i: number, next: StudioSceneOptionGroup) => onChange(groups.map((g, j) => j === i ? next : g));
  const freshKey = () => { let n = 1; while (groups.some(g => g.key === `opt-${n}`)) n++; return `opt-${n}`; };
  return <Field label="选项组" hint="照参考站：用户在场景页点一下就行，不用写字。选中那项「拼进去的话」会加进出图描述或编导的要求。最多 4 组，每组 2 到 8 个选项。">
    <div className="space-y-3">
      {groups.map((g, i) => {
        const setChoice = (k: number, changes: Partial<StudioSceneOptionGroup["choices"][number]>) => setGroup(i, { ...g, choices: g.choices.map((c, m) => m === k ? { ...c, ...changes } : c) });
        const freshValue = () => { let n = 1; while (g.choices.some(c => c.value === `c${n}`)) n++; return `c${n}`; };
        return <div key={i} className="space-y-2 rounded-md border p-3" role="group" aria-label={`选项组 ${i + 1}`}>
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label={`选项组 ${i + 1} 名称`} className="w-40" placeholder="如：拍法" value={g.label} maxLength={10} onChange={e => setGroup(i, { ...g, label: e.target.value })}/>
            <Input aria-label={`选项组 ${i + 1} 编号`} className="w-32" value={g.key} maxLength={32} onChange={e => setGroup(i, { ...g, key: e.target.value })}/>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onChange(groups.filter((_, j) => j !== i))}><X className="mr-1 h-4 w-4"/>删掉这组</Button>
          </div>
          {g.choices.map((c, k) => <div key={k} className="flex flex-wrap items-center gap-2">
            <Input aria-label={`${g.label || "选项组"} 选项 ${k + 1} 名称`} className="w-32" placeholder="给用户看的" value={c.label} maxLength={12} onChange={e => setChoice(k, { label: e.target.value })}/>
            <Input aria-label={`${g.label || "选项组"} 选项 ${k + 1} 拼进去的话`} className="min-w-[200px] flex-1" placeholder="选中后加进描述的话" value={c.prompt} onChange={e => setChoice(k, { prompt: e.target.value })}/>
            {g.defaultValue === c.value ? <Badge variant="secondary">默认</Badge>
              : <Button size="sm" variant="outline" onClick={() => setGroup(i, { ...g, defaultValue: c.value })}>设为默认</Button>}
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`删除${g.label || "选项组"}选项 ${k + 1}`} disabled={g.choices.length <= 2}
              onClick={() => { const choices = g.choices.filter((_, m) => m !== k); setGroup(i, { ...g, choices, defaultValue: choices.some(x => x.value === g.defaultValue) ? g.defaultValue : choices[0].value }); }}><X className="h-4 w-4"/></Button>
          </div>)}
          {g.choices.length < 8 && <Button size="sm" variant="outline" onClick={() => setGroup(i, { ...g, choices: [...g.choices, { value: freshValue(), label: "", prompt: "" }] })}><Plus className="mr-1 h-4 w-4"/>加一个选项</Button>}
        </div>;
      })}
      {groups.length < 4 && <Button size="sm" variant="outline" onClick={() => onChange([...groups, { key: freshKey(), label: "", defaultValue: "c1",
        choices: [{ value: "c1", label: "", prompt: "" }, { value: "c2", label: "", prompt: "" }] }])}><Plus className="mr-1 h-4 w-4"/>加一组选项</Button>}
    </div>
  </Field>;
}

/** 首页「你想做什么？」那一排：每张卡点进去落到一个场景，两张封面取两个场景的封面。落点场景下架后，这张卡在用户端自动不显示。 */
function HomeGoalsEditor({ catalog, onChange }: { catalog: StudioSceneCatalog; onChange: (g: StudioSceneHomeGoal[]) => void }) {
  const goals = catalog.homeGoals ?? [];
  const scenes = [...catalog.video.map(s => [s.id, `AI 视频 · ${s.title}`]), ...catalog.image.map(s => [s.id, `AI 图片 · ${s.title}`])];
  const setGoal = (i: number, changes: Partial<StudioSceneHomeGoal>) => onChange(goals.map((g, j) => j === i ? { ...g, ...changes } : g));
  const move = (i: number, by: -1 | 1) => { const j = i + by; if (j < 0 || j >= goals.length) return; const next = [...goals]; [next[i], next[j]] = [next[j], next[i]]; onChange(next); };
  const setCover = (i: number, slot: 0 | 1, id: string) => {
    const covers = [...(goals[i].covers ?? [])]; covers[slot] = id;
    setGoal(i, { covers: covers.filter(Boolean).slice(0, 2) });
  };
  const add = () => { let n = 1; while (goals.some(g => g.id === `goal-${n}`)) n++;
    const first = catalog.video[0]?.id ?? catalog.image[0]?.id ?? "";
    onChange([...goals, { id: `goal-${n}`, title: "新卡片", description: "一句话说清能做什么", sceneId: first, covers: first ? [first] : [] }]); };
  return <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
      <CardTitle className="text-base">首页「你想做什么？」</CardTitle>
      <Button size="sm" variant="outline" onClick={add} disabled={goals.length >= 12}><Plus className="mr-1 h-4 w-4"/>加一张卡片</Button>
    </CardHeader>
    <CardContent className="space-y-3">
      <p className="text-xs text-muted-foreground">首页按这里的顺序排。卡片点进去落到选的场景；落点场景下架后，这张卡在首页自动不显示。最多 12 张。</p>
      {goals.map((g, i) => <div key={g.id} className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_1.4fr_1.4fr_auto]" role="group" aria-label={`首页卡片 ${i + 1}`}>
        <Input aria-label={`卡片 ${i + 1} 标题`} value={g.title} maxLength={10} onChange={e => setGoal(i, { title: e.target.value })}/>
        <Input aria-label={`卡片 ${i + 1} 说明`} value={g.description} maxLength={24} onChange={e => setGoal(i, { description: e.target.value })}/>
        <ChoiceSelect label={`卡片 ${i + 1} 落到`} value={g.sceneId} options={scenes} onChange={v => setGoal(i, { sceneId: v })}/>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`上移卡片 ${i + 1}`} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4"/></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`下移卡片 ${i + 1}`} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4"/></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`删除卡片 ${i + 1}`} onClick={() => onChange(goals.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4"/></Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:col-span-4">
          <span className="text-xs text-muted-foreground">封面取这两个场景的图：</span>
          <div className="w-56"><ChoiceSelect label={`卡片 ${i + 1} 封面一`} value={g.covers?.[0] ?? g.sceneId} options={scenes} onChange={v => setCover(i, 0, v)}/></div>
          <div className="w-56"><ChoiceSelect label={`卡片 ${i + 1} 封面二`} value={g.covers?.[1] ?? g.sceneId} options={scenes} onChange={v => setCover(i, 1, v)}/></div>
        </div>
      </div>)}
      {!goals.length && <p className="py-6 text-center text-sm text-muted-foreground">还没有卡片，首页不会显示这一排。</p>}
    </CardContent>
  </Card>;
}

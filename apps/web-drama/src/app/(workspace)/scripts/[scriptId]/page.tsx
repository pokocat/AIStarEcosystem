"use client";

export const dynamic = "force-dynamic";

// 脚本编辑器（v0.197）：服务端每份脚本只存一版（listVersionsByScript 永远只回 1 条，commitVersion 是覆盖写），
// 原来的「另存版本 / 版本树」是假的 → 改成「保存」、去掉版本树；「归档」实为删除 → 改叫「删除」并如实确认。
// AI 续写接在编辑器当前正文后面（原来接在服务端存的那版后面，没保存的改动会被静默覆盖）。
// 第三轮：
//   · 「复制成新脚本」用编辑器眼前的正文；有没保存的改动先确认、先保存，保存没成功就不复制不跳走（_duplicate.ts）。
//   · 去掉「待定稿 / 已定稿」：服务端每次保存都把状态写成 ready（DramaScriptService#saveScript），
//     标了也存不住，重新读一次就变回去 → 只如实显示保存状态。
// 第三轮评审后复核：
//   · 「有没有改动」只跟本页记下的基线比（首次读到的正文 / 最近一次保存成功的返回值），不再跟缓存比。
//     此前保存后 invalidate 重拉：重拉期间整页换成 LoadingBlock、确认弹窗被卸掉再挂回来（能复制出两份）；
//     重拉失败时 saved 变 null、dirty 恒为 false，之后的改动存不了还显示「已保存」。
//     现在保存成功后用接口返回值直接写缓存（mutate），本页自己的两个 key 不再重拉。
//   · 复制期间正文只读，AI 续写也点不了；复制完正文要是又变了就不跳走（_duplicate.ts 的 editedSince）。
//   · 正文没读出来时给重试，不再显示一个空的、能打字的编辑器。
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Copy, Download, Info, Save, Trash2, Wand2 } from "lucide-react";
import type { Script, ScriptVersion } from "@ai-star-eco/types/script";
import { Button, Card } from "@/components/premium";
import {
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorBlock,
  Field,
  LoadingBlock,
  SectionHeader,
  TextArea,
  ViewHeader,
} from "@/components/common";
import { ScriptsApi } from "@/api";
import { useAsync, invalidate, mutate } from "@/lib/drama-query";
import { ApiError, formatDateTime } from "@ai-star-eco/api-client";
import { aiErrorMessage } from "@/lib/ai-error";
import { SCRIPT_KIND_LABEL, downloadScriptText } from "../_script-labels";
import { saveThenDuplicate } from "../_duplicate";

interface PageProps {
  params: Promise<{ scriptId: string }>;
}

export default function ScriptEditorPage({ params }: PageProps) {
  const { scriptId } = React.use(params);
  const router = useRouter();

  const scriptQ = useAsync<Script | null>(`/me/scripts/${scriptId}`, () => ScriptsApi.getScript(scriptId));
  const versionsQ = useAsync<ScriptVersion[]>(`/me/scripts/${scriptId}/versions`, () =>
    ScriptsApi.listVersionsByScript(scriptId),
  );

  const [content, setContent] = React.useState("");
  /**
   * 服务端那份正文（首次读到的，或最近一次保存成功时接口返回的）和它的保存时间。
   * null = 正文还没读到：这时不渲染编辑器。「有没有改动」只跟它比，不跟缓存比 ——
   * 缓存被清掉或重拉失败时，不能让 dirty 悄悄变成 false。
   */
  const [baseline, setBaseline] = React.useState<{ content: string; at: string } | null>(null);
  const [aiPromptOpen, setAiPromptOpen] = React.useState(false);
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiRunning, setAiRunning] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [dupConfirmOpen, setDupConfirmOpen] = React.useState(false);
  const [duplicating, setDuplicating] = React.useState(false);
  // state 要等下一次渲染才生效，挡不住同一刻的两次调用；真正的互斥用 ref
  const savingRef = React.useRef(false);
  const dupLockRef = React.useRef(false);
  // 复制结束时拿来比对「复制期间正文有没有再变」
  const contentRef = React.useRef(content);
  React.useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const script = scriptQ.data ?? null;
  const versionsData = versionsQ.data;

  // 首次拿到正文时填进编辑器（之后以编辑器为准；保存成功后基线换成接口返回的那份）
  React.useEffect(() => {
    if (baseline || !script || versionsData === undefined) return;
    // 服务端只存一版：当前稿就是那一条
    const cur = versionsData.find((v) => v.id === script.currentVersionId) ?? versionsData[0] ?? null;
    const text = cur?.content ?? "";
    setContent(text);
    setBaseline({ content: text, at: cur?.createdAt ?? script.updatedAt });
  }, [script, versionsData, baseline]);

  const loaded = baseline !== null;
  const dirty = baseline !== null && baseline.content !== content;

  async function aiContinue() {
    if (!script || duplicating) return;
    if (!aiPrompt.trim()) {
      toast.error("先写一句下一段要写什么");
      return;
    }
    setAiRunning(true);
    try {
      const { content: appended } = await ScriptsApi.generateDraft(script.id, aiPrompt.trim(), content);
      setContent(appended);
      setAiPromptOpen(false);
      toast.success("AI 写好了一段，接在正文最后，记得保存");
    } catch (e) {
      // 不直出服务端文案（那里写的是给运营看的「请在管理后台配置 X」）
      toast.error(aiErrorMessage(e, "AI 续写没成功，请稍后重试"));
    } finally {
      setAiRunning(false);
    }
  }

  /** 保存当前正文。返回是否保存成功 —— 失败不抛，在这里提示；调用方必须看返回值（§8.0.1 ⑨）。 */
  async function save(): Promise<boolean> {
    if (!script || savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      const v = await ScriptsApi.commitVersion(script.id, {
        content,
        aiAssisted: content.includes("[AI 续写"),
      });
      // 用接口返回的那份当基线；保存期间又打的字不在里面，照样算「有改动」
      setBaseline({ content: v.content, at: v.createdAt });
      // 本页自己的两个 key 直接写入返回值，不 invalidate：重拉会让整页进 loading、弹窗被卸掉（见文件头）
      mutate<ScriptVersion[]>(`/me/scripts/${script.id}/versions`, [v]);
      mutate<Script>(`/me/scripts/${script.id}`, { ...script, updatedAt: v.createdAt });
      invalidate("/me/scripts"); // 列表页不在这一页订阅，只是删掉，回列表时再拉
      toast.success("已保存");
      return true;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "保存失败，请重试");
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function remove() {
    if (!script) return;
    try {
      await ScriptsApi.deleteScript(script.id);
      invalidate("/me/scripts");
      toast.success(`已删除「${script.title}」`);
      router.push("/scripts");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败，请重试");
    }
  }

  /** 点「复制成新脚本」：有没保存的改动先弹确认，没有就直接复制。 */
  function requestDuplicate() {
    // 正文还没填进编辑器时不能复制：此刻的 content 是空串，复制出来就是一份空脚本
    if (!script || duplicating || aiRunning || !loaded || dupLockRef.current) return;
    if (dirty) setDupConfirmOpen(true);
    else void runDuplicate();
  }

  async function runDuplicate() {
    // 上一次还没完，或者已经在跳往副本：什么都不做，也不动「复制中」状态（那归上一次管）
    if (!script || dupLockRef.current) return;
    const id = script.id;
    setDuplicating(true);
    let keepBusy = false;
    try {
      // 锁在 saveThenDuplicate 里（同步拿锁）：确认弹窗被重新挂载、按钮被再点一次，拿不到锁就什么都不做
      const out = await saveThenDuplicate({
        lock: dupLockRef,
        dirty,
        content,
        currentContent: () => contentRef.current,
        save,
        clone: (text) => ScriptsApi.cloneScript(id, { content: text }),
      });
      if (out.kind === "busy") {
        keepBusy = true;
        return;
      }
      if (out.kind === "save-failed") return; // save() 已提示；不复制、不跳走，改动还在编辑器里
      if (out.kind === "copy-failed") {
        toast.error(out.error instanceof ApiError ? out.error.message : "复制失败，请重试");
        return;
      }
      invalidate("/me/scripts");
      const copyHref = `/scripts/${encodeURIComponent(out.copy.id)}`;
      if (out.editedSince) {
        // 复制期间正文又变了：副本里没有这部分，直接跳走就丢了 → 留在这页，让用户自己决定
        toast.success("副本已建好，但你刚才的改动没进副本，还在这页，记得保存", {
          action: { label: "打开副本", onClick: () => router.push(copyHref) },
        });
        return;
      }
      keepBusy = true; // 跳往副本时保持「复制中」：跳转完成前按钮一直转圈、正文一直只读
      toast.success("已复制，正在打开副本");
      router.push(copyHref);
    } finally {
      if (!keepBusy) setDuplicating(false);
    }
  }

  const backButton = (
    <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => router.push("/scripts")}>
      <ArrowLeft size={14} /> 返回脚本库
    </button>
  );

  // 两个查询读的是同一个接口：重试时把失败的那个（或两个）一起重拉
  function retryLoad() {
    if (scriptQ.error) scriptQ.refetch();
    if (versionsQ.error) versionsQ.refetch();
  }

  if (!script && scriptQ.isLoading) return <LoadingBlock rows={3} height={120} />;
  if (!script && scriptQ.error) return <ErrorBlock onRetry={retryLoad} />;
  if (!script) {
    return (
      <EmptyState
        title="找不到这份脚本"
        description="可能已经被删除了。"
        action={
          <Button variant="primary" size="md" onClick={() => router.push("/scripts")}>
            返回脚本库
          </Button>
        }
      />
    );
  }
  // 正文还没读到时不渲染编辑器：空编辑器能打字，正文一到就把打的字盖掉；复制、保存也都无从谈起
  if (!loaded) {
    if (versionsQ.error) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {backButton}
          <ErrorBlock title="正文没读出来" message="这次没读到这份脚本的正文，点「重试」再读一次。" onRetry={retryLoad} />
        </div>
      );
    }
    return <LoadingBlock rows={3} height={120} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {backButton}

      <ViewHeader
        eyebrow={SCRIPT_KIND_LABEL[script.kind] ?? "脚本"}
        title={script.title}
        meta={script.series ? `${script.series}${script.episode ? ` · ${script.episode}` : ""}` : "没填所属剧集"}
        action={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setAiPromptOpen(true)}
              disabled={duplicating}
              style={{ flex: "none" }}
            >
              <Wand2 size={14} />
              AI 续写
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => void save()}
              data-script-action="save"
              loading={saving}
              disabled={!dirty || duplicating}
              style={{ flex: "none" }}
            >
              <Save size={14} />
              保存
            </Button>
          </>
        }
      />

      <div
        className="row gap-2"
        style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6, alignItems: "flex-start", flexWrap: "wrap" }}
      >
        <Info size={14} style={{ color: "var(--accent)", flex: "none", marginTop: 3 }} />
        <span style={{ flex: "1 1 240px", minWidth: 0 }}>
          写好的脚本还不能直接带进某部短剧。要给某部短剧写分镜，到<Link href="/projects" style={{ color: "var(--accent)" }}>「我的短剧」</Link>打开那部短剧，在「逐集制作」里写。
        </span>
      </div>

      <div className="mk-script-editor">
        {/* 编辑器（窄屏排第一） */}
        <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div
            style={{
              padding: "12px 18px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div className="mono" style={{ fontSize: 11, color: dirty ? "var(--accent)" : "var(--fg-2)" }}>
              {duplicating
                ? "正在复制，这会儿正文先不能改"
                : dirty
                  ? "● 有改动没保存"
                  : `已保存 · ${formatDateTime(baseline.at)}`}{" "}
              · {content.length} 字
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  navigator.clipboard
                    .writeText(content)
                    .then(() => toast.success("已复制正文"))
                    .catch(() => toast.error("复制失败，请手动选中复制"))
                }
              >
                <Copy size={11} />
                复制正文
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  downloadScriptText(script.title, content);
                  toast.success("已下载剧本文件");
                }}
              >
                <Download size={11} />
                下载
              </Button>
            </div>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            // 复制期间只读：副本用的是点下去那一刻的正文，这时再打的字既不在原稿也不在副本里
            readOnly={duplicating}
            placeholder="从这里开始写"
            aria-label="脚本正文"
            style={{
              flex: 1,
              minHeight: 480,
              padding: "20px 22px",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--fg-0)",
              fontFamily: "var(--font-serif), serif",
              fontSize: 15,
              lineHeight: 1.7,
              resize: "vertical",
            }}
          />
        </Card>

        {/* 操作 + 修改建议 */}
        <Card style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <SectionHeader eyebrow="操作" title="下一步" />
          <Button variant="secondary" size="md" onClick={() => setAiPromptOpen(true)} disabled={duplicating}>
            <Wand2 size={13} />
            AI 续写一段
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={requestDuplicate}
            loading={duplicating}
            disabled={saving || aiRunning}
            data-script-action="duplicate"
          >
            <Copy size={13} />
            复制成新脚本
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={() => setDeleteOpen(true)}
            disabled={duplicating}
            data-script-action="delete"
          >
            <Trash2 size={13} />
            删除
          </Button>

          {script.suggestion && (
            <>
              <div className="eyebrow" style={{ marginTop: 10 }}>
                修改建议
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(164,76,255,0.08)",
                  border: "1px solid rgba(164,76,255,0.22)",
                  fontSize: 12,
                  color: "var(--fg-1)",
                  fontStyle: "italic",
                  fontFamily: "var(--font-serif)",
                  lineHeight: 1.55,
                }}
              >
                {script.suggestion}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* AI 续写 */}
      <Dialog
        open={aiPromptOpen}
        onOpenChange={(o) => {
          if (aiRunning) return;
          setAiPromptOpen(o);
        }}
        title="AI 续写"
        description="告诉 AI 下一段写什么，写好的内容接在正文最后。"
        width={520}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setAiPromptOpen(false)} disabled={aiRunning}>
              取消
            </Button>
            <Button variant="primary" size="md" loading={aiRunning} onClick={aiContinue}>
              <Wand2 size={13} />
              开始续写
            </Button>
          </>
        }
      >
        <Field label="下一段写什么" required>
          <TextArea
            rows={4}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            maxLength={200}
            placeholder="如：接着写一段，主角第一次坦诚"
            autoFocus
          />
        </Field>
      </Dialog>

      {/* 有没保存的改动时复制：先保存再复制，副本就是眼前这份正文 */}
      <ConfirmDialog
        open={dupConfirmOpen}
        onOpenChange={setDupConfirmOpen}
        title="先保存再复制"
        description="这份脚本有改动还没保存。点「保存并复制」会先保存这份，再用现在的正文复制一份新脚本并打开。"
        confirmLabel="保存并复制"
        onConfirm={runDuplicate}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`删除「${script.title}」`}
        description="删了没法恢复，确定删除吗？"
        destructive
        confirmLabel="删除"
        onConfirm={remove}
      />
    </div>
  );
}

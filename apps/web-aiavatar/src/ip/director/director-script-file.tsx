"use client";

import { useEffect, useImperativeHandle, useRef, useState, type ClipboardEvent, type Ref } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { DirectorApi } from "../api";
import { InlineError, errorText } from "./director-shared";

const ACCEPT = ".txt,.md,.markdown,.csv,.tsv,.json,.xml,.yaml,.yml,.log,.srt,.vtt,.rtf,.doc,.docx,.ppt,.pptx,.pdf,.html,.htm";
/** 剧本文件上限，和服务端 StudioStoryImportService.MAX_SCRIPT_BYTES 一致。提取出来的正文不限字数（2026-10-29）。 */
export const MAX_SCRIPT_FILE_BYTES = 50 * 1024 * 1024;
/** 预览框只放开头这么多字：几十万字塞进只读预览框没人会逐字看，还拖慢页面；导入时整份导入。 */
export const PREVIEW_CHARS = 20000;

function sizeText(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export type ScriptFileHandle = { open: () => void };

/**
 * 一次粘贴超过这么多字就拦下，请用户存成 TXT 再上传（2026-10-29 用户：「太多字了就提示用户保存成文本再上传」）。
 * 依据：本机 Chrome 实测，文本框原生粘贴的耗时随字数（准确说是行数）成倍增长，期间整页卡住 ——
 * 每行 24 字的剧本：2 万字约 0.5 秒、3 万字约 0.7 秒、6 万字约 2.3 秒、10 万字约 10 秒、30 万字 1–1.7 分钟。
 * 正文本身不限长，文件上传后直接放进正文、不走这条慢路。
 */
export const PASTE_MAX = 30000;

/**
 * 粘贴前拦超量文字：拦下时不改正文（preventDefault 在内容进入编辑框之前），记下粘贴的位置。
 * offset：编辑框只放了正文的一段时（按段编辑），这一段在整份正文里的起点。
 */
export function usePasteGuard(offset: () => number = () => 0) {
  const [blocked, setBlocked] = useState<{ chars: number; start: number; end: number } | null>(null);
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData?.getData("text/plain") ?? "";
    if (text.length <= PASTE_MAX) { setBlocked(null); return; }
    e.preventDefault();
    setBlocked({ chars: text.length, start: offset() + e.currentTarget.selectionStart, end: offset() + e.currentTarget.selectionEnd });
  };
  return { blocked, onPaste, clear: () => setBlocked(null) };
}

/**
 * 拦下超量粘贴后的提示。onUpload：页面上已有「上传剧本文件」，点按钮打开它；
 * onInsert：这里没有上传入口，就地给一个，读出来的文字插到刚才粘贴的位置，原有正文保留。
 */
export function LargePasteNotice({ chars, onUpload, onInsert, onClose, disabled }: {
  chars: number; onUpload?: () => void; onInsert?: (text: string) => void; onClose: () => void; disabled?: boolean;
}) {
  return <div className="director-paste-blocked" role="alert">
    <p><b>粘贴的文字较多（约 {chars.toLocaleString("zh-CN")} 字）</b>，请保存为 TXT 文件后，通过「上传剧本文件」导入。正文没有改动，可以继续编辑。</p>
    <div className="director-paste-blocked-actions">
      {onUpload && <button type="button" className="ip-brand-button" disabled={disabled} onClick={onUpload}><Upload size={14}/>上传剧本文件</button>}
      <button type="button" className="ip-brand-text-button" onClick={onClose}>知道了</button>
    </div>
    {onInsert && <DirectorScriptFile hasText insert disabled={disabled} onImport={text => { onInsert(text); onClose(); }} onReadingChange={() => {}}/>}
  </div>;
}

/** Keep the existing draft until the user accepts the extracted text. No automatic save or AI call. */
export function DirectorScriptFile({ hasText, insert, disabled, onImport, onReadingChange, ref }: {
  hasText: boolean; disabled?: boolean; onImport: (text: string) => void; onReadingChange: (reading: boolean) => void;
  /** 插到粘贴的位置（超量粘贴被拦下后用），不替换整份正文。 */
  insert?: boolean;
  ref?: Ref<ScriptFileHandle>;
}) {
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ open: () => input.current?.click() }), []);
  const request = useRef<AbortController | null>(null);
  const [reading, setReading] = useState<{ name: string; size: number; since: number }>();
  const [now, setNow] = useState(() => Date.now());
  // 大文件上传加提取可能要一会儿：每秒刷新一次「已用 N 秒」，让人知道还在进行，不编进度百分比。
  useEffect(() => {
    if (!reading) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [reading]);
  const [preview, setPreview] = useState<{ name: string; text: string }>();
  const [error, setError] = useState("");
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  const cancel = () => {
    request.current?.abort(); request.current = null;
    setReading(undefined); onReadingChange(false);
  };
  const read = async (file: File) => {
    if (disabled || request.current) return;
    setError(""); setPreview(undefined);
    const extension = file.name.includes(".") ? "." + file.name.split(".").pop()!.toLowerCase() : "";
    if (!ACCEPT.split(",").includes(extension)) { setError("请选择 TXT、Markdown、Word、PPT、PDF、RTF、HTML 或常见文本文件"); return; }
    if (!file.size) { setError("文件为空，请选择有正文的文件"); return; }
    if (file.size > MAX_SCRIPT_FILE_BYTES) { setError("文件超过 50 MB，请按章节拆分后上传。没有读取任何内容"); return; }
    const controller = new AbortController(); request.current = controller;
    setReading({ name: file.name, size: file.size, since: Date.now() }); setNow(Date.now()); onReadingChange(true);
    try {
      const result = await DirectorApi.importScript(file, controller.signal);
      if (request.current !== controller) return;
      if (!result.text.trim()) throw new Error("文件没有可读取的文字，请检查正文或先识别扫描件");
      setPreview({ name: file.name, text: result.text });
    } catch (e) {
      if (request.current === controller) setError(errorText(e));
    } finally {
      if (request.current === controller) { request.current = null; setReading(undefined); onReadingChange(false); }
    }
  };
  return <div className="director-script-file">
    <div className="director-script-file-toolbar">
      <button type="button" className="ip-brand-secondary" disabled={disabled || !!reading} onClick={() => input.current?.click()}>
        {reading ? <Loader2 size={15} className="ip-loading-icon"/> : <Upload size={15}/>}{reading ? "正在读取文件…" : "上传剧本文件"}
      </button>
      <input ref={input} hidden type="file" accept={ACCEPT} aria-label="上传剧本文件" disabled={disabled || !!reading}
        onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void read(file); }}/>
      {reading && <button type="button" className="ip-brand-text-button" onClick={cancel}>取消读取</button>}
      <span>TXT / Markdown / Word / PPT / PDF / RTF / HTML 等 · 文件最多 50 MB，正文不限字数</span>
    </div>
    <p className="director-script-file-hint">免费提取文字，可预览后导入正文；网页只取正文，不运行里面的脚本；扫描 PDF 请先识别文字。</p>
    {reading && <span role="status" className="director-script-file-hint director-script-file-progress">
      正在上传并提取「{reading.name}」（{sizeText(reading.size)}），已用 {Math.max(0, Math.round((now - reading.since) / 1000))} 秒。完成后可预览，取消不会改动正文。</span>}
    <InlineError message={error}/>
    {preview && <div className="director-script-file-preview">
      <div><FileText size={15}/><strong title={preview.name}>{preview.name}</strong><span>{preview.text.length.toLocaleString("zh-CN")} 字</span>
        <button type="button" aria-label="关闭文件预览" onClick={() => setPreview(undefined)}><X size={16}/></button></div>
      <textarea aria-label="文件文字预览" value={preview.text.length > PREVIEW_CHARS ? preview.text.slice(0, PREVIEW_CHARS) : preview.text} readOnly rows={6}/>
      {preview.text.length > PREVIEW_CHARS && <small className="director-muted">这里只预览开头 {PREVIEW_CHARS.toLocaleString("zh-CN")} 字，导入时整份 {preview.text.length.toLocaleString("zh-CN")} 字都会放进正文，不截断。</small>}
      <div className="director-actions">
        <button type="button" className="ip-brand-button" disabled={disabled} onClick={() => { onImport(preview.text); setPreview(undefined); }}>{insert ? "插入到粘贴的位置" : hasText ? "替换当前正文" : "使用文件内容"}</button>
        <small>{insert ? "插到你刚才粘贴的位置，原有正文保留；点击保存才会存入作品。" : hasText ? "确认后替换下方正文，请先检查原有内容。" : "导入后仍可编辑，点击保存才会存入作品。"}</small>
      </div>
    </div>}
  </div>;
}

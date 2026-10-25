"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { DirectorApi } from "../api";
import { InlineError, errorText } from "./director-shared";

const ACCEPT = ".txt,.md,.markdown,.csv,.tsv,.json,.xml,.yaml,.yml,.log,.srt,.vtt,.rtf,.doc,.docx,.ppt,.pptx,.pdf";
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_TEXT = 60000;

/** Keep the existing draft until the user accepts the extracted text. No automatic save or AI call. */
export function DirectorScriptFile({ hasText, disabled, onImport, onReadingChange }: {
  hasText: boolean; disabled?: boolean; onImport: (text: string) => void; onReadingChange: (reading: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<{ name: string; text: string }>();
  const [error, setError] = useState("");
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  const cancel = () => {
    request.current?.abort(); request.current = null;
    setReading(false); onReadingChange(false);
  };
  const read = async (file: File) => {
    if (disabled || request.current) return;
    setError(""); setPreview(undefined);
    const extension = file.name.includes(".") ? "." + file.name.split(".").pop()!.toLowerCase() : "";
    if (!ACCEPT.split(",").includes(extension)) { setError("请选择 TXT、Markdown、Word、PPT、PDF、RTF 或常见文本文件"); return; }
    if (!file.size) { setError("文件为空，请选择有正文的文件"); return; }
    if (file.size > MAX_BYTES) { setError("文件最多 8 MB，请按章节拆分后上传"); return; }
    const controller = new AbortController(); request.current = controller;
    setReading(true); onReadingChange(true);
    try {
      const result = await DirectorApi.importScript(file, controller.signal);
      if (request.current !== controller) return;
      if (!result.text.trim()) throw new Error("文件没有可读取的文字，请检查正文或先识别扫描件");
      if (result.text.length > MAX_TEXT) throw new Error("单份剧本最多 60000 字，请按章节拆分；未截断正文");
      setPreview({ name: file.name, text: result.text });
    } catch (e) {
      if (request.current === controller) setError(errorText(e));
    } finally {
      if (request.current === controller) { request.current = null; setReading(false); onReadingChange(false); }
    }
  };
  return <div className="director-script-file">
    <div className="director-script-file-toolbar">
      <button type="button" className="ip-brand-secondary" disabled={disabled || reading} onClick={() => input.current?.click()}>
        {reading ? <Loader2 size={15} className="ip-loading-icon"/> : <Upload size={15}/>}{reading ? "正在读取文件…" : "上传剧本文件"}
      </button>
      <input ref={input} hidden type="file" accept={ACCEPT} aria-label="上传剧本文件" disabled={disabled || reading}
        onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void read(file); }}/>
      {reading && <button type="button" className="ip-brand-text-button" onClick={cancel}>取消读取</button>}
      <span>TXT / Markdown / Word / PPT / PDF / RTF 等 · 最多 8 MB、6 万字</span>
    </div>
    <p className="director-script-file-hint">免费提取文字，可预览后导入正文；扫描 PDF 请先识别文字。</p>
    {reading && <span role="status" className="director-script-file-hint">正在提取文字，完成后可预览</span>}
    <InlineError message={error}/>
    {preview && <div className="director-script-file-preview">
      <div><FileText size={15}/><strong title={preview.name}>{preview.name}</strong><span>{preview.text.length.toLocaleString("zh-CN")} 字</span>
        <button type="button" aria-label="关闭文件预览" onClick={() => setPreview(undefined)}><X size={16}/></button></div>
      <textarea aria-label="文件文字预览" value={preview.text} readOnly rows={6}/>
      <div className="director-actions">
        <button type="button" className="ip-brand-button" disabled={disabled} onClick={() => { onImport(preview.text); setPreview(undefined); }}>{hasText ? "替换当前正文" : "使用文件内容"}</button>
        <small>{hasText ? "确认后替换下方正文，请先检查原有内容。" : "导入后仍可编辑，点击保存才会存入作品。"}</small>
      </div>
    </div>}
  </div>;
}

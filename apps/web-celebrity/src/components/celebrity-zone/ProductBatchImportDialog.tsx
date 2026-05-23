"use client";

// v0.22+: 商品库批量录入对话框。
// 三种入口模式由顶部 Tab 切换；底部统一是「编辑表格 → 一次性提交」：
//   1. 手动：从一行空表开始，「+ 加一行」逐条补
//   2. 粘贴：把 Excel / 飞书 / 钉钉表格选区复制后直接 Ctrl+V，TSV 自动拆列
//   3. 文件：上传 .csv / .xlsx / .xls，列名按下表自动 map
//
// 列 mapping（中英文都识别）：
//   name / 商品名称 / 名称 (必填) → name
//   category / 类目 / 分类         → category（不在 PRODUCT_CATEGORIES 里时落 "其他"）
//   link / 链接 / 商品链接 / URL   → link
//   sellingPoints / 卖点 / 描述    → sellingPoints
//   images / 图片 / 图片链接       → images（逗号 / 分号 / 换行分隔的多 URL）
//   price / 商品价格 / 价格 / 售价 → priceYuan（输入元，存 cents）
//   commission / 佣金 / 佣金率     → commissionRate（输入百分比整数）
//   商品ID / id                    → 忽略（server 自己生成；保留是为了兼容抖音选品表格列）
//
// xlsx 是 ~600KB 的库，仅在 Tab 切到「文件」时 dynamic import；不影响首屏。

import * as React from "react";
import { ChevronRight, FileSpreadsheet, Loader2, Plus, Trash2, ClipboardPaste, Upload, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ai-star-eco/ui/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@ai-star-eco/ui/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ai-star-eco/ui/ui/select";
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
  type ProductInput,
} from "@ai-star-eco/types/product";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";

type Mode = "manual" | "paste" | "file";

interface DraftRow {
  rowId: string;
  name: string;
  category: ProductCategory;
  link: string;
  sellingPoints: string;
  images: string; // 多 URL 用换行分隔在编辑框里
  priceYuan: string;       // v0.26+ 输入元，转 cents 时 *100
  commissionRate: string;  // v0.26+ 输入百分比整数（"50%" 自动 strip %）
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 批量创建：每行调一次 createProduct；返回成功条数 / 失败明细。 */
  onSubmit: (rows: ProductInput[]) => Promise<{ created: Product[]; failed: { row: number; reason: string }[] }>;
  onSaved?: (created: Product[]) => void;
}

const inputCls =
  "w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-violet-500";

let rowIdSeq = 0;
function newRowId() {
  rowIdSeq += 1;
  return `row-${Date.now().toString(36)}-${rowIdSeq}`;
}

function emptyRow(): DraftRow {
  return {
    rowId: newRowId(),
    name: "",
    category: "其他",
    link: "",
    sellingPoints: "",
    images: "",
    priceYuan: "",
    commissionRate: "",
  };
}

function normalizeCategory(raw: string | undefined): ProductCategory {
  if (!raw) return "其他";
  const trimmed = raw.trim();
  const hit = PRODUCT_CATEGORIES.find((c) => c === trimmed);
  return hit ?? "其他";
}

/** 把字符串列名归一化到 DraftRow 字段；不认得返回 null。 */
function mapHeaderToField(header: string): keyof DraftRow | null {
  const h = header.trim().toLowerCase().replace(/\s+/g, "");
  if (["name", "商品名称", "名称", "商品名"].includes(h)) return "name";
  if (["category", "类目", "分类", "类别"].includes(h)) return "category";
  if (["link", "url", "链接", "商品链接", "网址"].includes(h)) return "link";
  if (["sellingpoints", "卖点", "描述", "卖点描述"].includes(h)) return "sellingPoints";
  if (["images", "image", "图片", "图片链接", "图"].includes(h)) return "images";
  // v0.26+ 抖音选品表格列识别
  if (["price", "商品价格", "价格", "售价"].includes(h)) return "priceYuan";
  if (["commission", "佣金", "佣金率", "commissionrate"].includes(h)) return "commissionRate";
  return null;
}

/** 解析剪贴板内容（TSV / CSV）→ 行 array of cell arrays。
 *  - 优先 \t 分隔（Excel 复制默认就是 TSV，不会含逗号歧义）；
 *  - 找不到 \t 才退回到 CSV 解析（带引号字段处理）。
 */
function parseClipboardTable(raw: string): string[][] {
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!text.trim()) return [];
  const lines = text.split("\n").filter((l) => l.length > 0);
  const isTsv = lines.some((l) => l.includes("\t"));
  if (isTsv) {
    return lines.map((l) => l.split("\t"));
  }
  return parseCsv(text);
}

/** RFC4180 大致兼容的 CSV 解析（支持 "" 转义引号、\n in field）。 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        cur.push(field);
        field = "";
      } else if (ch === "\n") {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/** 把 cells[][] 按表头（首行）映射成 DraftRow[]。表头未识别的列会忽略。 */
function cellsToRows(cells: string[][]): { rows: DraftRow[]; ignored: string[]; matched: string[] } {
  if (cells.length === 0) return { rows: [], ignored: [], matched: [] };
  const header = cells[0];
  const mapping: (keyof DraftRow | null)[] = header.map((h) => mapHeaderToField(h));
  const matched: string[] = [];
  const ignored: string[] = [];
  header.forEach((h, i) => {
    if (mapping[i]) matched.push(h);
    else if (h.trim()) ignored.push(h);
  });
  const rows: DraftRow[] = [];
  for (let r = 1; r < cells.length; r++) {
    const draft = emptyRow();
    let nonEmpty = false;
    cells[r].forEach((cell, i) => {
      const field = mapping[i];
      if (!field) return;
      const val = (cell ?? "").trim();
      if (val) nonEmpty = true;
      if (field === "category") draft.category = normalizeCategory(val);
      else if (field === "images") draft.images = val.replace(/[;,，]\s*/g, "\n");
      else draft[field] = val;
    });
    if (nonEmpty) rows.push(draft);
  }
  return { rows, ignored, matched };
}

function draftRowToInput(d: DraftRow): ProductInput {
  const images = d.images
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const priceCentsRaw = d.priceYuan.trim();
  const commissionRaw = d.commissionRate.trim().replace(/%/g, "");
  const priceCents = priceCentsRaw ? Math.round(parseFloat(priceCentsRaw) * 100) : undefined;
  const commissionInt = commissionRaw ? parseInt(commissionRaw, 10) : undefined;
  return {
    name: d.name.trim(),
    category: d.category,
    link: d.link.trim() || undefined,
    sellingPoints: d.sellingPoints.trim() || undefined,
    images: images.length ? images : undefined,
    source: "manual",
    priceCents: Number.isFinite(priceCents) ? priceCents : undefined,
    commissionRate: Number.isFinite(commissionInt) ? commissionInt : undefined,
  };
}

export function ProductBatchImportDialog({ open, onOpenChange, onSubmit, onSaved }: Props) {
  const [mode, setMode] = React.useState<Mode>("manual");
  const [rows, setRows] = React.useState<DraftRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitProgress, setSubmitProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [submitResult, setSubmitResult] = React.useState<{ created: number; failed: { row: number; reason: string }[] } | null>(null);
  const [pasteText, setPasteText] = React.useState("");
  const [parseHint, setParseHint] = React.useState<{ ignored: string[]; matched: string[] } | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [parsingFile, setParsingFile] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setMode("manual");
    setRows([emptyRow()]);
    setSubmitting(false);
    setSubmitProgress(null);
    setSubmitResult(null);
    setPasteText("");
    setParseHint(null);
    setFileError(null);
    setParsingFile(false);
  }, [open]);

  const validRowCount = rows.filter((r) => r.name.trim().length > 0).length;
  const canSubmit = validRowCount > 0 && !submitting;

  const setRow = (rowId: string, patch: Partial<DraftRow>) => {
    setRows((cur) => cur.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((cur) => [...cur, emptyRow()]);
  const removeRow = (rowId: string) => setRows((cur) => (cur.length === 1 ? [emptyRow()] : cur.filter((r) => r.rowId !== rowId)));
  const clearAll = () => setRows([emptyRow()]);

  const handlePasteParse = () => {
    if (!pasteText.trim()) {
      setParseHint({ matched: [], ignored: ["（粘贴内容为空）"] });
      return;
    }
    const cells = parseClipboardTable(pasteText);
    const { rows: parsed, ignored, matched } = cellsToRows(cells);
    if (parsed.length === 0) {
      setParseHint({ matched, ignored: ignored.length ? ignored : ["（首行未识别到任何已知列名，请检查表头）"] });
      return;
    }
    setRows(parsed);
    setParseHint({ matched, ignored });
    setMode("manual"); // 自动跳回手动 tab 让用户预览 / 微调
  };

  const handleFileUpload = async (file: File) => {
    setFileError(null);
    setParseHint(null);
    setParsingFile(true);
    try {
      const lower = file.name.toLowerCase();
      let cells: string[][] = [];
      if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
        const text = await file.text();
        cells = parseClipboardTable(text);
      } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        // 动态 import：xlsx 包 ~600KB，仅在用户真的上传 Excel 时加载
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) throw new Error("Excel 文件没有任何 sheet");
        const ws = wb.Sheets[firstSheet];
        cells = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: "" }) as string[][];
      } else {
        throw new Error("仅支持 .csv / .xlsx / .xls / .tsv / .txt 文件");
      }
      const { rows: parsed, ignored, matched } = cellsToRows(cells);
      if (parsed.length === 0) {
        setFileError(matched.length === 0
          ? "未识别到任何已知列名。表头需含「商品名称 / name」等列。"
          : "已识别表头但没有有效数据行。");
        setParseHint({ matched, ignored });
        return;
      }
      setRows(parsed);
      setParseHint({ matched, ignored });
      setMode("manual");
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "文件解析失败");
    } finally {
      setParsingFile(false);
    }
  };

  const handleSubmit = async () => {
    const inputs: ProductInput[] = rows
      .filter((r) => r.name.trim().length > 0)
      .map(draftRowToInput);
    if (inputs.length === 0) return;
    setSubmitting(true);
    setSubmitResult(null);
    setSubmitProgress({ done: 0, total: inputs.length });
    try {
      const result = await onSubmit(inputs);
      setSubmitResult({ created: result.created.length, failed: result.failed });
      if (result.created.length > 0) onSaved?.(result.created);
      // 全部成功 → 关闭；有失败 → 留 dialog 让用户看
      if (result.failed.length === 0) {
        setTimeout(() => onOpenChange(false), 800);
      }
    } finally {
      setSubmitting(false);
      setSubmitProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[1280px] sm:max-w-[1280px] max-h-[92vh] overflow-y-auto border-zinc-200 bg-white text-zinc-900 shadow-[var(--shadow-pop)]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">批量录入商品</DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            手动逐行、Excel 复制粘贴、CSV/Excel 文件上传 三选一；解析后会落到下方编辑表，提交前可自由微调。
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="manual" className="text-xs gap-1.5">
              <Plus className="size-3.5" /> 手动录入
            </TabsTrigger>
            <TabsTrigger value="paste" className="text-xs gap-1.5">
              <ClipboardPaste className="size-3.5" /> 粘贴 Excel
            </TabsTrigger>
            <TabsTrigger value="file" className="text-xs gap-1.5">
              <FileSpreadsheet className="size-3.5" /> 文件上传
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* mode panel */}
        <div className="space-y-3">
          {mode === "paste" && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 space-y-2">
              <div className="flex items-start gap-2 text-[11px] text-zinc-600">
                <Info className="size-3.5 text-violet-500 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  从 Excel / 飞书表格 / 钉钉表格 / Google Sheets 直接复制选中的单元格区域，
                  粘贴到下面文本框（含表头行）。已识别列名：
                  <code className="px-1 text-violet-600">name/商品名称</code>{" "}
                  <code className="px-1 text-violet-600">category/类目</code>{" "}
                  <code className="px-1 text-violet-600">link/链接</code>{" "}
                  <code className="px-1 text-violet-600">price/商品价格</code>{" "}
                  <code className="px-1 text-violet-600">commission/佣金</code>{" "}
                  <code className="px-1 text-violet-600">sellingPoints/卖点</code>{" "}
                  <code className="px-1 text-violet-600">images/图片</code>。
                  支持抖音商城选品库表格直接粘贴（自动忽略「商品ID」列）。
                </div>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"商品ID\t商品名称\t商品链接\t商品价格\t佣金\n3485332505048038713\t一次性水槽过滤网\thttps://haohuo...\t9.9\t50%"}
                className="w-full min-h-[120px] rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-mono outline-none focus:border-violet-500"
              />
              <div className="flex justify-end">
                <button type="button" className={CTA_SECONDARY} onClick={handlePasteParse}>
                  <ClipboardPaste className="size-3.5" /> 解析到表格 →
                </button>
              </div>
            </div>
          )}

          {mode === "file" && (
            <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center space-y-3">
              <FileSpreadsheet className="size-8 text-violet-500 mx-auto" />
              <div className="text-xs text-zinc-600 leading-relaxed">
                选择本地的 <strong>.xlsx / .xls / .csv / .tsv</strong> 文件；表头需含「商品名称 / name」等列。
                <br />
                <span className="text-zinc-500">列识别同粘贴模式（name / category / link / sellingPoints / images）。</span>
              </div>
              <label className={cn(CTA_PRIMARY, "cursor-pointer", parsingFile && "opacity-50 pointer-events-none")}>
                {parsingFile ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                {parsingFile ? "解析中…" : "选择文件…"}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                    e.target.value = ""; // allow re-selecting same file
                  }}
                />
              </label>
              {fileError && (
                <div className="text-xs text-pink-600 bg-pink-50 border border-pink-200 rounded p-2 inline-flex items-start gap-1.5">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                  {fileError}
                </div>
              )}
            </div>
          )}

          {parseHint && (parseHint.matched.length > 0 || parseHint.ignored.length > 0) && (
            <div className="rounded-md bg-violet-50 border border-violet-200 px-3 py-2 text-[11px] text-violet-700 space-y-1">
              {parseHint.matched.length > 0 && (
                <div>
                  <CheckCircle2 className="inline size-3 mr-1" />
                  识别列：{parseHint.matched.join(" / ")}
                </div>
              )}
              {parseHint.ignored.length > 0 && (
                <div className="text-amber-700">
                  <Info className="inline size-3 mr-1" />
                  忽略列：{parseHint.ignored.join(" / ")}
                </div>
              )}
            </div>
          )}
        </div>

        {/* editable rows */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-600">
              共 {rows.length} 行 · <span className="text-emerald-600">{validRowCount}</span> 行可提交（有商品名）
            </div>
            <div className="flex items-center gap-2">
              {rows.length > 1 && (
                <button type="button" onClick={clearAll} className="text-[11px] text-zinc-500 hover:text-pink-600">
                  清空
                </button>
              )}
              <button type="button" onClick={addRow} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600 hover:border-violet-400 hover:text-violet-600">
                <Plus className="size-3" /> 加一行
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="w-full text-xs" style={{ minWidth: 1100 }}>
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: 110 }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 64 }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: 40 }} />
              </colgroup>
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">#</th>
                  <th className="px-2 py-1.5 text-left font-medium">商品名称 *</th>
                  <th className="px-2 py-1.5 text-left font-medium">类目</th>
                  <th className="px-2 py-1.5 text-left font-medium">链接</th>
                  <th className="px-2 py-1.5 text-left font-medium">价格 ¥</th>
                  <th className="px-2 py-1.5 text-left font-medium">佣金 %</th>
                  <th className="px-2 py-1.5 text-left font-medium">卖点 / 描述</th>
                  <th className="px-2 py-1.5 text-left font-medium">图片 URL（多行）</th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 max-h-[300px]">
                {rows.map((r, i) => (
                  <tr key={r.rowId} className={cn("align-top", r.name.trim() && "bg-emerald-50/30")}>
                    <td className="px-2 py-1.5 text-[10px] text-zinc-400 tabular-nums">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <input
                        className={inputCls}
                        value={r.name}
                        onChange={(e) => setRow(r.rowId, { name: e.target.value })}
                        placeholder="必填"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Select value={r.category} onValueChange={(v) => setRow(r.rowId, { category: v as ProductCategory })}>
                        <SelectTrigger className="h-8 w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className={inputCls}
                        value={r.link}
                        onChange={(e) => setRow(r.rowId, { link: e.target.value })}
                        placeholder="https://..."
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className={inputCls + " tabular-nums"}
                        value={r.priceYuan}
                        onChange={(e) => setRow(r.rowId, { priceYuan: e.target.value })}
                        placeholder="9.90"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        className={inputCls + " tabular-nums"}
                        value={r.commissionRate}
                        onChange={(e) => setRow(r.rowId, { commissionRate: e.target.value })}
                        placeholder="50"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <textarea
                        className={inputCls + " min-h-[32px] resize-none"}
                        rows={1}
                        value={r.sellingPoints}
                        onChange={(e) => setRow(r.rowId, { sellingPoints: e.target.value })}
                        placeholder="可选"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <textarea
                        className={inputCls + " min-h-[32px] resize-none font-mono text-[10px]"}
                        rows={1}
                        value={r.images}
                        onChange={(e) => setRow(r.rowId, { images: e.target.value })}
                        placeholder="一行一个 URL"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button type="button" onClick={() => removeRow(r.rowId)} className="text-zinc-400 hover:text-pink-600">
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {submitResult && (
          <div className={cn(
            "rounded-md px-3 py-2 text-xs space-y-1",
            submitResult.failed.length === 0
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-amber-50 border border-amber-200 text-amber-700"
          )}>
            <div className="flex items-center gap-1.5">
              {submitResult.failed.length === 0
                ? <CheckCircle2 className="size-3.5" />
                : <AlertTriangle className="size-3.5" />}
              成功 {submitResult.created} 条
              {submitResult.failed.length > 0 && ` · 失败 ${submitResult.failed.length} 条`}
            </div>
            {submitResult.failed.length > 0 && (
              <ul className="space-y-0.5 pl-4 list-disc text-[10px]">
                {submitResult.failed.slice(0, 5).map((f) => (
                  <li key={f.row}>第 {f.row + 1} 行：{f.reason}</li>
                ))}
                {submitResult.failed.length > 5 && <li>… 还有 {submitResult.failed.length - 5} 条</li>}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className={CTA_SECONDARY} disabled={submitting}>
            取消
          </button>
          <button type="button" onClick={handleSubmit} className={CTA_PRIMARY} disabled={!canSubmit}>
            {submitting && submitProgress
              ? <>
                  <Loader2 className="size-3.5 animate-spin" />
                  保存中 {submitProgress.done}/{submitProgress.total}
                </>
              : <>
                  <ChevronRight className="size-3.5" />
                  批量保存 {validRowCount} 条
                </>}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

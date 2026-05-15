"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { CelebrityStar } from "@ai-star-eco/types/celebrity-zone";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";

interface Props {
  star: CelebrityStar;
}

interface FormState {
  company: string;
  brand: string;
  scenes: string;
  budget: string;
  contact: string;
  note: string;
}

const INITIAL: FormState = {
  company: "",
  brand: "",
  scenes: "",
  budget: "",
  contact: "",
  note: "",
};

const inputCls =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-violet-500";

export function CelebrityApplyForm({ star }: Props) {
  const [form, setForm] = React.useState<FormState>(INITIAL);
  const [submitted, setSubmitted] = React.useState(false);

  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch });
  const canSubmit = form.company.trim() && form.brand.trim() && form.contact.trim();

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.06] px-8 py-12 text-center shadow-[var(--shadow-soft)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-400/40 bg-emerald-500/10">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-900">申请已提交</h2>
        <p className="text-sm leading-relaxed text-zinc-600">
          平台将在 3 个工作日内通过站内通知和邮件回复您。如有紧急合作需求，
          可直接联系商务团队 <a className="text-emerald-600 font-medium" href="mailto:bd@aistareco.com">bd@aistareco.com</a>。
        </p>
        <div className="flex gap-2">
          <Link href={`/star/${star.id}`} className={CTA_SECONDARY}>
            返回明星详情
          </Link>
          <Link href="/dashboard" className={CTA_PRIMARY}>
            继续浏览明星
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/star/${star.id}`} className={CTA_SECONDARY}>
          <ArrowLeft className="h-3.5 w-3.5" /> 返回 {star.name} 详情
        </Link>
        <h1 className="text-lg font-semibold text-zinc-800">
          申请 {star.name} 商务合作
        </h1>
      </div>

      {/* Hero card */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-violet-400/20 bg-gradient-to-r from-violet-500/[0.08] to-pink-500/[0.05] p-5 shadow-[var(--shadow-soft)]">
        <img
          src={star.cover}
          alt={star.name}
          className="h-16 w-12 rounded-md object-cover"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            <span className="text-base font-semibold text-zinc-900">{star.name}</span>
            <span className="rounded-md border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-600">
              {star.category}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            提交申请后，平台商务团队将与艺人/经纪团队确认授权范围（带货 / 种草 /
            测评 / 代言），并在 3 个工作日内反馈您可购买的套餐档位。
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600">
          <ShieldCheck className="h-4 w-4" /> 平台代为洽谈，授权信息透明可查
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          setSubmitted(true);
        }}
        className="grid grid-cols-1 gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[var(--shadow-soft)] sm:grid-cols-2"
      >
        <Field label="公司名称" required>
          <input
            className={inputCls}
            value={form.company}
            onChange={(e) => set({ company: e.target.value })}
            placeholder="如：北京 XX 文化传媒有限公司"
          />
        </Field>
        <Field label="品牌名称" required>
          <input
            className={inputCls}
            value={form.brand}
            onChange={(e) => set({ brand: e.target.value })}
            placeholder="如：XX 美妆 / XX 食品"
          />
        </Field>
        <Field label="合作场景">
          <input
            className={inputCls}
            value={form.scenes}
            onChange={(e) => set({ scenes: e.target.value })}
            placeholder="带货 / 种草 / 测评 / 代言（多选用逗号分隔）"
          />
        </Field>
        <Field label="月预算">
          <select
            className={inputCls}
            value={form.budget}
            onChange={(e) => set({ budget: e.target.value })}
          >
            <option value="">请选择…</option>
            <option value="lt-5k">5,000 元以内</option>
            <option value="5k-2w">5,000 - 20,000 元</option>
            <option value="2w-10w">20,000 - 100,000 元</option>
            <option value="gt-10w">100,000 元以上</option>
          </select>
        </Field>
        <Field label="联系方式" required className="sm:col-span-2">
          <input
            className={inputCls}
            value={form.contact}
            onChange={(e) => set({ contact: e.target.value })}
            placeholder="姓名 + 手机号 / 邮箱（用于商务回复）"
          />
        </Field>
        <Field label="备注 / 合作背景" className="sm:col-span-2">
          <textarea
            className={inputCls + " min-h-[100px] resize-none"}
            value={form.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="可选：项目背景、计划生成视频条数、首发渠道、上线节点等。"
          />
        </Field>

        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4">
          <a
            href="mailto:bd@aistareco.com"
            className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700"
          >
            <Mail className="h-3.5 w-3.5" /> 紧急合作可直接邮件 bd@aistareco.com
          </a>
          <button type="submit" disabled={!canSubmit} className={CTA_PRIMARY}>
            提交申请
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={"flex flex-col gap-1.5 " + (className ?? "")}>
      <span className="text-xs font-medium text-zinc-600">
        {label}
        {required && <span className="ml-0.5 text-pink-600">*</span>}
      </span>
      {children}
    </label>
  );
}

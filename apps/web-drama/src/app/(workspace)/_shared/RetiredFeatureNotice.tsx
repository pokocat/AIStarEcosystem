"use client";

// v0.60 收敛：本地「孵化 / 形象锻造」下线后的占位提示。
// 路由保留（避免外部书签 404），引导用户去 AiAvatar 创建数字人再回「数字人演员」导入。
// v0.197：文案按 docs/drama-ux-copy-pass.md §2 术语表；按钮组在手机上换行（styles/pages/account.css）。
// 其他页面（如 /cast/[id]/generate）也用它替掉已下线的假功能 —— `feature` 必填不变，其余 prop 都是可选的。

import Link from "next/link";
import { ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/premium";
import { EmptyState } from "@/components/common";
import { AIAVATAR_URL } from "@/api/dap-avatars";

export interface RetiredFeatureNoticeProps {
  /** 已下线的功能名，如「形象生成」「新建数字人演员」 */
  feature: string;
  /** 覆盖默认说明（不传用通用那段） */
  description?: string;
  /** 次要按钮去哪（默认「数字人演员」列表 /cast） */
  backHref?: string;
  backLabel?: string;
  /** 主按钮的外链（默认 AiAvatar 首页；例如某个数字人的造型页深链） */
  aiavatarHref?: string;
  aiavatarLabel?: string;
}

export function RetiredFeatureNotice({
  feature,
  description,
  backHref = "/cast",
  backLabel = "去数字人演员",
  aiavatarHref = AIAVATAR_URL,
  aiavatarLabel = "去 AiAvatar 做数字人",
}: RetiredFeatureNoticeProps) {
  return (
    <div style={{ paddingTop: 48 }}>
      <EmptyState
        icon={<Sparkles size={28} />}
        title={`${feature}已经搬到 AiAvatar`}
        description={
          description ??
          "数字人现在都在 AiAvatar（数字人平台）做：可以照真人复刻，也可以让 AI 生成，造型图和场景图也在那边出。做好之后回「数字人演员」点「从 AiAvatar 导入数字人」，那边改了造型，这里会跟着更新。"
        }
        action={
          <div className="acct-retired-actions">
            <a href={aiavatarHref} target="_blank" rel="noreferrer">
              <Button variant="primary" size="md">
                {aiavatarLabel} <ExternalLink size={12} style={{ flexShrink: 0 }} />
              </Button>
            </a>
            <Link href={backHref}>
              <Button variant="ghost" size="md">{backLabel}</Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}

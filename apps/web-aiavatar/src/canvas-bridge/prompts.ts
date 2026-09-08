// 提示词库的数据源 —— 本仓自己的中文预设。
//
// 上游作为单机工具，从 raw.githubusercontent.com 聚合了七八个第三方社区提示词集
// （Banana Prompt Quicker / Awesome GPT-4o …），配套一整套「源管理」：本地缓存、
// 定时刷新、失败重试、逐源启用开关。放在我们的产品里两头不讨好 ——
// 那些地址在国内基本拉不动，内容也全是英文仓库名，跟这个产品要做的事对不上。
//
// v0.162 把那套机制整个摘掉（约 350 行 + 侧栏的源管理界面），改成读
// `GET /v1/ip-studio/prompt-presets`：装扮 / 表情 / 短动作，后台可维护，内容是中文。
// 少了缓存层不心疼 —— 这个接口读的是内存里的静态目录，本来就不慢。

import { IpStudioApi } from "@/ip/api";

export type Prompt = {
  id: string;
  title: string;
  prompt: string;
  description: string;
  tags: string[];
  /** 分组 id（装扮 / 表情 / 短动作），列表按它分类 */
  sourceId: string;
  category: string;
  // 下面几个是提示词卡片 / 详情弹窗还在读的字段。我们的预设没有这些内容
  // （没有封面图、没有「更新时间」—— 它随版本发布），保留为可选、给空值，
  // 免得为了删几个字段去改那两个展示组件。
  coverUrl?: string;
  preview?: string;
  referenceImageUrls?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type PromptListResponse = {
  items: Prompt[];
  tags: string[];
  categories: string[];
  total: number;
};

export const ALL_PROMPTS_OPTION = "all";

async function allPrompts(): Promise<Prompt[]> {
  const groups = await IpStudioApi.listPromptPresets();
  return groups.flatMap((group) =>
    group.presets.map((preset) => ({
      id: `${group.id}:${preset.id}`,
      title: preset.name,
      prompt: preset.prompt,
      description: group.summary ?? "",
      // 性别 / 时长本来只写在详情里，做成标签用户才能拿它筛
      tags: [
        preset.gender === "female" ? "女生" : preset.gender === "male" ? "男生" : "不分性别",
        ...(preset.durationSec ? [`${preset.durationSec} 秒`] : []),
      ],
      sourceId: group.id,
      category: group.name,
      coverUrl: "",
      preview: "",
      referenceImageUrls: [],
      createdAt: "",
      updatedAt: "",
    })),
  );
}

function matches(item: Prompt, keyword: string, category: string, tags: string[]): boolean {
  if (category !== ALL_PROMPTS_OPTION && item.category !== category) return false;
  if (tags.length && !tags.every((t) => item.tags.includes(t))) return false;
  if (!keyword) return true;
  const hay = `${item.title}\n${item.prompt}\n${item.description}`.toLowerCase();
  return hay.includes(keyword);
}

export async function fetchPrompts({
  keyword = "",
  tag = [],
  category = ALL_PROMPTS_OPTION,
  page = 1,
  pageSize = 20,
}: { keyword?: string; tag?: string[]; category?: string; page?: number; pageSize?: number } = {}): Promise<PromptListResponse> {
  const items = await allPrompts();
  const kw = keyword.trim().toLowerCase();
  const p = Math.max(1, page);
  const size = Math.max(1, Math.min(100, pageSize));

  const filtered = items.filter((i) => matches(i, kw, category, tag));
  // 标签候选按「不含标签筛选」的结果算 —— 否则选了一个标签，其它标签就全消失了
  const forTags = items.filter((i) => matches(i, kw, category, []));

  return {
    items: filtered.slice((p - 1) * size, p * size),
    tags: Array.from(new Set(forTags.flatMap((i) => i.tags))),
    categories: Array.from(new Set(items.map((i) => i.category))),
    total: filtered.length,
  };
}

export function formatPromptDate(_iso?: string, _locale?: string): string {
  // 预设是随版本发布的内容，没有「更新时间」这回事；保留函数是为了不动调用点。
  return "";
}

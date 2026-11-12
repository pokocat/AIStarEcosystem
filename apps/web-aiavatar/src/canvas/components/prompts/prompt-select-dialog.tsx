import { ChevronDown, Search } from "lucide-react";
import { useEffect, useState } from "react";
// 本仓改动（2026-10-27）：错误不走 antd 顶部 message，统一到 Studio 错误出口（用户刚做的操作没做成就弹错误弹窗），成功提示照旧。
import { Button, Empty, Input, Modal, Spin, Tag } from "antd";
import { useLoadMoreOnScroll } from "@/lib/use-load-more-on-scroll";
import { useStudioApp } from "@/ip/studio-errors";
import { useTranslation } from "react-i18next";

import { ALL_PROMPTS_OPTION } from "@/canvas-bridge/prompts";
import { cn } from "@/canvas/lib/utils";
import { PromptCard } from "./prompt-card";
import { usePromptList } from "./use-prompt-list";

export function PromptSelectDialog({ open, onOpenChange, onSelect }: { open: boolean; onOpenChange: (open: boolean) => void; onSelect: (prompt: string) => void }) {
    const { message } = useStudioApp();
    const { t } = useTranslation();
    const [keyword, setKeyword] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState(ALL_PROMPTS_OPTION);
    const { query, items, tags: promptTags, categories: promptCategories } = usePromptList({ keyword, tags: selectedTags, category: selectedCategory, enabled: open });
    const toggleTag = (tag: string) => {
        if (tag === ALL_PROMPTS_OPTION) return setSelectedTags([]);
        setSelectedTags((items) => (items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag]));
    };
    const selectPrompt = (prompt: string) => {
        onSelect(prompt);
        onOpenChange(false);
    };

    useEffect(() => {
        if (query.isError) message.error(query.error instanceof Error ? query.error.message : t("prompts.loadFailed"));
    }, [message, query.error, query.isError, t]);

    const end = useLoadMoreOnScroll(open && query.hasNextPage && !query.isFetching && !query.isError, query.data?.pages.length ?? 0,
        () => void query.fetchNextPage(), JSON.stringify([keyword, selectedTags, selectedCategory]));

    return (
        <Modal title={t("prompts.library")} open={open} onCancel={() => onOpenChange(false)} footer={null} width={880} centered>
            <div className="grid h-[62dvh] min-h-0 gap-5 sm:grid-cols-[200px_minmax(0,1fr)]" data-canvas-no-zoom onWheelCapture={(event) => event.stopPropagation()}>
                <aside className="thin-scrollbar min-h-0 overflow-y-auto border-r border-stone-200 pr-4 dark:border-stone-800">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">{t("prompts.category")}</div>
                    <div className="flex flex-wrap gap-1.5">
                        {promptCategories.map((category) => (
                            <Tag.CheckableTag key={category} checked={selectedCategory === category} className={cn("prompt-filter-tag", selectedCategory === category && "is-active")} onChange={() => setSelectedCategory(category)}>
                                {category === ALL_PROMPTS_OPTION ? t("common.all") : category}
                            </Tag.CheckableTag>
                        ))}
                    </div>
                    <div className="mb-2 mt-5 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">{t("prompts.tags")}</div>
                    <div className="flex flex-wrap gap-1.5">
                        {promptTags.map((tag) => {
                            const active = tag === ALL_PROMPTS_OPTION ? selectedTags.length === 0 : selectedTags.includes(tag);
                            return (
                                <Tag.CheckableTag key={tag} checked={active} className={cn("prompt-filter-tag", active && "is-active")} onChange={() => toggleTag(tag)}>
                                    {tag === ALL_PROMPTS_OPTION ? t("common.all") : tag}
                                </Tag.CheckableTag>
                            );
                        })}
                    </div>
                </aside>
                <section className="flex min-h-0 min-w-0 flex-col">
                    <Input size="large" prefix={<Search className="size-4 text-stone-400" />} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={t("prompts.searchTitle")} />
                    <div className="thin-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto pr-2" data-canvas-no-zoom onWheelCapture={(event) => event.stopPropagation()}>
                        {query.isLoading ? (
                            <div className="flex h-40 items-center justify-center">
                                <Spin />
                            </div>
                        ) : null}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            {items.map((item) => (
                                <PromptCard key={item.id} item={item} onOpen={() => selectPrompt(item.prompt)} onCopy={() => selectPrompt(item.prompt)} compact />
                            ))}
                        </div>
                        {!query.isLoading && items.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("prompts.empty")} className="py-8" /> : null}
                        {query.hasNextPage && <div ref={end} className="scroll-more">
                            {query.isFetchingNextPage ? <Spin size="small"/> : query.isError
                                ? <Button size="small" onClick={() => void query.fetchNextPage()}>{t("prompts.retry")}</Button>
                                : <ChevronDown size={18} aria-hidden/>}
                        </div>}
                    </div>
                </section>
            </div>
        </Modal>
    );
}

import { nanoid } from "nanoid";

export type PromptSource = {
    id: string;
    name: string;
    url: string;
    homepage: string;
    enabled: boolean;
    builtIn: boolean;
};

export const PROMPT_REGISTRY_HOMEPAGE = "https://github.com/yukkcat/image-prompts";
const PROMPT_REGISTRY_SOURCE_BASE = "https://raw.githubusercontent.com/yukkcat/image-prompts/main/dist/sources";

export function createPromptSource(source?: Partial<PromptSource>): PromptSource {
    return {
        id: source?.id?.trim() || nanoid(),
        name: source?.name?.trim() || "",
        url: source?.url?.trim() || "",
        homepage: source?.homepage?.trim() || "",
        enabled: source?.enabled ?? true,
        builtIn: source?.builtIn ?? false,
    };
}

/**
 * 默认远程提示词源 —— **清空**。
 *
 * 上游内置了七八个第三方 GitHub 提示词集，从 raw.githubusercontent.com 拉。
 * 那些地址在国内基本拉不动（用户看到的是一直转圈或空列表），内容也全是英文仓库名，
 * 跟这个产品对不上。提示词库现在读本仓自己的中文预设（见 canvas-bridge/prompts.ts）。
 *
 * 机制保留：配置页里用户仍可以自己加源，只是默认一个都不开。
 */
export const DEFAULT_PROMPT_SOURCES: PromptSource[] = [];

function registrySource(id: string, name: string, homepage: string): PromptSource {
    return { id, name, url: `${PROMPT_REGISTRY_SOURCE_BASE}/${id}.json`, homepage, enabled: true, builtIn: true };
}

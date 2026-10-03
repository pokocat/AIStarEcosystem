package com.aistareco.aep.dto;

import java.util.List;

/**
 * 粘贴的剧本按集切开的结果（v0.198）：TS {@code SplitCanvasScriptResult} 1:1。
 * 规则见 {@code DramaCanvasScriptSplitter}；{@code notes} 是给用户看的切分说明。
 */
public record SplitCanvasScriptResultDto(
        List<Episode> episodes,
        List<String> notes
) {
    /** TS {@code { no: number; title: string; text: string }}。 */
    public record Episode(int no, String title, String text) {
    }
}

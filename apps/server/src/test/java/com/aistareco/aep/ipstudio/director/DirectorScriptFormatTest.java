package com.aistareco.aep.ipstudio.director;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;

/** 写剧本的形式和分批：批量大小、分集标题识别。 */
class DirectorScriptFormatTest {
    @Test void shortEpisodesAreWrittenInLargerBatchesThanLongOnes() {
        assertEquals(3, DirectorService.scriptBatch(90));
        assertEquals(3, DirectorService.scriptBatch(180));
        assertEquals(2, DirectorService.scriptBatch(300));
        assertEquals(1, DirectorService.scriptBatch(600));
    }

    /** 2026-11-05 真模型写了「（第3集 完）」，编号一断，整份剧本认不出分集，只能花钱让模型拆。 */
    @Test void anEpisodeEndNoteIsNotANewEpisode() {
        List<String> script = List.of("# 第1集 凌晨的礼物", "正文", "# 第2集 错误的回声", "正文", "（第2集 完）", "第3集完", "# 第3集 家的陷阱", "正文");
        assertEquals(List.of(0, 2, 6), DirectorPrompts.headingStarts(script));
    }

    @Test void episodeEndNotesAreRemovedFromTheScript() {
        assertEquals("# 第9集 迟到的晨光\n正文第1集完全不一样\n\n# 第10集 回家",
                DirectorPrompts.withoutEpisodeEndNotes("# 第9集 迟到的晨光\n正文第1集完全不一样\n\n（第9集 完）\n# 第10集 回家\n\n第十集完"));
    }

    @Test void aContinuedBatchStartsFromItsOwnEpisodeNumber() {
        assertEquals(List.of(0, 2), DirectorPrompts.headingsFrom(List.of("# 第4集 入口", "正文", "# 第5集 裂缝", "正文", "（第5集 完）"), 4));
        assertEquals(List.of(), DirectorPrompts.headingsFrom(List.of("# 第7集 不对", "正文"), 4));
    }
}

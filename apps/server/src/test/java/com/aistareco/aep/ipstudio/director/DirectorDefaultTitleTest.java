package com.aistareco.aep.ipstudio.director;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/** 没填作品名时按剧本起名：导入的剧本以「第1集 夜班」开头，作品不能叫「第1集 夜班」。 */
class DirectorDefaultTitleTest {
    @Test
    void episodeHeadingsAreSkippedAndTheFirstSentenceNamesTheWork() {
        assertEquals("凌晨三点，快递分拣站", DirectorService.defaultTitle("第1集 夜班\n凌晨三点，快递分拣站。传送带嗡嗡作响。\n\n第2集 打开\n清晨。"));
        assertEquals("下山", DirectorService.defaultTitle("# 【第一集】\n\n下山\n师父说"));
        assertEquals("一个很长很长很长很长很长很长的开头句子没", DirectorService.defaultTitle("一个很长很长很长很长很长很长的开头句子没有标点还在继续写"));
    }

    @Test
    void onlyHeadingsFallBackToUntitled() {
        assertEquals("未命名作品", DirectorService.defaultTitle("第1集\n\n第2集\n"));
        assertTrue(DirectorPrompts.isEpisodeHeading("第十二集：结局"));
        assertFalse(DirectorPrompts.isEpisodeHeading("他说第1集太长了，后面我们再改改这段对白吧，反正时间还多得是呢真的还多得很多得很"));
    }
}

package com.aistareco.aep.ipstudio.execution;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StudioSteeringQuestionsTest {
    @Test void progressAndStatusQuestionsOnlyAsk() {
        for (String text : List.of("做到哪了？", "做到哪了", "还要多久", "还要再等多久？", "进度怎么样", "第几步了", "花了多少积分？",
                "第一段好了没", "现在什么状态", "生成到第几步了？", "这个人物叫什么名字？"))
            assertTrue(StudioSteeringQuestions.onlyAsks(text), text);
    }

    @Test void changesControlsAndPlainStatementsKeepTheStop() {
        for (String text : List.of("第二段换成夜景", "能不能把第二段改成横屏？", "先停一下", "暂停", "取消吧", "算了", "再出一张图吗",
                "第三镜太暗了吗", "能不能快点？", "不要第二步", "只保留第一步", "好的", "", "   ",
                "做到哪了？我想知道现在的进度和每一步具体都做了些什么内容以及大概还要多长时间才能全部做完呢"))
            assertFalse(StudioSteeringQuestions.onlyAsks(text), text);
    }
}

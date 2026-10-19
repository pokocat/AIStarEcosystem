package com.aistareco.aep.ipstudio.dialogue;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class StudioStopIntentTest {
    @Test void wholeStopInstructionsStop() {
        for (String text : List.of("停", "先停", "先停！", "停止吧", "停下来", "请停止", "好，先停", "不做了", "别做了。", "取消", "都停了"))
            assertEquals(StudioStopIntent.Kind.STOP, StudioStopIntent.of(text), text);
    }
    @Test void wholePauseInstructionsPause() {
        for (String text : List.of("暂停", "先暂停一下", "停一下", "先停一下吧", "暂停后续"))
            assertEquals(StudioStopIntent.Kind.PAUSE, StudioStopIntent.of(text), text);
    }
    /** Substring matching would read these as stops; they are questions, negations or change requests. */
    @Test void everythingElseIsAnOrdinaryMessage() {
        for (String text : List.of("不要停", "别停", "要停吗？", "停吗", "先停一下第 3 段，换个人物", "停止第二段，其它照做", "可以开始", "第3段换个人物", "", "   "))
            assertNull(StudioStopIntent.of(text), text);
    }
}

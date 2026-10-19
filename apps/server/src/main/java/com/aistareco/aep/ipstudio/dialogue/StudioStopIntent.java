package com.aistareco.aep.ipstudio.dialogue;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * A typed stop or pause (plan §制作中输入与转向: 明确的停止指令和停止按钮走优先控制入口，不等待下一次模型推理). Only a message
 * that is nothing but such an instruction counts: the whole text, after punctuation, a polite opener and trailing
 * particles are removed, must be one of the phrases below. So 「先停」「停止吧」「暂停一下」 are controls, while 「不要停」
 * 「要停吗？」「先停一下第 3 段，换个人物」 stay ordinary messages (substring matching would misread 「不要停」 as a stop).
 */
public final class StudioStopIntent {
    private StudioStopIntent() {}

    public enum Kind { STOP, PAUSE }

    private static final Set<String> STOP = Set.of("停", "停止", "停下", "停下来", "停掉", "先停", "先停下", "先停下来", "先停止",
            "停止制作", "停止生成", "全部停止", "都停下", "都停", "别做", "先别做", "不做", "不要做", "不用做", "取消", "取消制作", "结束制作");
    private static final Set<String> PAUSE = Set.of("暂停", "先暂停", "暂停一下", "先暂停一下", "暂停制作", "暂停生成", "停一下", "先停一下", "暂停后续");
    private static final Pattern QUESTION = Pattern.compile("[?？吗么]");
    private static final Pattern SEPARATORS = Pattern.compile("[\\s,，。.!！、;；~～…]+");
    private static final Pattern OPENER = Pattern.compile("^(?:请|麻烦你|麻烦|帮我|你|好的?|行|嗯)+");
    /** Trailing particles are dropped before the lookup, so 「不做了」 is looked up as 「不做」 and 「停吧」 as 「停」. */
    private static final Pattern PARTICLES = Pattern.compile("[吧啊呀啦哈哦嘛了]+$");

    /** STOP / PAUSE when the whole message is a stop or pause instruction; null for anything else. */
    public static Kind of(String text) {
        if (text == null) return null;
        String said = text.strip();
        if (said.isEmpty() || said.length() > 24 || QUESTION.matcher(said).find()) return null;
        String core = SEPARATORS.matcher(said).replaceAll("");
        core = PARTICLES.matcher(OPENER.matcher(core).replaceAll("")).replaceAll("");
        if (STOP.contains(core)) return Kind.STOP;
        if (PAUSE.contains(core)) return Kind.PAUSE;
        return null;
    }
}

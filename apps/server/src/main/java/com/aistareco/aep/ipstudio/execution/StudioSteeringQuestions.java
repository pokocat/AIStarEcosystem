package com.aistareco.aep.ipstudio.execution;

import java.util.List;

/**
 * A message sent while a plan execution runs that only asks something (「做到哪了？」「还要多久」「花了多少积分」) does not
 * stop the execution: the dialogue answers it and the next steps keep going. Everything else still stops it before the
 * next submission (D03). Deliberately narrow, like {@link StudioNaturalApprovals}: a miss only means the old behaviour
 * (stop and wait for the user), never a change request that runs on unseen.
 */
final class StudioSteeringQuestions {
    private StudioSteeringQuestions() {}

    /** A question has one of these. */
    private static final List<String> QUESTION = List.of("？", "?", "吗", "呢", "多久", "多少", "几步", "第几", "什么时候", "啥时候",
            "怎么样", "到哪", "进度", "好了没", "完了没", "好没好", "完成没", "做完没", "还要", "还需", "还得", "在做什么", "在干嘛", "状态");
    /** Asking for a change, a different result or control over the run; any one of these keeps the stop. */
    private static final List<String> CHANGE = List.of("改", "换", "不要", "别", "去掉", "删", "加", "减", "重做", "重新", "重来", "调",
            "停", "取消", "继续", "算了", "能不能", "可不可以", "可以把", "帮我", "把", "再做", "再出", "再来", "再生成", "再画", "再拍",
            "做成", "出一", "来一", "要求", "应该", "不对", "不好", "太", "替换", "用这", "用那", "保留", "只要", "快点", "加快");
    private static final int MAX_LENGTH = 40;

    /** True when the message only asks something and names no change. */
    static boolean onlyAsks(String text) {
        String said = text == null ? "" : text.strip();
        if (said.isEmpty() || said.length() > MAX_LENGTH) return false;
        for (String word : CHANGE) if (said.contains(word)) return false;
        return QUESTION.stream().anyMatch(said::contains);
    }
}

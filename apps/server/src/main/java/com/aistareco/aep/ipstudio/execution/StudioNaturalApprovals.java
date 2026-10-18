package com.aistareco.aep.ipstudio.execution;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Server-side guard on an approval given in words (D04). The model decides that a message is an approval; the server
 * refuses the clear non-approvals and every number the user did not say: a question or hesitation never approves, the
 * cap can only go above the card's when the user named that higher number, and never below the quote. Refusals are
 * safe: the card stays pending and the button keeps working.
 */
final class StudioNaturalApprovals {
    private StudioNaturalApprovals() {}
    /** Plain substrings of a question or hesitation; matching one only ever refuses (never approves). */
    private static final List<String> HESITATION = List.of("？", "?", "吗", "先别", "别开始", "不要开始", "不开始", "暂不", "暂时不",
            "不确认", "不同意", "等一下", "等等", "再想想", "考虑一下", "再看看", "算了", "不用了", "不行");
    private static final Pattern DIGIT_GROUPING = Pattern.compile("(?<=\\d)[,，\\s](?=\\d)");

    static void require(String text, JsonNode card, long budgetCap, long autoFixCap) {
        String said = text == null ? "" : text.strip();
        if (said.isEmpty()) throw ambiguous();
        for (String h : HESITATION) if (said.contains(h)) throw ambiguous();
        long proposed = card.path("budgetCap").asLong(), proposedFix = card.path("autoFixCap").asLong(0), quoted = card.path("quotedCost").asLong(0);
        if (budgetCap < 0 || autoFixCap < 0 || autoFixCap > budgetCap)
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "重做额度不能超过总上限");
        if (budgetCap < quoted)
            throw StudioPlanExecutionService.budgetExceeded(card.path("stage").asText(), 0, 0, quoted, budgetCap);
        if (budgetCap > proposed && !mentions(said, budgetCap))
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "上限比确认卡上的 " + proposed + " 积分高，需要你在消息里说出新的上限，或在卡片上修改");
        if (autoFixCap > proposedFix && !mentions(said, autoFixCap))
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "重做额度比确认卡上的高，需要你在消息里说出这个数，或在卡片上修改");
    }

    /** The user wrote this exact number (digit grouping like 1,500 allowed; 15000 does not mention 1500). */
    static boolean mentions(String text, long number) {
        String plain = DIGIT_GROUPING.matcher(text).replaceAll("");
        return Pattern.compile("(?<!\\d)" + number + "(?!\\d)").matcher(plain).find();
    }

    private static BusinessException ambiguous() {
        return new BusinessException(HttpStatus.CONFLICT, "STUDIO_APPROVAL_AMBIGUOUS",
                "这句话不是明确的确认（像是在提问或还想再看看）。确认的话请直接说「按这个开始」，或点确认卡上的按钮");
    }
}

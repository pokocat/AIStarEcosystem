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
    /** Plain substrings of a question, hesitation, deferral or edit request; matching one only ever refuses (never approves). */
    private static final List<String> HESITATION = List.of("？", "?", "吗", "先别", "别开始", "不要开始", "不开始", "暂不", "暂时不",
            "不确认", "不同意", "等一下", "等等", "再想想", "考虑一下", "再看看", "算了", "不用了", "不行",
            "等我通知", "等通知", "等我说", "再通知", "等我确认", "稍后", "以后再", "先修改", "只修改", "先改", "改一下", "改成",
            "不生成", "别生成", "不要生成", "先不", "暂停", "停一下", "不急", "等一等", "晚点", "过会");
    /** An approval must contain one of these; a message that names neither approval nor hesitation is not an approval. */
    private static final List<String> APPROVAL = List.of("确认", "开始", "按这个", "按此", "按你", "按推荐", "按方案", "就这样", "就这个", "同意",
            "批准", "可以做", "可以开始", "做吧", "开工", "执行", "通过", "没问题", "就按", "照这个", "ok", "OK", "Ok", "好的", "行，", "行。");
    /**
     * A reply made only of short affirmatives — 「可以」「好」「行」「嗯，可以」「好吧」 — is how people actually answer a card
     * (the card itself says 「直接回复「可以」也行」). Each piece between punctuation, after its trailing particles, must be one
     * of these; so 「可以把第 2 段换成横屏」, 「行不行」 and 「不可以」 are not approvals (questions and edits are refused above anyway).
     */
    private static final java.util.Set<String> SHORT_AFFIRMATIVES = java.util.Set.of("可以", "可", "好", "好好", "行", "行行", "嗯", "嗯嗯",
            "对", "对的", "是", "是的", "没错", "可以可以", "好嘞", "妥");
    private static final Pattern PIECE_SEPARATORS = Pattern.compile("[\\s,，。.!！、;；~～…]+");
    private static final Pattern TRAILING_PARTICLES = Pattern.compile("[吧啊呀啦哈哦呢嘛了]+$");
    private static final Pattern DIGIT_GROUPING = Pattern.compile("(?<=\\d)[,，\\s](?=\\d)");
    /** Numbers the user tied to a budget: 「上限 280」「预算280积分」「不超过 1,500」「280 积分」. */
    private static final Pattern BUDGET_NUMBER = Pattern.compile(
            "(?:上限|预算|最多|不超过|控制在|额度|花)[^\\d]{0,6}(\\d+)|(\\d+)\\s*(?:积分|分钱|个积分)");

    static void require(String text, JsonNode card, long budgetCap, long autoFixCap) {
        String said = text == null ? "" : text.strip();
        if (said.isEmpty()) throw ambiguous();
        for (String h : HESITATION) if (said.contains(h)) throw ambiguous();
        if (APPROVAL.stream().noneMatch(said::contains) && !onlyAffirmatives(said)) throw ambiguous();
        long proposed = card.path("budgetCap").asLong(), proposedFix = card.path("autoFixCap").asLong(0), quoted = card.path("quotedCost").asLong(0);
        if (budgetCap < 0 || autoFixCap < 0 || autoFixCap > budgetCap)
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "重做额度不能超过总上限");
        // The user's own numbers win: whenever the message names a budget figure, the effective cap must be one of them —
        // the model may neither raise nor "round" it (R2-02), and a cap the card never proposed needs the user's number.
        // Each named amount binds its own cap (R3-01 / R4-01): a redo figure can never stand in for the total, nor the
        // reverse — even when both figures are the same number; budgetNumbers() already excludes 重做/修正/重试 amounts, so
        // the two sets are role-bound and must not be subtracted from each other. These checks run before the quote check
        // (R4-02): a number the user never said is an input error (400) whatever its relation to the quote.
        java.util.Set<Long> saidFix = redoNumbers(said), saidTotal = budgetNumbers(said);
        if (!saidFix.isEmpty() && !saidFix.contains(autoFixCap))
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "你说的重做额度是 " + saidFix.iterator().next() + " 积分，确认时只能用这个数；要改请直接说新的额度，或在卡片上修改");
        if (!saidTotal.isEmpty() && !saidTotal.contains(budgetCap))
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "你说的上限是 " + saidTotal.iterator().next() + " 积分，确认时只能用这个数；要改请直接说新的上限，或在卡片上修改");
        if (budgetCap < quoted)
            throw StudioPlanExecutionService.budgetExceeded(card.path("stage").asText(), 0, 0, quoted, budgetCap);
        if (budgetCap != proposed && !mentions(said, budgetCap))
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "上限与确认卡上的 " + proposed + " 积分不同，需要你在消息里说出新的上限，或在卡片上修改");
        if (autoFixCap != proposedFix && !mentions(said, autoFixCap))
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "重做额度与确认卡上的不同，需要你在消息里说出这个数，或在卡片上修改");
    }

    /** True when every piece of the reply is a short affirmative (see {@link #SHORT_AFFIRMATIVES}). */
    static boolean onlyAffirmatives(String text) {
        String[] pieces = PIECE_SEPARATORS.split(text.strip());
        if (pieces.length == 0) return false;
        for (String piece : pieces) {
            String core = TRAILING_PARTICLES.matcher(piece).replaceAll("");
            if (piece.isEmpty()) continue;
            if (!SHORT_AFFIRMATIVES.contains(core)) return false;
        }
        return java.util.Arrays.stream(pieces).anyMatch(p -> !p.isEmpty());
    }

    /** The user wrote this exact number (digit grouping like 1,500 allowed; 15000 does not mention 1500). */
    static boolean mentions(String text, long number) {
        String plain = DIGIT_GROUPING.matcher(text).replaceAll("");
        return Pattern.compile("(?<!\\d)" + number + "(?!\\d)").matcher(plain).find();
    }

    private static final Pattern REDO_NUMBER = Pattern.compile("(?:重做|修正|重试)[^\\d]{0,8}(\\d+)");

    /** Budget figures the user named, after digit grouping is removed (redo figures are returned separately). */
    static java.util.Set<Long> budgetNumbers(String text) {
        String plain = DIGIT_GROUPING.matcher(text).replaceAll("");
        java.util.Set<Long> out = new java.util.LinkedHashSet<>();
        var m = BUDGET_NUMBER.matcher(plain);
        while (m.find()) {
            // 「重做上限 0 积分」 matches the generic pattern too; the words right before the amount decide its role.
            String before = plain.substring(Math.max(0, m.start() - 8), m.start());
            if (before.contains("重做") || before.contains("修正") || before.contains("重试")) continue;
            String g = m.group(1) != null ? m.group(1) : m.group(2);
            try { out.add(Long.parseLong(g)); } catch (NumberFormatException ignored) { /* too long to be a budget */ }
        }
        return out;
    }

    /** Redo / auto-fix figures the user named: 「重做上限 0」「修正额度 100 积分」. */
    static java.util.Set<Long> redoNumbers(String text) {
        String plain = DIGIT_GROUPING.matcher(text).replaceAll("");
        java.util.Set<Long> out = new java.util.LinkedHashSet<>();
        var m = REDO_NUMBER.matcher(plain);
        while (m.find()) { try { out.add(Long.parseLong(m.group(1))); } catch (NumberFormatException ignored) { /* ignore */ } }
        return out;
    }

    private static BusinessException ambiguous() {
        return new BusinessException(HttpStatus.CONFLICT, "STUDIO_APPROVAL_AMBIGUOUS",
                "这句话不是明确的确认（像是在提问、还想再看看，或要先改方案）。确认的话请直接说「按这个开始」，或点确认卡上的按钮");
    }
}

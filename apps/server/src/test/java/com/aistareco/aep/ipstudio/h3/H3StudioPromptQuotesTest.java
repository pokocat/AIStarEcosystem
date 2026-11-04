package com.aistareco.aep.ipstudio.h3;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** 2026-11-04 线上手表脚本：模型把台词写成「博主说：“……”」，只认「」时一句也认不出，台词改由改写模型写，原话可能被改。 */
class H3StudioPromptQuotesTest {
    private static final String SCRIPT = """
            四、镜头时间轴：
            第1镜（0–3 秒）：画面：博主面带微笑看着镜头；音效：无；BGM：轻快节奏起；博主说：“颜值这块，这块高驰真的绝。”
            第2镜（3–8 秒）：画面：博主比划“看这里”的手势；BGM：持续；博主说：“你看这表带，透气又舒服。”
            第3镜（8–15 秒）这一镜的作用：下单
            博主说：「点下面链接直接拍。」
            """;

    @Test
    void curlyQuotedLinesAreRecognisedSoTheCodeFillsTheOriginalWords() {
        var built = H3StudioPrompt.build(SCRIPT, 15, new VideoSettings("t2v", null, null, null, null, null, null), null);
        var source = built.request().source();
        assertThat(source.lines()).extracting(H3PromptRewrite.Line::text)
                .containsExactly("颜值这块，这块高驰真的绝。", "你看这表带，透气又舒服。", "点下面链接直接拍。");
        assertThat(source.lines()).extracting(H3PromptRewrite.Line::speaker).containsOnly("博主");
        assertThat(built.request().shots()).isEqualTo(3);
    }

    @Test
    void halfWidthShotHeadsAndSpeechFromSonnetAreRecognised() {
        String script = "第1镜(0–3 秒)这一镜的作用:痛点截停\n表演:晓晴(图2)皱眉。\n晓晴说:「出门老掏手机看步数?」\n第2镜(3–15 秒)这一镜的作用:下单\n晓晴说:「点下方链接看看。」\n";
        var built = H3StudioPrompt.build(script, 15, new VideoSettings("t2v", null, null, null, null, null, null), null);
        assertThat(built.request().source().lines()).extracting(H3PromptRewrite.Line::text).containsExactly("出门老掏手机看步数?", "点下方链接看看。");
        assertThat(built.request().shots()).isEqualTo(2);
    }

    @Test
    void quotesInsideADescriptionAreLeftAlone() {
        assertThat(H3PromptRewrite.normalizeSpeechQuotes("比划“看这里”的手势；博主说：“好”"))
                .isEqualTo("比划“看这里”的手势；博主说：「好」");
    }
}

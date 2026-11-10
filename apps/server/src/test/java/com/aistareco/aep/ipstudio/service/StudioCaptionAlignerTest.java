package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Caption;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.KnownClip;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.KnownLine;
import com.aistareco.aep.ipstudio.service.StudioCaptionAligner.Segment;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** 成片自动字幕的排版和对时（2026-11-07）。 */
class StudioCaptionAlignerTest {
    private static KnownClip clip(double planned, KnownLine... lines) { return new KnownClip(planned, List.of(lines)); }

    @Test void linesBreakAtPunctuationAndDropTrailingCommasButKeepQuestionMarks() {
        assertEquals(List.of("你好，世界", "今天天气怎么样？"), StudioCaptionAligner.screens("「你好，世界。今天天气怎么样？」", 10));
        assertEquals(List.of("价格是3.5元"), StudioCaptionAligner.screens("价格是3.5元。", 15));
        assertEquals(List.of("一二三四五", "六七八"), StudioCaptionAligner.screens("一二三四五六七八", 5), "太长的硬切");
        assertEquals(List.of(), StudioCaptionAligner.screens("  。。", 5));
    }

    @Test void withoutRecognitionTheTimesComeFromTheShotsAndFollowTheRealClipLength() {
        var result = StudioCaptionAligner.fromKnown(List.of(
                clip(10, new KnownLine("第一句话", 2.0, 4.0)),
                clip(10, new KnownLine("第二句话", 0.0, 5.0))), List.of(5.0, 10.0), null, 15);
        assertFalse(result.recognized(), "没有识别结果，只能算估算");
        assertEquals(2, result.captions().size());
        assertEquals("第一句话", result.captions().get(0).text());
        assertEquals(1.0, result.captions().get(0).start(), 0.01, "片段只有计划的一半长，时间也按比例缩短");
        assertEquals(2.0, result.captions().get(0).end(), 0.01);
        assertEquals(5.0, result.captions().get(1).start(), 0.01, "第二段从第一段的实际结束开始算");
        assertEquals(10.0, result.captions().get(1).end(), 0.01);
    }

    @Test void recognitionMovesTheTimesButTheWordsStayTheScript() {
        // 识别结果错了一个字（「幸」→「兴」）且比计划晚了 2 秒。
        var result = StudioCaptionAligner.fromKnown(List.of(clip(8, new KnownLine("我很高兴认识你。你叫什么名字？", 0.0, 3.0))), List.of(8.0),
                List.of(new Segment(2.0, 4.0, "我很高幸认识你"), new Segment(4.5, 6.5, "你叫什么名字")), 15);
        assertTrue(result.recognized());
        assertEquals(List.of("我很高兴认识你", "你叫什么名字？"), result.captions().stream().map(Caption::text).toList());
        assertEquals(2.0, result.captions().get(0).start(), 0.25);
        assertEquals(4.5, result.captions().get(1).start(), 0.25);
        assertEquals(6.5, result.captions().get(1).end(), 0.4);
    }

    @Test void whenLittleMatchesTheEstimateIsKeptAndMarkedAsEstimated() {
        var result = StudioCaptionAligner.fromKnown(List.of(clip(6, new KnownLine("这是剧本里的台词", 1.0, 3.0))), List.of(6.0),
                List.of(new Segment(0.0, 6.0, "abcdefg 完全不相关")), 15);
        assertFalse(result.recognized());
        assertEquals(1.0, result.captions().get(0).start(), 0.01);
    }

    @Test void clipsWithoutLinesDoNotCountAgainstRecognition() {
        var result = StudioCaptionAligner.fromKnown(List.of(clip(5), clip(5, new KnownLine("只有这一句", 0.0, 5.0))), List.of(5.0, 5.0),
                List.of(new Segment(6.0, 8.0, "只有这一句")), 15);
        assertTrue(result.recognized());
        assertEquals(6.0, result.captions().get(0).start(), 0.2);
    }

    @Test void captionsNeverOverlapAndStayInsideTheVideo() {
        var result = StudioCaptionAligner.fromKnown(List.of(clip(2,
                new KnownLine("一句很长很长很长很长很长的台词，再来一句很长很长很长的台词", 0.0, 2.0),
                new KnownLine("又一句", 1.5, 2.0))), List.of(2.0), null, 8);
        double last = 0;
        for (Caption c : result.captions()) {
            assertTrue(c.start() >= last - 0.001, "不重叠");
            assertTrue(c.end() > c.start(), "时长为正");
            assertTrue(c.end() <= 2.0 + 0.001, "不超出成片");
            last = c.end();
        }
    }

    @Test void recognizedTextDropsTheWhisperHallucinations() {
        var captions = StudioCaptionAligner.fromHeard(List.of(new Segment(0, 2, "请不吝点赞订阅转发打赏支持"), new Segment(3, 5, "今天来聊聊新品")), 15, 10);
        assertEquals(List.of("今天来聊聊新品"), captions.stream().map(Caption::text).toList());
        assertEquals(3.0, captions.get(0).start(), 0.01);
    }

    @Test void segmentsShrinkToWhereThereIsSoundAndOnesInsideSilenceAreDropped() {
        // Whisper 把起点粘在 0 秒；其实前 1.5 秒没声音。第二段整个在静音里，是幻听。
        var fitted = StudioCaptionAligner.fitToVoice(List.of(
                new Segment(0, 6, "今天天气不错", List.of(new Segment(0, 3, "今天"), new Segment(3, 6, "天气不错"))),
                new Segment(7.2, 7.8, "请不吝点赞")), List.of(new double[]{0, 1.5}, new double[]{5, 8}));
        assertEquals(1, fitted.size());
        assertEquals(1.5, fitted.get(0).start(), 0.001);
        assertEquals(5.0, fitted.get(0).end(), 0.001);
        assertEquals(1.5, fitted.get(0).words().get(0).start(), 0.001, "逐词时间跟着一起收缩");
        assertEquals(3.25, fitted.get(0).words().get(1).start(), 0.001);
    }

    @Test void wordTimesPlaceScreensBetterThanCountingCharacters() {
        // 同一段里两句话，第二句前面停顿了很久：按字数平分会早很多，按逐词时间才对。
        var captions = StudioCaptionAligner.fromHeard(List.of(new Segment(0, 10, "你好。后面这句话晚很多。",
                List.of(new Segment(0, 1, "你好"), new Segment(8, 10, "后面这句话晚很多")))), 15, 10);
        assertEquals(List.of("你好", "后面这句话晚很多"), captions.stream().map(Caption::text).toList());
        assertEquals(8.0, captions.get(1).start(), 0.2);
    }

    @Test void silenceLogsAreReadIntoIntervals() {
        var out = new java.util.ArrayList<double[]>();
        StudioCaptionService.parseSilences("[silencedetect @ 0x1] silence_start: -0.01\n[silencedetect @ 0x1] silence_end: 1.52 | silence_duration: 1.53\n[silencedetect @ 0x1] silence_start: 4.5\n", out);
        assertEquals(1, out.size(), "只有开始没有结束的不算");
        assertEquals(0.0, out.get(0)[0]);
        assertEquals(1.52, out.get(0)[1]);
    }

    @Test void segmentsMarkedAsNoSpeechAreDroppedAndAResultWithoutTimesIsRejected() throws Exception {
        var mapper = new ObjectMapper();
        var segments = StudioTranscriber.parse(mapper.readTree("{\"segments\":[{\"start\":0,\"end\":1,\"text\":\"幻听\",\"no_speech_prob\":0.9},{\"start\":1,\"end\":2,\"text\":\" 真话 \",\"no_speech_prob\":0.1}]}"));
        assertEquals(List.of(new Segment(1, 2, "真话")), segments);
        assertTrue(StudioTranscriber.parse(mapper.readTree("{\"text\":\"\"}")).isEmpty(), "确实没听到东西");
        assertThrows(IllegalArgumentException.class, () -> StudioTranscriber.parse(mapper.readTree("{\"text\":\"只有文字没有时间\"}")));
    }
}

package com.aistareco.aep.ipstudio.history;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class StudioAccountHistoryTest {
    private final ObjectMapper om = new ObjectMapper();

    private IpRunDto run(String status, long cost, ObjectNode output) {
        return new IpRunDto("IPR-1", "P1", "n1", "studio-image", status, "done", 100, cost, null, null,
                om.createObjectNode(), output, "2026-11-09T01:00:00Z", null);
    }

    private ObjectNode breakdown(long spentWallet, long spentScoped, long pending, long released) {
        ObjectNode out = om.createObjectNode();
        ObjectNode b = out.putObject("billingBreakdown");
        b.putObject("spent").put("scopedCredits", spentScoped).put("walletCredits", spentWallet);
        b.putObject("pending").put("scopedCredits", 0).put("walletCredits", pending);
        b.putObject("released").put("scopedCredits", 0).put("walletCredits", released);
        return out;
    }

    @Test
    void creditsReadTheBreakdownAndSeparateGrants() {
        var c = StudioTaskHistoryService.credits(run("done", 200, breakdown(120, 80, 0, 40)));
        assertThat(c.spent()).isEqualTo(200);
        assertThat(c.scopedSpent()).isEqualTo(80);
        assertThat(c.pending()).isZero();
        assertThat(c.released()).isEqualTo(40);
    }

    @Test
    void videoCostAboveTheBreakdownIsThePromptRewriteAndCountsAsSpent() {
        var c = StudioTaskHistoryService.credits(run("done", 130, breakdown(120, 0, 0, 0)));
        assertThat(c.spent()).isEqualTo(130);
    }

    @Test
    void runsWithoutABreakdownFallBackToCostByStatus() {
        assertThat(StudioTaskHistoryService.credits(run("running", 48, om.createObjectNode())).pending()).isEqualTo(48);
        assertThat(StudioTaskHistoryService.credits(run("done", 48, om.createObjectNode())).spent()).isEqualTo(48);
    }

    @Test
    void digitalHumanJobsUseTheirRecordedBreakdownEvenWhenFailed() {
        // 文本成功、媒体失败：文本费用照扣，breakdown 里有；不能因为状态是 failed 就显示 0（Codex 评审 2026-11-09）
        var b = breakdown(5, 0, 0, 40).path("billingBreakdown");
        var c = StudioTaskHistoryService.credits(b, 5, "failed");
        assertThat(c.spent()).isEqualTo(5);
        assertThat(c.released()).isEqualTo(40);
        assertThat(StudioTaskHistoryService.credits(null, 0, "failed").spent()).isZero();
    }

    @Test
    void kindsMapToTheFilterTypes() {
        assertThat(StudioTaskHistoryService.typeOf("generate")).isEqualTo("image");
        assertThat(StudioTaskHistoryService.typeOf("studio-lip-sync")).isEqualTo("video");
        assertThat(StudioTaskHistoryService.typeOf("studio-audio")).isEqualTo("audio");
        assertThat(StudioTaskHistoryService.typeOf("studio-dialogue")).isEqualTo("dialogue");
        assertThat(StudioTaskHistoryService.typeOf("studio-director")).isEqualTo("text");
        assertThat(StudioTaskHistoryService.title("studio-storyboard", true)).isEqualTo("导演台 · 写分镜脚本");
    }

    @Test
    void storageCategoriesFromBothRecordersMergeIntoOneKey() {
        assertThat(StudioStorageService.keyOf("视频生成")).isEqualTo("video");
        assertThat(StudioStorageService.keyOf("成片")).isEqualTo("video");
        assertThat(StudioStorageService.keyOf("画布附件")).isEqualTo("upload");
        assertThat(StudioStorageService.keyOf("上传的素材")).isEqualTo("upload");
        assertThat(StudioStorageService.keyOf("随便什么")).isEqualTo("other");
    }

    @Test
    void backfillClassifiesHistoricalFilesLikeTheWriter() {
        assertThat(StudioStorageBackfill.categoryOf("ipstudio_gen/u1/a.jpg", "")).isEqualTo("生成的图片");
        assertThat(StudioStorageBackfill.categoryOf("ipstudio_gen/u1/a.bin", "video/mp4")).isEqualTo("生成的视频");
        assertThat(StudioStorageBackfill.categoryOf("ipstudio_gen/u1/a.wav", "")).isEqualTo("声音");
        assertThat(StudioStorageBackfill.categoryOf("ipstudio_source/u1/a.png", "image/png")).isEqualTo("上传的素材");
        assertThat(StudioStorageBackfill.categoryOf("material-videos/j/video.mp4", "video/mp4")).isNull();
        assertThat(StudioStorageBackfill.categoryOf("ipstudio_demo/x.png", "image/png")).isNull();
    }

    @Test
    void onlyStudioGeneratedAndUploadedFilesAreRecordedByFileStorage() throws Exception {
        Method m = FileStorageService.class.getDeclaredMethod("studioUsageCategory", String.class, String.class);
        m.setAccessible(true);
        assertThat(m.invoke(null, "ipstudio/gen", "image/jpeg")).isEqualTo("生成的图片");
        assertThat(m.invoke(null, "ipstudio/gen", "audio/wav")).isEqualTo("声音");
        assertThat(m.invoke(null, "ipstudio/source", "video/mp4")).isEqualTo("上传的素材");
        assertThat(m.invoke(null, "ipstudio/demo", "image/png")).isNull();
        assertThat(m.invoke(null, "dap/avatar", "image/png")).isNull();
    }
}

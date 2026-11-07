package com.aistareco.aep.service.ai;

import com.aistareco.aep.service.GenerationSubmissionFailure;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

/** These sentences are what a customer reads, so the wording is the behaviour under test. The bodies were seen in production. */
class PublicModelErrorReadabilityTest {
    @ParameterizedTest @ValueSource(strings = {
            "{\"error\":{\"message\":\"resource not found\"}}",
            "{\"error\":{\"message\":\"map[code:invalid_request details:map[violations:[map[location:[body voice]]]]\"}}",
            "{\"message\":\"视频请求未完成，请检查素材和参数，或稍后使用新幂等键重试。Video request failed; check media and parameters, or retry later with a new idempotency key.\"}",
            "{\"error\":{\"message\":\"return_last_frame is not supported by model seedance-2.5\"}}",
            // 2026-11-07 线上原话：模型在聊天；厂商接口的说法；什么也没说明的中文。
            "{\"error\":{\"message\":\"我目前无法在此对话中直接生成图片，但可以帮你进一步整理和强化这组分镜提示词\"}}",
            "{\"error\":{\"message\":\"当前生图模式不接受参考图或蒙版，请使用图片编辑接口\",\"code\":\"unexpected_image_input\"}}",
            "{\"message\":\"任务执行异常\"}",
            "{\"error\":{\"message\":\"I'm sorry, I cannot generate this image.\"}}",
    })
    void wordsAboutTheSuppliersInternalsNeverReachACustomer(String body) {
        assertEquals("我们的说明", ProviderErrorMessage.message(body, "我们的说明"));
        assertNotNull(ProviderErrorMessage.diagnosticReason(body), "the original must stay available for classification and logs");
    }

    @Test void aChineseReasonTheCustomerCanActOnIsKept() {
        assertEquals("参考图尺寸过小，请更换", ProviderErrorMessage.message("{\"message\":\"参考图尺寸过小，请更换\"}", "我们的说明"));
    }

    @Test void aBareSupplierCodeIsNotAReason() {
        assertNull(PublicModelErrorPolicy.upstream("InternalServiceError"));
        assertEquals("我们的说明", ProviderErrorMessage.message("{\"message\":\"internal_server_error\"}", "我们的说明"));
    }

    @Test void savedRecordsOfAModelChattingOrSupplierLogicReadAsARetryAndKeepTheirLookupNumber() {
        assertEquals(PublicModelErrorPolicy.UNREADABLE + " · 追查号 ABCDEF234567",
                PublicModelErrorPolicy.stored("图片生成服务返回错误：我目前无法在此对话中直接生成图片，但可以帮你整理 · 追查号 ABCDEF234567", "STUDIO_IMAGE_PROVIDER_FAILED"));
        assertEquals(PublicModelErrorPolicy.UNREADABLE,
                PublicModelErrorPolicy.stored("当前生图模式不接受参考图或蒙版，请使用图片编辑接口", "DAP_MODEL_HTTP_400"));
        assertEquals(PublicModelErrorPolicy.UNREADABLE,
                PublicModelErrorPolicy.stored("VIDEO_MIRROR_FAILED：视频生成好了，但没能存进我方存储（oss down）", null));
        assertEquals(PublicModelErrorPolicy.UNAVAILABLE,
                PublicModelErrorPolicy.stored("生成服务暂时不可用，请稍后再试或联系平台处理。", "STUDIO_VIDEO_FAILED"));
    }

    @Test void englishReasonsTheCustomerCanActOnAreTranslated() {
        assertEquals("参考视频要 2–15 秒，请调整后再试",
                ProviderErrorMessage.message("{\"message\":\"reference video duration must be within 2..15 seconds\"}", "我们的说明"));
        assertTrue(ProviderErrorMessage.message("{\"message\":\"The request failed because the input image 'content[1]' may contain real person.\"}", "我们的说明").contains("包含真人"));
        assertTrue(ProviderErrorMessage.message("{\"message\":\"model x has been retired; see https://vendor.example/models\"}", "我们的说明").contains("下架"));
    }

    @Test void aPlainEnglishReasonNeverStandsAloneOurSentenceComesFirst() {
        String message = ProviderErrorMessage.message("{\"message\":\"size must be one of 1024x1024\"}", "我们的说明");
        assertTrue(message.startsWith("我们的说明"), message);
        String upload = ProviderErrorMessage.append("{\"message\":\"image resolution too small\"}", "图1上传失败，请检查素材后再试");
        assertTrue(upload.startsWith("图1上传失败"), upload);
    }

    @Test void oldRecordsAreRewordedAndKeepTheirLookupNumber() {
        assertEquals("参考视频要 2–15 秒，请调整后再试 · 追查号 JVNLY9US3XJT",
                PublicModelErrorPolicy.stored("视频1被上游拒收：reference video duration must be within 2..15 seconds · 追查号 JVNLY9US3XJT", "VIDEO_REF_UPLOAD_FAILED"));
        assertEquals(GenerationSubmissionFailure.MESSAGE,
                PublicModelErrorPolicy.stored("生成服务没有返回有效的任务信息，本次生成失败。未完成部分的冻结积分已退回，你可以重新生成。 错误原因：UpstreamCallException", "STUDIO_IMAGE_SUBMISSION_UNKNOWN"));
        assertEquals(PublicModelErrorPolicy.UNREADABLE, PublicModelErrorPolicy.stored("resource not found", "AI_CALL_FAILED"));
        assertEquals("图片结果下载失败", PublicModelErrorPolicy.stored("图片结果下载失败（上游 500）", "STUDIO_IMAGE_PROVIDER_FAILED"));
    }

    /** 2026-11-04 浏览器里发现：我们自己写的配置提示提到 API Key，曾被当成厂商原话换掉。 */
    @Test void ourOwnChineseSentenceThatMentionsAnApiKeyIsNotMistakenForSupplierText() {
        String own = "未为「视频生成」绑定 AI 模型端点。请到管理后台绑定一个端点（端点需含 baseUrl 与有效 API Key）。";
        assertEquals(own, PublicModelErrorPolicy.stored(own, "VIDEO_NOT_CONFIGURED"));
    }

    @Test void aCustomersOwnWalletOrAPlainBusinessMessageIsLeftAlone() {
        String wallet = "积分余额不足，本次操作需 320，当前可用 16。请补足积分后继续。";
        assertEquals(wallet, PublicModelErrorPolicy.stored(wallet, "STUDIO_PAYMENT_REQUIRED"));
        assertEquals("这张画布不存在，或者已经删了", PublicModelErrorPolicy.stored("这张画布不存在，或者已经删了", "IP_PROJECT_NOT_FOUND"));
    }
}

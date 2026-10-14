package com.aistareco.aep.model;

import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioMediaLimit;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceRules;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiVideoRequestSpecTest {
    @Test void referenceMinimumMustBeReachableWithConfiguredLimits() {
        var image = new VideoStudioMediaLimit("image", 1, 1024, List.of("PNG"), null, null);
        var video = new VideoStudioMediaLimit("video", 1, 1024, List.of("MP4"), null, null);
        var audio = new VideoStudioMediaLimit("audio", 0, 1024, List.of("MP3"), null, null);
        var canvas = new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)));
        var impossible = new VideoStudioReferenceRules(image, video, audio, 0, 3, 2, 15);
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec(
                "universal_reference_video", false, false, null, impossible)),
                List.of(canvas), 4, 15, 2000, 4294967295L);
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("seedance", contract,
                "/tasks", "/tasks/{id}", Map.of()).validate());
        var possible = new VideoStudioReferenceRules(image, video, audio, 1, 3, 2, 15);
        var accepted = new VideoStudioContract(List.of(new VideoStudioModeSpec(
                "universal_reference_video", false, false, null, possible)),
                List.of(canvas), 4, 15, 2000, 4294967295L);
        new AiVideoRequestSpec("seedance", accepted, "/tasks", "/tasks/{id}", Map.of()).validate();
    }

    @Test void customJsonWithoutModelVariableDoesNotNeedSupplierModelIdentifier() {
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("t2v", false, false, null, null)),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                4, 15, 2000, 4294967295L);
        var body = Map.<String, Object>of("input", Map.of("prompt", "${prompt}"));
        var spec = new AiVideoRequestSpec("json-template", contract, "/tasks", "/tasks/{id}", Map.of(),
                null, null, Map.of("t2v", body));
        assertFalse(spec.requiresModelIdentifier());
        assertTrue(new AiVideoRequestSpec("json-template", contract, "/tasks/{model}", "/tasks/{id}",
                Map.of(), null, null, Map.of("t2v", body)).requiresModelIdentifier());
        assertTrue(new AiVideoRequestSpec("json-template", contract, "/tasks", "/tasks/{id}",
                Map.of(), null, null, Map.of("t2v", Map.of("model", "${model}", "prompt", "${prompt}")))
                .requiresModelIdentifier());
    }

    @Test void customModeCanOmitPromptVariableWhenPromptIsOptional() {
        var optionalMode = new VideoStudioModeSpec("t2v", false, false, null, null, null, false);
        var contract = new VideoStudioContract(List.of(optionalMode),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                4, 15, 2000, 4294967295L);
        var body = Map.<String, Object>of("duration", "${seconds}");
        var spec = new AiVideoRequestSpec("json-template", contract, "/tasks", "/tasks/{id}", Map.of(),
                null, null, Map.of("t2v", body));
        assertEquals(false, AiVideoRequestSpec.read(spec.json()).contract().modes().get(0).promptRequired());
        var required = new VideoStudioContract(List.of(new VideoStudioModeSpec("t2v", false, false, null, null)),
                contract.tiers(), 4, 15, 2000, 4294967295L);
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("json-template", required,
                "/tasks", "/tasks/{id}", Map.of(), null, null, Map.of("t2v", body)).json());
    }

    @Test void canvasDimensionsAndTierCountFollowTheSavedContractInsteadOfH3Caps() {
        var tiers = IntStream.range(0, 13).mapToObj(index -> new VideoStudioTier("tier" + index,
                List.of(new VideoStudioCanvas("100:71", 10000 + index, 7100)))).toList();
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("t2v", false, false, null, null)),
                tiers, 1, 30, 5000, 4294967295L);
        var spec = new AiVideoRequestSpec("seedance", contract, "/tasks", "/tasks/{id}", Map.of());
        var restored = AiVideoRequestSpec.read(spec.json());
        assertEquals(13, restored.contract().tiers().size());
        assertEquals(10000, restored.contract().tiers().get(0).canvases().get(0).width());
        assertEquals("100:71", restored.contract().tiers().get(0).canvases().get(0).aspectRatio());
    }

    @Test void staticProviderFieldsAreNotLimitedToH3SizedPresets() {
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("t2v", false, false, null, null)),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                1, 30, 5000, 4294967295L);
        var fields = IntStream.range(0, 20).boxed().collect(Collectors.toMap(
                index -> "option-" + index, index -> "value".repeat(25)));
        var restored = AiVideoRequestSpec.read(new AiVideoRequestSpec("seedance", contract,
                "/tasks", "/tasks/{id}", Map.copyOf(fields)).json());
        assertEquals(20, restored.requestFields().size());
        assertEquals("value".repeat(25), restored.requestFields().get("option-0"));
    }

    @Test void staticProviderFieldsCanCarryNestedJsonAndNull() {
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("t2v", false, false, null, null)),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                1, 30, 5000, 4294967295L);
        var fields = new LinkedHashMap<String, Object>();
        fields.put("options", Map.of("watermark", false, "tags", List.of("cinematic", "portrait")));
        fields.put("callback", null);
        fields.put("label", "");
        var restored = AiVideoRequestSpec.read(new AiVideoRequestSpec("seedance", contract,
                "/tasks", "/tasks/{id}", fields).json());
        assertEquals(fields, restored.requestFields());
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("seedance", contract,
                "/tasks", "/tasks/{id}", Map.of("prompt", "override")).validate());
    }

    @Test void configuredRoutesCanCarryPublicQueryParametersAndSnapshotVariables() {
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("t2v", false, false, null, null)),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                4, 15, 2000, 4294967295L);
        var spec = new AiVideoRequestSpec("seedance", contract, "/tasks?model={model}",
                "/jobs/{id}?model={model}&detail=true", Map.of(), "/models?category=video");
        assertEquals(spec.pollPathTemplate(), AiVideoRequestSpec.read(spec.json()).pollPathTemplate());
        assertEquals(spec.modelsPath(), AiVideoRequestSpec.read(spec.json()).modelsPath());
        assertEquals("", AiVideoRequestSpec.read(new AiVideoRequestSpec("seedance", contract,
                "/tasks", "/jobs/{id}", Map.of(), "").json()).modelsPath());
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("seedance", contract,
                "/tasks", "/jobs/{id}", Map.of(), "/models?model={model}").validate());
        for (String path : List.of("//other.example/jobs/{id}", "/jobs/{id}#part",
                "/jobs/{id}?model={apiKey}", "/jobs?model={model}", "/jobs/{id}?bad=%zz")) {
            assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("seedance", contract,
                    "/tasks", path, Map.of()).validate());
        }
    }

    @Test void postPollingCanPutTheAcceptedTaskIdInItsJsonBody() {
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("t2v", false, false, null, null)),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                4, 15, 2000, 4294967295L);
        var request = Map.<String, Object>of("task_id", "${id}", "model", "${model}");
        var spec = new AiVideoRequestSpec("json-template", contract, "/create", "/status", Map.of(),
                null, null, Map.of("t2v", Map.of("prompt", "${prompt}")), null, null, null, null,
                null, "POST", request);
        assertEquals(request, AiVideoRequestSpec.read(spec.json()).pollRequestTemplate());
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("json-template", contract,
                "/create", "/status", Map.of(), null, null,
                Map.of("t2v", Map.of("prompt", "${prompt}")), null, null, null, null,
                null, "GET", request).validate());
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("json-template", contract,
                "/create", "/status", Map.of(), null, null,
                Map.of("t2v", Map.of("prompt", "${prompt}")), null, null, null, null,
                null, "POST", Map.of("model", "${model}")).validate());
    }

    @Test void jusuanCanvasRequiresItsProviderSizeCode() {
        var modes = List.of(new VideoStudioModeSpec("t2v", false, false, null, null));
        var missing = new VideoStudioContract(modes,
                List.of(new VideoStudioTier("custom", List.of(new VideoStudioCanvas("100:71", 10000, 7100)))),
                20, 30, 5000, 4294967295L);
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("jusuan-media", missing,
                "/media/generations", "/media/generations/{id}", Map.of()).validate());
        var configured = new VideoStudioContract(modes,
                List.of(new VideoStudioTier("custom", List.of(new VideoStudioCanvas("100:71", 10000, 7100,
                        "provider-custom-100x71")))), 20, 30, 5000, 4294967295L);
        var spec = new AiVideoRequestSpec("jusuan-media", configured,
                "/media/generations", "/media/generations/{id}", Map.of());
        assertEquals("provider-custom-100x71", AiVideoRequestSpec.read(spec.json())
                .contract().tiers().get(0).canvases().get(0).outputSizeCode());
    }

    @Test void responsePathsRoundTripAndRejectInvalidPointers() {
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("t2v", false, false, null, null)),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                4, 15, 2000, 4294967295L);
        var mapping = new AiVideoRequestSpec.ResponseSpec("/payload/task/id", "/payload/state",
                "/payload/result/url", "/payload/error/message", List.of("ok"), List.of("rejected"));
        var spec = new AiVideoRequestSpec("seedance", contract, "/tasks", "/tasks/{id}", Map.of(), null, mapping);
        assertEquals(mapping, AiVideoRequestSpec.read(spec.json()).responseSpec());
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("seedance", contract,
                "/tasks", "/tasks/{id}", Map.of(), null,
                new AiVideoRequestSpec.ResponseSpec("payload/task/id", null, null, null, null, null)).validate());
    }

    @Test void jsonTemplateMustCoverEveryModeAndUseKnownVariables() {
        var frame = new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioMediaLimit(
                "image", 1, 10485760, List.of("PNG"), null, null);
        var contract = new VideoStudioContract(List.of(
                new VideoStudioModeSpec("t2v", false, false, null, null),
                new VideoStudioModeSpec("i2v", true, false, frame, null)),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                4, 15, 2000, 4294967295L);
        var t2v = Map.<String, Object>of("model", "${model}", "prompt", "${prompt}",
                "request_id", "${requestId}");
        var i2v = Map.<String, Object>of("model", "${model}", "prompt", "${prompt}",
                "image", Map.of("url", "${firstFrameUrl}"));
        var spec = new AiVideoRequestSpec("json-template", contract, "/tasks", "/tasks/{id}",
                Map.of(), null, null, Map.of("t2v", t2v, "i2v", i2v));
        assertEquals(spec.requestTemplates(), AiVideoRequestSpec.read(spec.json()).requestTemplates());
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("json-template", contract,
                "/tasks", "/tasks/{id}", Map.of(), null, null, Map.of("t2v", t2v)).validate());
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("json-template", contract,
                "/tasks", "/tasks/{id}", Map.of(), null, null,
                Map.of("t2v", t2v, "i2v", Map.of("prompt", "${prompt}", "image", "${typo}"))).validate());
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("json-template", contract,
                "/tasks", "/tasks/{id}", Map.of(), null, null,
                Map.of("t2v", t2v, "i2v", Map.of("prompt", "${prompt}"))).validate());
    }

    @Test void jsonTemplatePreservesMoreThanFourCustomModesAndTheirLabels() {
        var modes = IntStream.range(0, 5).mapToObj(index -> new VideoStudioModeSpec(
                "motion_" + index, false, false, null, null, "运动模式 " + index)).toList();
        var contract = new VideoStudioContract(modes,
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                4, 15, 2000, 4294967295L);
        var templates = modes.stream().collect(Collectors.toMap(VideoStudioModeSpec::mode,
                mode -> Map.<String, Object>of("prompt", "${prompt}", "mode", "${generationMode}")));
        var saved = AiVideoRequestSpec.read(new AiVideoRequestSpec("json-template", contract,
                "/tasks", "/tasks/{id}", Map.of(), null, null, templates).json());
        assertEquals(5, saved.contract().modes().size());
        assertEquals("运动模式 4", saved.contract().modes().get(4).label());
        assertEquals(templates, saved.requestTemplates());
    }

    @Test void configuredCredentialHeaderKeepsSecretOutOfTheSpec() {
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("t2v", false, false, null, null)),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                4, 15, 2000, 4294967295L);
        var auth = new AiVideoRequestSpec.AuthHeader("x-api-key", "");
        var spec = new AiVideoRequestSpec("json-template", contract, "/tasks", "/tasks/{id}",
                Map.of(), null, null, Map.of("t2v", Map.of("prompt", "${prompt}")), auth);
        assertEquals(auth, AiVideoRequestSpec.read(spec.json()).authHeader());
        assertEquals("secret", spec.credentialHeaderValue("secret"));
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec.AuthHeader("Host", "").validate());
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec.AuthHeader("x-api-key", "a\r\n").validate());
        assertEquals("Idempotency-Key", new AiVideoRequestSpec("seedance", contract,
                "/tasks", "/tasks/{id}", Map.of()).idempotencyHeaderName());
        assertEquals(null, new AiVideoRequestSpec("seedance", contract, "/tasks", "/tasks/{id}",
                Map.of(), null, null, null, null, null, null, null, "").idempotencyHeaderName());
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("json-template", contract,
                "/tasks", "/tasks/{id}", Map.of(), null, null,
                Map.of("t2v", Map.of("prompt", "${prompt}")), null, null, null, null,
                "Authorization").validate());
    }

    @Test void catalogPointersRoundTripAndRejectInvalidValues() {
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("t2v", false, false, null, null)),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                4, 15, 2000, 4294967295L);
        var catalog = new AiVideoRequestSpec.CatalogSpec("/payload/models", "/model/id", "/label", null);
        var spec = new AiVideoRequestSpec("json-template", contract, "/tasks", "/tasks/{id}",
                Map.of(), "/models", null, Map.of("t2v", Map.of("prompt", "${prompt}")), null, catalog);
        assertEquals(catalog, AiVideoRequestSpec.read(spec.json()).catalogSpec());
        assertThrows(RuntimeException.class,
                () -> new AiVideoRequestSpec.CatalogSpec("payload/models", "/id", null, null).validate());
    }

    @Test void referenceItemTemplateRequiresUrlAndRejectsUnknownVariables() {
        var contract = com.aistareco.aep.videostudio.service.VideoStudioService.contract(5, 15);
        var templates = Map.<String, Map<String, Object>>of(
                "t2v", Map.of("prompt", "${prompt}"),
                "i2v", Map.of("prompt", "${prompt}", "image", "${firstFrameUrl}"),
                "first_last_frame_video", Map.of("prompt", "${prompt}", "first", "${firstFrameUrl}",
                        "last", "${lastFrameUrl}"),
                "universal_reference_video", Map.of("prompt", "${prompt}", "refs", "${references}"));
        var spec = new AiVideoRequestSpec("json-template", contract, "/tasks", "/tasks/{id}",
                Map.of(), null, null, templates, null, null,
                Map.of("asset_url", "${url}", "media", "${mediaType}"));
        assertEquals(spec.referenceItemTemplate(), AiVideoRequestSpec.read(spec.json()).referenceItemTemplate());
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("json-template", contract,
                "/tasks", "/tasks/{id}", Map.of(), null, null, templates, null, null,
                Map.of("asset_url", "${unknown}")).validate());

        var spreadTemplates = new java.util.LinkedHashMap<>(templates);
        spreadTemplates.put("universal_reference_video", Map.of("content", List.of(
                Map.of("type", "text", "text", "${prompt}"), "${...references}")));
        var byType = Map.<String, Map<String, Object>>of(
                "image", Map.of("image_url", Map.of("url", "${url}")),
                "video", Map.of("video_url", Map.of("url", "${url}")));
        var configured = new AiVideoRequestSpec("json-template", contract, "/tasks", "/tasks/{id}",
                Map.of(), null, null, spreadTemplates, null, null, null, byType);
        assertEquals(byType, AiVideoRequestSpec.read(configured.json()).referenceTemplates());
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("json-template", contract,
                "/tasks", "/tasks/{id}", Map.of(), null, null,
                Map.of("t2v", Map.of("prompt", "${prompt}"),
                        "i2v", Map.of("prompt", "${prompt}", "image", "${firstFrameUrl}"),
                        "first_last_frame_video", Map.of("prompt", "${prompt}", "first", "${firstFrameUrl}",
                                "last", "${lastFrameUrl}"),
                        "universal_reference_video", Map.of("content", "${...references}", "prompt", "${prompt}")),
                null, null, null, byType).validate());
    }
}

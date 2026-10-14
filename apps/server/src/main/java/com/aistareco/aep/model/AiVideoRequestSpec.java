package com.aistareco.aep.model;

import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioMediaLimit;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** The editable video contract and wire adapter for one fixed supplier/model endpoint. */
public record AiVideoRequestSpec(String adapter, VideoStudioContract contract,
                                 String submitPath, String pollPathTemplate,
                                 Map<String, Object> requestFields, String modelsPath,
                                 ResponseSpec responseSpec,
                                 Map<String, Map<String, Object>> requestTemplates,
                                 AuthHeader authHeader,
                                 CatalogSpec catalogSpec,
                                 Map<String, Object> referenceItemTemplate,
                                 Map<String, Map<String, Object>> referenceTemplates,
                                 String submitIdempotencyHeader,
                                 String pollMethod,
                                 Map<String, Object> pollRequestTemplate,
                                 List<Integer> batchCounts) {
    /** Optional JSON Pointer mappings for gateways whose task responses use different field names. */
    public record ResponseSpec(String submitId, String status, String videoUrl, String error,
                               List<String> succeeded, List<String> failed) {}
    /** JSON Pointers for a supplier's model catalog; item pointers are relative to each array entry. */
    public record CatalogSpec(String items, String id, String label, String status) {
        public void validate() {
            for (String pointer : new String[]{items, id, label, status}) {
                if (pointer != null && (!pointer.startsWith("/") || pointer.length() > 200)) throw invalid();
            }
            if (items == null || id == null) throw invalid();
        }
    }
    /** Only the placement of the stored credential is configurable; the secret never enters this spec. */
    public record AuthHeader(String name, String prefix) {
        private static final Set<String> FORBIDDEN = Set.of("host", "content-type", "content-length",
                "connection", "transfer-encoding", "cookie", "proxy-authorization", "origin", "referer",
                "idempotency-key");
        public void validate() {
            if (name == null || !name.matches("[!#$%&'*+.^_`|~0-9A-Za-z-]+")
                    || FORBIDDEN.contains(name.toLowerCase(java.util.Locale.ROOT))
                    || prefix == null || prefix.chars().anyMatch(c -> c < 32 || c == 127)) throw invalid();
        }
    }

    public AiVideoRequestSpec(String adapter, VideoStudioContract contract, String submitPath,
                              String pollPathTemplate, Map<String, Object> requestFields) {
        this(adapter, contract, submitPath, pollPathTemplate, requestFields, null, null, null, null, null, null, null, null);
    }
    public AiVideoRequestSpec(String adapter, VideoStudioContract contract, String submitPath,
                              String pollPathTemplate, Map<String, Object> requestFields, String modelsPath) {
        this(adapter, contract, submitPath, pollPathTemplate, requestFields, modelsPath, null, null, null, null, null, null, null);
    }
    public AiVideoRequestSpec(String adapter, VideoStudioContract contract, String submitPath,
                              String pollPathTemplate, Map<String, Object> requestFields, String modelsPath,
                              ResponseSpec responseSpec) {
        this(adapter, contract, submitPath, pollPathTemplate, requestFields, modelsPath, responseSpec, null, null, null, null, null, null);
    }
    public AiVideoRequestSpec(String adapter, VideoStudioContract contract, String submitPath,
                              String pollPathTemplate, Map<String, Object> requestFields, String modelsPath,
                              ResponseSpec responseSpec, Map<String, Map<String, Object>> requestTemplates) {
        this(adapter, contract, submitPath, pollPathTemplate, requestFields, modelsPath, responseSpec, requestTemplates, null, null, null, null, null);
    }
    public AiVideoRequestSpec(String adapter, VideoStudioContract contract, String submitPath,
                              String pollPathTemplate, Map<String, Object> requestFields, String modelsPath,
                              ResponseSpec responseSpec, Map<String, Map<String, Object>> requestTemplates,
                              AuthHeader authHeader) {
        this(adapter, contract, submitPath, pollPathTemplate, requestFields, modelsPath, responseSpec, requestTemplates,
                authHeader, null, null, null, null);
    }
    public AiVideoRequestSpec(String adapter, VideoStudioContract contract, String submitPath,
                              String pollPathTemplate, Map<String, Object> requestFields, String modelsPath,
                              ResponseSpec responseSpec, Map<String, Map<String, Object>> requestTemplates,
                              AuthHeader authHeader, CatalogSpec catalogSpec) {
        this(adapter, contract, submitPath, pollPathTemplate, requestFields, modelsPath, responseSpec, requestTemplates,
                authHeader, catalogSpec, null, null, null);
    }
    public AiVideoRequestSpec(String adapter, VideoStudioContract contract, String submitPath,
                              String pollPathTemplate, Map<String, Object> requestFields, String modelsPath,
                              ResponseSpec responseSpec, Map<String, Map<String, Object>> requestTemplates,
                              AuthHeader authHeader, CatalogSpec catalogSpec,
                              Map<String, Object> referenceItemTemplate) {
        this(adapter, contract, submitPath, pollPathTemplate, requestFields, modelsPath, responseSpec, requestTemplates,
                authHeader, catalogSpec, referenceItemTemplate, null, null);
    }
    public AiVideoRequestSpec(String adapter, VideoStudioContract contract, String submitPath,
                              String pollPathTemplate, Map<String, Object> requestFields, String modelsPath,
                              ResponseSpec responseSpec, Map<String, Map<String, Object>> requestTemplates,
                              AuthHeader authHeader, CatalogSpec catalogSpec,
                              Map<String, Object> referenceItemTemplate,
                              Map<String, Map<String, Object>> referenceTemplates) {
        this(adapter, contract, submitPath, pollPathTemplate, requestFields, modelsPath, responseSpec, requestTemplates,
                authHeader, catalogSpec, referenceItemTemplate, referenceTemplates, null);
    }
    public AiVideoRequestSpec(String adapter, VideoStudioContract contract, String submitPath,
                              String pollPathTemplate, Map<String, Object> requestFields, String modelsPath,
                              ResponseSpec responseSpec, Map<String, Map<String, Object>> requestTemplates,
                              AuthHeader authHeader, CatalogSpec catalogSpec,
                              Map<String, Object> referenceItemTemplate,
                              Map<String, Map<String, Object>> referenceTemplates,
                              String submitIdempotencyHeader) {
        this(adapter, contract, submitPath, pollPathTemplate, requestFields, modelsPath, responseSpec, requestTemplates,
                authHeader, catalogSpec, referenceItemTemplate, referenceTemplates,
                submitIdempotencyHeader, null, null);
    }
    public AiVideoRequestSpec(String adapter, VideoStudioContract contract, String submitPath,
                              String pollPathTemplate, Map<String, Object> requestFields, String modelsPath,
                              ResponseSpec responseSpec, Map<String, Map<String, Object>> requestTemplates,
                              AuthHeader authHeader, CatalogSpec catalogSpec,
                              Map<String, Object> referenceItemTemplate,
                              Map<String, Map<String, Object>> referenceTemplates,
                              String submitIdempotencyHeader, String pollMethod,
                              Map<String, Object> pollRequestTemplate) {
        this(adapter, contract, submitPath, pollPathTemplate, requestFields, modelsPath, responseSpec, requestTemplates,
                authHeader, catalogSpec, referenceItemTemplate, referenceTemplates,
                submitIdempotencyHeader, pollMethod, pollRequestTemplate, null);
    }
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> ADAPTERS = Set.of("jusuan-media", "seedance", "json-template");
    private static final Set<String> MODES = Set.of("t2v", "i2v", "first_last_frame_video", "universal_reference_video");
    private static final Set<String> TEMPLATE_VARS = Set.of("model", "prompt", "seconds", "aspectRatio",
            "resolutionTier", "generationMode", "seed", "width", "height", "outputSizeCode",
            "firstFrameUrl", "lastFrameUrl", "references", "requestId");
    private static final Set<String> REFERENCE_VARS = Set.of("url", "mediaType", "index");
    private static final Set<String> RESERVED_FIELDS = Set.of("model", "prompt", "content", "duration", "seconds",
            "ratio", "aspect_ratio", "resolution", "resolutionTier", "generationMode", "seed", "referenceInputs",
            "outputSizeCode");

    public static AiVideoRequestSpec read(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            AiVideoRequestSpec spec = MAPPER.readValue(json, AiVideoRequestSpec.class);
            spec.validate();
            return spec;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw invalid();
        }
    }

    public String json() {
        validate();
        try {
            return MAPPER.writeValueAsString(this);
        } catch (Exception e) {
            throw invalid();
        }
    }

    public void validate() {
        if(batchCounts!=null && (batchCounts.isEmpty() || batchCounts.stream().anyMatch(n->n==null||n<1)
                || new HashSet<>(batchCounts).size()!=batchCounts.size()))throw invalid();
        if (adapter == null || !ADAPTERS.contains(adapter) || contract == null || contract.modes() == null
                || contract.modes().isEmpty()
                || !"json-template".equals(adapter) && contract.modes().size() > MODES.size()
                || contract.tiers() == null || contract.tiers().isEmpty()
                || contract.minSeconds() < 1 || contract.maxSeconds() < contract.minSeconds()
                || contract.promptMaxChars() < 1 || contract.seedMax() < 0
                || !validPath(submitPath, false) || !validPath(pollPathTemplate, true)
                || modelsPath != null && !modelsPath.isEmpty()
                    && (!validPath(modelsPath, false) || modelsPath.contains("{"))
                || requestFields == null) throw invalid();
        String queryMethod = pollMethodOrDefault();
        if (!Set.of("GET", "POST").contains(queryMethod)
                || pollRequestTemplate != null && (!"POST".equals(queryMethod)
                        || !pollRequestTemplate.isEmpty()
                            && !validTemplate(pollRequestTemplate, 0, Set.of("id", "model"), false, false))
                || !pollPathTemplate.contains("{id}")
                    && !("POST".equals(queryMethod) && containsVariable(pollRequestTemplate, "id"))) throw invalid();
        if (authHeader != null) authHeader.validate();
        if (catalogSpec != null) catalogSpec.validate();
        if (submitIdempotencyHeader != null && !submitIdempotencyHeader.isEmpty()
                && (!submitIdempotencyHeader.matches("[!#$%&'*+.^_`|~0-9A-Za-z-]+")
                || AuthHeader.FORBIDDEN.contains(submitIdempotencyHeader.toLowerCase(java.util.Locale.ROOT))
                   && !"idempotency-key".equalsIgnoreCase(submitIdempotencyHeader)
                || "authorization".equalsIgnoreCase(submitIdempotencyHeader)
                || authHeader != null && authHeader.name().equalsIgnoreCase(submitIdempotencyHeader))) throw invalid();
        if (referenceItemTemplate != null && (!"json-template".equals(adapter)
                || contract.modes().stream().noneMatch(mode -> mode != null && mode.references() != null)
                || !validTemplate(referenceItemTemplate, 0, REFERENCE_VARS, false, false)
                || !containsVariable(referenceItemTemplate, "url"))) throw invalid();
        if (referenceTemplates != null && (!"json-template".equals(adapter)
                || contract.modes().stream().noneMatch(mode -> mode != null && mode.references() != null)
                || referenceTemplates.isEmpty()
                || referenceTemplates.entrySet().stream().anyMatch(entry ->
                    !Set.of("image", "video", "audio").contains(entry.getKey())
                    || entry.getValue() == null || !validTemplate(entry.getValue(), 0, REFERENCE_VARS, false, false)
                    || !containsVariable(entry.getValue(), "url")))) throw invalid();
        if ("json-template".equals(adapter)) {
            if (requestTemplates == null || requestTemplates.size() != contract.modes().size()) throw invalid();
            for (VideoStudioModeSpec mode : contract.modes()) {
                if (mode == null || mode.mode() == null) throw invalid();
                Map<String, Object> template = requestTemplates.get(mode.mode());
                if (template == null || template.isEmpty() || !validTemplate(template, 0)) throw invalid();
                if (template.keySet().stream().anyMatch(requestFields::containsKey)) throw invalid();
                if (!Boolean.FALSE.equals(mode.promptRequired()) && !containsVariable(template, "prompt")) throw invalid();
                if (mode.needsFirstFrame() && !containsVariable(template, "firstFrameUrl")) throw invalid();
                if (mode.needsLastFrame() && !containsVariable(template, "lastFrameUrl")) throw invalid();
                if (mode.references() != null && !containsVariable(template, "references")) throw invalid();
            }
            if (!requestTemplates.keySet().stream().allMatch(modes -> contract.modes().stream()
                    .anyMatch(mode -> mode.mode().equals(modes)))) throw invalid();
        } else if (requestTemplates != null && !requestTemplates.isEmpty()) throw invalid();
        if (responseSpec != null) {
            for (String pointer : new String[]{responseSpec.submitId(), responseSpec.status(),
                    responseSpec.videoUrl(), responseSpec.error()}) {
                if (pointer != null && (!pointer.startsWith("/") || pointer.length() > 200)) throw invalid();
            }
            if (!statuses(responseSpec.succeeded()) || !statuses(responseSpec.failed())) throw invalid();
        }
        Set<String> modes = new HashSet<>();
        for (VideoStudioModeSpec mode : contract.modes()) {
            if (mode == null || mode.mode() == null || !mode.mode().matches("[A-Za-z][A-Za-z0-9_-]{0,63}")
                    || !modes.add(mode.mode())
                    || mode.label() != null && (mode.label().isBlank() || mode.label().length() > 100)
                    || (mode.needsFirstFrame() || mode.needsLastFrame()) && mode.frameImage() == null) throw invalid();
            if (!"json-template".equals(adapter)) {
                if (!MODES.contains(mode.mode()) || mode.needsLastFrame() && !mode.needsFirstFrame()
                        || mode.references() != null && (mode.needsFirstFrame() || mode.needsLastFrame())) throw invalid();
                switch (mode.mode()) {
                    case "t2v" -> { if (mode.needsFirstFrame() || mode.needsLastFrame() || mode.references() != null) throw invalid(); }
                    case "i2v" -> { if (!mode.needsFirstFrame() || mode.needsLastFrame() || mode.references() != null) throw invalid(); }
                    case "first_last_frame_video" -> { if (!mode.needsFirstFrame() || !mode.needsLastFrame() || mode.references() != null) throw invalid(); }
                    case "universal_reference_video" -> { if (mode.needsFirstFrame() || mode.needsLastFrame() || mode.references() == null) throw invalid(); }
                    default -> throw invalid();
                }
            }
            if (mode.frameImage() != null) media(mode.frameImage(), "image");
            if (mode.references() != null) {
                var refs = mode.references();
                media(refs.image(), "image");
                media(refs.video(), "video");
                media(refs.audio(), "audio");
                if (refs.maxTotal() < 1 || refs.maxImagesWithVideo() < 0
                        || refs.minVisual() < 0 || refs.maxAudioTotalSec() < 0) throw invalid();
                long maxVisual = Math.max(refs.image().maxCount(),
                        (long) refs.video().maxCount()
                                + Math.min(refs.image().maxCount(), refs.maxImagesWithVideo()));
                if (refs.minVisual() > refs.maxTotal() || refs.minVisual() > maxVisual) throw invalid();
            }
        }
        Set<String> tiers = new HashSet<>();
        for (VideoStudioTier tier : contract.tiers()) {
            if (tier == null || tier.tier() == null || !tier.tier().matches("[A-Za-z0-9_.-]{1,32}")
                    || !tiers.add(tier.tier()) || tier.canvases() == null || tier.canvases().isEmpty()) throw invalid();
            Set<String> ratios = new HashSet<>();
            for (VideoStudioCanvas canvas : tier.canvases()) {
                if (canvas == null || canvas.aspectRatio() == null
                        || !canvas.aspectRatio().matches("[1-9][0-9]*:[1-9][0-9]*")
                        || !ratios.add(canvas.aspectRatio()) || canvas.width() < 1
                        || canvas.height() < 1
                        || "jusuan-media".equals(adapter)
                        && (canvas.outputSizeCode() == null || canvas.outputSizeCode().isBlank())) throw invalid();
            }
        }
        for (var field : requestFields.entrySet()) {
            if (!field.getKey().matches("[A-Za-z][A-Za-z0-9_.-]*")
                    || RESERVED_FIELDS.contains(field.getKey()) || !staticJson(field.getValue(), 0)) throw invalid();
        }
    }

    public List<Integer> allowedBatchCounts() {return batchCounts==null?List.of(1,2,4):batchCounts;}

    private static void media(VideoStudioMediaLimit limit, String type) {
        if (limit == null || !type.equals(limit.mediaType()) || limit.maxCount() < 0
                || limit.maxBytes() < 1 || limit.formats() == null || limit.formats().isEmpty()
                || limit.minDurationSec() != null && limit.minDurationSec() < 0
                || limit.maxDurationSec() != null && limit.maxDurationSec() < 0
                || limit.minDurationSec() != null && limit.maxDurationSec() != null
                && limit.minDurationSec() > limit.maxDurationSec()) throw invalid();
    }

    private static boolean validPath(String path, boolean poll) {
        if (path == null || !path.startsWith("/") || path.startsWith("//") || path.length() > 1024
                || path.contains("..") || path.contains("#") || path.contains("\\")
                || path.chars().anyMatch(c -> Character.isWhitespace(c) || c < 32 || c == 127)
                || (!poll && path.contains("{id}"))) return false;
        String expanded = path.replace("{id}", "task").replace("{model}", "model");
        if (expanded.contains("{") || expanded.contains("}")) return false;
        try {
            URI uri = URI.create(expanded);
            return !uri.isAbsolute() && uri.getRawAuthority() == null && uri.getRawFragment() == null
                    && uri.getRawPath() != null && uri.getRawPath().startsWith("/");
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static boolean staticJson(Object value, int depth) {
        if (depth > 16) return false;
        if (value instanceof Map<?, ?> object) {
            return object.entrySet().stream().allMatch(entry -> entry.getKey() instanceof String
                    && staticJson(entry.getValue(), depth + 1));
        }
        if (value instanceof List<?> items)
            return items.stream().allMatch(item -> staticJson(item, depth + 1));
        if (value instanceof Number number) return Double.isFinite(number.doubleValue());
        return value == null || value instanceof String || value instanceof Boolean;
    }

    public String credentialHeaderName() {
        return authHeader == null ? "Authorization" : authHeader.name();
    }

    public String pollMethodOrDefault() {
        return pollMethod == null ? "GET" : pollMethod;
    }

    public String credentialHeaderValue(String apiKey) {
        return (authHeader == null ? "Bearer " : authHeader.prefix()) + apiKey;
    }

    public String idempotencyHeaderName() {
        if (submitIdempotencyHeader != null) return submitIdempotencyHeader.isEmpty() ? null : submitIdempotencyHeader;
        return "seedance".equals(adapter) ? "Idempotency-Key" : null;
    }

    /** Custom JSON gateways need a supplier model only when their saved wire template refers to one. */
    public boolean requiresModelIdentifier() {
        if (!"json-template".equals(adapter)) return true;
        if (submitPath.contains("{model}") || pollPathTemplate.contains("{model}")) return true;
        if (containsVariable(pollRequestTemplate, "model")) return true;
        return requestTemplates != null && requestTemplates.values().stream()
                .anyMatch(template -> containsVariable(template, "model"));
    }

    private static boolean validTemplate(Object value, int depth) {
        return validTemplate(value, depth, TEMPLATE_VARS, false, true);
    }

    private static boolean validTemplate(Object value, int depth, Set<String> variables,
                                         boolean insideList, boolean allowReferenceSpread) {
        if (depth > 16) return false;
        if (value instanceof Map<?, ?> object) {
            return object.entrySet().stream().allMatch(entry -> entry.getKey() instanceof String key
                    && !key.isBlank() && validTemplate(entry.getValue(), depth + 1, variables, false, allowReferenceSpread));
        }
        if (value instanceof List<?> items)
            return items.stream().allMatch(item -> validTemplate(item, depth + 1, variables, true, allowReferenceSpread));
        if (value instanceof String text) {
            if (text.equals("${...references}")) return insideList && allowReferenceSpread;
            if (!text.startsWith("${")) return !text.contains("${");
            return text.endsWith("}") && variables.contains(text.substring(2, text.length() - 1));
        }
        return value == null || value instanceof Number number && Double.isFinite(number.doubleValue())
                || value instanceof Boolean;
    }

    private static boolean containsVariable(Object value, String variable) {
        if (value instanceof String text) return text.equals("${" + variable + "}")
                || "references".equals(variable) && text.equals("${...references}");
        if (value instanceof Map<?, ?> object) return object.values().stream().anyMatch(item -> containsVariable(item, variable));
        if (value instanceof List<?> items) return items.stream().anyMatch(item -> containsVariable(item, variable));
        return false;
    }

    private static boolean statuses(List<String> values) {
        return values == null || values.stream().allMatch(value -> value != null && !value.isBlank()
                && value.length() <= 100);
    }

    private static BusinessException invalid() {
        return BusinessException.badRequest("VIDEO_REQUEST_SPEC_INVALID", "视频模型请求规格配置无效");
    }
}

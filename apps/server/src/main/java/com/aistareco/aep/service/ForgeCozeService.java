package com.aistareco.aep.service;

import com.aistareco.aep.dto.ForgeCozeChatRequest;
import com.aistareco.aep.dto.ForgeProviderStatusDto;
import com.aistareco.aep.model.AgentBotProvider;
import com.aistareco.aep.model.DigitalIp;
import com.aistareco.aep.repository.AgentBotProviderRepository;
import com.aistareco.aep.repository.DigitalIpRepository;
import com.aistareco.common.AepCryptoUtil;
import com.coze.openapi.client.chat.CreateChatReq;
import com.coze.openapi.client.chat.model.Chat;
import com.coze.openapi.client.chat.model.ChatEvent;
import com.coze.openapi.client.chat.model.ChatEventType;
import com.coze.openapi.client.chat.model.ChatUsage;
import com.coze.openapi.client.connversations.message.model.Message;
import com.coze.openapi.client.connversations.message.model.MessageContentType;
import com.coze.openapi.client.connversations.message.model.MessageType;
import com.coze.openapi.client.connversations.message.model.Message;
import com.coze.openapi.service.auth.TokenAuth;
import com.coze.openapi.service.service.CozeAPI;
import io.reactivex.Flowable;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.function.BiConsumer;

/**
 * 通过 Coze 官方 Java SDK 托管 v3 形象锻造对话。
 * token / botId 仅保存在后端配置中，前端通过 SSE 消费流式事件。
 */
@Service
public class ForgeCozeService implements DisposableBean {

    private static final Logger log = LoggerFactory.getLogger(ForgeCozeService.class);
    private static final Pattern MARKDOWN_IMAGE_PATTERN = Pattern.compile("!\\[[^\\]]*]\\((https?://[^)\\s]+)\\)");
    private static final Pattern HTTP_URL_PATTERN = Pattern.compile("https?://[^\\s\"')]+");

    /** 本服务托管的业务场景；bot 配置按此 sceneKey 从 agent_bot_providers 解析。 */
    private static final String SCENE = AgentScenes.APPEARANCE_FORGE;

    private final DigitalIpRepository digitalIpRepo;
    private final AgentBotProviderRepository agentBotRepo;
    private final ObjectMapper objectMapper;
    // env 兜底：后台未为本 scene 配置 bot 时回退到这套 env（保持老部署不破）。
    private final boolean envEnabled;
    private final String envToken;
    private final String envBotId;
    private final String envApiBase;
    private final String envUserIdPrefix;
    private final int envReadTimeoutMs;

    // 按 (apiBase, token) 缓存 Coze client；token 改了自然换 key。
    private final Map<String, CozeAPI> clients = new ConcurrentHashMap<>();

    public ForgeCozeService(
            DigitalIpRepository digitalIpRepo,
            AgentBotProviderRepository agentBotRepo,
            ObjectMapper objectMapper,
            @Value("${aep.coze.enabled:true}") boolean enabled,
            @Value("${aep.coze.token:}") String token,
            @Value("${aep.coze.bot-id:}") String botId,
            @Value("${aep.coze.api-base:https://api.coze.cn}") String apiBase,
            @Value("${aep.coze.user-id-prefix:aep-producer-}") String userIdPrefix,
            @Value("${aep.coze.read-timeout-ms:120000}") int readTimeoutMs
    ) {
        this.digitalIpRepo = digitalIpRepo;
        this.agentBotRepo = agentBotRepo;
        this.objectMapper = objectMapper;
        this.envEnabled = enabled;
        this.envToken = token == null ? "" : token.trim();
        this.envBotId = botId == null ? "" : botId.trim();
        this.envApiBase = apiBase == null || apiBase.isBlank() ? "https://api.coze.cn" : apiBase.trim();
        this.envUserIdPrefix = userIdPrefix == null || userIdPrefix.isBlank() ? "aep-producer-" : userIdPrefix.trim();
        this.envReadTimeoutMs = readTimeoutMs;
    }

    public ForgeProviderStatusDto status() {
        BotConfig cfg = resolveBot();
        boolean configured = cfg != null;
        log.info("Forge Coze provider status checked: configured={}, source={}",
                configured, cfg == null ? "none" : cfg.source());
        if (configured) {
            String origin = "db".equals(cfg.source()) ? "后台配置" : "环境变量";
            return new ForgeProviderStatusDto(true, "coze",
                    "Coze 已配置（来源：" + origin + "），可直接开始流式锻造");
        }
        return new ForgeProviderStatusDto(
                false,
                "coze",
                "Coze 未配置：请在后台「Agent 平台」为场景 " + SCENE + " 配置 bot，或设置 AEP_COZE_TOKEN/AEP_COZE_BOT_ID"
        );
    }

    public void streamConversation(
            String requestId,
            String ownerUserId,
            ForgeCozeChatRequest request,
            BiConsumer<String, Map<String, Object>> sink
    ) {
        BotConfig cfg = ensureConfigured();
        DigitalIp artist = requireOwnedArtist(request.artistId(), ownerUserId);
        String cozeUserId = buildCozeUserId(cfg.userIdPrefix(), ownerUserId, artist.getId());

        log.info("Forge Coze stream start: requestId={}, ownerUserId={}, artistId={}, artistName={}, botId={}, source={}, cozeUserId={}, promptLength={}, promptPreview={}",
                requestId, ownerUserId, artist.getId(), artist.getName(), cfg.botId(), cfg.source(), cozeUserId,
                request.prompt() == null ? 0 : request.prompt().length(),
                preview(request.prompt()));

        sink.accept("status", payload("phase", "validated", "message", "已校验艺人归属，准备连接 Coze"));

        CreateChatReq chatReq = CreateChatReq.builder()
                .botID(cfg.botId())
                .userID(cozeUserId)
                .messages(List.of(Message.buildUserQuestionText(request.prompt())))
                .autoSaveHistory(false)
                .metaData(Map.of(
                        "artist_id", artist.getId(),
                        "artist_name", artist.getName(),
                        "owner_user_id", ownerUserId,
                        "scene", "appearance-forge-v3"
                ))
                .build();

        ResponseState responseState = new ResponseState();
        try {
            Flowable<ChatEvent> flow = client(cfg).chat().stream(chatReq);
            flow.blockingForEach(event -> handleEvent(requestId, event, responseState, sink));
            log.info("Forge Coze stream finished: requestId={}, replyLength={}, hasImage={}",
                    requestId, responseState.reply.length(), responseState.imageUrl != null);
        } catch (Exception ex) {
            log.error("Forge Coze stream exception: requestId={}, artistId={}, message={}",
                    requestId, artist.getId(), ex.getMessage(), ex);
            throw ex;
        }
    }

    private void handleEvent(
            String requestId,
            ChatEvent event,
            ResponseState responseState,
            BiConsumer<String, Map<String, Object>> sink
    ) {
        if (ChatEventType.CONVERSATION_CHAT_CREATED.equals(event.getEvent())) {
            Chat chat = event.getChat();
            log.info("Forge Coze chat created: requestId={}, chatId={}, conversationId={}",
                    requestId,
                    chat == null ? null : chat.getID(),
                    chat == null ? null : chat.getConversationID());
            Map<String, Object> data = payload(
                    "phase", "created",
                    "message", "Coze 会话已创建，开始生成形象建议"
            );
            if (chat != null) {
                putIfText(data, "chatId", chat.getID());
                putIfText(data, "conversationId", chat.getConversationID());
            }
            sink.accept("status", data);
            return;
        }

        if (ChatEventType.CONVERSATION_CHAT_IN_PROGRESS.equals(event.getEvent())) {
            log.info("Forge Coze chat in progress: requestId={}", requestId);
            sink.accept("status", payload("phase", "in_progress", "message", "Coze 正在流式返回锻造建议"));
            return;
        }

        if (ChatEventType.CONVERSATION_MESSAGE_DELTA.equals(event.getEvent())) {
            String delta = event.getMessage() == null ? "" : safeText(event.getMessage().getContent());
            if (!delta.isEmpty()) {
                responseState.reply.append(delta);
                if (responseState.reply.length() == delta.length()) {
                    log.info("Forge Coze first delta received: requestId={}, deltaLength={}", requestId, delta.length());
                } else {
                    log.debug("Forge Coze delta received: requestId={}, deltaLength={}, replyLength={}",
                            requestId, delta.length(), responseState.reply.length());
                }
                Map<String, Object> data = payload("content", delta, "reply", responseState.reply.toString());
                putIfText(data, "imageUrl", responseState.imageUrl);
                sink.accept("delta", data);
            }
            return;
        }

        if (ChatEventType.CONVERSATION_MESSAGE_COMPLETED.equals(event.getEvent())) {
            Message message = event.getMessage();
            MessageSnapshot snapshot = messageSnapshot(message);
            log.info("Forge Coze message completed: requestId={}, messageType={}, contentType={}, renderable={}, wrapper={}, hasImage={}, textLength={}, preview={}",
                    requestId,
                    snapshot.messageType,
                    snapshot.contentType,
                    snapshot.renderable,
                    snapshot.wrapper,
                    snapshot.imageUrl != null,
                    snapshot.text.length(),
                    preview(snapshot.text.isBlank() ? safeText(message == null ? null : message.getContent()) : snapshot.text));

            if (snapshot.imageUrl != null) {
                responseState.imageUrl = snapshot.imageUrl;
            }

            if (!snapshot.renderable) {
                return;
            }

            if (!snapshot.text.isBlank()) {
                responseState.reply.setLength(0);
                responseState.reply.append(snapshot.text);
            }

            Map<String, Object> data = payload("content", responseState.reply.toString());
            putIfText(data, "imageUrl", responseState.imageUrl);
            sink.accept("message", data);
            return;
        }

        if (ChatEventType.CONVERSATION_CHAT_COMPLETED.equals(event.getEvent())) {
            Map<String, Object> data = payload(
                    "phase", "completed",
                    "message", "Coze 响应完成",
                    "content", responseState.reply.toString()
            );
            putIfText(data, "imageUrl", responseState.imageUrl);
            Chat chat = event.getChat();
            if (chat != null) {
                putIfText(data, "chatId", chat.getID());
                putIfText(data, "conversationId", chat.getConversationID());
                ChatUsage usage = chat.getUsage();
                if (usage != null) {
                    data.put("tokenCount", usage.getTokenCount());
                    data.put("inputTokens", usage.getInputTokens());
                    data.put("outputTokens", usage.getOutputTokens());
                }
                log.info("Forge Coze chat completed: requestId={}, chatId={}, conversationId={}, tokenCount={}, inputTokens={}, outputTokens={}, replyLength={}",
                        requestId,
                        chat.getID(),
                        chat.getConversationID(),
                        usage == null ? null : usage.getTokenCount(),
                        usage == null ? null : usage.getInputTokens(),
                        usage == null ? null : usage.getOutputTokens(),
                        responseState.reply.length());
            } else {
                log.info("Forge Coze chat completed without chat payload: requestId={}, replyLength={}",
                        requestId, responseState.reply.length());
            }
            sink.accept("completed", data);
            return;
        }

        if (ChatEventType.CONVERSATION_CHAT_FAILED.equals(event.getEvent())) {
            String message = "Coze 会话失败";
            if (event.getChat() != null && event.getChat().getLastError() != null) {
                String lastError = safeText(event.getChat().getLastError().getMsg());
                if (!lastError.isBlank()) {
                    message = lastError;
                }
            }
            log.warn("Forge Coze chat failed: requestId={}, message={}", requestId, message);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, message);
        }

        log.debug("Forge Coze ignored event: requestId={}, event={}", requestId, event.getEvent());
    }

    private CozeAPI client(BotConfig cfg) {
        String key = cfg.apiBase() + " " + cfg.token();
        return clients.computeIfAbsent(key, k -> {
            log.info("Forge Coze client init: apiBase={}, readTimeoutMs={}, source={}",
                    cfg.apiBase(), cfg.readTimeoutMs(), cfg.source());
            return new CozeAPI.Builder()
                    .auth(new TokenAuth(cfg.token()))
                    .baseURL(cfg.apiBase())
                    .readTimeout(cfg.readTimeoutMs())
                    .build();
        });
    }

    private BotConfig ensureConfigured() {
        BotConfig cfg = resolveBot();
        if (cfg == null) {
            log.warn("Forge Coze requested but not configured (no admin bot for scene={} and no env fallback)", SCENE);
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Coze 未配置：请在后台「Agent 平台」为场景 " + SCENE + " 配置 bot，或设置 AEP_COZE_TOKEN/AEP_COZE_BOT_ID"
            );
        }
        return cfg;
    }

    /** 解析本场景的 bot 配置：后台配置（agent_bot_providers）优先，env 兜底。 */
    private BotConfig resolveBot() {
        AgentBotProvider row = agentBotRepo.findBySceneKeyAndEnabledTrue(SCENE).orElse(null);
        if (row != null) {
            String tok = "";
            try {
                tok = AepCryptoUtil.decrypt(row.getTokenEncrypted());
            } catch (Exception e) {
                log.warn("Forge agent bot {} token 解密失败：{}", row.getId(), e.getMessage());
            }
            if (tok != null && !tok.isBlank() && row.getBotId() != null && !row.getBotId().isBlank()) {
                return new BotConfig(
                        tok.trim(),
                        row.getBotId().trim(),
                        blankTo(row.getApiBase(), "https://api.coze.cn"),
                        blankTo(row.getUserIdPrefix(), "aep-producer-"),
                        row.getReadTimeoutMs() != null ? row.getReadTimeoutMs() : 120000,
                        "db");
            }
        }
        if (envEnabled && !envToken.isBlank() && !envBotId.isBlank()) {
            return new BotConfig(envToken, envBotId, envApiBase, envUserIdPrefix, envReadTimeoutMs, "env");
        }
        return null;
    }

    private static String blankTo(String v, String def) {
        return v == null || v.isBlank() ? def : v.trim();
    }

    private record BotConfig(String token, String botId, String apiBase, String userIdPrefix,
                            int readTimeoutMs, String source) {}

    private DigitalIp requireOwnedArtist(String artistId, String ownerUserId) {
        DigitalIp artist = digitalIpRepo.findById(artistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "艺人不存在: " + artistId));
        if (!ownerUserId.equals(artist.getOwnerUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权为该艺人发起锻造");
        }
        return artist;
    }

    private String buildCozeUserId(String userIdPrefix, String ownerUserId, String artistId) {
        return userIdPrefix + ownerUserId + "-" + artistId;
    }

    private String safeText(String value) {
        return value == null ? "" : value;
    }

    private String preview(String value) {
        if (value == null || value.isBlank()) return "";
        String singleLine = value.replaceAll("\\s+", " ").trim();
        return singleLine.length() <= 120 ? singleLine : singleLine.substring(0, 120) + "...";
    }

    private MessageSnapshot messageSnapshot(Message message) {
        if (message == null) {
            return new MessageSnapshot("", "unknown", "unknown", null, false, false);
        }

        String messageType = message.getType() == null ? "unknown" : message.getType().getValue();
        String contentType = message.getContentType() == null ? "unknown" : message.getContentType().getValue();
        ParsedContent parsed = parseContent(message.getContent(), contentType);

        boolean renderable = MessageType.ANSWER.equals(message.getType()) && !parsed.wrapper
                && (!parsed.text.isBlank() || parsed.imageUrl != null);

        return new MessageSnapshot(
                parsed.text,
                messageType,
                contentType,
                parsed.imageUrl,
                renderable,
                parsed.wrapper
        );
    }

    private ParsedContent parseContent(String rawContent, String contentType) {
        String content = safeText(rawContent);
        if (content.isBlank()) {
            return new ParsedContent("", null, false);
        }

        if (MessageContentType.OBJECT_STRING.getValue().equals(contentType)
                || MessageContentType.CARD.getValue().equals(contentType)) {
            try {
                JsonNode root = objectMapper.readTree(content);
                String imageUrl = extractImageUrl(root, "");
                if (root.isArray()) {
                    StringBuilder text = new StringBuilder();
                    for (JsonNode node : root) {
                        String type = node.path("type").asText("");
                        if ("text".equals(type)) {
                            appendLine(text, node.path("text").asText(""));
                        }
                    }
                    if (text.length() > 0 || imageUrl != null) {
                        return new ParsedContent(text.toString(), imageUrl, false);
                    }
                }
                if (looksLikeWrapper(root)) {
                    return new ParsedContent("", imageUrl, true);
                }
                String text = extractText(root);
                if (!text.isBlank() || imageUrl != null) {
                    return new ParsedContent(text, imageUrl, false);
                }
            } catch (Exception ex) {
                log.debug("Forge Coze content parse fallback: contentType={}, message={}", contentType, ex.getMessage());
            }
        }

        if (looksLikeWrapper(content)) {
            return new ParsedContent("", extractImageUrl(content), true);
        }
        return new ParsedContent(content, extractImageUrl(content), false);
    }

    private boolean looksLikeWrapper(JsonNode root) {
        return "generate_answer_finish".equals(root.path("msg_type").asText(""))
                || root.has("finish_reason")
                || root.has("FinData");
    }

    private boolean looksLikeWrapper(String content) {
        return content.contains("\"msg_type\":\"generate_answer_finish\"")
                || content.contains("\"finish_reason\":")
                || content.contains("\"FinData\"");
    }

    private String extractText(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return "";
        if (node.isTextual()) return node.asText("");
        if (node.isArray()) {
            StringBuilder text = new StringBuilder();
            for (JsonNode child : node) {
                appendLine(text, extractText(child));
            }
            return text.toString();
        }
        if (node.isObject()) {
            if (node.hasNonNull("text")) return node.path("text").asText("");
            if (node.hasNonNull("content")) return node.path("content").asText("");
            if (node.hasNonNull("data") && node.path("data").isTextual()) return node.path("data").asText("");
        }
        return "";
    }

    private String extractImageUrl(JsonNode node, String keyHint) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        if (node.isTextual()) {
            String value = node.asText("");
            return isLikelyImageUrl(value, keyHint) ? value : extractImageUrl(value);
        }
        if (node.isArray()) {
            for (JsonNode child : node) {
                String candidate = extractImageUrl(child, keyHint);
                if (candidate != null) return candidate;
            }
            return null;
        }
        if (node.isObject()) {
            String prioritized = pickUrlFromKnownFields(node);
            if (prioritized != null) return prioritized;
            var fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                String candidate = extractImageUrl(entry.getValue(), entry.getKey());
                if (candidate != null) return candidate;
            }
        }
        return null;
    }

    private String pickUrlFromKnownFields(JsonNode node) {
        for (String key : List.of("image_url", "imageUrl", "file_url", "fileUrl", "url")) {
            String value = node.path(key).asText("");
            if (isLikelyImageUrl(value, key)) return value;
        }
        return null;
    }

    private String extractImageUrl(String content) {
        if (content == null || content.isBlank()) return null;
        Matcher markdown = MARKDOWN_IMAGE_PATTERN.matcher(content);
        if (markdown.find()) {
            return markdown.group(1);
        }
        Matcher http = HTTP_URL_PATTERN.matcher(content);
        while (http.find()) {
            String candidate = http.group();
            if (isLikelyImageUrl(candidate, "")) {
                return candidate;
            }
        }
        return null;
    }

    private boolean isLikelyImageUrl(String value, String keyHint) {
        if (value == null || value.isBlank() || !value.startsWith("http")) return false;
        String lower = value.toLowerCase();
        String key = keyHint == null ? "" : keyHint.toLowerCase();
        return key.contains("image")
                || key.contains("file")
                || lower.matches(".*\\.(png|jpg|jpeg|webp|gif)(\\?.*)?$")
                || lower.contains("/image")
                || lower.contains("/img")
                || lower.contains("coze")
                || lower.contains("cdn");
    }

    private void appendLine(StringBuilder sb, String text) {
        if (text == null || text.isBlank()) return;
        if (sb.length() > 0) sb.append('\n');
        sb.append(text.trim());
    }

    private record ParsedContent(String text, String imageUrl, boolean wrapper) {}

    private record MessageSnapshot(
            String text,
            String messageType,
            String contentType,
            String imageUrl,
            boolean renderable,
            boolean wrapper
    ) {}

    private static final class ResponseState {
        private final StringBuilder reply = new StringBuilder();
        private String imageUrl;
    }

    private Map<String, Object> payload(String k1, Object v1, String k2, Object v2) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put(k1, v1);
        data.put(k2, v2);
        return data;
    }

    private Map<String, Object> payload(String k1, Object v1) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put(k1, v1);
        return data;
    }

    private Map<String, Object> payload(String k1, Object v1, String k2, Object v2, String k3, Object v3) {
        Map<String, Object> data = payload(k1, v1, k2, v2);
        data.put(k3, v3);
        return data;
    }

    private void putIfText(Map<String, Object> data, String key, String value) {
        if (value != null && !value.isBlank()) {
            data.put(key, value);
        }
    }

    @Override
    public void destroy() {
        clients.values().forEach(c -> {
            try {
                c.shutdownExecutor();
            } catch (Exception ignored) {
                // best-effort shutdown
            }
        });
        clients.clear();
    }
}

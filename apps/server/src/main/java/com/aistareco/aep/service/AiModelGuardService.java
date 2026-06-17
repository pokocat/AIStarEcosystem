package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.repository.AiModelUsageRecordRepository;
import com.aistareco.common.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** LLM 调用前置保护：端点级 RPM / TPM / 每日 token / 每日成本配额。 */
@Service
public class AiModelGuardService {

    private static final ZoneId QUOTA_ZONE = ZoneId.of("Asia/Shanghai");
    private static final long WINDOW_SECONDS = 60L;

    private final AiModelUsageRecordRepository usageRepo;
    private final Map<String, Window> requestWindows = new ConcurrentHashMap<>();
    private final Map<String, Window> tokenWindows = new ConcurrentHashMap<>();

    @Value("${aep.llm.guard.default-output-token-reserve:1024}")
    private long defaultOutputTokenReserve = 1024L;

    public AiModelGuardService(AiModelUsageRecordRepository usageRepo) {
        this.usageRepo = usageRepo;
    }

    public void checkBeforeCall(AiModelEndpoint endpoint, TokenEstimate estimate) {
        if (endpoint == null || endpoint.getId() == null || endpoint.getId().isBlank()) return;
        TokenEstimate safeEstimate = estimate == null ? TokenEstimate.empty() : estimate;
        long estimatedTokens = Math.max(1L, safeEstimate.totalTokens());
        Instant now = Instant.now();

        checkDailyTokenQuota(endpoint, estimatedTokens);
        checkDailyCostQuota(endpoint, safeEstimate);

        Integer rpmLimit = endpoint.getRpmLimit();
        if (rpmLimit != null && rpmLimit > 0) {
            boolean accepted = requestWindows
                    .computeIfAbsent(endpoint.getId(), ignored -> new Window())
                    .addOrReject(now, 1L, rpmLimit);
            if (!accepted) {
                throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "LLM_RPM_LIMIT_EXCEEDED",
                        "该模型当前请求过多，请稍后重试");
            }
        }

        Integer tpmLimit = endpoint.getTpmLimit();
        if (tpmLimit != null && tpmLimit > 0) {
            boolean accepted = tokenWindows
                    .computeIfAbsent(endpoint.getId(), ignored -> new Window())
                    .addOrReject(now, estimatedTokens, tpmLimit);
            if (!accepted) {
                throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "LLM_TPM_LIMIT_EXCEEDED",
                        "该模型当前用量过高，请稍后重试");
            }
        }
    }

    public TokenEstimate estimateChatTokens(List<Map<String, String>> messages, Map<String, Object> body) {
        long chars = 0L;
        if (messages != null) {
            for (Map<String, String> message : messages) {
                if (message == null) continue;
                chars += lengthOf(message.get("role"));
                chars += lengthOf(message.get("content"));
            }
        }
        return new TokenEstimate(estimateTokensFromChars(chars), outputReserve(body));
    }

    public TokenEstimate estimateOpenAiBodyTokens(Map<String, Object> body) {
        if (body == null) return new TokenEstimate(0L, outputReserve(null));
        long chars = 0L;
        Object messages = body.get("messages");
        if (messages instanceof List<?> list) {
            for (Object item : list) {
                chars += lengthOf(item);
            }
        } else {
            chars += lengthOf(messages);
        }
        return new TokenEstimate(estimateTokensFromChars(chars), outputReserve(body));
    }

    public long estimateCostMicros(AiModelEndpoint endpoint, TokenEstimate estimate) {
        if (endpoint == null || estimate == null) return 0L;
        long promptPrice = Math.max(0L, endpoint.getPromptTokenPriceMicros());
        long completionPrice = Math.max(0L, endpoint.getCompletionTokenPriceMicros());
        return (estimate.promptTokens() * promptPrice + estimate.completionTokens() * completionPrice) / 1000L;
    }

    private void checkDailyTokenQuota(AiModelEndpoint endpoint, long estimatedTokens) {
        Long quota = endpoint.getDailyTokenQuota();
        if (quota == null || quota <= 0) return;
        long used = usageRepo.sumTotalTokensByProviderSince(endpoint.getId(), todayStart());
        if (used + estimatedTokens > quota) {
            throw new BusinessException(HttpStatus.PAYMENT_REQUIRED, "LLM_DAILY_TOKEN_QUOTA_EXCEEDED",
                    "该模型今日额度已用完，请联系管理员调整配额");
        }
    }

    private void checkDailyCostQuota(AiModelEndpoint endpoint, TokenEstimate estimate) {
        Long quota = endpoint.getDailyCostQuotaMicros();
        if (quota == null || quota <= 0) return;
        long used = usageRepo.sumCostMicrosByProviderSince(endpoint.getId(), todayStart());
        long estimatedCost = estimateCostMicros(endpoint, estimate);
        if (used + estimatedCost > quota) {
            throw new BusinessException(HttpStatus.PAYMENT_REQUIRED, "LLM_DAILY_COST_QUOTA_EXCEEDED",
                    "该模型今日成本额度已用完，请联系管理员调整配额");
        }
    }

    private static Instant todayStart() {
        return LocalDate.now(QUOTA_ZONE).atStartOfDay(QUOTA_ZONE).toInstant();
    }

    private static long estimateTokensFromChars(long chars) {
        if (chars <= 0) return 0L;
        return Math.max(1L, (chars + 3L) / 4L);
    }

    private long outputReserve(Map<String, Object> body) {
        Long maxTokens = asLong(body == null ? null : body.get("max_tokens"));
        if (maxTokens == null) maxTokens = asLong(body == null ? null : body.get("maxTokens"));
        if (maxTokens != null && maxTokens > 0) return maxTokens;
        return Math.max(1L, defaultOutputTokenReserve);
    }

    private static Long asLong(Object value) {
        if (value instanceof Number n) return n.longValue();
        if (value == null) return null;
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static long lengthOf(Object value) {
        return value == null ? 0L : String.valueOf(value).length();
    }

    public record TokenEstimate(long promptTokens, long completionTokens) {
        static TokenEstimate empty() {
            return new TokenEstimate(0L, 0L);
        }

        long totalTokens() {
            return Math.max(0L, promptTokens) + Math.max(0L, completionTokens);
        }
    }

    private static final class Window {
        private final ArrayDeque<Entry> entries = new ArrayDeque<>();
        private long total;

        synchronized boolean addOrReject(Instant now, long units, long limit) {
            prune(now);
            if (total + units > limit) return false;
            entries.addLast(new Entry(now, Math.max(0L, units)));
            total += Math.max(0L, units);
            return true;
        }

        private void prune(Instant now) {
            Instant cutoff = now.minusSeconds(WINDOW_SECONDS);
            while (!entries.isEmpty() && entries.peekFirst().at().isBefore(cutoff)) {
                total -= entries.removeFirst().units();
            }
            if (total < 0) total = 0;
        }
    }

    private record Entry(Instant at, long units) {}
}

package com.aistareco.aep.identity;

import com.aistareco.aep.model.PlatformConfig;
import com.aistareco.aep.repository.PlatformConfigRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.nimbusds.jose.KeySourceException;
import com.nimbusds.jose.RemoteKeySourceException;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSelector;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 账号中心验签公钥：验签只读内存，取公钥不占请求线程。
 *
 * <p>2026-11-06 事故：账号中心因欠费断开时重启服务，第一个请求持锁取公钥且没有超时，其余请求全部
 * 排在锁后面；公钥又只存在内存里，所有已登录用户都卡住。服务不重启也有同样的隐患：Nimbus 自带的
 * 缓存 15 分钟过期，之后取不到就全部验签失败。
 *
 * <p>规则：
 * <ul>
 *   <li>启动时先用库里存的上一份（{@link #CONFIG_KEY}），账号中心断开也能重启；</li>
 *   <li>后台每 5 分钟取一次，取到才替换内存和库。<b>取不到继续用旧的，没有过期一说</b>：账号中心
 *       连不上时我们不知道它换没换钥，而它连不上也签不出新令牌；连上之后 5 分钟内就换成新的；</li>
 *   <li>网络请求全是异步的，同一时间只有一个，总时长有上限（§8.0.1 ⑰）。请求线程最多等
 *       {@link #MISS_WAIT}，等的时候不持锁；</li>
 *   <li>令牌的 kid 不认识：可能是换钥，也可能是伪造。去取一次（最多每
 *       {@link #MISS_REFRESH_INTERVAL} 一次，防止乱填 kid 打爆账号中心），取到了还不认识就是无效令牌；
 *       取不到就是不知道，抛 {@link RemoteKeySourceException}，调用方回 503、不把用户踢下线。</li>
 * </ul>
 *
 * <p>存的只有公钥，库里那行也不能经后台改（{@code PlatformConfigService#upsert} 拒绝），
 * 否则能写配置的人就能伪造任何人的令牌。
 */
@Component
public class IdentityJwkCache implements JWKSource<SecurityContext> {

    private static final Logger log = LoggerFactory.getLogger(IdentityJwkCache.class);

    /** {@code aep_platform_configs} 里存最近一份公钥的 key。 */
    public static final String CONFIG_KEY = "identity.jwks-cache";

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(2);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(3);
    /** 一次取公钥（可能含发现 + JWKS 两个请求）的总时限，包括正文。 */
    static final Duration FETCH_TIMEOUT = Duration.ofSeconds(6);
    /** 不认识 kid 时，请求线程最多等这么久。 */
    static final Duration MISS_WAIT = Duration.ofSeconds(3);
    /** 不认识 kid 时，两次去账号中心之间至少隔这么久。 */
    static final Duration MISS_REFRESH_INTERVAL = Duration.ofSeconds(10);

    private final IdentityProperties props;
    private final PlatformConfigRepository repo;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    private final AtomicReference<CompletableFuture<JWKSet>> inFlight = new AtomicReference<>();

    private volatile JWKSet keys;
    /** 库里现在存的那份（只比内容决定要不要写库）。 */
    private volatile String storedJson;
    private volatile String discoveredJwksUri;
    private volatile Instant lastAttempt;
    /** 上一次取公钥失败的原因；成功后清空。 */
    private volatile String lastFailure;
    private volatile int consecutiveFailures;

    @Autowired
    public IdentityJwkCache(IdentityProperties props, PlatformConfigRepository repo, ObjectMapper mapper) {
        this(props, repo, mapper, Clock.systemUTC());
    }

    IdentityJwkCache(IdentityProperties props, PlatformConfigRepository repo, ObjectMapper mapper, Clock clock) {
        this.props = props;
        this.repo = repo;
        this.mapper = mapper;
        this.clock = clock;
    }

    /** 读库失败或内容不对只记日志：后台刷新会补上，不能因此起不来。 */
    @PostConstruct
    void loadStored() {
        if (!props.isEnabled()) return;
        try {
            PlatformConfig row = repo.findByConfigKey(CONFIG_KEY).orElse(null);
            if (row == null || row.getValueJson() == null) {
                log.info("[identity] 库里还没有验签公钥，等后台第一次取到");
                return;
            }
            JsonNode doc = mapper.readTree(row.getValueJson());
            // 库可能是别的环境复制来的：不是这个 issuer 的公钥一律不用。
            if (!props.baseUrl().equals(doc.path("issuer").asText())) {
                log.info("[identity] 库里的验签公钥属于 {}，不是当前的 {}，不使用",
                        doc.path("issuer").asText(), props.baseUrl());
                return;
            }
            JWKSet stored = JWKSet.parse(mapper.writeValueAsString(doc.path("jwks"))).toPublicJWKSet();
            if (stored.getKeys().isEmpty()) return;
            storedJson = stored.toString();
            keys = stored;
            log.info("[identity] 已载入库里的验签公钥 kids={} savedAt={}",
                    kids(stored), doc.path("savedAt").asText());
        } catch (Exception e) {
            log.warn("[identity] 读库里的验签公钥失败，等后台重新取 err={}", e.toString());
        }
    }

    /** 只发起、不等待：这个方法跑在只有一个线程的调度器上。 */
    @Scheduled(initialDelay = 0, fixedDelay = 300, timeUnit = TimeUnit.SECONDS)
    public void refreshInBackground() {
        if (props.isEnabled()) refresh();
    }

    @Override
    public List<JWK> get(JWKSelector selector, SecurityContext context) throws KeySourceException {
        JWKSet known = keys;
        if (known != null) {
            List<JWK> hit = selector.select(known);
            if (!hit.isEmpty()) return hit;
        }
        return selector.select(latestAfterMiss());
    }

    private JWKSet latestAfterMiss() throws RemoteKeySourceException {
        Instant last = lastAttempt;
        boolean recent = inFlight.get() == null && last != null
                && clock.instant().isBefore(last.plus(MISS_REFRESH_INTERVAL));
        if (recent) {
            String failure = lastFailure;
            JWKSet known = keys;
            if (failure != null || known == null) {
                throw new RemoteKeySourceException("账号中心公钥暂时取不到：" + failure, null);
            }
            return known;
        }
        CompletableFuture<JWKSet> running = refresh();
        try {
            return running.get(MISS_WAIT.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RemoteKeySourceException("等账号中心公钥时被中断", e);
        } catch (TimeoutException e) {
            throw new RemoteKeySourceException("等账号中心公钥超时", e);
        } catch (ExecutionException e) {
            throw new RemoteKeySourceException("账号中心公钥暂时取不到：" + reason(e), e);
        }
    }

    /** 同一时间只有一个请求；正在取时返回正在进行的那次。不抛异常、不阻塞调用方。 */
    CompletableFuture<JWKSet> refresh() {
        CompletableFuture<JWKSet> mine = new CompletableFuture<>();
        CompletableFuture<JWKSet> running = inFlight.compareAndExchange(null, mine);
        if (running != null) return running;
        lastAttempt = clock.instant();
        CompletableFuture<JWKSet> fetch;
        try {
            fetch = fetchAsync().orTimeout(FETCH_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
        } catch (RuntimeException e) {
            fetch = CompletableFuture.failedFuture(e);
        }
        fetch.whenComplete((fresh, err) -> {
            // 先改状态再放行等待的线程：它们醒来要能读到新公钥。
            if (err == null) accept(fresh);
            else reject(err);
            inFlight.compareAndSet(mine, null);
            if (err == null) mine.complete(fresh);
            else mine.completeExceptionally(err);
        });
        return mine;
    }

    private CompletableFuture<JWKSet> fetchAsync() {
        return jwksUri().thenCompose(uri -> getText(uri).whenComplete((body, err) -> {
            // 地址可能换了：失败就忘掉发现结果，下次重新发现。
            if (err != null) discoveredJwksUri = null;
        })).thenApply(this::parseKeys);
    }

    private CompletableFuture<String> jwksUri() {
        String explicit = props.getJwksUri();
        if (explicit != null && !explicit.isBlank()) return CompletableFuture.completedFuture(explicit.trim());
        String known = discoveredJwksUri;
        if (known != null) return CompletableFuture.completedFuture(known);
        String discoveryUrl = props.baseUrl() + "/.well-known/openid-configuration";
        return getText(discoveryUrl).thenApply(body -> {
            String uri;
            try {
                uri = mapper.readTree(body).path("jwks_uri").asText(null);
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("发现文档不是 JSON: " + discoveryUrl);
            }
            if (uri == null || uri.isBlank()) {
                throw new IllegalStateException("发现文档缺少 jwks_uri: " + discoveryUrl);
            }
            discoveredJwksUri = uri;
            return uri;
        });
    }

    private CompletableFuture<String> getText(String url) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(REQUEST_TIMEOUT)
                .header("Accept", "application/json, application/jwk-set+json")
                .GET()
                .build();
        return http.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
                .thenApply(response -> {
                    if (response.statusCode() != 200) {
                        throw new IllegalStateException("HTTP " + response.statusCode() + " " + url
                                + " body=" + snippet(response.body()));
                    }
                    return response.body();
                });
    }

    private JWKSet parseKeys(String body) {
        JWKSet parsed;
        try {
            parsed = JWKSet.parse(body).toPublicJWKSet();
        } catch (ParseException e) {
            throw new IllegalStateException("公钥内容解析失败 body=" + snippet(body));
        }
        // 账号中心把公钥发成空的：当作失败，不能拿空集合把好的换掉，否则所有人都验不过。
        if (parsed.getKeys().isEmpty()) throw new IllegalStateException("公钥集合是空的");
        return parsed;
    }

    private void accept(JWKSet fresh) {
        String json = fresh.toString();
        JWKSet previous = keys;
        boolean changed = previous == null || !previous.toString().equals(json);
        keys = fresh;
        lastFailure = null;
        if (consecutiveFailures > 0) {
            log.info("[identity] 账号中心公钥恢复获取（此前连续失败 {} 次）", consecutiveFailures);
        }
        consecutiveFailures = 0;
        if (changed) log.info("[identity] 验签公钥已更新 kids={} issuer={}", kids(fresh), props.baseUrl());
        // 写库不占发请求的线程；写失败下一轮（storedJson 没变）会再写。
        if (!json.equals(storedJson)) CompletableFuture.runAsync(() -> store(json));
    }

    private void reject(Throwable err) {
        String reason = reason(err);
        lastFailure = reason;
        consecutiveFailures++;
        JWKSet known = keys;
        log.warn("[identity] 取账号中心公钥失败，连续 {} 次；{} err={}", consecutiveFailures,
                known == null ? "现在没有可用公钥，账号中心令牌会回 503" : "继续用已有公钥 kids=" + kids(known),
                reason);
    }

    private void store(String json) {
        try {
            Instant now = clock.instant();
            ObjectNode doc = mapper.createObjectNode();
            doc.put("issuer", props.baseUrl());
            doc.set("jwks", mapper.readTree(json));
            doc.put("savedAt", now.toString());
            PlatformConfig row = repo.findByConfigKey(CONFIG_KEY).orElseGet(() -> PlatformConfig.builder()
                    .id(UUID.randomUUID().toString())
                    .configKey(CONFIG_KEY)
                    .description("账号中心验签公钥的最近一份，系统自动维护")
                    .build());
            row.setValueJson(mapper.writeValueAsString(doc));
            row.setVersion(row.getVersion() + 1);
            row.setUpdatedAt(now);
            row.setUpdatedBy("system");
            repo.save(row);
            storedJson = json;
        } catch (Exception e) {
            log.warn("[identity] 验签公钥写库失败，下一轮再写 err={}", e.toString());
        }
    }

    private static String reason(Throwable err) {
        Throwable cause = err;
        while ((cause instanceof CompletionException || cause instanceof ExecutionException)
                && cause.getCause() != null) {
            cause = cause.getCause();
        }
        return cause.toString();
    }

    private static String snippet(String body) {
        if (body == null) return "";
        return body.length() <= 200 ? body : body.substring(0, 200) + "…";
    }

    private static List<String> kids(JWKSet set) {
        return set.getKeys().stream().map(JWK::getKeyID).toList();
    }
}

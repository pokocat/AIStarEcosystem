package com.aistareco.aep.impersonation;

import com.aistareco.aep.model.AdminUser;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AdminUserRepository;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.service.AuditService;
import com.aistareco.common.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;

/** 单实例附身登录：复用产品用户和原有鉴权，不添加只读规则、角色表或账号中心配置。 */
@Service
public class ImpersonationService {
    public static final String TOKEN_PREFIX = "imp_";
    private final Map<String, Session> tickets = new HashMap<>();
    private final Map<String, Session> sessions = new HashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final AdminUserRepository admins;
    private final AepUserRepository users;
    private final ImpersonationOrigins origins;
    private final AuditService audit;
    private final Clock clock;
    record Actor(String id, String source) {}
    record Session(Actor actor, String targetId, String product, Instant expiresAt) {}
    public record Started(String handoffUrl) {}
    public record LoggedIn(String token, String targetName, String product, Instant expiresAt) {}
    public record Acting(AepUser user, String actorId, String actorSource) {}

    @org.springframework.beans.factory.annotation.Autowired
    public ImpersonationService(AdminUserRepository admins, AepUserRepository users,
            ImpersonationOrigins origins, AuditService audit) {
        this(admins, users, origins, audit, Clock.systemUTC());
    }
    ImpersonationService(AdminUserRepository admins, AepUserRepository users,
            ImpersonationOrigins origins, AuditService audit, Clock clock) {
        this.admins = admins; this.users = users; this.origins = origins; this.audit = audit; this.clock = clock;
    }
    public synchronized Started start(Authentication auth, String targetId, String product, HttpServletRequest request) {
        if (auth == null || !auth.isAuthenticated()
                || auth.getAuthorities().stream().noneMatch(a -> "ROLE_SUPER_ADMIN".equals(a.getAuthority()))) throw denied();
        Actor actor = admins.findById(auth.getName()).isPresent()
                ? new Actor(auth.getName(), "admin") : new Actor(auth.getName(), "operator");
        requireAdmin(actor);
        AepUser target = target(targetId);
        String origin = origins.get(product);
        cleanup();
        if (tickets.size() + sessions.size() >= 500)
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "IMPERSONATION_BUSY", "附身会话过多，请先退出不用的会话");
        String code = randomValue();
        Session ticket = new Session(actor, target.getId(), product, clock.instant().plusSeconds(60));
        tickets.put(hash(code), ticket);
        record("admin.impersonation.start", ticket, request);
        return new Started(origin + "/auth/callback/impersonation#code=" + code);
    }
    public synchronized LoggedIn exchange(String code, String product, String origin, HttpServletRequest request) {
        if (code == null || !code.matches("[A-Za-z0-9_-]{43}")) throw expired();
        Session ticket = tickets.get(hash(code));
        if (ticket == null || !ticket.expiresAt().isAfter(clock.instant())
                || !ticket.product().equals(product) || !origins.get(product).equals(origin)) throw expired();
        tickets.remove(hash(code)); // 一次消费；权限变化或后续失败只能从后台重新发起。
        requireAdmin(ticket.actor());
        AepUser target = target(ticket.targetId());
        String token = TOKEN_PREFIX + randomValue();
        Session session = new Session(ticket.actor(), ticket.targetId(), product, clock.instant().plusSeconds(1800));
        sessions.put(hash(token), session);
        record("admin.impersonation.enter", session, request);
        return new LoggedIn(token, target.getDisplayName() == null ? target.getUsername() : target.getDisplayName(),
                product, session.expiresAt());
    }
    public synchronized Acting authenticate(String token) {
        Session session = sessions.get(hash(token));
        if (session == null) throw expired();
        if (!session.expiresAt().isAfter(clock.instant())) { sessions.remove(hash(token)); throw expired(); }
        requireAdmin(session.actor());
        return new Acting(target(session.targetId()), session.actor().id(), session.actor().source());
    }
    public synchronized void exit(String token, HttpServletRequest request) {
        if (token == null || !token.startsWith(TOKEN_PREFIX)) return;
        Session session = sessions.remove(hash(token));
        if (session != null) record("admin.impersonation.exit", session, request);
    }
    private void requireAdmin(Actor actor) {
        boolean active = "admin".equals(actor.source())
                ? admins.findById(actor.id()).map(a -> a.getStatus() == AdminUser.AdminStatus.ACTIVE
                        && a.getRole() == AdminUser.AdminRole.SUPER_ADMIN).orElse(false)
                : users.findById(actor.id()).map(u -> u.getStatus() == AepUser.UserStatus.ACTIVE
                        && u.getOperatorRole() == AepUser.OperatorRole.SUPER_ADMIN).orElse(false);
        if (!active) throw denied();
    }
    private AepUser target(String id) {
        AepUser user = id == null ? null : users.findById(id).orElse(null);
        if (user == null || user.getStatus() != AepUser.UserStatus.ACTIVE)
            throw new BusinessException(HttpStatus.FORBIDDEN, "IMPERSONATION_TARGET_DISABLED", "目标用户不存在或已停用，无法登录");
        return user;
    }
    private void cleanup() {
        Instant now = clock.instant();
        tickets.values().removeIf(s -> !s.expiresAt().isAfter(now));
        sessions.values().removeIf(s -> !s.expiresAt().isAfter(now));
    }
    private String randomValue() {
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    private static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private void record(String action, Session session, HttpServletRequest request) {
        audit.recordAuthSuccess(action, session.actor().id(), null,
                "actorSource=" + session.actor().source() + "; target=" + session.targetId() + "; product=" + session.product(), request);
    }
    private static BusinessException denied() {
        return new BusinessException(HttpStatus.FORBIDDEN, "IMPERSONATION_FORBIDDEN", "仅有效的后台超级管理员可以发起附身登录");
    }
    private static BusinessException expired() {
        return new BusinessException(HttpStatus.UNAUTHORIZED, "IMPERSONATION_EXPIRED", "附身登录已失效，请返回后台重新发起");
    }
}

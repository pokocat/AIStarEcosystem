package com.aistareco.aep.service;

import com.aistareco.aep.dap.service.DapAvatarRefResolver;
import com.aistareco.aep.dto.DigitalIpDto;
import com.aistareco.aep.model.DigitalIp;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.DigitalIpRepository;
import com.aistareco.aep.repository.StudioRepository;
import com.aistareco.common.BusinessException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class DigitalIpService {

    /** 孵化默认费用，admin 未配置 incubation.cost 时使用。 */
    private static final long DEFAULT_INCUBATION_COST = 100L;
    private static final String INCUBATION_COST_CONFIG_KEY = "incubation.cost";
    private static final String INCUBATION_LEDGER_REFERENCE_TYPE = "INCUBATION";

    private final DigitalIpRepository ipRepo;
    private final AepUserRepository userRepo;
    private final StudioRepository studioRepo;
    private final CreditService creditService;
    private final PlatformConfigService platformConfigService;
    private final DapAvatarRefResolver dapRefResolver;

    public DigitalIpService(DigitalIpRepository ipRepo,
                            AepUserRepository userRepo,
                            StudioRepository studioRepo,
                            CreditService creditService,
                            PlatformConfigService platformConfigService,
                            DapAvatarRefResolver dapRefResolver) {
        this.ipRepo = ipRepo;
        this.userRepo = userRepo;
        this.studioRepo = studioRepo;
        this.creditService = creditService;
        this.platformConfigService = platformConfigService;
        this.dapRefResolver = dapRefResolver;
    }

    /** 出 wire 统一入口：引用了数字人的艺人实时解析展示名 + 签名图 URL。 */
    private DigitalIpDto toDto(DigitalIp ip) {
        return toDto(ip, null);
    }

    private DigitalIpDto toDto(DigitalIp ip, String studioName) {
        if (ip.getDapAvatarId() == null || ip.getDapAvatarId().isBlank()) {
            return DigitalIpDto.from(ip, studioName);
        }
        DapAvatarRefResolver.View v = dapRefResolver.resolve(ip.getDapAvatarId(), ip.getDapDisplayRef());
        return DigitalIpDto.from(ip, studioName, v.avatarName(), v.displayImageUrl());
    }

    public Page<DigitalIpDto> list(String ownerUserId, String studioId,
                                   DigitalIp.DigitalIpKind kind, Pageable pageable) {
        Page<DigitalIp> page;
        if (ownerUserId != null && !ownerUserId.isBlank()) {
            page = ipRepo.findByOwnerUserId(ownerUserId, pageable);
        } else if (studioId != null && !studioId.isBlank()) {
            page = ipRepo.findByStudioId(studioId, pageable);
        } else if (kind != null) {
            page = ipRepo.findByKind(kind, pageable);
        } else {
            page = ipRepo.findAll(pageable);
        }
        return page.map(this::toDto);
    }

    /**
     * Studio-scoped listing for GET /api/me/digital-ips — parity with admin's studio→artist
     * affiliation. Returns artists where {@code ownerUserId == userId} OR
     * {@code studioId == the user's Studio.id}, de-duplicated and sorted by createdAt desc.
     * <p>
     * Rationale: an agency-kind user sees every artist attached to their studio, not just
     * the ones they personally created. Mirrors AdminDigitalIpController filter semantics.
     */
    public java.util.List<DigitalIpDto> listForUser(String userId) {
        java.util.LinkedHashMap<String, DigitalIp> merged = new java.util.LinkedHashMap<>();
        for (DigitalIp ip : ipRepo.findByOwnerUserId(userId)) {
            merged.put(ip.getId(), ip);
        }
        studioRepo.findByOwnerUserId(userId).ifPresent(studio -> {
            for (DigitalIp ip : ipRepo.findByStudioId(studio.getId())) {
                merged.putIfAbsent(ip.getId(), ip);
            }
        });
        return merged.values().stream()
                .sorted((left, right) -> {
                    Instant a = left.getCreatedAt();
                    Instant b = right.getCreatedAt();
                    if (a == null && b == null) return 0;
                    if (a == null) return 1;
                    if (b == null) return -1;
                    return b.compareTo(a);
                })
                .map(this::toDto)
                .toList();
    }

    public DigitalIpDto findById(String id) {
        return toDto(loadOrThrow(id));
    }

    public DigitalIpDto findOwnedById(String id, String ownerUserId) {
        DigitalIp ip = loadOrThrow(id);
        requireOwner(ip, ownerUserId);
        return toDto(ip);
    }

    @Transactional
    public DigitalIpDto create(Map<String, Object> body, String enforcedOwnerUserId) {
        String ownerUserId = enforcedOwnerUserId != null
                ? enforcedOwnerUserId
                : getString(body, "ownerUserId");
        if (ownerUserId == null || ownerUserId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ownerUserId 必填");
        }
        if (!userRepo.existsById(ownerUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ownerUserId 对应的用户不存在: " + ownerUserId);
        }

        String studioId = getString(body, "studioId");
        if (studioId == null || studioId.isBlank()) {
            // 一个账号对应一个 Studio — 自动从 owner 回填；找不到则 409。
            studioId = studioRepo.findByOwnerUserId(ownerUserId)
                    .map(com.aistareco.aep.model.Studio::getId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                            "当前账号尚未创建工作室，无法创建艺人"));
        } else if (!studioRepo.existsById(studioId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "studioId 对应的工作室不存在: " + studioId);
        }

        // 前端 Artist 类型用 `type` 字段，DTO 输出也是 `type`；同时兼容 `kind`。
        String kindKey = body.containsKey("type") ? "type" : "kind";
        Instant now = Instant.now();
        DigitalIp ip = DigitalIp.builder()
                .id(UUID.randomUUID().toString())
                .name(requireString(body, "name"))
                .kind(parseEnum(body, kindKey, DigitalIp.DigitalIpKind.class, DigitalIp.DigitalIpKind.SINGER))
                .quality(parseEnum(body, "quality", DigitalIp.Quality.class, DigitalIp.Quality.COMMON))
                .status(parseEnum(body, "status", DigitalIp.DigitalIpStatus.class, DigitalIp.DigitalIpStatus.TRAINEE))
                .level(getInt(body, "level", 1))
                .exp(getInt(body, "exp", 0))
                .maxExp(getInt(body, "maxExp", 100))
                .avatarUrl(getString(body, "avatar"))
                .bio(getString(body, "bio"))
                .studioId(studioId)
                .ownerUserId(ownerUserId)
                .createdAt(now)
                .updatedAt(now)
                .build();

        applyTalents(ip, asMap(body.get("talents")));
        applyStats(ip, asMap(body.get("stats")));
        applyDomains(ip, body.get("domains"));
        applyIncubationParams(ip, body.get("incubationParams"));

        // 孵化扣积分：余额不足会抛 402 PAYMENT_REQUIRED，事务回滚不创建艺人。
        long incubationCost = platformConfigService.getLong(INCUBATION_COST_CONFIG_KEY, DEFAULT_INCUBATION_COST);
        if (incubationCost > 0) {
            creditService.debit(ownerUserId, incubationCost,
                    INCUBATION_LEDGER_REFERENCE_TYPE,
                    ip.getId(),
                    "孵化新艺人：" + ip.getName());
        }

        return toDto(ipRepo.save(ip));
    }

    /**
     * v0.60 收敛：从 AiAvatar 引入数字人 → 创建艺人壳（引用不复制）。
     * - 数字人必须本人所有、有定妆照、不在回收站；
     * - 形象/展示名实时跟随数字人，{@code avatarUrl} 不落值；
     * - 不扣孵化积分（形象生成费用已在 AiAvatar 端结算）；
     * - 同一数字人可跨 kind 多次引入（music 引入为 singer、drama 引入为 actor，各自独立展示图），
     *   但同 (owner, dapAvatarId, kind) 仅允许一个艺人壳 —— 重复引入 409 DAP_AVATAR_ALREADY_IMPORTED。
     */
    @Transactional
    public DigitalIpDto importFromAvatar(Map<String, Object> body, String ownerUserId) {
        var avatar = dapRefResolver.requireUsable(ownerUserId, requireString(body, "dapAvatarId"));

        var kind = parseEnum(body, "type", DigitalIp.DigitalIpKind.class, DigitalIp.DigitalIpKind.SINGER);
        ipRepo.findFirstByOwnerUserIdAndDapAvatarIdAndKind(ownerUserId, avatar.getId(), kind)
                .ifPresent(existing -> {
                    throw new BusinessException(HttpStatus.CONFLICT, "DAP_AVATAR_ALREADY_IMPORTED",
                            "该数字人已引入为艺人「" + existing.getName() + "」，请勿重复引入；如需调整可在该艺人详情里更换展示图");
                });

        String displayRef = getString(body, "dapDisplayRef");
        if (displayRef == null || displayRef.isBlank()) {
            displayRef = null;
        } else {
            dapRefResolver.requireRefOfAvatar(avatar.getId(), displayRef);
        }

        String studioId = studioRepo.findByOwnerUserId(ownerUserId)
                .map(com.aistareco.aep.model.Studio::getId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                        "当前账号尚未创建工作室，无法引入数字人"));

        String name = getString(body, "name");
        if (name == null || name.isBlank()) name = avatar.getName();

        Instant now = Instant.now();
        DigitalIp ip = DigitalIp.builder()
                .id(UUID.randomUUID().toString())
                .name(name)
                .kind(kind)
                .quality(parseEnum(body, "quality", DigitalIp.Quality.class, DigitalIp.Quality.COMMON))
                .status(DigitalIp.DigitalIpStatus.ACTIVE) // 引入即就绪（区别于孵化 TRAINEE）
                .level(getInt(body, "level", 1))
                .exp(0)
                .maxExp(100)
                // bio 兜底为空串：TS Artist.bio 是必填 string，下游有 bio.split 类派生逻辑
                .bio(Objects.requireNonNullElse(getString(body, "bio"), ""))
                .dapAvatarId(avatar.getId())
                .dapDisplayRef(displayRef)
                .studioId(studioId)
                .ownerUserId(ownerUserId)
                .createdAt(now)
                .updatedAt(now)
                .build();

        return toDto(ipRepo.save(ip));
    }

    /**
     * v0.61 反向「应用于」：数字人被本人哪些 music / drama 艺人壳引用
     * （aiavatar 详情页展示；调用方需先校验数字人归属）。
     */
    public java.util.List<com.aistareco.aep.dap.dto.DapDtos.AvatarReferenceDto> listAvatarReferences(
            String ownerUserId, String dapAvatarId) {
        return ipRepo.findByOwnerUserIdAndDapAvatarIdOrderByCreatedAtAsc(ownerUserId, dapAvatarId)
                .stream().map(com.aistareco.aep.dap.dto.DapDtos.AvatarReferenceDto::from).toList();
    }

    public DigitalIpDto update(String id, Map<String, Object> body) {
        return toDto(applyUpdate(loadOrThrow(id), body));
    }

    public DigitalIpDto updateOwned(String id, String ownerUserId, Map<String, Object> body) {
        DigitalIp ip = loadOrThrow(id);
        requireOwner(ip, ownerUserId);
        // Owner cannot re-assign ownership.
        body.remove("ownerUserId");
        return toDto(applyUpdate(ip, body));
    }

    public void delete(String id) {
        if (!ipRepo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Digital IP not found: " + id);
        }
        ipRepo.deleteById(id);
    }

    public void deleteOwned(String id, String ownerUserId) {
        DigitalIp ip = loadOrThrow(id);
        requireOwner(ip, ownerUserId);
        ipRepo.delete(ip);
    }

    // ── internal ────────────────────────────────────────────────────────────

    private DigitalIp applyUpdate(DigitalIp ip, Map<String, Object> body) {
        if (body.containsKey("name")) ip.setName(getString(body, "name"));
        // `type` 与 `kind` 均可（前端 Artist.type → 后端 DigitalIp.kind）
        if (body.containsKey("type")) ip.setKind(DigitalIp.DigitalIpKind.valueOf(getString(body, "type").toUpperCase(Locale.ROOT)));
        else if (body.containsKey("kind")) ip.setKind(DigitalIp.DigitalIpKind.valueOf(getString(body, "kind").toUpperCase(Locale.ROOT)));
        if (body.containsKey("quality")) ip.setQuality(DigitalIp.Quality.valueOf(getString(body, "quality").toUpperCase(Locale.ROOT)));
        if (body.containsKey("status")) ip.setStatus(DigitalIp.DigitalIpStatus.valueOf(getString(body, "status").toUpperCase(Locale.ROOT)));
        if (body.containsKey("level")) ip.setLevel(getInt(body, "level", ip.getLevel()));
        if (body.containsKey("exp")) ip.setExp(getInt(body, "exp", ip.getExp()));
        if (body.containsKey("maxExp")) ip.setMaxExp(getInt(body, "maxExp", ip.getMaxExp()));
        if (body.containsKey("avatar")) ip.setAvatarUrl(getString(body, "avatar"));
        if (body.containsKey("bio")) ip.setBio(getString(body, "bio"));

        // 展示图指针可改可清（清空 = 跟随定妆照）；数字人引用本身（dapAvatarId）不可改。
        if (body.containsKey("dapDisplayRef")) {
            String ref = getString(body, "dapDisplayRef");
            if (ref == null || ref.isBlank()) {
                ip.setDapDisplayRef(null);
            } else {
                if (ip.getDapAvatarId() == null || ip.getDapAvatarId().isBlank()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该艺人未引用数字人，无法设置展示图");
                }
                dapRefResolver.requireRefOfAvatar(ip.getDapAvatarId(), ref);
                ip.setDapDisplayRef(ref);
            }
        }

        if (body.containsKey("studioId")) {
            String studioId = getString(body, "studioId");
            if (studioId == null || studioId.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "studioId 不可为空");
            }
            if (!studioRepo.existsById(studioId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "studioId 对应的工作室不存在: " + studioId);
            }
            ip.setStudioId(studioId);
        }

        if (body.containsKey("ownerUserId")) {
            String ownerUserId = getString(body, "ownerUserId");
            if (ownerUserId == null || ownerUserId.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ownerUserId 不可为空");
            }
            if (!userRepo.existsById(ownerUserId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ownerUserId 对应的用户不存在: " + ownerUserId);
            }
            ip.setOwnerUserId(ownerUserId);
        }

        if (body.containsKey("talents")) applyTalents(ip, asMap(body.get("talents")));
        if (body.containsKey("stats")) applyStats(ip, asMap(body.get("stats")));
        if (body.containsKey("domains")) applyDomains(ip, body.get("domains"));
        if (body.containsKey("incubationParams")) applyIncubationParams(ip, body.get("incubationParams"));
        if (body.containsKey("lastActive")) ip.setLastActiveAt(parseInstant(body.get("lastActive")));

        ip.setUpdatedAt(Instant.now());
        return ipRepo.save(ip);
    }

    private void applyTalents(DigitalIp ip, Map<String, Object> talents) {
        if (talents == null) return;
        if (talents.containsKey("singing")) ip.setTalentSinging(toInt(talents.get("singing"), ip.getTalentSinging()));
        if (talents.containsKey("acting")) ip.setTalentActing(toInt(talents.get("acting"), ip.getTalentActing()));
        if (talents.containsKey("dancing")) ip.setTalentDancing(toInt(talents.get("dancing"), ip.getTalentDancing()));
        if (talents.containsKey("hosting")) ip.setTalentHosting(toInt(talents.get("hosting"), ip.getTalentHosting()));
        if (talents.containsKey("comedy")) ip.setTalentComedy(toInt(talents.get("comedy"), ip.getTalentComedy()));
        if (talents.containsKey("variety")) ip.setTalentVariety(toInt(talents.get("variety"), ip.getTalentVariety()));
    }

    private void applyStats(DigitalIp ip, Map<String, Object> stats) {
        if (stats == null) return;
        if (stats.containsKey("songs")) ip.setStatSongs(toInt(stats.get("songs"), ip.getStatSongs()));
        if (stats.containsKey("dramas")) ip.setStatDramas(toInt(stats.get("dramas"), ip.getStatDramas()));
        if (stats.containsKey("ads")) ip.setStatAds(toInt(stats.get("ads"), ip.getStatAds()));
        if (stats.containsKey("variety")) ip.setStatVariety(toInt(stats.get("variety"), ip.getStatVariety()));
        if (stats.containsKey("fans")) ip.setStatFans(toLong(stats.get("fans"), ip.getStatFans()));
        if (stats.containsKey("revenue")) ip.setStatRevenueCredits(toLong(stats.get("revenue"), ip.getStatRevenueCredits()));
        if (stats.containsKey("monthlyRevenue")) ip.setStatMonthlyRevenueCredits(toLong(stats.get("monthlyRevenue"), ip.getStatMonthlyRevenueCredits()));
        if (stats.containsKey("popularity")) ip.setStatPopularity(toInt(stats.get("popularity"), ip.getStatPopularity()));
        if (stats.containsKey("endorsements")) ip.setStatEndorsements(toInt(stats.get("endorsements"), ip.getStatEndorsements()));
        if (stats.containsKey("commercialValue")) ip.setStatCommercialValueCredits(toLong(stats.get("commercialValue"), ip.getStatCommercialValueCredits()));
    }

    /**
     * 合并孵化参数 —— 不覆盖旧键，传入 {@code null} 则整体清空。
     * 前端 PATCH/PUT 可以只传需要更新的键，例如 {@code {"age": 22}}。
     */
    private void applyIncubationParams(DigitalIp ip, Object raw) {
        if (raw == null) {
            ip.setIncubationParams(null);
            return;
        }
        Map<String, Object> incoming = asMap(raw);
        if (incoming == null) return;
        Map<String, Object> current = ip.getIncubationParams();
        if (current == null) {
            ip.setIncubationParams(new java.util.LinkedHashMap<>(incoming));
        } else {
            current.putAll(incoming);
            ip.setIncubationParams(current);
        }
    }

    @SuppressWarnings("unchecked")
    private void applyDomains(DigitalIp ip, Object raw) {
        if (raw == null) {
            ip.setDomains(null);
            return;
        }
        if (raw instanceof java.util.List<?> list) {
            ip.setDomains(list.stream().map(Object::toString).toList());
        }
    }

    private DigitalIp loadOrThrow(String id) {
        return ipRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Digital IP not found: " + id));
    }

    private void requireOwner(DigitalIp ip, String ownerUserId) {
        if (ownerUserId == null || !ownerUserId.equals(ip.getOwnerUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作该 Digital IP");
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object raw) {
        return raw instanceof Map<?, ?> map ? (Map<String, Object>) map : null;
    }

    private String getString(Map<String, Object> body, String key) {
        Object val = body.get(key);
        return val != null ? val.toString() : null;
    }

    private String requireString(Map<String, Object> body, String key) {
        String val = getString(body, key);
        if (val == null || val.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, key + " 必填");
        }
        return val;
    }

    private int getInt(Map<String, Object> body, String key, int defaultVal) {
        return toInt(body.get(key), defaultVal);
    }

    private static int toInt(Object raw, int defaultVal) {
        if (raw == null) return defaultVal;
        if (raw instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(raw.toString().trim());
        } catch (NumberFormatException ex) {
            return defaultVal;
        }
    }

    private static long toLong(Object raw, long defaultVal) {
        if (raw == null) return defaultVal;
        if (raw instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(raw.toString().trim());
        } catch (NumberFormatException ex) {
            return defaultVal;
        }
    }

    private static Instant parseInstant(Object raw) {
        if (raw == null) return null;
        if (raw instanceof Number n) return Instant.ofEpochMilli(n.longValue());
        try {
            return Instant.parse(raw.toString());
        } catch (Exception ex) {
            return null;
        }
    }

    private <E extends Enum<E>> E parseEnum(Map<String, Object> body, String key,
                                             Class<E> enumClass, E defaultVal) {
        Object val = body.get(key);
        if (val == null) return defaultVal;
        try {
            return Enum.valueOf(enumClass, val.toString().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return defaultVal;
        }
    }
}

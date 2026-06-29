package com.aistareco.aep.service.payment;

import com.aistareco.aep.dto.AdminPaymentChannelUpsertDto;
import com.aistareco.aep.dto.PaymentChannelConfigDto;
import com.aistareco.aep.model.PaymentChannelConfig;
import com.aistareco.aep.repository.PaymentChannelConfigRepository;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 支付渠道运行时配置读写（v0.94 多渠道直连）。
 *
 * <ul>
 *   <li>读：{@link #credentials} 解密机密供网关使用；{@link #isEnabled} / {@link #version}；
 *       {@link #listForAdmin} 出脱敏视图。</li>
 *   <li>写：{@link #upsert} 合并机密（空=保留、{@code __CLEAR__}=清空）→ 整块 AES-GCM 加密落库、version 自增。</li>
 *   <li>种子：{@link #seedFromEnvIfAbsent} 启动期把 env（旧 PaymentProperties）的渠道凭据迁进 DB，
 *       让既有 env 部署平滑过渡；之后以 admin 后台为准。</li>
 * </ul>
 *
 * §8.0：机密缺失时网关下单期抛 503，绝不静默回退 shadow（本服务只负责存取，不做兜底）。
 */
@Service
public class PaymentChannelConfigService {

    private static final Logger log = LoggerFactory.getLogger(PaymentChannelConfigService.class);
    /** 清空某机密字段的显式标记（前端留空=保留，传此值=清空）。 */
    public static final String CLEAR_TOKEN = "__CLEAR__";

    private final PaymentChannelConfigRepository repo;
    private final ObjectMapper om;

    public PaymentChannelConfigService(PaymentChannelConfigRepository repo, ObjectMapper om) {
        this.repo = repo;
        this.om = om;
    }

    // ── 读 ────────────────────────────────────────────────────────────────────

    public Optional<PaymentChannelConfig> find(String code) {
        return repo.findById(code);
    }

    public boolean isEnabled(String code) {
        return repo.findById(code).map(PaymentChannelConfig::isEnabled).orElse(false);
    }

    /** 渠道更新版本（网关据此判断是否需要重配 SDK；不存在返回 0）。 */
    public int version(String code) {
        return repo.findById(code).map(PaymentChannelConfig::getVersion).orElse(0);
    }

    /** 解密机密 map（不存在 / 空 → 空 map）。仅网关内部使用，绝不出 wire。 */
    public Map<String, String> credentials(String code) {
        return repo.findById(code).map(this::decryptCreds).orElseGet(LinkedHashMap::new);
    }

    /** 必填机密是否齐全（可下单）。 */
    public boolean isConfigured(String code) {
        PaymentChannelCatalog.ChannelMeta meta = PaymentChannelCatalog.of(code);
        if (meta == null) return false;
        Map<String, String> creds = credentials(code);
        return meta.requiredCreds().stream().allMatch(k -> {
            String v = creds.get(k);
            return v != null && !v.isBlank();
        });
    }

    public List<PaymentChannelConfig> listEnabled() {
        return repo.findByEnabledTrueOrderBySortOrderAsc();
    }

    /**
     * admin 视图：把 DB 行与目录（{@link PaymentChannelCatalog#CONFIGURABLE}）合并 —— 即便某渠道
     * 尚无配置也列出空表单。机密一律脱敏（已配置→sk-…XXXX，未配置→空串）。
     */
    public List<PaymentChannelConfigDto> listForAdmin() {
        List<PaymentChannelConfigDto> out = new ArrayList<>();
        for (PaymentChannelCatalog.ChannelMeta meta : PaymentChannelCatalog.CONFIGURABLE) {
            PaymentChannelConfig row = repo.findById(meta.code()).orElse(null);
            Map<String, String> stored = row == null ? Map.of() : decryptCreds(row);
            Map<String, String> masked = new LinkedHashMap<>();
            for (String key : meta.allCreds()) {
                String v = stored.get(key);
                masked.put(key, (v == null || v.isBlank()) ? "" : AepCryptoUtil.mask(v));
            }
            out.add(new PaymentChannelConfigDto(
                    meta.code(),
                    row != null && row.getLabel() != null ? row.getLabel() : meta.label(),
                    row != null && row.isEnabled(),
                    row != null && row.isSandbox(),
                    row != null ? row.getSortOrder() : 0,
                    row != null && row.getDefaultWayCode() != null ? row.getDefaultWayCode() : meta.defaultWayCode(),
                    isConfigured(meta.code()),
                    masked,
                    row != null ? row.getUpdatedAt() : null,
                    row != null ? row.getUpdatedBy() : null));
        }
        return out;
    }

    // ── 写 ────────────────────────────────────────────────────────────────────

    @Transactional
    public PaymentChannelConfigDto upsert(String code, AdminPaymentChannelUpsertDto dto, String updatedBy) {
        PaymentChannelCatalog.ChannelMeta meta = PaymentChannelCatalog.of(code);
        if (meta == null || !PaymentChannelCatalog.CONFIGURABLE.contains(meta)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PAYMENT_CHANNEL_UNKNOWN", "未知支付渠道：" + code);
        }
        PaymentChannelConfig row = repo.findById(code).orElseGet(() -> PaymentChannelConfig.builder()
                .code(code)
                .label(meta.label())
                .defaultWayCode(meta.defaultWayCode())
                .version(0)
                .build());

        // 机密合并：空/缺=保留原值；__CLEAR__=清空；其余=覆盖。只接受目录声明的字段。
        Map<String, String> creds = decryptCreds(row);
        if (dto.creds() != null) {
            for (String key : meta.allCreds()) {
                if (!dto.creds().containsKey(key)) continue;
                String v = dto.creds().get(key);
                if (v == null || v.isBlank()) continue;            // 留空 → 保留原值
                if (CLEAR_TOKEN.equals(v)) { creds.remove(key); continue; }
                creds.put(key, v.trim());
            }
        }
        row.setCredsEncrypted(encryptCreds(creds));

        if (dto.enabled() != null) row.setEnabled(dto.enabled());
        if (dto.sandbox() != null) row.setSandbox(dto.sandbox());
        if (dto.label() != null && !dto.label().isBlank()) row.setLabel(dto.label().trim());
        if (dto.sortOrder() != null) row.setSortOrder(dto.sortOrder());
        if (dto.defaultWayCode() != null && !dto.defaultWayCode().isBlank()) row.setDefaultWayCode(dto.defaultWayCode().trim());

        // 启用前必须机密齐全（§8.0：不允许启用一个跑不起来的渠道）
        if (row.isEnabled() && !requiredPresent(meta, creds)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PAYMENT_CHANNEL_INCOMPLETE",
                    "启用「" + meta.label() + "」前请先填齐必填机密：" + String.join(" / ", meta.requiredCreds()));
        }

        row.setVersion(row.getVersion() + 1);
        row.setUpdatedAt(Instant.now());
        row.setUpdatedBy(updatedBy == null ? "system" : updatedBy);
        repo.save(row);
        log.info("[pay][config] upsert channel={} enabled={} sandbox={} configured={} by={}",
                code, row.isEnabled(), row.isSandbox(), requiredPresent(meta, creds), row.getUpdatedBy());
        return listForAdmin().stream().filter(d -> d.code().equals(code)).findFirst().orElseThrow();
    }

    /**
     * 启动期种子：若 DB 尚无该渠道行且 env 提供了凭据，迁进 DB（enabled = env driver 选中该渠道）。
     * 既有 env 部署平滑过渡；之后 admin 后台为准（seed 不覆盖已存在行）。
     */
    @Transactional
    public void seedFromEnvIfAbsent(String code, boolean enabled, Map<String, String> creds, String label, String defaultWayCode, boolean sandbox) {
        if (repo.existsById(code)) return;
        PaymentChannelCatalog.ChannelMeta meta = PaymentChannelCatalog.of(code);
        Map<String, String> clean = new LinkedHashMap<>();
        if (creds != null) creds.forEach((k, v) -> { if (v != null && !v.isBlank()) clean.put(k, v.trim()); });
        boolean configured = meta != null && requiredPresent(meta, clean);
        PaymentChannelConfig row = PaymentChannelConfig.builder()
                .code(code)
                .enabled(enabled && configured)   // 只有凭据齐全才随 env 自动启用
                .sandbox(sandbox)
                .label(label != null ? label : (meta != null ? meta.label() : code))
                .sortOrder("alipay".equals(code) ? 10 : 20)
                .defaultWayCode(defaultWayCode != null ? defaultWayCode : (meta != null ? meta.defaultWayCode() : null))
                .credsEncrypted(encryptCreds(clean))
                .version(1)
                .updatedAt(Instant.now())
                .updatedBy("seed")
                .build();
        repo.save(row);
        log.info("[pay][config] seeded channel={} from env (enabled={} configured={})", code, row.isEnabled(), configured);
    }

    // ── 内部 ──────────────────────────────────────────────────────────────────

    private boolean requiredPresent(PaymentChannelCatalog.ChannelMeta meta, Map<String, String> creds) {
        return meta.requiredCreds().stream().allMatch(k -> {
            String v = creds.get(k);
            return v != null && !v.isBlank();
        });
    }

    private Map<String, String> decryptCreds(PaymentChannelConfig row) {
        String enc = row.getCredsEncrypted();
        if (enc == null || enc.isBlank()) return new LinkedHashMap<>();
        try {
            String json = AepCryptoUtil.decrypt(enc);
            if (json == null || json.isBlank()) return new LinkedHashMap<>();
            return om.readValue(json, new TypeReference<LinkedHashMap<String, String>>() {});
        } catch (Exception e) {
            log.error("[pay][config] decrypt creds failed channel={}: {}", row.getCode(), e.getMessage());
            return new LinkedHashMap<>();
        }
    }

    private String encryptCreds(Map<String, String> creds) {
        try {
            return AepCryptoUtil.encrypt(om.writeValueAsString(creds == null ? Map.of() : creds));
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "PAYMENT_CONFIG_ENCRYPT_FAILED", "支付配置加密失败");
        }
    }
}

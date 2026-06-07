package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.service.CelebrityActionPricingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * v0.53：dap（数字人资产平台）动作单价 —— 后台可配。
 *
 * 解析顺序：PlatformConfig {@code celebrity.action-pricing} 表中的 {@code dap.*} 行
 * （admin「权益扣减配置 → 动作单价」页可改，1min 缓存 + PUT 立即生效）
 * → 缺失 / 为 0 时 fallback 到 {@code aep.dap.pricing.*}（application.yml / env，部署默认价）。
 *
 * 注意：刻意 **不**把 dap.* 写进 {@link CelebrityActionPricingService} 的默认表 ——
 * 否则默认表的常量值会覆盖 env 配置（AEP_DAP_PRICING_* 自定义的部署将失效）。
 * 因此 admin 页 dap 行语义为「0 = 走部署默认价」。
 */
@Service
public class DapPricingService {

    private static final Logger log = LoggerFactory.getLogger(DapPricingService.class);

    public static final String ACTION_GENERATE = "dap.generate";
    public static final String ACTION_GENERATE_UPLOAD = "dap.generate-upload";
    public static final String ACTION_ITERATE = "dap.iterate";
    public static final String ACTION_WARP = "dap.warp";
    public static final String ACTION_LOOK = "dap.look";
    public static final String ACTION_DERIVE_ATLAS = "dap.derive-atlas";
    public static final String ACTION_DERIVE_EXPR = "dap.derive-expr";
    public static final String ACTION_DERIVE_SCENE = "dap.derive-scene";
    public static final String ACTION_DERIVE_WARD = "dap.derive-ward";
    public static final String ACTION_DERIVE_D3 = "dap.derive-d3";
    public static final String ACTION_DERIVE_VIDEO = "dap.derive-video";
    public static final String ACTION_VOICE_CLONE = "dap.voice-clone";

    private final DapProperties props;
    private final CelebrityActionPricingService actionPricing;

    public DapPricingService(DapProperties props, CelebrityActionPricingService actionPricing) {
        this.props = props;
        this.actionPricing = actionPricing;
    }

    /** 单价解析：后台配置（>0）优先，否则 env/yml 默认。读失败不阻断业务，回默认价。 */
    public long of(String action, long envDefault) {
        try {
            Long v = actionPricing.creditPriceOf(action);
            return v != null ? v : envDefault;
        } catch (Exception e) {
            log.warn("[dap-pricing] read action-pricing failed for {}: {} (fallback env default {})",
                    action, e.getMessage(), envDefault);
            return envDefault;
        }
    }

    public long generate()       { return of(ACTION_GENERATE, props.getPricing().getGenerate()); }
    public long generateUpload() { return of(ACTION_GENERATE_UPLOAD, props.getPricing().getGenerateUpload()); }
    public long iterate()        { return of(ACTION_ITERATE, props.getPricing().getIterate()); }
    public long warp()           { return of(ACTION_WARP, props.getPricing().getWarp()); }
    public long look()           { return of(ACTION_LOOK, props.getPricing().getLook()); }
    public long voiceClone()     { return of(ACTION_VOICE_CLONE, props.getPricing().getVoiceClone()); }

    public long derive(String derivKey) {
        DapProperties.Pricing p = props.getPricing();
        return switch (derivKey == null ? "" : derivKey) {
            case "atlas" -> of(ACTION_DERIVE_ATLAS, p.getDeriveAtlas());
            case "expr" -> of(ACTION_DERIVE_EXPR, p.getDeriveExpr());
            case "scene" -> of(ACTION_DERIVE_SCENE, p.getDeriveScene());
            case "ward" -> of(ACTION_DERIVE_WARD, p.getDeriveWard());
            case "d3" -> of(ACTION_DERIVE_D3, p.getDeriveD3());
            case "video" -> of(ACTION_DERIVE_VIDEO, p.getDeriveVideo());
            default -> 0;
        };
    }
}

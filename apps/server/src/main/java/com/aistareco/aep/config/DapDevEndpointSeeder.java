package com.aistareco.aep.config;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.model.AiAppBinding;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiAppBindingRepository;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.common.AepCryptoUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * 数字人资产平台（dap）专用 dev 种子器：开机自动把 DAP 三个用途
 * （DAP_PERSONA / DAP_IMAGE / DAP_VIDEO）各绑定到一个本地/真实多模态引擎端点，
 * 让 {@code dap-dev.sh} / {@code dap-verify.sh} 无需手动进 admin 后台配置即可端到端跑通。
 *
 * <p>仅当 {@code aep.dap.dev-seed.enabled=true} 时运行（生产默认 false → 不跑）。
 * 运行时 {@link com.aistareco.aep.dap.service.DapMultimodalClient} 始终只读 admin 端点
 * （无 env 兜底）—— 本 seeder 只是把端点 + 绑定「种」进 admin 表，是 dev 便捷初始化，
 * 不是运行时降级路径。
 *
 * <p>幂等：端点按 id、绑定按 purpose 查重，已存在则跳过。运营在后台配过真实端点 /
 * 绑过用途后，本 seeder 不会抢路由（先到先得）。
 *
 * <p>chat / image / video 用三个独立端点，是因为真实多模态服务商（如 Agnes AI）三类
 * 能力的 model id 不同（chat=…-flash / image=…-image / video=…-video）；指向本地 fake
 * 时 model 可任意（fake 忽略）。配置见 {@code aep.dap.dev-seed.*}。
 */
@Component
@Order(57)
@ConditionalOnProperty(prefix = "aep.dap.dev-seed", name = "enabled", havingValue = "true")
public class DapDevEndpointSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DapDevEndpointSeeder.class);

    private final AiModelEndpointRepository endpointRepo;
    private final AiAppBindingRepository bindingRepo;
    private final DapProperties props;

    public DapDevEndpointSeeder(AiModelEndpointRepository endpointRepo,
                                AiAppBindingRepository bindingRepo,
                                DapProperties props) {
        this.endpointRepo = endpointRepo;
        this.bindingRepo = bindingRepo;
        this.props = props;
    }

    @Override
    public void run(String... args) {
        try {
            DapProperties.DevSeed cfg = props.getDevSeed();
            Instant now = Instant.now();
            String encKey = AepCryptoUtil.encrypt(cfg.getApiKey());

            int boundCount = 0;
            boundCount += seedOne("dev-dap-chat", "数字人 · 人设/翻译（dev 种子）",
                    cfg.getBaseUrl(), encKey, cfg.getChatModel(), AiModelPurpose.DAP_PERSONA, now);
            boundCount += seedOne("dev-dap-image", "数字人 · 图片生成（dev 种子）",
                    cfg.getBaseUrl(), encKey, cfg.getImageModel(), AiModelPurpose.DAP_IMAGE, now);
            boundCount += seedOne("dev-dap-video", "数字人 · 视频生成（dev 种子）",
                    cfg.getBaseUrl(), encKey, cfg.getVideoModel(), AiModelPurpose.DAP_VIDEO, now);

            if (boundCount > 0) {
                log.warn("⚙️  DapDevEndpointSeeder：已为 {} 个数字人用途绑定到 dev 引擎 baseUrl={}（仅联调用，运行时仍只读 admin 端点）",
                        boundCount, cfg.getBaseUrl());
            }
        } catch (Exception e) {
            log.error("DapDevEndpointSeeder failed: {}", e.getMessage(), e);
        }
    }

    /**
     * upsert dev 自有端点（dev-dap-* id，每次开机刷新 baseUrl/key/model，便于 fake↔real 切换）
     * + 仅在 purpose 未绑定时新增绑定（绝不覆盖 admin 已绑）。返回新增绑定数（0 或 1）。
     */
    private int seedOne(String endpointId, String name, String baseUrl, String encKey,
                        String model, AiModelPurpose purpose, Instant now) {
        AiModelEndpoint e = endpointRepo.findById(endpointId).orElse(null);
        if (e == null) {
            endpointRepo.save(AiModelEndpoint.builder()
                    .id(endpointId)
                    .name(name)
                    .providerType(AiModelProviderType.OPENAI)
                    .baseUrl(baseUrl)
                    .upstreamApiKeyEncrypted(encKey)
                    .model(model)
                    .enabled(true)
                    .createdAt(now)
                    .updatedAt(now)
                    .build());
        } else {
            // dev-seed 自有端点：刷新落地信息，让同一持久库上 fake↔real 切换即时生效
            e.setBaseUrl(baseUrl);
            e.setUpstreamApiKeyEncrypted(encKey);
            e.setModel(model);
            e.setEnabled(true);
            e.setUpdatedAt(now);
            endpointRepo.save(e);
        }
        if (bindingRepo.findById(purpose).isEmpty()) {
            bindingRepo.save(AiAppBinding.builder()
                    .purpose(purpose)
                    .endpointId(endpointId)
                    .updatedAt(now)
                    .build());
            return 1;
        }
        return 0;
    }
}

package com.aistareco.aep.dap.service.modelink;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.common.BusinessException;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.Arrays;

/**
 * modelink 网关 facade（业务侧唯一依赖）。
 *
 * <p>路由（§8.0 禁止静默降级）：
 * <ol>
 *   <li>用途 {@code DAP_REAL_AVATAR} 已在后台绑定可用端点 → {@link HttpModelinkGateway}（真实调用）；</li>
 *   <li>未配置且 {@code aep.dap.modelink.allow-mock=true}（dev 默认） → {@link MockModelinkGateway}，
 *       落库行打 {@code mock=true}；</li>
 *   <li>未配置且不允许 mock（生产默认） → 503 {@code DAP_MODELINK_NOT_CONFIGURED}，
 *       不建会话、不落假数据。</li>
 * </ol>
 */
@Service
public class ModelinkService implements ModelinkGateway {

    private static final Logger log = LoggerFactory.getLogger(ModelinkService.class);

    private final HttpModelinkGateway httpGateway;
    private final MockModelinkGateway mockGateway;
    private final DapProperties props;
    private final Environment env;

    public ModelinkService(HttpModelinkGateway httpGateway,
                           MockModelinkGateway mockGateway,
                           DapProperties props,
                           Environment env) {
        this.httpGateway = httpGateway;
        this.mockGateway = mockGateway;
        this.props = props;
        this.env = env;
    }

    @PostConstruct
    void warnIfProductionLike() {
        boolean prodLike = env != null && Arrays.stream(env.getActiveProfiles())
                .anyMatch(p -> p.equalsIgnoreCase("mysql") || p.equalsIgnoreCase("prod") || p.equalsIgnoreCase("production"));
        if (prodLike && props.getModelink().isAllowMock()) {
            log.error("==========================================================================");
            log.error("⚠️  DAP MODELINK ALLOW-MOCK = true（生产 profile 下真人刷脸认证会走内存 mock）");
            log.error("⚠️  刷脸结果、素材审核结论均为假数据，绝不可用于真实肖像授权取证");
            log.error("⚠️  生产必须设置 AEP_DAP_MODELINK_ALLOW_MOCK=false 并在后台绑定七牛 modelink 端点");
            log.error("==========================================================================");
        }
    }

    /** 当前是否走 mock 网关（未配置端点 + 允许降级）。 */
    public boolean isMockMode() {
        return !httpGateway.isConfigured() && props.getModelink().isAllowMock();
    }

    /** 已绑定端点的模型 id；mock 模式下返回 "mock-model"。 */
    public String boundModel() {
        String m = httpGateway.boundModel();
        if (m != null) return m;
        if (props.getModelink().isAllowMock()) return "mock-model";
        throw notConfigured();
    }

    private ModelinkGateway gateway() {
        if (httpGateway.isConfigured()) return httpGateway;
        if (props.getModelink().isAllowMock()) return mockGateway;
        throw notConfigured();
    }

    private static BusinessException notConfigured() {
        return new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "DAP_MODELINK_NOT_CONFIGURED",
                "未配置素材合规服务：请在管理后台「AI 应用绑定」把用途「数字资产 · 真人素材与授权」绑定七牛 modelink 端点");
    }

    // ── 委派 ───────────────────────────────────────────────────

    @Override
    public GroupState createGroup(String kind, String name, String model, String callbackUrl) {
        return gateway().createGroup(kind, name, model, callbackUrl);
    }

    @Override
    public GroupState getGroup(String qgroupid) {
        return gateway().getGroup(qgroupid);
    }

    @Override
    public void visualValidate(String qgroupid, String resultCode, String bytedToken) {
        gateway().visualValidate(qgroupid, resultCode, bytedToken);
    }

    @Override
    public AssetState createAsset(String type, String name, String model, String url, String qgroupid) {
        return gateway().createAsset(type, name, model, url, qgroupid);
    }

    @Override
    public AssetState getAsset(String qassetid) {
        return gateway().getAsset(qassetid);
    }
}

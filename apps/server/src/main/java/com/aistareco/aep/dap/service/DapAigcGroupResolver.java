package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.dap.model.DapMaterialGroup;
import com.aistareco.aep.dap.repository.DapMaterialGroupRepository;
import com.aistareco.aep.dap.service.modelink.ModelinkGateway.GroupState;
import com.aistareco.aep.dap.service.modelink.ModelinkService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.UUID;

/**
 * 数字人专属 aigc 分组的解析器（v0.105-补丁）。
 *
 * <p>v0.105 首版让 AI 原创人物的定妆图**不传 group_id**，由平台落进账号默认组。本轮按产品要求改成
 * 「数字人业务自己的一个专属 aigc 分组」——素材归属清晰，后续按组做统计 / 清理才有抓手。
 *
 * <p>三条边界：
 * <ol>
 *   <li><b>账号级共享</b>：所有用户的 AI 人物送审共用同一个分组，所以本地行的 owner 是约定的系统
 *       owner {@link #PLATFORM_OWNER}（沿用仓库既有的 {@code __official__} / {@code __admin__} 风格），
 *       查询一律**不按 owner 过滤**，走确定性去重键。</li>
 *   <li><b>幂等</b>：去重键 = {@code aigc:<model>}，落在 {@code DapMaterialGroup.callbackToken}
 *       这一列（本身就有 unique 约束，aigc 分组没有回调，这列空着）。整个「查 → 建 → 落库」在
 *       JVM 锁内、并用独立事务（REQUIRES_NEW）提交，保证同实例并发只建一个上游分组；
 *       多实例并发靠该 unique 约束兜底（冲突方本次退回默认组，不会建出第二个上游分组的**落库**记录）。
 *       独立事务同时保证：调用方后续送审失败回滚，不会把已建好的分组行一起丢掉（否则下次又建一个，漏配额）。</li>
 *   <li><b>异步 pending 不阻断</b>：aigc 分组是 pending → active 异步生效。若本次拿不到 active，
 *       返回 null → 本次送审退回平台默认组（best-effort，绝不因为分组没就绪就送审失败）。</li>
 * </ol>
 *
 * <p>模型换绑：去重键含 model，admin 换绑不同 model 会另建一个专属分组（占一个配额槽位）。
 * modelink 账号级只有 3 个分组，换绑前应先清理旧组。
 *
 * <p>线上已手工建好分组时，配 {@code aep.dap.modelink.aigc-qgroupid} 直接**认领**，
 * 不再自动建组（否则白吃掉一个仅剩的配额槽位）。
 */
@Service
public class DapAigcGroupResolver {

    private static final Logger log = LoggerFactory.getLogger(DapAigcGroupResolver.class);

    /** 账号级共享行的系统 owner（非真实用户；对齐 {@code __official__} / {@code __admin__} 约定）。 */
    public static final String PLATFORM_OWNER = "__platform__";

    private final DapMaterialGroupRepository groupRepo;
    private final ModelinkService modelink;
    private final DapProperties props;
    private final DapSupport support;
    private final TransactionTemplate tx;
    private final Object lock = new Object();

    public DapAigcGroupResolver(DapMaterialGroupRepository groupRepo,
                                ModelinkService modelink,
                                DapProperties props,
                                DapSupport support,
                                PlatformTransactionManager txManager) {
        this.groupRepo = groupRepo;
        this.modelink = modelink;
        this.props = props;
        this.support = support;
        // 独立事务：分组行的生命周期不跟随调用方（送审）的事务成败
        this.tx = new TransactionTemplate(txManager);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** 去重键（≤64，落 callbackToken 的 unique 列）。 */
    static String dedupKey(String model) {
        String k = "aigc:" + (model == null ? "" : model);
        return k.length() <= 64 ? k : k.substring(0, 64);
    }

    /**
     * 解析专属 aigc 分组。
     *
     * @return 已 active 的分组行；尚未 active / 建组失败 → {@code null}
     *         （调用方本次退回平台默认组，不阻断送审）
     */
    public DapMaterialGroup resolveActiveGroup(String model) {
        // 锁必须裹住「查 + 建 + 提交」整段：只在方法体内 synchronized、事务在方法返回后才提交的话，
        // 另一个线程会读不到未提交的行、于是重复建上游分组（正是要防的配额泄漏）。
        synchronized (lock) {
            try {
                return tx.execute(status -> resolveInTx(model));
            } catch (RuntimeException e) {
                // 含多实例并发下的 unique 冲突：本次退回默认组，下次再解析即可复用对方建好的行
                log.warn("[dap-aigc-group] 解析专属 aigc 分组失败（本次退回平台默认组）: {}", e.toString());
                return null;
            }
        }
    }

    private DapMaterialGroup resolveInTx(String model) {
        String key = dedupKey(model);
        DapMaterialGroup row = groupRepo.findByCallbackToken(key).orElse(null);
        if (row == null) return createRow(key, model);

        boolean dead = row.getRecycledAt() != null || "failed".equals(row.getStatus());
        if (dead) return rebuild(row, model);
        if ("active".equals(row.getStatus())) return row;
        return refresh(row);
    }

    /**
     * 首次解析：先调上游、成功才落库（失败不留悬空行，§8.0）。
     *
     * <p>配了 {@code aep.dap.modelink.aigc-qgroupid} 就**认领**已有分组（只 GET 确认状态，不建组）——
     * 线上分组已经手工建好时，自动建组会白白吃掉账号仅剩的分组配额。
     */
    private DapMaterialGroup createRow(String key, String model) {
        String preset = preset();
        GroupState st = obtain(model);
        Instant now = Instant.now();
        DapMaterialGroup g = DapMaterialGroup.builder()
                .id(uniqueId())
                .ownerUserId(PLATFORM_OWNER)
                .kind("aigc")
                .model(model)
                .qgroupid(st.qgroupid())
                .status(DapRealAuthService.mapStatus(st.status(), "preparing"))
                .failReason(st.failReason())
                .callbackToken(key)
                .mock(modelink.isMockMode())
                .createdAt(now)
                .updatedAt(now)
                .build();
        groupRepo.saveAndFlush(g);
        log.info("[dap-aigc-group] {}数字人专属 aigc 分组 id={} qgroupid={} status={} mock={}",
                preset == null ? "已创建" : "已认领", g.getId(), g.getQgroupid(), g.getStatus(), g.isMock());
        return "active".equals(g.getStatus()) ? g : null;
    }

    /** 配了 qgroupid 就认领已有分组（GET 确认），否则新建。 */
    private GroupState obtain(String model) {
        String preset = preset();
        return preset != null
                ? modelink.getGroup(preset)
                // aigc 分组无刷脸回跳，callback_url 传 null
                : modelink.createGroup("aigc", props.getModelink().getAigcGroupName(), model, null);
    }

    private String preset() {
        String v = props.getModelink().getAigcQgroupid();
        return v == null || v.isBlank() ? null : v.trim();
    }

    /** 分组已 failed / 已被回收 → 在同一行上重建（或重新认领）上游分组，保住去重键这个「单例槽位」。 */
    private DapMaterialGroup rebuild(DapMaterialGroup row, String model) {
        GroupState st = obtain(model);
        row.setModel(model);
        row.setQgroupid(st.qgroupid());
        row.setStatus(DapRealAuthService.mapStatus(st.status(), "preparing"));
        row.setFailReason(st.failReason());
        row.setRecycledAt(null);
        row.setMock(modelink.isMockMode());
        row.setUpdatedAt(Instant.now());
        groupRepo.save(row);
        log.info("[dap-aigc-group] 专属 aigc 分组已重建 id={} qgroupid={}", row.getId(), row.getQgroupid());
        return "active".equals(row.getStatus()) ? row : null;
    }

    /** 非终态 → 向上游刷一次；仍未 active 就返回 null（本次走默认组）。 */
    private DapMaterialGroup refresh(DapMaterialGroup row) {
        if (row.getQgroupid() == null) return null;
        GroupState st = modelink.getGroup(row.getQgroupid());
        row.setStatus(DapRealAuthService.mapStatus(st.status(), row.getStatus()));
        if (st.failReason() != null && !st.failReason().isBlank()) row.setFailReason(st.failReason());
        row.setUpdatedAt(Instant.now());
        groupRepo.save(row);
        if ("active".equals(row.getStatus())) return row;
        log.info("[dap-aigc-group] 专属 aigc 分组尚未生效（status={}），本次送审走平台默认组", row.getStatus());
        return null;
    }

    private String uniqueId() {
        for (int i = 0; i < 20; i++) {
            String id = support.newId("MG");
            if (!groupRepo.existsById(id)) return id;
        }
        return "MG-" + UUID.randomUUID().toString().substring(0, 8);
    }
}

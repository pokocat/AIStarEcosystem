package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipVendorDtos.*;
import com.aistareco.aep.clip.service.shiliu.ShiliuGateway;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapVoiceRepository;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

/**
 * 石榴 AI 供应商总览（运营后台只读）。
 *
 * <p>存在理由：额度耗尽此前只能靠翻服务器日志才知道，而槽位被「孤儿」占满同样无声无息 ——
 * 我方软删了本地记录、上游删除却失败，那个对象就永远占着一个槽位，直到某天用户建不出新形象。
 *
 * <p><b>本类只读</b>。删除有破坏性且必须与我方 DB 联动（本地记录、原始素材、预览帧要一起清），
 * 不在这个视图里做。
 */
@Service
public class ClipVendorService {
    private static final Logger log = LoggerFactory.getLogger(ClipVendorService.class);

    /** 只有 ClipAvatarService 会写 engine_ref，且固定写这个引擎名；对账口径与它保持一致。 */
    private static final String ENGINE = "shiliu";

    /** 上游 id 形态（纯数字）。不符合的本地 ref 是 mock 时代残留，没有对应的上游对象。 */
    private static final String UPSTREAM_REF = "\\d{1,20}";

    private final ShiliuService shiliu;
    private final DapAvatarRepository avatars;
    private final DapVoiceRepository voices;

    public ClipVendorService(ShiliuService shiliu, DapAvatarRepository avatars, DapVoiceRepository voices) {
        this.shiliu = shiliu;
        this.avatars = avatars;
        this.voices = voices;
    }

    /** 我方 DB 一行的归一投影（dap_avatar / dap_voice 共用）。 */
    public record LocalRow(String id, String ownerUserId, String name, String engineRef,
                           String engineStatus, String updatedAt) {}

    @Transactional(readOnly = true)
    public VendorOverviewDto overview() {
        // 引擎没配就没有可对账的对象，直接让 CLIP_ENGINE_NOT_CONFIGURED 冒上去（503 + 明确文案），
        // 好过渲染一张「石榴侧 0 个、本地全是悬挂」的假页面。
        ShiliuGateway gateway = shiliu.required();
        return new VendorOverviewDto(
                gateway.mock(),
                Instant.now().toString(),
                readQuota(gateway),
                reconcileSide("avatar", gateway::listAvatars, localAvatars()),
                reconcileSide("speaker", gateway::listSpeakers, localVoices()));
    }

    // ── 对账（纯函数） ──────────────────────────────────────────────────────────

    /**
     * 三类对账 + 两类「无法对账」，无 IO，可直接单测（见 ClipVendorReconcileTest）。
     *
     * <ul>
     *   <li><b>正常 matched</b>：石榴有、我方也有。注意是<b>多对一</b>而非一一对应 ——
     *       一个音色可被多个形象复用，同一个 engineRef 可能被我方多行引用。</li>
     *   <li><b>孤儿 orphan</b>：石榴有、我方无（含我方已软删但上游删除失败的残留）。
     *       白占槽位，可安全清理。</li>
     *   <li><b>悬挂 dangling</b>：我方有合法 engineRef、石榴没有。上游被删了本地没同步，
     *       用户点到会报错。</li>
     *   <li><b>无法对账 unmatchable</b>：engineRef 为空（{@code training}，还在训练/训练失败）
     *       或不是上游 id 形态（{@code mock}，mock 时代残留）。这两类本来就没有上游对象，
     *       算进悬挂会把「正在训练」误报成「上游已删」，制造假警报。</li>
     * </ul>
     *
     * <p><b>前置条件</b>：{@code localRows} 必须已排除软删行（软删行在上游若还在，语义上就是孤儿）；
     * 石榴侧列表读失败时<b>禁止</b>调用本方法 —— 传空列表会把整库判成悬挂，
     * 这正是「读失败被说成空态」最吓人的一种形态。
     */
    public static ReconcileDto reconcile(List<ShiliuGateway.VendorObject> vendorObjects, List<LocalRow> localRows) {
        Map<String, ShiliuGateway.VendorObject> vendorById = new LinkedHashMap<>();
        for (ShiliuGateway.VendorObject object : vendorObjects) {
            String id = trimmed(object == null ? null : object.id());
            if (id == null) continue;
            vendorById.putIfAbsent(id, object); // 上游重复 id 只算一个对象
        }

        List<MatchedRow> matched = new ArrayList<>();
        List<DanglingRow> dangling = new ArrayList<>();
        List<UnmatchableRow> unmatchable = new ArrayList<>();
        Set<String> claimed = new LinkedHashSet<>();

        for (LocalRow row : localRows) {
            if (row == null) continue;
            String ref = trimmed(row.engineRef());
            if (ref == null) {
                unmatchable.add(new UnmatchableRow(row.id(), row.ownerUserId(), row.name(), null,
                        row.engineStatus(), "training"));
                continue;
            }
            if (!ref.matches(UPSTREAM_REF)) {
                unmatchable.add(new UnmatchableRow(row.id(), row.ownerUserId(), row.name(), ref,
                        row.engineStatus(), "mock"));
                continue;
            }
            ShiliuGateway.VendorObject hit = vendorById.get(ref);
            if (hit == null) {
                dangling.add(new DanglingRow(row.id(), row.ownerUserId(), row.name(), ref,
                        row.engineStatus(), row.updatedAt()));
                continue;
            }
            claimed.add(ref);
            matched.add(new MatchedRow(ref, hit.title(), row.id(), row.ownerUserId(), row.name(), row.engineStatus()));
        }

        List<OrphanRow> orphan = new ArrayList<>();
        for (Map.Entry<String, ShiliuGateway.VendorObject> entry : vendorById.entrySet()) {
            if (!claimed.contains(entry.getKey())) orphan.add(new OrphanRow(entry.getKey(), entry.getValue().title()));
        }

        return new ReconcileDto(null, vendorById.size(), localRows.size(), matched, orphan, dangling, unmatchable);
    }

    // ── 读取 ────────────────────────────────────────────────────────────────────

    private QuotaDto readQuota(ShiliuGateway gateway) {
        ShiliuGateway.AssetQuota quota;
        try {
            quota = gateway.asset();
        } catch (RuntimeException e) {
            log.warn("[clip-vendor] asset/get failed: {}", e.toString());
            return QuotaDto.failed(readableMessage(e));
        }
        // 槽位「用满」只在上游确实给了 0 时才成立；字段缺失（null）不算用满，也不算宽裕。
        return new QuotaDto(null, quota.availableAvatar(), quota.availableSpeaker(),
                quota.validPoint(), quota.validToTime(),
                exhausted(quota.availableAvatar()), exhausted(quota.availableSpeaker()));
    }

    private ReconcileDto reconcileSide(String kind, Supplier<List<ShiliuGateway.VendorObject>> read,
                                       List<LocalRow> localRows) {
        List<ShiliuGateway.VendorObject> vendorObjects;
        try {
            vendorObjects = read.get();
        } catch (RuntimeException e) {
            // 读失败绝不能退化成「石榴侧是空的」——那会把整库判成悬挂，是最响的一种假警报。
            log.warn("[clip-vendor] {} list failed: {}", kind, e.toString());
            return ReconcileDto.failed(readableMessage(e), localRows.size());
        }
        return reconcile(vendorObjects, localRows);
    }

    private List<LocalRow> localAvatars() {
        return avatars.findByEngineAndDeletedAtIsNull(ENGINE).stream()
                .map(a -> new LocalRow(a.getId(), a.getOwnerUserId(), a.getName(), a.getEngineRef(),
                        a.getEngineStatus(), iso(a.getUpdatedAt())))
                .toList();
    }

    private List<LocalRow> localVoices() {
        // dap_voice 没有 updatedAt 列，用 createdAt 顶上（页面只把它当「这行有多老」的参考）。
        return voices.findByEngineAndDeletedAtIsNull(ENGINE).stream()
                .map(v -> new LocalRow(v.getId(), v.getOwnerUserId(), v.getName(), v.getEngineRef(),
                        v.getEngineStatus(), iso(v.getCreatedAt())))
                .toList();
    }

    private static boolean exhausted(Integer available) { return available != null && available <= 0; }

    private static String trimmed(String raw) {
        if (raw == null) return null;
        String value = raw.trim();
        return value.isEmpty() ? null : value;
    }

    private static String iso(Instant instant) { return instant == null ? null : instant.toString(); }

    /** BusinessException 的 message 已是脱敏友好文案；其余异常不外泄堆栈细节。 */
    private static String readableMessage(RuntimeException e) {
        if (e instanceof BusinessException business) return business.getMessage();
        return "读取石榴数据失败，请稍后重试";
    }
}

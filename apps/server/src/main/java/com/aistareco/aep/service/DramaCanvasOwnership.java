package com.aistareco.aep.service;

import com.aistareco.aep.model.StorageAsset;
import com.aistareco.aep.repository.StorageAssetRepository;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 画布资产归属闸（v0.198，设计真源 docs/drama-canvas-plan.md §3.3）。
 *
 * <p>画布文档是客户端整存整取的，里面每个 {@code key} 都由浏览器写 —— 不校验的话，把别人的 key 抄进自己的画布，
 * 读画布就能换出一个指向别人图片的签名地址，出图就能拿别人的脸当参考（越权读取）。
 *
 * <p><b>为什么不照 ipstudio「看 key 前缀」</b>：drama 生成的 key 里没有用户 id（{@code drama/frames/<uuid>.png}），
 * 前缀判不出归属。真值只有一条：{@code storage_assets} 里 (app=drama, owner=本人, cdnKey) 三者对上。
 * 所以<b>画布的所有产物</b>（出图、上传、视频镜像、末帧、成片）落库时都要经 {@link #record} 记一行；
 * 上传参考图（{@code POST /me/drama/assets/uploads}）已经由 {@code StorageQuotaService.record("drama", …)} 记过。
 *
 * <p>判定只有这一条规则、只写在这里（AGENTS.md §8.0.1 ④）：{@link #ownedKeys} 给「不签就是了」的读路径，
 * {@link #requireOwned} 给「必须拒绝」的生成路径，后者 delegate 前者。
 */
@Component
public class DramaCanvasOwnership {

    private static final Logger log = LoggerFactory.getLogger(DramaCanvasOwnership.class);

    /** storage_assets 里短剧线的 app 值（与 {@code StorageQuotaService.record("drama", …)} 同一个）。 */
    public static final String APP = "drama";

    /** 一次 IN 查询最多带多少个 key。 */
    static final int IN_CHUNK = 500;
    /** key 列是 VARCHAR(512)，更长的一定不是我们存的。 */
    static final int MAX_KEY_LENGTH = 512;
    /** 拒绝时 details.keys 最多列多少个（都是调用方自己文档里的 key，不是探测面；只是别把响应撑太大）。 */
    private static final int DETAIL_KEYS_MAX = 20;

    private final StorageAssetRepository storageAssets;

    public DramaCanvasOwnership(StorageAssetRepository storageAssets) {
        this.storageAssets = storageAssets;
    }

    /**
     * 这批 key 里属于 {@code userId} 的那些（只读判定，不抛）。给「不签就是了」的场景用：读画布时只给本人的 key
     * 派生 url，不是本人的不签、不报错（抛的话，一份被塞进别人 key 的文档会让整张画布打不开）。
     *
     * <p>一次（按 {@link #IN_CHUNK} 分批）批量查，不 N+1。外形不安全的 key（路径穿越 / 绝对路径 / 控制字符 / 超长）
     * 直接不算本人的，不查库。
     *
     * @return 属于本人的 key（原样）；输入为空时返回空集合，不查库
     */
    public Set<String> ownedKeys(String userId, Collection<String> keys) {
        if (isBlank(userId) || keys == null || keys.isEmpty()) return Collections.emptySet();
        Set<String> candidates = new LinkedHashSet<>();
        for (String k : keys) {
            if (isSafeKey(k)) candidates.add(k);
        }
        if (candidates.isEmpty()) return Collections.emptySet();

        Set<String> owned = new HashSet<>();
        List<String> list = new ArrayList<>(candidates);
        for (int i = 0; i < list.size(); i += IN_CHUNK) {
            List<String> chunk = list.subList(i, Math.min(list.size(), i + IN_CHUNK));
            List<String> hit = storageAssets.findOwnedCdnKeys(APP, userId, chunk);
            if (hit != null) owned.addAll(hit);
        }
        Set<String> out = new LinkedHashSet<>();
        for (String k : candidates) if (owned.contains(k)) out.add(k);
        return out;
    }

    /**
     * 生成前的硬闸：任一 key 不属于本人 → 400 {@code DRAMA_CANVAS_ASSET_NOT_OWNED}，调用方必须在冻结积分之前调
     * （<b>不是静默跳过</b> —— 跳过的话用户付了钱，拿到一张没按他连的参考图出的图，还以为是模型不听话）。
     *
     * <p>null / 空白 key 忽略（没有参考图不是错）。{@code error.details.keys} 列出被拒的 key（最多 20 个，
     * 都是调用方自己文档里的），前端据此标出是哪张图。
     */
    public void requireOwned(String userId, Collection<String> keys) {
        if (keys == null || keys.isEmpty()) return;
        Set<String> wanted = new LinkedHashSet<>();
        for (String k : keys) {
            if (k != null && !k.isBlank()) wanted.add(k);
        }
        if (wanted.isEmpty()) return;
        Set<String> owned = ownedKeys(userId, wanted);
        List<String> rejected = new ArrayList<>();
        for (String k : wanted) if (!owned.contains(k)) rejected.add(k);
        if (rejected.isEmpty()) return;
        log.warn("[drama-canvas] 拒绝非本人资产 user={} count={} sample={}",
                userId, rejected.size(), abbreviate(rejected.get(0)));
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("count", rejected.size());
        details.put("keys", rejected.size() > DETAIL_KEYS_MAX ? rejected.subList(0, DETAIL_KEYS_MAX) : rejected);
        throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_ASSET_NOT_OWNED",
                "有 " + rejected.size() + " 张图不是你的，换掉再生成", details);
    }

    /**
     * 记一行归属（app=drama）：画布的每个产物落库时调。已经有本人这一行 → 什么都不做（幂等）。
     *
     * <p><b>和 {@code StorageQuotaService.record} 不同，这里失败会抛</b>：那边是用量观测（丢了只是少算几 KB），
     * 这里是归属的唯一真值 —— 静默丢一行，用户花钱生成的图下次打开就不签、显示成占位，而且无从排查（§8.0.1 ⑨）。
     * 同一个 key 已经记在<b>别人</b>名下（或别的子应用）→ 500 {@code DRAMA_CANVAS_ASSET_RECORD_CONFLICT}：
     * key 是我们自己生成的 uuid，撞上只可能是调用方拿错了 key，必须让它失败而不是悄悄归给现在这个人。
     *
     * @param bytes       文件字节数（用量台账用；不知道时传 0）
     * @param contentType 决定用量明细里的分类（图片 / 视频 / 其他）；可空
     */
    @Transactional
    public void record(String userId, String key, long bytes, String contentType) {
        if (isBlank(userId)) throw new IllegalArgumentException("record: userId 为空");
        if (!isSafeKey(key)) throw new IllegalArgumentException("record: key 不合法 " + abbreviate(key));
        List<StorageAsset> existing = storageAssets.findByCdnKey(key);
        if (existing != null && !existing.isEmpty()) {
            for (StorageAsset s : existing) {
                if (APP.equals(s.getApp()) && userId.equals(s.getOwnerUserId())) return;
            }
            StorageAsset other = existing.get(0);
            log.error("[drama-canvas] 归属记账冲突 key={} 想记给 user={}，已记在 app={} user={}",
                    abbreviate(key), userId, other.getApp(), other.getOwnerUserId());
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "DRAMA_CANVAS_ASSET_RECORD_CONFLICT",
                    "生成结果没存上，再试一次");
        }
        storageAssets.save(StorageAsset.builder()
                .id("sa_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16))
                .app(APP)
                .ownerUserId(userId)
                .category(categoryOf(contentType))
                .refId(null)
                .cdnKey(key)
                .bytes(Math.max(0, bytes))
                .createdAt(OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS))
                .build());
    }

    /**
     * key 的外形闸：路径穿越 / 绝对路径 / 反斜杠 / 控制字符 / 首尾空白 / 超长一律不收
     * （本地存储驱动按 key 拼路径读文件，一个 {@code ../../etc/passwd} 形状的 key 就能把本机文件当参考图发出去 ——
     * ipstudio 审计过同一个洞）。
     */
    static boolean isSafeKey(String key) {
        if (key == null || key.isBlank() || key.length() > MAX_KEY_LENGTH) return false;
        if (!key.equals(key.trim())) return false;
        if (key.startsWith("/") || key.contains("\\") || key.contains("..")) return false;
        for (int i = 0; i < key.length(); i++) {
            if (Character.isISOControl(key.charAt(i))) return false;
        }
        return true;
    }

    /** 用量明细里的分类名（给人看，存储用量页按它分组）。 */
    static String categoryOf(String contentType) {
        String ct = contentType == null ? "" : contentType.trim().toLowerCase(Locale.ROOT);
        if (ct.startsWith("image/")) return "画布图片";
        if (ct.startsWith("video/")) return "画布视频";
        return "画布其他";
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String abbreviate(String s) {
        return s == null || s.length() <= 120 ? s : s.substring(0, 120) + "…";
    }
}

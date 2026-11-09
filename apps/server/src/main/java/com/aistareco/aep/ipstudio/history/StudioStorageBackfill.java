package com.aistareco.aep.ipstudio.history;

import com.aistareco.aep.ipstudio.model.IpSavedAsset;
import com.aistareco.aep.ipstudio.repository.IpSavedAssetRepository;
import com.aistareco.aep.repository.StorageAssetRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 存储用量回填：2026-11-09 之前生成和上传的 IP Studio 文件没有记进通用存储统计。
 * 用户第一次打开账号页的存储用量时，按资产库（ip_saved_asset，生成成功和上传的文件都会自动收录）里的文件 key 补记一笔。
 *
 * <p>只加统计记录，不改文件和业务数据；同一 key 不重复记（{@link StorageQuotaService#record} 幂等）。
 * 文件大小优先用收录时记下的 bytes，没有才向存储查一次。观测类旁路（§8.0）：失败只 WARN，下次打开再补。
 * 每个用户每个进程只补一次。资产库里用户自己删掉的条目不补。
 */
@Service
public class StudioStorageBackfill {
    private static final Logger log = LoggerFactory.getLogger(StudioStorageBackfill.class);

    private final IpSavedAssetRepository savedAssets;
    private final StorageAssetRepository storageAssets;
    private final StorageQuotaService quota;
    private final FileStorageService files;
    private final ObjectMapper om;
    private final Set<String> done = ConcurrentHashMap.newKeySet();

    public StudioStorageBackfill(IpSavedAssetRepository savedAssets, StorageAssetRepository storageAssets,
                                 StorageQuotaService quota, FileStorageService files, ObjectMapper om) {
        this.savedAssets = savedAssets; this.storageAssets = storageAssets; this.quota = quota; this.files = files; this.om = om;
    }

    /** 单线程后台补：第一次打开要逐个查文件大小，文件多时不能拖住页面请求。 */
    private final java.util.concurrent.ExecutorService worker = java.util.concurrent.Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "studio-storage-backfill"); t.setDaemon(true); return t;
    });

    /** 在后台补记，立刻返回；本次打开看到的是补记之前的数，下次打开就完整了。 */
    public void backfillAsync(String user) {
        if (user == null || done.contains(user)) return;
        try { worker.submit(() -> backfill(user)); }
        catch (java.util.concurrent.RejectedExecutionException e) { log.warn("[storage-backfill] rejected user={}", user); }
    }

    @jakarta.annotation.PreDestroy
    void shutdown() { worker.shutdownNow(); }

    public int backfill(String user) {
        if (user == null || !done.add(user)) return 0;
        int recorded = 0;
        try {
            for (IpSavedAsset row : savedAssets.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(user)) {
                JsonNode data = om.readTree(row.getPayloadJson()).path("data");
                String key = data.path("storageKey").asText("");
                String category = categoryOf(key, data.path("mimeType").asText(""));
                if (category == null || storageAssets.existsByCdnKey(key)) continue;
                long bytes = data.path("bytes").asLong(0);
                if (bytes <= 0) {
                    try { var info = files.stat(key); bytes = info == null ? 0 : info.bytes(); }
                    catch (Exception e) { log.warn("[storage-backfill] stat failed key={}: {}", key, e.getMessage()); continue; }
                }
                if (bytes <= 0) continue;
                quota.record(StudioStorageService.APP, user, category, null, key, bytes);
                recorded++;
            }
        } catch (Exception e) {
            done.remove(user); // 下次打开再补
            log.warn("[storage-backfill] user={} stopped after {} records: {}", user, recorded, e.getMessage());
        }
        if (recorded > 0) log.info("[storage-backfill] user={} recorded={}", user, recorded);
        return recorded;
    }

    /**
     * 与 FileStorageService 写入时的分类一致：生成的按媒体类型分，上传的算「上传的素材」。
     * key 的第一段是分类名把 {@code /} 换成 {@code _}（{@code ipstudio/gen} → {@code ipstudio_gen/...}）。
     */
    static String categoryOf(String key, String mime) {
        if (key == null) return null;
        if (key.startsWith("ipstudio_source/")) return "上传的素材";
        if (!key.startsWith("ipstudio_gen/")) return null;
        String m = mime == null ? "" : mime.toLowerCase(Locale.ROOT);
        String k = key.toLowerCase(Locale.ROOT);
        if (m.startsWith("image/") || k.matches(".*\\.(png|jpe?g|webp|gif)$")) return "生成的图片";
        if (m.startsWith("video/") || k.endsWith(".mp4") || k.endsWith(".mov")) return "生成的视频";
        if (m.startsWith("audio/") || k.matches(".*\\.(wav|mp3|m4a|aac)$")) return "声音";
        return "其他";
    }
}

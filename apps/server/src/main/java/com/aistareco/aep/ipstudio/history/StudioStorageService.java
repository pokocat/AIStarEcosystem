package com.aistareco.aep.ipstudio.history;

import com.aistareco.aep.dap.service.DapAccountService;
import com.aistareco.aep.dto.StorageUsageDto;
import com.aistareco.aep.service.storage.StorageQuotaService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 账号「存储用量」：一个口径合并两套既有统计。
 * <ul>
 *   <li>数字资产（人物、场景、产品、声音、合成、真人授权素材）按表实时求和 —— {@link DapAccountService#storageMb}；</li>
 *   <li>IP Studio 生成和上传的文件记在通用存储统计里：画布 / AI 图片的图与配音、上传素材（app=aiavatar），
 *       视频成片（app=studio），导出的成片（app=aiavatar）。</li>
 * </ul>
 * 配额用通用存储的 aiavatar 配额（后台可配，含已购存储扩容）。
 */
@Service
public class StudioStorageService {
    public record Category(String key, String label, long mb) {}
    public record Usage(long usedMb, long quotaMb, long baseQuotaMb, long grantedMb, List<Category> categories) {}

    static final String APP = "aiavatar";
    /** 视频任务记账用的应用码（MaterialVideoJobService.modelAppCode 对 ipstudio 分区返回 studio）。 */
    static final String VIDEO_APP = "studio";

    private final DapAccountService dap;
    private final StorageQuotaService quota;

    public StudioStorageService(DapAccountService dap, StorageQuotaService quota) {
        this.dap = dap;
        this.quota = quota;
    }

    @Transactional(readOnly = true)
    public Usage usage(String user) {
        Map<String, Long> mb = new LinkedHashMap<>();
        for (String key : List.of("image", "video", "digital-human", "upload", "audio", "license", "other")) mb.put(key, 0L);
        for (String app : List.of(APP, VIDEO_APP))
            for (StorageUsageDto.Slice s : quota.usage(app, user).breakdown()) mb.merge(keyOf(s.category()), s.mb(), Long::sum);
        DapAccountService.StorageMb d = dap.storageMb(user);
        mb.merge("digital-human", d.character() + d.scene() + d.product() + d.compose(), Long::sum);
        mb.merge("audio", d.voice(), Long::sum);
        mb.merge("license", d.license(), Long::sum);

        List<Category> categories = new ArrayList<>();
        long used = 0;
        for (var e : mb.entrySet()) {
            used += e.getValue();
            if (e.getValue() > 0 || !"other".equals(e.getKey())) categories.add(new Category(e.getKey(), label(e.getKey()), e.getValue()));
        }
        long base = quota.quotaMb(APP);
        long total = quota.quotaMb(APP, user);
        return new Usage(used, total, base, Math.max(0, total - base), categories);
    }

    static String keyOf(String category) {
        return switch (category == null ? "" : category) {
            case "生成的图片" -> "image";
            case "生成的视频", "视频生成", "素材视频", "分镜视频", "成片" -> "video";
            case "上传的素材", "画布附件" -> "upload";
            case "声音" -> "audio";
            default -> "other";
        };
    }

    static String label(String key) {
        return switch (key) {
            case "image" -> "生成的图片";
            case "video" -> "生成的视频";
            case "digital-human" -> "数字人资产";
            case "upload" -> "上传的素材";
            case "audio" -> "声音";
            case "license" -> "真人授权素材";
            default -> "其他";
        };
    }
}

package com.aistareco.aep.ipstudio.scene;

import com.aistareco.aep.ipstudio.scene.StudioSceneCatalog.Catalog;
import com.aistareco.aep.ipstudio.scene.StudioSceneCatalog.ImageScene;
import com.aistareco.aep.ipstudio.scene.StudioSceneCatalog.VideoScene;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.MediaBytes;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Objects;

/**
 * 后台「Studio 场景模板」：运营增删改 AI 图片 / AI 视频的场景，整份目录一次保存。
 *
 * <p>保存带上读到的版本号，别人先存过就拒绝（不覆盖）；保存前用和随包目录同一套 {@link StudioSceneCatalog#validate}。
 * 封面和参考示例只能是这里上传的文件（{@link StudioSceneCatalog#MEDIA_PREFIX}），目录里只存 key，出 wire 时签名。
 */
@Service
public class StudioSceneAdminService {
    public record View(Catalog catalog, String source, int version, List<String> skills) {}
    public record SaveRequest(Catalog catalog, Integer baseVersion) {}
    public record Uploaded(String key, String url, String mediaType) {}

    private static final long IMAGE_MAX = 10L * 1024 * 1024, VIDEO_MAX = 50L * 1024 * 1024;

    private final StudioSceneCatalog scenes;
    private final PlatformConfigService config;
    private final FileStorageService storage;
    private final ObjectMapper mapper;

    public StudioSceneAdminService(StudioSceneCatalog scenes, PlatformConfigService config, FileStorageService storage, ObjectMapper mapper) {
        this.scenes = scenes; this.config = config; this.storage = storage; this.mapper = mapper;
    }

    public View view() {
        int version = scenes.savedVersion();
        return new View(StudioSceneCatalog.withMedia(scenes.catalog(), storage::signedUrl), version == 0 ? "default" : "custom", version,
                StudioSceneCatalog.VIDEO_SKILLS.stream().sorted().toList());
    }

    @Transactional
    public View save(SaveRequest request, String actor) {
        if (request == null || request.catalog() == null) throw BusinessException.badRequest("STUDIO_SCENE_CATALOG_INVALID", "场景目录为空");
        config.lockExisting(StudioSceneCatalog.CONFIG_KEY);
        requireBase(request.baseVersion());
        Catalog clean = strip(request.catalog());
        try { StudioSceneCatalog.validate(clean); }
        catch (IllegalStateException e) { throw BusinessException.badRequest("STUDIO_SCENE_CATALOG_INVALID", e.getMessage()); }
        config.upsert(StudioSceneCatalog.CONFIG_KEY, mapper.valueToTree(clean), "Studio 场景模板（AI 图片 / AI 视频）", actor);
        return view();
    }

    /** 回到随包那份：删掉后台存的目录。上传过的文件不删，旧草稿的封面还在用。 */
    @Transactional
    public View reset(Integer baseVersion, String actor) {
        config.lockExisting(StudioSceneCatalog.CONFIG_KEY);
        requireBase(baseVersion);
        if (scenes.savedVersion() > 0) config.delete(StudioSceneCatalog.CONFIG_KEY);
        return view();
    }

    public Uploaded upload(MultipartFile file) {
        if (file == null || file.isEmpty()) throw BusinessException.badRequest("STUDIO_SCENE_MEDIA_INVALID", "请选择要上传的文件");
        byte[] bytes;
        try { bytes = file.getBytes(); } catch (IOException e) { throw BusinessException.badRequest("STUDIO_SCENE_MEDIA_INVALID", "文件读取失败，请重新上传"); }
        MediaBytes.Format image = MediaBytes.sniff("image", bytes);
        MediaBytes.Format video = image == null ? MediaBytes.sniff("video", bytes) : null;
        // 按字节判，不按文件名（§8.0.1 ⑤）；示例视频只收 MP4，浏览器都能直接放。
        if (image == null && !MediaBytes.MP4.equals(video)) throw BusinessException.badRequest("STUDIO_SCENE_MEDIA_INVALID", "只支持 JPG / PNG / WEBP 图片或 MP4 视频");
        long max = image != null ? IMAGE_MAX : VIDEO_MAX;
        if (bytes.length > max) throw BusinessException.badRequest("STUDIO_SCENE_MEDIA_INVALID", (image != null ? "图片" : "视频") + "超过 " + max / 1024 / 1024 + "MB 上限");
        var format = image != null ? image : video;
        var stored = storage.store(bytes, StudioSceneCatalog.MEDIA_CATEGORY, StudioSceneCatalog.MEDIA_OWNER, format.ext(), format.mime());
        return new Uploaded(stored.key(), storage.signedUrl(stored.key()), StudioSceneCatalog.mediaType(stored.key()));
    }

    private void requireBase(Integer baseVersion) {
        int current = scenes.savedVersion();
        if (!Objects.equals(baseVersion == null ? 0 : baseVersion, current))
            throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_SCENE_CATALOG_STALE", "场景目录刚被别人改过，请刷新后再改");
    }

    /** 地址是派生出来的（会过期），不进库。 */
    private static Catalog strip(Catalog c) {
        return new Catalog(c.version(), c.imageGroups(), c.videoGroups(),
                c.image() == null ? null : c.image().stream().map(s -> new ImageScene(s.id(), s.group(), s.title(), s.description(), s.refs(), s.prompt(), s.hint(), s.ratio(),
                        s.enabled(), s.coverKey(), s.exampleKeys(), null, null)).toList(),
                c.video() == null ? null : c.video().stream().map(s -> new VideoScene(s.id(), s.group(), s.title(), s.description(), s.images(), s.video(), s.character(), s.voice(),
                        s.placeholder(), s.textRequired(), s.durations(), s.duration(), s.ratio(), s.structure(), s.ideas(), s.skill(), s.enabled(), s.coverKey(), s.exampleKeys(), null, null)).toList());
    }
}

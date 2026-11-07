package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Collection;
import java.util.function.Supplier;

/**
 * 视频任务提交前的素材准备：所有渠道同一步，按模型找到素材库，把素材换成它认得的引用。
 * 渠道差异都在 {@link VideoAssetLibrary} 的实现里。
 */
@Service
public class VideoAssetPreparer {
    private static final Logger log = LoggerFactory.getLogger(VideoAssetPreparer.class);
    /** 厂商排队时也可能校验引用，离过期太近就重传。上传免费。 */
    static final Duration RECEIPT_MIN_REMAINING = Duration.ofMinutes(30);

    private final VideoAssetLibraryRecordRepository libraries;
    private final MaterialVideoInputAssets receipts;
    private final MaterialVideoProperties props;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();

    public VideoAssetPreparer(VideoAssetLibraryRecordRepository libraries, MaterialVideoInputAssets receipts,
                              MaterialVideoProperties props) {
        this.libraries = libraries;
        this.receipts = receipts;
        this.props = props;
    }

    /** 模型配了素材库却打不开就报错，不能悄悄退回签名链接（§8.0）。 */
    Session open(String libraryId, VideoAssetLibrary.EndpointAccess access) {
        VideoAssetLibraryRecord record = libraries.findById(libraryId).orElseThrow(() -> notConfigured(libraryId, "素材库不存在"));
        return new Session(record.getId(), adapterOf(record), access);
    }

    /** 这个素材库能不能用。后台保存模型时先判，不等到任务提交才发现。 */
    public void requireUsable(String libraryId) {
        adapterOf(libraries.findById(libraryId).orElseThrow(() -> notConfigured(libraryId, "素材库不存在")));
    }

    private VideoAssetLibrary adapterOf(VideoAssetLibraryRecord record) {
        if (!"onetoken".equals(record.getAdapter()))
            throw notConfigured(record.getId(), "未知的适配器 " + record.getAdapter());
        try {
            return new OneTokenAssetLibrary(OneTokenAssetLibrary.Config.read(record.getConfigJson()), http,
                    Duration.ofSeconds(Math.max(props.getHttpTimeoutSeconds(), props.getDownloadTimeoutSeconds())));
        } catch (IllegalArgumentException invalid) {
            throw notConfigured(record.getId(), invalid.getMessage());
        }
    }

    private static BusinessException notConfigured(String libraryId, String detail) {
        log.warn("[material-video] 素材库不可用 library={} detail={}", libraryId, detail);
        return BusinessException.wrapped(HttpStatus.SERVICE_UNAVAILABLE, "VIDEO_ASSET_LIBRARY_NOT_CONFIGURED",
                "这个视频模型的素材库配置有误，暂时无法生成，请联系平台处理",
                "library=" + libraryId + " " + detail);
    }

    /** 这次提交打开的素材库。回执按「素材库 + 地址 + 凭据 + 素材」记，不分型号，同账号下的模型共用。 */
    final class Session {
        private final String libraryId;
        private final VideoAssetLibrary library;
        private final VideoAssetLibrary.EndpointAccess access;

        private Session(String libraryId, VideoAssetLibrary library, VideoAssetLibrary.EndpointAccess access) {
            this.libraryId = libraryId;
            this.library = library;
            this.access = access;
        }

        /** 分段视频的每一段都用同一批参考，复用引用既省上传次数，也避开厂商的频率限制。 */
        String ref(String sourceKey, Supplier<VideoAssetLibrary.LibraryFile> file) {
            return receipts.resolve(libraryId, access.baseUrl(), null, access.credentialValue(), sourceKey,
                    RECEIPT_MIN_REMAINING, () -> library.submit(access, file.get())).assetId();
        }

        void forget(Collection<String> sourceKeys) {
            for (String sourceKey : sourceKeys)
                receipts.forget(libraryId, access.baseUrl(), null, access.credentialValue(), sourceKey);
        }

        boolean rejectedStaleReference(int httpStatus, String responseBody) {
            return library.rejectedStaleReference(httpStatus, responseBody);
        }
    }
}

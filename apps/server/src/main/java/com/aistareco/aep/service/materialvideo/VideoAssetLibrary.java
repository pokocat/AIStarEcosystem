package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.service.storage.MediaBytes;

import java.nio.file.Path;

/**
 * 一个供应商账号的素材库。渠道差异只写在实现里，业务代码只认换回来的引用（docs/video-asset-library.md）。
 *
 * <p>OneToken 同步上传；官方人像库使用已确认的引用，未就绪时进入原任务内核验流程。
 */
public interface VideoAssetLibrary {

    /** 用模型自己的地址和凭据访问素材库。{@code credentialValue} 含密钥，所以不进 toString。 */
    record EndpointAccess(String endpointName, String baseUrl, String model,
                          String credentialHeader, String credentialValue) {
        @Override public String toString() {
            return "EndpointAccess[" + endpointName + "]";
        }
    }

    /** 已按真实字节验过大小和格式的本地文件。{@code label} 是任务卡上的素材叫法，出现在报错里。 */
    record LibraryFile(Path path, long size, MediaBytes.Format format, String filename, String mediaType, String label) {}

    /** 把文件交给素材库，换回引用。传不上去就抛，调用方不能退回签名地址。 */
    MaterialVideoInputAssets.Receipt submit(EndpointAccess access, LibraryFile file);

    /** Channels with approval-managed references may resolve directly; empty means the synchronous upload path is needed. */
    default java.util.Optional<String> preparedReference(String owner,String key) { return java.util.Optional.empty(); }
    default boolean preparesLegacyInputs() { return false; }
    default boolean flagReview(String owner,VideoGenSpec spec,int status,String response) { return false; }
    /** Return true when the adapter owns and invalidates its own approvals instead of the shared receipt cache. */
    default boolean forgetReferences(String owner,java.util.Collection<String> keys) { return false; }

    /** 生成请求被拒，是不是因为引用已经失效（过期、被删）。是的话可以作废回执、重传一次。 */
    boolean rejectedStaleReference(int httpStatus, String responseBody);
}

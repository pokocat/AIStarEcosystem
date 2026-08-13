package com.aistareco.aep.clip.service.shiliu;

import java.util.List;

public interface ShiliuGateway {
    record Task(String id, String status, Integer durationSec, String outputRef, String error, Integer progress) {
        public Task(String id, String status, Integer durationSec, String outputRef, String error) {
            this(id, status, durationSec, outputRef, error, null);
        }
    }

    /**
     * 石榴账户额度快照（{@code POST /asset/get}）。
     *
     * <p><b>字段语义是实测推断，供应商文档未写明这一层</b>：{@code availableAvatar} /
     * {@code availableSpeaker} 是「还能再<b>持有</b>几个」的剩余槽位，<b>不是</b>「还能创建几次」。
     * 证据：账户里存在 3 个 avatar、2 个 speaker 时这两个字段恰好都是 0，而 {@code validPoint}
     * 仍有 3418 —— 若是「创建次数」，点数充足却归零无法解释。所以槽位归零意味着
     * <b>必须先删旧对象才能再建新的</b>，删对象前要先跟我方 DB 对账（见 ClipVendorService）。
     *
     * <p>{@code validPoint} 是通用点数（TTS / 出片消耗）；{@code validToTime} 是套餐有效期，
     * 上游给的是 {@code "yyyy-MM-dd HH:mm:ss"} 字符串（无时区标注），原样透传不做解析。
     */
    record AssetQuota(Integer availableAvatar, Integer availableSpeaker, Long validPoint, String validToTime) {}

    /** 石榴侧的一个对象（avatar 或 speaker）。{@code id} 与我方 {@code engine_ref} 同源，可直接对账。 */
    record VendorObject(String id, String title) {}

    Task previewVoice(String ownerId, String speakerRef, String text);
    Task createVideoByText(String ownerId, String avatarRef, String speakerRef, String text);
    Task createVideoByAudioFile(String ownerId, String avatarRef, String audioRef);
    Task cloneAvatar(String ownerId, String mediaRef, String speakerRef, String authorizationRef);
    Task cloneVoice(String ownerId, String mediaRef);
    Task createAuthorizationVideo(String ownerId, String mediaRef, String spokenText);
    Task query(String taskId);
    void deleteAvatar(String engineRef);
    void deleteVoice(String engineRef);

    /** 账户额度快照。上游是 POST + 空 body（实测 GET 会 401）。 */
    AssetQuota asset();
    /** 石榴侧全部数字人形象。上游是 POST + 空 body。 */
    List<VendorObject> listAvatars();
    /** 石榴侧全部音色。上游是 POST + 空 body。 */
    List<VendorObject> listSpeakers();

    boolean mock();
}

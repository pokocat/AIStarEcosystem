package com.aistareco.aep.clip.service.shiliu;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class MockShiliuGateway implements ShiliuGateway {
    /**
     * 确定性额度快照，形状照 2026-08-13 线上实测：槽位已占满（0/0）而点数仍充足。
     * 故意做成「已占满」而不是「很宽裕」—— 运营总览页的槽位告警是这个视图存在的理由，
     * 本地/测试跑 mock 时必须能看到告警态，否则这段 UI 永远没人验过。
     */
    private static final AssetQuota MOCK_QUOTA = new AssetQuota(0, 0, 3418L, "2027-08-13 15:33:36");

    /** 石榴侧对象清单也固定，让对账页在 mock 下产出稳定的孤儿/悬挂分类。 */
    private static final List<VendorObject> MOCK_AVATARS = List.of(
            new VendorObject("1873243598304171", "军师数字分身-mock01"),
            new VendorObject("1873243598304172", "军师数字分身-mock02"),
            new VendorObject("1873243598304173", "军师数字分身-mock03"));
    private static final List<VendorObject> MOCK_SPEAKERS = List.of(
            new VendorObject("1873244706649061", "军师本人音色-mock01"),
            new VendorObject("1873244706649062", "军师本人音色-mock02"));

    private final Map<String, Task> tasks = new ConcurrentHashMap<>();
    private Task task(String prefix, Integer duration) {
        String id = "mock-" + prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
        // 引擎引用按正式上游的短 ID 形态返回；dap_consent.capture_id 只有 32 字符，不能塞 mock:// URI。
        Task task = new Task(id, "succeeded", duration, id, null);
        tasks.put(id, task); return task;
    }
    public Task previewVoice(String ownerId, String speakerRef, String text) { return task("tts", Math.max(1, Math.round((text == null ? 0 : text.length()) / 4f))); }
    public Task createVideoByText(String ownerId, String avatarRef, String speakerRef, String text) { return task("video-text", null); }
    public Task createVideoByAudioFile(String ownerId, String avatarRef, String audioRef) { return task("video-audio", null); }
    public Task cloneAvatar(String ownerId, String mediaRef, String speakerRef, String authorizationRef) { return task("avatar", null); }
    public Task cloneVoice(String ownerId, String mediaRef) { return task("voice", null); }
    public Task createAuthorizationVideo(String ownerId, String mediaRef, String spokenText) { return task("authorization", null); }
    public Task query(String taskId) { return tasks.getOrDefault(taskId, new Task(taskId, "failed", null, null, "task not found")); }
    public void deleteAvatar(String engineRef) {}
    public void deleteVoice(String engineRef) {}
    public AssetQuota asset() { return MOCK_QUOTA; }
    public List<VendorObject> listAvatars() { return MOCK_AVATARS; }
    public List<VendorObject> listSpeakers() { return MOCK_SPEAKERS; }
    public boolean mock() { return true; }
}

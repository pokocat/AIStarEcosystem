package com.aistareco.aep.clip.service.shiliu;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class MockShiliuGateway implements ShiliuGateway {
    private final Map<String, Task> tasks = new ConcurrentHashMap<>();
    private Task task(String prefix, Integer duration) {
        String id = "mock-" + prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
        Task task = new Task(id, "succeeded", duration, "mock://" + id, null);
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
    public boolean mock() { return true; }
}

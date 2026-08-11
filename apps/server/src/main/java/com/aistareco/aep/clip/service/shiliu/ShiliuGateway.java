package com.aistareco.aep.clip.service.shiliu;

public interface ShiliuGateway {
    record Task(String id, String status, Integer durationSec, String outputRef, String error, Integer progress) {
        public Task(String id, String status, Integer durationSec, String outputRef, String error) {
            this(id, status, durationSec, outputRef, error, null);
        }
    }
    Task previewVoice(String ownerId, String speakerRef, String text);
    Task createVideoByText(String ownerId, String avatarRef, String speakerRef, String text);
    Task createVideoByAudioFile(String ownerId, String avatarRef, String audioRef);
    Task cloneAvatar(String ownerId, String mediaRef, String speakerRef, String authorizationRef);
    Task cloneVoice(String ownerId, String mediaRef);
    Task createAuthorizationVideo(String ownerId, String mediaRef, String spokenText);
    Task query(String taskId);
    void deleteAvatar(String engineRef);
    void deleteVoice(String engineRef);
    boolean mock();
}

package com.aistareco.aep.dto;

import com.aistareco.aep.model.CommunityPost;

import java.time.Instant;
import java.util.List;

public record CommunityPostDto(
        String id,
        String userId,
        String artistId,
        String content,
        List<String> mediaUrls,
        Instant createdAt
) {
    public static CommunityPostDto from(CommunityPost p) {
        return new CommunityPostDto(
                p.getId(), p.getUserId(), p.getArtistId(),
                p.getContent(), p.getMediaUrls(), p.getCreatedAt()
        );
    }
}

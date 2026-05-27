package com.aistareco.aep.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.List;

/**
 * 社区帖子（制作方 / 艺人发给粉丝的动态）。
 * artistId 可为空（纯账号广播）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_community_posts")
public class CommunityPost {

    @Id
    private String id;

    @Column(nullable = false)
    private String userId;

    private String artistId;

    @Column(columnDefinition = "LONGTEXT")
    private String content;

    private Instant createdAt;

    /** 附件 URL 列表（图片 / 视频 / 音频）。 */
    @Column(name = "media_urls", columnDefinition = "LONGTEXT")
    @Convert(converter = StringListConverter.class)
    private List<String> mediaUrls;
}

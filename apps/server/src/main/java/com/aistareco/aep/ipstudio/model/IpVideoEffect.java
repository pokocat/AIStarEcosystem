package com.aistareco.aep.ipstudio.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/** An authored release never changes its description/model scope after publication. */
@Entity @Table(name="ip_video_effect") @Getter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpVideoEffect {
    @Id @Column(length=32) private String id;
    @Column(name="owner_user_id",nullable=false,length=64) private String ownerUserId;
    @Column(nullable=false,length=128) private String name;
    @Column(nullable=false,length=1024) private String summary;
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR) @Column(nullable=false,length = org.hibernate.Length.LONG32) private String prompt;
    @Column(nullable=false,length=128) private String author;
    @Column(nullable=false,length=16) private String visibility;
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR) @Column(name="tags_json",nullable=false,length = org.hibernate.Length.LONG32) private String tagsJson;
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR) @Column(name="models_json",nullable=false,length = org.hibernate.Length.LONG32) private String modelsJson;
    @Column(name="preview_key",length=512) private String previewKey;
    @Column(name="created_at",nullable=false) private Instant createdAt;
}

package com.aistareco.aep.ipstudio.skill;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/**
 * One immutable skill version (S3, V63). {@code frontmatterJson + bodyMd + contentDigest} are written once and never
 * updated. Publishing a distilled {@code draft} is the only change a row ever sees: {@code status} → {@code published},
 * {@code publishedAt} set, the admin's publish note appended to {@code note}.
 *
 * <p>{@code source}: seed (repository file) | admin (published in admin) | rollback (copy of an older version) |
 * distilled (drafted from a finished canvas execution; never in effect until an admin publishes it) | import (the first version of a
 * prompt library entry, carrying what production really used at switch-over; docs/studio-prompt-architecture.md §4.6).
 */
@Entity
@Table(name = "ip_skill_version",
        uniqueConstraints = @UniqueConstraint(name = "uk_ip_skill_version", columnNames = {"skill_key", "version"}),
        indexes = @Index(name = "idx_ip_skill_version_status", columnList = "skill_key,status"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpSkillVersion {
    public static final String PUBLISHED = "published", DRAFT = "draft";
    public static final String SOURCE_SEED = "seed", SOURCE_ADMIN = "admin", SOURCE_ROLLBACK = "rollback", SOURCE_DISTILLED = "distilled", SOURCE_IMPORT = "import";

    @Id @Column(length = 32) private String id;
    @Column(name = "skill_key", nullable = false, length = 64) private String skillKey;
    @Column(nullable = false) private int version;
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR) @Column(nullable = false, columnDefinition = "TEXT") private String frontmatterJson;
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR) @Column(nullable = false, length = org.hibernate.Length.LONG32) private String bodyMd;
    /** sha256 of the content as provided (the seed file text for seeds); the snapshot digest of this version. */
    @Column(nullable = false, length = 64) private String contentDigest;
    @Column(nullable = false, length = 16) private String source;
    @Column(nullable = false, length = 16) private String status;
    @Column(nullable = false, length = 64) private String author;
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR) @Column(columnDefinition = "TEXT") private String note;
    /** Drafts: the version they were distilled from. */
    private Integer baseVersion;
    @Column(length = 32) private String sourceProjectId;
    @Column(length = 64) private String sourceExecutionId;
    @Column(length = 32) private String sourceRunId;
    @Column(nullable = false) private Instant createdAt;
    private Instant publishedAt;
}

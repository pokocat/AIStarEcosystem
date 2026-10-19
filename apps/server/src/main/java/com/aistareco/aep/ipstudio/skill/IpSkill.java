package com.aistareco.aep.ipstudio.skill;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/**
 * One Studio skill (S3, V63). Holds the skill-level state only: runtime status and which immutable
 * {@link IpSkillVersion} is in effect. The content of every version lives in {@code ip_skill_version} and never changes.
 *
 * <p>{@code updatedBy = "seed"} means nobody but the repository seed has written this row (content or status); only then
 * may a changed seed file re-seed it (same rule as {@code PromptService.reseedBaselineIfUntouched}).
 */
@Entity
@Table(name = "ip_skill")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpSkill {
    public static final String ACTIVE = "active", DRAFT = "draft", WITHDRAWN = "withdrawn";
    public static final String SEED_AUTHOR = "seed";

    @Id @Column(name = "skill_key", length = 64) private String skillKey;
    @Column(nullable = false, length = 64) private String name;
    @Column(nullable = false, length = 16) private String status;
    @Column(nullable = false) private int currentVersion;
    @Column(length = 500) private String summary;
    @Column(length = 64) private String updatedBy;
    /** Repository seed file name when this skill came from resources/studio/skills; null for skills created in admin. */
    @Column(length = 128) private String seedFile;
    @Column(nullable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
}

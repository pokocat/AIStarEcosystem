package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Prompt 模板版本快照。每次 admin 保存或回滚追加一行，不覆盖历史。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "prompt_template_version", indexes = {
        @Index(name = "idx_prompt_version_key", columnList = "prompt_key"),
        @Index(name = "idx_prompt_version_key_version", columnList = "prompt_key, version")
})
public class PromptTemplateVersion {

    @Id
    private String id;

    @Column(name = "prompt_key", nullable = false, length = 64)
    private String promptKey;

    @Column(name = "version", nullable = false)
    private int version;

    @Lob
    @Column(name = "system_prompt", columnDefinition = "LONGTEXT")
    private String systemPrompt;

    @Lob
    @Column(name = "user_template", columnDefinition = "LONGTEXT")
    private String userTemplate;

    @Lob
    @Column(name = "params_json", columnDefinition = "TEXT")
    private String paramsJson;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "change_note", length = 256)
    private String changeNote;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}

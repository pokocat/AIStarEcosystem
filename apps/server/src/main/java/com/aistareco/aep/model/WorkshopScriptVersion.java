package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 脚本工坊脚本版本（v0.45）。每次提交（含 AI 续写）产生一个新版本，构成脚本的版本树。
 * 字段镜像 packages/types/src/script.ts 的 ScriptVersion。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "workshop_script_versions")
public class WorkshopScriptVersion {

    @Id
    private String id;

    @Column(name = "script_id")
    private String scriptId;

    private int version;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String content;

    @Column(name = "author_name")
    private String authorName;

    @Column(name = "ai_assisted")
    private boolean aiAssisted;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}

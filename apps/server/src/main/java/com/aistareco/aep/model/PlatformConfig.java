package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 平台可配置项（键值 + JSON 值）。
 * 典型用途：孵化向导选项（faceStyles / fashionStyles / templates …）、
 * 锻造炉选项（hairStyles / eyeColors / faceSliders …）、
 * 后续 AI prompt 模版，等。
 *
 * <p>单表覆盖多域：{@code configKey} 如 "incubation.faceStyles"、"forge.hairStyles"；
 * {@code valueJson} 是自由 JSON（数组 / 对象 / 字符串均可）。
 *
 * <p>前端通过 public {@code GET /api/config/{key}} 读取，管理端通过
 * {@code /api/admin/platform-configs} CRUD；{@code version} 每次更新自增，
 * 供前端缓存校验。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_platform_configs")
public class PlatformConfig {

    @Id
    private String id;

    @Column(name = "config_key", unique = true, nullable = false, length = 128)
    private String configKey;

    @Column(name = "value_json", columnDefinition = "TEXT")
    private String valueJson;

    /** 每次更新自增，前端做缓存校验用。 */
    private int version;

    /** 管理端可选备注：说明该 key 的 schema / 用途。 */
    @Column(length = 512)
    private String description;

    private Instant updatedAt;

    /** 最后一次修改者（adminUserId 或 system）。 */
    @Column(length = 64)
    private String updatedBy;
}

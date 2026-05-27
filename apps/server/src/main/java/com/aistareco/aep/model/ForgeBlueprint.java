package com.aistareco.aep.model;

import com.aistareco.common.JsonMapConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.Map;

/**
 * 艺人形象"蓝图"快照：用户把一次 forge 生成结果固化为艺人的默认形象。
 * snapshotJson 存储本次生成的锁定字段 + 参数，便于未来 diff / 回滚。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_forge_blueprints")
public class ForgeBlueprint {

    @Id
    private String id;

    @Column(nullable = false)
    private String artistId;

    /** 指向 {@link ForgeResult#id} 的弱引用；source of truth 仍在 snapshotJson。 */
    @Column(nullable = false)
    private String resultId;

    private Instant createdAt;

    @Column(name = "snapshot_json", columnDefinition = "LONGTEXT")
    @Convert(converter = JsonMapConverter.class)
    private Map<String, Object> snapshotJson;
}

package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * 素材运营 · 爆款雷达候选（只读，seed 落库）。完整 ViralHit 存 payloadJson。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "material_viral_hits")
public class MaterialViralHit {

    @Id
    private String id;

    @Column
    private String platform;

    /** 爆款分，列表默认按此降序。 */
    @Column
    @Builder.Default
    private int score = 0;

    @Lob
    @Column(name = "payload_json", columnDefinition = "LONGTEXT", nullable = false)
    private String payloadJson;
}

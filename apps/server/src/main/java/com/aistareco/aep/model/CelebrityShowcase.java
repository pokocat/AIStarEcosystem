package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * CelebrityShowcase — 模板/盲盒模式下的往期案例展示（带水印缩略）。
 * 前端真值源：apps/web/src/types/celebrity-zone.ts {@code CelebrityShowcase}。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "celebrity_showcases")
public class CelebrityShowcase {

    @Id
    private String id;

    @Column(nullable = false)
    private String caption;

    /** CelebrityEngine：KeLing / HiGen / MiniMax。 */
    @Column(nullable = false)
    private String engine;

    @Column(nullable = false)
    private String plays;

    private String approval;

    @Column(length = 512)
    private String thumb;

    @Column(length = 512)
    private String videoUrl;

    /** 模式归属："template" 或 "blindbox"。 */
    @Column(nullable = false)
    private String mode;
}

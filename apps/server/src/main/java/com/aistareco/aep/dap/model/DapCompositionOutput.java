package com.aistareco.aep.dap.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** 合成产物单张（入库后即为该 IP 的衍生物）。 */
@Entity
@Table(name = "dap_composition_output", indexes = {
        @Index(name = "idx_dap_comp_out_comp", columnList = "compositionId"),
        @Index(name = "idx_dap_comp_out_owner", columnList = "ownerUserId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapCompositionOutput {

    @Id
    @Column(length = 40)
    private String id;

    @Column(nullable = false, length = 32)
    private String compositionId;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    /** 组内序号（展示为 01 / 02 …）。 */
    @Builder.Default
    private int idx = 0;

    /** 产物 storage key。 */
    @Column(length = 512)
    private String fileKey;

    /** 规格，如「768×1365 · PNG」。 */
    @Column(length = 128)
    private String spec;

    @Builder.Default
    private long bytes = 0;

    private Instant createdAt;
}

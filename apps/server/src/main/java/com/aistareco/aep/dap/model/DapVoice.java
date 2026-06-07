package com.aistareco.aep.dap.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
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
import java.util.ArrayList;
import java.util.List;

/** 我的声线资产（VC-xx）。克隆声线的试听 = 原始采样回放（TTS 合成排期中）。 */
@Entity
@Table(name = "dap_voice", indexes = {
        @Index(name = "idx_dap_voice_owner", columnList = "ownerUserId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapVoice {

    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    @Column(nullable = false, length = 128)
    private String name;

    /** 绑定的数字人资产 id（可空）。 */
    @Column(length = 32)
    private String avatarId;

    /** clone | design */
    @Column(nullable = false, length = 8)
    private String kind;

    @Column(length = 8)
    private String gender;

    @Column(length = 32)
    @Builder.Default
    private String lang = "中文 · 普通话";

    @Column(length = 32)
    private String tone;

    /** 展示时长，如 00:42。 */
    @Column(length = 8)
    private String dur;

    /** 波形条高度数组（展示用）。 */
    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private List<String> wave = new ArrayList<>();

    @Builder.Default
    private boolean fav = false;

    /** 原始采样音频 storage key。 */
    @Column(length = 512)
    private String audioKey;

    @Builder.Default
    private long bytes = 0;

    private Instant createdAt;
}

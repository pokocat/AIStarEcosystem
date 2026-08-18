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

    @Column(length = 64)
    private String engine;

    @Column(length = 160)
    private String engineRef;

    @Column(length = 24)
    private String engineStatus;

    private Instant engineTrainedAt;

    /**
     * 固化的样例试听音频（storage key）。声音训练完成后由 ClipDemoWorker 用固定样例文案生成一次，
     * 之后端上「听听你的声音」直接播这一条 —— 零等待、成本固定，也不必靠限流防薅。
     * 用户自己改了文字才走按需合成（POST /me/clip/voices/{id}/preview）。
     */
    @Column(length = 300)
    private String demoAudioCdnKey;

    /** 样例生成尝试次数。素材本身有问题时会一直失败，没有它 worker 会永远重试下去。 */
    @Column(nullable = false)
    @Builder.Default
    private Integer demoAttempts = 0;

    private Instant createdAt;

    /** 与其它五类 DAP 资产一致的软删除语义。 */
    private Instant deletedAt;
}

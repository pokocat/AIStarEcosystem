package com.aistareco.aep.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_forge_results")
public class ForgeResult {

    @Id
    private String id;

    private String artistId;

    private String image;

    /**
     * 保存后为该形象关联的短视频 URL。
     * 当前 AI 视频生成未接入，{@code POST /appearance-forge/save} 会从后端
     * 预置的 demo 池中随机挑一个写入；接入真实 AI 后替换为产出流水的对象存储 URL。
     */
    private String videoUrl;

    @Column(columnDefinition = "TEXT")
    private String prompt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ForgeMode mode;

    private Instant createdAt;

    @Column(columnDefinition = "TEXT")
    @Convert(converter = StringListConverter.class)
    private List<String> locked;

    public enum ForgeMode {
        TEMPLATE_PHOTO, PROMPT_ONLY, TEMPLATE_PROMPT, RANDOM
    }
}

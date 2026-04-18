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

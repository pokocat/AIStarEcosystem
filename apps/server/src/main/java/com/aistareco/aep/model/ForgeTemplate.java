package com.aistareco.aep.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_forge_templates")
public class ForgeTemplate {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    private String image;

    @Column(columnDefinition = "TEXT")
    @Convert(converter = StringListConverter.class)
    private List<String> tags;

    private String style;
}

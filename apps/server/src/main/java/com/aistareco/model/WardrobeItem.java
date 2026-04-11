package com.aistareco.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "wardrobe_items")
public class WardrobeItem {

    @Id private String id;
    private String nameZh;
    private String nameEn;
    private String category;
    private String imageUrl;
    private String rarity;
    private int price;

    @Column(columnDefinition = "TEXT")
    @Convert(converter = StringListConverter.class)
    private List<String> tags;

    private boolean locked;
    private boolean newItem;
    private boolean trending;
}

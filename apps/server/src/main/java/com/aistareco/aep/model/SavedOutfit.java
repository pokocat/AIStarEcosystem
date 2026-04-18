package com.aistareco.aep.model;

import com.aistareco.common.JsonMapConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.Map;

/**
 * 用户保存的造型搭配。
 * slotsJson 以 {@code {slot: itemId}} 形式存储（e.g. {@code {"top": "cloth-1", "bottom": "cloth-2"}}），
 * 槽位集合可能随衣橱扩展演进，故用 JSON 列。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_saved_outfits")
public class SavedOutfit {

    @Id
    private String id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String name;

    private Instant createdAt;

    @Column(name = "slots_json", columnDefinition = "TEXT")
    @Convert(converter = JsonMapConverter.class)
    private Map<String, Object> slotsJson;
}

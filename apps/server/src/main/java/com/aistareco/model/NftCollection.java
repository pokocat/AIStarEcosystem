package com.aistareco.model;

import jakarta.persistence.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "nft_collections")
public class NftCollection {

    @Id private String id;
    private String name;
    private String coverUrl;
    private String priceLabel;
    private int remaining;
    private String rarity;
    private String trackId;
}

package com.aistareco.model;

import jakarta.persistence.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "marketplace_listings")
public class MarketplaceListing {

    @Id private String id;
    private String artistId;
    private String name;
    private String style;
    private String avatarUrl;
    private String priceLabel;
    private String owner;
    private int songs;
    private String followersLabel;

    @Column(length = org.hibernate.Length.LONG32)
    private String description;

    private boolean autoReplyEnabled;
}

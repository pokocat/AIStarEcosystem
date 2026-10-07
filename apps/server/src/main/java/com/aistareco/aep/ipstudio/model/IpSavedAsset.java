package com.aistareco.aep.ipstudio.model;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
@Entity @Table(name="ip_saved_asset")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class IpSavedAsset {
    @Id @Column(length=32) private String id;
    @Column(nullable=false,length=64) private String ownerUserId;
    @Lob @Column(nullable=false,columnDefinition="LONGTEXT") private String payloadJson;
    private Instant createdAt;
    private Instant deletedAt;
}

package com.aistareco.aep.ipstudio.model;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
/** Personal directory only. Media files and generation receipts retain their existing authorities. */
@Entity @Table(name="ip_library_record",indexes=@Index(name="idx_ip_library_owner_type",columnList="ownerUserId,recordType"))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class IpLibraryRecord {
    @Id @Column(length=32) private String id;
    @Column(nullable=false,length=64) private String ownerUserId;
    @Column(nullable=false,length=16) private String recordType;
    @Lob @Column(nullable=false,columnDefinition="LONGTEXT") private String payloadJson;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
}

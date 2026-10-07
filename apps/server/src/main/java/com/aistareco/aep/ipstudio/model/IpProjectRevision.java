package com.aistareco.aep.ipstudio.model;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
@Entity @Table(name="ip_project_revision")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class IpProjectRevision {
    @Id @Column(length=32) private String id;
    @Column(nullable=false,length=32) private String projectId;
    @Column(nullable=false,length=128) private String name;
    @Lob @Column(nullable=false,columnDefinition="LONGTEXT") private String docJson;
    private Instant createdAt;
}

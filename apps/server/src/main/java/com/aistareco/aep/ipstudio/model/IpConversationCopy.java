package com.aistareco.aep.ipstudio.model;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name="ip_conversation_copy",uniqueConstraints=@UniqueConstraint(name="uk_ip_conversation_copy",columnNames={"owner_user_id","client_request_id"}))
@Getter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpConversationCopy {
    @Id @Column(length=32) private String id;
    @Column(name="owner_user_id",nullable=false,length=64) private String ownerUserId;
    @Column(name="client_request_id",nullable=false,length=128) private String clientRequestId;
    @Column(nullable=false,length=32) private String token;
    @Column(name="project_id",nullable=false,length=32) private String projectId;
}

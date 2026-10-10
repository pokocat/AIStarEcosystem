package com.aistareco.aep.ipstudio.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name="ip_video_effect_activity",uniqueConstraints=@UniqueConstraint(name="uk_ip_effect_activity",columnNames={"owner_user_id","effect_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpVideoEffectActivity {
    @Id @Column(length=32) private String id;
    @Column(name="owner_user_id",nullable=false,length=64) private String ownerUserId;
    @Column(name="effect_id",nullable=false,length=32) private String effectId;
    @Column(nullable=false) private boolean favorite;
    @Column(name="last_used_at") private Instant lastUsedAt;
}

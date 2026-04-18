package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_voice_works")
public class VoiceWork {

    @Id
    private String id;

    @Column(nullable = false)
    private String project;

    @Enumerated(EnumType.STRING)
    private VoiceWorkType type;

    /** Duration in minutes. */
    private int duration;

    @Enumerated(EnumType.STRING)
    private VoiceWorkStatus status;

    private long payment;

    public enum VoiceWorkType {
        ANIMATION, DOCUMENTARY, AUDIOBOOK, GAME
    }

    public enum VoiceWorkStatus {
        RECORDING, EDITING, DELIVERED
    }
}

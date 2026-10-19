package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/** Durable admission ticket; no prompts, keys, URLs or second billing truth. */
@Entity @Table(name="ai_generation_queue",uniqueConstraints=@UniqueConstraint(name="uk_ai_generation_task",columnNames={"task_type","task_id"}))
@Getter @Setter @NoArgsConstructor
public class AiGenerationQueueEntry {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false,length=64) private String endpointId;
    @Column(nullable=false,length=32) private String taskType;
    @Column(nullable=false,length=64) private String taskId;
    @Column(nullable=false,length=16) private String state;
    @Column(nullable=false) private Instant createdAt;
    @Column(nullable=false) private Instant dispatchAfter;
}

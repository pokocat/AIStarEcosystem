package com.aistareco.aep.ipstudio.execution;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/**
 * Orchestration state of one skill plan execution (docs/ip-studio-conversational-video-recreation-plan.md §三处真值与新执行表).
 *
 * <p>Owns stage, plan binding, steps with their native run ids and attempts, approved budgets, payer binding, lease and
 * user decisions. It never owns prices, holds, settlement or outputs: those stay on IpRun / native media jobs and the
 * ledger. {@code spent / inFlight} are persisted summaries refreshed from native runs for the pre-submit budget check.
 * The canvas document is never written from here.
 */
@Entity
@Table(name="ip_plan_execution",
        uniqueConstraints=@UniqueConstraint(name="uk_ip_plan_execution_request",columnNames={"owner_user_id","client_request_id"}),
        indexes=@Index(name="idx_ip_plan_execution_project",columnList="projectId,status"))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class IpPlanExecution {
    public static final String RUNNING="running",PAUSED="paused",NEEDS_USER="needs_user",DONE="done",PARTIAL="partial",FAILED="failed",CANCELED="canceled";

    @Id @Column(length=32) private String id;
    @Column(nullable=false,length=32) private String projectId;
    @Column(nullable=false,length=64) private String ownerUserId;
    @Column(length=64) private String threadId;
    @Column(nullable=false,length=64) private String skillKey;
    private int skillVersion;
    @Column(nullable=false,length=16) private String stage;
    @Column(nullable=false,length=32) private String planRunId;
    private int planRevision;
    @Column(nullable=false,length=64) private String planFingerprint;
    @Column(nullable=false,length=16) private String status;
    @Lob @Column(nullable=false,columnDefinition="LONGTEXT") private String stepsJson;
    @Lob @Column(nullable=false,columnDefinition="LONGTEXT") private String budgetJson;
    @Builder.Default private long spent=0;
    @Builder.Default private long inFlight=0;
    @Lob @Column(nullable=false,columnDefinition="TEXT") private String billingJson;
    @Column(length=64) private String leaseOwner;
    private Instant leaseUntil;
    @Builder.Default private long leaseVersion=0;
    @Column(nullable=false,length=64) private String clientRequestId;
    private Instant startedAt;
    private Instant deadlineAt;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant finishedAt;

    /** Only these states hold the project's single active execution slot. */
    public static boolean active(String status) {return RUNNING.equals(status)||PAUSED.equals(status)||NEEDS_USER.equals(status);}
}

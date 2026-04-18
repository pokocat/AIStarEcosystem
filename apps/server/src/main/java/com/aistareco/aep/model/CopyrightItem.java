package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_copyrights")
public class CopyrightItem {

    @Id
    private String id;

    @Column(nullable = false)
    private String title;

    private String artistName;

    /** Free-text content type, e.g. "Original Song", "Cover". */
    private String contentType;

    private LocalDate submittedDate;

    /** FK → aep_users.id：用户提交版权登记时的归属账户。admin 直接录入时可为空。 */
    private String submittedByUserId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CopyrightStatus status;

    public enum CopyrightStatus {
        PENDING, VERIFIED
    }
}

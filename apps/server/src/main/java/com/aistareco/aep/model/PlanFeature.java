package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_plan_features")
public class PlanFeature {

    @Id
    private String id;

    private String planId;
    private String featureCode;
    private String value;
}

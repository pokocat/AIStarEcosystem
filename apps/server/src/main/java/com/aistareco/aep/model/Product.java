package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_products")
public class Product {

    @Id
    private String id;

    @Column(unique = true, nullable = false)
    private String code;

    private String name;
    private String description;
    private boolean enabled;
    private Instant createdAt;
}

package com.aistareco.aep.ipstudio.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Immutable;
import java.time.Instant;

/** Append-only release. A new publication gets a new ID and cannot overwrite an existing instance. */
@Entity @Immutable
@Table(name="ip_template_version", uniqueConstraints=@UniqueConstraint(name="uk_ip_template_version",columnNames={"template_id","version_no"}))
@Getter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpTemplateVersion {
    @Id @Column(length=32) private String id;
    @Column(name="template_id",nullable=false,length=32) private String templateId;
    @Column(name="version_no",nullable=false) private int version;
    @Column(nullable=false,length=128) private String name;
    @Column(length=1024) private String summary;
    @Lob @Column(name="recipe_json",nullable=false,columnDefinition="LONGTEXT") private String recipeJson;
    @Lob @Column(name="doc_json",nullable=false,columnDefinition="LONGTEXT") private String docJson;
    @Column(name="created_at",nullable=false) private Instant createdAt;
}

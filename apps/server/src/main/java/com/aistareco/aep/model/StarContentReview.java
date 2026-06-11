package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 内容审核条目（v0.60 web-star）。
 * 来源：切片二创 / 数字人产出 / AI 形象生成视频。
 * 四态：pending / approved / revision / rejected；revision 携带修改意见回流 MCN 端返工。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "star_content_reviews")
public class StarContentReview {

    @Id
    private String id;

    @Column(name = "star_id", nullable = false)
    private String starId;

    @Column(nullable = false, length = 256)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ContentType type;

    @Column(nullable = false)
    private String uploader;

    @Column(nullable = false)
    private String mcnName;

    @Column(nullable = false)
    @Builder.Default
    private int durationSec = 0;

    @Column(nullable = false)
    private OffsetDateTime submittedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Status status;

    @Column(nullable = false, length = 32)
    private String platform;

    /** 已发布内容的播放量（可空）。 */
    private Long views;

    @Column(length = 512)
    private String revisionNote;

    public enum ContentType {
        CLIP("clip"),
        DIGITAL_HUMAN("digitalHuman"),
        AI_LIKENESS("aiLikeness");

        private final String wire;
        ContentType(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static ContentType fromWire(String w) {
            for (ContentType t : values()) if (t.wire.equals(w)) return t;
            throw new IllegalArgumentException("unknown StarContentReview.ContentType: " + w);
        }
    }

    public enum Status {
        PENDING("pending"),
        APPROVED("approved"),
        REVISION("revision"),
        REJECTED("rejected");

        private final String wire;
        Status(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static Status fromWire(String w) {
            for (Status s : values()) if (s.wire.equals(w)) return s;
            throw new IllegalArgumentException("unknown StarContentReview.Status: " + w);
        }
    }
}

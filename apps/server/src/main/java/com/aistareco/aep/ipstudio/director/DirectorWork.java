package com.aistareco.aep.ipstudio.director;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * AI 导演台的一部作品（docs/ai-director-plan.md §10.3）。
 *
 * <p>和画布不同，作品内容由服务端拥有：三个工作区和后台连跑都读写这一行，
 * 用户编辑带对象修订号，后台只填空位和追加候选。{@code contentJson} 只存存储 key，签名地址出 wire 时派生。
 */
@Entity
@Table(name = "director_work")
@Getter
@Setter
@NoArgsConstructor
public class DirectorWork {
    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    @Column(nullable = false, length = 120)
    private String title;

    /** 作品级修订号：任何内容变化都 +1，前端据此判断要不要刷新。 */
    private long revision;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String contentJson;

    /** 有在跑的任务或连跑时为 true，后台调度只扫这些作品。 */
    private boolean active;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
}

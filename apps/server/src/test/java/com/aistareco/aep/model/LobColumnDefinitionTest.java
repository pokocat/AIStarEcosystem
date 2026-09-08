package com.aistareco.aep.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Lob;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 每个 {@code @Lob String} 字段都必须显式写 {@code columnDefinition}。
 *
 * <p>线上事故（v0.178）：{@code CardProfile.payloadJson} 只写了 {@code @Lob}、没写
 * {@code columnDefinition}。Hibernate 6 于是按 {@code @Column} 的默认长度 255 去挑
 * MySQL 的 text 家族 —— 挑中 <b>tinytext（255 字节）</b>；一张名片的文档随手就超，
 * 建卡直接 500「Data too long for column 'payload_json'」。而 ddl-auto 只加不改，
 * 建错一次就一直错着，只能再补一条迁移去拉宽（V30）。
 *
 * <p>H2 测试<b>逮不到</b>这一类：H2 把 {@code @Lob String} 一律当 CLOB，怎么写都不会截断。
 * 所以只能在映射这一层直接钉死 —— 写没写 columnDefinition 是能静态检查的。
 */
class LobColumnDefinitionTest {

    @Test
    @DisplayName("@Lob String 必须显式声明列类型（否则 MySQL 会挑到 tinytext）")
    void everyLobStringDeclaresItsColumnType() throws Exception {
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));

        List<String> offenders = new ArrayList<>();
        int lobFields = 0;
        var entities = scanner.findCandidateComponents("com.aistareco");
        // 扫不到东西的话这条测试就是「空绿」—— 比没有还糟，所以先钉死它确实扫到了
        assertTrue(entities.size() > 50, "只扫到 " + entities.size() + " 个实体，扫描器坏了");
        for (var bd : entities) {
            Class<?> type = Class.forName(bd.getBeanClassName());
            for (Field f : type.getDeclaredFields()) {
                if (!f.isAnnotationPresent(Lob.class) || f.getType() != String.class) continue;
                lobFields++;
                Column col = f.getAnnotation(Column.class);
                if (col == null || col.columnDefinition().isBlank()) {
                    offenders.add(type.getSimpleName() + "." + f.getName());
                }
            }
        }

        assertTrue(lobFields > 5, "只找到 " + lobFields + " 个 @Lob String 字段，过滤条件写错了");
        assertTrue(offenders.isEmpty(),
                "这些 @Lob String 字段没写 columnDefinition，MySQL 上会被建成 tinytext(255)："
                        + offenders + "；照 DramaProject.payloadJson 补 columnDefinition = \"LONGTEXT\"");
    }
}

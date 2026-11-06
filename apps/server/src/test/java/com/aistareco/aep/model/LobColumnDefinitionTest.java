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

/** 大文本容量与 JDBC 绑定契约，守住原 tinytext 截断事故及 PG OID 风险。 */
class LobColumnDefinitionTest {
    @Test
    @DisplayName("大文本必须保留显式容量，字符串不能走 JDBC LOB locator")
    void everyLobStringDeclaresItsColumnType() throws Exception {
        var scanner=new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        var entities=scanner.findCandidateComponents("com.aistareco");
        assertTrue(entities.size()>150,"实体扫描不能为空");
        int largeFields=0;var offenders=new ArrayList<String>();
        for(var bean:entities) for(Field f:Class.forName(bean.getBeanClassName()).getDeclaredFields()) {
            Column column=f.getAnnotation(Column.class);
            var jdbc=f.getAnnotation(org.hibernate.annotations.JdbcTypeCode.class);
            if(f.isAnnotationPresent(Lob.class) && f.getType()==String.class) offenders.add(f+" 仍使用 JDBC LOB");
            if(column!=null && (column.length()==org.hibernate.Length.LONG32 || jdbc!=null && jdbc.value()==org.hibernate.type.SqlTypes.LONGVARCHAR)) {
                largeFields++;
                if(column.length()!=org.hibernate.Length.LONG32 && !column.columnDefinition().equalsIgnoreCase("TEXT"))
                    offenders.add(f+" 缺少显式大文本容量");
                if(column.columnDefinition().equalsIgnoreCase("LONGTEXT")) offenders.add(f+" 仍硬编码 MySQL 方言");
            }
        }
        assertTrue(largeFields>80,"应检查所有原大文本字段，实际 "+largeFields);
        assertTrue(offenders.isEmpty(),offenders.toString());
    }
}

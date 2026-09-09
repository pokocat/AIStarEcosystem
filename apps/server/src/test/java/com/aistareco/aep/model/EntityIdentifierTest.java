package com.aistareco.aep.model;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 每个 {@code @Entity} 都必须有 {@code @Id}（或 {@code @EmbeddedId}），
 * 且它必须落在**实例字段**上 —— 不能是 static / final 常量。
 *
 * <p><b>为什么要有这条。</b>2026-09-09 线上事故：用脚本往
 * {@code IpDemoTemplate} 里插两个 {@code public static final} 常量，锚点选的是
 * {@code @Column(length = 32)} 那一行，而 {@code @Id} 在它上一行 —— 常量插进了
 * {@code @Id} 与 {@code id} 字段中间，{@code @Id} 就落到常量上去了。
 *
 * <p>后果：{@code Entity 'IpDemoTemplate' has no identifier} →
 * entityManagerFactory 建不起来 → 整个 Spring 上下文起不来 → 服务重启循环、API 全挂。
 *
 * <p><b>四道门禁一个都没拦住</b>：`mvnw compile` 过（注解放在常量上是合法 Java）、
 * 122 个 ipstudio 单测过（全是 mock，不碰 JPA 元模型）、typecheck 与契约门更不相干。
 * 唯一会炸的是真的建 EntityManagerFactory，而那批 {@code @SpringBootTest} 早就因为
 * 既有的 {@code drama_character.cast}（H2 保留字）红着 —— 等于这道网本来就是破的。
 *
 * <p>这个测试是纯反射、不连数据库、毫秒级，补的正是那张破网上最要命的一个洞。
 */
class EntityIdentifierTest {

    @Test
    void 每个实体都要有落在实例字段上的主键() throws Exception {
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        var candidates = scanner.findCandidateComponents("com.aistareco");
        assertTrue(candidates.size() > 50,
                "扫到的实体太少（" + candidates.size() + "），扫描没生效就等于这个测试永远绿");

        List<String> missing = new ArrayList<>();
        List<String> onConstant = new ArrayList<>();

        for (var bd : candidates) {
            Class<?> type = Class.forName(bd.getBeanClassName());
            boolean hasId = false;
            for (Class<?> k = type; k != null && k != Object.class; k = k.getSuperclass()) {
                for (Field f : k.getDeclaredFields()) {
                    boolean marked = f.isAnnotationPresent(Id.class) || f.isAnnotationPresent(EmbeddedId.class);
                    if (!marked) continue;
                    hasId = true;
                    // 落在常量上 = 今天那个事故的形状：注解在，但它标的不是持久化字段
                    if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) {
                        onConstant.add(type.getSimpleName() + "." + f.getName());
                    }
                }
                // @Id 也可能标在 getter 上（属性访问）——那种同样算有
                for (var m : k.getDeclaredMethods()) {
                    if (m.isAnnotationPresent(Id.class) || m.isAnnotationPresent(EmbeddedId.class)) hasId = true;
                }
            }
            if (!hasId) missing.add(type.getName());
        }

        assertTrue(onConstant.isEmpty(),
                "@Id 标在了 static 常量上（脚本改实体时把注解和字段插散了）：" + onConstant);
        assertTrue(missing.isEmpty(),
                "这些 @Entity 没有 @Id —— 会让 entityManagerFactory 建不起来、整个服务起不来：" + missing);
    }
}

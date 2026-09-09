package com.aistareco.aep.model;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.IdClass;
import jakarta.persistence.MappedSuperclass;
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
 * 且它必须落在**实例**字段（或 getter）上 —— 不能是 static 常量，也不能来自一个
 * 既非 {@code @Entity} 也非 {@code @MappedSuperclass} 的普通父类（那种 @Id 不会被映射）。
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
        List<String> badIdClass = new ArrayList<>();

        for (var bd : candidates) {
            Class<?> type = Class.forName(bd.getBeanClassName());
            boolean hasId = false;
            List<String> idFieldNames = new ArrayList<>();
            for (Class<?> k = type; k != null && k != Object.class; k = k.getSuperclass()) {
                // 只有实体自己、以及**持久化**父类上的 @Id 才会被映射。普通父类上标了也不算 ——
                // 那种「看起来有主键、实际 EMF 仍然建不起来」正是这道网最该拦的形状。
                if (k != type && !k.isAnnotationPresent(Entity.class)
                        && !k.isAnnotationPresent(MappedSuperclass.class)) continue;
                for (Field f : k.getDeclaredFields()) {
                    boolean marked = f.isAnnotationPresent(Id.class) || f.isAnnotationPresent(EmbeddedId.class);
                    if (!marked) continue;
                    // 落在常量上 = 今天那个事故的形状：注解在，但它标的不是持久化字段
                    if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) {
                        onConstant.add(type.getSimpleName() + "." + f.getName());
                        continue;   // 常量不算主键，否则事故实体反而被判成「有主键」
                    }
                    hasId = true;
                    idFieldNames.add(f.getName());
                }
                // @Id 也可能标在 getter 上（属性访问）——那种同样算有，但同样不能是 static
                for (var m : k.getDeclaredMethods()) {
                    if (!m.isAnnotationPresent(Id.class) && !m.isAnnotationPresent(EmbeddedId.class)) continue;
                    if (java.lang.reflect.Modifier.isStatic(m.getModifiers())) {
                        onConstant.add(type.getSimpleName() + "." + m.getName() + "()");
                        continue;
                    }
                    hasId = true;
                }
            }
            if (!hasId) missing.add(type.getName());

            // 复合主键：@IdClass 里必须逐个对得上 @Id 字段名，对不上 EMF 同样建不起来。
            IdClass idClass = type.getAnnotation(IdClass.class);
            if (idClass != null) {
                for (String name : idFieldNames) {
                    try {
                        idClass.value().getDeclaredField(name);
                    } catch (NoSuchFieldException e) {
                        badIdClass.add(type.getSimpleName() + ".@Id " + name
                                + " 在 " + idClass.value().getSimpleName() + " 里没有同名字段");
                    }
                }
            }
        }

        assertTrue(onConstant.isEmpty(),
                "@Id 标在了 static 常量上（脚本改实体时把注解和字段插散了）：" + onConstant);
        assertTrue(badIdClass.isEmpty(),
                "@IdClass 与 @Id 字段对不上：" + badIdClass);
        assertTrue(missing.isEmpty(),
                "这些 @Entity 没有 @Id —— 会让 entityManagerFactory 建不起来、整个服务起不来：" + missing);
    }
}

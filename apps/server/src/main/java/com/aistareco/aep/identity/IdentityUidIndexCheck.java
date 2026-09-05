package com.aistareco.aep.identity;

import db.migration.V24__aep_user_identity_uid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;

/**
 * 启动自检：{@code aep_users.identity_uid} 上确实有唯一约束（{@code docs/unified-identity-plan.md} §7）。
 *
 * <p>为什么要查：唯一约束是「一个账号中心 uid 只对应本产品一条本地档案」的**唯一**硬保证 ——
 * JIT 建档、老用户导入、{@code USER_MERGED} 改指都靠它挡住并发下的重复档案。
 * 如果 V24 迁移在某个环境上没落地（比如历史库里被手工改过），代码不会报错，
 * 只会在某天出现两条挂同一个 uid 的档案。这里在启动时喊一声。
 *
 * <p>只 ERROR 记录、**不阻断启动**：dev / 测试库可能根本还没建表，或正处于 ddl-auto 建表之前。
 * 判定按**列**而不是按索引名 —— 全新 H2 上这个约束由 Hibernate 按实体的
 * {@code @Column(unique = true)} 生成，名字是 {@code UK_xxxxxx} 而不是
 * {@code uk_aep_users_identity_uid}，按名字判会天天误报。
 */
@Component
@Order(105)
public class IdentityUidIndexCheck implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(IdentityUidIndexCheck.class);

    private final DataSource dataSource;

    public IdentityUidIndexCheck(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) {
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData md = conn.getMetaData();
            String table = V24__aep_user_identity_uid.resolveTableName(
                    md, V24__aep_user_identity_uid.TABLE);
            if (table == null) return;   // 表还没建（全新库 / ddl-auto 尚未跑），无从判定
            if (!V24__aep_user_identity_uid.columnExists(md, table, V24__aep_user_identity_uid.COLUMN)) {
                log.error("[identity] {}.{} 列缺失 —— 统一账号中心映射不可用，请检查 Flyway V24 是否执行",
                        table, V24__aep_user_identity_uid.COLUMN);
                return;
            }
            String index = V24__aep_user_identity_uid.uniqueIndexOn(
                    md, table, V24__aep_user_identity_uid.COLUMN);
            if (index == null) {
                log.error("[identity] {}.{} 缺少唯一约束（期望 {}）—— 同一个账号中心 uid 可能建出多条本地档案，"
                                + "请手工补：CREATE UNIQUE INDEX {} ON {} ({})",
                        table, V24__aep_user_identity_uid.COLUMN, V24__aep_user_identity_uid.INDEX,
                        V24__aep_user_identity_uid.INDEX, table, V24__aep_user_identity_uid.COLUMN);
            } else {
                log.debug("[identity] {}.{} 唯一约束就绪（索引 {}）",
                        table, V24__aep_user_identity_uid.COLUMN, index);
            }
        } catch (Exception e) {
            log.warn("[identity] identity_uid 唯一约束自检未完成（不影响启动）：{}", e.toString());
        }
    }
}

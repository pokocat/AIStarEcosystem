# Flyway 迁移 —— 编号真源

**编号横跨两个目录，必须一起数：**

| 目录 | 形态 | 当前占用 |
|---|---|---|
| `src/main/resources/db/migration/V*.sql` | SQL 迁移 | V1、V14–V20 |
| `src/main/java/db/migration/V*.java` | Java 迁移（`BaseJavaMigration`） | V2–V13、V21–V23 |

只 `ls` 本目录会看到「V1 跳到 V14、停在 V20」的假象，据此推断「编号漂移 / 文件丢了」是**错的**
（2026-08-31 踩过一次；更早还有一次 V20 撞号事故）。

**下一个可用编号 = 线上 `flyway_schema_history` 最大 version + 1**，不是本目录最大值 + 1：

```sql
SELECT version, description, script, checksum FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 5;
```

`script` 列可直接区分两种迁移：SQL 迁移记文件名且带 checksum；Java 迁移记 `db.migration.V23__xxx`，checksum 为 NULL。

## 什么时候必须写 Java 迁移

`out-of-order: false` + `validate-on-migrate: true`，且 Flyway 跑在 Hibernate `ddl-auto` **之前**。
所以：**改一张由 ddl-auto 创建的表**（如 `drama_shorts`、`aep_songs`）时，全新 dev H2 库首启时该表还不存在，
纯 `.sql` 迁移会直接失败、应用起不来。这类改动写成 Java 迁移，逐条 DDL 各自 `try/catch` 跳过
（范式见 `V21__song_owner_and_optional_artist.java`、`V23__drama_short_client_request_id.java`）。

建新表、或改由迁移自己建出来的表（如 `clip_*`），用 `.sql` 即可。

## 已执行的迁移不可修改

线上跑过的 SQL 迁移带 checksum，改动内容会导致 Flyway 校验和漂移、启动失败（v0.124 教训：
当时改了已执行的 V14，只能恢复原文并新开 V15）。要修就新开一个编号。

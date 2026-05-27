# infra/rds/ — 阿里云 RDS MySQL 8.0 初始化

## 1. 创建 RDS 实例（控制台）

- **引擎**：MySQL 8.0
- **规格**：起步选 2 核 4G（**Note** 项目当前数据量轻量，单 ECS 时这个规格够 6-12 个月）
- **存储**：SSD ESSD PL1 50GB；按 5GB/月 增长预估
- **网络**：**专有 VPC**（与 ECS 同 VPC + 同 vSwitch），切忌经典网络
- **白名单**：默认空 → 加 ECS 内网 CIDR 或固定内网 IP
- **参数组**：
  - `character_set_server = utf8mb4`
  - `collation_server = utf8mb4_unicode_ci`
  - `lower_case_table_names = 1`（与 H2 dev 模式一致）
  - `time_zone = +08:00`
  - `max_connections = 1000`（HikariCP 默认 pool=10，多实例时按 实例数 × 10 + 50% buffer 反推）
- **高可用**：单可用区起步；上多实例后切高可用版

## 2. 拿到 endpoint

控制台「连接信息」会给两个：

- **内网 endpoint**：形如 `rm-xxxxxxxx.mysql.rds.aliyuncs.com:3306`，**仅在 VPC 内可达**
- **外网 endpoint**：形如 `rm-xxxxxxxx.mysql.rds.aliyuncs.com:3306`，需手动开

**生产 server.env 必须用内网 endpoint**：免流量费 + 延迟更低（< 1ms）+ 不受公网爆破。

## 3. 创建主账号 + 应用账号

控制台「账号管理」先创主账号 `aistareco_root`（高权限）：

```
Username: aistareco_root
Password: <FILL>
Type:     高权限账号
```

然后用主账号登录 RDS 跑：

```bash
# 在能访问 RDS 内网的 ECS 上执行（或开外网白名单临时本机执行）
mysql -h <RDS_INTERNAL_HOST> -P 3306 -u aistareco_root -p < 00_create_database.sql

# 编辑 01_create_app_user.sql，替换 <APP_PASSWORD> 和 <VPC_CIDR_OR_PERCENT>
mysql -h <RDS_INTERNAL_HOST> -P 3306 -u aistareco_root -p < 01_create_app_user.sql
```

## 4. Flyway 接管

server v0.34+ 引入了 Flyway（`apps/server/pom.xml` 加 `flyway-mysql`），
启动时会自动：

1. 检查 `flyway_schema_history` 表是否存在
2. 不存在 → 按 `application-mysql.yml` 的 `flyway.baseline-on-migrate=true` 自动 baseline 到 V1
3. 存在 → 比较 `db/migration/V*.sql` 与已应用记录，缺什么补什么

`apps/server/src/main/resources/db/migration/` 目录约定：

- `V1__baseline.sql` — **当前线上库的完整 schema dump**（占位符，需在切 RDS 时填入真实 dump）
- `V2__<change>.sql` — 后续每次结构改动按时间顺序加版本号

**临时阶段（V1 baseline 文件还是占位时）**：
- 保持 `spring.jpa.hibernate.ddl-auto: update`（让 Hibernate 继续建表，避免启动失败）
- Flyway 只跟踪 V2+ 的增量

**最终阶段**（V1 baseline 填入真实 dump 后）：
- 切 `spring.jpa.hibernate.ddl-auto: validate`
- Hibernate 启动时只校验 schema 与 entity 字段对齐，**不再 ALTER**
- 任何结构改动必须先写 `V<N>__xxx.sql` 文件 + commit

## 5. 监控告警

控制台「监控与告警」开：
- CPU > 80% 持续 3 分钟
- 内存使用率 > 85%
- 磁盘使用率 > 80%
- 连接数 > 800（占 max_connections 80%）
- 主从延迟 > 30s（高可用版才有）

## 6. 备份

控制台「备份恢复」默认开「数据备份」+ 「日志备份」：
- 全量备份：每天凌晨 2-4 点
- 日志备份：实时
- 保留 7 天起步；正式上线后改 30 天

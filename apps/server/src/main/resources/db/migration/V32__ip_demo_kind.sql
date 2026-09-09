-- 全局示例分成「模板」与「实例」两种（v0.192）。
--
-- 起因：原来「存为全局示例」只有一种产物 —— 连素材一起复制。但这两件事用户的意图不同：
--   * 模板（template）：我把**工作流**共享出去 —— 节点怎么排、提示词怎么写。
--     素材是我自己的照片，不该跟着走。用户拿它当**起点**，填自己的素材。
--   * 实例（example）：我把**做完的成品**共享出去 —— 素材成图都在，
--     用户点开就能看见这条链最终长什么样。
--
-- 两者的落点也不同：模板进「开始一个 IP」那一排，实例进画布列表（带「官方示例」标记）。
--
-- 编号：线上 flyway_schema_history 已执行到 31（实测查过），故开 V32。
-- 编号横跨 resources/db/migration/*.sql 与 src/main/java/db/migration/*.java 两处，
-- 见本目录 README.md。
--
-- 存量行一律按 example：v0.182 起存下来的都是带素材的，改判成 template 会让它们
-- 的素材凭空消失。
ALTER TABLE ip_demo_template
    ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'example';

-- 目录按 kind 分开查，加索引免得两条列表都全表扫
CREATE INDEX idx_ip_demo_kind_enabled ON ip_demo_template (kind, enabled, sort_order);

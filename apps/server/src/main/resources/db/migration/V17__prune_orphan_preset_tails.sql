-- 清掉两条没有模板会用、用户又删不掉的预置片尾（2026-08-14）。
--
-- 背景：ClipOfficialTailSeeder 曾给三个官方模板各种一条片尾。产品侧后来只保留
-- 「为实体发声」(ct_shiti)，端上 catalog.js 的 OFFERED_TEMPLATE_IDS 也只剩它一个，
-- 但 ct_kaimen / ct_shouyi 的片尾还留在 clip_asset 里。这类 preset 素材的
-- external_owner_id 是 NULL，却会被 list() 混排进**每个用户**的素材库 —— 看得见、
-- 删不掉（真机实测报「素材不存在或无权访问」，追查号 BDMCTJKH77K2）。
--
-- ★ 只删这两条，按 id 写死，不做「自动清理孤儿预置素材」那种规则：
--   判错一次就是删掉正在用的片尾，而片尾是运营逐条定稿的内容。
--   ct_shiti 的片尾（ca_tail_story / ca_tail_story_v2）不在此列，保持不动。
--
-- 同一批把引用它们的模板片尾清空：留下指向已删素材的 tailClip，会在出片时才炸，
-- 炸在离原因最远的地方。
--
-- 磁盘上的媒体文件不由本迁移删除（SQL 碰不到对象存储）；它们成为孤儿文件，
-- 由存储侧的常规清理处理。宁可留几个孤儿文件，也不在迁移里做无法回滚的删文件动作。

UPDATE clip_template
   SET tail_clips_json = '{"items":[]}'
 WHERE deleted_at IS NULL
   AND id IN ('ct_kaimen', 'ct_shouyi')
   AND tail_clips_json IS NOT NULL;

DELETE FROM clip_asset
 WHERE id IN ('ca_tail_open', 'ca_tail_craft')
   AND preset = TRUE;

-- 删掉 2026-08-13 片尾换新后被取代的旧片尾 ca_tail_story（「故事收束」）。
--
-- ct_shiti 现在挂的是 ca_tail_story_v2（预发实测确认），v1 没有任何模板引用，
-- 却因为 preset 素材混排出现在每个用户的素材库里，删不掉。
--
-- 只删这一条不够：ClipOfficialTailSeeder 在 reseed=false 时会把 v1 重新种出来，
-- 所以同批已把播种目标写死成 v2。两处必须一起改，单改任何一处都无效。
DELETE FROM clip_asset
 WHERE id = 'ca_tail_story'
   AND preset = TRUE;

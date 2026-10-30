-- Studio 场景页（AI 图片 / AI 视频）建的草稿画布记下来自哪个场景，「最近」按它列，不再靠名字后缀认。
-- V70 已被未合并的 reel / 用户在线分支占用，这里跳到 V72。
ALTER TABLE ip_project ADD COLUMN scene_id VARCHAR(64) NULL;

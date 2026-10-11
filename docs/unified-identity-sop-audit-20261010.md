# 统一认证发布与 SOP 验收（2026-10-10）

状态：最终身份代码 **484e3cda** 已提交、推送、部署。跨产品结论及未完成项见[中心复核记录](../../aibuzz-id/docs/INTEGRATION-SOP-AUDIT-20261010.md)，规则为[接入SOP](../../aibuzz-id/docs/INTEGRATION-GUIDE-FOR-AGENTS.md) §7.9 / §10.6。快出片小程序仅开发版已上传，正式发布需用户完成。

## 修复与回归

五个Web共用server（aiavatar含Studio）。修复当前profile/phone同步、旧JWT/缓存防回写、UID/状态锁内复查、在途读取失效、首登前注销/合并墓碑、严格分页及事务后回执；api-client丢弃退出/换账号后的旧刷新响应。

独立V50新增身份状态、事件时钟、撤销时钟；停用与产品status分离，CLOSED/MERGED不复活，首登前停用只写无权益占位。RS256及关联UID的legacy用户令牌均验状态/撤销时间，解除停用不恢复旧票。合并后确认存活UID产品链接，再COMPLETED；已知事件失败不跳游标。

Java17身份/迁移最终**76全通过、无失败/跳过**，含真实签名JWT、H2/JPA/HTTP及增量V50重放；共享api-client **70通过**。typecheck:all、typecheck:admin、离线编译、API契约门通过。

## 最终制品

- Release：20261010-identity-484e3cda，/opt/ai-star-eco/releases/20261010-identity-484e3cda。
- JAR SHA256：396e15c1d9bdecc1e6f6fb4c328ab9458bc09dcea5eb3a5b3597ba9e766469ef。
- MySQL V50 success=1；backend及五Web active；verify ALL GREEN。
- 迁移前备份：/opt/ai-star-eco/backups/identity-v50-20261010/database-before-v50.sql，10,009,264 bytes，受限权限；旧release JAR保留。

首次中间制品6ceed370默认legacy，真实浏览器发现没有统一回跳。已修生产默认id / https://id.aibuzz.cn，重新构建部署最终制品；中间版本不能作为最终验收依据。

## 线上验收

- 五入口逐一完成真实统一授权回跳；中央昵称与业务别名按各自语义保留，既有作品/画布及权益可见，未提交生成任务。
- 后台搜索13939004928，命中**1**个账号并完整展示手机；未重复此前2000积分赠送。
- 隔离UID广播21–30；注销25/28、合并27，四产品共**12份COMPLETED**；本产品游标**30**。
- 注销/合并旧有效签名JWT均401 ACCOUNT_DISABLED；停用29→解除30后identity ACTIVE、产品status仍ACTIVE，旧JWT仍401 ACCOUNT_STATE_INVALID。
- 回补17个有效UID链接，保留ACTIVE，其余仅PROVISIONED；未变更开通、角色、钱包或积分。

真实用户短信换绑、注销及两个既有业务档案的生产合并未操作；不承诺全设备即时撤销。无关Studio视频开发修改保留工作区，未纳入制品。

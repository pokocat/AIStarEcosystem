# Studio 灵感封面发布

2026-11-11 13:09:02–13:10:00（北京时间）发布 `20261111-inspiration-cover-44cb2d9a`。构建提交为 `main` 的 `44cb2d9a44426d86c22efcb9511ff0043fd611d9`，发布服务为 `server` 和 `web-aiavatar`。

灵感的「设置封面」可以直接选择当前案例或模板画布里的图片或视频。图片和视频的预览按存储键签发，选择后自动保存。首页和灵感页的视频卡片沿用悬停或键盘聚焦时静音播放。

## 构建与发布

- Mac mini 隔离快照通过全工作区类型检查、API 契约检查、50 项前端定向测试和 6 组后端定向测试，随后构建生产包。网页包采用线上正在使用的企业功能配置。
- `server/app.jar` 的 SHA-256 为 `52af0f9a38d427bebc8d3ae188be77a7dcba4bbbf3e4faf286ad96acf0d33bdc`，线上运行文件与发布包一致。
- `web-aiavatar.tar.gz` 的 SHA-256 为 `235bd1b2e6049ec329a7c70bfdff316974fe00925eab87ac3aee6ad618ce5db5`，线上 `BUILD_ID` 为 `Dr8mY1GqAjXnf66qXTEsq`，与构建包一致。
- 发布前账号中心返回 200，生产库没有进行中的 Studio 运行或视频任务。`env-check` 和 `verify.sh` 均为 `ALL GREEN`，两项服务均已启动，Flyway 版本为 V81。

## 线上验收

- 登录后在 [灵感](https://aistar.aibuzz.cn/templates) 的「官方模板」打开「创意带货视频」的「设置封面」。发布前只显示上传和恢复入口，发布后显示并加载了 5 张图片和 1 段 720×1280 视频。
- [首页](https://aistar.aibuzz.cn/dashboard) 的「商品宣传短片」初始暂停，键盘聚焦卡片后开始静音播放。封面写入、权限和悬停播放由定向测试覆盖，线上验收仅打开并预览现有内容。
- 启动后的并发首次登录记录了同一账号的三次唯一键冲突。身份建档路径会回读已成功创建的记录，发布就绪后观察窗口的 Nginx 访问日志中 5xx 为 0。

## 回滚

- `server` 使用 `20261111-recreation-checks-e39e8776` 的 `server/app.jar`。
- `web-aiavatar` 使用 `20261111-studio-official-main-fa3104e6` 的 `web-aiavatar.tar.gz`。

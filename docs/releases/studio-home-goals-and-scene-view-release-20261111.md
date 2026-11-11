# 首页场景卡两行与导演台单个视角重新生成发布

## 首页「你想做什么？」两行三列

2026-11-11 19:25（北京时间）发布 `20261111-home-goals-94e68ff7`。构建自 `main` 的 `94e68ff7454784d1157af2abce64df28456a764d`，只发了 `server` 和 `web-aiavatar`，基线是 `20261111-studio-image-and-resume-e4bb6f3b`（`e4bb6f3b`），回滚就用这个制品。

- 场景目录 `ipstudio/scenes.json` 的 `homeGoals` 改成六张，顺序是爆款复刻、同城到店、电商带货、剧情短片、品牌广告、商品套图。「IP 形象」卡不再放在首页，场景本身还在 AI 图片页。线上没有后台保存的 `studio.scene-catalog`，所以用的是随包文件。
- 电脑上三列两行，去掉了左右箭头；手机上照旧横向滑动。

Mac mini 检查：`home-goals-web-checks`（`ip-home.test.tsx`、`scene-catalog.test.ts`、web-aiavatar 类型检查）和 `home-goals-server-test`（`StudioSceneCatalogTest`、`StudioPromptLibraryStoreTest`）都退出 0。生产构建任务 `bf325a0b9418` 也退出 0。发布前查过，近 2 小时没有进行中的 `ip_run`。`env-check` 和 `verify.sh` 均为 ALL GREEN。在 1440 宽度下打开线上首页，六张卡分两行、每行三张，标题顺序和上面一致；手机宽度下是一行横滑。

## 导演台单个视角重新生成

修复在 `0a330629c`，由另一会话随 `20261111-recreation-modes-0a330629` 一起发布（server + web-aiavatar，19:47:40 起服务）。

- 在反打、左立面、右立面的标签里点「重新生成」，只替换这一个视角。请求带 `options.view`，服务端照样出同一张 2×2 整图，价格不变，回投时只放这一格，另外两个视角不进版本。三个一起换在「全部视角」里点。
- 回归用例：`DirectorFormsAndViewsTest#regeneratingOneViewOnlyReplacesThatView`，以及 `director-asset-studio.test.tsx` 里的「inside one view, regenerate only replaces that view」。

线上已加载的页面脚本里能找到新按钮的文字和提示。没有在线上真点生成，因为会扣积分，浏览器面板里登录的也不是作品所属的账号。

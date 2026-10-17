# 资源来源

所有图片均复用本仓 Studio 已有公开品牌与功能示意资源，没有新增付费生成。

- `logo.png`：`apps/web-aiavatar/public/brand/ip-studio-logo.png`，现行 IP Studio 蓝灰侧脸图标。
- `image.png`：`apps/web-aiavatar/public/studio/create/image.png`，现有 AI 图片创作示意。
- `video.png`：`apps/web-aiavatar/public/studio/create/video.png`，现有 AI 视频功能画面示意；该原型展示静态图片，不将其冒充可播放成片。
- `script.png`：`apps/web-aiavatar/public/studio/create/script.png`，现有剧本功能示意。

示意图不代表邀请人的个人作品、真实客户结果或生成效果保证。邀请人名称使用本次线上验收已公开显示的名称，头像使用名称首字，无伪造用户照片。

字体为 Studio 既有 Noto Serif SC v36 官方 Unicode WOFF2 分片，本原型只包含正文使用的字块；沿用 SIL Open Font License 1.1，OFL 见 `fonts/OFL.txt`。

## 应用 WebP 派生资源（2026-10-17）

实际应用的三张图片由本目录对应 PNG 转换而来，未新增生成、裁切或改绘。以下路径均相对于仓库根目录；品牌图标继续使用既有 `/brand/ip-studio-logo.png`。

| 应用文件 | 原型源文件 | 转换 |
|---|---|---|
| `apps/web-aiavatar/public/invitation/image.webp` | `prototypes/studio-invitation/assets/image.png` | `cwebp -q 88` |
| `apps/web-aiavatar/public/invitation/video.webp` | `prototypes/studio-invitation/assets/video.png` | `cwebp -q 88` |
| `apps/web-aiavatar/public/invitation/script.webp` | `prototypes/studio-invitation/assets/script.png` | `cwebp -q 88` |

可在仓库根目录复现：

```bash
cwebp -q 88 prototypes/studio-invitation/assets/image.png -o apps/web-aiavatar/public/invitation/image.webp
cwebp -q 88 prototypes/studio-invitation/assets/video.png -o apps/web-aiavatar/public/invitation/video.webp
cwebp -q 88 prototypes/studio-invitation/assets/script.png -o apps/web-aiavatar/public/invitation/script.webp
```

本次在临时目录重新转换，三份结果均与应用文件逐字节一致。SHA-256 如下，便于后续追溯源文件和派生文件：

| 文件名 | 原型 PNG SHA-256 | 应用 WebP SHA-256 |
|---|---|---|
| `image` | `2462896b8d1262e947aefce97b06de93db268ed2170bf5d9c3f5a6f0e59c908c` | `0dc7d56f6cd73d1a52a3a137270dcf3ae19264255af6cc5e302e0bc45a8da187` |
| `video` | `21c04dd3682aa5a944cf8ea55e34cba369504655ca70c55472b6f1a053a86a8b` | `e4591054fc9e6c03af8182388477db0e6c70716a5bc4958972519a5ac8bc3626` |
| `script` | `4a8ec2988432ae820f6619adf6737c8e6a1602e3039483d4bcb6403ddcd404c7` | `89af6132d022b06e7dffa67dc0e6a095570478ce218be9dfb3a6a8c8e901c306` |

WebP 仍为静态 AI 创作示意，沿用上方用途边界，不代表邀请人作品，也不承诺注册后可免费生成。

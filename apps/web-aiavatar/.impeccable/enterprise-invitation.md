# 企业分享邀请

- Mode: Operate。延展现有 Studio 邀请注册页，不替换品牌或全站设计。
- 目标：管理员复制链接群发；匿名访客在品牌页短信注册/登录并直接加入；已有会话确认加入。
- 结构：暖灰纸面、深墨与中文衬线标题；桌面左侧创作视觉、右侧企业身份与表单，手机优先企业和加入操作。
- 头图 `/invitation/enterprise-film.webp`：现代企业总部、团队交流与前景摄影机，贴近企业宣传片场景。内置 imagegen 生成，WebP 约 229 KiB；保留 AI 创作示意标识，不冒充客户作品。仅企业邀请页使用。
- 真实状态：加载/读取失败、无效/撤销/过期、匿名、本人登录、其他企业、未开通、运营查看拦截、成功。
- 默认 90 天，可选 1 年，群发可多人接受；单企业归属和产品开通规则由后端执行。
- 邀请 token 仅在 URL fragment 与内存，POST 预览，no-referrer/no-store；不落本地存储。

## 头图生成提示词（2026-10-17）

Use case: ads-marketing. Create one photorealistic cinematic still for the hero image on IP Studio's enterprise invitation page, a tool companies use to make corporate promotional films. Landscape 1536x1024. Scene: an elegant contemporary Chinese enterprise headquarters atrium with tall glass windows, restrained limestone and warm wood, distant city towers; three Chinese colleagues in smart business casual are naturally walking and discussing a project in the middle distance, not posing. A professional cinema camera on a tripod occupies a small, softly out-of-focus foreground corner, suggesting a corporate brand film in production. The architecture and real collaborative human scene are the subject, the camera is secondary. Premium documentary / corporate brand-film cinematography, believable scale, nuanced materials, natural daylight, soft warm highlights with charcoal and muted slate-blue tones. Wide composed frame, main human action in central horizontal band so it survives a centered 1.68:1 crop. Credible, established enterprise atmosphere, welcoming and purposeful, no sci-fi, no holograms, no charts, no giant logos, no handshakes, no stock-photo smiles at camera, no captions, no text, no watermark. This is an illustrative fictional business scene, not an existing client's project.

# 人像核验组件预览

使用真实 `PortraitMaterialTable` / `PortraitDeclaration` / `PortraitPersonModal` / `PortraitReviewHost` 组件，所有控件均来自 Ant Design。

`api.ts` 为隔离示例数据，无网络、密钥、扣费或真实人脸核验。构建经 devq，输出为可在聊天中展示的 HTML fragment；依赖使用工作区锁定版本并打包；gzip 内嵌后在浏览器解压执行，避免聊天沙箱的跨域模块加载。

```sh
devq remote submit --name portrait-framework-preview --install pnpm --cwd /Users/donis/dev/AIStarEcosystem -- node tools/portrait-preview/build.mjs
```

输出目录 `output` 是临时生成物，不应提交。正式功能不导入本目录。

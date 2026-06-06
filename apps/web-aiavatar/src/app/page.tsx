import { App } from "@/proto/app";

// 数字人资产平台 · 移动端 SPA 入口。
// 整个体验是一个手机壳 + 底部 Tab + 覆盖页栈的客户端单页（见 src/proto/app.tsx），
// 与原型 m4/m-app.jsx 的导航模型一一对应。
export default function Page() {
  return <App />;
}

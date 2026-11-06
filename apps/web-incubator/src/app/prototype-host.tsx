"use client";

// 原型是纯客户端单页（用 window、localStorage、canvas），不做服务端渲染。
import dynamic from "next/dynamic";

export const PrototypeHost = dynamic(() => import("@/prototype/App"), {
  ssr: false,
  loading: () => <div style={{ minHeight: "100vh", background: "#000" }} />,
});

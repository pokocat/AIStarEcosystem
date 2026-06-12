"use client";

// 运营身份开关(演示) — 设计真源 v4 app-v4.jsx `operator`。
// localStorage 持久 + 自定义事件跨组件同步(左导航开关 ↔ 模板库新建入口)。
import * as React from "react";

const KEY = "drama.operator";
const EVT = "drama-operator-change";

export function useOperator(): [boolean, (next: boolean) => void] {
  const [operator, setState] = React.useState(false);
  React.useEffect(() => {
    setState(localStorage.getItem(KEY) === "1");
    const fn = () => setState(localStorage.getItem(KEY) === "1");
    window.addEventListener(EVT, fn);
    window.addEventListener("storage", fn);
    return () => {
      window.removeEventListener(EVT, fn);
      window.removeEventListener("storage", fn);
    };
  }, []);
  const set = React.useCallback((next: boolean) => {
    localStorage.setItem(KEY, next ? "1" : "0");
    window.dispatchEvent(new Event(EVT));
  }, []);
  return [operator, set];
}

"use client";

import type { ReactNode } from "react";
import { App, ConfigProvider, type ModalFuncProps } from "antd";
import zhCN from "antd/locale/zh_CN";

/** 导演台的确认框（重新规划、删除、批量生成）走 antd App.useApp()，外面必须有这一层，否则 modal.confirm 不存在。 */
export function DirectorAntd({ children }: { children: ReactNode }) {
  return <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: "#192229", borderRadius: 8, fontFamily: "var(--ip-ui)" } }}>
    <App>{children}</App>
  </ConfigProvider>;
}

/** 确认范围后先完全关闭确认框，再进入付款等下一步，避免异步 onOk 把旧弹窗留在付款框上面。 */
export function confirmDirectorAction(modal: ReturnType<typeof App.useApp>["modal"], options: Omit<ModalFuncProps, "onOk" | "afterClose">, action: () => void) {
  let confirmed = false;
  return modal.confirm({
    ...options,
    onOk: () => { confirmed = true; },
    afterClose: () => { if (confirmed) action(); },
  });
}

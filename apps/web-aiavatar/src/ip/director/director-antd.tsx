"use client";

import type { ReactNode } from "react";
import { App, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";

/** 导演台的确认框（重新规划、删除、批量生成）走 antd App.useApp()，外面必须有这一层，否则 modal.confirm 不存在。 */
export function DirectorAntd({ children }: { children: ReactNode }) {
  return <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: "#192229", borderRadius: 8, fontFamily: "var(--ip-ui)" } }}>
    <App>{children}</App>
  </ConfigProvider>;
}

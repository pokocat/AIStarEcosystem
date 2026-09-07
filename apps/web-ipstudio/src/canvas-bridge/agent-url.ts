// 上游用它引导「本地代理」——那是给浏览器直连模型厂商绕 CORS 用的（它的 canvas-proxy）。
// 本仓所有模型调用都走服务端，没有这个概念，恒 false。
// 保留上游签名（收一个 hash 串），调用点不用改。
export function hasAgentUrlBootstrap(_hash: string): boolean {
  return false;
}

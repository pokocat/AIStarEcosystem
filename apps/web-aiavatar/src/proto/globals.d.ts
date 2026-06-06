// 全局类型增强：UI.ToastHost 在运行时把 toast 实现挂到 window.toast。
export {};

declare global {
  interface Window {
    toast?: (msg: unknown, opts?: { tone?: string; dur?: number }) => void;
  }
}

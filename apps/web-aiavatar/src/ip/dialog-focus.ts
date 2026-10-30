// 弹窗焦点：导演台、场景页（看大图）共用，规则只写这一份。
const FOCUSABLE = 'input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])';

/**
 * 弹窗 / 抽屉的焦点：挂上时把焦点移进来（先输入框、再按钮），Tab 在里面循环；卸下时还给打开前的元素。
 * React 19 的 ref 回调可以返回清理函数，模块级函数引用稳定，只挂一次。
 */
export function dialogFocus(el: HTMLElement | null) {
  if (!el) return;
  const previous = document.activeElement as HTMLElement | null;
  const items = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(x => x.offsetParent !== null || x === document.activeElement);
  const first = el.querySelector<HTMLElement>("[autofocus], input:not([type=checkbox]):not([disabled]), textarea:not([disabled])") ?? items().find(x => !x.closest("header")) ?? items()[0];
  (first ?? el).focus({ preventScroll: true });
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const list = items();
    if (!list.length) return;
    const head = list[0], tail = list[list.length - 1];
    if (e.shiftKey && (document.activeElement === head || !el.contains(document.activeElement))) { e.preventDefault(); tail.focus(); }
    else if (!e.shiftKey && (document.activeElement === tail || !el.contains(document.activeElement))) { e.preventDefault(); head.focus(); }
  };
  el.addEventListener("keydown", onKey);
  return () => { el.removeEventListener("keydown", onKey); if (previous && document.contains(previous)) previous.focus({ preventScroll: true }); };
}

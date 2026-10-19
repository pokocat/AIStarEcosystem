/** Keep Studio overlays inside the content's token scope, never the fixed desktop bar. */
export function studioOverlayContainer(): HTMLElement {
  if (document.body.classList.contains('ip-surface')) return document.body;
  return document.querySelector<HTMLElement>('[data-studio-overlay-root]') || document.body;
}

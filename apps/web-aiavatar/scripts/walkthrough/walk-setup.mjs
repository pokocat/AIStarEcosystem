// 走查环境：jsdom 全局 + 浏览器 API 桩
import { JSDOM } from "jsdom";
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost:3013/",
  pretendToBeVisual: true,
});
const w = dom.window;
function def(k, v) {
  try { Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); } catch {}
}
def("window", w); def("document", w.document); def("navigator", w.navigator);
def("localStorage", w.localStorage); def("history", w.history); def("location", w.location);
def("HTMLElement", w.HTMLElement); def("Element", w.Element); def("Node", w.Node);
def("MouseEvent", w.MouseEvent); def("Event", w.Event); def("CustomEvent", w.CustomEvent);
def("getComputedStyle", w.getComputedStyle.bind(w));
def("requestAnimationFrame", w.requestAnimationFrame ? w.requestAnimationFrame.bind(w) : (cb) => setTimeout(cb, 16));
def("cancelAnimationFrame", w.cancelAnimationFrame ? w.cancelAnimationFrame.bind(w) : clearTimeout);
w.URL.createObjectURL = () => "blob:fake";
w.URL.revokeObjectURL = () => {};
URL.createObjectURL = w.URL.createObjectURL;
URL.revokeObjectURL = w.URL.revokeObjectURL;
w.HTMLMediaElement.prototype.play = function(){ return Promise.resolve(); };
w.HTMLMediaElement.prototype.pause = function(){};
if (!w.navigator.clipboard) { try { Object.defineProperty(w.navigator, "clipboard", { value: { writeText: async () => {} }, configurable: true }); } catch {} }
const mm = w.matchMedia || (() => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }));
def("matchMedia", mm);
w.Audio = function(){ return { play: () => Promise.resolve(), pause(){}, onended: null }; };
def("Audio", w.Audio);
export { dom, w };

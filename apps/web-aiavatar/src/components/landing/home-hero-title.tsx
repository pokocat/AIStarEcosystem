// 首页标题：一张设计好的字图（public/studio/home-title.webp），彩色声波从左穿到右，经过中间时写成
// 「衣冠百变　戏路万千」的手写字。图是近白底（#fefefe），样式里降到 65% 饱和度、提亮 4%：颜色更柔和，底色也变成纯白和页面接上。
// 打开页面时一道软边从左往右把图扫出来，「减少动态效果」时不动（studio-home-scenes.css）。
// 文字给读屏和搜索，图本身的 alt 为空，避免读两遍。
export function HomeHeroTitle() {
  return <h1 className="home-title">
    <span className="home-title-text">衣冠百变，戏路万千</span>
    <img className="home-title-art" src="/studio/home-title.webp" alt="" width={2000} height={334} decoding="async" fetchPriority="high"/>
  </h1>;
}

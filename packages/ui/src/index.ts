// 入口聚合：消费者推荐用子路径精确导入以利于 tree-shaking。
//   import { Button } from "@ai-star-eco/ui/ui/button";
//   import { ThemeProvider, useTheme, themeConfig } from "@ai-star-eco/ui/theme";
//   import { cn } from "@ai-star-eco/ui/ui/utils";

export { ThemeProvider, useTheme, themeConfig, type ThemeStyle } from "./ThemeProvider";
export { cn } from "./ui/utils";
export { useIsMobile } from "./ui/use-mobile";

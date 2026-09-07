import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "light" | "dark";

type ThemeStore = {
    theme: ThemeName;
    setTheme: (theme: ThemeName) => void;
};

export const useThemeStore = create<ThemeStore>()(
    persist(
        (set) => ({
            // 本仓默认浅色：工作台其余部分（项目 / 资产 / 名片）都是浅色纸面，
            // 画布单独深色会像是另一个应用。用户仍可自己切。
            theme: "light",
            setTheme: (theme) => set({ theme }),
        }),
        { name: "infinite-canvas:theme_store" },
    ),
);

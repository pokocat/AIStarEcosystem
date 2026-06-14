// DramaComposer 引用 chip 的数据模型 + 「类型 → 外观」注册表（v0.78）。
// 加新引用类型只动这里：ComposerRefKind 加一项 + COMPOSER_REF_META 加一行，
// chip 渲染与托盘代码完全不用改（见 composer.tsx 的 RefChip）。
import {
  Clapperboard,
  Image as ImageIcon,
  Layers,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";

export type ComposerRefKind = "recipe" | "template" | "image" | "scene" | "character" | "material";

export interface ComposerRef {
  id: string;
  kind: ComposerRefKind;
  /** 引用主名（创意标题 / 模版名 / 文件名…）。 */
  label: string;
  /** 次要说明（题材 / 时长…），仅 tooltip 与紧凑展示用。 */
  sub?: string;
  /** 封面渐变（创意 / 模版有封面时优先于图标）。 */
  from?: string;
  to?: string;
  /** 缩略图 src（参考图等）。 */
  thumb?: string;
}

export const COMPOSER_REF_META: Record<ComposerRefKind, { label: string; icon: LucideIcon }> = {
  recipe: { label: "创意", icon: Sparkles },
  template: { label: "模版", icon: Layers },
  image: { label: "参考图", icon: ImageIcon },
  scene: { label: "场景", icon: Clapperboard },
  character: { label: "角色", icon: User },
  material: { label: "素材", icon: ImageIcon },
};

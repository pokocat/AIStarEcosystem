// ─────────────────────────────────────────────────────────────────────────────
// constants/canvas-traits.ts —— 画布「角色设计」标签选择器的分类与标签（v0.198，真源 docs/drama-canvas-plan.md §1.5）。
//
// 六个页签，每个页签里若干组；每组要么单选（点另一个就换掉）、要么多选。肤色 / 发色是色块 + 自定义一句。
// 选中的标签存在 `look.traits`（key = 组名，value = 选中的标签），只给界面回显；出图以 `look.prompt` 为准 ——
// 保存时由 canvas/assets/traits.ts 把它们拼成一行「角色设计：……」写进外貌描述（受管理的那一行，别的段落不动）。
//
// phrase：拼进那一行时怎么说（缺省就是标签本身）。组级模板里 `{v}` 换成标签；个别标签单独给一句。
// ─────────────────────────────────────────────────────────────────────────────

export interface TraitOption {
  label: string;
  /** 拼进「角色设计：」那一行时的说法（缺省按组的 phrase 模板，模板也没有就用 label）。 */
  phrase?: string;
  /** 色块（肤色 / 发色）。 */
  swatch?: string;
}

export interface TraitGroup {
  /** 组名，同时是 look.traits 的 key（「性别表达」「年龄」…），全表唯一。 */
  name: string;
  options: TraitOption[];
  /** 缺省单选。 */
  multi?: boolean;
  /** 允许自己写一句（肤色 / 发色）。自定义的值原样存进 traits[name]。 */
  custom?: { placeholder: string };
  /** 组级说法模板，`{v}` = 标签（或自定义的那句）。 */
  phrase?: string;
}

export interface TraitTab {
  /** 页签名（也是旧数据里 traits 的 key，见 traits.ts normalizeTraits）。 */
  name: string;
  groups: TraitGroup[];
}

/** 受管理的那一行的开头。 */
export const TRAITS_LINE_PREFIX = "角色设计：";

export const CANVAS_TRAIT_TABS: TraitTab[] = [
  {
    name: "基础",
    groups: [
      { name: "性别表达", options: [{ label: "女性" }, { label: "男性" }, { label: "中性" }] },
      {
        name: "年龄",
        phrase: "{v} 岁",
        options: [
          { label: "18–22" },
          { label: "23–28" },
          { label: "29–35" },
          { label: "36–45" },
          { label: "46–60" },
          { label: "60+", phrase: "60 岁以上" },
        ],
      },
      {
        name: "区域 / 文化背景",
        options: [
          { label: "东亚" },
          { label: "东南亚" },
          { label: "南亚" },
          { label: "西亚·北非" },
          { label: "欧洲" },
          { label: "撒哈拉以南非洲" },
          { label: "拉丁美洲" },
          { label: "北美·大洋洲" },
        ],
      },
      {
        name: "肤色",
        phrase: "{v}肤色",
        custom: { placeholder: "自己写，如「偏暖的象牙白」" },
        options: [
          { label: "白皙", swatch: "#f6e3d4" },
          { label: "自然", swatch: "#eac8a8" },
          { label: "小麦色", swatch: "#d4a57a" },
          { label: "古铜色", swatch: "#b07a52" },
          { label: "深棕色", swatch: "#7a4f33" },
          { label: "深色", swatch: "#4b3021" },
        ],
      },
      {
        name: "皮肤质感",
        phrase: "皮肤{v}",
        options: [
          { label: "原生肌理" },
          { label: "通透清润" },
          { label: "微雀斑", phrase: "脸上有细微雀斑" },
          { label: "健康光泽" },
          { label: "成熟肌理" },
          { label: "干净哑光" },
        ],
      },
    ],
  },
  {
    name: "妆容与穿搭",
    groups: [
      {
        name: "妆容",
        phrase: "{v}妆容",
        options: [
          { label: "伪素颜" },
          { label: "清透水光" },
          { label: "冷感哑光" },
          { label: "明艳红唇" },
          { label: "无妆原生", phrase: "不化妆" },
          { label: "清透底妆" },
          { label: "自然修容" },
        ],
      },
      {
        name: "服装",
        multi: true,
        options: [{ label: "白色基础上衣" }, { label: "黑色基础上衣" }, { label: "简约白衬衫" }, { label: "低饱和针织" }],
      },
      {
        name: "配饰",
        multi: true,
        options: [
          { label: "小银耳饰" },
          { label: "无配饰", phrase: "不戴配饰" },
          { label: "珍珠耳钉" },
          { label: "金色耳圈" },
          { label: "细框眼镜" },
          { label: "简约腕表" },
          { label: "小耳钉" },
        ],
      },
    ],
  },
  {
    name: "五官",
    groups: [
      {
        name: "脸型",
        options: [
          { label: "柔和鹅蛋脸" },
          { label: "流畅瓜子脸" },
          { label: "利落方脸" },
          { label: "幼态圆脸" },
          { label: "立体长脸" },
          { label: "心形脸" },
        ],
      },
      {
        name: "面部风格",
        phrase: "长相{v}",
        options: [
          { label: "柔和自然" },
          { label: "浓颜立体" },
          { label: "清冷疏离" },
          { label: "英气利落" },
          { label: "甜美幼态" },
          { label: "成熟知性" },
        ],
      },
      {
        name: "骨相",
        phrase: "骨相{v}",
        options: [{ label: "自然柔和" }, { label: "高颧骨留白" }, { label: "清晰下颌" }, { label: "平缓圆润" }, { label: "立体眉骨" }],
      },
      {
        name: "鼻型",
        options: [{ label: "小巧翘鼻" }, { label: "挺直鼻梁" }, { label: "柔和圆鼻" }, { label: "高挺驼峰鼻" }],
      },
      {
        name: "唇形",
        options: [{ label: "薄唇" }, { label: "饱满丰唇" }, { label: "微笑唇" }, { label: "M 字唇" }, { label: "自然唇形" }],
      },
    ],
  },
  {
    name: "体型",
    groups: [
      {
        name: "体型",
        options: [
          { label: "高挑纤细" },
          { label: "匀称健康" },
          { label: "小骨架纤薄" },
          { label: "修长有力" },
          { label: "丰润柔和" },
          { label: "肩背挺拔" },
          { label: "纤细修长" },
        ],
      },
    ],
  },
  {
    name: "发型",
    groups: [
      {
        name: "发型",
        options: [
          { label: "法式层次锁骨发" },
          { label: "水波纹流苏波波" },
          { label: "高颅顶半扎发" },
          { label: "碎盖" },
          { label: "干净利落短发" },
          { label: "黑长直" },
          { label: "低马尾" },
          { label: "丸子头" },
          { label: "寸头" },
          { label: "背头" },
        ],
      },
      {
        name: "发色",
        phrase: "{v}头发",
        custom: { placeholder: "自己写，如「挑染几缕蓝色」" },
        options: [
          { label: "黑色", swatch: "#1d1b1a" },
          { label: "深棕", swatch: "#3b2a20" },
          { label: "栗棕", swatch: "#6b4226" },
          { label: "亚麻金", swatch: "#c9a66b" },
          { label: "银灰", swatch: "#b8b8b8" },
          { label: "酒红", swatch: "#6d1f2a" },
        ],
      },
    ],
  },
  {
    name: "风格",
    groups: [
      {
        name: "表情状态",
        options: [
          { label: "轻微浅笑" },
          { label: "恬静放空" },
          { label: "平静正视" },
          { label: "若有所思" },
          { label: "自信微笑" },
          { label: "沉静思考" },
          { label: "自信克制" },
        ],
      },
      {
        name: "摄影方案",
        options: [
          { label: "白底定妆" },
          { label: "浅灰影棚" },
          { label: "米白柔光" },
          { label: "正面半身" },
          { label: "轻转十五度" },
          { label: "证件式特写" },
        ],
      },
    ],
  },
];

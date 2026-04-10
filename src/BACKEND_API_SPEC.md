# AI Star Eco — 前后端数据模型与接口对接规范
**文档版本**: v1.0.0  
**适用范围**: 前端所有数据模型梳理 → 后端接口设计参考  
**生成日期**: 2026-04-08  
**前端技术栈**: React 18 + TypeScript  
**文档状态**: ✅ 可交付后端团队  

---

## 目录

1. [枚举值总表](#1-枚举值总表)
2. [核心数据模型](#2-核心数据模型)
   - 2.1 用户与认证
   - 2.2 AI歌手
   - 2.3 人格参数
   - 2.4 官方IP库
   - 2.5 服装系统
   - 2.6 姿态动作系统
   - 2.7 音乐曲目
   - 2.8 音乐生成任务
   - 2.9 歌词
   - 2.10 NFT合集
   - 2.11 NFT铸造任务
   - 2.12 财务与交易
   - 2.13 收益统计图表
   - 2.14 市场艺人
   - 2.15 艺人签约合同
   - 2.16 艺人市场挂牌
   - 2.17 发行渠道
   - 2.18 平台账号绑定
   - 2.19 发行任务
   - 2.20 音乐榜单
   - 2.21 掌门人-学员关系
3. [接口清单（RESTful）](#3-接口清单restful)
4. [字段约束与校验规则](#4-字段约束与校验规则)
5. [业务计算规则](#5-业务计算规则)
6. [通用响应格式](#6-通用响应格式)
7. [前端状态机与接口映射](#7-前端状态机与接口映射)

---

## 1. 枚举值总表

> 以下枚举值来源于前端代码，后端存储时建议使用 `VARCHAR` 并在应用层做枚举校验。

### 1.1 用户角色 `UserRole`
```
fan         粉丝（星际听众）
producer    制作人（造梦架构师）
coach       掌门人（生态领航员）
```

### 1.2 套餐类型 `PlanType`
```
free        免费版
pro         专业版
enterprise  企业版
```

### 1.3 歌手状态 `SingerStatus`
```
active      活跃
draft       草稿
archived    归档
```

### 1.4 歌手品质 `SingerQuality`（稀有度）
```
common      普通（灰色，⭐⭐）
rare        稀有（蓝色，⭐⭐⭐）
epic        史诗（紫色，⭐⭐⭐⭐）
legendary   传说（金色，⭐⭐⭐⭐⭐ + 皇冠）
```

### 1.5 服装分类 `ClothingCategory`
```
top         上衣
bottom      下装
accessory   配饰
shoes       鞋子
hair        发型
outfit      完整套装
```

### 1.6 姿态分类 `PoseCategory`
```
standing    站姿
sitting     坐姿
dancing     舞蹈
singing     演唱
action      动作
```

### 1.7 姿态难度 `PoseDifficulty`
```
easy        简单（绿色）
medium      中等（黄色）
hard        困难（红色）
```

### 1.8 表情分类 `ExpressionCategory`
```
happy       开心系
sad         悲伤系
cool        酷炫系
surprised   惊讶系
other       其他
```

### 1.9 曲目状态 `TrackStatus`
```
draft       草稿
processing  处理中（AI生成中）
published   已发布
```

### 1.10 音乐生成模式 `GenerationMode`
```
text        文本模式（提示词生成）
melody      旋律模式（上传旋律）
advanced    进阶模式（BPM+调性+结构）
interactive 互动写歌（对话式）
lyrics      歌词成歌
inspiration 灵感写歌
image       图片成歌
remix       热歌爆改
fun         趣味写歌
acrostic    藏头歌
gift        送Ta歌
```

### 1.11 NFT铸造状态 `MintStatus`
```
pending     等待中
minting     铸造中
success     已成功
failed      已失败
```

### 1.12 NFT稀有度 `NFTRarity`
```
common      普通
rare        稀有
epic        史诗
legendary   传说
```

### 1.13 交易类型 `TransactionType`
```
royalty         流媒体版税
nft_sale        NFT销售
tip             粉丝打赏
signing_fee     艺人签约费
withdrawal      提现
ai_credit       AI积分消耗
distribution    发行费用
platform_fee    平台服务费
```

### 1.14 交易状态 `TransactionStatus`
```
pending     处理中
completed   已完成
failed      已失败
```

### 1.15 发行渠道 `DistributionChannelId`
```
domestic    国内AI专属通道（腾讯音乐 / 网易云）
global      全球流媒体（DistroKid / TuneCore）
shortVideo  短视频矩阵（抖音 / TikTok）
```

### 1.16 平台账号标识 `PlatformAccountKey`
```
distrokid           DistroKid
tencent_music       腾讯音乐人（启明星）
netease_music       网易云音乐人
spotify_artists     Spotify for Artists
douyin_creator      抖音创作者平台
tiktok_business     TikTok for Business
```

### 1.17 市场挂牌授权类型 `LicenseType`
```
exclusive       独家授权
non_exclusive   非独家授权
```

### 1.18 市场挂牌状态 `ListingStatus`
```
pending     审核中
active      已上架
sold        已售出
removed     已下架
```

### 1.19 学员状态 `TraineeStatus`
```
active      活跃
inactive    暂停
graduated   已毕业
```

### 1.20 榜单趋势 `ChartTrend`
```
up      上升
down    下降
same    持平
```

---

## 2. 核心数据模型

---

### 2.1 用户与认证

#### `User` — 用户
> 来源文件：`App.tsx`（TRANSLATIONS角色描述）、`ThemeProvider.tsx`

```typescript
interface User {
  id: string;               // UUID，主键
  username: string;         // 用户名，唯一，最长 50 字符
  email: string;            // 邮箱，唯一，最长 100 字符
  avatar_url: string | null; // 头像图片 URL
  role: UserRole;           // 'fan' | 'producer' | 'coach'
  plan: PlanType;           // 'free' | 'pro' | 'enterprise'
  credits: number;          // AI积分余额，默认 100，整数
  lang_preference: 'zh' | 'en'; // 语言偏好，默认 'zh'
  theme_preference: string; // 主题偏好，默认 'cyberpunk'
  wallet_address: string | null; // Web3 钱包地址，ETH格式
  created_at: string;       // ISO 8601 时间戳
  updated_at: string;
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | UUID | 是 | 系统生成 |
| `username` | string | 是 | 3–50字符，唯一 |
| `email` | string | 是 | 合法邮箱格式 |
| `credits` | integer | 是 | 默认100，不可为负 |
| `role` | enum | 是 | 决定可访问模块 |
| `plan` | enum | 是 | 决定功能限额 |

---

### 2.2 AI歌手

#### `Singer` — AI歌手主体
> 来源文件：`AIIncubator.tsx`（完整interface）、`SingerEditor.tsx`（使用）

```typescript
interface Singer {
  id: string;                    // UUID，主键
  owner_id: string;              // 关联 User.id
  name: string;                  // 歌手名称，1–100 字符
  avatar_url: string;            // 头像图片 URL
  style: string;                 // 音乐风格标签，最长 50 字符
  status: SingerStatus;          // 'active' | 'draft' | 'archived'
  quality: SingerQuality;        // 'common' | 'rare' | 'epic' | 'legendary'
  tags: string[];                // 可搜索标签数组，最多 10 个
  parameters: PersonaParams;     // 人格参数对象（见 2.3）
  equipped_wardrobe: EquippedItems; // 已装备服装槽位（见 2.5.2）
  active_pose_id: string | null; // 当前姿态 ID，关联 Pose.id
  active_expression_id: string | null; // 当前表情 ID
  active_gesture: string | null; // 当前手势名称
  parent_a_id: string | null;    // 基因混合父本A，关联 Singer.id
  parent_b_id: string | null;    // 基因混合父本B，关联 Singer.id
  genetic_ratio: number | null;  // 基因混合比例 0–100（A的占比）
  is_public: boolean;            // 是否公开到市场，默认 false
  stats: SingerStats;            // 统计数据（见下）
  created_at: string;
  updated_at: string;
}

interface SingerStats {
  songs: number;       // 已制作曲目数，默认 0
  fans: number;        // 粉丝数量，默认 0
  popularity: number;  // 人气值 0–100，默认 0
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `name` | string | 是 | — | 1–100字符 |
| `quality` | enum | 是 | `common` | 稀有度决定UI展示 |
| `tags` | string[] | 否 | `[]` | 前端最多显示3个，存储最多10个 |
| `is_public` | boolean | 是 | `false` | 上架市场时设为 true |
| `genetic_ratio` | int | 否 | `null` | 仅基因混合创建时填入，0=纯A，100=纯B |

---

### 2.3 人格参数

#### `PersonaParams` — AI歌手人格参数
> 来源文件：`SingerEditor.tsx`（核心参数调节Tab）、`App.tsx`（state定义）

```typescript
interface PersonaParams {
  sweetness: number; // 甜度，0–100，整数
  energy: number;    // 能量，0–100，整数
  mystery: number;   // 神秘感，0–100，整数
}
```

**快速预设值（前端内置，供参考）：**
```typescript
const QUICK_PRESETS = [
  { name: '甜美少女', values: { sweetness: 95, energy: 75, mystery: 40 } },
  { name: '冷酷女王', values: { sweetness: 30, energy: 85, mystery: 90 } },
  { name: '活力青春', values: { sweetness: 70, energy: 95, mystery: 50 } },
  { name: '神秘精灵', values: { sweetness: 60, energy: 55, mystery: 95 } },
];
```

**业务含义：**
- 三个参数共同作为 **LLM人设生成Prompt的核心输入**
- 后端在调用大模型生成背景故事/说话风格/视觉指令时，应将参数映射为Prompt描述词
- 建议Prompt模板示例：`生成一位甜度{sweetness}/100、活力{energy}/100、神秘感{mystery}/100 的虚拟歌手人设描述...`

---

### 2.4 官方IP库

#### `OfficialIP` — 官方预设IP模板
> 来源文件：`SingerEditor.tsx`（officialIPs数组）

```typescript
interface OfficialIP {
  id: string;                // UUID，主键
  name: string;              // IP名称（双语支持）
  name_en: string;           // 英文名称
  avatar_url: string;        // 封面图 URL
  style: string;             // 音乐风格（中文）
  style_en: string;          // 音乐风格（英文）
  rarity: SingerQuality;     // 'common' | 'rare' | 'epic' | 'legendary'
  tags: string[];            // 分类标签
  preset_params: PersonaParams; // 该IP对应的推荐人格参数
  is_active: boolean;        // 是否可用，默认 true
  sort_order: number;        // 排序权重
  created_at: string;
}
```

**前端已存在的官方IP数据（Mock参考）：**
```json
[
  {
    "id": "1",
    "name": "霓虹战士",
    "name_en": "Neon Warrior",
    "style": "电子舞曲",
    "style_en": "EDM",
    "rarity": "legendary",
    "tags": ["cyberpunk", "edm"],
    "preset_params": { "sweetness": 40, "energy": 95, "mystery": 80 }
  },
  {
    "id": "2",
    "name": "云裳仙子",
    "name_en": "Cloud Fairy",
    "style": "古风流行",
    "style_en": "Ancient Pop",
    "rarity": "epic",
    "tags": ["traditional", "elegant"],
    "preset_params": { "sweetness": 90, "energy": 60, "mystery": 70 }
  },
  {
    "id": "3",
    "name": "机械核心",
    "name_en": "Mech Core",
    "style": "工业摇滚",
    "style_en": "Industrial Rock",
    "rarity": "epic",
    "tags": ["rock", "mechanical"],
    "preset_params": { "sweetness": 30, "energy": 90, "mystery": 85 }
  },
  {
    "id": "4",
    "name": "星辰歌者",
    "name_en": "Star Singer",
    "style": "梦幻流行",
    "style_en": "Dream Pop",
    "rarity": "rare",
    "tags": ["dreamy", "pop"],
    "preset_params": { "sweetness": 85, "energy": 70, "mystery": 75 }
  }
]
```

---

### 2.5 服装系统

#### 2.5.1 `ClothingItem` — 服装单品
> 来源文件：`WardrobeSystem.tsx`（clothingDatabase数组，interface ClothingItem）

```typescript
interface ClothingItem {
  id: string;                  // 主键，格式参考前端：'t1', 'b1', 'a1' 等
  name: string;                // 单品名称（中文）
  name_en: string;             // 单品名称（英文）
  category: ClothingCategory;  // 'top' | 'bottom' | 'accessory' | 'shoes' | 'hair' | 'outfit'
  image_url: string;           // 单品图片 URL
  rarity: SingerQuality;       // 'common' | 'rare' | 'epic' | 'legendary'
  price: number;               // 虚拟货币价格，整数，0–9999
  tags: string[];              // 搜索标签
  is_locked: boolean;          // 是否需要解锁（锁定项需企业版或购买）
  is_new: boolean;             // 是否显示 NEW 标签，默认 false
  is_trending: boolean;        // 是否显示 HOT 标签，默认 false
  sort_order: number;          // 分类内排序权重
  is_active: boolean;          // 是否上架，默认 true
  created_at: string;
}
```

**前端按分类的数量分布（供参考）：**
```
top（上衣）:      t1–t5，5条记录
bottom（下装）:   b1–b4，4条记录
accessory（配饰）: a1–a4，4条记录
shoes（鞋子）:    s1–s4，4条记录
hair（发型）:     h1–h4，4条记录
```

#### 2.5.2 `EquippedItems` — 当前装备状态
> 来源文件：`WardrobeSystem.tsx`（equippedItems state）

```typescript
interface EquippedItems {
  top: string | null;         // 已装备上衣的 ClothingItem.id
  bottom: string | null;      // 已装备下装的 ClothingItem.id
  accessory: string | null;   // 已装备配饰的 ClothingItem.id
  shoes: string | null;       // 已装备鞋子的 ClothingItem.id
  hair: string | null;        // 已装备发型的 ClothingItem.id
}
```
> **存储位置**：作为 `Singer.equipped_wardrobe` 的 JSON 字段存储。

#### 2.5.3 `SavedOutfit` — 保存的套装
> 来源文件：`WardrobeSystem.tsx`（savedOutfits state）

```typescript
interface SavedOutfit {
  id: string;                 // UUID，主键
  singer_id: string;          // 关联 Singer.id
  owner_id: string;           // 关联 User.id
  name: string;               // 套装名称，用户自定义
  items: EquippedItems;       // 套装包含的单品ID组合
  created_at: string;
}
```

#### 2.5.4 `UserWardrobeItem` — 用户已拥有的服装记录
> 来源文件：`WardrobeSystem.tsx`（收藏/购买逻辑）

```typescript
interface UserWardrobeItem {
  id: string;
  user_id: string;            // 关联 User.id
  item_id: string;            // 关联 ClothingItem.id
  is_favorited: boolean;      // 是否已收藏
  is_unlocked: boolean;       // 是否已解锁（付费/条件达成）
  acquired_at: string;
}
```

---

### 2.6 姿态动作系统

#### 2.6.1 `Pose` — 姿态
> 来源文件：`PoseLibrary.tsx`（poseDatabase数组，interface Pose）

```typescript
interface Pose {
  id: string;                  // 主键，格式参考前端：'p1'–'p16'
  name: string;                // 姿态名称（中文）
  name_en: string;             // 姿态名称（英文）
  category: PoseCategory;      // 'standing' | 'sitting' | 'dancing' | 'singing' | 'action'
  thumbnail_url: string;       // 缩略图 URL
  animation_url: string | null; // 动画数据 URL（预留字段，Phase 3使用）
  difficulty: PoseDifficulty;  // 'easy' | 'medium' | 'hard'
  is_locked: boolean;          // 是否需要解锁
  is_new: boolean;             // 是否显示 NEW 标签
  sort_order: number;
  is_active: boolean;
  created_at: string;
}
```

**前端已有的姿态数据（16条，含分类）：**
```
站姿(standing):  p1 自信站姿(easy), p2 休闲倚靠(easy), p3 超模姿态(medium), p4 战斗姿态(hard,locked)
坐姿(sitting):   p5 优雅端坐(easy), p6 翘腿坐姿(medium,new), p7 慵懒斜倚(medium)
舞蹈(dancing):   p8 爵士舞步(hard), p9 街舞风格(hard,new), p10 芭蕾姿态(hard,locked)
演唱(singing):   p11 麦克风握姿(easy), p12 高音姿态(medium,new), p13 摇滚手势(medium)
动作(action):    p14 飞吻动作(easy), p15 胜利手势(easy,new), p16 跳跃瞬间(hard,locked)
```

#### 2.6.2 `Expression` — 表情
> 来源文件：`PoseLibrary.tsx`（expressionDatabase数组，interface Expression）

```typescript
interface Expression {
  id: string;                      // 主键，格式参考前端：'e1'–'e12'
  name: string;                    // 表情名称（中文）
  name_en: string;                 // 表情名称（英文）
  emoji: string;                   // 对应 emoji 字符，用于UI展示
  default_intensity: number;       // 默认强度值 0–100，整数
  category: ExpressionCategory;   // 'happy' | 'sad' | 'cool' | 'surprised' | 'other'
  sort_order: number;
  is_active: boolean;
}
```

**前端已有的12种表情：**
```
e1  开心(happy,80)   e2  大笑(happy,100)  e3  微笑(happy,60)
e4  悲伤(sad,70)     e5  哭泣(sad,90)
e6  酷炫(cool,85)    e7  得意(cool,75)
e8  惊讶(surprised,80) e9 震惊(surprised,100)
e10 生气(other,85)   e11 害羞(other,60)   e12 爱心(happy,90)
```

#### 2.6.3 `Gesture` — 手势
> 来源文件：`PoseLibrary.tsx`（手势库部分）

```typescript
interface Gesture {
  id: string;
  name: string;       // 手势名称（中文）
  name_en: string;    // 手势名称（英文）
  emoji: string;      // 对应 emoji 字符
  sort_order: number;
  is_active: boolean;
}
```

**前端已有的8种手势：**
```
比心(❤️)  点赞(👍)  OK手势(👌)  和平手势(✌️)
摇滚手势(🤘)  挥手(👋)  祈祷(🙏)  鼓掌(👏)
```

#### 2.6.4 `SingerPoseConfig` — 歌手当前姿态配置
> 来源文件：`PoseLibrary.tsx`（selected state 组合）

```typescript
interface SingerPoseConfig {
  singer_id: string;
  pose_id: string | null;           // 当前姿态 ID
  expression_id: string | null;     // 当前表情 ID
  expression_intensity: number;     // 表情强度 0–100，整数，默认 80
  gesture_id: string | null;        // 当前手势 ID
  updated_at: string;
}
```

---

### 2.7 音乐曲目

#### `Track` — 音乐曲目
> 来源文件：`App.tsx`（Song interface, TRANSACTIONS, generatedSongs state）、`MusicGenerationDialog.tsx`（newTrack对象）、`GlobalAudioPlayer.tsx`（Song interface）、`DistributionPage.tsx`（Song interface）

```typescript
interface Track {
  id: string;                      // UUID，主键
  producer_id: string;             // 关联 User.id（制作人）
  singer_id: string | null;        // 关联 Singer.id，可为 null
  title: string;                   // 曲目标题，最长 200 字符
  audio_url: string | null;        // 音频文件 URL（生成完成后填入）
  cover_url: string | null;        // 封面图 URL
  generation_mode: GenerationMode; // 生成模式（见枚举 1.10）
  prompt: string | null;           // 生成提示词
  style: string | null;            // 音乐风格，最长 100 字符
  bpm: number | null;              // 节拍 40–240，整数
  key: string | null;              // 调性，如 "C", "Am", "F#"
  duration_sec: number | null;     // 时长（秒），30–600
  lyrics: LyricLine[] | null;      // 歌词数据（见 2.9）
  status: TrackStatus;             // 'draft' | 'processing' | 'published'
  play_count: number;              // 播放次数，默认 0
  created_at: string;
  updated_at: string;
}
```

**不同来源的字段差异说明：**

| 字段 | AIStudio使用 | DistributionPage使用 | AudioPlayer使用 |
|------|-------------|---------------------|----------------|
| `title` | ✅ | ✅ | ✅ |
| `status` | `draft/processing` | `Published/Draft/Processing` | — |
| `play_count` | — | `plays`（显示字符串） | — |
| `audio_url` | — | — | ✅ |
| `date` | `created_at` ISO 格式 | `date` 字符串 | — |

> ⚠️ **注意**：前端 `DistributionPage` 中的 `status` 使用首字母大写（`Published`/`Draft`/`Processing`），后端统一存储为小写，**接口返回时前端需做映射**。

---

### 2.8 音乐生成任务

#### `TrackGenerationRequest` — 音乐生成请求
> 来源文件：`MusicGenerationDialog.tsx`（handleGenerate函数的输入）

```typescript
interface TrackGenerationRequest {
  singer_id: string | null;           // 关联的AI歌手（可选）
  mode: GenerationMode;               // 生成模式
  title: string | null;               // 用户填写的标题（可选）
  prompt: string;                     // 核心描述词
  style: string | null;               // 风格/流派
  duration_sec: number;               // 期望时长（秒），默认 120
  bpm: number | null;                 // 节拍（进阶模式）
  key: string | null;                 // 调性（进阶模式）
  song_structure: string | null;      // 歌曲结构（进阶模式）
  mood: string | null;                // 情绪标签
  instruments: string | null;         // 乐器描述
  lyrics_text: string | null;         // 完整歌词（歌词成歌模式）
  melody_file_url: string | null;     // 旋律文件 URL（旋律模式）
  reference_image_url: string | null; // 参考图片 URL（图片成歌模式）
  original_song_ref: string | null;   // 原曲引用（热歌爆改模式）
  remix_target: string | null;        // 改编目标描述（热歌爆改）
  acrostic_word: string | null;       // 藏头词（最多8字）
  acrostic_topic: string | null;      // 藏头歌主题
  gift_to: string | null;             // 送给谁（送Ta歌模式）
  gift_occasion: string | null;       // 场合
  gift_message: string | null;        // 想说的话
  fun_theme: string | null;           // 趣味主题（趣味写歌）
  core_phrase: string | null;         // 核心歌词（趣味写歌）
}
```

#### `TrackGenerationResponse` — 音乐生成响应（轮询或WebSocket推送）
> 来源文件：`MusicGenerationDialog.tsx`（generation stages & newTrack对象）

```typescript
interface TrackGenerationResponse {
  job_id: string;                     // 任务 ID
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;                   // 0–100，整数
  current_stage: GenerationStage;     // 当前阶段
  track: Track | null;                // 生成完成后返回完整 Track 对象
  error_message: string | null;       // 失败时的错误信息
  estimated_seconds: number | null;   // 预计剩余秒数
}

type GenerationStage = 
  | 'analyzing'   // 分析参数
  | 'composing'   // 作曲中
  | 'arranging'   // 编曲中
  | 'mixing'      // 混音中
  | 'mastering'   // 母带处理
  | 'finalizing'; // 生成完成

// 前端每个阶段的预期时长（毫秒，供参考）
const STAGE_DURATIONS = {
  analyzing: 2000,
  composing: 5000,
  arranging: 4000,
  mixing: 3000,
  mastering: 2000,
  finalizing: 1000
};
```

---

### 2.9 歌词

#### `LyricLine` — 歌词行
> 来源文件：`App.tsx`（LYRICS常量，NLE编辑器歌词轨道）

```typescript
interface LyricLine {
  time: number;    // 时间偏移（秒），整数，从 0 开始
  text: string;    // 歌词内容，最长 200 字符
  duration: number | null; // 该行时长（秒），可选
}
```

**前端 Mock 歌词示例：**
```json
[
  { "time": 0, "text": "Neon rain falling down..." },
  { "time": 4, "text": "Washing away the dust of this town." },
  { "time": 8, "text": "I see your ghost in the hologram," },
  { "time": 12, "text": "Running through the wires, who I am?" },
  { "time": 16, "text": "(Instrumental Break)" },
  { "time": 24, "text": "Cyber heart, beating slow," },
  { "time": 28, "text": "Where the data streams, there I go." }
]
```

---

### 2.10 NFT合集

#### `NFTCollection` — NFT合集
> 来源文件：`NFTMintingDialog.tsx`（state: collectionName, supply, price, royalty, rarity, enableAirdrop）

```typescript
interface NFTCollection {
  id: string;                   // UUID，主键
  creator_id: string;           // 关联 User.id
  track_id: string;             // 关联 Track.id（绑定的音乐作品）
  singer_id: string | null;     // 关联 Singer.id（可选）
  name: string;                 // 合集名称，最长 100 字符
  description: string | null;   // 合集描述
  cover_url: string | null;     // 合集封面 URL
  supply: number;               // 发行总量，整数，1–10000
  price_eth: string;            // 铸造价格（ETH），decimal字符串，0.001–100
  royalty_pct: number;          // 版税比例，整数，0–100
  rarity: NFTRarity;            // 'common' | 'rare' | 'epic' | 'legendary'
  enable_airdrop: boolean;      // 是否开启空投，默认 false
  perks: NFTPerks;              // 持有者权益
  contract_address: string | null; // 链上合约地址（部署后填入）
  token_id_range_start: number | null; // Token ID 起始
  token_id_range_end: number | null;   // Token ID 结束
  minted_count: number;         // 已铸造数量，默认 0
  status: MintStatus;           // 'pending' | 'minting' | 'success' | 'failed'
  chain: string;                // 区块链网络，默认 'ethereum'
  ipfs_metadata_url: string | null; // IPFS 元数据 URL
  created_at: string;
  updated_at: string;
}

interface NFTPerks {
  future_airdrop: boolean;    // 未来空投权益
  exclusive_access: boolean;  // 独家访问权益
  meetup_priority: boolean;   // 线下见面会优先权
}
```

---

### 2.11 NFT铸造任务

#### `NFTMintJob` — 铸造任务（链上操作追踪）
> 来源文件：`NFTMintingDialog.tsx`（minting stages & handleMint）

```typescript
interface NFTMintJob {
  id: string;                  // UUID，主键
  collection_id: string;       // 关联 NFTCollection.id
  user_id: string;             // 关联 User.id
  wallet_address: string;      // 用户钱包地址
  wallet_type: WalletType;     // 'metamask' | 'walletconnect' | 'coinbase'
  status: MintStatus;          // 'pending' | 'minting' | 'success' | 'failed'
  current_stage: MintStage;    // 当前铸造阶段
  tx_hash: string | null;      // 链上交易哈希
  gas_fee_eth: string | null;  // 实际 Gas 费用（ETH）
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

type WalletType = 'metamask' | 'walletconnect' | 'coinbase';

type MintStage = 
  | 'preparing'    // 准备链上交易
  | 'ipfs_upload'  // 上传元数据到 IPFS
  | 'contract_call'// 调用智能合约
  | 'confirming'   // 等待区块确认
  | 'completed';   // 铸造完成
```

---

### 2.12 财务与交易

#### `Transaction` — 交易记录
> 来源文件：`App.tsx`（TRANSACTIONS常量，FinanceSection）

```typescript
interface Transaction {
  id: string;                  // UUID，主键
  user_id: string;             // 关联 User.id
  type: TransactionType;       // 见枚举 1.13
  direction: 'in' | 'out';    // 收入/支出
  amount: number;              // 金额，decimal，精度2位，不含货币符号
  currency: string;            // 货币代码，默认 'CNY'
  status: TransactionStatus;   // 'pending' | 'completed' | 'failed'
  reference_id: string | null; // 关联业务ID（如 Track.id 或 NFTCollection.id）
  description: string;         // 交易描述，最长 200 字符
  created_at: string;
}
```

**前端 Mock 数据（格式映射参考）：**
```json
[
  {
    "id": "1",
    "type": "royalty",
    "direction": "in",
    "amount": 12450.00,
    "currency": "CNY",
    "status": "completed",
    "description": "版税结算 - 2024年2月",
    "created_at": "2024-03-15T00:00:00Z"
  },
  {
    "id": "2",
    "type": "nft_sale",
    "direction": "in",
    "amount": 8920.00,
    "currency": "CNY",
    "status": "completed",
    "description": "铸造收益 - Genesis Badge",
    "created_at": "2024-03-14T00:00:00Z"
  },
  {
    "id": "3",
    "type": "ai_credit",
    "direction": "out",
    "amount": 200.00,
    "currency": "CNY",
    "status": "completed",
    "description": "AI服务费（Suno API）",
    "created_at": "2024-03-12T00:00:00Z"
  },
  {
    "id": "4",
    "type": "withdrawal",
    "direction": "out",
    "amount": 5000.00,
    "currency": "CNY",
    "status": "pending",
    "description": "提现到钱包（0x8...2a）",
    "created_at": "2024-03-10T00:00:00Z"
  }
]
```

#### `WalletBalance` — 账户余额
> 来源文件：`App.tsx`（FinanceSection balance展示）

```typescript
interface WalletBalance {
  user_id: string;
  available: number;           // 可用余额，decimal
  pending: number;             // 处理中金额
  total_earned: number;        // 累计收入
  currency: string;            // 默认 'CNY'
  updated_at: string;
}
```

---

### 2.13 收益统计图表

#### `EarningDataPoint` — 收益趋势数据点
> 来源文件：`App.tsx`（EARNING_DATA，Recharts图表数据）

```typescript
interface EarningDataPoint {
  period: string;       // 时间周期标识（日/周/月），如 "2026-W14" 或 "2026-04"
  song_revenue: number; // 流媒体版税收益，整数（分）或浮点（元）
  badge_revenue: number;// NFT勋章收益
}
```

**前端 Mock 数据（按天，7天滚动）：**
```json
[
  { "period": "1", "song_revenue": 4000, "badge_revenue": 2400 },
  { "period": "2", "song_revenue": 3000, "badge_revenue": 1398 },
  { "period": "3", "song_revenue": 2000, "badge_revenue": 9800 },
  { "period": "4", "song_revenue": 2780, "badge_revenue": 3908 },
  { "period": "5", "song_revenue": 1890, "badge_revenue": 4800 },
  { "period": "6", "song_revenue": 2390, "badge_revenue": 3800 },
  { "period": "7", "song_revenue": 3490, "badge_revenue": 4300 }
]
```

#### `DashboardStats` — 总览仪表盘统计
> 来源文件：`App.tsx`（OverviewSection KPI卡片）

```typescript
interface DashboardStats {
  user_id: string;
  eco_value: number;         // 生态估值（元），用于展示 "¥1.25M"
  estimated_royalty: number; // 预估版税（元）
  badge_holders: number;     // 勋章持有人数（整数）
  total_streams: number;     // 总播放量（整数）
  total_fans: number;        // 全网粉丝数（整数）
  updated_at: string;
}
```

---

### 2.14 市场艺人

#### `MarketplaceArtist` — 市场艺人
> 来源文件：`ArtistSigningDialog.tsx`（Artist interface，singer state）、`ArtistDetailDialog.tsx`（Artist interface）、`ArtistListingDialog.tsx`（Artist interface）

**注意**：三个文件中 `Artist` interface 字段略有差异，统一后定义如下：

```typescript
interface MarketplaceArtist {
  id: string;                    // UUID，主键
  singer_id: string;             // 关联 Singer.id（来源歌手）
  seller_id: string;             // 卖家（挂牌方） User.id
  name: string;                  // 艺人名称
  avatar_url: string;            // 头像图片 URL
  style: string;                 // 音乐风格
  signing_price: number;         // 签约价格（元），整数
  description: string | null;    // 艺人简介
  songs_count: number;           // 作品数量
  followers_count: number;       // 粉丝数量（整数，前端显示为 "58.2K"）
  creator_username: string;      // 原创者用户名（展示用）
  license_type: LicenseType;     // 'exclusive' | 'non_exclusive'
  enable_auto_reply: boolean;    // 是否开启自动回复询价
  status: ListingStatus;         // 'pending' | 'active' | 'sold' | 'removed'
  views: number;                 // 浏览量，默认 0
  inquiries: number;             // 询价次数，默认 0
  created_at: string;
  updated_at: string;
}
```

#### `ArtistAnalytics` — 艺人数据分析
> 来源文件：`ArtistDetailDialog.tsx`（stats对象，recentSongs数组）

```typescript
interface ArtistAnalytics {
  singer_id: string;
  total_songs: number;
  total_plays: number;            // 整数，前端显示 "1.5M"
  total_revenue: number;          // 元，前端显示 "¥15.2k"
  avg_play_rate: number;          // 百分比 0–100，前端显示 "85%"
  active_days: number;            // 活跃天数
  recent_songs: RecentSong[];     // 最近曲目列表
  fan_growth_data: number[];      // 7天粉丝增长趋势（用于迷你图）
  play_trend_data: number[];      // 7天播放趋势
  updated_at: string;
}

interface RecentSong {
  id: string;
  title: string;
  plays: number;                  // 播放量整数，前端显示 "450K"
  date: string;                   // ISO 日期
  duration: string;               // 格式："3:45"
}
```

---

### 2.15 艺人签约合同

#### `SigningContract` — 签约合同
> 来源文件：`ArtistSigningDialog.tsx`（步骤流程、条款定义）

```typescript
interface SigningContract {
  id: string;                     // UUID，主键
  listing_id: string;             // 关联 MarketplaceArtist.id
  buyer_id: string;               // 签约方（买家） User.id
  seller_id: string;              // 卖家 User.id
  singer_id: string;              // 关联 Singer.id
  signing_price: number;          // 签约价格（元）
  revenue_split_buyer: number;    // 买家收益分成比例，默认 70（70%）
  revenue_split_seller: number;   // 卖家收益分成比例，默认 30（30%）
  terms_agreed: boolean;          // 是否已同意条款，必须为 true
  terms_agreed_at: string | null; // 同意条款时间戳
  payment_status: 'pending' | 'paid' | 'refunded';
  contract_status: 'active' | 'terminated';
  created_at: string;
  activated_at: string | null;
}
```

**前端合同条款（硬编码，后端建议存 CMS 或配置表）：**
```
1. 签约后，您将获得该艺人的独家运营权，包括音乐发行、商业合作等权益
2. 原创者将保留艺人的所有权，您作为运营方享有收益分成权
3. 收益分成比例：您 70% / 原创者 30%
4. 合同期限：永久（除非双方协商解约）
5. 您需遵守平台社区规范，不得从事违法违规活动
6. 平台保留最终解释权
```

---

### 2.16 艺人市场挂牌

#### `ArtistListingRequest` — 发布艺人到市场（请求体）
> 来源文件：`ArtistListingDialog.tsx`（handlePublish，form state）

```typescript
interface ArtistListingRequest {
  singer_id: string;           // 要挂牌的 Singer.id
  signing_price: number;       // 签约价格（元），整数，建议范围 5000–15000
  description: string;         // 艺人简介，自由文本
  license_type: LicenseType;   // 'exclusive' | 'non_exclusive'
  enable_auto_reply: boolean;  // 是否开启自动回复询价
}
```

**收益分成计算（前端实时计算逻辑，后端对齐）：**
```typescript
// 来源：ArtistListingDialog.tsx calculatedSplit 对象
const calculatedSplit = {
  total: signingPrice,
  yourEarnings: Math.floor(signingPrice * 0.8),  // 卖家获得 80%
  platformFee: Math.floor(signingPrice * 0.2)    // 平台收取 20%
};
```

> ⚠️ **注意**：`ArtistListingDialog` 中卖家获得 **80%**，`ArtistSigningDialog` 合同条款中原创者获得 **30%**。二者描述的是不同场景：
> - 挂牌时：发布者(卖家) 80% vs 平台 20%（签约费分配）  
> - 合同时：买家运营方 70% vs 原创者 30%（后续收益分配）  
> 后端需用两套独立规则处理。

---

### 2.17 发行渠道

#### `DistributionChannel` — 发行渠道配置
> 来源文件：`DistributionPage.tsx`（channels数组，ChannelConfig interface）

```typescript
interface DistributionChannel {
  id: string;                        // 渠道唯一标识，见枚举 1.15
  name: string;                      // 渠道名称（中文）
  name_en: string;                   // 渠道名称（英文）
  description: string;               // 覆盖平台描述
  required_accounts: string[];       // 所需绑定的账号Key列表（见枚举 1.16）
  benefits: string[];                // 权益列表（中文）
  benefits_en: string[];             // 权益列表（英文）
  platform_count: number;            // 覆盖平台总数
  is_active: boolean;
}
```

**前端已定义的3个渠道（静态配置，建议存数据库可配置）：**

```json
[
  {
    "id": "domestic",
    "name": "国内AI专属通道",
    "name_en": "Domestic AI Channel",
    "description": "腾讯音乐「启明星」/ 网易云音乐人",
    "required_accounts": ["tencent_music", "netease_music"],
    "platform_count": 4,
    "benefits": [
      "✓ 自动标记「AI创作」标签",
      "✓ QQ音乐、酷狗、酷我同步上架",
      "✓ 平台播放激励金（每万次播放约¥30-80）",
      "✓ 支持纯AI生成作品发行"
    ]
  },
  {
    "id": "global",
    "name": "全球流媒体发行",
    "name_en": "Global DSPs",
    "description": "DistroKid / TuneCore / CD Baby",
    "required_accounts": ["distrokid", "spotify_artists"],
    "platform_count": 150,
    "benefits": [
      "✓ Spotify, Apple Music, YouTube Music, Amazon",
      "✓ 150+ 平台同步发行",
      "✓ 赚取流媒体版税（需商业授权）",
      "✓ 支持 ISRC 与 UPC 国际标准码"
    ]
  },
  {
    "id": "shortVideo",
    "name": "短视频矩阵打歌",
    "name_en": "Short Video Matrix",
    "description": "抖音 / TikTok / 快手 / Instagram Reels",
    "required_accounts": ["douyin_creator", "tiktok_business"],
    "platform_count": 6,
    "benefits": [
      "✓ AI 自动生成 15s/30s/60s 竖屏切片",
      "✓ 批量发布至多平台矩阵账号",
      "✓ 算法优化标题、话题标签",
      "✓ 引流至完整版 & NFT 购买页"
    ]
  }
]
```

---

### 2.18 平台账号绑定

#### `PlatformAccount` — 用户绑定的第三方平台账号
> 来源文件：`DistributionPage.tsx`（accountStatus state，AccountStatus interface）

```typescript
interface PlatformAccount {
  id: string;                     // UUID，主键
  user_id: string;                // 关联 User.id
  platform_key: string;           // 平台标识，见枚举 1.16
  connected: boolean;             // 是否已连接
  email: string | null;           // 绑定的账号邮箱（脱敏展示）
  access_token: string | null;    // OAuth Access Token（加密存储）
  refresh_token: string | null;   // OAuth Refresh Token（加密存储）
  token_expires_at: string | null;// Token 过期时间
  connected_at: string | null;
  updated_at: string;
}
```

**前端 accountStatus Mock 初始值（参考）：**
```json
{
  "distrokid":        { "connected": true,  "email": "artist@demo.com" },
  "tencent_music":    { "connected": false },
  "netease_music":    { "connected": false },
  "spotify_artists":  { "connected": false },
  "douyin_creator":   { "connected": false },
  "tiktok_business":  { "connected": false }
}
```

---

### 2.19 发行任务

#### `DistributionJob` — 发行任务
> 来源文件：`DistributionPage.tsx`（canSubmit逻辑，发行配置state）

```typescript
interface DistributionJob {
  id: string;                       // UUID，主键
  producer_id: string;              // 关联 User.id
  track_id: string;                 // 关联 Track.id
  singer_id: string | null;         // 关联 Singer.id（可选）
  selected_channels: string[];      // 选中渠道ID列表，如 ["domestic", "global"]
  release_date: string | null;      // 预计发行日期，ISO 格式，null = 立即发行
  release_time: string | null;      // 发行时间，格式 "HH:mm"
  enable_pre_save: boolean;         // 是否开启预存活动，默认 false
  pre_save_start_days: number;      // 提前多少天开始预存，默认 15
  status: DistributionJobStatus;    // 任务状态
  platform_results: PlatformResult[]; // 各平台发行结果
  submitted_at: string;
  completed_at: string | null;
}

type DistributionJobStatus = 
  | 'pending'     // 等待处理
  | 'processing'  // 发行中
  | 'partial'     // 部分成功
  | 'completed'   // 全部成功
  | 'failed';     // 失败

interface PlatformResult {
  platform_key: string;       // 平台标识
  channel_id: string;         // 渠道ID
  status: 'success' | 'failed' | 'pending';
  track_url: string | null;   // 已发行的平台链接
  error_message: string | null;
}
```

**前端发行前置条件校验（后端需同步）：**
```typescript
// 来源：DistributionPage.tsx canSubmit()
const canSubmit = () => {
  return (
    selectedTrack !== null &&           // 必须选择曲目
    selectedChannels.length > 0 &&      // 必须选择至少一个渠道
    getUnconnectedAccounts().length === 0 // 所选渠道的所有必需账号必须已绑定
  );
};
```

---

### 2.20 音乐榜单

#### `ChartEntry` — 榜单条目
> 来源文件：`App.tsx`（CHART_DATA常量，FanApp榜单Tab）

```typescript
interface ChartEntry {
  id: string;               // UUID，主键
  chart_id: string;         // 所属榜单ID，如 "weekly_hot"
  track_id: string;         // 关联 Track.id
  singer_id: string;        // 关联 Singer.id
  title: string;            // 曲目标题（冗余字段，提升读取性能）
  artist_name: string;      // 艺人名称（冗余字段）
  cover_url: string;        // 封面图 URL（冗余��段）
  votes: number;            // 票数，整数，默认 0
  trend: ChartTrend;        // 'up' | 'down' | 'same'
  rank: number;             // 当前排名，整数从 1 开始
  prev_rank: number | null; // 上期排名（计算趋势用）
  updated_at: string;
}
```

**前端 Mock 榜单数据（参考）：**
```json
[
  { "id": "1", "title": "Neon Rain",       "artist_name": "Neon V",        "votes": 12450, "trend": "up",   "rank": 1 },
  { "id": "2", "title": "Cyber Heartbeat", "artist_name": "Project: Zero", "votes": 10890, "trend": "up",   "rank": 2 },
  { "id": "3", "title": "Digital Tears",   "artist_name": "Luna Soft",     "votes": 9800,  "trend": "down", "rank": 3 },
  { "id": "4", "title": "Void Echo",       "artist_name": "Echo Bot",      "votes": 8500,  "trend": "same", "rank": 4 },
  { "id": "5", "title": "System Error",    "artist_name": "Glitch Gang",   "votes": 7200,  "trend": "up",   "rank": 5 }
]
```

#### `VoteRecord` — 投票记录
> 来源文件：`App.tsx`（FanApp投票按钮逻辑）

```typescript
interface VoteRecord {
  id: string;
  chart_entry_id: string;   // 关联 ChartEntry.id
  user_id: string;          // 投票用户（粉丝）
  voted_at: string;
}
```

> **限制规则**（前端隐含，后端需执行）：每用户每榜单每天最多投票 N 次（建议3次）。

---

### 2.21 掌门人-学员关系

#### `CoachTrainee` — 掌门人-学员关系
> 来源文件：`App.tsx`（CoachApp，TRANSLATIONS coach部分）

```typescript
interface CoachTrainee {
  id: string;
  coach_id: string;                   // 掌门人 User.id
  trainee_id: string;                 // 学员 User.id
  status: TraineeStatus;              // 'active' | 'inactive' | 'graduated'
  revenue_share_pct: number;          // 掌门人从学员收益中的分成比例，整数 0–100
  joined_at: string;
  updated_at: string;
}
```

#### `TraineeKPI` — 学员KPI数据
> 来源文件：`App.tsx`（CoachApp小队监控表格）

```typescript
interface TraineeKPI {
  trainee_id: string;          // 关联 User.id
  username: string;            // 学员用户名
  avatar_url: string;          // 学员头像
  status: TraineeStatus;       // 活跃状态
  weekly_songs: number;        // 本周新歌数
  weekly_progress: number;     // 本周进度百分比 0–100
  weekly_revenue: number;      // 本周营收（元）
  success_rate: number;        // 成功率 0–100
  pending_reviews: number;     // 待批改数量
  week_start: string;          // 统计周起始日期
}
```

#### `SubmissionReview` — 作品提交审核
> 来源文件：`App.tsx`（CoachApp详情面板 approve/reject）

```typescript
interface SubmissionReview {
  id: string;
  coach_id: string;                 // 审核掌门人 User.id
  trainee_id: string;               // 提交学员 User.id
  track_id: string;                 // 关联 Track.id
  status: 'pending' | 'approved' | 'rejected';
  review_comment: string | null;    // 审核备注
  submitted_at: string;
  reviewed_at: string | null;
}
```

---

## 3. 接口清单（RESTful）

> 以下为基于前端数据流梳理出的完整接口清单，**供后端团队实现参考**。

### 3.1 认证
```
POST   /api/auth/register            注册（邮箱/密码）
POST   /api/auth/login               登录
POST   /api/auth/logout              登出
POST   /api/auth/refresh             刷新 Token
POST   /api/auth/oauth/:provider     OAuth 登录（google/wechat/metamask）
GET    /api/auth/me                  获取当前用户信息
PATCH  /api/auth/me                  更新用户信息（语言偏好/主题/头像）
```

### 3.2 AI歌手
```
GET    /api/singers                  获取当前用户歌手列表（含搜索/筛选/分页）
  query: ?status=active&q=霓虹&page=1&limit=20

POST   /api/singers                  创建新歌手
GET    /api/singers/:id              获取单个歌手详情
PATCH  /api/singers/:id              更新歌手信息（名称/风格/标签/状态等）
DELETE /api/singers/:id              软删除（归档）歌手
POST   /api/singers/:id/archive      归档歌手
POST   /api/singers/generate         AI生成歌手（基于人格参数 + 图片/文字）
POST   /api/singers/genetic-mix      基因混合生成（Phase 3）
PATCH  /api/singers/:id/wardrobe     更新服装装备状态
PATCH  /api/singers/:id/pose         更新姿态/表情/手势配置
```

### 3.3 官方IP库
```
GET    /api/official-ips             获取官方IP列表
GET    /api/official-ips/:id         获取单个官方IP详情
```

### 3.4 服装系统
```
GET    /api/wardrobe/items           获取服装库列表（含分类/稀有度筛选）
  query: ?category=top&rarity=epic&q=赛博

GET    /api/wardrobe/my-items        获取用户已拥有/收藏的服装
POST   /api/wardrobe/items/:id/favorite   收藏/取消收藏服装
POST   /api/wardrobe/items/:id/unlock     解锁锁定服装（消耗积分/付费）

GET    /api/wardrobe/outfits         获取用户保存的套装列表
POST   /api/wardrobe/outfits         保存新套装
DELETE /api/wardrobe/outfits/:id     删除套装
```

### 3.5 姿态动作系统
```
GET    /api/poses                    获取姿态库列表
  query: ?category=dancing&difficulty=hard

GET    /api/expressions              获取表情库列表
GET    /api/gestures                 获取手势库列表
POST   /api/poses/:id/unlock         解锁锁定姿态
```

### 3.6 音乐曲目
```
GET    /api/tracks                   获取当前用户曲目列表
  query: ?status=published&singer_id=xxx&page=1&limit=20

POST   /api/tracks/generate          发起AI音乐生成任务
  → 返回 job_id，前端轮询

GET    /api/tracks/generate/:job_id  查询生成任务状态
  → 返回 TrackGenerationResponse

GET    /api/tracks/:id               获取曲目详情（含歌词）
PATCH  /api/tracks/:id               更新曲目信息（标题/封面等）
DELETE /api/tracks/:id               删除曲目
POST   /api/tracks/:id/publish       发布曲目
```

### 3.7 NFT合集与铸造
```
GET    /api/nft/collections          获取当前用户NFT合集列表
POST   /api/nft/collections          创建NFT合集配置
GET    /api/nft/collections/:id      获取单个合集详情

POST   /api/nft/mint                 发起铸造任务
  → 返回 job_id

GET    /api/nft/mint/:job_id         查询铸造状态
  → 返回 NFTMintJob

GET    /api/nft/wallet/connect       获取钱包连接信息（签名挑战）
POST   /api/nft/wallet/verify        验证钱包签名
```

### 3.8 财务
```
GET    /api/finance/balance          获取账户余额
GET    /api/finance/transactions     获取交易记录
  query: ?type=royalty&status=completed&from=2024-01-01&to=2024-12-31&page=1

GET    /api/finance/stats            获取收益统计图表数据
  query: ?period=7d|30d|12m

POST   /api/finance/withdraw         发起提现请求
  body: { amount, wallet_address }
```

### 3.9 市场与签约
```
GET    /api/marketplace              获取市场艺人列表（公开接口）
  query: ?style=cyberpunk&sort=price_asc&page=1&limit=20

GET    /api/marketplace/:id          获取市场艺人详情
POST   /api/marketplace              发布艺人到市场（挂牌）
  body: ArtistListingRequest

PATCH  /api/marketplace/:id          更新挂牌信息
DELETE /api/marketplace/:id          下架艺人

POST   /api/marketplace/:id/sign     签约艺人（购买）
  body: { agreed_to_terms: true }

GET    /api/marketplace/:id/analytics 获取艺人数据分析
```

### 3.10 发行
```
GET    /api/distribution/channels    获取发行渠道列表
GET    /api/distribution/accounts    获取用户绑定的平台账号状态
POST   /api/distribution/accounts/:platform/connect  连接平台账号（OAuth）
POST   /api/distribution/accounts/:platform/disconnect 解绑平台账号

POST   /api/distribution/jobs        提交发行任务
  body: DistributionJob（不含id/status/results字段）

GET    /api/distribution/jobs        获取发行任务列表
GET    /api/distribution/jobs/:id    获取发行任务状态与结果
```

### 3.11 榜单（粉丝端）
```
GET    /api/charts                   获取榜单列表（如周榜、月榜）
GET    /api/charts/:chart_id         获取指定榜单数据
POST   /api/charts/:entry_id/vote    为榜单条目投票
  → 需要登录，限每用户每天3票
```

### 3.12 掌门人端
```
GET    /api/coach/trainees           获取掌门人的学员列表（含KPI）
GET    /api/coach/trainees/:id       获取单个学员详情
POST   /api/coach/trainees/invite    邀请学员加入
PATCH  /api/coach/trainees/:id/status 修改学员状态

GET    /api/coach/reviews            获取待审核作品列表
GET    /api/coach/reviews/:id        获取单个审核详情
POST   /api/coach/reviews/:id/approve 通过作品
POST   /api/coach/reviews/:id/reject  驳回作品
  body: { comment: string }

POST   /api/coach/tasks              向学员下发任务
GET    /api/coach/stats              获取小队整体KPI统计
```

### 3.13 积分
```
GET    /api/credits/balance          获取当前积分余额
GET    /api/credits/history          获取积分消耗/获取记录
POST   /api/credits/purchase         购买积分（对接支付）
```

---

## 4. 字段约束与校验规则

> 来源：前端表单输入、range滑块、业务逻辑代码

| 模型 | 字段 | 类型 | 最小值 | 最大值 | 必填 | 默认值 | 特殊规则 |
|------|------|------|--------|--------|------|--------|---------|
| User | username | string | 3字符 | 50字符 | ✅ | — | 唯一，字母数字下划线 |
| User | credits | integer | 0 | — | ✅ | 100 | 不可为负 |
| Singer | name | string | 1字符 | 100字符 | ✅ | — | — |
| Singer | tags | array | 0项 | 10项 | ❌ | `[]` | 前端显示截取3项 |
| Singer | genetic_ratio | integer | 0 | 100 | ❌ | `null` | 仅基因混合时必填 |
| PersonaParams | sweetness | integer | 0 | 100 | ✅ | 70 | — |
| PersonaParams | energy | integer | 0 | 100 | ✅ | 80 | — |
| PersonaParams | mystery | integer | 0 | 100 | ✅ | 50 | — |
| ClothingItem | price | integer | 0 | 9999 | ✅ | — | 虚拟货币 |
| Expression | default_intensity | integer | 0 | 100 | ✅ | 80 | — |
| SingerPoseConfig | expression_intensity | integer | 0 | 100 | ✅ | 80 | — |
| Track | bpm | integer | 40 | 240 | ❌ | `null` | — |
| Track | duration_sec | integer | 30 | 600 | ✅ | 120 | — |
| Track | title | string | 1字符 | 200字符 | ✅ | — | — |
| NFTCollection | supply | integer | 1 | 10000 | ✅ | 100 | — |
| NFTCollection | price_eth | decimal | 0.001 | 100 | ✅ | 0.05 | — |
| NFTCollection | royalty_pct | integer | 0 | 100 | ✅ | 10 | >30时前端警告 |
| MarketplaceArtist | signing_price | integer | 1 | — | ✅ | 8800 | 建议范围5000–15000 |
| LyricLine | time | integer | 0 | — | ✅ | — | 单调递增 |
| LyricLine | text | string | 1字符 | 200字符 | ✅ | — | — |
| DistributionJob | release_date | date | 今天+1天 | — | ❌ | `null` | 不可排期到过去 |
| ArtistListingRequest | description | string | 0字符 | 2000字符 | ❌ | `""` | — |
| TrackGenerationRequest | acrostic_word | string | 1字符 | 8字符 | 条件必填 | `null` | 仅藏头歌模式 |

---

## 5. 业务计算规则

> 来源：前端组件中的计算逻辑，后端必须对齐，不可由前端单方面执行

### 5.1 积分消耗规则
```
音乐生成：每次 -5 积分
图片生成（AI生成头像）：每次 -3 积分（规划值）
基因混合：每次 -10 积分（规划值）

积分不足时：HTTP 402 Payment Required
返回：{ error: "INSUFFICIENT_CREDITS", current: N, required: M }
```

### 5.2 市场挂牌收益分成
```
发布者（卖家）实际到手 = signing_price × 80%
平台服务费            = signing_price × 20%

// 来源：ArtistListingDialog.tsx calculatedSplit
yourEarnings = Math.floor(signingPrice * 0.8)
platformFee  = Math.floor(signingPrice * 0.2)
```

### 5.3 签约合同收益分成
```
买家（运营方）享有后续收益 = 70%
原创者享有后续收益          = 30%

// 来源：ArtistSigningDialog.tsx 合同条款
// 注意：此为后续持续收益分成，与挂牌费是两套独立机制
```

### 5.4 稀有度星级展示规则
```
legendary → 5颗星 + 皇冠图标 + 金色光晕 + pulse动画
epic      → 4颗星 + 紫色光晕
rare      → 3颗星 + 蓝色光晕
common    → 2颗星 + 无光晕

// 来源：AIIncubator.tsx
const STAR_COUNT = { legendary: 5, epic: 4, rare: 3, common: 2 }
```

### 5.5 基因混合稀有度概率（Phase 3规划）
```
common    = 60%
rare      = 30%
epic      = 9%
legendary = 1%

突变触发概率 = 5%（触发后稀有度+1级，最高legendary）
突变类型：holographic_effect | dual_tone_hair | heterochromia | cybernetic_implant | elemental_aura
```

### 5.6 发行覆盖平台数量计算
```
domestic   渠道 → +4  个平台（QQ音乐、酷狗、酷我、网易云）
global     渠道 → +150 个平台
shortVideo 渠道 → +6  个平台（抖音、TikTok、快手、Instagram Reels等）

// 来源：DistributionPage.tsx getTotalPlatforms()
total = 0;
if (channels.includes('domestic'))   total += 4;
if (channels.includes('global'))     total += 150;
if (channels.includes('shortVideo')) total += 6;
```

### 5.7 国内流媒体平台播放激励估算
```
// 来源：DistributionPage.tsx 渠道描述文案
每万次播放约 ¥30–80（平台激励金，非保证值）
此字段为显示性文案，后端不参与计算
```

### 5.8 套餐功能限额规则
```
free       → 歌手最多3个；音乐生成5点/天；不可NFT铸造；不可MCN管理
pro        → 歌手最多20个；50点/天；NFT铸造≤10次/月
enterprise → 全部无限制

// 后端校验时机：创建歌手接口 / 音乐生成接口 / NFT铸造接口
```

### 5.9 发行前置条件（后端需校验）
```
1. track_id 对应曲目的 status = 'published'（或允许草稿发行，需确认）
2. selected_channels 中至少1个渠道
3. 选中渠道的所有 required_accounts 已 connected = true
4. release_date > NOW()（若指定了排期时间）

// 来源：DistributionPage.tsx canSubmit()
```

---

## 6. 通用响应格式

### 6.1 成功响应
```json
{
  "success": true,
  "data": { ... },          // 单条数据
  "message": "操作成功"
}
```

### 6.2 列表响应（分页）
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

### 6.3 错误响应
```json
{
  "success": false,
  "error": {
    "code": "SINGER_NOT_FOUND",       // 业务错误码（英文大写+下划线）
    "message": "歌手不存在",           // 用户友好的错误信息（中文）
    "message_en": "Singer not found", // 英文版本
    "details": { ... }                // 可选，附加错误详情
  }
}
```

### 6.4 建议错误码列表

| HTTP状态码 | 业务错误码 | 说明 |
|-----------|-----------|------|
| 400 | `VALIDATION_ERROR` | 字段校验失败 |
| 401 | `UNAUTHORIZED` | 未登录或Token失效 |
| 402 | `INSUFFICIENT_CREDITS` | 积分不足 |
| 403 | `PLAN_LIMIT_EXCEEDED` | 套餐限额超出 |
| 403 | `MODULE_LOCKED` | 模块未解锁（需升级套餐） |
| 403 | `PERMISSION_DENIED` | 无权限操作他人资源 |
| 404 | `SINGER_NOT_FOUND` | 歌手不存在 |
| 404 | `TRACK_NOT_FOUND` | 曲目不存在 |
| 404 | `LISTING_NOT_FOUND` | 挂牌不存在 |
| 409 | `ALREADY_SIGNED` | 艺人已被签约 |
| 409 | `ALREADY_LISTED` | 艺人已在市场挂牌 |
| 422 | `ACCOUNT_NOT_CONNECTED` | 所需平台账号未绑定 |
| 422 | `TRACK_NOT_READY` | 曲目未生成完成 |
| 429 | `RATE_LIMIT_EXCEEDED` | 请求频率超限 |
| 429 | `VOTE_LIMIT_EXCEEDED` | 投票次数超限 |
| 500 | `AI_GENERATION_FAILED` | AI生成服务故障 |
| 503 | `PLATFORM_UNAVAILABLE` | 第三方平台服务不可用 |

### 6.5 异步任务响应格式（音乐生成 / NFT铸造）
```json
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "status": "queued",
    "poll_url": "/api/tracks/generate/uuid",
    "poll_interval_ms": 2000,
    "estimated_seconds": 17
  }
}
```

---

## 7. 前端状态机与接口映射

> 明确每个前端UI状态触发了哪个接口，帮助后端理解调用时序。

### 7.1 MusicGenerationDialog 状态机
```
[input] 用户填写表单
    ↓ 点击"生成"按钮
POST /api/tracks/generate → 返回 job_id
    ↓
[generating] 前端按 2000ms 间隔轮询
GET /api/tracks/generate/:job_id
    ↓ status = 'completed'
[preview] 展示生成结果
    ↓ 点击"保存并使用"
    ↓ onSuccess(track) 回调 → 加入前端曲库
[success] → 自动关闭弹窗
```

### 7.2 NFTMintingDialog 状态机
```
[config] 用户配置合集参数
    ↓ 点击"下一步"
[wallet] 
    ↓ 点击"连接 MetaMask"
GET /api/nft/wallet/connect → 返回签名挑战
    ↓ 用户在钱包中签名
POST /api/nft/wallet/verify → 返回 wallet_connected = true
    ↓ 点击"确认铸造"
POST /api/nft/mint → 返回 job_id
    ↓
[minting] 前端按 1000ms 间隔轮询
GET /api/nft/mint/:job_id
    ↓ status = 'success'
[success] 展示合约地址 / Token ID
```

### 7.3 ArtistSigningDialog 状态机
```
[details] 展示艺人信息
    ↓ 点击"下一步"
GET /api/marketplace/:id → 获取最新挂牌详情
    ↓
[contract] 展示合同条款
    ↓ 勾选"已阅读并同意" + 点击"同意并继续"
    ↓
[payment] 展示费用
    ↓ 点击"确认支付"
POST /api/marketplace/:id/sign → 返回 SigningContract
    ↓
[success] 签约成功 → 艺人加入用户名单
```

### 7.4 DistributionPage 发行流程
```
初始化：
GET /api/tracks → 获取曲目列表
GET /api/distribution/channels → 获取渠道配置
GET /api/distribution/accounts → 获取账号绑定状态

用户操作：
POST /api/distribution/accounts/:platform/connect → OAuth授权跳转
POST /api/distribution/accounts/:platform/disconnect → 解绑

点击"提交发行审核"（需通过 canSubmit() 检查）：
POST /api/distribution/jobs → 提交发行任务
    ↓
GET /api/distribution/jobs/:id → 轮询发行状态
```

### 7.5 AIIncubator + SingerEditor 操作映射
```
初始化：
GET /api/singers → 获取歌手列表

创建歌手：
POST /api/singers → body: { name: "新歌手", status: "draft", quality: "common", ... }

编辑歌手（SingerEditor）：
GET /api/official-ips → 获取官方IP列表（Tab1）
PATCH /api/singers/:id → 实时保存参数变更（防抖 500ms）

服装操作：
GET /api/wardrobe/items → 获取服装库
GET /api/wardrobe/my-items → 获取用户库存
PATCH /api/singers/:id/wardrobe → body: EquippedItems（装备/卸下）
POST /api/wardrobe/items/:id/favorite → 收藏
POST /api/wardrobe/outfits → 保存套装

姿态操作：
GET /api/poses → 获取姿态库
GET /api/expressions → 获取表情库
GET /api/gestures → 获取手势库
PATCH /api/singers/:id/pose → body: SingerPoseConfig

保存歌手：
PATCH /api/singers/:id → 完整 Singer 对象更新

删除歌手：
DELETE /api/singers/:id → 软删除（archived）
```

---

*文档结束 — AI Star Eco 前后端数据模型对接规范 v1.0.0*  
*前端源码分析完成时间：2026-04-08*  
*如有字段变更请同步更新本文档*

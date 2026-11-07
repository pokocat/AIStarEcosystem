/**
 * 场景化快速生成（AI 视频 / AI 图片）的场景库。
 * 每个场景定义：需要放哪些素材、提示词快捷补充项、示例写法，以及 AI 编导按什么结构写脚本。
 * 推荐场景随首页方案切换；剧情类场景可以一键升级到 AI 导演台做多镜头精修。
 */
import type { SolutionId } from '../../../data/ipPlatform';

export type LT = { zh: string; en: string };
const L = (zh: string, en: string): LT => ({ zh, en });

export type GenKind = 'video' | 'image';

/** What a slot accepts. `character` / `voice` default to the active IP. */
export type SlotType = 'image' | 'character' | 'voice' | 'video';
export interface SlotDef { id: string; type: SlotType; label: LT; optional?: boolean; max?: number }
export interface Chip { label: LT; note?: LT }

export interface Scene {
  id: string;
  kind: GenKind;
  group: string;
  name: LT;
  tagline: LT;
  cover: string;
  slots: SlotDef[];
  chips: Chip[];
  placeholder: LT;
  /** 8 short writing tips shown on the example panel. */
  guide: LT[];
  /** Script beats AI 编导 fills in (video only). */
  beats?: LT[];
  /** Multi-shot scenes can be refined in the AI 导演台. */
  director?: boolean;
}

export const demoImage = (slug: string) => `/images/${slug}.webp`;

const slot = {
  product: (optional = false): SlotDef => ({ id: 'product', type: 'image', label: L('商品图', 'Product'), optional, max: 3 }),
  store: (): SlotDef => ({ id: 'store', type: 'image', label: L('门店图', 'Store photos'), max: 4 }),
  brand: (): SlotDef => ({ id: 'brand', type: 'image', label: L('品牌素材', 'Brand assets'), optional: true, max: 4 }),
  character: (optional = true): SlotDef => ({ id: 'character', type: 'character', label: L('角色', 'Character'), optional }),
  voice: (): SlotDef => ({ id: 'voice', type: 'voice', label: L('声音', 'Voice'), optional: true }),
  refVideo: (): SlotDef => ({ id: 'refVideo', type: 'video', label: L('参考爆款', 'Reference'), max: 1 }),
  images: (max = 9): SlotDef => ({ id: 'images', type: 'image', label: L('参考图', 'References'), optional: true, max }),
  photo: (id: string, zh: string, en: string, optional = false, max = 1): SlotDef => ({ id, type: 'image', label: L(zh, en), optional, max }),
};

const chip = (zh: string, en: string, note?: LT): Chip => ({ label: L(zh, en), note });
const OPTIONAL_NOTE = L('有就写', 'if any');

/* ───────────────────────── AI 视频 ───────────────────────── */

export const VIDEO_GROUPS: Array<{ id: string; name: LT }> = [
  { id: 'commerce', name: L('电商带货', 'E-commerce') },
  { id: 'local', name: L('同城到店', 'Local stores') },
  { id: 'brand', name: L('品牌广告', 'Brand ads') },
  { id: 'drama', name: L('剧情短片', 'Story shorts') },
  { id: 'ip', name: L('IP 内容', 'IP content') },
];

const COMMERCE_GUIDE = [
  L('开头一句话说清商品解决什么', 'Open with what the product solves'),
  L('中间边讲边展示商品细节和使用过程', 'Show details and usage while talking'),
  L('结尾讲怎么买并引导下单', 'Close with how to buy'),
  L('优惠信息客户写了才讲', 'Only mention deals the client gave'),
  L('没写就讲使用场景和用法', 'Otherwise talk about use cases'),
  L('拿到客户的商品和卖点后', 'Start from the real product and claims'),
  L('先核对商品细节与图片一致', 'Check details match the photos'),
  L('再按「问题→展示→怎么买」写', 'Write as problem → demo → how to buy'),
];
const LOCAL_GUIDE = [
  L('第一秒就拍出门店最有特色的画面', 'First second: the most distinctive shot'),
  L('说清店在哪、怎么去', 'Say where it is and how to get there'),
  L('招牌产品给足特写', 'Close-ups of the signature item'),
  L('真实体验比夸张形容更可信', 'Real experience beats hype'),
  L('价格和团购信息要准确', 'Prices and deals must be accurate'),
  L('人多、排队等热度画面加分', 'Crowds and queues add proof'),
  L('结尾给一个马上到店的理由', 'End with a reason to visit now'),
  L('时长控制在 15–30 秒', 'Keep it 15–30 seconds'),
];
const BRAND_GUIDE = [
  L('先想清楚只传达一个核心信息', 'Pick one core message'),
  L('画面服务于情绪，不堆卖点', 'Visuals serve the mood, not a feature list'),
  L('品牌元素自然出现，不要硬贴 logo', 'Let brand elements appear naturally'),
  L('用具体的人和场景代替口号', 'Use people and scenes instead of slogans'),
  L('节奏先慢后快，留出记忆点', 'Slow then fast, leave a memorable beat'),
  L('结尾一句主张 + 品牌露出', 'Close with the claim and the brand'),
  L('配乐和色调保持品牌调性', 'Keep music and grade on-brand'),
  L('一条片子只讲一件事', 'One film, one idea'),
];
const DRAMA_GUIDE = [
  L('前 3 秒抛出冲突或悬念', 'Conflict or hook in the first 3s'),
  L('人物不超过 3 个，关系一句话说清', 'Max 3 characters, one-line relationships'),
  L('每句台词都推动剧情', 'Every line moves the story'),
  L('中段制造一次情绪升级', 'Escalate once in the middle'),
  L('结尾留反转或钩子引导追更', 'End on a twist or a hook'),
  L('商品出现要服务剧情', 'Products must serve the plot'),
  L('单集控制在 30–60 秒', 'Keep episodes 30–60 seconds'),
  L('多镜头精修可交给 AI 导演', 'Hand multi-shot work to the AI Director'),
];
const IP_GUIDE = [
  L('用 IP 自己的口吻说话', "Speak in the IP's own voice"),
  L('一条只讲一个观点或一件事', 'One point or moment per video'),
  L('开头直接给结论或问题', 'Lead with the takeaway or question'),
  L('加入 IP 的口头禅和小动作', 'Add catchphrases and habits'),
  L('画面与人设保持一致', 'Keep visuals on-persona'),
  L('结尾引导关注或评论互动', 'End with a follow or comment prompt'),
  L('复刻爆款只借结构不抄内容', 'Borrow structure, not content'),
  L('保持固定更新节奏', 'Keep a steady cadence'),
];

const COMMERCE_BEATS = [L('开场钩子', 'Hook'), L('商品展示', 'Demo'), L('卖点讲解', 'Benefits'), L('下单引导', 'Call to action')];
const LOCAL_BEATS = [L('门店亮相', 'Store reveal'), L('招牌特写', 'Signature close-up'), L('真实体验', 'Experience'), L('到店理由', 'Reason to visit')];
const BRAND_BEATS = [L('情绪开场', 'Mood open'), L('场景叙事', 'Story'), L('品牌时刻', 'Brand moment'), L('主张收尾', 'Claim')];
const DRAMA_BEATS = [L('冲突开场', 'Conflict'), L('关系推进', 'Build-up'), L('情绪升级', 'Escalation'), L('反转/钩子', 'Twist / hook')];
const IP_BEATS = [L('开门见山', 'Lead'), L('观点展开', 'Point'), L('人设细节', 'Persona beat'), L('互动引导', 'Engage')];

const V = (id: string, group: string, name: LT, tagline: LT, cover: string, slots: SlotDef[], chips: Chip[], placeholder: LT, guide: LT[], beats: LT[], director = false): Scene =>
  ({ id, kind: 'video', group, name, tagline, cover: demoImage(cover), slots, chips, placeholder, guide, beats, director });

const PH_COMMERCE = L('贴上写好的提示词直接生成；只有想法的话，写几句让 AI 编导帮你写成脚本', 'Paste a finished prompt, or jot down an idea and let AI write the script');

export const VIDEO_SCENES: Scene[] = [
  V('talk_sell', 'commerce', L('口播带货', 'Talking sales'), L('有人出镜推荐，建立购买信任', 'A presenter builds trust'), 'video-talk-sell',
    [slot.product(), slot.character(), slot.voice()], [chip('商品是什么', 'What it is'), chip('解决什么问题', 'Problem solved'), chip('价格优惠', 'Price & deal', OPTIONAL_NOTE)], PH_COMMERCE, COMMERCE_GUIDE, COMMERCE_BEATS),
  V('promo', 'commerce', L('促销转化', 'Promotion'), L('把优惠讲透，推动马上下单', 'Make the deal clear, drive orders'), 'video-promo',
    [slot.product(), slot.character(), slot.voice()], [chip('优惠力度', 'Discount'), chip('活动时间', 'Deadline'), chip('赠品/限量', 'Gifts / limited', OPTIONAL_NOTE)], PH_COMMERCE, COMMERCE_GUIDE, COMMERCE_BEATS),
  V('seeding', 'commerce', L('场景种草', 'Lifestyle seeding'), L('放进生活场景，让人想用', 'Put it in daily life'), 'video-seeding',
    [slot.product(), slot.character(), slot.voice()], [chip('用在什么场景', 'Where it is used'), chip('用完什么感觉', 'How it feels')], PH_COMMERCE, COMMERCE_GUIDE, COMMERCE_BEATS),
  V('pain', 'commerce', L('痛点解决', 'Pain point'), L('先戳中烦恼，再给出解决效果', 'Hit the pain, show the fix'), 'video-pain',
    [slot.product(), slot.character(), slot.voice()], [chip('用户的烦恼', 'The pain'), chip('用了之后的变化', 'The change')], PH_COMMERCE, COMMERCE_GUIDE, COMMERCE_BEATS),
  V('demo', 'commerce', L('功能演示', 'Feature demo'), L('把功能演示出来，证明好用', 'Prove it works'), 'video-demo',
    [slot.product(), slot.character(), slot.voice()], [chip('核心功能', 'Key feature'), chip('操作步骤', 'Steps')], PH_COMMERCE, COMMERCE_GUIDE, COMMERCE_BEATS),

  V('store_find', 'local', L('门店发现', 'Store discovery'), L('拍出特色，给人到店的理由', 'Show what makes it special'), 'video-store-find',
    [slot.store(), slot.character(), slot.voice()], [chip('店名和位置', 'Name & location'), chip('特色是什么', 'What is special')], PH_COMMERCE, LOCAL_GUIDE, LOCAL_BEATS),
  V('visit', 'local', L('到店实录', 'Store visit'), L('真实到店体验，让人放心', 'A real visit builds trust'), 'video-visit',
    [slot.store(), slot.character(), slot.voice()], [chip('体验了什么', 'What you tried'), chip('真实感受', 'Honest take')], PH_COMMERCE, LOCAL_GUIDE, LOCAL_BEATS),
  V('signature', 'local', L('招牌体验', 'Signature item'), L('围绕招牌产品，讲出门店价值', 'Build around the signature item'), 'video-signature',
    [slot.store(), slot.character(), slot.voice()], [chip('招牌是什么', 'Signature'), chip('为什么必点', 'Why order it')], PH_COMMERCE, LOCAL_GUIDE, LOCAL_BEATS),
  V('groupbuy', 'local', L('同城团购', 'Group deal'), L('讲清团购划算，推动到店核销', 'Explain the deal, drive redemptions'), 'video-groupbuy',
    [slot.store(), slot.character(), slot.voice()], [chip('套餐内容', 'Package'), chip('团购价', 'Deal price'), chip('有效期', 'Valid until', OPTIONAL_NOTE)], PH_COMMERCE, LOCAL_GUIDE, LOCAL_BEATS),

  V('claim', 'brand', L('品牌主张', 'Brand claim'), L('传达理念，让人认同你', 'Make people share your belief'), 'video-claim',
    [slot.brand(), slot.character(), slot.voice()], [chip('品牌理念', 'Belief'), chip('目标人群', 'Audience')], PH_COMMERCE, BRAND_GUIDE, BRAND_BEATS),
  V('brand_story', 'brand', L('品牌故事', 'Brand story'), L('讲品牌的来历和坚持', 'Where you came from and why'), 'video-brand-story',
    [slot.brand(), slot.character(), slot.voice()], [chip('创立契机', 'Origin'), chip('一直坚持的事', 'What you never compromise')], PH_COMMERCE, BRAND_GUIDE, BRAND_BEATS, true),
  V('lifestyle', 'brand', L('生活方式', 'Lifestyle'), L('呈现用户向往的生活', 'The life your users want'), 'video-lifestyle',
    [slot.brand(), slot.character(), slot.voice()], [chip('向往的场景', 'Aspiration'), chip('情绪关键词', 'Mood')], PH_COMMERCE, BRAND_GUIDE, BRAND_BEATS),
  V('concept', 'brand', L('创意概念', 'Creative concept'), L('用创意画面让人记住品牌', 'A visual idea people remember'), 'video-concept',
    [slot.brand(), slot.voice()], [chip('核心创意', 'Big idea'), chip('视觉风格', 'Visual style')], PH_COMMERCE, BRAND_GUIDE, BRAND_BEATS),

  V('dialog', 'drama', L('对话剧情', 'Dialogue'), L('两三个人的对话推动故事', 'Two or three people drive the story'), 'video-dialog',
    [slot.character(false), slot.voice()], [chip('人物关系', 'Relationships'), chip('核心冲突', 'Conflict')], PH_COMMERCE, DRAMA_GUIDE, DRAMA_BEATS, true),
  V('twist', 'drama', L('反转剧情', 'Plot twist'), L('前面铺垫，结尾一个反转', 'Set up, then flip it'), 'video-twist',
    [slot.character(false), slot.voice()], [chip('表面情节', 'The setup'), chip('真相反转', 'The twist')], PH_COMMERCE, DRAMA_GUIDE, DRAMA_BEATS, true),
  V('mystery', 'drama', L('悬疑剧情', 'Mystery'), L('一个谜团吊住观众', 'A mystery that hooks viewers'), 'video-mystery',
    [slot.character(false), slot.voice()], [chip('谜团是什么', 'The mystery'), chip('线索', 'Clues')], PH_COMMERCE, DRAMA_GUIDE, DRAMA_BEATS, true),
  V('emotion', 'drama', L('情感剧情', 'Emotional story'), L('打动人心的情感故事', 'A story that moves people'), 'video-emotion',
    [slot.character(false), slot.voice()], [chip('情感主题', 'Theme'), chip('打动点', 'The moment')], PH_COMMERCE, DRAMA_GUIDE, DRAMA_BEATS, true),
  V('placement', 'drama', L('剧情植入', 'Story placement'), L('故事里自然带出商品', 'The product lives in the story'), 'video-placement',
    [slot.product(), slot.character(false), slot.voice()], [chip('故事梗概', 'Story'), chip('商品出场方式', 'How it appears')], PH_COMMERCE, DRAMA_GUIDE, DRAMA_BEATS, true),

  V('dh_talk', 'ip', L('数字人口播', 'Digital-human talk'), L('你的 IP 出镜，讲观点、讲知识', 'Your IP shares views and know-how'), 'video-dh-talk',
    [slot.character(false), slot.voice()], [chip('讲什么话题', 'Topic'), chip('核心观点', 'Key point')], PH_COMMERCE, IP_GUIDE, IP_BEATS),
  V('ip_daily', 'ip', L('IP 日常', 'IP daily vlog'), L('让你的 IP 过一天，拍成 vlog', 'A day in the life of your IP'), 'video-ip-daily',
    [slot.character(false), slot.voice()], [chip('今天做了什么', 'What happened'), chip('想分享的心情', 'Mood')], PH_COMMERCE, IP_GUIDE, IP_BEATS),
  V('remix', 'ip', L('爆款复刻', 'Viral remix'), L('参考一条爆款，做你自己的版本', 'Your take on a viral video'), 'video-remix',
    [slot.refVideo(), slot.character(), slot.voice()], [chip('爆款好在哪', 'Why it worked'), chip('你的改编点', 'Your twist')], PH_COMMERCE, IP_GUIDE, IP_BEATS),
];

/* ───────────────────────── AI 图片 ───────────────────────── */

export const IMAGE_GROUPS: Array<{ id: string; name: LT }> = [
  { id: 'ip', name: L('IP 形象', 'IP look') },
  { id: 'person', name: L('人物', 'People') },
  { id: 'product', name: L('商品', 'Products') },
  { id: 'scene', name: L('场景', 'Scenes') },
  { id: 'quality', name: L('画质', 'Quality') },
];

const IMAGE_GUIDE = [
  L('先放参考图，再写想要的变化', 'Add references, then describe the change'),
  L('一句话说清主体、场景和风格', 'Subject, setting and style in one line'),
  L('放了多张图时用 @ 指定用哪一张', 'Use @ to point at a specific image'),
  L('人物类保持同一张脸和发型', 'Keep the same face and hair'),
  L('商品类保证外观、颜色和文字不变', 'Keep product shape, color and text'),
  L('写清光线：自然光 / 棚拍 / 夜景', 'Name the light: daylight, studio, night'),
  L('需要多张时一次出 2–4 张挑选', 'Generate 2–4 to pick from'),
  L('满意的图可直接做成视频', 'Turn a favorite into a video'),
];

const PH_IMAGE = L('说说想要什么画面。放了图片的话，输入 @ 可以指定用哪一张', 'Describe the image. With references, type @ to pick one');

const I = (id: string, group: string, name: LT, tagline: LT, cover: string, slots: SlotDef[], chips: Chip[] = []): Scene =>
  ({ id, kind: 'image', group, name, tagline, cover: demoImage(cover), slots, chips, placeholder: PH_IMAGE, guide: IMAGE_GUIDE });

export const FREE_IMAGE: Scene = I('free', 'free', L('自由出图', 'Free generation'), L('自己写描述，可以放几张参考图', 'Write your own prompt, add references'), 'image-free', [slot.images(9)]);

export const IMAGE_SCENES: Scene[] = [
  FREE_IMAGE,
  I('ip_sheet', 'ip', L('IP 设定图', 'IP model sheet'), L('正侧背三视图 + 表情，统一形象', 'Front, side, back and expressions'), 'image-ip-sheet', [slot.character(false)], [chip('服装风格', 'Outfit'), chip('配色', 'Palette')]),
  I('ip_photo', 'ip', L('IP 写真', 'IP photoshoot'), L('给你的 IP 拍一组写真', 'A photo set for your IP'), 'image-ip-photo', [slot.character(false), slot.images(3)], [chip('拍摄场景', 'Location'), chip('氛围', 'Mood')]),
  I('ip_sticker', 'ip', L('IP 表情包', 'IP stickers'), L('一键生成 9 宫格表情包', 'A 9-grid sticker pack'), 'image-ip-sticker', [slot.character(false)], [chip('表情清单', 'Expressions'), chip('配字', 'Captions', OPTIONAL_NOTE)]),
  I('face3', 'person', L('脸部三视图', 'Face turnaround'), L('正脸、侧脸、四分之三角度', 'Front, profile and 3/4'), 'image-face3', [slot.photo('face', '人脸照', 'Face photo')]),
  I('body4', 'person', L('人物四视图', 'Full-body turnaround'), L('正、侧、背 + 半身特写', 'Front, side, back and bust'), 'image-body4', [slot.photo('person', '人物照', 'Full-body photo')]),
  I('face_swap', 'person', L('模特换脸', 'Model face swap'), L('保留穿搭和姿势，换成你的 IP', 'Keep the look, swap in your IP'), 'image-face-swap', [slot.photo('model', '模特图', 'Model photo'), slot.character(false)]),
  I('face_blend', 'person', L('人脸融合', 'Face blend'), L('融合两张脸，生成新形象', 'Blend two faces into one'), 'image-face-blend', [slot.photo('faceA', '人脸 A', 'Face A'), slot.photo('faceB', '人脸 B', 'Face B')], [chip('融合比例', 'Blend ratio')]),
  I('tryon', 'product', L('服装上身', 'Virtual try-on'), L('把衣服穿到模特或 IP 身上', 'Dress a model or your IP'), 'image-tryon', [slot.photo('garment', '服装图', 'Garment'), slot.character()], [chip('搭配', 'Styling'), chip('场景', 'Setting')]),
  I('product_use', 'product', L('商品使用', 'Product in use'), L('人物使用商品的真实画面', 'Someone using the product'), 'image-product-use', [slot.product(), slot.character()], [chip('使用动作', 'Action'), chip('使用场景', 'Setting')]),
  I('white_bg', 'product', L('商品白底图', 'White-background shot'), L('电商主图标准白底', 'Marketplace-ready white background'), 'image-white-bg', [slot.product()]),
  I('selling_point', 'product', L('商品卖点图', 'Feature graphic'), L('卖点文字 + 商品特写', 'Claims with a hero shot'), 'image-selling-point', [slot.product()], [chip('三个卖点', 'Three claims'), chip('主色调', 'Main color')]),
  I('restyle', 'product', L('服装改款', 'Garment restyle'), L('换颜色、图案或版型', 'New color, print or cut'), 'image-restyle', [slot.photo('garment', '服装图', 'Garment')], [chip('改什么', 'What to change')]),
  I('person_scene', 'scene', L('人物入景', 'Place a person'), L('把人物放进新场景', 'Put a person in a new setting'), 'image-person-scene', [slot.character(false), slot.images(2)], [chip('目标场景', 'Target scene')]),
  I('product_scene', 'scene', L('商品入景', 'Place a product'), L('把商品放进生活场景', 'Put the product in context'), 'image-product-scene', [slot.product(), slot.images(2)], [chip('目标场景', 'Target scene')]),
  I('realistic', 'quality', L('人物真人感', 'Photoreal people'), L('去掉 AI 感，皮肤和光线更真实', 'Natural skin and light'), 'image-realistic', [slot.photo('source', '原图', 'Source image')]),
  I('retouch', 'quality', L('图片精修', 'Retouch'), L('修瑕疵、调光影、提清晰度', 'Fix flaws, light and sharpness'), 'image-retouch', [slot.photo('source', '原图', 'Source image')], [chip('修哪里', 'What to fix')]),
];

/**
 * Single-shot video for the AI 导演台's quick-gen panel: frame reference + prompt → one segment.
 * Not listed in the AI 视频 scene library, where scenes produce complete videos.
 */
export const SHOT_VIDEO: Scene = V('shot', 'free', L('单镜头视频', 'Single shot'), L('按分镜图和提示词生成一个片段', 'One segment from a frame and a prompt'), 'case-luna-07',
  [slot.photo('frame', '首帧参考', 'First frame', true, 2), slot.character()], [chip('景别', 'Shot size'), chip('运镜', 'Camera move'), chip('人物动作', 'Action')],
  L('写清这一镜的画面、动作和运镜，例如：近景，她回头看向门口，镜头缓慢推近', 'Describe the frame, action and camera, e.g. close-up, she turns to the door, slow push-in'),
  DRAMA_GUIDE, [L('起幅', 'Open'), L('动作', 'Action'), L('落幅', 'Settle')]);

export const scenesOf = (kind: GenKind) => (kind === 'video' ? VIDEO_SCENES : IMAGE_SCENES);
export const groupsOf = (kind: GenKind) => (kind === 'video' ? VIDEO_GROUPS : IMAGE_GROUPS);
export const findScene = (kind: GenKind, id: string) => (kind === 'video' && id === SHOT_VIDEO.id ? SHOT_VIDEO : scenesOf(kind).find(s => s.id === id));

/* ───────────────────────── 按首页方案推荐 ───────────────────────── */

type Focus = 'commerce' | 'brand' | 'drama' | 'artist' | 'knowledge' | 'local';
const FOCUS: Record<SolutionId, Focus> = {
  ecosystem: 'artist', 'ai-artist': 'artist', 'virtual-idol': 'artist', 'social-ip': 'artist',
  'ai-drama': 'drama', 'anime-ip': 'drama',
  'story-commerce': 'commerce',
  'brand-ip': 'brand', 'corporate-ip': 'brand',
  'digital-founder': 'knowledge', 'education-ip': 'knowledge',
  'city-ip': 'local', 'culture-ip': 'local',
};
const PICKS: Record<Focus, { video: string[]; image: string[] }> = {
  commerce: { video: ['talk_sell', 'placement', 'promo', 'pain'], image: ['product_use', 'selling_point', 'white_bg'] },
  brand: { video: ['claim', 'brand_story', 'concept', 'lifestyle'], image: ['ip_sheet', 'product_scene', 'ip_photo'] },
  drama: { video: ['twist', 'dialog', 'mystery', 'emotion'], image: ['ip_sheet', 'body4', 'person_scene'] },
  artist: { video: ['ip_daily', 'dh_talk', 'remix', 'emotion'], image: ['ip_photo', 'ip_sticker', 'ip_sheet'] },
  knowledge: { video: ['dh_talk', 'remix', 'ip_daily'], image: ['ip_photo', 'realistic', 'ip_sheet'] },
  local: { video: ['store_find', 'signature', 'groupbuy', 'lifestyle'], image: ['person_scene', 'product_scene', 'ip_photo'] },
};

export const recommendedScenes = (solution: SolutionId, kind: GenKind): Scene[] =>
  PICKS[FOCUS[solution] ?? 'artist'][kind].map(id => findScene(kind, id)).filter((s): s is Scene => !!s);

/** Video opens on the top pick for the solution; images open on 自由出图 like a blank canvas. */
export const defaultScene = (solution: SolutionId, kind: GenKind): Scene =>
  kind === 'video' ? recommendedScenes(solution, 'video')[0] ?? VIDEO_SCENES[0] : FREE_IMAGE;

/* ───────────────────────── 参数与消耗 ───────────────────────── */

export const VIDEO_MODELS = [
  { id: 'v3', name: L('星绘视频 V3', 'Star Video V3'), note: L('画质优先', 'Best quality') },
  { id: 'v3-turbo', name: L('星绘视频 V3 极速', 'Star Video V3 Turbo'), note: L('速度优先 · 消耗减半', 'Faster · half cost') },
];
export const IMAGE_MODELS = [
  { id: 'i25', name: L('星绘图像 2.5', 'Star Image 2.5'), note: L('通用', 'General') },
  { id: 'i25-real', name: L('星绘图像 2.5 写实', 'Star Image 2.5 Real'), note: L('人像与商品更真实', 'Photoreal people & products') },
];

export interface VideoParams { model: string; lang: 'zh' | 'en'; duration: number; ratio: string; res: '768P' | '1080P' }
export interface ImageParams { model: string; ratio: string; quality: '1K' | '2K'; count: number }

export const VIDEO_OPTIONS = { durations: [5, 10, 15, 30], ratios: ['9:16', '16:9', '1:1', '3:4'], res: ['768P', '1080P'] as const };
export const IMAGE_OPTIONS = { ratios: ['3:4', '1:1', '4:3', '9:16', '16:9'], quality: ['1K', '2K'] as const, counts: [1, 2, 3, 4] };

export const DEFAULT_VIDEO: VideoParams = { model: 'v3', lang: 'zh', duration: 15, ratio: '9:16', res: '768P' };
export const DEFAULT_IMAGE: ImageParams = { model: 'i25', ratio: '3:4', quality: '1K', count: 1 };

export const videoCost = (p: VideoParams) => Math.round(p.duration * (p.res === '1080P' ? 46 : 31) * (p.model === 'v3-turbo' ? 0.5 : 1));
export const imageCost = (p: ImageParams) => p.count * (p.quality === '2K' ? 60 : 37);

/* ───────────────────────── AI 编导 ───────────────────────── */

/** Shot direction per beat, by scene group. `{who}` is the on-camera IP. */
const SHOTS: Record<string, LT[]> = {
  commerce: [L('{who}拿起商品正对镜头', '{who} holds the product up to camera'), L('商品特写 + 真实使用过程', 'Product close-up and real use'), L('{who}讲解卖点，字幕标出重点', '{who} explains, captions highlight'), L('购买入口与价格出现在画面下方', 'Price and buy button on screen')],
  local: [L('门头与店内环境快速掠过', 'Quick sweep of storefront and interior'), L('招牌产品特写，带热气或细节', 'Signature item close-up'), L('{who}体验后的真实反应', "{who}'s honest reaction"), L('地址与团购信息字幕', 'Address and deal captions')],
  brand: [L('情绪化空镜开场', 'Atmospheric opening'), L('{who}在生活场景中自然出现', '{who} appears in everyday life'), L('品牌元素与产品轻柔露出', 'Brand and product appear softly'), L('主张文案 + 品牌标识收尾', 'Claim and logo')],
  drama: [L('近景，{who}与对手冲突爆发', 'Close: {who} clashes with a rival'), L('双人对切，关系逐步揭开', 'Shot/reverse, relationship unfolds'), L('特写，情绪推到顶点', 'Close-up at the emotional peak'), L('反转画面 + 悬念字幕', 'The twist with a cliffhanger caption')],
  ip: [L('{who}正对镜头开口', '{who} opens to camera'), L('{who}边说边配合手势和素材画面', '{who} talks over b-roll'), L('穿插 {who} 的标志性小动作', "{who}'s signature gesture"), L('{who}看向镜头邀请互动', '{who} invites comments')],
};

/** What each beat says when the user gave no material for it, by scene group. */
const SAY: Record<string, LT[]> = {
  commerce: [L('一句话说清它解决什么问题', 'Say what it solves in one line'), L('边讲边展示细节和使用过程', 'Show details while using it'), L('讲透 1–2 个最打动人的卖点', 'Land one or two key benefits'), L('告诉观众在哪买、怎么买', 'Tell viewers where and how to buy')],
  local: [L('先亮出门店最有特色的一面', 'Lead with what makes the place special'), L('招牌产品给足特写', 'Give the signature item a close-up'), L('说出真实的体验感受', 'Share an honest reaction'), L('给一个现在就去的理由', 'Give a reason to go now')],
  brand: [L('用一个情绪画面开场', 'Open on a feeling'), L('讲一个具体的人和场景', 'Tell one person, one moment'), L('让品牌自然出现', 'Let the brand appear naturally'), L('一句主张收尾', 'Close on the claim')],
  drama: [L('一句台词抛出冲突', 'Open on a line of conflict'), L('交代人物关系并推进', 'Reveal and push the relationship'), L('把情绪推到顶点', 'Push the emotion to its peak'), L('反转揭晓，留下钩子', 'Reveal the twist and leave a hook')],
  ip: [L('开门见山抛出话题', 'Open with the topic'), L('展开讲清一个观点', 'Make one point clearly'), L('加入 IP 的口头禅或小动作', 'Add a catchphrase or habit'), L('邀请观众评论互动', 'Ask viewers to comment')],
};
const unlabel = (l: string) => l.replace(/^[^：:]{1,8}[：:]\s*/, '');

/** Pull the user's material out of free notes or a previous AI draft (so rewrites do not nest). */
const materialOf = (notes: string) => notes.split('\n').map(l => l.trim()).filter(Boolean).flatMap(l => {
  if (/^(素材要点|Notes)[:：]/.test(l)) return l.replace(/^(素材要点|Notes)[:：]\s*/, '').split(/[；;]/);
  if (/^[【[]/.test(l) || /^\d+\./.test(l) || /^\s*(画面|Shot)[:：]/.test(l)) return [];
  return [l];
}).map(l => l.trim()).filter(l => l && !/[:：]$/.test(l));

/**
 * Turns the user's notes into a scene-shaped script: each note fills one beat in order,
 * remaining beats fall back to the scene's writing tips, so nothing is invented about the product.
 */
export const writeScript = (scene: Scene, notes: string, ipName: string, durationSec: number, zh: boolean): string => {
  const beats = scene.beats ?? [];
  const material = materialOf(notes);
  const seg = Math.max(2, Math.round(durationSec / Math.max(1, beats.length)));
  const who = ipName || (zh ? '出镜角色' : 'the presenter');
  const shots = SHOTS[scene.group] ?? SHOTS.ip;
  const head = zh
    ? `【${scene.name.zh}】${durationSec} 秒 · 出镜：${who}${material.length ? `\n素材要点：${material.join('；')}` : ''}`
    : `[${scene.name.en}] ${durationSec}s · On camera: ${who}${material.length ? `\nNotes: ${material.join('; ')}` : ''}`;
  const body = beats.map((b, i) => {
    const from = i * seg, to = i === beats.length - 1 ? durationSec : Math.min(durationSec, (i + 1) * seg);
    const fallback = (SAY[scene.group] ?? SAY.ip)[i % 4];
    const say = material[i] ? unlabel(material[i]) : zh ? fallback.zh : fallback.en;
    const shot = (zh ? shots[i % shots.length].zh : shots[i % shots.length].en).replace(/\{who\}/g, who);
    return zh
      ? `${i + 1}. ${b.zh}（${from}–${to} 秒）：${say}\n   画面：${shot}`
      : `${i + 1}. ${b.en} (${from}–${to}s): ${say}\n   Shot: ${shot}`;
  }).join('\n');
  return `${head}\n${body}`;
};

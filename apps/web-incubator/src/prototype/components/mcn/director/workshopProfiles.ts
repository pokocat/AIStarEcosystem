/**
 * Per-solution configuration for 制作工坊 / AI 导演台. Each homepage (solution) gets its own
 * templates, deliverables, source material, cast wording, shot library and AI prompts.
 * 'ecosystem' and 'ai-artist' follow the active artist type instead.
 */
import type { SolutionId } from '../../../data/ipPlatform';
import { ARTIST_TYPE_CONFIG, type ArtistType } from '../ArtistTypes';
import type { CameraMove, LT, ProjectMode, ShotSize } from './directorData';

export type SourceKind = 'script' | 'product' | 'knowledge';
export type ToolTab = 'clip' | 'digital_person' | 'batch_mix';

export interface ShotIdea { title: LT; prompt: LT; size: ShotSize; camera: CameraMove; duration: number }
export interface TemplateDef { name: LT; mode: ProjectMode; formats?: LT[] }

export interface WorkshopProfile {
  director: LT;
  focus: LT;
  cast: LT;
  templates: TemplateDef[];
  formats: LT[];
  source: { kind: SourceKind; title: LT; prompt: LT };
  shots: ShotIdea[];
  defaultName: LT;
  defaultBrief: LT;
  quickPrompts: LT[];
  advice: LT;
  tools: ToolTab[];
}

const L = (zh: string, en: string): LT => ({ zh, en });
const S = (tz: string, te: string, pz: string, pe: string, size: ShotSize, camera: CameraMove, duration: number): ShotIdea => ({ title: L(tz, te), prompt: L(pz, pe), size, camera, duration });
const T = (zh: string, en: string, mode: ProjectMode = 'video'): TemplateDef => ({ name: L(zh, en), mode });

export const MUSIC_FORMATS: LT[] = [L('单曲(MP3/FLAC)', 'Single (MP3/FLAC)'), L('MV视频', 'Music Video'), L('歌词海报', 'Lyric Poster'), L('音频可视化', 'Audio Visualizer')];

const DRAMA_SHOTS: ShotIdea[] = [
  S('霓虹街口', 'Neon crossing', '雨后的霓虹街口，{A} 背对镜头站在人群中', 'Neon crossing after rain, {A} stands in the crowd, back to camera', 'wide', 'push', 4),
  S('回眸', 'Look back', '{A} 缓缓回头，眼神里有犹豫，背景虚化', '{A} slowly turns, hesitant eyes, blurred background', 'close', 'static', 3),
  S('手机亮起', 'Phone lights up', '手机屏幕亮起一条未读消息，手指停在屏幕上方', 'A phone lights up with an unread message, a finger hovers above it', 'extreme', 'static', 2),
  S('奔跑', 'Running', '{A} 穿过人群奔跑，霓虹灯拉成光带', '{A} runs through the crowd, neon lights streak into bands', 'full', 'follow', 5),
  S('天台相遇', 'Rooftop meeting', '城市天台，两人隔着雨幕对视，远处是巨型广告屏', 'City rooftop, two people face each other through rain, giant billboards beyond', 'medium', 'pan', 4),
  S('定格', 'Freeze frame', '画面定格在 {A} 的微笑，片名浮现', 'Freeze on {A} smiling as the title appears', 'close', 'pull', 3),
];

export const MV_SHOTS: ShotIdea[] = [
  S('主歌 · 录音棚', 'Verse · studio', '{A} 在霓虹录音棚里戴着耳机低声吟唱', '{A} sings softly in a neon-lit recording booth', 'medium', 'push', 6),
  S('副歌 · 天台', 'Chorus · rooftop', '城市天台，{A} 在雨中放声高唱，镜头环绕', 'On a city rooftop {A} belts the chorus in the rain, camera orbiting', 'full', 'pan', 8),
  S('桥段 · 回忆', 'Bridge · memory', '胶片质感的回忆片段，{A} 独自走过空荡的街', 'Film-grain memory, {A} walks an empty street alone', 'wide', 'follow', 6),
  S('尾奏 · 定格', 'Outro · freeze', '{A} 转身望向镜头，画面定格，歌名浮现', '{A} turns to camera, freeze frame, song title appears', 'close', 'pull', 5),
];

const VIDEO_PROMPTS = [L('再加 2 个镜头，节奏更紧张', 'Add 2 more shots, make it tenser'), L('把选中镜头改成雨夜特写', 'Make the selected shot a rainy close-up'), L('配一段更燃的音乐', 'Add more energetic music'), L('一键生成全部镜头', 'Generate all shots')];
const MUSIC_PROMPTS = [L('帮我重写一版副歌歌词', 'Rewrite the chorus lyrics'), L('编曲换成摇滚，BPM 140', 'Switch the arrangement to rock, 140 BPM'), L('用艺人声线演唱', "Sing it in the artist's voice"), L('加 2 个 MV 镜头', 'Add 2 MV shots')];
const MUSIC_ADVICE = L('作为制作人我建议：1. 副歌提前到 0:45，抓住前 15 秒；2. 桥段换成钢琴独奏留白；3. 出一个 15 秒的副歌切片用于短视频。', 'As producer: 1) bring the chorus forward to 0:45; 2) make the bridge a sparse piano solo; 3) cut a 15-second chorus clip for short video.');
const DRAMA_ADVICE = L('从导演角度，我建议三步：1. 开场加一个远景交代环境；2. 把高潮镜头换成跟拍；3. 结尾留 1 秒定格给片名。可以说“加 2 个镜头”。', 'As director I suggest: 1) open with a wide establishing shot; 2) make the climax a follow shot; 3) hold a 1-second freeze for the title. Say "add 2 shots".');

const PROFILES: Partial<Record<SolutionId, WorkshopProfile>> = {
  'ai-drama': {
    director: L('AI 导演', 'AI Director'), focus: L('短剧制片', 'Drama production'), cast: L('数字演员', 'Digital actor'),
    templates: [T('竖屏短剧', 'Vertical drama'), T('连续剧集', 'Episodic series'), T('反转短剧', 'Twist drama'), T('品牌定制剧', 'Branded drama'), T('剧集主题曲', 'Series theme song', 'music')],
    formats: [L('竖屏成片 9:16', 'Vertical cut 9:16'), L('分集剧本 PDF', 'Episode script PDF'), L('角色海报', 'Character poster'), L('预告片', 'Trailer')],
    source: { kind: 'script', title: L('第 1 集 · 霓虹失约', 'Ep. 1 · Missed in Neon'), prompt: L('雨夜，{A} 在演出前收到一条神秘消息，必须在开场前找到发信人。', 'On a rainy night {A} receives a mysterious message and must find the sender before curtain-up.') },
    shots: DRAMA_SHOTS, defaultName: L('霓虹失约', 'Missed in Neon'), defaultBrief: L('一部 3 分钟的竖屏悬疑短剧，结尾留钩子引导追更。', 'A 3-minute vertical mystery with a cliffhanger ending.'),
    quickPrompts: VIDEO_PROMPTS, advice: DRAMA_ADVICE, tools: ['clip', 'batch_mix', 'digital_person'],
  },
  'story-commerce': {
    director: L('AI 带货编导', 'AI Commerce Director'), focus: L('剧情带货', 'Story commerce'), cast: L('数字演员', 'Digital actor'),
    templates: [T('种草剧情', 'Seeding story'), T('测评反转', 'Review twist'), T('开箱情景剧', 'Unboxing skit'), T('直播切片带货', 'Live clip commerce'), T('A/B 剧情版本', 'A/B story variants')],
    formats: [L('带货短视频 9:16', 'Commerce video 9:16'), L('商品卡片', 'Product card'), L('直播切片', 'Live clips'), L('A/B 版本', 'A/B variants')],
    source: { kind: 'product', title: L('POMO 便携榨汁杯', 'POMO portable blender'), prompt: L('卖点：30 秒出汁\n卖点：USB-C 快充\n卖点：一键自清洁\n人群：通勤白领 · 健身人群', 'Selling point: juice in 30s\nSelling point: USB-C fast charge\nSelling point: one-tap self-clean\nAudience: commuters · gym-goers') },
    shots: [
      S('痛点开场', 'Pain point', '清晨赶地铁，{A} 看着空空的早餐叹气', 'Rushing for the subway, {A} sighs at an empty breakfast', 'medium', 'follow', 3),
      S('产品出场', 'Product enters', '同事递来 {P}，{A} 半信半疑地按下按钮', 'A colleague hands over the {P}; {A} presses the button, unconvinced', 'close', 'push', 4),
      S('前后对比', 'Before / after', '分屏对比：手动榨汁 5 分钟 vs {P} 30 秒', 'Split screen: 5 minutes by hand vs 30 seconds with the {P}', 'full', 'static', 4),
      S('反转下单', 'Twist & CTA', '{A} 笑着对镜头说“链接在下面”，商品卡弹出', '{A} smiles at camera, "link below", product card pops up', 'close', 'pull', 3),
    ],
    defaultName: L('通勤早餐 30 秒', '30-Second Commute Breakfast'), defaultBrief: L('用一个通勤小剧情种草便携榨汁杯，前 3 秒抛出痛点，结尾引导下单。', 'A commute mini-story that seeds the blender: pain point in 3 seconds, CTA at the end.'),
    quickPrompts: [L('加一个商品特写镜头', 'Add a product close-up'), L('生成 A/B 两个开场版本', 'Make A/B opening variants'), L('配一段轻快的音乐', 'Add upbeat music'), L('一键生成全部镜头', 'Generate all shots')],
    advice: L('从转化角度，我建议：1. 前 3 秒直接抛痛点；2. 商品出现不晚于第 8 秒；3. 结尾给出明确的下单理由。可以说“加一个商品特写镜头”。', 'For conversion: 1) hit the pain point in 3 seconds; 2) show the product by second 8; 3) end with a clear reason to buy. Try "add a product close-up".'),
    tools: ['batch_mix', 'clip', 'digital_person'],
  },
  'virtual-idol': {
    director: L('AI 制作人', 'AI Producer'), focus: L('偶像内容', 'Idol content'), cast: L('虚拟偶像', 'Virtual idol'),
    templates: [T('出道单曲', 'Debut single', 'music'), T('粉丝应援曲', 'Fan anthem', 'music'), T('打歌舞台', 'Stage performance'), T('直播切片', 'Live clips'), T('偶像 Vlog', 'Idol vlog')],
    formats: [L('打歌舞台视频', 'Stage video'), L('直播切片', 'Live clips'), L('Vlog 视频', 'Vlog'), L('写真海报', 'Photo poster')],
    source: { kind: 'script', title: L('出道舞台企划', 'Debut stage plan'), prompt: L('{A} 的出道舞台：开场剪影，副歌全员舞蹈，结尾与粉丝互动。', "{A}'s debut stage: silhouette opening, full dance chorus, fan interaction at the end.") },
    shots: [
      S('剪影开场', 'Silhouette', '舞台灯光亮起，{A} 的剪影出现在烟雾中', 'Stage lights rise, {A} appears as a silhouette in the haze', 'wide', 'push', 4),
      S('副歌舞蹈', 'Chorus dance', '{A} 在副歌跳出招牌动作，镜头环绕', '{A} hits the signature move on the chorus, camera orbiting', 'full', 'pan', 6),
      S('应援互动', 'Fan moment', '{A} 对着应援灯海比心', '{A} makes a heart to a sea of light sticks', 'medium', 'static', 3),
      S('谢幕', 'Curtain call', '{A} 鞠躬谢幕，屏幕打出出道日期', '{A} bows, the debut date appears on screen', 'close', 'pull', 3),
    ],
    defaultName: L('星轨', 'Star Orbit'), defaultBrief: L('一首元气电子流行出道曲，副歌有记忆点动作，适合粉丝翻跳。', 'An upbeat electro-pop debut song with a catchy chorus move for fan covers.'),
    quickPrompts: [L('帮我重写一版副歌歌词', 'Rewrite the chorus lyrics'), L('编曲换成电子，BPM 128', 'Switch to electronic, 128 BPM'), L('用偶像声线演唱', "Sing it in the idol's voice"), L('加 2 个 MV 镜头', 'Add 2 MV shots')],
    advice: L('作为制作人我建议：1. 副歌加一个粉丝能学的手势舞；2. 出一个 15 秒的副歌切片；3. 直播时演唱并引导应援。', 'As producer: 1) add a hand move fans can learn; 2) cut a 15-second chorus clip; 3) perform it live and cue fan chants.'),
    tools: ['clip', 'batch_mix', 'digital_person'],
  },
  'corporate-ip': {
    director: L('AI 品牌编导', 'AI Brand Director'), focus: L('企业传播', 'Corporate comms'), cast: L('数字代言人', 'Digital ambassador'),
    templates: [T('新品发布会视频', 'Product launch video'), T('招聘宣传片', 'Recruiting film'), T('员工培训课件', 'Staff training'), T('年报视频', 'Annual report video'), T('多语言出海版', 'Global multilingual cut')],
    formats: [L('横屏视频 16:9', 'Landscape 16:9'), L('竖屏短视频', 'Vertical short'), L('多语言字幕', 'Multilingual subtitles'), L('演示文稿', 'Slide deck')],
    source: { kind: 'knowledge', title: L('企业知识库', 'Company knowledge base'), prompt: L('产品：星云智能平台\n口径：安全 · 可信 · 高效\n禁用词：最、第一、唯一\n审核：发布前法务确认', 'Product: Nebula AI Platform\nVoice: secure · trusted · efficient\nBanned: best, No.1, only\nReview: legal sign-off before release') },
    shots: [
      S('代言人开场', 'Ambassador intro', '{A} 在品牌展厅向镜头问好，介绍发布主题', '{A} greets the camera in the brand hall and introduces the launch', 'medium', 'push', 5),
      S('功能演示', 'Feature demo', '屏幕录制与 {A} 讲解穿插，展示三大核心功能', 'Screen capture intercut with {A} explaining three core features', 'full', 'static', 8),
      S('客户案例', 'Customer story', '客户团队在办公室使用平台，数据看板上涨', 'A customer team uses the platform; the dashboard climbs', 'wide', 'pan', 6),
      S('口号收尾', 'Tagline', '{A} 说出品牌口号，Logo 定格', '{A} delivers the tagline, logo freeze', 'close', 'pull', 3),
    ],
    defaultName: L('星云平台 2.0 发布', 'Nebula 2.0 Launch'), defaultBrief: L('2 分钟发布会视频，数字代言人讲解三大新功能，口径符合品牌规范。', 'A 2-minute launch video: the ambassador presents three new features on-brand.'),
    quickPrompts: [L('加一段客户案例镜头', 'Add a customer story shot'), L('输出英文和日文版本', 'Output English and Japanese versions'), L('配一段沉稳的配乐', 'Add a confident score'), L('一键生成全部镜头', 'Generate all shots')],
    advice: L('从品牌传播角度建议：1. 开场 5 秒内说清发布主题；2. 每个功能配一个真实客户场景；3. 台词避开知识库里的禁用词。可以说“输出英文和日文版本”。', 'For brand comms: 1) state the launch theme within 5 seconds; 2) pair each feature with a real customer scene; 3) avoid banned words from the knowledge base. Try "output English and Japanese versions".'),
    tools: ['digital_person', 'clip', 'batch_mix'],
  },
  'brand-ip': {
    director: L('AI 品牌编导', 'AI Brand Director'), focus: L('品牌角色内容', 'Brand character content'), cast: L('品牌角色', 'Brand character'),
    templates: [T('品牌角色短片', 'Character short'), T('新品种草', 'Product seeding'), T('节日营销', 'Holiday campaign'), T('联名企划', 'Collab concept'), T('表情包', 'Sticker pack')],
    formats: [L('竖屏短视频', 'Vertical short'), L('角色海报', 'Character poster'), L('表情包 GIF', 'Sticker GIF'), L('联名提案', 'Collab deck')],
    source: { kind: 'product', title: L('气泡椰椰新品', 'Bubble Coco new flavor'), prompt: L('卖点：0 糖 0 卡\n卖点：真椰汁含量 30%\n角色性格：元气、爱冒险\n口号：一口回到夏天', 'Selling point: zero sugar\nSelling point: 30% real coconut\nPersona: cheerful, adventurous\nTagline: one sip back to summer') },
    shots: [
      S('角色登场', 'Character entrance', '{A} 从冰柜里跳出来，抖落冰碴', '{A} jumps out of the fridge, shaking off ice', 'full', 'push', 3),
      S('产品互动', 'Product play', '{A} 抱着 {P} 冲浪，气泡变成海浪', '{A} surfs on the {P}; bubbles turn into waves', 'medium', 'follow', 5),
      S('夏日场景', 'Summer scene', '海边夕阳，朋友们举杯，{A} 在中间', 'Beach sunset, friends raise drinks with {A} in the middle', 'wide', 'pan', 4),
      S('口号定格', 'Tagline freeze', '{A} 对镜头眨眼，口号与 Logo 出现', '{A} winks, tagline and logo appear', 'close', 'pull', 3),
    ],
    defaultName: L('一口回到夏天', 'One Sip Back to Summer'), defaultBrief: L('品牌角色带新品出场的 30 秒竖屏短片，风格轻快，可拆出表情包。', 'A 30-second vertical short of the mascot launching the new flavor, light and fun, with sticker cut-downs.'),
    quickPrompts: [L('加一个商品特写镜头', 'Add a product close-up'), L('风格改成更可爱的日系动漫', 'Make it cuter, anime style'), L('配一段轻快的音乐', 'Add upbeat music'), L('一键生成全部镜头', 'Generate all shots')],
    advice: L('从品牌角度建议：1. 角色动作要贴合性格设定；2. 产品露出 2 次以上；3. 从成片里截 4 个表情包。', 'For the brand: 1) keep the character in persona; 2) show the product at least twice; 3) cut four stickers from the final.'),
    tools: ['batch_mix', 'digital_person', 'clip'],
  },
  'city-ip': {
    director: L('AI 文旅编导', 'AI Tourism Director'), focus: L('城市文旅', 'City tourism'), cast: L('城市代言人', 'City ambassador'),
    templates: [T('城市宣传片', 'City promo'), T('文旅攻略', 'Travel guide'), T('节庆活动', 'Festival event'), T('方言导览', 'Dialect tour'), T('城市主题曲', 'City anthem', 'music')],
    formats: [L('横屏宣传片 16:9', 'Landscape promo 16:9'), L('竖屏短视频', 'Vertical short'), L('攻略图文', 'Guide article'), L('多语言字幕', 'Multilingual subtitles')],
    source: { kind: 'knowledge', title: L('城市资料库', 'City knowledge base'), prompt: L('地标：古城墙 · 江边夜市 · 博物馆\n美食：米粉 · 糖油粑粑\n节庆：灯会（2 月）\n客群：周末自驾 · 年轻打卡', 'Landmarks: old city wall · riverside night market · museum\nFood: rice noodles · sweet fritters\nFestival: lantern fair (Feb)\nVisitors: weekend drivers · young explorers') },
    shots: [
      S('航拍全景', 'Aerial', '清晨航拍古城墙与江面，云雾散开', 'Morning aerial of the old wall and river as mist clears', 'wide', 'push', 5),
      S('街巷烟火', 'Street life', '{A} 走进老街，品尝刚出锅的米粉', '{A} walks an old street and tastes fresh rice noodles', 'medium', 'follow', 5),
      S('地标夜景', 'Night landmark', '江边夜市灯火通明，人潮涌动', 'The riverside night market glows with crowds', 'full', 'pan', 4),
      S('代言人邀请', 'Invitation', '{A} 对镜头说“这个周末，来我的城市”', '{A} to camera: "This weekend, come to my city"', 'close', 'static', 3),
    ],
    defaultName: L('来我的城市过周末', 'A Weekend in My City'), defaultBrief: L('60 秒城市宣传片，城市代言人带看地标与美食，适合投放周末自驾人群。', 'A 60-second city promo: the ambassador tours landmarks and food for weekend drivers.'),
    quickPrompts: [L('加一个美食特写镜头', 'Add a food close-up'), L('输出英文和日文版本', 'Output English and Japanese versions'), L('配一段带地方特色的音乐', 'Add music with local flavor'), L('一键生成全部镜头', 'Generate all shots')],
    advice: L('从文旅传播建议：1. 前 3 秒用最具辨识度的地标；2. 每个场景给出“怎么去、花多少”；3. 结尾挂上节庆时间。', 'For tourism: 1) lead with the most recognizable landmark; 2) give "how to get there, what it costs" per scene; 3) end with the festival date.'),
    tools: ['digital_person', 'clip', 'batch_mix'],
  },
  'digital-founder': {
    director: L('AI 内容编导', 'AI Content Director'), focus: L('创始人内容', 'Founder content'), cast: L('数字分身', 'Digital twin'),
    templates: [T('观点口播', 'Opinion talk'), T('行业演讲', 'Keynote'), T('访谈切片', 'Interview clips'), T('直播答疑', 'Live Q&A'), T('品牌故事', 'Founder story')],
    formats: [L('竖屏口播', 'Vertical talk'), L('横屏演讲视频', 'Landscape keynote'), L('金句卡片', 'Quote cards'), L('文字稿', 'Transcript')],
    source: { kind: 'knowledge', title: L('观点知识库', 'Viewpoint library'), prompt: L('核心观点：AI 不替代人，替代低效流程\n案例：客服团队效率提升 3 倍\n语气：直接、克制、有数据', 'Core view: AI replaces slow processes, not people\nCase: support team 3x more efficient\nTone: direct, measured, data-backed') },
    shots: [
      S('金句开场', 'Hook quote', '{A} 直视镜头说出核心观点，字幕放大', '{A} looks into the lens and states the core view, big caption', 'close', 'static', 4),
      S('观点展开', 'Argument', '{A} 在办公室白板前拆解三个理由', '{A} breaks down three reasons at a whiteboard', 'medium', 'push', 8),
      S('案例佐证', 'Proof', '数据图表动画：客服响应时间下降 70%', 'Animated chart: support response time down 70%', 'full', 'static', 5),
      S('行动号召', 'Call to action', '{A} 邀请观众评论自己的经验', '{A} invites viewers to share their experience', 'close', 'pull', 3),
    ],
    defaultName: L('AI 替代的是流程', 'AI Replaces Processes'), defaultBrief: L('一条 90 秒观点口播，金句开场，用一个真实案例支撑观点。', 'A 90-second opinion talk with a hook quote and one real case.'),
    quickPrompts: [L('开场换一句更狠的金句', 'Sharpen the opening line'), L('加一个数据案例镜头', 'Add a data case shot'), L('拆出 3 张金句卡片', 'Make 3 quote cards'), L('一键生成全部镜头', 'Generate all shots')],
    advice: L('从个人品牌角度建议：1. 第一句话就给结论；2. 每个观点配一个数字；3. 结尾抛一个问题引导评论。', 'For your personal brand: 1) lead with the conclusion; 2) back each point with a number; 3) end with a question for comments.'),
    tools: ['digital_person', 'clip', 'batch_mix'],
  },
  'culture-ip': {
    director: L('AI 文化编导', 'AI Culture Director'), focus: L('文化内容', 'Culture content'), cast: L('文化角色', 'Cultural character'),
    templates: [T('历史人物讲述', 'Historical storyteller'), T('文物活化', 'Artifact revival'), T('非遗短片', 'Intangible heritage short'), T('文创海报', 'Cultural poster'), T('国风主题曲', 'C-style theme song', 'music')],
    formats: [L('竖屏短视频', 'Vertical short'), L('横屏纪录片', 'Landscape documentary'), L('文创海报', 'Cultural poster'), L('讲解音频', 'Audio guide')],
    source: { kind: 'knowledge', title: L('馆藏资料', 'Collection notes'), prompt: L('文物：唐代鎏金舞马衔杯纹银壶\n年代：公元 8 世纪\n故事：舞马为皇帝祝寿\n需审核：史实与文物描述', 'Artifact: Tang gilded silver flask with dancing horse\nDate: 8th century AD\nStory: horses danced for the emperor\nReview: facts and descriptions') },
    shots: [
      S('古卷展开', 'Scroll unfolds', '一卷古画缓缓展开，墨色晕染成场景', 'An ancient scroll unrolls, ink blooming into a scene', 'wide', 'push', 4),
      S('人物登场', 'Character enters', '{A} 身着唐装从画中走出', '{A} in Tang dress steps out of the painting', 'full', 'follow', 5),
      S('文物特写', 'Artifact close-up', '银壶上的舞马纹样在光中流转', 'The dancing-horse pattern on the flask shimmers in light', 'extreme', 'pan', 4),
      S('古今对照', 'Then & now', '分屏：千年前的宫宴与今天的博物馆展厅', 'Split screen: an ancient banquet and today\'s gallery', 'medium', 'static', 4),
    ],
    defaultName: L('会跳舞的马', 'The Dancing Horse'), defaultBrief: L('2 分钟文物活化短片，文化角色讲述银壶背后的故事，史实需审核。', 'A 2-minute artifact revival short told by the cultural character; facts need review.'),
    quickPrompts: [L('加一个文物特写镜头', 'Add an artifact close-up'), L('风格改成电影质感', 'Make it cinematic'), L('配一段国风音乐', 'Add C-style music'), L('一键生成全部镜头', 'Generate all shots')],
    advice: L('从文化传播建议：1. 用一个“为什么”开场；2. 文物细节用特写停留 2 秒以上；3. 史实部分标注来源并送审。', 'For culture: 1) open with a "why"; 2) hold artifact close-ups for 2+ seconds; 3) cite sources and send facts for review.'),
    tools: ['digital_person', 'clip', 'batch_mix'],
  },
  'education-ip': {
    director: L('AI 课程编导', 'AI Course Director'), focus: L('课程内容', 'Course content'), cast: L('AI 导师', 'AI tutor'),
    templates: [T('知识点讲解', 'Concept lesson'), T('题目精讲', 'Problem walkthrough'), T('知识卡片', 'Knowledge cards'), T('直播课切片', 'Live class clips'), T('课程预告', 'Course trailer')],
    formats: [L('横屏课程视频', 'Landscape lesson'), L('竖屏知识短视频', 'Vertical micro-lesson'), L('知识卡片', 'Knowledge cards'), L('课件 PPT', 'Slides')],
    source: { kind: 'knowledge', title: L('课程大纲', 'Course outline'), prompt: L('课程：初中物理 · 浮力\n知识点：阿基米德原理\n难点：浮沉条件判断\n学生：初二', 'Course: middle-school physics · buoyancy\nConcept: Archimedes\' principle\nHard part: sink-or-float conditions\nStudents: grade 8') },
    shots: [
      S('问题引入', 'Hook question', '{A} 拿起铁块和木块：“为什么一个沉一个浮？”', '{A} holds iron and wood: "Why does one sink and one float?"', 'medium', 'push', 5),
      S('概念讲解', 'Concept', '动画演示排开的水与浮力的关系', 'Animation of displaced water and buoyant force', 'full', 'static', 8),
      S('例题演示', 'Worked example', '{A} 在白板上一步步解一道浮力题', '{A} solves a buoyancy problem step by step on a whiteboard', 'medium', 'static', 8),
      S('总结回顾', 'Recap', '三条要点卡片依次弹出', 'Three key-point cards pop up in turn', 'close', 'pull', 4),
    ],
    defaultName: L('浮力 5 分钟讲透', 'Buoyancy in 5 Minutes'), defaultBrief: L('一节 5 分钟知识点微课，AI 导师用生活问题引入，配一道例题。', 'A 5-minute micro-lesson: the AI tutor opens with an everyday question and works one example.'),
    quickPrompts: [L('加一道例题讲解镜头', 'Add a worked-example shot'), L('拆成 3 张知识卡片', 'Split into 3 knowledge cards'), L('配一段轻松的背景音乐', 'Add light background music'), L('一键生成全部镜头', 'Generate all shots')],
    advice: L('从教学角度建议：1. 用生活现象引入；2. 每 90 秒设一个小问题；3. 结尾给出 3 条可复述的要点。', 'For teaching: 1) start from an everyday phenomenon; 2) add a mini question every 90 seconds; 3) end with three repeatable takeaways.'),
    tools: ['digital_person', 'clip', 'batch_mix'],
  },
  'anime-ip': {
    director: L('AI 动画导演', 'AI Animation Director'), focus: L('动漫内容', 'Anime content'), cast: L('动漫角色', 'Anime character'),
    templates: [T('动画短片', 'Animated short'), T('角色 PV', 'Character PV'), T('条漫分镜', 'Webtoon storyboard'), T('番外篇', 'Side story'), T('角色主题曲', 'Character song', 'music')],
    formats: [L('动画短片', 'Animated short'), L('条漫长图', 'Webtoon strip'), L('角色设定集', 'Character sheet'), L('PV 预告', 'PV trailer')],
    source: { kind: 'script', title: L('第 1 话 · 零界', 'Ch. 1 · Zero Realm'), prompt: L('{A} 在废墟城市醒来，发现自己能听见机器的心跳。', '{A} wakes in a ruined city and can hear the heartbeat of machines.') },
    shots: [
      S('世界观开场', 'World opening', '废墟城市上空漂浮着巨大齿轮', 'Giant gears float above a ruined city', 'wide', 'pan', 5),
      S('角色登场', 'Hero entrance', '{A} 从瓦砾中站起，瞳孔亮起蓝光', '{A} rises from rubble, eyes glowing blue', 'close', 'push', 4),
      S('战斗高潮', 'Battle climax', '{A} 与机械巨兽交锋，速度线拉满', '{A} clashes with a mech beast, full speed lines', 'full', 'follow', 6),
      S('悬念收尾', 'Cliffhanger', '神秘人影在高处注视，画面黑屏', 'A mysterious figure watches from above, cut to black', 'medium', 'static', 3),
    ],
    defaultName: L('零界', 'Zero Realm'), defaultBrief: L('一支 60 秒角色 PV，赛博废土世界观，结尾留悬念。', 'A 60-second character PV in a cyber wasteland, ending on a cliffhanger.'),
    quickPrompts: [L('再加 2 个战斗镜头', 'Add 2 battle shots'), L('风格改成日系动漫', 'Switch to anime style'), L('配一段更燃的音乐', 'Add more energetic music'), L('一键生成全部镜头', 'Generate all shots')],
    advice: L('从动画导演角度建议：1. 开场 3 秒交代世界观；2. 高潮用速度线与跟拍；3. 结尾一个人影制造悬念。', 'As animation director: 1) establish the world in 3 seconds; 2) use speed lines and follow shots at the climax; 3) end on a silhouette.'),
    tools: ['clip', 'batch_mix', 'digital_person'],
  },
  'social-ip': {
    director: L('AI 社区编导', 'AI Community Director'), focus: L('陪伴与社群', 'Companion & community'), cast: L('陪伴角色', 'Companion character'),
    templates: [T('陪伴对话短片', 'Companion short'), T('社群早安', 'Good-morning post'), T('话题互动', 'Topic prompt'), T('表情包', 'Sticker pack'), T('治愈歌单', 'Healing song', 'music')],
    formats: [L('竖屏短视频', 'Vertical short'), L('表情包 GIF', 'Sticker GIF'), L('话题海报', 'Topic poster'), L('语音消息', 'Voice message')],
    source: { kind: 'script', title: L('今日陪伴脚本', "Today's companion script"), prompt: L('{A} 早上问候群友，分享一个小目标，晚上回来听大家的故事。', '{A} greets the group in the morning, shares a small goal, and returns at night to hear their stories.') },
    shots: [
      S('早安问候', 'Good morning', '{A} 拉开窗帘对镜头说早安', '{A} opens the curtains and says good morning', 'medium', 'push', 3),
      S('日常陪伴', 'Day together', '{A} 和你一起在咖啡店写计划', '{A} plans the day with you in a café', 'full', 'static', 5),
      S('互动提问', 'Question', '{A} 举起卡片：“今天让你开心的一件小事？”', '{A} holds a card: "One small thing that made you happy today?"', 'close', 'static', 3),
      S('晚安收尾', 'Good night', '台灯下 {A} 轻声说晚安', 'Under a desk lamp {A} softly says good night', 'close', 'pull', 3),
    ],
    defaultName: L('今天也辛苦了', 'Thanks for Today'), defaultBrief: L('一条 30 秒陪伴短片，语气温柔，结尾抛出话题引导群友留言。', 'A gentle 30-second companion short that ends with a topic for members to reply to.'),
    quickPrompts: [L('加一个互动提问镜头', 'Add a question shot'), L('拆出 4 个表情包', 'Make 4 stickers'), L('配一段治愈的音乐', 'Add healing music'), L('一键生成全部镜头', 'Generate all shots')],
    advice: L('从社群运营建议：1. 每条内容只抛一个问题；2. 语气像朋友而不是客服；3. 把高赞回复做成下一期素材。', 'For community: 1) one question per post; 2) sound like a friend, not support; 3) turn top replies into the next episode.'),
    tools: ['batch_mix', 'digital_person', 'clip'],
  },
};

/** 'ecosystem' / 'ai-artist': templates and formats follow the artist type (音乐工坊, 影视工坊, …). */
const artistProfile = (type: ArtistType): WorkshopProfile => {
  const conf = ARTIST_TYPE_CONFIG[type];
  const templates = conf.templates.zh.map((zh, i) => {
    const name = L(zh, conf.templates.en[i] ?? zh);
    return { name, mode: (/单曲|EP|专辑|翻唱|对唱|OST|歌/.test(zh) ? 'music' : 'video') as ProjectMode };
  });
  const music = templates[0]?.mode === 'music';
  return {
    director: L('AI 导演', 'AI Director'), focus: conf.workshop, cast: L('艺人', 'Artist'),
    templates, formats: conf.contentFormats.zh.map((zh, i) => L(zh, conf.contentFormats.en[i] ?? zh)),
    source: { kind: 'script', title: L('第 1 集 · 霓虹失约', 'Ep. 1 · Missed in Neon'), prompt: L('雨夜，{A} 在演出前收到一条神秘消息，必须在开场前找到发信人。', 'On a rainy night {A} receives a mysterious message and must find the sender before curtain-up.') },
    shots: DRAMA_SHOTS,
    defaultName: music ? L('失约', 'Missed') : L('霓虹失约', 'Missed in Neon'),
    defaultBrief: music ? L('一首暗黑电子流行单曲，讲雨夜里错过又重逢的两个人。', 'A dark electro-pop single about two people who miss and find each other on a rainy night.') : L('一部 3 分钟的竖屏短剧，结尾留钩子。', 'A 3-minute vertical drama with a hook at the end.'),
    quickPrompts: music ? MUSIC_PROMPTS : VIDEO_PROMPTS, advice: music ? MUSIC_ADVICE : DRAMA_ADVICE, tools: ['clip', 'digital_person', 'batch_mix'],
  };
};

export const getWorkshopProfile = (solution: SolutionId, artistType: ArtistType): WorkshopProfile =>
  PROFILES[solution] ?? artistProfile(artistType);

/** Music templates in non-music solutions (e.g. 城市主题曲) fall back to standard music deliverables. */
export const formatsForTemplate = (profile: WorkshopProfile, template: TemplateDef): LT[] =>
  template.formats ?? (template.mode === 'music' && !profile.formats.some(f => /单曲/.test(f.zh)) ? MUSIC_FORMATS : profile.formats);


/** Quick prompts for the current project: the profile's own set when it matches the project type. */
export const promptsFor = (profile: WorkshopProfile, mode: ProjectMode): LT[] => {
  const profileMode = profile.templates[0]?.mode ?? 'video';
  if (mode === profileMode) return profile.quickPrompts;
  return mode === 'music' ? MUSIC_PROMPTS : VIDEO_PROMPTS;
};

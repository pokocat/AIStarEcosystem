import type { LocalizedText } from './ipPlatform';

export interface CatalogEntry {
  name: LocalizedText;
  description: LocalizedText;
}

const E = (zh: string, en: string, dzh: string, den: string): CatalogEntry => ({ name: { zh, en }, description: { zh: dzh, en: den } });

/** Content modes a solution can produce. Keys are referenced by SolutionConfig.preset.contentModes. */
export const CONTENT_MODES: Record<string, CatalogEntry> = {
  'short-drama': E('AI 短剧', 'AI Drama', '分集剧本、数字演员与成片', 'Episodes, digital cast and final cuts'),
  'story-commerce': E('剧情带货', 'Story Commerce', '商品自然融入剧情的带货短剧', 'Dramas with products woven into the plot'),
  'commerce-video': E('带货视频', 'Commerce Video', '卖点讲解、测评与种草短视频', 'Product explainers, reviews and seeding'),
  'brand-story': E('品牌故事', 'Brand Story', '品牌理念与新品故事短片', 'Brand values and launch stories'),
  music: E('音乐内容', 'Music', '原创单曲、翻唱与 MV', 'Original singles, covers and MVs'),
  livestream: E('虚拟直播', 'Livestream', '动捕驱动的实时直播与互动', 'Mocap-driven live shows and chat'),
  social: E('社交内容', 'Social Content', '日常动态、表情包与短视频', 'Daily posts, stickers and shorts'),
  'corporate-video': E('企业宣传', 'Corporate Video', '企业介绍、年报与文化视频', 'Company intros, reports and culture'),
  recruitment: E('招聘内容', 'Recruitment', '岗位讲解与雇主品牌视频', 'Role explainers and employer brand'),
  'product-launch': E('产品发布', 'Product Launch', '发布会口播与产品演示', 'Keynote narration and product demos'),
  commerce: E('商业内容', 'Commerce', '联名、促销与转化内容', 'Collabs, promotions and conversion'),
  tourism: E('文旅内容', 'Tourism', '景点、美食与路线推荐', 'Attractions, food and itineraries'),
  culture: E('文化传播', 'Culture', '地方文化与非遗故事', 'Local culture and heritage stories'),
  events: E('活动内容', 'Events', '节庆、赛事与活动预热', 'Festivals, matches and event teasers'),
  'thought-leadership': E('行业观点', 'Thought Leadership', '趋势解读与观点口播', 'Trend analysis and opinion videos'),
  multilingual: E('多语言内容', 'Multilingual', '同一内容的多语言版本', 'One message in many languages'),
  education: E('教育内容', 'Education', '面向学生与公众的知识讲解', 'Explainers for students and the public'),
  exhibition: E('数字展览', 'Exhibition', '线上展厅与 AR 导览讲解', 'Virtual halls and AR guided tours'),
  merchandise: E('文创衍生', 'Merchandise', '文创、周边与联名设计', 'Merch, souvenirs and collab designs'),
  course: E('课程内容', 'Courses', '知识点拆解的系列课程', 'Structured course series'),
  qa: E('互动问答', 'Interactive Q&A', '7×24 小时个性化答疑', 'Personalized answers 24/7'),
  'learning-plan': E('学习计划', 'Learning Plans', '按水平生成的学习路径', 'Paths tailored to each learner'),
  comic: E('漫画内容', 'Comics', '分镜、上色与对白连载', 'Panels, color and dialogue'),
  animation: E('动画内容', 'Animation', '角色短片与番剧', 'Character shorts and series'),
  game: E('游戏联动', 'Game Content', '角色与剧情接入游戏', 'Characters and story in games'),
  conversation: E('智能对话', 'Conversation', '有人格、有记忆的对话', 'Conversations with persona and memory'),
  community: E('社群内容', 'Community', '话题、活动与社群运营', 'Topics, events and moderation'),
  service: E('智能服务', 'AI Service', '会员咨询与售后服务', 'Member support and after-sales'),
  film: E('影视内容', 'Film', '网剧、短片与预告', 'Web series, shorts and trailers'),
  variety: E('综艺内容', 'Variety', '综艺、访谈与真人秀片段', 'Variety, talk and reality clips'),
};

/** AI engines that can be pre-configured for a solution. Keys are referenced by SolutionConfig.preset.recommendedEngines. */
export const AI_ENGINES: Record<string, CatalogEntry> = {
  script: E('AI 剧本', 'AI Scripts', '选题、人物小传与分集剧本', 'Concepts, character bios and episodes'),
  'digital-cast': E('数字演员', 'Digital Cast', '可重复出演的数字角色', 'Reusable digital actors'),
  storyboard: E('智能分镜', 'Storyboards', '从剧本生成镜头与场景', 'Shots and scenes from scripts'),
  video: E('视频生成', 'Video Generation', '画面、配音与剪辑成片', 'Visuals, voice-over and editing'),
  distribution: E('矩阵分发', 'Distribution', '多账号多平台排期发布', 'Scheduled multi-account publishing'),
  'product-analysis': E('商品分析', 'Product Analysis', '提炼卖点、人群与场景', 'Selling points, audiences, use cases'),
  placement: E('智能植入', 'Smart Placement', '规划商品出现时机与台词', 'Plan product timing and lines'),
  'gmv-tracking': E('GMV 追踪', 'GMV Tracking', '从播放到成交的归因', 'Attribution from views to sales'),
  'avatar-3d': E('3D 形象', '3D Avatar', '可驱动的 3D 角色模型', 'Rigged 3D character models'),
  voice: E('声音引擎', 'Voice Engine', '说话与歌唱声线', 'Speaking and singing voices'),
  mocap: E('动作捕捉', 'Motion Capture', '面部与肢体实时驱动', 'Real-time face and body capture'),
  music: E('AI 音乐', 'AI Music', '词曲、编曲与演唱', 'Lyrics, arrangement and vocals'),
  'fan-ops': E('粉丝运营', 'Fan Operations', '会员、应援与社群互动', 'Memberships, cheers and community'),
  avatar: E('数字分身', 'Digital Avatar', '形象定制与驱动', 'Custom, animatable likeness'),
  'knowledge-base': E('知识库', 'Knowledge Base', '接入资料并保持口径一致', 'Grounded, on-message answers'),
  translation: E('多语言', 'Translation', '多语言配音与字幕', 'Multilingual dubbing and captions'),
  'character-design': E('角色设计', 'Character Design', '外形、性格与设定图', 'Look, personality and model sheets'),
  'brand-knowledge': E('品牌知识', 'Brand Knowledge', '品牌调性与禁用词管理', 'Brand tone and banned terms'),
  commerce: E('商业转化', 'Commerce', '联名、带货与转化追踪', 'Collabs, sales and conversion'),
  licensing: E('授权引擎', 'Licensing', '授权范围、合同与分账', 'Scope, contracts and revenue split'),
  'city-knowledge': E('城市知识库', 'City Knowledge', '景区、交通、美食与历史', 'Attractions, transit, food, history'),
  guide: E('智能导览', 'AI Guide', '路线规划与实时讲解', 'Route planning and live narration'),
  'face-clone': E('形象克隆', 'Face Clone', '高还原度的真人数字形象', 'High-fidelity likeness'),
  'voice-clone': E('声音克隆', 'Voice Clone', '保留语气的专属声音', 'A voice that keeps its tone'),
  research: E('文化研究', 'Culture Research', '史料与典籍结构化整理', 'Structured archives and classics'),
  story: E('叙事引擎', 'Story Engine', '连续剧情与互动故事', 'Serial and interactive stories'),
  'tutor-avatar': E('数字导师', 'AI Tutor', '有教学风格的讲解形象', 'A tutor with a teaching style'),
  course: E('课程生成', 'Course Builder', '知识点拆解与课程视频', 'Topics into course videos'),
  assessment: E('学习评估', 'Assessment', '练习、测评与薄弱点诊断', 'Practice, tests and gap analysis'),
  analytics: E('数据分析', 'Analytics', '内容与用户数据看板', 'Content and audience dashboards'),
  'world-building': E('世界观生成', 'World Building', '地理、势力与历史设定', 'Geography, factions and lore'),
  animation: E('动画生成', 'Animation', '角色驱动的动画片段', 'Character-driven animation'),
  persona: E('人格引擎', 'Persona Engine', '性格、语气与价值观', 'Personality, tone and values'),
  dialogue: E('智能对话', 'Dialogue AI', '多轮连贯的自然对话', 'Natural multi-turn chat'),
  emotion: E('情感计算', 'Emotion AI', '识别情绪并合适回应', 'Read and respond to emotion'),
  community: E('社群运营', 'Community Ops', '话题、活动与群管理', 'Topics, events and moderation'),
};

const fallback = (key: string): CatalogEntry => ({ name: { zh: key, en: key.replaceAll('-', ' ') }, description: { zh: '', en: '' } });
export const getContentMode = (key: string) => CONTENT_MODES[key] ?? fallback(key);
export const getEngine = (key: string) => AI_ENGINES[key] ?? fallback(key);

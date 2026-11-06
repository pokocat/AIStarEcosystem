export type IPTypeId =
  | 'entertainment'
  | 'virtual-idol'
  | 'corporate'
  | 'brand'
  | 'anime'
  | 'city'
  | 'founder'
  | 'culture'
  | 'education'
  | 'social';

export type SolutionId =
  | 'ecosystem'
  | 'ai-artist'
  | 'ai-drama'
  | 'story-commerce'
  | 'virtual-idol'
  | 'corporate-ip'
  | 'brand-ip'
  | 'city-ip'
  | 'digital-founder'
  | 'culture-ip'
  | 'education-ip'
  | 'anime-ip'
  | 'social-ip';

export interface LocalizedText {
  zh: string;
  en: string;
}

export interface SolutionConfig {
  id: SolutionId;
  ipType: IPTypeId;
  icon: string;
  name: LocalizedText;
  group: 'platform' | 'entertainment' | 'business' | 'culture' | 'intelligence';
  badge: LocalizedText;
  title: LocalizedText;
  highlight: LocalizedText;
  description: LocalizedText;
  primaryCTA: LocalizedText;
  accent: string;
  secondary: string;
  image: string;
  audience: Array<{ name: LocalizedText; need: LocalizedText }>;
  heroStats: Array<{ value: string; label: LocalizedText }>;
  capabilities: Array<{ title: LocalizedText; description: LocalizedText }>;
  workflow: LocalizedText[];
  caseStudy: {
    name: LocalizedText;
    description: LocalizedText;
    metric: string;
    metricLabel: LocalizedText;
  };
  preset: {
    creationMode: string;
    contentModes: string[];
    recommendedEngines: string[];
  };
}

export const IP_TYPE_TEMPLATES: Array<{
  id: IPTypeId;
  name: LocalizedText;
  description: LocalizedText;
}> = [
  { id: 'entertainment', name: { zh: '娱乐 IP', en: 'Entertainment IP' }, description: { zh: 'AI艺人、演员、主播与短剧角色', en: 'AI artists, actors, hosts and drama characters' } },
  { id: 'virtual-idol', name: { zh: '虚拟偶像', en: 'Virtual Idol' }, description: { zh: '次元明星与虚拟网红', en: 'Digital stars and virtual influencers' } },
  { id: 'corporate', name: { zh: '企业 IP', en: 'Corporate IP' }, description: { zh: '企业代言人与吉祥物', en: 'Corporate ambassadors and mascots' } },
  { id: 'brand', name: { zh: '品牌 IP', en: 'Brand IP' }, description: { zh: '品牌角色与产品人格', en: 'Brand characters and product personas' } },
  { id: 'anime', name: { zh: '动漫 IP', en: 'Anime IP' }, description: { zh: '动画、漫画与互动角色', en: 'Animation, comics and interactive characters' } },
  { id: 'city', name: { zh: '城市 IP', en: 'City IP' }, description: { zh: '城市代言人与文旅形象', en: 'City ambassadors and tourism identities' } },
  { id: 'founder', name: { zh: '创始人 IP', en: 'Founder IP' }, description: { zh: '企业家与行业专家数字分身', en: 'Digital twins for founders and experts' } },
  { id: 'culture', name: { zh: '文化 IP', en: 'Culture IP' }, description: { zh: '历史人物与文化符号', en: 'Historical figures and cultural symbols' } },
  { id: 'education', name: { zh: '教育 IP', en: 'Education IP' }, description: { zh: 'AI导师与知识助手', en: 'AI tutors and knowledge guides' } },
  { id: 'social', name: { zh: '社交 IP', en: 'Social IP' }, description: { zh: '陪伴智能体与社群助手', en: 'Companion agents and community assistants' } },
];

/** Platform-wide headline numbers — keep every homepage consistent with these. */
export const PLATFORM_STATS = {
  creators: { full: '100,000+', short: '100K+' },
  assets: { full: '5,000,000+', short: '5M+' },
  ipTypes: '10',
  channels: '150+',
};

export const SHARED_PLATFORM_LAYERS = [
  { id: 'asset-model', name: { zh: '一个 IP 资产模型', en: 'One IP Asset Model' } },
  { id: 'templates', name: { zh: '十种 IP 类型模板', en: '10 IP Type Templates' } },
  { id: 'production', name: { zh: '一套内容生产引擎', en: 'One Content Engine' } },
  { id: 'distribution', name: { zh: '一套矩阵分发体系', en: 'One Distribution Matrix' } },
  { id: 'monetization', name: { zh: '一套授权与商业变现系统', en: 'One Licensing & Monetization System' } },
];

const L = (zh: string, en: string): LocalizedText => ({ zh, en });

const makeSolution = (
  config: Omit<SolutionConfig, 'audience' | 'heroStats' | 'capabilities' | 'workflow' | 'caseStudy'> & {
    audience: string[][];
    heroStats: string[][];
    capabilities: string[][][];
    workflow: string[][];
    caseStudy: [string[], string[], string, string[]];
  },
): SolutionConfig => ({
  ...config,
  audience: config.audience.map(([zh, en, needZh, needEn]) => ({ name: L(zh, en), need: L(needZh, needEn) })),
  heroStats: config.heroStats.map(([value, zh, en]) => ({ value, label: L(zh, en) })),
  capabilities: config.capabilities.map(([[zh, en], [dzh, den]]) => ({ title: L(zh, en), description: L(dzh, den) })),
  workflow: config.workflow.map(([zh, en]) => L(zh, en)),
  caseStudy: {
    name: L(config.caseStudy[0][0], config.caseStudy[0][1]),
    description: L(config.caseStudy[1][0], config.caseStudy[1][1]),
    metric: config.caseStudy[2],
    metricLabel: L(config.caseStudy[3][0], config.caseStudy[3][1]),
  },
});

export const SOLUTION_CONFIGS: Record<Exclude<SolutionId, 'ecosystem' | 'ai-artist'>, SolutionConfig> = {
  'ai-drama': makeSolution({
    id: 'ai-drama', ipType: 'entertainment', icon: 'film', group: 'entertainment',
    name: L('AI 短剧孵化', 'AI Drama Studio'), badge: L('AI 短剧全链路', 'End-to-End AI Drama'),
    title: L('一个创意，', 'One Idea.'), highlight: L('生成一部持续更新的 AI 短剧', 'An Always-Evolving AI Drama'),
    description: L('从选题、人物、分集剧本到数字演员、分镜制作与矩阵发行，用一套系统完成短剧工业化生产。', 'From concept and characters to scripts, digital actors, storyboards and distribution in one production system.'),
    primaryCTA: L('生成第一部短剧', 'Create Your First Drama'), accent: '#8b5cf6', secondary: '#ec4899',
    image: '/images/solution-ai-drama.webp',
    audience: [['短剧制作团队', 'Drama Studios', '降低单集成本、缩短制作周期', 'Lower cost and faster episodes'], ['MCN 机构', 'MCN Agencies', '批量出剧，稳定更新多个账号', 'Steady releases across many accounts'], ['品牌内容团队', 'Brand Teams', '用定制短剧讲品牌故事', 'Tell brand stories through custom dramas']],
    heroStats: [['72h', '剧本到成片', 'Script to Final Cut'], ['-70%', '制作成本', 'Production Cost'], ['24 集', '单角色连续产出', 'Episodes per Cast']],
    capabilities: [
      [['AI 选题与剧本', 'AI Story & Scripts'], ['生成选题、人物小传、分集大纲和完整剧本', 'Generate concepts, characters, episode arcs and scripts']],
      [['数字演员', 'Digital Cast'], ['创建可持续出演的数字角色和角色关系', 'Create reusable digital actors and relationships']],
      [['智能分镜', 'Smart Storyboards'], ['从剧本直接生成镜头、场景和拍摄清单', 'Turn scripts into shots, scenes and production lists']],
      [['批量制作', 'Batch Production'], ['配音、画面、剪辑和字幕批量完成', 'Batch voice, visuals, editing and captions']],
      [['剧情带货', 'Story Commerce'], ['商品与情节智能匹配并自然植入', 'Match products with stories for natural placement']],
      [['矩阵发行', 'Matrix Release'], ['多平台版本适配、排期和效果追踪', 'Adapt, schedule and track multi-platform releases']],
    ],
    workflow: [['输入故事方向', 'Set Story Direction'], ['构建人物世界', 'Build Story World'], ['生成分集剧本', 'Generate Episodes'], ['数字化制作', 'Produce Digitally'], ['发行与变现', 'Release & Monetize']],
    caseStudy: [['《零界回声》AI 连续短剧', 'Echoes of Zero AI Series'], ['一套角色资产连续生产 24 集内容，并同步完成多平台发行。', 'One reusable character system produced 24 episodes for multi-platform release.'], '24 集', ['连续生产', 'Episodes Produced']],
    preset: { creationMode: 'ai-drama', contentModes: ['short-drama', 'story-commerce'], recommendedEngines: ['script', 'digital-cast', 'storyboard', 'video', 'distribution'] },
  }),
  'story-commerce': makeSolution({
    id: 'story-commerce', ipType: 'brand', icon: 'shopping', group: 'business',
    name: L('剧情带货', 'Story Commerce'), badge: L('内容电商新引擎', 'Content Commerce Engine'),
    title: L('让商品进入剧情，', 'Put Products Into Stories,'), highlight: L('而不是打断剧情', 'Not Interrupt Them'),
    description: L('AI 自动匹配商品卖点、角色与情节，批量生成兼顾内容质量和商业转化的剧情视频。', 'AI matches product value, characters and plots to produce story-led commerce videos at scale.'),
    primaryCTA: L('创建剧情带货项目', 'Create Commerce Story'), accent: '#f97316', secondary: '#ec4899',
    image: '/images/solution-story-commerce.webp',
    audience: [['消费品牌', 'Consumer Brands', '新品上市需要持续的内容声量', 'Sustained buzz for every launch'], ['电商团队', 'Commerce Teams', '提升内容转化率与投产比', 'Higher content conversion and ROI'], ['内容 MCN', 'Content MCNs', '为品牌客户规模化交付剧情内容', 'Deliver story content to brands at scale']],
    heroStats: [['8.6%', '平均转化率', 'Avg. Conversion'], ['3.5x', '平均投产比', 'Avg. ROI'], ['50+', '剧情模型', 'Story Models']],
    capabilities: [
      [['商品卖点解析', 'Product Insight'], ['自动提炼卖点、人群与使用场景', 'Extract selling points, audiences and use cases']],
      [['剧情模型库', 'Story Model Library'], ['反转、种草、测评、情感等高转化剧情结构', 'Proven twist, seeding, review and emotional formats']],
      [['角色匹配', 'Cast Matching'], ['按品类与人群匹配数字演员风格', 'Match digital actors to category and audience']],
      [['自然植入', 'Native Placement'], ['商品出现时机、台词与镜头自动编排', 'Auto-plan product timing, lines and shots']],
      [['批量 A/B 版本', 'Batch A/B Variants'], ['同一商品生成多版本剧情对比转化', 'Test multiple story versions per product']],
      [['GMV 归因', 'GMV Attribution'], ['播放、点击到成交追踪到每一集', 'Trace views, clicks and sales per episode']],
    ],
    workflow: [['解析商品卖点', 'Analyze Product'], ['匹配剧情模型', 'Match Story Model'], ['生成角色脚本', 'Generate Script'], ['批量制作视频', 'Produce Videos'], ['追踪 GMV', 'Track GMV']],
    caseStudy: [['POMO 夏日剧情宇宙', 'POMO Summer Story Universe'], ['围绕三款产品创建连续剧情，形成可追更的品牌内容栏目。', 'An episodic brand story built around three products.'], '¥3200万', ['内容 GMV', 'Content GMV']],
    preset: { creationMode: 'story-commerce', contentModes: ['commerce-video', 'brand-story'], recommendedEngines: ['product-analysis', 'script', 'placement', 'video', 'gmv-tracking'] },
  }),
  'virtual-idol': makeSolution({
    id: 'virtual-idol', ipType: 'virtual-idol', icon: 'sparkles', group: 'entertainment',
    name: L('虚拟偶像', 'Virtual Idol'), badge: L('次元偶像工厂', 'Digital Idol Factory'),
    title: L('创建一个角色，', 'Create One Character.'), highlight: L('连接一个次元世界', 'Connect an Entire World'),
    description: L('从 3D 形象、声音和动捕到直播、音乐、粉丝社群与衍生授权，持续经营虚拟偶像资产。', 'Build and operate a virtual idol across 3D identity, voice, live content, music, fandom and licensing.'),
    primaryCTA: L('创建虚拟偶像', 'Create Virtual Idol'), accent: '#d946ef', secondary: '#8b5cf6',
    image: '/images/scene-virtual-idol.webp',
    audience: [['虚拟人团队', 'Virtual Human Teams', '缩短从建模到出道的周期', 'Faster path from modeling to debut'], ['娱乐公司', 'Entertainment Studios', '打造可持续运营的虚拟艺人', 'Build virtual artists that last'], ['独立创作者', 'Independent Creators', '一个人也能运营虚拟偶像', 'Run a virtual idol as a solo creator']],
    heroStats: [['30 天', '从设定到出道', 'Concept to Debut'], ['<80ms', '动捕延迟', 'Mocap Latency'], ['24/7', '直播在线', 'Always Live']],
    capabilities: [
      [['3D 形象设计', '3D Avatar Design'], ['从概念设定到可驱动的 3D 模型', 'From concept art to a rigged 3D model']],
      [['专属声线', 'Signature Voice'], ['唱歌、说话与多语言声线统一', 'One voice for singing, talking and languages']],
      [['实时动捕直播', 'Live Mocap'], ['低延迟面捕与动捕驱动虚拟直播', 'Low-latency face and body capture for streams']],
      [['AI 音乐制作', 'AI Music'], ['词曲、编曲与演唱一体生成', 'Lyrics, arrangement and vocals in one flow']],
      [['粉丝运营', 'Fan Operations'], ['应援、会员、私信与社群互动', 'Cheers, memberships, DMs and community']],
      [['衍生授权', 'Merch & Licensing'], ['周边、联名与形象授权统一管理', 'Merch, collabs and likeness licensing']],
    ],
    workflow: [['角色设定', 'Define Character'], ['形象与声线', 'Avatar & Voice'], ['首发内容', 'Debut Content'], ['直播与演出', 'Live & Shows'], ['粉丝经济', 'Fan Economy']],
    caseStudy: [['LUNA-07 次元偶像', 'LUNA-07 Digital Idol'], ['通过实时动捕和多语言直播建立跨平台粉丝生态。', 'Real-time motion capture and multilingual streaming built a cross-platform fandom.'], '420万', ['核心粉丝', 'Core Fans']],
    preset: { creationMode: 'virtual-idol', contentModes: ['music', 'livestream', 'social'], recommendedEngines: ['avatar-3d', 'voice', 'mocap', 'music', 'fan-ops'] },
  }),
  'corporate-ip': makeSolution({
    id: 'corporate-ip', ipType: 'corporate', icon: 'building', group: 'business',
    name: L('企业 IP', 'Corporate IP'), badge: L('企业数字形象系统', 'Corporate Digital Identity'),
    title: L('把企业能力，', 'Turn Corporate Capability'), highlight: L('变成持续传播的数字 IP', 'Into an Always-On Digital IP'),
    description: L('统一企业代言人、吉祥物、品牌知识与内容生产，为产品、招聘、招商和全球传播服务。', 'Unify corporate avatars, mascots, knowledge and content for products, hiring, partnerships and global communication.'),
    primaryCTA: L('创建企业 IP', 'Create Corporate IP'), accent: '#3b82f6', secondary: '#06b6d4',
    image: '/images/solution-corporate-ip.webp',
    audience: [['集团品牌部', 'Corporate Brand', '统一对外形象与品牌口径', 'One consistent public voice'], ['市场团队', 'Marketing Teams', '高频产出产品与活动内容', 'High-frequency product and event content'], ['人力与招商', 'HR & Partnerships', '让招聘与招商宣传更有温度', 'Warmer hiring and partnership stories']],
    heroStats: [['18 种', '语言覆盖', 'Languages'], ['120+', '月均内容产出', 'Monthly Assets'], ['100%', '发布前合规审核', 'Pre-publish Review']],
    capabilities: [
      [['企业形象设计', 'Identity Design'], ['代言人、吉祥物与数字员工形象定制', 'Custom ambassadors, mascots and digital staff']],
      [['企业知识库', 'Corporate Knowledge'], ['产品、品牌与制度知识统一接入', 'Products, brand and policies in one place']],
      [['品牌安全审核', 'Brand Safety'], ['话术与内容发布前自动合规检查', 'Automatic compliance checks before publishing']],
      [['多场景内容', 'Multi-scene Content'], ['发布会、招聘、培训与年报视频', 'Launches, hiring, training and annual reports']],
      [['多语言出海', 'Global Voice'], ['一套形象覆盖多语言市场', 'One identity across global markets']],
      [['传播效果分析', 'Impact Analytics'], ['触达、互动与品牌认知变化追踪', 'Track reach, engagement and awareness']],
    ],
    workflow: [['品牌诊断', 'Brand Audit'], ['形象与人设', 'Identity & Persona'], ['知识接入', 'Connect Knowledge'], ['内容生产', 'Produce Content'], ['全渠道传播', 'Omnichannel Reach']],
    caseStudy: [['星云科技数字代言人', 'Nebula Tech Digital Ambassador'], ['统一承载产品发布、招聘宣传与企业文化内容。', 'One digital ambassador for launches, recruitment and culture.'], '+240%', ['内容触达', 'Content Reach']],
    preset: { creationMode: 'corporate-avatar', contentModes: ['corporate-video', 'recruitment', 'product-launch'], recommendedEngines: ['avatar', 'knowledge-base', 'video', 'translation', 'distribution'] },
  }),
  'brand-ip': makeSolution({
    id: 'brand-ip', ipType: 'brand', icon: 'package', group: 'business',
    name: L('品牌 IP', 'Brand IP'), badge: L('品牌角色增长系统', 'Brand Character Growth'),
    title: L('让用户不只认识品牌，', 'Go Beyond Brand Awareness.'), highlight: L('更喜欢一个角色', 'Build a Character People Love'),
    description: L('设计品牌角色与产品人格，连接社交内容、剧情营销、联名商品和长期授权。', 'Create brand characters and product personas across social content, storytelling, merchandise and licensing.'),
    primaryCTA: L('创建品牌角色', 'Create Brand Character'), accent: '#14b8a6', secondary: '#22d3ee',
    image: '/images/solution-brand-ip.webp',
    audience: [['消费品牌', 'Consumer Brands', '用角色建立长期情感连接', 'Long-term emotional bonds through a character'], ['新零售', 'New Retail', '门店与线上统一的角色体验', 'One character across stores and online'], ['品牌代理商', 'Brand Agencies', '为客户快速交付角色方案', 'Deliver character programs to clients fast']],
    heroStats: [['+86%', '平均复购提升', 'Repurchase Lift'], ['26 款', '单 IP 联名产品', 'Collabs per IP'], ['5x', '联名投产比', 'Collab ROI']],
    capabilities: [
      [['角色设计', 'Character Design'], ['外形、性格、口头禅与品牌关联', 'Look, personality, catchphrases and brand ties']],
      [['品牌人格', 'Brand Persona'], ['角色说话方式与品牌调性一致', 'A voice that matches the brand']],
      [['社媒内容', 'Social Content'], ['表情包、短视频与日常更新', 'Stickers, short videos and daily posts']],
      [['剧情营销', 'Story Marketing'], ['围绕角色的连续剧情与新品故事', 'Episodic stories and launch narratives']],
      [['联名衍生', 'Collabs & Merch'], ['联名款、周边与包装延展', 'Collab editions, merch and packaging']],
      [['授权管理', 'Licensing'], ['授权方、范围与收益统一管理', 'Manage licensees, scope and revenue']],
    ],
    workflow: [['品牌洞察', 'Brand Insight'], ['角色共创', 'Co-create Character'], ['内容养成', 'Grow Content'], ['联名衍生', 'Collabs & Merch'], ['授权变现', 'License & Earn']],
    caseStudy: [['POMO 品牌角色宇宙', 'POMO Brand Character Universe'], ['从包装延伸到短视频剧情与联名商品的角色体系。', 'A character universe spanning packaging, video and merchandise.'], '26 款', ['联名产品', 'Collab Products']],
    preset: { creationMode: 'brand-character', contentModes: ['brand-story', 'social', 'commerce'], recommendedEngines: ['character-design', 'brand-knowledge', 'script', 'commerce', 'licensing'] },
  }),
  'city-ip': makeSolution({
    id: 'city-ip', ipType: 'city', icon: 'map', group: 'culture',
    name: L('城市 IP', 'City IP'), badge: L('城市文旅数字引擎', 'City & Tourism Engine'),
    title: L('让一座城市，', 'Give Every City'), highlight: L('拥有会表达的数字形象', 'A Digital Voice and Identity'),
    description: L('用城市数字代言人连接景区、非遗、美食、节庆与多语言海外传播。', 'Connect attractions, heritage, food, festivals and global communication through a digital city ambassador.'),
    primaryCTA: L('创建城市 IP', 'Create City IP'), accent: '#22c55e', secondary: '#06b6d4',
    image: '/images/solution-city-ip.webp',
    audience: [['城市文旅', 'City Tourism', '提升城市知名度与游客量', 'More awareness and more visitors'], ['景区集团', 'Attraction Groups', '提供 7×24 智能导览服务', '24/7 AI guided tours'], ['地方文化机构', 'Cultural Institutions', '让地方文化被更多人看见', 'Bring local culture to more people']],
    heroStats: [['7.6亿', '单城最高曝光', 'Top City Impressions'], ['+50%', '游客增长', 'Visitor Growth'], ['12 种', '语言导览', 'Guide Languages']],
    capabilities: [
      [['城市形象设计', 'City Avatar'], ['融合地标、方言与城市性格的代言人', 'An ambassador of landmarks, dialect and character']],
      [['城市知识库', 'City Knowledge'], ['景区、美食、交通与历史统一接入', 'Attractions, food, transit and history']],
      [['智能导览', 'AI Guide'], ['路线规划、景点讲解与实时问答', 'Routes, explanations and live Q&A']],
      [['节庆活动', 'Festival Content'], ['节庆、赛事与活动内容快速生成', 'Fast content for festivals and events']],
      [['海外传播', 'Global Promotion'], ['多语言短视频覆盖海外平台', 'Multilingual shorts for global platforms']],
      [['文旅数据', 'Tourism Analytics'], ['曝光、客流与消费转化追踪', 'Track exposure, footfall and spending']],
    ],
    workflow: [['城市调研', 'City Research'], ['形象共创', 'Co-create Ambassador'], ['知识接入', 'Connect Knowledge'], ['文旅内容', 'Tourism Content'], ['客流转化', 'Visitor Conversion']],
    caseStudy: [['霓虹湾数字文旅官', 'Neon Bay Digital Tourism Guide'], ['数字代言人串联景区、非遗、美食与城市节庆。', 'A city ambassador connecting attractions, heritage, food and festivals.'], '7.6亿', ['传播曝光', 'Impressions']],
    preset: { creationMode: 'city-ambassador', contentModes: ['tourism', 'culture', 'events'], recommendedEngines: ['avatar', 'city-knowledge', 'guide', 'translation', 'distribution'] },
  }),
  'digital-founder': makeSolution({
    id: 'digital-founder', ipType: 'founder', icon: 'crown', group: 'business',
    name: L('数字创始人', 'Digital Founder'), badge: L('创始人数字分身', 'Founder Digital Twin'),
    title: L('让创始人的思想，', 'Let Founder Insight'), highlight: L('7×24 小时持续传播', 'Communicate 24/7'),
    description: L('将创始人的形象、声音、知识和表达方式转化为可持续运营的企业内容资产。', 'Turn a founder’s image, voice, knowledge and expression into an always-on corporate content asset.'),
    primaryCTA: L('创建数字创始人', 'Create Digital Founder'), accent: '#f59e0b', secondary: '#f97316',
    image: '/images/scene-digital-founder.webp',
    audience: [['企业创始人', 'Founders', '没时间拍摄也能持续发声', 'Stay visible without filming'], ['行业专家', 'Industry Experts', '把专业观点规模化传播', 'Scale expert insight'], ['企业品牌部', 'Corporate Brand', '管理创始人对外内容与口径', 'Govern founder messaging']],
    heroStats: [['30 分钟', '完成形象采集', 'Capture Session'], ['7×24h', '持续输出', 'Always On'], ['9 种', '语言表达', 'Languages']],
    capabilities: [
      [['形象克隆', 'Likeness Clone'], ['高还原度的创始人数字形象', 'A high-fidelity digital likeness']],
      [['声音克隆', 'Voice Clone'], ['保留语气与表达习惯的专属声音', 'A voice that keeps tone and habits']],
      [['观点知识库', 'Insight Library'], ['演讲、访谈与文章沉淀为知识库', 'Talks, interviews and articles as knowledge']],
      [['口播内容生成', 'Talking-head Videos'], ['行业观点、企业动态自动成片', 'Auto-produced insight and company updates']],
      [['多语言表达', 'Multilingual Delivery'], ['同一观点同步输出多语言版本', 'One message in many languages']],
      [['授权与风控', 'Consent & Control'], ['每条内容经创始人授权后发布', 'Every piece approved before publishing']],
    ],
    workflow: [['采集形象声音', 'Capture Likeness'], ['沉淀观点', 'Build Insight Library'], ['生成内容', 'Generate Content'], ['授权审核', 'Founder Approval'], ['全网发布', 'Publish Everywhere']],
    caseStudy: [['周远数字创始人', 'Zhou Yuan Digital Founder'], ['持续输出行业观点、企业动态与多语言品牌内容。', 'Always-on industry insight, company news and multilingual content.'], '7×24h', ['持续输出', 'Always On']],
    preset: { creationMode: 'digital-twin', contentModes: ['thought-leadership', 'corporate-video', 'multilingual'], recommendedEngines: ['face-clone', 'voice-clone', 'knowledge-base', 'script', 'translation'] },
  }),
  'culture-ip': makeSolution({
    id: 'culture-ip', ipType: 'culture', icon: 'landmark', group: 'culture',
    name: L('文化 IP', 'Culture IP'), badge: L('文化数字复兴', 'Digital Culture Revival'),
    title: L('让传统文化，', 'Bring Cultural Heritage'), highlight: L('以新的方式被看见', 'Back Into View'),
    description: L('数字化历史人物、文化符号与非遗内容，连接互动叙事、展览、教育和文创开发。', 'Digitize historical figures, symbols and heritage for stories, exhibitions, education and merchandise.'),
    primaryCTA: L('创建文化 IP', 'Create Culture IP'), accent: '#f97316', secondary: '#ef4444',
    image: '/images/solution-culture-ip.webp',
    audience: [['博物馆', 'Museums', '让馆藏走出展柜', 'Take collections beyond the display case'], ['非遗机构', 'Heritage Organizations', '让传统技艺被年轻人看见', 'Reach younger audiences'], ['文创公司', 'Culture Brands', '开发有故事的文创产品', 'Merchandise with a story']],
    heroStats: [['68%', '年轻观众占比', 'Gen Z Audience'], ['8600万', '单 IP 播放', 'Views per IP'], ['42 种', '角色设定', 'Characters']],
    capabilities: [
      [['文化研究', 'Cultural Research'], ['史料、典籍与非遗资料结构化整理', 'Structure archives, classics and heritage data']],
      [['角色重塑', 'Character Reimagining'], ['历史人物与文化符号现代化设计', 'Modern designs for figures and symbols']],
      [['互动叙事', 'Interactive Stories'], ['可对话、可参与的文化故事', 'Culture stories you can talk to']],
      [['数字展览', 'Digital Exhibitions'], ['线上展厅、AR 导览与讲解', 'Virtual halls, AR tours and narration']],
      [['文化教育', 'Culture Education'], ['面向学生与公众的文化课程', 'Courses for students and the public']],
      [['文创授权', 'Merch Licensing'], ['文创产品开发与授权管理', 'Develop and license cultural merch']],
    ],
    workflow: [['文化研究', 'Research'], ['角色重塑', 'Reimagine'], ['故事创作', 'Tell Stories'], ['展览与教育', 'Exhibit & Teach'], ['文创变现', 'Merchandise']],
    caseStudy: [['山海异兽数字复兴', 'Mythical Creatures Reborn'], ['用现代视觉和 AI 叙事重构传统文化符号。', 'Traditional symbols reimagined through AI storytelling and modern visuals.'], '8600万', ['内容播放', 'Content Views']],
    preset: { creationMode: 'culture-character', contentModes: ['education', 'exhibition', 'merchandise'], recommendedEngines: ['research', 'character-design', 'story', 'guide', 'licensing'] },
  }),
  'education-ip': makeSolution({
    id: 'education-ip', ipType: 'education', icon: 'education', group: 'culture',
    name: L('教育 IP', 'Education IP'), badge: L('AI 知识导师', 'AI Knowledge Mentor'),
    title: L('把专业知识，', 'Turn Expertise'), highlight: L('变成会互动的 AI 导师', 'Into an Interactive AI Mentor'),
    description: L('构建专家知识库、数字导师和课程内容，实现讲解、问答、练习与学习分析。', 'Build expert knowledge, digital tutors and courses for explanation, Q&A, practice and analytics.'),
    primaryCTA: L('创建 AI 导师', 'Create AI Tutor'), accent: '#4f46e5', secondary: '#3b82f6',
    image: '/images/solution-education-ip.webp',
    audience: [['教育机构', 'Education Providers', '扩大优质师资覆盖面', 'Scale your best teachers'], ['知识博主', 'Knowledge Creators', '把内容变成可售卖的课程', 'Turn content into paid courses'], ['企业培训', 'Corporate Learning', '降低员工培训成本', 'Lower training costs']],
    heroStats: [['92%', '课程完成率', 'Completion'], ['24/7', '答疑在线', 'Q&A Online'], ['200+', '单导师课程', 'Courses per Tutor']],
    capabilities: [
      [['专家知识库', 'Expert Knowledge'], ['教材、讲义与题库统一接入', 'Textbooks, notes and question banks']],
      [['数字导师', 'AI Tutor Avatar'], ['形象、声音与教学风格定制', 'Custom look, voice and teaching style']],
      [['课程生成', 'Course Builder'], ['知识点拆解与课程视频生成', 'Break down topics into course videos']],
      [['互动答疑', 'Live Q&A'], ['7×24 小时个性化答疑', 'Personalized answers around the clock']],
      [['学习评估', 'Assessment'], ['练习、测评与薄弱点诊断', 'Practice, tests and gap diagnosis']],
      [['学习分析', 'Learning Analytics'], ['学习进度与效果数据看板', 'Progress and outcome dashboards']],
    ],
    workflow: [['知识接入', 'Connect Knowledge'], ['导师设定', 'Design Tutor'], ['课程生成', 'Build Courses'], ['互动教学', 'Teach & Answer'], ['评估提升', 'Assess & Improve']],
    caseStudy: [['苏格拉底 AI 学伴', 'Socrates AI Learning Partner'], ['完成知识讲解、练习反馈与个性化学习规划。', 'Delivers explanations, feedback and personalized study plans.'], '92%', ['课程完成率', 'Completion Rate']],
    preset: { creationMode: 'ai-tutor', contentModes: ['course', 'qa', 'learning-plan'], recommendedEngines: ['knowledge-base', 'tutor-avatar', 'course', 'assessment', 'analytics'] },
  }),
  'anime-ip': makeSolution({
    id: 'anime-ip', ipType: 'anime', icon: 'gamepad', group: 'entertainment',
    name: L('动漫 IP', 'Anime IP'), badge: L('角色与世界观工厂', 'Character & World Factory'),
    title: L('从一个角色开始，', 'Start With a Character.'), highlight: L('创造可持续扩展的世界', 'Build an Expandable World'),
    description: L('统一角色设定、世界观、漫画、动画、游戏联动与衍生授权，持续扩展内容宇宙。', 'Unify characters, worlds, comics, animation, games and licensing into an expanding content universe.'),
    primaryCTA: L('创建动漫 IP', 'Create Anime IP'), accent: '#8b5cf6', secondary: '#6366f1',
    image: '/images/solution-anime-ip.webp',
    audience: [['动画工作室', 'Animation Studios', '缩短前期设定与制作周期', 'Shorter pre-production and production'], ['漫画作者', 'Comic Creators', '提升连载更新效率', 'Faster serialization'], ['游戏团队', 'Game Studios', '获得可延展的角色与剧情', 'Characters and lore that extend']],
    heroStats: [['18 集', '互动番剧', 'Interactive Episodes'], ['64 款', '衍生商品', 'Merch SKUs'], ['3 款', '联动游戏', 'Game Tie-ins']],
    capabilities: [
      [['角色设定', 'Character Sheets'], ['三视图、表情与服装设定', 'Turnarounds, expressions and outfits']],
      [['世界观构建', 'World Building'], ['地理、势力、历史与规则体系', 'Geography, factions, history and rules']],
      [['漫画生成', 'Comic Generation'], ['分镜、上色与对白一体生成', 'Panels, color and dialogue in one flow']],
      [['动画制作', 'Animation'], ['角色驱动的短片与番剧', 'Character-driven shorts and series']],
      [['游戏联动', 'Game Tie-ins'], ['角色与剧情接入游戏', 'Bring characters and story into games']],
      [['衍生授权', 'Licensing'], ['手办、周边与联名授权', 'Figures, merch and collabs']],
    ],
    workflow: [['角色诞生', 'Create Character'], ['世界观', 'Build World'], ['漫画连载', 'Serialize Comics'], ['动画与游戏', 'Animate & Play'], ['衍生授权', 'License Merch']],
    caseStudy: [['零界纪元互动番剧', 'Zero Realm Interactive Anime'], ['观众投票影响剧情，并同步开发游戏与数字藏品。', 'Audience voting shapes the story alongside game and collectible extensions.'], '18 集', ['互动番剧', 'Interactive Series']],
    preset: { creationMode: 'anime-world', contentModes: ['comic', 'animation', 'game'], recommendedEngines: ['character-design', 'world-building', 'story', 'animation', 'licensing'] },
  }),
  'social-ip': makeSolution({
    id: 'social-ip', ipType: 'social', icon: 'message', group: 'intelligence',
    name: L('社交 IP', 'Social IP'), badge: L('陪伴与社群智能体', 'Companion & Community Agent'),
    title: L('让数字角色，', 'Build Digital Characters'), highlight: L('真正理解并陪伴用户', 'That Understand and Engage'),
    description: L('融合品牌人格、智能对话、情感计算、社群管理和用户洞察。', 'Combine brand personality, conversation, emotion AI, community operations and insight.'),
    primaryCTA: L('创建社交智能体', 'Create Social Agent'), accent: '#06b6d4', secondary: '#2dd4bf',
    image: '/images/solution-social-ip.webp',
    audience: [['品牌社群', 'Brand Communities', '让社群 7×24 小时有人回应', 'A community that always gets a reply'], ['会员运营', 'Membership Teams', '提升会员活跃与续费', 'More active members and renewals'], ['智能客服', 'AI Service Teams', '让服务更有温度', 'Service with warmth']],
    heroStats: [['+68%', '社群活跃度', 'Engagement Lift'], ['76%', '次月留存', 'Month-2 Retention'], ['-55%', '服务成本', 'Service Cost']],
    capabilities: [
      [['人格设定', 'Persona Design'], ['性格、语气、记忆与价值观', 'Personality, tone, memory and values']],
      [['智能对话', 'Dialogue AI'], ['多轮、上下文连贯的自然对话', 'Natural multi-turn conversation']],
      [['情感计算', 'Emotion AI'], ['识别情绪并给出合适回应', 'Read emotions and respond well']],
      [['长期记忆', 'Long-term Memory'], ['记住用户偏好与互动历史', 'Remember preferences and history']],
      [['社群运营', 'Community Ops'], ['话题、活动与群管理自动化', 'Automate topics, events and moderation']],
      [['用户洞察', 'User Insight'], ['沉淀需求、反馈与满意度', 'Capture needs, feedback and satisfaction']],
    ],
    workflow: [['人格设定', 'Design Persona'], ['知识与记忆', 'Knowledge & Memory'], ['对话调优', 'Tune Dialogue'], ['社群上线', 'Launch in Community'], ['洞察迭代', 'Learn & Iterate']],
    caseStudy: [['MOMO 社群共创官', 'MOMO Community Co-Creator'], ['陪伴用户、组织活动并持续沉淀社群洞察。', 'Supports users, runs events and continuously captures community insight.'], '+68%', ['社群活跃度', 'Engagement Lift']],
    preset: { creationMode: 'social-agent', contentModes: ['conversation', 'community', 'service'], recommendedEngines: ['persona', 'dialogue', 'emotion', 'community', 'analytics'] },
  }),
};

export const SOLUTION_ORDER: SolutionId[] = [
  'ecosystem', 'ai-artist', 'ai-drama', 'story-commerce', 'virtual-idol',
  'digital-founder', 'corporate-ip', 'brand-ip', 'city-ip', 'culture-ip',
  'education-ip', 'anime-ip', 'social-ip',
];

export const getSolutionLabel = (id: SolutionId): LocalizedText => {
  if (id === 'ecosystem') return L('AI IP 生态平台', 'AI IP Ecosystem');
  if (id === 'ai-artist') return L('AI 艺人孵化', 'AI Artist Incubation');
  return SOLUTION_CONFIGS[id].name;
};

export const isSolutionId = (value: string): value is SolutionId =>
  SOLUTION_ORDER.includes(value as SolutionId);

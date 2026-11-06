import type { LocalizedText, SolutionId } from './ipPlatform';

export type ShowcaseGroup = 'entertainment' | 'business' | 'brand' | 'city' | 'culture' | 'education' | 'social';

export interface ShowcaseCase {
  id: string;
  solution: SolutionId;
  category: LocalizedText;
  tag: LocalizedText;
  name: LocalizedText;
  description: LocalizedText;
  image: string;
  metrics: Array<{ value: string; label: LocalizedText }>;
  featured?: boolean;
}

type Pair = [string, string];
type Metric = [string, string, string];

const L = ([zh, en]: Pair): LocalizedText => ({ zh, en });
const img = (slug: string) => `/images/${slug}.webp`;

const make = (
  solution: SolutionId,
  items: Array<{ id: string; category: Pair; tag: Pair; name: Pair; description: Pair; image: string; metrics: Metric[]; featured?: boolean }>,
): ShowcaseCase[] =>
  items.map(item => ({
    id: `${solution}-${item.id}`,
    solution,
    category: L(item.category),
    tag: L(item.tag),
    name: L(item.name),
    description: L(item.description),
    image: img(item.image),
    metrics: item.metrics.map(([value, zh, en]) => ({ value, label: { zh, en } })),
    featured: item.featured,
  }));

export const SOLUTION_GROUP: Record<SolutionId, ShowcaseGroup> = {
  ecosystem: 'entertainment',
  'ai-artist': 'entertainment',
  'ai-drama': 'entertainment',
  'virtual-idol': 'entertainment',
  'anime-ip': 'entertainment',
  'story-commerce': 'brand',
  'brand-ip': 'brand',
  'corporate-ip': 'business',
  'digital-founder': 'business',
  'city-ip': 'city',
  'culture-ip': 'culture',
  'education-ip': 'education',
  'social-ip': 'social',
};

export const SHOWCASE_GROUP_LABELS: Record<ShowcaseGroup, LocalizedText> = {
  entertainment: { zh: '娱乐', en: 'Entertainment' },
  business: { zh: '企业', en: 'Business' },
  brand: { zh: '品牌', en: 'Brand' },
  city: { zh: '城市', en: 'City' },
  culture: { zh: '文化', en: 'Culture' },
  education: { zh: '教育', en: 'Education' },
  social: { zh: '社交', en: 'Social' },
};

export const SHOWCASE_CASES: ShowcaseCase[] = [
  ...make('ai-artist', [
    { id: 'tian', featured: true, category: ['音乐', 'Music'], tag: ['虚拟歌手', 'Virtual Singer'], name: ['星光小天', 'Starlight Tian'], description: ['次世代 AI 虚拟歌手，3 个月获得 50 万粉丝', 'Next-gen AI singer with 500K fans in 3 months'], image: 'case-xingguang-xiaotian', metrics: [['50万+', '粉丝', 'Followers'], ['1200万+', '播放', 'Plays'], ['80万+', '点赞', 'Likes']] },
    { id: 'nova', category: ['音乐', 'Music'], tag: ['AI 说唱', 'AI Rapper'], name: ['NOVA 夜航', 'NOVA Nightflight'], description: ['首张 AI 专辑登顶新歌榜，版权持续变现', 'Debut AI album topped new-release charts'], image: 'case-nova-night', metrics: [['32万+', '粉丝', 'Followers'], ['8 首', '上榜单曲', 'Chart Hits'], ['¥120万', '版权收入', 'Royalties']] },
    { id: 'linqi', category: ['影视', 'Film'], tag: ['AI 演员', 'AI Actor'], name: ['林栖', 'Lin Qi'], description: ['连续出演 3 部 AI 网剧的数字演员', 'Digital actor starring in three AI web series'], image: 'case-lin-qi', metrics: [['3 部', '主演作品', 'Lead Roles'], ['6800万', '播放', 'Views'], ['12 个', '品牌合作', 'Brand Deals']] },
    { id: 'mira', category: ['直播', 'Live'], tag: ['AI 主播', 'AI Host'], name: ['Mira', 'Mira'], description: ['日均直播 6 小时，多语言实时互动', 'Six hours of multilingual live hosting daily'], image: 'case-mira', metrics: [['6h', '日均直播', 'Daily Live'], ['18万', '在线峰值', 'Peak Viewers'], ['¥85万/月', '收入', 'Revenue']] },
  ]),
  ...make('ai-drama', [
    { id: 'echo', category: ['科幻', 'Sci-Fi'], tag: ['连续短剧', 'Series'], name: ['《零界回声》', 'Echoes of Zero'], description: ['一套角色资产连续生产 24 集科幻短剧', 'One character system produced 24 sci-fi episodes'], image: 'case-zero-echo', metrics: [['24 集', '连续生产', 'Episodes'], ['3.2亿', '播放', 'Views'], ['¥680万', '分账收入', 'Revenue']] },
    { id: 'fog', category: ['悬疑', 'Mystery'], tag: ['悬疑短剧', 'Mystery'], name: ['《雾港密档》', 'Fog Harbor Files'], description: ['AI 分镜驱动的港口悬疑连续剧', 'A harbor mystery driven by AI storyboards'], image: 'case-fog-harbor', metrics: [['36 集', '总集数', 'Episodes'], ['1.8亿', '播放', 'Views'], ['9.1', '用户评分', 'Rating']] },
    { id: 'jester', category: ['悬疑', 'Mystery'], tag: ['惊悚短剧', 'Thriller'], name: ['《午夜笑面人》', 'Midnight Jester'], description: ['高完播率的竖屏惊悚短剧', 'A vertical thriller with exceptional completion'], image: 'case-midnight-smile', metrics: [['18 集', '总集数', 'Episodes'], ['92%', '完播率', 'Completion'], ['45万', '追更用户', 'Followers']] },
    { id: 'neon', category: ['都市', 'Urban'], tag: ['剧情带货', 'Story Commerce'], name: ['《霓虹深夜》', 'Neon After Hours'], description: ['都市情感短剧自然植入 28 个品牌', 'Urban romance with 28 native brand placements'], image: 'case-neon-midnight', metrics: [['60 集', '总集数', 'Episodes'], ['¥1200万', '带货 GMV', 'GMV'], ['28 个', '品牌植入', 'Placements']] },
  ]),
  ...make('story-commerce', [
    { id: 'pomo', category: ['美妆', 'Beauty'], tag: ['剧情宇宙', 'Story Universe'], name: ['POMO 夏日剧情', 'POMO Summer Story'], description: ['三款产品串联成可追更的品牌栏目', 'Three products woven into an episodic brand show'], image: 'case-pomo-summer', metrics: [['¥3200万', '内容 GMV', 'GMV'], ['46 集', '剧情内容', 'Episodes'], ['8.6%', '转化率', 'Conversion']] },
    { id: 'lab', category: ['美妆', 'Beauty'], tag: ['剧情种草', 'Seeding Story'], name: ['《深夜实验室》', 'Midnight Lab'], description: ['精华产品化身剧情关键道具', 'A serum becomes the key prop of the story'], image: 'case-midnight-lab', metrics: [['¥860万', '销售额', 'Sales'], ['12.4%', '点击率', 'CTR'], ['3.5x', '投产比', 'ROI']] },
    { id: 'scent', category: ['香氛', 'Fragrance'], tag: ['悬疑带货', 'Mystery Commerce'], name: ['《香气侦探》', 'Scent Detective'], description: ['用嗅觉线索破案，带动香氛搜索暴涨', 'Scent-led mysteries boosted fragrance search'], image: 'case-scent-detective', metrics: [['¥1500万', '内容 GMV', 'GMV'], ['2400万', '播放', 'Views'], ['+210%', '品牌搜索', 'Search Lift']] },
    { id: 'gentle', category: ['香氛', 'Fragrance'], tag: ['男士品类', 'Menswear'], name: ['《绅士法则》', "Gentleman's Code"], description: ['职场剧情精准触达男士新客', 'Workplace stories reaching new male buyers'], image: 'case-gentleman-rules', metrics: [['¥620万', '销售额', 'Sales'], ['68%', '新客占比', 'New Buyers'], ['4.2x', '投产比', 'ROI']] },
  ]),
  ...make('virtual-idol', [
    { id: 'luna', category: ['歌手', 'Singer'], tag: ['虚拟歌姬', 'Virtual Diva'], name: ['LUNA-07', 'LUNA-07'], description: ['实时动捕与多语言直播建立全球粉丝圈', 'Real-time mocap and multilingual streams'], image: 'case-luna-07', metrics: [['420万', '核心粉丝', 'Core Fans'], ['2.1亿', '播放', 'Streams'], ['¥90万/月', '收入', 'Revenue']] },
    { id: 'moe', featured: true, category: ['主播', 'Streamer'], tag: ['虚拟偶像', 'Virtual Idol'], name: ['二次元萌酱', 'Moe-chan'], description: ['高人气虚拟偶像，直播观看量突破 100 万', 'Popular virtual idol with 1M+ live views'], image: 'case-erciyuan-moe', metrics: [['80万+', '粉丝', 'Followers'], ['100万+', '直播观看', 'Live Views'], ['¥40万/月', '收入', 'Revenue']] },
    { id: 'orbit', category: ['偶像团体', 'Group'], tag: ['虚拟女团', 'Idol Group'], name: ['星轨少女团', 'Orbit Girls'], description: ['五人虚拟女团完成 18 场线上演唱会', 'Five-member group with 18 virtual concerts'], image: 'case-star-orbit-group', metrics: [['5 人', '团体成员', 'Members'], ['18 场', '虚拟演唱会', 'Concerts'], ['650万', '应援互动', 'Fan Actions']] },
    { id: 'kira', category: ['歌手', 'Singer'], tag: ['电子音乐', 'Electronic'], name: ['KIRA 霓虹', 'KIRA Neon'], description: ['AI 作曲与虚拟舞台打造电子音乐偶像', 'AI-composed electronic idol on virtual stages'], image: 'case-kira-neon', metrics: [['26 首', '原创单曲', 'Originals'], ['3800万', '播放', 'Streams'], ['16 个', '音乐节', 'Festivals']] },
  ]),
  ...make('corporate-ip', [
    { id: 'nebula', category: ['代言人', 'Ambassador'], tag: ['数字代言人', 'Digital Ambassador'], name: ['星云科技代言人', 'Nebula Ambassador'], description: ['统一承载发布会、招聘与企业文化内容', 'One avatar for launches, hiring and culture'], image: 'case-nebula-spokesperson', metrics: [['+240%', '内容触达', 'Reach'], ['120+', '月产内容', 'Monthly Assets'], ['18 种', '语言', 'Languages']] },
    { id: 'aide', featured: true, category: ['吉祥物', 'Mascot'], tag: ['企业吉祥物', 'Mascot'], name: ['智能小助', 'Smart Aide'], description: ['科技公司品牌 IP，品牌认知度提升 300%', 'Tech brand IP that tripled brand awareness'], image: 'case-smart-helper', metrics: [['20万+', '粉丝', 'Followers'], ['45%', '互动率', 'Engagement'], ['+300%', '认知增长', 'Growth']] },
    { id: 'hr', category: ['数字员工', 'Digital Staff'], tag: ['招聘官', 'Recruiter'], name: ['小航 HR 官', 'Hang HR Agent'], description: ['7×24 小时讲解岗位并初筛候选人', 'Explains roles and screens candidates 24/7'], image: 'case-hr-officer', metrics: [['3.6万', '收到简历', 'Resumes'], ['-42%', '招聘成本', 'Hiring Cost'], ['24/7', '在线服务', 'Always On']] },
    { id: 'expo', category: ['数字员工', 'Digital Staff'], tag: ['展会讲解', 'Expo Guide'], name: ['数字讲解官', 'Expo Guide'], description: ['在全球展会以多语言讲解产品方案', 'Presents products in many languages at expos'], image: 'case-digital-guide', metrics: [['32 场', '覆盖展会', 'Expos'], ['1.2万', '有效线索', 'Leads'], ['+65%', '咨询转化', 'Conversion']] },
  ]),
  ...make('brand-ip', [
    { id: 'pomo', category: ['食品', 'Food'], tag: ['品牌角色', 'Brand Character'], name: ['POMO 角色宇宙', 'POMO Universe'], description: ['从包装延伸到剧情短片与联名商品', 'From packaging to story shorts and collabs'], image: 'case-pomo-universe', metrics: [['26 款', '联名产品', 'Collabs'], ['+86%', '复购率', 'Repurchase'], ['4800万', '曝光', 'Impressions']] },
    { id: 'panda', featured: true, category: ['潮玩', 'Designer Toy'], tag: ['品牌 IP', 'Brand IP'], name: ['品牌熊猫', 'Brand Panda'], description: ['知名品牌联名 IP，销售额增长 200%', 'Collab brand IP that grew sales by 200%'], image: 'case-brand-panda', metrics: [['+200%', '销售增长', 'Sales'], ['50+', '联名合作', 'Collabs'], ['5x', '投产比', 'ROI']] },
    { id: 'bunny', category: ['潮玩', 'Designer Toy'], tag: ['盲盒角色', 'Blind Box'], name: ['兔小绵', 'Bunny Mian'], description: ['角色故事带动盲盒系列持续售罄', 'Character stories kept blind boxes sold out'], image: 'case-rabbit-soft', metrics: [['12 季', '系列发售', 'Seasons'], ['98%', '售罄率', 'Sell-through'], ['36万', '会员', 'Members']] },
    { id: 'cat', category: ['生活方式', 'Lifestyle'], tag: ['产品人格', 'Product Persona'], name: ['喵伞先生', 'Mr. Umbrella Cat'], description: ['把雨具品牌变成有温度的城市角色', 'Turned a rainwear brand into a warm character'], image: 'case-umbrella-cat', metrics: [['+150%', '社媒增长', 'Social Growth'], ['18 城', '快闪活动', 'Pop-ups'], ['3.8x', '投产比', 'ROI']] },
  ]),
  ...make('city-ip', [
    { id: 'neonbay', category: ['夜游', 'Night Tour'], tag: ['文旅官', 'Tourism Guide'], name: ['霓虹湾文旅官', 'Neon Bay Guide'], description: ['串联夜游、美食与城市节庆内容', 'Connects night tours, food and festivals'], image: 'case-neon-bay-guide', metrics: [['7.6亿', '传播曝光', 'Impressions'], ['+38%', '夜间消费', 'Night Spend'], ['12 种', '语言', 'Languages']] },
    { id: 'jiangnan', featured: true, category: ['滨江', 'Riverside'], tag: ['城市代言人', 'City Ambassador'], name: ['江南小姐姐', 'Jiangnan Muse'], description: ['城市文旅 IP，带动旅游收入增长 50%', 'City IP that lifted tourism revenue by 50%'], image: 'case-jiangnan-lady', metrics: [['+50%', '游客增长', 'Tourists'], ['¥200万', '文创收入', 'Revenue'], ['90%', '好感度', 'Favorability']] },
    { id: 'cloud', category: ['都市', 'Metro'], tag: ['智能导览', 'AI Guide'], name: ['云端城市向导', 'Cloud City Guide'], description: ['为游客实时规划路线并讲解地标', 'Plans routes and explains landmarks live'], image: 'case-cloud-guide', metrics: [['260万', '导览服务', 'Guided Trips'], ['4.8', '用户评分', 'Rating'], ['-30%', '咨询压力', 'Support Load']] },
    { id: 'skyline', category: ['都市', 'Metro'], tag: ['海外传播', 'Global Reach'], name: ['天际线漫游官', 'Skyline Rover'], description: ['以多语言短视频向全球介绍城市', 'Introduces the city worldwide in short videos'], image: 'case-skyline-rover', metrics: [['46 国', '海外触达', 'Countries'], ['1.3亿', '播放', 'Views'], ['+27%', '入境游客', 'Inbound']] },
  ]),
  ...make('digital-founder', [
    { id: 'zhou', category: ['科技', 'Tech'], tag: ['数字分身', 'Digital Twin'], name: ['周远数字分身', 'Zhou Yuan Twin'], description: ['持续输出行业观点与多语言企业动态', 'Always-on insight and multilingual updates'], image: 'case-zhou-yuan', metrics: [['7×24h', '持续输出', 'Always On'], ['860万', '全网粉丝', 'Followers'], ['9 种', '语言', 'Languages']] },
    { id: 'wang', featured: true, category: ['投资', 'Investing'], tag: ['创始人 IP', 'Founder IP'], name: ['创业导师王', 'Mentor Wang'], description: ['知名企业家 IP，影响力覆盖百万创业者', 'Entrepreneur IP reaching a million founders'], image: 'case-startup-mentor', metrics: [['100万+', '影响力', 'Influence'], ['50+', '活动', 'Events'], ['5000+', '学员', 'Mentees']] },
    { id: 'lin', category: ['消费', 'Consumer'], tag: ['品牌主理人', 'Brand Founder'], name: ['林总品牌说', 'Founder Lin Talks'], description: ['创始人讲品牌故事，直接拉动新品销售', 'Founder storytelling that drives launches'], image: 'case-lin-brand', metrics: [['¥5600万', '新品 GMV', 'Launch GMV'], ['320 条', '品牌内容', 'Videos'], ['+72%', '品牌信任', 'Trust']] },
    { id: 'ceo', category: ['科技', 'Tech'], tag: ['CEO 栏目', 'CEO Show'], name: ['硬核 CEO 实验室', 'Hardcore CEO Lab'], description: ['每周解读技术趋势的数字化 CEO 栏目', 'A weekly digital CEO show on tech trends'], image: 'case-hardcore-ceo', metrics: [['52 期', '年度栏目', 'Episodes'], ['2.4亿', '播放', 'Views'], ['1800+', '商务线索', 'Leads']] },
  ]),
  ...make('culture-ip', [
    { id: 'shanhai', category: ['神话', 'Mythology'], tag: ['神话复兴', 'Myth Revival'], name: ['山海异兽', 'Mythical Beasts'], description: ['用 AI 叙事重构山海经文化符号', 'Classic myths reimagined through AI stories'], image: 'case-shanhai', metrics: [['8600万', '内容播放', 'Views'], ['42 种', '异兽角色', 'Creatures'], ['¥900万', '文创收入', 'Merch']] },
    { id: 'envoy', featured: true, category: ['非遗', 'Heritage'], tag: ['文化 IP', 'Culture IP'], name: ['文化使者', 'Culture Envoy'], description: ['传统文化数字化，传播覆盖全球', 'Digitized heritage with global reach'], image: 'case-culture-envoy', metrics: [['全球', '传播覆盖', 'Reach'], ['500+', '内容', 'Content'], ['5000万+', '播放', 'Views']] },
    { id: 'opera', category: ['戏曲', 'Opera'], tag: ['数字戏曲', 'Digital Opera'], name: ['数字梅韵', 'Digital Mei Opera'], description: ['让经典戏曲以互动短剧走进年轻人', 'Classic opera retold as interactive shorts'], image: 'case-digital-opera', metrics: [['36 出', '经典剧目', 'Classics'], ['68%', '年轻观众', 'Gen Z Share'], ['2100万', '播放', 'Views']] },
    { id: 'hanfu', category: ['非遗', 'Heritage'], tag: ['服饰文化', 'Costume Culture'], name: ['汉服时光馆', 'Hanfu Time Hall'], description: ['数字讲解员带观众穿越千年服饰史', 'A guide through a thousand years of costume'], image: 'case-hanfu-hall', metrics: [['120 套', '数字服饰', 'Costumes'], ['86万', '线上观展', 'Visitors'], ['+44%', '文创销售', 'Merch Sales']] },
  ]),
  ...make('education-ip', [
    { id: 'socrates', category: ['K12', 'K12'], tag: ['AI 学伴', 'AI Study Buddy'], name: ['苏格拉底学伴', 'Socrates Buddy'], description: ['讲解、练习反馈与个性化学习规划', 'Explanations, feedback and study plans'], image: 'case-socrates', metrics: [['92%', '课程完成率', 'Completion'], ['38万', '学生', 'Students'], ['+23 分', '平均提分', 'Score Lift']] },
    { id: 'prof', featured: true, category: ['职业教育', 'Career'], tag: ['教育导师', 'AI Tutor'], name: ['AI 教授', 'AI Professor'], description: ['在线教育平台明星导师，服务 10 万+ 学生', 'Star online mentor serving 100K+ learners'], image: 'case-ai-professor', metrics: [['10万+', '学生', 'Students'], ['200+', '课程', 'Courses'], ['4.9/5', '评分', 'Rating']] },
    { id: 'lingo', category: ['语言', 'Language'], tag: ['口语教练', 'Speaking Coach'], name: ['Lingo 口语教练', 'Lingo Coach'], description: ['实时纠音与情景对话训练', 'Live pronunciation and role-play practice'], image: 'case-lingo-coach', metrics: [['16 种', '语言', 'Languages'], ['1200万', '对话练习', 'Sessions'], ['+41%', '口语提升', 'Fluency']] },
    { id: 'code', category: ['K12', 'K12'], tag: ['编程启蒙', 'Coding Mentor'], name: ['编程星球导师', 'Code Planet Mentor'], description: ['用闯关故事教孩子学习编程', 'Teaches kids coding through quest stories'], image: 'case-coding-planet', metrics: [['15万', '小学员', 'Kids'], ['300+', '闯关任务', 'Quests'], ['96%', '家长满意', 'Parent CSAT']] },
  ]),
  ...make('anime-ip', [
    { id: 'zero', category: ['番剧', 'Series'], tag: ['互动番剧', 'Interactive'], name: ['零界纪元', 'Zero Realm Era'], description: ['观众投票影响剧情并同步开发游戏', 'Audience votes shape a story and game'], image: 'case-zero-era', metrics: [['18 集', '互动番剧', 'Episodes'], ['940万', '剧情投票', 'Votes'], ['3 款', '联动游戏', 'Games']] },
    { id: 'seabreeze', category: ['衍生品', 'Merch'], tag: ['手办衍生', 'Figures'], name: ['海风冒险团', 'Sea Breeze Crew'], description: ['角色设定直出手办与周边开发', 'Character sheets turned straight into figures'], image: 'case-sea-breeze', metrics: [['64 款', '衍生商品', 'SKUs'], ['¥2800万', '授权收入', 'Licensing'], ['22 家', '合作厂商', 'Partners']] },
    { id: 'shelf', category: ['衍生品', 'Merch'], tag: ['收藏宇宙', 'Collectibles'], name: ['次元收藏馆', 'Dimension Vault'], description: ['角色宇宙沉淀为高价值收藏系列', 'A character world built into collectibles'], image: 'case-collector-hall', metrics: [['8 个', '收藏系列', 'Collections'], ['26万', '藏家', 'Collectors'], ['92%', '复购率', 'Repurchase']] },
    { id: 'mecha', category: ['游戏联动', 'Game Tie-in'], tag: ['机甲世界', 'Mecha World'], name: ['机甲纪元', 'Mecha Era'], description: ['从世界观到动画、游戏的一体化开发', 'From world-building to anime and games'], image: 'case-mecha-era', metrics: [['120+', '世界观设定', 'Lore Entries'], ['4200万', '预告播放', 'Trailer Views'], ['85万', '游戏预约', 'Pre-registers']] },
  ]),
  ...make('social-ip', [
    { id: 'momo', category: ['社群', 'Community'], tag: ['共创官', 'Co-Creator'], name: ['MOMO 共创官', 'MOMO Co-Creator'], description: ['陪伴用户、组织活动并沉淀社群洞察', 'Supports users, runs events, captures insight'], image: 'case-momo', metrics: [['+68%', '社群活跃', 'Engagement'], ['1200 场', '社群活动', 'Events'], ['48万', '成员', 'Members']] },
    { id: 'warm', category: ['陪伴', 'Companion'], tag: ['情感陪伴', 'Companion'], name: ['暖暖陪伴官', 'Nuan Companion'], description: ['记住偏好与情绪的长期陪伴角色', 'A companion that remembers mood and taste'], image: 'case-warm-companion', metrics: [['42 分钟', '日均对话', 'Daily Chat'], ['76%', '次月留存', 'Retention'], ['4.9', '用户评分', 'Rating']] },
    { id: 'butler', category: ['会员服务', 'Membership'], tag: ['会员管家', 'Concierge'], name: ['小Q 会员管家', 'Q Concierge'], description: ['把客服升级为有人格的会员服务', 'Customer service with a real personality'], image: 'case-q-butler', metrics: [['86%', '自助解决', 'Self-Serve'], ['+31%', '会员续费', 'Renewal'], ['-55%', '服务成本', 'Service Cost']] },
    { id: 'radio', category: ['陪伴', 'Companion'], tag: ['夜聊电台', 'Night Radio'], name: ['夜聊电台', 'Night Talk Radio'], description: ['深夜陪伴主播与听众实时语音互动', 'A late-night host talking with listeners live'], image: 'case-night-radio', metrics: [['320万', '收听', 'Listeners'], ['18万', '语音互动', 'Voice Chats'], ['¥36万/月', '会员收入', 'Revenue']] },
  ]),
];

export const SOLUTION_SHOWCASE_COPY: Partial<Record<SolutionId, { title: LocalizedText; subtitle: LocalizedText }>> = {
  'ai-drama': { title: { zh: '这些 AI 短剧，正在被追更', en: 'AI Dramas Audiences Binge' }, subtitle: { zh: '从一个创意到持续更新的短剧宇宙', en: 'From one idea to an ever-growing drama universe' } },
  'story-commerce': { title: { zh: '让剧情，自然地卖出商品', en: 'Stories That Sell Naturally' }, subtitle: { zh: '品牌用剧情带货实现内容与转化双增长', en: 'Brands growing both content and conversion' } },
  'virtual-idol': { title: { zh: '看看这些闪耀的虚拟偶像', en: 'Virtual Idols That Shine' }, subtitle: { zh: '从角色诞生到全球粉丝社群', en: 'From character birth to global fandom' } },
  'corporate-ip': { title: { zh: '企业正在拥有自己的数字形象', en: 'Companies With Digital Faces' }, subtitle: { zh: '代言人、吉祥物与数字员工的真实成效', en: 'Results from ambassadors, mascots and digital staff' } },
  'brand-ip': { title: { zh: '让人记住并爱上的品牌角色', en: 'Brand Characters People Love' }, subtitle: { zh: '品牌角色带来的增长、联名与复购', en: 'Growth, collabs and repurchase driven by characters' } },
  'city-ip': { title: { zh: '会说话的城市，正在被看见', en: 'Cities That Speak for Themselves' }, subtitle: { zh: '城市数字代言人带动文旅增长', en: 'Digital city ambassadors driving tourism growth' } },
  'digital-founder': { title: { zh: '创始人的影响力，被持续放大', en: 'Founder Influence, Amplified' }, subtitle: { zh: '数字创始人让观点 7×24 小时传播', en: 'Digital founders sharing insight around the clock' } },
  'culture-ip': { title: { zh: '传统文化，正在重新流行', en: 'Heritage, Trending Again' }, subtitle: { zh: '数字化让文化符号走进新一代', en: 'Digital storytelling for a new generation' } },
  'education-ip': { title: { zh: '这些 AI 导师，正在改变学习', en: 'AI Mentors Changing Learning' }, subtitle: { zh: '专业知识转化为会互动的学习体验', en: 'Expertise turned into interactive learning' } },
  'anime-ip': { title: { zh: '从一个角色，长成一个世界', en: 'From One Character to a World' }, subtitle: { zh: '番剧、衍生品与游戏联动的完整 IP 宇宙', en: 'Series, merchandise and games in one universe' } },
  'social-ip': { title: { zh: '真正懂用户的数字角色', en: 'Characters That Truly Connect' }, subtitle: { zh: '陪伴、社群与会员服务的智能体案例', en: 'Companion, community and membership agents' } },
};

export const getSolutionCases = (solution: SolutionId) => SHOWCASE_CASES.filter(item => item.solution === solution);

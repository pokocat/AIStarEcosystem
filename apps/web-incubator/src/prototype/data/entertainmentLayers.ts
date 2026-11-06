import type React from 'react';
import { Crown, Film, Heart, Star } from 'lucide-react';
import { ROLE_GROUPS } from './roleIpSystem';

export interface EcosystemRole {
  zh: string;
  en: string;
  descZh: string;
  descEn: string;
  statZh: string;
  statEn: string;
}

/** One collaboration layer around the AI artist in the entertainment IP galaxy. */
export interface EcosystemLayer {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  zh: string;
  en: string;
  subZh: string;
  subEn: string;
  count: string;
  countEn: string;
  color: string;
  color2: string;
  /** Position of the layer around the centre, in degrees (0 = right, 90 = bottom). */
  angle: number;
  /** 'in' = this layer feeds the artist; 'out' = the artist creates value for this layer. */
  direction: 'in' | 'out';
  flowZh: string;
  flowEn: string;
  roles: EcosystemRole[];
  tagsZh: string[];
  tagsEn: string[];
  caseZh: string;
  caseEn: string;
  descZh: string;
  descEn: string;
  chainZh: string;
  chainEn: string;
  metric: string;
  metricEn: string;
  metricZh: string;
  metricLabelEn: string;
  image: string;
}

// Galaxy layers share their role line-up with the 角色 IP 体系 section, so counts and names never drift apart.
const names = (i: number, lang: 'zh' | 'en') => ROLE_GROUPS[i].roles.map(r => r.name[lang]).join(lang === 'zh' ? '、' : ', ');
const count = (i: number, zh: string, en: string) => ({ count: `${ROLE_GROUPS[i].roles.length} ${zh}`, countEn: `${ROLE_GROUPS[i].roles.length} ${en}` });

const role = (zh: string, en: string, descZh: string, descEn: string, statZh: string, statEn: string): EcosystemRole =>
  ({ zh, en, descZh, descEn, statZh, statEn });

export const CENTER_ARTIST = {
  name: 'NEON V',
  image: 'https://images.unsplash.com/photo-1767661667474-4f2a197c9a51?auto=format&fit=crop&w=400&q=85',
};

export const ENTERTAINMENT_LAYERS: EcosystemLayer[] = [
  {
    icon: Star, zh: '台前数字明星', en: 'Digital Stars',
    subZh: names(0, 'zh'), subEn: names(0, 'en'),
    ...count(0, '类角色', 'roles'), color: '#ec4899', color2: '#f43f5e',
    angle: 90, direction: 'out', flowZh: '多领域演出', flowEn: 'Performs across formats',
    roles: [
      role('歌手', 'Singer', '原创单曲、翻唱与虚拟演唱会', 'Originals, covers and virtual concerts', '26 首单曲', '26 singles'),
      role('演员', 'Actor', '出演 AI 短剧与网剧', 'Stars in AI dramas and web series', '3 部主演', '3 lead roles'),
      role('主播主持', 'Host', '多语言直播与粉丝互动', 'Multilingual livestreams and fan chat', '6h 日均直播', '6h daily live'),
      role('舞者', 'Dancer', '编舞挑战与舞台表演', 'Dance challenges and stage shows', '1200万 播放', '12M views'),
    ],
    tagsZh: ['形象与声线', '才艺成长', '多领域内容'], tagsEn: ['Identity & Voice', 'Talent Growth', 'Multi-format Content'],
    caseZh: 'NEON V AI 艺人矩阵', caseEn: 'NEON V AI Artist Matrix',
    descZh: '以一位 AI 主唱为核心，延展音乐、短剧、直播、综艺与品牌合作。', descEn: 'One AI vocalist expands into music, drama, livestreaming, variety and brand work.',
    chainZh: 'AI 艺人 → 音乐 · 短剧 · 直播', chainEn: 'AI artist → Music · Drama · Live',
    metric: '8600万', metricEn: '86M', metricZh: '全网播放', metricLabelEn: 'Total Views',
    image: 'https://images.unsplash.com/photo-1767661667474-4f2a197c9a51?auto=format&fit=crop&w=1200&q=85',
  },
  {
    icon: Film, zh: '幕后创作团队', en: 'Creative Team',
    subZh: names(1, 'zh'), subEn: names(1, 'en'),
    ...count(1, '类岗位', 'roles'), color: '#a855f7', color2: '#6366f1',
    angle: -90, direction: 'in', flowZh: '内容供给', flowEn: 'Feeds content',
    roles: [
      role('制作人', 'Producer', '统筹企划、音乐与发行节奏', 'Leads concepts, music and release cadence', '120+ 月产内容', '120+ monthly assets'),
      role('导演', 'Director', '分镜、镜头与视觉风格', 'Storyboards, shots and visual style', '36 集短剧', '36 episodes'),
      role('编剧', 'Writer', '人设故事与剧情连载', 'Character arcs and serial stories', '8 条故事线', '8 storylines'),
      role('编舞', 'Choreographer', '舞台动作与挑战编排', 'Stage moves and dance challenges', '40+ 编舞', '40+ routines'),
    ],
    tagsZh: ['创意策划', '内容生产', '制作协同'], tagsEn: ['Creative Direction', 'Production', 'Collaboration'],
    caseZh: 'NOVA 虚拟制作团队', caseEn: 'NOVA Virtual Production Team',
    descZh: '数字制作人、导演和编剧围绕艺人设定，持续产出音乐、短剧与舞台内容。', descEn: 'Digital producers, directors and writers create music, drama and stage content around the artist.',
    chainZh: '制作人 · 导演 → AI 艺人 → 新作品', chainEn: 'Producer · Director → AI artist → New releases',
    metric: '120+', metricEn: '120+', metricZh: '月产内容', metricLabelEn: 'Monthly Assets',
    image: 'https://images.unsplash.com/photo-1790619451922-feced14b555c?auto=format&fit=crop&w=1200&q=85',
  },
  {
    icon: Crown, zh: '娱乐经营者', en: 'Entertainment Operators',
    subZh: names(2, 'zh'), subEn: names(2, 'en'),
    ...count(2, '类角色', 'roles'), color: '#f59e0b', color2: '#f97316',
    angle: 180, direction: 'in', flowZh: '定位与经营', flowEn: 'Steers the business',
    roles: [
      role('数字创始人', 'Digital Founder', '代表厂牌发声，连接资本与合作伙伴', 'Voices the label and connects partners', '7×24h 经营表达', '24/7 presence'),
      role('经纪人', 'Manager', '艺人定位、档期与商务谈判', 'Positioning, scheduling and deals', '12 个品牌合作', '12 brand deals'),
      role('厂牌主理人', 'Label Head', '艺人矩阵与发行策略', 'Artist roster and release strategy', '8 位签约艺人', '8 signed artists'),
      role('MCN 掌门人', 'MCN Lead', '账号矩阵与流量运营', 'Account matrix and traffic operations', '150+ 渠道', '150+ channels'),
    ],
    tagsZh: ['艺人定位', '经纪管理', '厂牌经营'], tagsEn: ['Positioning', 'Management', 'Label Operations'],
    caseZh: '星河娱乐数字创始人', caseEn: 'Galaxy Entertainment Digital Founder',
    descZh: '娱乐公司创始人数字分身持续发布行业观点、艺人动态与厂牌内容，并连接商务合作。', descEn: 'A digital entertainment founder shares insight, artist updates and label content while supporting partnerships.',
    chainZh: '数字创始人 → 经纪团队 → 厂牌合作', chainEn: 'Digital founder → Management → Label deals',
    metric: '7×24h', metricEn: '24/7', metricZh: '经营表达', metricLabelEn: 'Always-On Leadership',
    image: 'https://images.unsplash.com/photo-1633511069490-76aa4c284518?auto=format&fit=crop&w=1200&q=85',
  },
  {
    icon: Heart, zh: '商业与粉丝生态', en: 'Commerce & Fandom',
    subZh: names(3, 'zh'), subEn: names(3, 'en'),
    ...count(3, '类连接', 'connections'), color: '#06b6d4', color2: '#14b8a6',
    angle: 0, direction: 'out', flowZh: '流量与收益', flowEn: 'Turns reach into value',
    roles: [
      role('品牌官', 'Brand Partner', '代言、联名与剧情植入', 'Endorsements, collabs and placements', '¥3200万 GMV', '¥32M GMV'),
      role('粉丝代表', 'Fan Lead', '应援企划与共创内容', 'Fan projects and co-creation', '420万 核心粉丝', '4.2M core fans'),
      role('社群运营', 'Community Ops', '会员、话题与线上活动', 'Memberships, topics and events', '+68% 活跃度', '+68% engagement'),
      role('应援官', 'Support Lead', '打榜、投票与演出应援', 'Charts, votes and show support', '18 场演出', '18 shows'),
    ],
    tagsZh: ['粉丝经营', '品牌合作', '演出与授权'], tagsEn: ['Fan Operations', 'Brand Deals', 'Shows & Licensing'],
    caseZh: 'LUNA-07 粉丝商业生态', caseEn: 'LUNA-07 Fan & Commerce Ecosystem',
    descZh: '围绕虚拟偶像连接会员、应援、演出、联名、授权与衍生品，形成长期增长飞轮。', descEn: 'Memberships, fan support, shows, collaborations, licensing and merchandise form a lasting growth loop.',
    chainZh: 'AI 艺人 → 粉丝会员 → 品牌联名 · 授权', chainEn: 'AI artist → Members → Brand collabs · Licensing',
    metric: '420万', metricEn: '4.2M', metricZh: '核心粉丝', metricLabelEn: 'Core Fans',
    image: 'https://images.unsplash.com/photo-1630754157718-8b7b3aaa57e2?auto=format&fit=crop&w=1200&q=85',
  },
];

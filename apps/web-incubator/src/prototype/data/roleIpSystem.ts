/**
 * 角色 IP 体系 — the AI entertainment ecosystem as four role groups (same layers as the
 * 「AI 娱乐 IP 宇宙」 galaxy). Every role can be incubated as its own AI IP.
 *
 * All roles share one 6-dimension IP value model so they can be compared across groups;
 * each role also lists its own specialist skills (digital-star skills are workbench talent caps)
 * and the roles it most often works with in the ecosystem.
 */
import type React from 'react';
import { Clapperboard, Coins, Crown, Fingerprint, Film, Heart, Layers, Megaphone, Network, Star } from 'lucide-react';

type LT = { zh: string; en: string };
type Icon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
const L = (zh: string, en: string): LT => ({ zh, en });

/** The shared IP value model. */
export const IP_AXES: Array<{ name: LT; desc: LT; icon: Icon }> = [
  { name: L('辨识度', 'Recognition'), desc: L('形象与人设是否让人一眼记住', 'How memorable the look and persona are'), icon: Fingerprint },
  { name: L('内容力', 'Content'), desc: L('稳定产出优质内容的能力', 'Ability to ship good content steadily'), icon: Clapperboard },
  { name: L('号召力', 'Pull'), desc: L('聚集与调动粉丝的能力', 'Ability to gather and move fans'), icon: Megaphone },
  { name: L('商业力', 'Commercial'), desc: L('把影响力转化为收入的能力', 'Turning influence into revenue'), icon: Coins },
  { name: L('延展力', 'Extensibility'), desc: L('跨品类、跨形态延展的空间', 'Room to expand across formats'), icon: Layers },
  { name: L('协同力', 'Synergy'), desc: L('带动生态里其他角色的能力', 'How much it lifts other roles'), icon: Network },
];

export interface RoleIp {
  name: LT;
  tagline: LT;
  /** IP value on the six IP_AXES. */
  ip: number[];
  /** Role-specific skills: [name, level]. */
  skills: Array<[LT, number]>;
  /** English names of the roles it works with most (resolved across all groups). */
  partners: string[];
  outputs: LT[];
  value: LT[];
  start: LT;
}
export interface RoleGroup { name: LT; sub: LT; icon: Icon; color: string; skillsAreCaps: boolean; roles: RoleIp[] }

const R = (name: LT, tagline: LT, ip: number[], skills: Array<[LT, number]>, partners: string[], outputs: LT[], value: LT[], start: LT): RoleIp =>
  ({ name, tagline, ip, skills, partners, outputs, value, start });

export const ROLE_GROUPS: RoleGroup[] = [
  {
    name: L('台前数字明星', 'Digital Stars'), sub: L('站在聚光灯下的 AI 艺人', 'AI artists in the spotlight'), icon: Star, color: '#ec4899', skillsAreCaps: true,
    roles: [
      R(L('歌手', 'Singer'), L('以声音征服舞台', 'Wins the stage with voice'), [92, 85, 90, 88, 80, 75],
        [[L('唱功', 'Vocals'), 100], [L('舞蹈', 'Dance'), 80], [L('综艺感', 'Variety'), 60]], ['Songwriter', 'Producer', 'Fan Representative'],
        [L('原创单曲', 'Original singles'), L('MV', 'Music videos'), L('虚拟演唱会', 'Virtual concerts')], [L('音乐版权', 'Music royalties'), L('数字专辑', 'Digital albums'), L('演出', 'Live shows')], L('首支单曲 + MV', 'Debut single + MV')),
      R(L('演员', 'Actor'), L('在每个角色里重生', 'Reborn in every role'), [88, 90, 82, 85, 86, 78],
        [[L('演技', 'Acting'), 100], [L('喜剧', 'Comedy'), 80], [L('主持', 'Hosting'), 70]], ['Screenwriter', 'Director', 'Brand Partner'],
        [L('短剧', 'Short dramas'), L('网剧', 'Web series'), L('广告片', 'Commercials')], [L('平台分账', 'Revenue share'), L('剧中植入', 'Placements'), L('代言', 'Endorsements')], L('一部 10 集短剧', 'A 10-episode short drama')),
      R(L('偶像', 'Idol'), L('为粉丝而闪耀', 'Shines for the fans'), [95, 80, 98, 90, 82, 85],
        [[L('唱功', 'Vocals'), 95], [L('舞蹈', 'Dance'), 90], [L('综艺感', 'Variety'), 85]], ['Choreographer', 'Cheer Captain', 'Fan Representative'],
        [L('打歌舞台', 'Stage performances'), L('粉丝直播', 'Fan streams'), L('日常 Vlog', 'Daily vlogs')], [L('会员订阅', 'Memberships'), L('应援', 'Fan support'), L('周边', 'Merch')], L('出道舞台 + 见面直播', 'Debut stage + fan-meet stream')),
      R(L('舞者', 'Dancer'), L('用身体讲故事', 'Tells stories through movement'), [86, 88, 84, 76, 78, 80],
        [[L('舞蹈', 'Dance'), 100], [L('唱功', 'Vocals'), 80], [L('综艺感', 'Variety'), 70]], ['Choreographer', 'Stylist', 'Community Manager'],
        [L('舞蹈短视频', 'Dance shorts'), L('舞蹈教学', 'Dance tutorials'), L('舞台表演', 'Stage shows')], [L('品牌挑战赛', 'Brand challenges'), L('舞蹈课程', 'Dance courses')], L('一支原创舞蹈挑战', 'An original dance challenge')),
      R(L('主播主持', 'Host'), L('掌控全场节奏', 'Owns the room'), [80, 92, 85, 94, 80, 88],
        [[L('主持', 'Hosting'), 100], [L('综艺感', 'Variety'), 90], [L('喜剧', 'Comedy'), 80]], ['Brand Partner', 'MCN Leader', 'Community Manager'],
        [L('直播栏目', 'Live shows'), L('访谈', 'Interviews'), L('发布会', 'Launch events')], [L('直播带货', 'Live commerce'), L('活动主持', 'Event hosting')], L('每周固定直播栏目', 'A weekly live show')),
      R(L('综艺咖', 'Entertainer'), L('天生的气氛制造者', 'A born mood-maker'), [90, 94, 88, 86, 92, 82],
        [[L('喜剧', 'Comedy'), 100], [L('综艺感', 'Variety'), 100], [L('主持', 'Hosting'), 85]], ['Screenwriter', 'Director', 'Cheer Captain'],
        [L('整活短视频', 'Comedy shorts'), L('挑战赛', 'Challenges'), L('直播', 'Live streams')], [L('直播打赏', 'Live tips'), L('品牌植入', 'Brand integrations')], L('一组系列短视频', 'A short-video series')),
    ],
  },
  {
    name: L('幕后创作团队', 'Creative Team'), sub: L('为艺人持续供给内容的 AI 创作者', 'AI creators who feed the artists'), icon: Film, color: '#a855f7', skillsAreCaps: false,
    roles: [
      R(L('制作人', 'Producer'), L('统筹企划与发行节奏', 'Runs concepts and release cadence'), [72, 90, 60, 85, 88, 98],
        [[L('企划统筹', 'Planning'), 95], [L('发行节奏', 'Release cadence'), 90], [L('预算管理', 'Budgeting'), 85]], ['Singer', 'Songwriter', 'Label Head'],
        [L('企划案', 'Concepts'), L('发行排期', 'Release plans'), L('专辑统筹', 'Album production')], [L('制作分成', 'Production share'), L('版权分成', 'Rights share')], L('为一位 AI 艺人做首张 EP', 'A first EP for one AI artist')),
      R(L('导演', 'Director'), L('把剧本拍成画面', 'Turns scripts into pictures'), [78, 95, 65, 82, 90, 92],
        [[L('镜头语言', 'Visual language'), 95], [L('分镜设计', 'Storyboarding'), 90], [L('剪辑节奏', 'Editing rhythm'), 88]], ['Actor', 'Screenwriter', 'Stylist'],
        [L('分镜', 'Storyboards'), L('镜头方案', 'Shot plans'), L('成片', 'Final cuts')], [L('导演费', 'Directing fees'), L('剧集分账', 'Series revenue share')], L('一部 3 集短剧', 'A 3-episode drama')),
      R(L('编剧', 'Screenwriter'), L('用故事留住观众', 'Keeps viewers with story'), [70, 98, 62, 80, 92, 86],
        [[L('叙事结构', 'Structure'), 98], [L('人物塑造', 'Characters'), 95], [L('对白', 'Dialogue'), 90]], ['Actor', 'Director', 'Entertainer'],
        [L('故事大纲', 'Outlines'), L('分集剧本', 'Episode scripts'), L('人物小传', 'Character bios')], [L('剧本授权', 'Script licensing'), L('剧集分账', 'Series revenue share')], L('10 集竖屏短剧剧本', 'A 10-episode vertical script')),
      R(L('词曲作者', 'Songwriter'), L('写出抓耳的旋律', 'Writes hooks that stick'), [75, 92, 68, 84, 85, 88],
        [[L('作曲', 'Composition'), 93], [L('作词', 'Lyrics'), 90], [L('编曲', 'Arrangement'), 82]], ['Singer', 'Producer', 'Idol'],
        [L('词曲', 'Songs'), L('编曲 Demo', 'Arrangement demos'), L('歌词海报', 'Lyric posters')], [L('词曲版权', 'Publishing royalties'), L('翻唱授权', 'Cover licensing')], L('一首主题曲 Demo', 'A theme-song demo')),
      R(L('编舞', 'Choreographer'), L('让动作成为记忆点', 'Makes moves memorable'), [76, 88, 72, 78, 82, 90],
        [[L('编舞创作', 'Choreography'), 92], [L('教学拆解', 'Teaching'), 88], [L('舞台调度', 'Staging'), 85]], ['Dancer', 'Idol', 'Fan Representative'],
        [L('原创编舞', 'Choreography'), L('教学拆解', 'Tutorials'), L('挑战赛动作', 'Challenge moves')], [L('编舞授权', 'Choreo licensing'), L('舞蹈课程', 'Courses')], L('一支 15 秒挑战舞', 'A 15-second challenge dance')),
      R(L('造型师', 'Stylist'), L('定义艺人的视觉', 'Defines the look'), [82, 84, 66, 80, 86, 88],
        [[L('形象设计', 'Look design'), 98], [L('服装搭配', 'Wardrobe'), 92], [L('视觉统一', 'Visual consistency'), 90]], ['Idol', 'Actor', 'Brand Partner'],
        [L('形象设定', 'Look design'), L('服装造型', 'Wardrobe'), L('写真海报', 'Photo posters')], [L('造型服务', 'Styling fees'), L('联名周边', 'Collab merch')], L('一套出道造型', 'A debut look')),
    ],
  },
  {
    name: L('娱乐经营者', 'Entertainment Operators'), sub: L('定方向、找资源、做经营的 AI 掌舵人', 'AI leaders who steer the business'), icon: Crown, color: '#f59e0b', skillsAreCaps: false,
    roles: [
      R(L('数字创始人', 'Digital Founder'), L('以观点经营个人品牌', 'Builds a brand on ideas'), [94, 86, 88, 92, 84, 82],
        [[L('观点输出', 'Point of view'), 96], [L('行业洞察', 'Industry insight'), 92], [L('公众表达', 'Public speaking'), 90]], ['Manager', 'MCN Leader', 'Brand Partner'],
        [L('观点口播', 'Opinion talks'), L('行业演讲', 'Keynotes'), L('访谈切片', 'Interview clips')], [L('商务线索', 'Business leads'), L('咨询', 'Consulting'), L('品牌溢价', 'Brand premium')], L('每周一条观点口播', 'One opinion talk a week')),
      R(L('经纪人', 'Manager'), L('为艺人找到对的合作', 'Finds the right deals'), [68, 70, 72, 96, 85, 95],
        [[L('商务谈判', 'Negotiation'), 96], [L('艺人规划', 'Career planning'), 92], [L('资源对接', 'Matchmaking'), 92]], ['Singer', 'Actor', 'Brand Partner'],
        [L('商务排期', 'Deal schedules'), L('合作方案', 'Partnership plans'), L('艺人规划', 'Career plans')], [L('经纪佣金', 'Commission'), L('商单分成', 'Deal share')], L('谈下首个品牌合作', 'Close a first brand deal')),
      R(L('厂牌主理人', 'Label Head'), L('打造有风格的厂牌', 'Builds a label with a sound'), [88, 85, 80, 90, 88, 92],
        [[L('风格定位', 'Positioning'), 92], [L('艺人签约', 'A&R'), 88], [L('版权运营', 'Catalogue'), 85]], ['Producer', 'Singer', 'Songwriter'],
        [L('厂牌企划', 'Label concept'), L('艺人矩阵', 'Artist roster'), L('合辑', 'Compilations')], [L('版权收入', 'Catalogue royalties'), L('厂牌授权', 'Label licensing')], L('签下 3 位风格统一的 AI 艺人', 'Sign 3 AI artists with one sound')),
      R(L('MCN 掌门人', 'MCN Leader'), L('规模化运营艺人矩阵', 'Runs rosters at scale'), [80, 94, 86, 95, 90, 96],
        [[L('矩阵运营', 'Matrix ops'), 95], [L('数据投放', 'Paid growth'), 94], [L('批量生产', 'Batch production'), 90]], ['Host', 'Manager', 'Community Manager'],
        [L('账号矩阵', 'Account matrix'), L('批量内容', 'Batch content'), L('投流计划', 'Paid boosts')], [L('广告分成', 'Ad share'), L('带货 GMV', 'Commerce GMV')], L('搭建 10 个账号的矩阵', 'A 10-account matrix')),
    ],
  },
  {
    name: L('商业与粉丝生态', 'Commerce & Fandom'), sub: L('把流量变成收益与长期关系', 'Turns reach into revenue and loyalty'), icon: Heart, color: '#06b6d4', skillsAreCaps: false,
    roles: [
      R(L('品牌官', 'Brand Partner'), L('让品牌进入内容', 'Puts brands inside content'), [84, 80, 82, 98, 86, 90],
        [[L('品牌策略', 'Brand strategy'), 94], [L('联名企划', 'Collabs'), 92], [L('转化追踪', 'Attribution'), 90]], ['Actor', 'Host', 'Stylist'],
        [L('品牌联名', 'Brand collabs'), L('定制短剧', 'Branded dramas'), L('新品种草', 'Product seeding')], [L('联名授权', 'Collab licensing'), L('带货 GMV', 'Commerce GMV')], L('一次 AI 艺人联名企划', 'One AI-artist collab')),
      R(L('粉丝代表', 'Fan Representative'), L('粉丝的声音', 'The voice of the fans'), [78, 82, 95, 80, 76, 92],
        [[L('粉丝洞察', 'Fan insight'), 95], [L('二创引导', 'Fan remix'), 88], [L('舆情沟通', 'Sentiment care'), 86]], ['Idol', 'Singer', 'Cheer Captain'],
        [L('应援企划', 'Fan projects'), L('二创内容', 'Fan remixes'), L('粉丝调研', 'Fan surveys')], [L('会员', 'Memberships'), L('应援众筹', 'Fan crowdfunding')], L('组建 500 人核心粉丝团', 'A 500-member core fan club')),
      R(L('社群运营', 'Community Manager'), L('让社群持续活跃', 'Keeps the community alive'), [72, 88, 90, 85, 78, 94],
        [[L('社群活跃', 'Engagement'), 96], [L('活动策划', 'Events'), 90], [L('会员运营', 'Membership'), 88]], ['Host', 'Fan Representative', 'MCN Leader'],
        [L('话题活动', 'Topic events'), L('社群早安', 'Daily posts'), L('打卡任务', 'Check-in tasks')], [L('会员续费', 'Renewals'), L('社群电商', 'Community commerce')], L('一个每日打卡的粉丝群', 'A daily check-in fan group')),
      R(L('应援官', 'Cheer Captain'), L('把热爱变成行动', 'Turns love into action'), [86, 84, 96, 82, 80, 90],
        [[L('应援策划', 'Cheer planning'), 95], [L('打榜组织', 'Chart drives'), 92], [L('线下活动', 'Offline events'), 86]], ['Idol', 'Entertainer', 'Fan Representative'],
        [L('应援视频', 'Cheer videos'), L('打榜计划', 'Chart campaigns'), L('线下活动', 'Offline events')], [L('应援周边', 'Cheer merch'), L('打榜奖励', 'Chart rewards')], L('一次新歌打榜应援', 'A new-single chart campaign')),
    ],
  },
];

export const ROLE_COUNT = ROLE_GROUPS.reduce((a, g) => a + g.roles.length, 0);

/** Resolve a partner (by English name) to its group and role indices. */
export const findRole = (en: string) => {
  for (let g = 0; g < ROLE_GROUPS.length; g++) {
    const r = ROLE_GROUPS[g].roles.findIndex(x => x.name.en === en);
    if (r >= 0) return { group: g, role: r };
  }
  return null;
};

/** Average IP value per axis inside a group (dashed reference on the radar). */
export const groupAverage = (g: RoleGroup) => IP_AXES.map((_, i) => Math.round(g.roles.reduce((a, r) => a + (r.ip?.[i] ?? 0), 0) / Math.max(1, g.roles.length)));

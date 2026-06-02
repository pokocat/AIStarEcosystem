// 各项目全链路内容 — 设计真源 data.js `projectData`。
// 每项目自带 projectInfo / topicCards / episodes / characters / script / storyboard / promptPack。
// 切项目 = 切整套；坚决不共用样例。
import type { ProjectData } from "./types";

export const PROJECT_DATA: Record<string, ProjectData> = {
  // ——— P1 落地窗后(悬疑) ———
  p1: {
    projectInfo: {
      title: "落地窗后",
      type: "悬疑短剧",
      episodes: 80,
      duration: "每集 75 秒",
      ratio: "竖屏 9:16",
      logline: "都市白领林夏发现对面公寓的命案是为她设的局,真相牵出三年前的旧案。",
      mainline: "目击 → 怀疑 → 被卷入 → 揭穿设局者 → 旧案真相 → 反杀收束",
    },
    topicCards: [
      { id: "p1t1", title: "《落地窗后》", main: "都市白领发现自己每天目睹的对面公寓命案,其实是为她量身设计的局", hook: "她按下窗帘的瞬间,对面的灯也灭了", pace: "前 3 集高密度反转,中段身份揭秘,末段双线收束", audience: "20-35 岁都市女性 · 通勤碎片时间", selected: true },
      { id: "p1t2", title: "《第 13 层》", main: '电梯每天多停一层,只有她看得见,直到她遇见三年前"去世"的自己', hook: "电梯数字跳到了不存在的 13", pace: "单元剧式,每集一个谜面", audience: "悬疑爱好者 · 强解谜向" },
      { id: "p1t3", title: "《替身游戏》", main: '为还债成为富家女替身,却发现真千金的"意外"早有预谋,而她是下一个', hook: "镜子里的脸,慢慢变成了别人", pace: "身份双线 + 倒计时压迫", audience: "爽感 + 悬疑双驱动" },
    ],
    episodes: [
      { no: 1, hook: "深夜加班,她从落地窗看见对面公寓有人倒下", synopsis: '林夏目睹"命案",报警却发现现场干净如初,无人相信她。', beat: "钩子:对面的灯灭了", locked: true },
      { no: 2, hook: '第二天,死者"好端端"出现在电梯里', synopsis: "她确认自己没看错,开始用手机记录对面的一举一动。", beat: "反转:死者复活", locked: true },
      { no: 3, hook: '她收到一张纸条:"你看到的都是真的"', synopsis: "神秘人开始与她联系,暗示这一切与她三年前的车祸有关。", beat: "悬念升级", locked: false },
      { no: 4, hook: "顾沉舟出现,自称是负责旧案的警官", synopsis: "林夏半信半疑,两人结成临时同盟,但他的身份疑点重重。", beat: "盟友登场", locked: false },
      { no: 5, hook: "监控里,设局者的侧脸一闪而过", synopsis: "线索指向她的上司苏总,但证据随即被人销毁。", beat: "嫌疑转移", locked: false },
      { no: 6, hook: "她发现自己的公寓也被人改造过", synopsis: '原来"对面"的一切都是为她搭的舞台,她才是被观察的人。', beat: "大反转", locked: false },
    ],
    characters: [
      { id: "c1", name: "林夏",   role: "key",   cast: "女主 · 28 岁 · 广告公司 AE", desc: "理性敏锐,失眠,习惯深夜在落地窗前观察对面。三年前一场车祸夺走未婚夫。", avatar: "linxia", bound: true,  refCount: 4 },
      { id: "c2", name: "顾沉舟", role: "key",   cast: "男主 · 33 岁 · 自称刑警",     desc: "沉稳、信息差掌控者。真实身份在第 8 集揭晓,既是盟友也是局中人。", avatar: "gu",     bound: true,  refCount: 3 },
      { id: "c3", name: "苏总",   role: "key",   cast: "反派 · 45 岁 · 林夏上司",     desc: "表面儒雅的广告公司老板,旧案的真正主使,擅长设局。",             avatar: "boss",   bound: false, refCount: 0 },
      { id: "c4", name: "老周",   role: "extra", cast: "配角 · 小区保安",             desc: "五十多岁,微胖,总穿洗旧的藏蓝制服,爱管闲事却屡屡帮到林夏。",   avatar: "zhou",   bound: false },
      { id: "c5", name: "小满",   role: "extra", cast: "配角 · 林夏室友",             desc: "二十出头,活泼,程序员,负责提供技术线索和喜剧调剂。",           avatar: "girl",   bound: false },
    ],
    script: { ep: 1, scenes: [
      { id: "s1", place: "内景 · 林夏公寓 · 深夜",    mood: "压抑、孤独",   action: "林夏端着咖啡走到落地窗前,望向对面公寓零星的灯光。", lines: [
        { who: "旁白", text: "凌晨一点,城市只剩下她窗前这一盏灯还亮着。" },
        { who: "林夏", text: "(揉着太阳穴)又是这个点……", emotion: "疲惫" },
      ] },
      { id: "s2", place: "内景 · 林夏公寓 · 落地窗前", mood: "惊悚、屏息",   action: "对面公寓里,一个人影缓缓倒下,灯随即熄灭。林夏瞳孔骤缩,后退半步。", lines: [
        { who: "林夏", text: "(咖啡杯滑落)那是……", emotion: "震惊" },
      ] },
      { id: "s3", place: "内景 · 林夏公寓 · 玄关",    mood: "慌乱、急促",   action: "林夏抓起手机,手抖得几乎按不准号码,光脚冲向门口。", lines: [
        { who: "林夏",     text: "喂,110 吗?我看到对面有人……有人被害了!", emotion: "颤抖" },
        { who: "接线员", text: "请您冷静,具体是哪栋哪户?" },
      ] },
    ] },
    storyboard: { ep: 1, scenes: [
      { id: "s1", shots: [] },
      { id: "s2", duration: 18, shots: [
        { id: "sh1", no: 1, size: "中近景",    move: "缓慢推近", dur: 4, engine: "avatar",  done: true, desc: "林夏背对落地窗,手握咖啡杯,窗外霓虹流光映在她脸侧。", cast: ["c1"], line: { who: "林夏", text: "(自语)今天也这么晚了……" }, voice: "气声、低语,环境安静" },
        { id: "sh2", no: 2, size: "主观镜头", move: "手持轻晃", dur: 5, engine: "seedance", done: true, desc: "透过林夏视角望向对面公寓:暖黄灯光的窗内,一个人影忽然倒下。", cast: [],     line: null, voice: "低沉弦乐渐起 + 远处雨声" },
        { id: "sh3", no: 3, size: "特写",      move: "固定",     dur: 3, engine: "avatar",  done: true, desc: "林夏的眼睛骤然睁大,瞳孔收缩,睫毛轻颤。", cast: ["c1"], line: null, voice: "心跳声放大" },
        { id: "sh4", no: 4, size: "中景",      move: "快速拉远", dur: 3, engine: "avatar",              desc: "咖啡杯从林夏手中滑落摔碎,她踉跄后退半步,对面的灯同时熄灭。", cast: ["c1"], line: { who: "林夏", text: "那是……" }, voice: "杯碎声 + 弦乐顿止" },
        { id: "sh5", no: 5, size: "空镜",      move: "环绕",     dur: 3, engine: "seedance",             desc: "对面漆黑的窗口在雨夜里格外刺眼,雨点开始砸在玻璃上。", cast: [], line: null, voice: "雨声渐强", overLimit: true },
      ] },
      { id: "s3", shots: [] },
    ] },
    promptPack: { ep: 1, scene: "场景二 · 落地窗前目击", shots: [
      { no: 1, engine: "avatar",   dur: 4, ratio: "9:16", style: "悬疑风格,压抑都市夜氛围,电影级冷色调",
        timeline: [
          { t: "0-2秒", items: ["中近景", "林夏背对落地窗", "手握咖啡杯", "窗外霓虹流光"] },
          { t: "2-4秒", items: ["缓慢推近", "侧脸特写", "微微低头", "气声自语"] },
        ],
        sound: "环境留白 + 极轻的气声台词「今天也这么晚了……」",
        refs: [{ type: "img", who: "linxia", label: "林夏的数字人形象" }],
      },
      { no: 2, engine: "seedance", dur: 5, ratio: "9:16", style: "悬疑风格,主观视角,暖黄对比冷蓝,轻微颗粒感",
        timeline: [
          { t: "0-3秒", items: ["主观镜头", "望向对面公寓", "手持轻晃", "暖黄窗光"] },
          { t: "3-5秒", items: ["人影倒下", "灯光熄灭", "弦乐渐起", "远处雨声"] },
        ],
        sound: "低沉弦乐渐起 + 远处雨声,无台词",
        refs: [{ type: "video", label: "参考运镜:手持主观推进" }],
      },
    ] },
  },

  // ——— P2 重生后她在冷宫杀疯了(宫斗) ———
  p2: {
    projectInfo: {
      title: "重生后她在冷宫杀疯了",
      type: "宫斗",
      episodes: 98,
      duration: "每集 80 秒",
      ratio: "竖屏 9:16",
      logline: "被赐死冷宫的贵妃沈昭重生回入宫前夜,这一世她不再隐忍,步步反杀害她满门的皇后与负心帝王。",
      mainline: "重生 → 蓄势 → 打脸 → 扳倒皇后 → 帝王反目 → 携摄政王问鼎",
    },
    topicCards: [
      { id: "p2t1", title: "《重生后她在冷宫杀疯了》", main: "冷宫赐死的贵妃睁眼重生回入宫前夜,带着前世记忆步步复仇", hook: "再睁眼,是她被废入冷宫的前一夜", pace: "重生即爽,前 5 集连环打脸", audience: "女性向 · 强爽感走量", selected: true },
      { id: "p2t2", title: "《凤还朝》", main: "将门嫡女家破人亡后归来,以摄政王妃之姿清算旧账", hook: "当年看她笑话的人,如今要跪着求她", pace: "权谋 + 复仇双线", audience: "大女主爽剧受众" },
    ],
    episodes: [
      { no: 1, hook: "冷宫一杯毒酒下肚,她却睁眼回到三年前", synopsis: "沈昭带着前世记忆重生,入宫前夜便已布局。", beat: "钩子:重生回到入宫前夜", locked: true },
      { no: 2, hook: '皇后赐下的"贺礼"暗藏杀机,被她当场识破', synopsis: "沈昭将计就计,反让皇后在太后面前失了体面。", beat: "反转:将计就计", locked: true },
      { no: 3, hook: "御花园里,她当众揭穿侧妃的栽赃", synopsis: "一句话四两拨千斤,侧妃自取其辱。", beat: "爽点:当众打脸", locked: false },
      { no: 4, hook: "摄政王萧珩出手,替她解了围", synopsis: "两人结成隐秘同盟,各取所需却暗生情愫。", beat: "盟友登场", locked: false },
      { no: 5, hook: "皇后构陷反被她反咬一口", synopsis: "沈昭设局让皇后的爪牙自相残杀。", beat: "步步紧逼", locked: false },
      { no: 6, hook: '帝王察觉她"变了个人"', synopsis: "皇帝起疑,沈昭借机离间帝后。", beat: "悬念升级", locked: false },
    ],
    characters: [
      { id: "c1", name: "沈昭", role: "key",   cast: "女主 · 重生贵妃",       desc: "前世隐忍致满门覆灭,重生后狠厉果决、步步为营,笑里藏刀。", avatar: "shenzhao", bound: true,  refCount: 5 },
      { id: "c2", name: "萧珩", role: "key",   cast: "男主 · 摄政王",         desc: "权倾朝野、心思深沉,被沈昭的锋芒吸引,亦敌亦友。",       avatar: "xiaoheng", bound: true,  refCount: 3 },
      { id: "c3", name: "皇后", role: "key",   cast: "反派 · 中宫之主",       desc: "出身世家、心狠手辣,前世害死沈昭满门的主谋。",           avatar: "queen",    bound: false, refCount: 0 },
      { id: "c4", name: "春桃", role: "extra", cast: "配角 · 贴身丫鬟",       desc: "机灵忠心,沈昭在宫中唯一信得过的人。",                   avatar: "chuntao",  bound: false },
    ],
    script: { ep: 1, scenes: [
      { id: "s1", place: "内景 · 冷宫 · 寒夜",    mood: "阴冷、决绝", action: "残烛摇曳,沈昭饮下毒酒倒地,再睁眼却已是三年前的妆台前。", lines: [
        { who: "旁白", text: "这一杯毒酒,她等了整整三年。" },
        { who: "沈昭", text: "(猛然睁眼,指尖发抖)……回来了?这是入宫前夜。", emotion: "震惊" },
      ] },
      { id: "s2", place: "内景 · 凤仪宫 · 次日",  mood: "暗流涌动", action: "沈昭盛装觐见皇后,垂眸恭顺,眼底却是冰。", lines: [
        { who: "皇后", text: "妹妹这身打扮,倒是比从前张扬了。", emotion: "试探" },
        { who: "沈昭", text: "(浅笑福身)娘娘说笑,臣妾只想活得明白些。", emotion: "绵里藏针" },
      ] },
    ] },
    storyboard: { ep: 1, scenes: [
      { id: "s1", shots: [] },
      { id: "s2", duration: 16, shots: [
        { id: "sh1", no: 1, size: "全景",    move: "横移",     dur: 4, engine: "seedance", done: true, desc: "金碧辉煌的凤仪宫,宫人鱼贯,沈昭一袭红裙缓步入殿。", cast: [],     line: null, voice: "编钟 + 衣袂声" },
        { id: "sh2", no: 2, size: "中近景",  move: "缓慢推近", dur: 5, engine: "avatar",   done: true, desc: "沈昭垂眸行礼,鬓边步摇轻颤,唇角一丝几不可察的冷笑。", cast: ["c1"], line: { who: "沈昭", text: "臣妾给娘娘请安。" }, voice: "气声、恭顺" },
        { id: "sh3", no: 3, size: "特写",    move: "固定",     dur: 3, engine: "avatar",               desc: "沈昭抬眸的瞬间,眼神从恭顺转为锋利。", cast: ["c1"], line: null, voice: "弦乐一顿" },
        { id: "sh4", no: 4, size: "过肩",    move: "固定",     dur: 4, engine: "avatar",               desc: "皇后高坐凤位俯视,手中佛珠一捻,目光阴沉。", cast: ["c3"], line: { who: "皇后", text: "起来吧。" }, voice: "低沉、压迫" },
      ] },
    ] },
    promptPack: { ep: 1, scene: "场景二 · 凤仪宫请安", shots: [
      { no: 1, engine: "avatar", dur: 5, ratio: "9:16", style: "古装宫斗,金红主调,电影级布光,华贵压抑",
        timeline: [
          { t: "0-3秒", items: ["中近景", "沈昭垂眸行礼", "步摇轻颤", "宫灯暖光"] },
          { t: "3-5秒", items: ["缓慢推近", "唇角冷笑", "气声请安"] },
        ],
        sound: "编钟余韵 + 气声台词「臣妾给娘娘请安。」",
        refs: [{ type: "img", who: "shenzhao", label: "沈昭的数字人形象" }],
      },
      { no: 2, engine: "avatar", dur: 4, ratio: "9:16", style: "古装宫斗,过肩俯视构图,冷光压迫",
        timeline: [
          { t: "0-2秒", items: ["过肩镜头", "皇后高坐凤位", "佛珠轻捻"] },
          { t: "2-4秒", items: ["固定", "阴沉俯视", "一句开口"] },
        ],
        sound: "低频铺底 + 台词「起来吧。」",
        refs: [{ type: "img", who: "queen", label: "皇后的数字人形象" }],
      },
    ] },
  },

  // ——— P3 闪婚老公竟是隐藏首富(都市甜宠) ———
  p3: {
    projectInfo: {
      title: "闪婚老公竟是隐藏首富",
      type: "都市甜宠",
      episodes: 76,
      duration: "每集 70 秒",
      ratio: "竖屏 9:16",
      logline: '被渣男悔婚的设计师苏晚,赌气闪婚了相亲角的"落魄"男人陆深,婚后才发现他是隐藏的商业帝国掌门人。',
      mainline: "悔婚 → 赌气闪婚 → 日常打脸 → 马甲松动 → 身份揭晓 → 双向奔赴",
    },
    topicCards: [
      { id: "p3t1", title: "《闪婚老公竟是隐藏首富》", main: '设计师赌气闪婚"穷小子",婚后发现老公马甲一层套一层', hook: "她随手签的婚,签来了个隐形首富", pace: "高糖快节奏,每集一个马甲掉落", audience: "20-30 岁女性 · 下饭剧", selected: true },
      { id: "p3t2", title: "《老公他人后是大佬》", main: '小职员意外嫁给"保安",发现对方深夜出入顶层办公室', hook: "保安老公的工牌,写着董事长", pace: "甜虐交替 + 反差萌", audience: "甜宠 + 反差受众" },
    ],
    episodes: [
      { no: 1, hook: "婚礼当天被悔婚,她转身在相亲角领了证", synopsis: "苏晚赌气闪婚陌生男人陆深,以为嫁了个普通上班族。", beat: "钩子:赌气闪婚", locked: true },
      { no: 2, hook: "老公出租屋里,藏着一柜子高定西装", synopsis: '苏晚起疑,陆深却用"帮人保管"轻描淡写带过。', beat: "马甲松动", locked: false },
      { no: 3, hook: "前男友带新欢炫富,被陆深一句话压回去", synopsis: "陆深不动声色地替她出气,苏晚心动了一下。", beat: "爽点:打脸前任", locked: false },
      { no: 4, hook: '公司新来的"实习生"对陆深毕恭毕敬', synopsis: '苏晚撞见员工喊陆深"总",疑云更重。', beat: "悬念升级", locked: false },
      { no: 5, hook: "陆母上门施压,要她签离婚协议", synopsis: "苏晚不卑不亢,反而赢得陆深暗中维护。", beat: "冲突", locked: false },
      { no: 6, hook: "商业晚宴上,陆深以集团总裁身份现身", synopsis: "马甲尽碎,苏晚震惊之余也开始正视这段婚姻。", beat: "大反转:身份揭晓", locked: false },
    ],
    characters: [
      { id: "c1", name: "苏晚",     role: "key",   cast: "女主 · 26 岁 · 独立设计师", desc: "要强、嘴硬心软,被悔婚后赌气闪婚,事业心强不愿靠人。", avatar: "suwan",  bound: true,  refCount: 4 },
      { id: "c2", name: "陆深",     role: "key",   cast: "男主 · 31 岁 · 隐藏首富",   desc: "低调隐忍、宠妻无下限,故意藏起身份只想被真心对待。", avatar: "lushen", bound: true,  refCount: 3 },
      { id: "c3", name: "秦助理", role: "extra", cast: "配角 · 陆深心腹",           desc: '永远在帮老板圆"穷人"人设,贡献大量喜剧效果。',     avatar: "qin",    bound: false },
      { id: "c4", name: "陆母",     role: "key",   cast: "反派 · 陆深母亲",           desc: "雷厉风行的豪门主母,起初强烈反对这桩婚事。",         avatar: "mom",    bound: false, refCount: 0 },
    ],
    script: { ep: 1, scenes: [
      { id: "s1", place: "内景 · 婚礼后台 · 白天", mood: "难堪、决绝", action: "苏晚攥着被退回的婚戒,听见未婚夫在门外宣布悔婚,深吸一口气摘下头纱。", lines: [
        { who: "旁白", text: "婚礼进行到一半,新郎不见了。" },
        { who: "苏晚", text: "(冷笑,把婚戒拍在桌上)行,这婚我不结了。", emotion: "倔强" },
      ] },
      { id: "s2", place: "外景 · 相亲角 · 黄昏", mood: "荒诞、冲动", action: "苏晚赌气走进相亲角,随手指向人群里最不起眼的男人——陆深。", lines: [
        { who: "苏晚", text: "就你了,跟我去领证吗?", emotion: "赌气" },
        { who: "陆深", text: "(微怔,随即唇角一扬)好。", emotion: "玩味" },
      ] },
    ] },
    storyboard: { ep: 1, scenes: [
      { id: "s1", shots: [] },
      { id: "s2", duration: 15, shots: [
        { id: "sh1", no: 1, size: "全景",        move: "环绕",     dur: 4, engine: "seedance", done: true, desc: "黄昏相亲角,挂满征婚启事的伞架,人群熙攘。",         cast: [],          line: null, voice: "市井环境声 + 轻快配乐" },
        { id: "sh2", no: 2, size: "中近景",     move: "快速推近", dur: 4, engine: "avatar",   done: true, desc: "苏晚一脸赌气,抬手径直指向人群里的陆深。",           cast: ["c1"],      line: { who: "苏晚", text: "就你了,跟我去领证吗?" }, voice: "气声 + 心跳鼓点" },
        { id: "sh3", no: 3, size: "特写",         move: "固定",     dur: 3, engine: "avatar",               desc: "陆深微怔,随即唇角扬起一抹耐人寻味的笑。",           cast: ["c2"],      line: { who: "陆深", text: "好。" }, voice: "低音 + 甜系音效叮" },
        { id: "sh4", no: 4, size: "双人中景",   move: "固定",     dur: 4, engine: "avatar",               desc: "两人对视,夕阳把影子拉得很长,空气里有一丝心动。", cast: ["c1", "c2"], line: null, voice: "暖色弦乐渐起" },
      ] },
    ] },
    promptPack: { ep: 1, scene: "场景二 · 相亲角闪婚", shots: [
      { no: 1, engine: "avatar", dur: 4, ratio: "9:16", style: "都市甜宠,暖黄夕阳,明亮通透,轻喜剧质感",
        timeline: [
          { t: "0-2秒", items: ["中近景", "苏晚赌气抬手", "指向人群"] },
          { t: "2-4秒", items: ["快速推近", "坚定眼神", "一句开口"] },
        ],
        sound: "轻快配乐 + 台词「就你了,跟我去领证吗?」",
        refs: [{ type: "img", who: "suwan", label: "苏晚的数字人形象" }],
      },
      { no: 2, engine: "avatar", dur: 3, ratio: "9:16", style: "都市甜宠,特写,暖光,反差萌",
        timeline: [
          { t: "0-1.5秒", items: ["特写", "陆深微怔"] },
          { t: "1.5-3秒", items: ["唇角上扬", "甜系音效"] },
        ],
        sound: "低音「好。」+ 叮的一声",
        refs: [{ type: "img", who: "lushen", label: "陆深的数字人形象" }],
      },
    ] },
  },

  // ——— P4 向阳而生 · 乡村支教纪实(公益宣传片) ———
  p4: {
    projectInfo: {
      title: "向阳而生 · 乡村支教纪实",
      type: "公益宣传片",
      episodes: 1,
      duration: "约 90 秒",
      ratio: "横屏 16:9",
      logline: "一位城市青年放弃高薪,到大山深处支教三年,用一间小小的图书角改变了一群孩子的远方。",
      mainline: "初到 → 困境 → 陪伴 → 点亮 → 离别 → 传承",
    },
    topicCards: [
      { id: "p4t1", title: "《向阳而生》", main: "城市青年大山支教三年,一间图书角点亮孩子的远方", hook: '"老师,山的那边是什么?"', pace: "叙事·情绪向,首尾呼应", audience: "公益传播 · 全年龄共鸣", selected: true },
    ],
    episodes: [
      { no: 1, hook: "颠簸数小时,他第一次站上漏风的讲台", synopsis: "李晓初到山村小学,条件远比想象艰苦。",                 beat: "段落一:初到",   locked: true },
      { no: 2, hook: "孩子们怯生生地问:山外面是什么样", synopsis: "一个问题让他决定建一个图书角。",                       beat: "段落二:点亮",   locked: false },
      { no: 3, hook: "三年后,第一个孩子考出了大山",       synopsis: "离别在即,孩子们把心愿写进了图书角。",                 beat: "段落三:传承",   locked: false },
    ],
    characters: [
      { id: "c1", name: "李晓", role: "key", cast: "主角 · 28 岁 · 支教老师",     desc: "温和坚定,放弃城市工作扎根山村,记录孩子的成长。",   avatar: "lixiao", bound: true, refCount: 3 },
      { id: "c2", name: "土豆", role: "key", cast: "主要人物 · 9 岁 · 学生",       desc: '机灵好学的留守儿童,最爱缠着老师问"山外面"。',         avatar: "tudou",  bound: true, refCount: 2 },
    ],
    script: { ep: 1, scenes: [
      { id: "s1", place: "外景 · 盘山公路 · 清晨", mood: "辽阔、忐忑", action: "一辆中巴在云雾缭绕的山路上颠簸,李晓背着行囊望向窗外连绵的山。", lines: [
        { who: "旁白", text: "从城市到这里,要换三趟车,走两小时山路。" },
      ] },
      { id: "s2", place: "内景 · 山村教室 · 白天", mood: "质朴、温暖", action: "阳光从破窗斜进来,孩子们挤在长凳上,土豆举起手。", lines: [
        { who: "土豆", text: "老师,山的那边……是什么呀?", emotion: "好奇" },
        { who: "李晓", text: "(蹲下来,认真地看着他)是更大的世界。我带你们去看。", emotion: "温柔" },
      ] },
    ] },
    storyboard: { ep: 1, scenes: [
      { id: "s1", shots: [] },
      { id: "s2", duration: 14, shots: [
        { id: "sh1", no: 1, size: "大远景",     move: "航拍下降", dur: 4, engine: "seedance", done: true, desc: "云海中的盘山公路,一辆小巴缓缓驶向群山深处。",   cast: [],            line: null, voice: "空灵人声吟唱 + 风声" },
        { id: "sh2", no: 2, size: "中近景",     move: "缓慢推近", dur: 4, engine: "avatar",   done: true, desc: "教室里,土豆怯生生举起手,眼里满是好奇的光。",     cast: ["c2"],        line: { who: "土豆", text: "老师,山的那边是什么呀?" }, voice: "童声 + 钢琴单音" },
        { id: "sh3", no: 3, size: "双人中景", move: "固定",       dur: 3, engine: "avatar",               desc: "李晓蹲下身,与土豆平视,认真而温柔。",                cast: ["c1", "c2"], line: { who: "李晓", text: "是更大的世界。" }, voice: "温暖弦乐渐起" },
        { id: "sh4", no: 4, size: "空镜",         move: "上摇",       dur: 3, engine: "seedance",             desc: "镜头从孩子们的笑脸上摇,定格在窗外远方的山脊与朝阳。", cast: [],            line: null, voice: "弦乐推向高潮" },
      ] },
    ] },
    promptPack: { ep: 1, scene: "段落二 · 山的那边", shots: [
      { no: 1, engine: "avatar", dur: 4, ratio: "16:9", style: "公益纪实,自然光,质朴温暖,胶片颗粒",
        timeline: [
          { t: "0-2秒", items: ["中近景", "土豆举手", "逆光剪影"] },
          { t: "2-4秒", items: ["缓慢推近", "眼里的光", "童声提问"] },
        ],
        sound: "钢琴单音 + 童声台词「山的那边是什么呀?」",
        refs: [{ type: "img", who: "tudou", label: "土豆的数字人形象" }],
      },
      { no: 2, engine: "seedance", dur: 3, ratio: "16:9", style: "公益纪实,上摇空镜,朝阳暖调,大气",
        timeline: [
          { t: "0-1.5秒", items: ["孩子们的笑脸"] },
          { t: "1.5-3秒", items: ["上摇", "远山朝阳", "弦乐高潮"] },
        ],
        sound: "弦乐推向高潮,无台词",
        refs: [{ type: "video", label: "参考运镜:笑脸上摇至远山" }],
      },
    ] },
  },

  // ——— P5 星核纪元(科幻短剧) ———
  p5: {
    projectInfo: {
      title: "星核纪元",
      type: "科幻短剧",
      episodes: 60,
      duration: "每集 80 秒",
      ratio: "竖屏 9:16",
      logline: '末世废土上,觉醒了"星核"能力的少年凌霄,带着 AI 伊塔寻找重启文明的方舟,对抗吞噬星球的机械神教。',
      mainline: "觉醒 → 逃亡 → 集结 → 揭秘星核 → 决战机械神教 → 重启文明",
    },
    topicCards: [
      { id: "p5t1", title: "《星核纪元》", main: "废土少年觉醒星核之力,与 AI 同伴寻找重启文明的方舟", hook: "他掌心亮起的蓝光,照亮了死寂的废土", pace: "强视觉奇观,首集即高燃", audience: "科幻 / 男频受众 · 强设定", selected: true },
      { id: "p5t2", title: "《最后的方舟》", main: "机械神教吞噬星球,人类最后的火种藏在一艘沉睡的方舟里",   hook: "倒计时归零前,只有他能开启方舟", pace: "末日倒计时 + 团队集结",   audience: "末世科幻爱好者" },
    ],
    episodes: [
      { no: 1, hook: "废土追猎中,凌霄掌心第一次亮起星核蓝光", synopsis: "被机械猎兵逼入绝境,凌霄意外觉醒星核之力。", beat: "钩子:星核觉醒", locked: true },
      { no: 2, hook: '残破终端里,AI 伊塔睁开了"眼睛"', synopsis: "凌霄唤醒沉睡的 AI 伊塔,得知方舟的存在。",     beat: "同伴登场",     locked: false },
      { no: 3, hook: "机械神教的传教士锁定了他的坐标", synopsis: "克戎率机械军团追来,凌霄被迫逃亡。",             beat: "反派压迫",     locked: false },
      { no: 4, hook: "废墟幸存者中,藏着同样觉醒的人", synopsis: "凌霄开始集结星核者,组建反抗小队。",             beat: "集结",           locked: false },
    ],
    characters: [
      { id: "c1", name: "凌霄", role: "key", cast: "男主 · 19 岁 · 星核觉醒者", desc: "废土孤儿,坚毅果敢,掌心可凝聚星核蓝光,潜力未知。",     avatar: "lingxiao", bound: true,  refCount: 3 },
      { id: "c2", name: "伊塔", role: "key", cast: "同伴 · 拟人 AI",             desc: "方舟遗留的人工智能,理性又带点毒舌,凌霄的军师。",     avatar: "ita",       bound: false, refCount: 0 },
      { id: "c3", name: "克戎", role: "key", cast: "反派 · 机械神教传教士",     desc: "半机械化的狂信徒,坚信只有机械能拯救星球。",             avatar: "kron",     bound: false, refCount: 0 },
    ],
    script: { ep: 1, scenes: [
      { id: "s1", place: "外景 · 废土峡谷 · 黄昏", mood: "紧张、压迫", action: "红沙漫卷,凌霄在锈蚀的钢铁残骸间狂奔,身后机械猎兵的红光逼近。", lines: [
        { who: "旁白", text: "文明熄灭后的第三百年,废土上只剩追猎与逃亡。" },
        { who: "凌霄", text: "(喘息,回头)就差一点……别过来!", emotion: "焦灼" },
      ] },
      { id: "s2", place: "外景 · 峡谷绝壁 · 黄昏", mood: "爆发、震撼", action: "退无可退,凌霄掌心骤然爆发刺目蓝光,将逼近的猎兵尽数击碎。", lines: [
        { who: "凌霄", text: "(低头看着发光的掌心)这是……什么力量?", emotion: "震惊" },
      ] },
    ] },
    storyboard: { ep: 1, scenes: [
      { id: "s1", shots: [] },
      { id: "s2", duration: 17, shots: [
        { id: "sh1", no: 1, size: "全景",    move: "跟随", dur: 4, engine: "seedance", done: true, desc: "凌霄在锈红废土上狂奔,身后机械猎兵的红色扫描光束逼近。", cast: [],     line: null, voice: "低频轰鸣 + 金属脚步" },
        { id: "sh2", no: 2, size: "特写",    move: "急推", dur: 3, engine: "avatar",   done: true, desc: "凌霄回头,瞳孔倒映着逼近的红光,额角滑下汗珠。",               cast: ["c1"], line: { who: "凌霄", text: "别过来!" }, voice: "急促喘息 + 心跳" },
        { id: "sh3", no: 3, size: "中景",    move: "环绕", dur: 5, engine: "seedance",             desc: "凌霄掌心爆发刺目蓝光,星核能量呈环状炸开,机械猎兵瞬间碎裂。", cast: ["c1"], line: null, voice: "能量爆发音 + 弦乐炸点", overLimit: true },
        { id: "sh4", no: 4, size: "特写",    move: "固定", dur: 5, engine: "avatar",               desc: "尘埃落定,凌霄难以置信地看着自己仍在发光的掌心。",             cast: ["c1"], line: { who: "凌霄", text: "这是……什么力量?" }, voice: "余音回响 + 气声" },
      ] },
    ] },
    promptPack: { ep: 1, scene: "场景二 · 星核觉醒", shots: [
      { no: 1, engine: "avatar", dur: 3, ratio: "9:16", style: "末世科幻,锈红废土,冷蓝能量对比,电影级特效",
        timeline: [
          { t: "0-1.5秒", items: ["特写", "凌霄回头", "瞳孔映红光"] },
          { t: "1.5-3秒", items: ["急推", "汗珠滑落", "嘶吼"] },
        ],
        sound: "急促喘息 + 台词「别过来!」",
        refs: [{ type: "img", who: "lingxiao", label: "凌霄的数字人形象" }],
      },
      { no: 2, engine: "seedance", dur: 5, ratio: "9:16", style: "末世科幻,环状能量爆发,粒子特效,高燃",
        timeline: [
          { t: "0-2秒", items: ["中景", "掌心蓝光", "能量环扩散"] },
          { t: "2-5秒", items: ["环绕", "猎兵碎裂", "弦乐炸点"] },
        ],
        sound: "能量爆发音 + 弦乐炸点,无台词",
        refs: [{ type: "video", label: "参考运镜:环绕爆发" }],
      },
    ] },
  },

  // ——— P6 匠心智造 · 品牌片(企业宣传片) ———
  p6: {
    projectInfo: {
      title: "匠心智造 · 品牌片",
      type: "企业宣传片",
      episodes: 1,
      duration: "约 60 秒",
      ratio: "横屏 16:9",
      logline: '从一台机床到智能工厂,匠心智造用二十年把"中国制造"做成"中国精造",讲述精度背后的人与匠心。',
      mainline: "起点 → 钻研 → 突破 → 智造 → 远望",
    },
    topicCards: [
      { id: "p6t1", title: "《匠心智造》品牌片", main: "二十年深耕精密制造,以匠心把毫厘做到极致", hook: "0.001 毫米的较真,二十年没变过", pace: "产品 + 口播,节奏明快有力", audience: "B 端客户 / 招商 / 品牌传播", selected: true },
    ],
    episodes: [
      { no: 1, hook: "老师傅的手,与机械臂的精度同框", synopsis: '以"手"为线索,引出匠心与智造的传承。', beat: "段落一:匠心", locked: true },
      { no: 2, hook: "0.001 毫米——一条产线的极致追求", synopsis: "用数据与镜头展现产品精度与智能化。",   beat: "段落二:智造", locked: false },
      { no: 3, hook: "从车间到世界,产品走向全球",       synopsis: "收束于品牌愿景与全球布局。",           beat: "段落三:远望", locked: false },
    ],
    characters: [
      { id: "c1", name: "品牌代言人", role: "key",   cast: "主体 · 形象代言",     desc: "沉稳可信的行业代言形象,口播串联产品与理念。",                       avatar: "spk",  bound: true, refCount: 2 },
      { id: "c2", name: "智能机械臂", role: "key",   cast: "主体 · 核心产品",     desc: "企业核心产品,需多角度展示精度与质感(产品锁形象)。",             avatar: "arm",  bound: true, refCount: 4 },
      { id: "c3", name: "老师傅",     role: "extra", cast: "人物 · 一线工匠",     desc: "二十年工龄的老技师,代表匠心传承。",                                 avatar: "zhou", bound: false },
    ],
    script: { ep: 1, scenes: [
      { id: "s1", place: "内景 · 现代化车间 · 白天", mood: "专注、有力",   action: "冷调车间里,老师傅布满老茧的手与高速运转的机械臂在同一画面中。", lines: [
        { who: "旁白", text: "有些较真,机器学了二十年,才学会。" },
      ] },
      { id: "s2", place: "内景 · 检测中心 · 白天",     mood: "精密、自信",   action: "特写显示屏跳动的精度数字,定格在 0.001mm。",                                   lines: [
        { who: "代言人", text: "把每一个 0.001,做成别人的标准。", emotion: "坚定" },
      ] },
    ] },
    storyboard: { ep: 1, scenes: [
      { id: "s1", shots: [] },
      { id: "s2", duration: 13, shots: [
        { id: "sh1", no: 1, size: "特写",     move: "微距横移", dur: 4, engine: "seedance", done: true, desc: "机械臂末端的精密刀头高速旋转,金属屑如火花般飞溅。", cast: ["c2"], line: null, voice: "工业环境声 + 节奏电子乐" },
        { id: "sh2", no: 2, size: "中景",     move: "固定",       dur: 4, engine: "avatar",   done: true, desc: "代言人立于产线前,神情笃定,正对镜头口播。",             cast: ["c1"], line: { who: "代言人", text: "把每一个 0.001,做成别人的标准。" }, voice: "沉稳男声口播" },
        { id: "sh3", no: 3, size: "大特写", move: "推近",       dur: 3, engine: "seedance",             desc: "检测屏上的精度数字跳动,最终定格在 0.001mm,绿光亮起。",   cast: [],     line: null, voice: "叮的确认音 + 鼓点" },
      ] },
    ] },
    promptPack: { ep: 1, scene: "段落二 · 0.001 的较真", shots: [
      { no: 1, engine: "seedance", dur: 4, ratio: "16:9", style: "企业品牌片,冷调金属质感,微距特写,电影级布光",
        timeline: [
          { t: "0-2秒", items: ["微距特写", "刀头高速旋转", "金属火花"] },
          { t: "2-4秒", items: ["横移", "精密咬合", "节奏电子乐"] },
        ],
        sound: "工业环境声 + 节奏电子乐,无台词",
        refs: [{ type: "img", who: "arm", label: "智能机械臂的产品形象" }],
      },
      { no: 2, engine: "avatar",   dur: 4, ratio: "16:9", style: "企业品牌片,中景口播,冷暖平衡,专业可信",
        timeline: [
          { t: "0-2秒", items: ["中景", "代言人正对镜头", "产线虚化背景"] },
          { t: "2-4秒", items: ["固定", "坚定口播"] },
        ],
        sound: "沉稳男声口播「把每一个 0.001,做成别人的标准。」",
        refs: [{ type: "img", who: "spk", label: "品牌代言人的数字人形象" }],
      },
    ] },
  },
};

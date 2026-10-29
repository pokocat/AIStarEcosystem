/**
 * 场景目录：「AI 图片」「AI 视频」两页和首页「你想做什么？」共用这一份。
 *
 * 图片场景是一步出图：选好场景，放参考图，描述已经按场景写好，改不改都行，点生成就出图。
 * 视频场景交给画布里的创作助手：放素材、写一句要求（可不写），我们按场景拼成一段话，
 * 助手先出方案和报价，确认后才生成。真源 docs/studio-scene-creation.md。
 *
 * 描述里的「图1、图2」与参考图位的顺序一一对应。用户写的补充要求拼在描述后面（见 imagePrompt），
 * 所以描述里需要用户决定的东西写成「按补充要求，没写就……」，不留方括号空位。
 */

export type ImageSceneGroup = "ip" | "person" | "product" | "scene" | "enhance";
export type VideoSceneGroup = "commerce" | "local" | "brand" | "drama" | "ip";

export interface SceneRef { label: string; required: boolean; hint?: string }

export interface ImageScene {
  id: string;
  group: ImageSceneGroup;
  title: string;
  description: string;
  /** 参考图位，按顺序是图1、图2… */
  refs: SceneRef[];
  /** 场景写好的描述。界面上不直接摆出来（老板看到一大段提示词就是「工具」），只显示场景标签，用户写的是补充要求；高级用户可以「改完整描述」。 */
  prompt: string;
  /** 补充要求输入框的提示：告诉用户可以写什么。 */
  hint: string;
  /** 默认画面比例。 */
  ratio: string;
}

export interface VideoScene {
  id: string;
  group: VideoSceneGroup;
  title: string;
  description: string;
  /** 图片素材位叫什么（商品图 / 门店照片 / 人物照片…），最多几张，是否必填。 */
  images: { label: string; required: boolean; max: number };
  /** 需要一条参考视频（爆款复刻）。 */
  video?: { label: string; required: boolean };
  /** 可选的出镜人物 / 声音素材。 */
  character?: boolean;
  voice?: boolean;
  /** 输入框里的示例：告诉用户这类视频写什么。参考站只要一句话 + 素材，不让人填表。 */
  placeholder: string;
  /** 没有素材可看时（剧情、口播、复刻），这句话必须写。 */
  textRequired?: boolean;
  durations: number[];
  duration: number;
  ratio: "9:16" | "16:9";
  /** 这类视频通常怎么拍：拼进交给助手的话里，让方案贴着场景走。 */
  structure: string;
  /** 快捷思路：点一下追加到补充说明。 */
  ideas: string[];
}

export const imageSceneGroups: { id: ImageSceneGroup; title: string }[] = [
  { id: "ip", title: "IP 形象" },
  { id: "person", title: "人物" },
  { id: "product", title: "商品" },
  { id: "scene", title: "场景" },
  { id: "enhance", title: "画质" },
];

export const videoSceneGroups: { id: VideoSceneGroup; title: string }[] = [
  { id: "commerce", title: "电商带货" },
  { id: "local", title: "同城到店" },
  { id: "brand", title: "品牌广告" },
  { id: "drama", title: "剧情短片" },
  { id: "ip", title: "IP 内容" },
];

const PERSON: SceneRef = { label: "人物照片", required: true, hint: "正脸清晰、光线均匀的照片效果最好" };

export const imageScenes: ImageScene[] = [
  { id: "ip-sheet", group: "ip", title: "IP 设定图", description: "一张图看全三视图、表情和服装细节",
    refs: [PERSON], ratio: "1:1",
    hint: "可以补充人物名字、性格或画风，例如：叫小紫，元气少女，偏日系插画",
    prompt: "以图1中的人物为唯一角色，做一张完整的人物设定图，一次生成在同一张图里。沿用图1的长相、发型、服装、配饰、身材比例和画风，所有区域都是同一个人、同一套衣服。浅暖色纸面背景，细灰分隔线，排版清楚。上半部分：左边一张大幅半身像，中间是正面、90 度侧面、背面三张全身像，并排、同样高度、脚底对齐；中间部分：五张头肩表情特写（微笑、惊讶、酷、生气、温柔）；下半部分：服装细节、配饰和主要配色色块。不要多余文字，不要水印，不要混入其他人物。" },
  { id: "ip-portrait", group: "ip", title: "IP 写真", description: "同一张脸，换一组杂志感写真",
    refs: [PERSON], ratio: "3:4",
    hint: "写想要的风格和场景，例如：海边日落、复古港风、白色极简棚拍",
    prompt: "以图1人物为准，保持长相、脸型和发型一致，拍一张写真，风格和场景按补充要求来，没写就拍午后咖啡馆里的杂志感写真。人物半身入画，姿态放松自然，光线柔和，背景有层次但不抢人物，写实照片质感，不加文字和水印。" },
  { id: "ip-expression", group: "ip", title: "IP 表情包", description: "一次出九种表情，聊天、封面都能用",
    refs: [PERSON], ratio: "1:1",
    hint: "可以换成想要的表情，或指定画风，例如：Q 版、手绘",
    prompt: "以图1人物为准，生成 3×3 九宫格表情图：开心、惊讶、生气、委屈、思考、得意、害羞、无奈、大笑。九格是同一个人、同一套服装、同样的画风，头肩入画，纯色浅色背景，每格表情夸张清楚，格子之间留细白边，不加文字。" },
  { id: "face-turnaround", group: "person", title: "脸部三视图", description: "正脸、半侧脸、侧脸，做角色参考",
    refs: [PERSON], ratio: "16:9",
    hint: "可以补充气质、表情或写实程度，例如：自然微笑、偏写实",
    prompt: "以图1人物为准，保持五官、脸型、发型、肤色和年龄感一致，在纯白背景上生成头部三视图：从左到右依次是正面、45 度半侧面、90 度正侧面。三个头像一样大、平视、肩部以上入画，柔和均匀的影棚光，写实照片质感，不加文字和水印。" },
  { id: "fullbody-sheet", group: "person", title: "人物四视图", description: "全身正、侧、背面，加一张脸部特写",
    refs: [PERSON], ratio: "16:9",
    hint: "可以补充站姿、服装要不要换，例如：穿白色运动套装",
    prompt: "以图1人物为准，保持长相、发型、身材比例和服装一致，在纯白背景上横向排列四个视图：全身正面、全身侧面、全身背面，以及一张脸部特写。站姿自然、双臂放松下垂，三个全身像一样高、脚底对齐，影棚柔光，写实照片质感，不加文字。" },
  { id: "face-swap", group: "person", title: "模特换脸", description: "保留姿势和衣服，换上指定的脸",
    refs: [{ label: "模特图", required: true }, { label: "新面孔", required: true, hint: "要换上的那张脸" }], ratio: "3:4",
    hint: "可以补充表情、妆容、发型细节，例如：自然微笑、淡妆、保留刘海",
    prompt: "把图1中模特的脸换成图2人物的脸，发型一起换成图2的样子。保留图1的姿势、服装、光线、背景和构图，脸部肤色和光影与身体自然衔接，看不出拼接痕迹，写实照片质感。" },
  { id: "face-fusion", group: "person", title: "人脸融合", description: "两张脸融合出一个新的虚拟形象",
    refs: [{ label: "人物 A", required: true }, { label: "人物 B", required: true }], ratio: "3:4",
    hint: "可以补充更像谁一点、年龄和气质，例如：更像 A，二十岁出头，温柔",
    prompt: "融合图1和图2两个人的面部特征，生成一个全新的虚拟人物：五官比例取两人之间，和任何一方都不完全一样，气质自然。正面半身肖像，浅灰纯色背景，柔和影棚光，写实照片质感，不加文字。" },
  { id: "outfit-on-model", group: "product", title: "服装上身", description: "把衣服穿到模特身上，出模特图",
    refs: [{ label: "模特图", required: true }, { label: "服装图", required: true, hint: "平铺图或挂拍图都行" }], ratio: "3:4",
    hint: "可以补充穿法和姿势，例如：外套敞开、侧身站立",
    prompt: "让图1中的模特穿上图2的服装，服装的款式、颜色、图案、面料质感和细节与图2完全一致。保留模特的长相、发型、姿势和背景，衣服贴合身形、褶皱自然，电商模特图质感。" },
  { id: "product-in-use", group: "product", title: "商品使用", description: "真人在用你的商品，做种草配图",
    refs: [{ label: "商品图", required: true }, { label: "人物照片", required: false, hint: "不放就由 AI 安排人物" }], ratio: "3:4",
    hint: "可以补充使用场景和人物，例如：在浴室镜前、三十岁左右的女性",
    prompt: "生成一张真人正在使用图1商品的生活场景照片。商品的外观、颜色、包装和标识与图1一致并且清晰可见；人物动作自然、表情放松，场景和商品用途相符，自然光，适合做电商种草配图，不加文字。" },
  { id: "white-background", group: "product", title: "商品白底图", description: "干净的白底主图，平台上架直接用",
    refs: [{ label: "商品图", required: true }], ratio: "1:1",
    hint: "可以补充角度和摆放，例如：45 度角、平放",
    prompt: "把图1中的商品单独放到纯白背景正中，商品完整、居中，约占画面七成。保留原有外观、颜色、文字和标识，加上柔和的接触阴影，影棚布光，边缘干净，适合电商平台主图。" },
  { id: "selling-point", group: "product", title: "商品卖点图", description: "围绕一个卖点布景，做详情页配图",
    refs: [{ label: "商品图", required: true }], ratio: "3:4",
    hint: "写一个最想突出的卖点，例如：防水、轻便、长续航",
    prompt: "以图1商品为主体，做一张竖版详情页卖点图：商品放在画面中上部，用简洁的场景和道具表现补充要求里写的卖点（没写就突出商品的质感），四周留出干净的空白方便后期加字，配色和商品协调，质感高级，画面里不要生成任何文字。" },
  { id: "outfit-restyle", group: "product", title: "服装改款", description: "版型不变，换面料、印花或颜色",
    refs: [{ label: "服装图", required: true }, { label: "面料或印花", required: false, hint: "不放就按文字里写的改" }], ratio: "3:4",
    hint: "没放面料图时，写想要的颜色或图案，例如：藏青色细条纹",
    prompt: "保持图1服装的版型、剪裁和穿着方式不变，把面料和印花换成图2的样式；没有图2时，按补充要求里写的颜色或图案改。光影和褶皱随新面料自然变化，展示方式与原图一致。" },
  { id: "scene-swap", group: "scene", title: "人物入景", description: "人不变，换一个拍摄场景",
    refs: [{ label: "人物照片", required: true }, { label: "场景图", required: false, hint: "不放就按文字里写的场景" }], ratio: "3:4",
    hint: "没放场景图时，写想要的场景，例如：海边的白色露台",
    prompt: "保留图1人物的长相、服装、姿势和光线方向，把背景换成图2的场景；没有图2时，换成补充要求里写的场景。人物和新背景的透视、光影、色调统一，脚下有合理的阴影，写实照片质感。" },
  { id: "product-scene", group: "scene", title: "商品入景", description: "把商品摆进生活场景里",
    refs: [{ label: "商品图", required: true }, { label: "场景图", required: false }], ratio: "3:4",
    hint: "没放场景图时，写想要的场景，例如：清晨洒满阳光的木质餐桌",
    prompt: "把图1的商品放进图2的场景里；没有图2时，放进补充要求里写的场景，商品外观不变，摆放符合真实使用习惯，光影和环境一致，适合做种草配图，不加文字。" },
  { id: "realism", group: "enhance", title: "人物真人感", description: "去掉塑料感，像真实拍出来的照片",
    refs: [{ label: "人物图", required: true }], ratio: "3:4",
    hint: "可以补充想保留或去掉的地方，例如：保留妆容，去掉美颜感",
    prompt: "让图1的人物看起来像真实拍摄的照片：加上自然的皮肤纹理、毛孔和细微瑕疵，去掉过度磨皮和塑料感，眼神和发丝细节更真实。保留原有长相、表情、服装和构图。" },
  { id: "retouch", group: "enhance", title: "图片精修", description: "提清晰度，修光影和颜色",
    refs: [{ label: "原图", required: true }], ratio: "3:4",
    hint: "可以补充想修的地方，例如：提亮肤色、去掉背景杂物",
    prompt: "精修图1：提高清晰度和细节，修正曝光和白平衡，光影更通透、颜色更自然，去掉噪点和压缩痕迹。不改变画面内容、人物长相和构图。" },
];

const COMMERCE_IDEAS = ["开头用一个反常识的说法抓人", "先讲用户的真实烦恼再给答案", "用前后对比突出效果", "结尾明确告诉观众怎么买"];
const LOCAL_IDEAS = ["从街口走进店里的第一视角", "老板或员工亲口介绍招牌", "突出排队和热闹的氛围", "结尾说清地址和团购入口"];
const BRAND_IDEAS = ["不出现硬广，用画面讲态度", "用一个真实人物的一天串起来", "画面统一成一种主色调", "最后一个镜头落在品牌标识上"];
const DRAMA_IDEAS = ["前三秒就进冲突", "每段结尾留一个钩子", "台词短，多用动作和表情", "结尾来一个出人意料的反转"];

const commerce = (id: string, title: string, description: string, structure: string, extra: Partial<VideoScene> = {}): VideoScene => ({
  id, group: "commerce", title, description, structure,
  images: { label: "商品图", required: true, max: 4 }, character: true, voice: true,
  placeholder: "说说卖什么、想突出哪一点，例如：玻尿酸保湿精华，一抹就吸收，今天第二瓶半价。不写也行，助手会先看商品图",
  durations: [15, 25, 30, 45], duration: 25, ratio: "9:16", ideas: COMMERCE_IDEAS, ...extra,
});
const local = (id: string, title: string, description: string, structure: string): VideoScene => ({
  id, group: "local", title, description, structure,
  images: { label: "门店照片", required: true, max: 6 }, character: true, voice: true,
  placeholder: "说说店名和特色，例如：巷子里的老火锅，牛油锅底现炒，双人套餐 99 元。不写也行，助手会先看照片",
  durations: [15, 25, 30, 45], duration: 25, ratio: "9:16", ideas: LOCAL_IDEAS,
});
const brand = (id: string, title: string, description: string, structure: string): VideoScene => ({
  id, group: "brand", title, description, structure,
  images: { label: "产品图", required: false, max: 6 }, character: true, voice: true,
  placeholder: "说说品牌和想让人记住的一句话，例如：山野户外，每个周末都值得出发",
  textRequired: true, durations: [15, 30, 45, 60], duration: 30, ratio: "16:9", ideas: BRAND_IDEAS,
});
const drama = (id: string, title: string, description: string, structure: string, extra: Partial<VideoScene> = {}): VideoScene => ({
  id, group: "drama", title, description, structure,
  images: { label: "参考图", required: false, max: 6 }, character: true, voice: true,
  placeholder: "一两句话说清楚谁、遇到什么事、结果怎样，例如：刚毕业的女主被老板刁难，最后发现老板是她失散的哥哥",
  textRequired: true, durations: [30, 45, 60], duration: 45, ratio: "9:16", ideas: DRAMA_IDEAS, ...extra,
});

export const videoScenes: VideoScene[] = [
  commerce("ecom-talking", "口播带货", "有人出镜推荐，建立购买信任",
    "真人对着镜头讲：开头一句话说清商品能解决什么，中间边讲边展示商品细节和使用过程，结尾讲优惠并引导下单。"),
  commerce("ecom-promo", "促销转化", "把优惠讲透，推动马上下单",
    "开头直接亮出优惠力度，中间用两三个画面证明商品值这个价，结尾强调时间有限、马上下单。"),
  commerce("ecom-seeding", "场景种草", "放进生活场景，让人想用",
    "从一个具体的生活场景切入，商品自然出现在场景里被使用，展示用完之后的好状态，不硬推销。"),
  commerce("ecom-painpoint", "痛点解决", "先戳中烦恼，再给出解决效果",
    "开头放大一个用户熟悉的烦恼，接着商品出场解决问题，用前后对比展示效果，最后一句总结。"),
  commerce("ecom-demo", "功能演示", "把功能演示出来，证明好用",
    "按功能逐个演示，每个镜头只讲一个功能，特写操作和效果，最后一个镜头展示商品全貌。"),
  local("local-discovery", "门店发现", "拍出特色，给人到店的理由",
    "像路过发现宝藏小店一样开场，带观众看门头、环境和最有特色的东西，结尾说清在哪里。"),
  local("local-visit", "到店实录", "真实到店体验，让人放心",
    "第一视角从进门开始，点单、上菜或体验服务，拍真实的反应和细节，结尾给出真实评价。"),
  local("local-signature", "招牌体验", "围绕招牌产品，讲出门店价值",
    "围绕一道招牌（或一项招牌服务）拍：制作过程特写、上桌或完成瞬间、第一口或体验反应。"),
  local("local-groupbuy", "同城团购", "讲清团购划算，推动到店核销",
    "开头亮出团购价格和包含的内容，逐项展示套餐里的东西，结尾提醒怎么买、怎么到店用。"),
  brand("brand-proposition", "品牌主张", "传达理念，让人认同你",
    "用有画面感的场景表达品牌态度，少讲产品多讲为什么，结尾落在一句品牌主张上。"),
  brand("brand-story", "品牌故事", "讲品牌的来历和坚持",
    "从创始人、匠人或第一位用户的故事开始，讲一个具体的坚持，最后回到品牌。"),
  brand("brand-lifestyle", "生活方式", "呈现用户向往的生活",
    "用几个生活片段拼出目标用户向往的一天，产品自然出现在其中，节奏轻快，配乐有氛围。"),
  brand("brand-concept", "创意概念", "用创意画面让人记住品牌",
    "用一个有想象力的视觉概念贯穿全片，画面有记忆点，最后把概念和产品连起来。"),
  drama("drama-dialogue", "对话剧情", "两三个人的对话推动故事",
    "以对话为主，正反打镜头切换，每段对话都推进一点关系或冲突，结尾一句点题。"),
  drama("drama-twist", "反转剧情", "前面铺垫，结尾一个反转",
    "前半段按观众预期铺垫，埋一个不起眼的伏笔，结尾揭开反转，让伏笔说得通。"),
  drama("drama-suspense", "悬疑剧情", "一个谜团吊住观众",
    "开头抛出一个谜团，中间逐步给线索、制造紧张，结尾揭晓或留下更大的悬念。"),
  drama("drama-emotional", "情感剧情", "打动人心的情感故事",
    "围绕一段关系（亲情、友情、爱情）讲一个小事，情绪慢慢推进，结尾有一个让人动容的瞬间。"),
  drama("drama-placement", "剧情植入", "故事里自然带出商品",
    "先讲一个完整的小故事，商品在关键情节里自然出现并帮上忙，不打断剧情，结尾轻轻点出商品。",
    { placeholder: "说说故事和要植入的商品，例如：闺蜜吵架后和好，随身小风扇在关键时刻帮上忙",
      images: { label: "商品图", required: false, max: 6 } }),
  { id: "ip-talking", group: "ip", title: "数字人口播", description: "你的 IP 出镜，讲观点、讲知识",
    images: { label: "人物照片", required: true, max: 2 }, voice: true,
    placeholder: "说说讲什么、用什么语气，例如：三个让皮肤变好的小习惯，像朋友聊天一样", textRequired: true,
    durations: [15, 30, 45, 60], duration: 30, ratio: "9:16", ideas: ["开头先抛一个问题", "分成三点讲，每点一个画面", "结尾提醒关注"],
    structure: "人物面对镜头讲解，中间穿插和内容相关的画面，字幕跟着说的话走，结尾一句总结。" },
  { id: "ip-vlog", group: "ip", title: "IP 日常", description: "让你的 IP 过一天，拍成 vlog",
    images: { label: "人物照片", required: true, max: 2 }, voice: true,
    placeholder: "说说这一天做什么，例如：早起做早餐、去公园跑步、下午在咖啡馆工作", textRequired: true,
    durations: [15, 30, 45, 60], duration: 30, ratio: "9:16", ideas: ["用手持自拍的视角", "每个片段配一句心情", "画面统一成暖色调"],
    structure: "按时间顺序拍几个生活片段，人物长相和穿着保持一致，节奏轻快，像真实的 vlog。" },
  { id: "recreation", group: "ip", title: "爆款复刻", description: "参考一条爆款，做你自己的版本",
    images: { label: "替换素材", required: false, max: 4 }, video: { label: "参考视频", required: true },
    placeholder: "说说要换成什么，例如：把原片里的护手霜换成我的精华液，人物换成我的 IP", textRequired: true,
    durations: [15, 25, 30, 45], duration: 25, ratio: "9:16", ideas: ["保留原片的节奏和镜头顺序", "台词换成我的卖点", "人物换成我的 IP"],
    structure: "先拆解参考视频的镜头、节奏和文案结构，再按同样的结构换成我的内容重新拍。" },
];

/** 不选场景时的「自由出图」：自己写描述，参考图可放可不放。 */
export const freeImageScene: ImageScene = { id: "free", group: "ip", title: "自由出图", description: "自己写描述，可以放几张参考图",
  refs: [1, 2, 3, 4].map(n => ({ label: `参考图 ${n}`, required: false })), prompt: "", ratio: "3:4",
  hint: "说说想要什么画面。放了参考图的话，可以用「图1、图2」指它们" };

/** 真正发出去的描述：场景描述（或用户改过的完整描述）+ 补充要求。自由出图只有用户写的那句。 */
export function imagePrompt(scene: ImageScene, input: { supplement: string; custom?: string }): string {
  const extra = input.supplement.trim();
  if (scene.id === freeImageScene.id) return extra;
  const base = (input.custom ?? scene.prompt).trim();
  return extra ? `${base}\n补充要求：${extra}` : base;
}

export const imageScene = (id?: string | null) => id === freeImageScene.id ? freeImageScene : imageScenes.find(s => s.id === id);
export const videoScene = (id?: string | null) => videoScenes.find(s => s.id === id);
export const sceneCover = (id: string) => `/studio/scene-covers/${id}.webp`;

/** 草稿画布的名字带上这个后缀，「最近」据此认出是哪一页建的。 */
export const IMAGE_DRAFT_SUFFIX = " · AI 图片";
export const VIDEO_DRAFT_SUFFIX = " · AI 视频";
export const sceneFromDraftName = <T extends { title: string }>(name: string, suffix: string, scenes: readonly T[]) =>
  name.endsWith(suffix) ? scenes.find(s => name.slice(0, -suffix.length).split(" · ")[0] === s.title) : undefined;

/** 交给创作助手的那段话。只写用户给了的东西，没给的不编。 */
export function composeVideoBrief(scene: VideoScene, input: {
  text: string; duration: number; ratio: string;
  imageTitles: string[]; characterTitle?: string; voiceTitle?: string; videoTitle?: string;
}): string {
  const shape = input.ratio === "16:9" ? "横屏" : "竖屏";
  const lines = [`帮我做一条 ${input.duration} 秒的${shape}短视频，类型是「${scene.title}」。`];
  const text = input.text.trim();
  if (text) lines.push(`我的要求：${text}`);
  const materials: string[] = [];
  if (input.videoTitle) materials.push(`「${input.videoTitle}」是要复刻的参考视频`);
  if (input.imageTitles.length) materials.push(`${input.imageTitles.map(t => `「${t}」`).join("")}是上传的${scene.images.label}，画面里出现时要和它一致`);
  if (input.characterTitle) materials.push(`「${input.characterTitle}」是出镜人物，长相和穿着保持一致`);
  if (input.voiceTitle) materials.push(`「${input.voiceTitle}」是配音要用的声音`);
  if (materials.length) lines.push(`画布上的素材：${materials.join("；")}。`);
  if (!text && materials.length) lines.push("我没写具体要求，先看素材，再按下面的拍法出方案。");
  lines.push(`拍法：${scene.structure}`);
  // 老板没给的价格、优惠、地址，模型最容易顺手编一个，写进成片就是虚假宣传。
  lines.push("上面没写的信息（价格、优惠、地址、功效数据）不要自己编。");
  // 只说「先给我分镜方案」时，真模型（2026-10-29 本地聚算 Qwen）只排了一步写脚本，做完也不提出视频。要的是视频，就直说。
  lines.push("要的是做好的视频，不只是脚本：把文案、分镜和每段视频一起排进方案，报总共要花的积分，我确认后一次生成。");
  return lines.join("\n");
}

/** 首页「你想做什么？」：每张卡片落到一个场景分组。 */
export const homeGoals: { id: string; title: string; description: string; href: string; covers: [string, string]; kind: "video" | "image" }[] = [
  { id: "recreation", title: "爆款复刻", description: "照着爆款的结构，做自己的版本", href: "/video?scene=recreation", covers: ["recreation", "ecom-talking"], kind: "video" },
  { id: "product-set", title: "商品套图", description: "白底图、卖点图、模特图一起出", href: "/image?scene=white-background", covers: ["white-background", "selling-point"], kind: "image" },
  { id: "commerce", title: "电商带货", description: "商品展示和带货短视频", href: "/video?scene=ecom-talking", covers: ["ecom-talking", "ecom-seeding"], kind: "video" },
  { id: "local", title: "同城到店", description: "探店、团购，拍给附近的人看", href: "/video?scene=local-discovery", covers: ["local-discovery", "local-signature"], kind: "video" },
  { id: "brand", title: "品牌广告", description: "讲理念、讲故事的品牌片", href: "/video?scene=brand-proposition", covers: ["brand-proposition", "brand-lifestyle"], kind: "video" },
  { id: "drama", title: "剧情短片", description: "有冲突、有反转的短剧情", href: "/video?scene=drama-twist", covers: ["drama-twist", "drama-emotional"], kind: "video" },
  { id: "ip", title: "IP 形象", description: "一张照片做出设定图和写真", href: "/image?scene=ip-sheet", covers: ["ip-sheet", "ip-portrait"], kind: "image" },
];

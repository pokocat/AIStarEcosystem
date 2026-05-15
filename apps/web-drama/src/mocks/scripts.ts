// mocks/scripts.ts — 脚本工坊样本数据（drama 主线）。

import type { Script, ScriptVersion } from "@ai-star-eco/types";

const NOW = "2026-05-14T09:20:00Z";

export const SCRIPTS: Script[] = [
  {
    id: "sc-001",
    title: "《暮色未央》EP07 · 雨夜电话亭",
    kind: "drama",
    status: "review",
    series: "暮色未央",
    episode: "EP07",
    dramaId: "d-001",
    currentVersionId: "scv-001-3",
    progress: 86,
    suggestion: "审稿备注：第 4 场保留 3 秒静默，给短视频切片留情绪峰值。",
    createdAt: "2026-04-26T10:00:00Z",
    updatedAt: "2026-05-14T06:40:00Z",
    authorName: "陈陌",
  },
  {
    id: "sc-002",
    title: "《盛夏来信》EP03 · 操场重逢",
    kind: "drama",
    status: "draft",
    series: "盛夏来信",
    episode: "EP03",
    dramaId: "d-002",
    currentVersionId: "scv-002-2",
    progress: 58,
    suggestion: "把回忆线提前到片头 15 秒内，便于竖屏平台首屏留存。",
    createdAt: "2026-05-06T08:30:00Z",
    updatedAt: "2026-05-13T18:30:00Z",
    authorName: "陈陌",
  },
  {
    id: "sc-003",
    title: "《摩天与月光》先导片 · 30s 预告",
    kind: "trailer",
    status: "approved",
    series: "摩天与月光",
    episode: "宣传片",
    dramaId: "d-003",
    currentVersionId: "scv-003-4",
    progress: 95,
    suggestion: "已锁定城市夜景 + 电梯对峙版本，等待调色导出。",
    createdAt: "2026-05-02T03:12:00Z",
    updatedAt: NOW,
    authorName: "李雨萱",
  },
  {
    id: "sc-004",
    title: "《雾隐 · 1992》试拍本 · 雨巷电话亭",
    kind: "drama",
    status: "draft",
    series: "雾隐 · 1992",
    episode: "试拍本",
    dramaId: "d-004",
    currentVersionId: "scv-004-1",
    progress: 34,
    suggestion: "需要先完成 Aiko 年代妆发定稿，再排 2 小时棚内雨窗测试。",
    createdAt: "2026-05-09T12:00:00Z",
    updatedAt: "2026-05-13T20:00:00Z",
    authorName: "陈陌",
  },
];

export const SCRIPT_VERSIONS: ScriptVersion[] = [
  {
    id: "scv-001-1",
    scriptId: "sc-001",
    version: 1,
    content:
      "场 1 · 外景 · 城市天桥 · 夜雨\n雨水打在透明伞面上。苏念停在天桥中央，手机屏幕反复亮起：未知号码，未接来电 3 次。\n\n苏念（V.O.）：「七年前，他也是这样，只响三声就挂断。」\n\n场 2 · 内景 · 电话亭 · 夜\n苏念推门进去。玻璃上的雨水把街灯拉成金色细线。她拨回号码，对面只有电流声。\n\n陆烬（电话里）：「不要回头。」",
    authorName: "陈陌",
    aiAssisted: false,
    createdAt: "2026-04-20T10:00:00Z",
    note: "初稿",
  },
  {
    id: "scv-001-2",
    scriptId: "sc-001",
    version: 2,
    content:
      "场 1 · 外景 · 城市天桥 · 夜雨（修订）\n苏念停在天桥中央，桥下车流像一条断续的光河。手机震动，未知号码。\n\n苏念（V.O.）：「七年前，他也是这样，只响三声就挂断。」\n\n场 2 · 内景 · 电话亭 · 夜\n苏念拨回号码。电话亭外，一个穿黑色风衣的人影靠近。\n\n陆烬（电话里）：「念念，别回头。」\n苏念没有动。她看见玻璃反光里，那个人影停在门外。",
    authorName: "陈陌",
    aiAssisted: false,
    createdAt: "2026-05-01T14:00:00Z",
    note: "补对白",
  },
  {
    id: "scv-001-3",
    scriptId: "sc-001",
    version: 3,
    content:
      "场 1 · 外景 · 城市天桥 · 夜雨（v3）\n镜头从桥下车流抬起，切到苏念的伞面。手机屏幕亮起：未知号码。\n\n[闪回 · 高中礼堂 · 傍晚]\n少年陆烬把旧相机递给她。\n陆烬：「如果哪天找不到我，就先找这卷胶片。」\n\n场 2 · 内景 · 电话亭 · 夜\n苏念拨回号码。电话亭外，一个穿黑色风衣的人影靠近。\n\n陆烬（电话里）：「念念，别回头。」\n\n苏念没有回头。她抬眼看玻璃反光，三秒静默后，电话亭门把手轻轻转动。",
    authorName: "陈陌",
    aiAssisted: true,
    createdAt: "2026-05-13T01:12:00Z",
    note: "AI 建议：加入回忆镜头",
  },
  {
    id: "scv-002-1",
    scriptId: "sc-002",
    version: 1,
    content:
      "场 1 · 外景 · 学校操场 · 傍晚\n林晓抱着一箱旧社团物料穿过跑道。周野在看台上修一台坏掉的广播。\n\n周野：「你真的要把广播站关掉？」\n林晓：「不是关掉，是让它安静一阵子。」\n\n场 2 · 内景 · 广播室 · 傍晚\n旧磁带卡住。林晓听见十年前自己的声音：『如果有一天我忘了这里，请替我记得。』",
    authorName: "陈陌",
    aiAssisted: false,
    createdAt: "2026-04-22T08:30:00Z",
  },
  {
    id: "scv-002-2",
    scriptId: "sc-002",
    version: 2,
    content:
      "场 1 · 外景 · 学校操场 · 傍晚（v2）\n开场 8 秒给操场空镜：风吹起红色跑道边的纸条。林晓捡起，上面写着『17 号柜』。\n\n周野在看台上修广播。\n周野：「你每次想走，都会先把东西收得很整齐。」\n林晓：「那你每次都假装没看见。」\n\n场 2 · 内景 · 广播室 · 傍晚\n磁带播放。十年前的林晓说：『如果有一天我不敢回来，请把这封信读给我听。』",
    authorName: "陈陌",
    aiAssisted: true,
    createdAt: "2026-05-12T18:30:00Z",
    note: "AI 建议：合并次线索",
  },
  {
    id: "scv-003-1",
    scriptId: "sc-003",
    version: 1,
    content:
      "0-03s 城市夜景航拍，字幕：『她签下那份合约时，还不知道代价。』\n03-09s 电梯门合上，苏念与顾辰对视，楼层数字从 17 跳到 32。\n09-18s 会议室玻璃倒影，月光落在合同第 4 条。\n18-27s 顾辰低声：『你要的真相，在顶楼。』\n27-30s 片名卡：摩天与月光。",
    authorName: "李雨萱",
    aiAssisted: false,
    createdAt: "2026-04-10T03:12:00Z",
  },
  {
    id: "scv-003-2",
    scriptId: "sc-003",
    version: 2,
    content:
      "0-05s 黑场接手机录音波形，背景是城市低频噪声。\n05-12s 苏念走进空会议室，桌上只放一枚电梯卡。\n12-22s 顾辰在落地窗前转身，窗外是高架车流。\n22-30s 快切：签字、停电、月光、顶楼门打开。",
    authorName: "李雨萱",
    aiAssisted: false,
    createdAt: "2026-04-22T03:12:00Z",
  },
  {
    id: "scv-003-3",
    scriptId: "sc-003",
    version: 3,
    content:
      "0-04s 电梯监控视角，画面压暗，字幕：『所有人都说他已经离开。』\n04-14s 苏念按下 32 层，镜头推近她攥紧的电梯卡。\n14-24s 顾辰的背影切入，合同页被风翻到违约条款。\n24-30s 两人隔着玻璃对视，月光扫过片名。",
    authorName: "李雨萱",
    aiAssisted: false,
    createdAt: "2026-05-02T03:12:00Z",
  },
  {
    id: "scv-003-4",
    scriptId: "sc-003",
    version: 4,
    content:
      "0-03s 城市夜景航拍，音乐只留低频心跳。\n03-08s 电梯上行，红色楼层数字从 17 跳到 32。\n08-15s 苏念看见合同背面的手写地址：顶楼西侧机房。\n15-23s 顾辰站在落地窗前：『你不是来谈生意的。』\n23-30s 灯灭，月光打在两人的侧脸上，片名切入。",
    authorName: "李雨萱",
    aiAssisted: false,
    createdAt: NOW,
    note: "待定终稿",
  },
  {
    id: "scv-004-1",
    scriptId: "sc-004",
    version: 1,
    content:
      "场 1 · 外景 · 老城雨巷 · 清晨\n1992 年，巷口照相馆还没有开门。Aiko 站在门檐下，手里攥着一张被雨泡皱的取照片据。\n\n照相馆老板（画外）：「姑娘，这张底片不是你的。」\n\n场 2 · 内景 · 照相馆暗房 · 清晨\n红灯亮起。水槽里的照片慢慢显影：照片上是同一条巷子，但门牌号不存在。\n\nAiko：「那是谁把我的名字写在背面？」",
    authorName: "陈陌",
    aiAssisted: false,
    createdAt: "2026-05-08T12:00:00Z",
  },
];

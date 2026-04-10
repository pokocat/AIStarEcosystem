import type { Lang } from "@/types/app";

export const appDictionary = {
  zh: {
    nav: {
      features: "核心功能",
      showcase: "孵化案例",
      ecosystem: "生态流程",
      about: "关于我们",
      enter: "进入控制台"
    },
    hero: {
      cta_primary: "开始构建生态",
      cta_secondary: "观看概念片",
      stats_songs: "120万+ 生成歌曲"
    },
    workflow: {
      tag: "闭环生态",
      title: "不仅仅是工具，更是一个自运行经济体。",
      desc: "传统音乐产业是线性的、封闭的。这里则是连接创作、发行与变现的价值网络。",
      steps: [
        { title: "创造 (Create)", desc: "利用 AI 生成歌手人设、歌词、旋律与视觉资产。" },
        { title: "发行 (Distribute)", desc: "一键分发至全球流媒体与短视频渠道。" },
        { title: "变现 (Monetize)", desc: "通过 NFT、粉丝经济与商业合作持续获得收益。" }
      ]
    },
    features: {
      saas_title: "Super-SaaS 工作台",
      saas_desc: "把 AI 创作、分发和商业化集中到一个生产环境里。",
      assets_title: "资产上链",
      assets_desc: "每首歌、每个徽章都有可追踪的数字指纹。",
      dao_title: "粉丝 DAO",
      dao_desc: "让粉丝共同参与投票、收藏与社区治理。"
    },
    portal: {
      fan_title: "星际听众",
      fan_desc: "发现新歌、投票打榜、收藏限量数字资产。",
      fan_btn: "进入秀场",
      maker_title: "造梦架构师",
      maker_desc: "孵化 AI 歌手，完成创作、发行与变现全流程。",
      maker_btn: "开始创作",
      coach_title: "生态领航员",
      coach_desc: "管理制作人、跟踪 KPI、分派任务并复盘结果。",
      coach_btn: "管理后台"
    },
    fan: {
      title: "星际金曲榜",
      market_title: "限量徽章市场",
      discovery: "发现",
      charts: "榜单",
      market: "市场",
      me: "我的",
      vote: "投票",
      mint: "铸造",
      remaining: "剩余",
      guess_like: "猜你喜欢"
    },
    producer: {
      sidebar: {
        dashboard: "经纪大盘",
        incubator: "AI 歌手孵化",
        studio: "AI 录音棚",
        distribution: "发行页面",
        mint: "NFT 铸造",
        earnings: "财务中心",
        community: "社区广场",
        logout: "退出登录",
        switch: "切换艺人",
        new_project: "孵化新歌手"
      },
      locked: {
        title: "即将解锁",
        desc: "社区功能正在开发中，升级到 Pro 计划可优先体验粉丝 DAO、社区治理与共创活动。",
        back: "返回总览"
      },
      intro: {
        maker_desc: "孵化 AI 歌手，完成创作、发行与变现全流程。",
        maker_btn: "进入工作台"
      },
      overview: {
        title: "制作人工作台",
        subtitle: "围绕 AI 艺人孵化、创作、发行与变现的统一工作流。",
        create: "孵化新歌手",
        metrics: ["在营艺人", "总播放量", "市场签约", "公司收益"]
      },
      studio: {
        title: "AI 录音棚",
        subtitle: "基于 11 种生成模式快速产出可发布曲目。",
        generate: "打开音乐生成器",
        library: "作品库"
      },
      mint: {
        title: "版权与链上资产",
        subtitle: "为作品建立链上收藏品与收益入口。",
        open: "打开 NFT 铸造"
      },
      earnings: {
        title: "财务中心",
        subtitle: "查看版税、NFT 销售与交易流水。"
      }
    },
    coach: {
      sidebar: {
        cmd: "指挥中心",
        trainees: "学员管理",
        msg: "消息",
        settings: "设置",
        logout: "退出"
      },
      header: {
        region: "亚太区节点",
        value: "生态总价值"
      },
      monitor: {
        title: "小队监控",
        desc: "实时追踪制作人的产出、收益与审核状态。",
        filter: "筛选",
        new_task: "下发任务",
        kpi_songs: "本周新歌",
        kpi_rate: "成功率",
        kpi_review: "待审批"
      },
      table: {
        producer: "制作人",
        status: "状态",
        progress: "进度",
        rev: "收益",
        action: "操作"
      },
      detail: {
        msg: "发送消息",
        profile: "查看档案",
        latest: "最新提交",
        submitted: "提交时间",
        approve: "通过",
        reject: "驳回",
        radar: "能力雷达",
        close: "关闭面板"
      }
    }
  },
  en: {
    nav: {
      features: "Features",
      showcase: "Showcase",
      ecosystem: "Workflow",
      about: "About",
      enter: "Enter Console"
    },
    hero: {
      cta_primary: "Start Building",
      cta_secondary: "Watch Concept",
      stats_songs: "1.2M+ Songs"
    },
    workflow: {
      tag: "Closed Loop",
      title: "Not just tooling, but a self-running economy.",
      desc: "Creation, distribution, and monetization converge into one operating system.",
      steps: [
        { title: "Create", desc: "Generate singers, songs, visuals, and identity systems with AI." },
        { title: "Distribute", desc: "Ship to streaming and short-video channels globally." },
        { title: "Monetize", desc: "Capture value through NFTs, fan economy, and commercial deals." }
      ]
    },
    features: {
      saas_title: "Super-SaaS Workspace",
      saas_desc: "A unified production environment for creating, launching, and monetizing AI artists.",
      assets_title: "On-Chain Assets",
      assets_desc: "Every track and badge carries a verifiable digital fingerprint.",
      dao_title: "Fan DAO",
      dao_desc: "Fans participate in voting, collecting, and governance loops."
    },
    portal: {
      fan_title: "Galactic Listener",
      fan_desc: "Discover music, vote on charts, and collect scarce digital assets.",
      fan_btn: "Enter Show",
      maker_title: "Dream Architect",
      maker_desc: "Incubate AI singers and manage the full creation-to-monetization loop.",
      maker_btn: "Start Creating",
      coach_title: "Ecosystem Navigator",
      coach_desc: "Monitor producers, assign work, and optimize ecosystem output.",
      coach_btn: "Coach Hub"
    },
    fan: {
      title: "Star Charts",
      market_title: "Badge Market",
      discovery: "Discover",
      charts: "Charts",
      market: "Market",
      me: "Me",
      vote: "Vote",
      mint: "Mint",
      remaining: "Remaining",
      guess_like: "You Might Like"
    },
    producer: {
      sidebar: {
        dashboard: "Dashboard",
        incubator: "AI Incubator",
        studio: "Studio",
        distribution: "Distribution",
        mint: "NFT Mint",
        earnings: "Earnings",
        community: "Community",
        logout: "Logout",
        switch: "Switch Singer",
        new_project: "Create Singer"
      },
      locked: {
        title: "Coming Soon",
        desc: "Community features are in development. Upgrade to Pro for early access to Fan DAO, governance, and co-creation events.",
        back: "Back to Overview"
      },
      intro: {
        maker_desc: "Incubate AI singers and manage the full creation-to-monetization loop.",
        maker_btn: "Enter Workspace"
      },
      overview: {
        title: "Producer Workspace",
        subtitle: "A unified workflow for incubating, creating, distributing, and monetizing AI artists.",
        create: "Create Singer",
        metrics: ["Artists", "Total Plays", "Market Signings", "Revenue"]
      },
      studio: {
        title: "AI Studio",
        subtitle: "Generate release-ready music across 11 creation modes.",
        generate: "Open Generator",
        library: "Library"
      },
      mint: {
        title: "Copyright & NFT Assets",
        subtitle: "Turn tracks into on-chain collectibles and monetization assets.",
        open: "Open NFT Minting"
      },
      earnings: {
        title: "Earnings Center",
        subtitle: "Review royalties, NFT sales, and transaction history."
      }
    },
    coach: {
      sidebar: {
        cmd: "Command",
        trainees: "Trainees",
        msg: "Messages",
        settings: "Settings",
        logout: "Logout"
      },
      header: {
        region: "APAC Node",
        value: "Eco Total Value"
      },
      monitor: {
        title: "Squad Monitor",
        desc: "Track producer output, revenue, and review pipeline in real time.",
        filter: "Filter",
        new_task: "New Task",
        kpi_songs: "New Songs",
        kpi_rate: "Success Rate",
        kpi_review: "Pending Reviews"
      },
      table: {
        producer: "Producer",
        status: "Status",
        progress: "Progress",
        rev: "Revenue",
        action: "Action"
      },
      detail: {
        msg: "Message",
        profile: "Profile",
        latest: "Latest Submission",
        submitted: "Submitted",
        approve: "Approve",
        reject: "Reject",
        radar: "Skills Radar",
        close: "Close Panel"
      }
    }
  }
} satisfies Record<Lang, any>;

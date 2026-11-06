import type { LocalizedText, SolutionId } from './ipPlatform';

/* Generated content for the vertical solution homepages: deliverables, a day in the life,
   before/after results, FAQ and one interactive spotlight module per solution. */

export interface SpotlightOption {
  label: LocalizedText;
  headline: LocalizedText;
  cards: Array<{ title: LocalizedText; sub: LocalizedText }>;
  chips?: LocalizedText[];
  metrics?: Array<{ value: string; label: LocalizedText }>;
  highlight?: LocalizedText;
}

export type SolutionSpotlight =
  | { kind: 'tabs'; title: LocalizedText; desc: LocalizedText; cardsTitle: LocalizedText; chipsTitle?: LocalizedText; options: SpotlightOption[] }
  | { kind: 'journey'; title: LocalizedText; desc: LocalizedText; steps: Array<{ time: string; label: LocalizedText; desc: LocalizedText; output: LocalizedText }> };

export interface SolutionDetail {
  deliverables: Array<{ title: LocalizedText; desc: LocalizedText }>;
  day: Array<{ time: string; title: LocalizedText; output: LocalizedText }>;
  results: Array<{ label: LocalizedText; before: LocalizedText; after: LocalizedText; change: string }>;
  faq: Array<{ q: LocalizedText; a: LocalizedText }>;
  spotlight: SolutionSpotlight;
}

export const SOLUTION_DETAILS: Partial<Record<SolutionId, SolutionDetail>> = {
  "ai-drama": {
    "deliverables": [
      {
        "title": {
          "zh": "角色资产库",
          "en": "Character Library"
        },
        "desc": {
          "zh": "人设、形象与声音统一复用",
          "en": "Reusable looks, voices and bios"
        }
      },
      {
        "title": {
          "zh": "分集剧本",
          "en": "Episode Scripts"
        },
        "desc": {
          "zh": "大纲、分集与台词",
          "en": "Outlines, episodes and dialogue"
        }
      },
      {
        "title": {
          "zh": "分镜与成片",
          "en": "Storyboards & Cuts"
        },
        "desc": {
          "zh": "镜头、配乐与剪辑",
          "en": "Shots, score and edit"
        }
      },
      {
        "title": {
          "zh": "发行数据",
          "en": "Release Data"
        },
        "desc": {
          "zh": "完播、追更与分账",
          "en": "Completion, follows and revenue"
        }
      }
    ],
    "day": [
      {
        "time": "09:00",
        "title": {
          "zh": "AI 生成 3 个剧情方向",
          "en": "AI pitches 3 story directions"
        },
        "output": {
          "zh": "3 个选题",
          "en": "3 concepts"
        }
      },
      {
        "time": "11:00",
        "title": {
          "zh": "打磨剧本并定稿",
          "en": "Polish and lock the script"
        },
        "output": {
          "zh": "第 5 集定稿",
          "en": "Episode 5 locked"
        }
      },
      {
        "time": "14:00",
        "title": {
          "zh": "批量生成分镜与画面",
          "en": "Batch storyboards and shots"
        },
        "output": {
          "zh": "48 个镜头",
          "en": "48 shots"
        }
      },
      {
        "time": "17:00",
        "title": {
          "zh": "剪辑配乐并发布",
          "en": "Edit, score and publish"
        },
        "output": {
          "zh": "2 集上线",
          "en": "2 episodes live"
        }
      },
      {
        "time": "21:00",
        "title": {
          "zh": "查看完播与评论",
          "en": "Review completion and comments"
        },
        "output": {
          "zh": "下一集调整建议",
          "en": "Notes for next episode"
        }
      }
    ],
    "results": [
      {
        "label": {
          "zh": "单集制作周期",
          "en": "Episode turnaround"
        },
        "before": {
          "zh": "14 天",
          "en": "14 days"
        },
        "after": {
          "zh": "3 天",
          "en": "3 days"
        },
        "change": "-79%"
      },
      {
        "label": {
          "zh": "单集成本",
          "en": "Cost per episode"
        },
        "before": {
          "zh": "¥8 万",
          "en": "¥80K"
        },
        "after": {
          "zh": "¥1.2 万",
          "en": "¥12K"
        },
        "change": "-85%"
      },
      {
        "label": {
          "zh": "月更新集数",
          "en": "Episodes per month"
        },
        "before": {
          "zh": "4 集",
          "en": "4"
        },
        "after": {
          "zh": "30 集",
          "en": "30"
        },
        "change": "7.5x"
      }
    ],
    "faq": [
      {
        "q": {
          "zh": "角色在不同集里会不会变样？",
          "en": "Will characters stay consistent?"
        },
        "a": {
          "zh": "角色资产会锁定形象与声音，每一集都复用同一套设定。",
          "en": "Character assets lock looks and voices, reused in every episode."
        }
      },
      {
        "q": {
          "zh": "可以导入自己的剧本吗？",
          "en": "Can I import my own script?"
        },
        "a": {
          "zh": "支持导入剧本或大纲，AI 会自动拆分场景和镜头。",
          "en": "Import a script or outline and AI breaks it into scenes and shots."
        }
      },
      {
        "q": {
          "zh": "作品版权归谁？",
          "en": "Who owns the rights?"
        },
        "a": {
          "zh": "你创作的剧本、角色与成片版权归你所有。",
          "en": "You own the scripts, characters and finished episodes you create."
        }
      }
    ],
    "spotlight": {
      "kind": "tabs",
      "title": {
        "zh": "选一个题材，看第 1 集怎么生成",
        "en": "Pick a Genre, See Episode 1"
      },
      "desc": {
        "zh": "AI 根据题材自动生成主要角色和第 1 集分镜。",
        "en": "AI drafts the main cast and an Episode 1 storyboard for each genre."
      },
      "cardsTitle": {
        "zh": "主要角色",
        "en": "Main Cast"
      },
      "options": [
        {
          "label": {
            "zh": "悬疑",
            "en": "Mystery"
          },
          "headline": {
            "zh": "雾港码头，一桩十年前的旧案重新开启",
            "en": "A decade-old case reopens at Fog Harbor"
          },
          "cards": [
            {
              "title": {
                "zh": "林深",
                "en": "Lin Shen"
              },
              "sub": {
                "zh": "刑警",
                "en": "Detective"
              }
            },
            {
              "title": {
                "zh": "沈雾",
                "en": "Shen Wu"
              },
              "sub": {
                "zh": "记者",
                "en": "Reporter"
              }
            },
            {
              "title": {
                "zh": "老 K",
                "en": "Old K"
              },
              "sub": {
                "zh": "线人",
                "en": "Informant"
              }
            }
          ],
          "chips": [
            {
              "zh": "雨夜码头远景",
              "en": "Rainy dock wide shot"
            },
            {
              "zh": "旧档案特写",
              "en": "Close-up of the old file"
            },
            {
              "zh": "审讯室对峙",
              "en": "Interrogation standoff"
            },
            {
              "zh": "结尾反转",
              "en": "Final twist"
            }
          ],
          "metrics": [
            {
              "value": "78%",
              "label": {
                "zh": "预计完播率",
                "en": "Est. completion"
              }
            },
            {
              "value": "24 集",
              "label": {
                "zh": "规划集数",
                "en": "Planned episodes"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "都市",
            "en": "Urban"
          },
          "headline": {
            "zh": "合租公寓里，四个年轻人的创业一年",
            "en": "Four flatmates, one year of startup life"
          },
          "cards": [
            {
              "title": {
                "zh": "许然",
                "en": "Xu Ran"
              },
              "sub": {
                "zh": "产品经理",
                "en": "Product manager"
              }
            },
            {
              "title": {
                "zh": "周可",
                "en": "Zhou Ke"
              },
              "sub": {
                "zh": "设计师",
                "en": "Designer"
              }
            },
            {
              "title": {
                "zh": "陈野",
                "en": "Chen Ye"
              },
              "sub": {
                "zh": "程序员",
                "en": "Engineer"
              }
            }
          ],
          "chips": [
            {
              "zh": "清晨地铁",
              "en": "Morning metro"
            },
            {
              "zh": "路演失败",
              "en": "Pitch gone wrong"
            },
            {
              "zh": "天台夜谈",
              "en": "Rooftop talk"
            },
            {
              "zh": "意外投资",
              "en": "Surprise investor"
            }
          ],
          "metrics": [
            {
              "value": "82%",
              "label": {
                "zh": "预计完播率",
                "en": "Est. completion"
              }
            },
            {
              "value": "36 集",
              "label": {
                "zh": "规划集数",
                "en": "Planned episodes"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "古风",
            "en": "Period"
          },
          "headline": {
            "zh": "江南织造世家的女儿，为父洗清冤屈",
            "en": "A weaving heiress clears her father's name"
          },
          "cards": [
            {
              "title": {
                "zh": "苏锦",
                "en": "Su Jin"
              },
              "sub": {
                "zh": "织造千金",
                "en": "Weaving heiress"
              }
            },
            {
              "title": {
                "zh": "裴昭",
                "en": "Pei Zhao"
              },
              "sub": {
                "zh": "巡按御史",
                "en": "Imperial inspector"
              }
            },
            {
              "title": {
                "zh": "柳娘",
                "en": "Madam Liu"
              },
              "sub": {
                "zh": "绣坊掌柜",
                "en": "Workshop owner"
              }
            }
          ],
          "chips": [
            {
              "zh": "织坊晨景",
              "en": "Workshop at dawn"
            },
            {
              "zh": "公堂受审",
              "en": "Trial at court"
            },
            {
              "zh": "密信特写",
              "en": "Secret letter close-up"
            },
            {
              "zh": "夜探库房",
              "en": "Night search of the store"
            }
          ],
          "metrics": [
            {
              "value": "80%",
              "label": {
                "zh": "预计完播率",
                "en": "Est. completion"
              }
            },
            {
              "value": "40 集",
              "label": {
                "zh": "规划集数",
                "en": "Planned episodes"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "科幻",
            "en": "Sci-Fi"
          },
          "headline": {
            "zh": "2089 年，一位记忆修复师发现自己的记忆是假的",
            "en": "In 2089, a memory restorer learns her memories are fake"
          },
          "cards": [
            {
              "title": {
                "zh": "艾琳",
                "en": "Irene"
              },
              "sub": {
                "zh": "记忆修复师",
                "en": "Memory restorer"
              }
            },
            {
              "title": {
                "zh": "K-7",
                "en": "K-7"
              },
              "sub": {
                "zh": "仿生助手",
                "en": "Android assistant"
              }
            },
            {
              "title": {
                "zh": "莫顿",
                "en": "Morton"
              },
              "sub": {
                "zh": "公司高管",
                "en": "Executive"
              }
            }
          ],
          "chips": [
            {
              "zh": "霓虹城市航拍",
              "en": "Neon city aerial"
            },
            {
              "zh": "记忆舱启动",
              "en": "Memory pod boots"
            },
            {
              "zh": "记忆碎片闪回",
              "en": "Memory flashback"
            },
            {
              "zh": "真相揭晓",
              "en": "The reveal"
            }
          ],
          "metrics": [
            {
              "value": "76%",
              "label": {
                "zh": "预计完播率",
                "en": "Est. completion"
              }
            },
            {
              "value": "18 集",
              "label": {
                "zh": "规划集数",
                "en": "Planned episodes"
              }
            }
          ]
        }
      ],
      "chipsTitle": {
        "zh": "第 1 集分镜",
        "en": "Episode 1 Storyboard"
      }
    }
  },
  "story-commerce": {
    "deliverables": [
      {
        "title": {
          "zh": "商品卖点库",
          "en": "Product Insight"
        },
        "desc": {
          "zh": "卖点、人群与使用场景",
          "en": "Selling points, audiences and use cases"
        }
      },
      {
        "title": {
          "zh": "剧情版本",
          "en": "Story Variants"
        },
        "desc": {
          "zh": "同一商品的多版本剧情",
          "en": "Multiple stories per product"
        }
      },
      {
        "title": {
          "zh": "植入脚本",
          "en": "Placement Scripts"
        },
        "desc": {
          "zh": "商品出现时机与台词",
          "en": "Product timing and lines"
        }
      },
      {
        "title": {
          "zh": "转化报表",
          "en": "Conversion Report"
        },
        "desc": {
          "zh": "点击、加购与成交归因",
          "en": "Clicks, carts and sales attribution"
        }
      }
    ],
    "day": [
      {
        "time": "09:00",
        "title": {
          "zh": "导入新品资料",
          "en": "Import the new product"
        },
        "output": {
          "zh": "12 个卖点",
          "en": "12 selling points"
        }
      },
      {
        "time": "10:30",
        "title": {
          "zh": "生成 3 个剧情版本",
          "en": "Generate 3 story versions"
        },
        "output": {
          "zh": "A/B/C 脚本",
          "en": "A/B/C scripts"
        }
      },
      {
        "time": "14:00",
        "title": {
          "zh": "批量生成短剧素材",
          "en": "Produce the short dramas"
        },
        "output": {
          "zh": "9 条视频",
          "en": "9 videos"
        }
      },
      {
        "time": "18:00",
        "title": {
          "zh": "小流量测试",
          "en": "Run a small test"
        },
        "output": {
          "zh": "点击率对比",
          "en": "CTR comparison"
        }
      },
      {
        "time": "21:00",
        "title": {
          "zh": "放量最优版本",
          "en": "Scale the winning version"
        },
        "output": {
          "zh": "ROI 3.5x",
          "en": "3.5x ROI"
        }
      }
    ],
    "results": [
      {
        "label": {
          "zh": "内容制作周期",
          "en": "Content cycle"
        },
        "before": {
          "zh": "7 天",
          "en": "7 days"
        },
        "after": {
          "zh": "1 天",
          "en": "1 day"
        },
        "change": "-86%"
      },
      {
        "label": {
          "zh": "单条成本",
          "en": "Cost per video"
        },
        "before": {
          "zh": "¥5000",
          "en": "¥5,000"
        },
        "after": {
          "zh": "¥600",
          "en": "¥600"
        },
        "change": "-88%"
      },
      {
        "label": {
          "zh": "平均转化率",
          "en": "Avg. conversion"
        },
        "before": {
          "zh": "1.8%",
          "en": "1.8%"
        },
        "after": {
          "zh": "8.6%",
          "en": "8.6%"
        },
        "change": "4.8x"
      }
    ],
    "faq": [
      {
        "q": {
          "zh": "剧情会不会太像广告？",
          "en": "Will it feel like an ad?"
        },
        "a": {
          "zh": "商品只在剧情需要时出现，AI 会控制植入时长与频次。",
          "en": "Products appear only when the story calls for it, with controlled timing."
        }
      },
      {
        "q": {
          "zh": "能否接入自己的店铺数据？",
          "en": "Can I connect store data?"
        },
        "a": {
          "zh": "可以接入店铺成交数据，按集归因转化效果。",
          "en": "Connect store sales to attribute conversions per episode."
        }
      },
      {
        "q": {
          "zh": "一个商品能做多少版本？",
          "en": "How many versions per product?"
        },
        "a": {
          "zh": "通常先做 3 个版本小流量测试，再放量表现最好的。",
          "en": "Usually 3 versions are tested, then the winner is scaled."
        }
      }
    ],
    "spotlight": {
      "kind": "tabs",
      "title": {
        "zh": "同一款精华，三种剧情卖法",
        "en": "One Serum, Three Story Versions"
      },
      "desc": {
        "zh": "对比三个剧情版本的小流量测试结果，挑出最优版本放量。",
        "en": "Compare test results of three versions and scale the best one."
      },
      "cardsTitle": {
        "zh": "剧情节奏",
        "en": "Story Beats"
      },
      "options": [
        {
          "label": {
            "zh": "A · 反转剧情",
            "en": "A · Plot Twist"
          },
          "headline": {
            "zh": "被嘲笑熬夜脸的她，一周后惊艳全场",
            "en": "Mocked for tired skin, she stuns everyone a week later"
          },
          "cards": [
            {
              "title": {
                "zh": "开场",
                "en": "Hook"
              },
              "sub": {
                "zh": "同事聚会被调侃",
                "en": "Teased at a party"
              }
            },
            {
              "title": {
                "zh": "植入",
                "en": "Placement"
              },
              "sub": {
                "zh": "闺蜜递来精华",
                "en": "A friend hands her the serum"
              }
            },
            {
              "title": {
                "zh": "转化",
                "en": "Payoff"
              },
              "sub": {
                "zh": "一周后反转",
                "en": "The twist a week later"
              }
            }
          ],
          "metrics": [
            {
              "value": "12.4%",
              "label": {
                "zh": "点击率",
                "en": "CTR"
              }
            },
            {
              "value": "8.6%",
              "label": {
                "zh": "转化率",
                "en": "Conversion"
              }
            },
            {
              "value": "3.5x",
              "label": {
                "zh": "投产比",
                "en": "ROI"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "B · 闺蜜测评",
            "en": "B · Bestie Review"
          },
          "headline": {
            "zh": "两个闺蜜真实对比 7 天使用效果",
            "en": "Two friends compare 7 days of results"
          },
          "cards": [
            {
              "title": {
                "zh": "开场",
                "en": "Hook"
              },
              "sub": {
                "zh": "素颜对镜头",
                "en": "Bare-faced to camera"
              }
            },
            {
              "title": {
                "zh": "植入",
                "en": "Placement"
              },
              "sub": {
                "zh": "每日打卡记录",
                "en": "Daily check-ins"
              }
            },
            {
              "title": {
                "zh": "转化",
                "en": "Payoff"
              },
              "sub": {
                "zh": "第 7 天对比",
                "en": "Day 7 comparison"
              }
            }
          ],
          "metrics": [
            {
              "value": "9.8%",
              "label": {
                "zh": "点击率",
                "en": "CTR"
              }
            },
            {
              "value": "10.2%",
              "label": {
                "zh": "转化率",
                "en": "Conversion"
              }
            },
            {
              "value": "4.1x",
              "label": {
                "zh": "投产比",
                "en": "ROI"
              }
            }
          ],
          "highlight": {
            "zh": "转化最高，建议放量",
            "en": "Highest conversion — scale this"
          }
        },
        {
          "label": {
            "zh": "C · 职场逆袭",
            "en": "C · Office Comeback"
          },
          "headline": {
            "zh": "连续加班的新人，在汇报日状态满分",
            "en": "An overworked rookie shines on presentation day"
          },
          "cards": [
            {
              "title": {
                "zh": "开场",
                "en": "Hook"
              },
              "sub": {
                "zh": "深夜加班",
                "en": "Late night at work"
              }
            },
            {
              "title": {
                "zh": "植入",
                "en": "Placement"
              },
              "sub": {
                "zh": "睡前护肤",
                "en": "Night skincare"
              }
            },
            {
              "title": {
                "zh": "转化",
                "en": "Payoff"
              },
              "sub": {
                "zh": "汇报惊艳全场",
                "en": "Nails the presentation"
              }
            }
          ],
          "metrics": [
            {
              "value": "11.1%",
              "label": {
                "zh": "点击率",
                "en": "CTR"
              }
            },
            {
              "value": "7.4%",
              "label": {
                "zh": "转化率",
                "en": "Conversion"
              }
            },
            {
              "value": "3.2x",
              "label": {
                "zh": "投产比",
                "en": "ROI"
              }
            }
          ]
        }
      ]
    }
  },
  "virtual-idol": {
    "deliverables": [
      {
        "title": {
          "zh": "偶像人设",
          "en": "Idol Persona"
        },
        "desc": {
          "zh": "形象、性格与世界观",
          "en": "Look, personality and lore"
        }
      },
      {
        "title": {
          "zh": "专属声线",
          "en": "Signature Voice"
        },
        "desc": {
          "zh": "说话与歌唱声音",
          "en": "Speaking and singing voice"
        }
      },
      {
        "title": {
          "zh": "直播系统",
          "en": "Live System"
        },
        "desc": {
          "zh": "动捕直播与互动",
          "en": "Mocap streams and interaction"
        }
      },
      {
        "title": {
          "zh": "粉丝资产",
          "en": "Fandom Assets"
        },
        "desc": {
          "zh": "会员、应援与周边",
          "en": "Memberships, support and merch"
        }
      }
    ],
    "day": [
      {
        "time": "10:00",
        "title": {
          "zh": "发布日常动态",
          "en": "Post daily updates"
        },
        "output": {
          "zh": "3 条动态",
          "en": "3 posts"
        }
      },
      {
        "time": "13:00",
        "title": {
          "zh": "录制新歌片段",
          "en": "Record a new song clip"
        },
        "output": {
          "zh": "1 段 Demo",
          "en": "1 demo"
        }
      },
      {
        "time": "16:00",
        "title": {
          "zh": "回复粉丝留言",
          "en": "Reply to fans"
        },
        "output": {
          "zh": "300+ 互动",
          "en": "300+ replies"
        }
      },
      {
        "time": "20:00",
        "title": {
          "zh": "开启 2 小时直播",
          "en": "Go live for 2 hours"
        },
        "output": {
          "zh": "18 万观看",
          "en": "180K viewers"
        }
      },
      {
        "time": "23:00",
        "title": {
          "zh": "整理应援数据",
          "en": "Review fan support data"
        },
        "output": {
          "zh": "次日企划",
          "en": "Plan for tomorrow"
        }
      }
    ],
    "results": [
      {
        "label": {
          "zh": "出道准备周期",
          "en": "Time to debut"
        },
        "before": {
          "zh": "6 个月",
          "en": "6 months"
        },
        "after": {
          "zh": "30 天",
          "en": "30 days"
        },
        "change": "-83%"
      },
      {
        "label": {
          "zh": "运营团队人数",
          "en": "Ops team size"
        },
        "before": {
          "zh": "12 人",
          "en": "12 people"
        },
        "after": {
          "zh": "2 人",
          "en": "2 people"
        },
        "change": "-83%"
      },
      {
        "label": {
          "zh": "每周直播时长",
          "en": "Weekly live hours"
        },
        "before": {
          "zh": "4 小时",
          "en": "4 hours"
        },
        "after": {
          "zh": "30 小时",
          "en": "30 hours"
        },
        "change": "7.5x"
      }
    ],
    "faq": [
      {
        "q": {
          "zh": "需要动捕设备吗？",
          "en": "Do I need mocap gear?"
        },
        "a": {
          "zh": "普通摄像头即可完成面部驱动，专业动捕设备可选接入。",
          "en": "A webcam handles face tracking; pro mocap is optional."
        }
      },
      {
        "q": {
          "zh": "一个人能运营吗？",
          "en": "Can one person run it?"
        },
        "a": {
          "zh": "日常内容、互动回复与排期都有 AI 辅助，一人即可运营。",
          "en": "AI handles daily content, replies and scheduling for a solo operator."
        }
      },
      {
        "q": {
          "zh": "能做虚拟团体吗？",
          "en": "Can I build a group?"
        },
        "a": {
          "zh": "支持多成员团体，每位成员拥有独立人设和声线。",
          "en": "Yes — each member gets their own persona and voice."
        }
      }
    ],
    "spotlight": {
      "kind": "journey",
      "title": {
        "zh": "出道 30 天运营日历",
        "en": "30-Day Debut Calendar"
      },
      "desc": {
        "zh": "从人设公开到首场线上演唱会，每一天都有明确目标。",
        "en": "From persona reveal to the first online concert, every day has a goal."
      },
      "steps": [
        {
          "time": "D1",
          "label": {
            "zh": "公布人设",
            "en": "Persona reveal"
          },
          "desc": {
            "zh": "发布形象预告与世界观设定",
            "en": "Teaser visuals and lore drop"
          },
          "output": {
            "zh": "2 条预热视频",
            "en": "2 teaser videos"
          }
        },
        {
          "time": "D3",
          "label": {
            "zh": "首支单曲",
            "en": "Debut single"
          },
          "desc": {
            "zh": "上线出道单曲与 MV",
            "en": "Release debut single and MV"
          },
          "output": {
            "zh": "1 首单曲",
            "en": "1 single"
          }
        },
        {
          "time": "D7",
          "label": {
            "zh": "首场直播",
            "en": "First livestream"
          },
          "desc": {
            "zh": "2 小时互动直播，建立粉丝群",
            "en": "2-hour stream, start the fan club"
          },
          "output": {
            "zh": "5000 名粉丝",
            "en": "5,000 fans"
          }
        },
        {
          "time": "D14",
          "label": {
            "zh": "粉丝应援企划",
            "en": "Fan project"
          },
          "desc": {
            "zh": "发起应援色与打榜活动",
            "en": "Launch fan colours and chart push"
          },
          "output": {
            "zh": "300 个应援作品",
            "en": "300 fan works"
          }
        },
        {
          "time": "D21",
          "label": {
            "zh": "首个品牌合作",
            "en": "First brand deal"
          },
          "desc": {
            "zh": "与潮流品牌联名内容",
            "en": "Collab content with a fashion brand"
          },
          "output": {
            "zh": "1 个联名",
            "en": "1 collab"
          }
        },
        {
          "time": "D30",
          "label": {
            "zh": "线上演唱会",
            "en": "Online concert"
          },
          "desc": {
            "zh": "虚拟舞台首场演出",
            "en": "First show on a virtual stage"
          },
          "output": {
            "zh": "18 万观看",
            "en": "180K viewers"
          }
        }
      ]
    }
  },
  "corporate-ip": {
    "deliverables": [
      {
        "title": {
          "zh": "企业形象",
          "en": "Corporate Avatar"
        },
        "desc": {
          "zh": "代言人或吉祥物形象",
          "en": "Ambassador or mascot design"
        }
      },
      {
        "title": {
          "zh": "企业知识库",
          "en": "Knowledge Base"
        },
        "desc": {
          "zh": "产品、品牌与制度知识",
          "en": "Product, brand and policy knowledge"
        }
      },
      {
        "title": {
          "zh": "场景内容包",
          "en": "Scenario Content"
        },
        "desc": {
          "zh": "招聘、发布会与培训内容",
          "en": "Hiring, launch and training content"
        }
      },
      {
        "title": {
          "zh": "合规审核流",
          "en": "Compliance Flow"
        },
        "desc": {
          "zh": "发布前审核与留痕",
          "en": "Pre-publish review and audit trail"
        }
      }
    ],
    "day": [
      {
        "time": "09:00",
        "title": {
          "zh": "同步本周产品动态",
          "en": "Sync this week's product news"
        },
        "output": {
          "zh": "知识库更新",
          "en": "Knowledge updated"
        }
      },
      {
        "time": "10:30",
        "title": {
          "zh": "生成招聘宣传视频",
          "en": "Make a hiring video"
        },
        "output": {
          "zh": "3 个岗位视频",
          "en": "3 role videos"
        }
      },
      {
        "time": "14:00",
        "title": {
          "zh": "录制新品讲解",
          "en": "Record a product explainer"
        },
        "output": {
          "zh": "中英日 3 版",
          "en": "3 languages"
        }
      },
      {
        "time": "16:00",
        "title": {
          "zh": "法务合规审核",
          "en": "Legal review"
        },
        "output": {
          "zh": "全部通过",
          "en": "All approved"
        }
      },
      {
        "time": "18:00",
        "title": {
          "zh": "全渠道发布",
          "en": "Publish everywhere"
        },
        "output": {
          "zh": "触达 12 万",
          "en": "120K reached"
        }
      }
    ],
    "results": [
      {
        "label": {
          "zh": "宣传视频周期",
          "en": "Video turnaround"
        },
        "before": {
          "zh": "2 周",
          "en": "2 weeks"
        },
        "after": {
          "zh": "1 天",
          "en": "1 day"
        },
        "change": "-93%"
      },
      {
        "label": {
          "zh": "多语言版本",
          "en": "Language versions"
        },
        "before": {
          "zh": "1 种",
          "en": "1"
        },
        "after": {
          "zh": "18 种",
          "en": "18"
        },
        "change": "18x"
      },
      {
        "label": {
          "zh": "内容触达",
          "en": "Content reach"
        },
        "before": {
          "zh": "基准",
          "en": "Baseline"
        },
        "after": {
          "zh": "+240%",
          "en": "+240%"
        },
        "change": "+240%"
      }
    ],
    "faq": [
      {
        "q": {
          "zh": "回答会不会超出企业口径？",
          "en": "Will it go off-message?"
        },
        "a": {
          "zh": "内容只基于企业知识库生成，并支持敏感词与审核流。",
          "en": "Content is grounded in your knowledge base with review flows."
        }
      },
      {
        "q": {
          "zh": "能用真人员工形象吗？",
          "en": "Can it use a real employee?"
        },
        "a": {
          "zh": "可以，需要本人授权，授权记录会完整留存。",
          "en": "Yes, with written consent that is stored on record."
        }
      },
      {
        "q": {
          "zh": "支持哪些渠道？",
          "en": "Which channels?"
        },
        "a": {
          "zh": "官网、公众号、视频号、展会大屏和招聘平台等。",
          "en": "Website, social accounts, expo screens and job boards."
        }
      }
    ],
    "spotlight": {
      "kind": "tabs",
      "title": {
        "zh": "同一个数字员工，五种工作状态",
        "en": "One Digital Employee, Five Roles"
      },
      "desc": {
        "zh": "点击切换，看同一个企业形象在不同场景里如何工作。",
        "en": "Switch roles to see one corporate avatar at work across scenes."
      },
      "cardsTitle": {
        "zh": "这个场景的产出",
        "en": "What It Produces"
      },
      "options": [
        {
          "label": {
            "zh": "招聘官",
            "en": "Recruiter"
          },
          "headline": {
            "zh": "在招聘平台介绍岗位，并初筛候选人",
            "en": "Presents roles on job boards and screens candidates"
          },
          "cards": [
            {
              "title": {
                "zh": "岗位介绍视频",
                "en": "Role videos"
              },
              "sub": {
                "zh": "每个岗位 1 分钟",
                "en": "1 minute per role"
              }
            },
            {
              "title": {
                "zh": "常见问题答复",
                "en": "FAQ answers"
              },
              "sub": {
                "zh": "7×24 小时在线",
                "en": "Always online"
              }
            },
            {
              "title": {
                "zh": "候选人初筛",
                "en": "Screening"
              },
              "sub": {
                "zh": "自动整理简历",
                "en": "Sorted résumés"
              }
            }
          ],
          "metrics": [
            {
              "value": "3.6 万",
              "label": {
                "zh": "收到简历",
                "en": "Résumés"
              }
            },
            {
              "value": "-42%",
              "label": {
                "zh": "招聘成本",
                "en": "Hiring cost"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "发布会主持",
            "en": "Launch Host"
          },
          "headline": {
            "zh": "主持新品发布会，并同步输出多语言版本",
            "en": "Hosts launches with multilingual versions"
          },
          "cards": [
            {
              "title": {
                "zh": "主持口播",
                "en": "Host script"
              },
              "sub": {
                "zh": "全程串场",
                "en": "Full show flow"
              }
            },
            {
              "title": {
                "zh": "产品演示",
                "en": "Product demo"
              },
              "sub": {
                "zh": "关键功能讲解",
                "en": "Key feature walkthrough"
              }
            },
            {
              "title": {
                "zh": "多语言版本",
                "en": "Multilingual cuts"
              },
              "sub": {
                "zh": "中英日韩",
                "en": "4 languages"
              }
            }
          ],
          "metrics": [
            {
              "value": "120 万",
              "label": {
                "zh": "直播观看",
                "en": "Live views"
              }
            },
            {
              "value": "4 种",
              "label": {
                "zh": "语言",
                "en": "Languages"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "产品讲解",
            "en": "Product Guide"
          },
          "headline": {
            "zh": "在官网和展会大屏讲解产品方案",
            "en": "Explains products on the website and expo screens"
          },
          "cards": [
            {
              "title": {
                "zh": "功能讲解",
                "en": "Feature tour"
              },
              "sub": {
                "zh": "按客户行业定制",
                "en": "Tailored by industry"
              }
            },
            {
              "title": {
                "zh": "方案对比",
                "en": "Comparison"
              },
              "sub": {
                "zh": "竞品差异说明",
                "en": "Competitive differences"
              }
            },
            {
              "title": {
                "zh": "线索收集",
                "en": "Lead capture"
              },
              "sub": {
                "zh": "自动登记意向",
                "en": "Logs interest"
              }
            }
          ],
          "metrics": [
            {
              "value": "1.2 万",
              "label": {
                "zh": "有效线索",
                "en": "Leads"
              }
            },
            {
              "value": "+65%",
              "label": {
                "zh": "咨询转化",
                "en": "Conversion"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "培训导师",
            "en": "Trainer"
          },
          "headline": {
            "zh": "给新员工讲解制度和业务知识",
            "en": "Teaches new hires policies and the business"
          },
          "cards": [
            {
              "title": {
                "zh": "入职课程",
                "en": "Onboarding"
              },
              "sub": {
                "zh": "12 节微课",
                "en": "12 micro-lessons"
              }
            },
            {
              "title": {
                "zh": "随堂测验",
                "en": "Quizzes"
              },
              "sub": {
                "zh": "自动出题批改",
                "en": "Auto-graded"
              }
            },
            {
              "title": {
                "zh": "答疑助手",
                "en": "Q&A helper"
              },
              "sub": {
                "zh": "随时提问",
                "en": "Ask anytime"
              }
            }
          ],
          "metrics": [
            {
              "value": "-60%",
              "label": {
                "zh": "培训时长",
                "en": "Training time"
              }
            },
            {
              "value": "96%",
              "label": {
                "zh": "考核通过",
                "en": "Pass rate"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "文化代表",
            "en": "Culture Ambassador"
          },
          "headline": {
            "zh": "在节日和周年庆传递企业文化",
            "en": "Shares company culture at festivals and anniversaries"
          },
          "cards": [
            {
              "title": {
                "zh": "节日祝福",
                "en": "Greetings"
              },
              "sub": {
                "zh": "全员定制视频",
                "en": "Personalised videos"
              }
            },
            {
              "title": {
                "zh": "周年故事",
                "en": "Anniversary story"
              },
              "sub": {
                "zh": "企业历程短片",
                "en": "Company history film"
              }
            },
            {
              "title": {
                "zh": "内部活动",
                "en": "Events"
              },
              "sub": {
                "zh": "活动主持串场",
                "en": "Event hosting"
              }
            }
          ],
          "metrics": [
            {
              "value": "92%",
              "label": {
                "zh": "员工好评",
                "en": "Staff approval"
              }
            },
            {
              "value": "40+",
              "label": {
                "zh": "年度活动",
                "en": "Annual events"
              }
            }
          ]
        }
      ]
    }
  },
  "brand-ip": {
    "deliverables": [
      {
        "title": {
          "zh": "品牌角色",
          "en": "Brand Character"
        },
        "desc": {
          "zh": "外形、性格与口头禅",
          "en": "Look, personality and catchphrases"
        }
      },
      {
        "title": {
          "zh": "角色规范",
          "en": "Character Guide"
        },
        "desc": {
          "zh": "使用场景与禁用规则",
          "en": "Usage and do-nots"
        }
      },
      {
        "title": {
          "zh": "内容素材",
          "en": "Content Kit"
        },
        "desc": {
          "zh": "表情包、短视频与海报",
          "en": "Stickers, videos and posters"
        }
      },
      {
        "title": {
          "zh": "联名方案",
          "en": "Collab Plan"
        },
        "desc": {
          "zh": "联名、周边与授权",
          "en": "Collabs, merch and licensing"
        }
      }
    ],
    "day": [
      {
        "time": "09:00",
        "title": {
          "zh": "发布角色早安动态",
          "en": "Post the morning update"
        },
        "output": {
          "zh": "1 条动态",
          "en": "1 post"
        }
      },
      {
        "time": "11:00",
        "title": {
          "zh": "生成新品包装形象",
          "en": "Design packaging art"
        },
        "output": {
          "zh": "3 款包装",
          "en": "3 packs"
        }
      },
      {
        "time": "14:00",
        "title": {
          "zh": "剪辑剧情短片",
          "en": "Edit a story short"
        },
        "output": {
          "zh": "1 支短片",
          "en": "1 short"
        }
      },
      {
        "time": "16:00",
        "title": {
          "zh": "回复粉丝与评论",
          "en": "Reply to fans"
        },
        "output": {
          "zh": "500+ 互动",
          "en": "500+ replies"
        }
      },
      {
        "time": "19:00",
        "title": {
          "zh": "联名方案评审",
          "en": "Review a collab"
        },
        "output": {
          "zh": "2 个方案",
          "en": "2 proposals"
        }
      }
    ],
    "results": [
      {
        "label": {
          "zh": "角色设计周期",
          "en": "Design cycle"
        },
        "before": {
          "zh": "3 个月",
          "en": "3 months"
        },
        "after": {
          "zh": "2 周",
          "en": "2 weeks"
        },
        "change": "-83%"
      },
      {
        "label": {
          "zh": "月产素材量",
          "en": "Monthly assets"
        },
        "before": {
          "zh": "20 个",
          "en": "20"
        },
        "after": {
          "zh": "300+",
          "en": "300+"
        },
        "change": "15x"
      },
      {
        "label": {
          "zh": "复购率",
          "en": "Repurchase rate"
        },
        "before": {
          "zh": "基准",
          "en": "Baseline"
        },
        "after": {
          "zh": "+86%",
          "en": "+86%"
        },
        "change": "+86%"
      }
    ],
    "faq": [
      {
        "q": {
          "zh": "角色会不会和品牌调性不符？",
          "en": "Will it fit our brand?"
        },
        "a": {
          "zh": "先做品牌人格诊断，再生成角色，所有内容遵循角色规范。",
          "en": "We diagnose your brand personality first; all content follows the guide."
        }
      },
      {
        "q": {
          "zh": "能用于实体商品吗？",
          "en": "Can it go on products?"
        },
        "a": {
          "zh": "可以，支持导出高清设计稿用于包装、周边和门店。",
          "en": "Yes, export print-ready art for packs, merch and stores."
        }
      },
      {
        "q": {
          "zh": "怎么做联名授权？",
          "en": "How do collabs work?"
        },
        "a": {
          "zh": "平台记录授权范围、期限与分成，自动生成授权协议。",
          "en": "Scope, term and revenue share are tracked with generated agreements."
        }
      }
    ],
    "spotlight": {
      "kind": "tabs",
      "title": {
        "zh": "你的品牌是哪种人格？",
        "en": "What Is Your Brand Personality?"
      },
      "desc": {
        "zh": "选择一种人格，看品牌角色会出现在哪些触点。",
        "en": "Pick a personality and see where your character shows up."
      },
      "cardsTitle": {
        "zh": "角色出现的地方",
        "en": "Where It Shows Up"
      },
      "options": [
        {
          "label": {
            "zh": "温暖治愈",
            "en": "Warm & Caring"
          },
          "headline": {
            "zh": "一只会照顾人的小熊，陪用户度过每一天",
            "en": "A caring bear that keeps users company"
          },
          "cards": [
            {
              "title": {
                "zh": "包装",
                "en": "Packaging"
              },
              "sub": {
                "zh": "手绘风插画",
                "en": "Hand-drawn art"
              }
            },
            {
              "title": {
                "zh": "社交媒体",
                "en": "Social"
              },
              "sub": {
                "zh": "每日暖心语录",
                "en": "Daily kind words"
              }
            },
            {
              "title": {
                "zh": "门店",
                "en": "Store"
              },
              "sub": {
                "zh": "陪伴型立牌",
                "en": "Welcome standee"
              }
            },
            {
              "title": {
                "zh": "联名",
                "en": "Collab"
              },
              "sub": {
                "zh": "家居与香氛",
                "en": "Home & scent"
              }
            }
          ],
          "metrics": [
            {
              "value": "食品 · 母婴",
              "label": {
                "zh": "最适合",
                "en": "Best for"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "潮酷先锋",
            "en": "Bold & Edgy"
          },
          "headline": {
            "zh": "一个戴耳机的街头少年，代表态度与个性",
            "en": "A street kid in headphones, all attitude"
          },
          "cards": [
            {
              "title": {
                "zh": "包装",
                "en": "Packaging"
              },
              "sub": {
                "zh": "涂鸦撞色",
                "en": "Graffiti colours"
              }
            },
            {
              "title": {
                "zh": "社交媒体",
                "en": "Social"
              },
              "sub": {
                "zh": "街拍挑战",
                "en": "Street challenges"
              }
            },
            {
              "title": {
                "zh": "门店",
                "en": "Store"
              },
              "sub": {
                "zh": "快闪装置",
                "en": "Pop-up installs"
              }
            },
            {
              "title": {
                "zh": "联名",
                "en": "Collab"
              },
              "sub": {
                "zh": "潮牌与球鞋",
                "en": "Streetwear & sneakers"
              }
            }
          ],
          "metrics": [
            {
              "value": "服饰 · 饮品",
              "label": {
                "zh": "最适合",
                "en": "Best for"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "专业可靠",
            "en": "Expert & Trusted"
          },
          "headline": {
            "zh": "一位白大褂研究员，用数据说话",
            "en": "A lab researcher who speaks in data"
          },
          "cards": [
            {
              "title": {
                "zh": "包装",
                "en": "Packaging"
              },
              "sub": {
                "zh": "成分可视化",
                "en": "Ingredient visuals"
              }
            },
            {
              "title": {
                "zh": "社交媒体",
                "en": "Social"
              },
              "sub": {
                "zh": "科普短视频",
                "en": "Explainer videos"
              }
            },
            {
              "title": {
                "zh": "门店",
                "en": "Store"
              },
              "sub": {
                "zh": "检测互动屏",
                "en": "Skin-test screen"
              }
            },
            {
              "title": {
                "zh": "联名",
                "en": "Collab"
              },
              "sub": {
                "zh": "医研机构",
                "en": "Research partners"
              }
            }
          ],
          "metrics": [
            {
              "value": "护肤 · 家电",
              "label": {
                "zh": "最适合",
                "en": "Best for"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "俏皮有趣",
            "en": "Playful"
          },
          "headline": {
            "zh": "一只爱捣乱的小猫，总有新点子",
            "en": "A mischievous cat full of ideas"
          },
          "cards": [
            {
              "title": {
                "zh": "包装",
                "en": "Packaging"
              },
              "sub": {
                "zh": "隐藏彩蛋",
                "en": "Hidden easter eggs"
              }
            },
            {
              "title": {
                "zh": "社交媒体",
                "en": "Social"
              },
              "sub": {
                "zh": "表情包与梗",
                "en": "Stickers & memes"
              }
            },
            {
              "title": {
                "zh": "门店",
                "en": "Store"
              },
              "sub": {
                "zh": "互动拍照点",
                "en": "Photo spots"
              }
            },
            {
              "title": {
                "zh": "联名",
                "en": "Collab"
              },
              "sub": {
                "zh": "游戏与动漫",
                "en": "Games & anime"
              }
            }
          ],
          "metrics": [
            {
              "value": "零食 · 文具",
              "label": {
                "zh": "最适合",
                "en": "Best for"
              }
            }
          ]
        }
      ]
    }
  },
  "city-ip": {
    "deliverables": [
      {
        "title": {
          "zh": "城市代言人",
          "en": "City Ambassador"
        },
        "desc": {
          "zh": "融合城市性格的数字形象",
          "en": "A digital face of the city"
        }
      },
      {
        "title": {
          "zh": "城市知识库",
          "en": "City Knowledge"
        },
        "desc": {
          "zh": "景点、美食与交通",
          "en": "Attractions, food and transit"
        }
      },
      {
        "title": {
          "zh": "智能导览",
          "en": "AI Guide"
        },
        "desc": {
          "zh": "路线规划与实时讲解",
          "en": "Routes and live narration"
        }
      },
      {
        "title": {
          "zh": "传播素材",
          "en": "Promo Kit"
        },
        "desc": {
          "zh": "多语言短视频与海报",
          "en": "Multilingual videos and posters"
        }
      }
    ],
    "day": [
      {
        "time": "08:00",
        "title": {
          "zh": "推送今日天气与活动",
          "en": "Push weather and events"
        },
        "output": {
          "zh": "12 万推送",
          "en": "120K pushes"
        }
      },
      {
        "time": "10:00",
        "title": {
          "zh": "景区智能导览",
          "en": "Run guided tours"
        },
        "output": {
          "zh": "3200 次讲解",
          "en": "3,200 tours"
        }
      },
      {
        "time": "13:00",
        "title": {
          "zh": "生成美食探店视频",
          "en": "Make food videos"
        },
        "output": {
          "zh": "5 条视频",
          "en": "5 videos"
        }
      },
      {
        "time": "17:00",
        "title": {
          "zh": "海外平台多语言发布",
          "en": "Publish in 12 languages"
        },
        "output": {
          "zh": "12 个版本",
          "en": "12 versions"
        }
      },
      {
        "time": "21:00",
        "title": {
          "zh": "汇总客流与舆情",
          "en": "Review footfall and sentiment"
        },
        "output": {
          "zh": "次日运营建议",
          "en": "Next-day plan"
        }
      }
    ],
    "results": [
      {
        "label": {
          "zh": "宣传片制作周期",
          "en": "Promo video cycle"
        },
        "before": {
          "zh": "2 个月",
          "en": "2 months"
        },
        "after": {
          "zh": "1 周",
          "en": "1 week"
        },
        "change": "-88%"
      },
      {
        "label": {
          "zh": "导览覆盖语言",
          "en": "Guide languages"
        },
        "before": {
          "zh": "2 种",
          "en": "2"
        },
        "after": {
          "zh": "12 种",
          "en": "12"
        },
        "change": "6x"
      },
      {
        "label": {
          "zh": "游客增长",
          "en": "Visitor growth"
        },
        "before": {
          "zh": "基准",
          "en": "Baseline"
        },
        "after": {
          "zh": "+50%",
          "en": "+50%"
        },
        "change": "+50%"
      }
    ],
    "faq": [
      {
        "q": {
          "zh": "内容会不会有事实错误？",
          "en": "Will facts be wrong?"
        },
        "a": {
          "zh": "所有讲解基于文旅部门审核过的城市知识库生成。",
          "en": "Narration is generated from a city knowledge base approved by officials."
        }
      },
      {
        "q": {
          "zh": "能接入景区票务吗？",
          "en": "Can it link to ticketing?"
        },
        "a": {
          "zh": "可以接入票务与预约系统，导览中直接预约。",
          "en": "Connect ticketing so visitors can book inside the guide."
        }
      },
      {
        "q": {
          "zh": "代言人形象能不能本地共创？",
          "en": "Can locals co-create the avatar?"
        },
        "a": {
          "zh": "支持征集市民意见投票，确定最终形象。",
          "en": "Run a public vote to choose the final design."
        }
      }
    ],
    "spotlight": {
      "kind": "journey",
      "title": {
        "zh": "游客的一天",
        "en": "A Visitor's Day"
      },
      "desc": {
        "zh": "看城市代言人如何陪伴游客，从抵达到分享。",
        "en": "See how the city ambassador guides a visitor from arrival to sharing."
      },
      "steps": [
        {
          "time": "09:00",
          "label": {
            "zh": "抵达欢迎",
            "en": "Arrival"
          },
          "desc": {
            "zh": "在车站收到代言人的欢迎与当日推荐",
            "en": "Greeted at the station with today's picks"
          },
          "output": {
            "zh": "个性化行程",
            "en": "Personal itinerary"
          }
        },
        {
          "time": "10:30",
          "label": {
            "zh": "景区导览",
            "en": "Guided tour"
          },
          "desc": {
            "zh": "扫码开启多语言讲解与路线规划",
            "en": "Scan for multilingual narration and routes"
          },
          "output": {
            "zh": "避开排队 40 分钟",
            "en": "40 min queue saved"
          }
        },
        {
          "time": "12:30",
          "label": {
            "zh": "本地美食",
            "en": "Local food"
          },
          "desc": {
            "zh": "按口味推荐老字号与网红店",
            "en": "Matches taste with classic and trending spots"
          },
          "output": {
            "zh": "3 家推荐",
            "en": "3 picks"
          }
        },
        {
          "time": "15:00",
          "label": {
            "zh": "非遗体验",
            "en": "Heritage"
          },
          "desc": {
            "zh": "预约手作体验，代言人讲解来历",
            "en": "Book a craft workshop with backstory"
          },
          "output": {
            "zh": "1 场体验",
            "en": "1 workshop"
          }
        },
        {
          "time": "19:00",
          "label": {
            "zh": "夜游演出",
            "en": "Night show"
          },
          "desc": {
            "zh": "推荐夜游路线与演出场次",
            "en": "Night routes and show times"
          },
          "output": {
            "zh": "夜间消费 +38%",
            "en": "+38% night spend"
          }
        },
        {
          "time": "21:30",
          "label": {
            "zh": "文创与分享",
            "en": "Souvenirs & sharing"
          },
          "desc": {
            "zh": "生成专属旅行短片，一键分享",
            "en": "Auto-made trip video to share"
          },
          "output": {
            "zh": "1 支旅行视频",
            "en": "1 trip video"
          }
        }
      ]
    }
  },
  "digital-founder": {
    "deliverables": [
      {
        "title": {
          "zh": "数字分身",
          "en": "Digital Twin"
        },
        "desc": {
          "zh": "高还原形象与声音",
          "en": "High-fidelity likeness and voice"
        }
      },
      {
        "title": {
          "zh": "观点知识库",
          "en": "Insight Library"
        },
        "desc": {
          "zh": "演讲、访谈与文章",
          "en": "Talks, interviews and articles"
        }
      },
      {
        "title": {
          "zh": "内容日历",
          "en": "Content Calendar"
        },
        "desc": {
          "zh": "每周选题与排期",
          "en": "Weekly topics and schedule"
        }
      },
      {
        "title": {
          "zh": "授权审核流",
          "en": "Approval Flow"
        },
        "desc": {
          "zh": "每条内容本人确认",
          "en": "Founder approves every piece"
        }
      }
    ],
    "day": [
      {
        "time": "08:30",
        "title": {
          "zh": "AI 推送今日行业热点",
          "en": "AI briefs today's news"
        },
        "output": {
          "zh": "5 个选题",
          "en": "5 topics"
        }
      },
      {
        "time": "10:00",
        "title": {
          "zh": "选定选题并口述观点",
          "en": "Pick a topic and voice notes"
        },
        "output": {
          "zh": "3 分钟语音",
          "en": "3-min voice note"
        }
      },
      {
        "time": "11:00",
        "title": {
          "zh": "生成口播与图文",
          "en": "Generate video and posts"
        },
        "output": {
          "zh": "1 视频 + 3 图文",
          "en": "1 video + 3 posts"
        }
      },
      {
        "time": "12:00",
        "title": {
          "zh": "手机端一键审核",
          "en": "Approve on mobile"
        },
        "output": {
          "zh": "全部确认",
          "en": "All approved"
        }
      },
      {
        "time": "18:00",
        "title": {
          "zh": "查看传播与线索",
          "en": "Review reach and leads"
        },
        "output": {
          "zh": "26 条商务线索",
          "en": "26 leads"
        }
      }
    ],
    "results": [
      {
        "label": {
          "zh": "每周出镜时间",
          "en": "Weekly filming time"
        },
        "before": {
          "zh": "6 小时",
          "en": "6 hours"
        },
        "after": {
          "zh": "30 分钟",
          "en": "30 min"
        },
        "change": "-92%"
      },
      {
        "label": {
          "zh": "每周内容量",
          "en": "Weekly content"
        },
        "before": {
          "zh": "1 条",
          "en": "1"
        },
        "after": {
          "zh": "10+ 条",
          "en": "10+"
        },
        "change": "10x"
      },
      {
        "label": {
          "zh": "商务线索",
          "en": "Business leads"
        },
        "before": {
          "zh": "基准",
          "en": "Baseline"
        },
        "after": {
          "zh": "+180%",
          "en": "+180%"
        },
        "change": "+180%"
      }
    ],
    "faq": [
      {
        "q": {
          "zh": "会不会发布我没说过的话？",
          "en": "Will it say things I didn't?"
        },
        "a": {
          "zh": "所有内容基于你的观点库生成，且必须经你本人确认后发布。",
          "en": "Content comes from your own insights and needs your approval."
        }
      },
      {
        "q": {
          "zh": "形象和声音安全吗？",
          "en": "Is my likeness safe?"
        },
        "a": {
          "zh": "形象与声音加密存储，仅本人授权的账号可调用。",
          "en": "Likeness and voice are encrypted and only usable by approved accounts."
        }
      },
      {
        "q": {
          "zh": "可以多语言吗？",
          "en": "Can it speak other languages?"
        },
        "a": {
          "zh": "支持 9 种语言，保留你的语气和表达习惯。",
          "en": "9 languages, keeping your tone and phrasing."
        }
      }
    ],
    "spotlight": {
      "kind": "journey",
      "title": {
        "zh": "创始人内容流水线",
        "en": "Founder Content Pipeline"
      },
      "desc": {
        "zh": "从一个想法到一条线索，创始人只需要确认两次。",
        "en": "From an idea to a lead, the founder only steps in twice."
      },
      "steps": [
        {
          "time": "01",
          "label": {
            "zh": "采集观点",
            "en": "Capture"
          },
          "desc": {
            "zh": "手机口述 3 分钟，或上传演讲与访谈",
            "en": "3-minute voice note or past talks"
          },
          "output": {
            "zh": "1 段原始观点",
            "en": "1 raw insight"
          }
        },
        {
          "time": "02",
          "label": {
            "zh": "沉淀知识",
            "en": "Organise"
          },
          "desc": {
            "zh": "AI 整理成观点卡片，存入知识库",
            "en": "AI turns it into insight cards"
          },
          "output": {
            "zh": "8 张观点卡",
            "en": "8 insight cards"
          }
        },
        {
          "time": "03",
          "label": {
            "zh": "生成内容",
            "en": "Generate"
          },
          "desc": {
            "zh": "口播视频、图文与多语言版本",
            "en": "Video, posts and translations"
          },
          "output": {
            "zh": "1 视频 + 3 图文",
            "en": "1 video + 3 posts"
          }
        },
        {
          "time": "04",
          "label": {
            "zh": "本人审核",
            "en": "Approve"
          },
          "desc": {
            "zh": "手机端逐条确认或修改",
            "en": "Approve or edit on mobile"
          },
          "output": {
            "zh": "100% 授权",
            "en": "100% approved"
          }
        },
        {
          "time": "05",
          "label": {
            "zh": "全网发布",
            "en": "Publish"
          },
          "desc": {
            "zh": "按平台习惯自动排期发布",
            "en": "Auto-scheduled per platform"
          },
          "output": {
            "zh": "9 个平台",
            "en": "9 platforms"
          }
        },
        {
          "time": "06",
          "label": {
            "zh": "线索转化",
            "en": "Convert"
          },
          "desc": {
            "zh": "评论与私信中的合作意向自动归集",
            "en": "Collects partnership interest from comments"
          },
          "output": {
            "zh": "26 条线索",
            "en": "26 leads"
          }
        }
      ]
    }
  },
  "culture-ip": {
    "deliverables": [
      {
        "title": {
          "zh": "文化角色",
          "en": "Culture Character"
        },
        "desc": {
          "zh": "历史人物或文化符号的现代形象",
          "en": "Modern take on figures and symbols"
        }
      },
      {
        "title": {
          "zh": "史料知识库",
          "en": "Source Library"
        },
        "desc": {
          "zh": "典籍、文物与研究资料",
          "en": "Classics, artifacts and research"
        }
      },
      {
        "title": {
          "zh": "互动内容",
          "en": "Interactive Stories"
        },
        "desc": {
          "zh": "可对话的文化故事",
          "en": "Culture stories you can talk to"
        }
      },
      {
        "title": {
          "zh": "文创方案",
          "en": "Merch Plan"
        },
        "desc": {
          "zh": "文创与授权开发",
          "en": "Merch and licensing"
        }
      }
    ],
    "day": [
      {
        "time": "09:00",
        "title": {
          "zh": "整理新入库史料",
          "en": "Process new sources"
        },
        "output": {
          "zh": "12 条史料",
          "en": "12 sources"
        }
      },
      {
        "time": "11:00",
        "title": {
          "zh": "生成讲解短视频",
          "en": "Make explainer videos"
        },
        "output": {
          "zh": "3 条视频",
          "en": "3 videos"
        }
      },
      {
        "time": "14:00",
        "title": {
          "zh": "专家审核史实标注",
          "en": "Expert fact review"
        },
        "output": {
          "zh": "全部通过",
          "en": "All approved"
        }
      },
      {
        "time": "16:00",
        "title": {
          "zh": "线上展厅互动",
          "en": "Run the virtual hall"
        },
        "output": {
          "zh": "8600 次互动",
          "en": "8,600 interactions"
        }
      },
      {
        "time": "19:00",
        "title": {
          "zh": "文创上新",
          "en": "Launch new merch"
        },
        "output": {
          "zh": "2 款新品",
          "en": "2 new items"
        }
      }
    ],
    "results": [
      {
        "label": {
          "zh": "内容制作周期",
          "en": "Content cycle"
        },
        "before": {
          "zh": "1 个月",
          "en": "1 month"
        },
        "after": {
          "zh": "3 天",
          "en": "3 days"
        },
        "change": "-90%"
      },
      {
        "label": {
          "zh": "年轻观众占比",
          "en": "Gen Z audience"
        },
        "before": {
          "zh": "22%",
          "en": "22%"
        },
        "after": {
          "zh": "68%",
          "en": "68%"
        },
        "change": "3x"
      },
      {
        "label": {
          "zh": "文创收入",
          "en": "Merch revenue"
        },
        "before": {
          "zh": "基准",
          "en": "Baseline"
        },
        "after": {
          "zh": "+120%",
          "en": "+120%"
        },
        "change": "+120%"
      }
    ],
    "faq": [
      {
        "q": {
          "zh": "如何避免歪曲历史？",
          "en": "How do you avoid distorting history?"
        },
        "a": {
          "zh": "史实与艺术再创作分开标注，并由专家审核。",
          "en": "Facts and creative content are labelled separately and expert-reviewed."
        }
      },
      {
        "q": {
          "zh": "文物图像可以用吗？",
          "en": "Can artifact images be used?"
        },
        "a": {
          "zh": "需要馆方授权，平台会记录授权来源与范围。",
          "en": "With museum consent; the source and scope are recorded."
        }
      },
      {
        "q": {
          "zh": "适合哪些机构？",
          "en": "Who is it for?"
        },
        "a": {
          "zh": "博物馆、非遗机构、文旅集团和文创企业。",
          "en": "Museums, heritage bodies, tourism groups and culture brands."
        }
      }
    ],
    "spotlight": {
      "kind": "tabs",
      "title": {
        "zh": "史实与再创作，一眼分清",
        "en": "Facts vs Creative, Clearly Labelled"
      },
      "desc": {
        "zh": "每一条文化内容都同时说明史料依据和艺术处理方式。",
        "en": "Every piece shows both its sources and its creative treatment."
      },
      "cardsTitle": {
        "zh": "内容标注",
        "en": "Content Labels"
      },
      "options": [
        {
          "label": {
            "zh": "历史人物",
            "en": "Historical Figure"
          },
          "headline": {
            "zh": "苏轼：一位会讲美食故事的数字讲解员",
            "en": "Su Shi as a digital guide who tells food stories"
          },
          "cards": [
            {
              "title": {
                "zh": "史实依据",
                "en": "Facts"
              },
              "sub": {
                "zh": "《东坡志林》等文献记载",
                "en": "Recorded in classical texts"
              }
            },
            {
              "title": {
                "zh": "艺术再创作",
                "en": "Creative"
              },
              "sub": {
                "zh": "现代口吻讲述美食往事",
                "en": "Food stories in a modern voice"
              }
            },
            {
              "title": {
                "zh": "呈现方式",
                "en": "Format"
              },
              "sub": {
                "zh": "系列短视频 + 互动问答",
                "en": "Short series + Q&A"
              }
            }
          ],
          "metrics": [
            {
              "value": "3 部",
              "label": {
                "zh": "引用文献",
                "en": "Sources cited"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "文物器物",
            "en": "Artifact"
          },
          "headline": {
            "zh": "一件青铜器，自己讲述三千年的旅程",
            "en": "A bronze vessel narrates its 3,000-year journey"
          },
          "cards": [
            {
              "title": {
                "zh": "史实依据",
                "en": "Facts"
              },
              "sub": {
                "zh": "出土地点与铭文研究",
                "en": "Excavation site and inscriptions"
              }
            },
            {
              "title": {
                "zh": "艺术再创作",
                "en": "Creative"
              },
              "sub": {
                "zh": "拟人化第一人称叙述",
                "en": "First-person narration"
              }
            },
            {
              "title": {
                "zh": "呈现方式",
                "en": "Format"
              },
              "sub": {
                "zh": "AR 展柜讲解",
                "en": "AR display narration"
              }
            }
          ],
          "metrics": [
            {
              "value": "2 位",
              "label": {
                "zh": "审核专家",
                "en": "Reviewing experts"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "非遗技艺",
            "en": "Intangible Heritage"
          },
          "headline": {
            "zh": "刺绣技艺，从一根针线开始的互动课程",
            "en": "Embroidery taught from a single thread"
          },
          "cards": [
            {
              "title": {
                "zh": "史实依据",
                "en": "Facts"
              },
              "sub": {
                "zh": "传承人口述与技艺档案",
                "en": "Inheritor interviews and archives"
              }
            },
            {
              "title": {
                "zh": "艺术再创作",
                "en": "Creative"
              },
              "sub": {
                "zh": "动画演示针法步骤",
                "en": "Animated stitch steps"
              }
            },
            {
              "title": {
                "zh": "呈现方式",
                "en": "Format"
              },
              "sub": {
                "zh": "互动课程 + 文创套装",
                "en": "Course + craft kit"
              }
            }
          ],
          "metrics": [
            {
              "value": "1 位",
              "label": {
                "zh": "合作传承人",
                "en": "Inheritor partner"
              }
            }
          ]
        }
      ]
    }
  },
  "education-ip": {
    "deliverables": [
      {
        "title": {
          "zh": "数字导师",
          "en": "AI Tutor"
        },
        "desc": {
          "zh": "形象、声音与教学风格",
          "en": "Look, voice and teaching style"
        }
      },
      {
        "title": {
          "zh": "课程体系",
          "en": "Course System"
        },
        "desc": {
          "zh": "知识点拆解与视频课",
          "en": "Topics broken into video lessons"
        }
      },
      {
        "title": {
          "zh": "题库与测评",
          "en": "Question Bank"
        },
        "desc": {
          "zh": "练习、测验与诊断",
          "en": "Practice, quizzes and diagnosis"
        }
      },
      {
        "title": {
          "zh": "学习报告",
          "en": "Learning Reports"
        },
        "desc": {
          "zh": "进度与效果分析",
          "en": "Progress and outcome analysis"
        }
      }
    ],
    "day": [
      {
        "time": "07:30",
        "title": {
          "zh": "推送今日学习计划",
          "en": "Send today's plan"
        },
        "output": {
          "zh": "2 万份计划",
          "en": "20K plans"
        }
      },
      {
        "time": "12:00",
        "title": {
          "zh": "午间知识点微课",
          "en": "Lunchtime micro-lesson"
        },
        "output": {
          "zh": "1 节微课",
          "en": "1 micro-lesson"
        }
      },
      {
        "time": "19:00",
        "title": {
          "zh": "晚间作业答疑",
          "en": "Evening homework help"
        },
        "output": {
          "zh": "4800 次答疑",
          "en": "4,800 answers"
        }
      },
      {
        "time": "21:00",
        "title": {
          "zh": "自动批改与反馈",
          "en": "Auto-grade and feedback"
        },
        "output": {
          "zh": "1.2 万份作业",
          "en": "12K assignments"
        }
      },
      {
        "time": "22:00",
        "title": {
          "zh": "生成家长周报",
          "en": "Parent weekly reports"
        },
        "output": {
          "zh": "个性化报告",
          "en": "Personal reports"
        }
      }
    ],
    "results": [
      {
        "label": {
          "zh": "答疑响应时间",
          "en": "Answer time"
        },
        "before": {
          "zh": "12 小时",
          "en": "12 hours"
        },
        "after": {
          "zh": "10 秒",
          "en": "10 sec"
        },
        "change": "-99%"
      },
      {
        "label": {
          "zh": "课程完成率",
          "en": "Course completion"
        },
        "before": {
          "zh": "41%",
          "en": "41%"
        },
        "after": {
          "zh": "92%",
          "en": "92%"
        },
        "change": "2.2x"
      },
      {
        "label": {
          "zh": "单课制作成本",
          "en": "Cost per lesson"
        },
        "before": {
          "zh": "¥3000",
          "en": "¥3,000"
        },
        "after": {
          "zh": "¥300",
          "en": "¥300"
        },
        "change": "-90%"
      }
    ],
    "faq": [
      {
        "q": {
          "zh": "讲解会不会出错？",
          "en": "Will explanations be wrong?"
        },
        "a": {
          "zh": "讲解只基于你上传的教材与题库，老师可随时修订。",
          "en": "Explanations use your materials; teachers can revise anytime."
        }
      },
      {
        "q": {
          "zh": "适合哪些年龄段？",
          "en": "Which ages?"
        },
        "a": {
          "zh": "K12、职业教育、语言学习和企业培训都适用。",
          "en": "K12, vocational, language learning and corporate training."
        }
      },
      {
        "q": {
          "zh": "学生数据安全吗？",
          "en": "Is student data safe?"
        },
        "a": {
          "zh": "学习数据加密存储，未成年人数据单独保护。",
          "en": "Data is encrypted, with extra protection for minors."
        }
      }
    ],
    "spotlight": {
      "kind": "journey",
      "title": {
        "zh": "学习效果自动闭环",
        "en": "The Adaptive Learning Loop"
      },
      "desc": {
        "zh": "每个学生都按自己的节奏前进，AI 根据结果自动调整。",
        "en": "Every learner moves at their own pace and AI adapts to results."
      },
      "steps": [
        {
          "time": "01",
          "label": {
            "zh": "水平诊断",
            "en": "Diagnose"
          },
          "desc": {
            "zh": "10 分钟测试找出薄弱知识点",
            "en": "A 10-minute test finds weak spots"
          },
          "output": {
            "zh": "3 个薄弱点",
            "en": "3 weak spots"
          }
        },
        {
          "time": "02",
          "label": {
            "zh": "推荐路径",
            "en": "Recommend"
          },
          "desc": {
            "zh": "生成个人学习路径与每日计划",
            "en": "Personal path and daily plan"
          },
          "output": {
            "zh": "21 天计划",
            "en": "21-day plan"
          }
        },
        {
          "time": "03",
          "label": {
            "zh": "AI 讲解",
            "en": "Teach"
          },
          "desc": {
            "zh": "数字导师按学生水平讲解",
            "en": "The tutor teaches at the right level"
          },
          "output": {
            "zh": "12 节微课",
            "en": "12 lessons"
          }
        },
        {
          "time": "04",
          "label": {
            "zh": "练习反馈",
            "en": "Practise"
          },
          "desc": {
            "zh": "错题即时讲解，举一反三",
            "en": "Instant feedback on mistakes"
          },
          "output": {
            "zh": "正确率 +35%",
            "en": "+35% accuracy"
          }
        },
        {
          "time": "05",
          "label": {
            "zh": "阶段测评",
            "en": "Assess"
          },
          "desc": {
            "zh": "每周测评检验学习效果",
            "en": "Weekly checks of progress"
          },
          "output": {
            "zh": "提分 23 分",
            "en": "+23 points"
          }
        },
        {
          "time": "06",
          "label": {
            "zh": "自动调整",
            "en": "Adapt"
          },
          "desc": {
            "zh": "根据测评结果更新下周计划",
            "en": "Next week's plan updates itself"
          },
          "output": {
            "zh": "新路径",
            "en": "New path"
          }
        }
      ]
    }
  },
  "anime-ip": {
    "deliverables": [
      {
        "title": {
          "zh": "角色设定集",
          "en": "Character Sheets"
        },
        "desc": {
          "zh": "三视图、表情与服装",
          "en": "Turnarounds, expressions and outfits"
        }
      },
      {
        "title": {
          "zh": "世界观设定",
          "en": "World Bible"
        },
        "desc": {
          "zh": "地理、势力与历史",
          "en": "Geography, factions and history"
        }
      },
      {
        "title": {
          "zh": "漫画与动画",
          "en": "Comics & Animation"
        },
        "desc": {
          "zh": "连载漫画与短片",
          "en": "Serial comics and shorts"
        }
      },
      {
        "title": {
          "zh": "衍生开发",
          "en": "Licensing Kit"
        },
        "desc": {
          "zh": "手办、周边与游戏",
          "en": "Figures, merch and games"
        }
      }
    ],
    "day": [
      {
        "time": "10:00",
        "title": {
          "zh": "生成新角色设定",
          "en": "Design a new character"
        },
        "output": {
          "zh": "1 套设定",
          "en": "1 character set"
        }
      },
      {
        "time": "13:00",
        "title": {
          "zh": "绘制本周漫画",
          "en": "Draw this week's chapter"
        },
        "output": {
          "zh": "24 页",
          "en": "24 pages"
        }
      },
      {
        "time": "16:00",
        "title": {
          "zh": "剪辑动画预告",
          "en": "Cut an animated teaser"
        },
        "output": {
          "zh": "30 秒预告",
          "en": "30-sec teaser"
        }
      },
      {
        "time": "19:00",
        "title": {
          "zh": "发起剧情投票",
          "en": "Run a story vote"
        },
        "output": {
          "zh": "3.2 万票",
          "en": "32K votes"
        }
      },
      {
        "time": "22:00",
        "title": {
          "zh": "周边打样确认",
          "en": "Approve merch samples"
        },
        "output": {
          "zh": "4 款周边",
          "en": "4 items"
        }
      }
    ],
    "results": [
      {
        "label": {
          "zh": "角色设定周期",
          "en": "Character design"
        },
        "before": {
          "zh": "3 周",
          "en": "3 weeks"
        },
        "after": {
          "zh": "3 天",
          "en": "3 days"
        },
        "change": "-86%"
      },
      {
        "label": {
          "zh": "漫画更新频率",
          "en": "Comic updates"
        },
        "before": {
          "zh": "月更",
          "en": "Monthly"
        },
        "after": {
          "zh": "周更",
          "en": "Weekly"
        },
        "change": "4x"
      },
      {
        "label": {
          "zh": "衍生商品数",
          "en": "Merch SKUs"
        },
        "before": {
          "zh": "5 款",
          "en": "5"
        },
        "after": {
          "zh": "64 款",
          "en": "64"
        },
        "change": "13x"
      }
    ],
    "faq": [
      {
        "q": {
          "zh": "画风能保持统一吗？",
          "en": "Will the art style stay consistent?"
        },
        "a": {
          "zh": "角色设定集锁定画风与比例，每一话都保持一致。",
          "en": "Character sheets lock style and proportions for every chapter."
        }
      },
      {
        "q": {
          "zh": "可以导入已有角色吗？",
          "en": "Can I import existing characters?"
        },
        "a": {
          "zh": "支持导入设定稿，AI 学习后继续创作。",
          "en": "Upload your sheets and AI continues in your style."
        }
      },
      {
        "q": {
          "zh": "怎么对接手办厂商？",
          "en": "How do figure makers get files?"
        },
        "a": {
          "zh": "可导出三视图和 3D 参考模型，直接用于打样。",
          "en": "Export turnarounds and 3D references for sampling."
        }
      }
    ],
    "spotlight": {
      "kind": "tabs",
      "title": {
        "zh": "《零界纪元》角色关系图",
        "en": "Zero Realm: Character Map"
      },
      "desc": {
        "zh": "点击角色，查看TA的能力、关系和剧情线。",
        "en": "Click a character to see abilities, relationships and arcs."
      },
      "cardsTitle": {
        "zh": "角色关系",
        "en": "Relationships"
      },
      "options": [
        {
          "label": {
            "zh": "夜岚 · 主角",
            "en": "Ye Lan · Hero"
          },
          "headline": {
            "zh": "失去记忆的机甲驾驶员，寻找零界之门的秘密",
            "en": "A pilot with lost memories seeking the Zero Gate"
          },
          "cards": [
            {
              "title": {
                "zh": "白枭",
                "en": "Bai Xiao"
              },
              "sub": {
                "zh": "宿敌 · 曾是挚友",
                "en": "Rival · former friend"
              }
            },
            {
              "title": {
                "zh": "小柚",
                "en": "Xiao You"
              },
              "sub": {
                "zh": "伙伴 · 机械师",
                "en": "Partner · mechanic"
              }
            },
            {
              "title": {
                "zh": "赤焰",
                "en": "Crimson"
              },
              "sub": {
                "zh": "搭档机甲",
                "en": "Mech partner"
              }
            }
          ],
          "chips": [
            {
              "zh": "时间回溯",
              "en": "Time rewind"
            },
            {
              "zh": "机甲同步",
              "en": "Mech sync"
            },
            {
              "zh": "零界感知",
              "en": "Zero-sense"
            }
          ],
          "metrics": [
            {
              "value": "38%",
              "label": {
                "zh": "人气投票",
                "en": "Popularity vote"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "白枭 · 宿敌",
            "en": "Bai Xiao · Rival"
          },
          "headline": {
            "zh": "掌控暗影军团的天才指挥官",
            "en": "A genius commander of the shadow legion"
          },
          "cards": [
            {
              "title": {
                "zh": "夜岚",
                "en": "Ye Lan"
              },
              "sub": {
                "zh": "宿敌 · 曾是挚友",
                "en": "Rival · former friend"
              }
            },
            {
              "title": {
                "zh": "暗影军团",
                "en": "Shadow Legion"
              },
              "sub": {
                "zh": "效忠的组织",
                "en": "His army"
              }
            },
            {
              "title": {
                "zh": "小柚",
                "en": "Xiao You"
              },
              "sub": {
                "zh": "失散的妹妹",
                "en": "Lost sister"
              }
            }
          ],
          "chips": [
            {
              "zh": "战术推演",
              "en": "Tactical foresight"
            },
            {
              "zh": "暗影操控",
              "en": "Shadow control"
            }
          ],
          "metrics": [
            {
              "value": "31%",
              "label": {
                "zh": "人气投票",
                "en": "Popularity vote"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "小柚 · 伙伴",
            "en": "Xiao You · Partner"
          },
          "headline": {
            "zh": "天才机械师，能修好任何东西，除了自己的过去",
            "en": "A genius mechanic who fixes everything but her past"
          },
          "cards": [
            {
              "title": {
                "zh": "夜岚",
                "en": "Ye Lan"
              },
              "sub": {
                "zh": "伙伴",
                "en": "Partner"
              }
            },
            {
              "title": {
                "zh": "白枭",
                "en": "Bai Xiao"
              },
              "sub": {
                "zh": "失散的哥哥",
                "en": "Lost brother"
              }
            },
            {
              "title": {
                "zh": "赤焰",
                "en": "Crimson"
              },
              "sub": {
                "zh": "亲手改装",
                "en": "Her custom build"
              }
            }
          ],
          "chips": [
            {
              "zh": "机械改造",
              "en": "Mech upgrades"
            },
            {
              "zh": "黑客入侵",
              "en": "Hacking"
            }
          ],
          "metrics": [
            {
              "value": "24%",
              "label": {
                "zh": "人气投票",
                "en": "Popularity vote"
              }
            }
          ]
        },
        {
          "label": {
            "zh": "赤焰 · 机甲",
            "en": "Crimson · Mech"
          },
          "headline": {
            "zh": "拥有自我意识的第七代机甲",
            "en": "A self-aware seventh-generation mech"
          },
          "cards": [
            {
              "title": {
                "zh": "夜岚",
                "en": "Ye Lan"
              },
              "sub": {
                "zh": "驾驶员",
                "en": "Pilot"
              }
            },
            {
              "title": {
                "zh": "小柚",
                "en": "Xiao You"
              },
              "sub": {
                "zh": "改装者",
                "en": "Engineer"
              }
            },
            {
              "title": {
                "zh": "零界之门",
                "en": "Zero Gate"
              },
              "sub": {
                "zh": "诞生之地",
                "en": "Place of origin"
              }
            }
          ],
          "chips": [
            {
              "zh": "烈焰形态",
              "en": "Blaze mode"
            },
            {
              "zh": "自主作战",
              "en": "Autonomous combat"
            }
          ],
          "metrics": [
            {
              "value": "64 款",
              "label": {
                "zh": "衍生商品",
                "en": "Merch items"
              }
            }
          ]
        }
      ]
    }
  },
  "social-ip": {
    "deliverables": [
      {
        "title": {
          "zh": "角色人格",
          "en": "Persona"
        },
        "desc": {
          "zh": "性格、语气与价值观",
          "en": "Personality, tone and values"
        }
      },
      {
        "title": {
          "zh": "长期记忆",
          "en": "Long-term Memory"
        },
        "desc": {
          "zh": "用户偏好与互动历史",
          "en": "Preferences and history"
        }
      },
      {
        "title": {
          "zh": "社群工具",
          "en": "Community Tools"
        },
        "desc": {
          "zh": "话题、活动与群管理",
          "en": "Topics, events and moderation"
        }
      },
      {
        "title": {
          "zh": "用户洞察",
          "en": "User Insight"
        },
        "desc": {
          "zh": "需求、反馈与满意度",
          "en": "Needs, feedback and satisfaction"
        }
      }
    ],
    "day": [
      {
        "time": "08:00",
        "title": {
          "zh": "向会员发送早安问候",
          "en": "Morning greetings to members"
        },
        "output": {
          "zh": "2.4 万条",
          "en": "24K messages"
        }
      },
      {
        "time": "12:00",
        "title": {
          "zh": "发起社群话题",
          "en": "Start a community topic"
        },
        "output": {
          "zh": "860 条讨论",
          "en": "860 replies"
        }
      },
      {
        "time": "15:00",
        "title": {
          "zh": "处理会员咨询",
          "en": "Handle member questions"
        },
        "output": {
          "zh": "86% 自助解决",
          "en": "86% self-served"
        }
      },
      {
        "time": "20:00",
        "title": {
          "zh": "主持线上活动",
          "en": "Host an online event"
        },
        "output": {
          "zh": "1200 人参与",
          "en": "1,200 joined"
        }
      },
      {
        "time": "23:00",
        "title": {
          "zh": "汇总用户反馈",
          "en": "Summarise feedback"
        },
        "output": {
          "zh": "5 条产品建议",
          "en": "5 product ideas"
        }
      }
    ],
    "results": [
      {
        "label": {
          "zh": "咨询响应时间",
          "en": "Response time"
        },
        "before": {
          "zh": "2 小时",
          "en": "2 hours"
        },
        "after": {
          "zh": "即时",
          "en": "Instant"
        },
        "change": "-100%"
      },
      {
        "label": {
          "zh": "社群活跃度",
          "en": "Community activity"
        },
        "before": {
          "zh": "基准",
          "en": "Baseline"
        },
        "after": {
          "zh": "+68%",
          "en": "+68%"
        },
        "change": "+68%"
      },
      {
        "label": {
          "zh": "会员续费率",
          "en": "Renewal rate"
        },
        "before": {
          "zh": "54%",
          "en": "54%"
        },
        "after": {
          "zh": "71%",
          "en": "71%"
        },
        "change": "+17pt"
      }
    ],
    "faq": [
      {
        "q": {
          "zh": "会不会记住不该记的信息？",
          "en": "Will it remember too much?"
        },
        "a": {
          "zh": "用户可随时查看和删除记忆，敏感信息不会保存。",
          "en": "Users can view and delete memories; sensitive data isn't kept."
        }
      },
      {
        "q": {
          "zh": "能接入哪些社群？",
          "en": "Which communities?"
        },
        "a": {
          "zh": "微信群、企业微信、Discord 和品牌 App。",
          "en": "Group chats, workplace messaging, Discord and brand apps."
        }
      },
      {
        "q": {
          "zh": "和普通客服机器人有什么区别？",
          "en": "How is it different from a chatbot?"
        },
        "a": {
          "zh": "它有稳定的人格和长期记忆，会主动关心而不只是回答问题。",
          "en": "It has a stable persona and memory, and reaches out — not just replies."
        }
      }
    ],
    "spotlight": {
      "kind": "journey",
      "title": {
        "zh": "用户关系成长路径",
        "en": "How the Relationship Grows"
      },
      "desc": {
        "zh": "从第一次对话到成为忠实会员，关系一步步加深。",
        "en": "From a first chat to a loyal member, the bond deepens step by step."
      },
      "steps": [
        {
          "time": "D1",
          "label": {
            "zh": "首次对话",
            "en": "First chat"
          },
          "desc": {
            "zh": "主动打招呼，了解用户兴趣",
            "en": "Says hi and learns interests"
          },
          "output": {
            "zh": "3 个兴趣标签",
            "en": "3 interest tags"
          }
        },
        {
          "time": "D3",
          "label": {
            "zh": "记住偏好",
            "en": "Remembers"
          },
          "desc": {
            "zh": "记住口味与习惯，推荐更准",
            "en": "Remembers taste and habits"
          },
          "output": {
            "zh": "推荐点击 +42%",
            "en": "+42% clicks"
          }
        },
        {
          "time": "D7",
          "label": {
            "zh": "主动关心",
            "en": "Reaches out"
          },
          "desc": {
            "zh": "生日、天气和活动主动提醒",
            "en": "Birthday, weather and event reminders"
          },
          "output": {
            "zh": "回复率 76%",
            "en": "76% reply rate"
          }
        },
        {
          "time": "D14",
          "label": {
            "zh": "参与社群",
            "en": "Joins in"
          },
          "desc": {
            "zh": "邀请加入兴趣小组和话题",
            "en": "Invites to interest groups"
          },
          "output": {
            "zh": "加入 2 个小组",
            "en": "Joins 2 groups"
          }
        },
        {
          "time": "D30",
          "label": {
            "zh": "成为会员",
            "en": "Becomes a member"
          },
          "desc": {
            "zh": "推荐合适的会员权益",
            "en": "Suggests the right membership"
          },
          "output": {
            "zh": "转化 18%",
            "en": "18% convert"
          }
        },
        {
          "time": "D60",
          "label": {
            "zh": "共创内容",
            "en": "Co-creates"
          },
          "desc": {
            "zh": "邀请参与新品与内容共创",
            "en": "Invites to co-create"
          },
          "output": {
            "zh": "5 条共创",
            "en": "5 co-creations"
          }
        }
      ]
    }
  }
};

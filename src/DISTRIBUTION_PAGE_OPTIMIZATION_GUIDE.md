# 全网发行页面优化方案

## 当前问题
1. 账号绑定管理和发行渠道选择是分离的，用户不清楚选择某个渠道需要绑定哪些账号
2. 流程不够直观，用户需要先绑定账号，再选择渠道
3. 没有作品选择功能

## 优化方案

### 新的页面结构（3列布局）

```
┌────────────────────────────────────────────┬──────────────────┐
│         发行配置区（2列宽）                │  预览区（1列宽）  │
├────────────────────────────────────────────┤                  │
│ ① 选择要发行的作品                          │  ▸ 发行预览      │
│   [√] Neon Dreams (2026-03-15)             │  ▸ 所选渠道      │
│   [ ] Cyber Lullaby (2026-03-12)           │  ▸ 账号状态检查  │
│                                            │  ▸ 发行进度      │
├────────────────────────────────────────────┤                  │
│ ② 选择发行渠道 + 账号绑定状态检查           │                  │
│                                            │                  │
│ [√] 国内AI专属通道                          │                  │
│     ├─ 所需账号：                           │                  │
│     ├─ ✓ 腾讯音乐人 (已连接)               │                  │
│     └─ ⚠ 网易云音乐人 (未连接) [立即授权]  │                  │
│                                            │                  │
│ [√] 全球流媒体发行                          │                  │
│     ├─ 所需账号：                           │                  │
│     └─ ✓ DistroKid (已连接)                │                  │
│                                            │                  │
│ [ ] 短视频矩阵打歌                          │                  │
│     ├─ 所需账号：                           │                  │
│     ├─ ⚠ 抖音创作者平台 (未连接) [绑定]    │                  │
│     └─ ⚠ TikTok for Business (未连接)      │                  │
│                                            │                  │
├────────────────────────────────────────────┤                  │
│ ③ 发行设置                                 │                  │
│   ▸ 发行时间: [2026-03-30] [12:00]        │                  │
│   ▸ Pre-save活动: [ON]                    │                  │
│                                            │                  │
├────────────────────────────────────────────┤                  │
│ [提交发行审核] 按钮                         │                  │
└────────────────────────────────────────────┴──────────────────┘
```

### 核心改进点

#### 1. 作品选择模块（新增）
```tsx
<Card>
  <CardHeader>
    <CardTitle>
      <span className="step-number">1</span>
      选择要发行的作品
    </CardTitle>
  </CardHeader>
  <CardContent>
    {generatedSongs.map(song => (
      <label className="track-option">
        <input type="radio" name="release-track" />
        <div className="track-info">
          <h4>{song.title}</h4>
          <span>{song.date}</span>
          <Badge>{song.status}</Badge>
        </div>
      </label>
    ))}
  </CardContent>
</Card>
```

#### 2. 发行渠道卡片（重新设计）

每个渠道卡片内嵌账号绑定状态：

```tsx
<label className="channel-card">
  <div className="channel-header">
    <input type="checkbox" />
    <div className="channel-icon">...</div>
    <div>
      <h4>国内AI专属通道</h4>
      <p>腾讯音乐「启明星」/ 网易云音乐人</p>
    </div>
  </div>
  
  {/* 新增：账号绑定状态 */}
  <div className="required-accounts">
    <Label>所需平台账号：</Label>
    <div className="account-item connected">
      <CheckCircle /> 腾讯音乐人 (已连接)
    </div>
    <div className="account-item not-connected">
      <AlertTriangle /> 网易云音乐人 (未连接)
      <Button size="sm">立即授权</Button>
    </div>
  </div>
  
  <div className="channel-benefits">
    ✓ 自动标记「AI创作」标签
    ✓ QQ音乐、酷狗、酷我同步上架
    ...
  </div>
</label>
```

#### 3. 右侧预览区（新增）

实时显示：
- 当前选择的作品封面和信息
- 已选择的发行渠道列表
- 账号绑定状态汇总
- 预计覆盖平台数量

```tsx
<Card className="release-preview">
  <CardHeader>
    <CardTitle>发行预览</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="selected-track">
      <img src={selectedTrack.cover} />
      <h4>{selectedTrack.title}</h4>
    </div>
    
    <Divider />
    
    <div className="selected-channels">
      <Label>已选渠道 (2)</Label>
      <div className="channel-list">
        <div className="channel-chip">
          国内AI通道
          <Badge>需授权1个账号</Badge>
        </div>
        <div className="channel-chip">
          全球DSP
          <Badge className="success">已就绪</Badge>
        </div>
      </div>
    </div>
    
    <Divider />
    
    <div className="coverage-stats">
      <div className="stat">
        <span className="value">150+</span>
        <span className="label">覆盖平台</span>
      </div>
      <div className="stat">
        <span className="value">2</span>
        <span className="label">待绑定账号</span>
      </div>
    </div>
  </CardContent>
</Card>
```

### 交互逻辑

1. **条件渲染**：选择某个渠道后，该渠道卡片展开显示所需账号
2. **状态提示**：未绑定的账号用⚠️标识，并显示"立即授权"按钮
3. **智能提示**：提交前检查，如果有未绑定的必需账号，弹出提示
4. **一键绑定**：点击"立即授权"按钮，弹出OAuth授权窗口

### 颜色编码

- ✓ 绿色 = 已连接
- ⚠ 黄色 = 未连接但必需
- ⓘ 灰色 = 可选，未连接

### 实现建议

由于当前代码结构限制，建议：

1. 将 `distribution` 页面拆分为独立组件
2. 使用 `useState` 追踪：
   - 选中的作品
   - 选中的渠道列表
   - 每个渠道的账号绑定状态
3. 根据选中的渠道动态生成"所需账号"列表

### 代码示例（伪代码）

```tsx
const [selectedTrack, setSelectedTrack] = useState(null);
const [selectedChannels, setSelectedChannels] = useState([]);

const channelConfig = {
  domestic: {
    name: '国内AI专属通道',
    requiredAccounts: ['tencent_music', 'netease_music'],
    platforms: ['QQ音乐', '酷狗', '酷我']
  },
  global: {
    name: '全球流媒体',
    requiredAccounts: ['distrokid'],
    platforms: ['Spotify', 'Apple Music', ...]
  },
  shortVideo: {
    name: '短视频矩阵',
    requiredAccounts: ['douyin_creator', 'tiktok_business'],
    platforms: ['抖音', 'TikTok', ...]
  }
};

const accountStatus = {
  distrokid: { connected: true, email: 'artist@demo.com' },
  tencent_music: { connected: false },
  netease_music: { connected: false },
  douyin_creator: { connected: false },
  tiktok_business: { connected: false }
};

// 渲染渠道卡片时
{Object.entries(channelConfig).map(([key, channel]) => (
  <ChannelCard
    key={key}
    channel={channel}
    accounts={channel.requiredAccounts.map(acc => ({
      name: acc,
      status: accountStatus[acc]
    }))}
    onSelect={() => toggleChannel(key)}
    onConnectAccount={(accountKey) => handleOAuth(accountKey)}
  />
))}
```

## 总结

这个优化方案的核心思想是：**让用户在选择渠道的同时，立即看到该渠道需要哪些账号，以及哪些账号未绑定，并提供一键绑定功能**。

这样可以大大简化发行流程，减少用户的认知负担。

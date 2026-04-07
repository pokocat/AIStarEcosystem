# 🚀 快速使用指南

## 新增功能快速访问

### 1. 艺人管理 (My Agency)
```
进入"我的经纪公司" → 选择 Tab:

📍 我孵化的艺人:
  - 点击"查看" → 艺人详情页（作品/数据/分析）
  - 点击"创作" → 跳转音乐工坊

📍 艺人市场:
  - 浏览可签约艺人
  - 点击"立即签约" → 完整签约流程（4 步）
    1. 查看详情
    2. 阅读合同
    3. 支付确认
    4. 签约成功

📍 已发布到市场:
  - 点击"发布新艺人到市场" → 发布流程
    1. 填写定价和描述
    2. 预览发布效果
    3. 确认发布
    4. 发布成功
```

### 2. 音乐创作 (Music Studio)
```
进入"音乐与MV工坊" → 任意创作模式:

点击模式卡片后:
  → 自动打开"AI 音乐生成对话框"
  → 选择输入模式（文本/哼唱/旋律）
  → 输入描述 + 风格
  → 点击"开始生成"
  → 观看 6 阶段生成动画（30 秒）
  → 试听预览
  → 保存到作品库
```

### 3. NFT 铸造 (Blockchain)
```
任意作品列表:

选择一首歌曲 → 点击"铸造 NFT":
  1. 配置 NFT（名称/数量/价格/稀有度）
  2. 连接钱包（MetaMask/WalletConnect）
  3. 确认铸造 → 5 阶段进度
  4. 铸造成功 → 显示合约信息
```

### 4. 全网发行 (Distribution)
```
进入"全网矩阵分发":

左侧配置区:
  1. 选择要发行的作品（单选）
  2. 选择发行渠道（多选）
     - 国内 AI 专属通道
     - 全球流媒体发行
     - 短视频矩阵打歌
  3. 绑定所需平台账号
     - 点击"立即授权"模拟连接
     - 绿色✓表示已连接
  4. 设置发行时间 + Pre-save 活动
  5. 点击"提交发行审核"

右侧预览区:
  - 实时显示已选内容
  - 覆盖平台数量统计
  - 待绑定账号提醒
```

### 5. 新手引导 (Onboarding)
```
首次进入应用:

自动弹出 6 步引导教程:
  1. 欢迎页面
  2. 孵化 AI 歌手
  3. 创作音乐
  4. 全网发行
  5. NFT 铸造
  6. 准备就绪

操作:
  - "跳过引导" → 关闭教程
  - "下一步" → 继续教程
  - "前往XXX页面" → 直接跳转到对应功能

重新查看:
  - 打开浏览器控制台
  - 执行: localStorage.removeItem('onboarding_completed')
  - 刷新页面
```

---

## 组件开发快速参考

### 如何添加新的对话框组件

```typescript
// 1. 创建组件文件 /components/MyDialog.tsx

interface MyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
  lang: 'zh' | 'en';
}

export default function MyDialog({ isOpen, onClose, onSuccess, lang }: MyDialogProps) {
  const [step, setStep] = useState<'input' | 'processing' | 'success'>('input');
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#0c0c0e] border-white/10 text-white">
        {/* 你的内容 */}
      </DialogContent>
    </Dialog>
  );
}

// 2. 在 App.tsx 中导入
import MyDialog from "./components/MyDialog";

// 3. 在 ProducerDashboard 中添加状态
const [showMyDialog, setShowMyDialog] = useState(false);

// 4. 渲染对话框
<MyDialog
  isOpen={showMyDialog}
  onClose={() => setShowMyDialog(false)}
  onSuccess={(data) => {
    // 处理成功回调
  }}
  lang={lang}
/>

// 5. 触发打开
<Button onClick={() => setShowMyDialog(true)}>
  打开对话框
</Button>
```

---

## 动画最佳实践

### 基础动画模板
```tsx
import { motion, AnimatePresence } from 'motion/react';

// 入场动画
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  内容
</motion.div>

// 退场动画
<AnimatePresence mode="wait">
  {isVisible && (
    <motion.div
      key="content"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      内容
    </motion.div>
  )}
</AnimatePresence>

// 成功动画（弹性）
<motion.div
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={{ type: "spring", duration: 0.6 }}
>
  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
</motion.div>

// 加载动画（旋转）
<motion.div
  animate={{ rotate: 360 }}
  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
>
  <Loader2 className="w-8 h-8" />
</motion.div>
```

---

## 样式规范

### 颜色使用指南
```css
/* 主色调 */
.primary-purple { @apply bg-purple-600 text-white }
.primary-cyan { @apply bg-cyan-600 text-white }

/* 状态颜色 */
.success { @apply bg-emerald-600 text-white }
.warning { @apply bg-yellow-600 text-white }
.error { @apply bg-red-600 text-white }
.info { @apply bg-blue-600 text-white }

/* 交互悬停 */
.hover-lift { @apply hover:scale-[1.02] transition-transform }
.hover-glow { @apply hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] }

/* 赛博朋克光晕 */
.neon-purple { @apply shadow-[0_0_20px_rgba(168,85,247,0.5)] }
.neon-cyan { @apply shadow-[0_0_20px_rgba(6,182,212,0.5)] }
.neon-emerald { @apply shadow-[0_0_20px_rgba(16,185,129,0.5)] }
```

### 常用组合类
```tsx
// 卡片
<div className="bg-[#0c0c0e] border border-white/10 rounded-xl p-6 backdrop-blur-xl">

// 按钮 - 主要操作
<Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">

// 按钮 - 次要操作
<Button variant="outline" className="border-white/10 hover:bg-white/5">

// 输入框
<Input className="bg-black/50 border-white/10 focus:border-purple-500/50">

// 进度条
<Progress value={50} className="h-2 bg-white/5" />

// Badge
<Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">
```

---

## 调试技巧

### 查看当前状态
```javascript
// 打开浏览器控制台

// 查看 localStorage
console.log(localStorage.getItem('onboarding_completed'));

// 清除新手引导记录
localStorage.removeItem('onboarding_completed');

// 查看 React 组件树（需要 React DevTools）
// 1. 安装 React DevTools 浏览器扩展
// 2. 打开扩展面板
// 3. 查看 ProducerDashboard 组件的状态
```

### 模拟错误场景
```typescript
// 在对话框组件中添加错误处理
const [error, setError] = useState<string | null>(null);

// 模拟 API 错误
setTimeout(() => {
  setError('网络连接失败，请稍后重试');
}, 2000);

// 显示错误提示
{error && (
  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
    <p className="text-red-400 text-sm">{error}</p>
  </div>
)}
```

---

## 性能优化检查清单

- [ ] 大型列表使用虚拟滚动
- [ ] 图片使用懒加载
- [ ] 对话框组件按需渲染（条件渲染）
- [ ] 防抖/节流高频操作（搜索、滚动）
- [ ] 使用 React.memo() 优化子组件
- [ ] 避免在 render 中创建新函数
- [ ] 使用 useCallback/useMemo 缓存

---

## 常见问题解决

### Q: 对话框关闭后状态没有重置？
```typescript
// 在 onClose 中重置所有状态
const handleClose = () => {
  setStep('input');
  setData(null);
  setError(null);
  onClose();
};
```

### Q: 动画卡顿？
```typescript
// 使用 will-change 提示浏览器优化
<motion.div className="will-change-transform">

// 或使用 GPU 加速
<motion.div style={{ transform: 'translateZ(0)' }}>
```

### Q: 中英文切换不生效？
```typescript
// 确保传递了 lang prop
<MyComponent lang={lang} />

// 使用翻译对象
const t = {
  zh: { title: '标题' },
  en: { title: 'Title' }
};
const text = t[lang];
```

---

## 快捷键（待实现）

```
Ctrl/Cmd + K  → 打开全局搜索
Ctrl/Cmd + N  → 创建新艺人
Ctrl/Cmd + M  → 打开音乐生成
Ctrl/Cmd + B  → 打开 NFT 铸造
Ctrl/Cmd + D  → 打开发行页面
ESC           → 关闭当前对话框
```

---

## 目录结构速查

```
src/
├── components/
│   ├── ui/                  # 基础 UI 组件
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── ArtistSigningDialog.tsx      # 艺人签约
│   ├── ArtistDetailDialog.tsx       # 艺人详情
│   ├── ArtistListingDialog.tsx      # 艺人发布
│   ├── MusicGenerationDialog.tsx    # 音乐生成
│   ├── NFTMintingDialog.tsx         # NFT 铸造
│   ├── OnboardingGuide.tsx          # 新手引导
│   ├── ToastNotification.tsx        # 通知系统
│   └── DistributionPage.tsx         # 发行页面
└── App.tsx                  # 主应用
```

---

**提示**: 查看 `/FINAL_OPTIMIZATION_REPORT.md` 获取完整文档。

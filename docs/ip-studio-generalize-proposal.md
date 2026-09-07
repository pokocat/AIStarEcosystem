# AI IP 工作台 · 通用化提案

> **状态：提案，未定案。** 真源仍是 [`ip-studio-plan.md`](ip-studio-plan.md)；本文只提出改动主张与依据，采纳后再合并回真源。
> 提出时间：2026-09-06

---

## 1. 问题

形象卡（`look` 节点）目前把描述拆成五个定死的字段：

```java
// IpRunService.lookText()
for (String f : List.of("outfit", "pose", "expression", "details", "props")) {
    String v = IpDocs.text(lookData, f);
    if (v != null) out.add(v);
}
```

**服务端对这五个字段做的唯一一件事，是按顺序拼成一串文本。** 它不区分语义、不分别调权、不做任何字段级处理。

既然最终仍然是一段话喂给模型，拆成五个输入框对出图**没有任何增益**，代价却实实在在：

1. **填写负担。** 用户要在五个框之间来回切，而脑子里想的本来就是一整句话。
2. **边界模糊。** 「一只眼睛完全闭上，另一只睁大并斜向一侧看，舌头卷成 U 型」—— 这该填 `expression` 还是 `details`？每次都要犹豫。
3. **表达受限。** 真实提示词里，风格、角色、服装、姿势、表情、道具本来就是交织的。硬拆会逼用户把一句自然的话切碎。
4. **与业界通用做法背离。** 主流 AI 画布工具的形态是「贴几张参考图 + 写一段完整提示词」。用户已经熟悉这套，我们的定制结构增加了迁移成本，却没换来更好的结果。

---

## 2. 建议

### 2.1 形象卡：五字段 → 一个提示词框 + 内置模板

节点数据从

```json
{ "outfit": "...", "pose": "...", "expression": "...", "details": "...", "props": "..." }
```

改成

```json
{ "prompt": "...", "presetId": "toy-3pack-a" }
```

**内置提示词模板库**（这是用户认可的方向：「把提示词做内置我觉得是可以的，增加可复制性和标准化」）：

- 每个模板是一段**完整的提示词骨架**，不是字段结构
- 点一下填进框里，用户可以自由改、可以整段替换
- 模板本身是可版本化、可运营配置的资产，比字段结构更容易迭代

内置模板建议按用途组织，例如：潮玩三连 / 表情包六连 / 商务形象 / 季节穿搭 / 场景写真。

### 2.2 节点类型：7 → 6，只删 `look`

| 节点 | 去留 | 理由 |
|---|---|---|
| `source` | 保留 | 原始照片，一致性的源头 |
| `identity` | **必须保留** | 特征卡是服务端从图里抽出来的一致性锚，不是用户填的表单。它是这个产品相对通用画布的核心价值 |
| `style` | 保留（可选节点） | 风格与形象**正交**：一个风格挂多个 look，`ancestorsOfType(doc, nodeId, T_STYLE, ANCESTOR_DEPTH)` 向上多跳已经支持。合并进 generate 会逼用户每个节点重写一遍风格 |
| `reference` | 保留 | 贴参考图是业界通用做法本身就有的 |
| `look` | **删除** | 内容并进 `generate` 的提示词框 |
| `generate` | 保留 | 承接提示词 + 参考图 + 出图 |
| `publish` | 保留 | 落成 `DapAvatar` + `DapLook` |

### 2.3 不动的部分

- **五层一致性锁定全部保留。** 特征卡文本固定 / 主图作 i2i 锚（`master → source → reference`）/ 风格文本原样拼接 / 服务端模板 + 一致性从句 / 多候选择优。这是产品的护城河，跟输入形态是两件事。
- 计费纪律、`IpRunWorker` 的 hold/commit 顺序、`afterCommit` 派发、`IpRunReaper` 全部不动。
- 发布链路（`IpPublishService` → `DapAvatar` + `DapLook`）不动。

---

## 3. 兼容性：零迁移

`lookText()` 现在做的就是「把五个字段按顺序拼起来」。读取老项目的 doc 时沿用这段逻辑得到 `prompt` 即可，历史画布不需要数据迁移，也不需要停机。

新写入一律只写 `prompt` + `presetId`。

---

## 4. 影响面

| 层 | 改动 |
|---|---|
| server | `IpRunService.lookText()` 改为读 `prompt`（老 doc 回落拼接）；`IpDocs.T_LOOK` 保留常量以读老 doc，不再作为可新建的节点类型 |
| server | `IpCatalogService` 增加提示词模板列表端点（与现有 `styles` 并列） |
| web | 删 `look-node.tsx`；`generate-node.tsx` 加提示词框 + 模板选择器 |
| web | 内置工作流模板（潮玩三连 / 表情包六连）改为预置好提示词文本的 generate 节点 |
| 契约 | `specs/openapi.yaml` 增加模板列表 path；节点 schema 调整 |

估算：不大。删的比加的多。

---

## 5. 待确认

1. 内置模板库放哪：写死在 `IpCatalogService`，还是做成 admin 可配（跟 `dap.*` prompt key 一样进 `PromptService`）？倾向后者 —— 模板是运营资产，运营应该能改。
2. 与 dap `createDerivative(expr / ward)` 的重叠怎么收：建议 **dap 衍生只保留单张微调，成组生产一律进工作台**。需要产品拍板并同步进两边文档。
3. 模板是否要按子产品分组（名片 / 带货 / 短剧各有偏好的形象组合）。

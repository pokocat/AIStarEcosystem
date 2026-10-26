# OneToken Seedance 2.0 / 2.5 生产配置发布（2026-10-26）

## 发布结论

- OneToken 当前模型目录已确认返回 `seedance-2.0`、`seedance-2.5` 和 `seedance-2.5-cn-vip`；本次只按需求接入前两个。
- Studio 视频模型组现在包含 MiniMax H3、Seedance 2.0、Seedance 2.5；H3 保持默认，用户可显式选择两条 Seedance 模型。
- 两条 Seedance 端点只向 `studio` 开放，不影响短剧、明星带货或其他产品线。
- 两条模型均沿用已上线的 Seedance 协议：文生视频、首帧生视频、720p、4–15 秒。
- 两条模型均按原 Seedance 售价配置为 80 积分/秒；H3 的配置与默认地位未改变。
- 本次是生产模型配置发布，没有更换服务端或前端制品，也没有发起付费视频生成。

## 背景

旧端点 `ai-98b369eb-b59` 使用的供应商模型 `doubao-seedance-2-0-260128` 已被 OneToken 下架。2026-10-20 的三次实际提交均被供应商以 `model ... has been retired` 拒绝，因此当日该端点被禁用并从 Studio 候选组移除。

本次使用线上已加密保存的 OneToken 凭据读取 `GET /v1/models?include_video=true`，未把聊天中提供的明文 Key 写入命令、仓库、发布记录或服务器配置。

## 生效配置

| 产品模型 | 端点 ID | 供应商模型 ID | 状态 | Studio 候选价 |
|---|---|---|---|---:|
| Seedance 2.0 | `ai-98b369eb-b59` | `seedance-2.0` | enabled | 80 积分/秒 |
| Seedance 2.5 | `ai-onetoken-seedance25` | `seedance-2.5` | enabled | 80 积分/秒 |

Studio 视频组：

```json
{
  "defaultEndpointId": "ai-jusuan-minimax-h3",
  "endpointIds": [
    "ai-jusuan-minimax-h3",
    "ai-98b369eb-b59",
    "ai-onetoken-seedance25"
  ]
}
```

## 验收

- 两条端点使用各自保存的凭据读取模型目录均返回 HTTP 200，并同时看见 `seedance-2.0`、`seedance-2.5`。
- 服务端模型管理回读显示：两条端点和候选均 enabled、均为 `PER_SECOND`，价格均为 80。
- 访问策略回读显示：`categories=[video]`、`scope=selected`、`appCodes=[studio]`。
- Studio 视频组回读包含 H3、Seedance 2.0、Seedance 2.5，默认端点仍为 H3。
- 视频价格投影显示两条 Seedance 均支持 `t2v` / `i2v` 的 720p 档，价格为 80 积分/秒。
- `infra/scripts/verify.sh` 全绿；`aistar.aibuzz.cn` 首页与 `/director` 均为 HTTP 200，后端、MySQL、nginx、各 Web 服务及 sau-service 均 active。
- 未发送付费生成，因此供应商的真实视频产出质量、耗时与最终结算仍需由下一次用户实际生成验证。

## 回滚材料

更新前的端点、Studio 视频候选和相关平台配置已保存在生产服务器 root-only 目录：

`/opt/ai-star-eco/backups/onetoken-seedance-models-20261026T065714Z`


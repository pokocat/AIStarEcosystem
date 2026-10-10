# Studio 平台配音定价接入

## 范围与启用

已实现 Studio 配音的发布价读取、任务价格快照及采用回执；端点使用模型 ID，动作 `studio.speech`，应用 `aistar-aiavatar`，单位秒。Java 薄 SDK 固定 `cn.aibuzz:platform-sdk:0.1.0`。开发环境先从同级 aibuzz-platform 的 `sdks/java/pom.xml` 构建安装。正式发布还需 Maven 制品仓库，不能依赖开发机本地仓库。

配置均为服务端配置，不传浏览器：

```properties
aep.studio.platform-pricing.enabled=true
aep.studio.platform-pricing.base-url=https://<平台地址>
aep.studio.platform-pricing.credential=<应用凭据>
aep.studio.platform-pricing.brand-id=<已开通品牌>
aep.studio.platform-pricing.app-code=aistar-aiavatar
```

默认 enabled=false，继续使用已有 `ipstudio.supplier-point-pricing`。仅本地 HTTP 联调可设置 `aep.studio.platform-pricing.allow-local=true`，mysql/prod/production 环境禁止此选项。启用时配置错误阻止启动；网络、契约、无价或停用会拒绝新受理，不静默使用旧价。x-dub 口型未接入，保留原规则。

## 快照、账本与回执

受理前读取平台发布版，完整价格及成本快照写入 `_exec.pointPricing`。预冻结与真实音频结算沿用 CreditService 不可变账本；秒数向上取整，积分最终向上取整。原请求幂等重放先返回既有任务，不再次取价或冻结。发布更新不改变已受理任务。

任务行兼作采用回执的持久待发送记录，定时发送平台 operationId=runId；平台成功后标记 `_exec.pricingReported`，失败保留记录后续补报。回执与供应商结果独立，不能拿回执冒充生成成功。客户端不自动重试任务提交。

## 本地验收

`StudioPlatformPricingAcceptanceTest` 仅有本地验收环境变量时执行，地址硬限制 localhost:4410。真实平台 v1 HTTP、真实 H2 钱包账本，供应商客户端为 Mockito 假实现（不出站、不付费）。成本 1 供应商积分/秒、换算 1:1、加成 50%；冻结 20，音频 3.2 秒按 4 秒结算 6，退回 14，余额 100→94。同请求重放无重复冻结，重复采用回执成功。

一般测试覆盖旧定价、配音服务与生命周期；本次未启动完整 AIStar 业务服务做浏览器生成验收。运营平台页面已通过真实浏览器成本、策略、发布、试算验收。未提交、未推送、未部署生产。

## 固定 SDK 制品交付

SDK 0.1.0 已发布到私有仓库 pokocat/aibuzz-platform 的 java-sdk-v0.1.0 Release，含 jar、pom 与 SHA256SUMS；SDK 构建固定输出时间戳。infra/scripts/prepare-platform-sdk.sh 从该发布下载并校验写死的 SHA，再安装本地 Maven 仓库；服务发布构建会先执行此步骤。构建机器需已登录具有仓库只读权限的 GitHub CLI，脚本不创建或存储额外令牌。可用 MAVEN_REPO_LOCAL 指定隔离 Maven 仓库。平台业务源码不导入应用，生产 JAR 内含 SDK 制品。

# 文字模型空回复识别与原始流排查（2026-11-08 北京时间）

## 问题与行为

导演台《二点四十》写分镜任务 IPR-023dc53509a04447bbe7（logId WRVN3EHYNK7Q）在 01:54:38 失败。OneToken · Orange5.5 / claude-opus-5-5-Kiro 的调用在 132 秒后 HTTP 200 / finish=stop；应用正文长度0，供应商用量回执输出Token为0。之前调用层将它记成成功，再由导演结构校验报 AI_BAD_OUTPUT「模型返回格式有误」。原110积分冻结已全部释放，cost=0。

现在流式、非流式文字调用及无正文也无工具调用的完整对话轮明确返回 HTTP502 / AI_EMPTY_OUTPUT：「生成服务未返回正文，请重试或更换模型」。用量流水记失败、分类 BAD_RESPONSE，保留用量与终态诊断；导演 worker 在业务解析前有相同防线。空回复不自动重发，不触发额外供应商调用；该次未完成冻结释放。纯工具调用、用户停止和非空原文的交付/保留规则不变。

## 授权重放与证据边界

用户明确授权重放原请求、保存完整原始流并修复提示。ECS 直连 OneToken，仅提交一次；请求体逐字取自原用量记录，并与任务冻结的 systemPrompt / userPrompt 核对一致。请求体 SHA256 d8588d70326a8df6c4379fd077d3afdd07a3d180b634ad74a0704c142e8af21c。无用户新冻结或扣款，诊断供应商费用由平台承担。

重放在104.2秒完整结束，HTTP200 / finish=stop / [DONE]，原始SSE 345058字节、1588个事件，正文17730字符，输出Token12194。原始字节流、响应头白名单、分块到达时间、解析事件与全文保存在 ECS /opt/ai-star-eco/ops/director-stream-replay-023dc535/，目录0700、文件0600；没有保存明文Key或授权头。原始流SHA256 40f49faa8a3b0389903f9f32857f2d9da3583f2f9514bc8397e0fbcf0d9ea1a4。

Mini 对完整捕获流运行实际 AiModelInvocationService.StreamAccumulator，正文与独立提取结果逐字一致；正文SHA256 11ba347d161c110c3a7c1645d7dd00837f8f1691d345d10c1ff253a58e5629b9。本次没有解析漏读。但供应商这次返回的 JSON 在第56行含未转义双引号，业务解析明确失败；没有自动修写内容或导入执行结构，完整原文保留供核对。

原失败时未保存原始SSE，用量记录response_body_json为空，所以不能仅凭这次成功接收正文完全确定历史那次是供应商空回，还是历史流式适配漏读。此次重放没有复现空回，不作超出证据的供应商归责。

## 主干、测试与正式制品

- 构建 main 提交：7c445915bcf8dd49d43cc6179c1264d73c4b3700，已推送；发布时随后合入的99fb26819与该提交的apps/server无差异。
- 只发布 server；未带入其他聊天后续的 reasoning_effort / V77 等未提交改动，也未发布前端。
- 初轮定向72例通过。最终主干对 AiModelInvocationServiceTest、DialogueStreamingInvocationTest、StudioWorkflowWorkerJsonTest、ModelOutputArchiveTest、AiModelUsageServiceTest、ModelOutputArchiveIntegrationTest 六组定向/集成测试通过，包括同步/流式空正文、空白/仅推理、失败观测、单次提交、释放冻结、纯工具调用、停止请求、完整原文保存。
- 检查与构建均通过Mac mini devq队列，Maven预算1536MiB、上下文缓存2。初次清洁度检查发现同步器按规定排除已跟踪.env文件，使用不检出.env的稀疏main快照后重新核对clean tree；没有恢复或传送环境凭据。本机其他聊天的脏文件保持原状。
- 最终构建队列任务20425411af98退出0；官方build-release.sh的打包阶段使用-DskipTests clean package，测试已在同一个串行任务的前一阶段执行通过，打包不替代测试。
- 制品20261107-empty-output-7c445915；app.jar SHA256 22a70f94213283f51aed3ef6966e393921c2c97c2b7637d023a0f971665fbbdd。线上JAR哈希一致。

## 线上验收

aistareco-server在02:33:46完成启动，服务active。公网Studio首页、登录、/api/config、/model-results均200；管理端根路径302至/admin。ECS直连公网/api/config也200。verify.sh最终ALL GREEN，包括本机API、服务、nginx配置与媒体依赖检查。

首次验证强制curl绑定en0导致本机HTTPS探测超时，恢复正常出口后公网通过；另一个人为选择的admin/login路径404，核对后台真实根路径302后修正为有效探针并重验通过。没有为这些验证问题重复发布或重启服务。

本次未改写原失败任务、未将重放原文自动导入导演作品，原任务冻结与作品内容保持原状。完整原始流与非空正文可从本机 .studio-e2e/director-023dc535-readonly/ 对应文件读取。

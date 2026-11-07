# 模型正文引号容错生产发布（2026-11-07，America/Los_Angeles）

## 用户遇到的问题与新行为

用户台词中的双引号是正常内容。此前 OneToken 重放正文在 JSON 字符串中漏了双引号转义，导致整份结构不能直接读成分镜。现由 ModelJson 在常规解析失败后，对字符串值内明确成对、不能作为值结尾的引号补转义；引号和文字本身保留，不改变用户输入或模型原文。

键名、疑似缺少逗号的字段边界、单个未配对引号、重复键、第二份 JSON 文档及未完成内容仍不猜测。补转义后必须整份通过严格解析和原有业务校验；无法安全整理时保留全文并提示自动整理未完成，不丢弃结果、不自动付费重发。原始回包在解析前的保存流程不变。

## 验证

- Mini devq a15fce6a6122：ModelJsonTest 43例、StudioWorkflowWorkerJsonTest 17例、DirectorPromptsTest 25例、ModelOutputArchiveTest 2例，共87例，失败/错误/跳过均0。
- 新增真实故障摘录、数组值、原有合法转义、保留引用字段，以及缺逗号/键名破损/未配对引号/重复键/多文档/缺失内容的拒绝案例。
- 复用先前保存的345058字节原始SSE，没有再次调用模型。实际Java流解析器仍与独立提取的17730字符原文逐字一致，SHA256 11ba347d161c110c3a7c1645d7dd00837f8f1691d345d10c1ff253a58e5629b9；新JSON容错和完整导演业务校验通过，得到11个片段。该检查由队列725add08d9dd完成；65217cfc215f另保存校验后的repaired-plan.json供复核。
- 没有自动改写原失败记录、作品片段或用户采用版本，没有新增用户扣费。

## 合并、构建与上线

- 正式构建 main：831ee12a4f2a776375bcf07282392e6fe66d574e，已推送。先快进合入现有main功能，保留其他聊天的未提交文档。
- Mini devq f9191ba79238 退出0：不检出.env的干净main快照，Maven预算1536MiB、上下文缓存2；同一串行任务先重跑上述87例，再执行官方build-release.sh server。打包阶段-DskipTests clean package，未将打包冒充测试；报告另存BuildBox/tmp/model-quote-831ee12a。
- 发布范围仅server，制品20261107-paired-quotes-831ee12a。
- 线上与本机制品JAR SHA256一致：cbed3ecba57390fe5c8048e86440c0346423d1d4d22528055147fe41d203ba89。
- 发布前无正在执行的ip_run。使用deploy-release.sh完成发布，aistareco-server active，verify.sh ALL GREEN；Studio首页/登录/API配置/原文页200、后台根路径302、所有现有服务及nginx检查通过。

本机证据在 .studio-e2e/director-023dc535-readonly/quote-deploy.log、quote-test-results.json、quote-capture-validation.log、repaired-plan.json。原始流与未修写正文继续保留在同目录；不将完整用户正文或凭据提交到Git。

package com.aistareco.aep.config;

import com.aistareco.aep.model.PlatformConfig;
import com.aistareco.aep.repository.PlatformConfigRepository;
import com.aistareco.aep.service.PromptService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * Prompt 模板默认值 seeder（docs/archive/material-ops-ai-text-plan.md §6.4）。
 *
 * 策略：
 *  - 每次启动：对每个已知 key「缺行才插」（resources/prompts/material/&lt;key&gt;.md）—— 不覆盖已存在的行。
 *  - 推新基线：bump SEED_VERSION 后，仅刷新运营未改过的行（version==1）；改过的行（version&gt;1）不动。
 *
 * 与 CelebrityProductSeeder 的「版本不匹配就 reset 清表」不同 —— prompt 是运营资产，
 * 绝不能因升级而 clobber 运营在后台改过的 prompt。
 */
@Component
@Order(38)
public class PromptTemplateSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(PromptTemplateSeeder.class);

    /** 推新默认 prompt 基线时改这个值；下次启动会刷新 version==1 的行。 */
    // v10：新增近期热点蒸馏 prompt（drama.hotspot_distill）—— bump 让新基线入库 + 刷新未改动的行。
    // v11：热点蒸馏 prompt 重写（同一个人/同一个世界 + 五类错配反面样例 + 宁缺勿滥）。
    //      线上实测产出过「包书皮时意外发现，前任留下的惊天伏笔」这类把两个话题域硬焊的选题。
    // v12：v11 收得过紧 —— 线上连续 6 次产出 0 条（旧版同批 50 热词能出 10 条）。改为「逐条判断、
    //      不要整批放弃、通常 4-8 条」，并说明丢弃规则只针对那件事本身、不是放弃整批热词。
    // v13：画布提示词（drama.canvas_script_setting / outline / episode / extract / storyboard）按线上实测改写：
    //      示例名换成人物甲 / 乙、人物小传列全想法里的人且不撞字、台词不加 △、相邻集不重复、拆角色看大纲、片段下限。
    // v14：对话提示词放行「可以」这类短肯定回复。
    // v15：方案提示词把 questions 写成字符串数组（Agnes 写成 {id,text,defaultAnswer}，整份方案被拒）；对话提示词
    //      不在正文写素材编号、不把没说过的金额说成用户说的（示例里的「上限 300 积分」曾被模型当成用户原话）。
    // v16：对话提示词要求可直接用的文字初稿用 create_nodes 放进画布；检查提示词以目标说明里的替换对象为准、依据与结论不许矛盾
    //      （线上复刻检查看到「三位成年男性」仍判「没有旧人物」）。
    // v17：对话提示词把「聊天按用量扣少量积分」与「制作确认报价后才开始」分开说，禁止先报数再改口、禁止「不确认不会花钱」
    //      （Codex 真 Agnes 复测：先说「费用 12 积分」，服务端报价 98，末尾还说「不确认不会花钱」而本轮已扣 5）。
    // v20：卡片精简（docs/ip-studio-new-canvas-and-threads.md §4.4）：方案 summary / title 只写要做出什么，不写判断过程、积分和流程；
    //      对话发卡时正文最多一句、不复述卡片、不报价、不给操作提示。
    // v21：对话提示词恢复「调用工具时正文可以写一句在做什么」，并在动作输出方式后给一个完整的动作示例
    //      （线上 2026-10-21 13:50 聚算 Qwen3.8 27B 整条回复只写了「[调用工具 view_images]」，没有调用任何工具）。
    // v22：对话提示词「动作输出方式」补一句分隔行只写一次、数组后面不要再写
    //      （线上 2026-10-21 14:10 聚算 Qwen3.8 27B 三次都在数组后面又写了一遍 <<<studio-actions>>>，整轮被判格式错误）。
    // v23：方案提示词补 targetNodeId（结果放进助手为这一步准备的对象，不另建）与「有首帧图时画幅跟首帧」；对话提示词规则 11 同补画幅
    //      （线上 2026-10-21 IPP-655ea55a：执行器另建了结果节点，助手建的视频节点成了空壳；1:1 首帧被拉成 9:16）。
    // v25：对话去掉「继续」（docs/ip-studio-dialogue-no-continue.md）：对话提示词新增规则 14（一句话做完，不让用户回复继续、
    //      不提单轮步数 / 用量 / 时间上限，只有付费生成才停下确认），长文分段读写成带参数的用法（nodeIds + offset，读到
    //      nextOffset 为空），{{steering}} 标题改成「接续信息与待应用的用户调整」（自动接续的任务把整条链的已做操作放在这里）。
    // v26：不锁方法（docs/ip-studio-dialogue-intents.md 「2026-10-23：不锁方法」）：对话提示词「先判断用户要什么」一节改成
    //      有进行中的制作时也按这句话的意图换方法，不再说「没有进行中的制作时才能换」。
    private static final String SEED_VERSION = "v26-2026-10-23-dialogue-unlocked-methods";
    private static final String CONFIG_KEY = "aep.material.prompt-seed-version";

    private final PromptService promptService;
    private final PlatformConfigRepository platformConfigRepo;

    public PromptTemplateSeeder(PromptService promptService,
                                PlatformConfigRepository platformConfigRepo) {
        this.promptService = promptService;
        this.platformConfigRepo = platformConfigRepo;
    }

    @Override
    public void run(String... args) {
        try {
            int inserted = 0;
            for (String key : PromptService.KNOWN_KEYS) {
                if (promptService.seedIfAbsent(key)) inserted++;
            }
            if (inserted > 0) log.info("PromptTemplateSeeder: +{} prompt 模板默认值入库", inserted);

            var existing = platformConfigRepo.findByConfigKey(CONFIG_KEY);
            String current = existing.map(PlatformConfig::getValueJson).orElse(null);
            if (!SEED_VERSION.equals(current)) {
                int refreshed = 0;
                for (String key : PromptService.KNOWN_KEYS) {
                    if (promptService.reseedBaselineIfUntouched(key)) refreshed++;
                }
                if (refreshed > 0) {
                    log.info("PromptTemplateSeeder: 刷新 {} 个未改动的 prompt 基线 → {}", refreshed, SEED_VERSION);
                }
                upsertSeedVersion(existing.orElse(null));
            }
        } catch (Exception e) {
            log.error("PromptTemplateSeeder failed: {}", e.getMessage(), e);
        }
    }

    private void upsertSeedVersion(PlatformConfig existing) {
        PlatformConfig cfg = existing != null
                ? existing
                : PlatformConfig.builder()
                        .id(UUID.randomUUID().toString())
                        .configKey(CONFIG_KEY)
                        .description("PromptTemplateSeeder 已种植的 prompt 基线版本号；不匹配时刷新 version==1 的行")
                        .version(0)
                        .build();
        cfg.setValueJson(SEED_VERSION);
        cfg.setVersion(cfg.getVersion() + 1);
        cfg.setUpdatedAt(Instant.now());
        cfg.setUpdatedBy("system:PromptTemplateSeeder");
        platformConfigRepo.save(cfg);
    }
}

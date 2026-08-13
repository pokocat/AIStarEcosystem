package com.aistareco.aep.clip.config;

import com.aistareco.aep.clip.dto.ClipRequests.UpsertTemplate;
import com.aistareco.aep.clip.repository.ClipTemplateRepository;
import com.aistareco.aep.clip.service.ClipTemplateService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 首次部署内置三套官方可体验模板；同 ID 已存在时尊重运营编辑，不覆盖。 */
@Component
@Order(80)
public class ClipOfficialTemplateSeeder implements ApplicationRunner {
    private final ClipTemplateRepository repo;
    private final ClipTemplateService service;
    private final boolean enabled;
    /** 显式重刷：内置模板改了文案/片尾时才打开一次，默认关，避免覆盖运营在后台的编辑。 */
    private final boolean reseed;

    public ClipOfficialTemplateSeeder(ClipTemplateRepository repo, ClipTemplateService service,
                                      @Value("${aep.clip.seed-official-templates:true}") boolean enabled,
                                      @Value("${aep.clip.reseed-official-templates:false}") boolean reseed) {
        this.repo = repo;
        this.service = service;
        this.enabled = enabled; this.reseed = reseed;
    }

    @Override public void run(ApplicationArguments args) {
        if (!enabled) return;
        // 文案与片尾由运营在 2026-08-13 定稿；21 段口播约 2:33 + 10 秒固定片尾 ≈ 2:43。
        // 出镜安排在第 1/7/13/21 段（开头、发起计划、行动号召、收尾），其余配画面 —— 
        // 出镜时长占比压在 10~20%，这是成本可控的前提（方案 §0）。
        seed("ct_shiti", "为实体发声", "实体商家", "advocacy",
                "纪实倡导片。走遍全国的实体店主群像，讲那些凌晨亮灯的坚持。", 163, 30, 62,
                variables("shopName", "巷口修鞋铺", "street", "学院路", "years", "十二年", "ownerName", "张姐"),
                List.of(
                        line(1,"百分之九十的实体店在边缘挣扎，但有的店却逆势生长。","avatar",null,null),
                        line(2,"我们走遍全国，发现那些活得好的老板：要么凌晨四点还在揉面，只为一口让人惦记的老味道；","broll","这里放：清晨备货或街景空镜",null),
                        line(3,"要么对着手机一遍遍练习，把冰冷的屏幕捂热成新的门店。","broll","这里放：店主对着手机练习",null),
                        line(4,"都说实体生意难做，这话不假。","broll",null,null),
                        line(5,"电商自媒体的洪流，卷走了太多熟悉的身影。","broll","这里放：冷清的街道或空店面",null),
                        line(6,"但绝处，总能逢生，这些滚烫的人生，这些城市的烟火气，不该沉默！","broll",null,null),
                        line(7,"我们团队发起百位实体创业者计划，想用镜头，把那些滚烫的人生，讲给世界听。","avatar",null,null),
                        line(8,"记录下平凡岗位上的不凡，每一家凌晨亮灯的小店背后，是咬牙的坚持；","broll","这里放：凌晨亮灯的小店",null),
                        line(9,"每一个轰鸣的车间里，藏着对品质的死磕；","broll","这里放：车间机器运转特写",null),
                        line(10,"每一个本土品牌的名字，都写满了从线下到线上的突围故事。","broll","这里放：本土品牌招牌",null),
                        line(11,"这些故事很小，汇聚起来，就是刺破寒冬的光。","broll","这里放：微光/灯火的空镜",null),
                        line(12,"这些故事就发生在你每天路过的街角，它们正在消失，像从未存在过。","broll","这里放：你每天路过的街角",null),
                        line(13,"但今天，你能让故事活下去，把那些滚烫的人生，讲给世界听。","avatar",null,null),
                        line(14,"当你按下录制键，奇迹正在发生：你拯救了王阿姨的豆腐摊，视频播放量换来了新顾客的长队，","broll","这里放：顾客排队或摊位忙碌",null),
                        line(15,"你点燃了张叔眼里的光，机械厂故事引来海外订单。","broll","这里放：车间或工人特写",null),
                        line(16,"加入为实体发声计划，不是要你当网红，而是邀请你成为城市故事的守护者，实体经济的点灯人，平凡生活的英雄。","broll",null,null),
                        line(17,"用你的声音，替沉默的实体发声，让每部手机，都成为照亮街角的火把，","broll","这里放：手机拍摄的画面",null),
                        line(18,"当十万支火把点燃，整座城市将不再有黑暗的角落。","broll","这里放：城市夜景灯火",null),
                        line(19,"别等到熟悉的店铺消失才后悔。","broll","这里放：卷闸门紧闭的店面",null),
                        line(20,"此刻，你指尖的温度，能融化冰封的招牌。","broll","这里放：招牌特写",null),
                        line(21,"这不是商业计划，而是一场人文运动，让技术有了心跳，让奋斗有了观众，让城市有了记忆！","avatar",null,null),
                        line(22,"结尾：为实体发声计划","tail",null,10)
                ));
        seed("ct_kaimen", "今天开门了", "本地生活", "daily",
                "1 分钟日更款。开门、备货、招呼客人，随手拍的素材就能出片。", 80, 12, 32,
                variables("shopName", "巷口修鞋铺", "street", "学院路", "ownerName", "张姐", "openTime", "早上七点"),
                List.of(
                        line(1,"早上七点，巷口修鞋铺今天开门了。","avatar",null,null),
                        line(2,"先扫门口，再把常用的锤子和针线摆顺手。","broll","这里放：开门和整理工具",null),
                        line(3,"第一位客人送来一双开胶的运动鞋，说下午要穿。","broll","这里放：接鞋和检查鞋底",null),
                        line(4,"清胶、上胶、压实，急活也不能少一道工序。","broll","这里放：修补过程的三个特写",null),
                        line(5,"中午前又来了两位老街坊，坐下就聊起这条街的变化。","broll","这里放：店内中景或顾客背影",null),
                        line(6,"小店的一天没有大事，都是把眼前的小事做好。","broll","这里放：柜台、工具和门外街景",null),
                        line(7,"路过学院路，鞋子有点小毛病，就来找我。","avatar",null,null),
                        line(8,"结尾：门店信息卡","tail",null,8)
                ));
        seed("ct_shouyi", "这门手艺", "手艺人", "craft",
                "讲你手上的活儿。特写镜头为主，出镜少、成本低。", 105, 16, 40,
                variables("shopName", "巷口修鞋铺", "street", "学院路", "years", "十二年", "ownerName", "张姐"),
                List.of(
                        line(1,"这把小锤子跟了我十二年，分量我闭着眼都认得。","avatar",null,null),
                        line(2,"修鞋先看磨损，不同的脚法，鞋底留下的痕迹也不同。","broll","这里放：翻看鞋底磨损",null),
                        line(3,"旧线要一针针拆，留下的针孔才能继续用。","broll","这里放：拆线的手部特写",null),
                        line(4,"皮子要顺着纹路裁，差一毫米，贴上去就不服帖。","broll","这里放：裁皮和比对边缘",null),
                        line(5,"最考功夫的是走线，手上要稳，心里不能急。","broll","这里放：穿针、拉线、收紧",null),
                        line(6,"机器能快一点，但最后的边角还得靠手感。","broll","这里放：机器与手工交替",null),
                        line(7,"修好的鞋不一定像新的，但一定还能陪主人走很远。","broll","这里放：修前修后对比",null),
                        line(8,"这门手艺不响亮，却能把舍不得丢的东西留下来。","broll","这里放：顾客接过鞋的瞬间",null),
                        line(9,"只要还有人需要，我就把这盏灯继续亮着。","avatar",null,null),
                        line(10,"结尾：手艺人群像","tail",null,14)
                ));
    }

    private void seed(String id, String name, String industry, String theme, String description,
                      int duration, int avatarSec, int credits, Map<String,String> vars,
                      List<Map<String,Object>> segments) {
        // 默认只做首次播种；内容定稿更新时用 aep.clip.reseed-official-templates=true 显式重刷一次。
        // 不做无条件覆盖：运营可能在后台改过这些模板，每次重启都推平是不可接受的。
        if (repo.existsById(id) && !reseed) return;
        Map<String,Object> skeleton = new LinkedHashMap<>();
        skeleton.put("variables", vars.entrySet().stream()
                .map(entry -> Map.<String,Object>of("key", entry.getKey(), "placeholder", entry.getValue()))
                .toList());
        skeleton.put("segments", segments);
        service.upsert(id, new UpsertTemplate(id, name, industry, theme, description, "published", "official",
                skeleton, Map.of("ratio", "9:16"), List.of(), List.of(), "9:16", duration, avatarSec, credits));
    }

    private static Map<String,String> variables(String... pairs) {
        Map<String,String> result = new LinkedHashMap<>();
        for (int i=0;i+1<pairs.length;i+=2) result.put(pairs[i], pairs[i+1]);
        return result;
    }

    private static Map<String,Object> line(int no, String text, String role, String hint, Integer durationSec) {
        Map<String,Object> row = new LinkedHashMap<>();
        row.put("no", no); row.put("text", text); row.put("role", role);
        if (hint != null) row.put("hint", hint);
        if (durationSec != null) { row.put("durationSec", durationSec); row.put("replaceable", true); }
        return row;
    }
}

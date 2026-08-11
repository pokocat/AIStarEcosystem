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

    public ClipOfficialTemplateSeeder(ClipTemplateRepository repo, ClipTemplateService service,
                                      @Value("${aep.clip.seed-official-templates:true}") boolean enabled) {
        this.repo = repo;
        this.service = service;
        this.enabled = enabled;
    }

    @Override public void run(ApplicationArguments args) {
        if (!enabled) return;
        seed("ct_shiti", "为实体发声", "实体商家", "advocacy",
                "纪实倡导片。暖光街景、褪色招牌，讲你守着这家店的这些年。", 162, 38, 68,
                variables("shopName", "巷口修鞋铺", "street", "学院路", "years", "十二年", "ownerName", "张姐"),
                List.of(
                        line(1,"大家好，我是巷口修鞋铺的张姐。","avatar",null,null),
                        line(2,"在学院路这条街上，我修了十二年鞋。","avatar",null,null),
                        line(3,"每天早上七点，卷闸门一拉开，这条街才算醒了。","broll","这里放：清早开门的门口",null),
                        line(4,"来的都是熟客，一双鞋修好，能再穿两年。","broll","这里放：你手上修鞋的特写",null),
                        line(5,"这些年店越来越少，招牌一块块褪了色。","broll","这里放：老招牌或街景空镜",null),
                        line(6,"隔壁的五金店去年关了，再隔壁的裁缝铺也搬走了。","broll","这里放：卷闸门紧闭的店面",null),
                        line(7,"有人问我，怎么不去做点别的。","broll","这里放：你在店里忙碌的中景",null),
                        line(8,"我说，这条街上还有人需要我把鞋修好。","broll","这里放：顾客取鞋的瞬间",null),
                        line(9,"我们没什么大本事，就是把手上的活儿做扎实。","avatar",null,null),
                        line(10,"一双鞋，一个招牌，一条街，都是这么撑下来的。","broll","这里放：街道全景",null),
                        line(11,"现在也有年轻人来学这门手艺了。","broll","这里放：学徒或工具特写",null),
                        line(12,"我把摊子摆在这儿，就是想让大家知道，实体店还在。","broll","这里放：门口全景",null),
                        line(13,"有需要的，随时来。","avatar",null,null),
                        line(14,"结尾：集体发声与团队愿景","tail",null,22)
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
        if (repo.existsById(id)) return;
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

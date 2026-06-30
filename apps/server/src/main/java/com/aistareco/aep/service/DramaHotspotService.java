package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 近期热点生成（运营手动触发）：抓抖音热搜实时热词 → LLM 蒸馏成短剧选题钩子（过滤新闻 / 敏感）。
 *
 * 轻量实现：无定时任务、不落库 —— 返回候选批次，由运营在「内容目录」页审核后写入 catalog hotTopics。
 * §8.0：热搜源抓取失败 / LLM 未配置 → 抛带 code 的错误，绝不编造；纯 LLM 不知「近期」，必须有真实来源。
 */
@Service
public class DramaHotspotService {

    private static final Logger log = LoggerFactory.getLogger(DramaHotspotService.class);

    /** 抖音公开热搜榜（免凭证）；运营可经 PlatformConfig key 覆盖换分类榜 / 官方接口。 */
    private static final String DEFAULT_SOURCE_URL =
            "https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/";
    private static final String SOURCE_URL_CONFIG_KEY = "drama.hotspot.source-url";

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    private final ObjectMapper om;
    private final AiModelInvocationService invocation;
    private final PromptService promptService;
    private final PlatformConfigService configs;

    public DramaHotspotService(ObjectMapper om, AiModelInvocationService invocation,
                               PromptService promptService, PlatformConfigService configs) {
        this.om = om;
        this.invocation = invocation;
        this.promptService = promptService;
        this.configs = configs;
    }

    /** 抓热搜 → 蒸馏 → 返回候选短剧选题钩子（最多 max 条，默认 12）。不落库。 */
    public List<String> generate(int max) {
        int cap = max > 0 ? Math.min(max, 30) : 12;
        if (!invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "热点蒸馏还没接入大模型：请在管理后台为「短剧脚本起草」用途绑定一个模型端点后再试。");
        }
        PromptService.ResolvedPrompt prompt = promptService.resolve(PromptService.KEY_DRAMA_HOTSPOT_DISTILL);
        if ("code".equals(prompt.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "近期热点蒸馏的提示词尚未配置（promptKey=" + PromptService.KEY_DRAMA_HOTSPOT_DISTILL + "）。");
        }

        List<String> words = fetchHotWords();
        if (words.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "HOTSPOT_SOURCE_EMPTY",
                    "热搜源没抓到内容，请稍后重试或更换来源。");
        }
        log.info("[drama-hotspot] fetched {} raw hot words", words.size());

        String userContent = PromptService.fill(prompt.userTemplate(), Map.of("topics", String.join("\n", words)));
        List<Map<String, String>> messages = new ArrayList<>();
        if (prompt.system() != null && !prompt.system().isBlank()) {
            messages.add(Map.of("role", "system", "content", prompt.system()));
        }
        messages.add(Map.of("role", "user", "content", userContent));
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("temperature", prompt.params().temperature() != null ? prompt.params().temperature() : 0.85);
        options.put("max_tokens", prompt.params().maxTokens() != null && prompt.params().maxTokens() > 0
                ? prompt.params().maxTokens() : 1024);
        options.put("response_format", Map.of("type", "json_object"));

        AiModelInvocationService.AiModelResponse resp;
        try {
            resp = invocation.invokeChat(AiModelPurpose.DRAMA_SCRIPT_DRAFT, messages, options);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED", "热点蒸馏调用失败，请稍后重试。");
        }

        List<String> out = parseHotspots(resp.content(), cap);
        if (out.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT",
                    "没能从热搜里蒸馏出合适的短剧选题，请重试或更换来源。");
        }
        log.info("[drama-hotspot] distilled {} drama topics", out.size());
        return out;
    }

    /** GET 抖音热搜 → 取 word_list[].word（兼容裹在 data 下的变体）。 */
    private List<String> fetchHotWords() {
        String url = configs.findByKey(SOURCE_URL_CONFIG_KEY)
                .map(c -> c.value() != null ? c.value().asText("") : "")
                .filter(s -> !s.isBlank())
                .orElse(DEFAULT_SOURCE_URL);
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .header("User-Agent",
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
                    .header("Accept", "application/json, text/plain, */*")
                    .GET()
                    .build();
            HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() / 100 != 2) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "HOTSPOT_FETCH_FAILED",
                        "热搜源返回 " + resp.statusCode() + "，请稍后重试或更换来源。");
            }
            JsonNode root = om.readTree(resp.body());
            JsonNode list = root.path("word_list");
            if (!list.isArray() || list.isEmpty()) list = root.path("data").path("word_list");
            Set<String> words = new LinkedHashSet<>();
            if (list.isArray()) {
                for (JsonNode it : list) {
                    String w = it.path("word").asText("").trim();
                    if (!w.isEmpty()) words.add(w);
                }
            }
            return new ArrayList<>(words);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[drama-hotspot] fetch failed url={} err={}", url, e.toString());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "HOTSPOT_FETCH_FAILED",
                    "抓取热搜源失败，请检查来源地址或稍后重试。");
        }
    }

    /** 解析 {"hotspots":[...]}（兼容直接数组），去空去重，截断到 cap。 */
    private List<String> parseHotspots(String content, int cap) {
        List<String> out = new ArrayList<>();
        JsonNode root = tryReadJson(content);
        if (root == null) return out;
        JsonNode arr = root.isArray() ? root : root.path("hotspots");
        if (!arr.isArray()) return out;
        Set<String> seen = new LinkedHashSet<>();
        for (JsonNode n : arr) {
            String s = n.asText("").trim();
            if (!s.isEmpty() && seen.add(s)) out.add(s);
            if (out.size() >= cap) break;
        }
        return out;
    }

    private JsonNode tryReadJson(String content) {
        if (content == null || content.isBlank()) return null;
        String s = content.trim();
        if (s.startsWith("```")) {
            int nl = s.indexOf('\n');
            if (nl >= 0) s = s.substring(nl + 1);
            if (s.endsWith("```")) s = s.substring(0, s.length() - 3);
            s = s.trim();
        }
        try {
            return om.readTree(s);
        } catch (Exception e) {
            int lb = s.indexOf('{'), la = s.indexOf('[');
            int start = (lb < 0) ? la : (la < 0 ? lb : Math.min(lb, la));
            int end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
            if (start >= 0 && end > start) {
                try {
                    return om.readTree(s.substring(start, end + 1));
                } catch (Exception ignore) {
                    return null;
                }
            }
            return null;
        }
    }
}

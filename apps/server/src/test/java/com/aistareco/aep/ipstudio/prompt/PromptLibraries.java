package com.aistareco.aep.ipstudio.prompt;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/** 测试用的提示词库：模拟后台发过新版本（当前版本是新的，按旧版本号还取得到仓库文件那一版）。 */
public final class PromptLibraries {
    private PromptLibraries() {}

    public static StudioPromptLibrary withNewVersions(StudioPromptEntry... newer) {
        Map<String, StudioPromptEntry> seeds = new LinkedHashMap<>();
        for (var s : StudioPromptLibrary.loadSeeds()) seeds.put(s.entry().key(), s.entry());
        Map<String, StudioPromptEntry> current = new LinkedHashMap<>(seeds);
        for (var e : newer) current.put(e.key(), e);
        return new StudioPromptLibrary(current) {
            @Override public Optional<StudioPromptEntry> version(String key, int version) {
                var now = find(key);
                if (now.isPresent() && now.get().version() == version) return now;
                return Optional.ofNullable(seeds.get(key)).filter(e -> e.version() == version);
            }
        };
    }

    /** 仓库里某个条目在末尾多一行、版本号加一（后台改过一版）。 */
    public static StudioPromptEntry revised(String key, String extraLine) {
        var seed = StudioPromptLibrary.loadSeeds().stream().filter(s -> s.entry().key().equals(key)).findFirst().orElseThrow().entry();
        Map<String, Object> header = new LinkedHashMap<>(seed.header());
        header.put("version", seed.version() + 1);
        return StudioPromptEntry.fromHeader(header, seed.body() + "\n" + extraLine, "test");
    }
}

package com.aistareco.aep.ipstudio.service;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

/** Only replaces model responses. Database, ownership, storage and tasks stay real. */
@Component
public class StudioFixtureProvider {
    private final boolean enabled;
    private final Path directory;
    private final Environment environment;
    private final ObjectMapper mapper;

    public StudioFixtureProvider(@Value("${aep.ipstudio.fixture-enabled:false}") boolean enabled,
                                 @Value("${aep.ipstudio.fixture-directory:../../.studio-fixtures}") String directory,
                                 Environment environment, ObjectMapper mapper) {
        this.enabled = enabled;
        this.directory = Path.of(directory).toAbsolutePath().normalize();
        this.environment = environment;
        this.mapper = mapper;
    }

    @PostConstruct
    public void validate() {
        if (!enabled) return;
        if (Arrays.stream(environment.getActiveProfiles()).anyMatch(p ->
                p.equalsIgnoreCase("prod") || p.equalsIgnoreCase("production") || p.equalsIgnoreCase("mysql"))) {
            throw new IllegalStateException("Studio fixtures are forbidden in production/mysql profiles");
        }
        if (!Files.isRegularFile(directory.resolve("manifest.json"))) {
            throw new IllegalStateException("Studio fixture manifest is missing: " + directory);
        }
        manifest();
    }

    public boolean enabled() { return enabled; }

    private JsonNode manifest() {
        if (!enabled) throw new IllegalStateException("Studio fixtures are disabled");
        try { return mapper.readTree(Files.readAllBytes(directory.resolve("manifest.json"))); }
        catch (Exception e) { throw unavailable("测试响应清单无法读取"); }
    }

    public byte[] image(String seed) {
        JsonNode images = manifest().path("images");
        if (!images.isArray() || images.isEmpty()) throw unavailable("测试图片未准备好");
        return read(images.get(Math.floorMod(seed.hashCode(), images.size())).asText());
    }

    public byte[] video() { return read(manifest().path("video").asText()); }
    public double videoDuration() { return manifest().path("videoDurationSec").asDouble(8); }
    public JsonNode script() {
        JsonNode script = manifest().path("script");
        if (!script.isObject() || script.path("episodes").isEmpty()) throw unavailable("测试剧本未准备好");
        return script.deepCopy();
    }

    private byte[] read(String name) {
        Path file = directory.resolve(name).normalize();
        if (name.isBlank() || !file.startsWith(directory) || !Files.isRegularFile(file)) {
            throw unavailable("测试媒体不存在");
        }
        try {
            if(!file.toRealPath().startsWith(directory.toRealPath())) throw unavailable("测试媒体超出素材目录");
            return Files.readAllBytes(file);
        }
        catch (Exception e) { throw unavailable("测试媒体无法读取"); }
    }

    private BusinessException unavailable(String message) {
        return new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "STUDIO_FIXTURE_UNAVAILABLE", message);
    }
}

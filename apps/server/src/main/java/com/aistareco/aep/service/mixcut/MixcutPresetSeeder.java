package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.repository.MixcutAssetRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;

/**
 * Mixcut 预置扰动贴图池 seed。
 *
 * 启动时按顺序：
 *  1) 扫 classpath:preset-stickers/*.gif（若有人放真贴图在 resources 里）→ 复制到 fs + 注册 DB
 *  2) 若 DB 中 preset 总数仍为 0，**用 ffmpeg lavfi 程序化生成 5 张 demo 动效贴图**，
 *     保证 dev 环境零依赖就能演示扰动贴图池的全链路
 *
 * 生产环境：把真 GIF 放到 `apps/server/src/main/resources/preset-stickers/<group>__<name>.gif`，
 * 或走 admin 后台 /api/admin/mixcut/preset-stickers 上传；本 seed 仅作 dev 兜底。
 *
 * 幂等：DB 已有同名 preset 不重复 insert。
 */
@Component
@Order(10) // 在 DataInitializer (@Order(1)) 之后
public class MixcutPresetSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MixcutPresetSeeder.class);

    /** 文件名约定：<group>__<name>.gif，如 sparkle__yellow-star.gif。 */
    private static final String NAME_SEPARATOR = "__";

    private final MixcutProperties props;
    private final MixcutAssetRepository repo;
    private final MixcutAssetService assetService;
    private final FfmpegRunner ffmpeg;

    public MixcutPresetSeeder(MixcutProperties props,
                              MixcutAssetRepository repo,
                              MixcutAssetService assetService,
                              FfmpegRunner ffmpeg) {
        this.props = props;
        this.repo = repo;
        this.assetService = assetService;
        this.ffmpeg = ffmpeg;
    }

    @Override
    public void run(String... args) {
        try {
            // 1) classpath:preset-stickers/*.gif → fs + DB
            int fromResources = seedFromResources();
            log.info("[mixcut] preset seed: classpath resources loaded={}", fromResources);

            // 2) DB 中 preset 为 0 → ffmpeg 程序化生成 5 张兜底
            long existing = repo.findByIsPresetTrueOrderByPresetGroupAscNameAsc().size();
            if (existing == 0) {
                int synth = synthesizeDemoStickers();
                log.info("[mixcut] preset seed: no presets in db → synthesized {} demo stickers", synth);
            } else {
                log.info("[mixcut] preset seed: {} preset stickers already in db, skip synth", existing);
            }
        } catch (Exception e) {
            log.warn("[mixcut] preset seed failed (continuing): {}", e.getMessage());
        }
    }

    // ── 路径 1：classpath ─────────────────────────────────────────────────────

    private int seedFromResources() {
        int count = 0;
        try {
            Resource[] resources = new PathMatchingResourcePatternResolver()
                    .getResources("classpath:preset-stickers/*.gif");
            for (Resource r : resources) {
                String filename = r.getFilename();
                if (filename == null) continue;
                String[] parts = parseGroupAndName(filename);
                if (parts == null) {
                    log.warn("[mixcut] preset seed: skip {} (need format <group>__<name>.gif)", filename);
                    continue;
                }
                String group = parts[0];
                String name = parts[1];
                if (repo.findFirstByIsPresetTrueAndPresetGroupAndNameOrderByUploadedAtAsc(group, name).isPresent()) {
                    continue; // 已 seed 过
                }
                File copied = copyResourceToPresetDir(r, group, filename);
                if (copied == null) continue;
                String publicUrl = props.getAssetPublicUrlBase() + "/preset/" + group + "/" + copied.getName();
                String previewUrl = generatePreview(copied, group);
                String id = "preset_" + group + "_" + safeName(name);
                assetService.registerPresetRow(id, "sticker", group, name, copied, publicUrl, previewUrl);
                count++;
            }
        } catch (IOException e) {
            log.warn("[mixcut] preset seed: classpath scan failed: {}", e.getMessage());
        }
        return count;
    }

    private File copyResourceToPresetDir(Resource r, String group, String filename) {
        File groupDir = new File(new File(props.getAssetDir(), "preset"), group);
        if (!groupDir.exists() && !groupDir.mkdirs()) {
            log.warn("[mixcut] preset seed: cannot create dir {}", groupDir);
            return null;
        }
        File target = new File(groupDir, filename);
        try (InputStream in = r.getInputStream()) {
            Files.copy(in, target.toPath(), StandardCopyOption.REPLACE_EXISTING);
            return target;
        } catch (IOException e) {
            log.warn("[mixcut] preset seed: failed to copy {} → {}: {}", filename, target, e.getMessage());
            return null;
        }
    }

    // ── 路径 2：ffmpeg 程序化合成 ──────────────────────────────────────────────

    private static final List<DemoSpec> DEMO_SPECS = List.of(
            // 飘动的黄色方块 (类似星星)
            new DemoSpec("sparkle", "yellow-star", 200, 200, 12,
                    "format=yuva420p,"
                            + "drawbox=x='mod(t*120\\,200)':y='mod(t*80\\,200)':w=24:h=24:color=#fff200@0.95:t=fill,"
                            + "drawbox=x='mod(t*120+100\\,200)':y='mod(t*80+60\\,200)':w=14:h=14:color=#fff200@0.7:t=fill"),
            // 飘动的粉色方块
            new DemoSpec("sparkle", "pink-burst", 200, 200, 12,
                    "format=yuva420p,"
                            + "drawbox=x='mod(t*90\\,200)':y='100-50*sin(t*3)':w=20:h=20:color=#ff66cc@0.9:t=fill,"
                            + "drawbox=x='200-mod(t*90\\,200)':y='100+50*sin(t*3)':w=20:h=20:color=#ff99dd@0.7:t=fill"),
            // 飘动的蓝色横条
            new DemoSpec("ribbon", "blue-stripe", 240, 60, 12,
                    "format=yuva420p,"
                            + "drawbox=x='mod(t*150-60\\,300)':y=20:w=60:h=20:color=#4f8eff@0.85:t=fill,"
                            + "drawbox=x='mod(t*150+30\\,300)':y=25:w=30:h=10:color=#82b1ff@0.7:t=fill"),
            // 紫色脉冲方块
            new DemoSpec("ribbon", "violet-pulse", 240, 60, 12,
                    "format=yuva420p,"
                            + "drawbox=x=10:y=15:w='30+20*sin(t*4)':h=30:color=#a78bfa@0.85:t=fill,"
                            + "drawbox=x=120:y=15:w='30+20*sin(t*4+1.5)':h=30:color=#c4b5fd@0.7:t=fill"),
            // 彩虹角标
            new DemoSpec("emoji_burst", "rainbow-corner", 160, 160, 12,
                    "format=yuva420p,"
                            + "drawbox=x='60+20*sin(t*5)':y='40+20*cos(t*5)':w=30:h=30:color=#ff3b30@0.9:t=fill,"
                            + "drawbox=x='90+20*sin(t*5+1)':y='70+20*cos(t*5+1)':w=30:h=30:color=#ffcc00@0.85:t=fill,"
                            + "drawbox=x='60+20*sin(t*5+2)':y='100+20*cos(t*5+2)':w=30:h=30:color=#34c759@0.8:t=fill")
    );

    /** width × height @ fps, 2s duration. vf = 滤镜链（不含 source filter）。 */
    private record DemoSpec(String group, String name, int width, int height, int fps, String vf) {}

    private int synthesizeDemoStickers() {
        int count = 0;
        for (DemoSpec spec : DEMO_SPECS) {
            try {
                if (repo.findFirstByIsPresetTrueAndPresetGroupAndNameOrderByUploadedAtAsc(spec.group, spec.name).isPresent()) {
                    continue;
                }
                File gif = synthesizeOne(spec);
                if (gif == null) continue;
                String publicUrl = props.getAssetPublicUrlBase() + "/preset/" + spec.group + "/" + gif.getName();
                String previewUrl = generatePreview(gif, spec.group);
                String id = "preset_" + spec.group + "_" + safeName(spec.name);
                assetService.registerPresetRow(id, "sticker", spec.group, spec.name, gif, publicUrl, previewUrl);
                count++;
            } catch (Exception e) {
                log.warn("[mixcut] preset synth failed group={} name={}: {}", spec.group, spec.name, e.getMessage());
            }
        }
        return count;
    }

    private File synthesizeOne(DemoSpec spec) throws IOException {
        File groupDir = new File(new File(props.getAssetDir(), "preset"), spec.group);
        if (!groupDir.exists() && !groupDir.mkdirs()) {
            throw new IOException("Cannot create dir " + groupDir);
        }
        File out = new File(groupDir, spec.name + ".gif");
        List<String> args = new ArrayList<>();
        args.add("-y");
        args.add("-hide_banner");
        args.add("-loglevel"); args.add("warning");
        // 透明 source（color=c=black@0.0 是 lavfi 的标准透明源；nullsrc 没 alpha 通道）
        args.add("-f"); args.add("lavfi");
        args.add("-i"); args.add("color=c=black@0.0:s=" + spec.width + "x" + spec.height + ":d=2:r=" + spec.fps);
        args.add("-vf"); args.add(spec.vf);
        args.add("-loop"); args.add("0");
        args.add(out.getAbsolutePath());
        try {
            ffmpeg.runFfmpeg(args);
        } catch (Exception e) {
            log.warn("[mixcut] ffmpeg synth failed for {}: {}", spec.name, e.getMessage());
            return null;
        }
        if (!out.exists() || out.length() == 0) return null;
        return out;
    }

    // ── 公共 helpers ──────────────────────────────────────────────────────────

    private String generatePreview(File gif, String group) {
        File preview = new File(gif.getParentFile(), gif.getName().replaceAll("\\.gif$", "") + "_preview.jpg");
        try {
            ffmpeg.runFfmpeg(List.of(
                    "-y",
                    "-i", gif.getAbsolutePath(),
                    "-frames:v", "1",
                    "-update", "1",
                    "-vf", "scale=160:-2",
                    "-q:v", "5",
                    preview.getAbsolutePath()
            ));
            if (preview.exists() && preview.length() > 0) {
                return props.getAssetPublicUrlBase() + "/preset/" + group + "/" + preview.getName();
            }
        } catch (Exception e) {
            log.warn("[mixcut] preview generation failed gif={}: {}", gif.getName(), e.getMessage());
        }
        return null;
    }

    /** "sparkle__yellow-star.gif" → ["sparkle", "yellow-star"]；不符合约定返回 null。 */
    static String[] parseGroupAndName(String filename) {
        int dot = filename.lastIndexOf('.');
        String base = dot > 0 ? filename.substring(0, dot) : filename;
        int sep = base.indexOf(NAME_SEPARATOR);
        if (sep <= 0 || sep + NAME_SEPARATOR.length() >= base.length()) return null;
        return new String[]{ base.substring(0, sep), base.substring(sep + NAME_SEPARATOR.length()) };
    }

    private static String safeName(String s) {
        return s == null ? "x" : s.replaceAll("[^a-zA-Z0-9_]", "_");
    }
}

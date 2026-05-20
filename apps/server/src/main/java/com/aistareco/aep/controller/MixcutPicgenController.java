package com.aistareco.aep.controller;

import com.aistareco.aep.config.PicgenProperties;
import com.aistareco.aep.service.picgen.PicgenClient;
import com.aistareco.common.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.security.Principal;
import java.util.UUID;

/**
 * v0.16+: mixcut 文字转图（pic-gen）预览端点。
 * <p>
 * 真正的批量生成在 {@code MixcutRenderingService} 内联调 {@link PicgenClient}，
 * 每变体一张图 + 不同 seed。这里只是给前端 "生成预览" 按钮一个一次性出图的口子。
 */
@RestController
@RequestMapping("/api/mixcut/picgen")
public class MixcutPicgenController {

    private static final Logger log = LoggerFactory.getLogger(MixcutPicgenController.class);

    private final PicgenClient picgen;
    private final PicgenProperties props;

    public MixcutPicgenController(PicgenClient picgen, PicgenProperties props) {
        this.picgen = picgen;
        this.props = props;
    }

    @PostMapping("/preview")
    public ApiResponse<PreviewResult> preview(@RequestBody PreviewRequest req, Principal principal) {
        if (req == null || req.title() == null || req.title().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title 不能为空");
        }
        int width = req.width() != null && req.width() > 0 ? Math.min(req.width(), 1920) : 1080;
        int height = req.height() != null && req.height() > 0 ? Math.min(req.height(), 1080) : 380;

        // 预览图不固定 seed，让用户多次点击得到不同效果（与"正式渲染每条不同"的语义一致）。
        long seed = System.nanoTime() ^ (principal != null ? principal.getName().hashCode() : 0);
        var params = new PicgenClient.PicgenParams(
                req.title(),
                blankToNull(req.subtitle()),
                blankToNull(req.tag()),
                width, height, seed,
                blankToNull(req.template()),
                blankToNull(req.scheme()),
                blankToNull(req.font())
        );

        byte[] png;
        try {
            png = picgen.renderPng(params);
        } catch (PicgenClient.PicgenException e) {
            log.warn("picgen preview 失败: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "pic-gen 服务调用失败: " + e.getMessage());
        }

        try {
            Path dir = Paths.get(props.getPreviewDir());
            Files.createDirectories(dir);
            String fileName = UUID.randomUUID().toString().replace("-", "") + ".png";
            Path file = dir.resolve(fileName);
            Files.write(file, png, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);

            String publicBase = props.getPreviewPublicUrlBase();
            if (publicBase.endsWith("/")) publicBase = publicBase.substring(0, publicBase.length() - 1);
            String url = publicBase + "/" + fileName;
            return ApiResponse.of(new PreviewResult(url));
        } catch (IOException ioe) {
            log.error("写 preview PNG 失败", ioe);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "preview 写盘失败");
        }
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    public record PreviewRequest(
            String title,
            String subtitle,
            String tag,
            Integer width,
            Integer height,
            String template,
            String scheme,
            String font
    ) {}

    public record PreviewResult(String preview_url) {}
}

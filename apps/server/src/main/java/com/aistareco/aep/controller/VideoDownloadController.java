package com.aistareco.aep.controller;

import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.service.DramaCanvasService;
import com.aistareco.aep.service.cdn.VideoDownloadLinks;
import com.aistareco.common.ApiResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
public class VideoDownloadController {
    public static final String REDEEM_PATH = "/api/media-download/resolve";
    private final IpProjectService projects;
    private final DramaCanvasService canvases;
    private final VideoDownloadLinks links;

    public VideoDownloadController(IpProjectService projects, DramaCanvasService canvases, VideoDownloadLinks links) {
        this.projects = projects;
        this.canvases = canvases;
        this.links = links;
    }

    @GetMapping("/api/v1/ip-studio/assets/video-download")
    public ResponseEntity<ApiResponse<VideoDownloadLinks.Grant>> studio(
            Principal principal, @RequestParam String key, @RequestParam String name) {
        return download(projects.requireOwnedAssetKey(principal.getName(), key), name);
    }

    @GetMapping("/api/me/drama/canvases/{id}/assets/video-download")
    public ResponseEntity<ApiResponse<VideoDownloadLinks.Grant>> drama(
            Principal principal, @PathVariable String id, @RequestParam String key, @RequestParam String name) {
        return download(canvases.requireDownloadAsset(principal.getName(), id, key), name);
    }

    @PostMapping(REDEEM_PATH)
    public ResponseEntity<ApiResponse<VideoDownloadLinks.Links>> redeem(@RequestBody VideoDownloadLinks.Grant grant) {
        return uncached(links.redeem(grant.ticket()));
    }

    private ResponseEntity<ApiResponse<VideoDownloadLinks.Grant>> download(String ownedKey, String name) {
        return uncached(links.issue(ownedKey, name));
    }

    private static <T> ResponseEntity<ApiResponse<T>> uncached(T data) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.of(data));
    }
}

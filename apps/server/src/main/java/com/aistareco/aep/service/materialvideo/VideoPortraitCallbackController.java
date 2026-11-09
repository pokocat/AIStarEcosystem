package com.aistareco.aep.service.materialvideo;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

/** Anonymous redirect callback, protected by a random capability and a server-side Ark result check. */
@RestController
public class VideoPortraitCallbackController {
    private final ArkPortraitLibrary portraits;
    public VideoPortraitCallbackController(ArkPortraitLibrary portraits){this.portraits=portraits;}
    @GetMapping("/api/v1/asset-library/callback")
    public ResponseEntity<Void> callback(@RequestParam String state){
        portraits.callback(state);
        // No caller-supplied redirect; strip all vendor callback credentials before reaching the browser UI.
        return ResponseEntity.status(HttpStatus.SEE_OTHER).cacheControl(CacheControl.noStore())
                .header("Referrer-Policy","no-referrer").location(java.net.URI.create("https://aistar.aibuzz.cn/assets/verification")).build();
    }
}

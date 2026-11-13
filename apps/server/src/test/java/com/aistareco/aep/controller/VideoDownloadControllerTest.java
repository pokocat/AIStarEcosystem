package com.aistareco.aep.controller;

import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.service.DramaCanvasService;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.cdn.VideoDownloadLinks;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class VideoDownloadControllerTest {
    private final IpProjectService studio = mock(IpProjectService.class);
    private final DramaCanvasService drama = mock(DramaCanvasService.class);
    private final CdnUrlSigner signer = mock(CdnUrlSigner.class);
    private final VideoDownloadLinks links = new VideoDownloadLinks(signer, "test-download-signing-secret");
    private final VideoDownloadController controller = new VideoDownloadController(studio, drama, links);

    @Test
    void authenticatedOwnerCanPassTheSameVideoToAnAnonymousBrowser() {
        String key = "material-videos/task/video.mp4";
        when(studio.requireOwnedAssetKey("owner", key)).thenReturn(key);
        when(signer.signKey(eq(key), longThat(ttl -> ttl > 0 && ttl <= 600))).thenReturn("https://oss.test/preview");
        when(signer.downloadUrlForKey(eq(key), eq("成片.mp4"), longThat(ttl -> ttl > 0 && ttl <= 600)))
                .thenReturn("https://oss.test/attachment");

        var grant = controller.studio(() -> "owner", key, "成片.mp4");
        var resolved = controller.redeem(grant.getBody().data());

        assertEquals("no-store", resolved.getHeaders().getCacheControl());
        assertEquals("https://oss.test/preview", resolved.getBody().data().previewUrl());
        assertEquals("https://oss.test/attachment", resolved.getBody().data().downloadUrl());
        assertEquals("成片.mp4", resolved.getBody().data().filename());
    }

    @Test
    void unownedAssetsAndModifiedTicketsCannotReachTheStorageSigner() {
        String key = "drama/render/private.mp4";
        when(drama.requireDownloadAsset("other", "canvas", key))
                .thenThrow(BusinessException.notFound("DRAMA_CANVAS_ASSET_NOT_FOUND", "视频已不可用"));
        assertThrows(BusinessException.class, () -> controller.drama(() -> "other", "canvas", key, "video"));

        String ticket = links.issue(key, "video").ticket();
        int signatureStart = ticket.lastIndexOf('.') + 1;
        String tampered = ticket.substring(0, signatureStart)
                + (ticket.charAt(signatureStart) == 'A' ? 'B' : 'A') + ticket.substring(signatureStart + 1);
        var error = assertThrows(BusinessException.class, () -> controller.redeem(new VideoDownloadLinks.Grant(tampered)));
        assertEquals(410, error.getStatus().value());
        verifyNoInteractions(signer);
    }
}

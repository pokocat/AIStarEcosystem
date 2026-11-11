package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

class StudioDepthVideoServiceTest {
    @TempDir Path directory;
    final FileStorageService storage=mock(FileStorageService.class);
    final IpProjectService projects=mock(IpProjectService.class);
    final FfmpegRunner ffmpeg=mock(FfmpegRunner.class);
    StudioDepthVideoService service;
    @BeforeEach void setup(){service=new StudioDepthVideoService(storage,projects,ffmpeg,new ObjectMapper(),"","",1000);}
    @Test void absentRuntimeCannotReturnFakeDepthOrStoreAnything() {
        assertFalse(service.configured());
        assertEquals("STUDIO_DEPTH_NOT_CONFIGURED",assertThrows(BusinessException.class,()->service.convert("u","v",()->true)).getCode());
        verifyNoInteractions(storage,ffmpeg,projects);
    }
    @Test void sourceIsDecodedAfterOwnershipAndDoesNotTrustClientMetadata() throws Exception {
        Path video=Files.write(directory.resolve("source.mp4"),new byte[]{1});
        when(projects.requireOwnedAssetKey("u","v")).thenReturn("owned");when(storage.openForRead("owned")).thenReturn(video);
        when(ffmpeg.runFfprobe(anyList())).thenReturn("{\"format\":{\"duration\":\"12.5\"},\"streams\":[{\"codec_type\":\"video\",\"width\":720,\"height\":1280}]}");
        var result=service.source("u","v");assertEquals(12.5,result.seconds());assertEquals(720,result.width());assertEquals("owned",result.key());
    }
    @Test void anotherOwnersReferenceIsNeverOpened() {
        when(projects.requireOwnedAssetKey("u","other")).thenThrow(BusinessException.badRequest("IP_ASSET_NOT_OWNED","不属于本人"));
        assertThrows(BusinessException.class,()->service.source("u","other"));verifyNoInteractions(storage,ffmpeg);
    }
    @Test void audioOnlyOrInvalidVideoCannotBeAccepted() throws Exception {
        Path audio=Files.write(directory.resolve("wrong.mp4"),new byte[]{1});
        when(projects.requireOwnedAssetKey("u","v")).thenReturn("v");when(storage.openForRead("v")).thenReturn(audio);
        when(ffmpeg.runFfprobe(anyList())).thenReturn("{\"format\":{\"duration\":\"12\"},\"streams\":[{\"codec_type\":\"audio\"}]}");
        assertEquals("STUDIO_CLONE_VIDEO_INVALID",assertThrows(BusinessException.class,()->service.source("u","v")).getCode());
    }

    @Test void pictureDurationWinsOverALongerAudioTrack() throws Exception {
        Path video=Files.write(directory.resolve("source.mp4"),new byte[]{1});
        when(projects.requireOwnedAssetKey("u","v")).thenReturn("v");when(storage.openForRead("v")).thenReturn(video);
        when(ffmpeg.runFfprobe(anyList())).thenReturn("{\"format\":{\"duration\":\"13.6\"},\"streams\":[{\"codec_type\":\"video\",\"width\":720,\"height\":1280,\"duration\":\"13.46\"},{\"codec_type\":\"audio\",\"duration\":\"13.6\"}]}");
        assertEquals(13.46,service.source("u","v").seconds(),1e-9);
    }
    private static com.fasterxml.jackson.databind.JsonNode clip(double[][]... frames) {
        var om=new ObjectMapper();var root=om.createObjectNode().put("format","reshot-pose/1").put("width",100).put("height",200);
        var list=root.putArray("frames");
        for(double[][] frame:frames) {
            var person=list.addObject().putArray("people").addObject();var kps=person.putArray("keypoints");var scores=person.putArray("scores");
            for(int i=0;i<134;i++){double[] p=i<frame.length?frame[i]:null;kps.addArray().add(p==null?0:p[0]).add(p==null?0:p[1]);scores.add(p==null?0:p[2]);}
        }
        return root;
    }
    private static double[][] body(boolean edge) {
        double[][] p=new double[18][];
        for(int j:new int[]{2,5,8,11,9,12})p[j]=new double[]{50,edge&&j!=2&&j!=5?199.5:100,0.9};
        p[2]=new double[]{42,60,0.9};p[5]=new double[]{58,60,0.9};
        return p;
    }
    /** 9862 车内近景：肩宽占画面近一半，髋膝是估计器猜出来的（都在画面里），也不能算全身。 */
    private static double[][] closeUp() {
        double[][] p=body(false);p[2]=new double[]{20,120,0.9};p[5]=new double[]{70,120,0.9};
        return p;
    }
    @Test void wholeBodiesChooseTheSkeletonCloseUpsDoNot() {
        // 俯拍躺着、跳舞：肩、髋、膝都在画面里 → 骨骼
        assertEquals(1.0,StudioDepthVideoService.bodyCoverage(clip(body(false),body(false))),1e-9);
        // 近景：髋和膝被估计器猜到画面底边（ReShot 说明里的已知情况）→ 不算，用深度
        assertEquals(0.0,StudioDepthVideoService.bodyCoverage(clip(body(true),body(true))),1e-9);
        // 一半帧看得到全身
        assertEquals(0.5,StudioDepthVideoService.bodyCoverage(clip(body(false),new double[0][])),1e-9);
        assertEquals(0.0,StudioDepthVideoService.bodyCoverage(clip(closeUp(),closeUp())),1e-9);
        assertEquals(0.0,StudioDepthVideoService.bodyCoverage(new ObjectMapper().createObjectNode()));
    }
    @Test void poseNeedsBothDetectorAndEstimatorWeights() throws Exception {
        Path dir=Files.createDirectories(directory.resolve("dwpose"));Files.write(dir.resolve("yolox_l.onnx"),new byte[]{1});
        var withOne=new StudioDepthVideoService(storage,projects,ffmpeg,new ObjectMapper(),"","",1000,dir.toString(),320,0.5);
        assertFalse(withOne.poseConfigured());
        Files.write(dir.resolve("dw-ll_ucoco_384.onnx"),new byte[]{1});
        assertTrue(withOne.poseConfigured());
        assertFalse(new StudioDepthVideoService(storage,projects,ffmpeg,new ObjectMapper(),"","",1000,"relative/dwpose",320,0.5).poseConfigured());
    }
}

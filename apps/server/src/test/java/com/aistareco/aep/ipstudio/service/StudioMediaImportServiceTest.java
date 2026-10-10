package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.aep.ipstudio.controller.StudioMediaImportController;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockMultipartFile;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
class StudioMediaImportServiceTest {
    FileStorageService storage; StorageQuotaService quota; FfmpegRunner ffmpeg; StudioMediaImportService service;
    @BeforeEach void setup() {
        storage=mock(FileStorageService.class); quota=mock(StorageQuotaService.class); ffmpeg=mock(FfmpegRunner.class);
        when(storage.store(any(),anyString(),anyString(),anyString(),anyString())).thenAnswer(i -> new FileStorageService.StoredFile("ipstudio_source/u/1."+i.getArgument(3),null,null,null, ((byte[])i.getArgument(0)).length,i.getArgument(4)));
        when(storage.signedUrl(anyString())).thenReturn("https://cdn.test/short-signed");
        service=new StudioMediaImportService(storage,quota,ffmpeg);
    }
    byte[] mp4() { return new byte[]{0,0,0,20,'f','t','y','p','i','s','o','m',0,0,0,0}; }
    MockMultipartFile file(byte[] bytes) { return new MockMultipartFile("file","../假的名字.png","image/png",bytes); }
    FfmpegRunner.MediaProbe probe(double d,String v,String a) {return new FfmpegRunner.MediaProbe(d,"mp4",v,a,640,360,44100,2,true);}
    @Test void checksActualImageAndWritesOwnAiavatarQuota() throws Exception {
        var bytes=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(20,12,BufferedImage.TYPE_INT_RGB),"png",bytes);
        var result=service.upload("u",file(bytes.toByteArray()),"image");
        assertEquals("image/png",result.mimeType());assertEquals(20,result.width());assertEquals("假的名字.png",result.fileName());
        var order=inOrder(quota,storage);order.verify(quota).checkQuota("aiavatar","u",bytes.size());
        order.verify(storage).store(any(),eq("ipstudio/source"),eq("u"),eq("png"),eq("image/png"));
        order.verify(quota).record(eq("aiavatar"),eq("u"),eq("画布附件"),isNull(),eq(result.key()),eq((long)bytes.size()));
    }
    @Test void declaredImageContainingVideoIsRejectedWithoutStoring() {
        assertThrows(BusinessException.class,()->service.upload("u",file(mp4()),"image"));verifyNoInteractions(storage,quota,ffmpeg);
    }
    @Test void videoRequiresReadableStreamsDurationAndBrowserCodecAndDeletesTempFiles() {
        var paths=new java.util.ArrayList<File>();
        when(ffmpeg.probeMedia(any())).thenAnswer(i->{File f=i.getArgument(0);assertTrue(f.exists());paths.add(f);return probe(61,"h264","aac");});
        assertThrows(BusinessException.class,()->service.upload("u",file(mp4()),"video"));
        doReturn(probe(4,"hevc","aac")).when(ffmpeg).probeMedia(any());
        assertThrows(BusinessException.class,()->service.upload("u",file(mp4()),"video"));
        doReturn(probe(4,"h264","aac")).when(ffmpeg).probeMedia(any());
        var result=service.upload("u",file(mp4()),"video");assertEquals("video/mp4",result.mimeType());assertEquals(4,result.durationSec());
        paths.forEach(f->assertFalse(f.exists()));verify(storage,times(1)).store(any(),anyString(),anyString(),eq("mp4"),eq("video/mp4"));
    }
    @Test void audioRejectsVideoDisguisedAsM4aAndAcceptsPureAudio() {
        when(ffmpeg.probeMedia(any())).thenReturn(probe(5,"h264","aac"));
        assertThrows(BusinessException.class,()->service.upload("u",file(mp4()),"audio"));verifyNoInteractions(storage,quota);
        when(ffmpeg.probeMedia(any())).thenReturn(probe(5,null,"aac"));
        var result=service.upload("u",file(mp4()),"audio");assertEquals("audio/mp4",result.mimeType());assertEquals("audio",result.mediaType());
    }
    @Test void quotaFailureNeverStoresMedia() {
        when(ffmpeg.probeMedia(any())).thenReturn(probe(5,"h264","aac"));
        doThrow(BusinessException.badRequest("STORAGE_QUOTA_EXCEEDED","配额不足")).when(quota).checkQuota(anyString(),anyString(),anyLong());
        assertThrows(BusinessException.class,()->service.upload("u",file(mp4()),"video"));verifyNoInteractions(storage);
    }
    @Test void rejectsForeignProjectBeforeReadingOrWritingFile() {
        var projects=mock(IpProjectService.class);var imports=mock(StudioMediaImportService.class);
        when(projects.required("u","foreign")).thenThrow(BusinessException.badRequest("IP_PROJECT_NOT_FOUND","不存在"));
        var controller=new StudioMediaImportController(projects,imports);
        assertThrows(BusinessException.class,()->controller.upload(()->"u","foreign",file(mp4()),"video"));verifyNoInteractions(imports);
    }
}

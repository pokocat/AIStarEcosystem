package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
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
    FileStorageService storage; FfmpegRunner ffmpeg; StudioMediaImportService service;
    com.aistareco.aep.ipstudio.history.StudioStorageGuard guard;
    @BeforeEach void setup() throws IOException {
        storage=mock(FileStorageService.class); ffmpeg=mock(FfmpegRunner.class);
        when(storage.store(any(),anyString(),anyString(),anyString(),anyString())).thenAnswer(i -> new FileStorageService.StoredFile("ipstudio_source/u/1."+i.getArgument(3),null,null,null, ((byte[])i.getArgument(0)).length,i.getArgument(4)));
        when(storage.signedUrl(anyString())).thenReturn("https://cdn.test/short-signed");
        when(storage.storePath(any(),anyString(),anyString(),anyString(),anyString())).thenAnswer(i ->
            new FileStorageService.StoredFile("ipstudio_source/u/1.mp4",null,null,null,
                    java.nio.file.Files.size(i.getArgument(0)), "video/mp4"));
        service=new StudioMediaImportService(storage,ffmpeg);
        guard=mock(com.aistareco.aep.ipstudio.history.StudioStorageGuard.class); service.setStorageGuard(guard);
    }
    byte[] mp4() { return new byte[]{0,0,0,20,'f','t','y','p','i','s','o','m',0,0,0,0}; }
    MockMultipartFile file(byte[] bytes) { return new MockMultipartFile("file","../假的名字.png","image/png",bytes); }
    StudioMediaImportService.UploadResponse upload(MockMultipartFile file,String type) { return service.accept("u",file,type,null,false,null); }
    FfmpegRunner.MediaProbe probe(double d,String v,String a) {return new FfmpegRunner.MediaProbe(d,"mp4",v,a,640,360,44100,2,true);}
    @Test void checksActualImageAndWritesOwnAiavatarQuota() throws Exception {
        var bytes=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(20,12,BufferedImage.TYPE_INT_RGB),"png",bytes);
        var result=upload(file(bytes.toByteArray()),"image");
        assertEquals("image/png",result.mimeType());assertEquals(20,result.width());assertEquals("假的名字.png",result.fileName());
        var order=inOrder(guard,storage);order.verify(guard,atLeastOnce()).checkUpload("u",(long)bytes.size());
        order.verify(storage).store(any(),eq("ipstudio/source"),eq("u"),eq("png"),eq("image/png"));
    }
    @Test void declaredImageContainingVideoIsRejectedWithoutStoring() {
        assertThrows(BusinessException.class,()->upload(file(mp4()),"image"));verifyNoInteractions(storage,ffmpeg);
    }
    @Test void videoAcceptsLongReadableStreamsAndDeletesTempFiles() throws IOException {
        var paths=new java.util.ArrayList<File>();
        when(ffmpeg.probeMedia(any())).thenAnswer(i->{File f=i.getArgument(0);assertTrue(f.exists());paths.add(f);return probe(61,"h264","aac");});
        var result=upload(file(mp4()),"video");assertEquals("video/mp4",result.mimeType());assertEquals(61,result.durationSec());
        paths.forEach(f->assertFalse(f.exists()));verify(storage).storePath(any(),anyString(),anyString(),eq("mp4"),eq("video/mp4"));
    }
    @Test void convertsUnsupportedCodecsAndStoresOnlyVerifiedCompatibleBytes() throws Exception {
        var paths=new java.util.ArrayList<java.nio.file.Path>();
        when(ffmpeg.probeMedia(any())).thenReturn(probe(4,"hevc","mp3"),probe(4,"h264","aac"));
        when(ffmpeg.runFfmpeg(anyList(),eq(150_000L))).thenAnswer(i->{
            java.util.List<String> args=i.getArgument(0);assertTrue(args.contains("libx264"));
            var output=java.nio.file.Path.of(args.get(args.size()-1));paths.add(output);
            java.nio.file.Files.write(output,new byte[]{1,2,3,4,5});return "";
        });
        var result=upload(file(mp4()),"video");assertEquals(5,result.bytes());assertEquals("video/mp4",result.mimeType());
        verify(storage).storePath(eq(paths.get(0)),anyString(),eq("u"),eq("mp4"),eq("video/mp4"));
        paths.forEach(p->assertFalse(java.nio.file.Files.exists(p)));
    }
    @Test void audioOnlyIncompatibilityCopiesVideoAndConversionFailureNeverStores() {
        when(ffmpeg.probeMedia(any())).thenReturn(probe(4,"h264","mp3"));
        when(ffmpeg.runFfmpeg(anyList(),eq(150_000L))).thenAnswer(i->{
            java.util.List<String> args=i.getArgument(0);assertTrue(args.contains("copy"));assertFalse(args.contains("libx264"));
            throw new RuntimeException("encoder failed");
        });
        var error=assertThrows(BusinessException.class,()->upload(file(mp4()),"video"));
        assertEquals("STUDIO_VIDEO_TRANSCODE_FAILED",error.getCode());verifyNoInteractions(storage);
    }
    @Test void audioRejectsVideoDisguisedAsM4aAndAcceptsPureAudio() {
        when(ffmpeg.probeMedia(any())).thenReturn(probe(5,"h264","aac"));
        assertThrows(BusinessException.class,()->upload(file(mp4()),"audio"));verifyNoInteractions(storage);
        when(ffmpeg.probeMedia(any())).thenReturn(probe(601,null,"aac"));
        var result=upload(file(mp4()),"audio");assertEquals("audio/mp4",result.mimeType());assertEquals("audio",result.mediaType());assertEquals(601,result.durationSec());
    }
    @Test void quotaFailureNeverStoresMedia() {
        when(ffmpeg.probeMedia(any())).thenReturn(probe(5,"h264","aac"));
        doThrow(BusinessException.badRequest("STORAGE_QUOTA_EXCEEDED","配额不足")).when(guard).checkUpload(anyString(),anyLong());
        assertThrows(BusinessException.class,()->upload(file(mp4()),"video"));verifyNoInteractions(storage);
    }
    @Test void rejectsForeignProjectBeforeReadingOrWritingFile() {
        var projects=mock(IpProjectService.class);var imports=mock(StudioMediaImportService.class);
        when(projects.required("u","foreign")).thenThrow(BusinessException.badRequest("IP_PROJECT_NOT_FOUND","不存在"));
        var controller=new StudioMediaImportController(projects,imports,mock(StudioMediaJobs.class));
        assertThrows(BusinessException.class,()->controller.upload(()->"u","foreign",file(mp4()),"video",true));verifyNoInteractions(imports);
    }
}

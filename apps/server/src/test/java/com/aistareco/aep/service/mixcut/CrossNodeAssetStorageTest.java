package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.config.*;
import com.aistareco.aep.model.MixcutAsset;
import com.aistareco.aep.repository.MixcutAssetRepository;
import com.aistareco.aep.service.cdn.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.controller.MixcutAssetFileController;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.nio.file.*;
import java.util.*;
import java.io.*;
import java.time.Instant;
import java.util.concurrent.*;
import com.sun.net.httpserver.HttpServer;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CrossNodeAssetStorageTest {
    @TempDir Path root;
    HttpServer server;Map<String,byte[]> objects=new ConcurrentHashMap<>();CdnUploader cdn;CdnUrlSigner signer;MixcutAssetRepository repo;
    @BeforeEach void start()throws Exception {
        server=HttpServer.create(new java.net.InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/",e->{byte[] data=objects.get(e.getRequestURI().getPath().substring(1));if(data==null){e.sendResponseHeaders(404,-1);e.close();return;}e.sendResponseHeaders(200,data.length);e.getResponseBody().write(data);e.close();});server.start();
        cdn=mock(CdnUploader.class);when(cdn.driverName()).thenReturn("oss");
        when(cdn.upload(any(),anyString(),anyString())).thenAnswer(i->{byte[] b=Files.readAllBytes(i.getArgument(0));String k=i.getArgument(1);objects.put(k,b);return new CdnUploader.CdnUploadResult(url(k),k,b.length,Instant.now());});
        signer=mock(CdnUrlSigner.class);when(signer.signKey(anyString())).thenAnswer(i->url(i.getArgument(0)));when(signer.maybeSign(any())).thenAnswer(i->i.getArgument(0));
        repo=mock(MixcutAssetRepository.class);when(repo.save(any())).thenAnswer(i->i.getArgument(0));
    }
    @AfterEach void stop(){server.stop(0);}
    String url(String key){return "http://127.0.0.1:"+server.getAddress().getPort()+"/"+key;}
    MixcutProperties mix(Path dir){var p=new MixcutProperties();p.setAssetDir(dir.toString());return p;}
    FileStorageService storage(Path dir,boolean durable){var p=new FileStorageProperties();p.setLocalDir(dir.toString());p.setRequireDurableUploads(durable);return new FileStorageService(p,cdn,signer);}
    MockMultipartFile input(){return new MockMultipartFile("file","a.png","image/png","synthetic image bytes".getBytes());}

    @Test void uploadOnAIsReadableOnBWithoutALocalCopy()throws Exception {
        var a=new MixcutAssetService(mix(root.resolve("a-assets")),repo,mock(FfmpegRunner.class),storage(root.resolve("a-cache"),true));
        MixcutAsset asset=a.upload(input(),"image","alice","image",null);assertNotNull(asset.getCdnKey());
        when(repo.findById(asset.getId())).thenReturn(Optional.of(asset));Files.delete(Path.of(asset.getLocalPath()));
        var b=new MixcutAssetService(mix(root.resolve("b-assets")),repo,mock(FfmpegRunner.class),storage(root.resolve("b-cache"),true));
        assertTrue(b.getVisibleTo(asset.getId(),"bob").isEmpty());
        var visible=b.getVisibleTo(asset.getId(),"alice").orElseThrow();File f=b.localFileForAuthorizedAsset(visible);
        assertArrayEquals(input().getBytes(),Files.readAllBytes(f.toPath()));assertTrue(f.toPath().startsWith(root.resolve("b-cache")));
    }
    @Test void failedDurableUploadNeverAcknowledgesADatabaseAsset()throws Exception {
        doThrow(new IOException("private upstream diagnostic")).when(cdn).upload(any(),anyString(),anyString());
        var a=new MixcutAssetService(mix(root.resolve("a")),repo,mock(FfmpegRunner.class),storage(root.resolve("cache"),true));
        var failure=assertThrows(IllegalStateException.class,()->a.upload(input(),"image","alice","image",null));
        assertFalse(failure.getMessage().contains("private upstream"));verify(repo,never()).save(any());
    }
    @Test void oldSingleNodeModeKeepsItsLocalFallback()throws Exception {
        doThrow(new IOException("synthetic failure")).when(cdn).upload(any(),anyString(),anyString());
        var a=new MixcutAssetService(mix(root.resolve("a")),repo,mock(FfmpegRunner.class),storage(root.resolve("cache"),false));
        var asset=a.upload(input(),"image","alice","image",null);assertNull(asset.getCdnKey());assertTrue(Files.isRegularFile(Path.of(asset.getLocalPath())));
    }
    @Test void presetAndOfficialUploadsAlsoBecomeDurable()throws Exception {
        var a=new MixcutAssetService(mix(root.resolve("a")),repo,mock(FfmpegRunner.class),storage(root.resolve("cache"),true));
        var preset=a.uploadPreset(input(),"image","stars","test",null);
        assertNotNull(preset.getCdnKey());
        // Platform originals must follow the same durable path, rather than silently staying on one ECS.
        var official=a.uploadOfficial(input(),"image","dance","test",null,null);assertNotNull(official.getCdnKey());
    }
    @Test void legacyFileUrlCanUseTheSharedCopyAndStillSupportsRanges()throws Exception {
        var p=mix(root.resolve("empty-node"));var b=new MixcutAssetService(p,repo,mock(FfmpegRunner.class),storage(root.resolve("b-cache"),true));
        var asset=new MixcutAsset();asset.setId("asset");asset.setUserId("alice");asset.setFileUrl("/static/mixcut-assets/alice/video.mp4");asset.setCdnKey("owned-key");asset.setMimeType("video/mp4");asset.setLocalPath(root.resolve("secret").toString());Files.writeString(root.resolve("secret"),"must not be exposed");objects.put("owned-key","0123456789".getBytes());
        when(repo.findFirstByFileUrl(asset.getFileUrl())).thenReturn(Optional.of(asset));
        var mvc=MockMvcBuilders.standaloneSetup(new MixcutAssetFileController(p,repo,b)).build();
        mvc.perform(get(asset.getFileUrl()).header("Range","bytes=2-5")).andExpect(status().isPartialContent()).andExpect(content().bytes("2345".getBytes())).andExpect(header().string("Content-Range","bytes 2-5/10"));
        mvc.perform(get("/static/mixcut-assets/../secret")).andExpect(status().isNotFound());
    }
}

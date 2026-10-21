package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * §6.2: a first frame of another shape is cropped around its centre to the clip's 画幅, never stretched. Production
 * 2026-10-21 IPP-655ea55a: a 1024×1024 first frame came back from a 9:16 request stretched to 768×1344.
 */
class StudioFrameCropTest {
    @TempDir Path dir;

    static byte[] picture(int w,int h,String format) throws Exception {
        var image=new BufferedImage(w,h,BufferedImage.TYPE_INT_RGB);
        var g=image.getGraphics();
        g.setColor(Color.BLUE);g.fillRect(0,0,w,h);
        // A red stripe through the middle column: a centred crop keeps it, a stretch would only make it taller.
        g.setColor(Color.RED);g.fillRect(w/2-2,0,4,h);
        var out=new ByteArrayOutputStream();ImageIO.write(image,format,out);return out.toByteArray();
    }

    @Test void aSquareFrameFor916KeepsTheFullHeightAndTheCentreColumns() throws Exception {
        assertTrue(StudioFrameCrop.needsCrop(1024,1024,"9:16"));
        assertArrayEquals(new int[]{224,0,576,1024},StudioFrameCrop.window(1024,1024,"9:16"));
        var cropped=StudioFrameCrop.crop(picture(1024,1024,"png"),"9:16");
        assertEquals(576,cropped.width());assertEquals(1024,cropped.height());
        assertEquals(9.0/16,(double)cropped.width()/cropped.height(),0.01,"the result has the requested shape");
        var image=ImageIO.read(new ByteArrayInputStream(cropped.bytes()));
        assertEquals(576,image.getWidth());assertEquals(1024,image.getHeight());
        var centre=new Color(image.getRGB(288,512));
        assertTrue(centre.getRed()>200&&centre.getBlue()<60,"the centre stays the centre (JPEG, so near red): "+centre);
        var edge=new Color(image.getRGB(4,512));
        assertTrue(edge.getBlue()>200&&edge.getRed()<60,"the sides are the frame's own, not stretched: "+edge);
        assertEquals("jpg",cropped.ext(),"an opaque picture is written as JPEG");
    }

    @Test void aLandscapeFrameFor916IsCutDownToItsMiddle() throws Exception {
        assertTrue(StudioFrameCrop.needsCrop(1920,1080,"9:16"));
        int[] window=StudioFrameCrop.window(1920,1080,"9:16");
        assertEquals(1080,window[3]);assertEquals(608,window[2]);assertEquals((1920-608)/2,window[0]);
        var cropped=StudioFrameCrop.crop(picture(1920,1080,"jpg"),"9:16");
        assertEquals(9.0/16,(double)cropped.width()/cropped.height(),0.01);
        // A portrait frame for 16:9 keeps the full width and its middle rows.
        assertArrayEquals(new int[]{0,(1344-432)/2,768,432},StudioFrameCrop.window(768,1344,"16:9"));
    }

    @Test void aFrameOfTheRequestedShapeIsLeftAlone() {
        assertFalse(StudioFrameCrop.needsCrop(768,1344,"9:16"),"768×1344 is 9:16 within 2%");
        assertFalse(StudioFrameCrop.needsCrop(1080,1920,"9:16"));
        assertFalse(StudioFrameCrop.needsCrop(1024,1024,"1:1"));
        assertFalse(StudioFrameCrop.needsCrop(1024,1024,null),"no 画幅 named: nothing to crop to");
        assertTrue(StudioFrameCrop.needsCrop(1000,1050,"1:1"),"5% off is another shape");
    }

    StudioVideoService service(IpProjectService projects,FileStorageService storage) {
        return new StudioVideoService(mock(AiAppSceneModelPolicyService.class),mock(VideoStudioService.class),projects,storage,mock(FfmpegRunner.class));
    }

    @Test void theCropIsStoredAsTheOwnersOwnPictureAndRecorded() throws Exception {
        var projects=mock(IpProjectService.class);var storage=mock(FileStorageService.class);
        Path square=dir.resolve("square.png");Files.write(square,picture(1024,1024,"png"));
        when(projects.requireOwnedAssetKey("u","ipstudio_gen/u/frame.png")).thenReturn("ipstudio_gen/u/frame.png");
        when(storage.openForRead("ipstudio_gen/u/frame.png")).thenReturn(square);
        when(storage.store(any(byte[].class),eq(IpProjectService.CATEGORY_GEN),eq("u"),anyString(),anyString()))
                .thenReturn(new FileStorageService.StoredFile("ipstudio_gen/u/cropped.jpg",null,null,null,10,"image/jpeg"));
        var aligned=service(projects,storage).alignFrame("u","ipstudio_gen/u/frame.png","9:16");
        assertEquals("ipstudio_gen/u/cropped.jpg",aligned.key(),"the provider gets the cropped picture");
        assertEquals("1:1",aligned.adjusted().path("from").asText());
        assertEquals("9:16",aligned.adjusted().path("to").asText());
        assertEquals("crop",aligned.adjusted().path("mode").asText());
        assertEquals("576x1024",aligned.adjusted().path("croppedSize").asText());
        verify(storage).store(argThat(bytes->{try{var i=ImageIO.read(new ByteArrayInputStream(bytes));return i.getWidth()==576&&i.getHeight()==1024;}catch(Exception e){return false;}}),
                eq(IpProjectService.CATEGORY_GEN),eq("u"),anyString(),anyString());
    }

    @Test void aFrameOfTheRightShapeGoesAsItIsAndSomeoneElsesIsNeverRead() throws Exception {
        var projects=mock(IpProjectService.class);var storage=mock(FileStorageService.class);
        Path tall=dir.resolve("tall.png");Files.write(tall,picture(768,1344,"png"));
        when(projects.requireOwnedAssetKey("u","ipstudio_gen/u/tall.png")).thenReturn("ipstudio_gen/u/tall.png");
        when(storage.openForRead("ipstudio_gen/u/tall.png")).thenReturn(tall);
        var aligned=service(projects,storage).alignFrame("u","ipstudio_gen/u/tall.png","9:16");
        assertEquals("ipstudio_gen/u/tall.png",aligned.key());assertNull(aligned.adjusted());
        verify(storage,never()).store(any(byte[].class),anyString(),anyString(),anyString(),anyString());
        when(projects.requireOwnedAssetKey("u","ipstudio_gen/other/x.png")).thenThrow(BusinessException.badRequest("IP_ASSET_KEY_INVALID","x"));
        assertEquals("IP_ASSET_KEY_INVALID",assertThrows(BusinessException.class,()->service(projects,storage).alignFrame("u","ipstudio_gen/other/x.png","9:16")).getCode());
        verify(storage,never()).openForRead("ipstudio_gen/other/x.png");
    }

    @Test void aFrameThatCannotBeReadIsAClearErrorNotAStretch() throws Exception {
        var projects=mock(IpProjectService.class);var storage=mock(FileStorageService.class);
        Path broken=dir.resolve("broken.png");Files.write(broken,new byte[]{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17});
        when(projects.requireOwnedAssetKey(eq("u"),anyString())).thenAnswer(i->i.getArgument(1));
        when(storage.openForRead(anyString())).thenReturn(broken);
        var ffmpeg=mock(FfmpegRunner.class);
        when(ffmpeg.runFfmpeg(anyList(),anyLong())).thenThrow(new RuntimeException("ffmpeg: invalid data"));
        var video=new StudioVideoService(mock(AiAppSceneModelPolicyService.class),mock(VideoStudioService.class),projects,storage,ffmpeg);
        assertEquals("STUDIO_VIDEO_FRAME_CROP_FAILED",assertThrows(BusinessException.class,()->video.alignFrame("u","ipstudio_gen/u/broken.png","9:16")).getCode());
    }
}

package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioMediaLimit;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceRules;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class StudioVideoMediaTest {
 @TempDir Path dir;
 @Test void ownershipIsCheckedBeforeReadingAndMediaCannotMasqueradeAsAnotherType() throws Exception {
  var projects=mock(IpProjectService.class);var storage=mock(FileStorageService.class);
  var service=new StudioVideoService(mock(com.aistareco.aep.service.AiAppSceneModelPolicyService.class),mock(VideoStudioService.class),projects,storage,mock(FfmpegRunner.class));
  var frame=VideoStudioService.contract(5,15).modes().get(1);
  var reference=VideoStudioService.contract(5,15).modes().get(3);
  when(projects.requireOwnedAssetKey("u","foreign")).thenThrow(BusinessException.badRequest("IP_ASSET_KEY_INVALID","foreign"));
  assertThrows(BusinessException.class,()->service.requireMedia("u","image","foreign",true,frame));verifyNoInteractions(storage);
  var image=dir.resolve("image.png");Files.write(image,new byte[]{(byte)137,80,78,71,13,10,26,10,0,0,0,0});
  when(storage.openForRead("image")).thenReturn(image);
  assertDoesNotThrow(()->service.requireMedia("u","image","image",true,frame));
  assertThrows(BusinessException.class,()->service.requireMedia("u","video","image",false,reference));
 }
 @Test void frameAndUniversalReferenceHaveDifferentImageLimits() throws Exception {
  var projects=mock(IpProjectService.class);var storage=mock(FileStorageService.class);
  var service=new StudioVideoService(mock(com.aistareco.aep.service.AiAppSceneModelPolicyService.class),mock(VideoStudioService.class),projects,storage,mock(FfmpegRunner.class));
  var frame=VideoStudioService.contract(5,15).modes().get(1);
  var reference=VideoStudioService.contract(5,15).modes().get(3);
  var image=dir.resolve("large.png");Files.write(image,new byte[]{(byte)137,80,78,71,13,10,26,10,0,0,0,0});
  try(var file=new java.io.RandomAccessFile(image.toFile(),"rw")){file.setLength(17*1024*1024);}
  when(storage.openForRead("large")).thenReturn(image);
  assertThrows(BusinessException.class,()->service.requireMedia("u","image","large",true,frame));
  assertDoesNotThrow(()->service.requireMedia("u","image","large",false,reference));
 }
 @Test void referenceVideoDurationUsesTheSelectedModelRule() throws Exception {
  var projects=mock(IpProjectService.class);var storage=mock(FileStorageService.class);var ffmpeg=mock(FfmpegRunner.class);
  var service=new StudioVideoService(mock(com.aistareco.aep.service.AiAppSceneModelPolicyService.class),mock(VideoStudioService.class),projects,storage,ffmpeg);
  var defaultMode=VideoStudioService.contract(5,15).modes().get(3);
  var original=defaultMode.references();
  var videoRule=new VideoStudioMediaLimit("video",original.video().maxCount(),original.video().maxBytes(),original.video().formats(),2,15);
  var reference=new VideoStudioModeSpec(defaultMode.mode(),false,false,null,new VideoStudioReferenceRules(
    original.image(),videoRule,original.audio(),original.maxImagesWithVideo(),original.maxTotal(),original.minVisual(),original.maxAudioTotalSec()));
  var video=dir.resolve("reference.mp4");
  Files.write(video,new byte[]{0,0,0,16,'f','t','y','p','i','s','o','m'});
  when(storage.openForRead("reference")).thenReturn(video);
  when(ffmpeg.probeMedia(video.toFile())).thenReturn(new FfmpegRunner.MediaProbe(16,"mp4","h264",null,1280,720,0,0,true));
  assertThrows(BusinessException.class,()->service.requireMedia("u","video","reference",false,reference));
  when(ffmpeg.probeMedia(video.toFile())).thenReturn(new FfmpegRunner.MediaProbe(10,"mp4","h264",null,1280,720,0,0,true));
  assertDoesNotThrow(()->service.requireMedia("u","video","reference",false,reference));
 }
 @Test void configuredFormatsAreAcceptedOnlyWhenTheSelectedModeAllowsThem() throws Exception {
  var projects=mock(IpProjectService.class);var storage=mock(FileStorageService.class);var ffmpeg=mock(FfmpegRunner.class);
  var service=new StudioVideoService(mock(com.aistareco.aep.service.AiAppSceneModelPolicyService.class),mock(VideoStudioService.class),projects,storage,ffmpeg);
  var gif=dir.resolve("reference.gif");
  Files.write(gif,new byte[]{'G','I','F','8','9','a',1,0,1,0,0,0});
  when(storage.openForRead("gif")).thenReturn(gif);
  var gifMode=new VideoStudioModeSpec("custom",true,false,
    new VideoStudioMediaLimit("image",1,1024,java.util.List.of("GIF"),null,null),null);
  assertDoesNotThrow(()->service.requireMedia("u","image","gif",true,gifMode));
  assertThrows(BusinessException.class,()->service.requireMedia("u","image","gif",true,VideoStudioService.contract(5,15).modes().get(1)));

  var webm=dir.resolve("reference.webm");
  byte[] header=new byte[128];
  header[0]=0x1A;header[1]=0x45;header[2]=(byte)0xDF;header[3]=(byte)0xA3;
  header[96]=0x42;header[97]=(byte)0x82;header[98]=(byte)0x84;
  header[99]='w';header[100]='e';header[101]='b';header[102]='m';
  Files.write(webm,header);
  when(storage.openForRead("webm")).thenReturn(webm);
  when(ffmpeg.probeMedia(webm.toFile())).thenReturn(new FfmpegRunner.MediaProbe(3,"webm","vp9",null,1280,720,0,0,true));
  var legacy=VideoStudioService.contract(5,15).modes().get(3).references();
  var webmMode=new VideoStudioModeSpec("custom",false,false,null,new VideoStudioReferenceRules(
    legacy.image(),new VideoStudioMediaLimit("video",1,1024,java.util.List.of("WEBM"),null,null),
    legacy.audio(),legacy.maxImagesWithVideo(),legacy.maxTotal(),legacy.minVisual(),legacy.maxAudioTotalSec()));
  assertDoesNotThrow(()->service.requireMedia("u","video","webm",false,webmMode));
  assertThrows(BusinessException.class,()->service.requireMedia("u","video","webm",false,VideoStudioService.contract(5,15).modes().get(3)));
 }
 @Test void frameAndReferenceUseSeparateRulesEvenInTheSameCustomMode() throws Exception {
  var projects=mock(IpProjectService.class);var storage=mock(FileStorageService.class);
  var service=new StudioVideoService(mock(com.aistareco.aep.service.AiAppSceneModelPolicyService.class),mock(VideoStudioService.class),projects,storage,mock(FfmpegRunner.class));
  var image=dir.resolve("image.png");
  Files.write(image,new byte[]{(byte)137,80,78,71,13,10,26,10,0,0,0,0});
  try(var file=new java.io.RandomAccessFile(image.toFile(),"rw")){file.setLength(1536);}
  when(storage.openForRead("image")).thenReturn(image);
  var frame=new VideoStudioMediaLimit("image",1,1024,java.util.List.of("PNG"),null,null);
  var referenceImage=new VideoStudioMediaLimit("image",2,2048,java.util.List.of("PNG"),null,null);
  var legacy=VideoStudioService.contract(5,15).modes().get(3).references();
  var mode=new VideoStudioModeSpec("custom",true,false,frame,new VideoStudioReferenceRules(
    referenceImage,legacy.video(),legacy.audio(),legacy.maxImagesWithVideo(),legacy.maxTotal(),legacy.minVisual(),legacy.maxAudioTotalSec()));
  assertThrows(BusinessException.class,()->service.requireMedia("u","image","image",true,mode));
  assertDoesNotThrow(()->service.requireMedia("u","image","image",false,mode));
 }
}

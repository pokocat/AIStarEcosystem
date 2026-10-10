package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.videostudio.service.VideoStudioService;
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
  var service=new StudioVideoService(mock(VideoStudioService.class),projects,storage,mock(FfmpegRunner.class));
  when(projects.requireOwnedAssetKey("u","foreign")).thenThrow(BusinessException.badRequest("IP_ASSET_KEY_INVALID","foreign"));
  assertThrows(BusinessException.class,()->service.requireMedia("u","image","foreign",false));verifyNoInteractions(storage);
  var image=dir.resolve("image.png");Files.write(image,new byte[]{(byte)137,80,78,71,13,10,26,10,0,0,0,0});
  when(storage.openForRead("image")).thenReturn(image);
  assertDoesNotThrow(()->service.requireMedia("u","image","image",false));
  assertThrows(BusinessException.class,()->service.requireMedia("u","video","image",true));
 }
 @Test void frameAndUniversalReferenceHaveDifferentImageLimits() throws Exception {
  var projects=mock(IpProjectService.class);var storage=mock(FileStorageService.class);
  var service=new StudioVideoService(mock(VideoStudioService.class),projects,storage,mock(FfmpegRunner.class));
  var image=dir.resolve("large.png");Files.write(image,new byte[]{(byte)137,80,78,71,13,10,26,10,0,0,0,0});
  try(var file=new java.io.RandomAccessFile(image.toFile(),"rw")){file.setLength(17*1024*1024);}
  when(storage.openForRead("large")).thenReturn(image);
  assertThrows(BusinessException.class,()->service.requireMedia("u","image","large",false));
  assertDoesNotThrow(()->service.requireMedia("u","image","large",true));
 }
}

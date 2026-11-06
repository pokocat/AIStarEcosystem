package com.aistareco.aep.service.storage;
import com.aistareco.aep.config.FileStorageProperties;
import com.aistareco.aep.service.cdn.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.net.*;import java.nio.file.*;import java.util.*;import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class SharedFileCacheTest {
 @TempDir Path root;
 @Test void secondReaderCannotObserveAPartialDownload()throws Exception {
  byte[] bytes=new byte[65536];new Random(17).nextBytes(bytes);var halfway=new CountDownLatch(1);var finish=new CountDownLatch(1);var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
  server.createContext("/",e->{try{e.sendResponseHeaders(200,bytes.length);e.getResponseBody().write(bytes,0,32768);e.getResponseBody().flush();halfway.countDown();if(!finish.await(5,TimeUnit.SECONDS))throw new AssertionError("fixture timed out");e.getResponseBody().write(bytes,32768,32768);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();}finally{e.close();}});server.start();
  var props=new FileStorageProperties();props.setLocalDir(root.toString());var signer=mock(CdnUrlSigner.class);when(signer.signKey(anyString())).thenReturn("http://127.0.0.1:"+server.getAddress().getPort()+"/file");var service=new FileStorageService(props,mock(CdnUploader.class),signer);var pool=Executors.newFixedThreadPool(2);
  try {
   var first=pool.submit(()->service.openForRead("owned/object.mp4"));assertTrue(halfway.await(5,TimeUnit.SECONDS));
   var second=pool.submit(()->Files.readAllBytes(service.openForRead("owned/object.mp4")));
   assertThrows(TimeoutException.class,()->second.get(100,TimeUnit.MILLISECONDS));finish.countDown();assertArrayEquals(bytes,Files.readAllBytes(first.get(5,TimeUnit.SECONDS)));assertArrayEquals(bytes,second.get(5,TimeUnit.SECONDS));
  }finally{finish.countDown();pool.shutdownNow();server.stop(0);}
 }
 @Test void keyCannotEscapeItsStorageRoot()throws Exception {
  var props=new FileStorageProperties();props.setLocalDir(root.resolve("cache").toString());var service=new FileStorageService(props,null,null);Files.createDirectories(root.resolve("cache"));Files.writeString(root.resolve("private"),"private");
  assertThrows(java.io.IOException.class,()->service.openForRead("../private"));assertThrows(java.io.IOException.class,()->service.openForRead(root.resolve("private").toString()));
 }
 @Test void sharedModeRejectsALocalOnlyDriverBeforeAcknowledgingAFile() {
  var props=new FileStorageProperties();props.setLocalDir(root.toString());props.setRequireDurableUploads(true);var cdn=mock(CdnUploader.class);when(cdn.driverName()).thenReturn("local");var service=new FileStorageService(props,cdn,null);assertThrows(IllegalStateException.class,()->service.store("synthetic".getBytes(),"test",null,"bin",null));
 }
}

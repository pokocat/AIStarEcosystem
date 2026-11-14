package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioFilmStudyTest {
 final ObjectMapper om=new ObjectMapper();@TempDir Path directory;
 @Test void rangesAreContinuousFiniteBoundedAndKeepTheRealEnding() throws Exception {
  var source=om.readTree("{\"durationSec\":17.067,\"visualChanges\":[{\"timeSec\":3,\"kind\":\"lighting\"},{\"timeSec\":4,\"kind\":\"visual\"},{\"timeSec\":9,\"kind\":\"visual\"}]}");
  assertEquals(List.of(3.8,6.8,13.8,17.067),StudioFilmStudy.boundaries(om.readTree("{\"segments\":[{\"endSec\":3.8},{\"endSec\":3.8},{\"endSec\":-1},{\"endSec\":6.8},{\"endSec\":13.8},{\"endSec\":17}]}"),source));
  assertEquals(List.of(4.0,9.0,17.067),StudioFilmStudy.boundaries(om.createObjectNode(),source));
 }
 @Test void realCutsStayWithinThirtySecondsAndKeepTheirOriginalSound() throws Exception {
  var ffmpeg=new com.aistareco.aep.service.mixcut.FfmpegRunner(new com.aistareco.aep.config.MixcutProperties());
  Path input=directory.resolve("boundary.mp4");
  ffmpeg.runFfmpeg(List.of("-v","error","-f","lavfi","-i","color=blue:s=160x90:r=30000/1001:d=60",
          "-f","lavfi","-i","sine=frequency=660:sample_rate=48000:duration=60",
          "-c:v","libx264","-threads","2","-c:a","aac",input.toString()),30_000);
  var storage=mock(FileStorageService.class);
  when(storage.store(any(byte[].class),anyString(),anyString(),anyString(),anyString())).thenAnswer(call->{
   var bytes=call.<byte[]>getArgument(0);
   return new FileStorageService.StoredFile("stored."+call.getArgument(3),"","","",bytes.length,call.getArgument(4));
  });
  for(int no=0;no<2;no++) {
   var segment=om.createObjectNode().put("no",no).put("startSec",30*no).put("endSec",30*(no+1));
   StudioFilmStudy.cut(input,directory,segment,storage,"owner",30);
   Path clip=directory.resolve("segment-"+no+".mp4");
   var probe=ffmpeg.probeMedia(clip.toFile());
   assertTrue(probe.hasVideo()&&probe.hasAudio());
   assertTrue(probe.durationSec()>=29.8&&probe.durationSec()<29.95,"actual clip duration "+probe.durationSec());
   assertEquals(probe.durationSec(),segment.path("durationSec").asDouble());
   Path samples=directory.resolve("audio-"+no+".raw");
   ffmpeg.runFfmpeg(List.of("-v","error","-ss","28","-i",clip.toString(),"-t","1",
           "-vn","-ac","1","-ar","8000","-f","s16le",samples.toString()),20_000);
   byte[] pcm=Files.readAllBytes(samples);int crossings=0,previous=0;
   for(int i=0;i+1<pcm.length;i+=2){
    int sample=(short)((pcm[i]&255)|(pcm[i+1]<<8));
    if(previous<0&&sample>=0)crossings++;
    previous=sample;
   }
   assertEquals(660,crossings,5,"each segment must keep the original signal near its end");
   System.out.println("Seedance 2.5 clip "+(no+1)+": "+probe.durationSec()+"s, original audio crossings/s="+crossings);
  }
 }
 @Test void automaticallyRecutsWhenALongFrameExtendsTheFirstEncodePastTheCap() throws Exception {
  var ffmpeg=new com.aistareco.aep.service.mixcut.FfmpegRunner(new com.aistareco.aep.config.MixcutProperties());
  Path input=directory.resolve("sparse.mp4");
  ffmpeg.runFfmpeg(List.of("-v","error","-f","lavfi","-i","color=blue:s=160x90:r=7/9:d=35",
          "-f","lavfi","-i","sine=frequency=660:sample_rate=48000:duration=35",
          "-c:v","libx264","-threads","2","-c:a","aac",input.toString()),30_000);
  var storage=mock(FileStorageService.class);
  when(storage.store(any(byte[].class),anyString(),anyString(),anyString(),anyString())).thenAnswer(call->
          new FileStorageService.StoredFile("stored."+call.getArgument(3),"","","",call.<byte[]>getArgument(0).length,call.getArgument(4)));
  // At 7/9 fps, the last frame of a 29.9-second cut ends after the 30-second cap.
  var segment=om.createObjectNode().put("no",2).put("startSec",0).put("endSec",30);
  StudioFilmStudy.cut(input,directory,segment,storage,"owner",30);
  Path clip=directory.resolve("segment-2.mp4");
  var info=StudioLipSyncMedia.probe(clip);
  double duration=info.path("format").path("duration").asDouble();
  assertEquals("25/1",info.path("streams").get(0).path("avg_frame_rate").asText(),"the retry must normalize the picture automatically");
  assertTrue(duration>=29.8&&duration<=30,"recut duration "+duration);
  assertTrue(ffmpeg.probeMedia(clip.toFile()).hasAudio());
  verify(storage,times(1)).store(any(byte[].class),anyString(),eq("owner"),eq("mp4"),eq("video/mp4"));
  System.out.println("Seedance 2.5 automatic recut: "+duration+"s at 25 fps, original audio present");
 }
 @Test void actualClipsRetainAudioAndSourceDurationAndDoNotGradeModelProse() throws Exception {
  Path input=directory.resolve("source.mp4");var ffmpeg=new ProcessBuilder("ffmpeg","-v","error","-y","-f","lavfi","-i","testsrc2=s=320x180:r=30:d=3","-f","lavfi","-i","sine=frequency=400:duration=3","-c:v","libx264","-threads","2","-c:a","aac","-shortest",input.toString()).start();assertTrue(ffmpeg.waitFor(30,TimeUnit.SECONDS));assertEquals(0,ffmpeg.exitValue());
  var storage=mock(FileStorageService.class);when(storage.openForRead("source")).thenReturn(input);var saved=new HashMap<String,byte[]>();
  when(storage.store(any(byte[].class),anyString(),anyString(),anyString(),anyString())).thenAnswer(call->{String key="asset-"+saved.size()+"."+call.getArgument(3);byte[] bytes=call.getArgument(0);saved.put(key,bytes);return new FileStorageService.StoredFile(key,"","","",bytes.length,call.getArgument(4));});
  ObjectNode source=om.createObjectNode().put("nodeId","video").put("title","测试").put("storageKey","source").put("durationSec",3).put("audioAnalyzed",false);var times=source.putArray("frameTimes");for(double t:new double[]{0,.5,1,1.5,2,2.5,2.9667})times.add(t);
  var image=Map.<String,Object>of("type","image_url","image_url",Map.of("url","data:image/jpeg;base64,test"));
  var evidence=new StudioRecreation.Study(Collections.nCopies(7,image),image,List.of(),Collections.nCopies(7,image));
  int[] calls={0};var checkpoint=new ArrayList<ObjectNode>();
  var result=StudioFilmStudy.run(source,"已编辑的全片文档",om.createObjectNode(),evidence,storage,"owner",8192,3,(system,parts,tokens,json)->{calls[0]++;assertTrue(parts.stream().filter(p->"image_url".equals(p.get("type"))).count()<=3,"planner and segment evidence must fit the configured image limit");return json?"{\"segments\":[{\"endSec\":1.2},{\"endSec\":3}]}":"## 任意模型正文\n\n内容仅用于串流程，不验证叙事。";},(pct,stage,partial)->{checkpoint.add(partial.deepCopy());return true;});
  assertEquals(3,calls[0]);assertEquals(2,result.path("segments").size());
  for(var segment:result.path("segments")) {assertEquals("done",segment.path("status").asText());assertTrue(segment.path("markdown").asText().contains("任意模型正文"));Path clip=directory.resolve(segment.path("storageKey").asText());Files.write(clip,saved.get(segment.path("storageKey").asText()));var probe=StudioLipSyncMedia.probe(clip);assertTrue(Math.abs(probe.path("format").path("duration").asDouble()-(segment.path("endSec").asDouble()-segment.path("startSec").asDouble()))<.3);assertTrue(probe.path("streams").toString().contains("audio"));}
  assertTrue(checkpoint.stream().anyMatch(p->"done".equals(p.path("segments").path(0).path("status").asText())&&"pending".equals(p.path("segments").path(1).path("status").asText())));
  int previous=saved.size();var resumed=StudioFilmStudy.run(source,"",result,evidence,storage,"owner",8192,3,(a,b,c,d)->{throw new AssertionError("completed segments must not call model again");},(a,b,c)->true);assertEquals(previous,saved.size());assertEquals(result.path("segments"),resumed.path("segments"));
  var interrupted=result.deepCopy();var unfinished=(ObjectNode)interrupted.path("segments").path(1);unfinished.put("status","pending").put("error","供应商中断");unfinished.remove("markdown");
  int[] retryCalls={0};var continued=StudioFilmStudy.run(source,"",interrupted,evidence,storage,"owner",8192,3,(system,parts,tokens,json)->{assertFalse(json,"a resumed run must not plan again");retryCalls[0]++;return "## 续跑正文";},(a,b,c)->true);
  assertEquals(1,retryCalls[0]);assertEquals(previous,saved.size(),"reuse clips already cut before the interruption");assertEquals(result.path("segments").path(0),continued.path("segments").path(0));assertFalse(continued.path("segments").path(1).has("error"));assertEquals("done",continued.path("segments").path(1).path("status").asText());
 }
}

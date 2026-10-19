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
 @Test void actualClipsRetainAudioAndSourceDurationAndDoNotGradeModelProse() throws Exception {
  Path input=directory.resolve("source.mp4");var ffmpeg=new ProcessBuilder("ffmpeg","-v","error","-y","-f","lavfi","-i","testsrc2=s=320x180:r=30:d=3","-f","lavfi","-i","sine=frequency=400:duration=3","-c:v","libx264","-threads","2","-c:a","aac","-shortest",input.toString()).start();assertTrue(ffmpeg.waitFor(30,TimeUnit.SECONDS));assertEquals(0,ffmpeg.exitValue());
  var storage=mock(FileStorageService.class);when(storage.openForRead("source")).thenReturn(input);var saved=new HashMap<String,byte[]>();
  when(storage.store(any(byte[].class),anyString(),anyString(),anyString(),anyString())).thenAnswer(call->{String key="asset-"+saved.size()+"."+call.getArgument(3);byte[] bytes=call.getArgument(0);saved.put(key,bytes);return new FileStorageService.StoredFile(key,"","","",bytes.length,call.getArgument(4));});
  ObjectNode source=om.createObjectNode().put("nodeId","video").put("title","测试").put("storageKey","source").put("durationSec",3).put("audioAnalyzed",false);var times=source.putArray("frameTimes");for(double t:new double[]{0,.5,1,1.5,2,2.5,2.9667})times.add(t);
  var image=Map.<String,Object>of("type","image_url","image_url",Map.of("url","data:image/jpeg;base64,test"));
  var evidence=new StudioRecreation.Study(Collections.nCopies(7,List.of(Map.of("type","text","text","素材"),image)),image,List.of(),Collections.nCopies(7,image));
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

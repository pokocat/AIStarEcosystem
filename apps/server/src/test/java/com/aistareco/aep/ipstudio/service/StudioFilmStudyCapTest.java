package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** maxSegmentSec: over-long segments are re-split with continuous coverage to the real ending, never truncated. */
class StudioFilmStudyCapTest {
    final ObjectMapper om=new ObjectMapper();@TempDir Path directory;
    static final String LEGACY_PLANNER="将原片按叙事或动作阶段划分为1至8个连续片段，一个片段可包含多个镜头，不按固定秒数均切，闪光不等于切镜。仅输出JSON：{\"segments\":[{\"endSec\":3.8,\"title\":\"环境铺垫\"}]}。只给每段在原片中的结束秒数，最后一段结束于原片结尾。";

    static void assertCovered(List<Double> ends,double duration,double cap,int max) {
        assertTrue(ends.size()<=max,"segment count "+ends);
        assertEquals(duration,ends.get(ends.size()-1),1e-9,"coverage ends at the real ending");
        double start=0;for(double end:ends){assertTrue(end>start);assertTrue(end-start<=cap+1e-6,"segment "+start+"→"+end+" exceeds "+cap);start=end;}
    }

    @Test void longSegmentsAreSplitKeepingModelBoundaries() {
        var ends=StudioFilmStudy.capped(List.of(10.0,46.0),46,new StudioFilmStudy.SegmentCap(15,8));
        assertEquals(List.of(10.0,22.0,34.0,46.0),ends);assertCovered(ends,46,15,8);
    }

    @Test void tooManySegmentsMergeShortNeighboursOrFallBackToAnEvenSplit() {
        // 8 short model segments plus one long one: the split overflows 8 and short neighbours are merged within the cap.
        var ends=StudioFilmStudy.capped(List.of(1.0,2.0,3.0,4.0,5.0,6.0,7.0,60.0),60,new StudioFilmStudy.SegmentCap(15,8));
        assertCovered(ends,60,15,8);
        var even=StudioFilmStudy.capped(List.of(14.0,15.0,29.0,30.0,44.0,45.0,59.0,60.0),60,new StudioFilmStudy.SegmentCap(7.5,8));
        assertCovered(even,60,7.5,8);
    }

    @Test void impossibleSourcesAreRefusedWithTheConflictAndCap() {
        var error=assertThrows(BusinessException.class,()->StudioFilmStudy.capped(List.of(60.0),60,new StudioFilmStudy.SegmentCap(5,8)));
        assertEquals("STUDIO_SEGMENT_TOO_LONG",error.getCode());
        var details=(ObjectNode)error.getDetails();
        assertEquals(5,details.path("maxSegmentSec").asDouble());assertEquals(8,details.path("maxSegments").asInt());
        assertEquals(60,details.path("conflicts").get(0).path("durationSec").asDouble());
    }

    @Test void realClipsRespectTheCapAndOldCallersKeepThePlannerTextByteForByte() throws Exception {
        Path input=directory.resolve("source.mp4");
        var ffmpeg=new ProcessBuilder("ffmpeg","-v","error","-y","-f","lavfi","-i","testsrc2=s=320x180:r=30:d=3","-f","lavfi","-i","sine=frequency=400:duration=3","-c:v","libx264","-threads","2","-c:a","aac","-shortest",input.toString()).start();
        assertTrue(ffmpeg.waitFor(30,TimeUnit.SECONDS));assertEquals(0,ffmpeg.exitValue());
        var storage=mock(FileStorageService.class);when(storage.openForRead("source")).thenReturn(input);var saved=new HashMap<String,byte[]>();
        when(storage.store(any(byte[].class),anyString(),anyString(),anyString(),anyString())).thenAnswer(call->{String key="asset-"+saved.size()+"."+call.getArgument(3);byte[] bytes=call.getArgument(0);saved.put(key,bytes);return new FileStorageService.StoredFile(key,"","","",bytes.length,call.getArgument(4));});
        ObjectNode source=om.createObjectNode().put("nodeId","video").put("title","测试").put("storageKey","source").put("durationSec",3).put("audioAnalyzed",false);
        var times=source.putArray("frameTimes");for(double t:new double[]{0,.5,1,1.5,2,2.5,2.9667})times.add(t);
        var image=Map.<String,Object>of("type","image_url","image_url",Map.of("url","data:image/jpeg;base64,test"));
        var evidence=new StudioRecreation.Study(Collections.nCopies(7,List.of(Map.of("type","text","text","素材"),image)),image,List.of(),Collections.nCopies(7,image));
        List<String> planners=new ArrayList<>();
        StudioFilmStudy.Chat chat=(system,parts,tokens,json)->{if(json){planners.add(system);return "{\"segments\":[{\"endSec\":3}]}";}return "## 本段";};
        var capped=StudioFilmStudy.run(source,"",om.createObjectNode(),evidence,storage,"owner",8192,3,chat,(a,b,c)->true,new StudioFilmStudy.SegmentCap(1.2,8));
        assertEquals(3,capped.path("segments").size(),"one 3 s model segment becomes three ≤1.2 s clips");
        double start=0;
        for(var segment:capped.path("segments")) {
            assertEquals(start,segment.path("startSec").asDouble(),1e-9,"continuous");start=segment.path("endSec").asDouble();
            assertTrue(segment.path("durationSec").asDouble()<=1.2+.3,"real cut length is re-verified");
        }
        assertEquals(3,start,1e-9);
        assertTrue(planners.get(0).startsWith(LEGACY_PLANNER)&&planners.get(0).contains("每段不超过1.2秒"));
        StudioFilmStudy.run(source,"",om.createObjectNode(),evidence,storage,"owner",8192,3,chat,(a,b,c)->true);
        assertEquals(LEGACY_PLANNER,planners.get(1),"callers without a cap send exactly the previous planner text");
    }
}

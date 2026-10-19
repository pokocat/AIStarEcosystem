package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.ai.AiChatHttpException;
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

class StudioVisionFallbackTest {
    final ObjectMapper json=new ObjectMapper();
    final ObjectNode source=json.createObjectNode();
    @TempDir Path directory;
    StudioVisionFallbackTest(){source.putArray("frameTimes").add(0).add(.5).add(1);}
    static AiChatHttpException rejection(int status,String code,String message){return new AiChatHttpException(status,
            "{\"error\":{\"code\":\""+code+"\",\"message\":\""+message+"\"}}","friendly","private");}
    static AiChatHttpException memory(){return rejection(400,"unsupported_geometry","visual activation/HBM headroom budget");}
    static Map<String,Object> image(int i){return Map.of("type","image_url","image_url",Map.of("url","data:image/jpeg;base64,frame"+i));}
    List<Map<String,Object>> primary(){return List.of(Map.of("type","text","text","original context"),image(0),image(1),image(2));}
    String facts(int count) {return "{\"frames\":["+String.join(",",Collections.nCopies(count,"{\"visible\":\"画面事实\",\"uncertainty\":\"无\"}"))+"]}";}
    int images(List<Map<String,Object>> parts){return (int)parts.stream().filter(p->"image_url".equals(p.get("type"))).count();}

    @Test void successKeepsTheExactOriginalRequestAndDoesNotDecodeOrCheckpoint() throws Exception {
        var study=json.createObjectNode();var parts=primary();int[] calls={0};
        String result=StudioVisionFallback.invoke((s,p,t,j)->{calls[0]++;assertSame(parts,p);assertEquals(768,t);return "original reply";},"system",parts,768,true,List.of(0,1,2),source,
                i->{throw new AssertionError("No native decode on success");},study,(p,s,r)->{throw new AssertionError("No recovery checkpoint on success");});
        assertEquals("original reply",result);assertEquals(1,calls[0]);assertTrue(study.isEmpty());
    }
    @Test void unrelatedFailuresNeverTriggerAdditionalCalls() {
        List<Exception> failures=List.of(rejection(400,"unsupported_geometry","unsupported aspect ratio"),
                rejection(400,"invalid_argument","visual activation/HBM headroom budget"),
                rejection(429,"unsupported_geometry","visual activation/HBM headroom budget"),
                rejection(500,"unsupported_geometry","visual activation/HBM headroom budget"),
                BusinessException.badRequest("AI_PROVIDER_TIMEOUT","timeout"),new IllegalStateException("HBM"));
        for(var error:failures){int[] calls={0};var study=json.createObjectNode();
            var thrown=assertThrows(Exception.class,()->StudioVisionFallback.invoke((s,p,t,j)->{calls[0]++;throw error;},"system",primary(),768,true,List.of(0,1,2),source,
                    i->{throw new AssertionError("No fallback decode");},study,(p,s,r)->{throw new AssertionError("No fallback checkpoint");}));
            assertSame(error,thrown);assertEquals(1,calls[0]);assertTrue(study.isEmpty());
        }
    }
    @Test void exactRejectionReadsAllFramesInFreshBatchesThenSynthesizesWithoutImages() throws Exception {
        var study=json.createObjectNode();int[] calls={0};List<Integer> decoded=new ArrayList<>();
        String result=StudioVisionFallback.invoke((s,p,t,j)->{
            if(calls[0]++==0)throw memory();int n=images(p);
            assertTrue(n<=2);return n>0?facts(n):"final reply";
        },"system",primary(),768,true,List.of(0,1,2),source,i->{decoded.add(i);return image(i);},study,(p,s,r)->true);
        assertEquals("final reply",result);assertEquals(List.of(0,1,2),decoded);assertEquals(4,calls[0]);
        var state=study.path("_visionFallback").elements().next();assertEquals(2,state.path("batches").size());
        assertEquals(3,state.path("batches").path(1).path(0).path("frame").asInt());
        assertEquals(1,state.path("batches").path(1).path(0).path("timeSec").asDouble());
        assertFalse(study.toString().contains("data:image"));
    }
    @Test void fallbackFailureIsNotRetriedAndCompletedBatchesAreReusedOnExplicitContinue() throws Exception {
        var study=json.createObjectNode();int[] calls={0};
        assertThrows(IllegalStateException.class,()->StudioVisionFallback.invoke((s,p,t,j)->{
            int call=calls[0]++;if(call==0)throw memory();if(call==1)return facts(2);throw new IllegalStateException("provider timeout");
        },"system",primary(),768,true,List.of(0,1,2),source,StudioVisionFallbackTest::image,study,(p,s,r)->true));
        assertEquals(3,calls[0]);int[] continued={0};List<Integer> decoded=new ArrayList<>();
        var result=StudioVisionFallback.invoke((s,p,t,j)->{continued[0]++;return images(p)>0?facts(1):"continued";},"system",primary(),768,true,List.of(0,1,2),source,
                i->{decoded.add(i);return image(i);},study,(p,s,r)->true);
        assertEquals("continued",result);assertEquals(2,continued[0]);assertEquals(List.of(2),decoded);
        // A completed fallback result also survives an interrupted parent checkpoint without paid replay.
        assertEquals("continued",StudioVisionFallback.invoke((s,p,t,j)->{throw new AssertionError("cached result");},"system",primary(),768,true,List.of(0,1,2),source,
                i->{throw new AssertionError();},study,(p,s,r)->true));
    }
    @Test void cancellationAndExhaustedBudgetStopBeforeAnyFallbackModelCall() {
        var lowBudget=new StudioFilmStudy.Chat(){public int remainingOutputTokens(){return 128;}public String invoke(String s,List<Map<String,Object>> p,int t,boolean j){throw memory();}};
        assertEquals("AI_USAGE_LIMIT",assertThrows(BusinessException.class,()->StudioVisionFallback.invoke(lowBudget,"system",primary(),768,true,List.of(0,1,2),source,
                i->{throw new AssertionError("No decode without budget");},json.createObjectNode(),(p,s,r)->true)).getCode());
        assertEquals("IP_RUN_CANCELLED",assertThrows(BusinessException.class,()->StudioVisionFallback.invoke((s,p,t,j)->{throw memory();},"system",primary(),768,true,List.of(0,1,2),source,
                i->{throw new AssertionError("No decode after cancellation");},json.createObjectNode(),(p,s,r)->false)).getCode());
    }
    @Test void nativeFramesRetainSourceDimensionsAndTemporaryFilesDoNotBecomeAssets() throws Exception {
        Path movie=directory.resolve("source.mp4");var p=new ProcessBuilder("ffmpeg","-v","error","-f","lavfi","-i","testsrc2=s=720x1280:r=24:d=1","-c:v","libx264","-threads","2","-y",movie.toString()).start();
        assertTrue(p.waitFor(30,TimeUnit.SECONDS));assertEquals(0,p.exitValue());
        var storage=mock(FileStorageService.class);when(storage.openForRead("source")).thenReturn(movie);source.put("storageKey","source");
        var part=StudioVisionFallback.nativeFrame(storage,source,1);String url=(String)((Map<?,?>)part.get("image_url")).get("url");
        var image=javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(Base64.getDecoder().decode(url.substring(url.indexOf(',')+1))));
        assertEquals(720,image.getWidth());assertEquals(1280,image.getHeight());verify(storage).openForRead("source");verifyNoMoreInteractions(storage);
    }
}

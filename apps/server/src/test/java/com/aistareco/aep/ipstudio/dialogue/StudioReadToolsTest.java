package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.ipstudio.dialogue.tools.*;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.Clock;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioReadToolsTest {
    final ObjectMapper om=new ObjectMapper();
    ToolContext context(ToolContext.Effects effects) {
        return new ToolContext("u","p","t","turn","r","a","m",null,null,false,null,null,
                DialogueLoop.TurnBudget.unmetered(1024,Clock.systemUTC()),null,null,()->false,effects);
    }
    @Test void everyCharacterOfALongUnicodeScriptCanBeReadWithoutGapsOrDuplicatedPages() throws Exception {
        String original="第一场😀".repeat(4000)+"最后一场结尾";
        var doc=om.createObjectNode();doc.putArray("nodes").addObject().put("id","script").put("type","text")
                .put("title","五场剧本").putObject("metadata").put("content",original);
        var effects=mock(ToolContext.Effects.class);when(effects.readDoc()).thenReturn(doc);
        var tool=new ReadCanvasTool();StringBuilder joined=new StringBuilder();int offset=0,pages=0;
        while(true) {
            var args=om.createObjectNode().put("offset",offset);args.putArray("nodeIds").add("script");
            assertNull(tool.validate(args,context(effects)));
            var page=om.readTree(tool.run(args,context(effects),null).forModel()).path("nodes").get(0);
            joined.append(page.path("text").asText());pages++;
            if(!page.path("hasMore").asBoolean()){assertTrue(page.path("nextOffset").isNull());break;}
            int next=page.path("nextOffset").asInt();assertTrue(next>offset);offset=next;
        }
        assertTrue(pages>1);assertEquals(original,joined.toString());
        assertTrue(DialogueCanvasDigest.full(doc,"script").contains("offset=4000"));
        assertNotNull(tool.validate(om.readTree("{\"offset\":-1}"),context(effects)));
        assertNotNull(tool.validate(om.readTree("{\"limit\":17000}"),context(effects)));
    }
    /**
     * docs/ip-studio-dialogue-no-continue.md §5 (IPP-6e051b9d 15:13): an 8000-character script pinned to a message. The
     * digest says how long it is and how to read on; the model follows nextOffset through the loop and reads it all, and
     * the loop never calls that a repeat.
     */
    @Test void an8000CharacterScriptIsReadToTheEndInSegmentsWithoutALoop() throws Exception {
        String script = "甲".repeat(5000) + "乙".repeat(2999) + "终";
        var doc=om.createObjectNode();doc.putArray("nodes").addObject().put("id","script").put("type","text")
                .put("title","三集剧本").putObject("metadata").put("content",script);
        String digest=DialogueCanvasDigest.build(doc,List.of("script"),List.of());
        assertTrue(digest.contains("全文 8000 字"), digest.substring(0, 200));
        assertTrue(digest.contains("offset=4000"));
        assertFalse(digest.contains("已截断"));
        var effects=mock(ToolContext.Effects.class);when(effects.readDoc()).thenReturn(doc);
        var tool=new ReadCanvasTool();var ctx=context(effects);StringBuilder read=new StringBuilder(script.substring(0,4000));
        var budget=DialogueLoop.TurnBudget.unmetered(1024,Clock.systemUTC());
        var model=new DialogueLoopTest.ScriptedModel(budget) {
            int next=4000;
            @Override public DialogueLoop.Reply call(java.util.List<java.util.Map<String,Object>> messages,int callIndex,int maxOutputTokens) {
                if(next<0)return new DialogueLoop.Reply("读完了，开始拆镜。",List.of(),null,null);
                var args=om.createObjectNode().put("offset",next).put("limit",3000);args.putArray("nodeIds").add("script");
                return new DialogueLoop.Reply("接着读",List.of(new DialogueLoop.Action("a"+callIndex,"read_canvas",args)),null,null);
            }
        };
        DialogueLoop.Tools tools=new DialogueLoop.Tools() {
            public java.util.Optional<String> reject(DialogueLoop.Action a){return java.util.Optional.ofNullable(tool.validate(a.args(),ctx));}
            public DialogueLoop.ToolOutcome run(DialogueLoop.Action a) throws Exception {
                var page=om.readTree(tool.run(a.args(),ctx,null).forModel()).path("nodes").get(0);
                assertEquals(8000,page.path("total").asInt());
                read.append(page.path("text").asText());
                model.next=page.path("nextOffset").isNull()?-1:page.path("nextOffset").asInt();
                return DialogueLoop.ToolOutcome.of(page.toString());
            }
        };
        var outcome=new DialogueLoop(model,tools,new DialogueLoopTest.Hooks(),budget).run(new java.util.ArrayList<>());
        assertEquals(DialogueLoop.Reason.COMPLETED,outcome.reason());
        assertNull(outcome.limit(),"reading on is not a repeat");
        assertEquals(script,read.toString());
        assertEquals(2,outcome.toolCalls(),"4000–7000 and 7000–8000");
    }
    @Test void theCatalogCanReachNodesBeyondItsFirst120Entries() throws Exception {
        var doc=om.createObjectNode();var nodes=doc.putArray("nodes");
        for(int i=0;i<135;i++)nodes.addObject().put("id","n"+i).put("type","text").put("title","镜头"+i);
        var effects=mock(ToolContext.Effects.class);when(effects.readDoc()).thenReturn(doc);var tool=new ReadCanvasTool();
        var first=om.readTree(tool.run(om.createObjectNode(),context(effects),null).forModel());
        assertEquals(135,first.path("count").asInt());assertEquals(120,first.path("nextOffset").asInt());
        var last=om.readTree(tool.run(om.createObjectNode().put("offset",120),context(effects),null).forModel());
        assertTrue(last.path("digest").asText().contains("n134"));assertFalse(last.path("hasMore").asBoolean());
    }
    @Test void progressUsesNativeProjectionAndKeepsAdoptedContentSeparateFromFailedRedo() throws Exception {
        var projects=mock(IpProjectService.class);var runs=mock(IpRunRepository.class);var effects=mock(ToolContext.Effects.class);
        when(effects.readDoc()).thenReturn(om.readTree("{\"nodes\":[{\"id\":\"v\",\"type\":\"video\",\"title\":\"判决\",\"metadata\":{\"storageKey\":\"old.mp4\"}},{\"id\":\"draft\",\"type\":\"video\",\"title\":\"黄毛进场\"}]}"));
        var binding=IpRun.builder().id("r1").projectId("p").ownerUserId("u").nodeId("v").kind("studio-video").status("done").build();
        var previous=IpRun.builder().id("r0").projectId("p").ownerUserId("u").nodeId("v").kind("studio-video").status("done").build();
        when(runs.findByProjectIdOrderByCreatedAtDesc("p")).thenReturn(List.of(binding,previous));
        when(projects.toRunDto(binding)).thenReturn(new IpRunDto("r1","p","v","studio-video","failed","video.failed",100,0,
                "VIDEO_SUBMIT_FAILED","rejected",om.createObjectNode(),om.createObjectNode().put("url","private-url"),null,null));
        var result=om.readTree(new ReadProductionStatusTool(projects,runs).run(om.createObjectNode(),context(effects),null).forModel());
        var items=result.path("items");assertEquals(2,items.size());assertEquals("failed",items.get(0).path("latestStatus").asText());
        assertTrue(items.get(0).path("hasAdoptedContent").asBoolean());assertEquals("no_task",items.get(1).path("latestStatus").asText());
        assertFalse(result.toString().contains("private-url"));assertFalse(result.toString().contains("old.mp4"));
        verify(projects).required("u","p");verify(projects,never()).toRunDto(previous);
    }
}

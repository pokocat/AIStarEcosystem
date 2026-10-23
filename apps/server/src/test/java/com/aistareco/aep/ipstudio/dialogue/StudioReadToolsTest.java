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

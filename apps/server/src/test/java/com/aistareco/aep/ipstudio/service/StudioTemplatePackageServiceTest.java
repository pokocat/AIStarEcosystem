package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.*;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.service.picgen.FontRegistry;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.awt.image.BufferedImage;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;
import java.io.*;
import javax.imageio.ImageIO;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioTemplatePackageServiceTest {
    final ObjectMapper om=new ObjectMapper();final IpProjectService projects=mock(IpProjectService.class);
    final StudioTemplateExecutionService execution=mock(StudioTemplateExecutionService.class);final FileStorageService storage=mock(FileStorageService.class);
    StudioTemplatePackageService service;IpProject p;Execution state;List<byte[]> outputs=new ArrayList<>();@TempDir Path dir;
    @BeforeEach void setup() throws Exception {
        var fonts=new FontRegistry();fonts.load();service=new StudioTemplatePackageService(projects,execution,storage,fonts,om);
        p=IpProject.builder().id("p").ownerUserId("owner").templateInstanceJson("{}").build();
        when(projects.required("owner","p")).thenReturn(p);when(projects.requiredForUpdate("owner","p")).thenReturn(p);
        when(projects.parseOrEmptyObject(anyString())).thenAnswer(i->om.readTree(i.getArgument(0,String.class)));
        var run=new IpRunDto("r","p","n","generate","done","done",100,8,null,null,om.createObjectNode(),om.createObjectNode(),"today","today");
        state=new Execution("v1",1,List.of(new ExecutionStep("main","主形象","n","main","done",true,8L,run,"own/main.png",null,true,null),new ExecutionStep("side","侧面","s","side","waiting_dependency",false,null,null,null,null,false,null)),false);
        when(execution.read("owner","p")).thenAnswer(i->state);
        var source=new BufferedImage(8,16,BufferedImage.TYPE_INT_RGB);source.setRGB(4,8,0x778899);Path image=dir.resolve("input.png");ImageIO.write(source,"png",image.toFile());
        when(projects.requireOwnedAssetKey(eq("owner"),anyString())).thenAnswer(i->i.getArgument(1));when(storage.openForRead(anyString())).thenReturn(image);
        when(storage.signedUrl(anyString())).thenAnswer(i->"url/"+i.getArgument(0));
        when(storage.store(any(byte[].class),anyString(),eq("owner"),anyString(),anyString())).thenAnswer(i->{byte[] data=i.getArgument(0);outputs.add(data);String key="own/result"+outputs.size()+"."+i.getArgument(3);return new FileStorageService.StoredFile(key,null,null,null,data.length,i.getArgument(4));});
    }
    @Test void realPngZipContainOriginalBytesAndProvenanceAndPartialIsHonest() throws Exception {
        var req=new PackageRequest("小紫人物资产包","固定服装与紫色发型",List.of("main"));var result=service.create("owner","p",req);
        assertFalse(result.complete());assertEquals(1,result.imageCount());assertEquals(2,result.requiredCount());assertEquals(1600,result.width());assertEquals(870,result.height());
        var board=ImageIO.read(new ByteArrayInputStream(outputs.get(0)));assertEquals(result.width(),board.getWidth());int ink=0;for(int y=40;y<290;y++)for(int x=70;x<1500;x++)if(board.getRGB(x,y)!=board.getRGB(0,0))ink++;assertTrue(ink>1000,"Chinese title and labels must have visible ink");
        Map<String,byte[]> entries=new HashMap<>();try(var zip=new ZipInputStream(new ByteArrayInputStream(outputs.get(1)))){ZipEntry entry;while((entry=zip.getNextEntry())!=null)entries.put(entry.getName(),zip.readAllBytes());}
        assertArrayEquals(outputs.get(0),entries.get("asset-board.png"));assertArrayEquals(Files.readAllBytes(dir.resolve("input.png")),entries.get("images/01-main.png"));
        var manifest=om.readTree(entries.get("manifest.json"));assertEquals("v1",manifest.path("versionId").asText());assertEquals("r",manifest.path("images").get(0).path("runId").asText());assertFalse(manifest.has("boardUrl"));
        assertEquals(result.id(),service.create("owner","p",req).id());assertEquals(2,outputs.size());assertEquals(result.id(),service.list("owner","p").get(0).id());
    }
    @Test void staleUnacceptedMissingAndDuplicateSelectionsFailBeforeStorage() {
        assertThrows(BusinessException.class,()->service.create("owner","p",new PackageRequest("pack",null,List.of("side"))));
        assertThrows(BusinessException.class,()->service.create("owner","p",new PackageRequest("pack",null,List.of("main","main"))));
        assertThrows(BusinessException.class,()->service.create("owner","p",new PackageRequest("pack",null,List.of("missing"))));
        state=new Execution("v1",1,List.of(new ExecutionStep("main","main","n","main","stale",true,8L,null,"own/main.png",null,true,null)),false);
        assertThrows(BusinessException.class,()->service.create("owner","p",new PackageRequest("pack",null,List.of("main"))));verify(storage,never()).store(any(byte[].class),any(),any(),any(),any());
    }
    @Test void invalidImageCannotBeUsedAsSuccessfulBoard() {assertThrows(Exception.class,()->StudioTemplatePackageService.decode("not image".getBytes()));}
}

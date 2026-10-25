package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.config.IpStudioProperties;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.materialvideo.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DirectorImageModelTest {
    private final ObjectMapper om = new ObjectMapper();
    private final DirectorWorkRepository works = mock(DirectorWorkRepository.class);
    private final IpRunRepository runs = mock(IpRunRepository.class);
    private final IpRunService images = mock(IpRunService.class);
    private final StudioWorkflowService text = mock(StudioWorkflowService.class);
    private final AiAppSceneModelPolicyService policy = mock(AiAppSceneModelPolicyService.class);
    private DirectorService service;
    private DirectorWork work;

    private AiAppSceneModelPolicyService.Selection selection(String id, long cost, boolean isDefault, String size) {
        var endpoint = AiModelEndpoint.builder().id(id).name(id).model(id).enabled(true).baseUrl("https://example.com/v1")
                .imageRequestSpecJson("{\"promptMaxChars\":16000,\"minReferenceImages\":0,\"maxReferenceImages\":14,\"referenceField\":\"multiple\",\"outputs\":[{\"canvasSize\":\""+size+"\",\"aspectRatio\":\"16:9\",\"providerFields\":{}}]}").build();
        return new AiAppSceneModelPolicyService.Selection(new AiModelInvocationService.ResolvedEndpoint(endpoint, null, isDefault),cost,"per_image");
    }

    @BeforeEach void setUp() {
        when(text.directorPrices()).thenReturn(new long[]{21,16});
        var a=selection("default-image",16,true,"2048x1152");
        var b=selection("chosen-image",37,false,"2560x1440");
        when(policy.available(eq("studio"),eq("image"),anyLong())).thenReturn(List.of(a,b));
        when(policy.resolve(eq("studio"),eq("image"),nullable(String.class),anyLong())).thenAnswer(i->{
            String id=i.getArgument(2); if(id==null||id.equals("default-image"))return a;
            if(id.equals("chosen-image"))return b;
            throw BusinessException.badRequest("ENDPOINT_NOT_ALLOWED","不可用");
        });
        when(works.save(any())).thenAnswer(i->{work=i.getArgument(0);return work;});
        when(works.lockById(any())).thenAnswer(i->Optional.ofNullable(work));
        when(works.findById(any())).thenAnswer(i->Optional.ofNullable(work));
        service=new DirectorService(works,runs,mock(IpProjectService.class),images,text,mock(StudioWorkflowWorker.class),mock(StudioVideoService.class),
                mock(StudioFixtureProvider.class),mock(StudioMediaImportService.class),mock(MaterialVideoJobService.class),mock(MaterialVideoModelClient.class),
                policy,mock(FileStorageService.class),new IpStudioProperties(),mock(IpLibraryService.class),om,mock(PlatformTransactionManager.class));
        service.create("u1",new DirectorService.CreateRequest("模型选择验收","",null));
    }

    @Test void choosingImageModelUpdatesSavedSelectionAndPrice() {
        var saved=service.patch("u1",work.getId(),new DirectorService.PatchRequest(null,null,null,null,om.createObjectNode().put("imageModel","chosen-image")));
        assertEquals("chosen-image",saved.path("settings").path("imageModel").asText());
        assertEquals(37,saved.path("pricing").path("image").asLong());
        assertEquals(2,saved.path("imageModels").size());
        var reset=service.patch("u1",work.getId(),new DirectorService.PatchRequest(null,null,null,null,om.createObjectNode().putNull("imageModel")));
        assertEquals(16,reset.path("pricing").path("image").asLong());
    }

    @Test void selectedModelIsActuallySubmittedWithItsOwnSizeAndApprovedPrice() throws Exception {
        ObjectNode c=(ObjectNode)om.readTree(work.getContentJson());
        ((ObjectNode)c.path("settings")).put("imageModel","chosen-image");
        c.withArray("assets").addObject().put("id","as1").put("kind","scene").put("name","庭院").put("description","庭院").put("prompt","庭院").put("rev",1)
                .putArray("aliases");
        ((ObjectNode)c.path("assets").get(0)).putObject("image").putArray("candidates");
        work.setContentJson(om.writeValueAsString(c));
        var result=new IpRunDto("run-new",work.getId(),"asset:as1","generate","running","queued",0,37,null,null,om.createObjectNode(),om.createObjectNode(),null,null,null);
        when(images.generateForDirector(eq("u1"),eq(work.getId()),any())).thenReturn(result);
        service.task("u1",work.getId(),new DirectorService.TaskRequest("asset-image","as1","req1",null,null,37L));
        var sent=ArgumentCaptor.forClass(IpRunService.IpGenerateRequest.class);
        verify(images).generateForDirector(eq("u1"),eq(work.getId()),sent.capture());
        assertEquals("chosen-image",sent.getValue().model());
        assertEquals("2560x1440",sent.getValue().size());
        assertEquals(37L,sent.getValue().maxCost());
    }

    @Test void unknownModelCannotBeSavedOrReachGeneration() {
        assertThrows(BusinessException.class,()->service.patch("u1",work.getId(),new DirectorService.PatchRequest(null,null,null,null,om.createObjectNode().put("imageModel","hidden"))));
        verifyNoInteractions(images);
    }
}

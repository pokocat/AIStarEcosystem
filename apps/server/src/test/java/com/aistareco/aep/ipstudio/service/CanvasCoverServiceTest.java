package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.model.*;
import com.aistareco.aep.ipstudio.repository.IpDemoTemplateRepository;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpUploadResultDto;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.support.*;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CanvasCoverServiceTest {
    final ObjectMapper om=new ObjectMapper();
    final IpProjectService projects=mock(IpProjectService.class);
    final IpDemoTemplateRepository templates=mock(IpDemoTemplateRepository.class);
    final FileStorageService storage=mock(FileStorageService.class);
    final EntityManager em=mock(EntityManager.class);
    final IpCatalogService catalog=mock(IpCatalogService.class);
    final PlatformConfigService configs=mock(PlatformConfigService.class);
    final CanvasCoverService service=new CanvasCoverService(projects,templates,storage,om,em,catalog,configs);
    final MockMultipartFile file=new MockMultipartFile("file","cover.png","image/png",new byte[]{1});
    IpProject project;IpDemoTemplate template;
    @BeforeEach void setup()throws Exception{
        String doc="{\"nodes\":[{\"type\":\"image\",\"metadata\":{\"storageKey\":\"own-image\"}}],\"connections\":[]}";
        project=IpProject.builder().id("p").ownerUserId("owner").docJson(doc).build();
        template=IpDemoTemplate.builder().id("t").visibility("personal").createdBy("owner").docJson(doc).currentVersionId("v1").build();
        when(projects.requiredForUpdate("owner","p")).thenReturn(project);
        when(projects.readDoc(project)).thenAnswer(i->om.readTree(project.getDocJson()));
        when(templates.findById("t")).thenReturn(Optional.of(template));
        when(storage.signedUrl(anyString())).thenAnswer(i->"signed:"+i.getArgument(0));
    }
    @AfterEach void cleanup(){if(TransactionSynchronizationManager.isSynchronizationActive())TransactionSynchronizationManager.clearSynchronization();}
    @Test void uploadChangesOnlyCoverAndNeverRewritesTheProjectDocument(){
        String before=project.getDocJson();when(projects.uploadImage(file,"ipstudio/cover","p")).thenReturn(new IpUploadResultDto("ipstudio_cover/p/new.png","signed:new",10,10,"cover.png"));
        service.upload("owner","project","p",false,file);
        assertEquals("ipstudio_cover/p/new.png",project.getCoverKey());assertEquals(before,project.getDocJson());
    }
    @Test void deniedPersonalAndOfficialTemplatesNeverUploadAnything(){
        assertThrows(BusinessException.class,()->service.upload("stranger","template","t",true,file));
        template.setVisibility("official");assertThrows(BusinessException.class,()->service.upload("owner","template","t",false,file));
        verify(projects,never()).uploadImage(any(),anyString(),anyString());
    }
    @Test void superAdminMayChangeOfficialCoverWithoutChangingVersionOrDoc(){
        template.setVisibility("official");String before=template.getDocJson();
        when(projects.uploadImage(file,"ipstudio/cover","t")).thenReturn(new IpUploadResultDto("ipstudio_cover/t/new.png","signed:new",10,10,"cover.png"));
        service.upload("operator","template","t",true,file);
        assertEquals(before,template.getDocJson());assertEquals("v1",template.getCurrentVersionId());
        assertEquals("ipstudio_cover/t/new.png",template.getCoverKey());
    }
    @Test void resetRemovesOnlyAnIndependentUploadedCoverAfterCommit(){
        template.setCoverKey("ipstudio_cover/t/old.png");TransactionSynchronizationManager.initSynchronization();
        service.reset("owner","template","t",false);assertNull(template.getCoverKey());verify(storage,never()).delete(anyString());
        TransactionSynchronizationManager.getSynchronizations().forEach(s->s.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));
        verify(storage).delete("ipstudio_cover/t/old.png");
    }
    @Test void uploadFailureLeavesOldCoverAndDocumentIntact(){
        project.setCoverKey("old");when(projects.uploadImage(file,"ipstudio/cover","p")).thenThrow(BusinessException.badRequest("IP_UPLOAD_INVALID","坏图片"));
        assertThrows(BusinessException.class,()->service.upload("owner","project","p",false,file));assertEquals("old",project.getCoverKey());
    }
    @Test void rollbackRemovesNewUploadAndNeverDeletesOldImage(){
        project.setCoverKey("own-image");when(projects.uploadImage(file,"ipstudio/cover","p")).thenReturn(new IpUploadResultDto("ipstudio_cover/p/new.png","signed:new",10,10,"cover.png"));
        TransactionSynchronizationManager.initSynchronization();service.upload("owner","project","p",false,file);
        TransactionSynchronizationManager.getSynchronizations().forEach(s->s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        verify(storage).delete("ipstudio_cover/p/new.png");verify(storage,never()).delete("own-image");
    }
    @Test void selectionRequiresAnImageInTheExactTargetCanvas(){
        assertEquals("IP_COVER_INVALID",assertThrows(BusinessException.class,()->service.select("owner","template","t",false,"foreign")).getCode());
        service.select("owner","template","t",false,"own-image");assertEquals("own-image",template.getCoverKey());
        service.reset("owner","template","t",false);verify(storage,never()).delete("own-image");
    }
    @Test void builtinCoverUsesOnlyAnOverrideAndNeverCreatesOrChangesATemplate()throws Exception{
        var builtin=new com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpTemplateDto("builtin","官方模板","","",null,0,0,om.readTree(template.getDocJson()));
        when(catalog.template("builtin")).thenReturn(Optional.of(builtin));
        when(projects.uploadImage(file,"ipstudio/cover","builtin")).thenReturn(new IpUploadResultDto("ipstudio_cover/builtin/new.png","signed:new",10,10,"cover.png"));
        service.upload("operator","template","builtin",true,file);
        verify(configs).lockExisting("studio.builtin-cover.builtin");
        verify(configs).upsert(eq("studio.builtin-cover.builtin"),argThat(v->"ipstudio_cover/builtin/new.png".equals(v.path("storageKey").asText())),anyString(),eq("operator"));
        verify(templates,never()).save(any());
        service.reset("operator","template","builtin",true);
        verify(configs).upsert(eq("studio.builtin-cover.builtin"),argThat(v->v.path("storageKey").isNull()),anyString(),eq("operator"));
    }
    @Test void nonAdminCannotSetABuiltinCoverAndUnknownIdsAreRejected(){
        assertThrows(BusinessException.class,()->service.upload("owner","template","builtin",false,file));
        assertThrows(BusinessException.class,()->service.upload("operator","template","unknown",true,file));
        verifyNoInteractions(configs);verify(projects,never()).uploadImage(any(),anyString(),anyString());
    }
}

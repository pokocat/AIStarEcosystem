package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioEffectDtos.*;
import com.aistareco.aep.ipstudio.model.*;
import com.aistareco.aep.ipstudio.repository.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioEffectServiceTest {
    final IpVideoEffectRepository effects=mock(IpVideoEffectRepository.class);
    final IpVideoEffectActivityRepository activity=mock(IpVideoEffectActivityRepository.class);
    final IpProjectService projects=mock(IpProjectService.class);
    final AiModelInvocationService models=mock(AiModelInvocationService.class);
    final FileStorageService storage=mock(FileStorageService.class);
    final EntityManager em=mock(EntityManager.class);
    final Map<String,IpVideoEffect> catalog=new LinkedHashMap<>();final Map<String,IpVideoEffectActivity> states=new HashMap<>();
    StudioEffectService service;@TempDir Path dir;
    @BeforeEach void setup()throws Exception {
        service=new StudioEffectService(effects,activity,projects,models,storage,em,new ObjectMapper());
        when(effects.save(any())).thenAnswer(i->{IpVideoEffect e=i.getArgument(0);catalog.put(e.getId(),e);return e;});
        when(effects.findById(anyString())).thenAnswer(i->Optional.ofNullable(catalog.get(i.getArgument(0))));
        when(effects.accessible(anyString())).thenAnswer(i->catalog.values().stream().filter(e->"official".equals(e.getVisibility())||e.getOwnerUserId().equals(i.getArgument(0))).toList());
        when(activity.save(any())).thenAnswer(i->{IpVideoEffectActivity a=i.getArgument(0);states.put(a.getOwnerUserId()+":"+a.getEffectId(),a);return a;});
        when(activity.findByOwnerUserIdAndEffectId(anyString(),anyString())).thenAnswer(i->Optional.ofNullable(states.get(i.getArgument(0)+":"+i.getArgument(1))));
        when(activity.findByOwnerUserId(anyString())).thenAnswer(i->states.values().stream().filter(a->a.getOwnerUserId().equals(i.getArgument(0))).toList());
        var user=AepUser.builder().id("owner").displayName("本人名称").build();when(em.find(AepUser.class,"owner")).thenReturn(user);when(em.find(AepUser.class,"owner",LockModeType.PESSIMISTIC_WRITE)).thenReturn(user);
        var endpoint=AiModelEndpoint.builder().id("h3").enabled(true).build();when(models.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION,"h3")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
        when(models.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION,"other")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
        when(projects.requireOwnedAssetKey(eq("owner"),anyString())).thenAnswer(i->{String key=i.getArgument(1);if(!key.startsWith("own/"))throw BusinessException.badRequest("IP_ASSET_KEY_INVALID","foreign");return key;});
        var file=dir.resolve("preview.png");javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(2,2,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",file.toFile());when(storage.openForRead("own/preview")).thenReturn(file);when(storage.signedUrl(anyString())).thenReturn("signed-temporary-url");
    }
    Effect publish(List<String> allowed,String key){return service.publish("owner",new Publish("光影","产品材质","完整效果描述",List.of("产品","光影"),allowed,"personal",key));}
    @Test void publicationIsImmutableAndContainsNoPersistedSignedUrlOrClientAuthor() {
        var a=publish(List.of("h3"),"own/preview");var b=publish(List.of(),null);assertNotEquals(a.id(),b.id());assertEquals("本人名称",a.author());assertEquals("signed-temporary-url",a.previewUrl());assertEquals("own/preview",catalog.get(a.id()).getPreviewKey());assertEquals("完整效果描述",catalog.get(a.id()).getPrompt());assertEquals(2,catalog.size());
    }
    @Test void foreignPreviewAndDisguisedAudioAreRejectedBeforePublication()throws Exception {
        assertThrows(BusinessException.class,()->publish(List.of(),"foreign/preview"));var file=dir.resolve("fake.png");Files.writeString(file,"not an image");when(storage.openForRead("own/preview")).thenReturn(file);assertThrows(BusinessException.class,()->publish(List.of(),"own/preview"));assertTrue(catalog.isEmpty());
    }
    @Test void unavailableModelAndOversizedTagsNeverWriteARelease() {
        assertThrows(BusinessException.class,()->publish(List.of("missing"),null));assertThrows(BusinessException.class,()->service.publish("owner",new Publish("n","","p",List.of("x".repeat(33)),List.of(),"personal",null)));assertTrue(catalog.isEmpty());
    }
    @Test void ownerIsolationAppliesToListFavoriteAndApply() {
        var e=publish(List.of(),null);assertTrue(service.list("stranger").isEmpty());assertThrows(BusinessException.class,()->service.favorite("stranger",e.id(),true));assertThrows(BusinessException.class,()->service.apply("stranger",e.id(),"h3"));verify(activity,never()).save(any());
    }
    @Test void favoritesAndRecentAreAccountPersistentAndIndependent() {
        var e=publish(List.of("h3"),null);service.favorite("owner",e.id(),true);var applied=service.apply("owner",e.id(),"h3");assertTrue(applied.favorite());assertNotNull(applied.lastUsedAt());service.favorite("owner",e.id(),false);var restored=service.list("owner").get(0);assertFalse(restored.favorite());assertEquals(applied.lastUsedAt(),restored.lastUsedAt());assertEquals(1,states.size());
        var order=inOrder(em,activity);order.verify(em).find(AepUser.class,"owner",LockModeType.PESSIMISTIC_WRITE);order.verify(activity).findByOwnerUserIdAndEffectId("owner",e.id());
    }
    @Test void incompatibleAndUnavailableModelsDoNotMarkUse() {
        var e=publish(List.of("h3"),null);assertThrows(BusinessException.class,()->service.apply("owner",e.id(),"other"));assertThrows(BusinessException.class,()->service.apply("owner",e.id(),"missing"));assertThrows(BusinessException.class,()->service.apply("owner",e.id(),null));assertTrue(states.isEmpty());
    }
    @Test void generalInstructionsStillRequireAConfiguredModel() {var e=publish(List.of(),null);assertEquals(e.prompt(),service.apply("owner",e.id(),"other").prompt());}
}

package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.director.DirectorWorkRepository;
import com.aistareco.aep.ipstudio.model.IpLibraryRecord;
import com.aistareco.aep.ipstudio.model.IpSavedAsset;
import com.aistareco.aep.ipstudio.repository.IpLibraryRecordRepository;
import com.aistareco.aep.ipstudio.repository.IpProjectRepository;
import com.aistareco.aep.ipstudio.repository.IpSavedAssetRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 资产来自哪部作品、哪张画布：只列真有内容的，已删除的标出来，别人的 id 不算。 */
class IpLibrarySourcesTest {
    @Test void listsSourcesThatActuallyHaveContentAndMarksDeletedOnes() {
        IpProjectRepository projects = mock(IpProjectRepository.class);
        DirectorWorkRepository works = mock(DirectorWorkRepository.class);
        IpSavedAssetRepository saved = mock(IpSavedAssetRepository.class);
        IpLibraryRecordRepository records = mock(IpLibraryRecordRepository.class);
        when(projects.namesOf("u")).thenReturn(List.of(new Object[]{"IPP-1", "废市", null}, new Object[]{"IPP-2", "没用过的画布", null}));
        when(works.namesOf("u")).thenReturn(java.util.Collections.singletonList(new Object[]{"DW-1", "食神", Instant.now()}));
        when(saved.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc("u")).thenReturn(List.of(
                IpSavedAsset.builder().id("a").ownerUserId("u").payloadJson("{\"metadata\":{\"projectId\":\"DW-1\"}}").build(),
                IpSavedAsset.builder().id("b").ownerUserId("u").payloadJson("{\"metadata\":{\"projectId\":\"IPP-1\"}}").build(),
                IpSavedAsset.builder().id("c").ownerUserId("u").payloadJson("{\"metadata\":{\"projectId\":\"IPP-others\"}}").build(),
                IpSavedAsset.builder().id("d").ownerUserId("u").payloadJson("{\"metadata\":{}}").build()));
        when(records.findByOwnerUserIdAndRecordTypeAndDeletedAtIsNullOrderByCreatedAtDesc("u", "object")).thenReturn(List.of(
                IpLibraryRecord.builder().id("o").ownerUserId("u").recordType("object").payloadJson("{\"sources\":[{\"projectId\":\"DW-1\"}]}").build()));

        var list = new IpLibrarySources(projects, works, saved, records, new ObjectMapper()).list("u");

        assertEquals(List.of("DW-1", "IPP-1"), list.stream().map(s -> s.id()).toList());
        assertEquals("director", list.get(0).type());
        assertTrue(list.get(0).deleted());
        assertEquals(2, list.get(0).count());
        assertFalse(list.get(1).deleted());
    }
}

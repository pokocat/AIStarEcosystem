package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.repository.IpDemoTemplateRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.HashSet;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioScenePresetsTest {
    @Test void bothScenesHaveOnlyOrdinaryEditableNodesAndValidEdges() {
        var mapper=new ObjectMapper();
        for(boolean commerce:new boolean[]{true,false}) {
            var doc=StudioScenePresets.document(mapper,commerce);
            var ids=new HashSet<String>();doc.path("nodes").forEach(n->ids.add(n.path("id").asText()));
            assertEquals(4,ids.size());assertEquals(3,doc.path("connections").size());
            doc.path("connections").forEach(e->{assertTrue(ids.contains(e.path("fromNodeId").asText()));assertTrue(ids.contains(e.path("toNodeId").asText()));});
            assertFalse(doc.has("commerce"));assertFalse(doc.toString().contains("storageKey"));
            assertEquals("script",IpDocs.node(doc,"script").path("metadata").path("studio").path("kind").asText());
        }
    }
    @Test void startupNeverOverwritesOrReenablesExistingTemplates() {
        var repository=mock(IpDemoTemplateRepository.class);
        when(repository.existsById(anyString())).thenReturn(true);
        new StudioScenePresets(repository,new ObjectMapper()).seed();
        verify(repository,never()).save(any());
    }
}

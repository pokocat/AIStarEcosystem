package com.aistareco.aep.service;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.model.MixcutAsset;
import com.aistareco.aep.repository.MixcutAssetRepository;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.mixcut.MixcutAssetService;
import com.aistareco.aep.service.storage.FileStorageService;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MixcutAssetServiceTest {

    private final MixcutAssetRepository repo = mock(MixcutAssetRepository.class);
    private final MixcutAssetService service = new MixcutAssetService(
            new MixcutProperties(),
            repo,
            mock(FfmpegRunner.class),
            mock(FileStorageService.class)
    );

    @Test
    void deleteOfficialSoftDeletesWithoutRemovingRowOrFile() {
        var asset = new MixcutAsset();
        asset.setId("official_demo");
        asset.setKind("video");
        asset.setName("官方片段");
        asset.setOfficial(true);
        asset.setOfficialCategory("live");
        asset.setRelatedStarId("star_1");
        when(repo.findById("official_demo")).thenReturn(Optional.of(asset));
        when(repo.save(any(MixcutAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        assertTrue(service.deleteOfficial("official_demo"));

        assertNotNull(asset.getDeletedAt());
        verify(repo).findById("official_demo");
        verify(repo).save(asset);
        verify(repo, never()).delete(any(MixcutAsset.class));
        verifyNoMoreInteractions(repo);
    }

    @Test
    void deleteOfficialRejectsAlreadySoftDeletedClip() {
        var asset = new MixcutAsset();
        asset.setId("official_deleted");
        asset.setOfficial(true);
        asset.setDeletedAt(java.time.OffsetDateTime.now());
        when(repo.findById("official_deleted")).thenReturn(Optional.of(asset));

        assertFalse(service.deleteOfficial("official_deleted"));

        verify(repo).findById("official_deleted");
        verifyNoMoreInteractions(repo);
    }
}

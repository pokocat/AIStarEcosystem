package com.aistareco.aep.dap;

import com.aistareco.aep.config.DapBuiltinPublicAvatarSeeder;
import com.aistareco.aep.dap.model.DapPublicAvatar;
import com.aistareco.aep.dap.repository.DapPublicAvatarRepository;
import com.aistareco.aep.dap.service.DapCatalogService;
import com.aistareco.aep.dap.service.DapPublicAvatarService;
import com.aistareco.aep.ipstudio.service.StudioIpAssetService;
import com.aistareco.aep.dap.repository.*;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.Instant;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 官方形象目录、历史素材访问、入库与使用权限。 */
class DapOfficialAvatarAccessTest {
    private final DapPublicAvatarRepository repo = mock(DapPublicAvatarRepository.class);
    private final FileStorageService storage = mock(FileStorageService.class);
    private final DapPublicAvatarService service = new DapPublicAvatarService(repo, storage);

    DapOfficialAvatarAccessTest() {
        when(storage.allocateKey(eq(DapPublicAvatarService.CATEGORY), isNull(), anyString())).thenReturn("dap_plaza/probe.png");
    }

    private DapPublicAvatar avatar(String id, String access, String front) {
        return DapPublicAvatar.builder().id(id).name(id).access(access).frontKey(front).cat("pro").build();
    }

    @Test
    void freeOfficialImagesAreUsableByAnyone() {
        when(repo.findByImageKey("dap_plaza/free.jpg")).thenReturn(List.of(avatar("PA-01", "free", "dap_plaza/free.jpg")));
        assertTrue(service.usableImageKey("someone", "dap_plaza/free.jpg"));
    }

    @Test
    void licensedOrUnknownOrOutsideTheCategoryIsRejected() {
        when(repo.findByImageKey("dap_plaza/paid.jpg")).thenReturn(List.of(avatar("PA-x", "license", "dap_plaza/paid.jpg")));
        when(repo.findByImageKey("dap_plaza/legacy.jpg")).thenReturn(List.of(avatar("PA-y", null, "dap_plaza/legacy.jpg")));
        assertFalse(service.usableImageKey("u", "dap_plaza/paid.jpg"));
        assertFalse(service.usableImageKey("u", "dap_plaza/legacy.jpg"), "V81 之前的行按需授权处理");
        assertFalse(service.usableImageKey("u", "dap_plaza/not-registered.jpg"));
        // 运营后台能手填 key：别人的私有图即便登记成免费也不放行
        when(repo.findByImageKey("ipstudio_source/other/private.png")).thenReturn(List.of(avatar("PA-z", "free", "ipstudio_source/other/private.png")));
        assertFalse(service.usableImageKey("u", "ipstudio_source/other/private.png"));
        verify(repo, never()).findByImageKey("ipstudio_source/other/private.png");
        assertFalse(service.usableImageKey(null, "dap_plaza/paid.jpg"));
    }

    @Test
    void studioOfficialLibraryListsEveryOfficialAvatarWithItsAccess() {
        var library = new StudioIpAssetService(mock(DapAvatarRepository.class), mock(DapAvatarVersionRepository.class), storage, mock(DapLookRepository.class));
        ReflectionTestUtils.setField(library, "publicAvatars", repo);
        ReflectionTestUtils.setField(library, "publicAvatarService", service);
        var free = avatar("PA-01", "free", "dap_plaza/a.jpg"); free.setRightKey("dap_plaza/a-r.jpg");
        free.setThreeViewKey("dap_plaza/a-sheet.jpg");
        when(repo.findAllNewestFirst()).thenReturn(List.of(free, avatar("PA-02", "license", "dap_plaza/b.jpg"), avatar("PA-03", "free", null)));
        var assets = library.officialAssets();
        assertEquals(4, assets.size(), "没有图的不列；需授权的列出来但标 license");
        assertEquals("official:PA-01", assets.get(0).avatarId());
        assertEquals("main", assets.get(0).assetRole());
        assertEquals("free", assets.get(0).access());
        assertEquals("pro", assets.get(0).category());
        assertEquals("three-view", assets.get(1).assetRole());
        assertEquals("dap_plaza/a-sheet.jpg", assets.get(1).storageKey());
        assertEquals("side", assets.get(2).assetRole());
        assertEquals("license", assets.get(3).access());
        assertEquals("official", assets.get(3).librarySource());
        when(repo.findByImageKey("dap_plaza/a-sheet.jpg")).thenReturn(List.of(free));
        assertTrue(service.usableImageKey("someone", "dap_plaza/a-sheet.jpg"));
    }

    @Test
    void retiredAvatarsLeaveBothCatalogsWhileTheirOldReferencesRemainReadable() {
        var library = new StudioIpAssetService(mock(DapAvatarRepository.class), mock(DapAvatarVersionRepository.class), storage, mock(DapLookRepository.class));
        ReflectionTestUtils.setField(library, "publicAvatars", repo);
        var catalog = new DapCatalogService();
        for (String id : List.of("PA-07", "PA-08", "PA-09")) {
            var retired = avatar(id, "free", "dap_plaza/" + id + ".jpg");
            when(repo.findAllNewestFirst()).thenReturn(List.of(retired));
            when(repo.findById(id)).thenReturn(Optional.of(retired));
            when(repo.findByImageKey(retired.getFrontKey())).thenReturn(List.of(retired));
            assertTrue(library.officialAssets().isEmpty());
            assertTrue(service.listPublicWire().isEmpty());
            assertNull(service.findWire(id));
            assertNull(service.findEntity(id));
            assertNull(catalog.publicAvatar(id));
            assertTrue(service.usableImageKey("someone", retired.getFrontKey()));
        }
    }

    @Test
    void builtinAvatarsAreStoredOnceAndMarkedFree() throws Exception {
        var configs = mock(PlatformConfigService.class);
        when(storage.storeAllocated(any(Path.class), eq(DapPublicAvatarService.CATEGORY), eq("platform"), anyString(), eq("image/jpeg")))
                .thenAnswer(i -> new FileStorageService.StoredFile(i.getArgument(3), null, null, null, 1, "image/jpeg"));
        var catalog = new DapCatalogService();
        assertEquals(Map.of("pro", 10L, "life", 10L, "ugc", 10L, "community", 10L,
                "teacher", 2L, "civil-service", 2L, "urban", 2L, "medical", 2L, "shopkeeper", 2L, "family", 2L), catalog.publicAvatars().stream()
                .collect(Collectors.groupingBy(a -> (String) a.get("cat"), Collectors.counting())));
        var saved = new ArrayList<DapPublicAvatar>();
        when(repo.existsById("PA-01")).thenReturn(true); // 已在库里的不重复写
        when(repo.save(any())).thenAnswer(i -> { saved.add(i.getArgument(0)); return i.getArgument(0); });

        var created = new DapBuiltinPublicAvatarSeeder(catalog, repo, storage, configs, new ObjectMapper()).seed();

        assertEquals(51, created.size());
        assertFalse(created.contains("PA-01"));
        assertEquals(51, saved.stream().map(DapPublicAvatar::getId).distinct().count());
        assertTrue(saved.stream().allMatch(a -> "free".equals(a.getAccess()) && a.getFrontKey() != null && a.getThreeViewKey() != null));
        assertEquals(6, saved.stream().filter(a -> a.getRightKey() != null && a.getLeftKey() != null).count());
        verify(configs).seedIfAbsent(eq(DapBuiltinPublicAvatarSeeder.MARKER), any(), anyString());
        verify(configs).seedIfAbsent(eq(DapBuiltinPublicAvatarSeeder.EXPANSION_MARKER), any(), anyString());

        when(configs.findByKey(DapBuiltinPublicAvatarSeeder.MARKER)).thenReturn(Optional.of(new com.aistareco.aep.dto.PlatformConfigDto(DapBuiltinPublicAvatarSeeder.MARKER, null, 1, null, null, null)));
        when(configs.findByKey(DapBuiltinPublicAvatarSeeder.EXPANSION_MARKER)).thenReturn(Optional.of(new com.aistareco.aep.dto.PlatformConfigDto(DapBuiltinPublicAvatarSeeder.EXPANSION_MARKER, null, 1, null, null, null)));
        when(configs.findByKey(DapBuiltinPublicAvatarSeeder.DRAMA_ROLES_MARKER)).thenReturn(Optional.of(new com.aistareco.aep.dto.PlatformConfigDto(DapBuiltinPublicAvatarSeeder.DRAMA_ROLES_MARKER, null, 1, null, null, null)));
        assertTrue(new DapBuiltinPublicAvatarSeeder(catalog, repo, storage, configs, new ObjectMapper()).seed().isEmpty(), "做过一次就不再写");
    }

    @Test
    void existingInstallationBackfillsOnlyExistingOriginalsAndStillSeedsTheExpansion() throws Exception {
        var configs = mock(PlatformConfigService.class);
        when(configs.findByKey(DapBuiltinPublicAvatarSeeder.MARKER)).thenReturn(Optional.of(
                new com.aistareco.aep.dto.PlatformConfigDto(DapBuiltinPublicAvatarSeeder.MARKER, null, 1, null, null, null)));
        when(repo.findById("PA-01")).thenReturn(Optional.of(avatar("PA-01", "license", "dap_plaza/existing.jpg")));
        when(storage.storeAllocated(any(Path.class), eq(DapPublicAvatarService.CATEGORY), eq("platform"), anyString(), eq("image/jpeg")))
                .thenAnswer(i -> new FileStorageService.StoredFile(i.getArgument(3), null, null, null, 1, "image/jpeg"));
        var catalog = new DapCatalogService();

        var created = new DapBuiltinPublicAvatarSeeder(catalog, repo, storage, configs, new ObjectMapper()).seed();

        assertEquals(45, created.size());
        assertTrue(created.contains("PA-11"));
        assertFalse(created.contains("PA-02"));
        verify(repo).setBuiltinThreeViewIfMissing(eq("PA-01"), eq("dap_plaza/platform/PA-01-three-view.jpg"), any(Instant.class));
        verify(repo, never()).save(argThat(a -> "PA-01".equals(a.getId())));
    }

    @Test
    void threeViewMigrationPreservesExistingAvatarRowsAndCanResume() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:official_avatar_three_view", "sa", "");
             var sql = connection.createStatement()) {
            var context = mock(org.flywaydb.core.api.migration.Context.class);
            when(context.getConnection()).thenReturn(connection);
            var migration = new db.migration.V85__dap_public_avatar_three_view();
            migration.migrate(context);
            sql.execute("CREATE TABLE dap_public_avatar (id VARCHAR(32) PRIMARY KEY, front_key VARCHAR(512))");
            sql.execute("INSERT INTO dap_public_avatar VALUES ('PA-01', 'dap_plaza/existing.jpg')");
            migration.migrate(context);
            migration.migrate(context);
            try (var row = sql.executeQuery("SELECT front_key, three_view_key FROM dap_public_avatar WHERE id = 'PA-01'")) {
                assertTrue(row.next());
                assertEquals("dap_plaza/existing.jpg", row.getString("front_key"));
                assertNull(row.getString("three_view_key"));
            }
        }
    }

    @Test
    void deletingAUsersAvatarNeverDeletesTheSharedOfficialImage() {
        var trash = new com.aistareco.aep.dap.service.DapTrashService(mock(DapAvatarRepository.class), mock(DapAvatarVersionRepository.class), mock(DapLookRepository.class),
                mock(DapDerivativeRepository.class), mock(DapPhotoRepository.class), mock(DapCaptureRepository.class), mock(DapLicenseRepository.class), mock(DapJobRepository.class),
                storage, mock(com.aistareco.aep.dap.config.DapProperties.class));
        // 「另存为我的数字人」后，用户的数字人直接引用官方图。
        var copy = com.aistareco.aep.dap.model.DapAvatar.builder().id("DH-1").ownerUserId("u").imageKey("dap_plaza/a.jpg")
                .shotKeys(new LinkedHashMap<>(Map.of("right", "media/dap_plaza/a-r.jpg", "mine", "ipstudio_gen/u/own.png"))).build();
        trash.hardDelete(copy);
        verify(storage, never()).delete("dap_plaza/a.jpg");
        verify(storage, never()).delete("media/dap_plaza/a-r.jpg");
        verify(storage).delete("ipstudio_gen/u/own.png");
    }
}

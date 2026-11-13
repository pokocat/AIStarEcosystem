package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.config.FileStorageProperties;
import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseBuilder;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseType;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StudioMediaJobsTest {
    @TempDir Path temp;

    @Test void savesLongOriginalAndCanRetryAndExtractASegmentWithoutChangingIt() throws Exception {
        var database = new EmbeddedDatabaseBuilder().generateUniqueName(true).setType(EmbeddedDatabaseType.H2)
                .addScript("db/migration/V84__studio_media_jobs.sql").build();
        try {
            var jdbc = new JdbcTemplate(database);
            var properties = new FileStorageProperties();
            properties.setLocalDir(temp.resolve("storage").toString());
            var storage = new FileStorageService(properties, null, CdnUrlSigner.NOOP);
            var quota = mock(StorageQuotaService.class);
            var owner = mock(AepUserRepository.class);
            when(owner.findByIdForUpdate("owner")).thenReturn(Optional.of(new AepUser()));
            var projects = mock(IpProjectService.class);
            when(projects.requireOwnedAssetKey(eq("owner"), anyString())).thenAnswer(call -> call.getArgument(1));
            var library = mock(IpLibraryService.class);
            var ffmpeg = spy(new FfmpegRunner(new MixcutProperties()));
            var media = spy(new StudioMediaImportService(storage, ffmpeg));
            var jobs = new StudioMediaJobs(jdbc, new DataSourceTransactionManager(database), new ObjectMapper(),
                    storage, quota, projects, library, owner, media);

            Path input = temp.resolve("long.mp4");
            ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi", "-i", "color=red:s=64x48:r=10",
                    "-f", "lavfi", "-i", "color=blue:s=64x48:r=10", "-filter_complex",
                    "[0:v]trim=duration=61[a];[1:v]trim=duration=61[b];[a][b]concat=n=2:v=1:a=0",
                    "-c:v", "mpeg4", "-threads", "1", input.toString()), 20_000);
            byte[] original = Files.readAllBytes(input);
            var upload = media.accept("owner", new MockMultipartFile("file", "long.mp4", "video/mp4", original),
                    "video", "folder", true, jobs);
            String job = upload.jobId();
            assertNotNull(job);
            assertNull(upload.key());
            assertEquals("queued", jobs.status("owner", job).status());
            assertThrows(BusinessException.class, () -> jobs.status("someone-else", job));

            doThrow(new IOException("fixture interrupted")).doCallRealMethod()
                    .when(media).renderVideo(any(), any(), isNull(), isNull());
            jobs.dispatch();
            assertEquals("failed", jobs.status("owner", job).status());
            assertEquals("queued", jobs.retry("owner", job).status());
            jobs.dispatch();
            var normalized = jobs.status("owner", job).result();
            assertNotNull(normalized);
            assertEquals(122, normalized.durationSec(), .1);
            assertEquals("h264", ffmpeg.probeMedia(storage.openForRead(normalized.key()).toFile()).videoCodec());
            assertFalse(jdbc.queryForObject("SELECT result_json FROM studio_media_job WHERE id=?", String.class, job)
                    .contains(normalized.url()));
            var originalCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
            verify(media).saveAsset(eq("owner"), any(), eq("folder"), originalCaptor.capture());
            assertArrayEquals(original, Files.readAllBytes(storage.openForRead(originalCaptor.getValue())));

            assertThrows(BusinessException.class, () -> jobs.clip("owner",
                    new StudioMediaJobs.ClipRequest(normalized.key(), "long.mp4", 0, 61, null)));
            var request = new StudioMediaJobs.ClipRequest(normalized.key(), "long.mp4", 62, 75, UUID.randomUUID());
            var excerpt = jobs.clip("owner", request);
            assertEquals(excerpt.id(), jobs.clip("owner", request).id());
            assertThrows(BusinessException.class, () -> jobs.clip("owner",
                    new StudioMediaJobs.ClipRequest(normalized.key(), "long.mp4", 62, 76, request.requestId())));
            jobs.dispatch();
            var clip = jobs.status("owner", excerpt.id()).result();
            assertNotNull(clip);
            assertNotEquals(normalized.key(), clip.key());
            assertEquals(13, clip.durationSec(), .15);
            Path frame = temp.resolve("frame.png");
            ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-i", storage.openForRead(clip.key()).toString(),
                    "-frames:v", "1", "-threads", "1", frame.toString()), 10_000);
            var pixel = new java.awt.Color(javax.imageio.ImageIO.read(frame.toFile()).getRGB(24, 20));
            assertTrue(pixel.getBlue() > 150 && pixel.getRed() < 40, "Excerpt starts after the source changes to blue");
            assertArrayEquals(original, Files.readAllBytes(storage.openForRead(originalCaptor.getValue())));
            assertEquals("done", jobs.retry("owner", excerpt.id()).status());
            verify(quota, times(3)).record(eq("aiavatar"), eq("owner"), anyString(), isNull(), anyString(), anyLong());
        } finally {
            database.shutdown();
        }
    }
}

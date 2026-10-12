package com.aistareco.aep.ipstudio.dto;
import java.util.List;
import com.fasterxml.jackson.databind.JsonNode;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
/** Wire mirror: packages/types/src/ip-asset-library.ts. */
public final class IpLibraryDtos {
    private IpLibraryDtos() {}
    public record LibraryFolder(String id,String name) {}
    public record LibrarySource(String id,String projectId,String nodeId,String title,String evidence,String description) {}
    public record LibraryVersion(String id,String storageKey,String url,String prompt,String createdAt,String runId,boolean mock) {}
    public record LibraryObject(String id,String kind,String name,String description,String prompt,String folderId,String referenceKey,
            String referenceUrl,String mainVersionId,List<LibraryVersion> versions,List<LibrarySource> sources,IpRunDto pendingRun,String createdAt,String updatedAt) {}
    public record LibraryCandidate(String key,String kind,String name,String description,String evidence,String reuseId) {}
    public record LibraryExtraction(String sourceHash,String title,List<LibraryCandidate> items,IpRunDto run) {}
    public record LibraryPage<T>(List<T> items,int page,long total,boolean hasMore) {}
    public record LibraryObjectEdit(String name,String description,String prompt,String folderId,String referenceKey,String mainVersionId,String updatedAt) {}
    public record LibraryGenerateRequest(String clientRequestId,String model,String aspectRatio,Long maxCost) {}
    public record ExtractRequest(String nodeId,boolean analyze,Integer episodeNo,String clientRequestId,String model,Long maxCost) {}
    public record SaveExtractRequest(String nodeId,String sourceHash,String folderId,List<LibraryCandidate> items) {}
    public record UploadVersionRequest(String storageKey,boolean main) {}
}

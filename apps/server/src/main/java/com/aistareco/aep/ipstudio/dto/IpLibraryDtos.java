package com.aistareco.aep.ipstudio.dto;
import java.util.List;
import com.fasterxml.jackson.databind.JsonNode;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
/** Wire mirror: packages/types/src/ip-asset-library.ts. */
public final class IpLibraryDtos {
    private IpLibraryDtos() {}
    public record LibraryFolder(String id,String name) {}
    /** origin：空 = 剧本提取；director = 导演台那一项自动建的卡；director-link = 导演台关联来用的；canvas = 从画布存的。 */
    public record LibrarySource(String id,String projectId,String nodeId,String title,String evidence,String description,String origin) {}
    /** label：这一张是什么（导演台的角色形态名、场景视角），主图没有。 */
    public record LibraryVersion(String id,String storageKey,String url,String prompt,String createdAt,String runId,boolean mock,String label) {
        public LibraryVersion(String id,String storageKey,String url,String prompt,String createdAt,String runId,boolean mock){this(id,storageKey,url,prompt,createdAt,runId,mock,null);}
    }
    public record LibraryObject(String id,String kind,String name,String description,String prompt,String folderId,String referenceKey,
            String referenceUrl,String mainVersionId,List<LibraryVersion> versions,List<LibrarySource> sources,IpRunDto pendingRun,String createdAt,String updatedAt) {}
    public record LibraryCandidate(String key,String kind,String name,String description,String evidence,String reuseId) {}
    public record LibraryExtraction(String sourceHash,String title,List<LibraryCandidate> items,IpRunDto run) {}
    public record LibraryPage<T>(List<T> items,int page,long total,boolean hasMore) {}
    public record LibraryObjectEdit(String name,String description,String prompt,String folderId,String referenceKey,String mainVersionId,String updatedAt) {}
    public record LibraryGenerateRequest(String clientRequestId,String model,String aspectRatio,Long maxCost,com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billing) {
        public LibraryGenerateRequest(String clientRequestId,String model,String aspectRatio,Long maxCost){this(clientRequestId,model,aspectRatio,maxCost,null);}
    }
    public record ExtractRequest(String nodeId,boolean analyze,Integer episodeNo,String clientRequestId,String model,Long maxCost,com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billing) {
        public ExtractRequest(String nodeId,boolean analyze,Integer episodeNo,String clientRequestId,String model,Long maxCost){this(nodeId,analyze,episodeNo,clientRequestId,model,maxCost,null);}
    }
    public record SaveExtractRequest(String nodeId,String sourceHash,String folderId,List<LibraryCandidate> items) {}
    public record UploadVersionRequest(String storageKey,boolean main) {}
    /** 一张已有的图存成角色、场景或道具：给 objectId 就加到那一项，否则按 kind + name 新建。clientRequestId 防重复提交。 */
    public record SaveMediaRequest(String clientRequestId,String storageKey,String objectId,String kind,String name,String description,String folderId,String projectId,String nodeId) {}
    /** 资产库里东西的来源：type=director 导演台作品 / canvas 画布。deleted=true 表示作品或画布已删除，资产还在。 */
    public record LibrarySourceOption(String id,String type,String title,boolean deleted,long count) {}
}

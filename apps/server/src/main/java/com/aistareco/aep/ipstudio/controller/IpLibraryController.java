package com.aistareco.aep.ipstudio.controller;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.ipstudio.dto.IpLibraryDtos.*;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.common.ApiResponse;
import com.aistareco.aep.dto.PageEnvelope;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.security.Principal;
import java.util.*;
@RestController @RequestMapping("/api/v1/ip-studio")
public class IpLibraryController {
    private final IpLibraryService library;private final IpSavedAssetService saved;private final StudioMediaImportService imports;
    public IpLibraryController(IpLibraryService library,IpSavedAssetService saved,StudioMediaImportService imports){this.library=library;this.saved=saved;this.imports=imports;}
    private static <T>PageEnvelope<T> page(LibraryPage<T> p){return new PageEnvelope<>(true,p.items(),new PageEnvelope.PaginationMeta(p.page(),24,p.total(),(int)Math.ceil(p.total()/24.0),p.hasMore(),p.page()>0),null);}
    @GetMapping("/library/folders") public ApiResponse<List<LibraryFolder>> folders(Principal p){return ApiResponse.of(library.folders(p.getName()));}
    @PostMapping("/library/folders") public ApiResponse<LibraryFolder> createFolder(Principal p,@RequestBody Map<String,String> body){return ApiResponse.of(library.folder(p.getName(),null,body.get("name")));}
    @PutMapping("/library/folders/{id}") public ApiResponse<LibraryFolder> renameFolder(Principal p,@PathVariable String id,@RequestBody Map<String,String> body){return ApiResponse.of(library.folder(p.getName(),id,body.get("name")));}
    @DeleteMapping("/library/folders/{id}") public ApiResponse<Void> removeFolder(Principal p,@PathVariable String id){library.deleteFolder(p.getName(),id);return ApiResponse.of(null);}
    @GetMapping("/library/objects") public PageEnvelope<LibraryObject> objects(Principal p,@RequestParam(required=false)String folder,@RequestParam(required=false)String query,@RequestParam(defaultValue="all")String status,@RequestParam(defaultValue="0")int page,@RequestParam(required=false)String projectId,@RequestParam(required=false)String nodeId){return page(library.objects(p.getName(),folder,query,status,page,projectId,nodeId));}
    @PostMapping("/library/objects") public ApiResponse<LibraryObject> create(Principal p,@RequestBody JsonNode body){var item=new LibraryCandidate(UUID.randomUUID().toString(),body.path("kind").asText(),body.path("name").asText(),body.path("description").asText(),"",null);return ApiResponse.of(library.create(p.getName(),item,body.path("folderId").asText(null)));}
    @GetMapping("/library/objects/{id}") public ApiResponse<LibraryObject> object(Principal p,@PathVariable String id){return ApiResponse.of(library.object(p.getName(),id));}
    @PatchMapping("/library/objects/{id}") public ApiResponse<LibraryObject> edit(Principal p,@PathVariable String id,@RequestBody JsonNode body){return ApiResponse.of(library.edit(p.getName(),id,body));}
    @DeleteMapping("/library/objects/{id}") public ApiResponse<Void> remove(Principal p,@PathVariable String id){library.remove(p.getName(),id);return ApiResponse.of(null);}
    @PostMapping("/library/objects/{id}/versions") public ApiResponse<LibraryObject> version(Principal p,@PathVariable String id,@RequestBody UploadVersionRequest body){return ApiResponse.of(library.upload(p.getName(),id,body));}
    @PostMapping("/library/objects/{id}/generate") public ApiResponse<IpRunDto> generate(Principal p,@PathVariable String id,@RequestBody LibraryGenerateRequest body){return ApiResponse.of(library.generate(p.getName(),id,body));}
    @GetMapping("/library/materials") public PageEnvelope<JsonNode> materials(Principal p,@RequestParam(required=false)String folder,@RequestParam(required=false)String query,@RequestParam(defaultValue="all")String kind,@RequestParam(defaultValue="0")int page){return page(saved.page(p.getName(),folder,query,kind,page));}
    @PatchMapping("/library/materials/{id}") public ApiResponse<JsonNode> editMaterial(Principal p,@PathVariable String id,@RequestBody JsonNode body){if(body.has("folderId"))library.checkFolder(p.getName(),body.path("folderId").asText(null));return ApiResponse.of(saved.edit(p.getName(),id,body));}
    @PostMapping("/library/uploads") public ApiResponse<StudioMediaImportService.MediaImportResult> upload(Principal p,@RequestParam MultipartFile file,@RequestParam(defaultValue="image")String mediaType,@RequestParam(required=false)String folderId){library.checkFolder(p.getName(),folderId);var result=imports.upload(p.getName(),file,mediaType);library.saveUpload(p.getName(),result,folderId);return ApiResponse.of(result);}
    @GetMapping("/projects/{projectId}/library/folder") public ApiResponse<Map<String,String>> canvasFolder(Principal p,@PathVariable String projectId){String folder=library.canvasFolder(p.getName(),projectId);return ApiResponse.of(Map.of("folderId",folder==null?"":folder));}
    @PutMapping("/projects/{projectId}/library/folder") public ApiResponse<Void> setCanvasFolder(Principal p,@PathVariable String projectId,@RequestBody Map<String,String> body){library.setCanvasFolder(p.getName(),projectId,body.get("folderId"));return ApiResponse.of(null);}
    @PostMapping("/projects/{projectId}/library/extract") public ApiResponse<LibraryExtraction> extract(Principal p,@PathVariable String projectId,@RequestBody ExtractRequest body){return ApiResponse.of(library.extract(p.getName(),projectId,body));}
    @PostMapping("/projects/{projectId}/library/save-extraction") public ApiResponse<List<LibraryObject>> saveExtraction(Principal p,@PathVariable String projectId,@RequestBody SaveExtractRequest body){return ApiResponse.of(library.saveExtraction(p.getName(),projectId,body));}
}

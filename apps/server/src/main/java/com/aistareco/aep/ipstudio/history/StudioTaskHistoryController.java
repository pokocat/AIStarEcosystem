package com.aistareco.aep.ipstudio.history;

import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

/** 账号「任务历史」：只读本人的生成记录与积分消耗。 */
@RestController
@RequestMapping("/api/v1/ip-studio")
public class StudioTaskHistoryController {
    private final StudioTaskHistoryService service;
    private final StudioStorageService storage;
    private final StudioStorageBackfill backfill;
    private final StudioTrashService trash;
    private final StudioStorageGuard guard;

    public StudioTaskHistoryController(StudioTaskHistoryService service, StudioStorageService storage, StudioStorageBackfill backfill,
                                       StudioTrashService trash, StudioStorageGuard guard) {
        this.service = service;
        this.storage = storage;
        this.backfill = backfill;
        this.trash = trash;
        this.guard = guard;
    }

    /** 从回收站彻底删除画布（只删画布与历史版本，生成记录和文件保留）。 */
    @org.springframework.web.bind.annotation.DeleteMapping("/projects/{id}/purge")
    public ApiResponse<java.util.Map<String, Object>> purgeCanvas(Principal principal, @org.springframework.web.bind.annotation.PathVariable String id) {
        trash.purgeCanvas(principal.getName(), id);
        return ApiResponse.of(java.util.Map.of("id", id, "purged", true));
    }

    /** 从回收站彻底删除导演台作品（只删作品本身，生成记录和文件保留）。 */
    @org.springframework.web.bind.annotation.DeleteMapping("/director/works/{id}/purge")
    public ApiResponse<java.util.Map<String, Object>> purgeWork(Principal principal, @org.springframework.web.bind.annotation.PathVariable String id) {
        trash.purgeWork(principal.getName(), id);
        return ApiResponse.of(java.util.Map.of("id", id, "purged", true));
    }

    /** 回收站规则：到期自动清理的天数（0 = 不自动清理）。 */
    @GetMapping("/trash/policy")
    public ApiResponse<java.util.Map<String, Object>> trashPolicy() {
        return ApiResponse.of(java.util.Map.of("retentionDays", trash.retentionDays(), "storageEnforced", guard.enforced()));
    }

    /** 账号「存储用量」：数字资产与 IP Studio 生成、上传文件合并成一个口径。第一次打开先补记历史文件。 */
    @GetMapping("/storage")
    public ApiResponse<StudioStorageService.Usage> storage(Principal principal) {
        backfill.backfillAsync(principal.getName());
        return ApiResponse.of(storage.usage(principal.getName()));
    }

    @GetMapping("/task-history")
    public ApiResponse<StudioTaskHistoryService.Page> list(Principal principal,
                                                          @RequestParam(required = false) String status,
                                                          @RequestParam(required = false) String type,
                                                          @RequestParam(defaultValue = "30") int days,
                                                          @RequestParam(defaultValue = "0") int page) {
        return ApiResponse.of(service.list(principal.getName(), status, type, days, page));
    }
}

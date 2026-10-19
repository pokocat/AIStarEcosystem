package com.aistareco.aep.enterprise.controller;
import com.aistareco.aep.enterprise.dto.*;
import com.aistareco.aep.enterprise.service.*;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.common.ApiResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/admin/finance/enterprises")
@PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")
public class AdminEnterpriseQueryController {
    private final EnterpriseQueryService query;private final EnterpriseRechargeService finance;private final EnterprisePointsService points;
    public AdminEnterpriseQueryController(EnterpriseQueryService query,EnterpriseRechargeService finance,EnterprisePointsService points){this.query=query;this.finance=finance;this.points=points;}
    @GetMapping public PageEnvelope<EnterpriseDtos.Enterprise> list(@RequestParam(required=false)String search,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int limit){return PageEnvelope.from(query.enterprises(search,page,limit));}
    @GetMapping("/{id}/wallet") public ApiResponse<EnterpriseRechargeDtos.WalletSummary> wallet(@PathVariable String id){return ApiResponse.of(finance.adminWallet(id));}
    @GetMapping("/{id}/member-balances") public PageEnvelope<EnterpriseRechargeDtos.MemberBalance> members(@PathVariable String id,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int limit){return PageEnvelope.from(finance.adminMemberBalances(id,page,limit));}
    @GetMapping("/{id}/points/transfers") public PageEnvelope<EnterprisePointsDtos.Transfer> transfers(@PathVariable String id,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int limit){return PageEnvelope.from(points.adminTransfers(id,page,limit));}
    @GetMapping("/{id}/usage") public PageEnvelope<EnterpriseUsageDto> usage(@PathVariable String id,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int limit){return PageEnvelope.from(query.adminUsage(id,page,limit));}
}

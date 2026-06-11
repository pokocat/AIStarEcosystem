package com.aistareco.aep.dto;

import com.aistareco.aep.model.StarContract;

/** 合同 DTO（= TS StarContract）。 */
public record StarContractDto(
        String id,
        String title,
        StarContract.ContractType type,
        String mcnName,
        String ipName,
        String signDate,
        String startDate,
        String endDate,
        long amountCents,
        StarContract.Status status
) {
    public static StarContractDto from(StarContract c) {
        return new StarContractDto(
                c.getId(),
                c.getTitle(),
                c.getType(),
                c.getMcnName(),
                c.getIpName(),
                c.getSignDate() != null ? c.getSignDate().toString() : null,
                c.getStartDate() != null ? c.getStartDate().toString() : null,
                c.getEndDate() != null ? c.getEndDate().toString() : null,
                c.getAmountCents(),
                c.getStatus()
        );
    }
}

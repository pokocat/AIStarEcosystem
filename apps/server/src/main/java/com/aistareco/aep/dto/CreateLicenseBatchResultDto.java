package com.aistareco.aep.dto;

import java.util.List;

/**
 * Admin create-batch result. rawCodes is returned once when initial keys are minted;
 * the database stores only hashes and masked codes.
 */
public record CreateLicenseBatchResultDto(
        LicenseBatchDto batch,
        List<String> rawCodes
) {}

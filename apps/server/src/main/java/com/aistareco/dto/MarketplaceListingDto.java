package com.aistareco.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Matches TypeScript MarketplaceListing. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MarketplaceListingDto(
        String  id,
        String  artistId,
        String  name,
        String  style,
        String  avatarUrl,
        String  priceLabel,
        String  owner,
        int     songs,
        String  followersLabel,
        String  description,
        Boolean autoReplyEnabled
) {}

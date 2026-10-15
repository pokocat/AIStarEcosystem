package com.aistareco.aep.enterprise.dto;

import java.time.Instant;
import java.util.List;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import java.io.IOException;

/** Mirrors enterprise.ts; amounts are integral credits. Null means reclaim all available. */
public final class EnterprisePointsDtos {
    private EnterprisePointsDtos() {}
    public record Item(String memberId, @JsonDeserialize(using=IntegralAmount.class) Long amount) {}
    public record PreviewRequest(List<Item> items) {}
    public record SubmitRequest(String clientRequestId, String confirmationFingerprint, List<Item> items) {}
    public record PreviewItem(String memberId, long amount, long availableBefore, long availableAfter, long pendingBalance) {}
    public record Preview(String enterpriseId, String direction, int memberCount, long totalAmount,
                          long rootAvailableBefore, long rootAvailableAfter, String confirmationFingerprint,
                          List<PreviewItem> items) {}
    public record Transfer(String id, String batchId, String enterpriseId, String memberId, String memberName, String direction,
                           long amount, String status, Instant createdAt, String fromWalletId, String toWalletId,
                           long fromGift, long fromLicense, long fromRecharge, String outLedgerId, String inLedgerId) {}
    public record Batch(String id, String enterpriseId, String direction, long totalAmount, List<Transfer> transfers, Instant createdAt) {}
    public static final class IntegralAmount extends JsonDeserializer<Long> {
        @Override public Long deserialize(JsonParser parser,DeserializationContext context) throws IOException {
            if(parser.currentToken()!=JsonToken.VALUE_NUMBER_INT)
                return (Long)context.handleUnexpectedToken(Long.class,parser);
            return parser.getLongValue();
        }
    }
}

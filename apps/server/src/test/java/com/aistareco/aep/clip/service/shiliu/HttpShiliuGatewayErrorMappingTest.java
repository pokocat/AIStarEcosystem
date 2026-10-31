package com.aistareco.aep.clip.service.shiliu;

import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 石榴上游错误码 → 我方错误码的映射。
 *
 * 钉住一条实测回归：石榴把 code=1 当通用兜底码用，真实语义只在 msg 里
 * （{@code code=1 msg=账户权益不足，无法进行声音克隆}）。这条原先落到 default 变成
 * 502 CLIP_ENGINE_CALL_FAILED，端上再统一显示「军师服务暂不可用」——
 * 于是"运营该去充值"被伪装成"我们的服务故障"，每次都得上服务器翻日志才知道真因。
 */
class HttpShiliuGatewayErrorMappingTest {

    @Test
    @DisplayName("code=1 + 权益不足文案 → 判为「克隆权益不足」，且不得引向充值或删除")
    void capacityFullIsRecognisedFromMessage() {
        // 石榴这句「账户权益不足」词不达意：实测真因是持有数量占满（availableAvatar/Speaker=0
        // 而 validPoint 还有 3418）。按字面当成余额不足会让运营去充值，钱花了问题还在。
        BusinessException e = HttpShiliuGateway.mappedUpstreamFailure(1, "账户权益不足，无法进行声音克隆");
        assertThat(e.getCode()).isEqualTo("CLIP_ENGINE_CAPACITY_FULL");
        assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(e.getMessage()).contains("克隆权益不足");
        // 两个都不能提：充点数没用（validPoint 还剩 3418），删旧对象也没用（删空后仍为 0）
        assertThat(e.getMessage()).doesNotContain("充值");
        assertThat(e.getMessage()).doesNotContain("删除");
        // 原始上游文案要留在内部细节里供排查，但不进用户可见的 message
        assertThat(e.getInternalDetail()).contains("账户权益不足");
    }

    @Test
    @DisplayName("从响应体分类要读供应商原话：对外的 reason 已把权益说法换成通用句，拿它判会退回笼统 502")
    void envelopeClassificationReadsSupplierWording() throws Exception {
        var envelope = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree("{\"code\":1,\"msg\":\"账户权益不足，无法进行声音克隆\"}");
        String diagnostic = com.aistareco.aep.service.ai.ProviderErrorMessage.diagnosticReason(envelope);
        assertThat(HttpShiliuGateway.mappedUpstreamFailure(1, diagnostic).getCode()).isEqualTo("CLIP_ENGINE_CAPACITY_FULL");
        assertThat(com.aistareco.aep.service.ai.ProviderErrorMessage.reason(envelope)).doesNotContain("权益");
    }

    @Test
    @DisplayName("余额、未知配额和克隆权益不能互相替代")
    void balanceAndUnspecifiedQuotaAreNotCloneEntitlements() {
        assertThat(HttpShiliuGateway.mappedUpstreamFailure(1,"账户权益不足").getCode()).isEqualTo("CLIP_ENGINE_CAPACITY_FULL");
        var balance=HttpShiliuGateway.mappedUpstreamFailure(1,"余额不足，请充值，剩余 ¥0.0123");
        assertThat(balance.getCode()).isEqualTo("CLIP_ENGINE_BALANCE_INSUFFICIENT");
        assertThat(balance.getMessage()).doesNotContain("余额").doesNotContain("充值").doesNotContain("0.0123");
        for (String msg : new String[]{"额度不足", "已超出配额"}) {
            var error=HttpShiliuGateway.mappedUpstreamFailure(1,msg);
            assertThat(error.getCode()).isEqualTo("CLIP_ENGINE_CALL_FAILED");
            assertThat(error.getMessage()).doesNotContain("克隆权益").doesNotContain("充值");
            assertThat(error.getInternalDetail()).contains(msg);
        }
    }

    @Test
    @DisplayName("鉴权类文案 → 判为凭证失效")
    void credentialFailureIsRecognisedFromMessage() {
        BusinessException e = HttpShiliuGateway.mappedUpstreamFailure(1, "鉴权失败，密钥无效");
        assertThat(e.getCode()).isEqualTo("CLIP_ENGINE_CREDENTIAL_INVALID");
        assertThat(e.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test void theWordTokenAloneDoesNotProveACredentialFailure() {
        assertThat(HttpShiliuGateway.mappedUpstreamFailure(1,"输入超过最大 token 数量").getCode()).isEqualTo("CLIP_ENGINE_CALL_FAILED");
        assertThat(HttpShiliuGateway.mappedUpstreamFailure(1,"invalid token").getCode()).isEqualTo("CLIP_ENGINE_CREDENTIAL_INVALID");
        assertThat(HttpShiliuGateway.mappedUpstreamFailure(1,"token 已过期").getCode()).isEqualTo("CLIP_ENGINE_CREDENTIAL_INVALID");
    }

    @Test
    @DisplayName("认不出来的仍回原来的 502，不比现状更差")
    void unknownMessageFallsBackToGatewayFailure() {
        BusinessException e = HttpShiliuGateway.mappedUpstreamFailure(1, "服务器开小差了");
        assertThat(e.getCode()).isEqualTo("CLIP_ENGINE_CALL_FAILED");
        assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY);
    }

    @Test
    @DisplayName("空消息不得抛 NPE")
    void nullMessageIsSafe() {
        assertThat(HttpShiliuGateway.mappedUpstreamFailure(1, null).getCode()).isEqualTo("CLIP_ENGINE_CALL_FAILED");
    }

    @Test
    @DisplayName("已有的数字错误码分支不受影响")
    void numericCodesStillWin() {
        // 2002 是石榴的数字错误码，语义明确为额度不足，与上面按文案兜底的容量判定互不影响
        assertThat(HttpShiliuGateway.mappedUpstreamFailure(2002, "whatever").getCode())
                .isEqualTo("CLIP_ENGINE_BALANCE_INSUFFICIENT");
        var privateBalance=HttpShiliuGateway.mappedUpstreamFailure(2002,"预扣费额度失败，用户剩余额度 ¥0.0123，需要 ¥0.4567");
        assertThat(privateBalance.getMessage()).isEqualTo(com.aistareco.aep.service.ai.PublicModelErrorPolicy.UNAVAILABLE);
        assertThat(HttpShiliuGateway.mappedUpstreamFailure(3004, "whatever").getCode())
                .isEqualTo("CLIP_ENGINE_AUDIO_TOO_SHORT");
        assertThat(HttpShiliuGateway.mappedUpstreamFailure(3003, "whatever").getStatus())
                .isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
    }
}

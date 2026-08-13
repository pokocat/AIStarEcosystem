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
    @DisplayName("code=1 + 权益不足文案 → 判为额度不足，而不是笼统的调用失败")
    void balanceExhaustedIsRecognisedFromMessage() {
        BusinessException e = HttpShiliuGateway.mappedUpstreamFailure(1, "账户权益不足，无法进行声音克隆");
        assertThat(e.getCode()).isEqualTo("CLIP_ENGINE_BALANCE_INSUFFICIENT");
        assertThat(e.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(e.getMessage()).contains("额度不足");
        // 原始上游文案要留在内部细节里供排查，但不进用户可见的 message
        assertThat(e.getInternalDetail()).contains("账户权益不足");
    }

    @Test
    @DisplayName("额度不足的多种说法都要认出来")
    void balanceKeywordVariants() {
        for (String msg : new String[]{"账户权益不足", "余额不足，请充值", "额度不足", "已超出配额"}) {
            assertThat(HttpShiliuGateway.mappedUpstreamFailure(1, msg).getCode())
                    .as("文案「%s」应判为额度不足", msg)
                    .isEqualTo("CLIP_ENGINE_BALANCE_INSUFFICIENT");
        }
    }

    @Test
    @DisplayName("鉴权类文案 → 判为凭证失效")
    void credentialFailureIsRecognisedFromMessage() {
        BusinessException e = HttpShiliuGateway.mappedUpstreamFailure(1, "鉴权失败，密钥无效");
        assertThat(e.getCode()).isEqualTo("CLIP_ENGINE_CREDENTIAL_INVALID");
        assertThat(e.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
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
        assertThat(HttpShiliuGateway.mappedUpstreamFailure(2002, "whatever").getCode())
                .isEqualTo("CLIP_ENGINE_BALANCE_INSUFFICIENT");
        assertThat(HttpShiliuGateway.mappedUpstreamFailure(3004, "whatever").getCode())
                .isEqualTo("CLIP_ENGINE_AUDIO_TOO_SHORT");
        assertThat(HttpShiliuGateway.mappedUpstreamFailure(3003, "whatever").getStatus())
                .isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
    }
}

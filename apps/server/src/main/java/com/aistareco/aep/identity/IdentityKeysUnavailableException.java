package com.aistareco.aep.identity;

import org.springframework.security.oauth2.jwt.JwtException;

/**
 * 没有公钥可以判断这个令牌：账号中心连不上，而且本地没有能对上这个令牌的公钥。
 *
 * <p>和「令牌无效」不一样：调用方要回 503、不能回 401。前端收到 401 会清令牌、把用户踢回登录页，
 * 而这个令牌可能好好的（{@code packages/api-client/src/auth-status.ts}）。
 */
public class IdentityKeysUnavailableException extends JwtException {

    public IdentityKeysUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}

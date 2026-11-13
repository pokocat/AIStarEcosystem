package com.aistareco.aep.service.cdn;

import com.aistareco.common.BusinessException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.util.Date;
import java.util.Locale;
import java.util.Set;

/** Called after the product has authorized the storage key. */
@Service
public class VideoDownloadLinks {
    private static final long TTL_SECONDS = 600;
    private static final Set<String> VIDEO_EXTENSIONS = Set.of("mp4", "mov", "webm", "m4v");
    private final CdnUrlSigner signer;
    private final SecretKey grantKey;

    public VideoDownloadLinks(CdnUrlSigner signer, @Value("${aep.jwt.secret}") String secret) {
        this.signer = signer;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            grantKey = Keys.hmacShaKeyFor(mac.doFinal("aep/video-download/v1".getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Video download signing unavailable", e);
        }
    }

    public record Grant(String ticket) {}
    public record Links(String previewUrl, String downloadUrl, String filename, long expiresAt) {}

    public Grant issue(String key, String name) {
        int dot = key == null ? -1 : key.lastIndexOf('.');
        String ext = dot < 0 ? "" : key.substring(dot + 1).toLowerCase(Locale.ROOT);
        if (!VIDEO_EXTENSIONS.contains(ext)) {
            throw BusinessException.badRequest("VIDEO_DOWNLOAD_INVALID", "没有可下载的视频");
        }
        String base = name == null ? "" : name.replaceAll("[\\p{Cntrl}\\\\/:*?\"<>|]", "_").strip();
        if (base.toLowerCase(Locale.ROOT).endsWith("." + ext)) {
            base = base.substring(0, base.length() - ext.length() - 1).strip();
        }
        if (base.isBlank()) base = "视频";
        String filename = base.substring(0, base.offsetByCodePoints(0, Math.min(80, base.codePointCount(0, base.length())))) + "." + ext;
        String ticket = Jwts.builder().subject(key).claim("filename", filename)
                .expiration(Date.from(Instant.now().plusSeconds(TTL_SECONDS))).signWith(grantKey).compact();
        return new Grant(ticket);
    }

    public Links redeem(String ticket) {
        if (ticket == null || ticket.length() > 4096) throw expired();
        String key;
        String filename;
        long expiresAt;
        try {
            var claims = Jwts.parser().verifyWith(grantKey).build().parseSignedClaims(ticket).getPayload();
            key = claims.getSubject();
            filename = claims.get("filename", String.class);
            Date expiry = claims.getExpiration();
            if (key == null || filename == null || expiry == null) throw expired();
            expiresAt = expiry.getTime();
        } catch (JwtException | IllegalArgumentException e) {
            throw expired();
        }
        long remainingSeconds = (expiresAt - System.currentTimeMillis()) / 1000;
        if (remainingSeconds <= 0) throw expired();
        String previewUrl = signer.signKey(key, remainingSeconds);
        String downloadUrl = signer.downloadUrlForKey(key, filename, remainingSeconds);
        if (previewUrl == null || downloadUrl == null) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "VIDEO_DOWNLOAD_UNAVAILABLE", "视频下载暂不可用，请重试");
        }
        return new Links(previewUrl, downloadUrl, filename, expiresAt);
    }

    private static BusinessException expired() {
        return new BusinessException(HttpStatus.GONE, "VIDEO_DOWNLOAD_EXPIRED", "下载链接已失效，请返回作品页重新下载");
    }
}

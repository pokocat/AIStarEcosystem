package com.aistareco.aep.service.sms;

import com.aistareco.common.BusinessException;
import io.lettuce.core.*;
import io.lettuce.core.api.StatefulRedisConnection;
import jakarta.annotation.PreDestroy;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

/** Atomic single-key state shared by both API nodes. No code or phone is stored in clear text. */
@Component
@ConditionalOnProperty(name="aep.sms.code.store",havingValue="tair")
public class TairSmsCodeStore implements AutoCloseable {
    private final RedisClient client;
    private final StatefulRedisConnection<String,String> connection;
    private final byte[] secret;
    private final String prefix;
    private static final String RESERVE="""
        local old=redis.call('GET',KEYS[1]); local ttl=redis.call('PTTL',KEYS[1]); local now=tonumber(ARGV[1]);
        if old then
          local e=cjson.decode(old)
          if tonumber(e.locked or 0)>now then return {'LOCK',tostring(math.ceil((e.locked-now)/1000))} end
          if now-e.sent<tonumber(ARGV[2]) then return {'RATE',tostring(math.ceil((tonumber(ARGV[2])-now+e.sent)/1000))} end
          if e.pending then return {'RATE','1'} end
        end
        redis.call('SET',KEYS[1],cjson.encode({sent=now,purpose=ARGV[3],hash=ARGV[4],pending=ARGV[5],failures=0}), 'PX',ARGV[6])
        return {'OK',old or '',tostring(ttl)}
        """;
    private static final String COMPLETE="""
        local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end
        local e=cjson.decode(raw); if e.pending~=ARGV[1] then return 0 end
        e.pending=nil; local ttl=redis.call('PTTL',KEYS[1]); if ttl<=0 then return 0 end
        redis.call('SET',KEYS[1],cjson.encode(e),'PX',ttl); return 1
        """;
    private static final String CANCEL="""
        local raw=redis.call('GET',KEYS[1]); if not raw or cjson.decode(raw).pending~=ARGV[1] then return 0 end
        local ttl=tonumber(ARGV[3])-tonumber(ARGV[4]);
        if ARGV[2]~='' and ttl>0 then redis.call('SET',KEYS[1],ARGV[2],'PX',ttl) else redis.call('DEL',KEYS[1]) end
        return 1
        """;
    private static final String VERIFY="""
        local raw=redis.call('GET',KEYS[1]); if not raw then return {'MISSING'} end
        local e=cjson.decode(raw); local now=tonumber(ARGV[1]);
        if e.purpose~=ARGV[2] or e.pending then return {'MISSING'} end
        if tonumber(e.locked or 0)>now then return {'LOCK',tostring(math.ceil((e.locked-now)/1000))} end
        if now-e.sent>tonumber(ARGV[3]) then redis.call('DEL',KEYS[1]); return {'EXPIRED'} end
        if e.hash~=ARGV[4] then
          e.failures=e.failures+1;local ttl=redis.call('PTTL',KEYS[1]);
          if e.failures>=tonumber(ARGV[5]) then e.locked=now+tonumber(ARGV[6]);e.hash='';ttl=math.max(ttl,tonumber(ARGV[6]));redis.call('SET',KEYS[1],cjson.encode(e),'PX',ttl);return {'LOCK',tostring(math.ceil(tonumber(ARGV[6])/1000))} end
          redis.call('SET',KEYS[1],cjson.encode(e),'PX',math.max(1,ttl));return {'INVALID',tostring(tonumber(ARGV[5])-e.failures)}
        end
        redis.call('DEL',KEYS[1]);return {'OK'}
        """;
    public TairSmsCodeStore(@Value("${aep.sms.tair.url}") String url,
                            @Value("${aep.sms.tair.prefix:aistar:prod:sms:v1:}") String prefix,
                            @Value("${aep.secret-key:${AEP_SECRET_KEY:}}") String secret) {
        RedisURI uri;try{uri=RedisURI.create(url);}catch(RuntimeException e){throw new IllegalArgumentException("Invalid shared SMS connection configuration");}uri.setTimeout(Duration.ofSeconds(2));
        if(!prefix.matches("aistar:[a-z0-9-]+:sms:v1:"))throw new IllegalArgumentException("Dedicated AIStar SMS prefix required");
        if(secret==null||secret.length()<32)throw new IllegalArgumentException("Existing high entropy SMS hashing key required");
        this.prefix=prefix;this.secret=secret.getBytes(StandardCharsets.UTF_8);client=RedisClient.create(uri);
        try{connection=client.connect();if(!"PONG".equals(connection.sync().ping()))throw new IllegalStateException("Tair unavailable");}
        catch(RuntimeException e){client.shutdown();throw new IllegalStateException("Shared SMS state unavailable");}
    }
    private String hash(String value) {
        try{Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(secret,"HmacSHA256"));return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));}
        catch(java.security.GeneralSecurityException e){throw new IllegalStateException(e);}
    }
    public record Reservation(String key,String token,String previous,long previousTtl,long started) {}
    public Reservation reserve(String phone,SmsCodePurpose purpose,String code,long ttl,long rate) {
        String key=prefix+hash(phone),token=UUID.randomUUID().toString();long now=System.currentTimeMillis();
        List<Object> result=eval(RESERVE,key,""+now,""+(rate*1000),purpose.wire(),hash(phone+"\0"+code),token,""+(Math.max(ttl,rate)*1000));
        check(result,purpose);return new Reservation(key,token,result.get(1).toString(),Long.parseLong(result.get(2).toString()),now);
    }
    public void complete(Reservation r) {
        try{Long ok=connection.sync().eval(COMPLETE,ScriptOutputType.INTEGER,new String[]{r.key()},r.token());if(ok==null||ok!=1)throw new IllegalStateException("SMS reservation expired");}
        catch(RuntimeException e){throw unavailable();}
    }
    public void cancel(Reservation r) {
        try{connection.sync().eval(CANCEL,ScriptOutputType.INTEGER,new String[]{r.key()},r.token(),r.previous(),""+r.previousTtl(),""+(System.currentTimeMillis()-r.started()));}
        catch(RuntimeException ignored){/* Retain reservation until TTL on uncertain state; never bypass the limiter. */}
    }
    public void verify(String phone,String code,SmsCodePurpose purpose,long ttl,int maxFailures,long lock) {
        check(eval(VERIFY,prefix+hash(phone),""+System.currentTimeMillis(),purpose.wire(),""+(ttl*1000),hash(phone+"\0"+code),""+maxFailures,""+(lock*1000)),purpose);
    }
    private List<Object> eval(String script,String key,String... args) {
        try{return connection.sync().eval(script,ScriptOutputType.MULTI,new String[]{key},args);}
        catch(RuntimeException e){throw unavailable();}
    }
    private static BusinessException unavailable(){return new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"SMS_STATE_UNAVAILABLE","验证码服务暂时不可用，请稍后再试");}
    private static void check(List<Object> result,SmsCodePurpose purpose) {
        String code=result.get(0).toString();String n=result.size()>1?result.get(1).toString():"";
        switch(code){case "OK":return;
          case "LOCK":throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS,"SMS_CODE_LOCKED","手机号已被临时锁定，请稍后再试");
          case "RATE":throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS,"SMS_CODE_RATE_LIMITED","短信发送过于频繁，请 "+n+" 秒后再试");
          case "MISSING":throw new BusinessException(HttpStatus.BAD_REQUEST,"SMS_CODE_NOT_REQUESTED","请先获取"+purpose.label()+"验证码");
          case "EXPIRED":throw new BusinessException(HttpStatus.BAD_REQUEST,"SMS_CODE_EXPIRED","验证码已过期，请重新获取");
          case "INVALID":throw new BusinessException(HttpStatus.BAD_REQUEST,"SMS_CODE_INVALID","验证码错误，剩余 "+n+" 次机会");
          default:throw unavailable();}
    }
    public boolean ready(){try{return "PONG".equals(connection.sync().ping());}catch(RuntimeException e){return false;}}
    @PreDestroy @Override public void close(){connection.close();client.shutdown();}
}

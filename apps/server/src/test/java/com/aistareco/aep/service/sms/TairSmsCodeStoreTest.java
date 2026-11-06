package com.aistareco.aep.service.sms;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.*;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.*;
import io.lettuce.core.*;
import java.util.*;import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
@Testcontainers
class TairSmsCodeStoreTest {
 @Container static GenericContainer<?> REDIS=new GenericContainer<>("redis:7.0.15-alpine").withExposedPorts(6379);
 static final String KEY="test-only-secret-at-least-32-characters";
 TairSmsCodeStore a,b;String prefix;
 @BeforeEach void setup(){prefix="aistar:test-"+UUID.randomUUID().toString().replace("-","")+":sms:v1:";String url="redis://"+REDIS.getHost()+":"+REDIS.getMappedPort(6379);a=new TairSmsCodeStore(url,prefix,KEY);b=new TairSmsCodeStore(url,prefix,KEY);}
 @AfterEach void close(){a.close();b.close();}
 static SmsSendResult failedDelivery(){return new SmsSendResult(false,false,"synthetic","login",null,400,"REJECTED",null,null,null,SmsSendResult.DeliveryStatus.FAILED,null,null,null,null);}
 static void failure(String code,Runnable r){assertThatThrownBy(r::run).isInstanceOfSatisfying(BusinessException.class,e->assertThat(e.getCode()).isEqualTo(code));}
 SmsCodeService service(TairSmsCodeStore store,SmsSender sender){var s=new SmsCodeService(sender,6,300,60,5,1800,"log","123456");s.setSharedStore(store);return s;}
 @Test void codeIssuedOnAIsConsumedOnBWithPurposeAndReplayProtection(){var r=a.reserve("13800138001",SmsCodePurpose.LOGIN,"654321",300,60);a.complete(r);failure("SMS_CODE_NOT_REQUESTED",()->b.verify("13800138001","654321",SmsCodePurpose.REGISTER,300,5,1800));b.verify("13800138001","654321",SmsCodePurpose.LOGIN,300,5,1800);failure("SMS_CODE_NOT_REQUESTED",()->a.verify("13800138001","654321",SmsCodePurpose.LOGIN,300,5,1800));}
 @Test void rateLimitAndFailureLockAreShared(){var r=a.reserve("13800138002",SmsCodePurpose.LOGIN,"654321",300,60);a.complete(r);failure("SMS_CODE_RATE_LIMITED",()->b.reserve("13800138002",SmsCodePurpose.REGISTER,"111111",300,60));for(int i=0;i<4;i++)failure("SMS_CODE_INVALID",()->b.verify("13800138002","000000",SmsCodePurpose.LOGIN,300,5,1800));failure("SMS_CODE_LOCKED",()->a.verify("13800138002","000000",SmsCodePurpose.LOGIN,300,5,1800));failure("SMS_CODE_LOCKED",()->b.reserve("13800138002",SmsCodePurpose.LOGIN,"222222",300,60));}
 @Test void simultaneousVerificationSucceedsExactlyOnce()throws Exception {var r=a.reserve("13800138003",SmsCodePurpose.LOGIN,"654321",300,60);a.complete(r);var pool=Executors.newFixedThreadPool(8);var start=new CountDownLatch(1);try{var futures=new ArrayList<Future<Boolean>>();for(int i=0;i<16;i++){var s=i%2==0?a:b;futures.add(pool.submit(()->{start.await();try{s.verify("13800138003","654321",SmsCodePurpose.LOGIN,300,5,1800);return true;}catch(BusinessException e){assertThat(e.getCode()).isEqualTo("SMS_CODE_NOT_REQUESTED");return false;}}));}start.countDown();int n=0;for(var f:futures)if(f.get(10,TimeUnit.SECONDS))n++;assertThat(n).isEqualTo(1);}finally{pool.shutdownNow();}}
 @Test void pendingReservationCannotBeVerifiedOrSentTwice(){var r=a.reserve("13800138004",SmsCodePurpose.LOGIN,"654321",300,60);failure("SMS_CODE_NOT_REQUESTED",()->b.verify("13800138004","654321",SmsCodePurpose.LOGIN,300,5,1800));failure("SMS_CODE_RATE_LIMITED",()->b.reserve("13800138004",SmsCodePurpose.LOGIN,"654321",300,60));a.cancel(r);var retry=b.reserve("13800138004",SmsCodePurpose.LOGIN,"111111",300,60);b.complete(retry);a.verify("13800138004","111111",SmsCodePurpose.LOGIN,300,5,1800);}
 @Test void failedReplacementRestoresTheStillValidPriorCode(){var old=a.reserve("13800138009",SmsCodePurpose.LOGIN,"654321",300,0);a.complete(old);var next=b.reserve("13800138009",SmsCodePurpose.LOGIN,"111111",300,0);b.cancel(next);a.verify("13800138009","654321",SmsCodePurpose.LOGIN,300,5,1800);}
 @Test void sourcePhoneAndCodeAreNotStoredAsPlaintext(){var r=a.reserve("13800138005",SmsCodePurpose.LOGIN,"654321",300,60);a.complete(r);var client=RedisClient.create("redis://"+REDIS.getHost()+":"+REDIS.getMappedPort(6379));try(var c=client.connect()){var keys=c.sync().keys(prefix+"*");assertThat(keys).hasSize(1);assertThat(keys.get(0)).doesNotContain("13800138005");assertThat(c.sync().get(keys.get(0))).doesNotContain("654321","13800138005");}finally{client.shutdown();}}
 @Test void explicitProviderFailureReleasesOnlyOwnReservation(){var sender=mock(SmsSender.class);when(sender.sendVerificationCode(anyString(),anyString(),any())).thenThrow(new SmsSender.SmsSendException("rejected",failedDelivery()));failure("SMS_SEND_FAILED",()->service(a,sender).requestCode("13800138006"));var r=b.reserve("13800138006",SmsCodePurpose.LOGIN,"123456",300,60);b.complete(r);a.verify("13800138006","123456",SmsCodePurpose.LOGIN,300,5,1800);}
 @Test void unknownTransportFailureKeepsReservationAndPreventsDuplicateSend(){var sender=mock(SmsSender.class);when(sender.sendVerificationCode(anyString(),anyString(),any())).thenThrow(new SmsSender.SmsSendException("unknown acceptance"));assertThatThrownBy(()->service(a,sender).requestCode("13800138007")).isInstanceOf(BusinessException.class);failure("SMS_CODE_RATE_LIMITED",()->service(b,sender).requestCode("13800138007"));verify(sender,times(1)).sendVerificationCode(anyString(),anyString(),any());}
 @Test void serviceUsesSharedStoreAcrossRestart(){var sender=mock(SmsSender.class);service(a,sender).requestCode("13800138008");service(b,sender).verifyCode("13800138008","123456");failure("SMS_CODE_NOT_REQUESTED",()->service(a,sender).verifyCode("13800138008","123456"));verify(sender,times(1)).sendVerificationCode(anyString(),anyString(),any());}
}

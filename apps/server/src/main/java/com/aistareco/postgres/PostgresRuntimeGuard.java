package com.aistareco.postgres;

import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.sql.SQLException;
import java.util.*;

/** PostgreSQL 生产拒绝开发配置和运行期修表。 */
@Component @Profile("postgres")
public class PostgresRuntimeGuard {
    private final Environment env;private final DataSource source;
    public PostgresRuntimeGuard(Environment env,DataSource source){this.env=env;this.source=source;}
    @PostConstruct void validate() throws SQLException {
        var problems=inspect(env);
        if(!problems.isEmpty())throw new IllegalStateException("PostgreSQL 生产配置不完整："+String.join("；",problems));
        try(var c=source.getConnection();var s=c.createStatement()) {
            if(!"PostgreSQL".equals(c.getMetaData().getDatabaseProductName()) || c.getMetaData().getDatabaseMajorVersion()!=18)
                throw new IllegalStateException("postgres profile 必须连接 PostgreSQL 18");
            try(var r=s.executeQuery("SHOW TIME ZONE")){if(!r.next()||!"UTC".equalsIgnoreCase(r.getString(1)))throw new IllegalStateException("PostgreSQL 连接时区必须为 UTC");}
        }
    }
    static List<String> inspect(Environment env) {
        var problems=new ArrayList<String>();
        if(!Arrays.equals(env.getActiveProfiles(),new String[]{"postgres"}))problems.add("只允许单独启用 postgres profile");
        require(env,problems,"spring.jpa.hibernate.ddl-auto","validate");
        require(env,problems,"spring.flyway.enabled","true");
        require(env,problems,"spring.flyway.locations","classpath:db/postgresql");
        require(env,problems,"spring.flyway.baseline-on-migrate","false");
        require(env,problems,"aep.sms.code.store","tair");
        try { var uri=java.net.URI.create(env.getProperty("aep.sms.tair.url",""));
            if(!"rediss".equals(uri.getScheme())||uri.getHost()==null||uri.getRawUserInfo()==null)problems.add("aep.sms.tair.url 必须使用独立账号与TLS");
        } catch(IllegalArgumentException e) { problems.add("aep.sms.tair.url 配置无效"); }
        require(env,problems,"aep.cdn.driver","oss");require(env,problems,"aep.sms.driver","aliyun");
        for(String flag:List.of("aep.seed.dev-data.enabled","aep.dev-auth.enabled","aep.dap.allow-placeholder",
                "aep.dap.modelink.allow-mock","aep.payment.shadow.enabled","aep.clip.allow-mock","aep.clip.force-mock")) {
            if(env.getProperty(flag,Boolean.class,false))problems.add(flag+" 必须关闭");
        }
        return problems;
    }
    private static void require(Environment env,List<String> problems,String key,String expected) {
        if(!expected.equals(env.getProperty(key)))problems.add(key+" 必须为 "+expected);
    }
}

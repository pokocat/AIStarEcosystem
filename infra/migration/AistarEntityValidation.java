import java.nio.file.*;
import java.security.*;
import java.sql.*;
import java.util.*;
import jakarta.persistence.Entity;
import jakarta.persistence.Converter;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Validates every packaged entity against the real isolated RDS, without starting application services. */
public class AistarEntityValidation {
    public static void main(String[] args)throws Exception {
        if(args.length!=0)throw new IllegalArgumentException("No production target or arguments accepted");
        Path root=Path.of("/opt/aistar-migration/preparation");var json=new ObjectMapper();var config=json.readTree(Files.readString(root.resolve("resource-secrets.json")));
        String host=config.get("rds_host").asText(),db="aistar_schema_rehearsal",role="aistar_rehearsal";
        if(!host.equals("pgm-bp1gp4819mbs30z3.pg.rds.aliyuncs.com"))throw new IllegalStateException("Scope mismatch");
        String url="jdbc:postgresql://"+host+":5432/"+db+"?sslmode=verify-full&sslrootcert="+root.resolve("rds-ca.pem")+"&options=-c%20TimeZone%3DUTC&connectTimeout=10&socketTimeout=120";
        String password=config.get("rds_roles").get(role).asText();
        try(var c=DriverManager.getConnection(url,role,password);var s=c.createStatement();var rs=s.executeQuery("select current_database(),current_user,current_setting('TimeZone'),current_setting('server_version_num')::integer")) {
            rs.next();if(!db.equals(rs.getString(1))||!role.equals(rs.getString(2))||!"UTC".equals(rs.getString(3))||rs.getInt(4)/10000!=18)throw new IllegalStateException("RDS identity/version/timezone mismatch");
        }
        var registry=new StandardServiceRegistryBuilder().applySetting("hibernate.connection.url",url)
            .applySetting("hibernate.connection.username",role).applySetting("hibernate.connection.password",password)
            .applySetting("hibernate.dialect","org.hibernate.dialect.PostgreSQLDialect")
            .applySetting("hibernate.hbm2ddl.auto","validate").applySetting("hibernate.auto_quote_keyword",true)
            .applySetting("hibernate.jdbc.time_zone","UTC").applySetting("hibernate.default_schema","public")
            .applySetting("hibernate.physical_naming_strategy","org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy")
            .applySetting("hibernate.implicit_naming_strategy","org.springframework.boot.orm.jpa.hibernate.SpringImplicitNamingStrategy").build();
        int entities;
        try {
            var sources=new MetadataSources(registry);var scanner=new ClassPathScanningCandidateComponentProvider(false);
            scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));scanner.addIncludeFilter(new AnnotationTypeFilter(Converter.class));
            for(var bean:scanner.findCandidateComponents("com.aistareco"))sources.addAnnotatedClass(Class.forName(bean.getBeanClassName()));
            try(var factory=sources.buildMetadata().buildSessionFactory()){entities=factory.getMetamodel().getEntities().size();if(entities<180)throw new IllegalStateException("Incomplete model coverage");}
        } finally {StandardServiceRegistryBuilder.destroy(registry);}
        var result=new TreeMap<String,Object>();result.put("database",db);result.put("role",role);result.put("entity_count",entities);result.put("hibernate_validate_passed",true);result.put("strict_tls",true);result.put("timezone","UTC");result.put("business_services_started",false);result.put("external_jobs_submitted",false);result.put("production_changed",false);result.put("artifact_sha256",HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(root.resolve("validation-app.jar")))));
        Files.writeString(root.resolve("entity-validation.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(result));System.out.println("All "+entities+" packaged entities validated against isolated RDS; no service or worker started");
    }
}

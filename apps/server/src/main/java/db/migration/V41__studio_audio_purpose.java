package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import java.util.List;

/** Native ENUM columns are not widened by Hibernate update, including persistent H2. */
public class V41__studio_audio_purpose extends BaseJavaMigration {
    static final String VALUES="'SCRIPT_DRAFT','SELLING_POINTS','VARIABLE_EXTRACT','VIDEO_GENERATION',"
            +"'SAFETY_REVIEW','VIDEO_REF_ANALYSIS','TEMPLATE_REWRITE','APPEARANCE_FORGE','DRAMA_SCRIPT_DRAFT',"
            +"'IMAGE_GENERATION','DAP_PERSONA','DAP_IMAGE','DAP_VIDEO','DAP_AUDIO','DAP_REAL_AVATAR','MUSIC_GENERATION','GENERAL'";
    @Override public void migrate(Context context) throws Exception {
        var connection=context.getConnection();String product=connection.getMetaData().getDatabaseProductName();
        boolean h2="H2".equals(product),mysql=product.contains("MySQL")||product.contains("MariaDB");
        if(!h2&&!mysql)return;
        for(String table:List.of("ai_app_binding","ai_app_endpoint_candidate")) {
            try(var stmt=connection.createStatement();var cols=stmt.executeQuery("SELECT COUNT(*) FROM information_schema.columns WHERE LOWER(table_name)='"+table+"' AND LOWER(column_name)='purpose' AND table_schema="+(h2?"'PUBLIC'":"DATABASE()"))) {
                cols.next();if(cols.getInt(1)==0)continue; // Fresh schema is subsequently created by Hibernate.
            }
            try(var stmt=connection.createStatement()) {
                stmt.executeUpdate("ALTER TABLE "+table+(h2?" ALTER COLUMN ":" MODIFY COLUMN ")+"purpose ENUM("+VALUES+") NOT NULL");
            }
        }
    }
}

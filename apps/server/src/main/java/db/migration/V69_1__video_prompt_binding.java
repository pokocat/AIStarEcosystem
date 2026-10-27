package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import java.sql.Connection;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

/** 69.1 leaves the in-progress V70 migration free. Expand native enums before Hibernate validates them. */
public class V69_1__video_prompt_binding extends BaseJavaMigration {
    private static final String PURPOSE="DAP_VIDEO_PROMPT";

    @Override public void migrate(Context context) throws Exception {
        var c=context.getConnection();
        if(!exists(c,"ai_app_binding")||!exists(c,"ai_app_endpoint_candidate")||!exists(c,"ai_model_providers"))return;
        if(c.getMetaData().getDatabaseProductName().equalsIgnoreCase("MySQL")) {
            expandEnum(c,"ai_app_binding");
            expandEnum(c,"ai_app_endpoint_candidate");
        }
        String endpoint=null;
        try(var s=c.prepareStatement("SELECT endpoint_id FROM ai_app_binding WHERE purpose=?")) {
            s.setString(1,PURPOSE);
            try(var r=s.executeQuery()){if(r.next())endpoint=r.getString(1);}
        }
        if(endpoint==null) {
            // Only the initial binding names Qwen. Runtime selection always reads ai_app_binding.
            try(var s=c.prepareStatement("SELECT id FROM ai_model_providers WHERE id=? AND enabled=TRUE")) {
                s.setString(1,"ai-studio-jusuan-qwen38");
                try(var r=s.executeQuery()){if(r.next())endpoint=r.getString(1);}
            }
            if(endpoint==null)return;
            try(var s=c.prepareStatement("INSERT INTO ai_app_binding(purpose,endpoint_id,updated_at) VALUES(?,?,?)")) {
                s.setString(1,PURPOSE);s.setString(2,endpoint);s.setTimestamp(3,Timestamp.from(Instant.now()));s.executeUpdate();
            }
        }
        try(var s=c.prepareStatement("SELECT id FROM ai_app_endpoint_candidate WHERE purpose=? AND endpoint_id=?")) {
            s.setString(1,PURPOSE);s.setString(2,endpoint);
            try(var r=s.executeQuery()){if(r.next())return;}
        }
        try(var s=c.prepareStatement("INSERT INTO ai_app_endpoint_candidate(id,purpose,endpoint_id,sort_order,enabled,created_at,updated_at) VALUES(?,?,?,0,TRUE,?,?)")) {
            var now=Timestamp.from(Instant.now());
            s.setString(1,UUID.randomUUID().toString().replace("-",""));s.setString(2,PURPOSE);s.setString(3,endpoint);
            s.setTimestamp(4,now);s.setTimestamp(5,now);s.executeUpdate();
        }
    }

    private static boolean exists(Connection c,String table)throws Exception {
        try(var r=c.getMetaData().getTables(c.getCatalog(),null,"%",new String[]{"TABLE"})) {
            while(r.next())if(table.equalsIgnoreCase(r.getString("TABLE_NAME")))return true;
        }
        return false;
    }

    private static void expandEnum(Connection c,String table)throws Exception {
        String type;
        try(var s=c.createStatement();var r=s.executeQuery("SHOW COLUMNS FROM "+table+" LIKE 'purpose'")) {
            if(!r.next())return;type=r.getString("Type");
        }
        if(!type.startsWith("enum(")||type.contains("'"+PURPOSE+"'"))return;
        try(var s=c.createStatement()) {
            s.executeUpdate("ALTER TABLE "+table+" MODIFY COLUMN purpose "+type.substring(0,type.length()-1)+",'"+PURPOSE+"') NOT NULL");
        }
    }
}

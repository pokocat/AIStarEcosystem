package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import java.sql.Connection;

/**
 * 成片自动字幕的语音识别用途（2026-11-07）。只扩枚举，不建绑定：要在后台「AI 应用绑定」选好模型才生效，
 * 没绑定时导演台按镜头时间排字幕，一键成片不加字幕并如实说明（AGENTS §8.0 审计表）。
 */
public class V75__studio_transcribe_purpose extends BaseJavaMigration {
    private static final String PURPOSE="DAP_TRANSCRIBE";

    @Override public void migrate(Context context) throws Exception {
        var c=context.getConnection();
        for(String table:new String[]{"ai_app_binding","ai_app_endpoint_candidate"}) {
            if(!exists(c,table))continue;
            if(c.getMetaData().getDatabaseProductName().equalsIgnoreCase("MySQL"))expandEnum(c,table);else widenH2Enum(c,table);
        }
    }

    private static boolean exists(Connection c,String table)throws Exception {
        try(var r=c.getMetaData().getTables(c.getCatalog(),null,"%",new String[]{"TABLE"})) {
            while(r.next())if(table.equalsIgnoreCase(r.getString("TABLE_NAME")))return true;
        }
        return false;
    }

    /** 老的本地 H2 文件库留着 Hibernate 当年建的 ENUM 列，改成 VARCHAR（同 V69.1）。 */
    private static void widenH2Enum(Connection c,String table)throws Exception {
        String type=null;
        try(var s=c.prepareStatement("SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE UPPER(TABLE_NAME)=UPPER(?) AND UPPER(COLUMN_NAME)='PURPOSE'")) {
            s.setString(1,table);
            try(var r=s.executeQuery()){if(r.next())type=r.getString(1);}
        }
        if(type==null||!type.equalsIgnoreCase("ENUM"))return;
        try(var s=c.createStatement()){s.executeUpdate("ALTER TABLE "+table+" ALTER COLUMN purpose VARCHAR(64) NOT NULL");}
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

package db.migration;

import java.sql.Connection;
import java.util.*;
import org.flywaydb.core.api.migration.*;

/** Additive migration: legacy voice samples are not relabelled as trained profiles. */
public class V43__studio_voice_profiles extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        Connection c=context.getConnection();
        String avatar=table(c,"dap_avatar"),voice=table(c,"dap_voice");
        if(avatar!=null)add(c,avatar,"voice_id","VARCHAR(32)");
        if(voice!=null) {
            add(c,voice,"profile_version","INT");add(c,voice,"style_prompt","VARCHAR(160)");add(c,voice,"source_run_id","VARCHAR(32)");
            boolean indexed=false;
            try(var indexes=c.getMetaData().getIndexInfo(c.getCatalog(),null,voice,true,false)) {
                while(indexes.next())if("uk_dap_voice_source".equalsIgnoreCase(indexes.getString("INDEX_NAME")))indexed=true;
            }
            if(!indexed)try(var statement=c.createStatement()){statement.executeUpdate("CREATE UNIQUE INDEX uk_dap_voice_source ON "+voice+" (avatar_id,source_run_id)");}
        }
    }
    private static String table(Connection c,String wanted) throws Exception {
        try(var tables=c.getMetaData().getTables(c.getCatalog(),null,"%",new String[]{"TABLE"})) {
            while(tables.next())if(wanted.equalsIgnoreCase(tables.getString("TABLE_NAME")))return tables.getString("TABLE_NAME");
        }return null; // Fresh dev schema is created by Hibernate after Flyway.
    }
    private static void add(Connection c,String table,String column,String definition) throws Exception {
        try(var columns=c.getMetaData().getColumns(c.getCatalog(),null,table,"%")) {
            while(columns.next())if(column.equalsIgnoreCase(columns.getString("COLUMN_NAME")))return;
        }
        try(var statement=c.createStatement()){statement.executeUpdate("ALTER TABLE "+table+" ADD COLUMN "+column+" "+definition);}
    }
}

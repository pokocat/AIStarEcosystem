package db.migration;

import java.sql.Connection;
import org.flywaydb.core.api.migration.*;

/** Additive, restart-safe migration for existing H2/MySQL and a fresh Hibernate dev schema. */
public class V44__studio_template_versions extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        var c=context.getConnection();
        String demo=table(c,"ip_demo_template"),project=table(c,"ip_project");
        if(demo!=null) {add(c,demo,"visibility","VARCHAR(16) NOT NULL DEFAULT 'official'");add(c,demo,"current_version_id","VARCHAR(32)");}
        if(project!=null) {add(c,project,"template_version_id","VARCHAR(32)");add(c,project,"template_instance_json","LONGTEXT");}
        if(table(c,"ip_template_version")==null)try(var s=c.createStatement()) {
            s.executeUpdate("CREATE TABLE ip_template_version (id VARCHAR(32) PRIMARY KEY, template_id VARCHAR(32) NOT NULL, version_no INT NOT NULL, name VARCHAR(128) NOT NULL, summary VARCHAR(1024), recipe_json LONGTEXT NOT NULL, doc_json LONGTEXT NOT NULL, created_at TIMESTAMP(6) NOT NULL, CONSTRAINT uk_ip_template_version UNIQUE(template_id,version_no))");
        }
    }
    private static String table(Connection c,String wanted) throws Exception {
        try(var rows=c.getMetaData().getTables(c.getCatalog(),null,"%",new String[]{"TABLE"})) {while(rows.next())if(wanted.equalsIgnoreCase(rows.getString("TABLE_NAME")))return rows.getString("TABLE_NAME");}return null;
    }
    private static void add(Connection c,String table,String name,String definition) throws Exception {
        try(var rows=c.getMetaData().getColumns(c.getCatalog(),null,table,"%")){while(rows.next())if(name.equalsIgnoreCase(rows.getString("COLUMN_NAME")))return;}
        try(var s=c.createStatement()){s.executeUpdate("ALTER TABLE "+table+" ADD COLUMN "+name+" "+definition);}
    }
}

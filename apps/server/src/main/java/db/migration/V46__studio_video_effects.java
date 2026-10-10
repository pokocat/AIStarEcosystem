package db.migration;

import java.sql.Connection;
import org.flywaydb.core.api.migration.*;

/** Independent, additive catalogue. No existing document, template, job or ledger is rewritten. */
public class V46__studio_video_effects extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        var c=context.getConnection();
        if(!exists(c,"ip_video_effect"))try(var s=c.createStatement()) {
            s.executeUpdate("CREATE TABLE ip_video_effect (id VARCHAR(32) PRIMARY KEY, owner_user_id VARCHAR(64) NOT NULL, name VARCHAR(128) NOT NULL, summary VARCHAR(1024) NOT NULL, prompt LONGTEXT NOT NULL, author VARCHAR(128) NOT NULL, visibility VARCHAR(16) NOT NULL, tags_json LONGTEXT NOT NULL, models_json LONGTEXT NOT NULL, preview_key VARCHAR(512), created_at TIMESTAMP(6) NOT NULL)");
        }
        if(!exists(c,"ip_video_effect_activity"))try(var s=c.createStatement()) {
            s.executeUpdate("CREATE TABLE ip_video_effect_activity (id VARCHAR(32) PRIMARY KEY, owner_user_id VARCHAR(64) NOT NULL, effect_id VARCHAR(32) NOT NULL, favorite BOOLEAN NOT NULL, last_used_at TIMESTAMP(6), CONSTRAINT uk_ip_effect_activity UNIQUE(owner_user_id,effect_id))");
        }
        seed(c,"IPE-product-light-v1","产品光影展示","侧光扫过材质，保留产品形状与标识。","产品保持稳定，柔和的侧光缓慢扫过表面，依次展现材质纹理和轮廓，背景简洁，保留产品原有形状与标识。","[\"电商营销\",\"材质\",\"光影\"]");
        seed(c,"IPE-petal-dissolve-v1","花瓣消散","人物周围的花瓣随风散开，面部保持清晰。","细小花瓣在主体周围轻轻升起，随微风向画面边缘逐渐散开，主体面部和服装保持稳定清晰，运动连续自然。","[\"创意玩法\",\"花瓣\",\"人物\"]");
        seed(c,"IPE-space-reveal-v1","空间展开","从局部逐渐展现环境，保持建筑结构连续。","镜头从场景局部缓慢展开，空间中的前景、中景和背景依次显现，光线自然过渡，保持建筑结构连续，避免墙面或家具突然变形。","[\"空间\",\"场景\",\"展示\"]");
    }
    private static boolean exists(Connection c,String table)throws Exception{try(var r=c.getMetaData().getTables(c.getCatalog(),null,"%",new String[]{"TABLE"})){while(r.next())if(table.equalsIgnoreCase(r.getString("TABLE_NAME")))return true;}return false;}
    private static void seed(Connection c,String id,String name,String summary,String prompt,String tags)throws Exception {
        try(var check=c.prepareStatement("SELECT id FROM ip_video_effect WHERE id=?")){check.setString(1,id);try(var r=check.executeQuery()){if(r.next())return;}}
        try(var s=c.prepareStatement("INSERT INTO ip_video_effect (id,owner_user_id,name,summary,prompt,author,visibility,tags_json,models_json,created_at) VALUES (?,?,?,?,?,'IP Studio','official',?,'[]',CURRENT_TIMESTAMP)")) {
            s.setString(1,id);s.setString(2,"system");s.setString(3,name);s.setString(4,summary);s.setString(5,prompt);s.setString(6,tags);s.executeUpdate();
        }
    }
}

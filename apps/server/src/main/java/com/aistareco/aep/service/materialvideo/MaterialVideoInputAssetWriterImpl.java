package com.aistareco.aep.service.materialvideo;
import jakarta.persistence.EntityManager;
import org.hibernate.Session;
import java.sql.Timestamp;
import java.time.Instant;
/** 并发缓存回执必须原子更新，冲突只针对同一 id；不覆盖首次 source_key。 */
public class MaterialVideoInputAssetWriterImpl implements MaterialVideoInputAssetWriter {
    private final EntityManager entityManager;
    public MaterialVideoInputAssetWriterImpl(EntityManager entityManager) {this.entityManager=entityManager;}
    @Override @org.springframework.transaction.annotation.Transactional
    public void remember(String id,String source,String asset,Instant expiry) {
        entityManager.unwrap(Session.class).doWork(connection -> {
            boolean postgres="PostgreSQL".equals(connection.getMetaData().getDatabaseProductName());
            String sql="INSERT INTO material_video_input_asset (id,source_key,asset_id,expires_at) VALUES (?,?,?,?) "
                +(postgres?"ON CONFLICT (id) DO UPDATE SET asset_id=EXCLUDED.asset_id,expires_at=EXCLUDED.expires_at"
                :"ON DUPLICATE KEY UPDATE asset_id=VALUES(asset_id),expires_at=VALUES(expires_at)");
            try(var statement=connection.prepareStatement(sql)) {
                statement.setString(1,id);statement.setString(2,source);statement.setString(3,asset);
                statement.setTimestamp(4,expiry==null?null:Timestamp.from(expiry));statement.executeUpdate();
            }
        });
    }
}

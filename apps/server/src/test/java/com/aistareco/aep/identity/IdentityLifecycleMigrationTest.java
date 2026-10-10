package com.aistareco.aep.identity;

import db.migration.V50__identity_lifecycle_state;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class IdentityLifecycleMigrationTest {
    @Test void additiveMigrationPreservesBusinessIdentityAndReplays() throws Exception {
        try (var conn = java.sql.DriverManager.getConnection("jdbc:h2:mem:identity_v50;DB_CLOSE_DELAY=-1")) {
            conn.createStatement().execute("CREATE TABLE aep_users(id VARCHAR(36) PRIMARY KEY, identity_uid VARCHAR(32), operator_role VARCHAR(32))");
            conn.createStatement().execute("INSERT INTO aep_users VALUES('business-id','central-uid','OPERATOR')");
            Context context = mock(Context.class); when(context.getConnection()).thenReturn(conn);
            var migration = new V50__identity_lifecycle_state(); migration.migrate(context); migration.migrate(context);
            var row = conn.createStatement().executeQuery("SELECT id,identity_uid,operator_role,identity_state,identity_state_event_id,identity_tokens_valid_after FROM aep_users");
            assertThat(row.next()).isTrue(); assertThat(row.getString(1)).isEqualTo("business-id");
            assertThat(row.getString(2)).isEqualTo("central-uid"); assertThat(row.getString(3)).isEqualTo("OPERATOR");
            assertThat(row.getString(4)).isNull(); assertThat(row.getObject(5)).isNull(); assertThat(row.getObject(6)).isNull();
        }
    }
}

package com.aistareco.aep.ipstudio;
import db.migration.V39__ip_canvas_recovery;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class IpRecoveryMigrationTest {
  @Test void migrationCreatesDurableTablesWithLargeDocumentCapacity() throws Exception {
    try(var connection = DriverManager.getConnection("jdbc:h2:mem:ip-recovery-migration;MODE=MySQL", "sa", "")) {
      Context context=mock(Context.class); when(context.getConnection()).thenReturn(connection);
      new V39__ip_canvas_recovery().migrate(context);
      String document="汉".repeat(100000);
      try(var insert=connection.prepareStatement("INSERT INTO ip_project_revision(id,project_id,name,doc_json,created_at) VALUES('r','p','name',?,CURRENT_TIMESTAMP)")) {
        insert.setString(1,document); assertEquals(1,insert.executeUpdate());
      }
      try(var s=connection.createStatement(); var rows=s.executeQuery("SELECT doc_json FROM ip_project_revision WHERE id='r'")) {
        assertTrue(rows.next()); assertEquals(document,rows.getString(1));
      }
      try(var s=connection.createStatement(); var rows=s.executeQuery("SELECT COUNT(*) FROM ip_saved_asset")) { assertTrue(rows.next()); assertEquals(0,rows.getInt(1)); }
    }
  }
}

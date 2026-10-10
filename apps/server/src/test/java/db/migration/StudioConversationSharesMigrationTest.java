package db.migration;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class StudioConversationSharesMigrationTest {
 @Test void additiveTablesPreserveCanvasAndSeparateCopyIdempotencyByOwner()throws Exception {
  try(var c=DriverManager.getConnection("jdbc:h2:mem:conversation-shares;MODE=MySQL")) {
   try(var s=c.createStatement()){s.execute("CREATE TABLE ip_project(id VARCHAR(32),doc_json LONGTEXT)");s.execute("INSERT INTO ip_project VALUES('old','{keep}')");}
   var ctx=mock(Context.class);when(ctx.getConnection()).thenReturn(c);new V47__studio_conversation_shares().migrate(ctx);
   try(var s=c.createStatement()) {
    try(var r=s.executeQuery("SELECT doc_json FROM ip_project")){assertTrue(r.next());assertEquals("{keep}",r.getString(1));}
    s.execute("INSERT INTO ip_conversation_copy VALUES('a','owner','request','token','project')");
    assertThrows(SQLException.class,()->s.execute("INSERT INTO ip_conversation_copy VALUES('dup','owner','request','token','project2')"));
    s.execute("INSERT INTO ip_conversation_copy VALUES('b','other','request','token','project2')");
   }
  }
 }
}

package db.migration;

import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class V66IpRunJsonCapacityTest {
    @Test void widensBothLegacyColumnsInOneAlter() throws Exception {
        var connection = connection("TEXT", "TEXT");
        var statement = mock(Statement.class);
        when(connection.createStatement()).thenReturn(statement);
        migrate(connection);
        verify(statement).executeUpdate("ALTER TABLE ip_run MODIFY COLUMN input_json LONGTEXT NULL, MODIFY COLUMN output_json LONGTEXT NULL");
    }

    @Test void skipsAlreadyExpandedProductionColumns() throws Exception {
        var connection = connection("LONGTEXT", "LONGTEXT");
        migrate(connection);
        verify(connection, never()).createStatement();
    }

    @Test void doesNotSilentlyAcceptMissingColumn() throws Exception {
        var connection = connection("TEXT", "TEXT");
        when(connection.getMetaData().getColumns("test", null, "ip_run", "output_json").next()).thenReturn(false);
        assertThrows(IllegalStateException.class, () -> migrate(connection));
        verify(connection, never()).createStatement();
    }

    private Connection connection(String inputType, String outputType) throws Exception {
        var connection = mock(Connection.class);
        var metadata = mock(DatabaseMetaData.class);
        when(connection.getMetaData()).thenReturn(metadata);
        when(connection.getCatalog()).thenReturn("test");
        when(metadata.getDatabaseProductName()).thenReturn("MySQL");
        for (String column : new String[]{"input_json", "output_json"}) {
            var rows = mock(ResultSet.class);
            when(rows.next()).thenReturn(true);
            when(rows.getString("TYPE_NAME")).thenReturn(column.equals("input_json") ? inputType : outputType);
            when(metadata.getColumns("test", null, "ip_run", column)).thenReturn(rows);
        }
        return connection;
    }

    private void migrate(Connection connection) throws Exception {
        var context = mock(Context.class);
        when(context.getConnection()).thenReturn(connection);
        new V66__ip_run_json_capacity().migrate(context);
    }
}

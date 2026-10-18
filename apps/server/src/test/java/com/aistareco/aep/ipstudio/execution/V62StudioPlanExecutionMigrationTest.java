package com.aistareco.aep.ipstudio.execution;

import db.migration.V62__studio_plan_execution;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import java.sql.SQLException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class V62StudioPlanExecutionMigrationTest {
    @Test void createsTheTableOnceWithTheRequestUniqueness() throws Exception {
        try(var connection=DriverManager.getConnection("jdbc:h2:mem:v62-plan-execution;MODE=MySQL","sa","")) {
            Context context=mock(Context.class);when(context.getConnection()).thenReturn(connection);
            new V62__studio_plan_execution().migrate(context);
            new V62__studio_plan_execution().migrate(context); // re-run is a no-op (table already present)
            String insert="INSERT INTO ip_plan_execution(id,project_id,owner_user_id,skill_key,skill_version,stage,plan_run_id,plan_revision,plan_fingerprint,status,steps_json,budget_json,billing_json,client_request_id) "
                    +"VALUES(?, 'p','u','k',1,'analysis','r',1,'f','running',?,'{}','{}','req')";
            try(var statement=connection.prepareStatement(insert)) {
                statement.setString(1,"a");statement.setString(2,"汉".repeat(100000));assertEquals(1,statement.executeUpdate());
                statement.setString(1,"b");statement.setString(2,"{}");
                assertThrows(SQLException.class,statement::executeUpdate,"UNIQUE(owner_user_id, client_request_id)");
            }
            try(var s=connection.createStatement();var rows=s.executeQuery("SELECT lease_version, spent, in_flight FROM ip_plan_execution WHERE id='a'")) {
                assertTrue(rows.next());assertEquals(0,rows.getLong(1));assertEquals(0,rows.getLong(2));assertEquals(0,rows.getLong(3));
            }
        }
    }
}

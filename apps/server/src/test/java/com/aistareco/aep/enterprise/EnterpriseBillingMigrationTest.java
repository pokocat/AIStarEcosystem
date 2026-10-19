package com.aistareco.aep.enterprise;

import db.migration.V58__enterprise_billing_lifecycle;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EnterpriseBillingMigrationTest {
    @Test void h2AddsDurableAuthorizationsWithoutMovingHistoricalMoney()throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:enterprise-billing-migration;MODE=MySQL","sa","")){verify(c);}
    }
    @Test @EnabledIfSystemProperty(named="enterprise.billing.migration.jdbc",matches="jdbc:mysql:.*")
    void mysqlAddsDurableAuthorizationsWithoutMovingHistoricalMoney()throws Exception {
        try(var c=DriverManager.getConnection(System.getProperty("enterprise.billing.migration.jdbc"),"root","")){verify(c);}
    }
    void verify(Connection c)throws Exception {
        try(var s=c.createStatement()) {
            s.execute("CREATE TABLE aep_wallets(id VARCHAR(64) PRIMARY KEY,user_id VARCHAR(64),total_balance BIGINT,pending_balance BIGINT)");
            s.execute("INSERT INTO aep_wallets VALUES('personal','old-user',777,40)");
            s.execute("CREATE TABLE aep_ledger_entries(id VARCHAR(64) PRIMARY KEY,amount BIGINT,entry_type VARCHAR(32))");
            s.execute("INSERT INTO aep_ledger_entries VALUES('old',777,'RECHARGE')");
            s.execute("CREATE TABLE aep_enterprise_credit_lot_holds(id VARCHAR(64) PRIMARY KEY,hold_id VARCHAR(64),lot_id VARCHAR(64),frozen BIGINT)");
            s.execute("INSERT INTO aep_enterprise_credit_lot_holds VALUES('old-hold','hold','lot',30)");
        }
        var context=mock(Context.class);when(context.getConnection()).thenReturn(c);var migration=new V58__enterprise_billing_lifecycle();migration.migrate(context);migration.migrate(context);
        try(var s=c.createStatement()) {
            try(var r=s.executeQuery("SELECT total_balance,pending_balance FROM aep_wallets WHERE id='personal'")){assertTrue(r.next());assertEquals(777,r.getLong(1));assertEquals(40,r.getLong(2));}
            try(var r=s.executeQuery("SELECT amount,entry_type FROM aep_ledger_entries WHERE id='old'")){assertTrue(r.next());assertEquals(777,r.getLong(1));assertEquals("RECHARGE",r.getString(2));}
            try(var r=s.executeQuery("SELECT frozen,released_amount FROM aep_enterprise_credit_lot_holds WHERE id='old-hold'")){assertTrue(r.next());assertEquals(30,r.getLong(1));assertEquals(0,r.getLong(2));}
            String insert="INSERT INTO aep_enterprise_billing_authorizations(id,enterprise_id,actor_user_id,membership_id,wallet_id,reference_type,reference_id,status,created_at,updated_at) VALUES(";
            s.execute(insert+"'a','e','u','m','w','ip-run','job','reserved',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
            assertThrows(SQLException.class,()->s.execute(insert+"'b','e','u','m','w','ip-run','job','reserved',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"));
            s.execute("INSERT INTO aep_enterprise_lifecycle_operations VALUES('op','e','u','req','fingerprint','{}',CURRENT_TIMESTAMP)");
            assertThrows(SQLException.class,()->s.execute("INSERT INTO aep_enterprise_lifecycle_operations VALUES('op2','e','u','req','other','{}',CURRENT_TIMESTAMP)"));
        }
    }
}

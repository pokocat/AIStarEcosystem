package com.aistareco.aep.billing;

import org.junit.jupiter.api.Test;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;

class ModelScopedCreditsMigrationTest {
    @Test void migrationPreservesExistingMoneyAndEnforcesGrantConservation() throws Exception {
        try(var connection=connection("model_scoped_migration_test")) {
            try(var s=connection.createStatement()) {
                String ledgerType=connection.getMetaData().getDatabaseProductName().equalsIgnoreCase("MySQL")
                        ? "ENUM('GIFT','RECHARGE')" : "VARCHAR(255)";
                s.execute("CREATE TABLE aep_ledger_entries(id VARCHAR(64) PRIMARY KEY, amount BIGINT, created_at TIMESTAMP,entry_type "+ledgerType+")");
                s.execute("INSERT INTO aep_ledger_entries VALUES ('old',123,CURRENT_TIMESTAMP,'GIFT')");
                s.execute("CREATE TABLE aep_wallets(id VARCHAR(64) PRIMARY KEY,total_balance BIGINT)");
                s.execute("INSERT INTO aep_wallets VALUES ('wallet',321)");
                String type=connection.getMetaData().getDatabaseProductName().equalsIgnoreCase("MySQL")
                        ? "ENUM('COMPENSATE','GRANT')" : "VARCHAR(16)";
                s.execute("CREATE TABLE credit_adjustment_request(id VARCHAR(64) PRIMARY KEY,type "+type+" NOT NULL,amount BIGINT)");
                s.execute("INSERT INTO credit_adjustment_request VALUES ('old-approval','GRANT',123)");
            }
            migrate(connection);
            try(var s=connection.createStatement()) {
                try(var r=s.executeQuery("SELECT amount,grant_id FROM aep_ledger_entries WHERE id='old'")){assertTrue(r.next());assertEquals(123,r.getLong(1));assertNull(r.getString(2));}
                s.execute("INSERT INTO aep_ledger_entries(id,amount,entry_type,grant_id) VALUES ('scoped',100,'SCOPED_GRANT','grant')");
                try(var r=s.executeQuery("SELECT total_balance FROM aep_wallets WHERE id='wallet'")){assertTrue(r.next());assertEquals(321,r.getLong(1));}
                try(var r=s.executeQuery("SELECT amount,wallet_id,expires_at,grant_id FROM credit_adjustment_request WHERE id='old-approval'")) {
                    assertTrue(r.next());assertEquals(123,r.getLong(1));assertNull(r.getString(2));assertNull(r.getTimestamp(3));assertNull(r.getString(4));
                }
                s.execute("INSERT INTO credit_adjustment_request(id,type,amount,wallet_id,expires_at,grant_id) VALUES ('scoped','SCOPED_GRANT',100,'wallet','2030-01-01','grant')");
                s.execute("INSERT INTO aep_credit_campaigns(id,name,targets_json,resource_unit,total_issue_limit,per_wallet_issue_limit,resource_limit,per_wallet_daily_resource_limit,max_concurrent_per_wallet,active,starts_at,expires_at,updated_at) VALUES ('campaign','test','[]','image',100,100,10,10,1,true,'2026-01-01','2030-01-01',CURRENT_TIMESTAMP)");
                s.execute("INSERT INTO aep_credit_grants(id,wallet_id,campaign_id,amount,available,source,source_reference,reason,created_by,expires_at,created_at) VALUES ('grant','wallet','campaign',100,100,'test','request','test','admin','2030-01-01',CURRENT_TIMESTAMP)");
                assertThrows(SQLException.class,()->s.execute("UPDATE aep_credit_grants SET available=101 WHERE id='grant'"));
                assertThrows(SQLException.class,()->s.execute("UPDATE aep_credit_campaigns SET resource_reserved=11 WHERE id='campaign'"));
                s.execute("UPDATE aep_credit_grants SET available=70,frozen=30 WHERE id='grant'");
                try(var r=s.executeQuery("SELECT available+frozen+spent+expired FROM aep_credit_grants")){assertTrue(r.next());assertEquals(100,r.getLong(1));}
            }
        }
    }
    @Test void freshDatabaseBootstrapsBeforeHibernateCreatesTheLedger() throws Exception {
        try(var connection=connection("model_scoped_fresh_test")) {
            migrate(connection);
            try(var s=connection.createStatement();var r=s.executeQuery("SELECT count(*) FROM aep_credit_grants")) {
                assertTrue(r.next());assertEquals(0,r.getLong(1));
            }
        }
    }
    private static Connection connection(String database)throws SQLException {
        String server=System.getProperty("model-scoped.mysql");
        return server==null?DriverManager.getConnection("jdbc:h2:mem:"+database+";MODE=MySQL")
                :DriverManager.getConnection("jdbc:mysql://"+server+"/"+database+"?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC","root","");
    }
    private static void migrate(Connection connection)throws Exception {
        var context=org.mockito.Mockito.mock(org.flywaydb.core.api.migration.Context.class);
        org.mockito.Mockito.when(context.getConnection()).thenReturn(connection);
        var migration=new db.migration.V67__model_scoped_credits();assertNotNull(migration.getChecksum());migration.migrate(context);
        var approval=new db.migration.V68__scoped_grant_approvals();assertNotNull(approval.getChecksum());approval.migrate(context);
        org.springframework.jdbc.datasource.init.ScriptUtils.executeSqlScript(connection,
                new org.springframework.core.io.ClassPathResource("db/migration/V69__model_credit_reservation_groups.sql"));
    }
}

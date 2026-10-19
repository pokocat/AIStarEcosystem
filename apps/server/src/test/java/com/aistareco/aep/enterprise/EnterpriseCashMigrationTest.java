package com.aistareco.aep.enterprise;

import db.migration.V57__enterprise_cash_provenance;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EnterpriseCashMigrationTest {
    @Test void preservesHistoricalPersonalCashWhileAddingEnterpriseProvenanceInH2()throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:enterprise-cash-migration;MODE=MySQL","sa","")){verify(c);}
    }
    @Test @EnabledIfSystemProperty(named="enterprise.cash.migration.jdbc",matches="jdbc:mysql:.*")
    void preservesHistoricalPersonalCashWhileAddingEnterpriseProvenanceInMysql()throws Exception {
        try(var c=DriverManager.getConnection(System.getProperty("enterprise.cash.migration.jdbc"),"root","")){verify(c);}
    }
    private void verify(Connection c)throws Exception {
        try(var s=c.createStatement()) {
            s.execute("CREATE TABLE recharge_order(id VARCHAR(64) PRIMARY KEY,user_id VARCHAR(64) NOT NULL,enterprise_id VARCHAR(64),target_wallet_id VARCHAR(64),receipt_reference VARCHAR(256),credits BIGINT NOT NULL,price_cents BIGINT NOT NULL,status VARCHAR(16) NOT NULL,created_at TIMESTAMP(6) NOT NULL)");
            s.execute("INSERT INTO recharge_order(id,user_id,credits,price_cents,status,created_at) VALUES('historical-personal','old-user',777,9900,'PAID',CURRENT_TIMESTAMP)");
            s.execute("CREATE TABLE aep_wallets(id VARCHAR(64) PRIMARY KEY,user_id VARCHAR(64),enterprise_id VARCHAR(64),total_balance BIGINT,recharge_balance BIGINT,pending_balance BIGINT)");
            s.execute("INSERT INTO aep_wallets VALUES('personal-wallet','old-user',NULL,777,777,23)");
            s.execute("CREATE TABLE aep_ledger_entries(id VARCHAR(64) PRIMARY KEY,user_id VARCHAR(64),amount BIGINT,entry_type VARCHAR(32))");
            s.execute("INSERT INTO aep_ledger_entries VALUES('old-ledger','old-user',777,'RECHARGE')");
        }
        Context context=mock(Context.class);when(context.getConnection()).thenReturn(c);var migration=new V57__enterprise_cash_provenance();migration.migrate(context);migration.migrate(context);
        try(var s=c.createStatement()) {
            try(var r=s.executeQuery("SELECT user_id,credits,price_cents,status,enterprise_id,refunded_price_cents FROM recharge_order WHERE id='historical-personal'")){assertTrue(r.next());assertEquals("old-user",r.getString(1));assertEquals(777,r.getLong(2));assertEquals(9900,r.getLong(3));assertEquals("PAID",r.getString(4));assertNull(r.getString(5));assertEquals(0,r.getLong(6));}
            try(var r=s.executeQuery("SELECT total_balance,recharge_balance,pending_balance FROM aep_wallets WHERE id='personal-wallet'")){assertTrue(r.next());assertEquals(777,r.getLong(1));assertEquals(777,r.getLong(2));assertEquals(23,r.getLong(3));}
            try(var r=s.executeQuery("SELECT user_id,amount,entry_type FROM aep_ledger_entries WHERE id='old-ledger'")){assertTrue(r.next());assertEquals("old-user",r.getString(1));assertEquals(777,r.getLong(2));assertEquals("RECHARGE",r.getString(3));}
            s.execute("INSERT INTO aep_enterprise_credit_lots VALUES('lot','enterprise','order','wallet',100,20,CURRENT_TIMESTAMP)");
            assertThrows(SQLException.class,()->s.execute("INSERT INTO aep_enterprise_credit_lots VALUES('other','enterprise','order','wallet',100,20,CURRENT_TIMESTAMP)"));
            s.execute("INSERT INTO aep_enterprise_cash_receipts VALUES('in:same','order','in','BANK-1',CURRENT_TIMESTAMP)");
            assertThrows(SQLException.class,()->s.execute("INSERT INTO aep_enterprise_cash_receipts VALUES('in:same','other','in','BANK-1',CURRENT_TIMESTAMP)"));
            s.execute("INSERT INTO recharge_order(id,user_id,enterprise_id,enterprise_request_id,credits,price_cents,status,created_at) VALUES('enterprise-order','owner','enterprise','key',0,0,'PENDING',CURRENT_TIMESTAMP)");
            assertThrows(SQLException.class,()->s.execute("INSERT INTO recharge_order(id,user_id,enterprise_id,enterprise_request_id,credits,price_cents,status,created_at) VALUES('duplicate-order','owner','enterprise','key',0,0,'PENDING',CURRENT_TIMESTAMP)"));
        }
    }
}

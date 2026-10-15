package com.aistareco.aep.enterprise;

import db.migration.V56__enterprise_accounts_foundation;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EnterpriseMigrationTest {
    @Test void upgradesHistoricalH2WithoutChangingMoneyOrLedger()throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:enterprise-migration;MODE=MySQL","sa","")){verifyUpgrade(c);}
    }
    @Test @EnabledIfSystemProperty(named="enterprise.migration.jdbc",matches="jdbc:mysql:.*")
    void upgradesHistoricalMysqlWithoutChangingMoneyOrLedger()throws Exception {
        try(var c=DriverManager.getConnection(System.getProperty("enterprise.migration.jdbc"),"root","")){verifyUpgrade(c);}
    }
    private void verifyUpgrade(Connection c)throws Exception {
        try(var s=c.createStatement()) {
            s.execute("CREATE TABLE aep_wallets(id VARCHAR(64) PRIMARY KEY,user_id VARCHAR(255) NOT NULL UNIQUE,total_balance BIGINT, gift_balance BIGINT,pending_balance BIGINT)");
            s.execute("INSERT INTO aep_wallets VALUES('old-wallet','old-user',777,777,40)");
            s.execute("CREATE TABLE aep_ledger_entries(id VARCHAR(64) PRIMARY KEY,user_id VARCHAR(255),entry_type ENUM('GIFT','FREEZE'),amount BIGINT)");
            s.execute("INSERT INTO aep_ledger_entries VALUES('old-ledger','old-user','GIFT',777)");
            s.execute("CREATE TABLE aep_credit_holds(id VARCHAR(64) PRIMARY KEY,user_id VARCHAR(64) NOT NULL)");
            s.execute("INSERT INTO aep_credit_holds VALUES('old-hold','old-user')");
            s.execute("CREATE TABLE recharge_order(id VARCHAR(64) PRIMARY KEY,user_id VARCHAR(255))");
        }
        Context ctx=mock(Context.class);when(ctx.getConnection()).thenReturn(c);var migration=new V56__enterprise_accounts_foundation();migration.migrate(ctx);migration.migrate(ctx);
        try(var s=c.createStatement()) {
            try(var r=s.executeQuery("SELECT user_id,total_balance,gift_balance,pending_balance,account_type,account_key FROM aep_wallets WHERE id='old-wallet'")) {
                assertTrue(r.next());assertEquals("old-user",r.getString(1));assertEquals(777,r.getLong(2));assertEquals(777,r.getLong(3));assertEquals(40,r.getLong(4));assertEquals("personal",r.getString(5));assertEquals("personal:old-user",r.getString(6));
            }
            try(var r=s.executeQuery("SELECT user_id,entry_type,amount FROM aep_ledger_entries WHERE id='old-ledger'")){assertTrue(r.next());assertEquals("old-user",r.getString(1));assertEquals("GIFT",r.getString(2));assertEquals(777,r.getLong(3));}
            s.execute("INSERT INTO aep_wallets(id,user_id,account_type,account_key,enterprise_id) VALUES('corp',NULL,'enterprise','enterprise:e','e')");
            s.execute("INSERT INTO aep_credit_holds(id,user_id) VALUES('corp-hold',NULL)");
            s.execute("INSERT INTO aep_ledger_entries(id,entry_type,amount) VALUES('transfer','TRANSFER_IN',100)");
            assertThrows(SQLException.class,()->s.execute("INSERT INTO aep_wallets(id,account_key) VALUES('duplicate','personal:old-user')"));
            s.execute("INSERT INTO aep_enterprise_current(user_id,enterprise_id,member_id) VALUES('u','e','m')");
            assertThrows(SQLException.class,()->s.execute("INSERT INTO aep_enterprise_current(user_id,enterprise_id,member_id) VALUES('u','other','m2')"));
        }
    }
}

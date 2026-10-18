package com.aistareco.aep.enterprise;

import db.migration.V59__enterprise_group_invitations;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.Connection;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EnterpriseGroupInvitationMigrationTest {
    @Test void removesOnlyOldInvitationDataAndIsSafeToRepeatAfterNewGroupLinksExist() throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:group-invitation-migration;MODE=MySQL","sa","")) {
            verifyMigration(c);
        }
    }
    @Test @EnabledIfSystemProperty(named="enterprise.group.migration.jdbc",matches="jdbc:mysql:.*")
    void mysqlCleansOnlyInvitationsAndPreservesNewGroupLinks() throws Exception {
        try(var c=DriverManager.getConnection(System.getProperty("enterprise.group.migration.jdbc"),"root","")) {
            verifyMigration(c);
        }
    }
    private void verifyMigration(Connection c) throws Exception {
            try(var s=c.createStatement()) {
                s.execute("CREATE TABLE aep_enterprise_invitations(id VARCHAR(64) PRIMARY KEY,status VARCHAR(16),accepted_by VARCHAR(64))");
                s.execute("INSERT INTO aep_enterprise_invitations VALUES('old-used','accepted','user'),('old-pending','pending',NULL)");
                s.execute("CREATE TABLE aep_enterprise_members(id VARCHAR(64) PRIMARY KEY)");s.execute("INSERT INTO aep_enterprise_members VALUES('member')");
                s.execute("CREATE TABLE aep_wallets(id VARCHAR(64) PRIMARY KEY,total_balance BIGINT)");s.execute("INSERT INTO aep_wallets VALUES('wallet',1200)");
            }
            var context=mock(Context.class);when(context.getConnection()).thenReturn(c);var migration=new V59__enterprise_group_invitations();migration.migrate(context);
            try(var s=c.createStatement()) {
                try(var r=s.executeQuery("SELECT COUNT(*) FROM aep_enterprise_invitations")){assertTrue(r.next());assertEquals(0,r.getInt(1));}
                s.execute("INSERT INTO aep_enterprise_invitations VALUES('new-group','pending')");
            }
            migration.migrate(context);
            try(var s=c.createStatement()) {
                try(var r=s.executeQuery("SELECT COUNT(*) FROM aep_enterprise_invitations")){assertTrue(r.next());assertEquals(1,r.getInt(1));}
                try(var r=s.executeQuery("SELECT COUNT(*) FROM aep_enterprise_members")){assertTrue(r.next());assertEquals(1,r.getInt(1));}
                try(var r=s.executeQuery("SELECT total_balance FROM aep_wallets")){assertTrue(r.next());assertEquals(1200,r.getInt(1));}
            }
    }
}

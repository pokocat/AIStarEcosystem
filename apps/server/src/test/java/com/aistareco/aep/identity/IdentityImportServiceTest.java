package com.aistareco.aep.identity;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 老用户导入（docs/unified-identity-plan.md §12.3）。
 *
 * <p>账号中心侧打桩（那端由另一路并行实现）。这里守的是本仓的三件事：
 * 候选集只含「有手机号且没有 uid」的账号、返回的 uid 正确回写、被跳过 / 出错的条目
 * 如实计数而不是当成成功。
 */
class IdentityImportServiceTest {

    private AepUserRepository repo;
    private IdentityCenterClient client;
    private IdentityImportService service;
    private final List<AepUser> table = new ArrayList<>();

    @BeforeEach
    void setUp() {
        repo = mock(AepUserRepository.class);
        client = mock(IdentityCenterClient.class);
        when(client.isEnabled()).thenReturn(true);

        // 模拟 id 游标分页：只返回「没有 uid + 有手机号 + id > afterId」的行
        when(repo.findImportCandidates(anyString(), any(Pageable.class))).thenAnswer(inv -> {
            String after = inv.getArgument(0);
            Pageable pageable = inv.getArgument(1);
            return table.stream()
                    .filter(u -> u.getIdentityUid() == null)
                    .filter(u -> u.getPhone() != null && !u.getPhone().isBlank())
                    .filter(u -> u.getId().compareTo(after) > 0)
                    .sorted(Comparator.comparing(AepUser::getId))
                    .limit(pageable.getPageSize())
                    .toList();
        });
        when(repo.saveAndFlush(any(AepUser.class))).thenAnswer(inv -> inv.getArgument(0));

        service = new IdentityImportService(repo, client);
    }

    private AepUser user(String id, String phone, String uid) {
        AepUser u = AepUser.builder().id(id).username(id).phone(phone).identityUid(uid)
                .kind(AepUser.AccountKind.PERSONAL).status(AepUser.UserStatus.ACTIVE).build();
        table.add(u);
        return u;
    }

    @Test
    void writesBackUidAndCountsCreatedLinkedSkipped() {
        AepUser a = user("u-001", "13800138001", null);
        AepUser b = user("u-002", "13800138002", null);
        AepUser closed = user("u-003", "13800138003", null);
        user("u-004", null, null);                       // 无手机号 → 不进候选
        user("u-005", "13800138005", "uid-existing");    // 已有 uid → 不进候选

        when(client.importUsers(anyList())).thenReturn(List.of(
                new IdentityCenterClient.ImportResultItem("u-001", "uid-1", true, null),
                new IdentityCenterClient.ImportResultItem("u-002", "uid-2", false, null),
                new IdentityCenterClient.ImportResultItem("u-003", null, false, "ACCOUNT_CLOSED")));

        var report = service.run(200, false);

        assertThat(a.getIdentityUid()).isEqualTo("uid-1");
        assertThat(b.getIdentityUid()).isEqualTo("uid-2");
        assertThat(closed.getIdentityUid()).as("被跳过的账号不写 uid").isNull();
        assertThat(report.scanned()).isEqualTo(3);
        assertThat(report.linked()).isEqualTo(2);
        assertThat(report.created()).isEqualTo(1);
        assertThat(report.skipped()).isEqualTo(1);
        assertThat(report.errors()).isZero();
    }

    @Test
    void rerunIsIdempotent_alreadyLinkedRowsAreNotResent() {
        user("u-001", "13800138001", "uid-1");
        user("u-002", "13800138002", "uid-2");

        var report = service.run(200, false);

        assertThat(report.scanned()).isZero();
        verify(client, never()).importUsers(anyList());
    }

    @Test
    void dryRunOnlyCountsAndNeverCallsIdentityCenter() {
        AepUser a = user("u-001", "13800138001", null);

        var report = service.run(200, true);

        assertThat(report.scanned()).isEqualTo(1);
        assertThat(report.linked()).isZero();
        assertThat(a.getIdentityUid()).isNull();
        verify(client, never()).importUsers(anyList());
        verify(repo, never()).saveAndFlush(any(AepUser.class));
    }

    @Test
    void missingUidInResponseCountsAsError() {
        user("u-001", "13800138001", null);
        when(client.importUsers(anyList())).thenReturn(List.of(
                new IdentityCenterClient.ImportResultItem("u-001", null, false, null)));

        var report = service.run(200, false);

        assertThat(report.errors()).isEqualTo(1);
        assertThat(report.linked()).isZero();
    }

    @Test
    void identityCenterNotConfigured_throws503AndScansNothing() {
        when(client.isEnabled()).thenReturn(false);
        user("u-001", "13800138001", null);

        assertThatThrownBy(() -> service.run(200, false))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode()).isEqualTo("IDENTITY_NOT_CONFIGURED"));
        verify(client, never()).importUsers(anyList());
    }
}

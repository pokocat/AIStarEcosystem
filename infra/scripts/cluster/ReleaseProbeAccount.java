import java.net.URI;
import java.sql.DriverManager;
import java.util.Arrays;
import java.util.Objects;

/** One-time provisioning. Run inside the verified production API container. */
public class ReleaseProbeAccount {
    private static final String SUBJECT = "e5fa3eb7-ab72-4f16-9eb5-b6583217ff8b";
    private static final String USERNAME = "aistar-release-probe";
    private static final String DB_HOST = "pgm-bp1gp4819mbs30z3.pg.rds.aliyuncs.com";

    public static void main(String[] args) throws Exception {
        if (args.length != 1 || !"--provision".equals(args[0])) {
            throw new IllegalArgumentException("Pass --provision to create the fixed probe account");
        }
        String url = Objects.requireNonNull(System.getenv("DB_URL"), "Missing DB_URL");
        String role = System.getenv("DB_USERNAME");
        URI target = URI.create(url.substring("jdbc:".length()));
        if (!"postgresql".equals(target.getScheme()) || !DB_HOST.equals(target.getHost())
                || target.getPort() != 5432 || !"/aistar_prod".equals(target.getPath())
                || !"aistar_app".equals(role) || target.getQuery() == null
                || !Arrays.asList(target.getQuery().split("&")).contains("sslmode=verify-full")) {
            throw new IllegalStateException("Wrong production database or role");
        }
        try (var connection = DriverManager.getConnection(url, role, System.getenv("DB_PASSWORD"))) {
            connection.setAutoCommit(false);
            int created;
            try (var insert = connection.prepareStatement("""
                    INSERT INTO public.aep_users
                        (id, username, display_name, kind, status, email_verified, phone_verified, created_at, updated_at)
                    VALUES (?, ?, '发布探针', 'PERSONAL', 'ACTIVE', false, false, now(), now())
                    ON CONFLICT DO NOTHING
                    """)) {
                insert.setString(1, SUBJECT);
                insert.setString(2, USERNAME);
                created = insert.executeUpdate();
            }
            try (var verify = connection.prepareStatement("""
                    SELECT count(*) FROM public.aep_users u
                    WHERE u.id = ? AND u.username = ? AND u.kind = 'PERSONAL' AND u.status = 'ACTIVE'
                      AND u.email IS NULL AND u.phone IS NULL AND u.password_hash IS NULL
                      AND u.operator_role IS NULL AND u.identity_uid IS NULL
                      AND NOT EXISTS (SELECT 1 FROM public.entitlement_grant g WHERE g.user_id = u.id)
                    """)) {
                verify.setString(1, SUBJECT);
                verify.setString(2, USERNAME);
                try (var result = verify.executeQuery()) {
                    if (!result.next() || result.getInt(1) != 1) {
                        throw new IllegalStateException("Probe account identity or permissions do not match");
                    }
                }
            }
            // Any enrollment row prevents the startup backfill from interpreting empty legacy platforms as full access.
            try (var deny = connection.prepareStatement("""
                    INSERT INTO public.product_enrollment (id, user_id, product, status, source, created_at, updated_at)
                    SELECT 'release-probe-' || product, ?, product, 'REVOKED', 'LEGACY', now(), now()
                    FROM unnest(ARRAY['aiavatar', 'celebrity', 'drama', 'music', 'star']) AS products(product)
                    ON CONFLICT (user_id, product) DO NOTHING
                    """)) {
                deny.setString(1, SUBJECT);
                deny.executeUpdate();
            }
            try (var verify = connection.prepareStatement("""
                    SELECT count(*), count(*) FILTER (WHERE status = 'REVOKED' AND source = 'LEGACY'
                      AND product IN ('aiavatar', 'celebrity', 'drama', 'music', 'star'))
                    FROM public.product_enrollment WHERE user_id = ?
                    """)) {
                verify.setString(1, SUBJECT);
                try (var result = verify.executeQuery()) {
                    if (!result.next() || result.getInt(1) != 5 || result.getInt(2) != 5) {
                        throw new IllegalStateException("Probe account product access does not match");
                    }
                }
            }
            connection.commit();
            System.out.println(created == 1 ? "Created dedicated release probe account" : "Verified existing release probe account");
        }
    }
}

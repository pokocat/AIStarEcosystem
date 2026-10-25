#!/bin/bash
# 线上积分消耗与对账（只读）。在 ECS 上执行：
#   ssh -i <key> ecs-user@47.98.162.120 'bash -s -- 24' < scripts/ops/credit-reconcile.sh
# 参数：统计窗口小时数（默认 24）。数据库凭据从 /etc/aistareco/server.env 读取，不打印。
# 整个会话设为只读事务；只有 SELECT。说明见 docs/runbooks/credit-reconciliation-agent.md。
set -euo pipefail
HOURS="${1:-24}"
[[ "$HOURS" =~ ^[0-9]+$ ]] && (( HOURS >= 1 && HOURS <= 720 )) || { echo "窗口小时数需为 1-720"; exit 2; }

export MYSQL_PWD=$(sudo -n sed -n "s/^DB_PASSWORD=//p" /etc/aistareco/server.env)
U=$(sudo -n sed -n "s/^DB_USERNAME=//p" /etc/aistareco/server.env)
URL=$(sudo -n sed -n "s/^DB_URL=//p" /etc/aistareco/server.env)
DB=$(echo "$URL" | sed -E "s#\?.*##; s#.*/##"); H=$(echo "$URL" | sed -E "s#jdbc:mysql://([^:/]+).*#\1#")

# created_at 存的是 UTC；展示一律转北京时间。
W="utc_timestamp() - interval $HOURS hour"
BJ="convert_tz(%s,'+00:00','+08:00')"
bj() { printf "$BJ" "$1"; }

mysql --default-character-set=utf8mb4 --connect-timeout=10 -h"$H" -u"$U" "$DB" --table <<SQL
SET SESSION TRANSACTION READ ONLY;
START TRANSACTION READ ONLY;

SELECT '== 0 运行信息' AS section, $(bj 'utc_timestamp()') AS bj_now, $HOURS AS window_hours;

SELECT '== 1 硬性对账（全部应为 0）' AS section;
SELECT 'A 钱包分桶之和≠总余额' chk, count(*) bad FROM aep_wallets WHERE total_balance <> gift_balance+license_balance+recharge_balance
UNION ALL SELECT 'B 出现负余额', count(*) FROM aep_wallets WHERE least(gift_balance,license_balance,recharge_balance,pending_balance,total_balance) < 0
UNION ALL SELECT 'C 总余额≠流水累计', count(*) FROM aep_wallets w LEFT JOIN (
    SELECT wallet_id, sum(CASE WHEN entry_type='SPEND' OR entry_type LIKE 'SCOPED%' THEN 0 ELSE amount END) s
    FROM aep_ledger_entries GROUP BY wallet_id) l ON l.wallet_id=w.id
  WHERE w.total_balance <> coalesce(l.s,0)
UNION ALL SELECT 'D 冻结余额≠流水累计', count(*) FROM aep_wallets w LEFT JOIN (
    SELECT wallet_id, sum(CASE entry_type WHEN 'FREEZE' THEN -amount WHEN 'UNFREEZE' THEN -amount WHEN 'SPEND' THEN amount ELSE 0 END) p
    FROM aep_ledger_entries GROUP BY wallet_id) l ON l.wallet_id=w.id
  WHERE w.pending_balance <> coalesce(l.p,0)
UNION ALL SELECT 'E 赠款分桶之和≠发放额', count(*) FROM aep_credit_grants WHERE amount <> available+frozen+spent+expired
UNION ALL SELECT 'F 赠款负数', count(*) FROM aep_credit_grants WHERE least(available,frozen,spent,expired) < 0
UNION ALL SELECT 'G 已结束冻结仍有剩余', count(*) FROM aep_credit_holds WHERE status IN ('COMMITTED','RELEASED') AND remaining_amount <> 0
UNION ALL SELECT 'H 模型扣费结算拆分不平', count(*) FROM aep_model_charges
  WHERE settled_payable_credits IS NOT NULL AND settled_payable_credits <> coalesce(settled_scoped_credits,0)+coalesce(settled_wallet_credits,0)
UNION ALL SELECT 'I 赠款活动发放超限', count(*) FROM aep_credit_campaigns WHERE issued > total_issue_limit;

SELECT '== 1x 硬性对账不为 0 时的明细（最多 20 行）' AS section;
SELECT w.id wallet_id, w.user_id, w.total_balance, w.gift_balance+w.license_balance+w.recharge_balance buckets, w.pending_balance,
       coalesce(l.s,0) ledger_total, coalesce(l.p,0) ledger_pending
FROM aep_wallets w LEFT JOIN (
  SELECT wallet_id,
         sum(CASE WHEN entry_type='SPEND' OR entry_type LIKE 'SCOPED%' THEN 0 ELSE amount END) s,
         sum(CASE entry_type WHEN 'FREEZE' THEN -amount WHEN 'UNFREEZE' THEN -amount WHEN 'SPEND' THEN amount ELSE 0 END) p
  FROM aep_ledger_entries GROUP BY wallet_id) l ON l.wallet_id=w.id
WHERE w.total_balance <> w.gift_balance+w.license_balance+w.recharge_balance
   OR w.total_balance <> coalesce(l.s,0) OR w.pending_balance <> coalesce(l.p,0)
   OR least(w.gift_balance,w.license_balance,w.recharge_balance,w.pending_balance,w.total_balance) < 0
LIMIT 20;

SELECT '== 2 卡住的冻结（进行中超过 6 小时）' AS section;
SELECT h.id hold_id, h.reference_type, h.reference_id, h.amount, h.remaining_amount, $(bj 'h.created_at') created_bj
FROM aep_credit_holds h WHERE h.status='HELD' AND h.created_at < utc_timestamp() - interval 6 hour
ORDER BY h.created_at LIMIT 20;

SELECT '== 2b 进行中冻结核对（软检查：冻结余额 + 赠款冻结 应等于进行中冻结剩余；有折扣时可能不等，只报告）' AS section;
SELECT w.id wallet_id, w.pending_balance, coalesce(g.f,0) grant_frozen, coalesce(h.r,0) held_remaining
FROM aep_wallets w
LEFT JOIN (SELECT wallet_id, sum(frozen) f FROM aep_credit_grants GROUP BY wallet_id) g ON g.wallet_id=w.id
LEFT JOIN (SELECT wallet_id, sum(remaining_amount) r FROM aep_credit_holds WHERE status='HELD' GROUP BY wallet_id) h ON h.wallet_id=w.id
WHERE w.pending_balance + coalesce(g.f,0) <> coalesce(h.r,0) LIMIT 20;

SELECT '== 3 窗口内积分流入流出（按流水类型）' AS section;
SELECT entry_type, plane, count(*) n, sum(amount) amount FROM aep_ledger_entries
WHERE created_at >= $W GROUP BY entry_type, plane ORDER BY entry_type;

SELECT '== 4 窗口内消耗最多的 15 个账户（普通积分 + 赠款）' AS section;
SELECT coalesce(u.display_name, w.user_id, w.member_user_id) who, w.account_type,
       sum(CASE WHEN l.entry_type='SPEND' THEN -l.amount ELSE 0 END) spend_credits,
       sum(CASE WHEN l.entry_type='SCOPED_SPEND' THEN -l.amount ELSE 0 END) spend_grant,
       count(DISTINCT l.reference_id) tasks,
       w.total_balance balance_now
FROM aep_ledger_entries l JOIN aep_wallets w ON w.id=l.wallet_id
LEFT JOIN aep_users u ON u.id=coalesce(w.user_id, w.member_user_id)
WHERE l.created_at >= $W AND l.entry_type IN ('SPEND','SCOPED_SPEND')
GROUP BY who, w.account_type, w.total_balance
ORDER BY spend_credits+spend_grant DESC LIMIT 15;

SELECT '== 5 窗口内单笔大额消耗（≥ 2000 积分）' AS section;
SELECT coalesce(u.display_name, w.user_id) who, l.entry_type, -l.amount credits, l.reference_type, l.reference_id, $(bj 'l.created_at') at_bj
FROM aep_ledger_entries l JOIN aep_wallets w ON w.id=l.wallet_id LEFT JOIN aep_users u ON u.id=coalesce(w.user_id, w.member_user_id)
WHERE l.created_at >= $W AND l.entry_type IN ('SPEND','SCOPED_SPEND') AND -l.amount >= 2000
ORDER BY -l.amount DESC LIMIT 20;

SELECT '== 6 窗口内按模型接入点（模型扣费，按冻结创建时间）' AS section;
SELECT json_unquote(json_extract(m.target_json,'$.endpointId')) endpoint, p.name,
       count(*) jobs,
       sum(h.status='COMMITTED') committed, sum(h.status='RELEASED') released, sum(h.status='HELD') in_flight,
       round(100*sum(h.status='RELEASED')/count(*)) released_pct,
       sum(coalesce(m.settled_payable_credits,0)) settled_credits,
       sum(coalesce(m.settled_scoped_credits,0)) from_grant,
       sum(coalesce(m.settled_wallet_credits,0)) from_wallet
FROM aep_model_charges m JOIN aep_credit_holds h ON h.id=m.hold_id
LEFT JOIN ai_model_providers p ON p.id=json_unquote(json_extract(m.target_json,'$.endpointId'))
WHERE h.created_at >= $W
GROUP BY endpoint, p.name ORDER BY settled_credits DESC, jobs DESC;

SELECT '== 7 窗口内按任务类型（全部冻结）' AS section;
SELECT reference_type, count(*) holds, sum(status='COMMITTED') committed, sum(status='RELEASED') released, sum(status='HELD') in_flight,
       sum(amount) frozen_total
FROM aep_credit_holds WHERE created_at >= $W GROUP BY reference_type ORDER BY holds DESC;

SELECT '== 8 窗口内发出的积分（赠送 / 调整 / 激活码 / 赠款 / 充值 / 退款）' AS section;
SELECT l.entry_type, coalesce(u.display_name, w.user_id) who, l.amount, left(l.description,60) description, $(bj 'l.created_at') at_bj
FROM aep_ledger_entries l JOIN aep_wallets w ON w.id=l.wallet_id LEFT JOIN aep_users u ON u.id=coalesce(w.user_id, w.member_user_id)
WHERE l.created_at >= $W AND l.entry_type IN ('GIFT','ADJUST','LICENSE_GRANT','SCOPED_GRANT','RECHARGE','REFUND_CASH','TRANSFER_IN','TRANSFER_OUT')
ORDER BY l.created_at DESC LIMIT 40;

SELECT '== 9 赠款活动' AS section;
SELECT c.name, c.active, c.total_issue_limit, c.issued,
       coalesce(sum(g.available),0) available, coalesce(sum(g.frozen),0) frozen, coalesce(sum(g.spent),0) spent, coalesce(sum(g.expired),0) expired,
       $(bj 'c.expires_at') expires_bj
FROM aep_credit_campaigns c LEFT JOIN aep_credit_grants g ON g.campaign_id=c.id
GROUP BY c.id, c.name, c.active, c.total_issue_limit, c.issued, c.expires_at ORDER BY c.expires_at;

SELECT '== 9b 7 天内到期仍有余额的赠款' AS section;
SELECT coalesce(u.display_name, w.user_id) who, g.available, $(bj 'g.expires_at') expires_bj
FROM aep_credit_grants g JOIN aep_wallets w ON w.id=g.wallet_id LEFT JOIN aep_users u ON u.id=coalesce(w.user_id, w.member_user_id)
WHERE g.available > 0 AND g.expires_at < utc_timestamp() + interval 7 day ORDER BY g.expires_at LIMIT 30;

SELECT '== 10 全平台余额快照' AS section;
SELECT account_type, count(*) wallets, sum(total_balance) total, sum(gift_balance) gift, sum(license_balance) license,
       sum(recharge_balance) recharge, sum(pending_balance) pending
FROM aep_wallets GROUP BY account_type;
SELECT 'grants' kind, count(*) n, sum(available) available, sum(frozen) frozen, sum(spent) spent, sum(expired) expired FROM aep_credit_grants;

COMMIT;
SQL

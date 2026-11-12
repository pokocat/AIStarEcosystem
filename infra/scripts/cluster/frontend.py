"""Verify a frontend traffic switch against both public routes and ALB health."""
import time
from subprocess import TimeoutExpired

from policy import Refused


def frontend_health(cluster, listener_id, node):
    result = cluster.alb('GetListenerHealthStatus', ['--ListenerId', listener_id, '--IncludeRule', 'true'])
    server_id = cluster.config['nodes'][node]['instance_id']
    groups = [
        group for rule in result.get('RuleHealthStatus', [])
        for group in rule.get('ServerGroupInfos', [])
        if group.get('ServerGroupId') == cluster.expected['group']
    ]
    if not groups or any(group.get('HealthCheckEnabled') != 'on' for group in groups):
        return {'ready': False, 'statuses': ['missing-health-report']}
    statuses = sorted({
        entry.get('Status') or 'unknown'
        for group in groups for entry in group.get('NonNormalServers', [])
        if entry.get('ServerId') == server_id
    })
    return {'ready': not statuses, 'statuses': statuses}


def verify_frontend_serving(cluster, listener_id, node, expected, probe, timeout=75):
    deadline = time.monotonic() + timeout
    last_observation = None
    while True:
        try:
            rows = probe(expected, False)
            routes = {'count': len(rows), 'other_nodes': sorted({row[4] for row in rows if row[4] != node})}
        except (Refused, OSError, TimeoutExpired) as error:
            routes = {'error': str(error)}
        try:
            health = frontend_health(cluster, listener_id, node)
        except (Refused, OSError, TimeoutExpired) as error:
            health = {'ready': False, 'error': str(error)}
        observation = {'routes': routes, 'health': health}
        if observation != last_observation:
            cluster.record('front cutover observation', node=node, **observation)
            last_observation = observation
        if routes.get('count') and not routes['other_nodes'] and health['ready']:
            cluster.record('front single node verified', node=node, builds=expected, routes=routes['count'])
            return
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise RuntimeError(f'前端切流验收超时 {node}: VIP={routes}; ALB健康={health}')
        time.sleep(min(2, remaining))

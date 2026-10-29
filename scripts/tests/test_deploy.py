import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'deploy.sh'


@unittest.skipIf(os.geteuid() == 0, 'Deployment deliberately refuses root')
class DeployCommands(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'checkout with spaces'
        (self.root / 'scripts').mkdir(parents=True)
        (self.root / '.git').mkdir()
        (self.root / '.env.deploy').write_text('private fixture')
        shutil.copy(SCRIPT, self.root / 'scripts/deploy.sh')
        (self.root / 'scripts/database.sh').write_text(
            '#!/bin/bash\necho BACKUP >> "$DEPLOY_TEST_LOG"\n'
            'exit "${DEPLOY_BACKUP_EXIT:-0}"\n')
        bin_dir = Path(self.temp.name) / 'bin'
        bin_dir.mkdir()
        runner = '''#!/usr/bin/env python3
import json, os, subprocess, sys
name = os.path.basename(sys.argv[0])
a = sys.argv[1:]
with open(os.environ['DEPLOY_TEST_LOG'], 'a') as log:
    log.write(json.dumps([name] + a) + '\\n')
if name == 'sudo':
    sys.exit(0 if a == ['-v'] else subprocess.call(a))
if name == 'git':
    if a == ['branch', '--show-current']: print(os.environ.get('DEPLOY_BRANCH', 'main'))
    elif a == ['status', '--porcelain']: print(os.environ.get('DEPLOY_DIRTY', ''))
    elif a[:2] == ['rev-parse', '--abbrev-ref']: print('origin/main')
    elif a[:2] == ['rev-parse', '--git-path']: print('.git/marksman-deploy.lock')
    elif a[0] == 'rev-parse': print('abc123')
    elif a[0] == 'pull': sys.exit(int(os.environ.get('DEPLOY_PULL_EXIT', '0')))
if name == 'docker' and 'up' in a: sys.exit(int(os.environ.get('DEPLOY_UP_EXIT', '0')))
'''
        for name in ['git', 'sudo', 'docker']:
            path = bin_dir / name
            path.write_text(runner)
            path.chmod(0o700)
        self.log = Path(self.temp.name) / 'commands'
        self.env = dict(os.environ, PATH=str(bin_dir) + os.pathsep + os.environ['PATH'],
                        DEPLOY_TEST_LOG=str(self.log))

    def run_deploy(self, **env):
        return subprocess.run(['bash', str(self.root / 'scripts/deploy.sh')],
                              env=dict(self.env, **env), capture_output=True, text=True)

    def commands(self):
        return self.log.read_text().splitlines() if self.log.exists() else []

    def test_success_backs_up_before_pull_and_waits_before_showing_status(self):
        result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = self.commands()
        backup = commands.index('BACKUP')
        pull = next(i for i, c in enumerate(commands) if '"pull"' in c)
        up = next(i for i, c in enumerate(commands) if c.startswith('["docker"') and '"up"' in c)
        ps = next(i for i, c in enumerate(commands) if c.startswith('["docker"') and '"ps"' in c)
        self.assertLess(backup, pull)
        self.assertLess(pull, up)
        self.assertLess(up, ps)
        self.assertIn('"--wait"', commands[up])
        self.assertIn('Deployed commit: abc123', result.stdout)

    def test_wrong_branch_and_dirty_checkout_stop_before_backup(self):
        for env in [dict(DEPLOY_BRANCH='feature'), dict(DEPLOY_DIRTY=' M file')]:
            with self.subTest(env=env):
                result = self.run_deploy(**env)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn('BACKUP', self.commands())

    def test_backup_failure_prevents_pull(self):
        result = self.run_deploy(DEPLOY_BACKUP_EXIT='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any('"pull"' in c for c in self.commands()))

    def test_pull_failure_prevents_build(self):
        result = self.run_deploy(DEPLOY_PULL_EXIT='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any('"up"' in c for c in self.commands()))

    def test_startup_failure_does_not_claim_success(self):
        result = self.run_deploy(DEPLOY_UP_EXIT='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('Deployed commit:', result.stdout)
        self.assertIn('no automatic code or database rollback', result.stderr)

    def test_missing_environment_stops_before_any_commands(self):
        (self.root / '.env.deploy').unlink()
        self.assertNotEqual(self.run_deploy().returncode, 0)
        self.assertEqual(self.commands(), [])


if __name__ == '__main__':
    unittest.main()

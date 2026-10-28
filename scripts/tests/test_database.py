import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'database.sh'


class DatabaseCommands(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        docker = self.bin / 'docker'
        docker.write_text('''#!/usr/bin/env python3
import os, sys
with open(os.environ['DATABASE_TEST_LOG'], 'a') as log:
    log.write(repr(sys.argv[1:]) + '\\n')
args = ' '.join(sys.argv[1:])
mode = os.environ.get('DATABASE_TEST_MODE', '')
if 'pg_dump' in args:
    sys.stdout.buffer.write(b'partial' if mode == 'dump-fail' else b'invalid' if mode == 'bad-archive' else b'archive')
    sys.exit(1 if mode == 'dump-fail' else 0)
if 'pg_restore' in args and '--list' in args:
    sys.exit(0 if sys.stdin.buffer.read() == b'archive' else 1)
if 'createdb' in args and mode == 'existing':
    sys.exit(1)
''')
        docker.chmod(0o700)
        self.log = self.root / 'commands'
        self.env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ['PATH'],
                        DATABASE_TEST_LOG=str(self.log))

    def run_command(self, *args, mode=''):
        return subprocess.run(['bash', str(SCRIPT), *map(str, args)],
                              env=dict(self.env, DATABASE_TEST_MODE=mode),
                              capture_output=True, text=True)

    def archive(self, content=b'archive'):
        archive = self.root / 'input.dump'
        archive.write_bytes(content)
        return archive

    def test_backup_is_private_and_unique_even_in_a_path_with_spaces(self):
        directory = self.root / 'backup directory'
        paths = []
        for _ in range(2):
            result = self.run_command('backup', '--rehearsal', directory)
            self.assertEqual(result.returncode, 0, result.stderr)
            path = Path(result.stdout.strip())
            self.assertFalse(path.name.startswith('.'))
            self.assertEqual(path.read_bytes(), b'archive')
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            paths.append(path)
        self.assertNotEqual(*paths)
        self.assertEqual(list(directory.glob('*.partial')), [])
        self.assertIn('marksman-rehearsal', self.log.read_text())

    def test_failed_dump_or_archive_validation_never_publishes_a_backup(self):
        for mode in ['dump-fail', 'bad-archive']:
            with self.subTest(mode=mode):
                directory = self.root / mode
                directory.mkdir()
                previous = directory / 'previous.dump'
                previous.write_bytes(b'preserve')
                result = self.run_command('backup', '--rehearsal', directory, mode=mode)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(list(directory.iterdir()), [previous])
                self.assertEqual(previous.read_bytes(), b'preserve')

    def test_restore_validates_archive_then_creates_new_database(self):
        result = self.run_command('restore', '--rehearsal', self.archive(), 'marksman_restore_test')
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = self.log.read_text().splitlines()
        self.assertEqual(len(commands), 3)
        self.assertIn('--list', commands[0])
        self.assertIn('createdb', commands[1])
        self.assertIn('--single-transaction', commands[2])
        self.assertIn('--exit-on-error', commands[2])

    def test_existing_destination_is_never_restored_over(self):
        result = self.run_command('restore', '--rehearsal', self.archive(),
                                  'marksman_restore_test', mode='existing')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(self.log.read_text().splitlines()), 2)

    def test_invalid_archive_never_creates_a_database(self):
        result = self.run_command('restore', '--rehearsal', self.archive(b'broken'),
                                  'marksman_restore_test')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('createdb', self.log.read_text())

    def test_unsafe_or_truncated_destination_names_are_rejected_before_docker(self):
        archive = self.archive()
        for target in ['marksman', 'postgres', 'marksman_restore_bad;sql', 'marksman_restore_' + 'a' * 64]:
            with self.subTest(target=target):
                result = self.run_command('restore', '--rehearsal', archive, target)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(self.log.exists())


if __name__ == '__main__':
    unittest.main()

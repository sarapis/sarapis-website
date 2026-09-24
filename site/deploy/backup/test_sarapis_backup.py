"""Tests for sarapis-backup.py.   python3 -m unittest discover -s site/deploy/backup

Each test builds a throwaway site (a real SQLite database with a users table, a
media directory) and runs the script as cron would: as a subprocess, configured
through the environment. The off-box copy goes to a fake `rclone` on PATH that
copies into a local directory, or fails on demand.
"""
import gzip
import json
import os
import shutil
import sqlite3
import stat
import subprocess
import sys
import tempfile
import time
import unittest

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sarapis-backup.py')

FAKE_RCLONE = """#!/bin/sh
# copyto SRC DST: copy into $FAKE_REMOTE_DIR. delete ...: no-op. FAKE_RCLONE_FAIL=1 fails.
[ -n "$FAKE_RCLONE_FAIL" ] && { echo "simulated remote outage" >&2; exit 5; }
case "$1" in
  copyto) cp "$2" "$FAKE_REMOTE_DIR/$(basename "$3")" ;;
  delete) : ;;
esac
"""


class SiteFixture(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        self.data = os.path.join(self.root, 'data')
        self.media = os.path.join(self.root, 'media')
        self.backups = os.path.join(self.root, 'backups')
        self.remote = os.path.join(self.root, 'remote')
        self.bin = os.path.join(self.root, 'bin')
        for d in (self.data, self.media, self.remote, self.bin):
            os.makedirs(d)
        db = sqlite3.connect(os.path.join(self.data, 'sarapis.db'))
        db.executescript('CREATE TABLE users(id INTEGER); INSERT INTO users VALUES (1),(2);'
                         'CREATE TABLE posts(id INTEGER); INSERT INTO posts VALUES (1),(2),(3);')
        db.close()
        for i in range(3):
            with open(os.path.join(self.media, f'img{i}.png'), 'wb') as f:
                f.write(os.urandom(256))
        rclone = os.path.join(self.bin, 'rclone')
        with open(rclone, 'w') as f:
            f.write(FAKE_RCLONE)
        os.chmod(rclone, os.stat(rclone).st_mode | stat.S_IEXEC)

    def tearDown(self):
        shutil.rmtree(self.root)

    def run_backup(self, **extra):
        env = {
            'PATH': f'{self.bin}:{os.environ["PATH"]}',
            'DATA_DIR': self.data,
            'MEDIA_DIR': self.media,
            'BACKUP_DIR': self.backups,
            'FAKE_REMOTE_DIR': self.remote,
            **extra,
        }
        proc = subprocess.run([sys.executable, SCRIPT], env=env, capture_output=True, text=True)
        with open(os.path.join(self.data, 'backup-status.json')) as f:
            return proc.returncode, json.load(f)


class BackupTest(SiteFixture):
    def test_backup_restores_with_the_same_counts(self):
        code, status = self.run_backup()
        self.assertEqual(code, 0, status)
        self.assertTrue(status['ok'])
        self.assertTrue(status['db']['restoreTested'])
        self.assertEqual(status['db']['counts']['users'], 2)
        self.assertEqual(status['db']['counts']['posts'], 3)
        self.assertEqual(status['media']['files'], 3)
        # Independently restore the artifact the way a person would.
        with gzip.open(os.path.join(self.backups, status['db']['file'])) as g:
            restored = os.path.join(self.root, 'restored.db')
            with open(restored, 'wb') as f:
                shutil.copyfileobj(g, f)
        conn = sqlite3.connect(restored)
        self.assertEqual(conn.execute('select count(*) from posts').fetchone()[0], 3)
        conn.close()

    def test_no_remote_is_recorded_not_hidden(self):
        code, status = self.run_backup()
        self.assertEqual(code, 0)
        self.assertEqual(status['offbox'], {'remote': None, 'ok': None, 'at': None})

    def test_offbox_copy_lands(self):
        code, status = self.run_backup(RCLONE_REMOTE='fake:bucket')
        self.assertEqual(code, 0, status)
        self.assertTrue(status['offbox']['ok'])
        self.assertEqual(sorted(os.listdir(self.remote)), sorted([status['db']['file'], status['media']['file']]))

    def test_offbox_failure_fails_the_run_but_keeps_the_local_backup(self):
        code, status = self.run_backup(RCLONE_REMOTE='fake:bucket', FAKE_RCLONE_FAIL='1')
        self.assertEqual(code, 1)
        self.assertFalse(status['ok'])
        self.assertIs(status['offbox']['ok'], False)
        self.assertIn('simulated remote outage', status['error'])
        self.assertTrue(os.path.exists(os.path.join(self.backups, status['db']['file'])))

    def test_missing_database_fails_loudly(self):
        os.remove(os.path.join(self.data, 'sarapis.db'))
        code, status = self.run_backup()
        self.assertEqual(code, 1)
        self.assertFalse(status['ok'])
        self.assertIn('database not found', status['error'])

    def test_a_database_with_no_users_is_refused(self):
        db = sqlite3.connect(os.path.join(self.data, 'sarapis.db'))
        db.execute('DELETE FROM users')
        db.commit()
        db.close()
        code, status = self.run_backup()
        self.assertEqual(code, 1)
        self.assertIn('no users', status['error'])

    def test_rotation_keeps_the_newest(self):
        for _ in range(3):
            code, _status = self.run_backup(KEEP='2')
            self.assertEqual(code, 0)
            time.sleep(1.1)  # names carry a per-second timestamp
        names = os.listdir(self.backups)
        self.assertEqual(sum(n.startswith('sarapis-db-') for n in names), 2)
        self.assertEqual(sum(n.startswith('media-') for n in names), 2)
        self.assertFalse([n for n in names if n.endswith('.part')])


def load_module():
    import importlib.util
    spec = importlib.util.spec_from_file_location('sarapis_backup', SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class RestoreTestTest(SiteFixture):
    """The restore test must actually be able to fail. Fixtures always restore
    cleanly, so without these a disabled restore check passed every test above."""

    def test_counts_that_differ_after_restore_reject_the_backup(self):
        mod = load_module()
        real, seen = mod.check_db, []

        def drifting(conn):
            counts = real(conn)
            seen.append(counts)
            return {**counts, 'posts': counts['posts'] - 1} if len(seen) == 2 else counts

        mod.check_db = drifting
        os.makedirs(self.backups)
        with self.assertRaisesRegex(RuntimeError, 'differ from snapshot'):
            mod.backup_db(os.path.join(self.data, 'sarapis.db'), self.backups, 'T')
        self.assertEqual(os.listdir(self.backups), [], 'no artifact or .part may remain')

    def test_a_truncated_artifact_is_rejected(self):
        from unittest import mock
        mod = load_module()
        real_open = gzip.open

        def truncating(path, mode='rb', *args, **kwargs):
            if 'r' in mode:  # the restore read: hand it half the artifact
                with open(path, 'rb') as f:
                    data = f.read()
                cut = os.path.join(self.root, 'truncated.gz')
                with open(cut, 'wb') as f:
                    f.write(data[: len(data) // 2])
                return real_open(cut, mode, *args, **kwargs)
            return real_open(path, mode, *args, **kwargs)

        os.makedirs(self.backups)
        with mock.patch.object(mod.gzip, 'open', truncating):
            with self.assertRaises(Exception):
                mod.backup_db(os.path.join(self.data, 'sarapis.db'), self.backups, 'T')
        self.assertFalse([n for n in os.listdir(self.backups) if n.startswith('sarapis-db-')])


if __name__ == '__main__':
    unittest.main()

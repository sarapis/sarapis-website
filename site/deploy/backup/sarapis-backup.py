#!/usr/bin/env python3
"""Back up a self-hosted Sarapis site: its SQLite database and its media.

Run nightly from cron (see sarapis-backup.cron). Each run:

  1. copies the live database with SQLite's online-backup API — a consistent
     snapshot that is safe while the site is writing, unlike `cp`, which can
     capture a half-written transaction;
  2. refuses a copy that fails `PRAGMA integrity_check`, or that has no users
     (the signature of backing up the wrong or an empty file);
  3. compresses it, then proves the compressed ARTIFACT restores — it is
     decompressed again, opened and integrity-checked, and its row counts must
     match. A backup nobody has restored is a hope, not a backup;
  4. archives the media directory and checks the archive's file count;
  5. keeps the newest KEEP of each kind;
  6. if RCLONE_REMOTE is set, copies both off the machine and prunes remote
     copies older than REMOTE_KEEP_DAYS;
  7. records the outcome in STATUS_FILE. The site serves it at
     /next/backup/health so an uptime monitor notices when backups stop —
     a backup job that fails quietly is no better than none.

Configuration (environment):
  DATA_DIR          directory holding sarapis.db        default /opt/sarapis/data
  MEDIA_DIR         uploaded media                      default /opt/sarapis/media
  BACKUP_DIR        where local backups are written     default /opt/sarapis/backups
  STATUS_FILE       outcome record; keep it inside DATA_DIR, which the site
                    container mounts                    default $DATA_DIR/backup-status.json
  KEEP              local copies of each kind to keep   default 14
  RCLONE_REMOTE     e.g. "r2:my-bucket/sarapis". Unset = no off-box copy, which
                    the health check reports as a failure: a backup on the same
                    disk does not survive losing the disk.
  REMOTE_KEEP_DAYS  remote retention                    default 30

Exits non-zero on any failure, after recording it. Needs only the Python 3
standard library (plus rclone for the off-box copy).
"""
import gzip
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
from datetime import datetime, timezone

DB_PREFIX, DB_SUFFIX = 'sarapis-db-', '.db.gz'
MEDIA_PREFIX, MEDIA_SUFFIX = 'media-', '.tar.gz'
# Row counts recorded with each backup, and compared after the restore test.
COUNTED_TABLES = ('users', 'posts', 'pages', 'projects', 'activity_events', 'media')


def now_iso():
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def env(key, default):
    return os.environ.get(key) or default


def check_db(conn):
    """Integrity + row counts; raises if the copy is not a usable site database."""
    result = conn.execute('PRAGMA integrity_check').fetchall()
    if result != [('ok',)]:
        raise RuntimeError(f'integrity_check failed: {result[:3]}')
    counts = {}
    for table in COUNTED_TABLES:
        try:
            counts[table] = conn.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]
        except sqlite3.OperationalError:
            counts[table] = None  # table absent in this schema
    if not counts.get('users'):
        raise RuntimeError('backup has no users — wrong or empty database file')
    return counts


def backup_db(src, backup_dir, stamp):
    if not os.path.isfile(src):
        raise FileNotFoundError(f'database not found: {src}')
    final = os.path.join(backup_dir, f'{DB_PREFIX}{stamp}{DB_SUFFIX}')
    part = final + '.part'
    try:
        counts = _snapshot_compress_verify(src, backup_dir, part)
    except BaseException:
        if os.path.exists(part):
            os.remove(part)  # an unverified artifact must not linger beside real backups
        raise
    os.replace(part, final)
    return {'file': os.path.basename(final), 'bytes': os.path.getsize(final), 'integrity': 'ok', 'restoreTested': True, 'counts': counts}


def _snapshot_compress_verify(src, backup_dir, part):
    with tempfile.TemporaryDirectory(dir=backup_dir) as tmp:
        raw = os.path.join(tmp, 'snapshot.db')
        source = sqlite3.connect(f'file:{src}?mode=ro', uri=True)
        dest = sqlite3.connect(raw)
        try:
            source.backup(dest)
            counts = check_db(dest)
        finally:
            dest.close()
            source.close()
        with open(raw, 'rb') as f, gzip.open(part, 'wb', compresslevel=6) as g:
            shutil.copyfileobj(f, g)

        # The restore test, on the artifact itself.
        restored = os.path.join(tmp, 'restored.db')
        with gzip.open(part, 'rb') as g, open(restored, 'wb') as f:
            shutil.copyfileobj(g, f)
        conn = sqlite3.connect(restored)
        try:
            restored_counts = check_db(conn)
        finally:
            conn.close()
        if restored_counts != counts:
            raise RuntimeError(f'restored counts {restored_counts} differ from snapshot {counts}')
    return counts


def backup_media(media_dir, backup_dir, stamp):
    if not os.path.isdir(media_dir):
        raise FileNotFoundError(f'media directory not found: {media_dir}')
    expected = sum(len(files) for _, _, files in os.walk(media_dir))
    final = os.path.join(backup_dir, f'{MEDIA_PREFIX}{stamp}{MEDIA_SUFFIX}')
    part = final + '.part'
    with tarfile.open(part, 'w:gz') as tar:
        tar.add(media_dir, arcname='media')
    with tarfile.open(part, 'r:gz') as tar:
        archived = sum(1 for m in tar.getmembers() if m.isfile())
    if archived != expected:
        os.remove(part)
        raise RuntimeError(f'media archive holds {archived} files, expected {expected}')
    os.replace(part, final)
    return {'file': os.path.basename(final), 'bytes': os.path.getsize(final), 'files': archived}


def rotate(backup_dir, prefix, suffix, keep):
    """Delete all but the newest `keep` backups of one kind (names sort by time)."""
    names = sorted(n for n in os.listdir(backup_dir) if n.startswith(prefix) and n.endswith(suffix))
    removed = names[:-keep] if keep > 0 else []
    for name in removed:
        os.remove(os.path.join(backup_dir, name))
    return len(removed)


def rclone(*args):
    result = subprocess.run(['rclone', *args], capture_output=True, text=True, timeout=1800)
    if result.returncode != 0:
        raise RuntimeError(f'rclone {args[0]} failed ({result.returncode}): {result.stderr.strip()[-300:]}')


def offbox(remote, backup_dir, files, keep_days):
    for name in files:
        rclone('copyto', os.path.join(backup_dir, name), f'{remote.rstrip("/")}/{name}')
    for pattern in (f'{DB_PREFIX}*', f'{MEDIA_PREFIX}*'):
        rclone('delete', remote, '--min-age', f'{keep_days}d', '--include', pattern)


def write_status(path, status):
    tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(status, f, indent=2)
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)


def main():
    data_dir = env('DATA_DIR', '/opt/sarapis/data')
    media_dir = env('MEDIA_DIR', '/opt/sarapis/media')
    backup_dir = env('BACKUP_DIR', '/opt/sarapis/backups')
    status_file = env('STATUS_FILE', os.path.join(data_dir, 'backup-status.json'))
    keep = int(env('KEEP', '14'))
    remote = os.environ.get('RCLONE_REMOTE') or None
    keep_days = int(env('REMOTE_KEEP_DAYS', '30'))
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')

    status = {
        'ok': False,
        'startedAt': now_iso(),
        'at': None,
        'db': None,
        'media': None,
        'rotated': None,
        'offbox': {'remote': remote, 'ok': None, 'at': None},
        'error': None,
    }
    stage = 'local'
    try:
        os.makedirs(backup_dir, exist_ok=True)
        status['db'] = backup_db(os.path.join(data_dir, 'sarapis.db'), backup_dir, stamp)
        status['media'] = backup_media(media_dir, backup_dir, stamp)
        status['rotated'] = rotate(backup_dir, DB_PREFIX, DB_SUFFIX, keep) + rotate(backup_dir, MEDIA_PREFIX, MEDIA_SUFFIX, keep)
        if remote:
            stage = 'offbox'
            offbox(remote, backup_dir, [status['db']['file'], status['media']['file']], keep_days)
            status['offbox'].update(ok=True, at=now_iso())
        status['ok'] = True
    except Exception as e:  # recorded, then reported through the exit status
        status['error'] = f'{stage}: {type(e).__name__}: {e}'
        if stage == 'offbox':
            status['offbox']['ok'] = False
    finally:
        status['at'] = now_iso()
        write_status(status_file, status)
    print(json.dumps(status))
    return 0 if status['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())

"""
Scripts/local_backup.py
-----------------------
Manual full backup script — run anytime to immediately save:
  1. Full ZIP (data/ + uploads/) → data/local_backups/
  2. JSON-only copies           → data/local_backups/
  3. Git commit + push          → GitHub

Usage:
    python Scripts/local_backup.py
    python Scripts/local_backup.py --json-only    (skip ZIP, faster)
    python Scripts/local_backup.py --no-git       (skip git push)
"""

import os
import sys
import argparse

# Allow imports from project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from services.local_backup_service import do_json_backup, do_zip_backup, do_git_backup

import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(message)s',
    datefmt='%H:%M:%S'
)

def main():
    parser = argparse.ArgumentParser(description='Trading Journal — Manual Backup')
    parser.add_argument('--json-only', action='store_true', help='Only JSON backup, skip full ZIP')
    parser.add_argument('--no-git',    action='store_true', help='Skip git commit+push')
    args = parser.parse_args()

    print('=' * 50)
    print('  Trading Journal — Manual Backup')
    print('=' * 50)

    print('\n[1/3] JSON backup...')
    do_json_backup()

    if not args.json_only:
        print('\n[2/3] Full ZIP backup (data + images)...')
        do_zip_backup()
    else:
        print('\n[2/3] Full ZIP skipped (--json-only)')

    if not args.no_git:
        print('\n[3/3] Git commit + push...')
        do_git_backup()
    else:
        print('\n[3/3] Git skipped (--no-git)')

    print('\nBackup complete!')
    print(f'Location: {os.path.join(BASE_DIR, "data", "local_backups")}')

if __name__ == '__main__':
    main()

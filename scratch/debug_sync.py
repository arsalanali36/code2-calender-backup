
import sys
import os
import json
from datetime import datetime

# Add project root to path
sys.path.append(os.getcwd())

from services.dhan_service import get_sync_tasks

tasks = get_sync_tasks()
print(f"Total Tasks Found: {len(tasks)}")
for t in tasks:
    print(t)

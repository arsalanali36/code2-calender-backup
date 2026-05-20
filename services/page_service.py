"""
services/page_service.py
------------------------
Business logic for page routes: blog entry loading and formatting.
"""
import json
import os
from datetime import datetime


def load_blog_entries(blog_path: str) -> list:
    """Load and return raw blog entries from the JSON file. Returns [] if missing."""
    if not os.path.exists(blog_path):
        return []
    with open(blog_path, 'r', encoding='utf-8') as f:
        content = f.read().strip()
        if not content:
            return []
        return json.loads(content)


def get_blog_entries_for_template(blog_path: str) -> list:
    """Return blog entries formatted for the /updates HTML template (long date format)."""
    entries = load_blog_entries(blog_path)
    for i, entry in enumerate(entries):
        dt = datetime.strptime(entry['date'], '%Y-%m-%d')
        entry['display_date'] = dt.strftime('%B %d, %Y')
        entry['display_day'] = dt.strftime('%A')
        entry['_idx'] = i
    entries.sort(key=lambda x: (x['date'], x['_idx']), reverse=True)
    return entries


def get_blog_entries_for_api(blog_path: str) -> list:
    """Return blog entries formatted for the /api/blog-posts JSON response (short date)."""
    entries = load_blog_entries(blog_path)
    for entry in entries:
        dt = datetime.strptime(entry['date'], '%Y-%m-%d')
        entry['display_date'] = f"{dt.strftime('%B')} {dt.day}"
        entry['display_day'] = dt.strftime('%A')
    entries.sort(key=lambda x: x['date'], reverse=True)
    return entries

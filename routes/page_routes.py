"""
routes/page_routes.py
---------------------
HTML page routes: main app and dev-blog updates.
"""
import json
import os
from datetime import datetime

from flask import Blueprint, render_template, jsonify, send_from_directory, redirect, request

from config import BASE_DIR, CACHE_BUST

MOBILE_DIST = os.path.join(BASE_DIR, 'tradefeed', 'dist')

MOBILE_KEYWORDS = ('Mobile', 'Android', 'iPhone', 'iPad', 'iPod', 'BlackBerry', 'IEMobile', 'Opera Mini')

page_bp = Blueprint('page', __name__)


@page_bp.route('/')
def index():
    ua = request.headers.get('User-Agent', '')
    if any(k in ua for k in MOBILE_KEYWORDS):
        return redirect('/mobile/')
    return render_template('index.html', cache_bust=CACHE_BUST)


@page_bp.route('/updates')
def updates():
    blog_path = os.path.join(BASE_DIR, 'data', 'dev-blog.json')
    entries = []
    if os.path.exists(blog_path):
        with open(blog_path, 'r', encoding='utf-8') as f:
            entries = json.load(f)
    for i, entry in enumerate(entries):
        dt = datetime.strptime(entry['date'], '%Y-%m-%d')
        entry['display_date'] = dt.strftime('%B %d, %Y')
        entry['display_day']  = dt.strftime('%A')
        entry['_idx'] = i
    entries.sort(key=lambda x: (x['date'], x['_idx']), reverse=True)
    return render_template('updates.html', entries=entries, cache_bust=CACHE_BUST)


@page_bp.route('/mobile/')
@page_bp.route('/mobile')
def mobile():
    return send_from_directory(MOBILE_DIST, 'index.html')


@page_bp.route('/mobile/assets/<path:filename>')
def mobile_assets(filename):
    return send_from_directory(os.path.join(MOBILE_DIST, 'assets'), filename)


@page_bp.route('/api/blog-posts')
def blog_posts_api():
    blog_path = os.path.join(BASE_DIR, 'data', 'dev-blog.json')
    entries = []
    if os.path.exists(blog_path):
        with open(blog_path, 'r', encoding='utf-8') as f:
            entries = json.load(f)
    for i, entry in enumerate(entries):
        dt = datetime.strptime(entry['date'], '%Y-%m-%d')
        entry['display_date'] = f"{dt.strftime('%B')} {dt.day}"
        entry['display_day']  = dt.strftime('%A')
    entries.sort(key=lambda x: x['date'], reverse=True)
    return jsonify(entries)

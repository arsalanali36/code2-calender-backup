"""
routes/page_routes.py
---------------------
HTML page routes: main app and dev-blog updates.
"""
import json
import os
import time

from flask import Blueprint, render_template, jsonify, send_from_directory, redirect, request

from config import BASE_DIR, CACHE_BUST, DATA_FILE
BUNDLE_PATH = os.path.join(BASE_DIR, 'static', 'js', 'bundle.js')
from services.page_service import get_blog_entries_for_template, get_blog_entries_for_api

MOBILE_DIST = os.path.join(BASE_DIR, 'tradefeed', 'dist')

MOBILE_KEYWORDS = ('Mobile', 'Android', 'iPhone', 'iPad', 'iPod', 'BlackBerry', 'IEMobile', 'Opera Mini')

page_bp = Blueprint('page', __name__)

BLOG_PATH = os.path.join(BASE_DIR, 'data', 'dev-blog.json')


@page_bp.route('/')
def index():
    ua = request.headers.get('User-Agent', '')
    if any(k in ua for k in MOBILE_KEYWORDS):
        return redirect('/mobile/')
    # Embed trades data directly in HTML — eliminates the /api/trades round-trip on load
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            initial_data_json = f.read()
        # Validate it's real JSON (don't embed corrupt data)
        json.loads(initial_data_json)
    except Exception:
        initial_data_json = '{}'
    use_bundle = os.path.exists(BUNDLE_PATH)
    return render_template('index.html', cache_bust=int(time.time()),
                           initial_data_json=initial_data_json,
                           use_bundle=use_bundle)


@page_bp.route('/updates')
def updates():
    entries = get_blog_entries_for_template(BLOG_PATH)
    return render_template('updates.html', entries=entries, cache_bust=int(time.time()))


@page_bp.route('/gallery-classic')
def gallery_classic():
    return render_template('gallery_classic_page.html', cache_bust=int(time.time()))


@page_bp.route('/strategy-lab')
def strategy_lab():
    return render_template('strategy_lab.html', cache_bust=int(time.time()))


@page_bp.route('/mobile/')
@page_bp.route('/mobile')
def mobile():
    return send_from_directory(MOBILE_DIST, 'index.html')


@page_bp.route('/mobile/assets/<path:filename>')
def mobile_assets(filename):
    return send_from_directory(os.path.join(MOBILE_DIST, 'assets'), filename)


@page_bp.route('/api/blog-posts')
def blog_posts_api():
    return jsonify(get_blog_entries_for_api(BLOG_PATH))

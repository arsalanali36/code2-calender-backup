"""
routes/page_routes.py
---------------------
HTML page routes: main app and dev-blog updates.
"""
import json
import os
import time

from flask import Blueprint, render_template, jsonify, send_from_directory, redirect, request
from flask_login import current_user

from config import BASE_DIR, CACHE_BUST, DATA_FILE
from processors.data_processors import get_user_data_file
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
    # Unauthenticated visitors land on the public pitch deck, not the login wall
    if not current_user.is_authenticated:
        return redirect('/app-deck')
    # Embed trades data directly in HTML — eliminates the /api/trades round-trip on load
    # Must read the user-specific file so authenticated users see their own data
    try:
        user_id = current_user.id if current_user.is_authenticated else None
        user_data_file = get_user_data_file(user_id)
        with open(user_data_file, 'r', encoding='utf-8') as f:
            initial_data_json = f.read()
        # Validate it's real JSON (don't embed corrupt data)
        json.loads(initial_data_json)
    except Exception:
        initial_data_json = '{}'
    use_bundle = os.environ.get('USE_BUNDLE') == '1' and os.path.exists(BUNDLE_PATH)
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


_DECK_DEFAULTS = {
    "offer": {
        "highlight": "Free 30-Day Trial",
        "cta": "Start Free Trial"
    },
    "hero_title": "Your Trading Edge Starts Here",
    "hero_subtitle": "The most powerful trading journal built for serious traders. Track, review, and improve every single trade.",
    "tagline": "Har trade ka hisaab. Ab code se.",
    "categories": []
}


@page_bp.route('/app-deck')
def app_deck():
    features_path = os.path.join(BASE_DIR, 'data', 'features.json')
    try:
        if os.path.exists(features_path):
            with open(features_path, 'r', encoding='utf-8') as f:
                deck_data = json.load(f)
        else:
            deck_data = {}
    except Exception:
        deck_data = {}

    # Deep-merge defaults so missing keys never crash the template
    for key, val in _DECK_DEFAULTS.items():
        if key not in deck_data:
            deck_data[key] = val
        elif isinstance(val, dict) and isinstance(deck_data.get(key), dict):
            for subkey, subval in val.items():
                if subkey not in deck_data[key]:
                    deck_data[key][subkey] = subval

    return render_template('app_deck.html', deck=deck_data, cache_bust=int(time.time()))


@page_bp.route('/api/blog-posts')
def blog_posts_api():
    return jsonify(get_blog_entries_for_api(BLOG_PATH))


@page_bp.route('/bulk-download')
def bulk_download_page():
    return render_template('bulk_download.html')

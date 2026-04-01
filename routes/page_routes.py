"""
routes/page_routes.py
---------------------
HTML page routes: main app and dev-blog updates.
"""
import os

from flask import Blueprint, render_template, jsonify, send_from_directory, redirect, request

from config import BASE_DIR, CACHE_BUST
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
    return render_template('index.html', cache_bust=CACHE_BUST)


@page_bp.route('/updates')
def updates():
    entries = get_blog_entries_for_template(BLOG_PATH)
    return render_template('updates.html', entries=entries, cache_bust=CACHE_BUST)


@page_bp.route('/gallery-classic')
def gallery_classic():
    return render_template('gallery_classic_page.html', cache_bust=CACHE_BUST)


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

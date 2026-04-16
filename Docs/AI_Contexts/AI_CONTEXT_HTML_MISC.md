# HTML - Misc (updates, auth)
Consolidated code context for AI assistants.


## File: `templates/updates.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Arsalan's Dev Journey &mdash; Building a Trading Journal App</title>
  <meta name="description" content="Arsalan's Dev Journey: behind-the-scenes story of building a personal trading journal app from scratch with Flask, Fabric.js, and Vanilla JS. Features, bugs, fixes &mdash; all documented." />
  <meta name="keywords" content="trading journal app, Flask, Fabric.js, Vanilla JS, Indian stock market, development blog, trade review, chart annotation, Zerodha, Dhan" />
  <link rel="stylesheet" href="/static/css/style-base.css?v={{ cache_bust }}" />
  <style>

    /* ── PAGE LAYOUT ─────────────────────────────── */
    .page-layout {
      display: flex;
      gap: 48px;
      max-width: 1120px;
      margin: 0 auto;
      padding: 40px 24px 100px;
      align-items: flex-start;
    }

    /* ── SIDEBAR ─────────────────────────────────── */
    .sidebar-nav {
      width: 188px;
      flex-shrink: 0;
      position: sticky;
      top: 76px;
      max-height: calc(100vh - 90px);
      overflow-y: auto;
      -ms-overflow-style: none;
      scrollbar-width: none;
      padding-right: 6px;
    }
    .sidebar-nav::-webkit-scrollbar { width: 0; height: 0; display: none; }
    .sidebar-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text2);
      font-weight: 700;
      margin-bottom: 14px;
      padding-left: 10px;
    }
    .sidebar-item {
      display: block;
      text-decoration: none;
      padding: 8px 10px;
      border-radius: var(--radius);
      border-left: 2px solid transparent;
      margin-bottom: 2px;
      transition: background 0.15s, border-color 0.15s;
    }
    .sidebar-item:hover {
      background: var(--surface2);
      border-left-color: var(--border2);
    }
    .sidebar-item.active {
      background: var(--surface2);
      border-left-color: var(--blue);
    }
    .sidebar-item-heading {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 3px;
      line-height: 1.2;
    }
    .sidebar-item-sub {
      display: block;
      font-size: 0.7rem;
      color: var(--text2);
    }

    /* ── MAIN CONTENT ────────────────────────────── */
    .main-content {
      flex: 1;
      min-width: 0;
    }
    .updates-hero {
      margin-bottom: 56px;
      padding-bottom: 32px;
      border-bottom: 1px solid var(--border2);
    }
    .updates-hero h1 {
      font-size: 1.9rem;
      color: var(--text);
      margin-bottom: 12px;
    }
    .updates-hero p {
      color: var(--text2);
      font-size: 1rem;
      line-height: 1.75;
    }

    /* ── BLOG ENTRY ──────────────────────────────── */
    .blog-entry {
      margin-bottom: 80px;
      padding-bottom: 64px;
      border-bottom: 1px solid var(--border);
      scroll-margin-top: 80px;
    }
    .blog-entry:last-child { border-bottom: none; }

    /* Big date stamp */
    .entry-datestamp {
      margin-bottom: 18px;
      padding-left: 14px;
      border-left: 3px solid var(--blue);
    }
    .date-big {
      display: block;
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text);
      line-height: 1.15;
      letter-spacing: -0.01em;
    }
    .date-day {
      display: block;
      font-size: 0.82rem;
      color: var(--text2);
      margin-top: 3px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    /* Meta row */
    .entry-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .entry-version {
      background: var(--blue);
      color: #0d1117;
      padding: 2px 9px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .entry-tag {
      background: var(--surface2);
      color: var(--text2);
      padding: 2px 9px;
      border-radius: 20px;
      font-size: 0.75rem;
      border: 1px solid var(--border2);
    }

    /* Title + summary */
    .entry-title {
      font-size: 1.45rem;
      color: var(--text);
      margin-bottom: 10px;
      line-height: 1.35;
    }
    .entry-summary {
      color: var(--blue);
      font-size: 0.92rem;
      font-style: italic;
      margin-bottom: 28px;
    }

    /* Body */
    .entry-body {
      color: var(--text2);
      line-height: 1.85;
      font-size: 0.93rem;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    .entry-body h3 {
      font-size: 1rem;
      color: var(--text);
      margin: 28px 0 10px;
    }
    .entry-body p { margin-bottom: 14px; }
    .entry-body strong { color: var(--text); }
    .entry-body em { color: var(--orange); font-style: italic; }
    .entry-body a { color: var(--blue); }
    .entry-body code {
      background: var(--surface2);
      color: var(--green);
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 0.87em;
      font-family: 'Consolas', 'Monaco', monospace;
    }
    .entry-body ol, .entry-body ul {
      padding-left: 22px;
      margin-bottom: 14px;
    }
    .entry-body li { margin-bottom: 6px; }
    .entry-body li strong { color: var(--text); }
    .entry-body img {
      max-width: 100%;
      width: 100%;
      height: auto;
      border-radius: var(--radius);
      border: 1px solid var(--border2);
      margin: 18px 0;
      display: block;
      box-sizing: border-box;
    }
    .entry-body .img-caption {
      text-align: center;
      font-size: 0.8rem;
      color: var(--text2);
      margin-top: -10px;
      margin-bottom: 18px;
      font-style: italic;
    }
    .entry-body .img-row {
      display: flex;
      gap: 12px;
      margin: 18px 0;
      flex-wrap: wrap;
    }
    .entry-body .img-row img { flex: 1; min-width: 200px; margin: 0; }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 80px 0;
      color: var(--text2);
    }
    .empty-state span { font-size: 3rem; display: block; margin-bottom: 16px; }

    /* Back button */
    .back-btn {
      text-decoration: none;
      color: var(--text2);
      font-size: 0.88rem;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border: 1px solid var(--border2);
      border-radius: var(--radius);
      transition: color 0.15s, border-color 0.15s;
    }
    .back-btn:hover { color: var(--text); border-color: var(--text2); }

    /* ── PRE / CODE BLOCKS ───────────────────────── */
    .entry-body pre {
      background: var(--surface2);
      border: 1px solid var(--border2);
      border-radius: var(--radius);
      padding: 14px 16px;
      overflow-x: auto;
      margin-bottom: 14px;
      font-size: 0.84em;
      line-height: 1.6;
    }
    .entry-body pre code {
      background: none;
      padding: 0;
      font-size: inherit;
      color: var(--green);
      white-space: pre;
    }

    /* ── MOBILE TOC BUTTON ───────────────────────── */
    .toc-toggle {
      display: none;
      position: fixed;
      bottom: 24px;
      right: 20px;
      z-index: 100;
      background: var(--blue);
      color: #0d1117;
      border: none;
      border-radius: 24px;
      padding: 10px 18px;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      gap: 6px;
      align-items: center;
    }
    .toc-drawer {
      display: block;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: 200;
      background: var(--surface);
      border-top: 1px solid var(--border2);
      border-radius: 16px 16px 0 0;
      padding: 20px 20px 40px;
      max-height: 60vh;
      overflow-y: auto;
      box-shadow: 0 -8px 32px rgba(0,0,0,0.4);
      transform: translateY(110%);
      transition: transform 0.28s cubic-bezier(.4,0,.2,1);
      visibility: hidden;
    }
    .toc-drawer.open { transform: translateY(0); visibility: visible; }
    .toc-drawer-handle {
      width: 40px; height: 4px;
      background: var(--border2);
      border-radius: 4px;
      margin: 0 auto 18px;
    }
    .toc-drawer .sidebar-label { margin-bottom: 12px; }
    .toc-backdrop {
      display: none;
      position: fixed; inset: 0;
      z-index: 190;
      background: rgba(0,0,0,0.5);
    }
    .toc-backdrop.open { display: block; }

    /* ── RESPONSIVE ──────────────────────────────── */
    @media (max-width: 768px) {
      body { overflow-x: hidden; }
      .sidebar-nav { display: none; }
      .toc-toggle { display: flex; }

      .page-layout {
        display: block;
        padding: 20px 16px 80px;
        max-width: 100%;
        box-sizing: border-box;
      }
      .main-content {
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
        box-sizing: border-box;
        word-break: break-word;
        overflow-wrap: break-word;
      }

      .updates-hero { margin-bottom: 36px; padding-bottom: 24px; }
      .updates-hero h1 { font-size: 1.4rem; margin-bottom: 8px; }
      .updates-hero p { font-size: 0.88rem; }

      .date-big { font-size: 1.2rem; }
      .entry-title { font-size: 1.1rem; }
      .entry-summary { font-size: 0.85rem; }
      .entry-body { font-size: 0.9rem; }
      .entry-body h3 { font-size: 0.95rem; }

      .blog-entry { margin-bottom: 52px; padding-bottom: 48px; }

      .entry-meta { gap: 6px; }
      .entry-version, .entry-tag { font-size: 0.7rem; }

      .entry-body pre { font-size: 0.78em; padding: 10px 12px; }
      .entry-body .img-row { flex-direction: column; }
      .entry-body .img-row img { min-width: unset; width: 100%; }

      .app-header .logo-text { font-size: 0.88rem; }
    }
  </style>
</head>

<body>
  <header class="app-header">
    <div class="logo">
      <span class="logo-icon">&#9650;</span>
      <span class="logo-text">Arsalan's Dev Journey</span>
    </div>
    <a href="/" class="back-btn">&#8592; Back to App</a>
  </header>

  <!-- Mobile TOC -->
  <div class="toc-backdrop" id="tocBackdrop"></div>
  <div class="toc-drawer" id="tocDrawer">
    <div class="toc-drawer-handle"></div>
    <div class="sidebar-label">All Entries</div>
    {% for entry in entries %}
    <a href="#{{ entry.id }}" class="sidebar-item toc-link">
      <span class="sidebar-item-heading">{{ entry.emoji }} {{ entry.short_title }}</span>
      <span class="sidebar-item-sub">{{ entry.version }} &middot; {{ entry.display_date }}</span>
    </a>
    {% endfor %}
  </div>
  <button class="toc-toggle" id="tocToggle">&#9776; All Posts</button>

  <div class="page-layout">

    <!-- ── SIDEBAR ──────────────────────────────── -->
    <aside class="sidebar-nav">
      <div class="sidebar-label">All Entries</div>
      {% for entry in entries %}
      <a href="#{{ entry.id }}" class="sidebar-item">
        <span class="sidebar-item-heading">{{ entry.emoji }} {{ entry.short_title }}</span>
        <span class="sidebar-item-sub">{{ entry.version }} &middot; {{ entry.display_date }}</span>
      </a>
      {% endfor %}
    </aside>

    <!-- ── MAIN ─────────────────────────────────── -->
    <div class="main-content">

      <div class="updates-hero">
        <h1>&#128211; Arsalan's Dev Journey</h1>
        <p>
          Building a <strong>Trading Journal App</strong> in public &mdash; one bug, one feature, one story at a time.<br />
          <span style="font-size:0.88rem;">Flask + Fabric.js + Vanilla JS + too much chai. &#9749; Indian stock market. Real trades. Real problems.</span>
        </p>
      </div>

      {% if entries %}
        {% for entry in entries %}
        <article class="blog-entry" id="{{ entry.id }}">
          <div class="entry-datestamp">
            <span class="date-big">{{ entry.display_date }}</span>
            <span class="date-day">{{ entry.display_day }}</span>
          </div>

          <div class="entry-meta">
            <span class="entry-version">{{ entry.version }}</span>
            {% for tag in entry.tags %}
            <span class="entry-tag">{{ tag }}</span>
            {% endfor %}
          </div>

          <h2 class="entry-title">{{ entry.emoji }} {{ entry.title }}</h2>
          <p class="entry-summary">{{ entry.summary }}</p>
          <div class="entry-body">{{ entry.body | safe }}</div>

        </article>
        {% endfor %}
      {% else %}
        <div class="empty-state">
          <span>&#128679;</span>
          <p>First entry coming soon!</p>
        </div>
      {% endif %}

    </div>
  </div>

  <script>
    // Highlight active sidebar item as user scrolls
    const sidebarLinks = document.querySelectorAll('.sidebar-item');
    const articles = document.querySelectorAll('.blog-entry');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          sidebarLinks.forEach(l => l.classList.remove('active'));
          const active = document.querySelector(`.sidebar-item[href="#${e.target.id}"]`);
          if (active) active.classList.add('active');
        }
      });
    }, { rootMargin: '-15% 0px -75% 0px' });
    articles.forEach(a => observer.observe(a));

    // Smooth scroll for sidebar clicks
    sidebarLinks.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const raw = link.getAttribute('href') || '';
        const targetId = raw.startsWith('#') ? raw.slice(1) : raw;
        const target = document.getElementById(targetId);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    });

    // Mobile TOC drawer
    const tocToggle   = document.getElementById('tocToggle');
    const tocDrawer   = document.getElementById('tocDrawer');
    const tocBackdrop = document.getElementById('tocBackdrop');

    function openToc()  { tocDrawer.classList.add('open'); tocBackdrop.classList.add('open'); }
    function closeToc() { tocDrawer.classList.remove('open'); tocBackdrop.classList.remove('open'); }

    tocToggle.addEventListener('click', openToc);
    tocBackdrop.addEventListener('click', closeToc);

    document.querySelectorAll('.toc-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        closeToc();
        const raw = link.getAttribute('href') || '';
        const targetId = raw.startsWith('#') ? raw.slice(1) : raw;
        const target = document.getElementById(targetId);
        if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 320);
      });
    });
  </script>

</body>
</html>

```

## File: `templates/login.html`
```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Trading Journal</title>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #0d1117;
            color: #c9d1d9;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }

        .auth-container {
            background: #161b22;
            padding: 40px;
            border-radius: 8px;
            border: 1px solid #30363d;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
            text-align: center;
        }

        .auth-container h2 {
            margin-top: 0;
            color: #fff;
        }

        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-size: 14px;
            color: #8b949e;
        }

        .form-control {
            width: 100%;
            padding: 10px;
            background: #0d1117;
            color: #c9d1d9;
            border: 1px solid #30363d;
            border-radius: 6px;
            box-sizing: border-box;
        }

        .form-control:focus {
            outline: none;
            border-color: #58a6ff;
            box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.3);
        }

        .btn-primary {
            width: 100%;
            padding: 10px;
            background-color: #238636;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            margin-top: 10px;
        }

        .btn-primary:hover {
            background-color: #2ea043;
        }

        .auth-links {
            margin-top: 20px;
            font-size: 14px;
        }

        .auth-links a {
            color: #58a6ff;
            text-decoration: none;
        }

        .auth-links a:hover {
            text-decoration: underline;
        }

        .flash-messages {
            color: #ff7b72;
            margin-bottom: 15px;
            font-size: 14px;
        }
    </style>
</head>

<body>
    <div class="auth-container">
        <h2>Sign in to Journal</h2>
        {% with messages = get_flashed_messages(with_categories=true) %}
        {% if messages %}
        <div class="flash-messages">
            {% for category, message in messages %}
            <div>{{ message }}</div>
            {% endfor %}
        </div>
        {% endif %}
        {% endwith %}
        <form method="POST" action="{{ url_for('auth.login') }}">
            <div class="form-group">
                <label for="email">Email address</label>
                <input type="email" id="email" name="email" class="form-control" required autofocus>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" class="form-control" required>
            </div>
            <button type="submit" class="btn-primary">Sign in</button>
        </form>
        <div class="auth-links" style="margin-top: 10px; margin-bottom: 20px;">
            <a href="{{ url_for('auth.reset_password') }}">Forgot your password?</a>
        </div>
        <div class="auth-links">
            Don't have an account? <a href="{{ url_for('auth.register') }}">Create an account</a>
        </div>
    </div>
</body>

</html>
```

## File: `templates/register.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register - Trading Journal</title>
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #0d1117; color: #c9d1d9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .auth-container { background: #161b22; padding: 40px; border-radius: 8px; border: 1px solid #30363d; width: 100%; max-width: 400px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); text-align: center; }
        .auth-container h2 { margin-top: 0; color: #fff; }
        .form-group { margin-bottom: 20px; text-align: left; }
        .form-group label { display: block; margin-bottom: 5px; font-size: 14px; color: #8b949e; }
        .form-control { width: 100%; padding: 10px; background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius: 6px; box-sizing: border-box; }
        .form-control:focus { outline: none; border-color: #58a6ff; box-shadow: 0 0 0 3px rgba(88,166,255,0.3); }
        .btn-primary { width: 100%; padding: 10px; background-color: #238636; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: 600; margin-top: 10px; }
        .btn-primary:hover { background-color: #2ea043; }
        .auth-links { margin-top: 20px; font-size: 14px; }
        .auth-links a { color: #58a6ff; text-decoration: none; }
        .auth-links a:hover { text-decoration: underline; }
        .flash-messages { color: #ff7b72; margin-bottom: 15px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="auth-container">
        <h2>Create an account</h2>
        {% with messages = get_flashed_messages(with_categories=true) %}
            {% if messages %}
                <div class="flash-messages">
                    {% for category, message in messages %}
                        <div>{{ message }}</div>
                    {% endfor %}
                </div>
            {% endif %}
        {% endwith %}
        <form method="POST" action="{{ url_for('auth.register') }}">
            <div class="form-group">
                <label for="email">Email address</label>
                <input type="email" id="email" name="email" class="form-control" required autofocus>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" class="form-control" required>
            </div>
            <div class="form-group">
                <label for="confirm_password">Confirm Password</label>
                <input type="password" id="confirm_password" name="confirm_password" class="form-control" required>
            </div>
            <button type="submit" class="btn-primary">Sign up</button>
        </form>
        <div class="auth-links">
            Already have an account? <a href="{{ url_for('auth.login') }}">Sign in</a>
        </div>
    </div>
</body>
</html>

```

## File: `templates/reset_password.html`
```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password - Trading Journal</title>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #0d1117;
            color: #c9d1d9;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }

        .auth-container {
            background: #161b22;
            padding: 40px;
            border-radius: 8px;
            border: 1px solid #30363d;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
            text-align: center;
        }

        .auth-container h2 {
            margin-top: 0;
            color: #fff;
        }

        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-size: 14px;
            color: #8b949e;
        }

        .form-control {
            width: 100%;
            padding: 10px;
            background: #0d1117;
            color: #c9d1d9;
            border: 1px solid #30363d;
            border-radius: 6px;
            box-sizing: border-box;
        }

        .form-control:focus {
            outline: none;
            border-color: #58a6ff;
            box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.3);
        }

        .btn-primary {
            width: 100%;
            padding: 10px;
            background-color: #238636;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            margin-top: 10px;
        }

        .btn-primary:hover {
            background-color: #2ea043;
        }

        .auth-links {
            margin-top: 20px;
            font-size: 14px;
        }

        .auth-links a {
            color: #58a6ff;
            text-decoration: none;
        }

        .auth-links a:hover {
            text-decoration: underline;
        }

        .flash-messages {
            color: #ff7b72;
            margin-bottom: 15px;
            font-size: 14px;
        }
    </style>
</head>

<body>
    <div class="auth-container">
        <h2>Reset Password</h2>
        <p style="text-align: left; font-size: 14px; color: #8b949e; margin-bottom: 20px;">
            Enter your email and a new password to reset it directly.
        </p>

        {% with messages = get_flashed_messages(with_categories=true) %}
        {% if messages %}
        <div class="flash-messages">
            {% for category, message in messages %}
            <div>{{ message }}</div>
            {% endfor %}
        </div>
        {% endif %}
        {% endwith %}

        <form method="POST" action="{{ url_for('auth.reset_password') }}">
            <div class="form-group">
                <label for="email">Email address</label>
                <input type="email" id="email" name="email" class="form-control" required autofocus>
            </div>
            <div class="form-group">
                <label for="new_password">New Password</label>
                <input type="password" id="new_password" name="new_password" class="form-control" required>
            </div>
            <div class="form-group">
                <label for="confirm_password">Confirm New Password</label>
                <input type="password" id="confirm_password" name="confirm_password" class="form-control" required>
            </div>
            <button type="submit" class="btn-primary">Update Password</button>
        </form>

        <div class="auth-links">
            <a href="{{ url_for('auth.login') }}">&larr; Back to login</a>
        </div>
    </div>
</body>

</html>
```

import json

BLOG_FILE = 'D:/KHAZANA/KHAZANA/PYTHON/CODE2- CALENDER/data/dev-blog.json'

body = (
    '<p>&#x1F4F1; Sunday ka waqt tha. Market band thi, phone pe apna trading journal khola &#x2014; aur ek frustration clearly feel hua: <strong>image quickly dekhne ka koi tarika nahi tha.</strong> '
    'Table me rows hain, gallery me grid hai, lekin ek din ke saare trades ek saath, ek hi scroll me &#x2014; kuch nahi tha. '
    'Wahi moment tha jab idea aaya: <em>Instagram ki tarah kuch banana chahiye &#x2014; ek feed jo daily trades ki story bataye.</em></p>'

    "<img src='/static/dev-blog-images/IMP/Screenshot%202026-03-09%20115300.png' "
    "alt='Hand-drawn wireframe sketches of TradeFeed app screens: Home, P:Day, Account, TagSer, Logger, Graphs, Calendar, Table' />"
    '<p class="img-caption">&#x270F;&#xFE0F; Paper pe pehli planning &#x2014; Home se Gallery tak, har screen ka rough wireframe. Yahan se journey shuru hui.</p>'

    '<h3>&#x1F916; Figma MCP Server &#x2014; AI se Design Directly</h3>'
    '<p>&#x1F539; Aaj pehli baar <strong>Figma MCP server</strong> ko Claude Code ke saath connect kiya. '
    'MCP (Model Context Protocol) ek aisi technology hai jisme AI tools directly external services se baat kar sakta hai &#x2014; is case me Figma ke saath.</p>'
    '<p>&#x1F539; Setup sirf ek command se hua:</p>'
    '<pre><code>claude mcp add figma --transport sse --url https://mcp.figma.com/sse</code></pre>'
    '<p>&#x1F539; Figma API token add kiya, aur Claude Code directly Figma files read karne laga. '
    'Yeh ek powerful shift tha: ab design aur code ek hi conversation me ho sakta hai &#x2014; '
    'screenshot share karo, annotation karo, aur Claude wahi design implement kar de.</p>'

    "<img src='/static/dev-blog-images/IMP/Screenshot%202026-03-09%20123428.png' "
    "alt='Claude Code MCP Servers panel showing Figma, Gmail, Google Calendar all listed as needs-auth' />"
    '<p class="img-caption">&#x2699;&#xFE0F; Claude Code ka MCP Servers panel &#x2014; Figma, Gmail, Google Calendar sab connected. Yahan se Figma designs directly Claude ke context me aate hain.</p>'

    '<p>&#x1F4A1; <strong>Practical learning:</strong> Free Figma plan pe MCP tool calls ki limit hoti hai. '
    'Workaround yeh raha: sketches aur screenshots share karo &#x2014; Claude annotated wireframe se bhi kaam kar leta hai. '
    'Pen se directly image pe likho, Claude wo padh ke implement kar deta hai.</p>'

    '<h3>&#x1F4F1; TradeFeed &#x2014; Ek Standalone Mobile App</h3>'
    '<p>&#x1F539; Decision liya ki desktop journal alag rahe, mobile ke liye ek <strong>dedicated React/TypeScript app</strong> banao &#x2014; '
    'same Flask backend, alag frontend. Naam rakha: <strong>TradeFeed</strong>.</p>'
    '<p>&#x1F539; Architecture kuch aisa:</p>'
    '<ul>'
    '<li><strong>Backend:</strong> Same Flask app (<code>code2-calender.onrender.com</code>) &#x2014; sirf CORS enable karna tha</li>'
    '<li><strong>Frontend:</strong> Vite + React + TypeScript + Tailwind &#x2014; pure mobile-first</li>'
    '<li><strong>API layer:</strong> <code>tradefeed/src/services/api.ts</code> &#x2014; Flask ke raw JSON fields ko mobile Trade interface me map karta hai, tagGroups se emotion/mistake/strategy chips banta hai</li>'
    '<li><strong>Deployment:</strong> Render.com static site (<code>tradefeed-hn52.onrender.com</code>)</li>'
    '</ul>'
    '<p>&#x1F539; Key UI decisions:</p>'
    '<ul>'
    '<li><strong>DayFeedCard:</strong> Ek din ke saare trades ek card me &#x2014; plain numbered switcher (1 2 3), swipe se images navigate, P&amp;L badge top-left, image count top-right</li>'
    '<li><strong>Gallery:</strong> Edge-to-edge grid, pinch-to-zoom columns (native non-passive touchmove), tag filter bar</li>'
    '<li><strong>Calendar:</strong> Real data se day color-coding, month P&amp;L total</li>'
    '<li><strong>Stats:</strong> SVG equity curve (explicit height container &#x2014; warna 0px render hota tha), win rate, profit factor</li>'
    '</ul>'

    '<h3>&#x1F6E0;&#xFE0F; Backend Refactor &#x2014; Clean Layered Architecture</h3>'
    '<p>&#x1F539; TradeFeed banate waqt realize hua ki <strong>app.py bahut monolithic</strong> ho gaya tha &#x2014; '
    '800+ lines me routes, business logic, aur data processing sab mix tha. Yeh sahi waqt tha ek proper refactor ka.</p>'
    '<p>&#x1F539; Naya layered structure:</p>'
    '<pre><code>'
    'app.py          &lt;- sirf entry point (setup + blueprint registration)\n'
    'config.py       &lt;- saare env vars aur paths\n'
    'routes/         &lt;- HTTP only: request parse -&gt; service call -&gt; jsonify()\n'
    'services/       &lt;- business logic (no Flask, no request/response)\n'
    'processors/     &lt;- pure data transforms (CSV, JSON, normalization)'
    '</code></pre>'
    '<p>&#x1F539; Frontend ke liye bhi service layer add kiya &#x2014; <code>static/js/services/</code> me apiClient, tradeService, imageService, importService, exportService. '
    'Ab koi bhi JS file directly <code>fetch()</code> nahi karti &#x2014; sab services ke through jata hai.</p>'

    '<h3>&#x2757; Deployment Battles &#x2014; 4 Hidden Bugs</h3>'
    '<p>&#x1F539; Render par deploy karna seedha nahi raha. Har ek bug alag layer pe chhupa tha:</p>'

    '<p><strong>&#x1F534; Bug 1: Flask-Cors missing from requirements.txt</strong><br/>'
    'Local pe kaam karta tha (installed tha), Render pe install hi nahi tha. '
    'CORS headers aa hi nahi rahe the, tradefeed data fetch nahi kar pa rahi thi.<br/>'
    '&#x2705; <em>Fix:</em> <code>Flask-Cors</code> requirements.txt me add kiya, phir manually '
    '<code>@app.after_request</code> se CORS headers add kiye &#x2014; zyada reliable approach kyunki Cloudflare ke through bhi kaam karta hai.</p>'

    '<p><strong>&#x1F534; Bug 2: routes/services/processors git me commit hi nahi the</strong><br/>'
    'Yeh sabse dangerous gotcha tha. New <code>app.py</code> push kiya jo <code>routes/</code> import karta tha &#x2014; '
    'lekin woh files git me thi hi nahi! Render deploy fail ho raha tha silently, aur old working version serve karta raha. '
    'Koi error visible nahi tha &#x2014; sab kuch theek lagta tha.<br/>'
    '&#x2705; <em>Fix:</em> <code>config.py</code>, <code>routes/</code>, <code>services/</code>, <code>processors/</code> sab ek saath commit kiye.</p>'

    '<p><strong>&#x1F534; Bug 3: P&amp;L = &#x20B90; sab trades pe</strong><br/>'
    'Kuch trades me <code>Net P/L</code> field empty string <code>""</code> tha (day-header rows jo daily summary hold karti hain). '
    'JavaScript ka <code>??</code> operator sirf <code>null</code>/<code>undefined</code> pe fallback karta hai, empty string pe nahi. '
    'Toh <code>"" as number</code> evaluate hota tha 0 ke taur pe.<br/>'
    '&#x2705; <em>Fix:</em> <code>typeof rawPnl === "number"</code> check, aur day-header rows ko filter out kiya <code>fetchTrades</code> me.</p>'

    '<p><strong>&#x1F534; Bug 4: Images 404 after redeploy</strong><br/>'
    'New deploy ke baad Render disk pe files the lekin route 404 de raha tha. '
    'Re-import ne fix kiya &#x2014; local se 77MB backup ZIP export karke Render API pe curl se directly upload kiya, bina browser khole.<br/>'
    '&#x2705; <em>Fix:</em> <code>curl -X POST /api/import-json -F file=@backup.zip</code> &#x2014; '
    'ek command se 363 images + trades.json sync ho gaye.</p>'

    '<h3>&#x1F3AF; Result &#x2014; Live on Mobile</h3>'
    "<img src='/static/dev-blog-images/IMP/Screenshot%202026-03-09%20145134.png' "
    "alt='TradeFeed Gallery view with real trade charts, tag filter bar showing BAT Distracted EntryMiss HERO tags' />"
    '<p class="img-caption">&#x1F4F8; TradeFeed Gallery &#x2014; real trade charts with tag filters, live on Render. Pinch-to-zoom columns, Day view toggle.</p>'

    "<img src='/static/dev-blog-images/IMP/Screenshot%202026-03-09%20153834.png' "
    "alt='TradeFeed mobile gallery showing annotated trading charts with red markers and hand-written notes, edge-to-edge grid' />"
    '<p class="img-caption">&#x1F4F1; Mobile pe real annotated charts &#x2014; hamare hi trades, hamare hi notes, ek proper Instagram-style grid me. Gallery tab active neeche.</p>'

    '<p>&#x2705; <strong>TradeFeed is live:</strong> <a href="https://tradefeed-hn52.onrender.com" target="_blank">tradefeed-hn52.onrender.com</a> &#x2014; '
    'apne phone pe kholo, apna real trading data dekhte raho.</p>'

    '<p>&#x1F4A1; <strong>Biggest learning aaj ka:</strong> Jab koi cheez locally kaam kare lekin production pe nahi &#x2014; '
    'pehle check karo ki kya <em>commit hua</em> hai. Silent rollback sabse dangerous hota hai kyunki koi error nahi dikhta, '
    'sab kuch theek lagta hai &#x2014; jab tak tum closely dekho nahi.</p>'
)

new_post = {
    "id": "2026-03-09-tradefeed-launch",
    "short_title": "TradeFeed Launch",
    "date": "2026-03-09",
    "version": "v2.6.0",
    "emoji": "\U0001f4f1",
    "title": "v2.6.0: TradeFeed \u2014 Instagram-style Mobile App, Figma MCP, Backend Refactor, aur Render Deployment Battles",
    "tags": ["TradeFeed", "Mobile", "React", "Figma MCP", "Deployment", "Render", "CORS", "Refactor"],
    "summary": "Sunday pe ek frustration se Instagram-style mobile trading feed ka idea aaya. Figma MCP server Claude Code se connect kiya, React/TypeScript standalone app banaya, backend ko clean layered architecture me refactor kiya, aur Render deployment ke 4 hidden bugs discover karke fix kiye.",
    "body": body
}

with open(BLOG_FILE, 'r', encoding='utf-8') as f:
    posts = json.load(f)

posts.insert(0, new_post)

with open(BLOG_FILE, 'w', encoding='utf-8') as f:
    json.dump(posts, f, ensure_ascii=False, indent=2)

print(f'Done. Total posts: {len(posts)}')
print(f'Added: {new_post["title"][:80]}')

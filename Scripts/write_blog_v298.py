import json, os

body = (
    "<p>&#x1F5BC;&#xFE0F; Kuch features hote hain jo technically kaam karte hain &#x2014; lekin feel nahi dete. "
    "Desktop ka F-key fullscreen viewer aisa hi tha. Images badi ho jaati thi, zoom-pan hota tha &#x2014; "
    "lekin koi context nahi tha. Kon si date hai? Kaun sa trade? Kitna P&amp;L? Koi pata nahi. Aaj woh sab badla.</p>\n\n"

    "<h3>&#x1F525; Asli Masla: Tray Thi Hi Nahi</h3>\n"
    "<p>Mobile app mein ek clean tray hai: back arrow, P&amp;L pill, trade pill, date &#x2014; sab ek line mein. "
    "Desktop ke F-key viewer mein? Ek Instagram-style header tha &#x2014; likes button, comments, follow button, "
    "caption, comment input box. Ek <em>trading journal</em> mein.</p>\n"
    "<p>Jab user ne pehli baar kaha: <em>&#x201C;mobile jaisi tray chahiye jab F dabaun tab&#x201D;</em> &#x2014; "
    "toh samjha nahi. Second time bola &#x2014; phir bhi gallery mein change kar diya. Teen-chaar rounds ke baad "
    "finally clear hua: <strong>F key fullscreen viewer, gallery nahi.</strong> Lesson learned. &#x1F601;</p>\n\n"

    "<h3>&#x1F50D; Bug #1: Dark Overlay &#x2014; Canvas Timing</h3>\n"
    "<p>Gallery mein ek ajeeb bug tha: kuch images open hone pe poori tarah black overlay dikh raha tha. "
    "Scratch nahi jaa raha tha chahe kitni baar restart karo.</p>\n"
    "<p><strong>Root cause:</strong> Canvas element <code>display: block</code> pe tha &#x2014; image load hone se "
    "<em>pehle</em>. Jab overlay async load ho raha tha, canvas pehle se visible tha apne stale content ke saath. "
    "Dark TradingView chart pe transparent empty canvas = black box.</p>\n"
    "<pre><code>// Pehle (bug):\n"
    "canvas.style.display = 'block';\n"
    "ovImg.onload = () =&gt; { ctx.drawImage(ovImg, ...); };\n\n"
    "// Fix:\n"
    "canvas.style.display = 'none';  // pehle hide karo\n"
    "ovImg.onload = () =&gt; {\n"
    "  ctx.clearRect(0, 0, canvas.width, canvas.height);\n"
    "  ctx.drawImage(ovImg, ...);\n"
    "  canvas.style.display = 'block';  // sirf draw ke baad dikhao\n"
    "};</code></pre>\n"
    "<p>Ek line ka fix &#x2014; lekin dhoondhna mush kil tha. Async timing bugs aise hote hain &#x2014; "
    "dikhte hain visual problem ki tarah, hote hain race condition.</p>\n\n"

    "<h3>&#x1F4F1; Fullscreen Viewer: Instagram Se Trading Tray</h3>\n"
    "<p>Poora <code>#fs-viewer</code> ka HTML replace kiya. Out gaya: likes (&#x2764;&#xFE0F;), comments (&#x1F4AC;), "
    "share, save, follow button, user avatar, caption, comment box. In aaya: ek clean tray:</p>\n"
    "<pre><code>&#x2190;  |  &#x25BC;-12,951  |  T1 &bull; -7,495 &#x25BC;  |  &#x1F4C5; TUE MAR 17  |  &#x1F513;</code></pre>\n"
    "<ul>\n"
    "<li><strong>Back arrow (&#x2190;)</strong> &#x2014; Absolute left pinned, kabhi center block nahi karta</li>\n"
    "<li><strong>P&amp;L pill (&#x25BC;-12,951)</strong> &#x2014; Din ka total, red/green. Click pe dropdown: har trade ki row &#x2014; click karo us trade pe jump ho jao</li>\n"
    "<li><strong>Trade pill (T1 &bull; -7,495)</strong> &#x2014; Current image ka trade, instrument name hata diya (noise tha). Click pe is trade ki images</li>\n"
    "<li><strong>Date (&#x1F4C5; TUE MAR 17)</strong> &#x2014; Click pe native date picker, select karo jump ho jao</li>\n"
    "<li><strong>Lock (&#x1F513;)</strong> &#x2014; Absolute right, locked mode mein side + corner navigation</li>\n"
    "</ul>\n"
    "<p>Sab center mein &#x2014; CSS <code>justify-content: center</code> + <code>padding: 0 54px</code> "
    "(back/lock ke liye space reserve kiya dono taraf).</p>\n\n"

    "<h3>&#x1F6AB; uiVisible = false: The Hidden Killer</h3>\n"
    "<p>Tray ka HTML perfect tha, CSS perfect tha &#x2014; lekin screen pe kuch nahi dikh raha tha. "
    "Restart karo, kuch nahi. Browser inspect karo &#x2014; <code>opacity: 0</code>. Kyun?</p>\n"
    "<p><code>open()</code> mein ek line thi:</p>\n"
    "<pre><code>this.uiVisible = false;  // &lt;-- yahi tha asli bug</code></pre>\n"
    "<p>Aur <code>updateUI()</code> mein header opacity <code>uiVisible</code> pe depend karti thi. "
    "Touch devices pe tap se toggle hota tha &#x2014; lekin <strong>desktop pe koi click handler hi nahi tha.</strong> "
    "Mouse se click karo &#x2014; kuch nahi. Tray hamesha invisible rehti.</p>\n"
    "<p>Fix: <code>uiVisible = true</code> on open + ek desktop click handler (header/buttons clicks exclude karke). "
    "Ek line ne teen din ki frustration explain ki.</p>\n\n"

    "<h3>&#x1F4CA; P&amp;L Dropdown: sameDateIndices</h3>\n"
    "<p>P&amp;L pill click pe dropdown aata hai per-trade rows ke saath. Yahan ek interesting challenge tha: "
    "<code>FullscreenViewer.days</code> mein ek date ke multiple trades = multiple consecutive entries. "
    "Toh T1 click karo toh <em>kaunsa</em> dayIndex?</p>\n"
    "<pre><code>const sameDateIndices = this.days.reduce((acc, d, idx) =&gt; {\n"
    "  if (d.date === day.date) acc.push(idx);\n"
    "  return acc;\n"
    "}, []);\n"
    "// sameDateIndices[0] = T1, [1] = T2, etc.</code></pre>\n"
    "<p>Row click karo &#x2014; <code>this.currentDayIndex = sameDateIndices[i]</code>, "
    "<code>currentImageIndex = 0</code>, render. Active trade row ko slight background highlight bhi diya.</p>\n\n"

    "<h3>&#x1F4CF; CSS 30KB Split: style-gallery-c.css</h3>\n"
    "<p><code>style-gallery-b.css</code> ne 30KB limit cross ki (30.8KB). Split kiya <code>/* AUDIO BAR */</code> "
    "section pe:</p>\n"
    "<ul>\n"
    "<li><code>style-gallery-b.css</code> &#x2014; Gallery layout, tray, body, thumbs (21.5KB)</li>\n"
    "<li><code>style-gallery-c.css</code> &#x2014; Audio bar, video bar, P&amp;L pills, trade pills, dropdowns (9KB)</li>\n"
    "</ul>\n"
    "<p>Boring kaam lagta hai &#x2014; lekin 30KB rule strictly follow karna zaroori hai. "
    "Bade files maintain karna mushkil hota hai, aur AI context window mein bhi problem aati hai.</p>\n\n"

    "<h3>&#x1F3AF; Aaj Ka Lesson</h3>\n"
    "<p>Do cheezein aaj clearly sikh li:</p>\n"
    "<ol>\n"
    "<li><strong>Async timing bugs visual lagte hain</strong> &#x2014; dark overlay thi toh lagta tha CSS issue hai. "
    "Actually canvas race condition tha. Hamesha async callbacks ke <em>andar</em> DOM state change karo.</li>\n"
    "<li><strong>Desktop = mouse, Mobile = touch</strong> &#x2014; sirf <code>touchend</code> pe toggle karo toh "
    "desktop users tray kabhi nahi dekhenge. Dono platforms ke liye alag events &#x2014; ya <code>click</code> "
    "use karo jo dono pe kaam karta hai.</li>\n"
    "</ol>\n"
    "<p>&#x1F4AA; Fullscreen viewer ab sirf ek image zoomer nahi &#x2014; ek complete trading review tool hai. "
    "Date, P&amp;L, trade navigation &#x2014; sab ek tap pe. Exactly jaisa mobile mein tha, ab desktop pe bhi.</p>"
)

entry = {
    "id": "2026-03-17-fullscreen-tray-redesign",
    "short_title": "F-Key Fullscreen: Trading Tray + Overlay Fix",
    "date": "2026-03-17",
    "display_date": "March 17",
    "version": "v2.9.8",
    "emoji": "\U0001f5a5\ufe0f",
    "title": "v2.9.8: F-Key Fullscreen Viewer \u2014 Instagram Se Trading Tray, Aur Ek Canvas Bug Ka Raaz",
    "tags": ["Desktop", "FullscreenViewer", "Gallery", "BugFix", "Tray", "UI", "CSS"],
    "summary": (
        "Desktop ka F-key fullscreen viewer poora redesign hua. Instagram-style UI (likes, comments, follow) "
        "ki jagah ab ek clean trading tray hai: P&L pill with per-trade dropdown, trade pill bina instrument "
        "noise ke, date picker, back + lock buttons pinned to edges. Plus: gallery images pe kala overlay aane "
        "ka bug fix \u2014 canvas async timing issue tha. Aur woh classic bug jahan tray thi lekin dikhi nahi: "
        "uiVisible = false on open, desktop pe koi click handler hi nahi tha."
    ),
    "body": body
}

path = os.path.join(os.path.dirname(__file__), '..', 'data', 'dev-blog.json')
with open(path, encoding='utf-8') as f:
    d = json.load(f)

# Replace v2.9.8 entry if exists, else insert at top
replaced = False
for i, e in enumerate(d):
    if e.get('version') == 'v2.9.8' and e.get('date') == '2026-03-17':
        d[i] = entry
        replaced = True
        break
if not replaced:
    d.insert(0, entry)

with open(path, 'w', encoding='utf-8') as f:
    json.dump(d, f, ensure_ascii=False, indent=2)

print(f"Blog post {'updated' if replaced else 'inserted'}. Total entries: {len(d)}")

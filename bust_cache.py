import time
import re

with open('templates/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# First, clean up the messed up strings
text = re.sub(r'\.js(\?v=\d+)?">">', '.js">', text)
text = re.sub(r' fabric\.js\?v=\d+">/5\.3\.1/fabric\.min\.js\?v=\d+">">', ' fabric.min.js">', text)
text = re.sub(r'\.js\?v=\d+">delivr\.net', '.jsdelivr.net', text)
text = re.sub(r'fabric\.js\?v=\d+">/5', 'fabric.js/5', text)
text = re.sub(r'\.js\?v=\d+">"', '.js"', text)

# General cleanup: remove all ?v=... from any source
text = re.sub(r'\?v=\d+', '', text)
text = text.replace('">">', '">')
text = text.replace('>"', '>')
text = text.replace('""', '"')

# Now intelligently add ?v=
js_ver = str(int(time.time()))
# We only want to append ?v= to scripts inside /static/js
text = re.sub(r'src="(/static/js/[^"]+\.js)"', rf'src="\1?v={js_ver}"', text)

with open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("HTML cleaned and cache buster applied!")

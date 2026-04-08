import re
import io

def inject_grid():
    with io.open('templates/index.html', 'r', encoding='utf-8') as f:
        idx_content = f.read()

    match = re.search(r'(<div class="dashboard-grid">.*?</div>)\s*</section>', idx_content, flags=re.DOTALL)
    if not match: return
    grid_html = match.group(1)

    new_idx = re.sub(r'<section class="section dashboard-section">.*?</section>', 
                     '<section class="section dashboard-section" style="display:none;"></section>', 
                     idx_content, flags=re.DOTALL)
                     
    with io.open('templates/index.html', 'w', encoding='utf-8') as f:
        f.write(new_idx)

    with io.open('templates/visual_dashboard.html', 'r', encoding='utf-8') as f:
        vd_content = f.read()

    vd_content = vd_content.replace('<!-- The dash-grid is injected here by our JS -->', grid_html)

    with io.open('templates/visual_dashboard.html', 'w', encoding='utf-8') as f:
        f.write(vd_content)

if __name__ == '__main__':
    inject_grid()

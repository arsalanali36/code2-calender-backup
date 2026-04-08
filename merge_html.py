import re
import io

def robust_replace():
    # 1. READ INDEX.HTML
    with io.open('templates/index.html', 'r', encoding='utf-8') as f:
        idx_content = f.read()

    # EXTRACT dashboard-grid
    match = re.search(r'(<div class="dashboard-grid">.*?</div>)\s*</section>', idx_content, flags=re.DOTALL)
    if not match:
        print("Error extracting grid")
        return
        
    dashboard_grid = match.group(1)

    # REMOVE dashboard-section content
    new_idx = re.sub(r'<section class="section dashboard-section">.*?</section>', 
                     '<section class="section dashboard-section" style="display:none;"></section>', 
                     idx_content, flags=re.DOTALL)
                     
    with io.open('templates/index.html', 'w', encoding='utf-8') as f:
        f.write(new_idx)

    # 2. READ VISUAL DASHBOARD
    with io.open('templates/visual_dashboard.html', 'r', encoding='utf-8') as f:
        vd_content = f.read()

    # REPLACE Quick Stats Tab Label
    vd_content = re.sub(r'Quick Stats <span.*?</span>', 'Summary Analytics 📈', vd_content)

    # INJECT Grid above Daily Breakdown
    # The current visual_dashboard.html has a structure: 
    # <div id="quick-stats-tab-content"...>
    
    # Let's find the start of quick-stats-tab-content and inject the new top section
    injection_point = '<div id="qs-stats-groups"'
    
    overall_html = """
          <!-- OVERALL MONTHLY SUMMARY BLOCK -->
          <div style="background:#161b22; border:1px solid #30363d; border-radius:14px; padding:20px; box-shadow:inset 0 0 20px rgba(0,0,0,0.2); margin-bottom:24px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid #30363d; padding-bottom:10px;">
              <span style="font-size:1.1rem; color:#fff; font-weight:700;">Overall Summary <span id="qs-monthly-subtitle" style="font-size:0.85rem; font-weight:normal; color:#8b949e; margin-left:10px;"></span></span>
              <button class="btn btn-outline" id="dashboard-stats-btn" style="padding:4px 10px; font-size:0.8rem; border-color:#30363d;">Stats &#9881;</button>
            </div>
            """ + dashboard_grid + """
          </div>

          <!-- DAILY QUICK STATS BLOCK -->
          <div style="margin-bottom:15px; border-bottom:1px solid #30363d; padding-bottom:10px;">
            <span style="font-size:1.1rem; color:#fff; font-weight:700;">Daily Breakdown & Drilldown</span>
          </div>
          <div id="qs-stats-groups"
    """
    
    vd_content = vd_content.replace('<div id="qs-stats-groups"', injection_point.replace('<div id="qs-stats-groups"', overall_html.strip()))
    
    # ALSO fix the donut size
    vd_content = re.sub(r'id="qs-pie-container" style=".*?"', 'id="qs-pie-container" style="width:100%; max-width:320px; height:320px; margin:0 auto; position:relative;"', vd_content)

    with io.open('templates/visual_dashboard.html', 'w', encoding='utf-8') as f:
        f.write(vd_content)
        
    print("Migration successful")

if __name__ == '__main__':
    robust_replace()

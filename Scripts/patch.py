import re

content = open('templates/index.html', encoding='utf-8').read()

# Fix duplicates created by buggy python patch loop
for id_key in ['cumulative','daily','distribution','profitability','long_short','daily_qty','pat_sum','points_per_trade','points_sum','daily_fc','avg_buy_price']:
    find_str = f"""            <select class="select-box vd-mode-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;" onchange="updateVdChartMode('{id_key}', this.value)">
              <option value="consolidated">Consolidated</option>
              <option value="individual">Individual</option>
            </select>"""
    
    # regex to replace double duplicates or triple
    pattern = r'(\s*<select class="select-box vd-mode-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;" onchange="updateVdChartMode\(\'' + id_key + r'\', this\.value\)">\s*<option value="consolidated">Consolidated</option>\s*<option value="individual">Individual</option>\s*</select>)+'
    
    content = re.sub(pattern, "\n" + find_str, content)

open('templates/index.html', 'w', encoding='utf-8').write(content)

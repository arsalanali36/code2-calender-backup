import re

f = open('templates/index.html', encoding='utf-8').read()

mappings = {
    'cumulative': 'cumulative',
    'daily': 'daily',
    'distribution': 'dist',
    'profitability': 'profit',
    'long_short': 'longShort',
    'daily_qty': 'dailyQty',
    'pat_sum': 'patSum',
    'points_per_trade': 'pointsPerTrade',
    'points_sum': 'pointsSum',
    'daily_fc': 'dailyFc',
    'avg_buy_price': 'avgBuyPrice'
}

for k, val in mappings.items():
    pattern = r'(<select class="select-box"[^>]*?onchange="updateVdChartType\(\'' + val + r'\'[^>]*?>[\s\S]*?</select>)'
    
    def repl(m):
        return m.group(1) + f'''
            <select class="select-box vd-mode-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;" onchange="updateVdChartMode('{k}', this.value)">
              <option value="consolidated">Consolidated</option>
              <option value="individual">Individual</option>
            </select>'''
            
    f = re.sub(pattern, repl, f)

open('templates/index.html', 'w', encoding='utf-8').write(f)

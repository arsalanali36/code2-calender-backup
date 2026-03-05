import re

f = open('templates/index.html', encoding='utf-8').read()
keys = ['cumulative', 'daily', 'daily_qty', 'pat_sum', 'points_sum', 'daily_fc', 'avg_buy_price', 'points_per_trade', 'distribution', 'profitability', 'long_short']
key_mappings = {
    'cumulative': 'cumulative',
    'daily': 'daily',
    'distribution': 'distribution',
    'profitability': 'profitability',
    'long_short': 'long_short',
    'daily_qty': 'daily_qty',
    'pat_sum': 'pat_sum',
    'points_per_trade': 'points_per_trade',
    'points_sum': 'points_sum',
    'daily_fc': 'daily_fc',
    'avg_buy_price': 'avg_buy_price'
}

for k, val in key_mappings.items():
    # finding exactly where updateVdChartWidth is
    pattern = r'(<select class="select-box"[\s\S]*?onchange="updateVdChartType\([\s\S]*?</select>\s*)(<select class="select-box vd-width-select"[\s\S]*?onchange="updateVdChartWidth\(\'' + val + r'\'[\s\S]*?</select>)'
    
    def repl(m):
        return m.group(1) + f'''<select class="select-box vd-mode-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;" onchange="updateVdChartMode('{k}', this.value)">
              <option value="consolidated">Consolidated</option>
              <option value="individual">Individual</option>
            </select>\n            ''' + m.group(2)
            
    f = re.sub(pattern, repl, f)

open('templates/index.html', 'w', encoding='utf-8').write(f)

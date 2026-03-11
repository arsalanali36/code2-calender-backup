"""
services/csvlog_service.py
--------------------------
Parse LOGGER.xlsx schema and return structured JSON for the CSVLog modal.
No Flask imports, no request/response objects.
"""
import os
import re


def _to_key(head):
    return re.sub(r'^_|_$', '', re.sub(r'[^a-z0-9]+', '_', head.lower()))


def load_schema(schema_file):
    """
    Parse the csvlog_schema.xlsx file.
    Returns dict:
        {
          "groups": ["Zone", "Entry", "Exit", "PSy"],
          "fields": {
            "Zone": [
              { "head": "formed", "type": "Switch", "input": "Y/N", "options": ["Y", "N"] },
              ...
            ],
            ...
          }
        }
    Only rows with Display == "Show" are included.
    Returns None if file doesn't exist.
    Returns {"error": "..."} on parse failure.
    """
    if not os.path.exists(schema_file):
        return None

    try:
        import openpyxl
        wb = openpyxl.load_workbook(schema_file, data_only=True)
        ws = wb.active

        groups_order = []
        fields = {}

        for row in ws.iter_rows(min_row=2, values_only=True):
            # Columns: Group, Head, Input, Type, Display, Description
            padded = list(row) + [None] * 6
            group, head, input_val, type_val, display = (
                padded[0], padded[1], padded[2], padded[3], padded[4]
            )

            if not group or not head:
                continue
            if str(display or '').strip().lower() != 'show':
                continue

            group    = str(group).strip()
            head     = str(head).strip()
            type_val = str(type_val or '').strip()
            input_val = str(input_val).strip() if input_val is not None else None

            if group not in fields:
                groups_order.append(group)
                fields[group] = []

            # Parse options list for Dropdown / Range types
            options = None
            if input_val and type_val in ('Dropdown', 'Range'):
                # Strip surrounding quotes, normalise newlines → commas
                clean = input_val.strip('"').replace('\n', ',')
                options = [o.strip() for o in clean.split(',') if o.strip()]

            # Y/N Switch → options list
            if type_val == 'Switch' and input_val == 'Y/N':
                options = ['Y', 'N']

            fields[group].append({
                'head':    head,
                'type':    type_val,
                'input':   input_val,
                'options': options,
            })

        return {'groups': groups_order, 'fields': fields}

    except Exception as exc:
        return {'error': str(exc)}


def export_csvlog_excel(trades, schema_file=None):
    """
    Export all trades with csvlog data to an Excel BytesIO.
    Returns (BytesIO, None) on success, (None, error_str) on failure.
    """
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Side, Border
        from io import BytesIO
    except ImportError:
        return None, 'openpyxl not installed'

    try:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'CSVLog Export'

        # ── Build ordered list of csvlog columns ──────────────────────────────
        # (group_key, field_key, display_label)
        csvlog_cols = []
        seen_cols = set()

        schema = load_schema(schema_file) if schema_file and os.path.exists(schema_file) else None
        if schema:
            for group in schema.get('groups', []):
                gk = group.lower()
                section = ''
                for field in schema['fields'].get(group, []):
                    if field['type'] == '-':
                        section = _to_key(field['head'])
                        continue
                    fk = (_to_key(section + '_' + field['head']) if section
                          else _to_key(field['head']))
                    label = f"{group} / {field['head']}"
                    pair = (gk, fk)
                    if pair not in seen_cols:
                        seen_cols.add(pair)
                        csvlog_cols.append((gk, fk, label))

        # Pick up any extra keys from actual data
        for trade in trades:
            for gk, fdata in (trade.get('csvlog') or {}).items():
                if not isinstance(fdata, dict):
                    continue
                for fk in fdata:
                    if fk.endswith('_obs') or fk == '_meta':
                        continue
                    pair = (gk, fk)
                    if pair not in seen_cols:
                        seen_cols.add(pair)
                        csvlog_cols.append((gk, fk, f"{gk} / {fk}"))

        # ── Headers ───────────────────────────────────────────────────────────
        base_hdrs = ['Date', 'Instrument', 'TradeType', 'Qty',
                     'Entry Time', 'Exit Time', 'P/L (Rs)', 'Points', 'Note']
        obs_hdr = ['Observations']
        all_hdrs = base_hdrs + [c[2] for c in csvlog_cols] + obs_hdr
        ws.append(all_hdrs)

        # Style header row
        hdr_fill = PatternFill('solid', fgColor='1E2535')
        for cell in ws[1]:
            cell.font = Font(bold=True, color='FFFFFF')
            cell.fill = hdr_fill
            cell.alignment = Alignment(horizontal='center')

        # ── Data rows ─────────────────────────────────────────────────────────
        def _pick(t, *keys):
            for k in keys:
                v = t.get(k)
                if v is not None and v != '':
                    return v
            return ''

        for trade in trades:
            date      = _pick(trade, 'trade_date', 'Date', 'date')
            instr     = _pick(trade, 'Instrument', 'instrument', 'INSTRUMENT')
            ttype     = _pick(trade, 'TradeType', 'tradetype', 'TRADETYPE')
            qty       = _pick(trade, 'Qty', 'qty', 'QTY')
            buy_t     = _pick(trade, 'Buy Time', 'buy_time', 'BUY TIME')
            sell_t    = _pick(trade, 'Sell Time', 'sell_time', 'SELL TIME')
            pnl       = _pick(trade, 'Net P/L', 'Gross P/L', 'Rs', 'rs', 'RS')
            points    = _pick(trade, 'Pt', 'pt')
            note      = _pick(trade, 'Note', 'note')

            # Entry = earlier time
            try:
                def _tsec(s):
                    p = str(s).split(':')
                    return int(p[0])*3600 + int(p[1])*60 + int(p[2] if len(p)>2 else 0)
                entry_t, exit_t = (buy_t, sell_t) if (_tsec(buy_t) <= _tsec(sell_t)) else (sell_t, buy_t)
            except Exception:
                entry_t, exit_t = buy_t, sell_t

            base_row = [date, instr, ttype, qty, entry_t, exit_t, pnl, points, note]

            csvlog = trade.get('csvlog') or {}
            csvlog_vals = []
            obs_parts = []
            for gk, fk, _ in csvlog_cols:
                gdata = csvlog.get(gk) or {}
                val = gdata.get(fk, '')
                csvlog_vals.append(val)
                obs_val = gdata.get(fk + '_obs', '')
                if obs_val:
                    obs_parts.append(f"[{gk}] {fk.replace('_',' ')}: {obs_val}")

            # Use manually edited obs text if exists
            meta = (csvlog.get('_meta') or {})
            compiled_obs = meta.get('obs_text', '') or '\n'.join(obs_parts)

            ws.append(base_row + csvlog_vals + [compiled_obs])

        # Auto-width columns
        for col in ws.columns:
            w = max((len(str(c.value or '')) for c in col), default=8)
            ws.column_dimensions[col[0].column_letter].width = min(max(w + 2, 10), 45)

        out = BytesIO()
        wb.save(out)
        out.seek(0)
        return out, None

    except Exception as exc:
        return None, str(exc)

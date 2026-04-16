# 📊 Trading Journal Data Schema

This document defines the structure of the data used in the Trading Journal project. All AI assistants must adhere to this schema when modifying `trades.json` or processing trade data.

## 📁 Main Data Container (`trades.json`)

The top-level object contains the following keys:

| Key | Type | Description |
|-----|------|-------------|
| `allTags` | `Array<string>` | Master list of all user-defined tags. |
| `columns` | `Array<string>` | Order and names of columns displayed in the UI table. |
| `trades` | `Array<Trade>` | List of all individual trade objects. |
| `dayData` | `Object<Date, DayDetails>` | Metadata for specific dates (images, videos, etc.) |

---

## 🏎️ Trade Object Structure

Each object in the `trades` array represents a single trade.

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `trade_date` | `string` | `"2026-02-20"` | Primary date of the trade (YYYY-MM-DD). |
| `Instrument` | `string` | `"NIFTY26FEB25450CE"` | Name of the traded symbol. |
| `TradeType` | `string` | `"sell"` | Type of trade (`buy` or `sell`). |
| `Qty` | `number` | `130` | Quantity traded. |
| `Buy Price (Avg)`| `number` | `118.45` | Average buying price. |
| `Sell Price (Avg)`| `number` | `120.8` | Average selling price. |
| `Pt` | `number` | `2.35` | Points captured (Diff between buy/sell). |
| `Rs` | `number` | `305.5` | Gross P&L for this trade. |
| `Brokerage` | `number` | `40` | Sum of broker fees. |
| `Other Charges` | `number` | `36.26` | Taxes, SEBI charges, etc. |
| `Total Fees` | `number` | `76.26` | Total cost (Brokerage + Other Charges). |
| `Net P/L` | `number` | `229.24` | Final profit/loss after fees. |
| `Tags` | `Array<string>`| `["RuleBased"]` | List of tags assigned to this trade. |
| `Note` | `string` | `"Nice trade!"` | User comments. |
| `Buy Time` | `string` | `"09:30:39"` | Entry timestamp (HH:MM:SS). |
| `Sell Time` | `string` | `"09:24:59"` | Exit timestamp (HH:MM:SS). |
| `Broker` | `string` | `"zerodha"` | Broker name. |
| `Video` | `string` | `"https://..."` | Link to recording. |

---

## 📅 DayData Structure

Indexed by date string (`"YYYY-MM-DD"`).

| Field | Type | Description |
|-------|------|-------------|
| `images` | `Array<string>` | List of relative paths to uploaded screenshots. |
| `video` | `string` | YouTube link or video URL for that day. |
| `imageTags` | `Object` | Custom tags assigned to specific images. |
| `marqueeBoxes` | `Object` | Coordinates for drawing boxes on images (ImageKey -> Boxes). |
| `overlays` | `Object` | Transparency/Layer data for images. |
| `fabricData` | `Object` | JSON output from Fabric.js for complex annotations. |

---

## 🧪 Strategy Lab Specifics (Experimental)

*To be updated as features are finalized.*

- **Trade Sequence**: Identified by `t1`, `t2`, etc. (Stored in `Tags` or a new field?).
- **Fit-to-Date**: Uses `trade_date` to center the chart.

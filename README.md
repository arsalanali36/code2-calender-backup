# CODE2 - CALENDER

Trading Journal web app (Flask + vanilla JS) with calendar/table analytics, image gallery, and advanced image annotation.

## Run

```bash
pip install -r requirements.txt
python app.py
```

Or use `run.bat` on Windows.

## Recent Updates (Annotation + Tags)

### Image Annotation

- Default annotation opens in **Brush (Pen)**.
- Tool persists while moving between images in preview.
- Added **Marquee tool** with:
  - draw/select/move/resize
  - per-box tags shown at box bottom
  - per-box color
  - top-right delete handle
  - right-click context menu (`Delete`, `Duplicate`, `Rebind`, `Color`, `Close Tool`)
- `Rebind` now non-destructive (does not clear current drawing).
- Legacy marquee compatibility/migration added for older saved overlays.

### Cursor & Tooling

- Brush/Eraser custom on-canvas `+` cursor.
- Cursor size follows brush/eraser size.
- Cursor alignment fixed with drawing point.

### Tags Tray

- Group drag/drop support.
- Delete mode button (`Del`) next to `+ Group`.
- Group-wise tag color consistency.

## Shortcuts (Gallery / Annotation)

- `A` -> Toggle Annotate mode
- `B` -> Brush (Pen)
- `E` -> Eraser
- `M` -> Marquee tool
- `[` -> Brush/Eraser size down
- `]` -> Brush/Eraser size up
- `Ctrl+S` -> Save overlay
- `Ctrl+Shift+S` -> Merge + save image
- `T` -> Toggle tags tray
- `D` -> Open date picker
- `R` -> Reset zoom

## Notes

- Marquee editability depends on stored marquee metadata. Legacy flattened-only overlays can be detached via **Rebind** and then edited as live marquee boxes.

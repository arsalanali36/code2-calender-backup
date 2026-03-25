# Auto Git Backup Script — runs every 2 hours via Task Scheduler
$repoPath = "D:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER"
Set-Location $repoPath

# Check if there are any changes
$status = git status --porcelain 2>&1
if ($status) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    git add data/trades.json data/trades_1.json data/ohlc_cache/ data/dhan_scrip_master.csv data/dhan_symbol_map.json data/symbol_expiry_map.json data/tradebook_sync_queue.json 2>$null
    git add static/js/ static/css/ templates/ routes/ services/ processors/ 2>$null
    
    $hasStaged = git diff --cached --quiet; $LASTEXITCODE
    if ($hasStaged -ne 0) {
        git commit -m "auto-backup: $timestamp"
        Write-Host "Auto-backup committed at $timestamp"
    } else {
        Write-Host "No stageable changes at $timestamp"
    }
} else {
    Write-Host "No changes — skipping backup"
}

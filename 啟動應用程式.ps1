# DQA 簡易時程規畫 - PowerShell 啟動器

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DQA 簡易時程規畫 - 啟動器" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 找到 index.html 的完整路徑
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$htmlFile = Join-Path $scriptPath "index.html"

# 檢查檔案是否存在
if (-not (Test-Path $htmlFile)) {
    Write-Host "[錯誤] 找不到 index.html 檔案！" -ForegroundColor Red
    Write-Host "請確保此腳本與 index.html 在同一資料夾中。" -ForegroundColor Yellow
    Read-Host "按 Enter 鍵結束"
    exit 1
}

Write-Host "檔案位置: $htmlFile" -ForegroundColor White
Write-Host ""
Write-Host "正在使用預設瀏覽器開啟..." -ForegroundColor Cyan
Write-Host ""

# 使用預設瀏覽器開啟
Start-Process $htmlFile

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ 應用程式已啟動！" -ForegroundColor Green
Write-Host ""
Write-Host "💡 提示：" -ForegroundColor Yellow
Write-Host "   - 如果遇到問題，請嘗試使用不同的瀏覽器" -ForegroundColor White
Write-Host "   - 建議使用 Chrome、Edge 或 Firefox" -ForegroundColor White
Write-Host "   - 所有資料都儲存在瀏覽器本地" -ForegroundColor White
Write-Host ""
Write-Host "視窗將在 3 秒後自動關閉..." -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan

Start-Sleep -Seconds 3

# DQA 簡易時程規畫 - 打包腳本
# 此腳本會建置應用程式並打包成 ZIP 檔案供分發

$projectName = "DQA-SchedulePlanner"
$timestamp = Get-Date -Format "yyyyMMdd"
$outputZip = "$projectName-$timestamp.zip"

Write-Host "🚀 開始建置 DQA 簡易時程規畫..." -ForegroundColor Green

# 1. 建置應用程式
Write-Host "`n📦 步驟 1: 建置應用程式..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 建置失敗！" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 建置完成！" -ForegroundColor Green

# 2. 複製必要檔案到 dist 資料夾
Write-Host "`n📋 步驟 2: 準備必要檔案..." -ForegroundColor Cyan
Copy-Item -Path "QUICKSTART.md" -Destination "dist\QUICKSTART.md" -Force
Copy-Item -Path "啟動應用程式.bat" -Destination "dist\啟動應用程式.bat" -Force
Copy-Item -Path "啟動應用程式.ps1" -Destination "dist\啟動應用程式.ps1" -Force
Copy-Item -Path "start.html" -Destination "dist\start.html" -Force
Write-Host "✅ 必要檔案已複製！" -ForegroundColor Green

# 3. 壓縮 dist 資料夾
Write-Host "`n🗜️  步驟 3: 打包成 ZIP 檔案..." -ForegroundColor Cyan

# 刪除舊的 ZIP 檔案（如果存在）
if (Test-Path $outputZip) {
    Remove-Item $outputZip -Force
}

# 壓縮 dist 資料夾
Compress-Archive -Path "dist\*" -DestinationPath $outputZip -Force

Write-Host "✅ 已建立 $outputZip" -ForegroundColor Green

# 4. 顯示檔案資訊
Write-Host "`n📊 檔案資訊:" -ForegroundColor Cyan
$fileInfo = Get-Item $outputZip
Write-Host "  檔案名稱: $($fileInfo.Name)" -ForegroundColor White
Write-Host "  檔案大小: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor White
Write-Host "  完整路徑: $($fileInfo.FullName)" -ForegroundColor White

Write-Host "`n✨ 完成！ZIP 檔案已準備好供分發。" -ForegroundColor Green
Write-Host "`n💡 提示：" -ForegroundColor Yellow
Write-Host "  - 將 $outputZip 分享給使用者" -ForegroundColor White
Write-Host "  - 使用者解壓縮後，請參考 QUICKSTART.md 使用說明" -ForegroundColor White
Write-Host "  - 建議使用本地伺服器運行以獲得最佳體驗" -ForegroundColor White

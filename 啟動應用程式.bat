@echo off
chcp 65001 >nul
echo ========================================
echo DQA 簡易時程規畫 - 啟動器
echo ========================================
echo.
echo 正在啟動應用程式...
echo.

REM 找到 index.html 的完整路徑
set "HTML_FILE=%~dp0index.html"

REM 檢查檔案是否存在
if not exist "%HTML_FILE%" (
    echo [錯誤] 找不到 index.html 檔案！
    echo 請確保此批次檔與 index.html 在同一資料夾中。
    pause
    exit /b 1
)

echo 檔案位置: %HTML_FILE%
echo.
echo 正在使用預設瀏覽器開啟...
echo.

REM 使用預設瀏覽器開啟 HTML 檔案
start "" "%HTML_FILE%"

echo ========================================
echo ✅ 應用程式已啟動！
echo.
echo 💡 提示：
echo    - 如果遇到問題，請嘗試使用不同的瀏覽器
echo    - 建議使用 Chrome、Edge 或 Firefox
echo    - 所有資料都儲存在瀏覽器本地
echo.
echo 請勿關閉此視窗（3秒後自動關閉）...
echo ========================================

timeout /t 3 >nul
exit

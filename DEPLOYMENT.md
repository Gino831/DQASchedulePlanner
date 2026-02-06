# DQA 簡易時程規畫 - 部署指南

本文件說明如何部署與分發 DQA 簡易時程規畫應用程式。

## 📦 部署選項

### 選項 1：靜態網站部署（推薦）⭐

最簡單且最推薦的方式，適合分享給其他人使用。

**建置產物位置**：`dist/` 資料夾

建置後的應用程式是純靜態檔案（HTML + JavaScript + CSS），可以部署在任何網頁伺服器上。

#### 部署方式：

**A. 本地簡易伺服器（測試用）**
```bash
# 使用 Node.js 內建伺服器
npm run preview

# 或使用 Python 簡易伺服器
cd dist
python -m http.server 8080
```

**B. 公司內部網頁伺服器**
1. 將 `dist/` 資料夾內的所有檔案複製到網頁伺服器目錄
2. 使用者可透過瀏覽器直接訪問

**C. 雲端平台部署（免費）**

- **Netlify**：拖放 `dist` 資料夾即可
- **Vercel**：連接 Git repository 自動部署
- **GitHub Pages**：適合開源專案
- **Cloudflare Pages**：快速且免費

### 選項 2：ZIP 壓縮包分發

適合需要離線使用或內部分享的情況。

#### 📁 分發包 A：完整原始碼（給開發者）

**包含內容**：
- 所有原始碼檔案
- `package.json` 和相依套件設定
- README.md 使用說明

**使用方式**：
```bash
# 1. 解壓縮 ZIP 檔案
# 2. 安裝相依套件
npm install

# 3. 啟動開發伺服器
npm run dev

# 或建置正式版本
npm run build
```

#### 📦 分發包 B：靜態建置產物（給一般使用者）

**包含內容**：
- `dist/` 資料夾內的所有檔案
- 簡易使用說明

**使用方式**：
1. 解壓縮 ZIP 檔案
2. 雙擊 `index.html` 直接在瀏覽器開啟（部分功能可能受限）
   
   **或**
   
3. 使用簡易伺服器運行：
   ```bash
   # Windows - PowerShell
   cd dist
   python -m http.server 8080
   
   # 然後在瀏覽器開啟 http://localhost:8080
   ```

### 選項 3：獨立桌面應用程式（進階）

如需打包成 Windows/Mac 獨立執行檔（.exe），需要使用 Electron。

**優點**：
- 無需安裝 Node.js
- 雙擊即可執行
- 完整離線使用

**缺點**：
- 檔案較大（約 100-200MB）
- 需要額外設定 Electron

## 🚀 快速分發步驟

### 給其他人使用（最簡單方式）

1. **建置應用程式**
   ```bash
   npm run build
   ```

2. **壓縮 dist 資料夾**
   - 將 `dist/` 資料夾打包成 `DQA-SchedulePlanner.zip`

3. **創建使用說明**
   - 附上 `QUICKSTART.md`（見下方）

4. **分享檔案**
   - 透過郵件、共享資料夾或內部平台分享

### 📝 給使用者的快速啟動說明（QUICKSTART.md）

創建一個簡單的說明檔案給使用者：

```markdown
# DQA 簡易時程規畫 - 快速啟動

## 使用方式

### 方法 1：線上版本（推薦）
直接訪問：[網址]

### 方法 2：本地使用

1. 解壓縮 ZIP 檔案
2. 進入資料夾
3. 執行以下任一方式：

**Option A - 直接開啟（可能有限制）**
- 雙擊 `index.html`

**Option B - 使用 Python 伺服器（推薦）**
```bash
python -m http.server 8080
```
然後在瀏覽器開啟 http://localhost:8080

## 系統需求
- 現代瀏覽器（Chrome、Edge、Firefox、Safari）
- （方法 2B）Python 3.x（通常 Windows/Mac 已內建）

## 功能特色
- ✅ 支援四大應用標準（Moxa、Railway、Marine、Power Station）
- ✅ 智慧時程評估
- ✅ 樣品需求自動計算
- ✅ 匯入/匯出設定功能

如有問題請聯繫：[您的聯絡資訊]
```

## 📋 檢查清單

分發前請確認：

- [ ] 已執行 `npm run build`
- [ ] 確認 `dist/` 資料夾內容完整
- [ ] 測試建置產物是否正常運作（`npm run preview`）
- [ ] 準備使用說明文件
- [ ] 移除敏感資訊（如 API 金鑰）
- [ ] 壓縮為 ZIP 檔案
- [ ] 測試解壓縮後是否可正常使用

## 🔧 進階設定

### 自訂部署路徑

如果應用程式不是部署在根路徑，需修改 `vite.config.ts`：

```typescript
export default defineConfig({
  base: '/your-subpath/',  // 例如 '/dqa-planner/'
  // ...
})
```

然後重新建置。

### 環境變數

如使用 Gemini API，請確保：
1. `.env.local` 不會被包含在分發包中（已在 `.gitignore`）
2. 使用者需自行設定 API 金鑰（若需要）

## 📞 技術支援

**維護者**：[您的名稱]  
**更新日期**：2026-01-07  
**版本**：1.0.0

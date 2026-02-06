# DQA 簡易時程規畫

一個專為 DQA（Design Quality Assurance）團隊設計的測試時程規劃工具，用於快速評估不同應用標準（Moxa Industrial、Railway、Marine、Power Station）的測試項目與所需時程。

## 🌟 主要功能

### 1. 多標準支援

- **Moxa Industrial** - 核心工業自動化標準
- **Railway** - EN 50155 軌道交通標準
- **Marine** - DNVGL 船舶設備標準
- **Power Station** - IEC 61850-3 變電站標準

### 2. 測試類別管理

支援六大測試類別：

- **Chamber 應用** - 環境測試（高溫、低溫、溫濕度循環等）
- **振動衝擊應用** - 機械測試（振動、衝擊、包裝測試等）
- **防塵測試** - IP 2X ~ IP 6X
- **防水測試** - IP X2 ~ IP X8
- **功能測試** - 基本功能驗證（環境、機械、包裝）
- **其他測試** - 鹽霧測試等

### 3. 智慧時程評估

- **Track A / PKG Track** - 環境與功能測試軌
  - 支援「串列執行」（樣品沿用）與「平行執行」（增加樣品）兩種策略
  - 自動計算最佳執行順序與所需樣品數
  
- **Track B** - 振動衝擊測試軌
  - 獨立測試軌道
  - 考量測試整備時間與資源需求

- **包裝測試樣品策略**
  - 延用 Track A 樣品（需 +7 天整理）
  - 獨立樣品（不需 +7 天，但增加組數）

### 4. 動態管理

- ✅ 新增/刪除測試項目
- ✅ 自訂測試時長
- ✅ 匯入/匯出標準設定（JSON）
- ✅ 即時時程計算與樣品需求分析

## 🚀 本地執行

### 前置需求

- **Node.js** (建議 v18 以上)

### 安裝步驟

1. **安裝相依套件**

   ```bash
   npm install
   ```

2. **設定 API 金鑰**

   在專案根目錄的 [.env.local](.env.local) 檔案中設定您的 Gemini API 金鑰：

   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. **啟動開發伺服器**

   ```bash
   npm run dev
   ```

   應用程式將在 `http://localhost:5173` 啟動

## 📦 建置與部署

### 建置正式版本

```bash
npm run build
```

建置完成的檔案會輸出到 `dist/` 目錄

### 預覽正式版本

```bash
npm run preview
```

## 🛠 技術架構

- **框架**: React 19 + TypeScript
- **建置工具**: Vite 6
- **樣式**: Tailwind CSS（內嵌於主要元件）
- **AI 整合**: Google Gemini API

## 📋 使用說明

1. **選擇應用標準** - 選擇一個或多個適用的標準（Moxa、Railway、Marine、Power Station）
2. **勾選測試項目** - 從各類別中選擇需要執行的測試項目
3. **設定執行策略** - 選擇測試執行方式（串列/平行）與包裝樣品策略
4. **查看評估結果** - 系統自動計算：
   - 各測試軌所需時程
   - 所需樣品組數
   - 測試項目數量
   - 詳細測試清單

## 📝 資料持久化

- 標準設定與測試項目會自動儲存於瀏覽器 localStorage
- 支援匯出設定為 JSON 格式
- 支援匯入先前儲存的設定檔

## 🔧 自訂測試項目

應用程式支援：

- 新增自訂測試項目至任何標準
- 修改測試項目名稱與時長
- 刪除不需要的測試項目
- 重置為預設標準設定

## � 打包與分發

### 自動打包（推薦）

使用提供的打包腳本一鍵建置並壓縮：

```bash
powershell -ExecutionPolicy Bypass -File build-and-package.ps1
```

這會自動完成：

1. 建置應用程式
2. 複製使用說明到 dist 資料夾
3. 打包成 `DQA-SchedulePlanner-[日期].zip`

### 手動打包

```bash
# 1. 建置
npm run build

# 2. 複製說明檔案
Copy-Item QUICKSTART.md dist\

# 3. 壓縮（Windows）
Compress-Archive -Path dist\* -DestinationPath DQA-SchedulePlanner.zip
```

### 分發方式

**選項 1：ZIP 檔案分發（離線使用）**

- 將生成的 ZIP 檔案分享給使用者
- 使用者解壓縮後參考 `QUICKSTART.md` 使用

**選項 2：網頁伺服器部署（在線使用）**

- 將 `dist/` 資料夾內容部署到內部網頁伺服器
- 使用者透過瀏覽器直接訪問

**選項 3：GitHub Pages 部署（推薦 - 免費線上託管）**

1. 在 GitHub 建立 Repository（名稱建議：`DQASchedulePlanner`）
2. 將專案推送到 GitHub：

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/DQASchedulePlanner.git
   git push -u origin main
   ```

3. 到 GitHub Repository → Settings → Pages
4. Source 選擇「GitHub Actions」
5. 推送後會自動部署，網址為：`https://YOUR_USERNAME.github.io/DQASchedulePlanner/`

**Confluence 嵌入方法**

部署到 GitHub Pages 後，可用 iframe 嵌入 Confluence：

```html
<iframe src="https://YOUR_USERNAME.github.io/DQASchedulePlanner/" 
        width="100%" height="800px" frameborder="0"></iframe>
```

詳細部署說明請參考 [DEPLOYMENT.md](DEPLOYMENT.md)

## �📄 授權

此專案為內部使用工具，版權歸屬 Moxa Inc.

---

**維護資訊**

- 專案類型: DQA 內部工具
- 建立日期: 2025
- 最後更新: 2026-01-07


import { CategoryType, StandardData } from './types';
import rawStandards from './data/standards.json';
import rawQuotes from './data/quotes.json';

// GitHub raw URL — 從此處動態載入最新測項資料
// 任何人在 GitHub 上編輯 data/standards.json 後，下次開啟 App 即生效
const GITHUB_STANDARDS_URL = 'https://raw.githubusercontent.com/Gino831/DQASchedulePlanner/main/data/standards.json';

// Lab TA 解鎖碼：解開「測項天數」編輯權限
// 注意：這是前端常數，只能防止一般使用者誤改，無法防止刻意查看原始碼的人。
// 要更換解鎖碼直接改這行即可。
export const LAB_TA_PASSCODE = 'labta2026';

// 定義每個應用都必須包含的基礎測項（BF 功能測試，不可編輯）
export const DEFAULT_MANDATORY_TESTS = {
  [CategoryType.FUNCTION]: [
    // P3 階段基準：Basic Function test 為 3 工作天
    { id: 'default_bf_env', name: 'Basic Function (Env)', duration: 3, category: CategoryType.FUNCTION },
    { id: 'default_bf_pkg', name: 'Basic Function (PKG)', duration: 3, category: CategoryType.FUNCTION },
  ],
  [CategoryType.VIB_SHOCK]: [
    { id: 'default_bf_mech', name: 'Basic Function (Mech)', duration: 3, category: CategoryType.VIB_SHOCK },
  ]
};

// 合併必要基礎測項到各標準
const mergeMandatory = (standard: StandardData): StandardData => {
  const newCategories = { ...standard.categories };

  // 處理 Function 類別 (Chamber / PKG Track)
  const existingFunc = newCategories[CategoryType.FUNCTION] || [];
  const mandatoryFunc = DEFAULT_MANDATORY_TESTS[CategoryType.FUNCTION]
    .filter(item => {
      // 只有 Moxa 才強制包含 PKG 的 Basic Function
      if (item.id === 'default_bf_pkg') return standard.id === 'moxa';
      return true;
    })
    .map(item => ({
      ...item,
      id: `${standard.id}_${item.id}`
    }));
  newCategories[CategoryType.FUNCTION] = [...mandatoryFunc, ...existingFunc];

  // 處理 Vib/Shock 類別 (S&V)
  const existingVib = newCategories[CategoryType.VIB_SHOCK] || [];
  const mandatoryVib = DEFAULT_MANDATORY_TESTS[CategoryType.VIB_SHOCK].map(item => ({
    ...item,
    id: `${standard.id}_${item.id}`
  }));
  newCategories[CategoryType.VIB_SHOCK] = [...mandatoryVib, ...existingVib];

  return { ...standard, categories: newCategories };
};

// 第三方報價：獨立維護於 data/quotes.json，載入測項時才併入。
// 分開的用意是報價異動不必動到測項定義檔，兩者的變更歷史也才分得清楚。
const QUOTE_MAP: Record<string, Array<{ vendor: string; price: number; note?: string }>> =
  (rawQuotes as any).quotes || {};
export const QUOTES_UPDATED_AT: string = (rawQuotes as any).updated || '';

// 將 quotes.json 的陣列格式轉為 App 內部使用的 { 實驗室: 價格 } 與註記
const attachQuotes = (item: any) => {
  const list = QUOTE_MAP[item.id];
  if (!list || list.length === 0) return item;
  const quotes: Record<string, number> = {};
  const quoteNotes: Record<string, string> = {};
  list.forEach(q => {
    quotes[q.vendor] = q.price;
    if (q.note) quoteNotes[q.vendor] = q.note;
  });
  return { ...item, quotes, ...(Object.keys(quoteNotes).length ? { quoteNotes } : {}) };
};

// 將 JSON 原始資料轉換為 App 所需的 StandardData 格式
// （自動補上 category 欄位與第三方報價，編輯者不需手動填寫）
const parseRawStandards = (rawData: any[]): StandardData[] => {
  return rawData.map(raw => {
    const categories: StandardData['categories'] = {};
    Object.entries(raw.categories || {}).forEach(([catKey, items]) => {
      categories[catKey as CategoryType] = (items as any[]).map(item => attachQuotes({
        ...item,
        category: catKey as CategoryType,
      }));
    });
    return mergeMandatory({
      id: raw.id,
      name: raw.name,
      description: raw.description || '',
      icon: raw.icon || 'default',
      categories,
    });
  });
};

// 內建預設資料（離線 fallback）
// 直接沿用 data/standards.json——該檔是 Lab TA 佈達的唯一真實來源。
// 過去這裡是手抄的字面副本，結果與佈達版漂移（名稱、天數都停留在舊值），
// 因此改為 import，讓兩者不可能再不一致。
const FALLBACK_STANDARDS: StandardData[] = parseRawStandards(rawStandards as any[]);

// 預設匯出（離線 fallback）
export const STANDARDS_DATA: StandardData[] = FALLBACK_STANDARDS;

// 深度合併遠端與本地資料：以遠端版為底，補上本地自訂的新增或修改
// allowLocalDuration=false（預設）時，測項天數一律以遠端（Lab TA 佈達版）為準，
// 否則使用者殘留的舊天數會永遠蓋過新公告的基準值，導致佈達失效。
export const mergeLocalWithRemote = (
  remote: StandardData[],
  local: StandardData[],
  allowLocalDuration = false
): StandardData[] => {
  if (!local || local.length === 0) return remote;

  const merged = [...remote];

  local.forEach(localStd => {
    const remoteStdIdx = merged.findIndex(rs => rs.id === localStd.id);
    if (remoteStdIdx === -1) {
      // 1. 本地新增的完整標準（例如使用者點了「新增領域」）
      merged.push(localStd);
    } else {
      // 2. 合併標準內的類別與測項
      const remoteStd = { ...merged[remoteStdIdx] };
      const remoteCategories = { ...remoteStd.categories } as any;
      const localCategories = (localStd.categories || {}) as any;

      Object.entries(localCategories).forEach(([catKey, localItems]) => {
        const cat = catKey as CategoryType;
        if (!remoteCategories[cat]) {
          // 本地新增了某個新類別的所有項目
          remoteCategories[cat] = [...(localItems as any[])];
        } else {
          const rItems = [...(remoteCategories[cat] as any[])];
          (localItems as any[]).forEach(lItem => {
            const rItemIdx = rItems.findIndex(ri => ri.id === lItem.id);
            if (rItemIdx === -1) {
              // 本地新增的測項
              rItems.push(lItem);
            } else {
              // 本地修改過的測項（名稱、類別等）；天數預設鎖定為遠端佈達值。
              // 報價一律以現行來源為準：本地快取的舊價會蓋掉新報價，
              // 使 quotes.json 的更新對既有使用者失效。
              const remoteItem = rItems[rItemIdx];
              const { quotes: _lq, quoteNotes: _ln, ...localRest } = lItem as any;
              rItems[rItemIdx] = {
                ...remoteItem,
                ...localRest,
                ...(allowLocalDuration ? { duration: (lItem as any).duration ?? remoteItem.duration } : { duration: remoteItem.duration }),
                quotes: remoteItem.quotes,
                quoteNotes: remoteItem.quoteNotes,
              };
            }
          });
          remoteCategories[cat] = rItems;
        }
      });

      // 保留本地對於該標準名稱/圖示的修改
      remoteStd.name = localStd.name || remoteStd.name;
      remoteStd.icon = localStd.icon || remoteStd.icon;
      remoteStd.categories = remoteCategories;

      merged[remoteStdIdx] = remoteStd;
    }
  });

  return merged;
};

// 從 GitHub 動態載入最新測項資料
// 成功時回傳遠端資料，失敗時回傳內建 fallback
export const loadStandardsFromRemote = async (): Promise<{
  data: StandardData[];
  source: 'remote' | 'local';
}> => {
  try {
    // 加上時間戳避免快取
    const url = `${GITHUB_STANDARDS_URL}?t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rawData = await response.json();
    if (!Array.isArray(rawData) || rawData.length === 0) {
      throw new Error('Invalid data format');
    }
    const parsed = parseRawStandards(rawData);
    console.log(`[DQA] ✅ 已從 GitHub 載入 ${parsed.length} 個標準的測項資料`);
    return { data: parsed, source: 'remote' };
  } catch (err) {
    console.warn('[DQA] ⚠️ 無法從 GitHub 載入測項資料，使用內建預設值', err);
    return { data: FALLBACK_STANDARDS, source: 'local' };
  }
};

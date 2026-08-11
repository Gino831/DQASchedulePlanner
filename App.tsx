
import React, { useState, useMemo, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import {
  CategoryType,
  TestItem,
  StandardData,
  ExecutionStrategy,
  PkgSampleStrategy,
  ModelEntry,
} from './types';
import { STANDARDS_DATA as INITIAL_DATA, loadStandardsFromRemote, mergeLocalWithRemote, LAB_TA_PASSCODE } from './constants';

// 根據應用程式設定預設勾選的測項
// Moxa: 按照使用者需求設定特定測項
// Railway, Marine, Power: 全選
const getDefaultSelectedTests = (standards: StandardData[]): Record<string, Record<string, boolean>> => {
  const defaultSelected: Record<string, Record<string, boolean>> = {};

  standards.forEach(standard => {
    defaultSelected[standard.id] = {};

    if (standard.id === 'moxa') {
      // Moxa Industrial 預設選項（根據使用者圖片）
      const moxaDefaultItems = [
        // Chamber 應用
        'm_c1', // High Temperature test
        'm_c2', // High Temperature & Humidity
        'm_c3', // Low Temp On/Off test
        'm_c4', // High Temp On/Off test
        'm_c5', // Temperature Cycling test
        'm_c6', // High temp storage test
        'm_c7', // Low temp storage test
        // 'm_c8', // Altitude test - 不選

        // 振動衝擊應用
        'moxa_default_bf_mech', // Basic Function (Mech) - mandatory
        'm_v1', // Endurance vibration (Sine)
        'm_v2', // Random vibration test
        'm_v3', // Shock test (half sine)
        'm_v4', // PKG Vib
        'm_v5', // PKG Drop

        // 功能測試
        'moxa_default_bf_env', // Basic Function (Env) - mandatory
        'moxa_default_bf_pkg', // Basic Function (PKG) - mandatory

        // 防塵測試 - 不選
        // 防水測試 - 不選
        // 其他測試 - 不選
      ];

      moxaDefaultItems.forEach(itemId => {
        defaultSelected[standard.id][itemId] = true;
      });
    } else {
      // Railway, Marine, Power Station: 全選所有測項
      Object.values(standard.categories).forEach(items => {
        items?.forEach(item => {
          defaultSelected[standard.id][item.id] = true;
        });
      });
    }
  });

  return defaultSelected;
};


const generateId = () => Math.random().toString(36).substring(2, 9);

const createDefaultModel = (standards: StandardData[], initialStandardIds: string[] = ['moxa'], modelName: string = 'NAT-G102-T'): ModelEntry => {
  const allDefaults = getDefaultSelectedTests(standards);
  const mergedTests: Record<string, boolean> = {};
  initialStandardIds.forEach(sid => Object.assign(mergedTests, allDefaults[sid] || {}));
  return {
    id: `m_${generateId()}`,
    name: modelName,
    standardIds: initialStandardIds,
    selectedTests: mergedTests,
    envSampleCount: 1,
    mechSampleCount: 1,
    pkgSampleCount: 1,
    ipSampleCount: 1,
    mechStrategy: ExecutionStrategy.PARALLEL,
    ipStrategy: ExecutionStrategy.SERIAL
  };
};

// 各標準固定顏色（側欄圖示、甘特圖分段、圖例共用，確保全應用一致性）
const STANDARD_FIXED_COLORS: Record<string, { bg: string, text: string, label: string }> = {
  moxa: { bg: 'bg-indigo-600', text: 'text-white', label: 'Moxa' },
  railway: { bg: 'bg-amber-500', text: 'text-white', label: 'Railway' },
  marine: { bg: 'bg-cyan-500', text: 'text-white', label: 'Marine' },
  power: { bg: 'bg-emerald-500', text: 'text-white', label: 'Power' },
};

// 側欄圖示色（與 STANDARD_FIXED_COLORS 一致）
const APP_COLORS: Record<string, string> = {
  moxa: 'bg-indigo-600',
  railway: 'bg-amber-500',
  marine: 'bg-cyan-500',
  power: 'bg-emerald-500',
  default: 'bg-slate-500',
  pkg_prep: 'bg-slate-200',
  pkg_item: 'bg-slate-800'
};

// DUT 甘特圖 - 特殊類別配色（BF、Storage、PKG 等非標準色）
const CATEGORY_COLORS: Record<string, { bg: string, text: string, label: string }> = {
  [CategoryType.FUNCTION]: { bg: 'bg-sky-400', text: 'text-white', label: 'BF' },
  storage: { bg: 'bg-purple-500', text: 'text-white', label: 'Storage' },
  pkg: { bg: 'bg-slate-700', text: 'text-white', label: 'PKG' },
  prep: { bg: 'bg-slate-200', text: 'text-slate-500', label: '前置作業' },
  rf: { bg: 'bg-teal-500', text: 'text-white', label: 'RF' },
};

// DUT Track 標籤配色
const TRACK_LABEL_COLORS: Record<string, string> = {
  A: 'bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-[0_1px_2px_rgba(79,70,229,0.1)]',
  B: 'bg-orange-50 text-orange-600 border border-orange-200 shadow-[0_1px_2px_rgba(234,88,12,0.1)]',
  C: 'bg-slate-50 text-slate-600 border border-slate-200 shadow-[0_1px_2px_rgba(148,163,184,0.1)]',
  D: 'bg-sky-50 text-sky-600 border border-sky-200 shadow-[0_1px_2px_rgba(2,132,199,0.1)]',
};

const App: React.FC = () => {
  // 資料來源：'loading' = 載入中, 'remote' = 從 GitHub 取得最新佈達版, 'local' = 使用內建預設
  const [dataSource, setDataSource] = useState<'loading' | 'remote' | 'local'>('loading');
  const [standards, setStandards] = useState<StandardData[]>(INITIAL_DATA);
  // Lab TA 模式：解鎖後才能編輯測項天數（僅防誤改，非資安控管）
  const [isLabTA, setIsLabTA] = useState<boolean>(() => sessionStorage.getItem('dqa_lab_ta') === '1');
  const ganttRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Lab TA 解鎖／鎖定：僅防止一般使用者誤改天數，非資安控管
  const unlockLabTA = () => {
    const input = window.prompt('請輸入 Lab TA 解鎖碼：');
    if (input === null) return;
    if (input.trim() === LAB_TA_PASSCODE) {
      sessionStorage.setItem('dqa_lab_ta', '1');
      setIsLabTA(true);
    } else {
      alert('解鎖碼錯誤');
    }
  };

  const lockLabTA = () => {
    sessionStorage.removeItem('dqa_lab_ta');
    setIsLabTA(false);
  };

  // 匯出佈達用的 standards.json（格式與 repo 的 data/standards.json 一致）
  const exportStandardsJson = () => {
    const payload = standards.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      icon: s.icon,
      categories: Object.fromEntries(
        Object.entries(s.categories).map(([cat, items]) => [
          cat,
          (items || []).map(({ id, name, duration }) => ({ id, name, duration })),
        ])
      ),
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'standards.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 只擷取甘特圖區塊輸出成 PDF，不含側欄/測項清單/設定面板
  // 作法：複製一份到畫面外並完整展開後才擷取，確保 html2canvas 的量測與繪製一致
  // （直接擷取原節點會因捲動容器裁切、以及 truncate 的 overflow:hidden 造成文字被切半）
  const EXPORT_SCALE = 3;
  const handleExportPDF = async () => {
    if (!ganttRef.current || isExporting) return;
    setIsExporting(true);
    const holder = document.createElement('div');
    try {
      const src = ganttRef.current;
      holder.style.cssText = `position:fixed;left:-99999px;top:0;background:#ffffff;padding:24px;width:${src.offsetWidth}px;`;
      const clone = src.cloneNode(true) as HTMLElement;
      clone.style.height = 'auto';
      // 移除純 UI 控制項（匯出鈕、排序切換）
      clone.querySelectorAll('.no-print').forEach(el => el.remove());
      // 展開 DUT 列捲動區域，避免多型號時被裁切
      clone.querySelectorAll<HTMLElement>('[data-gantt-scroll]').forEach(el => {
        el.style.maxHeight = 'none';
        el.style.overflow = 'visible';
      });
      // 解除 truncate 的 overflow:hidden，否則 html2canvas 會把文字底部切掉
      clone.querySelectorAll<HTMLElement>('.truncate').forEach(el => {
        el.style.overflow = 'visible';
        el.style.textOverflow = 'clip';
        el.style.lineHeight = '1.7';
      });
      holder.appendChild(clone);
      document.body.appendChild(holder);
      await new Promise(requestAnimationFrame);

      // html2canvas 的文字基線會比實際版面低（DOM 本身置中無誤，實測 8px 字低 4.0px、
      // 10px 字低 5.5px，擬合為 0.75×字級−2）。此處回推補正，讓文字在色塊/徽章內置中。
      // 只處理 12px 以下的標籤，避免動到總工期那類大字級數字。
      clone.querySelectorAll<HTMLElement>('*').forEach(el => {
        if (el.children.length > 0 || !el.textContent?.trim()) return;
        const fontSize = parseFloat(getComputedStyle(el).fontSize);
        if (!fontSize || fontSize > 12) return;
        const shift = 0.75 * fontSize - 2;
        if (shift <= 0) return;
        el.style.position = 'relative';
        el.style.top = `-${shift}px`;
      });

      const canvas = await html2canvas(holder, {
        scale: EXPORT_SCALE,
        backgroundColor: '#ffffff',
        width: holder.scrollWidth,
        height: holder.scrollHeight,
      });

      // 頁面尺寸取 CSS 像素當 pt，使影像密度為 EXPORT_SCALE × 72 DPI（216 DPI）
      const pageW = canvas.width / EXPORT_SCALE;
      const pageH = canvas.height / EXPORT_SCALE;
      const pdf = new jsPDF({
        orientation: pageW > pageH ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [pageW, pageH],
      });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, pageH);
      pdf.save(`DQA排程甘特圖_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('匯出 PDF 失敗', err);
      alert('匯出 PDF 失敗，請稍後再試。');
    } finally {
      if (holder.parentNode) document.body.removeChild(holder);
      setIsExporting(false);
    }
  };

  // App 啟動時從 GitHub 載入 Lab TA 佈達的最新測項資料
  // 天數以佈達版為準；本地只保留使用者自訂的測項/類別（見 mergeLocalWithRemote）
  useEffect(() => {
    let cancelled = false;
    setSyncStatus('載入測項資料中...');
    loadStandardsFromRemote().then(({ data, source }) => {
      if (cancelled) return;
      let merged = data;
      try {
        const savedLocal = localStorage.getItem('dqa_planner_v13');
        const localData = savedLocal ? JSON.parse(savedLocal) : [];
        merged = mergeLocalWithRemote(data, localData, isLabTA);
      } catch (err) {
        console.warn('[DQA] 本地備份解析失敗，改用佈達版資料', err);
      }
      setStandards(merged);
      setDataSource(source);
      setSyncStatus(source === 'remote' ? '已載入最新佈達版測項' : '離線：使用內建預設測項');
    });
    return () => { cancelled = true; };
  }, []);

  const [models, setModels] = useState<ModelEntry[]>(() => {
    const saved = localStorage.getItem('dqa_planner_v14_models');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => ({
            ...m,
            standardIds: m.standardIds || (m.standardId ? [m.standardId] : ['moxa']),
            mechStrategy: m.mechStrategy || ExecutionStrategy.PARALLEL,
            // 舊版資料無 IP 欄位，補預設值（串聯＝沿用既有 S&V 樣品，與舊行為最接近）
            ipSampleCount: m.ipSampleCount ?? 1,
            ipStrategy: m.ipStrategy || ExecutionStrategy.SERIAL,
          }));
        }
      } catch (e) {
        console.error("Failed to parse saved models", e);
      }
    }
    return [createDefaultModel(standards, ['moxa'], 'Default Model')];
  });

  const [activeModelId, setActiveModelId] = useState<string>(models[0]?.id || '');
  const [sortBy, setSortBy] = useState<'model' | 'track'>('model');

  // Keep strategy global
  const [strategy, setStrategy] = useState<ExecutionStrategy>(ExecutionStrategy.PARALLEL);
  const [storageStrategy, setStorageStrategy] = useState<ExecutionStrategy>(ExecutionStrategy.PARALLEL);
  const [pkgStrategy, setPkgStrategy] = useState<PkgSampleStrategy>(PkgSampleStrategy.REUSE);

  const [editingStandard, setEditingStandard] = useState<{ isNew: boolean, data: Partial<StandardData> } | null>(null);
  const [editingTest, setEditingTest] = useState<{ standardId: string, isNew: boolean, data: Partial<TestItem> } | null>(null);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState<boolean>(false);

  // Sync activeModelId
  useEffect(() => {
    if (!models.find(m => m.id === activeModelId) && models.length > 0) {
      setActiveModelId(models[0].id);
    }
  }, [models, activeModelId]);

  useEffect(() => {
    localStorage.setItem('dqa_planner_v14_models', JSON.stringify(models));
  }, [models]);

  const activeModel = models.find(m => m.id === activeModelId) || models[0];
  const activeApps = activeModel.standardIds || [];

  // 兩種呼叫方式：直接給 patch，或給 updater 從「上一版 model」推導 patch。
  // 需要讀舊值的操作（selectedTests、standardIds）一律用 updater，否則同一批
  // React 更新中的第二次呼叫會用過期的 render closure 覆蓋掉第一次的結果。
  // updater 回傳 null 代表放棄這次更新。
  const updateActiveModel = (
    updates: Partial<ModelEntry> | ((prev: ModelEntry) => Partial<ModelEntry> | null)
  ) => {
    setModels(prev => prev.map(m => {
      if (m.id !== activeModelId) return m;
      const patch = typeof updates === 'function' ? updates(m) : updates;
      if (!patch) return m;
      return { ...m, ...patch };
    }));
  };


  // 儲存最新的 standards 到 localStorage，以保留使用者的本地備份，避免離線時完全沒資料
  // 必須等遠端載入完成才寫入：否則初始的內建 fallback 會先被存成「本地修改」，
  // 之後合併時反而蓋過 Lab TA 佈達版（名稱與既有測項都會停留在舊值）。
  useEffect(() => {
    if (dataSource === 'loading') return;
    if (standards.length > 0) {
      localStorage.setItem('dqa_planner_v13', JSON.stringify(standards));
    }
  }, [standards, dataSource]);

  const toggleApp = (appId: string) => {
    const allDefaults = getDefaultSelectedTests(standards);
    updateActiveModel(prev => {
      const current = prev.standardIds || [];
      if (current.includes(appId)) {
        // 取消選取：移除該標準 ID
        const updated = current.filter(id => id !== appId);
        if (updated.length === 0) return null;
        return { standardIds: updated } as any;
      }
      // 新增選取：合併預設勾選測項（不取消已勾選項目）
      const newDefaults = allDefaults[appId] || {};
      const mergedTests = { ...prev.selectedTests };
      Object.entries(newDefaults).forEach(([key, val]) => {
        if (val) mergedTests[key] = true; // 只新增，不覆蓋
      });
      return { standardIds: [...current, appId], selectedTests: mergedTests } as any;
    });
  };

  const toggleTest = (standardId: string, itemId: string) => {
    updateActiveModel(prev => {
      if (!prev.standardIds?.includes(standardId)) return null;
      const currentSelection = prev.selectedTests || {};
      return {
        selectedTests: { ...currentSelection, [itemId]: !currentSelection[itemId] }
      };
    });
  };

  const toggleAllInStandard = (standard: StandardData, select: boolean) => {
    updateActiveModel(prev => {
      if (!prev.standardIds?.includes(standard.id)) return null;
      const currentSelection = { ...(prev.selectedTests || {}) };
      Object.values(standard.categories).forEach(items => {
        items?.forEach(item => {
          currentSelection[item.id] = select;
        });
      });
      return { selectedTests: currentSelection };
    });
  };

  const [syncStatus, setSyncStatus] = useState<string>('');

  const deleteTestItem = (e: React.MouseEvent, standardId: string, category: CategoryType, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('確定要永久刪除此測試項目嗎？')) return;

    // 計算新的 standards 陣列
    const newStandards = standards.map(s => {
      if (s.id !== standardId) return s;
      const updatedCats = { ...s.categories };
      if (updatedCats[category]) {
        updatedCats[category] = updatedCats[category]!.filter(i => i.id !== itemId);
      }
      return { ...s, categories: updatedCats };
    });

    // Optimistic UI update
    setStandards(newStandards);
    setModels(prev => prev.map(m => {
      if (!m.standardIds?.includes(standardId)) return m;
      const updatedTests = { ...m.selectedTests };
      delete updatedTests[itemId];
      return { ...m, selectedTests: updatedTests };
    }));

    // 僅存於本機（見 standards 的 localStorage useEffect），不再寫入雲端
  };

  const saveStandard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStandard) return;
    const { isNew, data } = editingStandard;

    let newStandards;
    if (isNew) {
      const newId = `app_${Date.now()}`;
      newStandards = [...standards, { id: newId, name: data.name || '新領域', description: '', icon: data.icon || 'bolt', categories: {} }];
    } else {
      newStandards = standards.map(s => s.id === data.id ? { ...s, ...data } : s);
    }

    setStandards(newStandards);
    setEditingStandard(null);
    // 僅存於本機，不再寫入雲端
  };

  const saveTestItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTest) return;
    const { standardId, isNew, data } = editingTest;

    const newStandards = standards.map(s => {
      if (s.id !== standardId) return s;
      const cat = (data.category as CategoryType) || CategoryType.CHAMBER;
      const currentItems = s.categories[cat] || [];
      const newCategories = { ...s.categories };
      if (isNew) {
        newCategories[cat] = [...currentItems, { id: `t_${Date.now()}`, name: data.name || '新測項', duration: data.duration || 1, category: cat }];
      } else {
        // 非 Lab TA 模式一律沿用原天數，避免繞過唯讀欄位改動基準值
        newCategories[cat] = currentItems.map(i =>
          i.id === data.id ? { ...i, ...data, duration: isLabTA ? (data.duration ?? i.duration) : i.duration } : i
        );
      }
      return { ...s, categories: newCategories };
    });

    setStandards(newStandards);
    setEditingTest(null);
    // 僅存於本機，不再寫入雲端
  };

  const calculationResults = useMemo(() => {
    let finalTotalDays = 0;
    let globalTrackATotal = 0;
    let globalTrackBTotal = 0;
    let globalTrackCTotal = 0;
    let globalTotalUnits = 0;
    let globalLastMechEndDay = 0;
    const allPkgTasks: any[] = [];

    // S&V 並行模式：全局設備時間槽排程
    // 相同應用跨型號可共用設備（並行），不同應用必須依序（設備只能設定一種條件）
    // key = 應用 ID, value = 該應用的設備時間槽位移（相對於 BF 結束後的天數）
    const mechParallelSlots: Record<string, number> = {};
    let mechParallelNextSlot = 0; // 下一個未使用槽位的起始位移

    type Seg = { label: string; days: number; bg: string; text: string; isWait?: boolean };
    const allDutRows: Array<{
      id: string; modelId?: string; label: string; track: 'A' | 'B' | 'C' | 'D'; trackLabel: string;
      startDay: number; segments: Seg[]; totalDays: number;
    }> = [];

    // 處理每個獨立的 model
    models.forEach((model, mIndex) => {
      const selectedStandards = standards.filter(s => (model.standardIds || []).includes(s.id));
      if (selectedStandards.length === 0) return;

      const selectedMap = model.selectedTests || {};

      // 各測項分類 — 合併為每標準每類別一個段落，多選標準以不同顏色區分
      const envBaseSegments: Seg[] = [];
      let envBaseDays = 0;
      // RF Performance Test 獨立呈現：RF前排在 Basic Function 之前，RF後接在 Chamber 之後
      const rfPreSegments: Seg[] = [];
      let rfPreDays = 0;
      const rfPostSegments: Seg[] = [];
      let rfPostDays = 0;
      const storageSegments: Seg[] = [];
      let totalStorageDays = 0;
      const altitudeSegments: Seg[] = [];
      let altitudeDays = 0;

      const ipOtherSegments: Seg[] = [];
      let ipOtherDays = 0;
      const mechSegments: Seg[] = [];
      let mechDays = 0;
      const pkgSegments: Seg[] = [];
      let pkgDays = 0;
      let envBfDays = 0;
      let mechBfDays = 0;
      let pkgBfDays = 0;
      let generalBfDays = 0;

      const mechSegsPerStd: Array<{ segs: Seg[], days: number, standardId?: string }> = selectedStandards.map(() => ({ segs: [], days: 0 }));

      // 遍歷所有已選標準，累計每類別天數後推入合併段落
      const multiStd = selectedStandards.length > 1;
      selectedStandards.forEach((standard, stdIndex) => {
        const stdTag = multiStd ? `[${standard.name.replace(/\s*(Industrial|法規|標準)/gi, '').trim()}] ` : '';
        // 使用各標準固定顏色，確保全應用一致性
        const stdFixedColor = STANDARD_FIXED_COLORS[standard.id] || { bg: 'bg-slate-400', text: 'text-white' };
        const getColor = () => ({ bg: stdFixedColor.bg, text: stdFixedColor.text });

        // 累計此標準各類別的總天數
        let stdEnvDays = 0;
        let stdStorageDays = 0;
        let stdAltDays = 0;
        let stdRfPreDays = 0;
        let stdRfPostDays = 0;

        let stdIpDays = 0;
        let stdMechDays = 0;
        let stdPkgDays = 0;

        Object.entries(standard.categories).forEach(([cat, items]) => {
          const catType = cat as CategoryType;
          (items as any[] | undefined)?.forEach(item => {
            if (selectedMap[item.id]) {
              // 外測項目不佔用自有設備工期，只累計費用（於 outsourcedCost 統計）
              if (item.outsourced) return;
              const nameLower = item.name.toLowerCase();
              const isPkg = nameLower.includes('pkg') || nameLower.includes('包裝');
              const isStorage = nameLower.includes('storage');
              const isAltitude = nameLower.includes('altitude') || item.name.includes('高空');
              const isBF = nameLower.includes('basic function') || item.name.includes('基本功能');

              const isIpOtherCategory = [CategoryType.DUST_TEST, CategoryType.WATER_TEST, CategoryType.OTHER].includes(catType);
              // RF Performance Test：以名稱區分 Chamber 前/後，於甘特圖獨立成段
              const isRf = nameLower.includes('rf performance') || nameLower.includes('rf test');
              const isRfPost = isRf && (item.name.includes('後') || nameLower.includes('post') || nameLower.includes('after'));
              const isRfPre = isRf && !isRfPost;

              if (isRfPre) {
                stdRfPreDays += item.duration;
              } else if (isRfPost) {
                stdRfPostDays += item.duration;
              } else if (isPkg && isBF) {
                pkgBfDays = Math.max(pkgBfDays, item.duration);
              } else if (isBF) {
                if (catType === CategoryType.VIB_SHOCK) mechBfDays = Math.max(mechBfDays, item.duration);
                else if (catType === CategoryType.CHAMBER || catType === CategoryType.FUNCTION) envBfDays = Math.max(envBfDays, item.duration);
                generalBfDays = Math.max(generalBfDays, item.duration);
              } else if (isPkg) {
                stdPkgDays += item.duration;
              } else if (isStorage) {
                stdStorageDays += item.duration;
              } else if (isAltitude) {
                stdAltDays += item.duration;
              } else if (isIpOtherCategory) {
                stdIpDays += item.duration;
              } else if ([CategoryType.CHAMBER].includes(catType)) {
                stdEnvDays += item.duration;
              } else {
                stdMechDays += item.duration;
              }
            }
          });
        });

        // 推入合併段落：每標準每類別一個 segment
        if (stdEnvDays > 0) {
          const c = getColor();
          envBaseSegments.push({ label: stdTag + 'Chamber', days: stdEnvDays, bg: c.bg, text: c.text });
          envBaseDays += stdEnvDays;
        }
        if (stdRfPreDays > 0) {
          rfPreSegments.push({ label: stdTag + 'RF 前', days: stdRfPreDays, bg: CATEGORY_COLORS.rf.bg, text: CATEGORY_COLORS.rf.text });
          rfPreDays += stdRfPreDays;
        }
        if (stdRfPostDays > 0) {
          rfPostSegments.push({ label: stdTag + 'RF 後', days: stdRfPostDays, bg: CATEGORY_COLORS.rf.bg, text: CATEGORY_COLORS.rf.text });
          rfPostDays += stdRfPostDays;
        }
        if (stdStorageDays > 0) {
          const c = getColor();
          storageSegments.push({ label: stdTag + 'Storage', days: stdStorageDays, bg: c.bg, text: c.text });
          totalStorageDays += stdStorageDays;
        }
        if (stdAltDays > 0) {
          altitudeSegments.push({ label: stdTag + '✈️ 高空', days: stdAltDays, bg: 'bg-amber-100 border-amber-300', text: 'text-amber-800 font-bold' });
          altitudeDays += stdAltDays;
        }

        if (stdIpDays > 0) {
          const c = getColor();
          ipOtherSegments.push({ label: stdTag + 'IP/Other', days: stdIpDays, bg: c.bg, text: c.text });
          ipOtherDays += stdIpDays;
        }
        if (stdMechDays > 0) {
          const c = getColor();
          const newSeg = { label: stdTag + 'S&V', days: stdMechDays, bg: c.bg, text: c.text, standardId: standard.id };
          mechSegments.push(newSeg);
          mechDays += stdMechDays;
          mechSegsPerStd[stdIndex].segs.push(newSeg);
          mechSegsPerStd[stdIndex].days += stdMechDays;
          mechSegsPerStd[stdIndex].standardId = standard.id;
        }
        if (stdPkgDays > 0) {
          const c = getColor();
          pkgSegments.push({ label: stdTag + 'PKG', days: stdPkgDays, bg: c.bg, text: c.text });
          pkgDays += stdPkgDays;
        }
      });

      const activeMechStds = mechSegsPerStd.filter(s => s.days > 0);
      const mechBins = Array.from({ length: Math.max(1, model.mechSampleCount) }, (_, i) => {
        if (activeMechStds.length === 0) return { segments: [], totalDays: 0 };
        if (model.mechStrategy === ExecutionStrategy.SERIAL) {
          // 串聯模式：一個 DUT 只執行一種應用的 S&V（共用設備，DUT 間依序執行）
          const stdData = activeMechStds[i % activeMechStds.length];
          return { segments: [...stdData.segs], totalDays: stdData.days };
        } else {
          // 並聯模式：一台樣品只執行一種應用的 S&V（round-robin 分配）
          // 相同應用的不同型號可共用設備、時程對齊
          const stdData = activeMechStds[i % activeMechStds.length];
          return { segments: [...stdData.segs], totalDays: stdData.days };
        }
      });

      // --- 建立共用 DUT Rows（樣品共用，所有標準在同一 DUT 行上依序排列）---
      const appendEnvBF = () => envBfDays > 0 ? [{ label: CATEGORY_COLORS[CategoryType.FUNCTION]?.label || 'Basic Func', days: envBfDays, bg: CATEGORY_COLORS[CategoryType.FUNCTION]?.bg || 'bg-sky-100', text: CATEGORY_COLORS[CategoryType.FUNCTION]?.text || 'text-sky-600' }] : [];
      const appendMechBF = () => mechBfDays > 0 ? [{ label: CATEGORY_COLORS[CategoryType.FUNCTION]?.label || 'Basic Func', days: mechBfDays, bg: CATEGORY_COLORS[CategoryType.FUNCTION]?.bg || 'bg-sky-100', text: CATEGORY_COLORS[CategoryType.FUNCTION]?.text || 'text-sky-600' }] : [];
      const appendPkgBF = () => pkgBfDays > 0 ? [{ label: 'PKG Basic Func', days: pkgBfDays, bg: 'bg-sky-100', text: 'text-sky-600' }] : [];
      const appendGeneralBF = () => generalBfDays > 0 ? [{ label: CATEGORY_COLORS[CategoryType.FUNCTION]?.label || 'Basic Func', days: generalBfDays, bg: CATEGORY_COLORS[CategoryType.FUNCTION]?.bg || 'bg-sky-100', text: CATEGORY_COLORS[CategoryType.FUNCTION]?.text || 'text-sky-600' }] : [];

      const modelDuts: Array<any> = [];
      let rowCounter = 1;
      const baseStartDay = strategy === ExecutionStrategy.SERIAL ? globalTrackATotal : 0;

      // Storage 策略：每型號固定 1 台 Storage 樣品
      // 串聯：延續第一台 Chamber 樣品（附加到 envRow[0]），不額外增加
      // 並聯：增加 1 台獨立的 Storage 樣品
      const storageIsParallel = storageStrategy === ExecutionStrategy.PARALLEL && totalStorageDays > 0;
      const envDutCount = model.envSampleCount;

      // IP 策略：並聯＝獨立樣品（依 ipSampleCount 配置），串聯＝接在 S&V 之後不增加樣品
      const ipIsParallel = (model.ipStrategy || ExecutionStrategy.SERIAL) === ExecutionStrategy.PARALLEL;
      const ipDutCount = Math.max(1, model.ipSampleCount ?? 1);
      // 串聯但無 S&V 樣品可接續時，會退回配置 1 台獨立樣品
      let ipFallbackUnits = 0;

      // 1. Track A (ENV) — 合併所有標準的 Chamber 段落在同一 DUT 行
      const envRows: any[] = [];
      if (envDutCount > 0 && (envBaseSegments.length > 0 || envBfDays > 0 || rfPreDays > 0 || rfPostDays > 0)) {
        for (let i = 0; i < envDutCount; i++) {
          // 順序：RF 前 → Basic Function → Chamber(含延續的 Storage) → RF 後
          const segs = [...rfPreSegments, ...appendEnvBF(), ...envBaseSegments];
          let days = rfPreDays + envBfDays + envBaseDays;
          // 串聯模式：僅第一台 Chamber 樣品延續 Storage 測試
          if (!storageIsParallel && storageSegments.length > 0 && i === 0) {
            segs.push(...storageSegments);
            days += totalStorageDays;
          }
          // RF 後測試接在所有 Chamber 類測項完成之後
          segs.push(...rfPostSegments);
          days += rfPostDays;
          const row = {
            id: `dut_env_${model.id}_${rowCounter}`, modelId: model.id, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
            track: 'A', trackLabel: 'ENV', startDay: baseStartDay, segments: segs, totalDays: days,
          };
          envRows.push(row);
          modelDuts.push(row);
          rowCounter++;
        }
      }

      // 2. Storage 獨立（並聯模式）：增加 1 台獨立 Storage 樣品
      if (storageIsParallel) {
        const segs = [...appendEnvBF(), ...storageSegments];
        const sDays = envBfDays + totalStorageDays;
        const row = {
          id: `dut_storage_${model.id}_${rowCounter}`, modelId: model.id, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
          track: 'A', trackLabel: 'Storage', startDay: baseStartDay, segments: segs, totalDays: sDays,
        };
        modelDuts.push(row);
        envRows.push(row);
        rowCounter++;
      }

      // 3. Track B (S&V) — 依型號策略決定並聯或串聯
      const mechRows: any[] = [];
      if (model.mechSampleCount > 0 && (mechSegments.length > 0 || mechBfDays > 0)) {
        if (model.mechStrategy === ExecutionStrategy.SERIAL) {
          // 串聯模式：跨型號全局接續執行 
          let equipmentStartDay = Math.max(baseStartDay + mechBfDays, globalLastMechEndDay);
          for (let i = 0; i < model.mechSampleCount; i++) {
            const bin = mechBins[i];
            const segments = [];
            if (mechBfDays > 0) {
              segments.push({
                label: CATEGORY_COLORS[CategoryType.FUNCTION]?.label || 'Basic Func',
                days: mechBfDays,
                bg: CATEGORY_COLORS[CategoryType.FUNCTION]?.bg || 'bg-sky-100',
                text: CATEGORY_COLORS[CategoryType.FUNCTION]?.text || 'text-sky-600',
                forceStartDay: baseStartDay
              });
            }

            let startDelay = equipmentStartDay - (baseStartDay + mechBfDays);
            if (startDelay > 0 && bin.segments.length > 0) {
              segments.push({
                label: '等候機台',
                days: startDelay,
                bg: 'bg-transparent border-t border-b border-dashed border-slate-300',
                text: 'text-slate-400 italic',
                isWait: true
              });
            }

            segments.push(...bin.segments);

            const row = {
              id: `dut_mech_${model.id}_${rowCounter}`,
              label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
              track: 'B',
              trackLabel: 'S&V',
              startDay: baseStartDay,
              segments: segments,
              totalDays: mechBfDays + (bin.segments.length > 0 ? (startDelay + bin.totalDays) : 0),
            };
            mechRows.push(row);
            modelDuts.push(row);
            rowCounter++;
            equipmentStartDay += bin.totalDays;
          }
          globalLastMechEndDay = equipmentStartDay;
        } else {
          // 並聯模式：一台樣品只執行一種應用的 S&V
          // 相同應用跨型號共用設備（並行），不同應用依序（設備一次只能設定一種條件）
          for (let i = 0; i < model.mechSampleCount; i++) {
            const bin = mechBins[i];
            const stdData = activeMechStds[i % activeMechStds.length];
            const appId = stdData?.standardId || '';

            // 分配全局設備時間槽：首次遇到的應用取得下一個可用槽位
            if (appId && mechParallelSlots[appId] === undefined) {
              mechParallelSlots[appId] = mechParallelNextSlot;
              mechParallelNextSlot += bin.totalDays;
            }

            const slotOffset = appId ? (mechParallelSlots[appId] || 0) : 0;

            const segments: Seg[] = [];
            // BF 基本功能測試
            if (mechBfDays > 0) {
              segments.push({
                label: CATEGORY_COLORS[CategoryType.FUNCTION]?.label || 'Basic Func',
                days: mechBfDays,
                bg: CATEGORY_COLORS[CategoryType.FUNCTION]?.bg || 'bg-sky-100',
                text: CATEGORY_COLORS[CategoryType.FUNCTION]?.text || 'text-sky-600',
              });
            }
            // 等候機台：不同應用需等候設備切換條件
            if (slotOffset > 0 && bin.segments.length > 0) {
              segments.push({
                label: '等候機台',
                days: slotOffset,
                bg: 'bg-transparent border-t border-b border-dashed border-slate-300',
                text: 'text-slate-400 italic',
                isWait: true
              });
            }
            segments.push(...bin.segments);

            const row = {
              id: `dut_mech_${model.id}_${rowCounter}`,
              modelId: model.id,
              label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
              track: 'B',
              trackLabel: 'S&V',
              startDay: baseStartDay,
              segments,
              totalDays: mechBfDays + (bin.segments.length > 0 ? (slotOffset + bin.totalDays) : 0),
            };
            mechRows.push(row);
            modelDuts.push(row);
            rowCounter++;
          }
        }
      }

      // 4. 智慧負載平衡
      if (altitudeSegments.length > 0) {
        if (envRows.length > 0) {
          envRows.sort((a, b) => a.totalDays - b.totalDays);
          envRows[0].segments.push(...altitudeSegments);
          envRows[0].totalDays += altitudeDays;
        } else {
          modelDuts.push({
            id: `dut_alt_${model.id}_${rowCounter}`, modelId: model.id, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
            track: 'A', trackLabel: 'ENV (Alt)', startDay: baseStartDay, segments: [...appendEnvBF(), ...altitudeSegments], totalDays: envBfDays + altitudeDays,
          });
          rowCounter++;
        }
      }

      // IP（防塵/防水/鹽霧）執行策略
      // 並聯：配置 ipSampleCount 台獨立樣品，各自前置 Basic Function
      // 串聯：接在 S&V 之後（沿用既有 S&V 樣品，不增加樣品數）
      if (ipOtherSegments.length > 0) {
        if (ipIsParallel) {
          for (let i = 0; i < ipDutCount; i++) {
            modelDuts.push({
              id: `dut_ip_${model.id}_${rowCounter}`, modelId: model.id, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
              track: 'D', trackLabel: 'IP/Misc', startDay: baseStartDay, segments: [...appendGeneralBF(), ...ipOtherSegments], totalDays: generalBfDays + ipOtherDays,
            });
            rowCounter++;
          }
        } else if (mechRows.length > 0) {
          // 串聯：接在工期最短的 S&V 樣品之後，避免拉長關鍵路徑
          const target = [...mechRows].sort((a, b) => a.totalDays - b.totalDays)[0];
          target.segments.push(...ipOtherSegments);
          target.totalDays += ipOtherDays;
        } else {
          // 沒有 S&V 樣品可接續時，退回獨立樣品（否則測項會憑空消失）
          modelDuts.push({
            id: `dut_ip_${model.id}_${rowCounter}`, modelId: model.id, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
            track: 'D', trackLabel: 'IP/Misc', startDay: baseStartDay, segments: [...appendGeneralBF(), ...ipOtherSegments], totalDays: generalBfDays + ipOtherDays,
          });
          rowCounter++;
          ipFallbackUnits = 1;
        }
      }

      // 5. Track C (PKG) - 暫存，等待所有 ENV 算完後在最終階段再同步對齊
      if (model.pkgSampleCount > 0 && (pkgSegments.length > 0 || pkgBfDays > 0)) {
        const prepSegments: Seg[] = [{ label: CATEGORY_COLORS.prep.label, days: 14, bg: CATEGORY_COLORS.prep.bg, text: CATEGORY_COLORS.prep.text }];
        allPkgTasks.push({
          model,
          baseStartDay,
          envRows,
          pkgSampleCount: model.pkgSampleCount,
          prepSegments,
          pkgBfDays,
          pkgSegments,
          pkgDays,
          rowCounterOffset: rowCounter
        });
        rowCounter += model.pkgSampleCount;
      }

      // --- 結算 Model 的時間與數量 ---
      let maxA = 0, maxB = 0, maxC = 0, maxD = 0;
      modelDuts.forEach(d => {
        // d.totalDays 只是該「長條」的寬度。要算出實際佔用的「最後一天」，必須以 (d.startDay - baseStartDay + d.totalDays) 來結算該 Model 的總耗時
        const relativeEndDay = (d.startDay - baseStartDay) + d.totalDays;

        if (d.track === 'A') maxA = Math.max(maxA, relativeEndDay);
        if (d.track === 'B') maxB = Math.max(maxB, relativeEndDay);
        if (d.track === 'C') maxC = Math.max(maxC, relativeEndDay);
        if (d.track === 'D') maxD = Math.max(maxD, relativeEndDay);
      });

      if (strategy === ExecutionStrategy.SERIAL) {
        // modelDuts.startDay is ALREADY correctly set to baseStartDay = globalTrackATotal
        globalTrackATotal += Math.max(maxA, maxB, maxC, maxD);
      } else {
        globalTrackATotal = Math.max(globalTrackATotal, maxA);
        globalTrackBTotal = Math.max(globalTrackBTotal, maxB);
        globalTrackCTotal = Math.max(globalTrackCTotal, maxC);
        globalTrackATotal = Math.max(globalTrackATotal, maxD);
      }

      const pkgExtraUnits = (pkgStrategy === PkgSampleStrategy.INDEPENDENT && model.pkgSampleCount > 0 && (pkgSegments.length > 0 || pkgBfDays > 0)) ? model.pkgSampleCount : 0;
      const storageExtraUnits = storageIsParallel ? 1 : 0;
      // IP 並聯才額外消耗樣品；串聯沿用 S&V 樣品（無 S&V 可接時退回 1 台）
      const ipExtraUnits = ipOtherSegments.length > 0 ? (ipIsParallel ? ipDutCount : ipFallbackUnits) : 0;
      const modelTotalUnits = model.envSampleCount + model.mechSampleCount + pkgExtraUnits + storageExtraUnits + ipExtraUnits;
      globalTotalUnits += modelTotalUnits;

      allDutRows.push(...modelDuts);
    });

    // --- 全局同步處理 PKG Start ---
    const appendGlobalPkgBF = (pkgBfDays: number) => pkgBfDays > 0 ? [{ label: 'PKG Basic Func', days: pkgBfDays, bg: 'bg-sky-100', text: 'text-sky-600' }] : [];
    let globalMaxEnvEndDay = 0;
    allDutRows.filter(r => r.track === 'A' || r.track === 'C' || r.track === 'D').forEach(r => {
      globalMaxEnvEndDay = Math.max(globalMaxEnvEndDay, r.startDay + r.totalDays);
    });

    allPkgTasks.forEach(task => {
      const activePrepDays = 14 + task.pkgBfDays;
      let rCounter = task.rowCounterOffset;
      if (pkgStrategy === PkgSampleStrategy.INDEPENDENT) {
        // 獨立樣品（並行）：有額外獨立機台，不需等待其他機台對齊，可直接開始
        // 且因為是獨立機台，不需重新整理，所以不需要 14 天前置作業
        for (let i = 0; i < task.pkgSampleCount; i++) {
          const row = {
            id: `dut_pkg_${task.model.id}_${rCounter}`, modelId: task.model.id, label: `DUT ${String(rCounter).padStart(2, '0')} - ${task.model.name}`,
            track: 'C' as any, trackLabel: 'PKG', startDay: task.baseStartDay,
            segments: [...appendGlobalPkgBF(task.pkgBfDays), ...task.pkgSegments],
            totalDays: task.pkgBfDays + task.pkgDays,
          };
          allDutRows.push(row);

          // Re-calculate max C for total duration
          globalTrackCTotal = Math.max(globalTrackCTotal, row.startDay + row.totalDays);
          rCounter++;
        }
      } else {
        // 消耗樣品：全部附加到 env 陣列尾端，並使用 gap 確保統一在此刻同步啟動前置作業
        const pkgAppendSegs = [...task.prepSegments, ...appendGlobalPkgBF(task.pkgBfDays), ...task.pkgSegments];
        const pkgAppendDays = 14 + task.pkgBfDays + task.pkgDays;
        for (let i = 0; i < task.pkgSampleCount; i++) {
          const targetRow = task.envRows[i % Math.max(1, task.envRows.length)];
          if (targetRow) {
            const absoluteEnd = targetRow.startDay + targetRow.totalDays;
            const gapDays = globalMaxEnvEndDay - absoluteEnd;
            if (gapDays > 0) {
              targetRow.segments.push({ label: '等候對齊', days: gapDays, bg: 'bg-transparent border-t border-b border-dashed border-slate-300', text: 'text-slate-400 italic', isWait: true });
              targetRow.totalDays += gapDays;
            }
            targetRow.segments.push(...pkgAppendSegs);
            targetRow.totalDays += pkgAppendDays;

            // Re-calculate max A/C after appending
            if (targetRow.track === 'A') globalTrackATotal = Math.max(globalTrackATotal, targetRow.startDay + targetRow.totalDays);
          }
        }
      }
    });

    if (strategy === ExecutionStrategy.SERIAL) {
      finalTotalDays = globalTrackATotal;
    } else {
      finalTotalDays = Math.max(globalTrackATotal, globalTrackBTotal, globalTrackCTotal);
    }

    if (sortBy === 'track') {
      allDutRows.sort((a, b) => {
        // 先按測試類別名稱 (ENV, Storage, S&V) 排列，確保同測試群聚
        if (a.trackLabel !== b.trackLabel) return String(a.trackLabel).localeCompare(String(b.trackLabel));
        // 同測試類別再依型號及 DUT 編號排列
        return a.label.localeCompare(b.label);
      });
    } else {
      allDutRows.sort((a, b) => {
        if (a.modelId !== b.modelId) return String(a.modelId).localeCompare(String(b.modelId));
        return String(a.track).localeCompare(String(b.track));
      });
    }

    return {
      totalDays: finalTotalDays,
      trackATotal: globalTrackATotal,
      trackBTotal: globalTrackBTotal,
      trackCTotal: globalTrackCTotal,
      hasTests: allDutRows.length > 0,
      totalUnits: globalTotalUnits, // Sum strictly counts physical items
      currentStrategy: strategy,
      dutRows: allDutRows,
    };
  }, [standards, models, strategy, storageStrategy, pkgStrategy, sortBy]);

  // 外測費用估算：彙總已勾選的外測項目各實驗室報價，取最低價作為建議估算
  const outsourcedCost = useMemo(() => {
    const items: Array<{ name: string; modelName: string; quotes: Record<string, number> }> = [];
    models.forEach(model => {
      const selected = model.selectedTests || {};
      (model.standardIds || []).forEach(sid => {
        const std = standards.find(s => s.id === sid);
        if (!std) return;
        Object.values(std.categories).forEach(list => {
          (list || []).forEach(item => {
            if (item.outsourced && selected[item.id]) {
              items.push({ name: item.name, modelName: model.name, quotes: item.quotes || {} });
            }
          });
        });
      });
    });
    const vendorTotals: Record<string, number> = {};
    let lowestTotal = 0;
    items.forEach(({ quotes }) => {
      Object.entries(quotes).forEach(([v, price]) => {
        vendorTotals[v] = (vendorTotals[v] || 0) + price;
      });
      const vals = Object.values(quotes);
      if (vals.length) lowestTotal += Math.min(...vals);
    });
    return { items, vendorTotals, lowestTotal, count: items.length };
  }, [standards, models]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 font-sans">

      {/* Sidebar - Compact Selection */}
      <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto no-print md:sticky md:top-0 md:h-screen">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">DQA Planner</h1>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Industrial Standards</p>
          <div className={`text-[9px] mt-1.5 flex items-center gap-1 ${syncStatus.includes('失敗') ? 'text-red-500 font-bold' : syncStatus.includes('等待') ? 'text-amber-500 font-bold' : dataSource === 'remote' ? 'text-emerald-500' : dataSource === 'loading' ? 'text-amber-400' : 'text-slate-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${syncStatus.includes('失敗') ? 'bg-red-500 animate-pulse' : syncStatus.includes('等待') ? 'bg-amber-500 animate-pulse' : dataSource === 'remote' ? 'bg-emerald-400' : dataSource === 'loading' ? 'bg-amber-400 animate-pulse' : 'bg-slate-300'}`}></span>
            {syncStatus || (dataSource === 'remote' ? '已載入最新佈達版測項' : dataSource === 'loading' ? '載入中...' : '使用內建預設資料')}
          </div>

          {/* Lab TA 模式：解鎖測項天數編輯 + 匯出佈達用 standards.json */}
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
            {isLabTA ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">🔓 Lab TA 模式</span>
                  <button onClick={lockLabTA} className="text-[9px] font-bold text-slate-400 hover:text-slate-600">鎖定</button>
                </div>
                <button
                  onClick={exportStandardsJson}
                  className="w-full py-2 rounded-lg bg-slate-900 text-white text-[9px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors"
                >
                  匯出 standards.json
                </button>
                <p className="text-[8px] text-slate-400 leading-relaxed">改完天數後匯出，交付 repo 的 data/standards.json 才算正式佈達</p>
              </>
            ) : (
              <button
                onClick={unlockLabTA}
                className="w-full py-2 rounded-lg bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors"
              >
                🔒 Lab TA 解鎖
              </button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-2 mb-2">應用領域選單</p>
          {standards.map(app => (
            <div key={app.id} className="group relative">
              <button
                onClick={() => toggleApp(app.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border ${activeApps.includes(app.id) ? 'bg-indigo-50 border-indigo-100 text-indigo-700 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50 text-slate-500'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${activeApps.includes(app.id) ? (APP_COLORS[app.id] || APP_COLORS.default) + ' text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {getAppIcon(app.icon, "w-4 h-4")}
                </div>
                <span className="font-bold text-xs text-left truncate">{app.name}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setEditingStandard({ isNew: false, data: app }); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2} /></svg>
              </button>
            </div>
          ))}
          <button
            onClick={() => setEditingStandard({ isNew: true, data: { icon: 'bolt' } })}
            className="w-full p-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all text-[10px] font-bold uppercase tracking-widest mt-4"
          >
            + 新增應用類別
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Gantt / Summary Header */}
        <section className="bg-white border-b border-slate-200 p-6 lg:px-10 shrink-0 shadow-sm sticky top-0 z-30 print:static print:shadow-none print:border-none">
          <h2 className="hidden print:block text-sm font-bold text-slate-700 mb-4">DQA 測試時程評估報告</h2>
          {!calculationResults.hasTests ? (
            <div className="w-full text-center py-6 text-slate-300 font-medium italic">請選取測項開始評估</div>
          ) : (
            <div ref={ganttRef} className="w-full flex flex-col xl:flex-row items-stretch gap-6 xl:gap-10 bg-white">
              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-sm animate-pulse"></div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">DUT Assignment Gantt</h3>
                    <div className="no-print flex ml-4 bg-slate-100 rounded-lg p-0.5">
                      <button
                        onClick={() => setSortBy('model')}
                        className={`px-3 py-1 text-[9px] font-bold uppercase rounded-md transition-all ${sortBy === 'model' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        依據型號排列
                      </button>
                      <button
                        onClick={() => setSortBy('track')}
                        className={`px-3 py-1 text-[9px] font-bold uppercase rounded-md transition-all ${sortBy === 'track' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        依據測試排列
                      </button>
                    </div>
                    <button
                      onClick={handleExportPDF}
                      disabled={isExporting}
                      className="no-print ml-2 px-3 py-1.5 text-[9px] font-bold uppercase rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-1.5"
                      title="將上方甘特圖擷取匯出為 PDF"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H8a2 2 0 01-2-2V5a2 2 0 012-2h6l6 6v9a2 2 0 01-2 2z" /></svg>
                      {isExporting ? '匯出中...' : '匯出 PDF'}
                    </button>
                  </div>
                  <div className="flex gap-4 text-[9px] font-bold text-slate-400 uppercase">
                    <span>A: <span className="text-indigo-600 tabular-nums">{calculationResults.trackATotal}D</span></span>
                    {calculationResults.trackBTotal > 0 && <span>B: <span className="text-orange-600 tabular-nums">{calculationResults.trackBTotal}D</span></span>}
                    {calculationResults.trackCTotal > 0 && <span>C: <span className="text-slate-600 tabular-nums">{calculationResults.trackCTotal}D</span></span>}
                  </div>
                </div>

                {/* DUT 列 */}
                <div data-gantt-scroll className="space-y-2 max-h-[40vh] xl:max-h-[50vh] print:max-h-none overflow-y-auto print:overflow-visible pr-1 pl-1 py-1 flex-1">
                  {calculationResults.dutRows.map(dut => (
                    <div key={dut.id} className="flex items-center gap-2">
                      <div className="w-48 lg:w-56 shrink-0 flex items-center justify-start gap-2 pr-2">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded text-center shrink-0 w-[4.5rem] ${TRACK_LABEL_COLORS[dut.track]}`}>
                          {dut.trackLabel}
                        </span>
                        <span className="text-[10px] font-bold text-slate-600 tabular-nums flex-1 text-left truncate pl-1" title={dut.label}>{dut.label}</span>
                      </div>
                      <div className="flex-1 h-7 bg-slate-50 rounded-lg relative overflow-hidden border border-slate-100">
                        <div
                          className="absolute top-0 bottom-0 flex transition-all duration-500 ease-out"
                          style={{
                            left: `${(dut.startDay / calculationResults.totalDays) * 100}%`,
                            width: `${(dut.totalDays / calculationResults.totalDays) * 100}%`
                          }}
                        >
                          {dut.segments.map((seg, i) => (
                            <div
                              key={i}
                              className={`${seg.bg} h-full border-r border-white/30 last:border-0 flex items-center justify-center hover:brightness-95 transition-all`}
                              style={{ width: `${(seg.days / dut.totalDays) * 100}%` }}
                            >
                              <span className={`text-[8px] font-bold truncate px-1 ${seg.text}`}>
                                {seg.label} {seg.days}D
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <span className="w-12 text-right text-[10px] font-black text-slate-400 tabular-nums shrink-0">
                        {dut.totalDays} WD
                      </span>
                    </div>
                  ))}
                </div>

                {/* 圖例 — 各標準固定色 + 特殊類別色 */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center pt-2 border-t border-slate-100">
                  {Object.entries(STANDARD_FIXED_COLORS).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <div className={`w-3 h-3 rounded-sm ${config.bg} shadow-sm`}></div>
                      <span className="text-[8px] text-slate-400 font-medium">{config.label}</span>
                    </div>
                  ))}
                  {Object.entries(CATEGORY_COLORS).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <div className={`w-3 h-3 rounded-sm ${config.bg} shadow-sm`}></div>
                      <span className="text-[8px] text-slate-400 font-medium">{config.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Numerical Overview */}
              <div className="flex xl:flex-col gap-6 xl:gap-8 shrink-0 xl:border-l xl:border-slate-100 xl:pl-10 h-full justify-center">
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">評估總工期</p>
                  <div className="flex items-baseline justify-end text-indigo-600">
                    <span className="text-5xl xl:text-6xl font-light tabular-nums leading-none tracking-tighter">{calculationResults.totalDays}</span>
                    <span className="text-xs font-bold ml-1 uppercase">WD</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">樣品數量</p>
                  <div className="flex items-baseline justify-end text-slate-900">
                    <span className="text-5xl xl:text-6xl font-light tabular-nums leading-none tracking-tighter">{calculationResults.totalUnits}</span>
                    <span className="text-xs font-bold ml-1 uppercase">Sets</span>
                  </div>
                </div>
                {/* 外測費用估算：外測項目不佔工期，僅估費用 */}
                {outsourcedCost.count > 0 && (
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      外測費用估算<span className="text-slate-300 normal-case tracking-normal">（{outsourcedCost.count} 項）</span>
                    </p>
                    <div className="flex items-baseline justify-end text-amber-600">
                      <span className="text-xs font-bold mr-1">NT$</span>
                      <span className="text-3xl xl:text-4xl font-light tabular-nums leading-none tracking-tighter">
                        {outsourcedCost.lowestTotal.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-col items-end gap-0.5">
                      {Object.entries(outsourcedCost.vendorTotals).map(([vendor, total]) => (
                        <span key={vendor} className="text-[8px] text-slate-400 tabular-nums">
                          {vendor} NT${total.toLocaleString()}
                        </span>
                      ))}
                    </div>
                    <p className="text-[8px] text-slate-300 mt-0.5">取各項最低報價估算</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Workspace: Test Group Details */}
        <div className="no-print flex-1 p-6 lg:p-10 pb-28 xl:pb-10">
          <div className="w-full flex flex-col gap-6">

            <div className="w-full">
              {/* Model Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
                {models.map(model => (
                  <div
                    key={model.id}
                    onClick={() => setActiveModelId(model.id)}
                    className={`px-4 py-2.5 rounded-t-xl font-bold text-sm whitespace-nowrap transition-all border border-b-0 flex items-center gap-2 cursor-pointer ${activeModelId === model.id ? 'bg-white text-indigo-600 border-slate-200 shadow-sm relative z-10 -mb-[9px]' : 'bg-slate-50 border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                  >
                    {activeModelId === model.id ? (
                      <input
                        type="text"
                        value={model.name}
                        onChange={(e) => updateActiveModel({ name: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 -mx-1 font-bold text-sm text-indigo-700 w-32"
                      />
                    ) : (
                      <span>{model.name}</span>
                    )}
                    {models.length > 1 && (
                      <button
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const newModels = models.filter(m => m.id !== model.id);
                          setModels(newModels);
                          if (activeModelId === model.id) {
                            setActiveModelId(newModels[0].id);
                          }
                        }}
                        className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-colors"
                        title="刪除型號"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newModel = createDefaultModel(standards, ['moxa'], `New Model ${models.length + 1}`);
                    setModels([...models, newModel]);
                    setActiveModelId(newModel.id);
                  }}
                  className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-indigo-600 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  新增型號
                </button>
              </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-10 items-start w-full">
              <div className="flex-1 space-y-10 w-full">

                {standards.filter(s => activeApps.includes(s.id)).map(standard => (
                  <div key={standard.id} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 pb-5 border-b border-slate-100 gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${APP_COLORS[standard.id] || APP_COLORS.default} text-white rounded-2xl flex items-center justify-center shadow-lg`}>
                          {getAppIcon(standard.icon, "w-6 h-6")}
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{standard.name}</h2>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingTest({ standardId: standard.id, isNew: true, data: { category: CategoryType.CHAMBER, duration: 1 } })} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors shadow-sm">+ 新增項目</button>
                        <button onClick={() => toggleAllInStandard(standard, true)} className="px-3 py-2 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-100 border border-slate-200">全選</button>
                        <button onClick={() => {
                          const defaults = getDefaultSelectedTests([standard]);
                          updateActiveModel({ selectedTests: defaults[standard.id] || {} });
                        }} className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-bold uppercase hover:bg-indigo-100 border border-indigo-200">預設</button>
                        <button onClick={() => toggleAllInStandard(standard, false)} className="px-3 py-2 bg-slate-50 text-rose-500 rounded-xl text-[10px] font-bold uppercase hover:bg-rose-50 border border-rose-100">清除</button>
                      </div>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      {Object.values(CategoryType).map(cat => {
                        const items = standard.categories[cat] || [];
                        if (items.length === 0) return null;
                        return (
                          <div key={cat} className="space-y-4">
                            <h4 className="text-lg font-bold text-slate-900 border-l-4 border-slate-300 pl-4 py-0.5 mb-2">{cat}</h4>
                            <div className="space-y-3">
                              {items.map(item => {
                                const isSelected = activeModel.selectedTests?.[item.id];
                                const isPkg = item.name.toLowerCase().includes('pkg');
                                return (
                                  <div key={item.id} className="relative group/card">
                                    <div
                                      onClick={() => toggleTest(standard.id, item.id)}
                                      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${isSelected ? 'bg-indigo-50/40 border-indigo-600 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                                    >
                                      <div className="flex-1 pr-14">
                                        <div className="flex items-center gap-2">
                                          <p className={`text-sm font-semibold transition-colors ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>{item.name}</p>
                                          {isPkg && <span className="text-[8px] bg-slate-800 text-white px-1.5 py-0.5 rounded font-black uppercase">PKG</span>}
                                          {item.outsourced && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-black">外測</span>}
                                        </div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                          {item.outsourced
                                            ? `不佔工期${item.quotes ? ' · ' + Object.entries(item.quotes).map(([v, p]) => `${v} NT$${p.toLocaleString()}`).join(' / ') : ''}`
                                            : `${item.duration} WD`}
                                        </p>
                                      </div>
                                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'border-slate-200'}`}>
                                        {isSelected && <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>}
                                      </div>
                                    </div>

                                    <div className="absolute top-1/2 -translate-y-1/2 right-12 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity z-10 scale-90">
                                      <button onClick={(e) => { e.stopPropagation(); setEditingTest({ standardId: standard.id, isNew: false, data: item }); }} className="p-2.5 bg-white rounded-xl shadow-lg border border-slate-100 text-slate-400 hover:text-indigo-600 hover:scale-110 transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2.5} /></svg></button>
                                      <button onClick={(e) => deleteTestItem(e, standard.id, cat, item.id)} className="p-2.5 bg-white rounded-xl shadow-lg border border-slate-100 text-slate-400 hover:text-rose-600 hover:scale-110 transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5} /></svg></button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Controls Side Panel */}
              <aside className="w-full xl:w-80 shrink-0 space-y-6">
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl space-y-8 sticky top-6 border border-slate-800 max-h-[calc(100vh-3rem)] overflow-y-auto">
                  <div className="text-center">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Strategy Settings</h3>
                    <div className="h-0.5 w-12 bg-indigo-500 mx-auto rounded-full"></div>
                  </div>

                  <div className="space-y-6">
                    {/* 型號名稱 */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">型號名稱</label>
                      <input
                        type="text"
                        value={activeModel.name}
                        onChange={(e) => updateActiveModel({ name: e.target.value })}
                        placeholder="例：NAT-G102-T"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    {/* Sample Requirements */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">樣品數量需求分配</label>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/10">
                          <span className="text-[10px] font-bold text-slate-400">Chamber 樣品數量</span>
                          <div className="flex items-center gap-3">
                            <button onClick={() => updateActiveModel({ envSampleCount: Math.max(1, activeModel.envSampleCount - 1) })} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">-</button>
                            <span className="w-4 text-center font-bold tabular-nums">{activeModel.envSampleCount}</span>
                            <button onClick={() => updateActiveModel({ envSampleCount: activeModel.envSampleCount + 1 })} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">+</button>
                          </div>
                        </div>

                        <div className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/10">
                          <span className="text-[10px] font-bold text-slate-400">S&V 樣品數量</span>
                          <div className="flex items-center gap-3">
                            <button onClick={() => updateActiveModel({ mechSampleCount: Math.max(0, activeModel.mechSampleCount - 1) })} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">-</button>
                            <span className="w-4 text-center font-bold tabular-nums">{activeModel.mechSampleCount}</span>
                            <button onClick={() => updateActiveModel({ mechSampleCount: activeModel.mechSampleCount + 1 })} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">+</button>
                          </div>
                        </div>
                        <div className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/10">
                          <span className="text-[10px] font-bold text-slate-400">[包裝/PKG] 樣品需求</span>
                          <div className="flex items-center gap-3">
                            <button onClick={() => updateActiveModel({ pkgSampleCount: Math.max(0, activeModel.pkgSampleCount - 1) })} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">-</button>
                            <span className="w-4 text-center font-bold tabular-nums">{activeModel.pkgSampleCount}</span>
                            <button onClick={() => updateActiveModel({ pkgSampleCount: activeModel.pkgSampleCount + 1 })} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">+</button>
                          </div>
                        </div>
                        {/* IP 樣品數量：僅並聯（獨立樣品）模式有作用，串聯時沿用 S&V 樣品 */}
                        <div className={`flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/10 ${activeModel.ipStrategy === ExecutionStrategy.PARALLEL ? '' : 'opacity-40'}`}>
                          <span className="text-[10px] font-bold text-slate-400">IP 樣品數量</span>
                          <div className="flex items-center gap-3">
                            <button
                              disabled={activeModel.ipStrategy !== ExecutionStrategy.PARALLEL}
                              onClick={() => updateActiveModel({ ipSampleCount: Math.max(1, (activeModel.ipSampleCount ?? 1) - 1) })}
                              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 disabled:hover:bg-white/5 disabled:cursor-not-allowed transition-all">-</button>
                            <span className="w-4 text-center font-bold tabular-nums">{activeModel.ipSampleCount ?? 1}</span>
                            <button
                              disabled={activeModel.ipStrategy !== ExecutionStrategy.PARALLEL}
                              onClick={() => updateActiveModel({ ipSampleCount: (activeModel.ipSampleCount ?? 1) + 1 })}
                              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 disabled:hover:bg-white/5 disabled:cursor-not-allowed transition-all">+</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Storage Strategy - ADDED BACK */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Storage 類別執行</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setStorageStrategy(ExecutionStrategy.SERIAL)}
                          className={`py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${storageStrategy === ExecutionStrategy.SERIAL ? 'bg-indigo-600 shadow-lg ring-1 ring-white/20' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                        >
                          串聯模式
                        </button>
                        <button
                          onClick={() => activeModel.envSampleCount >= 2 && setStorageStrategy(ExecutionStrategy.PARALLEL)}
                          disabled={activeModel.envSampleCount < 2}
                          className={`py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${storageStrategy === ExecutionStrategy.PARALLEL && activeModel.envSampleCount >= 2 ? 'bg-indigo-600 shadow-lg ring-1 ring-white/20' : activeModel.envSampleCount < 2 ? 'bg-white/5 text-slate-600 cursor-not-allowed opacity-50' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                        >
                          並行模式
                        </button>
                      </div>
                      {activeModel.envSampleCount < 2 && storageStrategy === ExecutionStrategy.PARALLEL && (
                        <p className="text-[9px] text-amber-400 mt-1">⚠ Chamber 樣品需 ≥ 2 才可啟用並聯</p>
                      )}
                    </div>

                    {/* S&V Strategy */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">S&V 執行策略</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updateActiveModel({ mechStrategy: ExecutionStrategy.SERIAL })}
                          className={`py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${activeModel.mechStrategy === ExecutionStrategy.SERIAL ? 'bg-indigo-600 shadow-lg ring-1 ring-white/20' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                        >
                          串聯模式
                        </button>
                        <button
                          onClick={() => updateActiveModel({ mechStrategy: ExecutionStrategy.PARALLEL })}
                          className={`py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${activeModel.mechStrategy === ExecutionStrategy.PARALLEL || !activeModel.mechStrategy ? 'bg-indigo-600 shadow-lg ring-1 ring-white/20' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                        >
                          並行模式
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-1">💡 因設備大小限制，大型樣品可能需選擇「串聯模式」接續執行</p>
                    </div>


                    {/* IP（防塵/防水/鹽霧）執行策略 */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IP 執行策略</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updateActiveModel({ ipStrategy: ExecutionStrategy.SERIAL })}
                          className={`py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${activeModel.ipStrategy !== ExecutionStrategy.PARALLEL ? 'bg-indigo-600 shadow-lg ring-1 ring-white/20 text-white' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                        >
                          串聯模式
                        </button>
                        <button
                          onClick={() => updateActiveModel({ ipStrategy: ExecutionStrategy.PARALLEL })}
                          className={`py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${activeModel.ipStrategy === ExecutionStrategy.PARALLEL ? 'bg-indigo-600 shadow-lg ring-1 ring-white/20 text-white' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                        >
                          並行模式
                        </button>
                      </div>
                      <p className="text-[8px] text-slate-500 text-center font-medium italic mt-1">
                        {activeModel.ipStrategy === ExecutionStrategy.PARALLEL
                          ? "💡 配置獨立樣品專職執行，各自前置 Basic Function"
                          : "💡 沿用 S&V 樣品，接在 S&V 測試之後執行"}
                      </p>
                    </div>

                    {/* PKG Strategy */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PKG 排程策略</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setPkgStrategy(PkgSampleStrategy.REUSE)}
                          className={`py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${pkgStrategy === PkgSampleStrategy.REUSE ? 'bg-indigo-600 shadow-lg ring-1 ring-white/20 text-white' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                        >
                          串聯模式
                        </button>
                        <button
                          onClick={() => setPkgStrategy(PkgSampleStrategy.INDEPENDENT)}
                          className={`py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${pkgStrategy === PkgSampleStrategy.INDEPENDENT ? 'bg-indigo-600 shadow-lg ring-1 ring-white/20 text-white' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                        >
                          並行模式
                        </button>
                      </div>
                      <p className="text-[8px] text-slate-500 text-center font-medium italic mt-1 leading-snug">
                        {pkgStrategy === PkgSampleStrategy.REUSE ? "💡 等候 Track A 結束後，再執行前置 14D 準備與測試" : "💡 與 Track A 齊頭進行前置 14D 等候期，最大化利用時間"}
                      </p>
                    </div>

                    {/* Master Strategy */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">主關鍵路徑策略</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setStrategy(ExecutionStrategy.SERIAL)} className={`py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${calculationResults.currentStrategy === ExecutionStrategy.SERIAL ? 'bg-indigo-600 shadow-lg ring-1 ring-white/20' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}>總程串聯</button>
                        <button disabled={calculationResults.totalUnits <= 1} onClick={() => setStrategy(ExecutionStrategy.PARALLEL)} className={`py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${calculationResults.currentStrategy === ExecutionStrategy.PARALLEL ? 'bg-indigo-600 shadow-lg ring-1 ring-white/20' : 'bg-white/5 text-slate-500 hover:bg-white/10'} disabled:opacity-20`}>總程並聯</button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5">
                    <div className="flex gap-2.5 text-indigo-400 bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10 shadow-inner">
                      <span className="text-sm">⚙️</span>
                      <p className="text-[9px] leading-relaxed font-medium">
                        系統邏輯：包材準備與 PKG 實體機台數量為完全脫鉤的「等候/並行」排程概念。PKG設定並不會再直接增加上方的「總機台數量」。
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </main>

      {/* 手機版浮動底部控制面板 - 僅在 xl 以下顯示 */}
      {mobileSettingsOpen && (
        <div className="fixed inset-0 bg-black/40 xl:hidden z-40" onClick={() => setMobileSettingsOpen(false)} />
      )}
      <div className={`fixed bottom-0 left-0 right-0 xl:hidden bg-slate-900 border-t border-slate-700 z-50 transition-all duration-300 ${mobileSettingsOpen ? 'rounded-t-3xl' : ''}`}>
        {/* 展開時的完整設定面板 */}
        {mobileSettingsOpen && (
          <div className="p-5 pt-2 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* 拖曳指示條 */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-slate-600 rounded-full"></div>
            </div>

            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">Strategy Settings</h3>

            {/* 型號名稱 */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">型號名稱</label>
              <input
                type="text"
                value={activeModel.name}
                onChange={(e) => updateActiveModel({ name: e.target.value })}
                placeholder="例：NAT-G102-T"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 樣品數量 - Track A / B 分開 */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">樣品數量需求</label>
              <div className="flex gap-2">
                <div className="flex-1 flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400">Track A</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateActiveModel({ envSampleCount: Math.max(1, activeModel.envSampleCount - 1) })} className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold active:bg-white/20">-</button>
                    <span className="w-5 text-center font-bold tabular-nums text-white">{activeModel.envSampleCount}</span>
                    <button onClick={() => updateActiveModel({ envSampleCount: activeModel.envSampleCount + 1 })} className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold active:bg-white/20">+</button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400">Track B</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateActiveModel({ mechSampleCount: Math.max(0, activeModel.mechSampleCount - 1) })} className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold active:bg-white/20">-</button>
                    <span className="w-5 text-center font-bold tabular-nums text-white">{activeModel.mechSampleCount}</span>
                    <button onClick={() => updateActiveModel({ mechSampleCount: activeModel.mechSampleCount + 1 })} className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold active:bg-white/20">+</button>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/10 mt-2">
                <span className="text-[10px] font-bold text-slate-400">[包裝/PKG] 樣品需求</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateActiveModel({ pkgSampleCount: Math.max(1, activeModel.pkgSampleCount - 1) })} className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold active:bg-white/20">-</button>
                  <span className="w-5 text-center font-bold tabular-nums text-white">{activeModel.pkgSampleCount}</span>
                  <button onClick={() => updateActiveModel({ pkgSampleCount: activeModel.pkgSampleCount + 1 })} className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold active:bg-white/20">+</button>
                </div>
              </div>
            </div>

            {/* Storage 策略 */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Storage 類別執行</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setStorageStrategy(ExecutionStrategy.SERIAL)} className={`py-3 rounded-xl text-[10px] font-bold transition-all ${storageStrategy === ExecutionStrategy.SERIAL ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-400'}`}>串聯模式</button>
                <button onClick={() => activeModel.envSampleCount >= 2 && setStorageStrategy(ExecutionStrategy.PARALLEL)} disabled={activeModel.envSampleCount < 2} className={`py-3 rounded-xl text-[10px] font-bold transition-all ${storageStrategy === ExecutionStrategy.PARALLEL && activeModel.envSampleCount >= 2 ? 'bg-indigo-600 text-white' : activeModel.envSampleCount < 2 ? 'bg-white/10 text-slate-600 cursor-not-allowed opacity-50' : 'bg-white/10 text-slate-400'}`}>並行模式</button>
              </div>
            </div>

            {/* S&V 策略 */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">S&V 執行策略</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => updateActiveModel({ mechStrategy: ExecutionStrategy.SERIAL })} className={`py-3 rounded-xl text-[10px] font-bold transition-all ${activeModel.mechStrategy === ExecutionStrategy.SERIAL ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-400'}`}>串聯模式</button>
                <button onClick={() => updateActiveModel({ mechStrategy: ExecutionStrategy.PARALLEL })} className={`py-3 rounded-xl text-[10px] font-bold transition-all ${activeModel.mechStrategy === ExecutionStrategy.PARALLEL || !activeModel.mechStrategy ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-400'}`}>並行模式</button>
              </div>
            </div>

            {/* PKG 策略 */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PKG 樣品策略</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPkgStrategy(PkgSampleStrategy.REUSE)} className={`py-3 rounded-xl text-[10px] font-bold transition-all ${pkgStrategy === PkgSampleStrategy.REUSE ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-400'}`}>延用樣品</button>
                <button onClick={() => setPkgStrategy(PkgSampleStrategy.INDEPENDENT)} className={`py-3 rounded-xl text-[10px] font-bold transition-all ${pkgStrategy === PkgSampleStrategy.INDEPENDENT ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-400'}`}>獨立樣品</button>
              </div>
              <p className="text-[9px] text-slate-500 text-center italic">{pkgStrategy === PkgSampleStrategy.REUSE ? '💡 延用樣品需增加 14 天前置整理時間' : '💡 獨立樣品不需整理時間，但需額外樣品'}</p>
            </div>

            {/* 主關鍵路徑策略 */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">主關鍵路徑策略</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setStrategy(ExecutionStrategy.SERIAL)} className={`py-3 rounded-xl text-[10px] font-bold transition-all ${calculationResults.currentStrategy === ExecutionStrategy.SERIAL ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-400'}`}>總程串聯</button>
                <button disabled={calculationResults.totalUnits <= 1} onClick={() => setStrategy(ExecutionStrategy.PARALLEL)} className={`py-3 rounded-xl text-[10px] font-bold transition-all ${calculationResults.currentStrategy === ExecutionStrategy.PARALLEL ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-400'} disabled:opacity-20`}>總程並聯</button>
              </div>
            </div>
          </div>
        )}

        {/* 底部常駐摘要列 - 點擊展開/收合 */}
        <div className="p-4" onClick={() => setMobileSettingsOpen(!mobileSettingsOpen)}>
          <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
            <div className="flex items-center gap-3 text-white">
              <span className="text-[10px] font-bold text-slate-400">A:</span>
              <span className="font-bold tabular-nums text-sm">{activeModel.envSampleCount}</span>
              <span className="text-slate-600">|</span>
              <span className="text-[10px] font-bold text-slate-400">B:</span>
              <span className="font-bold tabular-nums text-sm">{activeModel.mechSampleCount}</span>
              {pkgStrategy === PkgSampleStrategy.INDEPENDENT && (<>
                <span className="text-slate-600">|</span>
                <span className="text-[10px] font-bold text-slate-400">C:</span>
                <span className="font-bold tabular-nums text-sm">{activeModel.pkgSampleCount}</span>
              </>)}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold px-2 py-1 rounded-lg ${pkgStrategy === PkgSampleStrategy.REUSE ? 'bg-indigo-600/30 text-indigo-300' : 'bg-amber-600/30 text-amber-300'}`}>{pkgStrategy === PkgSampleStrategy.REUSE ? '延用' : '獨立'}</span>
              <span className={`text-[9px] font-bold px-2 py-1 rounded-lg ${calculationResults.currentStrategy === ExecutionStrategy.PARALLEL ? 'bg-emerald-600/30 text-emerald-300' : 'bg-slate-600/30 text-slate-300'}`}>{calculationResults.currentStrategy === ExecutionStrategy.PARALLEL ? '並聯' : '串聯'}</span>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${mobileSettingsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 15l7-7 7 7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Test Item Modal */}
      {
        editingTest && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <form onSubmit={saveTestItem} className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl border border-slate-100 space-y-8 animate-in fade-in zoom-in duration-200">
              <h3 className="text-2xl font-bold text-slate-900">測試項目編輯</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">項目名稱 (名稱含 "PKG" 可啟動特殊邏輯)</label>
                  <input required type="text" value={editingTest.data.name || ''} onChange={e => setEditingTest({ ...editingTest, data: { ...editingTest.data, name: e.target.value } })} className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none font-semibold text-slate-700 transition-all" />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                      工期 (WD)
                      {!editingTest.isNew && !isLabTA && (
                        <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} strokeLinecap="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      )}
                    </label>
                    <input
                      required type="number" step="0.5"
                      readOnly={!editingTest.isNew && !isLabTA}
                      value={editingTest.data.duration || ''}
                      onChange={e => setEditingTest({ ...editingTest, data: { ...editingTest.data, duration: parseFloat(e.target.value) } })}
                      className={`w-full rounded-xl px-4 py-3 border outline-none font-semibold transition-all ${!editingTest.isNew && !isLabTA
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-indigo-500 focus:bg-white'}`}
                    />
                    {!editingTest.isNew && !isLabTA && (
                      <p className="text-[9px] text-slate-400 ml-1">基準天數由 Lab TA team 維護佈達</p>
                    )}
                  </div>
                  <div className="flex-[2] space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">所屬類別</label>
                    <select value={editingTest.data.category} onChange={e => setEditingTest({ ...editingTest, data: { ...editingTest.data, category: e.target.value as CategoryType } })} className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none font-semibold text-slate-700 transition-all appearance-none cursor-pointer">
                      {Object.values(CategoryType).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setEditingTest(null)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">取消</button>
                <button type="submit" className="px-5 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-sm">儲存</button>
              </div>
            </form>
          </div>
        )
      }


      {/* Application Domain Modal */}
      {
        editingStandard && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <form onSubmit={saveStandard} className="bg-white rounded-[2.5rem] p-10 max-md w-full shadow-2xl border border-slate-100 space-y-8 animate-in fade-in zoom-in duration-200">
              <h3 className="text-2xl font-bold text-slate-900">應用領域設定</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">顯示名稱</label>
                  <input required type="text" value={editingStandard.data.name || ''} onChange={e => setEditingStandard({ ...editingStandard, data: { ...editingStandard.data, name: e.target.value } })} className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none font-semibold text-slate-700 transition-all" />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center block">Icon 樣式</label>
                  <div className="grid grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    {['factory', 'train', 'ship', 'bolt'].map(icon => (
                      <button key={icon} type="button" onClick={() => setEditingStandard({ ...editingStandard, data: { ...editingStandard.data, icon } })} className={`aspect-square rounded-xl flex items-center justify-center transition-all ${editingStandard.data.icon === icon ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-200' : 'bg-white text-slate-300 hover:text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
                        {getAppIcon(icon, "w-6 h-6")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setEditingStandard(null)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">取消</button>
                <button type="submit" className="px-5 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-sm">儲存</button>
              </div>
            </form>
          </div>
        )
      }

    </div >
  );
};

const getAppIcon = (iconName: string, className: string = "w-6 h-6") => {
  switch (iconName) {
    case 'factory': return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" strokeWidth={1.5} /></svg>;
    case 'train': return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 4h14a2 2 0 012 2v6H3V6a2 2 0 012-2zm0 14h14a2 2 0 012 2v2H3v-2a2 2 0 012-2zM3 12h18v4H3v-4z" strokeWidth={1.5} /></svg>;
    case 'ship': return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 19l9 2-9-18-9 18 9-2" strokeWidth={1.5} /></svg>;
    case 'bolt': return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth={1.5} /></svg>;
    default: return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth={2} /></svg>;
  }
};

export default App;

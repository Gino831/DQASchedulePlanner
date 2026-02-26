
import React, { useState, useMemo, useEffect } from 'react';
import {
  CategoryType,
  TestItem,
  StandardData,
  ExecutionStrategy,
  PkgSampleStrategy,
  ModelEntry,
  SingleSampleStrategy,
} from './types';
import { STANDARDS_DATA as INITIAL_DATA } from './constants';

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

const createDefaultModel = (standards: StandardData[], standardId: string = 'moxa', modelName: string = 'NAT-G102-T'): ModelEntry => {
  return {
    id: `m_${generateId()}`,
    name: modelName,
    standardId: standardId,
    selectedTests: getDefaultSelectedTests(standards)[standardId] || {},
    envSampleCount: 1,
    mechSampleCount: 1,
    pkgSampleCount: 1
  };
};

const APP_COLORS: Record<string, string> = {
  moxa: 'bg-indigo-600',
  railway: 'bg-amber-500',
  marine: 'bg-cyan-600',
  power: 'bg-emerald-600',
  default: 'bg-slate-500',
  pkg_prep: 'bg-slate-200',
  pkg_item: 'bg-slate-800'
};

// DUT 甘特圖 - 類別配色設定
const CATEGORY_COLORS: Record<string, { bg: string, text: string, label: string }> = {
  [CategoryType.FUNCTION]: { bg: 'bg-cyan-500', text: 'text-white', label: 'BF' },
  [CategoryType.CHAMBER]: { bg: 'bg-yellow-400', text: 'text-yellow-900', label: 'Chamber' },
  [CategoryType.VIB_SHOCK]: { bg: 'bg-orange-500', text: 'text-white', label: 'S&V' },
  [CategoryType.DUST_TEST]: { bg: 'bg-lime-500', text: 'text-lime-900', label: 'Dust' },
  [CategoryType.WATER_TEST]: { bg: 'bg-blue-400', text: 'text-white', label: 'Water' },
  [CategoryType.OTHER]: { bg: 'bg-purple-400', text: 'text-white', label: 'Other' },
  storage: { bg: 'bg-amber-500', text: 'text-white', label: 'Storage' },
  pkg: { bg: 'bg-slate-800', text: 'text-white', label: 'PKG' },
  prep: { bg: 'bg-slate-200', text: 'text-slate-500', label: '前置作業' },
};

// DUT Track 標籤配色
const TRACK_LABEL_COLORS: Record<string, string> = {
  A: 'bg-indigo-100 text-indigo-700',
  B: 'bg-orange-100 text-orange-700',
  C: 'bg-slate-200 text-slate-700',
};

const App: React.FC = () => {
  const [standards, setStandards] = useState<StandardData[]>(() => {
    const saved = localStorage.getItem('dqa_planner_v13');
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });

  const [models, setModels] = useState<ModelEntry[]>(() => {
    const saved = localStorage.getItem('dqa_planner_v14_models');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Failed to parse saved models", e);
      }
    }
    return [createDefaultModel(standards, 'moxa', 'Default Model')];
  });

  const [activeModelId, setActiveModelId] = useState<string>(models[0]?.id || '');
  const [sortBy, setSortBy] = useState<'model' | 'track'>('model');

  // Keep strategy global
  const [strategy, setStrategy] = useState<ExecutionStrategy>(ExecutionStrategy.PARALLEL);
  const [storageStrategy, setStorageStrategy] = useState<ExecutionStrategy>(ExecutionStrategy.PARALLEL);
  const [pkgStrategy, setPkgStrategy] = useState<PkgSampleStrategy>(PkgSampleStrategy.REUSE);
  const [singleSampleStrategy, setSingleSampleStrategy] = useState<SingleSampleStrategy>(SingleSampleStrategy.AUTO);

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
  const activeApps = [activeModel.standardId];

  const updateActiveModel = (updates: Partial<ModelEntry>) => {
    setModels(prev => prev.map(m => m.id === activeModelId ? { ...m, ...updates } : m));
  };


  useEffect(() => {
    localStorage.setItem('dqa_planner_v13', JSON.stringify(standards));
  }, [standards]);

  const toggleApp = (appId: string) => {
    updateActiveModel({ standardId: appId });
  };

  const toggleTest = (standardId: string, itemId: string) => {
    if (activeModel.standardId !== standardId) return;
    const currentSelection = activeModel.selectedTests || {};
    updateActiveModel({
      selectedTests: { ...currentSelection, [itemId]: !currentSelection[itemId] }
    });
  };

  const toggleAllInStandard = (standard: StandardData, select: boolean) => {
    if (activeModel.standardId !== standard.id) return;
    const standardSelection: Record<string, boolean> = {};
    Object.values(standard.categories).forEach(items => {
      items?.forEach(item => {
        standardSelection[item.id] = select;
      });
    });
    updateActiveModel({ selectedTests: standardSelection });
  };

  const deleteTestItem = (e: React.MouseEvent, standardId: string, category: CategoryType, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('確定要永久刪除此測試項目嗎？')) return;
    setStandards(prev => prev.map(s => {
      if (s.id !== standardId) return s;
      const updatedCats = { ...s.categories };
      if (updatedCats[category]) {
        updatedCats[category] = updatedCats[category]!.filter(i => i.id !== itemId);
      }
      return { ...s, categories: updatedCats };
    }));
    setModels(prev => prev.map(m => {
      if (m.standardId !== standardId) return m;
      const updatedTests = { ...m.selectedTests };
      delete updatedTests[itemId];
      return { ...m, selectedTests: updatedTests };
    }));
  };

  const saveStandard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStandard) return;
    const { isNew, data } = editingStandard;
    if (isNew) {
      const newId = `app_${Date.now()}`;
      setStandards([...standards, { id: newId, name: data.name || '新領域', description: '', icon: data.icon || 'bolt', categories: {} }]);
    } else {
      setStandards(standards.map(s => s.id === data.id ? { ...s, ...data } : s));
    }
    setEditingStandard(null);
  };

  const saveTestItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTest) return;
    const { standardId, isNew, data } = editingTest;
    setStandards(prev => prev.map(s => {
      if (s.id !== standardId) return s;
      const cat = (data.category as CategoryType) || CategoryType.CHAMBER;
      const currentItems = s.categories[cat] || [];
      const newCategories = { ...s.categories };
      if (isNew) {
        newCategories[cat] = [...currentItems, { id: `t_${Date.now()}`, name: data.name || '新測項', duration: data.duration || 1, category: cat }];
      } else {
        newCategories[cat] = currentItems.map(i => i.id === data.id ? { ...i, ...data } : i);
      }
      return { ...s, categories: newCategories };
    }));
    setEditingTest(null);
  };

  const calculationResults = useMemo(() => {
    let finalTotalDays = 0;
    let globalTrackATotal = 0;
    let globalTrackBTotal = 0;
    let globalTrackCTotal = 0;
    let globalTotalUnits = 0;

    type Seg = { label: string; days: number; bg: string; text: string };
    const allDutRows: Array<{
      id: string; label: string; track: 'A' | 'B' | 'C' | 'D'; trackLabel: string;
      startDay: number; segments: Seg[]; totalDays: number;
    }> = [];

    // 處理每個獨立的 model
    models.forEach((model, mIndex) => {
      const standard = standards.find(s => s.id === model.standardId);
      if (!standard) return;

      const selectedMap = model.selectedTests || {};

      const envBaseSegments: Seg[] = [];
      let envBaseDays = 0;

      const storageSegments: Seg[] = [];
      let totalStorageDays = 0;

      const altitudeSegments: Seg[] = [];
      let altitudeDays = 0;

      const connectorSegments: Seg[] = [];
      let connectorDays = 0;

      const ipOtherSegments: Seg[] = [];
      let ipOtherDays = 0;

      const mechSegments: Seg[] = [];
      let mechDays = 0;

      const pkgSegments: Seg[] = [];
      let pkgDays = 0;

      let bfDays = 0;

      Object.entries(standard.categories).forEach(([cat, items]) => {
        const catType = cat as CategoryType;
        (items as any[] | undefined)?.forEach(item => {
          if (selectedMap[item.id]) {
            const nameLower = item.name.toLowerCase();
            const isPkg = nameLower.includes('pkg');
            const isStorage = nameLower.includes('storage');
            const isAltitude = nameLower.includes('altitude') || item.name.includes('高空');
            const isBF = nameLower.includes('basic function') || item.name.includes('基本功能');
            const isConnector = (nameLower.includes('connector') || item.name.includes('插拔') || nameLower.includes('durability')) && !isAltitude && !isStorage && !isPkg && !isBF;
            
            // ipOther includes DUST, WATER, OTHER categories (except altitude and connector)
            const isIpOtherCategory = [CategoryType.DUST_TEST, CategoryType.WATER_TEST, CategoryType.OTHER].includes(catType);

            if (isBF) {
              bfDays += item.duration;
            } else if (isPkg) {
              pkgSegments.push({ label: CATEGORY_COLORS.pkg.label, days: item.duration, bg: CATEGORY_COLORS.pkg.bg, text: CATEGORY_COLORS.pkg.text });
              pkgDays += item.duration;
            } else if (isStorage) {
              storageSegments.push({ label: CATEGORY_COLORS.storage.label, days: item.duration, bg: CATEGORY_COLORS.storage.bg, text: CATEGORY_COLORS.storage.text });
              totalStorageDays += item.duration;
            } else if (isAltitude && !isIpOtherCategory) {
               altitudeSegments.push({ label: '✈️ (外測) ' + (CATEGORY_COLORS[catType]?.label || '高空'), days: item.duration, bg: 'bg-amber-100 border-amber-300', text: 'text-amber-800 font-bold' });
               altitudeDays += item.duration;
            } else if (isConnector) {
               connectorSegments.push({ label: CATEGORY_COLORS[catType]?.label || '插拔', days: item.duration, bg: CATEGORY_COLORS[catType]?.bg || 'bg-slate-100', text: CATEGORY_COLORS[catType]?.text || 'text-slate-600' });
               connectorDays += item.duration;
            } else if (isIpOtherCategory || isAltitude) {
               if (isAltitude) {
                 altitudeSegments.push({ label: '✈️ (外測) 高空', days: item.duration, bg: 'bg-amber-100 border-amber-300', text: 'text-amber-800 font-bold' });
                 altitudeDays += item.duration;
               } else {
                 ipOtherSegments.push({ label: CATEGORY_COLORS[catType]?.label || '其他', days: item.duration, bg: CATEGORY_COLORS[catType]?.bg || 'bg-slate-100', text: CATEGORY_COLORS[catType]?.text || 'text-slate-600' });
                 ipOtherDays += item.duration;
               }
            } else if ([CategoryType.CHAMBER, CategoryType.FUNCTION].includes(catType)) {
              envBaseSegments.push({ label: CATEGORY_COLORS[catType]?.label || '環境', days: item.duration, bg: CATEGORY_COLORS[catType]?.bg || 'bg-slate-100', text: CATEGORY_COLORS[catType]?.text || 'text-slate-600' });
              envBaseDays += item.duration;
            } else {
              mechSegments.push({ label: CATEGORY_COLORS[catType]?.label || '震動', days: item.duration, bg: CATEGORY_COLORS[catType]?.bg || 'bg-slate-100', text: CATEGORY_COLORS[catType]?.text || 'text-slate-600' });
              mechDays += item.duration;
            }
          }
        });
      });

      // --- 建立 DUT Rows ---
      
      const appendBF = () => bfDays > 0 ? [{ label: CATEGORY_COLORS[CategoryType.FUNCTION]?.label || 'Basic Func', days: bfDays, bg: CATEGORY_COLORS[CategoryType.FUNCTION]?.bg || 'bg-sky-100', text: CATEGORY_COLORS[CategoryType.FUNCTION]?.text || 'text-sky-600' }] : [];

      const modelDuts: Array<any> = [];
      let rowCounter = 1;
      const baseStartDay = strategy === ExecutionStrategy.SERIAL ? globalTrackATotal : 0; 

      const storageIsParallel = storageStrategy === ExecutionStrategy.PARALLEL && totalStorageDays > 0 && model.envSampleCount >= 2;
      const envDutCount = storageIsParallel ? (model.envSampleCount - 1) : model.envSampleCount;

      // 1. 產生 Track A (ENV Base + Storage if serial)
      const envRows: any[] = [];
      if (envDutCount > 0 && (envBaseSegments.length > 0 || bfDays > 0 || (storageSegments.length > 0 && !storageIsParallel))) {
        for (let i = 0; i < envDutCount; i++) {
          const segs = [...appendBF(), ...envBaseSegments];
          let days = bfDays + envBaseDays;
          
          if (!storageIsParallel && storageSegments.length > 0) {
            segs.push(...storageSegments);
            days += totalStorageDays;
          }

          const row = {
            id: `dut_env_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
            track: 'A', trackLabel: 'ENV', startDay: baseStartDay, segments: segs, totalDays: days,
          };
          envRows.push(row);
          modelDuts.push(row);
          rowCounter++;
        }
      }

      // 2. 獨立的 Storage 樣品 (Track A)
      if (storageIsParallel) {
        const segs = [...appendBF(), ...storageSegments];
        const sDays = bfDays + totalStorageDays;
        
        const row = {
          id: `dut_storage_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
          track: 'A', trackLabel: 'Storage', startDay: baseStartDay, segments: segs, totalDays: sDays,
        };
        modelDuts.push(row);
        envRows.push(row);
        rowCounter++;
      }

      // 3. 產生 Track B (Mech)
      const mechRows: any[] = [];
      const mechStart = baseStartDay;
      if (model.mechSampleCount > 0 && (mechSegments.length > 0 || bfDays > 0)) {
        for (let i = 0; i < model.mechSampleCount; i++) {
          const row = {
            id: `dut_mech_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
            track: 'B', trackLabel: 'S&V', startDay: mechStart, segments: [...appendBF(), ...mechSegments], totalDays: bfDays + mechDays,
          };
          mechRows.push(row);
          modelDuts.push(row);
          rowCounter++;
        }
      }

      // 4. 智慧負載平衡 (Smart Routing)
      
      // 高空 (Altitude) -> 找目前 ENV Rows 中最短的，接在後面
      if (altitudeSegments.length > 0) {
        if (envRows.length > 0) {
          envRows.sort((a, b) => a.totalDays - b.totalDays);
          const targetRow = envRows[0];
          targetRow.segments.push(...altitudeSegments);
          targetRow.totalDays += altitudeDays;
        } else {
          modelDuts.push({
            id: `dut_alt_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
            track: 'A', trackLabel: 'ENV (Alt)', startDay: baseStartDay, segments: [...appendBF(), ...altitudeSegments], totalDays: bfDays + altitudeDays,
          });
          rowCounter++;
        }
      }

      // Connector -> 找目前 ENV 或 MECH 中最短的，接在後面
      if (connectorSegments.length > 0) {
        const candidates = [...envRows, ...mechRows];
        if (candidates.length > 0) {
          candidates.sort((a, b) => a.totalDays - b.totalDays);
          const targetRow = candidates[0];
          targetRow.segments.push(...connectorSegments);
          targetRow.totalDays += connectorDays;
        } else {
          modelDuts.push({
            id: `dut_conn_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
            track: 'A', trackLabel: 'Connector', startDay: baseStartDay, segments: [...appendBF(), ...connectorSegments], totalDays: bfDays + connectorDays,
          });
          rowCounter++;
        }
      }

      // IP / Other -> 找目前 ENV 或 MECH 中最短的，或獨立
      if (ipOtherSegments.length > 0) {
        if (singleSampleStrategy === SingleSampleStrategy.INDEPENDENT) {
          modelDuts.push({
            id: `dut_ip_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
            track: 'D', trackLabel: 'IP/Misc', startDay: baseStartDay, segments: [...appendBF(), ...ipOtherSegments], totalDays: bfDays + ipOtherDays,
          });
          rowCounter++;
        } else {
          const candidates = [...envRows, ...mechRows];
          if (candidates.length > 0) {
            candidates.sort((a, b) => a.totalDays - b.totalDays);
            const targetRow = candidates[0];
            targetRow.segments.push(...ipOtherSegments);
            targetRow.totalDays += ipOtherDays;
          } else {
            modelDuts.push({
              id: `dut_ip_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
              track: 'A', trackLabel: 'IP/Misc', startDay: baseStartDay, segments: [...appendBF(), ...ipOtherSegments], totalDays: bfDays + ipOtherDays,
            });
            rowCounter++;
          }
        }
      }

      // 5. 產生 Track C (PKG)
      if (pkgSegments.length > 0) {
        if (pkgStrategy === PkgSampleStrategy.REUSE) {
          if (envRows.length > 0) {
             envRows.sort((a, b) => b.totalDays - a.totalDays);
             const targetRow = envRows[0];
             targetRow.segments.push({ label: CATEGORY_COLORS.prep.label, days: 14, bg: CATEGORY_COLORS.prep.bg, text: CATEGORY_COLORS.prep.text });
             targetRow.segments.push(...pkgSegments);
             targetRow.totalDays += 14 + pkgDays;
          } else {
             modelDuts.push({
               id: `dut_pkg_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
               track: 'C', trackLabel: 'PKG', startDay: baseStartDay, segments: [{ label: CATEGORY_COLORS.prep.label, days: 14, bg: CATEGORY_COLORS.prep.bg, text: CATEGORY_COLORS.prep.text }, ...pkgSegments], totalDays: 14 + pkgDays,
             });
             rowCounter++;
          }
        } else {
          for (let i = 0; i < model.pkgSampleCount; i++) {
            modelDuts.push({
              id: `dut_pkg_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
              track: 'C', trackLabel: 'PKG', startDay: baseStartDay, segments: [...pkgSegments], totalDays: pkgDays,
            });
            rowCounter++;
          }
        }
      }

      // --- 結算 Model 的時間與數量 ---
      let maxA = 0, maxB = 0, maxC = 0, maxD = 0;
      modelDuts.forEach(d => {
        if (d.track === 'A') maxA = Math.max(maxA, d.totalDays);
        if (d.track === 'B') maxB = Math.max(maxB, d.totalDays);
        if (d.track === 'C') maxC = Math.max(maxC, d.totalDays);
        if (d.track === 'D') maxD = Math.max(maxD, d.totalDays);
      });

      // Update global tracking
      if (strategy === ExecutionStrategy.SERIAL) {
        const shiftAmount = globalTrackATotal;
        modelDuts.forEach(d => d.startDay += shiftAmount);
        globalTrackATotal += Math.max(maxA, maxB, maxC, maxD);
      } else {
        globalTrackATotal = Math.max(globalTrackATotal, maxA);
        globalTrackBTotal = Math.max(globalTrackBTotal, maxB);
        globalTrackCTotal = Math.max(globalTrackCTotal, maxC);
        globalTrackATotal = Math.max(globalTrackATotal, maxD); // Independent IP tracked in A's timespan
      }

      const modelTotalUnits = model.envSampleCount + model.mechSampleCount + (pkgStrategy === PkgSampleStrategy.INDEPENDENT ? model.pkgSampleCount : 0) + (ipOtherSegments.length > 0 && singleSampleStrategy === SingleSampleStrategy.INDEPENDENT ? 1 : 0);
      globalTotalUnits += modelTotalUnits;

      allDutRows.push(...modelDuts);
    });

    if (strategy === ExecutionStrategy.SERIAL) {
      finalTotalDays = globalTrackATotal;
    } else {
      finalTotalDays = Math.max(globalTrackATotal, globalTrackBTotal, globalTrackCTotal);
    }

    if (sortBy === 'track') {
      allDutRows.sort((a, b) => {
        if (a.track !== b.track) return a.track.localeCompare(b.track);
        return a.label.localeCompare(b.label);
      });
    } else {
      allDutRows.sort((a, b) => {
        const modelA = a.id.split('_')[2];
        const modelB = b.id.split('_')[2];
        if (modelA !== modelB) return modelA.localeCompare(modelB);
        return String(a.track).localeCompare(String(b.track));
      });
    }

    return {
      totalDays: finalTotalDays,
      trackATotal: globalTrackATotal,
      trackBTotal: globalTrackBTotal,
      trackCTotal: globalTrackCTotal,
      hasTests: allDutRows.length > 0,
      totalUnits: globalTotalUnits,
      currentStrategy: strategy,
      dutRows: allDutRows,
    };
  }, [standards, models, strategy, storageStrategy, pkgStrategy, singleSampleStrategy, sortBy]);


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 font-sans">

      {/* Sidebar - Compact Selection */}
      <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto no-print md:sticky md:top-0 md:h-screen">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">DQA Planner</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Industrial Standards</p>
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
        <section className="bg-white border-b border-slate-200 p-6 lg:px-10 shrink-0 shadow-sm sticky top-0 z-30">
          {!calculationResults.hasTests ? (
            <div className="w-full text-center py-6 text-slate-300 font-medium italic">請選取測項開始評估</div>
          ) : (
            <div className="w-full flex flex-col xl:flex-row items-stretch gap-6 xl:gap-10">
              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-sm animate-pulse"></div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">DUT Assignment Gantt</h3>
                    <div className="flex ml-4 bg-slate-100 rounded-lg p-0.5">
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

                  </div>
                  <div className="flex gap-4 text-[9px] font-bold text-slate-400 uppercase">
                    <span>A: <span className="text-indigo-600 tabular-nums">{calculationResults.trackATotal}D</span></span>
                    {calculationResults.trackBTotal > 0 && <span>B: <span className="text-orange-600 tabular-nums">{calculationResults.trackBTotal}D</span></span>}
                    {calculationResults.trackCTotal > 0 && <span>C: <span className="text-slate-600 tabular-nums">{calculationResults.trackCTotal}D</span></span>}
                  </div>
                </div>

                {/* DUT 列 */}
                <div className="space-y-1.5 max-h-[40vh] xl:max-h-[50vh] overflow-y-auto pr-1 flex-1">
                  {calculationResults.dutRows.map(dut => (
                    <div key={dut.id} className="flex items-center gap-2">
                      <div className="w-auto min-w-[6rem] shrink-0 flex items-center gap-1.5">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${TRACK_LABEL_COLORS[dut.track]}`}>
                          {dut.trackLabel}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 tabular-nums whitespace-nowrap">{dut.label}</span>
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

                {/* 圖例 */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center pt-2 border-t border-slate-100">
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
              </div>
            </div>
          )}
        </section>

        {/* Workspace: Test Group Details */}
        <div className="flex-1 p-6 lg:p-10 pb-28 xl:pb-10">
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
                    const newModel = createDefaultModel(standards, 'moxa', `New Model ${models.length + 1}`);
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
                                        </div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{item.duration} WD</p>
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
                          <span className="text-[10px] font-bold text-slate-400">Track A 樣品數量</span>
                          <div className="flex items-center gap-3">
                            <button onClick={() => updateActiveModel({ envSampleCount: Math.max(1, activeModel.envSampleCount - 1) })} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">-</button>
                            <span className="w-4 text-center font-bold tabular-nums">{activeModel.envSampleCount}</span>
                            <button onClick={() => updateActiveModel({ envSampleCount: activeModel.envSampleCount + 1 })} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">+</button>
                          </div>
                        </div>

                        <div className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/10">
                          <span className="text-[10px] font-bold text-slate-400">Track B 樣品數量</span>
                          <div className="flex items-center gap-3">
                            <button onClick={() => updateActiveModel({ mechSampleCount: Math.max(0, activeModel.mechSampleCount - 1) })} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">-</button>
                            <span className="w-4 text-center font-bold tabular-nums">{activeModel.mechSampleCount}</span>
                            <button onClick={() => updateActiveModel({ mechSampleCount: activeModel.mechSampleCount + 1 })} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">+</button>
                          </div>
                        </div>
                        {pkgStrategy === PkgSampleStrategy.INDEPENDENT && (
                          <div className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/10">
                            <span className="text-[10px] font-bold text-slate-400">Track C 樣品數量</span>
                            <div className="flex items-center gap-3">
                              <button onClick={() => updateActiveModel({ pkgSampleCount: Math.max(1, activeModel.pkgSampleCount - 1) })} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">-</button>
                              <span className="w-4 text-center font-bold tabular-nums">{activeModel.pkgSampleCount}</span>
                              <button onClick={() => updateActiveModel({ pkgSampleCount: activeModel.pkgSampleCount + 1 })} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">+</button>
                            </div>
                          </div>
                        )}
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
                        <p className="text-[9px] text-amber-400 mt-1">⚠ Track A 樣品需 ≥ 2 才可啟用並聯</p>
                      )}
                    </div>


                    {/* Single Sample Strategy (Smart Routing) */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">高空/IP/鹽霧 執行策略</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setSingleSampleStrategy(SingleSampleStrategy.AUTO)}
                          className={`py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${singleSampleStrategy === SingleSampleStrategy.AUTO ? 'bg-indigo-600 shadow-lg ring-1 ring-white/20 text-white' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                        >
                          智慧平衡分流
                        </button>
                        <button
                          onClick={() => setSingleSampleStrategy(SingleSampleStrategy.INDEPENDENT)}
                          className={`py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${singleSampleStrategy === SingleSampleStrategy.INDEPENDENT ? 'bg-indigo-600 shadow-lg ring-1 ring-white/20 text-white' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                        >
                          消耗獨立樣品
                        </button>
                      </div>
                      <p className="text-[8px] text-slate-500 text-center font-medium italic mt-1">
                        {singleSampleStrategy === SingleSampleStrategy.AUTO ? "💡 自動搜尋最短工期的樣品接續" : "💡 配置一台獨立新機專職執行"}
                      </p>
                    </div>

                    {/* PKG Strategy */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PKG 樣品策略</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setPkgStrategy(PkgSampleStrategy.REUSE)}
                          className={`py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${pkgStrategy === PkgSampleStrategy.REUSE ? 'bg-indigo-600 shadow-lg ring-1 ring-white/20' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                        >
                          延用樣品
                        </button>
                        <button
                          onClick={() => setPkgStrategy(PkgSampleStrategy.INDEPENDENT)}
                          className={`py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${pkgStrategy === PkgSampleStrategy.INDEPENDENT ? 'bg-indigo-600 shadow-lg ring-1 ring-white/20' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                        >
                          獨立樣品
                        </button>
                      </div>
                      <p className="text-[8px] text-slate-500 text-center font-medium italic mt-1">
                        {pkgStrategy === PkgSampleStrategy.REUSE ? "💡 延用樣品需增加 14 天前置整理時間" : "💡 獨立樣品不需整理時間，但需額外樣品"}
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
                        系統邏輯：若選「延用樣品」，包裝測試將排在 Track A 環境測試之後（+14D）。若選「獨立樣品」，可同步於 Track C 執行。
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
              {pkgStrategy === PkgSampleStrategy.INDEPENDENT && (
                <div className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400">Track C</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateActiveModel({ pkgSampleCount: Math.max(1, activeModel.pkgSampleCount - 1) })} className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold active:bg-white/20">-</button>
                    <span className="w-5 text-center font-bold tabular-nums text-white">{activeModel.pkgSampleCount}</span>
                    <button onClick={() => updateActiveModel({ pkgSampleCount: activeModel.pkgSampleCount + 1 })} className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold active:bg-white/20">+</button>
                  </div>
                </div>
              )}
            </div>

            {/* Storage 策略 */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Storage 類別執行</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setStorageStrategy(ExecutionStrategy.SERIAL)} className={`py-3 rounded-xl text-[10px] font-bold transition-all ${storageStrategy === ExecutionStrategy.SERIAL ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-400'}`}>串聯模式</button>
                <button onClick={() => activeModel.envSampleCount >= 2 && setStorageStrategy(ExecutionStrategy.PARALLEL)} disabled={activeModel.envSampleCount < 2} className={`py-3 rounded-xl text-[10px] font-bold transition-all ${storageStrategy === ExecutionStrategy.PARALLEL && activeModel.envSampleCount >= 2 ? 'bg-indigo-600 text-white' : activeModel.envSampleCount < 2 ? 'bg-white/10 text-slate-600 cursor-not-allowed opacity-50' : 'bg-white/10 text-slate-400'}`}>並行模式</button>
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
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">工期 (WD)</label>
                    <input required type="number" step="0.5" value={editingTest.data.duration || ''} onChange={e => setEditingTest({ ...editingTest, data: { ...editingTest.data, duration: parseFloat(e.target.value) } })} className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none font-semibold text-slate-700 transition-all" />
                  </div>
                  <div className="flex-[2] space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">所屬類別</label>
                    <select value={editingTest.data.category} onChange={e => setEditingTest({ ...editingTest, data: { ...editingTest.data, category: e.target.value as CategoryType } })} className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none font-semibold text-slate-700 transition-all appearance-none cursor-pointer">
                      {Object.values(CategoryType).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingTest(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200">取消</button>
                <button type="submit" className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all">儲存測項</button>
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
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingStandard(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200">取消</button>
                <button type="submit" className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all">更新類別</button>
              </div>
            </form>
          </div>
        )
      }

    </div>
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


import React, { useState, useMemo, useEffect } from 'react';
import {
  CategoryType,
  TestItem,
  StandardData,
  ExecutionStrategy,
  PkgSampleStrategy,
  SelectedTests,
} from './types';
import { STANDARDS_DATA as INITIAL_DATA } from './constants';

// 根據應用程式設定預設勾選的測項
// Moxa: 按照使用者需求設定特定測項
// Railway, Marine, Power: 全選
const getDefaultSelectedTests = (standards: StandardData[]): SelectedTests => {
  const defaultSelected: SelectedTests = {};

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

const APP_COLORS: Record<string, string> = {
  moxa: 'bg-indigo-600',
  railway: 'bg-amber-500',
  marine: 'bg-cyan-600',
  power: 'bg-emerald-600',
  default: 'bg-slate-500',
  pkg_prep: 'bg-slate-200',
  pkg_item: 'bg-slate-800'
};

const App: React.FC = () => {
  const [standards, setStandards] = useState<StandardData[]>(() => {
    const saved = localStorage.getItem('dqa_planner_v13');
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });

  const [activeApps, setActiveApps] = useState<string[]>(['moxa']);
  const [selectedTests, setSelectedTests] = useState<SelectedTests>(() => getDefaultSelectedTests(standards));
  const [strategy, setStrategy] = useState<ExecutionStrategy>(ExecutionStrategy.PARALLEL);
  const [storageStrategy, setStorageStrategy] = useState<ExecutionStrategy>(ExecutionStrategy.PARALLEL);
  const [pkgStrategy, setPkgStrategy] = useState<PkgSampleStrategy>(PkgSampleStrategy.REUSE);

  const [envSampleCount, setEnvSampleCount] = useState<number>(1);
  const [mechSampleCount, setMechSampleCount] = useState<number>(1);
  const [pkgSampleCount, setPkgSampleCount] = useState<number>(1);

  const [editingStandard, setEditingStandard] = useState<{ isNew: boolean, data: Partial<StandardData> } | null>(null);
  const [editingTest, setEditingTest] = useState<{ standardId: string, isNew: boolean, data: Partial<TestItem> } | null>(null);

  useEffect(() => {
    localStorage.setItem('dqa_planner_v13', JSON.stringify(standards));
  }, [standards]);

  const toggleApp = (appId: string) => {
    setActiveApps(prev => prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]);
  };

  const toggleTest = (standardId: string, itemId: string) => {
    setSelectedTests(prev => {
      const standardSelection = prev[standardId] || {};
      return {
        ...prev,
        [standardId]: { ...standardSelection, [itemId]: !standardSelection[itemId] }
      };
    });
  };

  const toggleAllInStandard = (standard: StandardData, select: boolean) => {
    setSelectedTests(prev => {
      const standardSelection: Record<string, boolean> = {};
      Object.values(standard.categories).forEach(items => {
        items?.forEach(item => {
          standardSelection[item.id] = select;
        });
      });
      return { ...prev, [standard.id]: standardSelection };
    });
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
    setSelectedTests(prev => {
      const next = { ...prev };
      if (next[standardId]) {
        const updated = { ...next[standardId] };
        delete updated[itemId];
        next[standardId] = updated;
      }
      return next;
    });
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
    const envTracks = [CategoryType.CHAMBER, CategoryType.DUST_TEST, CategoryType.WATER_TEST, CategoryType.FUNCTION, CategoryType.OTHER];
    const trackABreakdown: { name: string, days: number, color: string, type: 'env' | 'prep' | 'pkg' }[] = [];
    const trackBBreakdown: { name: string, days: number, color: string }[] = [];
    const trackCBreakdown: { name: string, days: number, color: string }[] = [];

    let totalEnvDays = 0;
    let totalPkgDays = 0;
    let totalMechDays = 0;
    let anyPkgSelected = false;

    standards.forEach(standard => {
      if (!activeApps.includes(standard.id)) return;
      const selectedMap = selectedTests[standard.id] || {};

      let appEnvSum = 0;
      let appStorageDays: number[] = [];
      let appPkgSum = 0;
      let appMechSum = 0;

      Object.entries(standard.categories).forEach(([cat, items]) => {
        const catType = cat as CategoryType;
        (items as TestItem[] | undefined)?.forEach(item => {
          if (selectedMap[item.id]) {
            const isPkg = item.name.toLowerCase().includes('pkg');
            const isStorage = item.name.toLowerCase().includes('storage');

            if (isPkg) {
              appPkgSum += item.duration;
              anyPkgSelected = true;
            } else if (envTracks.includes(catType)) {
              if (isStorage) appStorageDays.push(item.duration);
              else appEnvSum += item.duration;
            } else {
              appMechSum += item.duration;
            }
          }
        });
      });

      let appEnvTotal = appEnvSum;
      if (appStorageDays.length > 0) {
        appEnvTotal += storageStrategy === ExecutionStrategy.PARALLEL ? Math.max(...appStorageDays) : appStorageDays.reduce((a, b) => a + b, 0);
      }

      if (appEnvTotal > 0) {
        totalEnvDays += appEnvTotal;
        trackABreakdown.push({ name: `${standard.name}`, days: appEnvTotal, color: APP_COLORS[standard.id] || APP_COLORS.default, type: 'env' });
      }
      if (appMechSum > 0) {
        totalMechDays += appMechSum;
        trackBBreakdown.push({ name: `${standard.name}`, days: appMechSum, color: APP_COLORS[standard.id] || APP_COLORS.default });
      }
      if (appPkgSum > 0) {
        totalPkgDays += appPkgSum;
        if (pkgStrategy === PkgSampleStrategy.INDEPENDENT) {
          trackCBreakdown.push({ name: `${standard.name} PKG`, days: appPkgSum, color: APP_COLORS.pkg_item });
        }
      }
    });

    let trackATotal = totalEnvDays;
    let trackCTotal = totalPkgDays;

    if (anyPkgSelected && pkgStrategy === PkgSampleStrategy.REUSE) {
      trackABreakdown.push({ name: '樣品整理', days: 7, color: APP_COLORS.pkg_prep, type: 'prep' });
      if (totalPkgDays > 0) {
        trackABreakdown.push({ name: 'PKG 測試', days: totalPkgDays, color: APP_COLORS.pkg_item, type: 'pkg' });
      }
      trackATotal = totalEnvDays + 7 + totalPkgDays;
      trackCTotal = 0;
    }

    const trackBTotal = totalMechDays;

    let finalTotalDays = 0;
    if (strategy === ExecutionStrategy.SERIAL) {
      finalTotalDays = trackATotal + trackBTotal + trackCTotal;
    } else {
      finalTotalDays = Math.max(trackATotal, trackBTotal, trackCTotal);
    }

    const totalUnitsNeeded = envSampleCount + mechSampleCount + (pkgStrategy === PkgSampleStrategy.INDEPENDENT ? pkgSampleCount : 0);

    return {
      totalDays: finalTotalDays,
      trackATotal,
      trackBTotal,
      trackCTotal,
      trackABreakdown,
      trackBBreakdown,
      trackCBreakdown,
      hasTests: (trackATotal + trackBTotal + trackCTotal > 0),
      totalUnits: totalUnitsNeeded,
      currentStrategy: (totalUnitsNeeded <= 1) ? ExecutionStrategy.SERIAL : strategy
    };
  }, [standards, selectedTests, strategy, storageStrategy, pkgStrategy, activeApps, envSampleCount, mechSampleCount, pkgSampleCount]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 font-sans">

      {/* Sidebar - Compact Selection */}
      <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto no-print">
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
      <main className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* Gantt / Summary Header */}
        <section className="bg-white border-b border-slate-200 p-6 lg:px-10 shrink-0 shadow-sm z-10">
          {!calculationResults.hasTests ? (
            <div className="w-full text-center py-6 text-slate-300 font-medium italic">請選取測項開始評估</div>
          ) : (
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-10">
              <div className="flex-1 w-full space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-sm animate-pulse"></div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Time Analysis Gantt</h3>
                </div>

                <div className="space-y-4">
                  {/* Track A */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase px-1">
                      <span>Track A: 環境 & {pkgStrategy === PkgSampleStrategy.REUSE ? '包裝延用' : '環境測項'}</span>
                      <span className="tabular-nums font-black text-indigo-600">{calculationResults.trackATotal} WD</span>
                    </div>
                    <div className="h-10 w-full bg-slate-50 rounded-xl flex overflow-hidden border border-slate-100">
                      {calculationResults.trackABreakdown.map((seg, i) => (
                        <div key={i} className={`${seg.color} h-full border-r border-white/20 last:border-0 flex items-center justify-center transition-all hover:brightness-95`} style={{ width: `${(seg.days / calculationResults.totalDays) * 100}%` }}>
                          <span className={`text-[10px] font-black truncate px-2 ${seg.type === 'prep' ? 'text-slate-500 italic font-medium' : 'text-white'}`}>
                            {seg.name} ({seg.days}D)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Track B */}
                  {calculationResults.trackBTotal > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase px-1">
                        <span>Track B: 機械力相關測試</span>
                        <span className="tabular-nums font-black text-slate-600">{calculationResults.trackBTotal} WD</span>
                      </div>
                      <div className="h-10 w-full bg-slate-50 rounded-xl relative overflow-hidden border border-slate-100">
                        <div className="absolute top-0 bottom-0 flex transition-all duration-700 ease-out" style={{
                          left: calculationResults.currentStrategy === ExecutionStrategy.SERIAL ? `${(calculationResults.trackATotal / calculationResults.totalDays) * 100}%` : '0',
                          width: `${(calculationResults.trackBTotal / calculationResults.totalDays) * 100}%`
                        }}>
                          {calculationResults.trackBBreakdown.map((seg, i) => (
                            <div key={i} className={`${seg.color} h-full border-r border-white/20 last:border-0 flex items-center justify-center hover:brightness-95`} style={{ width: `${(seg.days / calculationResults.trackBTotal) * 100}%` }}>
                              <span className="text-[10px] font-black text-white px-2 truncate">
                                {seg.name} ({seg.days}D)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Track C */}
                  {pkgStrategy === PkgSampleStrategy.INDEPENDENT && calculationResults.trackCTotal > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase px-1">
                        <span>Track C: 獨立包裝測試</span>
                        <span className="tabular-nums font-black text-slate-600">{calculationResults.trackCTotal} WD</span>
                      </div>
                      <div className="h-10 w-full bg-slate-50 rounded-xl relative overflow-hidden border border-slate-100">
                        <div className="absolute top-0 bottom-0 flex transition-all duration-700 ease-out" style={{
                          left: calculationResults.currentStrategy === ExecutionStrategy.SERIAL ? `${((calculationResults.trackATotal + calculationResults.trackBTotal) / calculationResults.totalDays) * 100}%` : '0',
                          width: `${(calculationResults.trackCTotal / calculationResults.totalDays) * 100}%`
                        }}>
                          {calculationResults.trackCBreakdown.map((seg, i) => (
                            <div key={i} className={`${seg.color} h-full border-r border-white/20 last:border-0 flex items-center justify-center hover:brightness-95`} style={{ width: `${(seg.days / calculationResults.trackCTotal) * 100}%` }}>
                              <span className="text-[10px] font-black text-white px-2 truncate">
                                {seg.name} ({seg.days}D)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Numerical Overview */}
              <div className="flex gap-10 shrink-0 border-l border-slate-100 pl-10 h-full items-center">
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">評估總工期</p>
                  <div className="flex items-baseline justify-end text-indigo-600">
                    <span className="text-5xl font-light tabular-nums leading-none tracking-tighter">{calculationResults.totalDays}</span>
                    <span className="text-xs font-bold ml-1 uppercase">WD</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">樣本需求組數</p>
                  <div className="flex items-baseline justify-end text-slate-900">
                    <span className="text-5xl font-light tabular-nums leading-none tracking-tighter">{calculationResults.totalUnits}</span>
                    <span className="text-xs font-bold ml-1 uppercase">Sets</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Workspace: Test Group Details */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-6xl mx-auto flex flex-col xl:flex-row gap-10">

            <div className="flex-1 space-y-10">
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
                        setSelectedTests(prev => ({ ...prev, [standard.id]: defaults[standard.id] || {} }));
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
                              const isSelected = selectedTests[standard.id]?.[item.id];
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

            {/* Controls Side Panel - Fixed Options */}
            <aside className="xl:w-80 shrink-0 space-y-6">
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl space-y-8 sticky top-6 border border-slate-800">
                <div className="text-center">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Strategy Settings</h3>
                  <div className="h-0.5 w-12 bg-indigo-500 mx-auto rounded-full"></div>
                </div>

                <div className="space-y-6">
                  {/* Sample Requirements */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">樣品組數需求分配</label>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/10">
                        <span className="text-[10px] font-bold text-slate-400">Track A 組數</span>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setEnvSampleCount(Math.max(1, envSampleCount - 1))} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">-</button>
                          <span className="w-4 text-center font-bold tabular-nums">{envSampleCount}</span>
                          <button onClick={() => setEnvSampleCount(envSampleCount + 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">+</button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/10">
                        <span className="text-[10px] font-bold text-slate-400">Track B 組數</span>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setMechSampleCount(Math.max(0, mechSampleCount - 1))} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">-</button>
                          <span className="w-4 text-center font-bold tabular-nums">{mechSampleCount}</span>
                          <button onClick={() => setMechSampleCount(mechSampleCount + 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">+</button>
                        </div>
                      </div>
                      {pkgStrategy === PkgSampleStrategy.INDEPENDENT && (
                        <div className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/10">
                          <span className="text-[10px] font-bold text-slate-400">Track C 組數</span>
                          <div className="flex items-center gap-3">
                            <button onClick={() => setPkgSampleCount(Math.max(1, pkgSampleCount - 1))} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">-</button>
                            <span className="w-4 text-center font-bold tabular-nums">{pkgSampleCount}</span>
                            <button onClick={() => setPkgSampleCount(pkgSampleCount + 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 transition-all">+</button>
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
                        onClick={() => setStorageStrategy(ExecutionStrategy.PARALLEL)}
                        className={`py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${storageStrategy === ExecutionStrategy.PARALLEL ? 'bg-indigo-600 shadow-lg ring-1 ring-white/20' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                      >
                        並行模式
                      </button>
                    </div>
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
                      {pkgStrategy === PkgSampleStrategy.REUSE ? "💡 延用樣品需增加 7 天前置整理時間" : "💡 獨立樣品不需整理時間，但需額外樣品"}
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
                      系統邏輯：若選「延用樣品」，包裝測試將排在 Track A 環境測試之後（+7D）。若選「獨立樣品」，可同步於 Track C 執行。
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Test Item Modal */}
      {editingTest && (
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
      )}

      {/* Application Domain Modal */}
      {editingStandard && (
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
      )}

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

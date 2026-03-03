import re

def refactor_app_tsx():
    with open('App.tsx', 'r', encoding='utf-8') as f:
        app_content = f.read()

    # Find boundaries for useMemo
    start_str = "  const calculationResults = useMemo(() => {"
    end_str = "}, [standards, models, strategy, storageStrategy, pkgStrategy, singleSampleStrategy, sortBy]);"
    
    start_idx = app_content.find(start_str)
    end_idx = app_content.find(end_str, start_idx)
    
    if start_idx == -1 or end_idx == -1:
        print("Could not find the bounds of useMemo block.")
        return
    
    end_idx += len("}, [standards, models, strategy, storageStrategy, pkgStrategy, singleSampleStrategy, sortBy]);")

    # The new useMemo block body
    new_usememo_body = """  const calculationResults = useMemo(() => {
    let finalTotalDays = 0;
    let globalTrackATotal = 0;
    let globalTrackBTotal = 0;
    let globalTrackCTotal = 0;
    let globalTotalUnits = 0;

    type Seg = { label: string; days: number; bg: string; text: string; isWait?: boolean };
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

      // NEW: Split BF days by category
      let envBfDays = 0;
      let mechBfDays = 0;
      let pkgBfDays = 0; 
      // Also track general BF for Track D (IP/Other if independent)
      let generalBfDays = 0;

      Object.entries(standard.categories).forEach(([cat, items]) => {
        const catType = cat as CategoryType;
        (items as any[] | undefined)?.forEach(item => {
          if (selectedMap[item.id]) {
            const nameLower = item.name.toLowerCase();
            const isPkg = nameLower.includes('pkg') || nameLower.includes('包裝');
            const isStorage = nameLower.includes('storage');
            const isAltitude = nameLower.includes('altitude') || item.name.includes('高空');
            const isBF = nameLower.includes('basic function') || item.name.includes('基本功能');
            const isConnector = (nameLower.includes('connector') || item.name.includes('插拔') || nameLower.includes('durability')) && !isAltitude && !isStorage && !isPkg && !isBF;
            
            // ipOther includes DUST, WATER, OTHER categories (except altitude and connector)
            const isIpOtherCategory = [CategoryType.DUST_TEST, CategoryType.WATER_TEST, CategoryType.OTHER].includes(catType);

            if (isPkg && isBF) {
              pkgBfDays += item.duration; // It's uniquely a PKG Basic Function
            } else if (isBF) {
              if (catType === CategoryType.VIB_SHOCK) {
                mechBfDays += item.duration; // Mechanical Basic Function
              } else if (catType === CategoryType.CHAMBER || catType === CategoryType.FUNCTION) {
                envBfDays += item.duration; // Chamber/Environmental Basic Function
              }
              // Track a max of any BF to be used as fallback for Track D if needed
              generalBfDays = Math.max(generalBfDays, item.duration);
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
            } else if ([CategoryType.CHAMBER].includes(catType)) {
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
      
      const appendEnvBF = () => envBfDays > 0 ? [{ label: CATEGORY_COLORS[CategoryType.FUNCTION]?.label || 'Basic Func', days: envBfDays, bg: CATEGORY_COLORS[CategoryType.FUNCTION]?.bg || 'bg-sky-100', text: CATEGORY_COLORS[CategoryType.FUNCTION]?.text || 'text-sky-600' }] : [];
      const appendMechBF = () => mechBfDays > 0 ? [{ label: CATEGORY_COLORS[CategoryType.FUNCTION]?.label || 'Basic Func', days: mechBfDays, bg: CATEGORY_COLORS[CategoryType.FUNCTION]?.bg || 'bg-sky-100', text: CATEGORY_COLORS[CategoryType.FUNCTION]?.text || 'text-sky-600' }] : [];
      const appendPkgBF = () => pkgBfDays > 0 ? [{ label: 'PKG Basic Func', days: pkgBfDays, bg: 'bg-sky-100', text: 'text-sky-600' }] : [];
      const appendGeneralBF = () => generalBfDays > 0 ? [{ label: CATEGORY_COLORS[CategoryType.FUNCTION]?.label || 'Basic Func', days: generalBfDays, bg: CATEGORY_COLORS[CategoryType.FUNCTION]?.bg || 'bg-sky-100', text: CATEGORY_COLORS[CategoryType.FUNCTION]?.text || 'text-sky-600' }] : [];


      const modelDuts: Array<any> = [];
      let rowCounter = 1;
      const baseStartDay = strategy === ExecutionStrategy.SERIAL ? globalTrackATotal : 0; 

      const storageIsParallel = storageStrategy === ExecutionStrategy.PARALLEL && totalStorageDays > 0 && model.envSampleCount >= 2;
      const envDutCount = storageIsParallel ? (model.envSampleCount - 1) : model.envSampleCount;

      // 1. 產生 Track A (ENV Base + Storage if serial)
      const envRows: any[] = [];
      if (envDutCount > 0 && (envBaseSegments.length > 0 || envBfDays > 0 || (storageSegments.length > 0 && !storageIsParallel))) {
        for (let i = 0; i < envDutCount; i++) {
          const segs = [...appendEnvBF(), ...envBaseSegments];
          let days = envBfDays + envBaseDays;
          
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
        const segs = [...appendEnvBF(), ...storageSegments];
        const sDays = envBfDays + totalStorageDays;
        
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
      if (model.mechSampleCount > 0 && (mechSegments.length > 0 || mechBfDays > 0)) {
        for (let i = 0; i < model.mechSampleCount; i++) {
          const row = {
            id: `dut_mech_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
            track: 'B', trackLabel: 'S&V', startDay: mechStart, segments: [...appendMechBF(), ...mechSegments], totalDays: mechBfDays + mechDays,
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
            track: 'A', trackLabel: 'ENV (Alt)', startDay: baseStartDay, segments: [...appendEnvBF(), ...altitudeSegments], totalDays: envBfDays + altitudeDays,
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
            track: 'A', trackLabel: 'Connector', startDay: baseStartDay, segments: [...appendEnvBF(), ...connectorSegments], totalDays: envBfDays + connectorDays,
          });
          rowCounter++;
        }
      }

      // IP / Other -> 找目前 ENV 或 MECH 中最短的，或獨立
      if (ipOtherSegments.length > 0) {
        if (singleSampleStrategy === SingleSampleStrategy.INDEPENDENT) {
          modelDuts.push({
            id: `dut_ip_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
            track: 'D', trackLabel: 'IP/Misc', startDay: baseStartDay, segments: [...appendGeneralBF(), ...ipOtherSegments], totalDays: generalBfDays + ipOtherDays,
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
              track: 'A', trackLabel: 'IP/Misc', startDay: baseStartDay, segments: [...appendEnvBF(), ...ipOtherSegments], totalDays: envBfDays + ipOtherDays,
            });
            rowCounter++;
          }
        }
      }

      // 5. 產生 Track C (PKG) - NEW LOGIC using PkgSampleStrategy logic reversed to 'Parallel' or 'Serial'
      if (pkgSegments.length > 0 || pkgBfDays > 0) {
        // pkgStrategy is now treated as ExecutionStrategy (Independent = PARALLEL, Reuse = SERIAL to match UI)
        const isPkgParallel = pkgStrategy === PkgSampleStrategy.INDEPENDENT; // We'll rename labels in UI, Independent maps to Parallel
        
        for (let i = 0; i < model.pkgSampleCount; i++) {
            // Find completion time of corresponding Track A sample for the drop test
            const sourceEnvRow = envRows[i % Math.max(1, envRows.length)];
            const envDuration = sourceEnvRow ? sourceEnvRow.totalDays : 0;
            
            const prepSegments: Seg[] = [{ label: CATEGORY_COLORS.prep.label, days: 14, bg: CATEGORY_COLORS.prep.bg, text: CATEGORY_COLORS.prep.text }];
            
            if (isPkgParallel) {
                // Parallel: Start Day 0: [Prep] + [PKG BF] + [Wait...] + [PKG Drop/Vib]
                const activePrepDays = 14 + pkgBfDays;
                let waitSegments: Seg[] = [];
                let waitDays = 0;
                
                if (envDuration > activePrepDays) {
                    waitDays = envDuration - activePrepDays;
                    waitSegments = [{ label: '等候環境完測', days: waitDays, bg: 'bg-transparent border-t border-b border-dashed border-slate-300', text: 'text-slate-400 italic', isWait: true }];
                }
                
                modelDuts.push({
                  id: `dut_pkg_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
                  track: 'C', trackLabel: 'PKG', startDay: baseStartDay, 
                  segments: [...prepSegments, ...appendPkgBF(), ...waitSegments, ...pkgSegments], 
                  totalDays: activePrepDays + waitDays + pkgDays,
                });
            } else {
                // Serial: Start after Env is totally done. Wait(Env) + [Prep] + [PKG BF] + [PKG]
                let waitSegments: Seg[] = [];
                if (envDuration > 0) {
                    waitSegments = [{ label: '等候環境完測', days: envDuration, bg: 'bg-transparent border-t border-b border-dashed border-slate-300', text: 'text-slate-400 italic', isWait: true }];
                }
                modelDuts.push({
                  id: `dut_pkg_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
                  track: 'C', trackLabel: 'PKG', startDay: baseStartDay, 
                  segments: [...waitSegments, ...prepSegments, ...appendPkgBF(), ...pkgSegments], 
                  totalDays: envDuration + 14 + pkgBfDays + pkgDays,
                });
            }
            rowCounter++;
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

      // NEW logic: Exclude PKG samples from total tracking (they are boxes/materials, do not consume physical machine unit counts)
      const modelTotalUnits = model.envSampleCount + model.mechSampleCount + (ipOtherSegments.length > 0 && singleSampleStrategy === SingleSampleStrategy.INDEPENDENT ? 1 : 0);
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
      totalUnits: globalTotalUnits, // Sum strictly counts physical items
      currentStrategy: strategy,
      dutRows: allDutRows,
    };
  }, [standards, models, strategy, storageStrategy, pkgStrategy, singleSampleStrategy, sortBy]);"""

    app_content = app_content[:start_idx] + new_usememo_body + app_content[end_idx:]

    # Edit the PKG labels in Desktop View
    pkg_str_block_desktop = """                    <div className="space-y-3">
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
                    </div>"""

    new_pkg_str_block_desktop = """                    <div className="space-y-3">
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
                    </div>"""

    app_content = app_content.replace(pkg_str_block_desktop, new_pkg_str_block_desktop)


    # Edit Mobile PKG Strategy UI
    pkg_str_block_mob = """        {/* PKG 策略 */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PKG 樣品策略</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setPkgStrategy(PkgSampleStrategy.REUSE)} className={`py-3 rounded-xl text-[10px] font-bold transition-all ${pkgStrategy === PkgSampleStrategy.REUSE ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-400'}`}>延用樣品</button>
            <button onClick={() => setPkgStrategy(PkgSampleStrategy.INDEPENDENT)} className={`py-3 rounded-xl text-[10px] font-bold transition-all ${pkgStrategy === PkgSampleStrategy.INDEPENDENT ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-400'}`}>獨立樣品</button>
          </div>
        </div>"""

    new_pkg_str_block_mob = """        {/* PKG 策略 */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PKG 排程策略</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setPkgStrategy(PkgSampleStrategy.REUSE)} className={`py-3 rounded-xl text-[10px] font-bold transition-all ${pkgStrategy === PkgSampleStrategy.REUSE ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-400'}`}>串聯模式</button>
            <button onClick={() => setPkgStrategy(PkgSampleStrategy.INDEPENDENT)} className={`py-3 rounded-xl text-[10px] font-bold transition-all ${pkgStrategy === PkgSampleStrategy.INDEPENDENT ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-400'}`}>並行模式</button>
          </div>
        </div>"""

    app_content = app_content.replace(pkg_str_block_mob, new_pkg_str_block_mob)

    # Edit the informative banner
    banner_old = "系統邏輯：若選「延用樣品」，包裝測試將排在 Track A 環境測試之後（+14D）。若選「獨立樣品」，可同步於 Track C 執行。"
    banner_new = "系統邏輯：包材準備與 PKG 實體機台數量為完全脫鉤的「等候/並行」排程概念。PKG設定並不會再直接增加上方的「總機台數量」。"
    app_content = app_content.replace(banner_old, banner_new)


    with open('App.tsx', 'w', encoding='utf-8') as f:
        f.write(app_content)

if __name__ == '__main__':
    refactor_app_tsx()

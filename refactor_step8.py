import re

def refactor_app_tsx():
    with open('types.ts', 'r', encoding='utf-8') as f:
        types_content = f.read()

    if 'SingleSampleStrategy' not in types_content:
        # Add the enum to types.ts
        enum_str = """
export enum SingleSampleStrategy {
  AUTO = 'AUTO', // 自動找最短路徑接續
  INDEPENDENT = 'INDEPENDENT' // 獨立樣品
}
"""
        types_content += enum_str
        with open('types.ts', 'w', encoding='utf-8') as f:
            f.write(types_content)

    with open('App.tsx', 'r', encoding='utf-8') as f:
        app_content = f.read()

    # 1. Add SingleSampleStrategy import
    if 'SingleSampleStrategy' not in app_content:
        app_content = app_content.replace(
            "import { CategoryType, ExecutionStrategy, PkgSampleStrategy",
            "import { CategoryType, ExecutionStrategy, PkgSampleStrategy, SingleSampleStrategy"
        )

    # 2. Add singleSampleStrategy state
    if 'const [singleSampleStrategy, setSingleSampleStrategy]' not in app_content:
        state_injection = """  const [pkgStrategy, setPkgStrategy] = useState<PkgSampleStrategy>(PkgSampleStrategy.REUSE);
  const [singleSampleStrategy, setSingleSampleStrategy] = useState<SingleSampleStrategy>(SingleSampleStrategy.AUTO);"""
        app_content = app_content.replace(
            "const [pkgStrategy, setPkgStrategy] = useState<PkgSampleStrategy>(PkgSampleStrategy.REUSE);",
            state_injection
        )

    # 3. Add singleSampleStrategy to the useMemo dependencies
    app_content = app_content.replace(
        "}, [standards, models, strategy, storageStrategy, pkgStrategy, sortBy]);",
        "}, [standards, models, strategy, storageStrategy, pkgStrategy, singleSampleStrategy, sortBy]);"
    )

    # 4. Find boundaries
    start_str = "  const calculationResults = useMemo(() => {"
    # We already injected singleSampleStrategy into the array, so we look for the updated one
    end_str = "}, [standards, models, strategy, storageStrategy, pkgStrategy, singleSampleStrategy, sortBy]);"
    
    start_idx = app_content.find(start_str)
    end_idx = app_content.find(end_str, start_idx)
    
    if start_idx == -1 or end_idx == -1:
        print("Could not find the bounds of useMemo block.")
        # If it was still the old string because of multiple script runs:
        end_idx = app_content.find("}, [standards, models, strategy, storageStrategy, pkgStrategy, sortBy]);", start_idx)
        if end_idx == -1:
            return
        end_str = "}, [standards, models, strategy, storageStrategy, pkgStrategy, sortBy]);"
    
    end_idx += len("}, [standards, models, strategy, storageStrategy, pkgStrategy, singleSampleStrategy, sortBy]);")

    # Create the new useMemo block body
    new_usememo_body = """  const calculationResults = useMemo(() => {
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

      const ipOtherSegments: Seg[] = [];
      let ipOtherDays = 0;

      const mechSegments: Seg[] = [];
      let mechDays = 0;

      const pkgSegments: Seg[] = [];
      let pkgDays = 0;

      Object.entries(standard.categories).forEach(([cat, items]) => {
        const catType = cat as CategoryType;
        (items as any[] | undefined)?.forEach(item => {
          if (selectedMap[item.id]) {
            const nameLower = item.name.toLowerCase();
            const isPkg = nameLower.includes('pkg');
            const isStorage = nameLower.includes('storage');
            const isAltitude = nameLower.includes('altitude') || item.name.includes('高空');
            
            // ipOther includes DUST, WATER, OTHER categories (except altitude)
            const isIpOtherCategory = [CategoryType.DUST_TEST, CategoryType.WATER_TEST, CategoryType.OTHER].includes(catType);

            if (isPkg) {
              pkgSegments.push({ label: CATEGORY_COLORS.pkg.label, days: item.duration, bg: CATEGORY_COLORS.pkg.bg, text: CATEGORY_COLORS.pkg.text });
              pkgDays += item.duration;
            } else if (isStorage) {
              storageSegments.push({ label: CATEGORY_COLORS.storage.label, days: item.duration, bg: CATEGORY_COLORS.storage.bg, text: CATEGORY_COLORS.storage.text });
              totalStorageDays += item.duration;
            } else if (isAltitude && !isIpOtherCategory) {
               altitudeSegments.push({ label: CATEGORY_COLORS[catType]?.label || '環境', days: item.duration, bg: CATEGORY_COLORS[catType]?.bg || 'bg-slate-100', text: CATEGORY_COLORS[catType]?.text || 'text-slate-600' });
               altitudeDays += item.duration;
            } else if (isIpOtherCategory || isAltitude) {
               if (isAltitude) {
                 altitudeSegments.push({ label: CATEGORY_COLORS[catType]?.label || '高空', days: item.duration, bg: CATEGORY_COLORS[catType]?.bg || 'bg-slate-100', text: CATEGORY_COLORS[catType]?.text || 'text-slate-600' });
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
      
      const modelDuts: Array<any> = [];
      let rowCounter = 1;
      const baseStartDay = strategy === ExecutionStrategy.SERIAL ? globalTrackATotal : 0; 

      const storageIsParallel = storageStrategy === ExecutionStrategy.PARALLEL && totalStorageDays > 0 && model.envSampleCount >= 2;
      const envDutCount = storageIsParallel ? (model.envSampleCount - 1) : model.envSampleCount;

      // 1. 產生 Track A (ENV Base + Storage if serial)
      const envRows: any[] = [];
      if (envDutCount > 0 && (envBaseSegments.length > 0 || (storageSegments.length > 0 && !storageIsParallel))) {
        for (let i = 0; i < envDutCount; i++) {
          const segs = [...envBaseSegments];
          let days = envBaseDays;
          
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
        const segs = [];
        const bfSeg = envBaseSegments.find(s => s.label === CATEGORY_COLORS[CategoryType.FUNCTION].label);
        let sDays = totalStorageDays;
        if (bfSeg) {
          segs.push(bfSeg);
          sDays += bfSeg.days;
        }
        segs.push(...storageSegments);
        
        const row = {
          id: `dut_storage_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
          track: 'A', trackLabel: 'Storage', startDay: baseStartDay, segments: segs, totalDays: sDays,
        };
        modelDuts.push(row);
        envRows.push(row); // Storage also acts as an ENV row target for load-balancing if needed
        rowCounter++;
      }

      // 3. 產生 Track B (Mech)
      const mechRows: any[] = [];
      const mechStart = baseStartDay;
      if (model.mechSampleCount > 0 && mechSegments.length > 0) {
        for (let i = 0; i < model.mechSampleCount; i++) {
          const row = {
            id: `dut_mech_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
            track: 'B', trackLabel: 'S&V', startDay: mechStart, segments: [...mechSegments], totalDays: mechDays,
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
            track: 'A', trackLabel: 'ENV (Alt)', startDay: baseStartDay, segments: [...altitudeSegments], totalDays: altitudeDays,
          });
          rowCounter++;
        }
      }

      // IP / Other -> 找目前 ENV 或 MECH 中最短的，或獨立
      if (ipOtherSegments.length > 0) {
        if (singleSampleStrategy === SingleSampleStrategy.INDEPENDENT) {
          modelDuts.push({
            id: `dut_ip_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
            track: 'D', trackLabel: 'IP/Misc', startDay: baseStartDay, segments: [...ipOtherSegments], totalDays: ipOtherDays,
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
              track: 'A', trackLabel: 'IP/Misc', startDay: baseStartDay, segments: [...ipOtherSegments], totalDays: ipOtherDays,
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
  }, [standards, models, strategy, storageStrategy, pkgStrategy, singleSampleStrategy, sortBy]);"""

    app_content = app_content[:start_idx] + new_usememo_body + app_content[end_idx:]

    ui_block = """
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
"""
    pkg_str = "{/* PKG Strategy */}"
    if pkg_str in app_content and ui_block not in app_content:
        app_content = app_content.replace(pkg_str, ui_block + "\n                    " + pkg_str)

    with open('App.tsx', 'w', encoding='utf-8') as f:
        f.write(app_content)

if __name__ == '__main__':
    refactor_app_tsx()

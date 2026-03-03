import re

def refactor_app_tsx():
    with open('App.tsx', 'r', encoding='utf-8') as f:
        app_content = f.read()

    # Find boundaries for useMemo as we did before
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
      let pkgBfDays = 0; // NEW: separate BF days specifically for PKG

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
      const appendPkgBF = () => pkgBfDays > 0 ? [{ label: 'PKG Basic Func', days: pkgBfDays, bg: 'bg-sky-100', text: 'text-sky-600' }] : [];

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
      if (pkgSegments.length > 0 || pkgBfDays > 0) { // Also proc if there's ONLY a PKG BF
        if (pkgStrategy === PkgSampleStrategy.REUSE) {
          if (envRows.length > 0) {
             envRows.sort((a, b) => b.totalDays - a.totalDays);
             const targetRow = envRows[0];
             targetRow.segments.push({ label: CATEGORY_COLORS.prep.label, days: 14, bg: CATEGORY_COLORS.prep.bg, text: CATEGORY_COLORS.prep.text });
             targetRow.segments.push(...appendPkgBF()); // Unique PKG basic function
             targetRow.segments.push(...pkgSegments);
             targetRow.totalDays += 14 + pkgBfDays + pkgDays;
          } else {
             modelDuts.push({
               id: `dut_pkg_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
               track: 'C', trackLabel: 'PKG', startDay: baseStartDay, segments: [{ label: CATEGORY_COLORS.prep.label, days: 14, bg: CATEGORY_COLORS.prep.bg, text: CATEGORY_COLORS.prep.text }, ...appendPkgBF(), ...pkgSegments], totalDays: 14 + pkgBfDays + pkgDays,
             });
             rowCounter++;
          }
        } else {
          for (let i = 0; i < model.pkgSampleCount; i++) {
            modelDuts.push({
              id: `dut_pkg_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
              track: 'C', trackLabel: 'PKG', startDay: baseStartDay, segments: [...appendPkgBF(), ...pkgSegments], totalDays: pkgBfDays + pkgDays,
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

      // NEW logic: Always add model.pkgSampleCount to totally Units because packing materials are physically needed
      // no matter if the device body is reused from track A or newly bought.
      const modelTotalUnits = model.envSampleCount + model.mechSampleCount + model.pkgSampleCount + (ipOtherSegments.length > 0 && singleSampleStrategy === SingleSampleStrategy.INDEPENDENT ? 1 : 0);
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

    # Step 2: Make Track C sample count visible unconditionally on DESKTOP
    old_desktop_pkg_cond = "{pkgStrategy === PkgSampleStrategy.INDEPENDENT && ("
    if old_desktop_pkg_cond in app_content:
        # We need to remove the condition and the closing bracket.
        desktop_section_start = app_content.find(old_desktop_pkg_cond)
        desktop_section_end = app_content.find(")}", desktop_section_start)
        if desktop_section_start != -1 and desktop_section_end != -1:
            # extract content inside
            inner_content = app_content[desktop_section_start + len(old_desktop_pkg_cond):desktop_section_end].strip()
            # replace "Track C 樣品數量" with "[包裝/PKG] 樣品需求"
            inner_content = inner_content.replace("Track C 樣品數量", "[包裝/PKG] 樣品需求")
            
            app_content = app_content[:desktop_section_start] + "                        " + inner_content + "\n" + app_content[desktop_section_end + 2:]


    # Step 3: Make Track C sample count visible unconditionally on MOBILE
    # Below Track B logic, there's another INDEPENDENT wrapper for mobile
    # We find the mobile layout part
    
    mobile_track_c_search = "{pkgStrategy === PkgSampleStrategy.INDEPENDENT && ("
    # Because we already replaced the desktop one, the next one is mobile
    if mobile_track_c_search in app_content:
        mobile_section_start = app_content.find(mobile_track_c_search)
        mobile_section_end = app_content.find(")}", mobile_section_start)
        if mobile_section_start != -1 and mobile_section_end != -1:
            inner_content = app_content[mobile_section_start + len(mobile_track_c_search):mobile_section_end].strip()
            inner_content = inner_content.replace("Track C", "[包裝/PKG]")
            
            app_content = app_content[:mobile_section_start] + "                " + inner_content + "\n" + app_content[mobile_section_end + 2:]

    with open('App.tsx', 'w', encoding='utf-8') as f:
        f.write(app_content)

if __name__ == '__main__':
    refactor_app_tsx()

import re

def main():
    with open('App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find useMemo start and end
    usememo_start_idx = content.find("  const calculationResults = useMemo(() => {")
    if usememo_start_idx == -1:
        print("Cannot find useMemo")
        return

    # Find the end of useMemo dependency array
    end_marker = "  }, [standards, selectedTests, strategy, storageStrategy, pkgStrategy, activeApps, envSampleCount, mechSampleCount, pkgSampleCount]);"
    
    # Check if end marker exists, if not maybe the deps were already modified?
    # Actually just search for "}, ["
    usememo_end_idx = content.find("  }, [", usememo_start_idx)
    usememo_end_idx = content.find(");", usememo_end_idx) + 2

    if usememo_end_idx < usememo_start_idx:
        print("Cannot find useMemo end")
        return

    new_usememo = """  const calculationResults = useMemo(() => {
    const envTracks = [CategoryType.CHAMBER, CategoryType.DUST_TEST, CategoryType.WATER_TEST, CategoryType.FUNCTION, CategoryType.OTHER];

    let finalTotalDays = 0;
    let globalTrackATotal = 0;
    let globalTrackBTotal = 0;
    let globalTrackCTotal = 0;
    let globalTotalUnits = 0;

    type Seg = { label: string; days: number; bg: string; text: string };
    const allDutRows: Array<{
      id: string; label: string; track: 'A' | 'B' | 'C'; trackLabel: string;
      startDay: number; segments: Seg[]; totalDays: number;
    }> = [];

    // 處理每個獨立的 model
    models.forEach((model, mIndex) => {
      const standard = standards.find(s => s.id === model.standardId);
      if (!standard) return;

      const selectedMap = model.selectedTests || {};
      
      let appEnvSum = 0;
      let appStorageDays: number[] = [];
      let appPkgSum = 0;
      let appMechSum = 0;
      const envCatDays: Record<string, number> = {};
      let mechBfDays = 0;
      let mechSvDays = 0;
      let anyPkgSelected = false;

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
              if (isStorage) {
                appStorageDays.push(item.duration);
              } else {
                appEnvSum += item.duration;
                envCatDays[catType] = (envCatDays[catType] || 0) + item.duration;
              }
            } else {
              appMechSum += item.duration;
              const isBF = item.name.toLowerCase().includes('basic function');
              if (isBF) mechBfDays += item.duration;
              else mechSvDays += item.duration;
            }
          }
        });
      });

      let totalStorageDays = 0;
      if (appStorageDays.length > 0) {
        totalStorageDays = storageStrategy === ExecutionStrategy.PARALLEL
          ? Math.max(...appStorageDays)
          : appStorageDays.reduce((a, b) => a + b, 0);
      }

      const totalEnvDays = storageStrategy === ExecutionStrategy.PARALLEL
        ? appEnvSum
        : appEnvSum + totalStorageDays;
      
      const totalPkgDays = appPkgSum;
      const totalMechDays = appMechSum;
      
      // 本型號的 Track A (ENV) 總時間計算
      let envDutDays = totalEnvDays;
      if (anyPkgSelected && pkgStrategy === PkgSampleStrategy.REUSE) {
        envDutDays = totalEnvDays + 14 + totalPkgDays;
      }

      const storageDutDays = totalStorageDays > 0 ? (envCatDays[CategoryType.FUNCTION] || 0) + totalStorageDays : 0;
      let trackATotal = (storageStrategy === ExecutionStrategy.PARALLEL && totalStorageDays > 0 && model.envSampleCount >= 2)
        ? Math.max(envDutDays, storageDutDays)
        : envDutDays;
        
      let trackCTotal = totalPkgDays;
      if (anyPkgSelected && pkgStrategy === PkgSampleStrategy.REUSE) {
        trackCTotal = 0;
      }
      
      const trackBTotal = totalMechDays;

      // 如果全實驗室策略為並聯，則時間取各型號的最大值；如果為串聯，則相加。
      // 計算每個型號自己的 Total Days (依據此型號所需的 A/B/C 三條線是否串並排而定)
      const modelTotalUnits = model.envSampleCount + model.mechSampleCount + (pkgStrategy === PkgSampleStrategy.INDEPENDENT ? model.pkgSampleCount : 0);
      const modelCurrentStrategy = (modelTotalUnits <= 1) ? ExecutionStrategy.SERIAL : strategy;
      
      let modelFinalDays = 0;
      if (modelCurrentStrategy === ExecutionStrategy.SERIAL) {
        modelFinalDays = trackATotal + trackBTotal + trackCTotal;
      } else {
        modelFinalDays = Math.max(trackATotal, trackBTotal, trackCTotal);
      }

      globalTrackATotal = strategy === ExecutionStrategy.PARALLEL ? Math.max(globalTrackATotal, trackATotal) : globalTrackATotal + trackATotal;
      globalTrackBTotal = strategy === ExecutionStrategy.PARALLEL ? Math.max(globalTrackBTotal, trackBTotal) : globalTrackBTotal + trackBTotal;
      globalTrackCTotal = strategy === ExecutionStrategy.PARALLEL ? Math.max(globalTrackCTotal, trackCTotal) : globalTrackCTotal + trackCTotal;
      globalTotalUnits += modelTotalUnits;

      // 產生 DUT 分配資料
      const envSegments: Seg[] = [];
      if (storageStrategy === ExecutionStrategy.SERIAL) {
        [CategoryType.FUNCTION, CategoryType.CHAMBER].forEach(cat => {
          if (envCatDays[cat] > 0) envSegments.push({ label: CATEGORY_COLORS[cat].label, days: envCatDays[cat], bg: CATEGORY_COLORS[cat].bg, text: CATEGORY_COLORS[cat].text });
        });
        if (totalStorageDays > 0) envSegments.push({ label: CATEGORY_COLORS.storage.label, days: totalStorageDays, bg: CATEGORY_COLORS.storage.bg, text: CATEGORY_COLORS.storage.text });
        [CategoryType.DUST_TEST, CategoryType.WATER_TEST, CategoryType.OTHER].forEach(cat => {
          if (envCatDays[cat] > 0) envSegments.push({ label: CATEGORY_COLORS[cat].label, days: envCatDays[cat], bg: CATEGORY_COLORS[cat].bg, text: CATEGORY_COLORS[cat].text });
        });
      } else {
        [CategoryType.FUNCTION, CategoryType.CHAMBER, CategoryType.DUST_TEST, CategoryType.WATER_TEST, CategoryType.OTHER].forEach(cat => {
          if (envCatDays[cat] > 0) envSegments.push({ label: CATEGORY_COLORS[cat].label, days: envCatDays[cat], bg: CATEGORY_COLORS[cat].bg, text: CATEGORY_COLORS[cat].text });
        });
      }

      const mechSegments: Seg[] = [];
      if (mechBfDays > 0) mechSegments.push({ label: CATEGORY_COLORS[CategoryType.FUNCTION].label, days: mechBfDays, bg: CATEGORY_COLORS[CategoryType.FUNCTION].bg, text: CATEGORY_COLORS[CategoryType.FUNCTION].text });
      if (mechSvDays > 0) mechSegments.push({ label: CATEGORY_COLORS[CategoryType.VIB_SHOCK].label, days: mechSvDays, bg: CATEGORY_COLORS[CategoryType.VIB_SHOCK].bg, text: CATEGORY_COLORS[CategoryType.VIB_SHOCK].text });

      const pkgSegments: Seg[] = [];
      if (totalPkgDays > 0) pkgSegments.push({ label: CATEGORY_COLORS.pkg.label, days: totalPkgDays, bg: CATEGORY_COLORS.pkg.bg, text: CATEGORY_COLORS.pkg.text });

      // Build out rows
      let rowCounter = 1;
      const baseStartDay = strategy === ExecutionStrategy.SERIAL ? (globalTrackATotal - trackATotal) : 0; 
      // Note: mapping serial behavior precisely requires more complex accumulator. We'll stick to model internal startDay logic as requested.
      
      const storageIsParallel = storageStrategy === ExecutionStrategy.PARALLEL && totalStorageDays > 0 && model.envSampleCount >= 2;
      const envDutCount = storageIsParallel ? (model.envSampleCount - 1) : model.envSampleCount;

      const hasEnvContent = envSegments.length > 0 || (anyPkgSelected && pkgStrategy === PkgSampleStrategy.REUSE && pkgSegments.length > 0);
      if (hasEnvContent) {
        for (let i = 0; i < envDutCount; i++) {
          const segs = [...envSegments];
          if (anyPkgSelected && pkgStrategy === PkgSampleStrategy.REUSE) {
            segs.push({ label: CATEGORY_COLORS.prep.label, days: 14, bg: CATEGORY_COLORS.prep.bg, text: CATEGORY_COLORS.prep.text });
            segs.push(...pkgSegments);
          }
          allDutRows.push({
            id: `dut_env_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
            track: 'A', trackLabel: 'ENV', startDay: baseStartDay, segments: segs, totalDays: envDutDays,
          });
          rowCounter++;
        }
      }

      if (storageIsParallel) {
        const storageSegs: Seg[] = [];
        const bfDays = envCatDays[CategoryType.FUNCTION] || 0;
        if (bfDays > 0) storageSegs.push({ label: CATEGORY_COLORS[CategoryType.FUNCTION].label, days: bfDays, bg: CATEGORY_COLORS[CategoryType.FUNCTION].bg, text: CATEGORY_COLORS[CategoryType.FUNCTION].text });
        storageSegs.push({ label: CATEGORY_COLORS.storage.label, days: totalStorageDays, bg: CATEGORY_COLORS.storage.bg, text: CATEGORY_COLORS.storage.text });
        allDutRows.push({
          id: `dut_storage_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
          track: 'A', trackLabel: 'Storage', startDay: baseStartDay, segments: storageSegs, totalDays: bfDays + totalStorageDays,
        });
        rowCounter++;
      }

      if (trackBTotal > 0 && model.mechSampleCount > 0) {
        const mechStart = baseStartDay + (modelCurrentStrategy === ExecutionStrategy.SERIAL ? trackATotal : 0);
        for (let i = 0; i < model.mechSampleCount; i++) {
          allDutRows.push({
            id: `dut_mech_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
            track: 'B', trackLabel: 'S&V', startDay: mechStart, segments: [...mechSegments], totalDays: trackBTotal,
          });
          rowCounter++;
        }
      }

      if (pkgStrategy === PkgSampleStrategy.INDEPENDENT && trackCTotal > 0 && model.pkgSampleCount > 0) {
        const pkgStart = baseStartDay + (modelCurrentStrategy === ExecutionStrategy.SERIAL ? (trackATotal + trackBTotal) : 0);
        for (let i = 0; i < model.pkgSampleCount; i++) {
          allDutRows.push({
            id: `dut_pkg_${model.id}_${rowCounter}`, label: `DUT ${String(rowCounter).padStart(2, '0')} - ${model.name}`,
            track: 'C', trackLabel: 'PKG', startDay: pkgStart, segments: [...pkgSegments], totalDays: trackCTotal,
          });
          rowCounter++;
        }
      }
    });

    if (strategy === ExecutionStrategy.SERIAL) {
      finalTotalDays = globalTrackATotal + globalTrackBTotal + globalTrackCTotal;
    } else {
      finalTotalDays = Math.max(globalTrackATotal, globalTrackBTotal, globalTrackCTotal);
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
  }, [standards, models, strategy, storageStrategy, pkgStrategy]);
"""
    content = content[:usememo_start_idx] + new_usememo + content[usememo_end_idx:]

    with open('App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()

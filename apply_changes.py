"""將 App.tsx 中的 useMemo 和甘特圖 JSX 替換為 DUT 分配版本"""
import re

with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# === 變更 1: 替換 useMemo (第 183-299 行區塊) ===
old_usememo_start = "  const calculationResults = useMemo(() => {\n    const envTracks = [CategoryType.CHAMBER, CategoryType.DUST_TEST, CategoryType.WATER_TEST, CategoryType.FUNCTION, CategoryType.OTHER];\n    const trackABreakdown"
old_usememo_end = "  }, [standards, selectedTests, strategy, storageStrategy, pkgStrategy, activeApps, envSampleCount, mechSampleCount, pkgSampleCount]);"

# 找到 useMemo 的起止位置
start_idx = content.find(old_usememo_start)
end_idx = content.find(old_usememo_end, start_idx) + len(old_usememo_end)

new_usememo = '''  const calculationResults = useMemo(() => {
    const envTracks = [CategoryType.CHAMBER, CategoryType.DUST_TEST, CategoryType.WATER_TEST, CategoryType.FUNCTION, CategoryType.OTHER];

    let totalEnvDays = 0;
    let totalPkgDays = 0;
    let totalMechDays = 0;
    let anyPkgSelected = false;

    // 類別天數累計（用於 DUT 甘特圖段落）
    const envCatDays: Record<string, number> = {};
    let totalStorageDays = 0;
    let mechBfDays = 0;
    let mechSvDays = 0;

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

      // Storage 策略處理
      let storageDaysForApp = 0;
      if (appStorageDays.length > 0) {
        storageDaysForApp = storageStrategy === ExecutionStrategy.PARALLEL
          ? Math.max(...appStorageDays)
          : appStorageDays.reduce((a, b) => a + b, 0);
        totalStorageDays += storageDaysForApp;
      }

      const appEnvTotal = appEnvSum + storageDaysForApp;
      if (appEnvTotal > 0) totalEnvDays += appEnvTotal;
      if (appMechSum > 0) totalMechDays += appMechSum;
      if (appPkgSum > 0) totalPkgDays += appPkgSum;
    });

    // --- Track 總工期計算 ---
    let trackATotal = totalEnvDays;
    let trackCTotal = totalPkgDays;

    if (anyPkgSelected && pkgStrategy === PkgSampleStrategy.REUSE) {
      trackATotal = totalEnvDays + 14 + totalPkgDays;
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
    const currentStrategy = (totalUnitsNeeded <= 1) ? ExecutionStrategy.SERIAL : strategy;

    // --- 產生 DUT 甘特圖段落 ---
    type Seg = { label: string; days: number; bg: string; text: string };

    // ENV 段落（依類別順序）
    const envSegments: Seg[] = [];
    const envCatOrder = [CategoryType.FUNCTION, CategoryType.CHAMBER, CategoryType.DUST_TEST, CategoryType.WATER_TEST, CategoryType.OTHER];
    envCatOrder.forEach(cat => {
      const days = envCatDays[cat];
      if (days && days > 0) {
        const c = CATEGORY_COLORS[cat];
        envSegments.push({ label: c.label, days, bg: c.bg, text: c.text });
      }
    });
    if (totalStorageDays > 0) {
      const c = CATEGORY_COLORS.storage;
      envSegments.push({ label: c.label, days: totalStorageDays, bg: c.bg, text: c.text });
    }

    // MECH 段落（BF → S&V）
    const mechSegments: Seg[] = [];
    if (mechBfDays > 0) {
      const c = CATEGORY_COLORS[CategoryType.FUNCTION];
      mechSegments.push({ label: c.label, days: mechBfDays, bg: c.bg, text: c.text });
    }
    if (mechSvDays > 0) {
      const c = CATEGORY_COLORS[CategoryType.VIB_SHOCK];
      mechSegments.push({ label: c.label, days: mechSvDays, bg: c.bg, text: c.text });
    }

    // PKG 段落
    const pkgSegments: Seg[] = [];
    if (totalPkgDays > 0) {
      const c = CATEGORY_COLORS.pkg;
      pkgSegments.push({ label: c.label, days: totalPkgDays, bg: c.bg, text: c.text });
    }

    // --- 產生 DUT 列資料 ---
    const dutRows: Array<{
      id: string; label: string; track: 'A' | 'B' | 'C'; trackLabel: string;
      startDay: number; segments: Seg[]; totalDays: number;
    }> = [];

    // ENV DUT
    const hasEnvContent = envSegments.length > 0 || (anyPkgSelected && pkgStrategy === PkgSampleStrategy.REUSE && pkgSegments.length > 0);
    if (hasEnvContent) {
      for (let i = 0; i < envSampleCount; i++) {
        const segs = [...envSegments];
        if (anyPkgSelected && pkgStrategy === PkgSampleStrategy.REUSE) {
          const prepC = CATEGORY_COLORS.prep;
          segs.push({ label: prepC.label, days: 14, bg: prepC.bg, text: prepC.text });
          segs.push(...pkgSegments);
        }
        dutRows.push({
          id: `dut_env_${i + 1}`, label: `DUT ${String(i + 1).padStart(2, '0')}`,
          track: 'A', trackLabel: 'ENV', startDay: 0, segments: segs, totalDays: trackATotal,
        });
      }
    }

    // MECH DUT
    if (trackBTotal > 0 && mechSampleCount > 0) {
      const mechStart = currentStrategy === ExecutionStrategy.SERIAL ? trackATotal : 0;
      for (let i = 0; i < mechSampleCount; i++) {
        dutRows.push({
          id: `dut_mech_${i + 1}`, label: `DUT ${String(envSampleCount + i + 1).padStart(2, '0')}`,
          track: 'B', trackLabel: 'S&V', startDay: mechStart, segments: [...mechSegments], totalDays: trackBTotal,
        });
      }
    }

    // PKG DUT（獨立樣品策略時）
    if (pkgStrategy === PkgSampleStrategy.INDEPENDENT && trackCTotal > 0) {
      const pkgStart = currentStrategy === ExecutionStrategy.SERIAL ? (trackATotal + trackBTotal) : 0;
      for (let i = 0; i < pkgSampleCount; i++) {
        dutRows.push({
          id: `dut_pkg_${i + 1}`, label: `DUT ${String(envSampleCount + mechSampleCount + i + 1).padStart(2, '0')}`,
          track: 'C', trackLabel: 'PKG', startDay: pkgStart, segments: [...pkgSegments], totalDays: trackCTotal,
        });
      }
    }

    return {
      totalDays: finalTotalDays,
      trackATotal, trackBTotal, trackCTotal,
      hasTests: (trackATotal + trackBTotal + trackCTotal > 0),
      totalUnits: totalUnitsNeeded,
      currentStrategy,
      dutRows,
    };
  }, [standards, selectedTests, strategy, storageStrategy, pkgStrategy, activeApps, envSampleCount, mechSampleCount, pkgSampleCount]);'''

if start_idx == -1:
    print("ERROR: Could not find useMemo start")
else:
    content = content[:start_idx] + new_usememo + content[end_idx:]
    print(f"useMemo replaced (was {end_idx - start_idx} chars, now {len(new_usememo)} chars)")

# === 變更 2: 替換 Gantt JSX ===
old_gantt_start = '              <div className="flex-1 w-full space-y-6">\n                <div className="flex items-center gap-3">\n                  <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-sm animate-pulse"></div>\n                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Time Analysis Gantt</h3>\n                </div>'
old_gantt_end = '                </div>\n              </div>'  # closing of space-y-4 and flex-1

gantt_start_idx = content.find(old_gantt_start)
if gantt_start_idx == -1:
    print("ERROR: Could not find Gantt start")
else:
    # Find the matching closing divs - need to find the correct end
    # After the header, there's <div className="space-y-4"> then Track A/B/C content
    # The end is two consecutive </div> - one for space-y-4, one for flex-1
    # Let me find "Track C" section ending
    track_c_end_marker = '                )}\n                </div>\n              </div>'
    gantt_end_idx = content.find(track_c_end_marker, gantt_start_idx)
    if gantt_end_idx == -1:
        print("ERROR: Could not find Gantt end")
    else:
        gantt_end_idx += len(track_c_end_marker)

        new_gantt = '''              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-sm animate-pulse"></div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">DUT Assignment Gantt</h3>
                  </div>
                  <div className="flex gap-4 text-[9px] font-bold text-slate-400 uppercase">
                    <span>A: <span className="text-indigo-600 tabular-nums">{calculationResults.trackATotal}D</span></span>
                    {calculationResults.trackBTotal > 0 && <span>B: <span className="text-orange-600 tabular-nums">{calculationResults.trackBTotal}D</span></span>}
                    {calculationResults.trackCTotal > 0 && <span>C: <span className="text-slate-600 tabular-nums">{calculationResults.trackCTotal}D</span></span>}
                  </div>
                </div>

                {/* DUT 列 */}
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {calculationResults.dutRows.map(dut => (
                    <div key={dut.id} className="flex items-center gap-2">
                      <div className="w-24 shrink-0 flex items-center gap-1.5">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${TRACK_LABEL_COLORS[dut.track]}`}>
                          {dut.trackLabel}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 tabular-nums">{dut.label}</span>
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
              </div>'''

        content = content[:gantt_start_idx] + new_gantt + content[gantt_end_idx:]
        print(f"Gantt replaced (was {gantt_end_idx - gantt_start_idx} chars, now {len(new_gantt)} chars)")

# === 變更 3: 更新 PKG 策略說明文字 (7→14 天) ===
content = content.replace('延用樣品需增加 7 天前置整理時間', '延用樣品需增加 14 天前置整理時間')
content = content.replace('（+7D）', '（+14D）')
print("PKG prep text updated (7->14)")

# === 變更 4: 更新甘特圖中 PKG 前置時間 (7→14) ===
content = content.replace("days: 7, color: APP_COLORS.pkg_prep", "days: 14, color: APP_COLORS.pkg_prep")
content = content.replace("totalEnvDays + 7 + totalPkgDays", "totalEnvDays + 14 + totalPkgDays")
print("PKG prep calculation updated (7->14)")

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("\\nDone! All changes applied to App.tsx")

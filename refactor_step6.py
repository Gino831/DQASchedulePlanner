import re

def refine_layout():
    with open('App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # --- 1. Fix Model Deletion (Event Bubbling) ---
    # The span inside the button has onClick={(e) => { e.stopPropagation(); ... }} but sometimes React Synthetic events need e.preventDefault() as well, or we change it to a distinct button element instead of nesting in a button.
    # We will change the wrapper to a `div` or ensure the `button` is actually a `div` if it contains another `button`.
    
    tab_replacement = """                  <div
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
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (window.confirm(`確定要刪除型號 ${model.name} 嗎？`)) {
                            const newModels = models.filter(m => m.id !== model.id);
                            setModels(newModels);
                            if (activeModelId === model.id) {
                              setActiveModelId(newModels[0].id);
                            }
                          }
                        }}
                        className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </div>"""
                  
    # Replace the old tab button with the new div-based tab to prevent button-in-button hydration/DOM issues
    old_tab_start = content.find("                  <button\n                    key={model.id}")
    if old_tab_start != -1:
        old_tab_end = content.find("                  </button>", old_tab_start) + len("                  </button>")
        content = content[:old_tab_start] + tab_replacement + content[old_tab_end:]

    # --- 2. Gantt Chart Layout Maximization ---
    # The requirement is: "上方的甘特圖Layout儘量拉長。右方的總天數及數量可調整成上下顯示。依照不同解析度時可以以甘特圖最大化為優化的Layout進行調整"
    
    # Target 1: The row wrapper for Gantt (max-w-7xl -> w-full max-w-none)
    content = content.replace(
        '<div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-10">',
        '<div className="w-full flex flex-col xl:flex-row items-stretch gap-6 xl:gap-10">'
    )

    # Target 2: The inner container for DUT rows, removing max-h limitation to let it expand or sizing it better.
    # Currently it is `<div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">`
    # We will change it to a flex-1 container that scrolls if needed, but since it's "一頁式顯示", maybe we just let it grow.
    content = content.replace(
        '<div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">',
        '<div className="space-y-1.5 max-h-[40vh] xl:max-h-[50vh] overflow-y-auto pr-1 flex-1">'
    )

    # Target 3: Numerical Overview arrangement (horizontal to vertical Stack)
    old_stats = """              {/* Numerical Overview */}
              <div className="flex gap-10 shrink-0 border-l border-slate-100 pl-10 h-full items-center">
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">評估總工期</p>
                  <div className="flex items-baseline justify-end text-indigo-600">
                    <span className="text-5xl font-light tabular-nums leading-none tracking-tighter">{calculationResults.totalDays}</span>
                    <span className="text-xs font-bold ml-1 uppercase">WD</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">樣品數量</p>
                  <div className="flex items-baseline justify-end text-slate-900">
                    <span className="text-5xl font-light tabular-nums leading-none tracking-tighter">{calculationResults.totalUnits}</span>
                    <span className="text-xs font-bold ml-1 uppercase">Sets</span>
                  </div>
                </div>
              </div>"""

    new_stats = """              {/* Numerical Overview */}
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
              </div>"""
    
    if old_stats in content:
        content = content.replace(old_stats, new_stats)

    # --- 3. Restructure Workspace Details (Tests under Model Tabs) ---
    # The user wants "型號後面的測試項目調整至型號下方。之後新增型號之後就不會一直往右下角。"

    # Right now, `flex-col xl:flex-row gap-10` splits the Test categories and the Strategy Settings.
    # The Model Tabs are above both of them.
    # Instead, we want:
    # <Workspace Container>
    #   <Model Tabs (full width)>
    #   <Grid layout: Left (Test Items for THIS standard/model), Right (Strategy Settings for THIS model)>

    # Find the top area of the Workspace:
    old_workspace_start = """        {/* Workspace: Test Group Details */}
        <div className="flex-1 p-6 lg:p-10 pb-28 xl:pb-10">
          <div className="max-w-6xl mx-auto flex flex-col xl:flex-row gap-10">

            <div className="flex-1 space-y-6">"""

    new_workspace_start = """        {/* Workspace: Test Group Details */}
        <div className="flex-1 p-6 lg:p-10 pb-28 xl:pb-10">
          <div className="w-full flex flex-col gap-6">

            <div className="w-full">"""
    
    content = content.replace(old_workspace_start, new_workspace_start)

    # We need to change the split after tabs. 
    # Current structure after tabs is:
    #             <div className="space-y-10">
    #               {standards.filter(s => activeApps.includes(s.id)).map(standard => ( ... ))}
    #             </div>
    #           </div> (this closes the flex-1 left column)
    #           <aside> (this is the right column strategy settings)

    # We want to change the wrapper AFTER tabs from `<div className="space-y-10">`
    # To `<div className="flex flex-col xl:flex-row gap-10 items-start">`
    # Then `div flex-1 space-y-10` for standards map
    # Then `aside xl:w-80 shrink-0` for Strategy settings
    
    old_tabs_end = """                </button>
              </div>
            </div>

            <div className="space-y-10">

              {standards.filter(s => activeApps.includes(s.id)).map(standard => ("""

    new_tabs_end = """                </button>
              </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-10 items-start w-full">
              <div className="flex-1 space-y-10 w-full">

                {standards.filter(s => activeApps.includes(s.id)).map(standard => ("""
    
    content = content.replace(old_tabs_end, new_tabs_end)

    # And we must safely close the flex-1 standard list, and move the aside *inside* the new flex row.
    # Currently it looks like:
    #               ))}
    #             </div>
    #             
    #             {/* Controls Side Panel ...
    
    old_aside_start = """              ))}
            </div>

            {/* Controls Side Panel - Hidden on mobile, shown on xl+ */}
            <aside className="hidden xl:block xl:w-80 shrink-0 space-y-6">"""
            
    new_aside_start = """              ))}
              </div>

              {/* Controls Side Panel */}
              <aside className="w-full xl:w-80 shrink-0 space-y-6">"""
              
    content = content.replace(old_aside_start, new_aside_start)

    # Because we removed the `<div className="max-w-6xl ... flex-row">` at the very top, we need to remove one closing div at the end of the `Workspace: Test Group Details`.
    # Let's check the bottom:
    #           </aside>
    #         </div>
    #       </div>
    #     </main >
    
    old_workspace_end = """            </aside>
          </div>
        </div>
      </main>"""
      
    # Actually `div` tags balance should remain the same if we replaced exactly one pair of `<div ...>` with another.
    # We replaced `<div className="max-w-6xl mx-auto flex flex-col xl:flex-row gap-10">` with `<div className="w-full flex flex-col gap-6">`, so no end tag changes needed.
    
    # 4. Remove 'hidden' on Strategy panel for mobile, just let it flow since it's now in a normal column structure
    content = content.replace('className="hidden xl:block xl:w-80 shrink-0 space-y-6"', 'className="w-full xl:w-80 shrink-0 space-y-6"')

    with open('App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    refine_layout()

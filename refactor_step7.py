import re

def repair_jsx():
    with open('App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # The issue is that the `main` tag and several `div` tags inside the Workspace area are not closed properly.
    # Let's extract the whole `return (` block and rebuild it from the known good pieces.

    # 1. We know getting the return block is tricky, let's just use string replacement on the exact sections that are mismatched.
    
    # We replaced `<div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-10">`
    # with `<div className="w-full flex flex-col xl:flex-row items-stretch gap-6 xl:gap-10">`
    # This was a 1:1 replacement, so no tag mismatch here.

    # We replaced `<div className="max-w-6xl mx-auto flex flex-col xl:flex-row gap-10">` (line 616 roughly)
    # with `<div className="w-full flex flex-col gap-6">\n            <div className="w-full">`
    # Ah! That added an EXTRA `<div className="w-full">` that wasn't closed!
    # Because `div className="w-full flex flex-col gap-6"` replaced `div className="..." flex-row`.
    # But we added `div className="w-full"` inside it, which wraps the tabs.

    # Let's look at where we replaced the tabs ending.
    # old_tabs_end = "...</button>\n              </div>\n            </div>\n\n            <div className=\"space-y-10\">\n\n              {standards.filter(..."
    # new_tabs_end = "...</button>\n              </div>\n            </div>\n\n            <div className=\"flex flex-col xl:flex-row gap-10 items-start w-full\">\n              <div className=\"flex-1 space-y-10 w-full\">\n\n                {standards.filter(..."
    #
    # Wait, the `</div>` after `</button>\n              </div>` was already there to close `<div className="flex-1 space-y-6">`.
    # In the original, it was:
    #             <div className="flex-1 space-y-6">
    #               {/* Model Tabs */}
    #               <div className="flex items-center ..."> ... </div>
    #             </div>
    #             <div className="space-y-10"> ... </div>
    #
    # We replaced `<div className="flex-1 space-y-6">`
    # with `<div className="w-full">` (by combining it with the wrapper replacement).
    #
    # Let's just fix the whole bottom section structure manually by finding the start of the Workspace segment and replacing until the end of Main.

    # Instead of fragile replaces, let's fix the specific unclosed tags based on the TSC error.
    # App.tsx(469,6): error TS17008: JSX element 'div' has no corresponding closing tag. (This is the root <div className="min-h-screen...">)
    # App.tsx(509,8): error TS17008: JSX element 'main' has no corresponding closing tag. (This is <main className="flex-1 flex flex-col min-w-0">)
    # App.tsx(616,10): error TS17008: JSX element 'div' has no corresponding closing tag. (This is <div className="flex-1 p-6 lg:p-10 pb-28 xl:pb-10">)
    # App.tsx(617,12): error TS17008: JSX element 'div' has no corresponding closing tag. (This is <div className="w-full flex flex-col gap-6">)
    # 
    # Why are they unclosed? Because at the bottom we have:
    #             </div>
    #           </div>
    #       </main>
    #
    # We are missing three `</div>`s before `</main>`!
    # Let's replace the end of that section:

    section_to_fix_start = "            </div>\n          </div>\n      </main>"
    section_to_fix_replacement = "              </div>\n            </div>\n          </div>\n        </div>\n      </main>"
    
    if section_to_fix_start in content:
        content = content.replace(section_to_fix_start, section_to_fix_replacement)
    elif "            </div>\n          </div>\n        </div>\n      </main>" in content:
         # maybe it has 3 now instead of 4
         content = content.replace(
             "            </div>\n          </div>\n        </div>\n      </main>",
             "              </div>\n            </div>\n          </div>\n        </div>\n      </main>"
         )
    
    # Let's just inject enough closing tags above `</main>` to satisfy TypeScript.
    # Actually, the best way is to use regex to find `</main>` and replace the immediately preceding `</div>`s.
    
    # Wait, the TSC error also mentions `App.tsx(970,17): error TS17002: Expected corresponding JSX closing tag for 'div'.`
    # This might be inside the mobile menu or somewhere else.
    # "App.tsx(1153,1): error TS1381: Unexpected token. Did you mean `{'}'}` or `&rbrace;`?"
    # Let's fix the very end of the file. It's totally garbled.

    # Here is what the end of the file SHOULD look like (after `      {/* Test Item Modal */}` and `      {/* Application Domain Modal */}`):

    good_end = """
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
"""

    start_idx = content.find("{/* Application Domain Modal */}")
    if start_idx != -1:
        content = content[:start_idx] + good_end

    # NOW, let's fix the missing `</div>` before `</main>` AND before `{/* 手機版浮動底部...`.
    # Let's count the `<div>` inside `main`.
    # <main> contains:
    #   <section>...</section>
    #   <div className="flex-1 p-6 lg:p-10 pb-28 xl:pb-10"> (1)
    #     <div className="w-full flex flex-col gap-6"> (2)
    #       <div className="w-full"> (3)
    #         ... tabs ...
    #       </div> (closes 3)
    #       <div className="flex flex-col xl:flex-row gap-10 items-start w-full"> (4)
    #         <div className="flex-1 space-y-10 w-full"> (5)
    #           ... standards map ...
    #         </div> (closes 5)
    #         <aside> ... </aside>
    #       </div> (closes 4)
    #     </div> (closes 2)
    #   </div> (closes 1)
    # </main>
    # So we need exactly that structure.
    
    # Let's find `<aside className="w-full xl:w-80 shrink-0 space-y-6">` and its closing `</aside>`.
    aside_start = content.find("<aside className=\"w-full xl:w-80 shrink-0 space-y-6\">")
    aside_end = content.find("</aside>", aside_start) + len("</aside>")
    
    # Replace everything from aside_end to the start of `</main>` with EXACTLY 3 `</div>` tags.
    main_end = content.find("</main>", aside_end)
    
    if aside_start != -1 and main_end != -1:
        content = content[:aside_end] + "\n            </div>\n          </div>\n        </div>\n      " + content[main_end:]

    with open('App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    repair_jsx()

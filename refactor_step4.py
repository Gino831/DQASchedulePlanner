import re

def update_app_tsx_ui():
    with open('App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the target location to insert the Model Tabs UI.
    # It should be placed right above the standard details header:
    # <div className="flex-1 space-y-10">
    #   {standards.filter(s => activeApps.includes(s.id)).map(standard => (

    target_anchor = '<div className="flex-1 space-y-10">'
    idx = content.find(target_anchor)
    if idx == -1:
        print("Could not find anchor for UI tabs.")
        return

    # Create the Model Tabs UI
    tabs_ui = """            <div className="flex-1 space-y-6">
              {/* Model Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
                {models.map(model => (
                  <button
                    key={model.id}
                    onClick={() => setActiveModelId(model.id)}
                    className={`px-4 py-2.5 rounded-t-xl font-bold text-sm whitespace-nowrap transition-all border border-b-0 flex items-center gap-2 ${activeModelId === model.id ? 'bg-white text-indigo-600 border-slate-200 shadow-sm relative z-10 -mb-[9px]' : 'bg-slate-50 border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                  >
                    <span>{model.name}</span>
                    {models.length > 1 && (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
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
                      </span>
                    )}
                  </button>
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

"""
    # Replace the anchor with tabs UI (Note that we effectively replacing the original div start and letting it nest properly or just sitting above it)
    # The original was:
    #             <div className="flex-1 space-y-10">
    #               {standards.filter...
    # We'll replace '<div className="flex-1 space-y-10">' with the tabs_ui and keep the space-y-10 container for standards underneath.
    
    # Let's cleanly inject it. We will wrap the original standards mapping in a div if needed, but flex-1 space-y-10 already works as the column layout.
    
    modified_tabs_ui = tabs_ui + '              <div className="space-y-10">\n'
    
    # We need to close the extra div we just opened after the standards map ends.
    # We will search for the end of the standards.map block.
    # {standards.filter(s => activeApps.includes(s.id)).map(standard => ( ... ))}
    # It ends before: {/* Controls Side Panel ...
    
    content = content[:idx] + modified_tabs_ui + content[idx + len(target_anchor):]
    
    # Find the controls side panel comment to insert the closing div
    side_panel_anchor = "{/* Controls Side Panel - Hidden on mobile, shown on xl+ */}"
    side_panel_idx = content.find(side_panel_anchor)
    
    if side_panel_idx != -1:
        # Step back to find the closing tag of the flex-1 space-y-10 div
        # We need to add one '</div>' right before the side panel.
        insertion = "              </div>\n            </div>\n\n            "
        # We need to be careful with exact indentation.
        content = content[:side_panel_idx-16] + insertion + content[side_panel_idx:]
    else:
        print("Warning: Could not close the div cleanly.")
        
    with open('App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    update_app_tsx_ui()

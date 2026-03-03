import re

def main():
    with open('App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add sortBy state
    if "const [sortBy, setSortBy]" not in content:
        # Find where to insert state: after activeModelId
        state_idx = content.find("const [activeModelId, setActiveModelId] = useState<string>(models[0]?.id || '');")
        if state_idx != -1:
            insertion_point = state_idx + len("const [activeModelId, setActiveModelId] = useState<string>(models[0]?.id || '');")
            content = content[:insertion_point] + "\n  const [sortBy, setSortBy] = useState<'model' | 'track'>('model');" + content[insertion_point:]

    # 2. Update useMemo to include sortBy and sort the dutRows
    usememo_deps_idx = content.find("}, [standards, models, strategy, storageStrategy, pkgStrategy])")
    if usememo_deps_idx != -1:
        # Change deps if sortBy not there
        if "sortBy" not in content[usememo_deps_idx - 20: usememo_deps_idx + 65]:
            content = content[:usememo_deps_idx] + "}, [standards, models, strategy, storageStrategy, pkgStrategy, sortBy]);" + content[usememo_deps_idx + 64:]

    # Add sorting logic before returning from useMemo
    sort_logic = """
    if (sortBy === 'track') {
      allDutRows.sort((a, b) => {
        if (a.track !== b.track) return a.track.localeCompare(b.track);
        return a.label.localeCompare(b.label);
      });
    } else {
      // Sort by model name then track
      // Extract model name from label if we didn't add modelId explicitely (we have it in map, but the rows are flattened)
      // Actually simpler: just use insertion order for model (original array is pushed by model loop)
      // but to be safe we sort by label if needed, or if we preserve insertion it's already sorted by model!
      // To strictly ensure:
      allDutRows.sort((a, b) => {
        const modelA = a.id.split('_')[2];
        const modelB = b.id.split('_')[2];
        if (modelA !== modelB) return modelA.localeCompare(modelB);
        return String(a.track).localeCompare(String(b.track));
      });
    }

    return {
"""
    if "if (sortBy === 'track')" not in content:
        content = content.replace("    return {\n      totalDays: finalTotalDays,", sort_logic + "      totalDays: finalTotalDays,")


    # 3. Update the Gantt header to be sticky and add sorting buttons
    gantt_section_target = '<section className="bg-white border-b border-slate-200 p-6 lg:px-10 shrink-0 shadow-sm z-10">'
    gantt_section_replacement = '<section className="bg-white border-b border-slate-200 p-6 lg:px-10 shrink-0 shadow-sm sticky top-0 z-30">'
    content = content.replace(gantt_section_target, gantt_section_replacement)

    header_target = '<h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">DUT Assignment Gantt</h3>'
    if header_target in content:
        header_replacement = header_target + """
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
"""
        content = content.replace(header_target, header_replacement)

    # 4. Inline Model Name Editing
    name_span_target = "<span>{model.name}</span>"
    if name_span_target in content:
        name_input_replacement = """{activeModelId === model.id ? (
                      <input 
                        type="text" 
                        value={model.name}
                        onChange={(e) => updateActiveModel({ name: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 -mx-1 font-bold text-sm text-indigo-700 w-32" 
                      />
                    ) : (
                      <span>{model.name}</span>
                    )}"""
        # because the string might appear in multiple places (not likely, but let's just replace the first one inside the tabs map)
        content = content.replace(name_span_target, name_input_replacement, 1)

    with open('App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()

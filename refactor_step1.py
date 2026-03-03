import re

def update_app_tsx():
    with open('App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update imports from types.ts
    content = content.replace(
        "  SelectedTests,",
        "  ModelEntry,"
    )

    # 2. Add an initial model generator and ID generator
    init_helper = """
const generateId = () => Math.random().toString(36).substring(2, 9);

const createDefaultModel = (standards: StandardData[], standardId: string = 'moxa'): ModelEntry => {
  return {
    id: `m_${generateId()}`,
    name: 'NAT-G102-T',
    standardId: standardId,
    selectedTests: getDefaultSelectedTests(standards)[standardId] || {},
    envSampleCount: 1,
    mechSampleCount: 1,
    pkgSampleCount: 1
  };
};
"""
    # Insert helper after APP_COLORS
    idx_app_colors = content.find("const APP_COLORS")
    if idx_app_colors != -1:
        content = content[:idx_app_colors] + init_helper + "\n" + content[idx_app_colors:]

    # 3. Replace state definitions
    old_state_start = "  const [activeApps, setActiveApps] = useState<string[]>(['moxa']);"
    old_state_end = "  const [mobileSettingsOpen, setMobileSettingsOpen] = useState<boolean>(false);"
    
    start_idx = content.find(old_state_start)
    end_idx = content.find(old_state_end, start_idx) + len(old_state_end)

    new_state = """  const [models, setModels] = useState<ModelEntry[]>(() => {
    const saved = localStorage.getItem('dqa_planner_v13_models');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
         console.error("Failed to parse saved models", e);
      }
    }
    // Fallback or initialization
    return [createDefaultModel(standards, 'moxa')];
  });
  
  const [activeModelId, setActiveModelId] = useState<string>(models[0]?.id || '');

  // Keep strategy global
  const [strategy, setStrategy] = useState<ExecutionStrategy>(ExecutionStrategy.PARALLEL);
  const [storageStrategy, setStorageStrategy] = useState<ExecutionStrategy>(ExecutionStrategy.PARALLEL);
  const [pkgStrategy, setPkgStrategy] = useState<PkgSampleStrategy>(PkgSampleStrategy.REUSE);

  const [editingStandard, setEditingStandard] = useState<{ isNew: boolean, data: Partial<StandardData> } | null>(null);
  const [editingTest, setEditingTest] = useState<{ standardId: string, isNew: boolean, data: Partial<TestItem> } | null>(null);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState<boolean>(false);

  // Sync activeModelId if models array is empty (should not happen)
  useEffect(() => {
    if (!models.find(m => m.id === activeModelId) && models.length > 0) {
      setActiveModelId(models[0].id);
    }
  }, [models, activeModelId]);

  useEffect(() => {
    localStorage.setItem('dqa_planner_v13_models', JSON.stringify(models));
  }, [models]);
  
  const activeModel = models.find(m => m.id === activeModelId) || models[0];
  const activeApps = [activeModel.standardId];
"""
    content = content[:start_idx] + new_state + content[end_idx:]

    # 4. Modify Handlers (toggleTest, toggleAllInStandard)
    # Re-write toggleApp, toggleTest, toggleAllInStandard
    
    old_toggle_start = "  const toggleApp = (appId: string) => {"
    old_toggle_end = "      return { ...prev, [standard.id]: standardSelection };\n    });\n  };"
    
    t_start = content.find(old_toggle_start)
    t_end = content.find(old_toggle_end, t_start) + len(old_toggle_end)

    new_toggles = """  const updateActiveModel = (updates: Partial<ModelEntry>) => {
    setModels(prev => prev.map(m => m.id === activeModelId ? { ...m, ...updates } : m));
  };

  const toggleTest = (standardId: string, itemId: string) => {
    if (activeModel.standardId !== standardId) return;
    const currentSelection = activeModel.selectedTests;
    updateActiveModel({ 
      selectedTests: { ...currentSelection, [itemId]: !currentSelection[itemId] } 
    });
  };

  const toggleAllInStandard = (standard: StandardData, select: boolean) => {
    if (activeModel.standardId !== standard.id) return;
    const standardSelection: Record<string, boolean> = {};
    Object.values(standard.categories).forEach(items => {
      items?.forEach(item => {
        standardSelection[item.id] = select;
      });
    });
    updateActiveModel({ selectedTests: standardSelection });
  };
"""
    content = content[:t_start] + new_toggles + content[t_end:]

    # Remove `deleteTestItem` update to `setSelectedTests`
    content = content.replace(
"""    setSelectedTests(prev => {
      const next = { ...prev };
      if (next[standardId]) {
        const updated = { ...next[standardId] };
        delete updated[itemId];
        next[standardId] = updated;
      }
      return next;
    });""",
"""    // Clean up test from models
    setModels(prev => prev.map(m => {
      if (m.standardId !== standardId) return m;
      const updatedTests = { ...m.selectedTests };
      delete updatedTests[itemId];
      return { ...m, selectedTests: updatedTests };
    }));"""
    )

    with open('App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
        
if __name__ == '__main__':
    update_app_tsx()

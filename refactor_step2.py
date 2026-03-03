import re

def main():
    with open('App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update imports
    content = content.replace("  SelectedTests,\n", "  ModelEntry,\n")

    # 2. Add generator helpers
    init_helper = """
const generateId = () => Math.random().toString(36).substring(2, 9);

const createDefaultModel = (standards: StandardData[], standardId: string = 'moxa', modelName: string = 'NAT-G102-T'): ModelEntry => {
  return {
    id: `m_${generateId()}`,
    name: modelName,
    standardId: standardId,
    selectedTests: getDefaultSelectedTests(standards)[standardId] || {},
    envSampleCount: 1,
    mechSampleCount: 1,
    pkgSampleCount: 1
  };
};
"""
    idx_app_colors = content.find("const APP_COLORS")
    if init_helper not in content:
        content = content[:idx_app_colors] + init_helper + "\n" + content[idx_app_colors:]

    # 3. Replace state definitions
    # Replace from activeApps down to mobileSettingsOpen
    old_state_start = "  const [activeApps, setActiveApps] = useState<string[]>(['moxa']);"
    old_state_end = "  const [mobileSettingsOpen, setMobileSettingsOpen] = useState<boolean>(false);"
    
    start_idx = content.find(old_state_start)
    end_idx = content.find(old_state_end, start_idx) + len(old_state_end)

    new_state = """  const [models, setModels] = useState<ModelEntry[]>(() => {
    const saved = localStorage.getItem('dqa_planner_v14_models');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
         console.error("Failed to parse saved models", e);
      }
    }
    return [createDefaultModel(standards, 'moxa', 'Default Model')];
  });
  
  const [activeModelId, setActiveModelId] = useState<string>(models[0]?.id || '');

  // Keep strategy global
  const [strategy, setStrategy] = useState<ExecutionStrategy>(ExecutionStrategy.PARALLEL);
  const [storageStrategy, setStorageStrategy] = useState<ExecutionStrategy>(ExecutionStrategy.PARALLEL);
  const [pkgStrategy, setPkgStrategy] = useState<PkgSampleStrategy>(PkgSampleStrategy.REUSE);

  const [editingStandard, setEditingStandard] = useState<{ isNew: boolean, data: Partial<StandardData> } | null>(null);
  const [editingTest, setEditingTest] = useState<{ standardId: string, isNew: boolean, data: Partial<TestItem> } | null>(null);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState<boolean>(false);

  // Sync activeModelId
  useEffect(() => {
    if (!models.find(m => m.id === activeModelId) && models.length > 0) {
      setActiveModelId(models[0].id);
    }
  }, [models, activeModelId]);

  useEffect(() => {
    localStorage.setItem('dqa_planner_v14_models', JSON.stringify(models));
  }, [models]);
  
  const activeModel = models.find(m => m.id === activeModelId) || models[0];
  const activeApps = [activeModel.standardId];

  const updateActiveModel = (updates: Partial<ModelEntry>) => {
    setModels(prev => prev.map(m => m.id === activeModelId ? { ...m, ...updates } : m));
  };
"""
    content = content[:start_idx] + new_state + content[end_idx:]

    # 4. Modify Handlers
    old_toggle_start = "  const toggleApp = (appId: string) => {"
    old_toggle_end = "      return { ...prev, [standard.id]: standardSelection };\n    });\n  };"
    
    t_start = content.find(old_toggle_start)
    t_end = content.find(old_toggle_end, t_start) + len(old_toggle_end)

    new_toggles = """  const toggleApp = (appId: string) => {
    updateActiveModel({ standardId: appId });
  };

  const toggleTest = (standardId: string, itemId: string) => {
    if (activeModel.standardId !== standardId) return;
    const currentSelection = activeModel.selectedTests || {};
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
  };"""
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
"""    setModels(prev => prev.map(m => {
      if (m.standardId !== standardId) return m;
      const updatedTests = { ...m.selectedTests };
      delete updatedTests[itemId];
      return { ...m, selectedTests: updatedTests };
    }));"""
    )
    
    # Update setEnvSampleCount calls...
    content = content.replace("setEnvSampleCount(Math.max(1, envSampleCount - 1))", "updateActiveModel({envSampleCount: Math.max(1, activeModel.envSampleCount - 1)})")
    content = content.replace("setEnvSampleCount(envSampleCount + 1)", "updateActiveModel({envSampleCount: activeModel.envSampleCount + 1})")
    content = content.replace("setMechSampleCount(Math.max(0, mechSampleCount - 1))", "updateActiveModel({mechSampleCount: Math.max(0, activeModel.mechSampleCount - 1)})")
    content = content.replace("setMechSampleCount(mechSampleCount + 1)", "updateActiveModel({mechSampleCount: activeModel.mechSampleCount + 1})")
    content = content.replace("setPkgSampleCount(Math.max(1, pkgSampleCount - 1))", "updateActiveModel({pkgSampleCount: Math.max(1, activeModel.pkgSampleCount - 1)})")
    content = content.replace("setPkgSampleCount(pkgSampleCount + 1)", "updateActiveModel({pkgSampleCount: activeModel.pkgSampleCount + 1})")
    
    # Replace variable references in JSX for strategy settings panel
    content = content.replace("envSampleCount}", "activeModel.envSampleCount}")
    content = content.replace("mechSampleCount}", "activeModel.mechSampleCount}")
    content = content.replace("pkgSampleCount}", "activeModel.pkgSampleCount}")

    # Replace modelName references
    content = content.replace("value={modelName}", "value={activeModel.name}")
    content = content.replace("setModelName(e.target.value)", "updateActiveModel({name: e.target.value})")

    # Disable storage config checks dynamically for UI display.
    # We will use total units for lab strategy. Need a sum of active logic.
    content = content.replace("envSampleCount >=", "activeModel.envSampleCount >=")
    content = content.replace("envSampleCount < 2", "activeModel.envSampleCount < 2")

    with open('App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()

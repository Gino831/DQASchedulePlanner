
export enum CategoryType {
  CHAMBER = 'Chamber 應用',
  VIB_SHOCK = '振動衝擊應用',
  DUST_TEST = '防塵測試',
  WATER_TEST = '防水測試',
  FUNCTION = '功能測試',
  OTHER = '其他測試'
}

export interface TestItem {
  id: string;
  name: string;
  duration: number; // in days
  category: CategoryType;
}

export interface StandardData {
  id: string;
  name: string;
  description: string;
  icon: string;
  categories: {
    [key in CategoryType]?: TestItem[];
  };
}

export enum ExecutionStrategy {
  SERIAL = 'SERIAL', // 樣品沿用 (接續測試)
  PARALLEL = 'PARALLEL' // 樣品平行 (增加樣品)
}

export enum PkgSampleStrategy {
  REUSE = 'REUSE', // 延用 Track A 樣品 (需 +14 天整理)
  INDEPENDENT = 'INDEPENDENT' // 獨立樣品 (不需 +7 天，但增加樣品數量)
}

export interface ModelEntry {
  id: string; // Type ID (e.g. m_01)
  name: string; // User defined model name (e.g. NAT-G102-T)
  standardId: string; // Associated app ID (e.g. moxa, railway)
  selectedTests: Record<string, boolean>; // Selected test items for this specific model
  envSampleCount: number;
  mechSampleCount: number;
  pkgSampleCount: number;
}

export enum SingleSampleStrategy {
  AUTO = 'AUTO', // 自動找最短路徑接續
  INDEPENDENT = 'INDEPENDENT' // 獨立樣品
}

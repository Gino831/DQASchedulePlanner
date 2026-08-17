
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
  duration: number; // 工作天 (WD)；外測項目為 0，不佔用自有工期
  category: CategoryType;
  outsourced?: boolean; // 外測：不佔用自有設備工期，僅計費用
  quotes?: Record<string, number>; // 各實驗室報價 (NT$)，如 { SGS: 26400, DEKRA: 35000 }
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
  REUSE = 'REUSE', // 延用 Chamber 樣品 (需 +14 天整理)
  INDEPENDENT = 'INDEPENDENT' // 獨立樣品 (不需 +7 天，但增加樣品數量)
}

export interface ModelEntry {
  id: string; // Type ID (e.g. m_01)
  name: string; // User defined model name (e.g. NAT-G102-T)
  standardIds: string[]; // 關聯的應用領域 ID 清單 (可多選，如 moxa + railway)
  selectedTests: Record<string, boolean>; // Selected test items for this specific model
  envSampleCount: number;
  mechSampleCount: number;
  pkgSampleCount: number;
  ipSampleCount: number; // IP/防塵防水/鹽霧 樣品數量（僅並聯模式有作用）
  // 臨時改走外測的測項：時程吃緊時可把自測項目切為外測，即時看到工期與費用變化。
  // 與 TestItem.outsourced（Lab TA 佈達的本質屬性）分開存放，不影響基準資料。
  outsourcedOverrides?: Record<string, boolean>;
  mechStrategy?: ExecutionStrategy; // S&V 執行策略
  // S&V 振動台一次可同時安裝的樣品數。並聯時決定要跑幾輪：
  // 輪數 = ceil(該法規樣品數 / 可安裝數)。串聯時固定一台一輪，此值不生效。
  mechFixtureCapacity?: number;
  ipStrategy?: ExecutionStrategy; // IP 執行策略：並聯=獨立樣品(前置 BF)、串聯=接在 S&V 之後
}

export enum SingleSampleStrategy {
  AUTO = 'AUTO', // 自動找最短路徑接續
  INDEPENDENT = 'INDEPENDENT' // 獨立樣品
}

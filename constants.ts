
import { CategoryType, StandardData } from './types';

// 定義每個應用都必須包含的基礎測項
export const DEFAULT_MANDATORY_TESTS = {
  [CategoryType.FUNCTION]: [
    { id: 'default_bf_env', name: 'Basic Function (Env)', duration: 2, category: CategoryType.FUNCTION },
    { id: 'default_bf_pkg', name: 'Basic Function (PKG)', duration: 2, category: CategoryType.FUNCTION },
  ],
  [CategoryType.VIB_SHOCK]: [
    { id: 'default_bf_mech', name: 'Basic Function (Mech)', duration: 2, category: CategoryType.VIB_SHOCK },
  ]
};

const mergeMandatory = (standard: StandardData): StandardData => {
  const newCategories = { ...standard.categories };
  
  // 處理 Function 類別 (Track A / PKG Track)
  const existingFunc = newCategories[CategoryType.FUNCTION] || [];
  const mandatoryFunc = DEFAULT_MANDATORY_TESTS[CategoryType.FUNCTION]
    .filter(item => {
      // 只有 Moxa 才強制包含 PKG 的 Basic Function
      if (item.id === 'default_bf_pkg') return standard.id === 'moxa';
      return true;
    })
    .map(item => ({
      ...item,
      id: `${standard.id}_${item.id}`
    }));
  newCategories[CategoryType.FUNCTION] = [...mandatoryFunc, ...existingFunc];

  // 處理 Vib/Shock 類別 (Track B)
  const existingVib = newCategories[CategoryType.VIB_SHOCK] || [];
  const mandatoryVib = DEFAULT_MANDATORY_TESTS[CategoryType.VIB_SHOCK].map(item => ({
    ...item,
    id: `${standard.id}_${item.id}`
  }));
  newCategories[CategoryType.VIB_SHOCK] = [...mandatoryVib, ...existingVib];

  return { ...standard, categories: newCategories };
};

export const STANDARDS_DATA: StandardData[] = [
  mergeMandatory({
    id: 'moxa',
    name: 'Moxa Industrial',
    description: '核心工業自動化標準',
    icon: 'factory',
    categories: {
      [CategoryType.CHAMBER]: [
        { id: 'm_c1', name: 'High Temperature test', duration: 1, category: CategoryType.CHAMBER },
        { id: 'm_c2', name: 'High Temperature & Humidity', duration: 1, category: CategoryType.CHAMBER },
        { id: 'm_c3', name: 'Low Temp On/Off test', duration: 2.5, category: CategoryType.CHAMBER },
        { id: 'm_c4', name: 'High Temp On/Off test', duration: 1, category: CategoryType.CHAMBER },
        { id: 'm_c5', name: 'Temperature Cycling test', duration: 2.5, category: CategoryType.CHAMBER },
        { id: 'm_c6', name: 'High temp storage test', duration: 2, category: CategoryType.CHAMBER },
        { id: 'm_c7', name: 'Low temp storage test', duration: 2, category: CategoryType.CHAMBER },
        { id: 'm_c8', name: 'Altitude test', duration: 2, category: CategoryType.CHAMBER },
      ],
      [CategoryType.VIB_SHOCK]: [
        { id: 'm_v1', name: 'Endurance vibration (Sine)', duration: 1, category: CategoryType.VIB_SHOCK },
        { id: 'm_v2', name: 'Random vibration test', duration: 1, category: CategoryType.VIB_SHOCK },
        { id: 'm_v3', name: 'Shock test (half sine)', duration: 1, category: CategoryType.VIB_SHOCK },
        { id: 'm_v4', name: 'PKG Vib', duration: 1, category: CategoryType.VIB_SHOCK },
        { id: 'm_v5', name: 'PKG Drop', duration: 1, category: CategoryType.VIB_SHOCK },
      ],
      [CategoryType.DUST_TEST]: [
        { id: 'm_ip2x', name: 'IP 2X', duration: 2, category: CategoryType.DUST_TEST },
        { id: 'm_ip3x', name: 'IP 3X', duration: 1, category: CategoryType.DUST_TEST },
        { id: 'm_ip4x', name: 'IP 4X', duration: 1, category: CategoryType.DUST_TEST },
        { id: 'm_ip5x', name: 'IP 5X', duration: 2, category: CategoryType.DUST_TEST },
        { id: 'm_ip6x', name: 'IP 6X', duration: 3.5, category: CategoryType.DUST_TEST },
      ],
      [CategoryType.WATER_TEST]: [
        { id: 'm_ipx2', name: 'IP X2', duration: 2, category: CategoryType.WATER_TEST },
        { id: 'm_ipx3', name: 'IP X3', duration: 2, category: CategoryType.WATER_TEST },
        { id: 'm_ipx4', name: 'IP X4', duration: 2, category: CategoryType.WATER_TEST },
        { id: 'm_ipx5', name: 'IP X5', duration: 4.5, category: CategoryType.WATER_TEST },
        { id: 'm_ipx6', name: 'IP X6', duration: 4.5, category: CategoryType.WATER_TEST },
        { id: 'm_ipx7', name: 'IP X7', duration: 4.5, category: CategoryType.WATER_TEST },
        { id: 'm_ipx8', name: 'IP X8', duration: 4.5, category: CategoryType.WATER_TEST },
      ],
      [CategoryType.OTHER]: [
        { id: 'm_o1', name: 'Salt mist', duration: 3.5, category: CategoryType.OTHER },
      ]
    }
  }),
  mergeMandatory({
    id: 'railway',
    name: 'Railway',
    description: 'EN 50155 軌道交通',
    icon: 'train',
    categories: {
      [CategoryType.CHAMBER]: [
        { id: 'r_c1', name: 'Low Temperature Start-up', duration: 2, category: CategoryType.CHAMBER },
        { id: 'r_c2', name: 'Dry heat thermal test', duration: 2, category: CategoryType.CHAMBER },
        { id: 'r_c3', name: 'Cyclic damp heat test', duration: 8, category: CategoryType.CHAMBER },
      ],
      [CategoryType.VIB_SHOCK]: [
        { id: 'r_v1', name: 'LongLife test (Rand vib)', duration: 1, category: CategoryType.VIB_SHOCK },
        { id: 'r_v2', name: 'Shock test (Half sine)', duration: 1, category: CategoryType.VIB_SHOCK },
        { id: 'r_v3', name: 'Functional test (Rand vib)', duration: 1, category: CategoryType.VIB_SHOCK },
      ]
    }
  }),
  mergeMandatory({
    id: 'marine',
    name: 'Marine',
    description: 'DNVGL 船舶設備',
    icon: 'ship',
    categories: {
      [CategoryType.CHAMBER]: [
        { id: 'mr_c1', name: 'Dry heat', duration: 1, category: CategoryType.CHAMBER },
        { id: 'mr_c2', name: 'Cold test', duration: 2, category: CategoryType.CHAMBER },
        { id: 'mr_c3', name: 'Low temperature startup', duration: 2, category: CategoryType.CHAMBER },
        { id: 'mr_c4', name: 'Damp heat', duration: 4, category: CategoryType.CHAMBER },
        { id: 'mr_c5', name: 'Hi-Pot', duration: 2, category: CategoryType.CHAMBER },
      ],
      [CategoryType.VIB_SHOCK]: [
        { id: 'mr_v1', name: 'Vibration (Sine Wave)', duration: 2, category: CategoryType.VIB_SHOCK },
        { id: 'mr_v2', name: 'Wideband random', duration: 1, category: CategoryType.VIB_SHOCK },
      ]
    }
  }),
  mergeMandatory({
    id: 'power',
    name: 'Power Station',
    description: 'IEC 61850-3 變電站',
    icon: 'bolt',
    categories: {
      [CategoryType.CHAMBER]: [
        { id: 'p_c1', name: 'Cold Test Operation', duration: 3, category: CategoryType.CHAMBER },
        { id: 'p_c2', name: 'Dry Heat test Operation', duration: 3, category: CategoryType.CHAMBER },
        { id: 'p_c3', name: 'Damp Heat Cyclic test', duration: 9, category: CategoryType.CHAMBER },
        { id: 'p_c4', name: 'Damp Heat Steady State', duration: 13, category: CategoryType.CHAMBER },
        { id: 'p_c5', name: 'Change of Temperature test', duration: 4, category: CategoryType.CHAMBER },
        { id: 'p_c6', name: 'Cold storage temp', duration: 3, category: CategoryType.CHAMBER },
        { id: 'p_c7', name: 'Dry heat max storage', duration: 3, category: CategoryType.CHAMBER },
        { id: 'p_c8', name: 'IR & Hi-Pot', duration: 2, category: CategoryType.CHAMBER },
      ],
      [CategoryType.VIB_SHOCK]: [
        { id: 'p_v1', name: 'Vib resonance', duration: 1, category: CategoryType.VIB_SHOCK },
        { id: 'p_v2', name: 'Vib endurance', duration: 1, category: CategoryType.VIB_SHOCK },
        { id: 'p_v3', name: 'Shock response', duration: 0.5, category: CategoryType.VIB_SHOCK },
        { id: 'p_v4', name: 'Shock withstand', duration: 0.5, category: CategoryType.VIB_SHOCK },
        { id: 'p_v5', name: 'Bump test', duration: 1, category: CategoryType.VIB_SHOCK },
        { id: 'p_v6', name: 'Seismic test', duration: 2, category: CategoryType.VIB_SHOCK },
      ]
    }
  })
];

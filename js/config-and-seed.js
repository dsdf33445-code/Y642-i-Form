/**
 * Y642 每月定檢表系統 - 核心設定、預設種子資料與 Firebase Cloud Firestore 即時同步引擎
 * 已修復多人設計表單即時同步機制：採用獨立 Client ID、防抖自動雲端存檔與範本結構自動同步
 */
window.AppConfig = {
  STORAGE_KEY: 'Y642_INSPECTION_SYSTEM_V3',
  SESSION_KEY: 'Y642_CURRENT_SESSION_V3',
  FIREBASE_CFG_KEY: 'Y642_FIREBASE_CONFIG_JSON',
  TAGS: ['A股', 'B股', 'C股', 'D股', '其他'],
  SUPER_ADMIN_ID: '209874' // 鄭毓邦：唯一可進入人員管理之最高權限管理者
};

// 直接綁定您的 Firebase 專案設定 (y642-monthly-inspection)
window.DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyA2Q7pWW7TWqnFpazmyPQ_KuRJpoCqZ81A",
  authDomain: "y642-monthly-inspection.firebaseapp.com",
  projectId: "y642-monthly-inspection",
  storageBucket: "y642-monthly-inspection.firebasestorage.app",
  messagingSenderId: "372763684806",
  appId: "1:372763684806:web:0517ac3f825b6413c74cc7"
};

/**
 * 產生預設人員與帳號清單
 */
function createDefaultUsers() {
  return [
    // 1. 課長
    {
      id: '159038',
      account: '159038',
      password: 'Y642',
      name: '李宗霖',
      role: 'chief',
      roleTitle: '課長',
      group: '課長室',
      isSharedAccount: false,
      members: ['李宗霖'],
      supervisorId: '',
      allowedTags: ['A股', 'B股', 'C股', 'D股', '其他'],
      allowedTemplateIds: [],
      sealText: '李宗霖',
      sealSub: 'Y642 課長',
      customSignature: ''
    },
    // 2. 工程師
    {
      id: '171504',
      account: '171504',
      password: 'Y642',
      name: '林彥廷',
      role: 'engineer',
      roleTitle: '工程師',
      group: '工程師',
      isSharedAccount: false,
      members: ['林彥廷'],
      supervisorId: '159038',
      allowedTags: ['A股', 'B股', 'C股', 'D股', '其他'],
      allowedTemplateIds: [],
      sealText: '林彥廷',
      sealSub: 'Y642 工程師',
      customSignature: ''
    },
    {
      id: '183715',
      account: '183715',
      password: 'Y642',
      name: '蘇哲彬',
      role: 'engineer',
      roleTitle: '工程師',
      group: '其他',
      isSharedAccount: false,
      members: ['蘇哲彬'],
      supervisorId: '159038',
      allowedTags: ['A股', 'B股', 'C股', 'D股', '其他'],
      allowedTemplateIds: [],
      sealText: '蘇哲彬',
      sealSub: 'Y642 工程師',
      customSignature: ''
    },
    // 3. A~D 股股長
    {
      id: '219691',
      account: '219691',
      password: 'Y642',
      name: '張育嘉',
      role: 'leader',
      roleTitle: 'A股股長',
      group: 'A股',
      isSharedAccount: false,
      members: ['張育嘉'],
      supervisorId: '159038',
      allowedTags: ['A股', '其他'],
      allowedTemplateIds: [],
      sealText: '張育嘉',
      sealSub: 'A股股長',
      customSignature: ''
    },
    {
      id: '209874',
      account: '209874',
      password: '830829',
      name: '鄭毓邦',
      role: 'leader',
      roleTitle: 'B股股長 (最高管理員)',
      group: 'B股',
      isSharedAccount: false,
      members: ['鄭毓邦'],
      supervisorId: '159038',
      allowedTags: ['A股', 'B股', 'C股', 'D股', '其他'],
      allowedTemplateIds: [],
      sealText: '鄭毓邦',
      sealSub: 'B股股長',
      customSignature: ''
    },
    {
      id: '166629',
      account: '166629',
      password: 'Y642',
      name: '盧帝宏',
      role: 'leader',
      roleTitle: 'C股股長',
      group: 'C股',
      isSharedAccount: false,
      members: ['盧帝宏'],
      supervisorId: '159038',
      allowedTags: ['C股', '其他'],
      allowedTemplateIds: [],
      sealText: '盧帝宏',
      sealSub: 'C股股長',
      customSignature: ''
    },
    {
      id: '230854',
      account: '230854',
      password: 'Y642',
      name: '曾苡慈',
      role: 'leader',
      roleTitle: 'D股股長',
      group: 'D股',
      isSharedAccount: false,
      members: ['曾苡慈'],
      supervisorId: '159038',
      allowedTags: ['D股', '其他'],
      allowedTemplateIds: [],
      sealText: '曾苡慈',
      sealSub: 'D股股長',
      customSignature: ''
    },
    // 4. 各股技術員共用帳號 (Y642A ~ Y642D) 與 洪浚豪 (Y642E)
    {
      id: 'Y642A',
      account: 'Y642A',
      password: 'Y642A',
      name: 'A股技術員',
      role: 'tech',
      roleTitle: 'A股技術員',
      group: 'A股',
      isSharedAccount: true,
      members: ['蔡 錱', '張志弘', '余君鴻'],
      supervisorId: '219691',
      allowedTags: ['A股', '其他'],
      allowedTemplateIds: [],
      sealText: '蔡 錱',
      sealSub: 'A股技術員',
      customSignature: ''
    },
    {
      id: 'Y642B',
      account: 'Y642B',
      password: 'Y642B',
      name: 'B股技術員',
      role: 'tech',
      roleTitle: 'B股技術員',
      group: 'B股',
      isSharedAccount: true,
      members: ['吳宗穎', '史龍泰', '楊正隆', '王亮傑'],
      supervisorId: '209874',
      allowedTags: ['B股', '其他'],
      allowedTemplateIds: [],
      sealText: '吳宗穎',
      sealSub: 'B股技術員',
      customSignature: ''
    },
    {
      id: 'Y642C',
      account: 'Y642C',
      password: 'Y642C',
      name: 'C股技術員',
      role: 'tech',
      roleTitle: 'C股技術員',
      group: 'C股',
      isSharedAccount: true,
      members: ['許嗣晧', '夏國斌', '呂家松', '黃御豪', '梁上瑀', '張恆瑞'],
      supervisorId: '166629',
      allowedTags: ['C股', '其他'],
      allowedTemplateIds: [],
      sealText: '許嗣晧',
      sealSub: 'C股技術員',
      customSignature: ''
    },
    {
      id: 'Y642D',
      account: 'Y642D',
      password: 'Y642D',
      name: 'D股技術員',
      role: 'tech',
      roleTitle: 'D股技術員',
      group: 'D股',
      isSharedAccount: true,
      members: ['樊祥霖', '董光展', '吳友中', '葉柏漢'],
      supervisorId: '230854',
      allowedTags: ['D股', '其他'],
      allowedTemplateIds: [],
      sealText: '樊祥霖',
      sealSub: 'D股技術員',
      customSignature: ''
    },
    {
      id: 'Y642E',
      account: 'Y642E',
      password: 'Y642E',
      name: '洪浚豪',
      role: 'tech',
      roleTitle: '技術員(其他)',
      group: '其他',
      isSharedAccount: false,
      members: ['洪浚豪'],
      supervisorId: '183715',
      allowedTags: ['其他'],
      allowedTemplateIds: [],
      sealText: '洪浚豪',
      sealSub: 'Y642 技術員',
      customSignature: ''
    }
  ];
}

/**
 * 產生預設各股與其他之定檢表單範本
 */
function createDefaultTemplates() {
  const baseColumns = [
    { id: 'c1', title: '項次', width: 55, type: 'text', align: 'center' },
    { id: 'c2', title: '檢查設備 / 項目名稱', width: 210, type: 'text', align: 'left' },
    { id: 'c3', title: '檢查標準說明', width: 170, type: 'text', align: 'left' },
    { id: 'c4', title: '量測數值', width: 130, type: 'number', min: 210, max: 230, unit: 'V', align: 'center' },
    { id: 'c5', title: '目視點檢', width: 95, type: 'checkbox', checkLabel: '正常', align: 'center' },
    { id: 'c6', title: '綜合判定', width: 120, type: 'select', options: ['合格', '待追蹤', '異常需檢修'], align: 'center' },
    { id: 'c7', title: '點檢日期', width: 130, type: 'date', align: 'center' }
  ];

  const makeRows = (equipPrefix) => [
    {
      id: 'r_sec1',
      isSection: true,
      sectionTitle: `一、${equipPrefix} 主變壓器與配電盤月定檢（含上下限與自動加總）`,
      cells: {}
    },
    {
      id: 'r1',
      isSection: false,
      cells: {
        c1: { value: '1', readOnly: true },
        c2: { value: `${equipPrefix} 一次側匯流排電壓`, readOnly: true },
        c3: { value: '標準 210V ~ 230V', readOnly: true },
        c4: { value: '220', override: { type: 'number', min: 210, max: 230, unit: 'V' } },
        c5: { value: true },
        c6: { value: '合格' },
        c7: { value: new Date().toISOString().slice(0, 10) }
      }
    },
    {
      id: 'r2',
      isSection: false,
      cells: {
        c1: { value: '2', readOnly: true },
        c2: { value: `${equipPrefix} 變壓器繞組溫升測試`, readOnly: true },
        c3: { value: '標準 20°C ~ 75°C', readOnly: true },
        c4: { value: '52', override: { type: 'number', min: 20, max: 75, unit: '°C' } },
        c5: { value: true },
        c6: { value: '合格' },
        c7: { value: new Date().toISOString().slice(0, 10) }
      }
    },
    {
      id: 'r3',
      isSection: false,
      cells: {
        c1: { value: '3', readOnly: true },
        c2: { value: `${equipPrefix} 接地電阻值量測`, readOnly: true },
        c3: { value: '標準 0.1Ω ~ 10Ω', readOnly: true },
        c4: { value: '3.2', override: { type: 'number', min: 0.1, max: 10, unit: 'Ω' } },
        c5: { value: true },
        c6: { value: '合格' },
        c7: { value: new Date().toISOString().slice(0, 10) }
      }
    },
    {
      id: 'r4',
      isSection: false,
      cells: {
        c1: { value: '合計', readOnly: true },
        c2: { value: '上方量測數值自動加總 (SUM)', readOnly: true },
        c3: { value: '系統自動計算 COL_SUM', readOnly: true },
        c4: { value: '', override: { type: 'sum', formula: 'COL_SUM', unit: '' } },
        c5: { value: true },
        c6: { value: '合格' },
        c7: { value: new Date().toISOString().slice(0, 10) }
      }
    }
  ];

  return [
    {
      id: 'TPL_A_01',
      name: 'A股 - 高壓變電站配電盤每月定檢表',
      code: 'Y642-A-M01',
      tag: 'A股',
      cycle: '每月',
      department: 'Y642 電力維護課 (A股)',
      EquipmentCode: 'SUB-A01',
      updatedAt: '2026-11-01',
      createdBy: '219691',
      columns: JSON.parse(JSON.stringify(baseColumns)),
      rows: makeRows('A股 #1 變電站')
    },
    {
      id: 'TPL_B_01',
      name: 'B股 - 特高壓變壓器與斷路器每月定檢表',
      code: 'Y642-B-M01',
      tag: 'B股',
      cycle: '每月',
      department: 'Y642 電力維護課 (B股)',
      EquipmentCode: 'SUB-B01',
      updatedAt: '2026-11-01',
      createdBy: '209874',
      columns: JSON.parse(JSON.stringify(baseColumns)),
      rows: makeRows('B股 #2 變電站')
    },
    {
      id: 'TPL_C_01',
      name: 'C股 - 廠區緊急發電機與ATS每月定檢表',
      code: 'Y642-C-M01',
      tag: 'C股',
      cycle: '每月',
      department: 'Y642 電力維護課 (C股)',
      EquipmentCode: 'GEN-C01',
      updatedAt: '2026-11-01',
      createdBy: '166629',
      columns: JSON.parse(JSON.stringify(baseColumns)),
      rows: makeRows('C股 緊急發電機組')
    },
    {
      id: 'TPL_D_01',
      name: 'D股 - 直流充電機與蓄電池組每月定檢表',
      code: 'Y642-D-M01',
      tag: 'D股',
      cycle: '每月',
      department: 'Y642 電力維護課 (D股)',
      EquipmentCode: 'UPS-D01',
      updatedAt: '2026-11-01',
      createdBy: '230854',
      columns: JSON.parse(JSON.stringify(baseColumns)),
      rows: makeRows('D股 直流電瓶室')
    },
    {
      id: 'TPL_OTHER_01',
      name: '其他 - 公共照明與附屬電氣設備每月定檢表',
      code: 'Y642-E-M01',
      tag: '其他',
      cycle: '每月',
      department: 'Y642 電力維護課 (其他)',
      EquipmentCode: 'PUB-E01',
      updatedAt: '2026-11-01',
      createdBy: '183715',
      columns: JSON.parse(JSON.stringify(baseColumns)),
      rows: makeRows('全廠公共電氣設備')
    }
  ];
}

/**
 * 產生預設填表與歷史簽核紀錄
 */
function createDefaultRecords(templates) {
  const tplB = templates.find(t => t.id === 'TPL_B_01') || templates[0];
  const tplA = templates.find(t => t.id === 'TPL_A_01') || templates[0];
  const tplOther = templates.find(t => t.id === 'TPL_OTHER_01') || templates[0];

  const extractCells = (tpl) => {
    const data = {};
    tpl.rows.forEach(r => {
      if (!r.isSection) {
        data[r.id] = {};
        Object.keys(r.cells).forEach(cid => {
          data[r.id][cid] = r.cells[cid].value;
        });
      }
    });
    return data;
  };

  return [
    {
      id: 'REC_202611_B01',
      templateId: tplB.id,
      templateName: tplB.name,
      templateCode: tplB.code,
      tag: 'B股',
      month: '2026-11',
      inspectDate: '2026-11-10',
      stage: 'draft_tech',
      fillerAccountId: 'Y642B',
      fillerMemberName: '吳宗穎',
      currentAssigneeId: 'Y642B',
      cellValues: extractCells(tplB),
      note: '',
      approvals: { tech: null, leader: null, chief: null },
      logs: [
        { time: '2026-11-10 08:30', actor: '吳宗穎 (Y642B)', action: '建立 2026-11 定檢表草稿' }
      ]
    },
    {
      id: 'REC_202611_A01',
      templateId: tplA.id,
      templateName: tplA.name,
      templateCode: tplA.code,
      tag: 'A股',
      month: '2026-11',
      inspectDate: '2026-11-08',
      stage: 'pending_chief',
      fillerAccountId: 'Y642A',
      fillerMemberName: '蔡 錱',
      currentAssigneeId: '159038',
      cellValues: extractCells(tplA),
      note: '',
      approvals: {
        tech: { accountId: 'Y642A', name: '蔡 錱', roleTitle: 'A股技術員', time: '2026-11-08 10:15', comment: '點檢完畢無異常' },
        leader: { accountId: '219691', name: '張育嘉', roleTitle: 'A股股長', time: '2026-11-08 14:20', comment: '複核合格，呈請課長核示' },
        chief: null
      },
      logs: [
        { time: '2026-11-08 10:15', actor: '蔡 錱 (A股技術員)', action: '完成填寫並陳核給 A股股長 張育嘉' },
        { time: '2026-11-08 14:20', actor: '張育嘉 (A股股長)', action: '股長簽核通過，陳核給 課長 李宗霖' }
      ]
    },
    {
      id: 'REC_202611_B_DONE',
      templateId: tplB.id,
      templateName: tplB.name,
      templateCode: tplB.code,
      tag: 'B股',
      month: '2026-11',
      inspectDate: '2026-11-03',
      stage: 'completed',
      fillerAccountId: 'Y642B',
      fillerMemberName: '史龍泰',
      currentAssigneeId: '',
      cellValues: extractCells(tplB),
      note: '',
      approvals: {
        tech: { accountId: 'Y642B', name: '史龍泰', roleTitle: 'B股技術員', time: '2026-11-03 09:20', comment: '定檢正常' },
        leader: { accountId: '209874', name: '鄭毓邦', roleTitle: 'B股股長', time: '2026-11-03 11:05', comment: '數據正常，准予備查' },
        chief: { accountId: '159038', name: '李宗霖', roleTitle: '課長', time: '2026-11-03 16:00', comment: '核定結案' }
      },
      logs: [
        { time: '2026-11-03 09:20', actor: '史龍泰 (B股技術員)', action: '填寫完成並陳核 B股股長 鄭毓邦' },
        { time: '2026-11-03 11:05', actor: '鄭毓邦 (B股股長)', action: '簽核通過並陳核 課長 李宗霖' },
        { time: '2026-11-03 16:00', actor: '李宗霖 (課長)', action: '決行核定，表單歸檔完成' }
      ]
    },
    {
      id: 'REC_202610_E_DONE',
      templateId: tplOther.id,
      templateName: tplOther.name,
      templateCode: tplOther.code,
      tag: '其他',
      month: '2026-10',
      inspectDate: '2026-10-25',
      stage: 'completed',
      fillerAccountId: 'Y642E',
      fillerMemberName: '洪浚豪',
      currentAssigneeId: '',
      cellValues: extractCells(tplOther),
      note: '',
      approvals: {
        tech: { accountId: 'Y642E', name: '洪浚豪', roleTitle: '技術員(其他)', time: '2026-10-25 10:00', comment: '點檢正常' },
        leader: { accountId: '183715', name: '蘇哲彬', roleTitle: '工程師', time: '2026-10-25 13:40', comment: '工程師複核通過' },
        chief: { accountId: '159038', name: '李宗霖', roleTitle: '課長', time: '2026-10-25 17:10', comment: '核准歸檔' }
      },
      logs: [
        { time: '2026-10-25 10:00', actor: '洪浚豪 (Y642E)', action: '填寫完成並陳核 工程師 蘇哲彬' },
        { time: '2026-10-25 13:40', actor: '蘇哲彬 (工程師)', action: '簽核通過並陳核 課長 李宗霖' },
        { time: '2026-10-25 17:10', actor: '李宗霖 (課長)', action: '決行核定，表單歸檔完成' }
      ]
    }
  ];
}

/**
 * 全域資料庫狀態與 Firebase Cloud Firestore 即時雙向同步管理
 */
window.DB = {
  state: {
    users: [],
    templates: [],
    records: [],
    updatedAt: 0
  },
  clientId: 'CLIENT_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
  lastWriteToken: '',
  firestoreDocRef: null,
  setDocFn: null,
  isCloudConnected: false,
  hasPendingSaveBeforeConnect: false,
  debounceTimer: null,

  init() {
    const raw = localStorage.getItem(AppConfig.STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
          this.state = parsed;
        } else {
          this.resetToSeed();
        }
      } catch (e) {
        this.resetToSeed();
      }
    } else {
      this.resetToSeed();
    }
    this.initFirebaseIfConfigured();
  },

  resetToSeed() {
    const users = createDefaultUsers();
    const templates = createDefaultTemplates();
    const records = createDefaultRecords(templates);
    this.state = {
      users,
      templates,
      records,
      updatedAt: 1000 // 初始種子設定較小時間戳記，確保雲端有正式資料時優先採用雲端版本
    };
    localStorage.setItem(AppConfig.STORAGE_KEY, JSON.stringify(this.state));
  },

  /**
   * 當表單範本 (templates) 被修改時，自動將最新的結構與唯讀預設文字同步至未結案之填表草稿 (records)
   */
  syncDraftRecordsWithTemplates() {
    if (!Array.isArray(this.state.templates) || !Array.isArray(this.state.records)) return;
    this.state.records.forEach(rec => {
      if (rec.stage === 'completed') return;
      const tpl = this.state.templates.find(t => t.id === rec.templateId);
      if (!tpl) return;

      rec.templateName = tpl.name;
      rec.templateCode = tpl.code;
      rec.tag = tpl.tag || rec.tag;

      if (!rec.cellValues) rec.cellValues = {};
      tpl.rows.forEach(r => {
        if (r.isSection) return;
        if (!rec.cellValues[r.id]) rec.cellValues[r.id] = {};
        tpl.columns.forEach(c => {
          const cellDef = r.cells?.[c.id];
          if (!cellDef) return;
          // 若該儲存格在設計表單被設為「唯讀固定字」，或草稿中尚無該格的值，即同步為範本最新設定值
          if (cellDef.readOnly || rec.cellValues[r.id][c.id] === undefined) {
            rec.cellValues[r.id][c.id] = cellDef.value ?? '';
          }
        });
      });
    });
  },

  /**
   * 儲存至本機 LocalStorage
   */
  saveLocal() {
    this.syncDraftRecordsWithTemplates();
    this.state.updatedAt = Date.now();
    localStorage.setItem(AppConfig.STORAGE_KEY, JSON.stringify(this.state));
  },

  /**
   * 防抖自動雲端同步（適用於設計表單打字輸入時，停筆 400ms 後自動同步至 Firebase 雲端）
   */
  scheduleSave() {
    this.saveLocal();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.save();
    }, 400);
  },

  /**
   * 立即寫入本機與 Firebase Cloud Firestore，觸發所有連線裝置即時同步
   */
  async save() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.saveLocal();

    if (!this.isCloudConnected || !this.firestoreDocRef || !this.setDocFn) {
      // 若 Firebase 尚在初始連線中，標記待同步，連線完成後立即補推上雲端
      this.hasPendingSaveBeforeConnect = true;
      return false;
    }

    try {
      if (window.App && typeof App.updateSyncBadge === 'function') {
        App.updateSyncBadge('syncing', '雲端同步寫入中...');
      }

      const writeToken = `${this.clientId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      this.lastWriteToken = writeToken;

      await this.setDocFn(this.firestoreDocRef, {
        payload: JSON.stringify(this.state),
        updatedAt: this.state.updatedAt,
        writerClientId: this.clientId,
        writeToken: writeToken
      });

      if (window.App && typeof App.updateSyncBadge === 'function') {
        App.updateSyncBadge('cloud-ok', '雲端已即時同步');
      }
      return true;
    } catch (err) {
      console.error('Firestore 同步寫入失敗:', err);
      if (window.App && typeof App.updateSyncBadge === 'function') {
        App.updateSyncBadge('cloud-err', '雲端寫入失敗(已存本機)');
      }
      return false;
    }
  },

  /**
   * 初始化 Firebase Cloud Firestore 並啟動全員即時雙向監聽 (onSnapshot)
   */
  async initFirebaseIfConfigured() {
    let cfg = window.DEFAULT_FIREBASE_CONFIG;
    const savedCfgStr = localStorage.getItem(AppConfig.FIREBASE_CFG_KEY);
    if (savedCfgStr) {
      try {
        const parsedCfg = JSON.parse(savedCfgStr);
        if (parsedCfg && parsedCfg.apiKey && parsedCfg.projectId) {
          cfg = parsedCfg;
        }
      } catch (e) {}
    }

    if (!cfg || !cfg.apiKey || !cfg.projectId) {
      if (window.App && typeof App.updateSyncBadge === 'function') {
        App.updateSyncBadge('local', '本機儲存模式');
      }
      return;
    }

    try {
      if (window.App && typeof App.updateSyncBadge === 'function') {
        App.updateSyncBadge('syncing', '連線 Firebase 中...');
      }
      const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      const { getFirestore, doc, onSnapshot, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

      const appInstance = getApps().length ? getApps()[0] : initializeApp(cfg);
      const db = getFirestore(appInstance);
      const docRef = doc(db, 'y642_monthly_inspection', 'shared_state_v3');
      this.firestoreDocRef = docRef;
      this.setDocFn = setDoc;

      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        // 雲端尚無資料時，將本機初始狀態寫入 Firestore
        const writeToken = `${this.clientId}_${Date.now()}`;
        this.lastWriteToken = writeToken;
        await setDoc(docRef, {
          payload: JSON.stringify(this.state),
          updatedAt: Date.now(),
          writerClientId: this.clientId,
          writeToken
        });
      } else {
        // 雲端已有資料時，載入雲端最新狀態
        const remoteData = snap.data();
        if (remoteData && remoteData.payload) {
          try {
            const remoteState = JSON.parse(remoteData.payload);
            if (remoteState && Array.isArray(remoteState.users)) {
              this.state = remoteState;
              this.syncDraftRecordsWithTemplates();
              localStorage.setItem(AppConfig.STORAGE_KEY, JSON.stringify(this.state));
              if (window.App && App.currentUser) {
                const updatedMe = this.state.users.find(u => u.id === App.currentUser.id);
                if (updatedMe) App.currentUser = updatedMe;
                App.renderHeaderAndSidebarUser();
                App.refreshCurrentModuleView();
              }
            }
          } catch (parseErr) {
            console.error('初次解析雲端資料失敗:', parseErr);
          }
        }
      }

      // 啟動即時監聽：任何同仁在「設計表單」、「填寫表單」、「表單管理」或「人員管理」儲存，全員畫面即時同步更新
      onSnapshot(docRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        if (!data || !data.payload) return;

        // 若該次變更為本機自己剛剛送出的同一筆 writeToken，則不重複重繪本機畫面（避免打字游標跳動）
        if (data.writeToken && data.writeToken === this.lastWriteToken) {
          return;
        }

        try {
          const remoteState = JSON.parse(data.payload);
          if (remoteState && Array.isArray(remoteState.users)) {
            this.state = remoteState;
            this.syncDraftRecordsWithTemplates();
            localStorage.setItem(AppConfig.STORAGE_KEY, JSON.stringify(this.state));

            if (window.App && App.currentUser) {
              const updatedMe = this.state.users.find(u => u.id === App.currentUser.id);
              if (updatedMe) App.currentUser = updatedMe;
              App.renderHeaderAndSidebarUser();
              App.refreshCurrentModuleView();
            }
            if (window.App && typeof App.updateSyncBadge === 'function') {
              App.updateSyncBadge('cloud-ok', '雲端已即時同步');
            }
          }
        } catch (err) {
          console.error('解析遠端即時資料失敗:', err);
        }
      });

      this.isCloudConnected = true;
      if (window.App && typeof App.updateSyncBadge === 'function') {
        App.updateSyncBadge('cloud-ok', '雲端即時同步中');
      }

      // 若連線完成前有待同步的修改，立即補推至雲端
      if (this.hasPendingSaveBeforeConnect) {
        this.hasPendingSaveBeforeConnect = false;
        this.save();
      }
    } catch (err) {
      console.error('Firebase 初始化失敗:', err);
      this.isCloudConnected = false;
      if (window.App && typeof App.updateSyncBadge === 'function') {
        App.updateSyncBadge('cloud-err', 'Firebase 連線異常');
      }
    }
  }
};
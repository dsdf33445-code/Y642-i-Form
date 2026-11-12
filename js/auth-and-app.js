/**
 * Y642 每月定檢表系統 - 登入驗證、多工作表分頁管理、自訂座標加總引擎、A4 自動縮放預覽與 PDF 匯出核心
 * 本次升級重點：
 * 1. 加總功能支援指定儲存格座標與四則運算（例：C1 = A1 + B1、A1+B1+C1、SUM(A1:A5)、COL_SUM、ROW_SUM）
 * 2. 預覽與匯出移除表頭列顯示
 * 3. 支援一份表單多個分頁 (sheets)，可於預覽視窗切換分頁
 * 4. 預覽與匯出自動將表單等比例縮放至單頁 A4 大小（確保表單與底部簽核格完整顯示在同一頁 A4）
 */
window.App = {
  currentUser: null,        // 當前登入之帳號物件
  activeTechMember: '',     // 若為 Y642A~D 共用帳號，當前選取的填表技術員姓名
  currentModule: 'fill',    // 'fill' | 'builder' | 'manage' | 'completed' | 'personnel'
  activeRecordId: null,     // 當前於填寫模組開啟的紀錄 ID
  activeTemplateId: null,   // 當前於設計表單開啟的範本 ID
  pdfTargetRecordId: null,  // 當前預覽 PDF 的紀錄 ID
  pdfActiveSheetIdx: 0,     // 當前預覽 PDF 的分頁索引
  confirmCallback: null,    // 美化確認視窗回呼函式
  CYCLES: ['每月', '每季', '半年', '每年'],

  init() {
    DB.init();
    const savedSession = sessionStorage.getItem(AppConfig.SESSION_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        const found = DB.state.users.find(u => u.id === parsed.userId);
        if (found) {
          this.currentUser = found;
          this.activeTechMember = parsed.activeTechMember || (found.members && found.members[0]) || found.name;
          this.enterAppShell();
          return;
        }
      } catch (e) {}
    }
    this.showLoginScreen();
  },

  showLoginScreen() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
  },

  /**
   * 快速帶入帳號
   */
  quickFillLogin(acc) {
    const accEl = document.getElementById('login-account');
    const pwdEl = document.getElementById('login-password');
    if (accEl) accEl.value = acc;
    if (pwdEl) {
      pwdEl.value = '';
      pwdEl.focus();
    }
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.classList.add('hidden');
  },

  /**
   * 確保表單範本具備多工作表分頁 (sheets) 陣列，並向下相容既有單頁範本
   */
  ensureTemplateSheets(tpl) {
    if (!tpl) return [];
    if (!Array.isArray(tpl.sheets) || tpl.sheets.length === 0) {
      tpl.sheets = [
        {
          id: 'sheet_1',
          name: '工作表1',
          columns: Array.isArray(tpl.columns) ? tpl.columns : [],
          rows: Array.isArray(tpl.rows) ? tpl.rows : []
        }
      ];
    }
    // 確保每個分頁內的列 ID 唯一，避免跨分頁填寫資料時互相覆蓋
    const seenRowIds = new Set();
    tpl.sheets.forEach((sh, sIdx) => {
      if (!sh.id) sh.id = 'sheet_' + (sIdx + 1);
      if (!sh.name) sh.name = `工作表${sIdx + 1}`;
      if (!Array.isArray(sh.columns)) sh.columns = [];
      if (!Array.isArray(sh.rows)) sh.rows = [];
      sh.rows.forEach((r, rIdx) => {
        if (!r.id || seenRowIds.has(r.id)) {
          r.id = `${sh.id}_r_${rIdx}_${Date.now().toString().slice(-4)}`;
        }
        seenRowIds.add(r.id);
      });
    });

    // 同步第一分頁至頂層屬性以保持相容
    tpl.columns = tpl.sheets[0].columns;
    tpl.rows = tpl.sheets[0].rows;
    return tpl.sheets;
  },

  /**
   * 開啟全域美化版刪除確認彈跳視窗
   */
  openConfirmModal({ title = '確認刪除', message = '確定要執行刪除嗎？', confirmText = '確認刪除', onConfirm = null }) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').innerHTML = message;
    document.getElementById('confirm-modal-ok-text').textContent = confirmText;
    this.confirmCallback = onConfirm;

    const okBtn = document.getElementById('confirm-modal-ok-btn');
    okBtn.onclick = () => {
      const cb = this.confirmCallback;
      this.closeConfirmModal();
      if (typeof cb === 'function') cb();
    };

    modal.classList.remove('hidden');
  },

  closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.add('hidden');
    this.confirmCallback = null;
  },

  /**
   * 依據標籤名稱回傳專屬顏色樣式
   */
  getTagBadgeClass(tag) {
    const map = {
      'A股': 'bg-blue-100 text-blue-800 border border-blue-300',
      'B股': 'bg-emerald-100 text-emerald-800 border border-emerald-300',
      'C股': 'bg-amber-100 text-amber-800 border border-amber-300',
      'D股': 'bg-purple-100 text-purple-800 border border-purple-300',
      '其他': 'bg-rose-100 text-rose-800 border border-rose-300'
    };
    return map[tag] || 'bg-slate-100 text-slate-800 border border-slate-300';
  },

  /**
   * 依據填寫週期回傳顏色樣式
   */
  getCycleBadgeClass(cycle) {
    const map = {
      '每月': 'bg-sky-50 text-sky-700 border border-sky-200',
      '每季': 'bg-indigo-50 text-indigo-700 border border-indigo-200',
      '半年': 'bg-amber-50 text-amber-700 border border-amber-200',
      '每年': 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200'
    };
    return map[cycle] || 'bg-sky-50 text-sky-700 border border-sky-200';
  },

  getCleanTitle(user) {
    if (!user) return '';
    const cleaned = String(user.roleTitle || '').replace(/\s*[\(（].*?[\)）]/g, '').trim();
    if (cleaned) return cleaned;
    const roleMap = { tech: '技術員', leader: '股長', engineer: '工程師', chief: '課長', admin: '管理員' };
    return roleMap[user.role] || '人員';
  },

  getFormattedUserHeaderTitle(user) {
    if (!user) return '';
    const cleanTitle = this.getCleanTitle(user);
    const personName = user.isSharedAccount ? (this.activeTechMember || user.members?.[0] || user.name) : user.name;
    return `${cleanTitle} ${personName}`;
  },

  handleLogin(e) {
    e.preventDefault();
    const accInput = document.getElementById('login-account').value.trim().toUpperCase();
    const pwdInput = document.getElementById('login-password').value.trim();

    const matchedUser = DB.state.users.find(
      u => u.account.toUpperCase() === accInput && u.password === pwdInput
    );

    if (!matchedUser) {
      const errBox = document.getElementById('login-error');
      document.getElementById('login-error-text').textContent = '帳號或密碼錯誤，請確認後重試！';
      errBox.classList.remove('hidden');
      return;
    }

    document.getElementById('login-error').classList.add('hidden');
    this.currentUser = matchedUser;
    this.activeTechMember = (matchedUser.members && matchedUser.members[0]) || matchedUser.name;

    sessionStorage.setItem(AppConfig.SESSION_KEY, JSON.stringify({
      userId: matchedUser.id,
      activeTechMember: this.activeTechMember
    }));

    this.enterAppShell();
    this.toast(`歡迎登入，${this.getFormattedUserHeaderTitle(matchedUser)}`, 'success');
  },

  handleLogout() {
    sessionStorage.removeItem(AppConfig.SESSION_KEY);
    this.currentUser = null;
    this.activeTechMember = '';
    document.getElementById('login-password').value = '';
    this.showLoginScreen();
  },

  getAllowedModulesForCurrentUser() {
    const u = this.currentUser;
    if (!u) return [];

    const fillTitle = u.role === 'chief' ? '待簽核表單' : '填寫表單';
    const fillIcon = u.role === 'chief' ? 'fa-file-signature' : 'fa-pen-to-square';

    let modules = [];
    if (u.role === 'chief') {
      modules = [
        { id: 'fill', title: fillTitle, icon: fillIcon },
        { id: 'completed', title: '已完成表單', icon: 'fa-box-archive' }
      ];
    } else if (u.role === 'leader' || u.role === 'engineer' || u.role === 'admin') {
      modules = [
        { id: 'fill', title: fillTitle, icon: fillIcon },
        { id: 'builder', title: '設計表單', icon: 'fa-file-excel' },
        { id: 'manage', title: '表單管理', icon: 'fa-folder-tree' },
        { id: 'completed', title: '已完成表單', icon: 'fa-box-archive' }
      ];
    } else {
      modules = [
        { id: 'fill', title: '填寫表單', icon: 'fa-pen-to-square' },
        { id: 'completed', title: '已完成表單', icon: 'fa-box-archive' }
      ];
    }

    if (u.id === AppConfig.SUPER_ADMIN_ID || u.role === 'admin') {
      modules.push({ id: 'personnel', title: '人員管理', icon: 'fa-users-gear' });
    }

    return modules;
  },

  canUserAccessTemplate(user, template) {
    if (!user || !template) return false;
    if (user.id === AppConfig.SUPER_ADMIN_ID || user.role === 'admin' || user.role === 'chief') return true;

    if (Array.isArray(user.allowedTemplateIds) && user.allowedTemplateIds.length > 0) {
      return user.allowedTemplateIds.includes(template.id);
    }

    const tags = Array.isArray(user.allowedTags) && user.allowedTags.length > 0
      ? user.allowedTags
      : [user.group, '其他'];
    return tags.includes(template.tag || '其他');
  },

  enterAppShell() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');

    this.renderHeaderAndSidebarUser();
    const allowed = this.getAllowedModulesForCurrentUser();
    if (!allowed.some(m => m.id === this.currentModule)) {
      this.currentModule = allowed[0]?.id || 'fill';
    }
    this.switchModule(this.currentModule);
  },

  renderHeaderAndSidebarUser() {
    const u = this.currentUser;
    if (!u) return;

    const freshUser = DB.state.users.find(item => item.id === u.id);
    if (freshUser) this.currentUser = freshUser;

    const headerDisplayEl = document.getElementById('current-user-display');
    if (headerDisplayEl) {
      headerDisplayEl.textContent = this.getFormattedUserHeaderTitle(this.currentUser);
    }

    const accCodeEl = document.getElementById('sidebar-account-code');
    if (accCodeEl) {
      accCodeEl.textContent = `帳號: ${u.account}`;
    }

    const sealName = u.isSharedAccount ? this.activeTechMember : (u.sealText || u.name);
    const todayStr = new Date().toISOString().slice(0, 10);
    document.getElementById('sidebar-seal-preview').innerHTML = this.renderSealHTML({
      name: sealName,
      time: todayStr,
      customSignature: u.customSignature
    });

    const sup = DB.state.users.find(x => x.id === u.supervisorId);
    const supChief = sup ? DB.state.users.find(x => x.id === sup.supervisorId) : null;
    let chainHtml = `<div class="text-slate-400">所屬分類：<span class="text-white font-semibold">${(u.allowedTags || []).join('、')}</span></div>`;
    if (sup) {
      chainHtml += `<div class="mt-0.5 text-slate-400">下一簽核人：<span class="text-amber-300 font-semibold">${this.getCleanTitle(sup)} ${sup.name}</span></div>`;
    }
    if (supChief) {
      chainHtml += `<div class="mt-0.5 text-slate-400">最終決行：<span class="text-emerald-300 font-semibold">${this.getCleanTitle(supChief)} ${supChief.name}</span></div>`;
    }
    document.getElementById('sidebar-chain-info').innerHTML = chainHtml;

    this.renderNavigationBars();
  },

  renderNavigationBars() {
    const modules = this.getAllowedModulesForCurrentUser();
    const pendingCount = this.getPendingActionCountForCurrentUser();

    const desktopNav = document.getElementById('desktop-nav-list');
    desktopNav.innerHTML = modules.map(m => {
      const isActive = this.currentModule === m.id;
      const badge = (m.id === 'fill' && pendingCount > 0)
        ? `<span class="ml-auto px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-500 text-slate-950">${pendingCount}</span>`
        : '';
      return `
        <button onclick="App.switchModule('${m.id}')"
          class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
            isActive
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }">
          <i class="fa-solid ${m.icon} w-4 text-center text-sm"></i>
          <span>${m.title}</span>
          ${badge}
        </button>
      `;
    }).join('');

    const mobileNav = document.getElementById('mobile-nav-list');
    mobileNav.innerHTML = modules.map(m => {
      const isActive = this.currentModule === m.id;
      const badge = (m.id === 'fill' && pendingCount > 0)
        ? `<span class="absolute -top-1 right-2 px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-amber-500 text-slate-950">${pendingCount}</span>`
        : '';
      return `
        <button onclick="App.switchModule('${m.id}')"
          class="relative flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[11px] font-bold transition ${
            isActive ? 'text-blue-400' : 'text-slate-400 hover:text-white'
          }">
          <i class="fa-solid ${m.icon} text-base mb-0.5"></i>
          <span>${m.title}</span>
          ${badge}
        </button>
      `;
    }).join('');
  },

  getPendingActionCountForCurrentUser() {
    const u = this.currentUser;
    if (!u) return 0;
    return DB.state.records.filter(r => {
      if (r.stage === 'completed') return false;
      if (u.role === 'chief') return r.stage === 'pending_chief' && r.currentAssigneeId === u.id;
      if (u.role === 'leader' || u.role === 'engineer' || u.role === 'admin') {
        return (r.stage === 'pending_leader' && r.currentAssigneeId === u.id) ||
               (r.stage === 'draft_tech' && r.fillerAccountId === u.id);
      }
      return r.stage === 'draft_tech' && r.fillerAccountId === u.id;
    }).length;
  },

  switchModule(moduleId) {
    if (moduleId === 'personnel' && (!this.currentUser || (this.currentUser.id !== AppConfig.SUPER_ADMIN_ID && this.currentUser.role !== 'admin'))) {
      this.toast('權限不足：僅管理員可進入人員管理！', 'error');
      return;
    }

    const allowed = this.getAllowedModulesForCurrentUser();
    if (!allowed.some(m => m.id === moduleId)) {
      moduleId = allowed[0]?.id || 'fill';
    }

    this.currentModule = moduleId;
    document.querySelectorAll('.module-view').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`view-${moduleId}`);
    if (target) target.classList.remove('hidden');

    this.renderHeaderAndSidebarUser();
    this.refreshCurrentModuleView();
  },

  refreshCurrentModuleView() {
    if (!this.currentUser) return;
    this.renderNavigationBars();
    switch (this.currentModule) {
      case 'fill':
        ModuleFill.render();
        break;
      case 'builder':
        ModuleBuilder.render();
        break;
      case 'manage':
        ModuleManage.render();
        break;
      case 'completed':
        ModuleCompleted.render();
        break;
      case 'personnel':
        ModulePersonnel.render();
        break;
    }
  },

  /**
   * 產生電子職章或手寫簽名 HTML（只顯示 姓名 + 日期[年月日]）
   */
  renderSealHTML({ name, time, customSignature }) {
    const dateStr = time ? String(time).slice(0, 10) : new Date().toISOString().slice(0, 10);
    if (customSignature) {
      return `
        <div class="inline-flex flex-col items-center">
          <img src="${customSignature}" alt="${name}" class="h-10 object-contain" />
          <span class="text-[9px] text-red-600 font-mono font-bold mt-0.5">${dateStr}</span>
        </div>
      `;
    }
    return `
      <div class="traditional-seal">
        <span class="text-sm font-black tracking-widest border-b border-red-500/40 pb-0.5 px-1">${name || '未具名'}</span>
        <span class="text-[9px] font-mono tracking-normal pt-0.5">${dateStr}</span>
      </div>
    `;
  },

  /**
   * 二維合併儲存格計算引擎（同時支援上下跨列合併 rowspan 與左右跨欄合併 colspan）
   */
  computeMergedGridMap(sheetOrTpl) {
    const rows = sheetOrTpl.rows || [];
    const cols = sheetOrTpl.columns || [];
    const rowCount = rows.length;
    const colCount = cols.length;
    const gridMap = Array.from({ length: rowCount }, () =>
      Array.from({ length: colCount }, () => ({ skip: false, rowspan: 1, colspan: 1 }))
    );

    for (let rIdx = 0; rIdx < rowCount; rIdx++) {
      const row = rows[rIdx];
      if (!row || row.isSection) continue;

      for (let cIdx = 0; cIdx < colCount; cIdx++) {
        if (gridMap[rIdx][cIdx].skip) continue;

        const col = cols[cIdx];
        const cell = (row.cells && row.cells[col.id]) || {};

        let colspan = Math.max(1, Math.min(parseInt(cell.colspan, 10) || 1, colCount - cIdx));
        for (let dc = 1; dc < colspan; dc++) {
          if (gridMap[rIdx][cIdx + dc].skip) {
            colspan = dc;
            break;
          }
        }

        let maxAvailRows = 1;
        for (let dr = 1; rIdx + dr < rowCount; dr++) {
          if (rows[rIdx + dr].isSection) break;
          maxAvailRows++;
        }
        const rowspan = Math.max(1, Math.min(parseInt(cell.rowspan, 10) || 1, maxAvailRows));

        gridMap[rIdx][cIdx] = { skip: false, rowspan, colspan, masterR: rIdx, masterC: cIdx };

        for (let dr = 0; dr < rowspan; dr++) {
          for (let dc = 0; dc < colspan; dc++) {
            if (dr === 0 && dc === 0) continue;
            gridMap[rIdx + dr][cIdx + dc] = {
              skip: true,
              rowspan: 1,
              colspan: 1,
              masterR: rIdx,
              masterC: cIdx
            };
          }
        }
      }
    }
    return gridMap;
  },

  /**
   * 取得單一儲存格的最終顯示樣式
   */
  getEffectiveCellStyle(colObj, cellObj) {
    const eff = Object.assign({}, colObj, (cellObj && cellObj.override) || {});
    const align = (cellObj && cellObj.align) || eff.align || colObj.align || 'center';
    const fontSize = (cellObj && cellObj.fontSize) || eff.fontSize || colObj.fontSize || 12;
    const bold = Boolean((cellObj && cellObj.bold !== undefined) ? cellObj.bold : (eff.bold || colObj.bold));
    const italic = Boolean((cellObj && cellObj.italic !== undefined) ? cellObj.italic : (eff.italic || colObj.italic));
    const bgColor = (cellObj && cellObj.bgColor) || eff.bgColor || colObj.bgColor || '';
    const textColor = (cellObj && cellObj.textColor) || eff.textColor || colObj.textColor || '';

    return {
      align,
      fontSize,
      bold,
      italic,
      bgColor,
      textColor,
      cssText: `text-align:${align}; font-size:${fontSize}px; font-weight:${bold ? '700' : '400'}; font-style:${italic ? 'italic' : 'normal'}; ${bgColor ? `background-color:${bgColor};` : ''} ${textColor ? `color:${textColor};` : ''}`
    };
  },

  /**
   * 將欄位英文字母 (A, B, C... Z, AA) 轉為 0-based 欄位索引
   */
  colLettersToIndex(letters) {
    let idx = 0;
    const up = String(letters || '').toUpperCase();
    for (let i = 0; i < up.length; i++) {
      idx = idx * 26 + (up.charCodeAt(i) - 64);
    }
    return idx - 1;
  },

  /**
   * 依據列索引 (0-based) 與欄索引 (0-based) 取得該儲存格的數值（支援遞迴取得其他加總格的值，並防範循環參照）
   */
  getNumericValueAtCoord(sheetObj, rIdx, cIdx, cellValues, visitedSet) {
    const rows = sheetObj.rows || [];
    const cols = sheetObj.columns || [];
    if (rIdx < 0 || rIdx >= rows.length || cIdx < 0 || cIdx >= cols.length) return 0;

    const r = rows[rIdx];
    const c = cols[cIdx];
    if (!r || r.isSection || !c) return 0;

    const visitKey = `${r.id}_${c.id}`;
    if (visitedSet.has(visitKey)) return 0;

    const cellDef = (r.cells && r.cells[c.id]) || {};
    const eff = Object.assign({}, c, cellDef.override || {});

    if (eff.type === 'sum') {
      const nextVisited = new Set(visitedSet);
      nextVisited.add(visitKey);
      const nestedVal = parseFloat(this.computeSumCellValue(sheetObj, r, c, cellValues, nextVisited));
      return isNaN(nestedVal) ? 0 : nestedVal;
    }

    const rawVal = (cellValues && cellValues[r.id] && cellValues[r.id][c.id] !== undefined)
      ? cellValues[r.id][c.id]
      : cellDef.value;
    const num = parseFloat(rawVal);
    return isNaN(num) ? 0 : num;
  },

  /**
   * 計算加總欄位 (SUM) 數值：
   * 支援：
   * 1. 指定座標四則運算（例如：C1 = A1 + B1、=A1+B1、A2+B2-C2、A1*B1）
   * 2. 指定座標範圍（例如：A1:B3、SUM(A1:A5)）
   * 3. COL_SUM（本欄上方自動加總）與 ROW_SUM（同列左側自動加總）
   */
  computeSumCellValue(sheetOrTpl, rowObj, colObj, cellValues, visitedSet = new Set()) {
    const rows = sheetOrTpl.rows || [];
    const cols = sheetOrTpl.columns || [];
    const cellCfg = (rowObj.cells && rowObj.cells[colObj.id]) || {};
    const eff = Object.assign({}, colObj, cellCfg.override || {});
    let rawFormula = String(eff.formula || 'COL_SUM').trim().toUpperCase();

    const currentVisitKey = `${rowObj.id}_${colObj.id}`;
    visitedSet.add(currentVisitKey);

    if (!rawFormula || rawFormula === 'COL_SUM') {
      let sum = 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.id === rowObj.id) break;
        if (r.isSection) continue;
        const cIdx = cols.findIndex(x => x.id === colObj.id);
        sum += this.getNumericValueAtCoord(sheetOrTpl, i, cIdx, cellValues, visitedSet);
      }
      return Number.isInteger(sum) ? String(sum) : Number(sum.toFixed(2)).toString();
    }

    if (rawFormula === 'ROW_SUM') {
      let sum = 0;
      const rIdx = rows.findIndex(x => x.id === rowObj.id);
      for (let j = 0; j < cols.length; j++) {
        const c = cols[j];
        if (c.id === colObj.id) break;
        sum += this.getNumericValueAtCoord(sheetOrTpl, rIdx, j, cellValues, visitedSet);
      }
      return Number.isInteger(sum) ? String(sum) : Number(sum.toFixed(2)).toString();
    }

    // 支援使用者輸入 "C1 = A1 + B1" 或 "= A1 + B1"：自動剝除左側目標座標與等號
    let expr = rawFormula.replace(/^[A-Z]+\d+\s*=\s*/, '').replace(/^=\s*/, '').trim();

    // 1. 先展開 SUM(A1:B3) 或 A1:B3 區間語法
    const expandRange = (match, startColStr, startRowStr, endColStr, endRowStr) => {
      const c1 = this.colLettersToIndex(startColStr);
      const r1 = parseInt(startRowStr, 10) - 1;
      const c2 = this.colLettersToIndex(endColStr);
      const r2 = parseInt(endRowStr, 10) - 1;
      let rangeSum = 0;
      for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
        for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
          rangeSum += this.getNumericValueAtCoord(sheetOrTpl, r, c, cellValues, visitedSet);
        }
      }
      return `(${rangeSum})`;
    };

    expr = expr.replace(/SUM\(\s*([A-Z]+)(\d+)\s*:\s*([A-Z]+)(\d+)\s*\)/g, expandRange);
    expr = expr.replace(/\b([A-Z]+)(\d+)\s*:\s*([A-Z]+)(\d+)\b/g, expandRange);

    // 2. 將單一儲存格座標 (如 A1, B1, D12) 替換為實際數值
    expr = expr.replace(/\b([A-Z]+)(\d+)\b/g, (match, colLetters, rowDigits) => {
      const cIdx = this.colLettersToIndex(colLetters);
      const rIdx = parseInt(rowDigits, 10) - 1;
      const val = this.getNumericValueAtCoord(sheetOrTpl, rIdx, cIdx, cellValues, visitedSet);
      return `(${val})`;
    });

    // 3. 安全計算四則運算表達式
    if (/^[0-9+\-*/().\s]+$/.test(expr)) {
      try {
        const result = Function(`"use strict"; return (${expr});`)();
        if (typeof result === 'number' && isFinite(result)) {
          return Number.isInteger(result) ? String(result) : Number(result.toFixed(2)).toString();
        }
      } catch (e) {
        return '公式錯誤';
      }
    }
    return '0';
  },

  /**
   * 開啟 A4 PDF 預覽與匯出彈窗
   */
  openPdfModal(recordId, initialSheetIdx = 0) {
    this.pdfTargetRecordId = recordId;
    this.pdfActiveSheetIdx = initialSheetIdx || 0;
    document.getElementById('pdf-modal').classList.remove('hidden');
    this.refreshPdfModal();
  },

  closePdfModal() {
    document.getElementById('pdf-modal').classList.add('hidden');
  },

  changePdfSheetIndex(idx) {
    this.pdfActiveSheetIdx = parseInt(idx, 10) || 0;
    this.refreshPdfModal();
  },

  /**
   * 渲染 A4 預覽與匯出內容：
   * - 不顯示表頭列 (<thead>)
   * - 支援多工作表分頁切換
   * - 自動計算縮放比例，將表單縮放成單一 A4 頁面大小（表單與底部簽核格顯示在同一頁）
   */
  refreshPdfModal() {
    const rec = DB.state.records.find(r => r.id === this.pdfTargetRecordId);
    if (!rec) return;
    const tpl = DB.state.templates.find(t => t.id === rec.templateId);
    if (!tpl) return;

    const sheets = this.ensureTemplateSheets(tpl);
    if (this.pdfActiveSheetIdx >= sheets.length) this.pdfActiveSheetIdx = 0;
    const activeSheet = sheets[this.pdfActiveSheetIdx] || sheets[0];

    // 若此表單有多個分頁，於預覽工具列動態注入分頁切換選單
    let sheetSelectEl = document.getElementById('pdf-sheet-selector');
    if (sheets.length > 1) {
      if (!sheetSelectEl) {
        const orientEl = document.getElementById('pdf-orientation');
        if (orientEl && orientEl.parentNode) {
          sheetSelectEl = document.createElement('select');
          sheetSelectEl.id = 'pdf-sheet-selector';
          sheetSelectEl.className = 'bg-emerald-800 border border-emerald-500 rounded-lg px-2.5 py-1 text-xs text-white font-bold';
          sheetSelectEl.onchange = function () { App.changePdfSheetIndex(this.value); };
          orientEl.parentNode.insertBefore(sheetSelectEl, orientEl);
        }
      }
      if (sheetSelectEl) {
        sheetSelectEl.classList.remove('hidden');
        sheetSelectEl.innerHTML = sheets.map((sh, idx) =>
          `<option value="${idx}" ${idx === this.pdfActiveSheetIdx ? 'selected' : ''}>分頁：${sh.name}</option>`
        ).join('');
      }
    } else if (sheetSelectEl) {
      sheetSelectEl.classList.add('hidden');
    }

    const orient = document.getElementById('pdf-orientation').value;
    const container = document.getElementById('pdf-render-container');
    container.className = `a4-sheet ${orient} bg-white text-black shadow-2xl`;

    const renderSignBox = (stageObj) => {
      if (!stageObj) {
        return `<div class="h-14 flex items-center justify-center text-slate-300 text-xs">（待簽核）</div>`;
      }
      const userObj = DB.state.users.find(u => u.id === stageObj.accountId);
      return `
        <div class="flex flex-col items-center justify-center py-1">
          ${this.renderSealHTML({
            name: stageObj.name,
            time: stageObj.time,
            customSignature: userObj?.customSignature
          })}
        </div>
      `;
    };

    const gridMap = this.computeMergedGridMap(activeSheet);
    let rowsHtml = '';

    activeSheet.rows.forEach((r, rIdx) => {
      const rowHeightStyle = r.height ? `style="height:${r.height}px"` : '';
      if (r.isSection) {
        rowsHtml += `
          <tr ${rowHeightStyle}>
            <td colspan="${activeSheet.columns.length}" class="bg-slate-200 font-bold text-left px-2 py-1.5 text-xs">
              ${r.sectionTitle}
            </td>
          </tr>
        `;
        return;
      }

      rowsHtml += `<tr ${rowHeightStyle}>`;
      activeSheet.columns.forEach((c, cIdx) => {
        const mapInfo = gridMap[rIdx]?.[cIdx];
        if (mapInfo && mapInfo.skip) return;

        const colspan = mapInfo ? mapInfo.colspan : 1;
        const rowspan = mapInfo ? mapInfo.rowspan : 1;
        const cellDef = (r.cells && r.cells[c.id]) || {};
        const eff = Object.assign({}, c, cellDef.override || {});
        const styleInfo = this.getEffectiveCellStyle(c, cellDef);

        let val = (cellDef.readOnly && cellDef.value !== undefined)
          ? cellDef.value
          : (rec.cellValues?.[r.id]?.[c.id] !== undefined ? rec.cellValues[r.id][c.id] : (cellDef.value ?? ''));

        let displayHtml = '';
        if (eff.type === 'checkbox') {
          displayHtml = val ? `☑ ${eff.checkLabel || '正常'}` : `☐ 未勾選`;
        } else if (eff.type === 'sum') {
          const sumVal = this.computeSumCellValue(activeSheet, r, c, rec.cellValues);
          displayHtml = `<strong>${sumVal}${eff.unit ? ' ' + eff.unit : ''}</strong>`;
        } else if (eff.type === 'number') {
          const num = parseFloat(val);
          const hasMin = eff.min !== undefined && eff.min !== '' && !isNaN(parseFloat(eff.min));
          const hasMax = eff.max !== undefined && eff.max !== '' && !isNaN(parseFloat(eff.max));
          const out = !isNaN(num) && ((hasMin && num < parseFloat(eff.min)) || (hasMax && num > parseFloat(eff.max)));
          displayHtml = `<span class="${out ? 'text-red-600 font-bold' : ''}">${val !== '' ? val : '-'}${eff.unit ? ' ' + eff.unit : ''}${out ? ' (超標)' : ''}</span>`;
        } else {
          displayHtml = val !== '' ? String(val) : '';
        }

        rowsHtml += `<td colspan="${colspan}" rowspan="${rowspan}" style="${styleInfo.cssText}">${displayHtml}</td>`;
      });
      rowsHtml += '</tr>';
    });

    container.innerHTML = `
      <!-- 上半部：表單標題與自動縮放定檢表格（已移除表頭列顯示） -->
      <div id="pdf-top-section" class="w-full overflow-hidden">
        <div id="pdf-header-title" class="border-b-2 border-slate-900 pb-2 mb-2.5">
          <h2 class="text-xl font-black tracking-wide text-center">
            ${tpl.name}${sheets.length > 1 ? ` - ${activeSheet.name}` : ''}
          </h2>
        </div>

        <div id="pdf-table-scale-holder" class="w-full overflow-hidden">
          <div id="pdf-table-scale-box" style="transform-origin: top left;">
            <table class="pdf-table">
              <colgroup>
                ${activeSheet.columns.map(c => `<col style="width:${c.width || 100}px" />`).join('')}
              </colgroup>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 下半部：自動推至 A4 最下方之簽核格 -->
      <div id="pdf-bottom-sign" class="w-full mt-auto pt-2 shrink-0">
        <table class="pdf-table">
          <thead>
            <tr>
              <th class="w-1/3 bg-slate-100">檢查人</th>
              <th class="w-1/3 bg-slate-100">股長</th>
              <th class="w-1/3 bg-slate-100">課長</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-center">${renderSignBox(rec.approvals?.tech)}</td>
              <td class="text-center">${renderSignBox(rec.approvals?.leader)}</td>
              <td class="text-center">${renderSignBox(rec.approvals?.chief)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    // 執行 A4 單頁自動縮放計算
    requestAnimationFrame(() => {
      this.autoFitPdfToSingleA4();
    });
  },

  /**
   * 自動計算表格寬高與 A4 單頁可用空間比例，將表單等比例縮放至單頁 A4 內
   */
  autoFitPdfToSingleA4() {
    const container = document.getElementById('pdf-render-container');
    const titleEl = document.getElementById('pdf-header-title');
    const holderEl = document.getElementById('pdf-table-scale-holder');
    const scaleBoxEl = document.getElementById('pdf-table-scale-box');
    const signEl = document.getElementById('pdf-bottom-sign');
    if (!container || !holderEl || !scaleBoxEl || !signEl) return;

    // 先重置縮放以量測原始表格寬高
    scaleBoxEl.style.transform = 'none';
    scaleBoxEl.style.width = 'auto';
    holderEl.style.height = 'auto';

    const style = window.getComputedStyle(container);
    const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);

    const availWidth = container.clientWidth - padX;
    const availHeight = container.clientHeight - padY - (titleEl ? titleEl.offsetHeight + 10 : 0) - signEl.offsetHeight - 12;

    const tableEl = scaleBoxEl.querySelector('table');
    if (!tableEl) return;

    const naturalWidth = Math.max(tableEl.scrollWidth, tableEl.offsetWidth, 1);
    const naturalHeight = Math.max(tableEl.scrollHeight, tableEl.offsetHeight, 1);

    const scaleX = availWidth / naturalWidth;
    const scaleY = availHeight / naturalHeight;
    const scale = Math.min(1, scaleX, scaleY);

    if (scale < 1) {
      scaleBoxEl.style.width = `${naturalWidth}px`;
      scaleBoxEl.style.transform = `scale(${scale})`;
      holderEl.style.width = `${availWidth}px`;
      holderEl.style.height = `${Math.ceil(naturalHeight * scale)}px`;
    } else {
      scaleBoxEl.style.width = '100%';
      scaleBoxEl.style.transform = 'none';
      holderEl.style.width = '100%';
      holderEl.style.height = `${naturalHeight}px`;
    }
  },

  /**
   * 匯出並下載 PDF（確保縮放成單一 A4 頁面）
   */
  downloadPdfFile() {
    this.autoFitPdfToSingleA4();
    const rec = DB.state.records.find(r => r.id === this.pdfTargetRecordId);
    const orient = document.getElementById('pdf-orientation').value;
    const element = document.getElementById('pdf-render-container');
    const filename = `${rec ? rec.templateName + '_' + rec.month : 'Y642定檢表'}.pdf`;

    html2pdf().set({
      margin: 0,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: orient },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }).from(element).toPdf().get('pdf').then((pdf) => {
      const totalPages = pdf.internal.getNumberOfPages();
      if (totalPages > 1) {
        for (let p = totalPages; p > 1; p--) {
          pdf.deletePage(p);
        }
      }
    }).save();
  },

  updateSyncBadge(status, text) {
    const el = document.getElementById('sync-status-badge');
    if (!el) return;
    if (status === 'cloud-ok') {
      el.className = 'px-2 py-0.5 text-[10px] rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-600 font-medium shrink-0';
      el.innerHTML = `<i class="fa-solid fa-cloud-bolt mr-1"></i>${text}`;
    } else if (status === 'syncing') {
      el.className = 'px-2 py-0.5 text-[10px] rounded-full bg-blue-900/80 text-blue-200 border border-blue-500 font-medium shrink-0';
      el.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin mr-1"></i>${text}`;
    } else if (status === 'cloud-err') {
      el.className = 'px-2 py-0.5 text-[10px] rounded-full bg-amber-900/80 text-amber-300 border border-amber-600 font-medium shrink-0';
      el.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i>${text}`;
    } else {
      el.className = 'px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 border border-slate-600 font-medium shrink-0';
      el.innerHTML = `<i class="fa-solid fa-hard-drive mr-1"></i>${text}`;
    }
  },

  toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const colors = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-red-600 text-white',
      info: 'bg-slate-800 text-white'
    };
    const item = document.createElement('div');
    item.className = `px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 pointer-events-auto transition-all ${colors[type] || colors.info}`;
    item.innerHTML = `<i class="fa-solid fa-bell"></i><span>${msg}</span>`;
    container.appendChild(item);
    setTimeout(() => item.remove(), 3200);
  }
};

window.addEventListener('DOMContentLoaded', () => App.init());

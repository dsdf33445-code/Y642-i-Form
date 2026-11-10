/**
 * Y642 每月定檢表系統 - 登入驗證、角色模組權限控管、二維合併儲存格引擎、電子職章與 PDF 匯出核心
 */
window.App = {
  currentUser: null,        // 當前登入之帳號物件
  activeTechMember: '',     // 若為 Y642A~D 共用帳號，當前選取的填表技術員姓名
  currentModule: 'fill',    // 'fill' | 'builder' | 'manage' | 'completed' | 'personnel'
  activeRecordId: null,     // 當前於填寫模組開啟的紀錄 ID
  activeTemplateId: null,   // 當前於設計表單開啟的範本 ID
  pdfTargetRecordId: null,  // 當前預覽 PDF 的紀錄 ID
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
   * 快速帶入帳號（僅帶入帳號，清空密碼欄並自動聚焦至密碼輸入框）
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
   * 依據標籤名稱回傳專屬顏色樣式 (A股、B股、C股、D股、其他)
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
   * 依據填寫週期回傳顏色樣式 (每月、每季、半年、每年)
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

  /**
   * 取得乾淨的「職稱」名稱（去除括號附註，例如將「B股股長 (最高管理員)」轉為「B股股長」）
   */
  getCleanTitle(user) {
    if (!user) return '';
    const cleaned = String(user.roleTitle || '').replace(/\s*[\(（].*?[\)）]/g, '').trim();
    if (cleaned) return cleaned;
    const roleMap = { tech: '技術員', leader: '股長', engineer: '工程師', chief: '課長', admin: '管理員' };
    return roleMap[user.role] || '人員';
  },

  /**
   * 取得右上角顯示之「職位 + 姓名」（例如：課長 李宗霖、B股股長 鄭毓邦、B股技術員 吳宗穎）
   */
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

  /**
   * 依據登入者角色回傳可顯示的模組清單
   */
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

  /**
   * 檢查某張表單範本是否對指定使用者可見
   */
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
   * 回傳結構：gridMap[rIdx][cIdx] = { skip: Boolean, rowspan: Number, colspan: Number, masterR: Number, masterC: Number }
   */
  computeMergedGridMap(tpl) {
    const rowCount = (tpl.rows || []).length;
    const colCount = (tpl.columns || []).length;
    const gridMap = Array.from({ length: rowCount }, () =>
      Array.from({ length: colCount }, () => ({ skip: false, rowspan: 1, colspan: 1 }))
    );

    for (let rIdx = 0; rIdx < rowCount; rIdx++) {
      const row = tpl.rows[rIdx];
      if (!row || row.isSection) continue;

      for (let cIdx = 0; cIdx < colCount; cIdx++) {
        if (gridMap[rIdx][cIdx].skip) continue;

        const col = tpl.columns[cIdx];
        const cell = (row.cells && row.cells[col.id]) || {};

        let colspan = Math.max(1, Math.min(parseInt(cell.colspan, 10) || 1, colCount - cIdx));
        // 避免跨欄覆蓋到已經被上方跨列佔用的格子
        for (let dc = 1; dc < colspan; dc++) {
          if (gridMap[rIdx][cIdx + dc].skip) {
            colspan = dc;
            break;
          }
        }

        // 計算最大可用跨列數（遇到大分類列 isSection 或表格底端即停止）
        let maxAvailRows = 1;
        for (let dr = 1; rIdx + dr < rowCount; dr++) {
          if (tpl.rows[rIdx + dr].isSection) break;
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
   * 取得單一儲存格的最終顯示樣式（整合整欄設定與單格設定：靠左/置中/靠右、字型大小、粗體、斜體、背景色、文字色）
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
   * 計算加總欄位 (SUM) 數值
   */
  computeSumCellValue(template, rowObj, colObj, cellValues) {
    const cellCfg = (rowObj.cells && rowObj.cells[colObj.id]) || {};
    const eff = Object.assign({}, colObj, cellCfg.override || {});
    const formula = (eff.formula || 'COL_SUM').trim().toUpperCase();

    let sum = 0;
    if (formula === 'COL_SUM') {
      for (const r of template.rows) {
        if (r.id === rowObj.id) break;
        if (r.isSection) continue;
        const rawVal = cellValues?.[r.id]?.[colObj.id] ?? r.cells?.[colObj.id]?.value;
        const num = parseFloat(rawVal);
        if (!isNaN(num)) sum += num;
      }
    } else if (formula === 'ROW_SUM') {
      for (const c of template.columns) {
        if (c.id === colObj.id) break;
        const rawVal = cellValues?.[rowObj.id]?.[c.id] ?? rowObj.cells?.[c.id]?.value;
        const num = parseFloat(rawVal);
        if (!isNaN(num)) sum += num;
      }
    }
    return Number.isInteger(sum) ? String(sum) : sum.toFixed(2);
  },

  /**
   * 開啟 A4 PDF 預覽與匯出彈窗
   */
  openPdfModal(recordId) {
    this.pdfTargetRecordId = recordId;
    document.getElementById('pdf-modal').classList.remove('hidden');
    this.refreshPdfModal();
  },

  closePdfModal() {
    document.getElementById('pdf-modal').classList.add('hidden');
  },

  /**
   * 渲染 A4 預覽與匯出內容：
   * 1. 不顯示「Y642 電力維護課｜分類標籤｜週期」
   * 2. 完整支援上下合併 (rowspan)、左右合併 (colspan)、靠左/置中/靠右對齊、字型大小
   * 3. 簽核格自動移至 A4 最下方，並維持標準 A4 大小
   */
  refreshPdfModal() {
    const rec = DB.state.records.find(r => r.id === this.pdfTargetRecordId);
    if (!rec) return;
    const tpl = DB.state.templates.find(t => t.id === rec.templateId);
    if (!tpl) return;

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

    const gridMap = this.computeMergedGridMap(tpl);
    let rowsHtml = '';

    tpl.rows.forEach((r, rIdx) => {
      const rowHeightStyle = r.height ? `style="height:${r.height}px"` : '';
      if (r.isSection) {
        rowsHtml += `
          <tr ${rowHeightStyle}>
            <td colspan="${tpl.columns.length}" class="bg-slate-200 font-bold text-left px-2 py-1.5 text-xs">
              ${r.sectionTitle}
            </td>
          </tr>
        `;
        return;
      }

      rowsHtml += `<tr ${rowHeightStyle}>`;
      tpl.columns.forEach((c, cIdx) => {
        const mapInfo = gridMap[rIdx]?.[cIdx];
        if (mapInfo && mapInfo.skip) return;

        const colspan = mapInfo ? mapInfo.colspan : 1;
        const rowspan = mapInfo ? mapInfo.rowspan : 1;
        const cellDef = (r.cells && r.cells[c.id]) || {};
        const eff = Object.assign({}, c, cellDef.override || {});
        const styleInfo = this.getEffectiveCellStyle(c, cellDef);

        let val = rec.cellValues?.[r.id]?.[c.id];
        if (val === undefined) val = cellDef.value ?? '';

        let displayHtml = '';
        if (eff.type === 'checkbox') {
          displayHtml = val ? `☑ ${eff.checkLabel || '正常'}` : `☐ 未勾選`;
        } else if (eff.type === 'sum') {
          const sumVal = this.computeSumCellValue(tpl, r, c, rec.cellValues);
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
      <!-- 上半部：表單標題與定檢表格 -->
      <div class="w-full">
        <div class="border-b-2 border-slate-900 pb-2.5 mb-3 flex items-end justify-between">
          <div>
            <h2 class="text-xl font-black tracking-wide">${tpl.name}</h2>
          </div>
          <div class="text-right text-xs space-y-0.5 font-mono">
            <div>表單編號：${tpl.code}</div>
            <div>定檢月份：${rec.month}</div>
            <div>點檢日期：${rec.inspectDate}</div>
          </div>
        </div>

        <table class="pdf-table mb-3">
          <thead>
            <tr>
              ${tpl.columns.map(c => `<th style="width:${c.width || 100}px; font-size:${c.fontSize || 12}px;">${c.title}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <!-- 下半部：自動推至 A4 最下方之綜合備註與簽核格 -->
      <div class="w-full mt-auto pt-2">
        <div class="border border-slate-800 p-2 text-xs mb-2.5">
          <strong>綜合備註與異常說明：</strong> ${rec.note || '無異常事項。'}
        </div>

        <table class="pdf-table">
          <thead>
            <tr>
              <th class="w-1/3">檢查人</th>
              <th class="w-1/3">股長</th>
              <th class="w-1/3">課長</th>
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
  },

  /**
   * 匯出並下載 PDF（維持標準 A4 大小且簽核格置底，不產生多餘空白頁）
   */
  downloadPdfFile() {
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
      if (totalPages > 1 && element.scrollHeight < 1150) {
        pdf.deletePage(totalPages);
      }
    }).save();
  },

  updateSyncBadge(status, text) {
    const el = document.getElementById('sync-status-badge');
    if (!el) return;
    if (status === 'cloud-ok') {
      el.className = 'px-2 py-0.5 text-[10px] rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-600 font-medium shrink-0';
      el.innerHTML = `<i class="fa-solid fa-cloud-bolt mr-1"></i>${text}`;
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
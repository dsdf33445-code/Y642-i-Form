/**
 * Y642 每月定檢表系統 - 登入驗證、角色模組權限控管、標籤色彩、電子職章與 PDF 匯出核心
 */
window.App = {
  currentUser: null,        // 當前登入之帳號物件
  activeTechMember: '',     // 若為 Y642A~D 共用帳號，當前選取的填表技術員姓名
  currentModule: 'fill',    // 'fill' | 'builder' | 'manage' | 'completed' | 'personnel'
  activeRecordId: null,     // 當前於填寫模組開啟的紀錄 ID
  activeTemplateId: null,   // 當前於設計表單開啟的範本 ID
  pdfTargetRecordId: null,  // 當前預覽 PDF 的紀錄 ID

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
        { id: 'builder', title: '設計表單', icon: 'fa-table-cells' },
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

    // 右上角只顯示「職位 + 姓名」（例：課長 李宗霖，B股股長 鄭毓邦，B股技術員 吳宗穎）
    const headerDisplayEl = document.getElementById('current-user-display');
    if (headerDisplayEl) {
      headerDisplayEl.textContent = this.getFormattedUserHeaderTitle(this.currentUser);
    }

    const accCodeEl = document.getElementById('sidebar-account-code');
    if (accCodeEl) {
      accCodeEl.textContent = `帳號: ${u.account}`;
    }

    // 左下角職章預覽：只顯示 姓名 + 日期(年月日)
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

    let rowsHtml = '';
    tpl.rows.forEach(r => {
      if (r.isSection) {
        rowsHtml += `
          <tr>
            <td colspan="${tpl.columns.length}" class="bg-slate-200 font-bold text-left px-2 py-1.5 text-xs">
              ${r.sectionTitle}
            </td>
          </tr>
        `;
        return;
      }

      rowsHtml += '<tr>';
      let skipCount = 0;
      tpl.columns.forEach((c) => {
        if (skipCount > 0) {
          skipCount--;
          return;
        }
        const cellDef = (r.cells && r.cells[c.id]) || {};
        const colspan = parseInt(cellDef.colspan, 10) || 1;
        if (colspan > 1) skipCount = colspan - 1;

        const eff = Object.assign({}, c, cellDef.override || {});
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

        rowsHtml += `<td colspan="${colspan}" style="text-align:${eff.align || 'center'}">${displayHtml}</td>`;
      });
      rowsHtml += '</tr>';
    });

    container.innerHTML = `
      <div class="border-b-2 border-slate-900 pb-2.5 mb-3 flex items-end justify-between">
        <div>
          <div class="text-xs font-bold text-slate-600">${tpl.department || 'Y642 電力維護課'}｜分類標籤：【${rec.tag}】</div>
          <h2 class="text-lg font-black tracking-wide mt-0.5">${tpl.name}</h2>
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
            ${tpl.columns.map(c => `<th style="width:${c.width || 100}px">${c.title}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="border border-slate-800 p-2 text-xs mb-3">
        <strong>綜合備註與異常說明：</strong> ${rec.note || '無異常事項。'}
      </div>

      <table class="pdf-table">
        <thead>
          <tr>
            <th class="w-1/3">第一級：點檢技術員</th>
            <th class="w-1/3">第二級：股長 / 工程師複核</th>
            <th class="w-1/3">第三級：課長決行核定</th>
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
    `;
  },

  /**
   * 匯出並下載 PDF（消除多餘空白頁）
   */
  downloadPdfFile() {
    const rec = DB.state.records.find(r => r.id === this.pdfTargetRecordId);
    const orient = document.getElementById('pdf-orientation').value;
    const element = document.getElementById('pdf-render-container');
    const filename = `${rec ? rec.templateName + '_' + rec.month : 'Y642定檢表'}.pdf`;

    html2pdf().set({
      margin: [6, 6, 6, 6],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: orient },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }).from(element).toPdf().get('pdf').then((pdf) => {
      const totalPages = pdf.internal.getNumberOfPages();
      if (totalPages > 1 && element.scrollHeight < 1020) {
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
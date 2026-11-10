/**
 * 模組 1：填寫表單 / 待簽核表單
 * - 依當前使用者顯示可填寫的表單（預設僅能填寫該股及其他表單，或依人員管理設定之顯示表單）
 * - 完整支援設計表單設定之「上下合併 (rowspan)」、「左右合併 (colspan)」、「靠左/置中/靠右對齊」與「字型大小」
 * - 三級簽核欄名稱：檢查人、股長、課長
 */
window.ModuleFill = {
  filterTag: 'ALL',

  render() {
    const container = document.getElementById('view-fill');
    const u = App.currentUser;
    if (!container || !u) return;

    const accessibleTemplates = DB.state.templates.filter(tpl => App.canUserAccessTemplate(u, tpl));

    const activeRecords = DB.state.records.filter(r => {
      if (r.stage === 'completed') return false;
      if (u.role === 'chief') {
        return r.stage === 'pending_chief' || r.currentAssigneeId === u.id;
      }
      const tpl = DB.state.templates.find(t => t.id === r.templateId);
      const canSeeTpl = tpl ? App.canUserAccessTemplate(u, tpl) : (u.allowedTags || []).includes(r.tag);
      return canSeeTpl || r.currentAssigneeId === u.id || r.fillerAccountId === u.id;
    });

    if (!App.activeRecordId || !activeRecords.some(r => r.id === App.activeRecordId)) {
      const myTurn = activeRecords.find(r => r.currentAssigneeId === u.id);
      App.activeRecordId = myTurn ? myTurn.id : (activeRecords[0]?.id || null);
    }

    const currentRec = activeRecords.find(r => r.id === App.activeRecordId) || null;
    const currentTpl = currentRec ? DB.state.templates.find(t => t.id === currentRec.templateId) : null;

    container.innerHTML = `
      <!-- 頂部工具列：選擇進行中定檢單 / 建立新月份定檢單 / 技術員切換 -->
      <div class="bg-white border-b border-slate-200 px-3 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
            <i class="fa-solid ${u.role === 'chief' ? 'fa-file-signature text-purple-600' : 'fa-pen-to-square text-blue-600'}"></i>
            ${u.role === 'chief' ? '待課長簽核表單：' : '目前作業表單：'}
          </span>

          <select onchange="ModuleFill.selectRecord(this.value)"
            class="border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold bg-slate-50 focus:outline-none focus:border-blue-600 max-w-xs sm:max-w-md">
            ${activeRecords.length === 0
              ? '<option value="">-- 目前無進行中或待簽核表單 --</option>'
              : activeRecords.map(r => {
                  const isMyTurn = r.currentAssigneeId === u.id;
                  const stageLabel = this.getStageLabel(r.stage);
                  return `<option value="${r.id}" ${r.id === App.activeRecordId ? 'selected' : ''}>
                    ${isMyTurn ? '★【待您處理】' : ''}[${r.tag}] ${r.templateName} (${r.month}) - ${stageLabel}
                  </option>`;
                }).join('')
            }
          </select>

          ${u.role !== 'chief' ? `
            <button onclick="ModuleFill.openNewRecordModal()"
              class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition">
              <i class="fa-solid fa-plus"></i> 新增填寫表單
            </button>
          ` : ''}
        </div>

        <!-- 若為共用技術員帳號 (Y642A~D)，提供填表人姓名下拉切換 -->
        <div class="flex items-center gap-2">
          ${u.isSharedAccount ? `
            <div class="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-xl text-xs">
              <span class="font-bold text-emerald-800"><i class="fa-solid fa-user-check mr-1"></i>檢查人：</span>
              <select onchange="ModuleFill.changeActiveTechMember(this.value)"
                class="bg-white border border-emerald-400 rounded-lg px-2 py-0.5 font-bold text-emerald-900">
                ${(u.members || []).map(m => `<option value="${m}" ${m === App.activeTechMember ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
          ` : ''}

          ${currentRec ? `
            <button onclick="App.openPdfModal('${currentRec.id}')"
              class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5">
              <i class="fa-solid fa-file-pdf text-red-400"></i> 預覽匯出 PDF
            </button>
          ` : ''}
        </div>
      </div>

      <!-- 主內容：若無表單顯示引導，若有則顯示進度條 + 填寫表格 + 簽核操作區 -->
      <div class="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
        ${!currentRec || !currentTpl ? this.renderEmptyState(accessibleTemplates) : this.renderActiveRecordWorkspace(currentRec, currentTpl)}
      </div>

      <!-- 新增填寫定檢表彈窗 -->
      <div id="new-record-modal" class="fixed inset-0 z-50 hidden bg-slate-900/75 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
          <div class="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
            <h3 class="font-bold text-sm"><i class="fa-solid fa-file-circle-plus mr-2 text-blue-400"></i>新增定檢表作業</h3>
            <button onclick="ModuleFill.closeNewRecordModal()" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="p-5 space-y-3.5 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">選擇可填寫之定檢表單（僅顯示您所屬股別及其他表單）</label>
              <select id="new-rec-template" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold bg-slate-50">
                ${accessibleTemplates.map(t => `<option value="${t.id}">[${t.tag}｜${t.cycle || '每月'}] ${t.name} (${t.code})</option>`).join('')}
              </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">定檢月份</label>
                <input type="month" id="new-rec-month" value="${new Date().toISOString().slice(0, 7)}"
                  class="w-full border border-slate-300 rounded-xl px-3 py-2 font-mono" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">點檢日期</label>
                <input type="date" id="new-rec-date" value="${new Date().toISOString().slice(0, 10)}"
                  class="w-full border border-slate-300 rounded-xl px-3 py-2 font-mono" />
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button onclick="ModuleFill.closeNewRecordModal()" class="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold">取消</button>
              <button onclick="ModuleFill.createNewRecord()" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">建立並開始填寫</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  getStageLabel(stage) {
    const map = {
      draft_tech: '檢查人填寫中',
      pending_leader: '待股長簽核',
      pending_chief: '待課長簽核',
      completed: '已核定歸檔'
    };
    return map[stage] || stage;
  },

  renderEmptyState(accessibleTemplates) {
    const u = App.currentUser;
    return `
      <div class="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-lg mx-auto my-8 shadow-sm">
        <div class="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 text-2xl">
          <i class="fa-solid fa-clipboard-list"></i>
        </div>
        <h3 class="text-base font-bold text-slate-800">目前沒有待處理的定檢表單</h3>
        <p class="text-xs text-slate-500 mt-1 leading-relaxed">
          ${u.role === 'chief'
            ? '所有呈報至課長的定檢表皆已簽核完畢！您可切換至「已完成表單」查閱歸檔紀錄。'
            : `您目前可填寫【${(u.allowedTags || []).join('、')}】共 ${accessibleTemplates.length} 張定檢表範本。`}
        </p>
        ${u.role !== 'chief' && accessibleTemplates.length > 0 ? `
          <button onclick="ModuleFill.openNewRecordModal()"
            class="mt-4 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow">
            <i class="fa-solid fa-plus mr-1.5"></i>立即建立本月定檢表
          </button>
        ` : ''}
      </div>
    `;
  },

  renderActiveRecordWorkspace(rec, tpl) {
    const u = App.currentUser;
    const isMyTurn = rec.currentAssigneeId === u.id;
    const canEditCells = (rec.stage === 'draft_tech' && (rec.fillerAccountId === u.id || u.role === 'leader' || u.role === 'engineer' || u.role === 'admin')) ||
                         (rec.stage === 'pending_leader' && rec.currentAssigneeId === u.id);

    const fillerAcc = DB.state.users.find(x => x.id === rec.fillerAccountId);
    const leaderUser = fillerAcc ? DB.state.users.find(x => x.id === fillerAcc.supervisorId) : null;
    const chiefUser = DB.state.users.find(x => x.role === 'chief');

    return `
      <!-- 三級簽核進度橫幅 -->
      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-1 rounded-lg text-xs font-black ${App.getTagBadgeClass(rec.tag)}">${rec.tag}</span>
            <span class="px-2.5 py-1 rounded-lg text-xs font-bold ${App.getCycleBadgeClass(tpl.cycle || '每月')}">
              <i class="fa-solid fa-rotate mr-1"></i>${tpl.cycle || '每月'}
            </span>
            <h2 class="text-sm sm:text-base font-bold text-slate-900">${tpl.name}</h2>
            <span class="text-xs font-mono text-slate-400">(${rec.month})</span>
          </div>
          <div class="flex items-center gap-2">
            ${canEditCells ? `
              <button onclick="ModuleFill.quickCheckAllNormal('${rec.id}')"
                class="px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-bold transition">
                <i class="fa-solid fa-check-double mr-1"></i>一鍵全設為正常
              </button>
            ` : ''}
          </div>
        </div>

        <!-- 逐級陳核三階段視覺卡片：檢查人 -> 股長 -> 課長 -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <!-- Stage 1: 檢查人 -->
          <div class="p-3 rounded-xl border ${rec.stage === 'draft_tech' ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-100' : 'border-slate-200 bg-slate-50'} flex items-center justify-between">
            <div>
              <div class="font-bold text-slate-800 text-sm">檢查人</div>
              <div class="text-[11px] text-slate-500 mt-0.5">
                負責：${rec.approvals?.tech ? rec.approvals.tech.name : `${rec.fillerMemberName}`}
              </div>
              ${rec.approvals?.tech ? `<div class="text-[10px] text-emerald-600 font-mono mt-0.5">✓ 已陳核 ${rec.approvals.tech.time.slice(0, 10)}</div>` : '<div class="text-[10px] text-blue-600 font-bold mt-0.5">● 填寫作業中</div>'}
            </div>
            <div>
              ${rec.approvals?.tech ? App.renderSealHTML({ name: rec.approvals.tech.name, time: rec.approvals.tech.time }) : ''}
            </div>
          </div>

          <!-- Stage 2: 股長 -->
          <div class="p-3 rounded-xl border ${rec.stage === 'pending_leader' ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-100' : 'border-slate-200 bg-slate-50'} flex items-center justify-between">
            <div>
              <div class="font-bold text-slate-800 text-sm">股長</div>
              <div class="text-[11px] text-slate-500 mt-0.5">
                負責：${rec.approvals?.leader ? rec.approvals.leader.name : (leaderUser ? `${leaderUser.name}` : '各股股長')}
              </div>
              ${rec.approvals?.leader
                ? `<div class="text-[10px] text-emerald-600 font-mono mt-0.5">✓ 已簽核 ${rec.approvals.leader.time.slice(0, 10)}</div>`
                : (rec.stage === 'pending_leader' ? '<div class="text-[10px] text-amber-600 font-bold mt-0.5">● 待股長簽章</div>' : '<div class="text-[10px] text-slate-400 mt-0.5">等待檢查人陳核</div>')}
            </div>
            <div>
              ${rec.approvals?.leader ? App.renderSealHTML({ name: rec.approvals.leader.name, time: rec.approvals.leader.time }) : ''}
            </div>
          </div>

          <!-- Stage 3: 課長 -->
          <div class="p-3 rounded-xl border ${rec.stage === 'pending_chief' ? 'border-purple-500 bg-purple-50/50 ring-2 ring-purple-100' : 'border-slate-200 bg-slate-50'} flex items-center justify-between">
            <div>
              <div class="font-bold text-slate-800 text-sm">課長</div>
              <div class="text-[11px] text-slate-500 mt-0.5">
                負責：${chiefUser ? `${chiefUser.name}` : '李宗霖'}
              </div>
              ${rec.approvals?.chief
                ? `<div class="text-[10px] text-emerald-600 font-mono mt-0.5">✓ 已核定 ${rec.approvals.chief.time.slice(0, 10)}</div>`
                : (rec.stage === 'pending_chief' ? '<div class="text-[10px] text-purple-600 font-bold mt-0.5">● 待課長簽章</div>' : '<div class="text-[10px] text-slate-400 mt-0.5">等待股長陳核</div>')}
            </div>
            <div>
              ${rec.approvals?.chief ? App.renderSealHTML({ name: rec.approvals.chief.name, time: rec.approvals.chief.time }) : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- 填寫表格區 (支援手機水平滑動 RWD + 上下/左右合併 + 對齊與字型大小) -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="sheet-grid">
            <thead>
              <tr>
                ${tpl.columns.map(c => `<th class="col-header" style="width:${c.width || 110}px; font-size:${c.fontSize || 12}px;">${c.title}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${this.renderFillTableRows(rec, tpl, canEditCells)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 備註與逐級陳核簽章行動區 -->
      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">定檢綜合備註 / 異常處理說明</label>
          <textarea rows="2" ${canEditCells || isMyTurn ? '' : 'disabled'}
            onchange="ModuleFill.updateNote('${rec.id}', this.value)"
            placeholder="請填寫定檢補充說明或異常改善情形..."
            class="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-blue-600">${rec.note || ''}</textarea>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div class="text-xs text-slate-500">
            ${isMyTurn
              ? `<span class="text-blue-700 font-bold"><i class="fa-solid fa-circle-exclamation mr-1"></i>目前輪到您處理此表單，確認無誤後請點擊右側按鈕蓋章陳核。</span>`
              : `<span>目前待處理人：<strong>${this.getUserDisplayName(rec.currentAssigneeId)}</strong></span>`
            }
          </div>

          <div class="flex items-center gap-2">
            ${this.renderActionButtons(rec, isMyTurn)}
          </div>
        </div>
      </div>
    `;
  },

  renderFillTableRows(rec, tpl, canEditCells) {
    const gridMap = App.computeMergedGridMap(tpl);

    return tpl.rows.map((r, rIdx) => {
      const rowHeightStyle = r.height ? `style="height:${r.height}px"` : '';

      if (r.isSection) {
        return `
          <tr ${rowHeightStyle}>
            <td colspan="${tpl.columns.length}" class="bg-slate-800 text-white font-bold text-xs px-3 py-2">
              <i class="fa-solid fa-layer-group mr-1.5 text-blue-400"></i>${r.sectionTitle}
            </td>
          </tr>
        `;
      }

      const cellsHtml = tpl.columns.map((c, cIdx) => {
        const mapInfo = gridMap[rIdx]?.[cIdx];
        if (mapInfo && mapInfo.skip) return '';

        const colspan = mapInfo ? mapInfo.colspan : 1;
        const rowspan = mapInfo ? mapInfo.rowspan : 1;
        const cellDef = (r.cells && r.cells[c.id]) || {};
        const eff = Object.assign({}, c, cellDef.override || {});
        const styleInfo = App.getEffectiveCellStyle(c, cellDef);
        const isReadOnly = !canEditCells || cellDef.readOnly;

        let val = rec.cellValues?.[r.id]?.[c.id];
        if (val === undefined) val = cellDef.value ?? '';

        if (eff.type === 'sum') {
          const sumVal = App.computeSumCellValue(tpl, r, c, rec.cellValues);
          return `
            <td colspan="${colspan}" rowspan="${rowspan}" style="${styleInfo.cssText}" class="bg-amber-50/70 px-2 py-2 font-mono font-extrabold text-amber-900">
              ∑ ${sumVal} ${eff.unit || ''}
            </td>
          `;
        }

        if (cellDef.readOnly && eff.type === 'text') {
          return `
            <td colspan="${colspan}" rowspan="${rowspan}" class="bg-slate-50 px-2.5 py-2 text-slate-700" style="${styleInfo.cssText}">
              ${val}
            </td>
          `;
        }

        if (eff.type === 'number') {
          const num = parseFloat(val);
          const hasMin = eff.min !== undefined && eff.min !== '' && !isNaN(parseFloat(eff.min));
          const hasMax = eff.max !== undefined && eff.max !== '' && !isNaN(parseFloat(eff.max));
          const isOut = !isNaN(num) && ((hasMin && num < parseFloat(eff.min)) || (hasMax && num > parseFloat(eff.max)));
          const rangeHint = (hasMin || hasMax) ? `${hasMin ? eff.min : '-∞'} ~ ${hasMax ? eff.max : '∞'} ${eff.unit || ''}` : '';

          return `
            <td colspan="${colspan}" rowspan="${rowspan}" style="${styleInfo.bgColor ? `background-color:${styleInfo.bgColor};` : ''}" class="p-1.5 ${isOut ? 'cell-out-of-range' : (val !== '' ? 'cell-in-range' : '')}">
              <div class="flex items-center gap-1">
                <input type="number" step="any" value="${val}" ${isReadOnly ? 'disabled' : ''}
                  style="${styleInfo.cssText}"
                  onchange="ModuleFill.updateCellValue('${rec.id}','${r.id}','${c.id}',this.value)"
                  class="w-full px-2 py-1 font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-600" />
                ${eff.unit ? `<span class="text-[11px] text-slate-500 font-mono shrink-0">${eff.unit}</span>` : ''}
              </div>
              <div class="flex items-center justify-between text-[10px] mt-0.5 px-1">
                <span class="text-slate-400 font-mono">${rangeHint}</span>
                ${!isNaN(num) ? (isOut ? '<span class="text-red-600 font-bold">⚠超標</span>' : '<span class="text-emerald-600 font-bold">✓合格</span>') : ''}
              </div>
            </td>
          `;
        }

        if (eff.type === 'checkbox') {
          const checked = Boolean(val);
          return `
            <td colspan="${colspan}" rowspan="${rowspan}" style="${styleInfo.cssText}" class="p-2">
              <label class="inline-flex items-center gap-1.5 cursor-pointer select-none font-bold ${checked ? 'text-emerald-700' : 'text-slate-500'}">
                <input type="checkbox" ${checked ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''}
                  onchange="ModuleFill.updateCellValue('${rec.id}','${r.id}','${c.id}',this.checked)"
                  class="w-4 h-4 accent-emerald-600 rounded" />
                <span>${eff.checkLabel || '正常'}</span>
              </label>
            </td>
          `;
        }

        if (eff.type === 'select') {
          const opts = Array.isArray(eff.options) ? eff.options : ['合格', '待追蹤', '異常需檢修'];
          return `
            <td colspan="${colspan}" rowspan="${rowspan}" style="${styleInfo.bgColor ? `background-color:${styleInfo.bgColor};` : ''}" class="p-1.5">
              <select ${isReadOnly ? 'disabled' : ''}
                style="${styleInfo.cssText}"
                onchange="ModuleFill.updateCellValue('${rec.id}','${r.id}','${c.id}',this.value)"
                class="w-full px-2 py-1.5 font-bold border border-slate-300 rounded-lg bg-white">
                <option value="">-- 請選擇 --</option>
                ${opts.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
              </select>
            </td>
          `;
        }

        if (eff.type === 'date') {
          return `
            <td colspan="${colspan}" rowspan="${rowspan}" style="${styleInfo.bgColor ? `background-color:${styleInfo.bgColor};` : ''}" class="p-1.5">
              <input type="date" value="${val}" ${isReadOnly ? 'disabled' : ''}
                style="${styleInfo.cssText}"
                onchange="ModuleFill.updateCellValue('${rec.id}','${r.id}','${c.id}',this.value)"
                class="w-full px-2 py-1 font-mono border border-slate-300 rounded-lg bg-white" />
            </td>
          `;
        }

        return `
          <td colspan="${colspan}" rowspan="${rowspan}" style="${styleInfo.bgColor ? `background-color:${styleInfo.bgColor};` : ''}" class="p-1.5">
            <input type="text" value="${val}" ${isReadOnly ? 'disabled' : ''}
              style="${styleInfo.cssText}"
              onchange="ModuleFill.updateCellValue('${rec.id}','${r.id}','${c.id}',this.value)"
              class="w-full px-2 py-1 border border-slate-300 rounded-lg bg-white" />
          </td>
        `;
      }).join('');

      return `<tr ${rowHeightStyle}>${cellsHtml}</tr>`;
    }).join('');
  },

  renderActionButtons(rec, isMyTurn) {
    const u = App.currentUser;
    if (!isMyTurn && u.id !== AppConfig.SUPER_ADMIN_ID && u.role !== 'admin') {
      return '';
    }

    if (rec.stage === 'draft_tech') {
      const fillerAcc = DB.state.users.find(x => x.id === rec.fillerAccountId) || u;
      const nextSup = DB.state.users.find(x => x.id === fillerAcc.supervisorId);
      const nextLabel = nextSup ? `${App.getCleanTitle(nextSup)} ${nextSup.name}` : '股長';
      return `
        <button onclick="ModuleFill.submitToNextStage('${rec.id}')"
          class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md flex items-center gap-2 transition">
          <i class="fa-solid fa-paper-plane"></i>
          檢查人蓋章並陳核給：${nextLabel}
        </button>
      `;
    }

    if (rec.stage === 'pending_leader') {
      const chief = DB.state.users.find(x => x.role === 'chief');
      return `
        <button onclick="ModuleFill.rejectToPrevious('${rec.id}')"
          class="px-3.5 py-2 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold">
          <i class="fa-solid fa-rotate-left mr-1"></i>退回檢查人修正
        </button>
        <button onclick="ModuleFill.submitToNextStage('${rec.id}')"
          class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md flex items-center gap-2">
          <i class="fa-solid fa-stamp"></i>
          股長蓋章並陳核課長 (${chief ? chief.name : '李宗霖'})
        </button>
      `;
    }

    if (rec.stage === 'pending_chief') {
      return `
        <button onclick="ModuleFill.rejectToPrevious('${rec.id}')"
          class="px-3.5 py-2 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold">
          <i class="fa-solid fa-rotate-left mr-1"></i>退回股長
        </button>
        <button onclick="ModuleFill.submitToNextStage('${rec.id}')"
          class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md flex items-center gap-2">
          <i class="fa-solid fa-file-circle-check"></i>
          課長蓋章核定（歸檔至已完成表單）
        </button>
      `;
    }
    return '';
  },

  getUserDisplayName(userId) {
    const found = DB.state.users.find(u => u.id === userId);
    return found ? `${App.getCleanTitle(found)} ${found.name}` : (userId || '無');
  },

  selectRecord(recId) {
    App.activeRecordId = recId;
    this.render();
  },

  changeActiveTechMember(memberName) {
    App.activeTechMember = memberName;
    sessionStorage.setItem(AppConfig.SESSION_KEY, JSON.stringify({
      userId: App.currentUser.id,
      activeTechMember: memberName
    }));
    const rec = DB.state.records.find(r => r.id === App.activeRecordId);
    if (rec && rec.stage === 'draft_tech' && rec.fillerAccountId === App.currentUser.id) {
      rec.fillerMemberName = memberName;
      DB.save();
    }
    App.renderHeaderAndSidebarUser();
    this.render();
    App.toast(`已切換檢查人為：${App.getFormattedUserHeaderTitle(App.currentUser)}`, 'info');
  },

  updateCellValue(recId, rowId, colId, val) {
    const rec = DB.state.records.find(r => r.id === recId);
    if (!rec) return;
    if (!rec.cellValues[rowId]) rec.cellValues[rowId] = {};
    rec.cellValues[rowId][colId] = val;
    DB.save();
    this.render();
  },

  updateNote(recId, val) {
    const rec = DB.state.records.find(r => r.id === recId);
    if (!rec) return;
    rec.note = val;
    DB.save();
  },

  quickCheckAllNormal(recId) {
    const rec = DB.state.records.find(r => r.id === recId);
    if (!rec) return;
    const tpl = DB.state.templates.find(t => t.id === rec.templateId);
    if (!tpl) return;

    tpl.rows.forEach(r => {
      if (r.isSection) return;
      if (!rec.cellValues[r.id]) rec.cellValues[r.id] = {};
      tpl.columns.forEach(c => {
        const eff = Object.assign({}, c, r.cells?.[c.id]?.override || {});
        if (eff.type === 'checkbox') {
          rec.cellValues[r.id][c.id] = true;
        } else if (eff.type === 'select') {
          const opts = Array.isArray(eff.options) ? eff.options : ['合格'];
          rec.cellValues[r.id][c.id] = opts[0] || '合格';
        }
      });
    });

    DB.save();
    this.render();
    App.toast('已將所有勾選與判定欄設為正常/合格！', 'success');
  },

  submitToNextStage(recId) {
    const rec = DB.state.records.find(r => r.id === recId);
    if (!rec) return;
    const u = App.currentUser;
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

    if (rec.stage === 'draft_tech') {
      const fillerAcc = DB.state.users.find(x => x.id === rec.fillerAccountId) || u;
      const nextSupId = fillerAcc.supervisorId || '209874';
      const signerName = u.isSharedAccount ? App.activeTechMember : u.name;

      rec.approvals.tech = {
        accountId: u.id,
        name: signerName,
        roleTitle: '檢查人',
        time: nowStr,
        comment: '點檢完成陳核'
      };
      rec.fillerMemberName = signerName;
      rec.stage = 'pending_leader';
      rec.currentAssigneeId = nextSupId;
      rec.logs.push({ time: nowStr, actor: `${App.getCleanTitle(u)} ${signerName}`, action: `完成填表並陳核給 ${this.getUserDisplayName(nextSupId)}` });

      DB.save();
      this.render();
      App.toast(`已蓋章陳核給 ${this.getUserDisplayName(nextSupId)}！`, 'success');
      return;
    }

    if (rec.stage === 'pending_leader') {
      const chief = DB.state.users.find(x => x.role === 'chief');
      const chiefId = chief ? chief.id : '159038';

      rec.approvals.leader = {
        accountId: u.id,
        name: u.name,
        roleTitle: '股長',
        time: nowStr,
        comment: '複核通過呈課長'
      };
      rec.stage = 'pending_chief';
      rec.currentAssigneeId = chiefId;
      rec.logs.push({ time: nowStr, actor: `${App.getCleanTitle(u)} ${u.name}`, action: `股長簽章通過，陳核給 ${this.getUserDisplayName(chiefId)}` });

      DB.save();
      this.render();
      App.toast(`已簽核並陳核給 ${this.getUserDisplayName(chiefId)}！`, 'success');
      return;
    }

    if (rec.stage === 'pending_chief') {
      rec.approvals.chief = {
        accountId: u.id,
        name: u.name,
        roleTitle: '課長',
        time: nowStr,
        comment: '決行核定'
      };
      rec.stage = 'completed';
      rec.currentAssigneeId = '';
      rec.logs.push({ time: nowStr, actor: `${App.getCleanTitle(u)} ${u.name}`, action: '課長決行核定，歸檔至已完成表單' });

      DB.save();
      App.activeRecordId = null;
      this.render();
      App.toast('表單已決行核定，並自動歸檔至「已完成表單」！', 'success');
    }
  },

  rejectToPrevious(recId) {
    const rec = DB.state.records.find(r => r.id === recId);
    if (!rec) return;
    const u = App.currentUser;
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

    if (rec.stage === 'pending_chief') {
      const prevLeaderId = rec.approvals?.leader?.accountId || '209874';
      rec.approvals.chief = null;
      rec.stage = 'pending_leader';
      rec.currentAssigneeId = prevLeaderId;
      rec.logs.push({ time: nowStr, actor: `${App.getCleanTitle(u)} ${u.name}`, action: '退回股長重新確認' });
    } else if (rec.stage === 'pending_leader') {
      rec.approvals.tech = null;
      rec.approvals.leader = null;
      rec.stage = 'draft_tech';
      rec.currentAssigneeId = rec.fillerAccountId;
      rec.logs.push({ time: nowStr, actor: `${App.getCleanTitle(u)} ${u.name}`, action: '退回檢查人重新填寫' });
    }

    DB.save();
    this.render();
    App.toast('已將表單退回上一層級修正！', 'info');
  },

  openNewRecordModal() {
    document.getElementById('new-record-modal').classList.remove('hidden');
  },

  closeNewRecordModal() {
    document.getElementById('new-record-modal').classList.add('hidden');
  },

  createNewRecord() {
    const tplId = document.getElementById('new-rec-template').value;
    const month = document.getElementById('new-rec-month').value || new Date().toISOString().slice(0, 7);
    const inspectDate = document.getElementById('new-rec-date').value || new Date().toISOString().slice(0, 10);
    const tpl = DB.state.templates.find(t => t.id === tplId);
    if (!tpl) return;

    const u = App.currentUser;
    const initCells = {};
    tpl.rows.forEach(r => {
      if (!r.isSection) {
        initCells[r.id] = {};
        Object.keys(r.cells || {}).forEach(cid => {
          initCells[r.id][cid] = r.cells[cid].value;
        });
      }
    });

    const newRec = {
      id: 'REC_' + Date.now(),
      templateId: tpl.id,
      templateName: tpl.name,
      templateCode: tpl.code,
      tag: tpl.tag || '其他',
      month,
      inspectDate,
      stage: 'draft_tech',
      fillerAccountId: u.id,
      fillerMemberName: u.isSharedAccount ? App.activeTechMember : u.name,
      currentAssigneeId: u.id,
      cellValues: initCells,
      note: '',
      approvals: { tech: null, leader: null, chief: null },
      logs: [
        { time: new Date().toISOString().slice(0, 16).replace('T', ' '), actor: `${u.isSharedAccount ? App.activeTechMember : u.name}`, action: '建立新定檢表單' }
      ]
    };

    DB.state.records.unshift(newRec);
    App.activeRecordId = newRec.id;
    DB.save();
    this.closeNewRecordModal();
    this.render();
    App.toast(`已建立「${tpl.name} (${month})」定檢表！`, 'success');
  }
};
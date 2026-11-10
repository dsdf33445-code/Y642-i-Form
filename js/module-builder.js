/**
 * 模組 2：設計表單 (類 Excel 欄位與單一儲存格格式設計器)
 * - 修正表單切換與跨欄合併 (colspan) 時的表格渲染穩定度問題
 * - 加入分類標籤管理：A股、B股、C股、D股、其他
 * - 支援 6 大格式：數值(最低/最高限制)、文字、勾選、下拉清單、加總數值(SUM)、日期選擇
 */
window.ModuleBuilder = {
  selectedColId: null,
  selectedRowId: null,

  render() {
    const container = document.getElementById('view-builder');
    const u = App.currentUser;
    if (!container || !u) return;

    const editableTemplates = DB.state.templates.filter(t => App.canUserAccessTemplate(u, t));
    if (!App.activeTemplateId || !editableTemplates.some(t => t.id === App.activeTemplateId)) {
      App.activeTemplateId = editableTemplates[0]?.id || (DB.state.templates[0]?.id || null);
    }

    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) {
      container.innerHTML = `<div class="p-8 text-center text-slate-500">目前尚無表單範本，請新增範本。</div>`;
      return;
    }

    // 確保預設選取第一個有效欄位
    if (!this.selectedColId || !tpl.columns.some(c => c.id === this.selectedColId)) {
      this.selectedColId = tpl.columns[0]?.id || null;
    }

    const activeCol = tpl.columns.find(c => c.id === this.selectedColId) || tpl.columns[0];
    const activeRow = tpl.rows.find(r => r.id === this.selectedRowId && !r.isSection) || null;
    const activeCell = (activeRow && activeCol) ? (activeRow.cells?.[activeCol.id] || {}) : null;

    container.innerHTML = `
      <!-- 頂部工具列：選擇範本、標籤設定 (A股/B股/C股/D股/其他)、新增列欄 -->
      <div class="bg-white border-b border-slate-200 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-extrabold text-slate-700"><i class="fa-solid fa-table-cells text-blue-600 mr-1"></i>設計表單範本：</span>
          <select onchange="ModuleBuilder.selectTemplate(this.value)"
            class="border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold bg-slate-50">
            ${editableTemplates.map(t => `<option value="${t.id}" ${t.id === tpl.id ? 'selected' : ''}>[${t.tag || '其他'}] ${t.name}</option>`).join('')}
          </select>

          <button onclick="ModuleBuilder.createNewTemplate()"
            class="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1">
            <i class="fa-solid fa-plus"></i> 新範本
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <button onclick="ModuleBuilder.addRow()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">
            <i class="fa-solid fa-plus mr-1"></i>新增檢查列
          </button>
          <button onclick="ModuleBuilder.addSectionRow()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">
            <i class="fa-solid fa-heading mr-1"></i>插入大分類列
          </button>
          <button onclick="ModuleBuilder.addColumn()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">
            <i class="fa-solid fa-table-columns mr-1"></i>新增欄位
          </button>
          <button onclick="ModuleBuilder.saveTemplateNow()" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm">
            <i class="fa-solid fa-floppy-disk mr-1"></i>儲存設計
          </button>
        </div>
      </div>

      <!-- 主設計區：左側表單基本資訊與 Excel 表格 + 右側欄位/儲存格格式面板 -->
      <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">

        <!-- 左側：表單標題、標籤選擇器與類 Excel 編輯網格 -->
        <div class="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          <!-- 表單基本屬性與分類標籤 (A股/B股/C股/D股/其他) -->
          <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div class="sm:col-span-2">
              <label class="block font-bold text-slate-600 mb-1">表單名稱</label>
              <input type="text" value="${tpl.name}" onchange="ModuleBuilder.updateMeta('name', this.value)"
                class="w-full border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-900" />
            </div>
            <div>
              <label class="block font-bold text-slate-600 mb-1">表單編號</label>
              <input type="text" value="${tpl.code || ''}" onchange="ModuleBuilder.updateMeta('code', this.value)"
                class="w-full border border-slate-300 rounded-xl px-3 py-1.5 font-mono" />
            </div>
            <div>
              <label class="block font-bold text-blue-700 mb-1"><i class="fa-solid fa-tag mr-1"></i>所屬分類標籤</label>
              <select onchange="ModuleBuilder.updateMeta('tag', this.value)"
                class="w-full border-2 border-blue-500 rounded-xl px-3 py-1.5 font-extrabold text-blue-900 bg-blue-50">
                ${AppConfig.TAGS.map(tag => `<option value="${tag}" ${tpl.tag === tag ? 'selected' : ''}>${tag}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- 類 Excel 互動式表格設計網格 -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="bg-slate-800 text-slate-200 px-4 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2">
              <span><i class="fa-solid fa-hand-pointer mr-1.5 text-amber-400"></i>點擊「欄位標題 (A, B, C...)」設定整欄格式；點擊「任一儲存格」可單獨覆寫該格格式或設定上下限。</span>
              <span class="font-mono text-purple-300">紫色角標 = 已啟用單格獨立格式</span>
            </div>
            <div class="overflow-x-auto">
              <table class="sheet-grid">
                <thead>
                  <tr>
                    <th class="col-header" style="width:44px">#</th>
                    ${tpl.columns.map((c, idx) => {
                      const colLetter = String.fromCharCode(65 + idx);
                      const isSel = c.id === this.selectedColId;
                      return `
                        <th onclick="ModuleBuilder.selectColumn('${c.id}')"
                          class="col-header ${isSel ? 'selected-col' : ''}" style="width:${c.width || 120}px">
                          <div class="text-[10px] text-slate-400 font-mono">${colLetter} (${this.getTypeShortName(c.type)})</div>
                          <div class="truncate px-1">${c.title}</div>
                        </th>
                      `;
                    }).join('')}
                    <th class="col-header" style="width:48px">刪列</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.renderBuilderRows(tpl)}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 右側：欄位與單一儲存格格式設定面板 -->
        <aside class="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto p-4 space-y-4 shrink-0 text-xs">
          ${this.renderFormatInspector(tpl, activeCol, activeRow, activeCell)}
        </aside>
      </div>
    `;
  },

  getTypeShortName(type) {
    const map = {
      number: '數值',
      text: '文字',
      checkbox: '勾選',
      select: '下拉',
      sum: '加總',
      date: '日期'
    };
    return map[type] || '文字';
  },

  renderBuilderRows(tpl) {
    return tpl.rows.map((r, rIdx) => {
      if (r.isSection) {
        return `
          <tr class="bg-slate-200/80">
            <td class="row-header">${rIdx + 1}</td>
            <td colspan="${tpl.columns.length}" class="p-1.5">
              <input type="text" value="${r.sectionTitle || ''}"
                onchange="ModuleBuilder.updateSectionTitle('${r.id}', this.value)"
                class="w-full px-2.5 py-1 font-bold text-xs bg-white border border-slate-300 rounded-lg" />
            </td>
            <td class="text-center">
              <button onclick="ModuleBuilder.deleteRow('${r.id}')" class="text-red-500 hover:text-red-700 p-1"><i class="fa-solid fa-trash-can"></i></button>
            </td>
          </tr>
        `;
      }

      // 防呆：確保 r.cells 存在
      if (!r.cells) r.cells = {};

      let skip = 0;
      const cellsHtml = tpl.columns.map(c => {
        if (skip > 0) {
          skip--;
          return '';
        }
        if (!r.cells[c.id]) r.cells[c.id] = { value: '' };
        const cell = r.cells[c.id];
        const colspan = Math.min(parseInt(cell.colspan, 10) || 1, tpl.columns.length);
        if (colspan > 1) skip = colspan - 1;

        const isSelCell = (this.selectedRowId === r.id && this.selectedColId === c.id);
        const eff = Object.assign({}, c, cell.override || {});
        const hasOverride = Boolean(cell.override && Object.keys(cell.override).length > 0);

        let badge = '';
        if (eff.type === 'number' && (eff.min !== undefined || eff.max !== undefined)) {
          badge = `<div class="text-[9px] font-mono text-blue-600 px-1">[${eff.min ?? '-∞'}~${eff.max ?? '∞'}${eff.unit || ''}]</div>`;
        } else if (eff.type === 'sum') {
          badge = `<div class="text-[9px] font-mono text-amber-700 font-bold px-1">∑ ${eff.formula || 'COL_SUM'}</div>`;
        } else if (eff.type === 'select') {
          badge = `<div class="text-[9px] text-purple-600 px-1">下拉 (${(eff.options || []).length}項)</div>`;
        } else if (eff.type === 'checkbox') {
          badge = `<div class="text-[9px] text-emerald-700 px-1">☑ ${eff.checkLabel || '正常'}</div>`;
        } else if (eff.type === 'date') {
          badge = `<div class="text-[9px] text-slate-500 px-1">📅 日期</div>`;
        }

        return `
          <td colspan="${colspan}"
            onclick="ModuleBuilder.selectCell('${r.id}','${c.id}')"
            class="p-1 cursor-pointer ${isSelCell ? 'active-cell' : ''}">
            ${hasOverride ? '<div class="cell-override-dot"></div>' : ''}
            <input type="text" value="${cell.value === true ? 'true' : (cell.value || '')}"
              placeholder="預設值/項目文字"
              onchange="ModuleBuilder.updateCellDefaultValue('${r.id}','${c.id}',this.value)"
              class="w-full px-1.5 py-1 text-xs bg-transparent focus:bg-white focus:outline-none rounded" />
            ${badge}
          </td>
        `;
      }).join('');

      return `
        <tr>
          <td class="row-header">${rIdx + 1}</td>
          ${cellsHtml}
          <td class="text-center">
            <button onclick="ModuleBuilder.deleteRow('${r.id}')" class="text-red-500 hover:text-red-700 p-1"><i class="fa-solid fa-trash-can"></i></button>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderFormatInspector(tpl, col, row, cell) {
    if (!col) return `<div>請選擇任一欄位</div>`;

    const hasCellOverride = Boolean(cell && cell.override);
    const eff = hasCellOverride ? Object.assign({}, col, cell.override) : col;

    return `
      <!-- 1. 整欄設定 -->
      <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="font-extrabold text-slate-800 flex items-center gap-1.5">
            <i class="fa-solid fa-table-columns text-blue-600"></i>整欄屬性設定 (${col.title})
          </h4>
          ${tpl.columns.length > 1 ? `
            <button onclick="ModuleBuilder.deleteColumn('${col.id}')" class="text-red-600 hover:underline text-[11px] font-bold">刪除此欄</button>
          ` : ''}
        </div>

        <div>
          <label class="block font-bold text-slate-600 mb-1">欄位標題</label>
          <input type="text" value="${col.title}" onchange="ModuleBuilder.updateColumnProp('${col.id}','title',this.value)"
            class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold bg-white" />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-bold text-slate-600 mb-1">整欄預設格式</label>
            <select onchange="ModuleBuilder.updateColumnProp('${col.id}','type',this.value)"
              class="w-full border border-slate-300 rounded-lg px-2 py-1.5 font-bold bg-white">
              <option value="text" ${col.type === 'text' ? 'selected' : ''}>文字輸入</option>
              <option value="number" ${col.type === 'number' ? 'selected' : ''}>數值 (含上下限)</option>
              <option value="checkbox" ${col.type === 'checkbox' ? 'selected' : ''}>勾選方塊</option>
              <option value="select" ${col.type === 'select' ? 'selected' : ''}>下拉清單</option>
              <option value="sum" ${col.type === 'sum' ? 'selected' : ''}>自動加總 (SUM)</option>
              <option value="date" ${col.type === 'date' ? 'selected' : ''}>日期選擇</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-600 mb-1">欄寬 (px)</label>
            <input type="number" value="${col.width || 120}" onchange="ModuleBuilder.updateColumnProp('${col.id}','width',parseInt(this.value,10)||120)"
              class="w-full border border-slate-300 rounded-lg px-2 py-1.5 font-mono bg-white" />
          </div>
        </div>

        ${this.renderTypeSpecificFields('col', col)}
      </div>

      <!-- 2. 單一儲存格格式覆寫 -->
      ${row && cell ? `
        <div class="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="font-extrabold text-purple-900 flex items-center gap-1.5">
              <i class="fa-solid fa-wand-magic-sparkles text-purple-600"></i>單一儲存格設定
            </h4>
            <label class="inline-flex items-center gap-1 cursor-pointer font-bold text-purple-800">
              <input type="checkbox" ${cell.readOnly ? 'checked' : ''}
                onchange="ModuleBuilder.updateCellProp('${row.id}','${col.id}','readOnly',this.checked)"
                class="accent-purple-600" />
              <span>設為唯讀</span>
            </label>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block font-bold text-purple-800 mb-1">跨欄合併 (Colspan)</label>
              <input type="number" min="1" max="${tpl.columns.length}" value="${cell.colspan || 1}"
                onchange="ModuleBuilder.updateCellProp('${row.id}','${col.id}','colspan',parseInt(this.value,10)||1)"
                class="w-full border border-purple-300 rounded-lg px-2 py-1 font-mono bg-white" />
            </div>
            <div>
              <label class="block font-bold text-purple-800 mb-1">單格專屬格式</label>
              <select onchange="ModuleBuilder.setCellOverrideType('${row.id}','${col.id}',this.value)"
                class="w-full border border-purple-300 rounded-lg px-2 py-1 font-bold bg-white">
                <option value="" ${!hasCellOverride ? 'selected' : ''}>跟隨整欄 (${this.getTypeShortName(col.type)})</option>
                <option value="number" ${hasCellOverride && eff.type === 'number' ? 'selected' : ''}>數值 (獨立上下限)</option>
                <option value="text" ${hasCellOverride && eff.type === 'text' ? 'selected' : ''}>文字輸入</option>
                <option value="checkbox" ${hasCellOverride && eff.type === 'checkbox' ? 'selected' : ''}>勾選方塊</option>
                <option value="select" ${hasCellOverride && eff.type === 'select' ? 'selected' : ''}>下拉清單</option>
                <option value="sum" ${hasCellOverride && eff.type === 'sum' ? 'selected' : ''}>加總數值 (SUM)</option>
                <option value="date" ${hasCellOverride && eff.type === 'date' ? 'selected' : ''}>日期選擇</option>
              </select>
            </div>
          </div>

          ${hasCellOverride ? this.renderTypeSpecificFields('cell', eff, row.id, col.id) : ''}
        </div>
      ` : `<div class="text-slate-400 text-center py-4">點擊左側任一儲存格可設定單格上下限或跨欄合併</div>`}
    `;
  },

  renderTypeSpecificFields(mode, targetObj, rowId = '', colId = '') {
    const onChangeFn = (prop, valExpr) => mode === 'col'
      ? `ModuleBuilder.updateColumnProp('${targetObj.id}','${prop}',${valExpr})`
      : `ModuleBuilder.updateCellOverrideProp('${rowId}','${colId}','${prop}',${valExpr})`;

    if (targetObj.type === 'number') {
      return `
        <div class="grid grid-cols-3 gap-2 pt-1">
          <div>
            <label class="block font-bold text-slate-600 mb-1">最低值(Min)</label>
            <input type="number" step="any" value="${targetObj.min ?? ''}"
              onchange="${onChangeFn('min', 'this.value===\'\'?undefined:parseFloat(this.value)')}"
              class="w-full border border-slate-300 rounded-lg px-2 py-1 font-mono bg-white" />
          </div>
          <div>
            <label class="block font-bold text-slate-600 mb-1">最高值(Max)</label>
            <input type="number" step="any" value="${targetObj.max ?? ''}"
              onchange="${onChangeFn('max', 'this.value===\'\'?undefined:parseFloat(this.value)')}"
              class="w-full border border-slate-300 rounded-lg px-2 py-1 font-mono bg-white" />
          </div>
          <div>
            <label class="block font-bold text-slate-600 mb-1">單位</label>
            <input type="text" value="${targetObj.unit || ''}" placeholder="V/°C/A"
              onchange="${onChangeFn('unit', 'this.value')}"
              class="w-full border border-slate-300 rounded-lg px-2 py-1 font-mono bg-white" />
          </div>
        </div>
      `;
    }

    if (targetObj.type === 'select') {
      const joined = (targetObj.options || ['合格', '待追蹤', '異常']).join(',');
      return `
        <div>
          <label class="block font-bold text-slate-600 mb-1">下拉選項（以逗號 , 分隔）</label>
          <input type="text" value="${joined}"
            onchange="${onChangeFn('options', 'this.value.split(\',\').map(s=>s.trim()).filter(Boolean)')}"
            class="w-full border border-slate-300 rounded-lg px-2 py-1 bg-white" />
        </div>
      `;
    }

    if (targetObj.type === 'checkbox') {
      return `
        <div>
          <label class="block font-bold text-slate-600 mb-1">勾選顯示文字</label>
          <input type="text" value="${targetObj.checkLabel || '正常'}"
            onchange="${onChangeFn('checkLabel', 'this.value')}"
            class="w-full border border-slate-300 rounded-lg px-2 py-1 bg-white" />
        </div>
      `;
    }

    if (targetObj.type === 'sum') {
      return `
        <div>
          <label class="block font-bold text-slate-600 mb-1">加總模式</label>
          <select onchange="${onChangeFn('formula', 'this.value')}"
            class="w-full border border-slate-300 rounded-lg px-2 py-1 font-bold bg-white">
            <option value="COL_SUM" ${(targetObj.formula || 'COL_SUM') === 'COL_SUM' ? 'selected' : ''}>COL_SUM (自動加總本欄上方數值)</option>
            <option value="ROW_SUM" ${targetObj.formula === 'ROW_SUM' ? 'selected' : ''}>ROW_SUM (自動加總同列左側數值)</option>
          </select>
        </div>
      `;
    }

    return '';
  },

  selectTemplate(tplId) {
    App.activeTemplateId = tplId;
    this.selectedColId = null;
    this.selectedRowId = null;
    this.render();
  },

  selectColumn(colId) {
    this.selectedColId = colId;
    this.render();
  },

  selectCell(rowId, colId) {
    this.selectedRowId = rowId;
    this.selectedColId = colId;
    this.render();
  },

  updateMeta(key, val) {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    tpl[key] = val;
    tpl.updatedAt = new Date().toISOString().slice(0, 10);
    // 同步更新關聯紀錄的標籤或名稱
    DB.state.records.forEach(r => {
      if (r.templateId === tpl.id) {
        if (key === 'name') r.templateName = val;
        if (key === 'code') r.templateCode = val;
        if (key === 'tag') r.tag = val;
      }
    });
    DB.save();
    this.render();
  },

  updateColumnProp(colId, prop, val) {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    const col = tpl.columns.find(c => c.id === colId);
    if (!col) return;
    col[prop] = val;
    DB.save();
    this.render();
  },

  updateCellDefaultValue(rowId, colId, val) {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    const row = tpl.rows.find(r => r.id === rowId);
    if (!row) return;
    if (!row.cells[colId]) row.cells[colId] = {};
    row.cells[colId].value = val;
    DB.save();
  },

  updateCellProp(rowId, colId, prop, val) {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    const row = tpl.rows.find(r => r.id === rowId);
    if (!row) return;
    if (!row.cells[colId]) row.cells[colId] = {};
    row.cells[colId][prop] = val;
    DB.save();
    this.render();
  },

  setCellOverrideType(rowId, colId, newType) {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    const row = tpl.rows.find(r => r.id === rowId);
    if (!row) return;
    if (!row.cells[colId]) row.cells[colId] = {};

    if (!newType) {
      delete row.cells[colId].override;
    } else {
      row.cells[colId].override = { type: newType };
    }
    DB.save();
    this.render();
  },

  updateCellOverrideProp(rowId, colId, prop, val) {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    const row = tpl.rows.find(r => r.id === rowId);
    if (!row || !row.cells[colId]) return;
    if (!row.cells[colId].override) row.cells[colId].override = {};
    row.cells[colId].override[prop] = val;
    DB.save();
    this.render();
  },

  updateSectionTitle(rowId, val) {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    const row = tpl.rows.find(r => r.id === rowId);
    if (row) row.sectionTitle = val;
    DB.save();
  },

  addRow() {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    const cells = {};
    tpl.columns.forEach((c, idx) => {
      cells[c.id] = { value: idx === 0 ? String(tpl.rows.filter(r => !r.isSection).length + 1) : '' };
    });
    tpl.rows.push({ id: 'r_' + Date.now(), isSection: false, cells });
    DB.save();
    this.render();
  },

  addSectionRow() {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    tpl.rows.push({ id: 'sec_' + Date.now(), isSection: true, sectionTitle: '新增分類區段標題', cells: {} });
    DB.save();
    this.render();
  },

  deleteRow(rowId) {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    tpl.rows = tpl.rows.filter(r => r.id !== rowId);
    DB.save();
    this.render();
  },

  addColumn() {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    const newColId = 'c_' + Date.now();
    tpl.columns.push({ id: newColId, title: '新欄位', width: 120, type: 'text', align: 'center' });
    tpl.rows.forEach(r => {
      if (!r.isSection) {
        if (!r.cells) r.cells = {};
        r.cells[newColId] = { value: '' };
      }
    });
    this.selectedColId = newColId;
    DB.save();
    this.render();
  },

  deleteColumn(colId) {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl || tpl.columns.length <= 1) return;
    tpl.columns = tpl.columns.filter(c => c.id !== colId);
    tpl.rows.forEach(r => {
      if (r.cells) delete r.cells[colId];
    });
    this.selectedColId = tpl.columns[0]?.id || null;
    DB.save();
    this.render();
  },

  createNewTemplate() {
    const u = App.currentUser;
    const defaultTag = AppConfig.TAGS.includes(u.group) ? u.group : '其他';
    const newTpl = {
      id: 'TPL_' + Date.now(),
      name: `${defaultTag} - 新建每月定檢表`,
      code: `Y642-${Date.now().toString().slice(-4)}`,
      tag: defaultTag,
      department: `Y642 電力維護課 (${defaultTag})`,
      updatedAt: new Date().toISOString().slice(0, 10),
      createdBy: u.id,
      columns: [
        { id: 'c1', title: '項次', width: 60, type: 'text', align: 'center' },
        { id: 'c2', title: '點檢項目', width: 220, type: 'text', align: 'left' },
        { id: 'c3', title: '量測數值', width: 130, type: 'number', min: 0, max: 100, unit: '', align: 'center' },
        { id: 'c4', title: '正常勾選', width: 100, type: 'checkbox', checkLabel: '正常', align: 'center' },
        { id: 'c5', title: '判定結果', width: 120, type: 'select', options: ['合格', '異常'], align: 'center' }
      ],
      rows: [
        {
          id: 'r1',
          isSection: false,
          cells: {
            c1: { value: '1', readOnly: true },
            c2: { value: '範例點檢項目 (請點擊修改)', readOnly: false },
            c3: { value: '50' },
            c4: { value: true },
            c5: { value: '合格' }
          }
        }
      ]
    };

    DB.state.templates.unshift(newTpl);
    App.activeTemplateId = newTpl.id;
    DB.save();
    this.render();
    App.toast('已建立新定檢表範本！', 'success');
  },

  saveTemplateNow() {
    DB.save();
    App.toast('表單格式與標籤設定已儲存同步！', 'success');
  }
};
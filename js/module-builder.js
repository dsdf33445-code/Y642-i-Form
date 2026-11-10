/**
 * 模組 2：設計表單（直接嵌入 EXCEL 試算表介面）
 * - 支援匯入 EXCEL (.xlsx / .xls / .csv) 自動解析表頭、分類跨欄列、上下限數值與勾選格式，一鍵自動生成表單
 * - 支援直接從桌面 Excel 框選區域複製並於試算表內按 Ctrl+V 貼上
 * - 加入「填寫週期」設定（每月、每季、半年、每年）
 * - 內嵌式 Excel 試算表介面：含 Excel 功能區 (Ribbon)、座標方塊 (A1)、fx 資料編輯列、鍵盤方向鍵/Enter/Tab 導覽
 */
window.ModuleBuilder = {
  selectedColId: null,
  selectedRowId: null,
  pendingImportData: null, // 暫存解析後的 Excel 結構供確認視窗使用

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
      container.innerHTML = `<div class="p-8 text-center text-slate-500">目前尚無表單範本，請建立或匯入 Excel 表單。</div>`;
      return;
    }

    if (!tpl.cycle) tpl.cycle = '每月';

    if (!this.selectedColId || !tpl.columns.some(c => c.id === this.selectedColId)) {
      this.selectedColId = tpl.columns[0]?.id || null;
    }
    if (!this.selectedRowId || !tpl.rows.some(r => r.id === this.selectedRowId)) {
      const firstNormalRow = tpl.rows.find(r => !r.isSection) || tpl.rows[0];
      this.selectedRowId = firstNormalRow?.id || null;
    }

    const activeColIdx = tpl.columns.findIndex(c => c.id === this.selectedColId);
    const activeCol = tpl.columns[activeColIdx] || tpl.columns[0];
    const activeRowIdx = tpl.rows.findIndex(r => r.id === this.selectedRowId);
    const activeRow = tpl.rows[activeRowIdx] || null;
    const activeCell = (activeRow && !activeRow.isSection && activeCol)
      ? (activeRow.cells?.[activeCol.id] || {})
      : null;

    const colLetter = activeColIdx >= 0 ? this.getColumnLetter(activeColIdx) : 'A';
    const cellCoord = activeRow ? `${colLetter}${activeRowIdx + 1}` : `${colLetter}1`;
    const hasCellOverride = Boolean(activeCell && activeCell.override && Object.keys(activeCell.override).length > 0);
    const effFormat = (activeCell && hasCellOverride) ? Object.assign({}, activeCol, activeCell.override) : (activeCol || { type: 'text' });
    const formulaBarVal = activeRow
      ? (activeRow.isSection ? (activeRow.sectionTitle || '') : (activeCell?.value === true ? 'true' : (activeCell?.value ?? '')))
      : '';

    container.innerHTML = `
      <!-- 隱藏之 Excel 檔案上傳輸入框 -->
      <input type="file" id="excel-file-input" accept=".xlsx,.xls,.csv" class="hidden" onchange="ModuleBuilder.handleExcelFileSelect(event)" />

      <!-- ==================== 1. 頂部 EXCEL 檔案與表單基本資訊列 ==================== -->
      <div class="bg-[#107c41] text-white px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-sm">
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-1.5 font-extrabold text-xs bg-white/15 px-2.5 py-1 rounded-lg">
            <i class="fa-solid fa-file-excel text-sm"></i>
            <span>EXCEL 試算表設計器</span>
          </div>

          <select onchange="ModuleBuilder.selectTemplate(this.value)"
            class="bg-white text-slate-900 rounded-lg px-2.5 py-1 text-xs font-extrabold border border-emerald-800 max-w-xs focus:outline-none">
            ${editableTemplates.map(t => `<option value="${t.id}" ${t.id === tpl.id ? 'selected' : ''}>[${t.tag || '其他'}｜${t.cycle || '每月'}] ${t.name}</option>`).join('')}
          </select>

          <button onclick="ModuleBuilder.createNewTemplate()"
            class="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1 transition">
            <i class="fa-solid fa-plus"></i> 新空白表單
          </button>

          <button onclick="ModuleBuilder.triggerExcelImport()"
            class="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow transition">
            <i class="fa-solid fa-file-import"></i> 匯入 EXCEL 自動生成表單
          </button>

          <button onclick="ModuleBuilder.exportCurrentToExcel()"
            class="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1 transition">
            <i class="fa-solid fa-file-export"></i> 匯出 Excel
          </button>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="ModuleBuilder.saveTemplateNow()"
            class="px-3.5 py-1 rounded-lg bg-white text-[#107c41] hover:bg-emerald-50 text-xs font-extrabold shadow flex items-center gap-1.5">
            <i class="fa-solid fa-floppy-disk"></i> 儲存表單
          </button>
        </div>
      </div>

      <!-- ==================== 2. 表單屬性列 (表單名稱、編號、標籤、填寫週期) ==================== -->
      <div class="bg-slate-100 border-b border-slate-300 px-3 sm:px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs shrink-0">
        <div class="flex items-center gap-1.5 flex-1 min-w-[200px]">
          <span class="font-bold text-slate-600 shrink-0">表單名稱：</span>
          <input type="text" value="${tpl.name}" onchange="ModuleBuilder.updateMeta('name', this.value)"
            class="w-full border border-slate-300 rounded-lg px-2.5 py-1 font-bold text-slate-900 bg-white focus:border-[#107c41] focus:outline-none" />
        </div>

        <div class="flex items-center gap-1.5">
          <span class="font-bold text-slate-600 shrink-0">編號：</span>
          <input type="text" value="${tpl.code || ''}" onchange="ModuleBuilder.updateMeta('code', this.value)"
            class="w-28 border border-slate-300 rounded-lg px-2 py-1 font-mono bg-white focus:border-[#107c41] focus:outline-none" />
        </div>

        <div class="flex items-center gap-1.5">
          <span class="font-bold text-slate-600 shrink-0"><i class="fa-solid fa-tag mr-1 text-blue-600"></i>標籤：</span>
          <select onchange="ModuleBuilder.updateMeta('tag', this.value)"
            class="border border-slate-300 rounded-lg px-2.5 py-1 font-extrabold bg-white">
            ${AppConfig.TAGS.map(tag => `<option value="${tag}" ${tpl.tag === tag ? 'selected' : ''}>${tag}</option>`).join('')}
          </select>
        </div>

        <div class="flex items-center gap-1.5">
          <span class="font-bold text-slate-600 shrink-0"><i class="fa-solid fa-rotate mr-1 text-emerald-600"></i>填寫週期：</span>
          <select onchange="ModuleBuilder.updateMeta('cycle', this.value)"
            class="border-2 border-[#107c41] rounded-lg px-2.5 py-1 font-extrabold text-[#107c41] bg-emerald-50">
            ${(App.CYCLES || ['每月', '每季', '半年', '每年']).map(cy => `<option value="${cy}" ${(tpl.cycle || '每月') === cy ? 'selected' : ''}>${cy}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- ==================== 3. EXCEL 互動式格式功能區 (Ribbon Toolbar) ==================== -->
      <div class="bg-white border-b border-slate-300 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <!-- 左側：行列增刪與結構操作 -->
        <div class="flex flex-wrap items-center gap-1.5">
          <button onclick="ModuleBuilder.addRow()" class="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-300">
            <i class="fa-solid fa-plus text-emerald-600 mr-1"></i>插入列
          </button>
          <button onclick="ModuleBuilder.addSectionRow()" class="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-300">
            <i class="fa-solid fa-grip-lines text-blue-600 mr-1"></i>插入分類標題列
          </button>
          <button onclick="ModuleBuilder.addColumn()" class="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-300">
            <i class="fa-solid fa-table-columns text-indigo-600 mr-1"></i>插入欄
          </button>
          ${activeRow ? `
            <button onclick="ModuleBuilder.deleteRow('${activeRow.id}')" class="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-bold border border-red-200">
              <i class="fa-solid fa-trash-can mr-1"></i>刪第 ${activeRowIdx + 1} 列
            </button>
          ` : ''}
          ${activeCol && tpl.columns.length > 1 ? `
            <button onclick="ModuleBuilder.deleteColumn('${activeCol.id}')" class="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-bold border border-red-200">
              <i class="fa-solid fa-xmark mr-1"></i>刪 ${colLetter} 欄
            </button>
          ` : ''}
        </div>

        <!-- 右側：選取欄位 / 單一儲存格格式設定列 -->
        ${activeCol ? `
          <div class="flex flex-wrap items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <span class="font-extrabold text-[#107c41]">${colLetter}欄 (${activeCol.title}) 整欄格式：</span>
            <select onchange="ModuleBuilder.updateColumnProp('${activeCol.id}','type',this.value)"
              class="border border-slate-300 rounded px-2 py-0.5 font-bold bg-white">
              <option value="text" ${activeCol.type === 'text' ? 'selected' : ''}>文字</option>
              <option value="number" ${activeCol.type === 'number' ? 'selected' : ''}>數值(上下限)</option>
              <option value="checkbox" ${activeCol.type === 'checkbox' ? 'selected' : ''}>勾選</option>
              <option value="select" ${activeCol.type === 'select' ? 'selected' : ''}>下拉清單</option>
              <option value="sum" ${activeCol.type === 'sum' ? 'selected' : ''}>自動加總(SUM)</option>
              <option value="date" ${activeCol.type === 'date' ? 'selected' : ''}>日期</option>
            </select>

            <span class="text-slate-400">|</span>

            <span class="font-bold text-slate-600">欄寬：</span>
            <input type="number" value="${activeCol.width || 120}"
              onchange="ModuleBuilder.updateColumnProp('${activeCol.id}','width',parseInt(this.value,10)||120)"
              class="w-16 border border-slate-300 rounded px-1.5 py-0.5 font-mono text-center bg-white" />

            ${activeRow && !activeRow.isSection && activeCell ? `
              <span class="text-slate-400">|</span>
              <span class="font-extrabold text-purple-800">儲存格 [${cellCoord}] 格式：</span>
              <select onchange="ModuleBuilder.setCellOverrideType('${activeRow.id}','${activeCol.id}',this.value)"
                class="border border-purple-300 rounded px-2 py-0.5 font-bold bg-purple-50 text-purple-900">
                <option value="" ${!hasCellOverride ? 'selected' : ''}>跟隨 ${colLetter} 欄 (${this.getTypeShortName(activeCol.type)})</option>
                <option value="number" ${hasCellOverride && effFormat.type === 'number' ? 'selected' : ''}>單格數值(獨立上下限)</option>
                <option value="text" ${hasCellOverride && effFormat.type === 'text' ? 'selected' : ''}>單格文字</option>
                <option value="checkbox" ${hasCellOverride && effFormat.type === 'checkbox' ? 'selected' : ''}>單格勾選</option>
                <option value="select" ${hasCellOverride && effFormat.type === 'select' ? 'selected' : ''}>單格下拉清單</option>
                <option value="sum" ${hasCellOverride && effFormat.type === 'sum' ? 'selected' : ''}>單格加總(SUM)</option>
                <option value="date" ${hasCellOverride && effFormat.type === 'date' ? 'selected' : ''}>單格日期</option>
              </select>

              <label class="inline-flex items-center gap-1 font-bold text-slate-700 cursor-pointer ml-1">
                <input type="checkbox" ${activeCell.readOnly ? 'checked' : ''}
                  onchange="ModuleBuilder.updateCellProp('${activeRow.id}','${activeCol.id}','readOnly',this.checked)"
                  class="accent-[#107c41]" />
                <span>唯讀</span>
              </label>

              <span class="font-bold text-slate-600 ml-1">跨欄：</span>
              <input type="number" min="1" max="${tpl.columns.length}" value="${activeCell.colspan || 1}"
                onchange="ModuleBuilder.updateCellProp('${activeRow.id}','${activeCol.id}','colspan',parseInt(this.value,10)||1)"
                class="w-12 border border-slate-300 rounded px-1 py-0.5 font-mono text-center bg-white" />
            ` : ''}

            ${this.renderInlineParameterControls(activeCol, activeRow, activeCell, hasCellOverride, effFormat)}
          </div>
        ` : ''}
      </div>

      <!-- ==================== 4. EXCEL 座標方塊與 fx 資料編輯列 ==================== -->
      <div class="bg-slate-50 border-b border-slate-300 px-3 py-1.5 flex items-center gap-2 text-xs shrink-0">
        <div id="excel-name-box" class="w-20 px-2 py-1 bg-white border border-slate-300 rounded font-mono font-extrabold text-center text-[#107c41] select-none">
          ${cellCoord}
        </div>
        <div class="font-serif italic font-black text-slate-500 px-1.5 select-none">fx</div>
        <input type="text" id="excel-formula-input" value="${String(formulaBarVal).replace(/"/g, '&quot;')}"
          placeholder="在此輸入儲存格內容或預設值（亦支援於下方試算表直接按 Ctrl+V 貼上 Excel 表格內容）..."
          oninput="ModuleBuilder.onFormulaBarInput(this.value)"
          class="flex-1 bg-white border border-slate-300 rounded px-3 py-1 text-xs focus:outline-none focus:border-[#107c41]" />
        <span class="text-[11px] text-slate-400 hidden xl:inline">提示：點擊欄頭文字可直接修改欄位名稱；支援方向鍵與直接從 Excel 複製貼上</span>
      </div>

      <!-- ==================== 5. 內嵌式 EXCEL 試算表主工作區 ==================== -->
      <div class="flex-1 overflow-auto bg-[#e6e6e6] relative" id="excel-grid-scroll-container">
        <table class="excel-spreadsheet-table" onpaste="ModuleBuilder.handleSpreadsheetPaste(event)">
          <thead>
            <tr>
              <th class="excel-corner-header"></th>
              ${tpl.columns.map((c, idx) => {
                const letter = this.getColumnLetter(idx);
                const isSelectedCol = c.id === this.selectedColId;
                return `
                  <th onclick="ModuleBuilder.selectColumn('${c.id}')"
                    class="excel-col-header ${isSelectedCol ? 'selected-col' : ''}"
                    style="width:${c.width || 130}px; min-width:${c.width || 130}px;">
                    <div class="flex items-center justify-between px-1.5 text-[10px] font-mono text-slate-500 border-b border-slate-200/80 pb-0.5">
                      <span class="font-extrabold text-[#107c41]">${letter}</span>
                      <span class="px-1 rounded bg-white/80 text-[9px] text-slate-600">${this.getTypeShortName(c.type)}</span>
                    </div>
                    <input type="text" value="${String(c.title).replace(/"/g, '&quot;')}"
                      onclick="event.stopPropagation(); ModuleBuilder.selectColumn('${c.id}')"
                      onchange="ModuleBuilder.updateColumnProp('${c.id}','title',this.value)"
                      title="點擊直接修改欄位標題"
                      class="w-full text-center font-extrabold text-xs bg-transparent focus:bg-white focus:outline-none px-1 py-0.5" />
                  </th>
                `;
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${this.renderExcelGridRows(tpl)}
          </tbody>
        </table>
      </div>

      <!-- ==================== Excel 匯入預覽與設定彈窗 ==================== -->
      ${this.pendingImportData ? this.renderImportPreviewModal() : ''}
    `;
  },

  getColumnLetter(colIdx) {
    let letter = '';
    let temp = colIdx;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  },

  getTypeShortName(type) {
    const map = {
      number: '數值',
      text: '文字',
      checkbox: '勾選',
      select: '下拉',
      sum: 'SUM加總',
      date: '日期'
    };
    return map[type] || '文字';
  },

  /**
   * 於 Ribbon 工具列直接顯示當前格式之細部參數（如最低值、最高值、單位、下拉選項、加總公式）
   */
  renderInlineParameterControls(col, row, cell, hasCellOverride, eff) {
    const isCellMode = Boolean(row && !row.isSection && cell && hasCellOverride);
    const onChangeFn = (prop, valExpr) => isCellMode
      ? `ModuleBuilder.updateCellOverrideProp('${row.id}','${col.id}','${prop}',${valExpr})`
      : `ModuleBuilder.updateColumnProp('${col.id}','${prop}',${valExpr})`;

    if (eff.type === 'number') {
      return `
        <span class="text-slate-400">|</span>
        <span class="font-bold text-blue-700">最低：</span>
        <input type="number" step="any" value="${eff.min ?? ''}" placeholder="無"
          onchange="${onChangeFn('min', 'this.value===\'\'?undefined:parseFloat(this.value)')}"
          class="w-16 border border-blue-300 rounded px-1.5 py-0.5 font-mono text-center bg-white" />
        <span class="font-bold text-blue-700">最高：</span>
        <input type="number" step="any" value="${eff.max ?? ''}" placeholder="無"
          onchange="${onChangeFn('max', 'this.value===\'\'?undefined:parseFloat(this.value)')}"
          class="w-16 border border-blue-300 rounded px-1.5 py-0.5 font-mono text-center bg-white" />
        <span class="font-bold text-blue-700">單位：</span>
        <input type="text" value="${eff.unit || ''}" placeholder="V/°C"
          onchange="${onChangeFn('unit', 'this.value')}"
          class="w-14 border border-blue-300 rounded px-1.5 py-0.5 font-mono text-center bg-white" />
      `;
    }

    if (eff.type === 'select') {
      const joined = (eff.options || ['合格', '待追蹤', '異常']).join(',');
      return `
        <span class="text-slate-400">|</span>
        <span class="font-bold text-purple-700">選項(逗號分隔)：</span>
        <input type="text" value="${joined}"
          onchange="${onChangeFn('options', 'this.value.split(\',\').map(s=>s.trim()).filter(Boolean)')}"
          class="w-44 border border-purple-300 rounded px-2 py-0.5 bg-white" />
      `;
    }

    if (eff.type === 'checkbox') {
      return `
        <span class="text-slate-400">|</span>
        <span class="font-bold text-emerald-700">勾選文字：</span>
        <input type="text" value="${eff.checkLabel || '正常'}"
          onchange="${onChangeFn('checkLabel', 'this.value')}"
          class="w-20 border border-emerald-300 rounded px-2 py-0.5 bg-white" />
      `;
    }

    if (eff.type === 'sum') {
      return `
        <span class="text-slate-400">|</span>
        <span class="font-bold text-amber-800">公式：</span>
        <select onchange="${onChangeFn('formula', 'this.value')}"
          class="border border-amber-300 rounded px-2 py-0.5 font-bold bg-white">
          <option value="COL_SUM" ${(eff.formula || 'COL_SUM') === 'COL_SUM' ? 'selected' : ''}>COL_SUM (加總本欄上方)</option>
          <option value="ROW_SUM" ${eff.formula === 'ROW_SUM' ? 'selected' : ''}>ROW_SUM (加總同列左側)</option>
        </select>
      `;
    }

    return '';
  },

  renderExcelGridRows(tpl) {
    return tpl.rows.map((r, rIdx) => {
      const isSelectedRow = r.id === this.selectedRowId;

      if (r.isSection) {
        return `
          <tr>
            <td onclick="ModuleBuilder.selectRow('${r.id}')"
              class="excel-row-header ${isSelectedRow ? 'selected-row' : ''}">${rIdx + 1}</td>
            <td colspan="${tpl.columns.length}"
              onclick="ModuleBuilder.selectRow('${r.id}')"
              class="bg-slate-800 text-white px-2 py-1">
              <div class="flex items-center gap-2">
                <span class="text-[10px] px-1.5 py-0.2 rounded bg-blue-600 font-bold shrink-0">分類標題列</span>
                <input type="text" data-row-id="${r.id}" data-col-id="SECTION"
                  value="${String(r.sectionTitle || '').replace(/"/g, '&quot;')}"
                  oninput="ModuleBuilder.updateSectionTitleSilent('${r.id}', this.value)"
                  onchange="DB.save()"
                  class="w-full bg-transparent text-white font-bold text-xs focus:outline-none" />
              </div>
            </td>
          </tr>
        `;
      }

      if (!r.cells) r.cells = {};

      let skip = 0;
      const cellsHtml = tpl.columns.map((c, cIdx) => {
        if (skip > 0) {
          skip--;
          return '';
        }
        if (!r.cells[c.id]) r.cells[c.id] = { value: '' };
        const cell = r.cells[c.id];
        const colspan = Math.min(parseInt(cell.colspan, 10) || 1, tpl.columns.length - cIdx);
        if (colspan > 1) skip = colspan - 1;

        const isSelCell = (this.selectedRowId === r.id && this.selectedColId === c.id);
        const eff = Object.assign({}, c, cell.override || {});
        const hasOverride = Boolean(cell.override && Object.keys(cell.override).length > 0);

        let formatTag = '';
        if (eff.type === 'number' && (eff.min !== undefined || eff.max !== undefined)) {
          formatTag = `<span class="text-[9px] font-mono text-blue-600 bg-blue-50 px-1 rounded shrink-0">[${eff.min ?? '-∞'}~${eff.max ?? '∞'}${eff.unit || ''}]</span>`;
        } else if (eff.type === 'sum') {
          formatTag = `<span class="text-[9px] font-mono text-amber-800 bg-amber-100 px-1 rounded font-bold shrink-0">∑${eff.formula || 'COL'}</span>`;
        } else if (eff.type === 'checkbox') {
          formatTag = `<span class="text-[9px] text-emerald-700 bg-emerald-50 px-1 rounded shrink-0">☑${eff.checkLabel || '正常'}</span>`;
        } else if (eff.type === 'select') {
          formatTag = `<span class="text-[9px] text-purple-700 bg-purple-50 px-1 rounded shrink-0">▼下拉</span>`;
        } else if (eff.type === 'date') {
          formatTag = `<span class="text-[9px] text-slate-500 bg-slate-100 px-1 rounded shrink-0">📅日期</span>`;
        }

        const displayVal = cell.value === true ? 'true' : (cell.value ?? '');

        return `
          <td colspan="${colspan}"
            onclick="ModuleBuilder.selectCell('${r.id}','${c.id}', false)"
            class="excel-cell ${cell.readOnly ? 'readonly-cell' : ''} ${isSelCell ? 'active-excel-cell' : ''}">
            ${hasOverride ? '<div class="cell-override-dot" title="此儲存格已設定獨立格式"></div>' : ''}
            <div class="flex items-center h-full pr-1">
              <input type="text"
                data-row-id="${r.id}"
                data-col-id="${c.id}"
                data-r-idx="${rIdx}"
                data-c-idx="${cIdx}"
                value="${String(displayVal).replace(/"/g, '&quot;')}"
                onfocus="ModuleBuilder.onCellInputFocus('${r.id}','${c.id}')"
                oninput="ModuleBuilder.updateCellDefaultValueSilent('${r.id}','${c.id}',this.value)"
                onchange="DB.save()"
                onkeydown="ModuleBuilder.handleCellKeyDown(event, ${rIdx}, ${cIdx})"
                class="excel-cell-input ${cell.readOnly ? 'text-slate-600 font-medium' : 'text-slate-900'}" />
              ${formatTag}
            </div>
          </td>
        `;
      }).join('');

      return `
        <tr>
          <td onclick="ModuleBuilder.selectRow('${r.id}')"
            class="excel-row-header ${isSelectedRow ? 'selected-row' : ''}">${rIdx + 1}</td>
          ${cellsHtml}
        </tr>
      `;
    }).join('');
  },

  /**
   * 聚焦儲存格時更新座標與 fx 資料編輯列（避免整表重繪造成輸入中斷）
   */
  onCellInputFocus(rowId, colId) {
    if (this.selectedRowId === rowId && this.selectedColId === colId) return;
    this.selectedRowId = rowId;
    this.selectedColId = colId;

    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;

    const cIdx = tpl.columns.findIndex(c => c.id === colId);
    const rIdx = tpl.rows.findIndex(r => r.id === rowId);
    const nameBox = document.getElementById('excel-name-box');
    if (nameBox && cIdx >= 0 && rIdx >= 0) {
      nameBox.textContent = `${this.getColumnLetter(cIdx)}${rIdx + 1}`;
    }

    const row = tpl.rows[rIdx];
    const formulaInput = document.getElementById('excel-formula-input');
    if (formulaInput && row) {
      const val = row.isSection ? (row.sectionTitle || '') : (row.cells?.[colId]?.value ?? '');
      formulaInput.value = val === true ? 'true' : val;
    }

    document.querySelectorAll('.excel-cell.active-excel-cell').forEach(el => el.classList.remove('active-excel-cell'));
    const inputEl = document.querySelector(`input[data-row-id="${rowId}"][data-col-id="${colId}"]`);
    if (inputEl && inputEl.closest('.excel-cell')) {
      inputEl.closest('.excel-cell').classList.add('active-excel-cell');
    }
  },

  updateCellDefaultValueSilent(rowId, colId, val) {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    const row = tpl.rows.find(r => r.id === rowId);
    if (!row) return;
    if (!row.cells[colId]) row.cells[colId] = {};
    row.cells[colId].value = val === 'true' ? true : val;

    const formulaInput = document.getElementById('excel-formula-input');
    if (formulaInput && document.activeElement !== formulaInput) {
      formulaInput.value = val;
    }
  },

  updateSectionTitleSilent(rowId, val) {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    const row = tpl.rows.find(r => r.id === rowId);
    if (row) row.sectionTitle = val;
    const formulaInput = document.getElementById('excel-formula-input');
    if (formulaInput && document.activeElement !== formulaInput) {
      formulaInput.value = val;
    }
  },

  onFormulaBarInput(val) {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl || !this.selectedRowId) return;
    const row = tpl.rows.find(r => r.id === this.selectedRowId);
    if (!row) return;

    if (row.isSection) {
      row.sectionTitle = val;
      const secInput = document.querySelector(`input[data-row-id="${row.id}"][data-col-id="SECTION"]`);
      if (secInput) secInput.value = val;
    } else if (this.selectedColId) {
      if (!row.cells[this.selectedColId]) row.cells[this.selectedColId] = {};
      row.cells[this.selectedColId].value = val;
      const cellInput = document.querySelector(`input[data-row-id="${row.id}"][data-col-id="${this.selectedColId}"]`);
      if (cellInput) cellInput.value = val;
    }
    DB.saveLocal();
  },

  /**
   * 支援在試算表內使用方向鍵 / Enter / Tab 快速移動焦點
   */
  handleCellKeyDown(e, rIdx, cIdx) {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;

    let targetR = rIdx;
    let targetC = cIdx;

    if (e.key === 'Enter') {
      e.preventDefault();
      targetR = Math.min(tpl.rows.length - 1, rIdx + 1);
    } else if (e.key === 'ArrowDown') {
      targetR = Math.min(tpl.rows.length - 1, rIdx + 1);
    } else if (e.key === 'ArrowUp') {
      targetR = Math.max(0, rIdx - 1);
    } else {
      return;
    }

    const nextInput = document.querySelector(`input[data-r-idx="${targetR}"][data-c-idx="${targetC}"]`);
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
  },

  /**
   * 支援直接從桌面 Excel 複製多格區域並於試算表內按 Ctrl+V 貼上
   */
  handleSpreadsheetPaste(e) {
    const clipText = (e.clipboardData || window.clipboardData)?.getData('text');
    if (!clipText || (!clipText.includes('\t') && !clipText.includes('\n'))) return;

    e.preventDefault();
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;

    const rowsData = clipText.replace(/\r/g, '').split('\n').filter(line => line.length > 0).map(line => line.split('\t'));
    if (rowsData.length === 0) return;

    let startR = Math.max(0, tpl.rows.findIndex(r => r.id === this.selectedRowId));
    let startC = Math.max(0, tpl.columns.findIndex(c => c.id === this.selectedColId));

    // 若貼上欄位數超出目前欄數，自動擴充欄位
    const maxColsNeeded = startC + Math.max(...rowsData.map(r => r.length));
    while (tpl.columns.length < maxColsNeeded) {
      const newColId = 'c_' + Date.now() + '_' + tpl.columns.length;
      tpl.columns.push({ id: newColId, title: `欄位 ${tpl.columns.length + 1}`, width: 120, type: 'text', align: 'center' });
    }

    rowsData.forEach((rCells, offsetR) => {
      const targetRowIdx = startR + offsetR;
      let rowObj = tpl.rows[targetRowIdx];
      if (!rowObj) {
        const newCells = {};
        tpl.columns.forEach(c => { newCells[c.id] = { value: '' }; });
        rowObj = { id: 'r_' + Date.now() + '_' + offsetR, isSection: false, cells: newCells };
        tpl.rows.push(rowObj);
      }
      if (rowObj.isSection) return;

      rCells.forEach((val, offsetC) => {
        const colObj = tpl.columns[startC + offsetC];
        if (!colObj) return;
        if (!rowObj.cells[colObj.id]) rowObj.cells[colObj.id] = {};
        rowObj.cells[colObj.id].value = val.trim();
      });
    });

    DB.save();
    this.render();
    App.toast(`已從剪貼簿貼上 ${rowsData.length} 列 Excel 資料！`, 'success');
  },

  /**
   * 觸發匯入 Excel 檔案選擇器
   */
  triggerExcelImport() {
    const fileEl = document.getElementById('excel-file-input');
    if (fileEl) {
      fileEl.value = '';
      fileEl.click();
    }
  },

  /**
   * 解析使用者上傳的 Excel (.xlsx / .xls / .csv) 並自動推導定檢表結構
   */
  handleExcelFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
      App.toast('Excel 解析引擎載入中，請稍候再試！', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawGrid = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        const merges = worksheet['!merges'] || [];

        const parsedStructure = this.convertExcelSheetToTemplateStructure(file.name, firstSheetName, rawGrid, merges);
        this.pendingImportData = parsedStructure;
        this.render();
      } catch (err) {
        console.error('Excel 解析錯誤:', err);
        App.toast('無法解析此 Excel 檔案，請確認檔案格式為 .xlsx、.xls 或 .csv', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  },

  /**
   * 智慧轉換 Excel 二維陣列與合併資訊為系統表單 Columns 與 Rows（含自動偵測上下限與勾選）
   */
  convertExcelSheetToTemplateStructure(fileName, sheetName, rawGrid, merges) {
    // 過濾全空白列
    const nonEmptyRows = [];
    rawGrid.forEach((rowArr, originalRowIdx) => {
      const hasContent = rowArr.some(cell => String(cell ?? '').trim() !== '');
      if (hasContent) {
        nonEmptyRows.push({ rowArr, originalRowIdx });
      }
    });

    const cleanFileTitle = fileName.replace(/\.(xlsx|xls|csv)$/i, '');

    if (nonEmptyRows.length === 0) {
      return {
        suggestedName: cleanFileTitle,
        sheetName,
        columns: [
          { id: 'c1', title: '項次', width: 60, type: 'text', align: 'center' },
          { id: 'c2', title: '檢查項目', width: 220, type: 'text', align: 'left' },
          { id: 'c3', title: '檢查結果', width: 130, type: 'checkbox', checkLabel: '正常', align: 'center' }
        ],
        rows: []
      };
    }

    // 找出最適合作為欄位表頭的列（第一個擁有 >=2 個非空儲存格的列）
    let headerIdxInNonEmpty = 0;
    for (let i = 0; i < Math.min(5, nonEmptyRows.length); i++) {
      const nonBlankCount = nonEmptyRows[i].rowArr.filter(v => String(v ?? '').trim() !== '').length;
      if (nonBlankCount >= 2) {
        headerIdxInNonEmpty = i;
        break;
      }
    }

    const headerRow = nonEmptyRows[headerIdxInNonEmpty].rowArr;
    // 計算有效欄數
    let maxColCount = headerRow.length;
    nonEmptyRows.forEach(item => {
      for (let c = item.rowArr.length - 1; c >= 0; c--) {
        if (String(item.rowArr[c] ?? '').trim() !== '') {
          maxColCount = Math.max(maxColCount, c + 1);
          break;
        }
      }
    });
    maxColCount = Math.max(2, Math.min(maxColCount, 15));

    // 建立欄位定義並依據標題文字智慧判斷欄位格式
    const columns = [];
    for (let c = 0; c < maxColCount; c++) {
      const rawTitle = String(headerRow[c] ?? '').trim() || `欄位 ${this.getColumnLetter(c)}`;
      let colType = 'text';
      let colWidth = 120;
      let extraProps = {};

      if (/項次|序號|編號|No/i.test(rawTitle)) {
        colWidth = 65;
      } else if (/項目|名稱|設備|位置|內容|說明/.test(rawTitle)) {
        colWidth = 200;
      } else if (/日期|時間/.test(rawTitle)) {
        colType = 'date';
        colWidth = 130;
      } else if (/勾選|目視|點檢結果|是否正常/.test(rawTitle)) {
        colType = 'checkbox';
        extraProps = { checkLabel: '正常' };
        colWidth = 100;
      } else if (/判定|狀態|結論/.test(rawTitle)) {
        colType = 'select';
        extraProps = { options: ['合格', '待追蹤', '異常需檢修'] };
        colWidth = 120;
      } else if (/數值|量測|電壓|電流|溫度|壓力|電阻|頻率/.test(rawTitle)) {
        colType = 'number';
        colWidth = 135;
      } else if (/加總|合計|總計/.test(rawTitle)) {
        colType = 'sum';
        extraProps = { formula: 'COL_SUM' };
        colWidth = 120;
      }

      columns.push(Object.assign({
        id: `c_${c + 1}`,
        title: rawTitle,
        width: colWidth,
        type: colType,
        align: c === 1 ? 'left' : 'center'
      }, extraProps));
    }

    // 建立資料列
    const rows = [];
    for (let i = headerIdxInNonEmpty + 1; i < nonEmptyRows.length; i++) {
      const { rowArr, originalRowIdx } = nonEmptyRows[i];
      const nonBlankCells = rowArr.slice(0, maxColCount).filter(v => String(v ?? '').trim() !== '');

      // 檢查此列在 Excel 中是否為整列跨欄合併，或僅第一格有文字（代表大分類標題列）
      const rowMerge = merges.find(m => m.s.r === originalRowIdx && m.e.r === originalRowIdx && (m.e.c - m.s.c + 1) >= Math.max(2, maxColCount - 1));
      if (rowMerge || (nonBlankCells.length === 1 && String(rowArr[0] ?? '').trim().length >= 4 && isNaN(Number(rowArr[0])))) {
        rows.push({
          id: `sec_${i}`,
          isSection: true,
          sectionTitle: String(nonBlankCells[0] || rowArr[0]).trim(),
          cells: {}
        });
        continue;
      }

      const cellsObj = {};
      let rowTextForRangeDetection = rowArr.map(v => String(v ?? '')).join(' ');
      const rangeMatch = rowTextForRangeDetection.match(/(-?\d+(?:\.\d+)?)\s*[~～\-至]\s*(-?\d+(?:\.\d+)?)\s*([A-Za-z°℃%ΩVvAaWwHz]+)?/);

      columns.forEach((col, cIdx) => {
        let rawVal = rowArr[cIdx];
        let strVal = String(rawVal ?? '').trim();
        const cellData = { value: strVal };

        // 檢查水平跨欄合併
        const cellMerge = merges.find(m => m.s.r === originalRowIdx && m.s.c === cIdx && m.e.c > cIdx);
        if (cellMerge) {
          cellData.colspan = cellMerge.e.c - cellMerge.s.c + 1;
        }

        // 前兩欄（如項次、檢查項目名稱）若已有固定文字，預設設為唯讀方便填表
        if (cIdx <= 1 && strVal !== '') {
          cellData.readOnly = true;
        }

        // 若本列文字含有上下限範圍（例如 210~230V），自動套用至數值欄位的單格上下限設定
        if (col.type === 'number' && rangeMatch) {
          cellData.override = {
            type: 'number',
            min: parseFloat(rangeMatch[1]),
            max: parseFloat(rangeMatch[2]),
            unit: rangeMatch[3] || ''
          };
        }

        // 若儲存格內容為 V / ✓ / 正常，自動識別為勾選
        if (strVal === '✓' || strVal === '☑' || strVal.toUpperCase() === 'TRUE') {
          cellData.value = true;
          if (col.type !== 'checkbox') {
            cellData.override = { type: 'checkbox', checkLabel: '正常' };
          }
        }

        cellsObj[col.id] = cellData;
      });

      rows.push({
        id: `r_${i}`,
        isSection: false,
        cells: cellsObj
      });
    }

    return {
      suggestedName: cleanFileTitle,
      sheetName,
      columns,
      rows
    };
  },

  renderImportPreviewModal() {
    const p = this.pendingImportData;
    const u = App.currentUser;
    const defaultTag = AppConfig.TAGS.includes(u.group) ? u.group : '其他';

    return `
      <div class="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-auto">
          <div class="bg-[#107c41] text-white px-5 py-3.5 flex items-center justify-between">
            <h3 class="font-bold text-sm flex items-center gap-2">
              <i class="fa-solid fa-file-excel"></i>
              Excel 解析成功 — 自動生成定檢表單
            </h3>
            <button onclick="ModuleBuilder.cancelExcelImport()" class="text-white/80 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="p-5 space-y-4 text-xs">
            <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
              <div class="font-bold">✓ 已自動偵測試算表結構：</div>
              <div>・工作表名稱：<strong>${p.sheetName}</strong></div>
              <div>・偵測欄位數：<strong>${p.columns.length} 欄</strong>（${p.columns.map(c => c.title).join('、')}）</div>
              <div>・偵測點檢列數：<strong>${p.rows.length} 列</strong></div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">生成的表單名稱</label>
              <input type="text" id="import-tpl-name" value="${p.suggestedName}"
                class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">所屬分類標籤</label>
                <select id="import-tpl-tag" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold bg-slate-50">
                  ${AppConfig.TAGS.map(t => `<option value="${t}" ${t === defaultTag ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">填寫週期</label>
                <select id="import-tpl-cycle" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold bg-emerald-50 text-emerald-900">
                  ${(App.CYCLES || ['每月', '每季', '半年', '每年']).map(cy => `<option value="${cy}">${cy}</option>`).join('')}
                </select>
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">匯入方式</label>
              <select id="import-tpl-mode" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold bg-slate-50">
                <option value="new">建立為一張新表單範本</option>
                <option value="overwrite">直接覆蓋目前正在編輯的表單</option>
              </select>
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button onclick="ModuleBuilder.cancelExcelImport()" class="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold">取消</button>
              <button onclick="ModuleBuilder.confirmExcelImport()" class="px-5 py-2 rounded-xl bg-[#107c41] hover:bg-emerald-800 text-white font-bold shadow">
                <i class="fa-solid fa-wand-magic-sparkles mr-1"></i>確認生成表單
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  cancelExcelImport() {
    this.pendingImportData = null;
    this.render();
  },

  confirmExcelImport() {
    const p = this.pendingImportData;
    if (!p) return;

    const name = document.getElementById('import-tpl-name').value.trim() || p.suggestedName;
    const tag = document.getElementById('import-tpl-tag').value || '其他';
    const cycle = document.getElementById('import-tpl-cycle').value || '每月';
    const mode = document.getElementById('import-tpl-mode').value;

    if (mode === 'overwrite') {
      const currentTpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
      if (currentTpl) {
        currentTpl.name = name;
        currentTpl.tag = tag;
        currentTpl.cycle = cycle;
        currentTpl.columns = p.columns;
        currentTpl.rows = p.rows;
        currentTpl.updatedAt = new Date().toISOString().slice(0, 10);
      }
    } else {
      const newTpl = {
        id: 'TPL_' + Date.now(),
        name,
        code: `Y642-${Date.now().toString().slice(-4)}`,
        tag,
        cycle,
        department: `Y642 電力維護課 (${tag})`,
        updatedAt: new Date().toISOString().slice(0, 10),
        createdBy: App.currentUser.id,
        columns: p.columns,
        rows: p.rows
      };
      DB.state.templates.unshift(newTpl);
      App.activeTemplateId = newTpl.id;
    }

    this.pendingImportData = null;
    this.selectedColId = null;
    this.selectedRowId = null;
    DB.save();
    this.render();
    App.toast(`已由 Excel 自動生成「${name} (${cycle})」！`, 'success');
  },

  /**
   * 將目前設計中的表單匯出為標準 Excel (.xlsx) 檔案
   */
  exportCurrentToExcel() {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl || typeof XLSX === 'undefined') return;

    const aoa = [];
    // 第 1 列：欄位標題
    aoa.push(tpl.columns.map(c => c.title));

    // 資料列
    tpl.rows.forEach(r => {
      if (r.isSection) {
        aoa.push([r.sectionTitle || '']);
      } else {
        aoa.push(tpl.columns.map(c => {
          const val = r.cells?.[c.id]?.value;
          return val === true ? '✓' : (val ?? '');
        }));
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '定檢表範本');
    XLSX.writeFile(wb, `${tpl.name}.xlsx`);
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

  selectRow(rowId) {
    this.selectedRowId = rowId;
    this.render();
  },

  selectCell(rowId, colId, shouldReRender = true) {
    this.selectedRowId = rowId;
    this.selectedColId = colId;
    if (shouldReRender) this.render();
  },

  updateMeta(key, val) {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    tpl[key] = val;
    tpl.updatedAt = new Date().toISOString().slice(0, 10);
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

  addRow() {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    const cells = {};
    tpl.columns.forEach((c, idx) => {
      cells[c.id] = { value: idx === 0 ? String(tpl.rows.filter(r => !r.isSection).length + 1) : '' };
    });
    const newRow = { id: 'r_' + Date.now(), isSection: false, cells };
    tpl.rows.push(newRow);
    this.selectedRowId = newRow.id;
    DB.save();
    this.render();
  },

  addSectionRow() {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    const newSec = { id: 'sec_' + Date.now(), isSection: true, sectionTitle: '新增分類區段標題', cells: {} };
    tpl.rows.push(newSec);
    this.selectedRowId = newSec.id;
    DB.save();
    this.render();
  },

  deleteRow(rowId) {
    const tpl = DB.state.templates.find(t => t.id === App.activeTemplateId);
    if (!tpl) return;
    tpl.rows = tpl.rows.filter(r => r.id !== rowId);
    this.selectedRowId = tpl.rows[0]?.id || null;
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
      name: `${defaultTag} - 新建定檢表`,
      code: `Y642-${Date.now().toString().slice(-4)}`,
      tag: defaultTag,
      cycle: '每月',
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
            c2: { value: '範例點檢項目 (請直接點擊儲存格修改)', readOnly: false },
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
    App.toast('表單格式、填寫週期與標籤設定已儲存同步！', 'success');
  }
};
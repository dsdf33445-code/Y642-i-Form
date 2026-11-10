/**
 * 模組 4：已完成表單
 * - 依當前使用者權限顯示已決行歸檔的已完成表單
 * - 依照「月份 (YYYY-MM)」分類顯示與篩選
 * - 加入即時關鍵字搜尋框（可搜尋表單名稱、編號、標籤、填表技術員、備註）
 */
window.ModuleCompleted = {
  searchKeyword: '',
  selectedMonth: 'ALL',
  selectedTag: 'ALL',

  render() {
    const container = document.getElementById('view-completed');
    const u = App.currentUser;
    if (!container || !u) return;

    // 1. 取得該使用者有權檢視的所有已完成表單
    const accessibleCompleted = DB.state.records.filter(r => {
      if (r.stage !== 'completed') return false;
      if (u.role === 'chief' || u.id === AppConfig.SUPER_ADMIN_ID) return true;
      const tpl = DB.state.templates.find(t => t.id === r.templateId);
      if (tpl) return App.canUserAccessTemplate(u, tpl);
      return (u.allowedTags || []).includes(r.tag);
    });

    // 取出所有可用月份 (由新到舊排序)
    const months = Array.from(new Set(accessibleCompleted.map(r => r.month))).sort((a, b) => b.localeCompare(a));

    // 2. 依月份、標籤與搜尋框關鍵字過濾
    const kw = this.searchKeyword.trim().toLowerCase();
    const filtered = accessibleCompleted.filter(r => {
      if (this.selectedMonth !== 'ALL' && r.month !== this.selectedMonth) return false;
      if (this.selectedTag !== 'ALL' && r.tag !== this.selectedTag) return false;
      if (kw) {
        const hay = `${r.templateName} ${r.templateCode} ${r.tag} ${r.month} ${r.fillerMemberName} ${r.note || ''} ${r.approvals?.leader?.name || ''}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });

    // 3. 依照月份分組
    const groupedByMonth = {};
    filtered.forEach(r => {
      if (!groupedByMonth[r.month]) groupedByMonth[r.month] = [];
      groupedByMonth[r.month].push(r);
    });
    const sortedGroupMonths = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));

    container.innerHTML = `
      <div class="max-w-6xl mx-auto w-full space-y-4">
        <!-- 頂部搜尋框與月份/標籤篩選列 -->
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <i class="fa-solid fa-box-archive text-emerald-600"></i>
                已完成定檢表單歸檔庫（依月份分類）
              </h2>
              <p class="text-xs text-slate-500 mt-0.5">顯示經課長決行核定之歷史定檢表，可隨時檢視簽核章或匯出 A4 PDF</p>
            </div>
            <span class="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              共 ${filtered.length} 筆已完成表單
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
            <!-- 關鍵字搜尋框 -->
            <div class="sm:col-span-2 relative">
              <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-2.5 text-slate-400"></i>
              <input type="text" value="${this.searchKeyword}"
                oninput="ModuleCompleted.updateSearch(this.value)"
                placeholder="搜尋表單名稱、編號、填表技術員、股別或備註..."
                class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600" />
            </div>

            <!-- 月份篩選 -->
            <div>
              <select onchange="ModuleCompleted.updateMonth(this.value)"
                class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold bg-slate-50">
                <option value="ALL">📅 全部月份 (${months.length} 個月)</option>
                ${months.map(m => `<option value="${m}" ${this.selectedMonth === m ? 'selected' : ''}>${m} 月份</option>`).join('')}
              </select>
            </div>

            <!-- 股別標籤篩選 -->
            <div>
              <select onchange="ModuleCompleted.updateTag(this.value)"
                class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold bg-slate-50">
                <option value="ALL">🏷️ 全部分類標籤</option>
                ${AppConfig.TAGS.map(t => `<option value="${t}" ${this.selectedTag === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- 依月份分組顯示已完成表單 -->
        ${sortedGroupMonths.length === 0 ? `
          <div class="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-xs">
            <i class="fa-solid fa-folder-open text-3xl mb-2 block"></i>
            找不到符合搜尋或篩選條件的已完成表單
          </div>
        ` : sortedGroupMonths.map(monthKey => {
          const list = groupedByMonth[monthKey];
          return `
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div class="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between">
                <div class="font-bold text-xs sm:text-sm flex items-center gap-2">
                  <i class="fa-solid fa-calendar-check text-emerald-400"></i>
                  <span>${monthKey} 月份定檢歸檔</span>
                </div>
                <span class="px-2.5 py-0.5 rounded-full bg-slate-700 text-emerald-300 text-xs font-mono">${list.length} 份表單</span>
              </div>

              <div class="divide-y divide-slate-100">
                ${list.map(r => `
                  <div class="p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="space-y-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[11px] font-extrabold">${r.tag}</span>
                        <span class="font-bold text-sm text-slate-900">${r.templateName}</span>
                        <span class="text-xs font-mono text-slate-400">(${r.templateCode})</span>
                      </div>
                      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span><i class="fa-solid fa-calendar-day mr-1"></i>點檢日：${r.inspectDate}</span>
                        <span><i class="fa-solid fa-user-check mr-1 text-emerald-600"></i>技術員：<strong>${r.approvals?.tech?.name || r.fillerMemberName}</strong></span>
                        <span><i class="fa-solid fa-user-tie mr-1 text-amber-600"></i>複核：<strong>${r.approvals?.leader?.name || '-'}</strong></span>
                        <span><i class="fa-solid fa-stamp mr-1 text-purple-600"></i>決行：<strong>${r.approvals?.chief?.name || '李宗霖'}</strong></span>
                      </div>
                      ${r.note ? `<div class="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg mt-1">備註：${r.note}</div>` : ''}
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                      <button onclick="App.openPdfModal('${r.id}')"
                        class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm">
                        <i class="fa-solid fa-file-pdf"></i> 檢視 / 匯出 PDF
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  updateSearch(val) {
    this.searchKeyword = val;
    this.render();
  },

  updateMonth(val) {
    this.selectedMonth = val;
    this.render();
  },

  updateTag(val) {
    this.selectedTag = val;
    this.render();
  }
};
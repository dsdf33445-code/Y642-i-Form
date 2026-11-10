/**
 * 模組 4：已完成表單歸檔
 * - 標題改為「已完成表單歸檔」，移除副標題說明
 * - 加入年份下拉選單與年度分頁（每頁只顯示當年度月份）
 * - 每月歸檔標題列支援點擊展開 / 收起
 * - 歸檔表單每列只顯示：標籤、表單名稱、點檢日（及右側檢視/匯出 PDF 按鈕）
 */
window.ModuleCompleted = {
  searchKeyword: '',
  selectedYear: '',
  selectedMonth: 'ALL',
  selectedTag: 'ALL',
  collapsedMonths: {}, // 紀錄各月份展開/收起狀態：{ '2026-10': true } 代表收起

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

    // 2. 取出所有可用年份 (由新到舊排序)，若無資料則預設今年度
    const currentYearStr = String(new Date().getFullYear());
    const yearsSet = new Set(accessibleCompleted.map(r => String(r.month || '').slice(0, 4)).filter(Boolean));
    if (yearsSet.size === 0) yearsSet.add(currentYearStr);
    const availableYears = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));

    // 預設選取最新年度（每頁只顯示當年度月份）
    if (!this.selectedYear || !availableYears.includes(this.selectedYear)) {
      this.selectedYear = availableYears[0];
    }

    const currentYearIdx = availableYears.indexOf(this.selectedYear);
    const totalYearPages = availableYears.length;

    // 3. 取出「當年度」底下所有可用月份 (由新到舊排序)
    const monthsInSelectedYear = Array.from(
      new Set(
        accessibleCompleted
          .filter(r => String(r.month || '').startsWith(this.selectedYear))
          .map(r => r.month)
      )
    ).sort((a, b) => b.localeCompare(a));

    if (this.selectedMonth !== 'ALL' && !monthsInSelectedYear.includes(this.selectedMonth)) {
      this.selectedMonth = 'ALL';
    }

    // 4. 依「當年度(分頁)」、月份、標籤與搜尋框關鍵字過濾
    const kw = this.searchKeyword.trim().toLowerCase();
    const filtered = accessibleCompleted.filter(r => {
      if (!String(r.month || '').startsWith(this.selectedYear)) return false;
      if (this.selectedMonth !== 'ALL' && r.month !== this.selectedMonth) return false;
      if (this.selectedTag !== 'ALL' && r.tag !== this.selectedTag) return false;
      if (kw) {
        const hay = `${r.templateName} ${r.tag} ${r.month} ${r.inspectDate}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });

    // 5. 依照當年度月份分組
    const groupedByMonth = {};
    filtered.forEach(r => {
      if (!groupedByMonth[r.month]) groupedByMonth[r.month] = [];
      groupedByMonth[r.month].push(r);
    });
    const sortedGroupMonths = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));

    container.innerHTML = `
      <div class="max-w-6xl mx-auto w-full space-y-4">
        <!-- 頂部搜尋框與年份/月份/標籤篩選列 -->
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <i class="fa-solid fa-box-archive text-emerald-600"></i>
              已完成表單歸檔
            </h2>
            <span class="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              ${this.selectedYear} 年度共 ${filtered.length} 筆已完成表單
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs">
            <!-- 關鍵字搜尋框 -->
            <div class="sm:col-span-2 relative">
              <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-2.5 text-slate-400"></i>
              <input type="text" value="${this.searchKeyword}"
                oninput="ModuleCompleted.updateSearch(this.value)"
                placeholder="搜尋表單名稱、標籤或點檢日..."
                class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600" />
            </div>

            <!-- 年份下拉選單 (切換年度分頁) -->
            <div>
              <select onchange="ModuleCompleted.updateYear(this.value)"
                class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold bg-slate-50">
                ${availableYears.map(y => `<option value="${y}" ${this.selectedYear === y ? 'selected' : ''}>📆 ${y} 年度</option>`).join('')}
              </select>
            </div>

            <!-- 當年度月份下拉選單 -->
            <div>
              <select onchange="ModuleCompleted.updateMonth(this.value)"
                class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold bg-slate-50">
                <option value="ALL">📅 ${this.selectedYear} 全月份 (${monthsInSelectedYear.length} 個月)</option>
                ${monthsInSelectedYear.map(m => `<option value="${m}" ${this.selectedMonth === m ? 'selected' : ''}>${m} 月份</option>`).join('')}
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

        <!-- 依當年度月份分組顯示（點擊月份標題可展開/收起） -->
        ${sortedGroupMonths.length === 0 ? `
          <div class="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-xs">
            <i class="fa-solid fa-folder-open text-3xl mb-2 block"></i>
            ${this.selectedYear} 年度找不到符合條件的已完成表單
          </div>
        ` : sortedGroupMonths.map(monthKey => {
          const list = groupedByMonth[monthKey];
          const isCollapsed = Boolean(this.collapsedMonths[monthKey]);
          return `
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <!-- 月份標題列 (點擊展開 / 收起) -->
              <button type="button" onclick="ModuleCompleted.toggleMonthCollapse('${monthKey}')"
                class="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 flex items-center justify-between transition text-left select-none">
                <div class="font-bold text-xs sm:text-sm flex items-center gap-2.5">
                  <i class="fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'} text-emerald-400 w-3.5 text-center transition-transform"></i>
                  <i class="fa-solid fa-calendar-check text-emerald-400"></i>
                  <span>${monthKey} 月份定檢歸檔</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-[11px] text-slate-300 hidden sm:inline">${isCollapsed ? '點擊展開' : '點擊收起'}</span>
                  <span class="px-2.5 py-0.5 rounded-full bg-slate-700 text-emerald-300 text-xs font-mono">${list.length} 份表單</span>
                </div>
              </button>

              <!-- 歸檔表單清單：只顯示 標籤、表單名稱、點檢日 -->
              <div class="${isCollapsed ? 'hidden' : 'divide-y divide-slate-100'}">
                ${list.map(r => `
                  <div class="px-4 py-3 hover:bg-slate-50 transition flex flex-wrap items-center justify-between gap-3">
                    <div class="flex flex-wrap items-center gap-3 min-w-0">
                      <span class="px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-extrabold shrink-0">${r.tag}</span>
                      <span class="font-bold text-sm text-slate-900 truncate">${r.templateName}</span>
                      <span class="text-xs font-mono text-slate-500 shrink-0">
                        <i class="fa-solid fa-calendar-day mr-1 text-slate-400"></i>點檢日：${r.inspectDate}
                      </span>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                      <button onclick="App.openPdfModal('${r.id}')"
                        class="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm">
                        <i class="fa-solid fa-file-pdf"></i> 檢視 / 匯出 PDF
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}

        <!-- 年度分頁控制列 (每頁顯示單一年度之所有月份) -->
        <div class="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs">
          <div class="text-slate-500 font-semibold">
            目前顯示：<strong class="text-slate-900">${this.selectedYear} 年度</strong>（第 ${currentYearIdx + 1} / ${totalYearPages} 頁，每頁顯示當年度月份）
          </div>
          <div class="flex items-center gap-1.5">
            <button type="button"
              ${currentYearIdx <= 0 ? 'disabled' : ''}
              onclick="ModuleCompleted.goToYearPage(${currentYearIdx - 1})"
              class="px-3 py-1.5 rounded-xl border border-slate-300 font-bold ${currentYearIdx <= 0 ? 'text-slate-300 bg-slate-50 cursor-not-allowed' : 'text-slate-700 bg-white hover:bg-slate-100'}">
              <i class="fa-solid fa-chevron-left mr-1"></i>較新年度
            </button>

            ${availableYears.map((y, idx) => `
              <button type="button"
                onclick="ModuleCompleted.goToYearPage(${idx})"
                class="px-3 py-1.5 rounded-xl font-bold transition ${y === this.selectedYear ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
                ${y} 年
              </button>
            `).join('')}

            <button type="button"
              ${currentYearIdx >= totalYearPages - 1 ? 'disabled' : ''}
              onclick="ModuleCompleted.goToYearPage(${currentYearIdx + 1})"
              class="px-3 py-1.5 rounded-xl border border-slate-300 font-bold ${currentYearIdx >= totalYearPages - 1 ? 'text-slate-300 bg-slate-50 cursor-not-allowed' : 'text-slate-700 bg-white hover:bg-slate-100'}">
              較舊年度<i class="fa-solid fa-chevron-right ml-1"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  toggleMonthCollapse(monthKey) {
    this.collapsedMonths[monthKey] = !this.collapsedMonths[monthKey];
    this.render();
  },

  updateSearch(val) {
    this.searchKeyword = val;
    this.render();
  },

  updateYear(yearVal) {
    this.selectedYear = yearVal;
    this.selectedMonth = 'ALL';
    this.render();
  },

  goToYearPage(pageIndex) {
    const u = App.currentUser;
    const accessibleCompleted = DB.state.records.filter(r => {
      if (r.stage !== 'completed') return false;
      if (u.role === 'chief' || u.id === AppConfig.SUPER_ADMIN_ID) return true;
      const tpl = DB.state.templates.find(t => t.id === r.templateId);
      if (tpl) return App.canUserAccessTemplate(u, tpl);
      return (u.allowedTags || []).includes(r.tag);
    });
    const currentYearStr = String(new Date().getFullYear());
    const yearsSet = new Set(accessibleCompleted.map(r => String(r.month || '').slice(0, 4)).filter(Boolean));
    if (yearsSet.size === 0) yearsSet.add(currentYearStr);
    const availableYears = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));

    if (pageIndex >= 0 && pageIndex < availableYears.length) {
      this.selectedYear = availableYears[pageIndex];
      this.selectedMonth = 'ALL';
      this.render();
    }
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
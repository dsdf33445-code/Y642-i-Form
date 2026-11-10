/**
 * 模組 3：表單管理
 * - 依當前使用者顯示其管理的表單範本與進行中紀錄
 * - 支援依標籤 (A股、B股、C股、D股、其他) 篩選、快速修改標籤、進入設計器編輯、複製或刪除表單
 */
window.ModuleManage = {
  selectedTag: 'ALL',

  render() {
    const container = document.getElementById('view-manage');
    const u = App.currentUser;
    if (!container || !u) return;

    const managedTemplates = DB.state.templates.filter(t => {
      if (!App.canUserAccessTemplate(u, t)) return false;
      if (this.selectedTag !== 'ALL' && t.tag !== this.selectedTag) return false;
      return true;
    });

    container.innerHTML = `
      <div class="max-w-6xl mx-auto w-full space-y-5">
        <!-- 頂部篩選與統計列 -->
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <i class="fa-solid fa-folder-tree text-blue-600"></i>
              表單管理（依您的權限顯示管理之定檢表）
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              目前登入身分：<strong>${u.name} (${u.roleTitle})</strong>｜可管理分類：<strong>${(u.allowedTags || []).join('、')}</strong>
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <button onclick="ModuleManage.setTagFilter('ALL')"
              class="px-3 py-1.5 rounded-xl text-xs font-bold transition ${this.selectedTag === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
              全部顯示 (${DB.state.templates.filter(t => App.canUserAccessTemplate(u, t)).length})
            </button>
            ${AppConfig.TAGS.map(tag => `
              <button onclick="ModuleManage.setTagFilter('${tag}')"
                class="px-3 py-1.5 rounded-xl text-xs font-bold transition ${this.selectedTag === tag ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
                ${tag}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- 表單範本卡片清單 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${managedTemplates.map(tpl => {
            const recCount = DB.state.records.filter(r => r.templateId === tpl.id).length;
            return `
              <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-3">
                <div class="space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="px-2.5 py-0.5 rounded-lg bg-blue-100 text-blue-800 text-xs font-extrabold">${tpl.tag || '其他'}</span>
                    <span class="text-xs font-mono text-slate-400">編號：${tpl.code || '-'}</span>
                  </div>
                  <h3 class="text-sm sm:text-base font-bold text-slate-900">${tpl.name}</h3>
                  <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span><i class="fa-solid fa-table-columns mr-1"></i>${tpl.columns.length} 欄 / ${tpl.rows.filter(r => !r.isSection).length} 項點檢</span>
                    <span><i class="fa-solid fa-file-lines mr-1"></i>累計填表紀錄：${recCount} 筆</span>
                  </div>
                </div>

                <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div class="flex items-center gap-1.5">
                    <span class="text-slate-500 font-semibold">標籤：</span>
                    <select onchange="ModuleManage.changeTemplateTag('${tpl.id}', this.value)"
                      class="border border-slate-300 rounded-lg px-2 py-1 font-bold bg-slate-50">
                      ${AppConfig.TAGS.map(t => `<option value="${t}" ${tpl.tag === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <button onclick="ModuleManage.editInBuilder('${tpl.id}')"
                      class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1">
                      <i class="fa-solid fa-pen-ruler"></i> 編輯表單
                    </button>
                    <button onclick="ModuleManage.duplicateTemplate('${tpl.id}')"
                      class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold">
                      複製
                    </button>
                    <button onclick="ModuleManage.deleteTemplate('${tpl.id}')"
                      class="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold">
                      <i class="fa-solid fa-trash-can"></i> 刪除
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  setTagFilter(tag) {
    this.selectedTag = tag;
    this.render();
  },

  changeTemplateTag(tplId, newTag) {
    const tpl = DB.state.templates.find(t => t.id === tplId);
    if (!tpl) return;
    tpl.tag = newTag;
    DB.state.records.forEach(r => {
      if (r.templateId === tplId) r.tag = newTag;
    });
    DB.save();
    this.render();
    App.toast(`已將「${tpl.name}」分類標籤改為【${newTag}】`, 'success');
  },

  editInBuilder(tplId) {
    App.activeTemplateId = tplId;
    App.switchModule('builder');
  },

  duplicateTemplate(tplId) {
    const src = DB.state.templates.find(t => t.id === tplId);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = 'TPL_' + Date.now();
    copy.name = src.name + ' (複製)';
    copy.code = src.code + '-COPY';
    DB.state.templates.unshift(copy);
    DB.save();
    this.render();
    App.toast('已複製表單範本！', 'success');
  },

  deleteTemplate(tplId) {
    if (DB.state.templates.length <= 1) {
      App.toast('系統至少需保留一張定檢表範本！', 'error');
      return;
    }
    const tpl = DB.state.templates.find(t => t.id === tplId);
    if (!tpl) return;
    if (!confirm(`確定要刪除「${tpl.name}」及其關聯的未結案草稿嗎？`)) return;

    DB.state.templates = DB.state.templates.filter(t => t.id !== tplId);
    DB.state.records = DB.state.records.filter(r => r.templateId !== tplId || r.stage === 'completed');
    DB.save();
    this.render();
    App.toast('已刪除表單範本！', 'info');
  }
};
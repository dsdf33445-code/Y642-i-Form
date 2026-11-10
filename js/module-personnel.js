/**
 * 模組 5：人員管理 (最高權限管理者 鄭毓邦 209874 專屬模組)
 * - 檢視與編輯所有預設人員（課長、工程師、A~D股股長、A~D股技術員共用帳號名單、洪浚豪）
 * - 設定簽核層級（各股技術員 > 各股股長 > 課長，洪浚豪 > 蘇哲彬 > 課長）
 * - 可編輯每位人員「要顯示的表單」（可勾選分類標籤 A~D股/其他，或精確勾選特定表單範本）
 */
window.ModulePersonnel = {
  editingUserId: null,

  render() {
    const container = document.getElementById('view-personnel');
    const u = App.currentUser;
    if (!container) return;

    // 嚴格權限防護：只有鄭毓邦 (209874) 可進入
    if (!u || u.id !== AppConfig.SUPER_ADMIN_ID) {
      container.innerHTML = `
        <div class="p-10 text-center text-red-600 font-bold">
          權限不足：僅最高權限管理者 鄭毓邦 (209874) 可存取人員管理模組！
        </div>
      `;
      return;
    }

    const editingUser = DB.state.users.find(item => item.id === this.editingUserId) || null;

    container.innerHTML = `
      <div class="max-w-6xl mx-auto w-full space-y-5">
        <!-- 頂部說明與新增人員按鈕 -->
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <i class="fa-solid fa-users-gear text-amber-500"></i>
              人員權限、逐級簽核鏈與顯示表單管理（最高管理員 鄭毓邦 專屬）
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              可在此調整各帳號密碼、共用帳號旗下技術員名單、直屬陳核主管，以及個別設定每個人員可顯示的表單。
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="ModulePersonnel.openEditModal('NEW')"
              class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <i class="fa-solid fa-user-plus"></i> 新增人員帳號
            </button>
          </div>
        </div>

        <!-- 人員清單表格 -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-800 text-white">
                  <th class="py-3 px-3.5">帳號 / 工號</th>
                  <th class="py-3 px-3.5">姓名 / 技術員名單</th>
                  <th class="py-3 px-3.5">職稱層級與股別</th>
                  <th class="py-3 px-3.5">直屬陳核對象</th>
                  <th class="py-3 px-3.5">可顯示的表單範圍</th>
                  <th class="py-3 px-3.5 text-center">職章預覽</th>
                  <th class="py-3 px-3.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                ${DB.state.users.map(item => {
                  const sup = DB.state.users.find(s => s.id === item.supervisorId);
                  const customTplCount = (item.allowedTemplateIds || []).length;
                  return `
                    <tr class="hover:bg-slate-50">
                      <td class="py-3 px-3.5 font-mono font-bold text-slate-900">
                        <div>${item.account}</div>
                        <div class="text-[10px] text-slate-400">密碼: ${item.password}</div>
                      </td>
                      <td class="py-3 px-3.5">
                        <div class="font-bold text-slate-900">${item.name}</div>
                        ${item.isSharedAccount ? `
                          <div class="text-[11px] text-emerald-700 font-semibold mt-0.5">
                            共用成員：${(item.members || []).join('、')}
                          </div>
                        ` : ''}
                      </td>
                      <td class="py-3 px-3.5">
                        <span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">${item.roleTitle}</span>
                        <div class="text-[11px] text-slate-500 mt-0.5">所屬：${item.group}</div>
                      </td>
                      <td class="py-3 px-3.5">
                        ${sup
                          ? `<span class="font-bold text-amber-800">${sup.name} (${sup.roleTitle})</span>`
                          : '<span class="text-purple-700 font-bold">最終決行核定</span>'}
                      </td>
                      <td class="py-3 px-3.5">
                        <div class="flex flex-wrap gap-1">
                          ${(item.allowedTags || []).map(t => `<span class="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[11px] font-bold">${t}</span>`).join('')}
                        </div>
                        ${customTplCount > 0 ? `<div class="text-[10px] text-blue-600 font-bold mt-1">★ 已指定 ${customTplCount} 張特定表單</div>` : '<div class="text-[10px] text-slate-400 mt-0.5">依標籤自動顯示</div>'}
                      </td>
                      <td class="py-3 px-3.5 text-center">
                        ${App.renderSealHTML({ name: item.sealText || item.name, roleTitle: item.sealSub || item.roleTitle, customSignature: item.customSignature })}
                      </td>
                      <td class="py-3 px-3.5 text-right">
                        <button onclick="ModulePersonnel.openEditModal('${item.id}')"
                          class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold">
                          <i class="fa-solid fa-Sliders mr-1"></i>編輯權限與表單
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        ${editingUser ? this.renderEditUserModal(editingUser) : ''}
      </div>
    `;
  },

  renderEditUserModal(user) {
    const potentialSupervisors = DB.state.users.filter(u => u.id !== user.id && (u.role === 'leader' || u.role === 'engineer' || u.role === 'chief'));
    const allowedTags = user.allowedTags || [];
    const allowedTplIds = user.allowedTemplateIds || [];

    return `
      <div class="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-auto">
          <div class="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
            <h3 class="font-bold text-sm">
              <i class="fa-solid fa-user-pen text-amber-400 mr-2"></i>
              編輯人員權限與可顯示表單：${user.name} (${user.account})
            </h3>
            <button onclick="ModulePersonnel.closeEditModal()" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">登入帳號 / 職工編號</label>
                <input type="text" id="edit-u-account" value="${user.account}"
                  class="w-full border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">登入密碼</label>
                <input type="text" id="edit-u-password" value="${user.password}"
                  class="w-full border border-slate-300 rounded-xl px-3 py-2 font-mono" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">人員名稱 / 帳號名稱</label>
                <input type="text" id="edit-u-name" value="${user.name}"
                  class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">系統層級角色 (決定顯示模組)</label>
                <select id="edit-u-role" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold bg-slate-50">
                  <option value="tech" ${user.role === 'tech' ? 'selected' : ''}>技術員 (填寫、已完成)</option>
                  <option value="leader" ${user.role === 'leader' ? 'selected' : ''}>股長 (全部模組顯示)</option>
                  <option value="engineer" ${user.role === 'engineer' ? 'selected' : ''}>工程師 (全部模組顯示)</option>
                  <option value="chief" ${user.role === 'chief' ? 'selected' : ''}>課長 (待簽核、已完成)</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">職稱顯示文字</label>
                <input type="text" id="edit-u-roletitle" value="${user.roleTitle}"
                  class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">直屬陳核對象 (下一簽核人)</label>
                <select id="edit-u-supervisor" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold bg-amber-50">
                  <option value="">-- 無 (最終決行課長) --</option>
                  ${potentialSupervisors.map(s => `<option value="${s.id}" ${user.supervisorId === s.id ? 'selected' : ''}>${s.name} (${s.roleTitle})</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- 共用帳號旗下技術員名單 -->
            <div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
              <label class="inline-flex items-center gap-2 font-bold text-emerald-900 cursor-pointer">
                <input type="checkbox" id="edit-u-shared" ${user.isSharedAccount ? 'checked' : ''} class="w-4 h-4 accent-emerald-600" />
                <span>此帳號為「各股技術員共用帳號」（可於填表時下拉切換填表技術員姓名）</span>
              </label>
              <div>
                <label class="block font-bold text-emerald-800 mb-1">旗下技術員名單（以頓號「、」或逗號「,」分隔）</label>
                <input type="text" id="edit-u-members" value="${(user.members || []).join('、')}"
                  class="w-full border border-emerald-300 rounded-xl px-3 py-1.5 bg-white font-bold" />
              </div>
            </div>

            <!-- 可編輯人員要顯示的表單分類標籤與特定表單 -->
            <div class="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-3">
              <h4 class="font-extrabold text-blue-900 flex items-center gap-1.5">
                <i class="fa-solid fa-eye text-blue-600"></i>設定該人員要顯示的表單範圍
              </h4>

              <div>
                <label class="block font-bold text-slate-700 mb-1.5">1. 允許顯示與填寫的「分類標籤」：</label>
                <div class="flex flex-wrap gap-3">
                  ${AppConfig.TAGS.map(tag => `
                    <label class="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-blue-300 cursor-pointer font-bold">
                      <input type="checkbox" name="edit-u-tag" value="${tag}" ${allowedTags.includes(tag) ? 'checked' : ''} class="accent-blue-600" />
                      <span>${tag}</span>
                    </label>
                  `).join('')}
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1.5">
                  2. 指定顯示特定表單（選填；若全不勾選則自動顯示上方所勾選標籤之全部表單）：
                </label>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto bg-white p-2.5 rounded-xl border border-blue-200">
                  ${DB.state.templates.map(tpl => `
                    <label class="inline-flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                      <input type="checkbox" name="edit-u-tpl" value="${tpl.id}" ${allowedTplIds.includes(tpl.id) ? 'checked' : ''} class="accent-blue-600" />
                      <span class="truncate">[${tpl.tag}] ${tpl.name}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button onclick="ModulePersonnel.closeEditModal()" class="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold">取消</button>
              <button onclick="ModulePersonnel.saveUserChanges('${user.id}')" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow">
                儲存人員設定
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  openEditModal(userId) {
    if (userId === 'NEW') {
      const newId = 'U_' + Date.now().toString().slice(-4);
      const newUser = {
        id: newId,
        account: newId,
        password: 'Y642',
        name: '新進人員',
        role: 'tech',
        roleTitle: '技術員',
        group: '其他',
        isSharedAccount: false,
        members: ['新進人員'],
        supervisorId: '209874',
        allowedTags: ['其他'],
        allowedTemplateIds: [],
        sealText: '新進人員',
        sealSub: 'Y642 技術員'
      };
      DB.state.users.push(newUser);
      this.editingUserId = newId;
    } else {
      this.editingUserId = userId;
    }
    this.render();
  },

  closeEditModal() {
    this.editingUserId = null;
    this.render();
  },

  saveUserChanges(userId) {
    const user = DB.state.users.find(u => u.id === userId);
    if (!user) return;

    user.account = document.getElementById('edit-u-account').value.trim() || user.account;
    user.password = document.getElementById('edit-u-password').value.trim() || user.password;
    user.name = document.getElementById('edit-u-name').value.trim() || user.name;
    user.role = document.getElementById('edit-u-role').value;
    user.roleTitle = document.getElementById('edit-u-roletitle').value.trim() || user.roleTitle;
    user.supervisorId = document.getElementById('edit-u-supervisor').value;
    user.isSharedAccount = document.getElementById('edit-u-shared').checked;

    const rawMembers = document.getElementById('edit-u-members').value;
    user.members = rawMembers.split(/[、,，]/).map(s => s.trim()).filter(Boolean);
    if (user.members.length === 0) user.members = [user.name];

    const checkedTags = Array.from(document.querySelectorAll('input[name="edit-u-tag"]:checked')).map(el => el.value);
    user.allowedTags = checkedTags.length > 0 ? checkedTags : ['其他'];
    user.group = checkedTags[0] || user.group;

    const checkedTpls = Array.from(document.querySelectorAll('input[name="edit-u-tpl"]:checked')).map(el => el.value);
    user.allowedTemplateIds = checkedTpls;

    user.sealText = user.isSharedAccount ? user.members[0] : user.name;
    user.sealSub = user.roleTitle;

    DB.save();
    this.editingUserId = null;
    App.renderHeaderAndSidebarUser();
    this.render();
    App.toast(`已更新「${user.name}」的權限與顯示表單設定！`, 'success');
  }
};
/**
 * 模組 5：人員權限管理
 * - 表頭置中，欄位改為：帳密、人員、職稱（刪除所屬顯示）、直屬陳核對象、可顯示的表單範圍（刪除依標籤自動顯示）、職章預覽、操作（編輯/刪除圖示+刪除確認視窗）
 * - 不同標籤以不同顏色區分
 * - 編輯視窗：刪除職稱顯示文字欄位；改為登入帳號、姓名、職位(技術員/股長/工程師/課長/管理員)、下一簽核人(鄭毓邦 (B股股長))
 * - 新增人員帳號時，點擊「建立」按鈕才會寫入建立，點擊取消不會新增
 */
window.ModulePersonnel = {
  editingUserId: null,
  isCreatingNew: false,
  tempNewUser: null,

  render() {
    const container = document.getElementById('view-personnel');
    const u = App.currentUser;
    if (!container) return;

    if (!u || (u.id !== AppConfig.SUPER_ADMIN_ID && u.role !== 'admin')) {
      container.innerHTML = `
        <div class="p-10 text-center text-red-600 font-bold">
          權限不足：僅管理員可存取人員權限管理模組！
        </div>
      `;
      return;
    }

    const editingUser = this.isCreatingNew
      ? this.tempNewUser
      : (DB.state.users.find(item => item.id === this.editingUserId) || null);

    container.innerHTML = `
      <div class="max-w-6xl mx-auto w-full space-y-5">
        <!-- 頂部標題與新增人員按鈕 -->
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <i class="fa-solid fa-users-gear text-amber-500"></i>
              人員權限管理
            </h2>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="ModulePersonnel.openEditModal('NEW')"
              class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <i class="fa-solid fa-user-plus"></i> 新增人員帳號
            </button>
          </div>
        </div>

        <!-- 人員清單表格 (表頭置中) -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-xs">
              <thead>
                <tr class="bg-slate-800 text-white text-center">
                  <th class="py-3 px-3.5 text-center">帳密</th>
                  <th class="py-3 px-3.5 text-center">人員</th>
                  <th class="py-3 px-3.5 text-center">職稱</th>
                  <th class="py-3 px-3.5 text-center">直屬陳核對象</th>
                  <th class="py-3 px-3.5 text-center">可顯示的表單範圍</th>
                  <th class="py-3 px-3.5 text-center">職章預覽</th>
                  <th class="py-3 px-3.5 text-center">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                ${DB.state.users.map(item => {
                  const sup = DB.state.users.find(s => s.id === item.supervisorId);
                  const customTplCount = (item.allowedTemplateIds || []).length;
                  const cleanTitle = App.getCleanTitle(item);
                  return `
                    <tr class="hover:bg-slate-50 text-center">
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
                        <span class="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 text-slate-800 font-bold">${cleanTitle}</span>
                      </td>
                      <td class="py-3 px-3.5">
                        ${sup
                          ? `<span class="font-bold text-amber-800">${sup.name} (${App.getCleanTitle(sup)})</span>`
                          : '<span class="text-purple-700 font-bold">最終決行核定</span>'}
                      </td>
                      <td class="py-3 px-3.5">
                        <div class="flex flex-wrap justify-center gap-1">
                          ${(item.allowedTags || []).map(t => `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold ${App.getTagBadgeClass(t)}">${t}</span>`).join('')}
                        </div>
                        ${customTplCount > 0 ? `<div class="text-[10px] text-blue-600 font-bold mt-1">★ 已指定 ${customTplCount} 張特定表單</div>` : ''}
                      </td>
                      <td class="py-3 px-3.5 text-center">
                        ${App.renderSealHTML({ name: item.sealText || item.name, customSignature: item.customSignature })}
                      </td>
                      <td class="py-3 px-3.5 text-center">
                        <div class="inline-flex items-center justify-center gap-1.5">
                          <button onclick="ModulePersonnel.openEditModal('${item.id}')" title="編輯"
                            class="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 transition flex items-center justify-center">
                            <i class="fa-solid fa-pen-to-square"></i>
                          </button>
                          <button onclick="ModulePersonnel.deleteUser('${item.id}')" title="刪除"
                            class="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 transition flex items-center justify-center">
                            <i class="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
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
    const potentialSupervisors = DB.state.users.filter(
      u => u.id !== user.id && (u.role === 'leader' || u.role === 'engineer' || u.role === 'chief' || u.role === 'admin')
    );
    const allowedTags = user.allowedTags || [];
    const allowedTplIds = user.allowedTemplateIds || [];
    const currentRoleValue = (user.id === AppConfig.SUPER_ADMIN_ID && user.role !== 'leader' && user.role !== 'tech' && user.role !== 'engineer' && user.role !== 'chief')
      ? 'admin'
      : (user.role || 'tech');

    return `
      <div class="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-auto">
          <div class="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
            <h3 class="font-bold text-sm">
              <i class="fa-solid ${this.isCreatingNew ? 'fa-user-plus text-emerald-400' : 'fa-user-pen text-amber-400'} mr-2"></i>
              ${this.isCreatingNew ? '新增人員帳號' : `編輯人員權限與可顯示表單：${user.name} (${user.account})`}
            </h3>
            <button onclick="ModulePersonnel.closeEditModal()" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">登入帳號</label>
                <input type="text" id="edit-u-account" value="${user.account}" placeholder="請輸入工號或帳號"
                  class="w-full border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">登入密碼</label>
                <input type="text" id="edit-u-password" value="${user.password}" placeholder="請輸入密碼"
                  class="w-full border border-slate-300 rounded-xl px-3 py-2 font-mono" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">姓名</label>
                <input type="text" id="edit-u-name" value="${user.name}" placeholder="請輸入姓名"
                  class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">職位</label>
                <select id="edit-u-role" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold bg-slate-50">
                  <option value="tech" ${currentRoleValue === 'tech' ? 'selected' : ''}>技術員</option>
                  <option value="leader" ${currentRoleValue === 'leader' ? 'selected' : ''}>股長</option>
                  <option value="engineer" ${currentRoleValue === 'engineer' ? 'selected' : ''}>工程師</option>
                  <option value="chief" ${currentRoleValue === 'chief' ? 'selected' : ''}>課長</option>
                  <option value="admin" ${currentRoleValue === 'admin' ? 'selected' : ''}>管理員</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">下一簽核人</label>
                <select id="edit-u-supervisor" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold bg-amber-50">
                  <option value="">-- 無 (最終決行課長) --</option>
                  ${potentialSupervisors.map(s => `<option value="${s.id}" ${user.supervisorId === s.id ? 'selected' : ''}>${s.name} (${App.getCleanTitle(s)})</option>`).join('')}
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
                <div class="flex flex-wrap gap-2.5">
                  ${AppConfig.TAGS.map(tag => `
                    <label class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer font-bold ${App.getTagBadgeClass(tag)}">
                      <input type="checkbox" name="edit-u-tag" value="${tag}" ${allowedTags.includes(tag) ? 'checked' : ''} class="accent-slate-900" />
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
                      <span class="px-1.5 py-0.2 rounded text-[10px] font-bold ${App.getTagBadgeClass(tpl.tag)}">${tpl.tag}</span>
                      <span class="truncate">${tpl.name}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button type="button" onclick="ModulePersonnel.closeEditModal()" class="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold">取消</button>
              <button type="button" onclick="ModulePersonnel.saveUserChanges('${user.id}')" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow">
                ${this.isCreatingNew ? '建立' : '儲存人員設定'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 依據職位 (role) 與勾選之股別標籤自動推導乾淨的職稱 (roleTitle)
   */
  deriveRoleTitle(role, checkedTags, existingUser) {
    const mainShiftTag = (checkedTags || []).find(t => ['A股', 'B股', 'C股', 'D股'].includes(t));
    if (role === 'chief') return '課長';
    if (role === 'engineer') return '工程師';
    if (role === 'leader') return mainShiftTag ? `${mainShiftTag}股長` : '股長';
    if (role === 'admin') {
      if (existingUser && existingUser.id === AppConfig.SUPER_ADMIN_ID) return 'B股股長';
      return mainShiftTag ? `${mainShiftTag}股長` : '管理員';
    }
    return mainShiftTag ? `${mainShiftTag}技術員` : '技術員';
  },

  openEditModal(userId) {
    if (userId === 'NEW') {
      const newId = 'U_' + Date.now().toString().slice(-4);
      this.isCreatingNew = true;
      this.editingUserId = newId;
      this.tempNewUser = {
        id: newId,
        account: '',
        password: 'Y642',
        name: '',
        role: 'tech',
        roleTitle: '技術員',
        group: '其他',
        isSharedAccount: false,
        members: [],
        supervisorId: '209874',
        allowedTags: ['其他'],
        allowedTemplateIds: [],
        sealText: '',
        sealSub: '技術員',
        customSignature: ''
      };
    } else {
      this.isCreatingNew = false;
      this.tempNewUser = null;
      this.editingUserId = userId;
    }
    this.render();
  },

  closeEditModal() {
    this.editingUserId = null;
    this.isCreatingNew = false;
    this.tempNewUser = null;
    this.render();
  },

  deleteUser(userId) {
    if (userId === AppConfig.SUPER_ADMIN_ID) {
      App.toast('最高管理員帳號 (209874) 不可刪除！', 'error');
      return;
    }
    const target = DB.state.users.find(u => u.id === userId);
    if (!target) return;

    if (!confirm(`確定要刪除人員「${target.name} (${target.account})」嗎？此操作無法復原。`)) {
      return;
    }

    DB.state.users = DB.state.users.filter(u => u.id !== userId);
    DB.save();
    this.render();
    App.toast(`已刪除人員：${target.name}`, 'info');
  },

  saveUserChanges(userId) {
    const accVal = document.getElementById('edit-u-account').value.trim();
    const pwdVal = document.getElementById('edit-u-password').value.trim();
    const nameVal = document.getElementById('edit-u-name').value.trim();

    if (!accVal || !nameVal) {
      App.toast('請填寫完整的「登入帳號」與「姓名」！', 'error');
      return;
    }

    // 檢查帳號是否與其他人重複
    const duplicate = DB.state.users.find(
      u => u.account.toUpperCase() === accVal.toUpperCase() && u.id !== userId
    );
    if (duplicate) {
      App.toast(`登入帳號「${accVal}」已存在，請使用其他帳號！`, 'error');
      return;
    }

    let user = this.isCreatingNew
      ? this.tempNewUser
      : DB.state.users.find(u => u.id === userId);
    if (!user) return;

    if (this.isCreatingNew) {
      user.id = accVal;
    }

    user.account = accVal;
    user.password = pwdVal || 'Y642';
    user.name = nameVal;
    user.role = document.getElementById('edit-u-role').value;
    user.supervisorId = document.getElementById('edit-u-supervisor').value;
    user.isSharedAccount = document.getElementById('edit-u-shared').checked;

    const rawMembers = document.getElementById('edit-u-members').value;
    user.members = rawMembers.split(/[、,，]/).map(s => s.trim()).filter(Boolean);
    if (user.members.length === 0) user.members = [user.name];

    const checkedTags = Array.from(document.querySelectorAll('input[name="edit-u-tag"]:checked')).map(el => el.value);
    user.allowedTags = checkedTags.length > 0 ? checkedTags : ['其他'];
    user.group = checkedTags[0] || user.group || '其他';

    user.roleTitle = this.deriveRoleTitle(user.role, user.allowedTags, user);

    const checkedTpls = Array.from(document.querySelectorAll('input[name="edit-u-tpl"]:checked')).map(el => el.value);
    user.allowedTemplateIds = checkedTpls;

    user.sealText = user.isSharedAccount ? user.members[0] : user.name;
    user.sealSub = user.roleTitle;

    if (this.isCreatingNew) {
      DB.state.users.push(user);
    }

    const wasCreating = this.isCreatingNew;
    this.editingUserId = null;
    this.isCreatingNew = false;
    this.tempNewUser = null;

    DB.save();
    App.renderHeaderAndSidebarUser();
    this.render();
    App.toast(wasCreating ? `已成功建立人員「${user.name}」！` : `已更新「${user.name}」的權限設定！`, 'success');
  }
};
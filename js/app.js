/* ============================================
 * 蓝莓的学习进度工作台 · 应用逻辑 v2
 * - 进度基于目标总量自动计算
 * - 月历视图 + 周重复任务
 * - 目标配图上传
 * - 板块页面无图标
 * ============================================ */

// ===== 全局状态 =====
let state = {
  sections: [],
  goals: [],
  inspirations: [],
  checkIns: {},
  checkInAmounts: {},
  currentView: 'home',
  currentSectionId: null,
  currentTab: 'items',
};

let calendarDate = new Date(); // 日历当前查看月份

const STORAGE_KEY = 'learning_dashboard_v2';
const IDB_NAME = 'lanmei_learning_dashboard';
const IDB_VERSION = 1;
const IDB_STORE = 'snapshots';
const IDB_KEY = 'main';

// ===== IndexedDB 持久化（更可靠的浏览器存储，容量50MB+） =====
function openIDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('浏览器不支持IndexedDB'));
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });
}

async function saveToIDB(snapshot) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put({ data: snapshot, ts: Date.now() }, IDB_KEY);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  } catch (e) {
    console.warn('IndexedDB保存失败', e);
    return false;
  }
}

async function loadFromIDB() {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => { db.close(); resolve(req.result || null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch (e) {
    console.warn('IndexedDB读取失败', e);
    return null;
  }
}

async function getIDBStatus() {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => {
        db.close();
        if (req.result) {
          const ageMs = Date.now() - (req.result.ts || 0);
          resolve({ ok: true, ts: req.result.ts, ageMs });
        } else {
          resolve({ ok: false });
        }
      };
      req.onerror = () => { db.close(); resolve({ ok: false }); };
    });
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ===== 初始化 =====
async function init() {
  await loadData();
  renderNav();
  startClock();
  navigate('home');
  setupEventListeners();
  setInterval(checkTaskReminders, 60000);
  checkTaskReminders();
  updateStorageStatus(true, true);
}

function setupEventListeners() {
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('modalOverlay').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); hideContextMenu(); }
  });
  // 点击任意位置关闭右键菜单
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('contextMenu');
    if (menu && !menu.contains(e.target)) hideContextMenu();
  });
  // 滚动或调整窗口时关闭右键菜单
  window.addEventListener('scroll', hideContextMenu, true);
  window.addEventListener('resize', hideContextMenu);
}

// ===== 右键上下文菜单 =====
function showSectionContextMenu(e, sectionId) {
  e.preventDefault();
  e.stopPropagation();
  const sec = state.sections.find(s => s.id === sectionId);
  if (!sec) return;

  const menu = document.getElementById('contextMenu');
  const c = getSectionColor(sectionId);

  menu.innerHTML = `
    <div class="ctx-menu-header" style="border-left:3px solid ${c.color}">
      <span class="ctx-dot" style="background:${c.color}"></span>
      <span class="ctx-name">${escapeHtml(sec.name)}</span>
    </div>
    <div class="ctx-menu-item" onclick="hideContextMenu();openRenameSectionModal('${sec.id}')">
      ${ICONS.edit.replace('width="18" height="18"', 'width="16" height="16"')}
      <span>重命名板块</span>
    </div>
    <div class="ctx-menu-divider"></div>
    <div class="ctx-menu-item ctx-danger" onclick="hideContextMenu();confirmDeleteSection('${sec.id}')">
      ${ICONS.trash.replace('width="18" height="18"', 'width="16" height="16"')}
      <span>删除板块</span>
    </div>
  `;

  menu.classList.add('active');

  // 定位菜单，确保不超出视口
  const menuRect = menu.getBoundingClientRect();
  let x = e.clientX;
  let y = e.clientY;
  // 预先测量（菜单display后会有效）
  const w = menu.offsetWidth || 180;
  const h = menu.offsetHeight || 120;
  if (x + w > window.innerWidth - 8) x = window.innerWidth - w - 8;
  if (y + h > window.innerHeight - 8) y = window.innerHeight - h - 8;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

function hideContextMenu() {
  const menu = document.getElementById('contextMenu');
  if (menu) menu.classList.remove('active');
}

// ===== 数据持久化 + 迁移 =====
// 存储策略：IndexedDB 为主（容量大、更可靠），localStorage 兜底
async function loadData() {
  // 1. 优先尝试 IndexedDB
  const idbRecord = await loadFromIDB();
  if (idbRecord && idbRecord.data) {
    const data = idbRecord.data;
    state.sections = data.sections || [];
    state.goals = data.goals || [];
    state.inspirations = data.inspirations || [];
    state.checkIns = data.checkIns || {};
    state.checkInAmounts = data.checkInAmounts || {};
    migrateItemFields();
    // 同步到 localStorage 兜底
    writeLocalStorage();
    console.info('[数据已从IndexedDB加载]', new Date(idbRecord.ts).toLocaleString());
    return;
  }

  // 2. 兜底：localStorage
  let saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      state.sections = data.sections || [];
      state.goals = data.goals || [];
      state.inspirations = data.inspirations || [];
      state.checkIns = data.checkIns || {};
      state.checkInAmounts = data.checkInAmounts || {};
      migrateItemFields();
      // 迁移到 IndexedDB
      saveData();
      return;
    } catch (e) {
      console.error('localStorage解析失败', e);
    }
  }

  // 3. 兼容旧版本 v1
  const v1 = localStorage.getItem('learning_dashboard_v1');
  if (v1) {
    try {
      const v1Data = JSON.parse(v1);
      migrateV1ToV2(v1Data);
      return;
    } catch (e) {
      console.error('v1数据迁移失败', e);
    }
  }

  // 4. 全新用户：加载默认数据
  loadDefaults();
}

function writeLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sections: state.sections,
      goals: state.goals,
      inspirations: state.inspirations,
      checkIns: state.checkIns,
      checkInAmounts: state.checkInAmounts,
    }));
    return true;
  } catch (e) {
    console.warn('localStorage写入失败', e);
    return false;
  }
}

function migrateV1ToV2(v1Data) {
  state.sections = (v1Data.sections || []).map(sec => ({
    ...sec,
    items: (sec.items || []).map(item => ({
      ...item,
      target: item.target || 100,
      completed: item.completed || Math.round((item.progress || 0) * (item.target || 100) / 100),
      unit: item.unit || '次',
    })),
    goals: (sec.goals || []).map(g => ({
      ...g,
      target: g.target || 0,
      completed: g.completed || 0,
      unit: g.unit || '',
    })),
    tasks: (sec.tasks || []).map(t => ({
      ...t,
      recurringDays: t.recurringDays || null,
    })),
  }));
  state.goals = (v1Data.goals || []).map(g => ({
    ...g,
    target: g.target || 0,
    completed: g.completed || 0,
    unit: g.unit || '',
  }));
  state.inspirations = v1Data.inspirations || [];
  state.checkIns = v1Data.checkIns || {};
  state.checkInAmounts = v1Data.checkInAmounts || {};
  saveData();
  showToast('数据已升级到新版本', 'success');
}

function migrateItemFields() {
  state.sections.forEach(sec => {
    (sec.items || []).forEach(item => {
      if (item.target === undefined) { item.target = 100; item.completed = Math.round((item.progress || 0)); item.unit = '次'; }
      if (!item.links && (item.source || item.sourceUrl)) {
        item.links = [{ name: item.source || '', url: item.sourceUrl || '' }];
      } else if (!item.links) {
        item.links = [];
      }
    });
    (sec.goals || []).forEach(g => {
      if (g.target === undefined) { g.target = 0; g.completed = 0; g.unit = ''; }
    });
    (sec.tasks || []).forEach(t => {
      if (t.recurringDays === undefined) t.recurringDays = null;
      if (t.startTime === undefined) {
        t.startTime = t.time || '';
        t.endTime = '';
      }
    });
  });
  state.goals.forEach(g => {
    if (g.target === undefined) { g.target = 0; g.completed = 0; g.unit = ''; }
  });
  // 灵感数据迁移：自动补充分类
  let insChanged = false;
  state.inspirations.forEach(ins => {
    if (!ins.category) {
      const processed = processInspiration(ins.text);
      ins.category = processed.category;
      ins.keywords = processed.keywords;
      ins.summary = processed.summary;
      insChanged = true;
    }
  });
  if (insChanged) saveData();
}

function loadDefaults() {
  state.sections = JSON.parse(JSON.stringify(DEFAULT_SECTIONS));
  state.goals = JSON.parse(JSON.stringify(DEFAULT_GOALS));
  state.inspirations = [];
  state.checkIns = {};
  state.checkInAmounts = {};
  saveData();
}

function saveData() {
  const snapshot = {
    sections: state.sections,
    goals: state.goals,
    inspirations: state.inspirations,
    checkIns: state.checkIns,
    checkInAmounts: state.checkInAmounts,
  };
  // localStorage 兜底
  const lsOk = writeLocalStorage();
  // IndexedDB 主力
  saveToIDB(snapshot).then(idbOk => {
    updateStorageStatus(lsOk, idbOk);
  });
  // 云端自动备份（防抖）
  scheduleCloudBackup();
}

function updateStorageStatus(lsOk, idbOk) {
  const el = document.getElementById('storageStatus');
  if (!el) return;
  if (idbOk) {
    const ts = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    el.innerHTML = `<span class="storage-dot ok"></span>已自动保存 · ${ts}`;
    el.title = '数据自动持久化到本地，刷新页面不会丢失';
  } else if (lsOk) {
    el.innerHTML = `<span class="storage-dot warn"></span>使用本地存储`;
    el.title = '浏览器IndexedDB不可用，已回退到localStorage';
  } else {
    el.innerHTML = `<span class="storage-dot err"></span>存储失败`;
    el.title = '数据可能无法持久化，请导出备份';
  }
}

async function exportData() {
  // 优先从 IndexedDB 取最新的（包括图片等大字段）
  const idb = await loadFromIDB();
  const data = idb?.data
    ? JSON.stringify(idb.data, null, 2)
    : (localStorage.getItem(STORAGE_KEY) || JSON.stringify({
        sections: state.sections, goals: state.goals, inspirations: state.inspirations,
        checkIns: state.checkIns, checkInAmounts: state.checkInAmounts,
      }, null, 2));
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `蓝莓学习工作台_备份_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('数据已导出', 'success');
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.sections && Array.isArray(data.sections)) {
        // 双写：localStorage + IndexedDB
        writeLocalStorage();
        await saveToIDB(data);
        await loadData();
        renderNav();
        navigate(state.currentView);
        showToast('数据导入成功，已恢复所有记录', 'success');
      } else {
        showToast('文件格式不正确', 'error');
      }
    } catch (err) {
      showToast('导入失败：文件格式错误', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ===== 进度计算 =====
function calcProgress(item) {
  if (!item) return 0;
  // 有目标量的：自动计算
  if (item.target && item.target > 0) {
    return Math.min(100, Math.round((item.completed || 0) / item.target * 100));
  }
  // 无目标量的：使用手动progress
  return item.progress || 0;
}

function progressText(item) {
  if (item.target && item.target > 0) {
    return `${item.completed || 0} / ${item.target} ${item.unit || ''}`;
  }
  return `${item.progress || 0}%`;
}

// ===== 时钟 =====
function startClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('clockTime').textContent = `${h}:${m}:${s}`;
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  document.getElementById('clockDate').textContent =
    `${now.getMonth() + 1}月${now.getDate()}日 星期${days[now.getDay()]}`;
}

// ===== 导航 =====
function renderNav() {
  const navList = document.getElementById('navList');
  let html = '';

  html += `<div class="nav-item ${state.currentView === 'home' ? 'active' : ''}" onclick="navigate('home')">
    <span class="nav-icon">${ICONS.home}</span>
    <span class="nav-label">首页</span>
  </div>`;

  html += '<div class="nav-divider"></div>';
  html += '<div class="nav-section-label">学习板块</div>';

  state.sections.forEach(sec => {
    const incompleteCount = (sec.tasks || []).filter(t => !t.completed).length;
    const badge = incompleteCount > 0 ? `<span class="nav-badge">${incompleteCount}</span>` : '';
    html += `<div class="nav-item ${state.currentView === 'section' && state.currentSectionId === sec.id ? 'active' : ''}" onclick="navigate('section','${sec.id}')" oncontextmenu="showSectionContextMenu(event,'${sec.id}')" data-section-id="${sec.id}">
      <span class="nav-icon" style="color:${getSectionColor(sec.id).color}">${ICONS[sec.icon] || ICONS.folder}</span>
      <span class="nav-label">${sec.name}</span>
      ${badge}
    </div>`;
  });

  html += '<div class="nav-divider"></div>';
  html += '<div class="nav-section-label">个人空间</div>';

  html += `<div class="nav-item ${state.currentView === 'goals' ? 'active' : ''}" onclick="navigate('goals')">
    <span class="nav-icon">${ICONS.target}</span>
    <span class="nav-label">个人目标</span>
  </div>`;

  html += `<div class="nav-item ${state.currentView === 'inspiration' ? 'active' : ''}" onclick="navigate('inspiration')">
    <span class="nav-icon">${ICONS.bulb}</span>
    <span class="nav-label">灵感碎碎念</span>
  </div>`;

  html += '<div class="nav-divider"></div>';
  html += `<div class="nav-item ${state.currentView === 'data' ? 'active' : ''}" onclick="navigate('data')">
    <span class="nav-icon">${ICONS.database}</span>
    <span class="nav-label">数据管理</span>
  </div>`;

  navList.innerHTML = html;
}

function navigate(view, sectionId = null) {
  // 离开灵感页面时停止录音
  if (voiceIsRecording && state.currentView === 'inspiration' && view !== 'inspiration') {
    stopVoiceRecording();
  }
  state.currentView = view;
  state.currentSectionId = sectionId;
  state.currentTab = 'items';
  renderNav();

  const titles = {
    home: '首页',
    section: state.sections.find(s => s.id === sectionId)?.name || '板块',
    goals: '个人目标',
    inspiration: '灵感碎碎念',
    data: '数据管理',
  };
  document.getElementById('topBarTitle').textContent = titles[view] || '首页';

  const container = document.getElementById('pageContainer');
  if (view === 'home') container.innerHTML = renderHome();
  else if (view === 'section') container.innerHTML = renderSection(sectionId);
  else if (view === 'goals') container.innerHTML = renderGoalsPage();
  else if (view === 'inspiration') container.innerHTML = renderInspirationPage();
  else if (view === 'data') {
    container.innerHTML = '<div class="card"><div style="padding:48px;text-align:center;color:var(--ink-lighter);">加载中…</div></div>';
    renderDataPage().then(html => {
      if (state.currentView === 'data') container.innerHTML = html;
    });
  }

  document.getElementById('sidebar').classList.remove('open');
  container.scrollTop = 0;
}

// ===== 颜色辅助 =====
function getSectionColor(sectionId) {
  const sec = state.sections.find(s => s.id === sectionId);
  const colorKey = sec?.color || 'teal';
  return SECTION_COLORS[colorKey] || SECTION_COLORS.teal;
}

function setSectionStyle(sectionId) {
  const c = getSectionColor(sectionId);
  document.documentElement.style.setProperty('--accent', c.color);
  document.documentElement.style.setProperty('--accent-bg', c.bg);
}

// ===== 首页 =====
function renderHome() {
  const today = todayStr();
  const allTasks = [];
  state.sections.forEach(sec => {
    (sec.tasks || []).forEach(t => {
      if (!t.completed) allTasks.push({ ...t, sectionName: sec.name, sectionId: sec.id });
    });
  });

  const todayTasks = getTasksForDate(today);
  const totalIncomplete = allTasks.filter(t => !t.recurringDays).length;
  const todayIncomplete = todayTasks.filter(t => !t.completed).length;

  let totalCheckIns = 0;
  let totalItems = 0;
  state.sections.forEach(sec => {
    (sec.items || []).forEach(item => {
      totalItems++;
      if (state.checkIns[`${sec.id}_${item.id}`] === today) totalCheckIns++;
    });
  });

  const hour = new Date().getHours();
  let greeting = '晚安';
  if (hour >= 5 && hour < 9) greeting = '早安';
  else if (hour >= 9 && hour < 12) greeting = '上午好';
  else if (hour >= 12 && hour < 14) greeting = '午安';
  else if (hour >= 14 && hour < 18) greeting = '下午好';
  else if (hour >= 18 && hour < 22) greeting = '晚上好';

  let html = '';

  // 欢迎卡 + 提醒
  html += `<div class="dash-grid">
    <div class="welcome-card">
      <div class="welcome-greeting">${greeting}，今天也要加油呀</div>
      <div class="welcome-title">蓝莓的学习进度工作台</div>
      <div class="welcome-stats">
        <div class="welcome-stat-item">
          <div class="stat-num">${totalItems}</div>
          <div class="stat-label">学习项目</div>
        </div>
        <div class="welcome-stat-item">
          <div class="stat-num">${totalCheckIns}</div>
          <div class="stat-label">今日打卡</div>
        </div>
        <div class="welcome-stat-item">
          <div class="stat-num">${todayIncomplete}</div>
          <div class="stat-label">今日待办</div>
        </div>
        <div class="welcome-stat-item">
          <div class="stat-num">${state.goals.length}</div>
          <div class="stat-label">个人目标</div>
        </div>
      </div>
    </div>

    <div class="card reminder-card">
      <div class="section-title">今日提醒 <span class="deco-line"></span></div>
      <div class="section-subtitle">Today's Reminders</div>
      <div class="reminder-list">
        ${todayTasks.filter(t => !t.completed).length > 0 ? todayTasks.filter(t => !t.completed).map(t => {
          const isUrgent = isTaskUrgent(t);
          return `<div class="reminder-item">
            <div class="reminder-dot ${isUrgent ? 'urgent' : ''}"></div>
            <div class="reminder-content">
              <div class="reminder-title">${escapeHtml(t.title)}</div>
              <div class="reminder-meta">
                <span>${t.sectionName}</span>
                ${formatTaskTime(t) ? ` · <span>${formatTaskTime(t)}</span>` : ''}
                ${t.recurringDays ? ` · <span>每周${formatWeekdays(t.recurringDays)}</span>` : ''}
                ${t.priority === 'high' ? ' · <span style="color:var(--danger)">高优先级</span>' : ''}
              </div>
            </div>
            <button class="btn btn-sm btn-outline" onclick="quickCompleteTask('${t.sectionId}','${t.id}')">完成</button>
          </div>`;
        }).join('') : `
          <div class="reminder-empty">
            ${ICONS.checkEmpty}
            <div>今日任务已全部完成</div>
            <div class="empty-state-hint">享受充实的一天</div>
          </div>
        `}
      </div>
    </div>
  </div>`;

  // 进度概览 - 圆环可视化
  const ringR = 26, ringCirc = 2 * Math.PI * ringR;
  html += `<div class="card" style="margin-bottom:24px;">
    <div class="section-title">学习进度概览 <span class="deco-line"></span></div>
    <div class="section-subtitle">Progress Overview</div>
    <div class="progress-overview-grid">
      ${state.sections.map(sec => {
        const c = getSectionColor(sec.id);
        const items = sec.items || [];
        const avgProgress = items.length > 0
          ? Math.round(items.reduce((sum, i) => sum + calcProgress(i), 0) / items.length)
          : 0;
        const checkedToday = items.filter(i => state.checkIns[`${sec.id}_${i.id}`] === today).length;
        const dashOffset = ringCirc * (1 - avgProgress / 100);
        return `<div class="progress-overview-item" style="--accent:${c.color};--accent-bg:${c.bg}" onclick="navigate('section','${sec.id}')">
          <div class="po-ring">
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle class="po-ring-bg" cx="32" cy="32" r="${ringR}" fill="none" stroke-width="6"/>
              <circle class="po-ring-fill" cx="32" cy="32" r="${ringR}" fill="none" stroke-width="6"
                stroke-dasharray="${ringCirc.toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}"/>
            </svg>
            <div class="po-ring-text">${avgProgress}%</div>
          </div>
          <div class="po-content">
            <div class="po-title">${sec.name}</div>
            <div class="po-sub">${items.length} 项学习 · ${checkedToday} 项已打卡</div>
            <div class="po-bar"><div class="po-bar-fill" style="width:${avgProgress}%"></div></div>
            <div class="po-stats">
              <span>平均进度</span>
              <span class="po-stat-val">${avgProgress}%</span>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  // 月历视图
  html += renderMonthlyCalendar();

  return html;
}

// ===== 月历视图 =====
function renderMonthlyCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const todayDateStr = todayStr();

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const weekHeaders = ['日', '一', '二', '三', '四', '五', '六'];

  let cells = '';
  // 空白格
  for (let i = 0; i < startWeekday; i++) {
    cells += `<div class="cal-cell cal-empty"></div>`;
  }
  // 日期格
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const weekday = dateObj.getDay();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === todayDateStr;

    // 获取当天任务
    const dayTasks = getTasksForDate(dateStr);
    const incompleteTasks = dayTasks.filter(t => !t.completed);

    // 收集各板块颜色
    const dotColors = [];
    incompleteTasks.forEach(t => {
      const c = getSectionColor(t.sectionId);
      if (!dotColors.find(dc => dc === c.color)) dotColors.push(c.color);
    });

    // 生成任务条预览（最多2条）
    const taskPreviews = incompleteTasks.slice(0, 2).map(t => {
      const c = getSectionColor(t.sectionId);
      const timeStr = formatTaskTime(t);
      return `<div class="cal-task-preview" style="border-left-color:${c.color}">
        ${timeStr ? `<span class="cal-task-time">${timeStr}</span>` : ''}
        <span class="cal-task-name">${escapeHtml(t.title.length > 6 ? t.title.slice(0, 6) + '…' : t.title)}</span>
      </div>`;
    }).join('');
    const moreCount = incompleteTasks.length > 2 ? `<div class="cal-task-more">+${incompleteTasks.length - 2} more</div>` : '';

    cells += `<div class="cal-cell ${isToday ? 'cal-today' : ''} ${incompleteTasks.length === 0 ? 'cal-no-task' : ''}" onclick="showDayTasks('${dateStr}')">
      <div class="cal-day-num">${d}</div>
      <div class="cal-task-previews">${taskPreviews}${moreCount}</div>
      ${incompleteTasks.length === 0 ? '' : `<div class="cal-dots">${dotColors.slice(0, 4).map(c => `<span class="cal-dot" style="background:${c}"></span>`).join('')}</div>`}
    </div>`;
  }

  return `<div class="card calendar-section">
    <div class="section-title">
      ${monthNames[month]} ${year}
      <span class="deco-line"></span>
    </div>
    <div class="section-subtitle">Monthly Calendar</div>
    <div class="cal-nav">
      <button class="btn btn-outline btn-sm" onclick="changeCalendarMonth(-1)">${ICONS.chevronLeft.replace('width="24" height="24"','width="16" height="16"')} 上月</button>
      <button class="btn btn-outline btn-sm" onclick="changeCalendarMonth(0)">今天</button>
      <button class="btn btn-outline btn-sm" onclick="changeCalendarMonth(1)">下月 ${ICONS.chevronRight.replace('width="24" height="24"','width="16" height="16"')}</button>
    </div>
    <div class="cal-grid">
      ${weekHeaders.map(w => `<div class="cal-week-header">${w}</div>`).join('')}
      ${cells}
    </div>
    <div class="cal-legend">
      ${state.sections.map(sec => {
        const c = getSectionColor(sec.id);
        return `<span class="cal-legend-item"><span class="cal-dot" style="background:${c.color}"></span>${sec.name}</span>`;
      }).join('')}
    </div>
  </div>`;
}

function changeCalendarMonth(delta) {
  if (delta === 0) {
    calendarDate = new Date();
  } else {
    calendarDate.setMonth(calendarDate.getMonth() + delta);
  }
  navigate('home');
}

// ===== 获取某天的任务（含周重复） =====
function getTasksForDate(dateStr) {
  const date = new Date(dateStr);
  const weekday = date.getDay();
  const tasks = [];
  state.sections.forEach(sec => {
    (sec.tasks || []).forEach(t => {
      // 单次任务：日期匹配
      if (t.date === dateStr) {
        tasks.push({ ...t, sectionName: sec.name, sectionId: sec.id });
      }
      // 周重复任务：星期匹配
      if (t.recurringDays && t.recurringDays.includes(weekday) && t.date !== dateStr) {
        tasks.push({ ...t, sectionName: sec.name, sectionId: sec.id });
      }
    });
  });
  // 按时间排序
  tasks.sort((a, b) => (formatTaskTime(a) || '23:59').localeCompare(formatTaskTime(b) || '23:59'));
  return tasks;
}

function formatWeekdays(days) {
  if (!days || days.length === 0) return '';
  const names = ['日', '一', '二', '三', '四', '五', '六'];
  return days.map(d => names[d]).join('、');
}

// 格式化任务时间段
function formatTaskTime(task) {
  if (task.startTime && task.endTime) {
    return `${task.startTime} - ${task.endTime}`;
  }
  return task.startTime || task.time || '';
}

// 计算任务时长（分钟）
function getTaskDuration(task) {
  if (task.startTime && task.endTime) {
    const [sh, sm] = task.startTime.split(':').map(Number);
    const [eh, em] = task.endTime.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }
  return 0;
}

function showDayTasks(dateStr) {
  const tasks = getTasksForDate(dateStr);
  const d = new Date(dateStr);
  const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日`;
  const weekday = d.getDay();
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  let body = '';
  if (tasks.length === 0) {
    body = `<div class="empty-state">${ICONS.calendar}<div class="empty-state-text">${dateLabel} ${weekdayNames[weekday]} 暂无任务</div><div class="empty-state-hint">点击下方按钮添加任务</div></div>`;
  } else {
    body = `<div class="task-list">${tasks.map(t => {
      const timeStr = formatTaskTime(t);
      const duration = getTaskDuration(t);
      const durationStr = duration > 0 ? ` · ${duration < 60 ? duration + '分钟' : Math.floor(duration/60) + '小时' + (duration%60 > 0 ? (duration%60) + '分' : '')}` : '';
      return `
      <div class="task-item ${t.completed ? 'completed' : ''}">
        <div class="task-checkbox ${t.completed ? 'checked' : ''}" onclick="toggleTaskFromCalendar('${t.sectionId}','${t.id}','${dateStr}')">
          ${t.completed ? ICONS.check : ''}
        </div>
        <div class="task-info">
          <div class="task-title">${escapeHtml(t.title)}</div>
          <div class="task-meta">
            <span class="task-meta-item">${ICONS.folder.replace('width="18" height="18"','width="12" height="12"')} ${t.sectionName}</span>
            ${timeStr ? `<span class="task-meta-item">${ICONS.clock.replace('width="18" height="18"','width="12" height="12"')} ${timeStr}${durationStr}</span>` : ''}
            ${t.recurringDays ? `<span class="task-meta-item">${ICONS.repeat.replace('width="18" height="18"','width="12" height="12"')} 每周${formatWeekdays(t.recurringDays)}</span>` : ''}
            <span class="task-priority ${t.priority}">${t.priority === 'high' ? '高' : t.priority === 'medium' ? '中' : '低'}</span>
          </div>
        </div>
        <button class="task-delete" onclick="deleteTaskFromCalendar('${t.sectionId}','${t.id}','${dateStr}')" title="删除任务">${ICONS.trash}</button>
      </div>
    `}).join('')}</div>`;
  }

  openModal({
    title: `${dateLabel} ${weekdayNames[weekday]}`,
    sub: `${tasks.filter(t => !t.completed).length} 项待完成 · ${tasks.length} 项总计 · <span style="color:var(--ink-lighter);font-size:11px;">点击 ☐ 勾选完成，再点可取消</span>`,
    body: body,
    footer: `
      <button class="btn btn-outline" onclick="closeModal()">关闭</button>
      <button class="btn btn-primary" onclick="addTaskFromDate('${dateStr}')">${ICONS.plus} 添加任务</button>
    `,
  });
}

function addTaskFromDate(dateStr) {
  closeModal();
  // 如果有板块，打开第一个板块的任务添加；否则让用户选择
  if (state.sections.length === 0) {
    showToast('请先创建一个学习板块', 'warning');
    return;
  }
  // 打开板块选择器
  let optionsHtml = state.sections.map(s => {
    const c = getSectionColor(s.id);
    return `<div class="cal-section-pick" onclick="openAddTaskFromDate('${s.id}','${dateStr}')" style="--accent:${c.color}">
      <span class="cal-section-dot" style="background:${c.color}"></span>
      <span>${escapeHtml(s.name)}</span>
    </div>`;
  }).join('');

  openModal({
    title: '选择板块',
    sub: '将任务添加到哪个学习板块？',
    body: `<div class="cal-section-picker">${optionsHtml}</div>`,
    footer: `<button class="btn btn-outline" onclick="closeModal()">取消</button>`,
  });
}

function openAddTaskFromDate(sectionId, dateStr) {
  closeModal();
  setTimeout(() => openAddTaskModal(sectionId, dateStr), 100);
}

function toggleTaskFromCalendar(sectionId, taskId, dateStr) {
  toggleTask(sectionId, taskId);
  // 刷新弹窗
  setTimeout(() => showDayTasks(dateStr), 50);
}

function deleteTaskFromCalendar(sectionId, taskId, dateStr) {
  if (!confirm('确定删除此任务？')) return;
  const sec = state.sections.find(s => s.id === sectionId);
  sec.tasks = sec.tasks.filter(t => t.id !== taskId);
  saveData();
  showToast('任务已删除', 'success');
  // 刷新弹窗
  setTimeout(() => showDayTasks(dateStr), 50);
}

function isTaskUrgent(task) {
  if (task.completed) return false;
  if (task.priority === 'high') return true;
  const now = new Date();
  const taskTimeStr = task.startTime || task.time;
  if (taskTimeStr) {
    const [h, m] = taskTimeStr.split(':').map(Number);
    const taskTime = new Date();
    taskTime.setHours(h, m, 0, 0);
    const diff = (taskTime - now) / 60000;
    if (diff > 0 && diff < 60) return true;
  }
  return false;
}

function quickCompleteTask(sectionId, taskId) {
  toggleTask(sectionId, taskId);
  navigate('home');
  showToast('任务已完成', 'success');
}

// ===== 板块页面 =====
function renderSection(sectionId) {
  const sec = state.sections.find(s => s.id === sectionId);
  if (!sec) return '<div class="empty-state">板块不存在</div>';
  setSectionStyle(sectionId);

  const items = sec.items || [];
  const avgProgress = items.length > 0
    ? Math.round(items.reduce((sum, i) => sum + calcProgress(i), 0) / items.length)
    : 0;
  const today = todayStr();
  const checkedToday = items.filter(i => state.checkIns[`${sec.id}_${i.id}`] === today).length;
  const incompleteTasks = (sec.tasks || []).filter(t => !t.completed).length;
  const c = getSectionColor(sectionId);

  let html = '';

  // Hero - 无图标，仅色块
  html += `<div class="section-hero" style="--accent:${c.color};--accent-bg:${c.bg}">
    <div class="section-hero-color-block" style="background:${c.color}"></div>
    <div class="section-hero-text">
      <div class="section-hero-title">${sec.name}</div>
      <div class="section-hero-sub">${sec.subtitle || ''}</div>
    </div>
    <div class="section-hero-actions">
      <button class="btn btn-sm btn-outline" onclick="openRenameSectionModal('${sec.id}')">${ICONS.edit.replace('width="18" height="18"','width="14" height="14"')} 编辑板块</button>
    </div>
    <div class="section-hero-stats">
      <div class="sh-stat"><div class="sh-stat-num">${items.length}</div><div class="sh-stat-label">学习项目</div></div>
      <div class="sh-stat"><div class="sh-stat-num">${checkedToday}/${items.length}</div><div class="sh-stat-label">今日打卡</div></div>
      <div class="sh-stat"><div class="sh-stat-num">${avgProgress}%</div><div class="sh-stat-label">平均进度</div></div>
      <div class="sh-stat"><div class="sh-stat-num">${incompleteTasks}</div><div class="sh-stat-label">待办任务</div></div>
    </div>
  </div>`;

  // Tabs
  html += `<div class="tabs">
    <div class="tab ${state.currentTab === 'items' ? 'active' : ''}" onclick="switchTab('items')">学习项目</div>
    <div class="tab ${state.currentTab === 'goals' ? 'active' : ''}" onclick="switchTab('goals')">目标与措施</div>
    <div class="tab ${state.currentTab === 'tasks' ? 'active' : ''}" onclick="switchTab('tasks')">任务安排</div>
    <div class="tab ${state.currentTab === 'materials' ? 'active' : ''}" onclick="switchTab('materials')">资料汇总</div>
  </div>`;

  html += `<div class="tab-content ${state.currentTab === 'items' ? 'active' : ''}">${renderItemsTab(sec)}</div>`;
  html += `<div class="tab-content ${state.currentTab === 'goals' ? 'active' : ''}">${renderGoalsTab(sec)}</div>`;
  html += `<div class="tab-content ${state.currentTab === 'tasks' ? 'active' : ''}">${renderTasksTab(sec)}</div>`;
  html += `<div class="tab-content ${state.currentTab === 'materials' ? 'active' : ''}">${renderMaterialsTab(sec)}</div>`;

  return html;
}

function switchTab(tab) {
  state.currentTab = tab;
  navigate('section', state.currentSectionId);
}

// --- 学习项目Tab ---
function renderItemsTab(sec) {
  const items = sec.items || [];
  const c = getSectionColor(sec.id);
  if (items.length === 0) {
    return `<div class="empty-state">
      ${ICONS.list}
      <div class="empty-state-text">暂无学习项目</div>
      <div class="empty-state-hint">点击下方按钮添加第一个学习项目</div>
    </div>
    <button class="btn-add-bar" style="--accent:${c.color};--accent-bg:${c.bg}" onclick="openAddItemModal('${sec.id}')">${ICONS.plus} 添加学习项目</button>`;
  }

  const today = todayStr();
  let html = `<button class="btn-add-bar" style="--accent:${c.color};--accent-bg:${c.bg};margin-bottom:16px;" onclick="openAddItemModal('${sec.id}')">${ICONS.plus} 添加学习项目</button>`;

  html += `<div class="items-grid">`;
  items.forEach(item => {
    const checkKey = `${sec.id}_${item.id}`;
    const isChecked = state.checkIns[checkKey] === today;
    const streak = calculateStreak(sec.id, item.id);
    const progress = calcProgress(item);
    html += `<div class="item-card" style="--accent:${c.color};--accent-bg:${c.bg}">
      <div class="item-header">
        <div>
          <div class="item-name">${escapeHtml(item.name)}</div>
          ${(item.links && item.links.length) ? `<div class="item-source">${item.links.map((lnk, li) => {
            if (li === 0) {
              return lnk.url ? `<a href="${escapeHtml(lnk.url)}" target="_blank">${escapeHtml(lnk.name)}</a>` : escapeHtml(lnk.name);
            }
            return lnk.url ? ` · <a href="${escapeHtml(lnk.url)}" target="_blank">${escapeHtml(lnk.name)}</a>` : ` · ${escapeHtml(lnk.name)}`;
          }).join('')}</div>` : (item.source ? `<div class="item-source">${item.sourceUrl ? `<a href="${escapeHtml(item.sourceUrl)}" target="_blank">${escapeHtml(item.source)}</a>` : escapeHtml(item.source)}</div>` : '')}
        </div>
        <span class="item-freq">${escapeHtml(item.frequency || '未设置')}</span>
      </div>
      <div class="item-progress-info">
        <span class="item-progress-text">${progressText(item)}</span>
        <span class="item-progress-pct">${progress}%</span>
      </div>
      <div class="item-progress-bar"><div class="item-progress-fill" style="width:${progress}%"></div></div>
      <div class="item-footer">
        <div class="item-streak">连续 <b>${streak}</b> 天</div>
        <button class="checkin-btn ${isChecked ? 'checked' : ''}" onclick="${isChecked ? `undoCheckIn('${sec.id}','${item.id}')` : `openCheckInModal('${sec.id}','${item.id}')`}">
          ${isChecked ? '已打卡 · 取消' : '打卡'}
        </button>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button class="btn btn-sm btn-outline" onclick="openEditItemModal('${sec.id}','${item.id}')">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteItem('${sec.id}','${item.id}')">删除</button>
      </div>
    </div>`;
  });
  html += `</div>`;

  return html;
}

// --- 目标Tab ---
function renderGoalsTab(sec) {
  const goals = (sec.goals || []);
  const c = getSectionColor(sec.id);
  let html = `<div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
    <button class="btn btn-primary btn-sm" onclick="openAddGoalModal('${sec.id}')">${ICONS.plus} 添加目标</button>
  </div>`;

  if (goals.length === 0) {
    html += `<div class="empty-state">
      ${ICONS.target}
      <div class="empty-state-text">暂无目标</div>
      <div class="empty-state-hint">设定目标，为学习指引方向</div>
    </div>`;
    return html;
  }

  html += `<div class="goals-grid">`;
  goals.forEach(g => {
    const days = daysUntil(g.deadline);
    const progress = calcProgress(g);
    html += `<div class="goal-card">
      ${g.image ? `<img class="goal-image" src="${g.image}" alt="${escapeHtml(g.name)}">` :
        `<div class="goal-image-placeholder" style="background:linear-gradient(135deg,${c.bg},${c.color}22)">${ICONS.target}</div>`}
      <div class="goal-body">
        <div class="goal-name">${escapeHtml(g.name)}</div>
        <div class="goal-countdown ${days < 0 ? 'expired' : ''}">${days > 0 ? `${days}` : days === 0 ? '今天' : '已过期'} ${days > 0 ? '天' : ''}</div>
        <div class="goal-deadline">截止：${g.deadline}</div>
        ${g.target > 0 ? `<div class="goal-progress-info"><span class="item-progress-text">${g.completed || 0} / ${g.target} ${g.unit || ''}</span><span class="item-progress-pct">${progress}%</span></div>` : ''}
        <div class="item-progress-bar" style="margin-top:${g.target > 0 ? '8px' : '10px'};"><div class="item-progress-fill" style="width:${progress}%"></div></div>
        ${g.measures ? `<div style="font-size:13px;color:var(--ink-light);margin-top:8px;line-height:1.6;">${escapeHtml(g.measures)}</div>` : ''}
        ${g.frequency ? `<div style="font-size:12px;color:var(--gold-dark);margin-top:6px;">频率：${escapeHtml(g.frequency)}</div>` : ''}
        <div class="goal-actions">
          <button class="btn btn-sm btn-outline" onclick="openUpdateProgressModal('${g.id}','${sec.id}')">更新进度</button>
          <button class="btn btn-sm btn-outline" onclick="openEditGoalModal('${sec.id}','${g.id}')">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteGoal('${sec.id}','${g.id}')">删除</button>
        </div>
      </div>
    </div>`;
  });
  html += `</div>`;
  return html;
}

// --- 任务Tab ---
function renderTasksTab(sec) {
  const tasks = sec.tasks || [];
  const c = getSectionColor(sec.id);
  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <div style="font-size:14px;color:var(--ink-light);">${tasks.filter(t => !t.completed).length} 项待完成 · ${tasks.filter(t => t.completed).length} 项已完成</div>
    <button class="btn btn-primary btn-sm" onclick="openAddTaskModal('${sec.id}')">${ICONS.plus} 添加任务</button>
  </div>`;

  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const aTime = formatTaskTime(a) || '9999';
    const bTime = formatTaskTime(b) || '9999';
    return (a.date || '9999' + aTime).localeCompare(b.date || '9999' + bTime);
  });

  if (sorted.length === 0) {
    html += `<div class="empty-state">
      ${ICONS.list}
      <div class="empty-state-text">暂无任务</div>
      <div class="empty-state-hint">添加任务来规划你的学习时间</div>
    </div>`;
    return html;
  }

  html += `<div class="task-list">`;
  sorted.forEach(t => {
    const priorityLabels = { high: '高', medium: '中', low: '低' };
    const timeStr = formatTaskTime(t);
    const duration = getTaskDuration(t);
    const durationStr = duration > 0 ? ` · ${duration < 60 ? duration + '分钟' : Math.floor(duration/60) + '小时' + (duration%60 > 0 ? (duration%60) + '分' : '')}` : '';
    html += `<div class="task-item ${t.completed ? 'completed' : ''}">
      <div class="task-checkbox ${t.completed ? 'checked' : ''}" onclick="toggleTask('${sec.id}','${t.id}')">
        ${t.completed ? ICONS.check : ''}
      </div>
      <div class="task-info">
        <div class="task-title">${escapeHtml(t.title)}</div>
        <div class="task-meta">
          ${t.date ? `<span class="task-meta-item">${ICONS.calendar.replace('width="18" height="18"','width="12" height="12"')} ${t.date}</span>` : ''}
          ${t.recurringDays ? `<span class="task-meta-item">${ICONS.repeat.replace('width="18" height="18"','width="12" height="12"')} 每周${formatWeekdays(t.recurringDays)}</span>` : ''}
          ${timeStr ? `<span class="task-meta-item">${ICONS.clock.replace('width="18" height="18"','width="12" height="12"')} ${timeStr}${durationStr}</span>` : ''}
          <span class="task-priority ${t.priority}">${priorityLabels[t.priority]}</span>
        </div>
      </div>
      <button class="task-delete" onclick="deleteTask('${sec.id}','${t.id}')">${ICONS.trash}</button>
    </div>`;
  });
  html += `</div>`;
  return html;
}

// --- 资料Tab ---
function renderMaterialsTab(sec) {
  const materials = sec.materials || [];
  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <div style="font-size:14px;color:var(--ink-light);">${materials.length} 份资料</div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-outline btn-sm" onclick="openAddLinkModal('${sec.id}')">${ICONS.link} 添加链接</button>
      <button class="btn btn-primary btn-sm" onclick="openUploadModal('${sec.id}')">${ICONS.file} 上传文件</button>
    </div>
  </div>`;

  if (materials.length === 0) {
    html += `<div class="empty-state">
      ${ICONS.folder}
      <div class="empty-state-text">暂无资料</div>
      <div class="empty-state-hint">上传文件或添加链接来汇总学习资料</div>
    </div>`;
    return html;
  }

  html += `<div class="materials-grid">`;
  materials.forEach(m => {
    const iconClass = getMaterialIconClass(m.type);
    const icon = getMaterialIcon(m.type);
    html += `<div class="material-card">
      ${m.type === 'img' && m.data ? `<img class="material-preview" src="${m.data}" alt="${escapeHtml(m.name)}" onclick="viewImage('${m.data}')">` : ''}
      <div class="material-icon ${iconClass}">${icon}</div>
      <div class="material-name">${escapeHtml(m.name)}</div>
      <div class="material-meta">${getMaterialTypeLabel(m.type)} · ${m.date || ''}</div>
      <div class="material-actions">
        ${m.url ? `<a href="${escapeHtml(m.url)}" target="_blank">打开链接</a>` : ''}
        ${m.data && m.type !== 'img' ? `<a href="${m.data}" download="${escapeHtml(m.name)}">下载</a>` : ''}
        ${m.data && m.type === 'img' ? `<button onclick="viewImage('${m.data}')">预览</button>` : ''}
        <button onclick="deleteMaterial('${sec.id}','${m.id}')">删除</button>
      </div>
    </div>`;
  });
  html += `</div>`;
  return html;
}

// ===== 数据管理页面 =====
async function renderDataPage() {
  const status = await getIDBStatus();
  const cfg = getCloudConfig();
  const idbTs = status.ok ? new Date(status.ts).toLocaleString('zh-CN') : '无记录';
  const lsSize = (JSON.stringify({
    sections: state.sections, goals: state.goals, inspirations: state.inspirations,
    checkIns: state.checkIns, checkInAmounts: state.checkInAmounts,
  }).length / 1024).toFixed(1);
  const sectionsCount = state.sections.length;
  const itemsCount = state.sections.reduce((sum, s) => sum + (s.items?.length || 0), 0);
  const tasksCount = state.sections.reduce((sum, s) => sum + (s.tasks?.length || 0), 0);
  const goalsCount = state.goals.length;
  const goalsWithImage = state.goals.filter(g => g.image).length;
  const inspirationsCount = state.inspirations.length;
  const materialsCount = state.sections.reduce((sum, s) => sum + (s.materials?.length || 0), 0);

  let html = `<div class="card" style="margin-bottom:20px;">
    <div class="section-title">数据存储与备份 <span class="deco-line"></span></div>
    <div class="section-subtitle">Long-term Memory</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:20px;">
      <div class="stat-tile"><div class="stat-tile-num">${sectionsCount}</div><div class="stat-tile-label">学习板块</div></div>
      <div class="stat-tile"><div class="stat-tile-num">${itemsCount}</div><div class="stat-tile-label">学习项目</div></div>
      <div class="stat-tile"><div class="stat-tile-num">${tasksCount}</div><div class="stat-tile-label">任务安排</div></div>
      <div class="stat-tile"><div class="stat-tile-num">${goalsCount}</div><div class="stat-tile-label">个人目标</div></div>
      <div class="stat-tile"><div class="stat-tile-num">${goalsWithImage}</div><div class="stat-tile-label">目标配图</div></div>
      <div class="stat-tile"><div class="stat-tile-num">${inspirationsCount}</div><div class="stat-tile-label">灵感记录</div></div>
      <div class="stat-tile"><div class="stat-tile-num">${materialsCount}</div><div class="stat-tile-label">资料</div></div>
    </div>

    <div class="storage-info-row">
      <div class="storage-info-card ok">
        <div class="storage-info-title"><span class="storage-dot ok"></span>主存储 - IndexedDB</div>
        <div class="storage-info-desc">大容量（50MB+），图片数据更安全。最后保存：${idbTs}</div>
      </div>
      <div class="storage-info-card">
        <div class="storage-info-title"><span class="storage-dot"></span>兜底存储 - localStorage</div>
        <div class="storage-info-desc">${lsSize} KB，作为双保险</div>
      </div>
    </div>

    <div class="data-mgmt-actions">
      <button class="btn btn-primary" onclick="exportData()">${ICONS.download} 导出数据备份</button>
      <button class="btn btn-outline" onclick="document.getElementById('importFile').click()">${ICONS.upload} 导入数据备份</button>
      <button class="btn btn-outline" onclick="forceReSave()">${ICONS.database} 立即重新保存</button>
    </div>
    <div class="data-mgmt-hint">建议每周导出一次备份文件到本地。备份文件包含所有学习项目、目标配图、灵感记录和资料，是最可靠的长期记忆方式。</div>
  </div>

  <div class="card" style="margin-bottom:20px;">
    <div class="section-title">云端同步（GitHub） <span class="deco-line"></span></div>
    <div class="section-subtitle">Cloud Backup · 长期记忆保险箱</div>
    <div class="cloud-desc">把全部数据（含目标配图、灵感、资料）备份到你 GitHub 的<strong>私有仓库</strong>里。换浏览器、换电脑时，配置好 Token 点「从云端恢复」即可找回所有记录。</div>
    <div class="cloud-form">
      <label class="cloud-field"><span>GitHub 用户名</span><input class="input" id="cloudUser" placeholder="例如 blueberry" value="${escapeHtml(cfg.user || '')}"></label>
      <label class="cloud-field"><span>仓库名（建议私有）</span><input class="input" id="cloudRepo" placeholder="例如 blueberry-learning-data" value="${escapeHtml(cfg.repo || 'blueberry-learning-data')}"></label>
      <label class="cloud-field"><span>Access Token</span><input class="input" type="password" id="cloudToken" placeholder="ghp_... 或 github_pat_..." value="${escapeHtml(cfg.token || '')}"></label>
      <label class="cloud-check"><input type="checkbox" id="cloudAuto" ${cfg.auto ? 'checked' : ''}> 开启自动备份（每次改动约 1 分钟后自动同步到云端）</label>
    </div>
    <div class="data-mgmt-actions">
      <button class="btn btn-gold" onclick="cloudSaveSettings()">保存设置</button>
      <button class="btn btn-outline" onclick="cloudTestConnection()">测试连接 / 创建仓库</button>
      <button class="btn btn-primary" id="cloudBackupBtn" onclick="cloudBackupNow(true)">${ICONS.upload} 立即备份到云端</button>
      <button class="btn btn-outline" onclick="cloudRestoreNow()">${ICONS.download} 从云端恢复</button>
    </div>
    <div class="cloud-status">${cfg.lastBackup ? '☁ 上次云端备份：' + new Date(cfg.lastBackup).toLocaleString('zh-CN') : '尚未进行过云端备份'}${cfg.user ? ' · 目标仓库：github.com/' + escapeHtml(cfg.user) + '/' + escapeHtml(cfg.repo || '…') : ''}</div>
    <div class="data-mgmt-hint">Token 获取：GitHub → 头像 → Settings → Developer settings → Personal access tokens → Generate new token（勾选 repo 权限）。Token 只保存在你的浏览器里，不会发给其他人。私有仓库只有你自己可见。</div>
  </div>

  <div class="card">
    <div class="section-title">存储说明 <span class="deco-line"></span></div>
    <div class="data-explain">
      <div class="data-explain-item">
        <div class="data-explain-title">📌 数据存放在哪里？</div>
        <div>所有数据都保存在<strong>你正在使用的浏览器</strong>里，不会上传到任何服务器。每次操作会自动保存到本地的 IndexedDB 和 localStorage。</div>
      </div>
      <div class="data-explain-item">
        <div class="data-explain-title">⚠️ 什么情况下数据会丢失？</div>
        <div>在<strong>不同浏览器、不同设备、或无痕模式</strong>下打开网站，会看到全新的数据。建议每个设备第一次打开时导入已有的备份文件。</div>
      </div>
      <div class="data-explain-item">
        <div class="data-explain-title">💾 如何确保数据安全？</div>
        <div>三层保障：本地自动双写（IndexedDB + localStorage）→「云端同步（GitHub）」备份到你的私有仓库（换设备可一键恢复）→ 定期「导出数据备份」下载 JSON 文件到本地。</div>
      </div>
    </div>
  </div>`;

  return html;
}

async function forceReSave() {
  saveData();
  await new Promise(r => setTimeout(r, 200));
  showToast('数据已重新保存', 'success');
  if (state.currentView === 'data') navigate('data');
}

// ===== 个人目标页面 =====
function renderGoalsPage() {
  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
    <div></div>
    <button class="btn btn-primary" onclick="openAddGlobalGoalModal()">${ICONS.plus} 添加个人目标</button>
  </div>`;

  if (state.goals.length === 0) {
    html += `<div class="empty-state">
      ${ICONS.target}
      <div class="empty-state-text">暂无个人目标</div>
      <div class="empty-state-hint">设定目标，配图倒计时，让梦想可见</div>
    </div>`;
    return html;
  }

  html += `<div class="goals-grid">`;
  state.goals.forEach(g => {
    const days = daysUntil(g.deadline);
    const sec = state.sections.find(s => s.id === g.section);
    const secName = sec ? sec.name : '通用';
    const c = sec ? getSectionColor(sec.id) : SECTION_COLORS.teal;
    const progress = calcProgress(g);
    html += `<div class="goal-card" style="--accent:${c.color};--accent-bg:${c.bg}">
      ${g.image ? `<img class="goal-image" src="${g.image}" alt="${escapeHtml(g.name)}">` :
        `<div class="goal-image-placeholder" style="background:linear-gradient(135deg,${c.bg},${c.color}22)">${ICONS.target}</div>`}
      <div class="goal-body">
        <div style="font-size:11px;color:${c.color};font-weight:600;margin-bottom:4px;">${secName}</div>
        <div class="goal-name">${escapeHtml(g.name)}</div>
        <div class="goal-countdown ${days < 0 ? 'expired' : ''}">${days > 0 ? days : days === 0 ? '今天' : '已过期'} ${days > 0 ? '天' : ''}</div>
        <div class="goal-deadline">截止：${g.deadline}</div>
        ${g.target > 0 ? `<div class="goal-progress-info"><span class="item-progress-text">${g.completed || 0} / ${g.target} ${g.unit || ''}</span><span class="item-progress-pct">${progress}%</span></div>` : ''}
        <div class="item-progress-bar" style="margin-top:${g.target > 0 ? '8px' : '10px'};"><div class="item-progress-fill" style="width:${progress}%;background:${c.color}"></div></div>
        ${g.measures ? `<div style="font-size:13px;color:var(--ink-light);margin-top:8px;line-height:1.6;">${escapeHtml(g.measures)}</div>` : ''}
        ${g.frequency ? `<div style="font-size:12px;color:var(--gold-dark);margin-top:6px;">频率：${escapeHtml(g.frequency)}</div>` : ''}
        <div class="goal-actions">
          <button class="btn btn-sm btn-outline" onclick="openUpdateProgressModal('${g.id}','')">${ICONS.edit.replace('width="18" height="18"','width="14" height="14"')} 更新进度</button>
          <button class="btn btn-sm btn-outline" onclick="openEditGlobalGoalModal('${g.id}')">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteGlobalGoal('${g.id}')">删除</button>
        </div>
      </div>
    </div>`;
  });
  html += `</div>`;
  return html;
}

// ===== 灵感碎碎念页面 =====
function renderInspirationPage() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceSupported = !!SR;

  let html = `<div class="card" style="margin-bottom:24px;">
    <div class="section-title">记录灵感 <span class="deco-line"></span></div>
    <div class="section-subtitle">Capture Your Thoughts</div>
    <div class="inspiration-input-area">
      <textarea class="textarea" id="inspirationInput" placeholder="此刻在想什么？说出来或写下来..." style="min-height:100px;margin-bottom:8px;padding-right:52px;"></textarea>
      ${voiceSupported ? `<button class="inspiration-voice-btn" id="voiceBtn" onclick="toggleVoiceRecording()" title="语音输入">${ICONS.mic}</button>` : ''}
    </div>
    <div class="voice-status idle" id="voiceStatus">${voiceSupported ? '' : '当前浏览器不支持语音识别，建议使用 Chrome 或 Edge'}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <input class="input" id="inspirationTag" placeholder="标签（可选，分类会自动生成）" style="width:240px;">
      <button class="btn btn-gold" onclick="addInspiration()">${ICONS.bulb} 记录灵感</button>
    </div>
  </div>`;

  if (state.inspirations.length === 0) {
    html += `<div class="empty-state">
      ${ICONS.bulb}
      <div class="empty-state-text">还没有灵感记录</div>
      <div class="empty-state-hint">每一个想法都值得被记住${voiceSupported ? '，可以语音输入哦' : ''}</div>
    </div>`;
    return html;
  }

  // 视图切换
  html += `<div class="inspiration-view-toggle">
    <button class="inspiration-view-btn ${inspirationViewMode === 'notes' ? 'active' : ''}" onclick="switchInspirationView('notes')">
      ${ICINS_bulbSmall()} 便利贴
    </button>
    <button class="inspiration-view-btn ${inspirationViewMode === 'category' ? 'active' : ''}" onclick="switchInspirationView('category')">
      ${ICONS.grid} 分类总结
    </button>
  </div>`;

  if (inspirationViewMode === 'notes') {
    html += renderInspirationNotesView();
  } else {
    html += renderInspirationCategoryView();
  }

  return html;
}

function ICINS_bulbSmall() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0012 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function switchInspirationView(mode) {
  inspirationViewMode = mode;
  navigate('inspiration');
}

// 便利贴视图
function renderInspirationNotesView() {
  const sorted = [...state.inspirations].sort((a, b) => (b.time || '').localeCompare(a.time || ''));

  let html = `<div class="inspiration-wall">`;
  sorted.forEach((ins, idx) => {
    const color = INSPIRATION_COLORS[idx % INSPIRATION_COLORS.length];
    const angle = (Math.random() - 0.5) * 3;
    const cat = INSPIRATION_CATEGORIES[ins.category || 'other'] || INSPIRATION_CATEGORIES.other;

    // 如果旧数据没有分类，现场补分类
    if (!ins.category) {
      const processed = processInspiration(ins.text);
      ins.category = processed.category;
      ins.keywords = processed.keywords;
      ins.summary = processed.summary;
    }

    html += `<div class="inspiration-note" style="background:${color.bg};color:${color.text};transform:rotate(${angle}deg);">
      <button class="inspiration-delete" onclick="deleteInspiration('${ins.id}')">×</button>
      <div class="inspiration-cat-badge" style="background:${cat.bg};color:${cat.color}">
        ${ICONS.tag} ${cat.name}
      </div>
      ${ins.tag ? `<div class="inspiration-tag">${escapeHtml(ins.tag)}</div>` : ''}
      <div class="inspiration-text">${escapeHtml(ins.text)}</div>
      ${ins.summary ? `<div class="inspiration-summary">
        <div class="inspiration-summary-title" style="color:${cat.color}">${ICONS.sparkle} AI梳理</div>
        <div class="inspiration-summary-content">${escapeHtml(ins.summary)}</div>
      </div>` : ''}
      ${ins.keywords && ins.keywords.length > 0 ? `<div class="inspiration-keywords">
        ${ins.keywords.map(kw => `<span class="inspiration-keyword">${escapeHtml(kw)}</span>`).join('')}
      </div>` : ''}
      <div class="inspiration-time">${formatTime(ins.time)}</div>
    </div>`;
  });
  html += `</div>`;
  return html;
}

// 分类总结视图
function renderInspirationCategoryView() {
  // 按分类分组
  const groups = {};
  state.inspirations.forEach(ins => {
    if (!ins.category) {
      const processed = processInspiration(ins.text);
      ins.category = processed.category;
      ins.keywords = processed.keywords;
      ins.summary = processed.summary;
    }
    if (!groups[ins.category]) groups[ins.category] = [];
    groups[ins.category].push(ins);
  });

  // 按数量排序
  const sortedCats = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

  if (sortedCats.length === 0) {
    return `<div class="empty-state"><div class="empty-state-text">暂无灵感</div></div>`;
  }

  let html = `<div class="inspiration-category-view">`;

  sortedCats.forEach(([catKey, items]) => {
    const cat = INSPIRATION_CATEGORIES[catKey] || INSPIRATION_CATEGORIES.other;
    const sortedItems = [...items].sort((a, b) => (b.time || '').localeCompare(a.time || ''));

    // 生成分类汇总
    const allKeywords = new Set();
    sortedItems.forEach(ins => {
      (ins.keywords || []).forEach(kw => allKeywords.add(kw));
    });
    const topKeywords = Array.from(allKeywords).slice(0, 6);

    const summaryText = `共${sortedItems.length}条灵感` +
      (topKeywords.length > 0 ? `，高频关键词：${topKeywords.join('、')}` : '') +
      `。最近一条：${formatTime(sortedItems[0].time)}记录。`;

    html += `<div class="inspiration-cat-section" style="--accent:${cat.color}">
      <div class="inspiration-cat-header">
        <span class="inspiration-cat-dot" style="background:${cat.color}"></span>
        <span class="inspiration-cat-name">${cat.name}</span>
        <span class="inspiration-cat-count">${sortedItems.length} 条</span>
      </div>
      <div class="inspiration-cat-summary-box">${escapeHtml(summaryText)}</div>
      <div class="inspiration-cat-list">
        ${sortedItems.map(ins => `
          <div class="inspiration-cat-item">
            <span class="inspiration-cat-item-time">${formatTime(ins.time)}</span>
            <span class="inspiration-cat-item-text">${escapeHtml(ins.text)}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
  });

  html += `</div>`;
  return html;
}

// ===== 打卡功能（带数量输入） =====
function openCheckInModal(sectionId, itemId) {
  const sec = state.sections.find(s => s.id === sectionId);
  const item = sec.items.find(i => i.id === itemId);
  const progress = calcProgress(item);

  openModal({
    title: '打卡',
    sub: `${item.name} · 当前 ${progressText(item)}（${progress}%）`,
    body: `
      <div class="form-group">
        <label class="label">本次完成了多少 ${item.unit || '次'} ？</label>
        <input type="number" class="input" id="checkInAmount" value="1" min="1" max="999" style="font-size:18px;text-align:center;font-family:'Cormorant Garamond',serif;">
        <div style="font-size:12px;color:var(--ink-lighter);margin-top:6px;text-align:center;">
          打卡后进度将从 ${progress}% 更新为 ${Math.min(100, Math.round((item.completed + 1) / (item.target || 1) * 100))}%
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:8px;">
        <button class="btn btn-sm btn-outline" onclick="document.getElementById('checkInAmount').value='1'">+1</button>
        <button class="btn btn-sm btn-outline" onclick="document.getElementById('checkInAmount').value='5'">+5</button>
        <button class="btn btn-sm btn-outline" onclick="document.getElementById('checkInAmount').value='10'">+10</button>
      </div>
    `,
    footer: `
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="doCheckIn('${sectionId}','${itemId}')">确认打卡</button>
    `,
  });
}

function doCheckIn(sectionId, itemId) {
  const amount = parseInt(document.getElementById('checkInAmount').value) || 1;
  const checkKey = `${sectionId}_${itemId}`;
  const today = todayStr();
  if (state.checkIns[checkKey] === today) {
    showToast('今天已经打卡过了', 'warning');
    closeModal();
    return;
  }

  state.checkIns[checkKey] = today;
  state.checkInAmounts[checkKey] = amount;
  const sec = state.sections.find(s => s.id === sectionId);
  const item = sec.items.find(i => i.id === itemId);
  item.completed = (item.completed || 0) + amount;
  item.streak = calculateStreak(sectionId, itemId) + 1;
  item.lastCheckIn = today;

  saveData();
  closeModal();
  const newProgress = calcProgress(item);
  showToast(`「${item.name}」打卡成功！+${amount} ${item.unit || '次'}，进度 ${newProgress}%`, 'success');
  navigate('section', sectionId);
}

function undoCheckIn(sectionId, itemId) {
  const checkKey = `${sectionId}_${itemId}`;
  const today = todayStr();
  if (state.checkIns[checkKey] !== today) return;

  const sec = state.sections.find(s => s.id === sectionId);
  const item = sec.items.find(i => i.id === itemId);
  const amount = state.checkInAmounts[checkKey] || 1;

  // 回退数据
  delete state.checkIns[checkKey];
  delete state.checkInAmounts[checkKey];
  item.completed = Math.max(0, (item.completed || 0) - amount);
  item.streak = Math.max(0, (item.streak || 0) - 1);
  // 回退 lastCheckIn：如果没有历史记录了就置空
  const hasHistory = Object.keys(state.checkIns).some(k => k.startsWith(`${sectionId}_${itemId}_`) || k === checkKey);
  if (!hasHistory) item.lastCheckIn = null;

  saveData();
  const newProgress = calcProgress(item);
  showToast(`已取消「${item.name}」今日打卡，进度回退至 ${newProgress}%`, 'info');
  navigate('section', sectionId);
}

function calculateStreak(sectionId, itemId) {
  const checkKey = `${sectionId}_${itemId}`;
  const lastDate = state.checkIns[checkKey];
  if (!lastDate) return 0;

  const sec = state.sections.find(s => s.id === sectionId);
  const item = sec?.items?.find(i => i.id === itemId);
  if (item && item.streak) {
    if (lastDate === todayStr()) return item.streak;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    if (lastDate === yStr) return item.streak;
    return 0;
  }
  return lastDate === todayStr() ? 1 : 0;
}

// ===== 任务功能 =====
function toggleTask(sectionId, taskId) {
  const sec = state.sections.find(s => s.id === sectionId);
  const task = sec.tasks.find(t => t.id === taskId);
  task.completed = !task.completed;
  saveData();
  if (state.currentView === 'section') navigate('section', sectionId);
  else if (state.currentView === 'home') navigate('home');
  if (task.completed) showToast('任务已完成', 'success');
}

function deleteTask(sectionId, taskId) {
  if (!confirm('确定删除此任务？')) return;
  const sec = state.sections.find(s => s.id === sectionId);
  sec.tasks = sec.tasks.filter(t => t.id !== taskId);
  saveData();
  navigate('section', sectionId);
  showToast('任务已删除', 'success');
}

// ===== 学习项目CRUD =====
function deleteItem(sectionId, itemId) {
  if (!confirm('确定删除此学习项目？')) return;
  const sec = state.sections.find(s => s.id === sectionId);
  sec.items = sec.items.filter(i => i.id !== itemId);
  saveData();
  navigate('section', sectionId);
  showToast('项目已删除', 'success');
}

function openAddItemModal(sectionId) {
  openModal({
    title: '添加学习项目',
    sub: '设定目标总量，进度自动计算',
    body: `
      <div class="form-group">
        <label class="label">项目名称</label>
        <input class="input" id="itemName" placeholder="如：影子跟读">
      </div>
      <div class="form-group">
        <label class="label">来源链接</label>
        <div id="itemLinksContainer">
          <div class="link-row" style="display:flex;gap:8px;margin-bottom:8px;">
            <input class="input link-name" placeholder="来源名称（如：灵格AI英语）" style="flex:1;">
            <input class="input link-url" placeholder="网址 https://..." style="flex:1.5;">
            <button class="btn btn-sm btn-outline link-remove" onclick="removeLinkRow(this)" style="flex-shrink:0;">×</button>
          </div>
        </div>
        <button class="btn btn-sm btn-outline" onclick="addLinkRow()">+ 添加链接</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">频率</label>
          <select class="select" id="itemFreq">
            <option value="每日">每日</option>
            <option value="每周2次">每周2次</option>
            <option value="每周3次">每周3次</option>
            <option value="每周5次">每周5次</option>
            <option value="每周1次">每周1次</option>
            <option value="每月1次">每月1次</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">单位（如：篇/次/套）</label>
          <input class="input" id="itemUnit" placeholder="篇" value="次">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">目标总量</label>
          <input type="number" class="input" id="itemTarget" min="1" value="100" placeholder="如：100">
        </div>
        <div class="form-group">
          <label class="label">已完成数量</label>
          <input type="number" class="input" id="itemCompleted" min="0" value="0">
        </div>
      </div>
      <div style="font-size:12px;color:var(--ink-lighter);margin-top:-8px;">
        进度将自动计算 = 已完成数量 / 目标总量 × 100%
      </div>
    `,
    footer: `
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="addItem('${sectionId}')">添加</button>
    `,
  });
}

function addLinkRow() {
  const container = document.getElementById('itemLinksContainer');
  const row = document.createElement('div');
  row.className = 'link-row';
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';
  row.innerHTML = `
    <input class="input link-name" placeholder="来源名称" style="flex:1;">
    <input class="input link-url" placeholder="网址 https://..." style="flex:1.5;">
    <button class="btn btn-sm btn-outline link-remove" onclick="removeLinkRow(this)" style="flex-shrink:0;">×</button>
  `;
  container.appendChild(row);
}

function removeLinkRow(btn) {
  const container = document.getElementById('itemLinksContainer');
  if (container.children.length > 1) {
    btn.parentElement.remove();
  } else {
    btn.parentElement.querySelector('.link-name').value = '';
    btn.parentElement.querySelector('.link-url').value = '';
  }
}

function collectLinksFromForm(containerId) {
  const container = document.getElementById(containerId);
  const rows = container.querySelectorAll('.link-row');
  const links = [];
  rows.forEach(row => {
    const name = row.querySelector('.link-name').value.trim();
    const url = row.querySelector('.link-url').value.trim();
    if (name || url) links.push({ name: name || url, url: url });
  });
  return links;
}

function addItem(sectionId) {
  const name = document.getElementById('itemName').value.trim();
  if (!name) { showToast('请输入项目名称', 'warning'); return; }
  const sec = state.sections.find(s => s.id === sectionId);
  const links = collectLinksFromForm('itemLinksContainer');
  const newItem = {
    id: 'item_' + Date.now(),
    name: name,
    links: links,
    source: links.length ? links[0].name : '',
    sourceUrl: links.length ? links[0].url : '',
    frequency: document.getElementById('itemFreq').value,
    target: parseInt(document.getElementById('itemTarget').value) || 100,
    completed: parseInt(document.getElementById('itemCompleted').value) || 0,
    unit: document.getElementById('itemUnit').value.trim() || '次',
    streak: 0,
    lastCheckIn: null,
  };
  sec.items.push(newItem);
  saveData();
  closeModal();
  navigate('section', sectionId);
  showToast('学习项目已添加', 'success');
}

function openEditItemModal(sectionId, itemId) {
  const sec = state.sections.find(s => s.id === sectionId);
  const item = sec.items.find(i => i.id === itemId);
  const links = (item.links && item.links.length) ? item.links : (item.source || item.sourceUrl ? [{ name: item.source || '', url: item.sourceUrl || '' }] : []);

  openModal({
    title: '编辑学习项目',
    body: `
      <div class="form-group">
        <label class="label">项目名称</label>
        <input class="input" id="editItemName" value="${escapeHtml(item.name)}">
      </div>
      <div class="form-group">
        <label class="label">来源链接</label>
        <div id="editItemLinksContainer">
          ${links.length ? links.map(lnk => `
            <div class="link-row" style="display:flex;gap:8px;margin-bottom:8px;">
              <input class="input link-name" placeholder="来源名称" style="flex:1;" value="${escapeHtml(lnk.name || '')}">
              <input class="input link-url" placeholder="网址 https://..." style="flex:1.5;" value="${escapeHtml(lnk.url || '')}">
              <button class="btn btn-sm btn-outline link-remove" onclick="removeEditLinkRow(this)" style="flex-shrink:0;">×</button>
            </div>
          `).join('') : `
            <div class="link-row" style="display:flex;gap:8px;margin-bottom:8px;">
              <input class="input link-name" placeholder="来源名称" style="flex:1;">
              <input class="input link-url" placeholder="网址 https://..." style="flex:1.5;">
              <button class="btn btn-sm btn-outline link-remove" onclick="removeEditLinkRow(this)" style="flex-shrink:0;">×</button>
            </div>
          `}
        </div>
        <button class="btn btn-sm btn-outline" onclick="addEditLinkRow()">+ 添加链接</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">频率</label>
          <select class="select" id="editItemFreq">
            ${['每日','每周2次','每周3次','每周5次','每周1次','每月1次'].map(f =>
              `<option value="${f}" ${item.frequency === f ? 'selected' : ''}>${f}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="label">单位</label>
          <input class="input" id="editItemUnit" value="${escapeHtml(item.unit || '次')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">目标总量</label>
          <input type="number" class="input" id="editItemTarget" min="1" value="${item.target || 100}">
        </div>
        <div class="form-group">
          <label class="label">已完成数量</label>
          <input type="number" class="input" id="editItemCompleted" min="0" value="${item.completed || 0}">
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="editItem('${sectionId}','${itemId}')">保存</button>
    `,
  });
}

function addEditLinkRow() {
  const container = document.getElementById('editItemLinksContainer');
  const row = document.createElement('div');
  row.className = 'link-row';
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';
  row.innerHTML = `
    <input class="input link-name" placeholder="来源名称" style="flex:1;">
    <input class="input link-url" placeholder="网址 https://..." style="flex:1.5;">
    <button class="btn btn-sm btn-outline link-remove" onclick="removeEditLinkRow(this)" style="flex-shrink:0;">×</button>
  `;
  container.appendChild(row);
}

function removeEditLinkRow(btn) {
  const container = document.getElementById('editItemLinksContainer');
  if (container.children.length > 1) {
    btn.parentElement.remove();
  } else {
    btn.parentElement.querySelector('.link-name').value = '';
    btn.parentElement.querySelector('.link-url').value = '';
  }
}

function editItem(sectionId, itemId) {
  const sec = state.sections.find(s => s.id === sectionId);
  const item = sec.items.find(i => i.id === itemId);
  item.name = document.getElementById('editItemName').value.trim();
  const links = collectLinksFromForm('editItemLinksContainer');
  item.links = links;
  item.source = links.length ? links[0].name : '';
  item.sourceUrl = links.length ? links[0].url : '';
  item.frequency = document.getElementById('editItemFreq').value;
  item.unit = document.getElementById('editItemUnit').value.trim() || '次';
  item.target = parseInt(document.getElementById('editItemTarget').value) || 100;
  item.completed = parseInt(document.getElementById('editItemCompleted').value) || 0;
  saveData();
  closeModal();
  navigate('section', sectionId);
  showToast('项目已更新', 'success');
}

// ===== 目标功能 =====
function deleteGoal(sectionId, goalId) {
  if (!confirm('确定删除此目标？')) return;
  const sec = state.sections.find(s => s.id === sectionId);
  sec.goals = sec.goals.filter(g => g.id !== goalId);
  state.goals = state.goals.filter(g => g.id !== goalId);
  saveData();
  navigate('section', sectionId);
  showToast('目标已删除', 'success');
}

function deleteGlobalGoal(goalId) {
  if (!confirm('确定删除此目标？')) return;
  const goal = state.goals.find(g => g.id === goalId);
  if (goal && goal.section) {
    const sec = state.sections.find(s => s.id === goal.section);
    if (sec) sec.goals = sec.goals.filter(g => g.id !== goalId);
  }
  state.goals = state.goals.filter(g => g.id !== goalId);
  saveData();
  navigate('goals');
  showToast('目标已删除', 'success');
}

// ===== 更新进度（目标量型 vs 手动型） =====
function openUpdateProgressModal(goalId, sectionId) {
  const goal = sectionId
    ? state.sections.find(s => s.id === sectionId).goals.find(g => g.id === goalId)
    : state.goals.find(g => g.id === goalId);
  if (!goal) return;

  if (goal.target && goal.target > 0) {
    // 目标量型：输入完成数量
    openModal({
      title: '更新目标进度',
      sub: `${goal.name} · 当前 ${goal.completed || 0}/${goal.target} ${goal.unit || ''}（${calcProgress(goal)}%）`,
      body: `
        <div class="form-group">
          <label class="label">已完成数量</label>
          <input type="number" class="input" id="goalCompletedInput" value="${goal.completed || 0}" min="0" max="${goal.target}" style="font-size:18px;text-align:center;font-family:'Cormorant Garamond',serif;">
        </div>
        <div class="item-progress-bar"><div class="item-progress-fill" style="width:${calcProgress(goal)}%"></div></div>
        <div style="text-align:center;font-size:13px;color:var(--ink-light);margin-top:8px;">
          进度：${calcProgress(goal)}%
        </div>
      `,
      footer: `
        <button class="btn btn-outline" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="saveGoalCompleted('${goalId}','${sectionId || ''}')">保存</button>
      `,
    });
  } else {
    // 手动型：滑动条
    openModal({
      title: '更新目标进度',
      sub: goal.name,
      body: `
        <div class="form-group">
          <label class="label">当前进度：${goal.progress || 0}%</label>
          <input type="range" class="input" id="progressSlider" min="0" max="100" value="${goal.progress || 0}" oninput="document.getElementById('progressVal').textContent=this.value+'%'">
          <div style="text-align:center;font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:700;color:var(--gold-dark);margin-top:8px;" id="progressVal">${goal.progress || 0}%</div>
        </div>
      `,
      footer: `
        <button class="btn btn-outline" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="saveGoalProgress('${goalId}','${sectionId || ''}')">保存</button>
      `,
    });
  }
}

function saveGoalCompleted(goalId, sectionId) {
  const completed = parseInt(document.getElementById('goalCompletedInput').value) || 0;
  if (sectionId) {
    const sec = state.sections.find(s => s.id === sectionId);
    const goal = sec.goals.find(g => g.id === goalId);
    goal.completed = completed;
    const globalGoal = state.goals.find(g => g.id === goalId);
    if (globalGoal) globalGoal.completed = completed;
  } else {
    const goal = state.goals.find(g => g.id === goalId);
    goal.completed = completed;
    if (goal.section) {
      const sec = state.sections.find(s => s.id === goal.section);
      const secGoal = sec?.goals?.find(g => g.id === goalId);
      if (secGoal) secGoal.completed = completed;
    }
  }
  saveData();
  closeModal();
  if (sectionId) navigate('section', sectionId);
  else navigate('goals');
  showToast('进度已更新', 'success');
}

function saveGoalProgress(goalId, sectionId) {
  const progress = parseInt(document.getElementById('progressSlider').value);
  if (sectionId) {
    const sec = state.sections.find(s => s.id === sectionId);
    const goal = sec.goals.find(g => g.id === goalId);
    goal.progress = progress;
    const globalGoal = state.goals.find(g => g.id === goalId);
    if (globalGoal) globalGoal.progress = progress;
  } else {
    const goal = state.goals.find(g => g.id === goalId);
    goal.progress = progress;
    if (goal.section) {
      const sec = state.sections.find(s => s.id === goal.section);
      const secGoal = sec?.goals?.find(g => g.id === goalId);
      if (secGoal) secGoal.progress = progress;
    }
  }
  saveData();
  closeModal();
  if (sectionId) navigate('section', sectionId);
  else navigate('goals');
  showToast('进度已更新', 'success');
}

// ===== 资料功能 =====
function deleteMaterial(sectionId, materialId) {
  if (!confirm('确定删除此资料？')) return;
  const sec = state.sections.find(s => s.id === sectionId);
  sec.materials = sec.materials.filter(m => m.id !== materialId);
  saveData();
  navigate('section', sectionId);
  showToast('资料已删除', 'success');
}

function viewImage(dataUrl) {
  openModal({
    title: '图片预览',
    body: `<img src="${dataUrl}" style="width:100%;border-radius:var(--radius-md);">`,
    footer: `<button class="btn btn-outline" onclick="closeModal()">关闭</button>`,
  });
}

// ===== 灵感功能 =====

/* --- 语音识别 --- */
let voiceRecognition = null;
let voiceIsRecording = false;
let voiceFinalText = '';

function initVoiceRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = 'zh-CN';
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        voiceFinalText += transcript;
      } else {
        interim += transcript;
      }
    }
    const textarea = document.getElementById('inspirationInput');
    if (textarea) {
      textarea.value = voiceFinalText + interim;
      textarea.scrollTop = textarea.scrollHeight;
    }
  };
  rec.onerror = (event) => {
    if (event.error === 'no-speech') return;
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showToast('麦克风权限被拒绝，请在浏览器设置中允许', 'error');
      stopVoiceRecording();
    } else if (event.error === 'network') {
      showToast('语音识别网络错误', 'error');
      stopVoiceRecording();
    }
  };
  rec.onend = () => {
    if (voiceIsRecording) {
      try { rec.start(); } catch(e) {}
    }
  };
  return rec;
}

function toggleVoiceRecording() {
  if (voiceIsRecording) {
    stopVoiceRecording();
  } else {
    startVoiceRecording();
  }
}

function startVoiceRecording() {
  if (!voiceRecognition) {
    voiceRecognition = initVoiceRecognition();
  }
  if (!voiceRecognition) {
    showToast('当前浏览器不支持语音识别，请使用 Chrome 或 Edge', 'error');
    return;
  }
  voiceFinalText = document.getElementById('inspirationInput').value || '';
  try {
    voiceRecognition.start();
    voiceIsRecording = true;
    const btn = document.getElementById('voiceBtn');
    if (btn) {
      btn.classList.add('recording');
      btn.innerHTML = ICONS.micOff;
    }
    const status = document.getElementById('voiceStatus');
    if (status) {
      status.className = 'voice-status';
      status.textContent = '正在聆听... 点击麦克风停止';
    }
  } catch(e) {
    showToast('语音识别启动失败', 'error');
  }
}

function stopVoiceRecording() {
  voiceIsRecording = false;
  if (voiceRecognition) {
    try { voiceRecognition.stop(); } catch(e) {}
  }
  const btn = document.getElementById('voiceBtn');
  if (btn) {
    btn.classList.remove('recording');
    btn.innerHTML = ICONS.mic;
  }
  const status = document.getElementById('voiceStatus');
  if (status) {
    status.className = 'voice-status idle';
    const text = document.getElementById('inspirationInput')?.value?.trim();
    if (text) {
      status.textContent = '语音输入完成，可继续编辑或直接记录';
    } else {
      status.textContent = '';
    }
  }
}

/* --- 分类引擎 --- */
function classifyInspiration(text) {
  const lowerText = text.toLowerCase();
  let bestCat = 'other';
  let bestScore = 0;
  const scores = {};

  for (const [key, cat] of Object.entries(INSPIRATION_CATEGORIES)) {
    if (key === 'other') continue;
    let score = 0;
    for (const kw of cat.keywords) {
      const lowerKw = kw.toLowerCase();
      if (lowerText.includes(lowerKw)) {
        score += lowerKw.length > 2 ? 3 : 2;
      }
    }
    scores[key] = score;
    if (score > bestScore) {
      bestScore = score;
      bestCat = key;
    }
  }

  return {
    category: bestCat,
    score: bestScore,
    scores: scores,
  };
}

function extractKeywords(text, category) {
  const keywords = new Set();
  const cat = INSPIRATION_CATEGORIES[category];
  if (cat) {
    const lowerText = text.toLowerCase();
    for (const kw of cat.keywords) {
      if (lowerText.includes(kw.toLowerCase())) {
        keywords.add(kw);
      }
      if (keywords.size >= 5) break;
    }
  }
  // 也提取一些通用关键词（双字以上的名词短语）
  const phrases = text.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
  const stopWords = ['的话', '的话', '就是', '可以', '这样', '那个', '这个', '什么', '怎么', '为什么', '因为', '所以', '但是', '不过', '然后', '其实', '觉得', '感觉', '一下', '一些', '一直', '一定', '一般', '一下', '可能'];
  for (const p of phrases) {
    if (!stopWords.includes(p) && p.length >= 2) {
      keywords.add(p);
    }
    if (keywords.size >= 6) break;
  }
  return Array.from(keywords).slice(0, 5);
}

function generateInspirationSummary(text, category, keywords) {
  const sentences = text.split(/[。！？\n.!?]+/).map(s => s.trim()).filter(s => s.length > 2);
  const catName = INSPIRATION_CATEGORIES[category]?.name || '其他';

  if (sentences.length <= 1) {
    return `这条灵感属于「${catName}」类别。${keywords.length > 0 ? '关键词：' + keywords.join('、') + '。' : ''}记录了此刻的想法。`;
  }

  // 选取关键句：包含最多关键词的句子
  let bestSentence = sentences[0];
  let bestCount = 0;
  for (const s of sentences) {
    let count = 0;
    for (const kw of keywords) {
      if (s.includes(kw)) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestSentence = s;
    }
  }

  const kwStr = keywords.length > 0 ? `关键词：${keywords.slice(0, 3).join('、')}。` : '';
  return `「${catName}」· 共${sentences.length}句 · ${kwStr}核心：${bestSentence}`;
}

function processInspiration(text) {
  const result = classifyInspiration(text);
  const keywords = extractKeywords(text, result.category);
  const summary = generateInspirationSummary(text, result.category, keywords);
  return {
    category: result.category,
    keywords: keywords,
    summary: summary,
  };
}

/* --- 灵感视图状态 --- */
let inspirationViewMode = 'notes'; // 'notes' | 'category'

function addInspiration() {
  const text = document.getElementById('inspirationInput').value.trim();
  const tag = document.getElementById('inspirationTag').value.trim();
  if (!text) { showToast('请输入灵感内容', 'warning'); return; }

  // 停止录音如果还在录
  if (voiceIsRecording) stopVoiceRecording();

  // 自动分类和生成摘要
  const processed = processInspiration(text);

  state.inspirations.push({
    id: 'ins_' + Date.now(),
    text: text,
    tag: tag,
    time: new Date().toISOString(),
    category: processed.category,
    keywords: processed.keywords,
    summary: processed.summary,
  });
  saveData();
  navigate('inspiration');
  showToast(`灵感已记录 · 自动归类为「${INSPIRATION_CATEGORIES[processed.category].name}」`, 'success');
}

function deleteInspiration(insId) {
  state.inspirations = state.inspirations.filter(i => i.id !== insId);
  saveData();
  navigate('inspiration');
  showToast('灵感已删除', 'success');
}

// ===== 新增板块 =====
function openAddSectionModal() {
  const colorOptions = ['teal', 'gold', 'rose', 'plum', 'sage', 'amber'];
  openModal({
    title: '新增学习板块',
    sub: '创建属于你的学习领域',
    body: `
      <div class="form-group">
        <label class="label">板块名称</label>
        <input class="input" id="newSecName" placeholder="如：编程学习">
      </div>
      <div class="form-group">
        <label class="label">副标题（英文）</label>
        <input class="input" id="newSecSub" placeholder="如：Programming">
      </div>
      <div class="form-group">
        <label class="label">主题色</label>
        <div class="color-picker">
          ${colorOptions.map((color, i) => `
            <div class="color-option ${i === 0 ? 'selected' : ''}" data-color="${color}"
              style="background:${SECTION_COLORS[color].color};"
              onclick="selectColorOption(this)">
            </div>
          `).join('')}
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="addSection()">创建板块</button>
    `,
  });
}

let selectedColor = 'teal';

function selectColorOption(el) {
  document.querySelectorAll('[data-color]').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  selectedColor = el.dataset.color;
}

function addSection() {
  const name = document.getElementById('newSecName').value.trim();
  const sub = document.getElementById('newSecSub').value.trim();
  if (!name) { showToast('请输入板块名称', 'warning'); return; }
  const newSec = {
    id: 'sec_' + Date.now(),
    name: name,
    subtitle: sub,
    icon: 'folder',
    color: selectedColor,
    items: [],
    goals: [],
    tasks: [],
    materials: [],
  };
  state.sections.push(newSec);
  saveData();
  closeModal();
  renderNav();
  navigate('section', newSec.id);
  showToast(`板块「${name}」已创建`, 'success');
}

function confirmDeleteSection(sectionId, sectionName) {
  const sec = state.sections.find(s => s.id === sectionId);
  const name = sectionName || (sec ? sec.name : '');
  openModal({
    title: '删除板块',
    sub: `确定要删除「${name}」吗？`,
    body: `
      <div style="padding:16px;background:rgba(196,90,90,0.06);border-radius:var(--radius-sm);border:1px solid rgba(196,90,90,0.2);">
        <div style="font-size:14px;color:var(--danger);font-weight:600;margin-bottom:8px;">⚠️ 此操作不可撤销</div>
        <div style="font-size:13px;color:var(--ink-light);line-height:1.7;">
          删除后将永久丢失该板块下的：
          <ul style="margin:8px 0 0 20px;line-height:1.8;">
            <li>所有学习项目及打卡记录</li>
            <li>所有目标及进度</li>
            <li>所有任务安排</li>
            <li>所有已上传的资料文件</li>
          </ul>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-danger" style="background:var(--danger);color:#fff;" onclick="deleteSection('${sectionId}')">确认删除</button>
    `,
  });
}

function deleteSection(sectionId) {
  // 删除关联的全局目标
  state.goals = state.goals.filter(g => g.section !== sectionId);
  // 删除板块
  state.sections = state.sections.filter(s => s.id !== sectionId);
  saveData();
  closeModal();
  renderNav();
  navigate('home');
  showToast('板块已删除', 'success');
}

// ===== 重命名板块 =====
function openRenameSectionModal(sectionId) {
  const sec = state.sections.find(s => s.id === sectionId);
  if (!sec) return;
  openModal({
    title: '编辑板块',
    sub: '修改板块名称、副标题和主题色',
    body: `
      <div class="form-group">
        <label class="label">板块名称</label>
        <input class="input" id="renameSecName" value="${escapeHtml(sec.name)}">
      </div>
      <div class="form-group">
        <label class="label">副标题（英文）</label>
        <input class="input" id="renameSecSub" value="${escapeHtml(sec.subtitle || '')}">
      </div>
      <div class="form-group">
        <label class="label">主题色</label>
        <div class="color-picker">
          ${['teal', 'gold', 'rose', 'plum', 'sage', 'amber'].map(color => `
            <div class="color-option ${sec.color === color ? 'selected' : ''}" data-color="${color}"
              style="background:${SECTION_COLORS[color].color};"
              onclick="selectColorOption(this)">
            </div>
          `).join('')}
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="renameSection('${sectionId}')">保存</button>
    `,
  });
  selectedColor = sec.color || 'teal';
}

function renameSection(sectionId) {
  const name = document.getElementById('renameSecName').value.trim();
  if (!name) { showToast('请输入板块名称', 'warning'); return; }
  const sec = state.sections.find(s => s.id === sectionId);
  sec.name = name;
  sec.subtitle = document.getElementById('renameSecSub').value.trim();
  sec.color = selectedColor;
  saveData();
  closeModal();
  renderNav();
  if (state.currentView === 'section' && state.currentSectionId === sectionId) {
    navigate('section', sectionId);
  } else {
    navigate('home');
  }
  showToast('板块已更新', 'success');
}

// ===== 添加目标（板块内） =====
function openAddGoalModal(sectionId) {
  openModal({
    title: '添加目标',
    sub: '设定目标、措施与频率',
    body: `
      <div class="form-group">
        <label class="label">目标名称</label>
        <input class="input" id="goalName" placeholder="如：影子跟读100篇">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">截止日期</label>
          <input type="date" class="input" id="goalDeadline">
        </div>
        <div class="form-group">
          <label class="label">频率</label>
          <select class="select" id="goalFreq">
            <option value="每日">每日</option>
            <option value="每周">每周</option>
            <option value="每月">每月</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">目标总量（0=手动进度）</label>
          <input type="number" class="input" id="goalTarget" min="0" value="0" placeholder="如：100">
        </div>
        <div class="form-group">
          <label class="label">单位（如：篇/天/个）</label>
          <input class="input" id="goalUnit" placeholder="篇" value="">
        </div>
      </div>
      <div style="font-size:12px;color:var(--ink-lighter);margin-top:-8px;margin-bottom:12px;">
        设定目标总量后，进度将自动计算；填0则使用手动滑动条设置进度
      </div>
      <div class="form-group">
        <label class="label">具体措施</label>
        <textarea class="textarea" id="goalMeasures" placeholder="描述实现目标的具体措施..."></textarea>
      </div>
      <div class="form-group">
        <label class="label">配图</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('goalImageFile').click()">${ICONS.upload} 上传图片</button>
          <input type="file" id="goalImageFile" accept="image/*" style="display:none" onchange="handleGoalImageUpload(event)">
          <span style="font-size:12px;color:var(--ink-lighter);">或</span>
          <input class="input" id="goalImage" placeholder="粘贴图片URL" style="flex:1;">
        </div>
        <div id="goalImagePreview" style="margin-top:8px;"></div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="addGoal('${sectionId}')">添加目标</button>
    `,
  });
}

let tempGoalImage = '';
const cropCallbacks = {};

function showImageCropper(previewId, imageSrc, callback) {
  const container = document.getElementById(previewId);
  if (!container) return;
  cropCallbacks[previewId] = callback;

  container.innerHTML = `
    <div class="crop-container" id="${previewId}_cropArea">
      <img id="${previewId}_cropImg" src="${imageSrc}" style="display:none;">
      <div class="crop-overlay">
        <div class="crop-guide-h"></div><div class="crop-guide-h"></div>
        <div class="crop-guide-v"></div><div class="crop-guide-v"></div>
      </div>
      <div id="${previewId}_cropLoading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--ink-lighter);font-size:13px;">图片加载中...</div>
    </div>
    <div class="crop-controls" id="${previewId}_controls" style="display:none;">
      <span class="crop-zoom-label">缩放</span>
      <input type="range" class="crop-zoom-slider" id="${previewId}_zoom" min="100" max="500" value="100">
      <span class="crop-zoom-label" id="${previewId}_zoomVal">100%</span>
    </div>
    <div class="crop-actions" id="${previewId}_actions" style="display:none;">
      <button class="btn btn-primary btn-sm" id="${previewId}_confirm">确认裁剪</button>
      <button class="btn btn-outline btn-sm" id="${previewId}_reset">重置</button>
    </div>
    <div class="crop-hint" id="${previewId}_hint" style="display:none;">拖动图片调整位置，滑块或滚轮调整大小</div>
  `;

  const cropArea = document.getElementById(previewId + '_cropArea');
  const img = document.getElementById(previewId + '_cropImg');
  const zoomSlider = document.getElementById(previewId + '_zoom');
  const zoomVal = document.getElementById(previewId + '_zoomVal');
  const confirmBtn = document.getElementById(previewId + '_confirm');
  const resetBtn = document.getElementById(previewId + '_reset');
  const controls = document.getElementById(previewId + '_controls');
  const actions = document.getElementById(previewId + '_actions');
  const hint = document.getElementById(previewId + '_hint');
  const loading = document.getElementById(previewId + '_cropLoading');

  const cs = {
    scale: 1, offsetX: 0, offsetY: 0,
    coverScale: 1, imgW: 0, imgH: 0,
    cropW: 0, cropH: 0,
  };

  img.onload = function() {
    cs.imgW = img.naturalWidth;
    cs.imgH = img.naturalHeight;
    cs.cropW = cropArea.clientWidth;
    cs.cropH = cropArea.clientHeight;
    const sx = cs.cropW / cs.imgW;
    const sy = cs.cropH / cs.imgH;
    cs.coverScale = Math.max(sx, sy);
    cs.scale = cs.coverScale;
    cs.offsetX = (cs.cropW - cs.imgW * cs.scale) / 2;
    cs.offsetY = (cs.cropH - cs.imgH * cs.scale) / 2;
    img.style.display = '';
    loading.style.display = 'none';
    controls.style.display = '';
    actions.style.display = '';
    hint.style.display = '';
    updateTransform();
  };

  img.onerror = function() {
    loading.textContent = '图片加载失败';
    loading.style.color = 'var(--danger)';
  };

  function updateTransform() {
    img.style.transform = `translate(${cs.offsetX}px, ${cs.offsetY}px) scale(${cs.scale})`;
  }

  function clampOffset() {
    const rw = cs.imgW * cs.scale;
    const rh = cs.imgH * cs.scale;
    cs.offsetX = Math.min(0, Math.max(cs.cropW - rw, cs.offsetX));
    cs.offsetY = Math.min(0, Math.max(cs.cropH - rh, cs.offsetY));
  }

  function setZoom(pct) {
    pct = Math.max(100, Math.min(500, pct));
    cs.scale = cs.coverScale * (pct / 100);
    clampOffset();
    updateTransform();
    zoomSlider.value = pct;
    zoomVal.textContent = pct + '%';
  }

  // Drag
  let isDragging = false, dSX = 0, dSY = 0, sOX = 0, sOY = 0;

  function getPt(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    cropArea.classList.add('dragging');
    const pt = getPt(e);
    dSX = pt.x; dSY = pt.y; sOX = cs.offsetX; sOY = cs.offsetY;
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
  }

  function onDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    const pt = getPt(e);
    cs.offsetX = sOX + (pt.x - dSX);
    cs.offsetY = sOY + (pt.y - dSY);
    clampOffset();
    updateTransform();
  }

  function endDrag() {
    isDragging = false;
    cropArea.classList.remove('dragging');
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', endDrag);
  }

  cropArea.addEventListener('mousedown', startDrag);
  cropArea.addEventListener('touchstart', startDrag, { passive: false });

  zoomSlider.addEventListener('input', function() { setZoom(parseInt(this.value)); });

  cropArea.addEventListener('wheel', function(e) {
    e.preventDefault();
    setZoom(parseInt(zoomSlider.value) + (e.deltaY > 0 ? -5 : 5));
  }, { passive: false });

  resetBtn.addEventListener('click', function() { setZoom(100); });

  confirmBtn.addEventListener('click', function() {
    const outW = Math.min(cs.cropW, 800);
    const outH = Math.round(outW * cs.cropH / cs.cropW);
    const canvas = document.createElement('canvas');
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext('2d');
    const srcX = -cs.offsetX / cs.scale;
    const srcY = -cs.offsetY / cs.scale;
    const srcW = cs.cropW / cs.scale;
    const srcH = cs.cropH / cs.scale;
    try {
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      if (cropCallbacks[previewId]) {
        cropCallbacks[previewId](dataUrl);
        delete cropCallbacks[previewId];
      }
    } catch (err) {
      showToast('图片裁剪失败，请重试', 'error');
    }
  });
}

function handleGoalImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('图片过大（超过5MB），请使用较小图片', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('goalImage').value = '';
    showImageCropper('goalImagePreview', e.target.result, function(cropped) {
      tempGoalImage = cropped;
      document.getElementById('goalImagePreview').innerHTML =
        `<img src="${cropped}" style="width:100%;max-height:120px;object-fit:cover;border-radius:var(--radius-sm);">`;
    });
  };
  reader.readAsDataURL(file);
}

function addGoal(sectionId) {
  const name = document.getElementById('goalName').value.trim();
  if (!name) { showToast('请输入目标名称', 'warning'); return; }
  const deadline = document.getElementById('goalDeadline').value;
  if (!deadline) { showToast('请选择截止日期', 'warning'); return; }

  const image = tempGoalImage || document.getElementById('goalImage').value.trim();
  tempGoalImage = '';

  const goal = {
    id: 'goal_' + Date.now(),
    name: name,
    deadline: deadline,
    image: image,
    measures: document.getElementById('goalMeasures').value.trim(),
    frequency: document.getElementById('goalFreq').value,
    target: parseInt(document.getElementById('goalTarget').value) || 0,
    completed: 0,
    unit: document.getElementById('goalUnit').value.trim(),
    progress: 0,
  };
  const sec = state.sections.find(s => s.id === sectionId);
  sec.goals.push(goal);
  state.goals.push({ ...goal, section: sectionId });
  saveData();
  closeModal();
  navigate('section', sectionId);
  showToast('目标已添加', 'success');
}

function openEditGoalModal(sectionId, goalId) {
  const sec = state.sections.find(s => s.id === sectionId);
  const goal = sec.goals.find(g => g.id === goalId);
  tempGoalImage = '';

  openModal({
    title: '编辑目标',
    body: `
      <div class="form-group">
        <label class="label">目标名称</label>
        <input class="input" id="editGoalName" value="${escapeHtml(goal.name)}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">截止日期</label>
          <input type="date" class="input" id="editGoalDeadline" value="${goal.deadline}">
        </div>
        <div class="form-group">
          <label class="label">频率</label>
          <select class="select" id="editGoalFreq">
            ${['每日','每周','每月'].map(f => `<option value="${f}" ${goal.frequency === f ? 'selected' : ''}>${f}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">目标总量（0=手动）</label>
          <input type="number" class="input" id="editGoalTarget" min="0" value="${goal.target || 0}">
        </div>
        <div class="form-group">
          <label class="label">单位</label>
          <input class="input" id="editGoalUnit" value="${escapeHtml(goal.unit || '')}">
        </div>
      </div>
      <div class="form-group">
        <label class="label">具体措施</label>
        <textarea class="textarea" id="editGoalMeasures">${escapeHtml(goal.measures || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="label">配图</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('editGoalImageFile').click()">${ICONS.upload} 上传图片</button>
          <input type="file" id="editGoalImageFile" accept="image/*" style="display:none" onchange="handleEditGoalImageUpload(event)">
          <span style="font-size:12px;color:var(--ink-lighter);">或</span>
          <input class="input" id="editGoalImage" value="${escapeHtml(goal.image || '')}" placeholder="图片URL" style="flex:1;">
        </div>
        <div id="editGoalImagePreview" style="margin-top:8px;">
          ${goal.image ? `<img src="${goal.image}" style="width:100%;max-height:120px;object-fit:cover;border-radius:var(--radius-sm);">` : ''}
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="editGoal('${sectionId}','${goalId}')">保存</button>
    `,
  });
}

function handleEditGoalImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('图片过大（超过5MB）', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('editGoalImage').value = '';
    showImageCropper('editGoalImagePreview', e.target.result, function(cropped) {
      tempGoalImage = cropped;
      document.getElementById('editGoalImagePreview').innerHTML =
        `<img src="${cropped}" style="width:100%;max-height:120px;object-fit:cover;border-radius:var(--radius-sm);">`;
    });
  };
  reader.readAsDataURL(file);
}

function editGoal(sectionId, goalId) {
  const sec = state.sections.find(s => s.id === sectionId);
  const goal = sec.goals.find(g => g.id === goalId);
  goal.name = document.getElementById('editGoalName').value.trim();
  goal.deadline = document.getElementById('editGoalDeadline').value;
  goal.frequency = document.getElementById('editGoalFreq').value;
  goal.target = parseInt(document.getElementById('editGoalTarget').value) || 0;
  goal.unit = document.getElementById('editGoalUnit').value.trim();
  goal.measures = document.getElementById('editGoalMeasures').value.trim();
  goal.image = tempGoalImage || document.getElementById('editGoalImage').value.trim();
  tempGoalImage = '';

  const globalGoal = state.goals.find(g => g.id === goalId);
  if (globalGoal) {
    Object.assign(globalGoal, {
      name: goal.name, deadline: goal.deadline, frequency: goal.frequency,
      target: goal.target, unit: goal.unit, measures: goal.measures, image: goal.image,
    });
  }
  saveData();
  closeModal();
  navigate('section', sectionId);
  showToast('目标已更新', 'success');
}

// ===== 编辑全局目标 =====
function openEditGlobalGoalModal(goalId) {
  const goal = state.goals.find(g => g.id === goalId);
  tempGoalImage = '';

  openModal({
    title: '编辑个人目标',
    body: `
      <div class="form-group">
        <label class="label">目标名称</label>
        <input class="input" id="editGGoalName" value="${escapeHtml(goal.name)}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">截止日期</label>
          <input type="date" class="input" id="editGGoalDeadline" value="${goal.deadline}">
        </div>
        <div class="form-group">
          <label class="label">频率</label>
          <select class="select" id="editGGoalFreq">
            ${['每日','每周','每月'].map(f => `<option value="${f}" ${goal.frequency === f ? 'selected' : ''}>${f}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">目标总量（0=手动）</label>
          <input type="number" class="input" id="editGGoalTarget" min="0" value="${goal.target || 0}">
        </div>
        <div class="form-group">
          <label class="label">单位</label>
          <input class="input" id="editGGoalUnit" value="${escapeHtml(goal.unit || '')}">
        </div>
      </div>
      <div class="form-group">
        <label class="label">具体措施</label>
        <textarea class="textarea" id="editGGoalMeasures">${escapeHtml(goal.measures || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="label">配图</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('editGGoalImageFile').click()">${ICONS.upload} 上传图片</button>
          <input type="file" id="editGGoalImageFile" accept="image/*" style="display:none" onchange="handleEditGGoalImageUpload(event)">
          <span style="font-size:12px;color:var(--ink-lighter);">或</span>
          <input class="input" id="editGGoalImage" value="${escapeHtml(goal.image || '')}" placeholder="图片URL" style="flex:1;">
        </div>
        <div id="editGGoalImagePreview" style="margin-top:8px;">
          ${goal.image ? `<img src="${goal.image}" style="width:100%;max-height:120px;object-fit:cover;border-radius:var(--radius-sm);">` : ''}
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="editGlobalGoal('${goalId}')">保存</button>
    `,
  });
}

function handleEditGGoalImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('图片过大', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('editGGoalImage').value = '';
    showImageCropper('editGGoalImagePreview', e.target.result, function(cropped) {
      tempGoalImage = cropped;
      document.getElementById('editGGoalImagePreview').innerHTML =
        `<img src="${cropped}" style="width:100%;max-height:120px;object-fit:cover;border-radius:var(--radius-sm);">`;
    });
  };
  reader.readAsDataURL(file);
}

function editGlobalGoal(goalId) {
  const goal = state.goals.find(g => g.id === goalId);
  goal.name = document.getElementById('editGGoalName').value.trim();
  goal.deadline = document.getElementById('editGGoalDeadline').value;
  goal.frequency = document.getElementById('editGGoalFreq').value;
  goal.target = parseInt(document.getElementById('editGGoalTarget').value) || 0;
  goal.unit = document.getElementById('editGGoalUnit').value.trim();
  goal.measures = document.getElementById('editGGoalMeasures').value.trim();
  goal.image = tempGoalImage || document.getElementById('editGGoalImage').value.trim();
  tempGoalImage = '';

  if (goal.section) {
    const sec = state.sections.find(s => s.id === goal.section);
    const secGoal = sec?.goals?.find(g => g.id === goalId);
    if (secGoal) {
      Object.assign(secGoal, {
        name: goal.name, deadline: goal.deadline, frequency: goal.frequency,
        target: goal.target, unit: goal.unit, measures: goal.measures, image: goal.image,
      });
    }
  }
  saveData();
  closeModal();
  navigate('goals');
  showToast('目标已更新', 'success');
}

// ===== 添加全局目标 =====
function openAddGlobalGoalModal() {
  let sectionOptions = state.sections.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  tempGoalImage = '';
  openModal({
    title: '添加个人目标',
    sub: '设定目标，配图倒计时',
    body: `
      <div class="form-group">
        <label class="label">目标名称</label>
        <input class="input" id="gGoalName" placeholder="如：坚持运动100天">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">所属板块</label>
          <select class="select" id="gGoalSection">${sectionOptions}</select>
        </div>
        <div class="form-group">
          <label class="label">截止日期</label>
          <input type="date" class="input" id="gGoalDeadline">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">目标总量（0=手动）</label>
          <input type="number" class="input" id="gGoalTarget" min="0" value="0">
        </div>
        <div class="form-group">
          <label class="label">单位</label>
          <input class="input" id="gGoalUnit" placeholder="天/篇/个" value="">
        </div>
      </div>
      <div class="form-group">
        <label class="label">频率</label>
        <select class="select" id="gGoalFreq">
          <option value="每日">每日</option>
          <option value="每周">每周</option>
          <option value="每月">每月</option>
        </select>
      </div>
      <div class="form-group">
        <label class="label">具体措施</label>
        <textarea class="textarea" id="gGoalMeasures" placeholder="描述实现目标的具体措施..."></textarea>
      </div>
      <div class="form-group">
        <label class="label">配图</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('gGoalImageFile').click()">${ICONS.upload} 上传图片</button>
          <input type="file" id="gGoalImageFile" accept="image/*" style="display:none" onchange="handleGGoalImageUpload(event)">
          <span style="font-size:12px;color:var(--ink-lighter);">或</span>
          <input class="input" id="gGoalImage" placeholder="图片URL" style="flex:1;">
        </div>
        <div id="gGoalImagePreview" style="margin-top:8px;"></div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="addGlobalGoal()">添加目标</button>
    `,
  });
}

function handleGGoalImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('图片过大', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('gGoalImage').value = '';
    showImageCropper('gGoalImagePreview', e.target.result, function(cropped) {
      tempGoalImage = cropped;
      document.getElementById('gGoalImagePreview').innerHTML =
        `<img src="${cropped}" style="width:100%;max-height:120px;object-fit:cover;border-radius:var(--radius-sm);">`;
    });
  };
  reader.readAsDataURL(file);
}

function addGlobalGoal() {
  const name = document.getElementById('gGoalName').value.trim();
  const sectionId = document.getElementById('gGoalSection').value;
  const deadline = document.getElementById('gGoalDeadline').value;
  if (!name) { showToast('请输入目标名称', 'warning'); return; }
  if (!deadline) { showToast('请选择截止日期', 'warning'); return; }

  const image = tempGoalImage || document.getElementById('gGoalImage').value.trim();
  tempGoalImage = '';

  const goal = {
    id: 'goal_' + Date.now(),
    name: name,
    deadline: deadline,
    image: image,
    measures: document.getElementById('gGoalMeasures').value.trim(),
    frequency: document.getElementById('gGoalFreq').value,
    target: parseInt(document.getElementById('gGoalTarget').value) || 0,
    completed: 0,
    unit: document.getElementById('gGoalUnit').value.trim(),
    progress: 0,
  };
  state.goals.push({ ...goal, section: sectionId });
  const sec = state.sections.find(s => s.id === sectionId);
  if (sec) sec.goals.push({ ...goal });

  saveData();
  closeModal();
  navigate('goals');
  showToast('个人目标已添加', 'success');
}

// ===== 添加任务（支持周重复 + 时间段） =====
function openAddTaskModal(sectionId, prefillDate) {
  const defaultDate = prefillDate || todayStr();
  openModal({
    title: '添加任务',
    sub: '设定时间安排和重复频率',
    body: `
      <div class="form-group">
        <label class="label">任务标题</label>
        <input class="input" id="taskTitle" placeholder="如：影子跟读练习">
      </div>
      <div class="form-group">
        <label class="label">任务类型</label>
        <div style="display:flex;gap:12px;">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;">
            <input type="radio" name="taskType" value="once" checked onchange="toggleTaskType('once')"> 单次任务
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;">
            <input type="radio" name="taskType" value="recurring" onchange="toggleTaskType('recurring')"> 每周重复
          </label>
        </div>
      </div>
      <div class="form-group" id="dateGroup">
        <label class="label">日期</label>
        <input type="date" class="input" id="taskDate" value="${defaultDate}">
      </div>
      <div class="form-group" id="recurringGroup" style="display:none;">
        <label class="label">每周哪几天</label>
        <div class="weekday-picker">
          ${['日','一','二','三','四','五','六'].map((d, i) => `
            <label class="weekday-chip" data-day="${i}">
              <input type="checkbox" value="${i}" style="display:none;">
              <span>${d}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">开始时间</label>
          <input type="time" class="input" id="taskStartTime">
        </div>
        <div class="form-group">
          <label class="label">结束时间（可选）</label>
          <input type="time" class="input" id="taskEndTime">
        </div>
        <div class="form-group">
          <label class="label">优先级</label>
          <select class="select" id="taskPriority">
            <option value="high">高</option>
            <option value="medium" selected>中</option>
            <option value="low">低</option>
          </select>
        </div>
      </div>
      <div style="font-size:12px;color:var(--ink-lighter);">
        填写开始和结束时间可设置连续时间段，如 09:00 - 10:30
      </div>
    `,
    footer: `
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="addTask('${sectionId}')">添加</button>
    `,
  });

  // 绑定星期选择器
  document.querySelectorAll('.weekday-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      const cb = chip.querySelector('input');
      cb.checked = !cb.checked;
      chip.classList.toggle('selected', cb.checked);
    });
  });
}

function toggleTaskType(type) {
  document.getElementById('dateGroup').style.display = type === 'once' ? '' : 'none';
  document.getElementById('recurringGroup').style.display = type === 'recurring' ? '' : 'none';
}

function addTask(sectionId) {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) { showToast('请输入任务标题', 'warning'); return; }

  const isRecurring = document.querySelector('input[name="taskType"]:checked').value === 'recurring';
  let recurringDays = null;
  let date = null;

  if (isRecurring) {
    recurringDays = Array.from(document.querySelectorAll('.weekday-chip input:checked')).map(cb => parseInt(cb.value));
    if (recurringDays.length === 0) {
      showToast('请至少选择一天', 'warning');
      return;
    }
  } else {
    date = document.getElementById('taskDate').value;
  }

  const startTime = document.getElementById('taskStartTime').value;
  const endTime = document.getElementById('taskEndTime').value;

  // 验证时间段
  if (startTime && endTime && startTime >= endTime) {
    showToast('结束时间必须晚于开始时间', 'warning');
    return;
  }

  const sec = state.sections.find(s => s.id === sectionId);
  sec.tasks.push({
    id: 'task_' + Date.now(),
    title: title,
    date: date,
    startTime: startTime || '',
    endTime: endTime || '',
    time: startTime || '', // 兼容旧字段
    priority: document.getElementById('taskPriority').value,
    completed: false,
    section: sectionId,
    recurringDays: recurringDays,
  });
  saveData();
  closeModal();
  navigate('section', sectionId);
  showToast('任务已添加', 'success');
}

// ===== 添加链接 =====
function openAddLinkModal(sectionId) {
  openModal({
    title: '添加资料链接',
    sub: '支持网址、PDF、Excel等链接',
    body: `
      <div class="form-group">
        <label class="label">资料名称</label>
        <input class="input" id="linkName" placeholder="如：PyTorch官方教程">
      </div>
      <div class="form-group">
        <label class="label">链接地址</label>
        <input class="input" id="linkUrl" placeholder="https://...">
      </div>
      <div class="form-group">
        <label class="label">类型</label>
        <select class="select" id="linkType">
          <option value="link">网页链接</option>
          <option value="pdf">PDF</option>
          <option value="excel">Excel</option>
          <option value="doc">文档</option>
          <option value="img">图片</option>
        </select>
      </div>
    `,
    footer: `
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="addLink('${sectionId}')">添加</button>
    `,
  });
}

function addLink(sectionId) {
  const name = document.getElementById('linkName').value.trim();
  const url = document.getElementById('linkUrl').value.trim();
  if (!name || !url) { showToast('请填写名称和链接', 'warning'); return; }
  const sec = state.sections.find(s => s.id === sectionId);
  sec.materials.push({
    id: 'mat_' + Date.now(),
    name: name,
    type: document.getElementById('linkType').value,
    url: url,
    data: '',
    date: todayStr(),
  });
  saveData();
  closeModal();
  navigate('section', sectionId);
  showToast('链接已添加', 'success');
}

// ===== 上传文件 =====
function openUploadModal(sectionId) {
  openModal({
    title: '上传文件',
    sub: '支持 PDF、Excel、JPG、PNG 等格式',
    body: `
      <div class="form-group">
        <label class="label">选择文件</label>
        <input type="file" id="uploadFile" class="input" style="padding:8px;" accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.doc,.docx,.txt,.csv">
      </div>
      <div class="form-group">
        <label class="label">显示名称（可选）</label>
        <input class="input" id="uploadName" placeholder="留空则使用文件名">
      </div>
      <div id="uploadStatus" style="font-size:13px;color:var(--ink-lighter);"></div>
    `,
    footer: `
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="uploadFile('${sectionId}')">上传</button>
    `,
  });

  document.getElementById('uploadFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const sizeKB = (file.size / 1024).toFixed(1);
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      const sizeStr = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
      document.getElementById('uploadStatus').textContent = `已选择：${file.name} (${sizeStr})`;
      if (file.size > 2 * 1024 * 1024) {
        document.getElementById('uploadStatus').innerHTML += `<br><span style="color:var(--warning);">文件较大（${sizeMB}MB），建议小于2MB</span>`;
      }
    }
  });
}

function uploadFile(sectionId) {
  const fileInput = document.getElementById('uploadFile');
  const file = fileInput.files[0];
  if (!file) { showToast('请选择文件', 'warning'); return; }
  if (file.size > 3 * 1024 * 1024) {
    showToast('文件过大（超过3MB），请使用链接方式', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const sec = state.sections.find(s => s.id === sectionId);
    const name = document.getElementById('uploadName').value.trim() || file.name;
    const type = getFileType(file.name);
    sec.materials.push({
      id: 'mat_' + Date.now(),
      name: name,
      type: type,
      url: '',
      data: e.target.result,
      date: todayStr(),
    });
    saveData();
    closeModal();
    navigate('section', sectionId);
    showToast('文件上传成功', 'success');
  };
  reader.onerror = () => { showToast('文件读取失败', 'error'); };
  reader.readAsDataURL(file);
}

function getFileType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['pdf'].includes(ext)) return 'pdf';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'img';
  if (['doc', 'docx', 'txt'].includes(ext)) return 'doc';
  return 'doc';
}

// ===== 任务提醒检查 =====
function checkTaskReminders() {
  const today = todayStr();
  const now = new Date();
  const weekday = now.getDay();
  const allTasks = [];
  state.sections.forEach(sec => {
    (sec.tasks || []).forEach(t => {
      if (t.completed) return;
      // 单次任务
      if (t.date === today) allTasks.push({ ...t, sectionName: sec.name });
      // 周重复任务
      if (t.recurringDays && t.recurringDays.includes(weekday)) allTasks.push({ ...t, sectionName: sec.name });
    });
  });
  allTasks.forEach(t => {
    const timeStr = t.startTime || t.time;
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      const taskTime = new Date();
      taskTime.setHours(h, m, 0, 0);
      const diffMin = Math.round((taskTime - now) / 60000);
      if (diffMin === 15 || diffMin === 14) {
        showToast(`「${t.title}」将在15分钟后开始（${t.sectionName}）`, 'warning');
      }
    }
  });
}

// ===== 模态框 =====
function openModal({ title, sub, body, footer }) {
  const overlay = document.getElementById('modalOverlay');
  const container = document.getElementById('modalContainer');
  container.innerHTML = `<div class="modal">
    <div class="modal-header">
      <div class="modal-title">${title || ''}</div>
      ${sub ? `<div class="modal-sub">${sub}</div>` : ''}
    </div>
    <div class="modal-body">${body || ''}</div>
    ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
  </div>`;
  overlay.classList.add('active');
  container.classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.getElementById('modalContainer').classList.remove('active');
  tempGoalImage = '';
}

// ===== Toast =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', warning: '⚠', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span class="toast-text">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ===== 工具函数 =====
function daysUntil(dateStr) {
  if (!dateStr) return 0;
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function getMaterialIcon(type) {
  return { pdf: ICONS.pdf, excel: ICONS.excel, img: ICONS.image, link: ICONS.link, doc: ICONS.doc }[type] || ICONS.file;
}
function getMaterialIconClass(type) { return type || 'doc'; }
function getMaterialTypeLabel(type) {
  return { pdf: 'PDF文档', excel: '表格', img: '图片', link: '网页链接', doc: '文档' }[type] || '文件';
}

// ===== GitHub 云端同步（长期记忆云备份）=====
const CLOUD_KEY = 'learning_dashboard_cloud';
let cloudBackupTimer = null;
let cloudBacking = false;

function getCloudConfig() {
  try { return JSON.parse(localStorage.getItem(CLOUD_KEY)) || {}; } catch (e) { return {}; }
}
function saveCloudConfig(cfg) {
  try { localStorage.setItem(CLOUD_KEY, JSON.stringify(cfg)); } catch (e) { console.warn('云配置保存失败', e); }
}

function readCloudInputs() {
  return {
    user: (document.getElementById('cloudUser')?.value || '').trim(),
    repo: (document.getElementById('cloudRepo')?.value || '').trim(),
    token: (document.getElementById('cloudToken')?.value || '').trim(),
    auto: !!document.getElementById('cloudAuto')?.checked,
  };
}

function cloudSaveSettings() {
  const input = readCloudInputs();
  if (!input.user || !input.repo || !input.token) { showToast('请填写用户名、仓库名和 Token', 'error'); return; }
  const cfg = getCloudConfig();
  cfg.user = input.user; cfg.repo = input.repo; cfg.token = input.token; cfg.auto = input.auto;
  saveCloudConfig(cfg);
  showToast('云同步设置已保存（仅保存在本浏览器）', 'success');
}

// 统一的 GitHub API 请求（带 Token）
async function ghFetch(path, options = {}) {
  const cfg = getCloudConfig();
  if (!cfg.token) throw new Error('请先填写并保存 GitHub Token');
  const headers = Object.assign({
    'Authorization': 'token ' + cfg.token,
    'Accept': 'application/vnd.github+json',
  }, options.headers || {});
  const res = await fetch('https://api.github.com' + path, { ...options, headers });
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const err = await res.json(); if (err.message) msg = err.message; } catch (e) {}
    throw new Error(msg);
  }
  return res;
}

// 测试连接：验证 Token、检查/创建私有仓库
async function cloudTestConnection() {
  const input = readCloudInputs();
  if (!input.user || !input.repo || !input.token) { showToast('请先填写完整信息', 'error'); return; }
  // 先保存设置
  const cfg = getCloudConfig();
  Object.assign(cfg, input); saveCloudConfig(cfg);
  try {
    const me = await fetch('https://api.github.com/user', { headers: { 'Authorization': 'token ' + input.token } });
    if (!me.ok) throw new Error(me.status === 401 ? 'Token 无效，请检查后重试' : '无法验证 Token（HTTP ' + me.status + '）');
    const meData = await me.json();
    if (meData.login.toLowerCase() !== input.user.toLowerCase()) {
      throw new Error('Token 属于账号「' + meData.login + '」，与填写的用户名「' + input.user + '」不一致');
    }
    const repoRes = await fetch(`https://api.github.com/repos/${input.user}/${input.repo}`, { headers: { 'Authorization': 'token ' + input.token } });
    if (repoRes.status === 404) {
      if (!confirm(`仓库 ${input.repo} 还不存在，是否为你创建一个私有仓库？`)) { showToast('已取消创建', 'info'); return; }
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: { 'Authorization': 'token ' + input.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: input.repo, private: true, autoinit: true, description: '蓝莓的学习进度工作台 · 数据云备份' }),
      });
      if (!createRes.ok) throw new Error('创建仓库失败（HTTP ' + createRes.status + '）');
      showToast('私有仓库已创建，云同步就绪', 'success');
    } else if (!repoRes.ok) {
      throw new Error('无法访问仓库（HTTP ' + repoRes.status + '）');
    } else {
      const repoData = await repoRes.json();
      if (repoData.private) showToast('连接成功，云端仓库就绪', 'success');
      else showToast('连接成功，但该仓库是公开的，建议在 GitHub 上设为私有', 'info');
    }
  } catch (e) {
    showToast('测试失败：' + e.message, 'error');
  }
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// 大文件走 Git Data API（contents API 超过 1MB 不可靠）
async function gitDataCommit(cfg, path, b64, message) {
  const base = `/repos/${cfg.user}/${cfg.repo}`;
  const blobRes = await ghFetch(`${base}/git/blobs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: b64, encoding: 'base64' }),
  });
  const blob = await blobRes.json();
  const refRes = await ghFetch(`${base}/git/ref/heads/main`);
  const ref = await refRes.json();
  const commitRes = await ghFetch(`${base}/git/commits/${ref.object.sha}`);
  const parent = await commitRes.json();
  const treeRes = await ghFetch(`${base}/git/trees`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: parent.tree.sha, tree: [{ path, mode: '100644', type: 'blob', sha: blob.sha }] }),
  });
  const tree = await treeRes.json();
  const newCommitRes = await ghFetch(`${base}/git/commits`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] }),
  });
  const newCommit = await newCommitRes.json();
  await ghFetch(`${base}/git/refs/heads/main`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: newCommit.sha }),
  });
}

// 立即备份：把全部数据（含图片）写入云端仓库 backup.json
async function cloudBackupNow(notify = true) {
  if (cloudBacking) return;
  const cfg = getCloudConfig();
  if (!cfg.user || !cfg.repo || !cfg.token) { if (notify) showToast('请先在上方配置云同步', 'error'); return; }
  cloudBacking = true;
  const btn = document.getElementById('cloudBackupBtn');
  if (btn) { btn.disabled = true; btn.textContent = '备份中…'; }
  try {
    // 优先取 IndexedDB 里的完整快照（含图片）
    const idb = await loadFromIDB();
    const data = idb?.data || {
      sections: state.sections, goals: state.goals, inspirations: state.inspirations,
      checkIns: state.checkIns, checkInAmounts: state.checkInAmounts,
    };
    const json = JSON.stringify(data);
    const b64 = bytesToBase64(new TextEncoder().encode(json));
    const path = 'backup.json';
    const message = '工作台数据备份 ' + new Date().toLocaleString('zh-CN');
    let sha = null;
    try {
      const r = await ghFetch(`/repos/${cfg.user}/${cfg.repo}/contents/${path}?ref=main&t=${Date.now()}`);
      const j = await r.json();
      sha = j.sha || null;
    } catch (e) { /* 文件不存在，首次备份 */ }
    if (json.length < 900 * 1024) {
      await ghFetch(`/repos/${cfg.user}/${cfg.repo}/contents/${path}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, content: b64, branch: 'main', ...(sha ? { sha } : {}) }),
      });
    } else {
      await gitDataCommit(cfg, path, b64, message);
    }
    cfg.lastBackup = new Date().toISOString();
    saveCloudConfig(cfg);
    if (notify) showToast('已备份到 GitHub 云端', 'success');
    if (state.currentView === 'data') navigate('data');
  } catch (e) {
    console.error('云端备份失败', e);
    if (notify) showToast('云端备份失败：' + e.message, 'error');
  } finally {
    cloudBacking = false;
    if (btn) { btn.disabled = false; btn.innerHTML = ICONS.upload + ' 立即备份到云端'; }
  }
}

// 从云端恢复全部数据
async function cloudRestoreNow() {
  const cfg = getCloudConfig();
  if (!cfg.user || !cfg.repo || !cfg.token) { showToast('请先配置云同步', 'error'); return; }
  if (!confirm('将用云端备份覆盖本地当前数据，确定继续吗？')) return;
  try {
    const res = await fetch(`https://api.github.com/repos/${cfg.user}/${cfg.repo}/contents/backup.json?ref=main`, {
      headers: { 'Authorization': 'token ' + cfg.token, 'Accept': 'application/vnd.github.raw' },
    });
    if (!res.ok) {
      if (res.status === 404) { showToast('云端还没有备份，请先点「立即备份到云端」', 'error'); return; }
      throw new Error('HTTP ' + res.status);
    }
    const text = await res.text();
    const data = JSON.parse(text);
    if (!data.sections || !Array.isArray(data.sections)) throw new Error('备份文件格式不正确');
    await saveToIDB(data);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* IDB 已写入即可 */ }
    await loadData();
    renderNav();
    navigate(state.currentView);
    showToast('已从云端恢复全部数据', 'success');
  } catch (e) {
    console.error('云端恢复失败', e);
    showToast('云端恢复失败：' + e.message, 'error');
  }
}

// 自动备份：saveData 后 60 秒防抖触发（避免频繁请求）
function scheduleCloudBackup() {
  const cfg = getCloudConfig();
  if (!cfg.auto || !cfg.user || !cfg.repo || !cfg.token) return;
  clearTimeout(cloudBackupTimer);
  cloudBackupTimer = setTimeout(() => cloudBackupNow(false), 60000);
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', init);

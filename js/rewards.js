/* ============================================
 * 蓝莓的学习进度工作台 · 激励系统
 * - 即时反馈：完成动效、今日小结、随机鼓励语
 * - 随机奖励：抽奖券 + 心愿盲盒（含保底）+ 每日彩蛋
 * - 连续守恒：连续学习天数（植物成长）、冻结卡、温和复位
 * - 成就里程碑：徽章墙 + 成就卡片（可导出图片）
 * ============================================ */

// ===== 常量配置 =====
const TASKS_PER_TICKET = 5;      // 每完成多少项学习动作得 1 张抽奖券
const FREEZES_PER_MONTH = 2;     // 每月冻结卡数量
const PITY_MID = 12;             // 连续 12 次未出中奖及以上 → 保底中奖
const PITY_BIG = 30;             // 连续 30 次 → 保底大奖
const MAX_ACTIVITIES = 600;      // 活动日志上限

const WISH_TIERS = {
  small: { name: '小确幸', hint: '30 分钟内能兑现的小享受', color: '#f64f7b', prob: 70 },
  mid: { name: '中奖', hint: '值得期待一次的中等奖励', color: '#c98a3f', prob: 25 },
  big: { name: '大奖', hint: '攒够运气才敢想的大愿望', color: '#5f8d9e', prob: 5 },
};

const ENCOURAGEMENTS = [
  '又往前走了一点点，这就是全部意义。',
  '今天的你，比昨天多了 1% 的底气。',
  '进度条不会骗人，你确实在变强。',
  '这一刻的努力，未来的你会记得。',
  '不用很快，只要不停。',
  '你已经比昨天更懂一点点了。',
  '把今天做好，明天自然会来。',
  '小小的坚持，正在累积成看得见的东西。',
  '学一点是一点，不欠自己。',
  '状态不好也来了，这比状态好更重要。',
  '你正在成为那个想成为的人。',
  '每一格进度，都有人（你）真的付出过。',
  '慢，但没停。',
  '今天也算数。',
  '这条路你走了很久了，继续走。',
  '不追求完美的一天，只要真实的一天。',
  '你在做的事情，正在悄悄改变你。',
  '收下这份小小的成就感，你应得的。',
  '你不需要每天都很好，只需要每天都来。',
  '这一刻的专注，就是你给自己的礼物。',
  '有点累还继续，这才是真正的坚持。',
  '积累不会背叛你。',
  '与其焦虑进度，不如再写一行。',
  '你做得比你以为的好。',
  '又一天的自己，值得被记录。',
  '这不是任务，是你在为自己投资。',
];

const EGGS = [
  { id: 'e01', type: 'poem', title: '一句诗', text: '“我们都在阴沟里，但仍有人仰望星空。” —— 王尔德' },
  { id: 'e02', type: 'fact', title: '冷知识', text: '番茄工作法得名于一个番茄形状的厨房计时器，25 分钟只是那个计时器的巧合，不是科学结论。' },
  { id: 'e03', type: 'coupon', title: '发呆券', text: '凭此券可以毫无愧疚地发呆 15 分钟。什么都不做，也是恢复的一部分。' },
  { id: 'e04', type: 'poem', title: '一句诗', text: '“你要爱荒野上的风声，胜过爱贫穷和思考。” —— 海子' },
  { id: 'e05', type: 'prompt', title: '问自己', text: '最近学的东西里，哪一个让你眼睛亮了一下？把那个方向记下来。' },
  { id: 'e06', type: 'fact', title: '冷知识', text: '睡眠时大脑会重放白天学过的内容并加以整理——所以睡好觉是学习的一部分，不是偷懒。' },
  { id: 'e07', type: 'coupon', title: '赦免券', text: '凭此券可以原谅自己一次没完成计划。计划是工具，不是审判。' },
  { id: 'e08', type: 'poem', title: '一句诗', text: '“缓慢而坚定地生长。” —— 井上雄彦' },
  { id: 'e09', type: 'prompt', title: '问自己', text: '如果只看一个指标来判断这周有没有进步，你会看哪个？' },
  { id: 'e10', type: 'fact', title: '冷知识', text: '把学习内容讲给别人听（哪怕对着空气讲），记忆留存率能从 20% 提升到 70% 以上。' },
  { id: 'e11', type: 'coupon', title: '断网券', text: '凭此券可以给自己 30 分钟完全离线的时间，专心做一件事。' },
  { id: 'e12', type: 'poem', title: '一句诗', text: '“凡是过往，皆为序章。” —— 莎士比亚' },
  { id: 'e13', type: 'fact', title: '冷知识', text: '学完新东西后 10 分钟内复习一次，比一天后复习省力得多。这就是"趁热打铁"的科学依据。' },
  { id: 'e14', type: 'prompt', title: '问自己', text: '现在的学习方式里，哪一步其实可以删掉？' },
  { id: 'e15', type: 'coupon', title: '奖励券', text: '凭此券可以为自己买一杯喜欢的饮料，理由只需要一个：你今天来了。' },
  { id: 'e16', type: 'poem', title: '一句诗', text: '“山高路远，看世界也找自己。”' },
  { id: 'e17', type: 'fact', title: '冷知识', text: '学习中有"平台期"是正常现象——能力在积蓄，输出暂时不变。撑过去就是拐点。' },
  { id: 'e18', type: 'prompt', title: '问自己', text: '如果一年后的你回头看今天，最希望你现在做的一件事是什么？' },
  { id: 'e19', type: 'coupon', title: '早睡券', text: '凭此券今晚可以比平时早睡 1 小时，明天的大脑会更感谢你。' },
  { id: 'e20', type: 'poem', title: '一句诗', text: '“且将新火试新茶，诗酒趁年华。” —— 苏轼' },
  { id: 'e21', type: 'fact', title: '冷知识', text: '在稍微走动或散步时思考难题，创意产出会明显提高——身体动起来，思路也松动了。' },
  { id: 'e22', type: 'prompt', title: '问自己', text: '有什么一直想学但没敢开始的事？把它写成一个小到不可能失败的第一步。' },
  { id: 'e23', type: 'coupon', title: '空白页券', text: '凭此券可以什么都不学，就翻开书，看两页插图。开始了就算。' },
  { id: 'e24', type: 'fact', title: '冷知识', text: '习惯不是靠意志力维持的，是靠环境。把书放在桌上，比在心里下决心更有用。' },
];

const ACHIEVEMENTS = [
  { id: 'first_task', name: '第一步', desc: '完成第 1 个学习动作' },
  { id: 'tasks_10', name: '渐入佳境', desc: '累计完成 10 个学习动作' },
  { id: 'tasks_50', name: '五十次抵达', desc: '累计完成 50 个学习动作' },
  { id: 'tasks_100', name: '百次坚持', desc: '累计完成 100 个学习动作' },
  { id: 'tasks_300', name: '三百次抵达', desc: '累计完成 300 个学习动作' },
  { id: 'streak_3', name: '三日之约', desc: '连续学习 3 天' },
  { id: 'streak_7', name: '七日不辍', desc: '连续学习 7 天' },
  { id: 'streak_30', name: '月满花开', desc: '连续学习 30 天' },
  { id: 'streak_100', name: '百日如一', desc: '连续学习 100 天' },
  { id: 'perfect_1', name: '第一座山', desc: '有 1 个项目达成 100%' },
  { id: 'perfect_3', name: '登顶三座', desc: '有 3 个项目达成 100%' },
  { id: 'breadth_4', name: '四面开花', desc: '四个学习板块都推进过' },
  { id: 'wish_1', name: '首次兑现', desc: '第一次抽中心愿' },
  { id: 'draw_10', name: '开箱十次', desc: '累计开启盲盒 10 次' },
  { id: 'egg_7', name: '彩蛋猎人', desc: '收集 7 个每日彩蛋' },
  { id: 'egg_30', name: '收藏家', desc: '收集 30 个每日彩蛋' },
  { id: 'early', name: '晨型学习者', desc: '在早上 7 点前完成学习' },
  { id: 'night', name: '夜猫子', desc: '在晚上 23 点后仍在学习' },
  { id: 'comeback', name: '重新出发', desc: '断签之后又连续坚持 3 天' },
  { id: 'big_one', name: '心想事成', desc: '抽中一次大奖' },
];

// ===== 运行时状态 =====
let rwStage = 'idle';        // idle | opening | result
let rwLastResult = null;     // 最近一次开箱结果
let rwLastEncourageTs = 0;   // 鼓励语冷却
let rwLastDraw = false;

// ===== 数据初始化与迁移 =====
function defaultRewards() {
  return {
    wishes: [],
    tickets: 0,
    taskProgress: 0,
    totalCompleted: 0,
    totalDraws: 0,
    totalCheckIns: 0,
    pity: 0,
    draws: [],
    eggs: [],
    achievements: {},
    flags: {},
    celebrated: {},
    activities: [],
    streak: {
      current: 0, best: 0, lastDate: '', previousCurrent: 0,
      freezes: FREEZES_PER_MONTH, freezeMonth: '', frozenDates: [], everReset: false, autoFreeze: true,
    },
  };
}

function ensureRewardsShape(r) {
  const def = defaultRewards();
  if (!r || typeof r !== 'object') return def;
  const out = Object.assign({}, def, r);
  out.streak = Object.assign({}, def.streak, r.streak || {});
  ['wishes', 'draws', 'eggs', 'activities', 'frozenDates'].forEach(k => {
    if (k === 'frozenDates') return;
    if (!Array.isArray(out[k])) out[k] = [];
  });
  if (!Array.isArray(out.streak.frozenDates)) out.streak.frozenDates = [];
  if (!out.achievements || typeof out.achievements !== 'object') out.achievements = {};
  if (!out.flags || typeof out.flags !== 'object') out.flags = {};
  if (!out.celebrated || typeof out.celebrated !== 'object') out.celebrated = {};
  return out;
}

function initRewards() {
  const cur = state.rewards;
  const shaped = ensureRewardsShape(cur);
  // 保持对象引用稳定：调用方可能持有 state.rewards 的旧引用，
  // 若每次重建对象，那些引用上的写入会静默丢失。
  if (cur && typeof cur === 'object') {
    Object.keys(cur).forEach(k => { if (!(k in shaped)) delete cur[k]; });
    Object.assign(cur, shaped);
  } else {
    state.rewards = shaped;
  }
}

// ===== 日期工具 =====
function rwToday() { return todayStr(); }

function rwDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rwDayDiff(fromKey, toKey) {
  const a = new Date(fromKey + 'T00:00:00');
  const b = new Date(toKey + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function rwFormatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

// ===== 统计 =====
function getRewardStats() {
  const r = state.rewards || defaultRewards();
  const today = rwToday();
  const todayActs = r.activities.filter(a => a.date === today);
  const perfectItems = state.sections.reduce((n, s) =>
    n + (s.items || []).filter(i => calcProgress(i) >= 100).length, 0);
  const activeSections = state.sections.filter(s => {
    const hasCheck = (s.items || []).some(i => state.checkIns[`${s.id}_${i.id}`] !== undefined);
    const hasDoneTask = (s.tasks || []).some(t => t.completed);
    const hasProgress = (s.items || []).some(i => (i.completed || 0) > 0);
    return hasCheck || hasDoneTask || hasProgress;
  }).length;
  return {
    todayCompleted: todayActs.filter(a => a.type === 'task').length,
    todayCheckIns: todayActs.filter(a => a.type === 'checkin').length,
    todayMinutes: todayActs.reduce((n, a) => n + (a.minutes || 0), 0),
    totalCompleted: r.totalCompleted,
    totalCheckIns: r.totalCheckIns,
    perfectItems,
    activeSections,
    streak: r.streak.current,
    bestStreak: r.streak.best,
    tickets: r.tickets,
    taskProgress: r.taskProgress,
    pity: r.pity,
    totalDraws: r.totalDraws,
    eggCount: r.eggs.length,
    wishDraws: r.draws.filter(d => d.kind === 'wish').length,
    bigDraws: r.draws.filter(d => d.tier === 'big').length,
  };
}

// ===== 活动记录（核心钩子）=====
// type: 'task' 完成任务 | 'checkin' 打卡 | 'progress' 更新进度 | 'inspiration' 记录灵感
function recordActivity(type, opts = {}) {
  initRewards();
  const r = state.rewards;
  const today = rwToday();
  const now = new Date();

  r.activities.push({
    date: today, type, ts: Date.now(),
    title: opts.title || '', minutes: opts.minutes || 0,
  });
  if (r.activities.length > MAX_ACTIVITIES) r.activities = r.activities.slice(-MAX_ACTIVITIES);

  // 时段标记
  const hour = now.getHours();
  if (type === 'task' || type === 'checkin') {
    if (hour < 7) r.flags.hasEarly = true;
    if (hour >= 23) r.flags.hasLate = true;
  }

  // 计数
  if (type === 'task') r.totalCompleted += 1;
  if (type === 'checkin') r.totalCheckIns += 1;

  // 连续天数
  const streakResult = rwUpdateStreak(today);

  // 抽奖券
  let gotTicket = false;
  if (type === 'task' || type === 'checkin') {
    r.taskProgress = (r.taskProgress || 0) + 1;
    if (r.taskProgress >= TASKS_PER_TICKET) {
      r.taskProgress -= TASKS_PER_TICKET;
      r.tickets = (r.tickets || 0) + 1;
      gotTicket = true;
    }
  }

  saveData();
  rwRefreshNavBadge();
  rwFlashStreakArea();

  // 反馈
  if (gotTicket) {
    setTimeout(() => {
      showToast('攒够啦！获得 1 张抽奖券，可以去开盲盒了', 'success');
      rwSparkleBurst(14);
    }, 420);
  } else if (type === 'task' || type === 'checkin') {
    rwMaybeEncourage();
    rwSparkleBurst(6);
  }

  if (streakResult.reset) {
    setTimeout(() => showToast('连续记录重新开始了，第 1 天也算数', 'info'), 700);
  } else if (streakResult.frozenUsed) {
    setTimeout(() => showToast(`已自动使用 ${streakResult.frozenUsed} 张冻结卡，连续记录保住了`, 'info'), 700);
  } else if (streakResult.milestone) {
    setTimeout(() => showToast(`连续学习 ${state.rewards.streak.current} 天，了不起`, 'success'), 600);
  }

  rwCheckAchievements();
  return streakResult;
}

function rwUpdateStreak(dateKey) {
  const s = state.rewards.streak;
  const result = { changed: false, reset: false, frozenUsed: 0, milestone: false };

  // 每月重置冻结卡
  const ym = dateKey.slice(0, 7);
  if (s.freezeMonth !== ym) { s.freezeMonth = ym; s.freezes = FREEZES_PER_MONTH; }

  if (s.lastDate === dateKey) return result;
  if (!s.lastDate) {
    s.current = 1; s.best = Math.max(s.best || 0, 1); s.lastDate = dateKey;
    result.changed = true;
    return result;
  }

  const gap = rwDayDiff(s.lastDate, dateKey);
  if (gap <= 0) return result;

  if (gap === 1) {
    s.current = (s.current || 0) + 1;
  } else {
    const missed = gap - 1;
    if (s.autoFreeze !== false && (s.freezes || 0) >= missed) {
      s.freezes -= missed;
      s.current = (s.current || 0) + 1;
      result.frozenUsed = missed;
    } else {
      s.previousCurrent = s.current || 0;
      s.everReset = true;
      s.current = 1;
      result.reset = true;
    }
  }

  s.lastDate = dateKey;
  s.best = Math.max(s.best || 0, s.current);
  result.changed = true;
  result.milestone = [3, 7, 14, 21, 30, 50, 66, 100, 150, 200, 300, 365].includes(s.current);
  return result;
}

function rwMaybeEncourage() {
  const now = Date.now();
  if (now - rwLastEncourageTs < 45000) return;
  rwLastEncourageTs = now;
  const line = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
  setTimeout(() => showToast(line, 'encourage'), 220);
}

// ===== 成就 =====
function rwCheckAchievements(silent = false) {
  const r = state.rewards;
  const st = getRewardStats();
  const unlocked = [];
  const tests = {
    first_task: () => st.totalCompleted >= 1,
    tasks_10: () => st.totalCompleted >= 10,
    tasks_50: () => st.totalCompleted >= 50,
    tasks_100: () => st.totalCompleted >= 100,
    tasks_300: () => st.totalCompleted >= 300,
    streak_3: () => st.bestStreak >= 3,
    streak_7: () => st.bestStreak >= 7,
    streak_30: () => st.bestStreak >= 30,
    streak_100: () => st.bestStreak >= 100,
    perfect_1: () => st.perfectItems >= 1,
    perfect_3: () => st.perfectItems >= 3,
    breadth_4: () => st.activeSections >= 4,
    wish_1: () => st.wishDraws >= 1,
    draw_10: () => st.totalDraws >= 10,
    egg_7: () => st.eggCount >= 7,
    egg_30: () => st.eggCount >= 30,
    early: () => !!r.flags.hasEarly,
    night: () => !!r.flags.hasLate,
    comeback: () => r.streak.everReset && r.streak.current >= 3,
    big_one: () => st.bigDraws >= 1,
  };
  ACHIEVEMENTS.forEach(a => {
    if (r.achievements[a.id]) return;
    if (tests[a.id] && tests[a.id]()) {
      r.achievements[a.id] = new Date().toISOString();
      unlocked.push(a);
    }
  });
  if (unlocked.length) {
    saveData();
    if (!silent) {
      setTimeout(() => showAchievementCard(unlocked[0]), 900);
      if (unlocked.length > 1) {
        setTimeout(() => showToast(`另外还解锁了 ${unlocked.length - 1} 个成就`, 'success'), 1600);
      }
    }
  }
  return unlocked;
}

// ===== 盲盒抽奖 =====
function rwPickEgg() {
  const r = state.rewards;
  const seen = new Set(r.eggs.map(e => e.eggId));
  const unseen = EGGS.filter(e => !seen.has(e.id));
  const pool = unseen.length ? unseen : EGGS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function rwRollReward() {
  const r = state.rewards;
  const pool = { small: [], mid: [], big: [] };
  r.wishes.filter(w => !w.redeemed).forEach(w => { if (pool[w.tier]) pool[w.tier].push(w); });

  const hasBig = pool.big.length > 0, hasMid = pool.mid.length > 0, hasSmall = pool.small.length > 0;
  let tier = null;

  if (r.pity >= PITY_BIG && (hasBig || hasMid || hasSmall)) {
    tier = hasBig ? 'big' : (hasMid ? 'mid' : 'small');
  } else if (r.pity >= PITY_MID && (hasMid || hasBig || hasSmall)) {
    tier = hasMid ? 'mid' : (hasBig ? 'big' : 'small');
  } else {
    const roll = Math.random() * 100;
    if (roll < 5 && hasBig) tier = 'big';
    else if (roll < 30 && hasMid) tier = 'mid';
    else if (hasSmall) tier = 'small';
    else if (hasMid) tier = 'mid';
    else if (hasBig) tier = 'big';
  }

  r.totalDraws = (r.totalDraws || 0) + 1;

  if (!tier) {
    // 心愿清单为空 → 掉落彩蛋
    const egg = rwPickEgg();
    r.pity = (r.pity || 0) + 1;
    const res = { kind: 'egg', tier: 'egg', egg, ts: Date.now() };
    r.draws.push({ ts: res.ts, kind: 'egg', tier: 'egg', title: egg.title });
    return res;
  }

  if (tier === 'mid' || tier === 'big') r.pity = 0;
  else r.pity = (r.pity || 0) + 1;

  const wish = pool[tier][Math.floor(Math.random() * pool[tier].length)];
  wish.redeemed = true;
  wish.redeemedAt = new Date().toISOString();
  const res = { kind: 'wish', tier, wishId: wish.id, title: wish.title, note: wish.note || '', ts: Date.now() };
  r.draws.push({ ts: res.ts, kind: 'wish', tier, title: wish.title });
  if (r.draws.length > 120) r.draws = r.draws.slice(-120);
  return res;
}

function openBlindBox() {
  initRewards();
  if (rwLastDraw) return;
  if ((state.rewards.tickets || 0) <= 0) {
    showToast(`还没有抽奖券，再完成 ${TASKS_PER_TICKET - (state.rewards.taskProgress || 0)} 项就能攒到 1 张`, 'warning');
    return;
  }
  const stage = document.getElementById('rwBoxStage');
  if (!stage) return;

  rwLastDraw = true;
  state.rewards.tickets -= 1;
  const result = rwRollReward();
  rwLastResult = result;
  saveData();

  stage.classList.add('rw-opening');
  stage.innerHTML = rwOpeningHTML();
  rwUpdateTicketDisplays();

  setTimeout(() => {
    stage.classList.remove('rw-opening');
    stage.innerHTML = rwResultHTML(result);
    rwStage = 'result';
    rwLastDraw = false;
    rwSparkleBurst(result.tier === 'big' ? 22 : result.tier === 'mid' ? 14 : 8);
    rwUpdateTicketDisplays();
    rwCheckAchievements();
    if (result.kind === 'wish') rwRefreshWishList();
  }, 900);
}

function rwOpeningHTML() {
  return `<div class="rw-box rw-box-shake">
    <div class="rw-box-lid"></div>
    <div class="rw-box-body">
      <div class="rw-box-mark">?</div>
    </div>
    <div class="rw-box-text">正在打开…</div>
  </div>`;
}

function rwResultHTML(res) {
  if (res.kind === 'egg') {
    return `<div class="rw-result rw-result-egg">
      <div class="rw-result-label">今日彩蛋</div>
      <div class="rw-result-title">${escapeHtml(res.egg.title)}</div>
      <div class="rw-result-text">${escapeHtml(res.egg.text)}</div>
      <button class="btn btn-outline btn-sm" onclick="rwResetStage()">收下</button>
    </div>`;
  }
  const t = WISH_TIERS[res.tier];
  return `<div class="rw-result rw-result-${res.tier}">
    <div class="rw-result-label" style="color:${t.color}">${t.name}</div>
    <div class="rw-result-title">${escapeHtml(res.title)}</div>
    ${res.note ? `<div class="rw-result-text">${escapeHtml(res.note)}</div>` : ''}
    <div class="rw-result-hint">现在就去兑现它，这是你挣来的</div>
    <button class="btn btn-outline btn-sm" onclick="rwResetStage()">收下</button>
  </div>`;
}

function rwResetStage() {
  rwStage = 'idle';
  rwLastResult = null;
  const stage = document.getElementById('rwBoxStage');
  if (stage) stage.innerHTML = rwBoxIdleHTML();
  rwUpdateTicketDisplays();
}

function rwBoxIdleHTML() {
  const r = state.rewards || defaultRewards();
  const tickets = r.tickets || 0;
  const can = tickets > 0;
  return `<div class="rw-box ${can ? 'rw-box-ready' : 'rw-box-locked'}" onclick="${can ? 'openBlindBox()' : ''}">
    <div class="rw-box-lid"></div>
    <div class="rw-box-body">
      <div class="rw-box-mark">${can ? '开' : '锁'}</div>
    </div>
    <div class="rw-box-text">${can ? '点击开箱' : '完成任务攒券'}</div>
  </div>`;
}

function rwUpdateTicketDisplays() {
  const r = state.rewards || defaultRewards();
  const el = document.getElementById('rwTicketCount');
  if (el) el.textContent = r.tickets || 0;
  const p = document.getElementById('rwTicketProgress');
  if (p) {
    const need = TASKS_PER_TICKET - (r.taskProgress || 0);
    p.textContent = `再完成 ${need} 项获得下一张券`;
  }
  const pityEl = document.getElementById('rwPityText');
  if (pityEl) {
    const left = Math.max(0, PITY_MID - (r.pity || 0));
    pityEl.textContent = left > 0 ? `保底：再抽 ${left} 次必出中奖及以上` : '保底已触发，下次必出中奖及以上';
  }
  rwRefreshNavBadge();
}

function rwRefreshNavBadge() {
  const badge = document.getElementById('navTicketBadge');
  if (badge) {
    const n = state.rewards?.tickets || 0;
    badge.textContent = n;
    badge.style.display = n > 0 ? '' : 'none';
  }
}

function rwRefreshWishList() {
  const el = document.getElementById('rwWishListArea');
  if (el) el.innerHTML = rwWishListHTML();
}

// ===== 每日彩蛋 =====
function claimDailyEgg() {
  initRewards();
  const today = rwToday();
  const eggs = state.rewards.eggs || [];
  if (eggs.some(e => e.date === today)) { showToast('今天的彩蛋已经开过啦，明天再来', 'info'); return; }
  const egg = rwPickEgg();
  eggs.push({ date: today, eggId: egg.id, ts: Date.now() });
  if (eggs.length > 300) state.rewards.eggs = eggs.slice(-300);
  state.rewards.todayEgg = { date: today, eggId: egg.id };
  saveData();
  showToast('彩蛋已开启', 'success');
  rwSparkleBurst(8);
  rwCheckAchievements();
  if (state.currentView === 'rewards') navigate('rewards');
}

// ===== 心愿清单 =====
function rwAddWish() {
  const input = document.getElementById('rwWishTitle');
  const tierEl = document.getElementById('rwWishTier');
  const noteEl = document.getElementById('rwWishNote');
  const title = (input?.value || '').trim();
  if (!title) { showToast('先写下你的心愿', 'error'); return; }
  initRewards();
  state.rewards.wishes.push({
    id: 'w' + Date.now(), title, tier: tierEl?.value || 'small',
    note: (noteEl?.value || '').trim(), redeemed: false, createdAt: new Date().toISOString(),
  });
  saveData();
  if (input) input.value = '';
  if (noteEl) noteEl.value = '';
  showToast('心愿已放入盲盒池', 'success');
  rwRefreshWishList();
  const cnt = document.getElementById('rwWishPoolCount');
  if (cnt) cnt.textContent = state.rewards.wishes.filter(w => !w.redeemed).length;
}

function rwDeleteWish(wishId) {
  if (!confirm('确定删除这个心愿？')) return;
  state.rewards.wishes = state.rewards.wishes.filter(w => w.id !== wishId);
  saveData();
  rwRefreshWishList();
  showToast('心愿已删除', 'success');
}

function rwBackToPool(wishId) {
  const w = state.rewards.wishes.find(x => x.id === wishId);
  if (!w) return;
  w.redeemed = false;
  w.redeemedAt = null;
  delete w.redeemedAt;
  saveData();
  rwRefreshWishList();
  showToast('已重新放回盲盒池', 'success');
}

// ===== 成就卡片 =====
function showAchievementCard(ach) {
  const unlockedAt = state.rewards?.achievements?.[ach.id] || new Date().toISOString();
  const st = getRewardStats();
  const dataLine = rwAchievementDataLine(ach.id, st);
  openModal({
    title: '解锁成就',
    sub: ach.name,
    body: `
      <div class="rw-ach-card" id="rwAchCardVisual">
        <div class="rw-ach-card-inner">
          <div class="rw-ach-card-kicker">ACHIEVEMENT</div>
          <div class="rw-ach-card-name">${escapeHtml(ach.name)}</div>
          <div class="rw-ach-card-dec"></div>
          <div class="rw-ach-card-desc">${escapeHtml(ach.desc)}</div>
          <div class="rw-ach-card-data">${escapeHtml(dataLine)}</div>
          <div class="rw-ach-card-foot">
            <span>${escapeHtml(rwFormatDate(unlockedAt))}</span>
            <span>蓝莓的学习进度工作台</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:16px;">
        <button class="btn btn-primary" onclick="rwExportAchievementCard('${ach.id}')">保存为图片</button>
        <button class="btn btn-outline" onclick="closeModal()">收下</button>
      </div>
    `,
  });
}

function rwAchievementDataLine(id, st) {
  if (id.startsWith('streak')) return `连续学习 ${st.bestStreak} 天 · 累计 ${st.totalCompleted} 个学习动作`;
  if (id.startsWith('tasks')) return `累计完成 ${st.totalCompleted} 个学习动作 · 坚持 ${st.streak} 天`;
  if (id.startsWith('perfect')) return `${st.perfectItems} 个项目达成 100%`;
  if (id === 'breadth_4') return `${st.activeSections} 个学习板块都在推进`;
  if (id === 'wish_1') return `已兑现 ${st.wishDraws} 个心愿`;
  if (id === 'big_one') return `已抽中大奖 ${st.bigDraws} 次`;
  if (id.startsWith('draw')) return `累计开启盲盒 ${st.totalDraws} 次`;
  if (id.startsWith('egg')) return `收集彩蛋 ${st.eggCount} 个`;
  if (id === 'early') return `清晨的学习者 · 连续 ${st.bestStreak} 天`;
  if (id === 'night') return `深夜的学习者 · 累计 ${st.totalCompleted} 个动作`;
  if (id === 'comeback') return `断签之后重新连续 ${st.streak} 天`;
  return `累计 ${st.totalCompleted} 个学习动作`;
}

function rwExportAchievementCard(achId) {
  const ach = ACHIEVEMENTS.find(a => a.id === achId);
  if (!ach) return;
  const st = getRewardStats();
  const W = 900, H = 1200;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // 背景
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#fffaf6');
  g.addColorStop(0.5, '#fff5f2');
  g.addColorStop(1, '#f6fbf9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 外框
  ctx.strokeStyle = 'rgba(246,79,123,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, W - 96, H - 96);
  ctx.strokeStyle = 'rgba(95,141,158,0.28)';
  ctx.lineWidth = 1;
  ctx.strokeRect(70, 70, W - 140, H - 140);

  ctx.textAlign = 'center';

  // 顶部小字
  ctx.fillStyle = 'rgba(154,143,168,0.9)';
  ctx.font = '22px "Noto Sans SC", sans-serif';
  ctx.fillText('A C H I E V E M E N T', W / 2, 210);

  // 成就名
  ctx.fillStyle = '#3a2f45';
  ctx.font = '600 76px "Noto Serif SC", serif';
  ctx.fillText(ach.name, W / 2, 380);

  // 分隔线
  ctx.beginPath();
  ctx.moveTo(W / 2 - 90, 440);
  ctx.lineTo(W / 2 + 90, 440);
  ctx.strokeStyle = 'rgba(246,79,123,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 描述
  ctx.fillStyle = '#6b5d7a';
  ctx.font = '30px "Noto Sans SC", sans-serif';
  const descLines = rwWrapText(ctx, ach.desc, W - 260);
  descLines.forEach((line, i) => ctx.fillText(line, W / 2, 530 + i * 46));

  // 数据
  ctx.fillStyle = '#f64f7b';
  ctx.font = '500 34px "Noto Sans SC", sans-serif';
  const dataLines = rwWrapText(ctx, rwAchievementDataLine(ach.id, st), W - 260);
  dataLines.forEach((line, i) => ctx.fillText(line, W / 2, 700 + i * 50));

  // 日期
  ctx.fillStyle = '#9a8fa8';
  ctx.font = '26px "Noto Sans SC", sans-serif';
  ctx.fillText(rwFormatDate(state.rewards.achievements[ach.id] || new Date().toISOString()), W / 2, 900);

  // 落款
  ctx.fillStyle = 'rgba(58,47,69,0.75)';
  ctx.font = '28px "Noto Serif SC", serif';
  ctx.fillText('蓝莓的学习进度工作台', W / 2, 1010);
  ctx.fillStyle = 'rgba(154,143,168,0.8)';
  ctx.font = '20px "Noto Sans SC", sans-serif';
  ctx.fillText('每一格进度，都有人真的付出过', W / 2, 1060);

  const url = cv.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `成就卡片_${ach.name}_${rwToday()}.png`;
  a.click();
  showToast('成就卡片已保存', 'success');
}

function rwWrapText(ctx, text, maxWidth) {
  const chars = String(text).split('');
  const lines = [];
  let line = '';
  chars.forEach(ch => {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = ch; }
    else line = test;
  });
  if (line) lines.push(line);
  return lines;
}

// ===== 微动效 =====
function rwSparkleBurst(count = 8) {
  const layer = document.createElement('div');
  layer.className = 'rw-sparkle-layer';
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'rw-sparkle';
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 90;
    s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    s.style.left = `${50 + (Math.random() * 8 - 4)}%`;
    s.style.top = `${38 + (Math.random() * 8 - 4)}%`;
    s.style.animationDelay = `${Math.random() * 120}ms`;
    if (i % 3 === 1) s.style.background = 'rgba(95,141,158,0.85)';
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1100);
}

function rwFlashStreakArea() {
  const el = document.getElementById('rwStreakArea');
  if (!el) return;
  el.classList.remove('rw-pulse');
  void el.offsetWidth;
  el.classList.add('rw-pulse');
}

// ===== 植物成长 SVG =====
function rwPlantStage(days) {
  if (days <= 0) return { key: 'seed', label: '还没有开始' };
  if (days < 4) return { key: 'sprout', label: '刚刚破土' };
  if (days < 8) return { key: 'leaf', label: '长出叶子了' };
  if (days < 31) return { key: 'grow', label: '正在茂盛生长' };
  if (days < 101) return { key: 'flower', label: '开花了' };
  return { key: 'fruit', label: '结果了' };
}

function rwPlantSVG(days) {
  const stage = rwPlantStage(days).key;
  const stem = '#7fa88f';
  const leafG = '#9dc4ab';
  const leafD = '#7fa88f';
  const soil = '#d8c9b8';
  const flower = '#f2909f';
  let plant = '';

  if (stage === 'seed') {
    plant = `<circle cx="60" cy="132" r="7" fill="#c9b49c"/>
      <path d="M60 126 q6 -6 10 -2" stroke="#c9b49c" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  } else if (stage === 'sprout') {
    plant = `<path d="M60 140 L60 118" stroke="${stem}" stroke-width="3" stroke-linecap="round"/>
      <path d="M60 122 q-14 -4 -16 -16 q14 0 16 16z" fill="${leafG}"/>
      <path d="M60 126 q14 -5 16 -17 q-14 1 -16 17z" fill="${leafD}"/>`;
  } else if (stage === 'leaf') {
    plant = `<path d="M60 140 L60 96" stroke="${stem}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M60 122 q-16 -4 -19 -17 q16 0 19 17z" fill="${leafG}"/>
      <path d="M60 112 q16 -5 19 -18 q-16 1 -19 18z" fill="${leafD}"/>
      <path d="M60 104 q-13 -4 -15 -14 q13 0 15 14z" fill="${leafG}"/>`;
  } else if (stage === 'grow') {
    plant = `<path d="M60 140 L60 76" stroke="${stem}" stroke-width="4" stroke-linecap="round"/>
      <path d="M60 126 q-18 -4 -21 -18 q18 0 21 18z" fill="${leafG}"/>
      <path d="M60 116 q19 -5 22 -19 q-19 1 -22 19z" fill="${leafD}"/>
      <path d="M60 104 q-16 -4 -19 -16 q16 0 19 16z" fill="${leafG}"/>
      <path d="M60 92 q17 -5 20 -17 q-17 1 -20 17z" fill="${leafD}"/>
      <path d="M60 82 q-13 -4 -15 -13 q13 0 15 13z" fill="${leafG}"/>`;
  } else if (stage === 'flower') {
    plant = `<path d="M60 140 L60 70" stroke="${stem}" stroke-width="4" stroke-linecap="round"/>
      <path d="M60 126 q-18 -4 -21 -18 q18 0 21 18z" fill="${leafG}"/>
      <path d="M60 112 q19 -5 22 -19 q-19 1 -22 19z" fill="${leafD}"/>
      <path d="M60 98 q-16 -4 -19 -16 q16 0 19 16z" fill="${leafG}"/>
      <circle cx="60" cy="64" r="7" fill="${flower}"/>
      <circle cx="52" cy="60" r="5.5" fill="${flower}" opacity="0.85"/>
      <circle cx="68" cy="60" r="5.5" fill="${flower}" opacity="0.85"/>
      <circle cx="60" cy="54" r="5.5" fill="${flower}" opacity="0.7"/>
      <circle cx="60" cy="64" r="3" fill="#fbd7a8"/>`;
  } else {
    plant = `<path d="M60 140 L60 70" stroke="${stem}" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M60 126 q-18 -4 -21 -18 q18 0 21 18z" fill="${leafG}"/>
      <path d="M60 110 q19 -5 22 -19 q-19 1 -22 19z" fill="${leafD}"/>
      <path d="M60 94 q-16 -4 -19 -16 q16 0 19 16z" fill="${leafG}"/>
      <path d="M60 80 q16 -5 19 -17 q-16 1 -19 17z" fill="${leafD}"/>
      <circle cx="46" cy="106" r="6" fill="${flower}"/>
      <circle cx="76" cy="98" r="6" fill="${flower}"/>
      <circle cx="60" cy="66" r="6.5" fill="${flower}"/>`;
  }

  return `<svg viewBox="0 0 120 160" width="120" height="160" role="img" aria-label="连续学习植物">
    <ellipse cx="60" cy="142" rx="30" ry="7" fill="${soil}" opacity="0.55"/>
    <path d="M30 140 h60" stroke="${soil}" stroke-width="3" stroke-linecap="round"/>
    ${plant}
  </svg>`;
}

// ===== 页面渲染 =====
function rwHomeWidgetHTML() {
  const r = state.rewards || defaultRewards();
  const st = getRewardStats();
  const stage = rwPlantStage(st.streak);
  const need = TASKS_PER_TICKET - (r.taskProgress || 0);
  const pct = Math.round(((r.taskProgress || 0) / TASKS_PER_TICKET) * 100);

  return `<div class="card rw-home-card" style="margin-bottom:24px;">
    <div class="section-title">今天，你有在前进 <span class="deco-line"></span></div>
    <div class="section-subtitle">Today's Momentum</div>
    <div class="rw-home-grid">
      <div class="rw-home-stat" id="rwStreakArea">
        <div class="rw-home-num">${st.streak}</div>
        <div class="rw-home-label">连续学习天数</div>
        <div class="rw-home-sub">${stage.label}${st.bestStreak > st.streak ? ` · 最长 ${st.bestStreak} 天` : ''}</div>
      </div>
      <div class="rw-home-stat">
        <div class="rw-home-num">${st.todayCompleted}</div>
        <div class="rw-home-label">今日完成</div>
        <div class="rw-home-sub">${st.todayMinutes > 0 ? `约 ${st.todayMinutes} 分钟` : '每一项都算数'}</div>
      </div>
      <div class="rw-home-stat">
        <div class="rw-home-num">${st.todayCheckIns}</div>
        <div class="rw-home-label">今日打卡</div>
        <div class="rw-home-sub">${st.totalCheckIns > 0 ? `累计 ${st.totalCheckIns} 次` : '今天开始也可以'}</div>
      </div>
      <div class="rw-home-stat">
        <div class="rw-home-num">${r.tickets || 0}</div>
        <div class="rw-home-label">抽奖券</div>
        <div class="rw-home-sub">再完成 ${need} 项得 1 张</div>
      </div>
    </div>
    <div class="rw-home-bar"><div class="rw-home-bar-fill" style="width:${pct}%"></div></div>
    <div class="rw-home-actions">
      <button class="btn btn-primary btn-sm" onclick="navigate('rewards')">去开盲盒 / 看成就</button>
      <span class="rw-home-hint">券来自真实完成，抽奖必有所得（有保底，不会空手）</span>
    </div>
  </div>`;
}

function rwWishListHTML() {
  const r = state.rewards || defaultRewards();
  const pool = r.wishes.filter(w => !w.redeemed);
  const redeemed = r.wishes.filter(w => w.redeemed);

  const groupHTML = Object.keys(WISH_TIERS).map(key => {
    const t = WISH_TIERS[key];
    const list = pool.filter(w => w.tier === key);
    return `<div class="rw-wish-group">
      <div class="rw-wish-group-head">
        <span class="rw-tier-dot" style="background:${t.color}"></span>
        <span class="rw-wish-group-name">${t.name}</span>
        <span class="rw-wish-group-prob">基础概率 ${t.prob}%</span>
      </div>
      <div class="rw-wish-group-hint">${t.hint}</div>
      ${list.length ? list.map(w => `
        <div class="rw-wish-item">
          <div class="rw-wish-item-main">
            <div class="rw-wish-title">${escapeHtml(w.title)}</div>
            ${w.note ? `<div class="rw-wish-note">${escapeHtml(w.note)}</div>` : ''}
          </div>
          <button class="rw-icon-btn" onclick="rwDeleteWish('${w.id}')" title="删除">✕</button>
        </div>`).join('') : `<div class="rw-wish-empty">还没有这一档的心愿</div>`}
    </div>`;
  }).join('');

  return `${groupHTML}
    <div class="rw-wish-redeemed">
      <div class="rw-wish-redeemed-head">已兑现纪念册 · ${redeemed.length} 个</div>
      ${redeemed.length ? redeemed.slice().reverse().map(w => `
        <div class="rw-wish-item rw-wish-item-done">
          <div class="rw-wish-item-main">
            <div class="rw-wish-title">${escapeHtml(w.title)}</div>
            <div class="rw-wish-note">${w.redeemedAt ? rwFormatDate(w.redeemedAt) + ' 兑现' : '已兑现'}</div>
          </div>
          <button class="rw-icon-btn" onclick="rwBackToPool('${w.id}')" title="重新放回盲盒池">↺</button>
        </div>`).join('') : `<div class="rw-wish-empty">抽中的心愿会收进这里，作为你努力的证据</div>`}
    </div>`;
}

function rwEggHTML() {
  const r = state.rewards || defaultRewards();
  const today = rwToday();
  const todayEgg = (r.eggs || []).find(e => e.date === today);
  if (todayEgg) {
    const egg = EGGS.find(e => e.id === todayEgg.eggId) || EGGS[0];
    return `<div class="rw-egg rw-egg-open">
      <div class="rw-egg-type">${egg.type === 'poem' ? '一句诗' : egg.type === 'fact' ? '冷知识' : egg.type === 'coupon' ? '给自己的一张券' : '问自己'}</div>
      <div class="rw-egg-title">${escapeHtml(egg.title)}</div>
      <div class="rw-egg-text">${escapeHtml(egg.text)}</div>
      <div class="rw-egg-foot">明天再来，还有新的</div>
    </div>`;
  }
  return `<div class="rw-egg">
    <div class="rw-egg-title">今天的彩蛋还没开</div>
    <div class="rw-egg-text">不需要券，打开就有一份小东西：可能是一句诗、一个冷知识，或者一张允许自己休息的券。</div>
    <button class="btn btn-gold btn-sm" onclick="claimDailyEgg()">打开今日彩蛋</button>
  </div>`;
}

function rwAchievementWallHTML() {
  const r = state.rewards || defaultRewards();
  const unlockedCount = ACHIEVEMENTS.filter(a => r.achievements[a.id]).length;
  return `<div class="rw-ach-head">已解锁 ${unlockedCount} / ${ACHIEVEMENTS.length}</div>
    <div class="rw-ach-wall">
      ${ACHIEVEMENTS.map(a => {
        const at = r.achievements[a.id];
        return `<div class="rw-ach-badge ${at ? 'unlocked' : 'locked'}" ${at ? `onclick="showAchievementCard({id:'${a.id}',name:'${a.name}',desc:'${a.desc}'})"` : ''}>
          <div class="rw-ach-seal">${at ? '✦' : '·'}</div>
          <div class="rw-ach-name">${a.name}</div>
          <div class="rw-ach-desc">${a.desc}</div>
          ${at ? `<div class="rw-ach-date">${rwFormatDate(at)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
}

function rwDrawHistoryHTML() {
  const r = state.rewards || defaultRewards();
  const draws = (r.draws || []).slice().reverse().slice(0, 12);
  if (!draws.length) return `<div class="rw-empty">还没有抽奖记录，攒到第一张券就可以开始了</div>`;
  const tierName = { small: '小确幸', mid: '中奖', big: '大奖', egg: '彩蛋' };
  const tierColor = { small: '#f64f7b', mid: '#c98a3f', big: '#5f8d9e', egg: '#9a8fa8' };
  return `<div class="rw-history">
    ${draws.map(d => `<div class="rw-history-item">
      <span class="rw-history-dot" style="background:${tierColor[d.tier] || '#9a8fa8'}"></span>
      <span class="rw-history-title">${escapeHtml(d.title || '')}</span>
      <span class="rw-history-tier" style="color:${tierColor[d.tier] || '#9a8fa8'}">${tierName[d.tier] || ''}</span>
      <span class="rw-history-time">${formatTime(new Date(d.ts).toISOString())}</span>
    </div>`).join('')}
  </div>`;
}

function renderRewardsPage() {
  initRewards();
  const r = state.rewards;
  const st = getRewardStats();
  const stage = rwPlantStage(st.streak);
  const need = TASKS_PER_TICKET - (r.taskProgress || 0);
  const frozenThisMonth = (r.streak.frozenDates || []).filter(d => d.slice(0, 7) === rwToday().slice(0, 7)).length;

  return `
  <div class="card rw-hero">
    <div class="section-title">激励中心 <span class="deco-line"></span></div>
    <div class="section-subtitle">Motivation Studio · 让每一步都有回声</div>
    <div class="rw-hero-grid">
      <div class="rw-hero-left">
        <div class="rw-ticket-box">
          <div class="rw-ticket-num" id="rwTicketCount">${r.tickets || 0}</div>
          <div class="rw-ticket-label">张抽奖券</div>
          <div class="rw-ticket-progress" id="rwTicketProgress">再完成 ${need} 项获得下一张券</div>
          <div class="rw-ticket-bar"><div class="rw-ticket-bar-fill" style="width:${Math.round((r.taskProgress || 0) / TASKS_PER_TICKET * 100)}%"></div></div>
        </div>
        <div class="rw-pity" id="rwPityText">${(r.pity || 0) >= PITY_MID ? '保底已触发，下次必出中奖及以上' : `保底：再抽 ${Math.max(0, PITY_MID - (r.pity || 0))} 次必出中奖及以上`}</div>
      </div>
      <div class="rw-hero-right" id="rwBoxStage">
        ${rwBoxIdleHTML()}
      </div>
    </div>
  </div>

  <div class="rw-two-col">
    <div class="card">
      <div class="section-title">连续学习 <span class="deco-line"></span></div>
      <div class="section-subtitle">Keep the Streak Alive</div>
      <div class="rw-streak-row" id="rwStreakArea">
        <div class="rw-streak-plant">${rwPlantSVG(st.streak)}</div>
        <div class="rw-streak-info">
          <div class="rw-streak-num">${st.streak} <span>天</span></div>
          <div class="rw-streak-label">${stage.label}</div>
          <div class="rw-streak-meta">最长连续 ${st.bestStreak} 天 · 本月已用冻结卡 ${frozenThisMonth} 张</div>
          <div class="rw-streak-freeze">冻结卡剩余 ${r.streak.freezes} 张（每月 ${FREEZES_PER_MONTH} 张，断签自动保护）</div>
        </div>
      </div>
      <div class="rw-note">断一天不会清零，冻结卡会帮你保住记录；真的断了也只是重新开始第 1 天，不算失败。</div>
    </div>

    <div class="card">
      <div class="section-title">今日小结 <span class="deco-line"></span></div>
      <div class="section-subtitle">Today's Summary</div>
      <div class="rw-summary">
        <div class="rw-summary-item"><span class="rw-summary-num">${st.todayCompleted}</span><span>项任务完成</span></div>
        <div class="rw-summary-item"><span class="rw-summary-num">${st.todayCheckIns}</span><span>次打卡</span></div>
        <div class="rw-summary-item"><span class="rw-summary-num">${st.todayMinutes}</span><span>分钟专注</span></div>
        <div class="rw-summary-item"><span class="rw-summary-num">${st.totalCompleted}</span><span>累计完成</span></div>
      </div>
      <div class="rw-summary-line">${rwSummarySentence(st)}</div>
      ${rwEggHTML()}
    </div>
  </div>

  <div class="card" style="margin-bottom:24px;">
    <div class="section-title">心愿清单 <span class="deco-line"></span></div>
    <div class="section-subtitle">Wish Pool · 抽中即兑现</div>
    <div class="rw-wish-form">
      <input class="input" id="rwWishTitle" placeholder="写一个你真的想做的愿望，例如：看一部想看的电影">
      <select class="input rw-select" id="rwWishTier">
        <option value="small">小确幸 · 30 分钟内</option>
        <option value="mid">中奖 · 值得期待</option>
        <option value="big">大奖 · 攒够运气</option>
      </select>
      <input class="input" id="rwWishNote" placeholder="备注（可选）">
      <button class="btn btn-primary" onclick="rwAddWish()">放入盲盒池</button>
    </div>
    <div class="rw-wish-pool-count">池中还有 <span id="rwWishPoolCount">${r.wishes.filter(w => !w.redeemed).length}</span> 个心愿等着被抽中</div>
    <div class="rw-wish-list" id="rwWishListArea">${rwWishListHTML()}</div>
  </div>

  <div class="card" style="margin-bottom:24px;">
    <div class="section-title">成就墙 <span class="deco-line"></span></div>
    <div class="section-subtitle">Achievements · 点亮的可以保存成卡片</div>
    ${rwAchievementWallHTML()}
  </div>

  <div class="card">
    <div class="section-title">抽奖记录 <span class="deco-line"></span></div>
    <div class="section-subtitle">Draw History</div>
    ${rwDrawHistoryHTML()}
  </div>`;
}

function rwSummarySentence(st) {
  if (st.todayCompleted === 0 && st.todayCheckIns === 0) return '今天还没开始，完成任意一项就会点亮今天的记录。';
  if (st.todayCompleted >= 5) return '今天推进得很快，记得给自己一点奖励。';
  if (st.streak >= 7) return `已经连续 ${st.streak} 天，这种稳定比偶尔的冲刺更值钱。`;
  return '今天已经动起来了，这就是最重要的事。';
}

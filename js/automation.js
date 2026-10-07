/* ============================================
 * 蓝莓的学习进度工作台 · 自动化与任务拆解
 * ------------------------------------------------------------
 * 两大能力：
 *  1) 自动化：到点自动产出内容（选题推送 / 提醒），可自定义时间与规则
 *  2) 任务拆解：把一个大任务拆成可执行的小步骤，降低启动阻力
 *
 * 设计约束（重要）：
 *  - 纯前端静态站点，没有服务器，因此"关了网页也能推送"做不到。
 *    实现方式为：页面打开时到点触发 + 重新打开网页时补发（catch-up）。
 *  - 所有新增数据都是**追加字段**，不改动任何既有字段，旧数据零影响。
 *  - AI 生成有两条路：本地规则引擎（无需联网、无需 Key）+ 可选自带 Key
 *    接入任意 OpenAI 兼容接口。AI 凭据单独存本地，不进同步快照。
 * ============================================ */

// ===== 常量 =====

const AUTO_MAX_RUNS = 30;          // 每个自动化保留的历史产出次数
const AUTO_TICK_MS = 30000;        // 定时检查间隔
const AUTO_AI_STORAGE = 'lanmei_ai_config_v1';  // AI 凭据（仅本机，不同步）

// 参考文件：可被 AI 与本地选题引擎读取，作为产出的上下文
const AUTO_REF_MAX_FILES = 5;               // 最多几个文件
const AUTO_REF_MAX_SIZE = 150 * 1024;       // 单个文件上限 150KB
const AUTO_REF_MAX_TOTAL = 500 * 1024;      // 全部文件总上限 500KB
const AUTO_REF_AI_PER_FILE = 2500;          // 每个文件喂给 AI 的字数上限
const AUTO_REF_AI_TOTAL = 8000;             // 所有文件喂给 AI 的总字数上限
// 能读出内容的文本类文件（其余类型只能记录文件名）
const AUTO_REF_TEXT_EXT = [
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'html', 'htm', 'xml',
  'yml', 'yaml', 'log', 'srt', 'vtt', 'js', 'css', 'py', 'tex', 'text',
];

const AUTO_REPEATS = {
  daily:    { name: '每天' },
  weekdays: { name: '工作日（周一至周五）' },
  weekly:   { name: '每周指定几天' },
};

const AUTO_KINDS = {
  topic:    { name: '选题推送', desc: '到点自动产出选题与文案建议，可直接开录' },
  reminder: { name: '内容提醒', desc: '到点提醒你该做什么，并可附带清单' },
};

// 中文自媒体选题公式（本地规则引擎的核心，无 AI 也能产出可用的选题）
const TOPIC_FORMULAS = [
  {
    key: 'pain',
    name: '痛点解答',
    build: (kw, aud) => `为什么你${kw}总是卡住？${aud}最容易忽略的 1 个前提`,
    angle: (kw, aud) => `先否定"努力不够"这个结论，把问题归因到方法和顺序上，让${aud}有被说中的感觉`,
  },
  {
    key: 'counter',
    name: '反常识',
    build: (kw, aud) => `都说${kw}要这样做，我实测 30 天后发现结论是反的`,
    angle: (kw) => `用一个可验证的亲测结果推翻流行说法，前半段顺着共识走，后半段反转`,
  },
  {
    key: 'list',
    name: '清单盘点',
    build: (kw) => `${kw}的 5 个关键点，第 3 个最多人忽略`,
    angle: () => `把干货拆成清单降低理解成本，明确"第几个最重要"制造留存动机`,
  },
  {
    key: 'compare',
    name: '对比测评',
    build: (kw, aud) => `${kw}：A 方案 vs B 方案，${aud}该选哪个？`,
    angle: () => `不评判绝对好坏，而是按"你的目标是什么"给分场景结论，更容易被收藏`,
  },
  {
    key: 'pitfall',
    name: '避坑指南',
    build: (kw) => `做${kw}之前必看：我踩过的 4 个坑`,
    angle: () => `用自身代价换来的教训建立信任感，每个坑配"正确做法"形成闭环`,
  },
  {
    key: 'tutorial',
    name: '从零教程',
    build: (kw, aud) => `${aud}从 0 到 1 做${kw}：手把手全过程`,
    angle: () => `按时间顺序完整走一遍，不省略中间步骤，突出"新手照着做就行"`,
  },
  {
    key: 'review',
    name: '真实复盘',
    build: (kw) => `我坚持${kw} 30 天，真实数据和过程全公开`,
    angle: () => `把过程中的数据和情绪都摊开讲，真实感本身就是内容壁垒`,
  },
  {
    key: 'qa',
    name: '高频问答',
    build: (kw, aud) => `${aud}最常问的 6 个关于${kw}的问题，一次讲清`,
    angle: () => `把评论区常见问题集中回答，天然贴近搜索需求，适合长期被翻出来看`,
  },
  {
    key: 'case',
    name: '案例拆解',
    build: (kw) => `拆解一个${kw}的真实案例，普通人也能照着做`,
    angle: () => `选可控规模的小案例，强调可复制性而不是不可企及的传奇`,
  },
  {
    key: 'timeline',
    name: '成长时间线',
    build: (kw) => `从完全不会到能拿出手，我的${kw}用了多久？`,
    angle: (kw, aud) => `用时间线呈现阶段性变化，给正在起步的${aud}一个可对照的坐标`,
  },
];

// 文案结构建议（口播/图文通用骨架）
const SCRIPT_FRAMES = [
  {
    name: '钩子—痛点—干货—行动',
    beats: [
      '前 3 秒抛出一个具体场景或反常识结论，不要自我介绍',
      '用一句话说出目标观众当下的困境，让他觉得"这说的就是我"',
      '分 2–3 点给方法和依据，每点配一个具体例子或数字',
      '结尾给一个今天就能做的最小动作，并留一个互动钩子',
    ],
  },
  {
    name: '问题—验证—结论—延伸',
    beats: [
      '先提出一个你也被困扰过的真实问题',
      '讲清你是怎么做验证的（过程比结论更有说服力）',
      '给出结论，并说明它成立的边界条件',
      '延伸到下一个相关问题，预告后续内容',
    ],
  },
  {
    name: '清单式快节奏',
    beats: [
      '开头直接点明"几条"，给观众预期',
      '每条控制在 15 秒内：现象 → 原因 → 做法',
      '中间插入一句制造停顿感的话，防止划走',
      '最后一条留作最实用的那个，收尾干脆',
    ],
  },
];

// 任务拆解模板（关键词命中即套用，命中越靠前越优先）
const BREAKDOWN_TEMPLATES = [
  {
    name: '内容创作 / 自媒体',
    keys: ['自媒体', '短视频', '视频', '公众号', '小红书', '笔记', '文章', '文案', '录制', '口播', '发布', '选题', '脚本', '剪辑'],
    steps: [
      '定选题与角度（一句话说清"给谁看、解决什么"）',
      '列大纲：钩子 / 主体 2–3 点 / 结尾行动',
      '写完整脚本或初稿',
      '通读一遍删掉三分之一冗余',
      '录制或排版（先出一版粗糙的成品）',
      '发布并记录数据（播放、互动、涨粉）',
      '复盘：哪一段留人、哪一段掉人',
    ],
  },
  {
    name: '课程 / 系统学习',
    keys: ['课程', '课时', '网课', '学', '学习', '教程', '看书', '读书', '阅读', '论文', '教材', '章节'],
    steps: [
      '先看目录和章节概要，建立整体框架',
      '完整过一遍，不纠结细节，标记卡住的地方',
      '回头精读标记处，查资料补齐',
      '整理成一页笔记（自己的话，不要抄）',
      '做练习或复述一遍，检验是否真的懂了',
      '隔一天再快速回顾一次',
    ],
  },
  {
    name: '项目 / 开发',
    keys: ['项目', '开发', '编码', '实现', '搭建', '做一个', '程序', '网页', '应用', '系统', '功能', '接口'],
    steps: [
      '写清目标：最终要看到什么结果',
      '拆出最小可用版本（只保留一个核心功能）',
      '搭好基础结构并跑通一次',
      '实现核心功能',
      '自己测一遍边界情况',
      '整理说明文档或使用说明',
    ],
  },
  {
    name: '考试 / 复习',
    keys: ['考试', '复习', '备考', '刷题', '真题', '测验', '背诵', '单词', '雅思', '托福'],
    steps: [
      '先做一套真题摸底，找出薄弱环节',
      '按薄弱点排序，先补最拉分的',
      '专项练习，每类做完立刻对答案',
      '整理错题，写清错因而不是答案',
      '限时模拟一次，适应节奏',
      '考前只过错题和框架，不碰新题',
    ],
  },
  {
    name: '报名 / 事务办理',
    keys: ['报名', '申请', '预约', '提交', '材料', '手续', '办理', '填表', '缴费'],
    steps: [
      '看清楚要求与截止时间，列出材料清单',
      '逐项准备材料，缺的先标记出来',
      '扫描或整理成要求的格式',
      '填表并逐项核对（姓名、日期最容易错）',
      '提交并截图保存回执',
      '记下后续需要跟进的节点',
    ],
  },
  {
    name: '运动 / 健康',
    keys: ['运动', '健身', '跑步', '瑜伽', '游泳', '锻炼', '训练', '拉伸', '冥想'],
    steps: [
      '热身 5 分钟（不要跳）',
      '主训练按计划完成',
      '放松拉伸 5 分钟',
      '记录本次数据（时长、强度、感受）',
    ],
  },
  {
    name: '活动 / 组织',
    keys: ['活动', '会议', '组织', '策划', '聚会', '安排', '协调', '通知'],
    steps: [
      '定时间、地点、人数和预算',
      '列出需要通知的人员与方式',
      '准备所需物料或场地',
      '提前一天确认一遍',
      '当天执行并处理临时状况',
      '结束后简单复盘',
    ],
  },
];

// 兜底拆解（没有命中任何模板时）
const BREAKDOWN_FALLBACK = {
  name: '通用拆解',
  steps: [
    '用一句话写清"完成后会是什么样"',
    '列出不超过 3 个主要环节',
    '只挑第一个环节，再做一次细化',
    '先做 15 分钟，做完再决定下一步',
    '收尾时记录卡在哪、下次从哪继续',
  ],
};

// 快速创建模板
const AUTO_PRESETS = [
  {
    key: 'media',
    name: '自媒体选题推送',
    kind: 'topic',
    time: '19:00',
    repeat: 'daily',
    count: 3,
    brief: '职场新人向的口播短视频，单条 1–3 分钟，讲得具体、有可操作步骤',
    presetTopics: [],
  },
  {
    key: 'english_morning',
    name: '英语晨读提醒',
    kind: 'reminder',
    time: '08:00',
    repeat: 'weekdays',
    count: 0,
    brief: '影子跟读 30 分钟 + 单词复习 20 个',
    presetTopics: [],
  },
  {
    key: 'review_night',
    name: '每日复盘',
    kind: 'reminder',
    time: '21:30',
    repeat: 'daily',
    count: 0,
    brief: '今天学了什么、卡在哪、明天第一步做什么',
    presetTopics: [],
  },
];

// ===== 数据初始化与迁移 =====

function defaultAutomations() {
  return [];
}

function ensureAutosShape(list) {
  if (!Array.isArray(list)) return [];
  return list.map(a => ({
    id: a.id || ('auto_' + Math.random().toString(36).slice(2, 9)),
    name: a.name || '未命名自动化',
    sectionId: a.sectionId || '',
    kind: a.kind === 'reminder' ? 'reminder' : 'topic',
    enabled: a.enabled !== false,
    time: /^\d{2}:\d{2}$/.test(a.time || '') ? a.time : '19:00',
    repeat: AUTO_REPEATS[a.repeat] ? a.repeat : 'daily',
    weekdays: Array.isArray(a.weekdays) ? a.weekdays.filter(d => d >= 0 && d <= 6) : [1, 2, 3, 4, 5],
    count: Number.isFinite(a.count) ? Math.max(1, Math.min(8, a.count)) : 3,
    presetTopics: Array.isArray(a.presetTopics)
      ? a.presetTopics.filter(t => t && t.title).map(t => ({
          id: t.id || ('pt_' + Math.random().toString(36).slice(2, 9)),
          title: String(t.title).slice(0, 120),
          angle: String(t.angle || '').slice(0, 300),
          tags: Array.isArray(t.tags) ? t.tags : [],
        }))
      : [],
    brief: a.brief || '',
    autoCreateTask: !!a.autoCreateTask,
    refFiles: Array.isArray(a.refFiles)
      ? a.refFiles.filter(f => f && f.name).slice(0, AUTO_REF_MAX_FILES).map(f => ({
          id: f.id || ('rf_' + Math.random().toString(36).slice(2, 9)),
          name: String(f.name).slice(0, 120),
          size: Number(f.size) || 0,
          ext: String(f.ext || '').slice(0, 12),
          isText: !!f.isText,
          text: typeof f.text === 'string' ? f.text : '',
          addedAt: f.addedAt || '',
        }))
      : [],
    lastRunDate: a.lastRunDate || '',
    runs: Array.isArray(a.runs) ? a.runs.slice(-AUTO_MAX_RUNS) : [],
  }));
}

function initAutomation() {
  const cur = state.automations;
  const shaped = ensureAutosShape(cur);
  // 保持数组引用稳定，避免外部持有的旧引用丢数据
  if (Array.isArray(cur)) {
    cur.length = 0;
    shaped.forEach(x => cur.push(x));
  } else {
    state.automations = shaped;
  }
  if (!state.autoRead || typeof state.autoRead !== 'object') state.autoRead = {};
}

// 给历史任务补齐 subtasks 字段（纯追加，不动原有字段）
function migrateSubtasks() {
  let changed = false;
  state.sections.forEach(sec => {
    (sec.tasks || []).forEach(t => {
      if (!Array.isArray(t.subtasks)) { t.subtasks = []; changed = true; }
    });
  });
  return changed;
}

// ===== 参考文件（上传 / 读取 / 预览）=====
// 编辑弹窗里的草稿：打开弹窗时从自动化复制一份，保存时写回，取消则丢弃
let autoDraftRefs = [];

function autoRefExt(name) {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

function autoRefIsText(file) {
  if (AUTO_REF_TEXT_EXT.includes(autoRefExt(file.name))) return true;
  return String(file.type || '').startsWith('text/');
}

function autoRefFormatSize(n) {
  const b = Number(n) || 0;
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1024 / 1024).toFixed(2) + ' MB';
}

function autoRefTotalSize(list) {
  return (list || []).reduce((n, f) => n + (Number(f.size) || 0), 0);
}

function autoRefListHTML() {
  if (!autoDraftRefs.length) {
    return `<div class="auto-ref-empty">还没有参考文件。可以传你的往期文案、产品资料、爆款清单或笔记，AI 生成选题时会先读它。</div>`;
  }
  return autoDraftRefs.map(f => `<div class="auto-ref-item">
    <div class="auto-ref-item-main">
      <div class="auto-ref-name">${escapeHtml(f.name)}</div>
      <div class="auto-ref-meta">${autoRefFormatSize(f.size)} · ${f.isText ? `已读取 ${f.text.length} 字` : '二进制文件，仅记录文件名'}</div>
    </div>
    ${f.isText && f.text ? `<button type="button" class="rw-icon-btn" onclick="autoToggleRefPreview('${f.id}')" title="预览">看</button>` : ''}
    <button type="button" class="rw-icon-btn" onclick="autoRemoveRef('${f.id}')" title="移除">✕</button>
    ${f.isText && f.text ? `<div class="auto-ref-preview" id="autoRefPreview_${f.id}" style="display:none;">${escapeHtml(f.text.slice(0, 800))}${f.text.length > 800 ? '\n…（仅预览前 800 字）' : ''}</div>` : ''}
  </div>`).join('');
}

function autoRefreshRefList() {
  const box = document.getElementById('autoRefList');
  if (box) box.innerHTML = autoRefListHTML();
  const cnt = document.getElementById('autoRefCount');
  if (cnt) {
    cnt.textContent = `${autoDraftRefs.length} / ${AUTO_REF_MAX_FILES} 个 · 共 ${autoRefFormatSize(autoRefTotalSize(autoDraftRefs))}`;
  }
}

function autoHandleRefFiles(input) {
  const files = Array.from((input && input.files) || []);
  if (input) input.value = '';
  if (!files.length) return;

  const failed = [];
  let pending = files.length;
  const finish = () => {
    autoRefreshRefList();
    if (failed.length) {
      showToast(failed[0] + (failed.length > 1 ? `（另有 ${failed.length - 1} 个未添加）` : ''), 'warning');
    } else {
      showToast('参考文件已添加，记得点保存', 'success');
    }
  };
  const step = () => { pending -= 1; if (pending === 0) finish(); };

  files.forEach(file => {
    if (autoDraftRefs.length >= AUTO_REF_MAX_FILES) return (failed.push(`最多只能放 ${AUTO_REF_MAX_FILES} 个参考文件`), step());
    if (file.size > AUTO_REF_MAX_SIZE) return (failed.push(`「${file.name}」超过 ${autoRefFormatSize(AUTO_REF_MAX_SIZE)}`), step());
    if (autoRefTotalSize(autoDraftRefs) + file.size > AUTO_REF_MAX_TOTAL) {
      return (failed.push(`参考文件总大小会超过 ${autoRefFormatSize(AUTO_REF_MAX_TOTAL)}`), step());
    }

    const isText = autoRefIsText(file);
    const meta = {
      id: 'rf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: file.name.slice(0, 120),
      size: file.size,
      ext: autoRefExt(file.name),
      isText,
      text: '',
      addedAt: new Date().toISOString(),
    };
    const keep = () => {
      autoDraftRefs = autoDraftRefs.filter(f => f.name !== file.name);  // 同名覆盖
      autoDraftRefs.push(meta);
      step();
    };

    if (!isText) return keep();   // 二进制文件只记录文件名与大小
    const rd = new FileReader();
    rd.onerror = () => { failed.push(`读取「${file.name}」失败`); step(); };
    rd.onload = () => { meta.text = String(rd.result || ''); keep(); };
    rd.readAsText(file, 'utf-8');
  });
}

function autoRemoveRef(refId) {
  autoDraftRefs = autoDraftRefs.filter(f => f.id !== refId);
  autoRefreshRefList();
}

function autoToggleRefPreview(refId) {
  const el = document.getElementById('autoRefPreview_' + refId);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// 把所有参考文件的文本拼成一段上下文，供 AI 使用
function autoRefContextForAI(auto) {
  const files = (auto.refFiles || []).filter(f => f.isText && f.text);
  if (!files.length) return '';
  let left = AUTO_REF_AI_TOTAL;
  const blocks = [];
  files.forEach(f => {
    if (left <= 0) return;
    const piece = f.text.replace(/\s+/g, ' ').trim().slice(0, Math.min(AUTO_REF_AI_PER_FILE, left));
    if (!piece) return;
    left -= piece.length;
    blocks.push(`【${f.name}】\n${piece}`);
  });
  if (!blocks.length) return '';
  return '我的参考资料（请贴合这些内容来构思，不要照抄原文）：\n' + blocks.join('\n\n');
}

// ===== AI 凭据（只存本机，不进同步快照：避免 Key 被写进备份文件） =====

function getAIConfig() {
  try {
    const raw = localStorage.getItem(AUTO_AI_STORAGE);
    if (!raw) return { enabled: false, baseUrl: '', apiKey: '', model: '' };
    const c = JSON.parse(raw);
    return {
      enabled: !!c.enabled,
      baseUrl: c.baseUrl || '',
      apiKey: c.apiKey || '',
      model: c.model || '',
    };
  } catch (e) {
    return { enabled: false, baseUrl: '', apiKey: '', model: '' };
  }
}

function setAIConfig(cfg) {
  try { localStorage.setItem(AUTO_AI_STORAGE, JSON.stringify(cfg)); return true; }
  catch (e) { return false; }
}

function aiConfigReady() {
  const c = getAIConfig();
  return c.enabled && c.baseUrl && c.apiKey && c.model;
}

async function autoCallAI(prompt) {
  const cfg = getAIConfig();
  if (!cfg.enabled || !cfg.baseUrl || !cfg.apiKey || !cfg.model) {
    throw new Error('AI 未配置');
  }
  const url = cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
    }),
  });
  if (!res.ok) throw new Error('AI 接口返回 ' + res.status);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('AI 返回为空');
  return text;
}

// 从 AI 回复中抠出 JSON 数组（容忍 ```json 包裹与前后废话）
function autoParseAIJson(text) {
  if (!text) return null;
  let s = String(text).replace(/```json/gi, '```').trim();
  const fence = s.match(/```([\s\S]*?)```/);
  if (fence) s = fence[1];
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  try {
    const arr = JSON.parse(s.slice(start, end + 1));
    return Array.isArray(arr) ? arr : null;
  } catch (e) {
    return null;
  }
}

// ===== 选题生成 =====

function autoPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function autoShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 从 brief / 板块名 / 预设选题里抽出领域关键词
function autoKeywords(auto) {
  const words = [];
  (auto.brief || '').split(/[，,。;；、\s/|]+/).forEach(w => {
    const t = w.trim();
    if (t.length >= 2 && t.length <= 8 && !/^(的|了|和|与|或|很|要|是|在|有|做)$/.test(t)) words.push(t);
  });
  const sec = state.sections.find(s => s.id === auto.sectionId);
  if (sec) words.push(sec.name.replace(/学习|设计|课程/g, '').trim() || sec.name);
  auto.presetTopics.forEach(t => {
    (t.tags || []).forEach(g => { if (g && g.length <= 8) words.push(g); });
  });
  // 从预设选题标题里抓 2 字以上词块作为候选
  auto.presetTopics.forEach(t => {
    (t.title || '').split(/[，,。;；、\s:：]+/).forEach(w => {
      const x = w.trim();
      if (x.length >= 2 && x.length <= 6) words.push(x);
    });
  });
  // 参考文件：取出现频次最高的词块，让本地引擎也能贴合你上传的资料
  const refText = (auto.refFiles || []).filter(f => f.isText && f.text).map(f => f.text).join('\n').slice(0, 20000);
  if (refText) {
    const freq = {};
    refText.split(/[，,。;；、\s:：!？?!"“”()（）\[\]【】/|]+/).forEach(w => {
      const x = w.trim();
      if (x.length < 2 || x.length > 6) return;
      if (/^[\d%.％\-—_]+$/.test(x)) return;
      freq[x] = (freq[x] || 0) + 1;
    });
    Object.keys(freq)
      .filter(w => freq[w] >= 2)
      .sort((a, b) => freq[b] - freq[a])
      .slice(0, 20)
      .forEach(w => words.push(w));
  }
  const uniq = [...new Set(words.filter(Boolean))];
  return uniq.length ? uniq : ['这件事', '这个领域'];
}

function autoAudience(auto) {
  const m = (auto.brief || '').match(/([^\s，,。]{1,10}(?:新人|小白|新手|学生|家长|职场人|打工人|宝妈|老师|同行))/);
  if (m) return m[1];
  if (/职场|工作|打工/.test(auto.brief || '')) return '职场新人';
  if (/学生|考试|雅思|托福/.test(auto.brief || '')) return '备考的人';
  return '刚起步的人';
}

// 本地规则引擎：产出可直接使用的选题
function autoLocalTopics(auto, need) {
  const kws = autoKeywords(auto);
  const aud = autoAudience(auto);
  const used = new Set();
  auto.runs.forEach(r => (r.items || []).forEach(it => used.add(it.title)));
  const out = [];
  const formulas = autoShuffle(TOPIC_FORMULAS);
  let guard = 0;

  while (out.length < need && guard < 200) {
    guard++;
    const f = formulas[(out.length + guard) % formulas.length];
    const kw = autoPick(kws);
    let title, angleText;
    try {
      title = f.build(kw, aud);
      angleText = f.angle(kw, aud);
    } catch (e) {
      // 单个公式出错只跳过它，不影响整批产出
      continue;
    }
    if (!title) continue;
    const key = f.key + '|' + kw;
    if (used.has(title) || out.some(o => o.title === title)) continue;
    const frame = SCRIPT_FRAMES[out.length % SCRIPT_FRAMES.length];
    out.push({
      source: 'local',
      formula: f.name,
      title,
      angle: angleText || '',
      frame: frame.name,
      script: frame.beats.slice(),
      format: /短视频|口播|视频/.test(auto.brief || '') ? '口播短视频' : '图文 + 短口播',
      duration: autoPick(['1–2 分钟', '2–3 分钟', '3 分钟左右']),
      tags: [...new Set([kw, aud, f.name])].filter(Boolean),
      keyRef: key,
    });
  }
  return out;
}

// AI 生成：走用户自带 Key 的 OpenAI 兼容接口
async function autoAITopics(auto, need) {
  const sec = state.sections.find(s => s.id === auto.sectionId);
  const presetLines = auto.presetTopics.slice(0, 20).map(t => `- ${t.title}${t.angle ? '（角度：' + t.angle + '）' : ''}`).join('\n');
  const refContext = autoRefContextForAI(auto);
  const prompt = [
    '你是一个中文自媒体选题策划。请根据下面的账号定位产出自媒体选题。',
    '',
    '账号定位：' + (auto.brief || '（未填写，请按通用成长/学习类账号处理）'),
    sec ? '所属领域：' + sec.name : '',
    refContext,
    presetLines ? '我已想过的选题（请避开，不要重复）：\n' + presetLines : '',
    '',
    `请产出 ${need} 个全新选题，要求：`,
    '1. 标题具体、有信息量，不要空泛的口号；长度 15–30 字。',
    '2. 每个选题给出「切入角度」一句话，说明为什么这个角度能打动人。',
    '3. 给出 3–4 步文案结构，每步一行，具体可执行。',
    '4. 语言口语化，不要书面腔，不要 emoji。',
    refContext ? '5. 选题要能用上参考资料里的具体内容（术语、案例、数字），但不要直接复制原文句子。' : '',
    '',
    '严格只输出 JSON 数组，不要任何解释文字。格式：',
    '[{"title":"标题","angle":"切入角度","script":["步骤1","步骤2","步骤3"],"format":"形式","duration":"建议时长","tags":["标签1","标签2"]}]',
  ].filter(Boolean).join('\n');

  const text = await autoCallAI(prompt);
  const arr = autoParseAIJson(text);
  if (!arr) throw new Error('AI 返回不是合法 JSON');
  return arr.slice(0, need).map((it, i) => ({
    source: 'ai',
    formula: 'AI 生成',
    title: String(it.title || '').slice(0, 120) || ('AI 选题 ' + (i + 1)),
    angle: String(it.angle || '').slice(0, 300),
    frame: 'AI 建议结构',
    script: Array.isArray(it.script) ? it.script.map(s => String(s)).slice(0, 6) : [],
    format: String(it.format || '口播短视频'),
    duration: String(it.duration || '2–3 分钟'),
    tags: Array.isArray(it.tags) ? it.tags.map(t => String(t)).slice(0, 5) : [],
    keyRef: 'ai|' + i,
  }));
}

// 按比例混合：预设选题 + 生成选题
async function autoGenerateTopics(auto) {
  const need = auto.count;
  const items = [];
  const warnings = [];

  // 1) 先用用户预设选题里尚未用过的
  const usedTitles = new Set();
  auto.runs.forEach(r => (r.items || []).forEach(it => usedTitles.add(it.title)));
  const freshPresets = auto.presetTopics.filter(t => !usedTitles.has(t.title));
  const presetQuota = Math.round(need * 0.4);
  autoShuffle(freshPresets).slice(0, presetQuota).forEach(t => {
    const frame = SCRIPT_FRAMES[items.length % SCRIPT_FRAMES.length];
    items.push({
      source: 'preset',
      formula: '我的预设',
      title: t.title,
      angle: t.angle || '你自己写下的选题，按你的理解去讲就是最好的角度',
      frame: frame.name,
      script: frame.beats.slice(),
      format: /短视频|口播|视频/.test(auto.brief || '') ? '口播短视频' : '图文 + 短口播',
      duration: '2–3 分钟',
      tags: t.tags || [],
      keyRef: 'preset|' + t.id,
    });
  });

  // 2) 剩下用 AI（可用时）或本地规则引擎
  const rest = need - items.length;
  if (rest > 0) {
    if (aiConfigReady()) {
      try {
        const aiItems = await autoAITopics(auto, rest);
        items.push(...aiItems);
      } catch (e) {
        warnings.push('AI 生成失败（' + e.message + '），已改用本地选题引擎');
        items.push(...autoLocalTopics(auto, rest));
      }
    } else {
      items.push(...autoLocalTopics(auto, rest));
    }
  }

  // 3) 去重 + 截断
  const seen = new Set();
  const finalItems = [];
  items.forEach(it => {
    if (seen.has(it.title)) return;
    seen.add(it.title);
    finalItems.push(it);
  });
  return { items: finalItems.slice(0, need), warnings };
}

// ===== 运行调度 =====

function autoTodayKey() { return todayStr(); }

function autoIsDueToday(auto, now) {
  const d = now.getDay(); // 0=周日
  if (auto.repeat === 'daily') return true;
  if (auto.repeat === 'weekdays') return d >= 1 && d <= 5;
  if (auto.repeat === 'weekly') return auto.weekdays.includes(d);
  return true;
}

function autoDueReason(auto, now) {
  const today = autoTodayKey();
  if (!auto.enabled) return '已关闭';
  if (auto.lastRunDate === today) return '今日已完成';
  if (!autoIsDueToday(auto, now)) return '今日不触发';
  const [h, m] = auto.time.split(':').map(Number);
  const due = new Date(now); due.setHours(h, m, 0, 0);
  if (now < due) {
    const mins = Math.round((due - now) / 60000);
    return mins < 60 ? `${mins} 分钟后触发` : `今天 ${auto.time} 触发`;
  }
  return '待触发（已过点，将立即补发）';
}

// 定时检查：到点 + 补发
async function autoTick(manual = false) {
  initAutomation();
  if (autoTickBusy) return 0;
  const now = new Date();
  const due = state.automations.filter(a => {
    if (!a.enabled) return false;
    if (a.lastRunDate === autoTodayKey()) return false;
    if (!autoIsDueToday(a, now)) return false;
    const [h, m] = a.time.split(':').map(Number);
    const dueAt = new Date(now); dueAt.setHours(h, m, 0, 0);
    return now >= dueAt;
  });

  if (!due.length) {
    if (manual) showToast('当前没有到点的自动化', 'info');
    return 0;
  }

  autoTickBusy = true;
  try {
    for (const auto of due) {
      await autoRun(auto, true);
    }
  } finally {
    autoTickBusy = false;
  }

  saveData();
  if (state.currentView === 'automation') navigate('automation');
  else if (state.currentView === 'home') navigate('home');
  return due.length;
}

// 执行一次自动化
async function autoRun(auto, notify = true) {
  const now = new Date();
  const today = autoTodayKey();

  let items = [];
  let warnings = [];
  if (auto.kind === 'topic') {
    const r = await autoGenerateTopics(auto);
    items = r.items;
    warnings = r.warnings;
  } else {
    items = [];
  }

  // 参考文件：产出说明里带上文件名，提醒类任务也能知道该翻哪份资料
  const refNames = (auto.refFiles || []).map(f => f.name);
  const refNote = refNames.length ? `参考资料：${refNames.join('、')}` : '';

  const run = {
    id: 'run_' + Date.now(),
    date: today,
    ts: Date.now(),
    items,
    brief: [auto.brief, refNote].filter(Boolean).join(' · '),
    warnings,
  };
  auto.runs.push(run);
  if (auto.runs.length > AUTO_MAX_RUNS) auto.runs = auto.runs.slice(-AUTO_MAX_RUNS);
  auto.lastRunDate = today;

  // 可选：自动把选题变成任务（含拆解）
  if (auto.autoCreateTask && auto.sectionId && items.length) {
    const sec = state.sections.find(s => s.id === auto.sectionId);
    if (sec) {
      items.forEach(it => {
        sec.tasks.push({
          id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          title: it.title,
          date: today,
          startTime: '',
          endTime: '',
          time: '',
          priority: 'medium',
          completed: false,
          section: auto.sectionId,
          recurringDays: null,
          subtasks: (it.script || []).map((s, si) => ({
            id: 'st_' + Date.now() + '_' + si,
            title: s,
            done: false,
          })),
          fromAutomation: auto.id,
        });
      });
    }
  }

  // 推送
  if (notify) autoNotify(auto, run);
  autoSendNotification(auto, run);
  saveData();
  return run;
}

function autoNotify(auto, run) {
  const n = run.items.length;
  showToast(n ? `「${auto.name}」已就绪：${n} 个选题等你开录` : `「${auto.name}」提醒到了`, 'success');
}

// 浏览器通知（页面开着才有效，静态站点无法后台推送）
function autoSendNotification(auto, run) {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const body = run.items.length
      ? run.items.slice(0, 3).map((it, i) => `${i + 1}. ${it.title}`).join('\n')
      : (auto.brief || '该做这件事了');
    new Notification('蓝莓的工作台 · ' + auto.name, { body, tag: 'auto_' + auto.id });
  } catch (e) { /* 通知失败不影响主流程 */ }
}

function autoNotifyState() {
  try {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission; // granted | denied | default
  } catch (e) {
    return 'unsupported';
  }
}

async function autoRequestNotifyPermission() {
  if (!('Notification' in window)) {
    showToast('当前浏览器不支持系统通知', 'warning');
    return false;
  }
  if (Notification.permission === 'granted') {
    showToast('系统通知已开启', 'success');
    return true;
  }
  const p = await Notification.requestPermission();
  if (p === 'granted') {
    showToast('系统通知已开启', 'success');
    return true;
  }
  showToast('未获得通知权限，仍会在页面内提示', 'info');
  return false;
}

// ===== 任务拆解 =====

function autoSuggestSubtasks(taskTitle) {
  const t = (taskTitle || '').toLowerCase();
  let best = null, bestHit = 0;
  BREAKDOWN_TEMPLATES.forEach(tpl => {
    const hit = tpl.keys.filter(k => t.includes(k.toLowerCase())).length;
    if (hit > bestHit) { bestHit = hit; best = tpl; }
  });
  const tpl = best && bestHit > 0 ? best : BREAKDOWN_FALLBACK;
  return { templateName: tpl.name, steps: tpl.steps.slice() };
}

function taskSubProgress(task) {
  const subs = task.subtasks || [];
  if (!subs.length) return null;
  const done = subs.filter(s => s.done).length;
  return { done, total: subs.length, pct: Math.round((done / subs.length) * 100) };
}

// ===== 渲染 =====

function autoSectionName(id) {
  const sec = state.sections.find(s => s.id === id);
  return sec ? sec.name : '未指定板块';
}

function autoFormatTs(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 首页卡片：今天有产出就展示最新一条
function autoHomeCardHTML() {
  initAutomation();
  const today = autoTodayKey();
  const todayRuns = [];
  state.automations.forEach(a => {
    (a.runs || []).forEach(r => {
      if (r.date === today) todayRuns.push({ auto: a, run: r });
    });
  });
  todayRuns.sort((x, y) => y.run.ts - x.run.ts);

  const pending = state.automations.filter(a => a.enabled && a.lastRunDate !== today &&
    autoIsDueToday(a, new Date())).length;

  // 没有任何自动化时也要显示引导卡片（否则新功能藏得太深，用户发现不了）；
  // 已配置自动化但今天既无产出、也无待运行的，则不占首页版面。
  if (state.automations.length && !todayRuns.length && !pending) return '';

  let html = `<div class="card auto-home">
    <div class="auto-home-head">
      <div>
        <div class="auto-home-title">${ICONS.sparkle} 自动化</div>
        <div class="auto-home-sub">${todayRuns.length ? `今天已产出 ${todayRuns.length} 次` : '今天还没有产出'}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="navigate('automation')">管理自动化</button>
    </div>`;

  if (!state.automations.length) {
    html += `<div class="auto-home-empty">
      还没有自动化。可以让工作台在固定时间自动给你推送选题或提醒你该做什么。
      <div style="margin-top:12px;"><button class="btn btn-primary btn-sm" onclick="navigate('automation')">去创建第一个</button></div>
    </div>`;
  } else {
    const latest = todayRuns[0];
    if (latest) {
      html += `<div class="auto-run-card">
        <div class="auto-run-head">
          <span class="auto-run-name">${escapeHtml(latest.auto.name)}</span>
          <span class="auto-run-time">${autoFormatTs(latest.run.ts)}</span>
        </div>`;
      if (latest.run.items.length) {
        html += `<div class="auto-run-items">`;
        latest.run.items.slice(0, 3).forEach((it, i) => {
          html += `<div class="auto-item">
            <div class="auto-item-no">${i + 1}</div>
            <div class="auto-item-main">
              <div class="auto-item-title">${escapeHtml(it.title)}</div>
              <div class="auto-item-meta">${escapeHtml(it.formula || '')}${it.duration ? ' · ' + escapeHtml(it.duration) : ''}</div>
            </div>
          </div>`;
        });
        html += `</div>`;
        html += `<div class="auto-run-actions">
          <button class="btn btn-primary btn-sm" onclick="navigate('automation')">查看完整文案建议</button>
        </div>`;
      } else {
        html += `<div class="auto-run-note">${escapeHtml(latest.run.brief || '该做这件事了')}</div>`;
      }
      html += `</div>`;
    } else if (pending) {
      const next = state.automations.filter(a => a.enabled && a.lastRunDate !== today)[0];
      html += `<div class="auto-home-empty">${next ? `「${escapeHtml(next.name)}」${autoDueReason(next, new Date())}` : ''}</div>`;
    }
  }
  html += `</div>`;
  return html;
}

// 单条选题卡片
function autoItemHTML(it, autoId, runId, idx) {
  const srcLabel = { preset: '我的预设', ai: 'AI 生成', local: '智能生成' }[it.source] || '生成';
  return `<div class="auto-topic">
    <div class="auto-topic-head">
      <span class="auto-topic-badge auto-badge-${it.source}">${srcLabel}</span>
      <span class="auto-topic-formula">${escapeHtml(it.formula || '')}</span>
    </div>
    <div class="auto-topic-title">${escapeHtml(it.title)}</div>
    ${it.angle ? `<div class="auto-topic-angle"><b>切入角度：</b>${escapeHtml(it.angle)}</div>` : ''}
    ${(it.script && it.script.length) ? `<div class="auto-topic-script">
      <div class="auto-topic-label">文案结构建议 · ${escapeHtml(it.frame || '')}</div>
      <ol>${it.script.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
    </div>` : ''}
    <div class="auto-topic-foot">
      <div class="auto-topic-tags">
        ${it.format ? `<span class="auto-tag">${escapeHtml(it.format)}</span>` : ''}
        ${it.duration ? `<span class="auto-tag">${escapeHtml(it.duration)}</span>` : ''}
        ${(it.tags || []).slice(0, 3).map(t => `<span class="auto-tag">${escapeHtml(t)}</span>`).join('')}
      </div>
      <div class="auto-topic-actions">
        <button class="btn btn-outline btn-sm" onclick="autoCopyTopic('${autoId}','${runId}',${idx},this)">复制文案</button>
        <button class="btn btn-primary btn-sm" onclick="autoTopicToTask('${autoId}','${runId}',${idx})">转成任务</button>
      </div>
    </div>
  </div>`;
}

function renderAutomationPage() {
  initAutomation();
  const now = new Date();
  const aiReady = aiConfigReady();
  const cfg = getAIConfig();

  let html = `<div class="card">
    <div class="auto-page-head">
      <div>
        <div class="auto-page-title">自动化</div>
        <div class="auto-page-sub">让工作台在固定时间自动给你产出选题、或提醒你该做什么；大任务可以一键拆成小步骤。</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openAutoModal()">${ICONS.plus} 新建自动化</button>
    </div>

    <div class="auto-honest">
      <b>关于"自动推送"的说明：</b>这是个纯网页工具，没有服务器，所以<b>网页关掉时无法主动推送</b>。
      实际行为是：网页开着时到点自动触发；如果到点时网页没开，下次打开会<b>立刻补发</b>，不会漏掉。
      想要更接近"手机推送"的体验，可以开启下面的系统通知，并把这个网页固定成浏览器常驻标签页或添加到桌面。
    </div>

    <div class="auto-toolbar">
      <button class="btn ${autoNotifyState() === 'granted' ? 'btn-outline' : 'btn-primary'} btn-sm" onclick="autoRequestNotifyPermission()">
        ${autoNotifyState() === 'granted' ? '系统通知已开启' : (autoNotifyState() === 'unsupported' ? '浏览器不支持系统通知' : '开启系统通知')}
      </button>
      <button class="btn btn-outline btn-sm" onclick="autoTick(true).catch(function(){})">立即检查一次</button>
      <span class="auto-toolbar-hint">${state.automations.length} 个自动化 · ${state.automations.filter(a => a.enabled).length} 个已启用</span>
    </div>
  </div>`;

  // 快速创建模板
  if (!state.automations.length) {
    html += `<div class="card">
      <div class="auto-block-title">从模板快速创建</div>
      <div class="auto-preset-grid">
        ${AUTO_PRESETS.map(p => `<div class="auto-preset" onclick="autoCreateFromPreset('${p.key}')">
          <div class="auto-preset-name">${escapeHtml(p.name)}</div>
          <div class="auto-preset-meta">${AUTO_KINDS[p.kind].name} · ${AUTO_REPEATS[p.repeat].name} ${p.time}</div>
          <div class="auto-preset-desc">${escapeHtml(p.brief)}</div>
        </div>`).join('')}
      </div>
    </div>`;
  }

  // 自动化列表
  state.automations.forEach(auto => {
    const sec = state.sections.find(s => s.id === auto.sectionId);
    const lastRun = auto.runs[auto.runs.length - 1];
    html += `<div class="card auto-card ${auto.enabled ? '' : 'auto-card-off'}">
      <div class="auto-card-head">
        <div class="auto-card-title-wrap">
          <div class="auto-card-name">${escapeHtml(auto.name)}</div>
          <div class="auto-card-meta">
            <span class="auto-chip">${AUTO_KINDS[auto.kind].name}</span>
            <span class="auto-chip">${AUTO_REPEATS[auto.repeat].name}${auto.repeat === 'weekly' ? ' ' + formatWeekdays(auto.weekdays) : ''}</span>
            <span class="auto-chip">${auto.time}</span>
            ${sec ? `<span class="auto-chip">${escapeHtml(sec.name)}</span>` : ''}
          </div>
        </div>
        <div class="auto-card-ops">
          <span class="auto-status ${auto.enabled ? 'on' : 'off'}">${autoDueReason(auto, now)}</span>
          <label class="auto-switch">
            <input type="checkbox" ${auto.enabled ? 'checked' : ''} onchange="autoToggle('${auto.id}')">
            <span></span>
          </label>
          <button class="btn btn-outline btn-sm" onclick="openAutoModal('${auto.id}')">编辑</button>
          <button class="btn btn-outline btn-sm" onclick="autoRunNow('${auto.id}')">立即运行</button>
          <button class="btn btn-danger btn-sm" onclick="autoDelete('${auto.id}')">删除</button>
        </div>
      </div>
      ${auto.brief ? `<div class="auto-card-brief">${escapeHtml(auto.brief)}</div>` : ''}
      ${auto.kind === 'topic' ? `<div class="auto-card-line">每次产出 ${auto.count} 个选题 · 预设选题库 ${auto.presetTopics.length} 条 · 生成引擎：${aiReady ? 'AI（' + escapeHtml(cfg.model) + '）+ 本地引擎' : '本地选题引擎（未配置 AI）'}</div>` : ''}
      ${auto.autoCreateTask ? `<div class="auto-card-line">运行时自动把产出转成任务（含拆解）</div>` : ''}
      ${(auto.refFiles || []).length ? `<div class="auto-card-line">参考文件 ${auto.refFiles.length} 个：${auto.refFiles.map(f => escapeHtml(f.name) + (f.isText ? '' : '（未读取内容）')).join('、')}</div>` : ''}

      ${lastRun ? `<div class="auto-lastrun">
        <div class="auto-lastrun-head" onclick="autoToggleHistory('${auto.id}')">
          <span>最近一次产出 · ${autoFormatTs(lastRun.ts)}</span>
          <span class="auto-lastrun-toggle">展开 / 收起</span>
        </div>
        <div class="auto-history" id="autoHist_${auto.id}" style="display:none;">
          ${lastRun.warnings && lastRun.warnings.length ? lastRun.warnings.map(w => `<div class="auto-warn">${escapeHtml(w)}</div>`).join('') : ''}
          ${lastRun.items.length
            ? lastRun.items.map((it, i) => autoItemHTML(it, auto.id, lastRun.id, i)).join('')
            : `<div class="auto-run-note">${escapeHtml(lastRun.brief || '提醒')}</div>`}
        </div>
      </div>` : `<div class="auto-card-line auto-dim">还没有运行过</div>`}
    </div>`;
  });

  // 历史产出（全部）
  const allRuns = [];
  state.automations.forEach(a => (a.runs || []).forEach(r => allRuns.push({ auto: a, run: r })));
  allRuns.sort((x, y) => y.run.ts - x.run.ts);

  html += `<div class="card">
    <div class="auto-block-title">历史产出（最近 ${Math.min(allRuns.length, 20)} 条）</div>
    ${allRuns.length ? allRuns.slice(0, 20).map(({ auto, run }) => `
      <div class="auto-hist-row">
        <div class="auto-hist-main">
          <div class="auto-hist-name">${escapeHtml(auto.name)}</div>
          <div class="auto-hist-items">${run.items.length ? escapeHtml(run.items.map(i => i.title).join(' / ')).slice(0, 120) : escapeHtml(run.brief || '提醒')}</div>
        </div>
        <div class="auto-hist-time">${autoFormatTs(run.ts)}</div>
      </div>`).join('') : '<div class="auto-dim">还没有历史产出</div>'}
  </div>`;

  // AI 设置
  html += `<div class="card">
    <div class="auto-block-title">AI 生成设置（可选）</div>
    <div class="auto-honest">
      不填也能用：默认走内置选题引擎，按你的领域和受众自动组合出选题与文案结构。
      想让选题更贴合你的风格，可以填入任意 <b>OpenAI 兼容接口</b>的地址、Key 和模型名（例如 DeepSeek、通义、Kimi、OpenAI 等）。
      <b>Key 只保存在这台设备的浏览器里，不会进入备份文件，也不会同步到云端。</b>
    </div>
    <div class="auto-ai-form">
      <label class="auto-ai-row">
        <span>启用 AI 生成</span>
        <input type="checkbox" id="aiEnabled" ${cfg.enabled ? 'checked' : ''}>
      </label>
      <div class="form-row">
        <div class="form-group">
          <label class="label">接口地址（Base URL）</label>
          <input class="input" id="aiBaseUrl" placeholder="https://api.deepseek.com/v1" value="${escapeHtml(cfg.baseUrl)}">
        </div>
        <div class="form-group">
          <label class="label">模型名</label>
          <input class="input" id="aiModel" placeholder="deepseek-chat" value="${escapeHtml(cfg.model)}">
        </div>
      </div>
      <div class="form-group">
        <label class="label">API Key</label>
        <input class="input" id="aiApiKey" type="password" placeholder="sk-..." value="${escapeHtml(cfg.apiKey)}">
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <button class="btn btn-primary btn-sm" onclick="autoSaveAIConfig()">保存 AI 设置</button>
        <button class="btn btn-outline btn-sm" onclick="autoTestAI()">测试连接</button>
        <span class="auto-dim" id="aiTestResult">${aiReady ? '已配置' : '未配置，使用本地引擎'}</span>
      </div>
    </div>
  </div>`;

  return html;
}

// ===== 交互 =====

function autoToggleHistory(autoId) {
  const el = document.getElementById('autoHist_' + autoId);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function autoToggle(autoId) {
  const auto = state.automations.find(a => a.id === autoId);
  if (!auto) return;
  auto.enabled = !auto.enabled;
  saveData();
  navigate('automation');
  showToast(auto.enabled ? '已启用' : '已关闭', auto.enabled ? 'success' : 'info');
}

async function autoRunNow(autoId) {
  const auto = state.automations.find(a => a.id === autoId);
  if (!auto) return;
  showToast('正在生成…', 'info');
  try {
    await autoRun(auto, true);
    navigate('automation');
    const last = auto.runs[auto.runs.length - 1];
    if (last) {
      setTimeout(() => autoToggleHistory(auto.id), 100);
    }
  } catch (e) {
    showToast('运行失败：' + e.message, 'error');
  }
}

function autoDelete(autoId) {
  const auto = state.automations.find(a => a.id === autoId);
  if (!auto) return;
  if (!confirm(`确定删除自动化「${auto.name}」？\n已生成的历史产出会一并删除，但已转成任务的内容不受影响。`)) return;
  state.automations = state.automations.filter(a => a.id !== autoId);
  saveData();
  navigate('automation');
  showToast('已删除', 'success');
}

function autoCreateFromPreset(key) {
  const p = AUTO_PRESETS.find(x => x.key === key);
  if (!p) return;
  const auto = ensureAutosShape([{
    ...p,
    id: 'auto_' + Date.now(),
    sectionId: state.sections[0]?.id || '',
    enabled: true,
  }])[0];
  state.automations.push(auto);
  saveData();
  navigate('automation');
  showToast('已创建，点「编辑」可以调整细节', 'success');
  setTimeout(() => openAutoModal(auto.id), 300);
}

function openAutoModal(autoId) {
  const editing = autoId ? state.automations.find(a => a.id === autoId) : null;
  const a = editing || {
    name: '', sectionId: state.sections[0]?.id || '', kind: 'topic',
    time: '19:00', repeat: 'daily', weekdays: [1, 2, 3, 4, 5],
    count: 3, presetTopics: [], brief: '', autoCreateTask: false,
  };
  const presetText = (a.presetTopics || []).map(t =>
    [t.title, t.angle, (t.tags || []).join(',')].filter(Boolean).join(' | ')
  ).join('\n');
  // 参考文件走草稿：保存才写回，取消则丢弃
  autoDraftRefs = (a.refFiles || []).map(f => Object.assign({}, f));

  openModal({
    title: editing ? '编辑自动化' : '新建自动化',
    sub: '设定触发时间与产出内容，到点自动执行',
    body: `
      <div class="form-group">
        <label class="label">名称</label>
        <input class="input" id="autoName" placeholder="如：自媒体选题推送" value="${escapeHtml(a.name)}">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="label">类型</label>
          <select class="select" id="autoKind" onchange="autoKindChanged()">
            <option value="topic" ${a.kind === 'topic' ? 'selected' : ''}>选题推送（自动产出选题与文案）</option>
            <option value="reminder" ${a.kind === 'reminder' ? 'selected' : ''}>内容提醒（只提醒）</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">归属板块</label>
          <select class="select" id="autoSection">
            <option value="">不指定</option>
            ${state.sections.map(s => `<option value="${s.id}" ${a.sectionId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="label">触发时间</label>
          <input type="time" class="input" id="autoTime" value="${a.time}">
        </div>
        <div class="form-group">
          <label class="label">重复</label>
          <select class="select" id="autoRepeat" onchange="autoRepeatChanged()">
            <option value="daily" ${a.repeat === 'daily' ? 'selected' : ''}>每天</option>
            <option value="weekdays" ${a.repeat === 'weekdays' ? 'selected' : ''}>工作日（周一至周五）</option>
            <option value="weekly" ${a.repeat === 'weekly' ? 'selected' : ''}>每周指定几天</option>
          </select>
        </div>
      </div>

      <div class="form-group" id="autoWeekdayGroup" style="display:${a.repeat === 'weekly' ? '' : 'none'};">
        <label class="label">每周哪几天</label>
        <div class="weekday-picker" id="autoWeekdayPicker">
          ${['日', '一', '二', '三', '四', '五', '六'].map((d, i) => `
            <label class="weekday-chip ${a.weekdays.includes(i) ? 'selected' : ''}" data-day="${i}">
              <input type="checkbox" value="${i}" ${a.weekdays.includes(i) ? 'checked' : ''} style="display:none;">
              <span>${d}</span>
            </label>`).join('')}
        </div>
      </div>

      <div class="form-group">
        <label class="label">这个任务/领域是做什么的（AI 与选题引擎都会参考它）</label>
        <textarea class="input" id="autoBrief" rows="3" placeholder="如：职场新人向的口播短视频，单条 1–3 分钟，讲具体可操作的步骤">${escapeHtml(a.brief)}</textarea>
      </div>

      <div class="form-group">
        <label class="label">参考文件（可选，生成时会先读它）</label>
        <div class="auto-ref-box">
          <div class="auto-ref-list" id="autoRefList">${autoRefListHTML()}</div>
          <div class="auto-ref-actions">
            <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('autoRefInput').click()">${ICONS.plus} 选择文件</button>
            <span class="auto-ref-count" id="autoRefCount"></span>
          </div>
          <div class="auto-ref-hint">
            文本类文件（txt / md / csv / json / srt 等）会把内容读进来，AI 生成选题时先读它；
            Word、PDF、图片等二进制文件只能记录文件名，内容读不到——想让它们也参与，先转成 txt 或 md 再传。
            单个 ≤ 150KB，最多 5 个，文件内容会随工作台数据一起保存和备份。
          </div>
          <input type="file" id="autoRefInput" multiple style="display:none;" onchange="autoHandleRefFiles(this)">
        </div>
      </div>

      <div id="autoTopicFields" style="display:${a.kind === 'topic' ? '' : 'none'};">
        <div class="form-group">
          <label class="label">每次产出几个选题</label>
          <input type="number" class="input" id="autoCount" min="1" max="8" value="${a.count}">
        </div>
        <div class="form-group">
          <label class="label">我的预设选题库（每行一条，格式：标题 | 切入角度 | 标签,标签）</label>
          <textarea class="input" id="autoPresets" rows="6" placeholder="为什么你的日更总是坚持不过一周 | 从精力管理而不是意志力切入 | 自媒体,习惯&#10;3 个让剪辑提速一倍的习惯 | 用具体操作替代泛泛而谈 | 自媒体,效率">${escapeHtml(presetText)}</textarea>
          <div style="font-size:12px;color:var(--ink-lighter);margin-top:6px;">
            这些是你自己想讲的题，会优先出现；名额不够的部分由 AI 或内置引擎补足，并自动避开已用过的标题。
          </div>
        </div>
      </div>

      <label class="auto-check-line">
        <input type="checkbox" id="autoCreateTask" ${a.autoCreateTask ? 'checked' : ''}>
        <span>运行时自动把产出转成任务（含拆解步骤），不用手动添加</span>
      </label>
    `,
    footer: `
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="autoSave('${editing ? a.id : ''}')">${editing ? '保存' : '创建'}</button>
    `,
  });

  // 星期选择器绑定
  const picker = document.getElementById('autoWeekdayPicker');
  if (picker) {
    picker.querySelectorAll('.weekday-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const cb = chip.querySelector('input');
        cb.checked = !cb.checked;
        chip.classList.toggle('selected', cb.checked);
      });
    });
  }
  autoRefreshRefList();
}

function autoKindChanged() {
  const kind = document.getElementById('autoKind').value;
  const el = document.getElementById('autoTopicFields');
  if (el) el.style.display = kind === 'topic' ? '' : 'none';
}

function autoRepeatChanged() {
  const r = document.getElementById('autoRepeat').value;
  const el = document.getElementById('autoWeekdayGroup');
  if (el) el.style.display = r === 'weekly' ? '' : 'none';
}

function autoParsePresets(text) {
  return String(text || '').split('\n').map(line => {
    const t = line.trim();
    if (!t) return null;
    const parts = t.split('|').map(x => x.trim());
    const tags = (parts[2] || '').split(/[,，、\s]+/).map(x => x.trim()).filter(Boolean);
    return {
      id: 'pt_' + Math.random().toString(36).slice(2, 9),
      title: parts[0].slice(0, 120),
      angle: (parts[1] || '').slice(0, 300),
      tags,
    };
  }).filter(Boolean);
}

function autoSave(autoId) {
  const name = document.getElementById('autoName').value.trim();
  if (!name) { showToast('请填写名称', 'warning'); return; }
  const time = document.getElementById('autoTime').value || '19:00';
  const kind = document.getElementById('autoKind').value;
  const repeat = document.getElementById('autoRepeat').value;
  let weekdays = [];
  if (repeat === 'weekly') {
    weekdays = Array.from(document.querySelectorAll('#autoWeekdayPicker .weekday-chip input:checked'))
      .map(cb => parseInt(cb.value));
    if (!weekdays.length) { showToast('请至少选择一天', 'warning'); return; }
  }
  const patch = {
    name,
    kind,
    sectionId: document.getElementById('autoSection').value,
    time,
    repeat,
    weekdays: weekdays.length ? weekdays : [1, 2, 3, 4, 5],
    brief: document.getElementById('autoBrief').value.trim(),
    count: parseInt(document.getElementById('autoCount')?.value) || 3,
    presetTopics: autoParsePresets(document.getElementById('autoPresets')?.value),
    autoCreateTask: document.getElementById('autoCreateTask').checked,
    refFiles: autoDraftRefs.map(f => Object.assign({}, f)),
  };

  initAutomation();
  if (autoId) {
    const idx = state.automations.findIndex(a => a.id === autoId);
    if (idx < 0) { showToast('找不到该自动化', 'error'); return; }
    state.automations[idx] = ensureAutosShape([{ ...state.automations[idx], ...patch }])[0];
  } else {
    state.automations.push(ensureAutosShape([{
      ...patch, id: 'auto_' + Date.now(), enabled: true, lastRunDate: '', runs: [],
    }])[0]);
  }
  saveData();
  closeModal();
  navigate('automation');
  showToast(autoId ? '已保存' : '已创建', 'success');
}

function autoSaveAIConfig() {
  const cfg = {
    enabled: document.getElementById('aiEnabled').checked,
    baseUrl: document.getElementById('aiBaseUrl').value.trim(),
    model: document.getElementById('aiModel').value.trim(),
    apiKey: document.getElementById('aiApiKey').value.trim(),
  };
  if (cfg.enabled && (!cfg.baseUrl || !cfg.apiKey || !cfg.model)) {
    showToast('启用 AI 需要同时填写接口地址、模型名和 Key', 'warning');
    return;
  }
  setAIConfig(cfg);
  navigate('automation');
  showToast(cfg.enabled ? 'AI 设置已保存（仅存本机）' : '已改为使用本地引擎', 'success');
}

async function autoTestAI() {
  const el = document.getElementById('aiTestResult');
  // 先临时保存，避免用户填了没保存就测试
  const cfg = {
    enabled: document.getElementById('aiEnabled').checked,
    baseUrl: document.getElementById('aiBaseUrl').value.trim(),
    model: document.getElementById('aiModel').value.trim(),
    apiKey: document.getElementById('aiApiKey').value.trim(),
  };
  if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) {
    if (el) el.textContent = '请先填写接口地址、模型名和 Key';
    return;
  }
  const prev = getAIConfig();
  setAIConfig({ ...cfg, enabled: true });
  if (el) el.textContent = '测试中…';
  try {
    const text = await autoCallAI('只回复两个字：可用');
    if (el) el.textContent = '连接成功：' + String(text).trim().slice(0, 20);
  } catch (e) {
    if (el) el.textContent = '连接失败：' + e.message;
    setAIConfig(prev);
  }
}

// 复制选题文案
function autoCopyTopic(autoId, runId, idx, btn) {
  const auto = state.automations.find(a => a.id === autoId);
  const run = auto?.runs.find(r => r.id === runId);
  const it = run?.items[idx];
  if (!it) return;
  const lines = [
    it.title,
    '',
    '【切入角度】' + (it.angle || ''),
    '',
    '【文案结构】',
    ...(it.script || []).map((s, i) => `${i + 1}. ${s}`),
    '',
    `【形式】${it.format || ''}　【时长】${it.duration || ''}`,
    (it.tags || []).length ? '【标签】' + it.tags.join(' ') : '',
  ].filter(x => x !== undefined);
  const text = lines.join('\n');

  const done = () => {
    if (btn) { btn.textContent = '已复制'; setTimeout(() => { btn.textContent = '复制文案'; }, 1500); }
    showToast('文案已复制到剪贴板', 'success');
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => autoCopyFallback(text, done));
  } else {
    autoCopyFallback(text, done);
  }
}

function autoCopyFallback(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    done();
  } catch (e) {
    showToast('复制失败，请手动选择文本', 'error');
  }
}

// 把选题转成任务（自动带上拆解步骤）
function autoTopicToTask(autoId, runId, idx) {
  const auto = state.automations.find(a => a.id === autoId);
  const run = auto?.runs.find(r => r.id === runId);
  const it = run?.items[idx];
  if (!it) return;
  const sectionId = auto.sectionId || state.sections[0]?.id;
  const sec = state.sections.find(s => s.id === sectionId);
  if (!sec) { showToast('请先给这个自动化指定归属板块', 'warning'); return; }

  const exists = (sec.tasks || []).some(t => t.title === it.title);
  if (exists) { showToast('这个选题已经在任务里了', 'info'); return; }

  sec.tasks.push({
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    title: it.title,
    date: todayStr(),
    startTime: '', endTime: '', time: '',
    priority: 'medium',
    completed: false,
    section: sectionId,
    recurringDays: null,
    subtasks: (it.script || []).map((s, i) => ({
      id: 'st_' + Date.now() + '_' + i, title: s, done: false,
    })),
    fromAutomation: auto.id,
  });
  saveData();
  showToast(`已加入「${sec.name}」，并拆成 ${(it.script || []).length} 个小步骤`, 'success');
}

// ===== 任务拆解 UI =====

function openBreakdownModal(sectionId, taskId) {
  const sec = state.sections.find(s => s.id === sectionId);
  const task = sec?.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (!Array.isArray(task.subtasks)) task.subtasks = [];

  const suggest = autoSuggestSubtasks(task.title);

  openModal({
    title: '拆解任务',
    sub: escapeHtml(task.title).slice(0, 60),
    body: `
      <div class="bd-hint">
        把大任务拆成小步骤，每一步都能单独勾掉。完成度会显示在任务卡片上，启动阻力会小很多。
      </div>

      <div class="bd-suggest">
        <div class="bd-suggest-head">
          <span>智能建议 · ${escapeHtml(suggest.templateName)}</span>
          <button class="btn btn-outline btn-sm" onclick="bdApplySuggest('${sectionId}','${taskId}',${JSON.stringify(suggest.steps).replace(/"/g, '&quot;')})">全部加入</button>
        </div>
        <ol class="bd-suggest-list">
          ${suggest.steps.map((s, i) => `<li>
            <span>${escapeHtml(s)}</span>
            <button class="rw-icon-btn" title="只加这一条" onclick="bdAddStep('${sectionId}','${taskId}',${JSON.stringify(s).replace(/"/g, '&quot;')})">+</button>
          </li>`).join('')}
        </ol>
      </div>

      <div class="form-group">
        <label class="label">已拆出的步骤（${task.subtasks.length} 条）</label>
        <div class="bd-list" id="bdList">
          ${task.subtasks.length ? task.subtasks.map((s, i) => `
            <div class="bd-item ${s.done ? 'done' : ''}">
              <div class="bd-check ${s.done ? 'checked' : ''}" onclick="bdToggle('${sectionId}','${taskId}','${s.id}')">${s.done ? ICONS.check : ''}</div>
              <div class="bd-item-title">${escapeHtml(s.title)}</div>
              <button class="rw-icon-btn" onclick="bdRemove('${sectionId}','${taskId}','${s.id}')">✕</button>
            </div>`).join('') : '<div class="bd-empty">还没有步骤，可从上面的建议加入，或自己写一条</div>'}
        </div>
      </div>

      <div class="bd-add">
        <input class="input" id="bdNewStep" placeholder="自己写一条小步骤，回车添加">
        <button class="btn btn-primary btn-sm" onclick="bdAddManual('${sectionId}','${taskId}')">添加</button>
      </div>
    `,
    footer: `<button class="btn btn-primary" onclick="closeModal()">完成</button>`,
  });

  setTimeout(() => {
    const inp = document.getElementById('bdNewStep');
    if (inp) {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); bdAddManual(sectionId, taskId); }
      });
      inp.focus();
    }
  }, 60);
}

function bdFind(sectionId, taskId) {
  const sec = state.sections.find(s => s.id === sectionId);
  return sec?.tasks.find(t => t.id === taskId);
}

function bdAddStep(sectionId, taskId, title) {
  const task = bdFind(sectionId, taskId);
  if (!task) return;
  if (!Array.isArray(task.subtasks)) task.subtasks = [];
  if (task.subtasks.some(s => s.title === title)) { showToast('这一步已经在列表里了', 'info'); return; }
  task.subtasks.push({ id: 'st_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), title, done: false });
  saveData();
  openBreakdownModal(sectionId, taskId);
}

function bdApplySuggest(sectionId, taskId, steps) {
  const task = bdFind(sectionId, taskId);
  if (!task) return;
  if (!Array.isArray(task.subtasks)) task.subtasks = [];
  let added = 0;
  steps.forEach(s => {
    if (!task.subtasks.some(x => x.title === s)) {
      task.subtasks.push({ id: 'st_' + Date.now() + '_' + added + '_' + Math.random().toString(36).slice(2, 5), title: s, done: false });
      added++;
    }
  });
  saveData();
  openBreakdownModal(sectionId, taskId);
  showToast(added ? `已加入 ${added} 个步骤` : '这些步骤都已经在列表里了', added ? 'success' : 'info');
}

function bdAddManual(sectionId, taskId) {
  const inp = document.getElementById('bdNewStep');
  const title = (inp?.value || '').trim();
  if (!title) return;
  bdAddStep(sectionId, taskId, title);
}

function bdToggle(sectionId, taskId, subId) {
  const task = bdFind(sectionId, taskId);
  if (!task) return;
  const sub = (task.subtasks || []).find(s => s.id === subId);
  if (!sub) return;
  sub.done = !sub.done;
  const p = taskSubProgress(task);
  saveData();
  openBreakdownModal(sectionId, taskId);
  if (p && p.done === p.total) {
    showToast('所有小步骤都完成了，可以勾掉整个任务了', 'success');
  }
}

function bdRemove(sectionId, taskId, subId) {
  const task = bdFind(sectionId, taskId);
  if (!task) return;
  task.subtasks = (task.subtasks || []).filter(s => s.id !== subId);
  saveData();
  openBreakdownModal(sectionId, taskId);
}

// 任务卡片上的子步骤进度条
function bdProgressChip(task) {
  const p = taskSubProgress(task);
  if (!p) return '';
  return `<span class="bd-chip">子项 ${p.done}/${p.total}</span>`;
}

// 启动
let autoTimer = null;
let autoTickBusy = false;

function startAutomationTimer() {
  if (autoTimer) clearInterval(autoTimer);
  // 首次补发（打开网页时把错过的补上）
  setTimeout(() => { autoTick(false).catch(e => console.warn('自动化检查失败', e)); }, 1500);
  autoTimer = setInterval(() => {
    autoTick(false).catch(e => console.warn('自动化检查失败', e));
  }, AUTO_TICK_MS);
}

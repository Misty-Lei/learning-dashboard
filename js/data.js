/* ============================================
 * 初始数据 · 学习工作台
 * ============================================ */

const SECTION_COLORS = {
  teal:   { color: '#38b2bf', bg: 'rgba(56,178,191,0.12)' },
  gold:   { color: '#f5a623', bg: 'rgba(245,166,35,0.12)' },
  rose:   { color: '#f64f7b', bg: 'rgba(246,79,123,0.12)' },
  plum:   { color: '#9b87c1', bg: 'rgba(155,135,193,0.12)' },
  sage:   { color: '#5fb89a', bg: 'rgba(95,184,154,0.12)' },
  amber:  { color: '#ff8c61', bg: 'rgba(255,140,97,0.12)' },
};

const ICONS = {
  home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12l9-9 9 9M5 10v10h14V10" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  english: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" stroke-linecap="round"/></svg>',
  ai: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><circle cx="15" cy="9" r="1.5" fill="currentColor"/><path d="M8.5 15h7" stroke-linecap="round"/></svg>',
  design: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 19l7-7 3 3-7 7-3-3z" stroke-linejoin="round"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" stroke-linejoin="round"/><path d="M2 2l7.586 7.586" stroke-linecap="round"/><circle cx="11" cy="11" r="2"/></svg>',
  other: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6z" stroke-linejoin="round"/></svg>',
  goal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
  inspiration: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0012 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  book: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 5a2 2 0 012-2h12v18H6a2 2 0 01-2-2V5z" stroke-linejoin="round"/><path d="M4 5v14a2 2 0 012-2h12" /></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  checkEmpty: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/></svg>',
  link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  file: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-linejoin="round"/><path d="M14 2v6h6M8 13h8M8 17h5" stroke-linecap="round"/></svg>',
  pdf: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-linejoin="round"/><path d="M14 2v6h6" stroke-linecap="round" stroke-linejoin="round"/><text x="8.5" y="18" font-size="6" fill="currentColor" stroke="none" font-family="sans-serif" font-weight="bold">PDF</text></svg>',
  excel: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-linejoin="round"/><path d="M14 2v6h6" stroke-linecap="round" stroke-linejoin="round"/><text x="7" y="18" font-size="5.5" fill="currentColor" stroke="none" font-family="sans-serif" font-weight="bold">XLS</text></svg>',
  image: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15l-5-5L5 21" stroke-linejoin="round"/></svg>',
  doc: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-linejoin="round"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h4" stroke-linecap="round"/></svg>',
  calendar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4" stroke-linecap="round"/></svg>',
  clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round"/></svg>',
  plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>',
  trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4v16h16v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  target: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
  trophy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" stroke-linejoin="round"/><path d="M17 5h3v3a3 3 0 01-3 3M7 5H4v3a3 3 0 003 3" stroke-linecap="round"/></svg>',
  bulb: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0012 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  list: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke-linecap="round"/></svg>',
  folder: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7a2 2 0 012-2h4l2 3h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke-linejoin="round"/></svg>',
  megaphone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1zM14 8a4 4 0 010 8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dumbbell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 8v8M4 9v6M18 8v8M20 9v6M6 12h12" stroke-linecap="round"/></svg>',
  upload: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevronLeft: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevronRight: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  repeat: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mic: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" stroke-linejoin="round"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3M8 22h8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  micOff: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a3 3 0 00-3 3v3M15 10.5V5a3 3 0 00-5.7-1.3M19 10v2a7 7 0 01-7 7M12 19v3M8 22h8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 3l18 18" stroke-linecap="round"/></svg>',
  grid: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  tag: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 12l-8 8-9-9V3h8l9 9z" stroke-linejoin="round"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/></svg>',
  sparkle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l1.5 5L19 9.5l-5.5 1.5L12 16l-1.5-5L5 9.5l5.5-1.5L12 3z" stroke-linejoin="round"/><path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15z" stroke-linejoin="round"/></svg>',
  database: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" stroke-linecap="round"/></svg>',
  download: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/* ===== 灵感分类引擎 ===== */
const INSPIRATION_CATEGORIES = {
  ai: { name: 'AI/技术', color: '#f5a623', bg: 'rgba(245,166,35,0.12)', keywords: ['AI', '人工智能', '机器学习', '深度学习', 'GPT', '模型', '算法', '编程', '代码', 'python', 'tensorflow', 'pytorch', '神经网络', '自然语言', 'NLP', '大模型', 'agent', 'prompt', 'rag', '微调', '训练', '数据集', '开源', 'github', '框架', 'api', '向量', 'embedding', 'transformer', 'llm', '生成式', '智能体', '多模态', '计算机视觉', 'cv', '推荐系统', '强化学习'] },
  english: { name: '英语', color: '#38b2bf', bg: 'rgba(56,178,191,0.12)', keywords: ['英语', 'english', '雅思', 'ielts', '口语', '听力', '阅读', '写作', '单词', '词汇', '语法', '发音', '拼读', '跟读', 'shadowing', '外教', '剑桥', '托福', 'toefl', '翻译', '口语练习', '语感', '连读', '弱读', '语调', '音标', '词汇量', '真题'] },
  design: { name: '课程设计', color: '#9b87c1', bg: 'rgba(155,135,193,0.12)', keywords: ['课程', '教学', '教案', '课件', '教学设计', '课程设计', '教材', '教法', '学情', '教学目标', '课标', '单元', '课时', '课堂', '学生', '学习者', '翻转课堂', 'pbl', '项目式', '教学策略', '竞品', '政策', '课程标准', '核心素养', '评价', '教学评价', '教学反思', '教研', '备课'] },
  health: { name: '运动/健康', color: '#5fb89a', bg: 'rgba(95,184,154,0.12)', keywords: ['运动', '跑步', '健身', '瑜伽', 'yoga', '游泳', '打球', '篮球', '羽毛球', '健康', '睡眠', '饮食', '减肥', '锻炼', '拉伸', '冥想', '散步', '骑行', '体能', '晨跑', '有氧', '力量训练', '体脂', '卡路里'] },
  hobby: { name: '兴趣/爱好', color: '#ff8c61', bg: 'rgba(255,140,97,0.12)', keywords: ['唱歌', '跳舞', '舞蹈', '音乐', '吉他', '钢琴', '画画', '绘画', '摄影', '旅行', '美食', '烹饪', '烘焙', '手工', '书法', '乐器', '主持', '播音', '表演', '声乐', '视唱', '编曲', '剪辑', '视频'] },
  todo: { name: '待办/计划', color: '#f64f7b', bg: 'rgba(246,79,123,0.12)', keywords: ['要做', '需要', '计划', '待办', '明天', '下周', '安排', '准备', '完成', '提交', '报名', '预约', '提醒', '截止', 'deadline', '任务', '复习', '预习', '整理', '总结', '回顾', '清单', '进度', '打卡'] },
  thought: { name: '想法/创意', color: '#ff7a9d', bg: 'rgba(255,122,157,0.12)', keywords: ['想法', '创意', '灵感', 'idea', '如果', '也许', '可以尝试', '突然想到', '发现', '思考', '为什么', '怎么样', '创新', '点子', '假设', '设想', '或许', '不如', '试试', '万一', '有趣', '有意思'] },
  emotion: { name: '情感/感悟', color: '#b8a7d9', bg: 'rgba(184,167,217,0.12)', keywords: ['开心', '难过', '焦虑', '压力', '感动', '感悟', '反思', '觉得', '感受', '心情', '沮丧', '兴奋', '疲惫', '满足', '感恩', '坚持', '放弃', '成长', '开心', '失落', '期待', '紧张', '放松', '充实'] },
  other: { name: '其他', color: '#8e8296', bg: 'rgba(142,130,150,0.12)', keywords: [] },
};

const DEFAULT_SECTIONS = [
  {
    id: 'english',
    name: '英语学习',
    subtitle: 'English Learning',
    icon: 'english',
    color: 'teal',
    items: [
      { id: 'en_1', name: '自然拼读', source: 'B站英语兔课程', sourceUrl: 'https://search.bilibili.com/all?keyword=英语兔', frequency: '每周3次', target: 30, completed: 9, unit: '课', streak: 0, lastCheckIn: null },
      { id: 'en_2', name: '影子跟读', source: '灵格AI英语', sourceUrl: '', frequency: '每日', target: 100, completed: 15, unit: '篇', streak: 0, lastCheckIn: null },
      { id: 'en_3', name: '雅思题目', source: '剑桥雅思真题', sourceUrl: '', frequency: '每周5次', target: 50, completed: 22, unit: '套', streak: 0, lastCheckIn: null },
      { id: 'en_4', name: '外教交流', source: '在线外教课', sourceUrl: '', frequency: '每周2次', target: 60, completed: 12, unit: '次', streak: 0, lastCheckIn: null },
    ],
    goals: [
      { id: 'en_g1', name: '雅思总分7.0', deadline: '2026-12-31', image: '', measures: '每周完成2套真题、每日影子跟读30分钟、每周2次外教课', frequency: '每日', target: 0, completed: 0, unit: '', progress: 45 },
    ],
    tasks: [
      { id: 'en_t1', title: '完成剑桥雅思18 Test1', date: todayStr(), time: '14:00', priority: 'high', completed: false, section: 'english', recurringDays: null },
      { id: 'en_t2', title: '英语兔自然拼读', date: null, time: '20:00', priority: 'medium', completed: false, section: 'english', recurringDays: [1, 3, 5] },
    ],
    materials: [
      { id: 'en_m1', name: '剑桥雅思真题18 PDF', type: 'pdf', url: '', data: '', date: todayStr() },
      { id: 'en_m2', name: '英语兔自然拼读合集', type: 'link', url: 'https://search.bilibili.com/all?keyword=英语兔', data: '', date: todayStr() },
    ],
  },
  {
    id: 'ai',
    name: 'AI学习',
    subtitle: 'AI Learning',
    icon: 'ai',
    color: 'gold',
    items: [
      { id: 'ai_1', name: '做项目', source: '个人AI项目实战', sourceUrl: '', frequency: '每周2次', target: 5, completed: 2, unit: '个', streak: 0, lastCheckIn: null },
      { id: 'ai_2', name: '参加比赛', source: 'Kaggle / 天池等', sourceUrl: 'https://www.kaggle.com', frequency: '每月1次', target: 6, completed: 1, unit: '场', streak: 0, lastCheckIn: null },
      { id: 'ai_3', name: '课程学习', source: 'Coursera / 李沐等', sourceUrl: 'https://www.coursera.org', frequency: '每周3次', target: 40, completed: 22, unit: '课时', streak: 0, lastCheckIn: null },
      { id: 'ai_4', name: '官网指导', source: 'PyTorch / HuggingFace', sourceUrl: 'https://pytorch.org', frequency: '每周2次', target: 20, completed: 6, unit: '篇', streak: 0, lastCheckIn: null },
      { id: 'ai_5', name: 'AI新闻+AI产品', source: 'ProductHunt / 机器之心', sourceUrl: 'https://www.jiqizhixin.com', frequency: '每日', target: 300, completed: 180, unit: '条', streak: 0, lastCheckIn: null },
      { id: 'ai_6', name: '自媒体', source: '公众号 / 小红书', sourceUrl: '', frequency: '每周2次', target: 50, completed: 10, unit: '篇', streak: 0, lastCheckIn: null },
    ],
    goals: [
      { id: 'ai_g1', name: '完成5个AI应用项目', deadline: '2026-10-01', image: '', measures: '选定方向→数据准备→模型训练→部署上线→自媒体分享', frequency: '每周', target: 5, completed: 2, unit: '个', progress: 40 },
      { id: 'ai_g2', name: 'Kaggle铜牌', deadline: '2026-09-30', image: '', measures: '每月参加1场比赛，进入前10%', frequency: '每月', target: 0, completed: 0, unit: '', progress: 25 },
    ],
    tasks: [
      { id: 'ai_t1', title: '学习PyTorch Transformer教程', date: todayStr(), time: '09:00', priority: 'high', completed: false, section: 'ai', recurringDays: null },
      { id: 'ai_t2', title: '浏览AI新闻', date: null, time: '12:30', priority: 'low', completed: true, section: 'ai', recurringDays: [0, 1, 2, 3, 4, 5, 6] },
    ],
    materials: [
      { id: 'ai_m1', name: 'PyTorch官方教程', type: 'link', url: 'https://pytorch.org/tutorials/', data: '', date: todayStr() },
      { id: 'ai_m2', name: '李沐动手学深度学习', type: 'link', url: 'https://zh.d2l.ai/', data: '', date: todayStr() },
      { id: 'ai_m3', name: 'HuggingFace文档', type: 'link', url: 'https://huggingface.co/docs', data: '', date: todayStr() },
    ],
  },
  {
    id: 'design',
    name: '课程设计学习',
    subtitle: 'Curriculum Design',
    icon: 'design',
    color: 'rose',
    items: [
      { id: 'cd_1', name: '书籍及网络资料视频阅读', source: '多平台综合', sourceUrl: '', frequency: '每日', target: 10, completed: 3, unit: '本', streak: 0, lastCheckIn: null },
      { id: 'cd_2', name: '竞品分析', source: '各大教育平台', sourceUrl: '', frequency: '每周2次', target: 10, completed: 2, unit: '个', streak: 0, lastCheckIn: null },
      { id: 'cd_3', name: '政策文件', source: '教育部官网', sourceUrl: 'https://www.moe.gov.cn', frequency: '每周1次', target: 20, completed: 3, unit: '份', streak: 0, lastCheckIn: null },
    ],
    goals: [
      { id: 'cd_g1', name: '完成课程设计方案初稿', deadline: '2026-11-15', image: '', measures: '研读3本课程设计书籍、分析5个竞品课程、研读最新政策文件', frequency: '每周', target: 0, completed: 0, unit: '', progress: 30 },
    ],
    tasks: [
      { id: 'cd_t1', title: '阅读《课程与教学论》', date: null, time: '15:00', priority: 'medium', completed: false, section: 'design', recurringDays: [2, 4, 6] },
    ],
    materials: [
      { id: 'cd_m1', name: '教育部课程改革文件', type: 'link', url: 'https://www.moe.gov.cn', data: '', date: todayStr() },
    ],
  },
  {
    id: 'other',
    name: '其他学习',
    subtitle: 'Beyond the Books',
    icon: 'other',
    color: 'plum',
    items: [
      { id: 'ot_1', name: '运动', source: '跑步 / 健身', sourceUrl: '', frequency: '每日', target: 100, completed: 50, unit: '天', streak: 0, lastCheckIn: null },
      { id: 'ot_2', name: '唱歌', source: '声乐练习', sourceUrl: '', frequency: '每周3次', target: 60, completed: 18, unit: '次', streak: 0, lastCheckIn: null },
      { id: 'ot_3', name: '跳舞', source: '舞蹈课程', sourceUrl: '', frequency: '每周2次', target: 40, completed: 10, unit: '次', streak: 0, lastCheckIn: null },
      { id: 'ot_4', name: '瑜伽', source: '线上瑜伽课', sourceUrl: '', frequency: '每周3次', target: 60, completed: 24, unit: '次', streak: 0, lastCheckIn: null },
      { id: 'ot_5', name: '教培', source: '教师资格培训', sourceUrl: '', frequency: '每周2次', target: 30, completed: 10, unit: '课时', streak: 0, lastCheckIn: null },
      { id: 'ot_6', name: '网硕', source: '在线硕士课程', sourceUrl: '', frequency: '每周4次', target: 80, completed: 36, unit: '课时', streak: 0, lastCheckIn: null },
      { id: 'ot_7', name: '主持', source: '主持技巧训练', sourceUrl: '', frequency: '每周1次', target: 20, completed: 4, unit: '次', streak: 0, lastCheckIn: null },
    ],
    goals: [
      { id: 'ot_g1', name: '坚持运动100天', deadline: '2026-11-16', image: '', measures: '每日至少30分钟运动（跑步/健身/瑜伽）', frequency: '每日', target: 100, completed: 50, unit: '天', progress: 50 },
    ],
    tasks: [
      { id: 'ot_t1', title: '晨跑3公里', date: null, time: '06:30', priority: 'medium', completed: false, section: 'other', recurringDays: [1, 2, 3, 4, 5] },
      { id: 'ot_t2', title: '瑜伽30分钟', date: null, time: '21:00', priority: 'low', completed: false, section: 'other', recurringDays: [1, 3, 5] },
    ],
    materials: [],
  },
];

const DEFAULT_GOALS = [
  { id: 'g_1', name: '雅思总分7.0', deadline: '2026-12-31', image: '', section: 'english', measures: '每周完成2套真题、每日影子跟读30分钟', frequency: '每日', target: 0, completed: 0, unit: '', progress: 45 },
  { id: 'g_2', name: '完成5个AI应用项目', deadline: '2026-10-01', image: '', section: 'ai', measures: '选定方向→数据→模型→部署→分享', frequency: '每周', target: 5, completed: 2, unit: '个', progress: 40 },
  { id: 'g_3', name: '课程设计方案初稿', deadline: '2026-11-15', image: '', section: 'design', measures: '研读3本书+分析5个竞品+政策文件', frequency: '每周', target: 0, completed: 0, unit: '', progress: 30 },
  { id: 'g_4', name: '坚持运动100天', deadline: '2026-11-16', image: '', section: 'other', measures: '每日至少30分钟运动', frequency: '每日', target: 100, completed: 50, unit: '天', progress: 50 },
];

const INSPIRATION_COLORS = [
  { bg: 'rgba(246,79,123,0.14)', text: '#d63b63' },
  { bg: 'rgba(245,166,35,0.14)', text: '#c27a0a' },
  { bg: 'rgba(95,184,154,0.14)', text: '#3d8f75' },
  { bg: 'rgba(155,135,193,0.14)', text: '#765fa0' },
  { bg: 'rgba(255,122,157,0.14)', text: '#d65a7a' },
  { bg: 'rgba(56,178,191,0.14)', text: '#2c8c97' },
];

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

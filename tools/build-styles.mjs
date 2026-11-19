/**
 * StyleVault · 把 oiioii.tv 风格库原始数据转换成站点数据模型
 * 用法: node tools/build-styles.mjs
 * 产出: assets/data/styles.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const raw = JSON.parse(readFileSync(resolve(ROOT, 'tools/style_assets_all.json'), 'utf8'));
const items = raw.items || [];

/* ---------- 分类 ---------- */
const CATS = [
  { key: 'all', label: '全部风格' },
  { key: 'real', label: '真人剧' },
  { key: 'anime', label: '日漫' },
  { key: 'manju', label: '漫剧' },
  { key: 'cn', label: '国风' },
  { key: 'd3', label: '3D' },
  { key: 'd2', label: '2D' },
  { key: 'us', label: '欧美' },
  { key: 'game', label: '游戏' },
  { key: 'chibi', label: 'Q版' },
  { key: 'kr', label: '韩流' },
];
const CAT_KEY = {
  '真人剧': 'real', '日漫': 'anime', '漫剧': 'manju', '国风': 'cn',
  '3D': 'd3', '2D': 'd2', '欧美': 'us', '游戏': 'game', 'Q版': 'chibi', '韩流': 'kr',
};
// 多分类归一：'2D,日漫' → ['d2','anime']
function parseCats(typeCn) {
  const raw = String(typeCn || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  const keys = raw.map((c) => CAT_KEY[c]).filter(Boolean);
  return { cats: [...new Set(keys)], labels: raw };
}

/* ---------- 各分类主色 ---------- */
const CAT_ACCENT = {
  real: '#8fb8ff', anime: '#ff9ec4', manju: '#7c9eff', cn: '#e0b064',
  d3: '#7ce0c4', d2: '#c9a0ff', us: '#ff9a5c', game: '#6fe08a',
  chibi: '#ffb3c9', kr: '#ff7fa8',
};

/* ---------- 题材/画面词库（用于剧本匹配） ---------- */
const LEX = [
  // 题材
  '都市', '职场', '写字楼', '加班', '会议', '汇报', '相亲', '婚恋', '爱情', '甜宠', '撒糖',
  '仙侠', '修仙', '宗门', '剑', '剑修', '渡劫', '飞升', '灵气', '丹药', '法宝', '神魔', '妖怪',
  '武侠', '江湖', '门派', '恩怨', '复仇', '刺杀', '刀光', '轻功', '掌门', '大侠',
  '科幻', '未来', '赛博', '机甲', '机械', '人工智能', '机器人', '芯片', '太空', '星际',
  '悬疑', '推理', '案件', '侦探', '凶案', '真相', '线索', '反转', '悬念', '惊悚', '恐怖',
  '灵异', '鬼', '诡异', '怪谈', '规则怪谈', '诡事', '附身', '邪祟',
  '末世', '丧尸', '病毒', '废土', '幸存', '避难所', '感染', '变异', '灾变',
  '民国', '上海', '弄堂', '旗袍', '长衫', '旧上海', '军阀', '商战',
  '古装', '宫廷', '后宫', '将军', '皇帝', '权谋', '家国', '朝堂', '大宅', '宅斗',
  '年代', '八零', '九零', '八十年代', '九十年代', '复古', '怀旧', '童年', '回忆', '往事',
  '历史', '战争', '抗战', '谍战', '革命', '长征',
  '校园', '青春', '高中', '大学', '同学', '老师', '早恋', '毕业', '班主任',
  '亲子', '儿童', '童话', '萌宠', '宠物', '猫', '狗', '家庭', '育儿', '动物',
  '游戏', '电竞', '副本', '公会', '玩家', '装备', '技能', '开黑',
  '美妆', '穿搭', '时尚', '护肤', '珠宝', '家居', '美食', '探店', '带货', '电商',
  '体育', '足球', '篮球', '赛车', '拳击', '健身',
  '医疗', '医生', '医院', '病例', '急诊', '法医',
  '律政', '律师', '官司', '检察', '警察', '扫毒', '卧底',
  '音乐', 'MV', '说唱', '乐队', '偶像', '出道', '选秀',
  '乡村', '种田', '田园', '农家', '知青', '村庄',
  '军事', '战争片', '谍战片', '特战', '空战', '海军',
  // 情绪 / 画面
  '治愈', '温暖', '舒适', '慵懒', '轻松', '欢快', '搞笑', '沙雕', '尴尬', '爆笑',
  '热血', '燃', '励志', '成长', '热血战斗', '战斗', '对决', '竞技', '拼搏',
  '压抑', '沉重', '绝望', '悲', '虐', '眼泪', '离别', '牺牲', '救赎',
  '唯美', '浪漫', '梦幻', '空灵', '意境', '诗意', '禅意',
  '暗黑', '黑暗', '阴郁', '恐怖', '惊悚', '诡异', '血腥',
  '高级感', '质感', '写实', '纪实', '真实', '电影感', '质感细节', '胶片',
  '赛璐璐', '厚涂', '半写实', '二次元', '动漫', '卡通', '渲染', '建模', 'CG',
  // 时代 / 场景
  '古代', '现代', '民国', '未来', '近代', '当代',
  '雨夜', '夜景', '白天', '黄昏', '清晨', '深夜', '室内', '室外', '街道', '天台', '地铁', '咖啡馆',
  '雪', '雨', '雾', '烟', '火光', '霓虹', '灯火', '月光', '阳光', '夕阳',
  // 人物
  '女性', '男性', '女孩', '男孩', '少女', '少年', '母亲', '父亲', '孩子', '老人', '小孩', '宠物',
];

const countHits = (text, term) => {
  let n = 0, i = 0;
  while ((i = text.indexOf(term, i)) !== -1) { n++; i += term.length; }
  return n;
};

/* ---------- 句子分段 & 标注 ---------- */
const LABEL_RULES = [
  { re: /(禁止|避免|不要|不可|严禁)/, label: '负向' },
  { re: /(光|影|照明|打光|色调|色彩|颜色|饱和)/, label: '光线 / 色彩' },
  { re: /(材质|质感|纹理|面料|金属|表面)/, label: '材质' },
  { re: /(构图|镜头|视角|透视|景深|构图感)/, label: '镜头 / 构图' },
  { re: /(角色|人物|表情|神态|服饰|穿着)/, label: '角色' },
  { re: /(场景|环境|背景|空间|建筑)/, label: '场景' },
  { re: /(氛围|气质|质感风格|风格|美学)/, label: '风格' },
];

function splitSentences(text) {
  return (text || '')
    .split(/(?<=[。；;])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 6);
}
function labelSentence(s) {
  for (const r of LABEL_RULES) if (r.re.test(s)) return r.label;
  return '风格描述';
}

/* ---------- 构建 ---------- */
const styles = items.map((it) => {
  const m = it.meta || {};
  const content = (it.content || '').trim();
  const nameCn = m.name_cn || m.name;
  const { cats, labels } = parseCats(m.type_cn);
  const cat = cats[0] || 'manju';
  const hay = `${nameCn} ${m.name || ''} ${content}`;

  const kw = new Set();
  for (const t of LEX) if (hay.includes(t)) kw.add(t);
  kw.add(nameCn);
  // 名称分词（去掉修饰后缀）
  for (const t of nameCn.replace(/(风格|画风|动画|剧|系|动漫)$/g, '')) if (t.length >= 2) kw.add(t);

  const sentences = splitSentences(content);
  const negative = sentences.filter((s) => /(禁止|避免|不要|不可|严禁)/.test(s));
  const facets = [];
  for (const s of sentences) {
    const label = labelSentence(s);
    if (label === '负向') continue;
    if (facets.some((f) => f.label === label)) continue;
    facets.push({ label, text: s.replace(/[。；;]$/, '') });
  }

  const clicks = m.click_count || 0;
  const hot = !!m.is_hot;
  const isNew = !!m.is_new;
  const rarity = hot || clicks > 5000 ? 'SSR' : clicks > 800 || isNew ? 'SR' : 'R';

  const refs = [];
  const push = (k, label) => { if (m[k]) refs.push({ label, file: `assets/refs/${it.id}_${k.replace('_url', '')}.jpg` }); };
  push('girl_url', '女性'); push('boy_url', '男性'); push('pet_url', '宠物');
  push('indoor_url', '室内'); push('outdoor_url', '室外');

  return {
    id: String(it.id),
    name: nameCn,
    en: m.name || '',
    cat,
    cats,
    catLabel: labels.join(' / ') || m.type_cn,
    type: m.type || '',
    tool: it.tool || '',
    desc: sentences[0] ? sentences[0].replace(/[。；;]$/, '') : content.slice(0, 80),
    full: content,
    tags: [...new Set([...labels, ...(Array.isArray(m.hot_tags) ? m.hot_tags : [])].filter(Boolean))].slice(0, 5),
    hot, new: isNew,
    uses: clicks,
    creator: m.creator_name_cn || m.creator_name || 'OiiOii',
    thumb: `assets/thumbs/${it.id}.jpg`,
    refs,
    facets,
    negative: negative.join(' '),
    keywords: [...kw],
    accent: CAT_ACCENT[cat] || '#7cb3ff',
    rarity,
  };
});

const out = `/**
 * StyleVault · 风格库数据（来源：oiioii.tv 风格库 / knowledge/style_assets）
 * 自动生成于 tools/build-styles.mjs，请勿手改
 */
window.STYLE_CATEGORIES = ${JSON.stringify(CATS, null, 2)};
window.STYLE_LIBRARY = ${JSON.stringify(styles, null, 1)};
`;
writeFileSync(resolve(ROOT, 'assets/data/styles.js'), out, 'utf8');
console.log(`已生成 assets/data/styles.js：${styles.length} 个风格，${(out.length / 1024).toFixed(0)} KB`);
const byCat = {};
styles.forEach((s) => { byCat[s.catLabel] = (byCat[s.catLabel] || 0) + 1; });
console.log('分类分布：', Object.entries(byCat).map(([k, v]) => `${k}:${v}`).join('  '));
console.log('示例：', styles.slice(0, 6).map((s) => `${s.name}(${s.catLabel})`).join(' | '));

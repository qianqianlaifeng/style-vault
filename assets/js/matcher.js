/* ============================================================
   StyleVault · 本地剧本语义匹配引擎
   纯前端、零依赖：文本 → 题材/时代/情绪/媒介要素 → 画风打分
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 要素词典 ---------- */
  const GENRES = {
    '都市职场': ['职场', '上班', '加班', '写字楼', '会议', '汇报', '老板', '同事', '简历', '面试', '升职', '辞职', '项目', '客户', '出差', '工位', 'KPI', '方案', '甲方', '甲方', '提案', '通勤', '地铁', '部门', '策划'],
    '都市情感': ['相亲', '婚恋', '恋爱', '分手', '离婚', '暧昧', '心动', '告白', '白月光', '前女友', '前男友', '结婚', '闺蜜', '同学会', '原生家庭'],
    '仙侠修真': ['修仙', '仙侠', '灵气', '丹田', '经脉', '宗门', '渡劫', '飞升', '丹药', '法宝', '剑修', '御剑', '元婴', '金丹', '雷劫', '修仙者', '灵根', '筑基', '仙人', '神魔'],
    '武侠江湖': ['武侠', '江湖', '门派', '恩怨', '复仇', '刺杀', '刀光', '轻功', '掌门', '大侠', '内力', '剑法', '镖局', '武林'],
    '古风权谋': ['宫廷', '后宫', '皇帝', '将军', '权谋', '朝堂', '大宅', '宅斗', '古风', '古装', '妃子', '太子', '丞相', '深宅', '绣楼'],
    '科幻未来': ['科幻', '未来', '赛博', '机甲', '机械', '人工智能', 'AI', '机器人', '芯片', '太空', '星际', '克隆', '生化', '基因', '外星', '飞船', '义体', '数据', '算法'],
    '悬疑推理': ['悬疑', '推理', '案件', '侦探', '凶案', '真相', '线索', '反转', '悬念', '尸体', '凶手', '嫌疑人', '卷宗', '笔录', '不在场证明'],
    '灵异惊悚': ['灵异', '诡异', '鬼', '怪谈', '规则怪谈', '附身', '邪祟', '凶宅', '半夜', '诡异', '阴森', '鬼压床', '招魂'],
    '末世丧尸': ['末世', '丧尸', '病毒', '废土', '幸存者', '避难所', '感染', '变异', '灾变', '物资', '幸存', '荒野'],
    '民国年代': ['民国', '上海', '弄堂', '旗袍', '长衫', '租界', '军阀', '商会', '戏园', '旧上海', '报馆', '舞女', '租界'],
    '年代怀旧': ['八十年代', '九十年代', '八零', '九零', '复古', '怀旧', '回忆', '童年', '小时候', '旧照片', '老屋', '供销社', '录像厅', '搪瓷缸', '的确良', '泛黄'],
    '校园青春': ['校园', '青春', '高中', '大学', '班主任', '早恋', '毕业', '同桌', '操场', '晚自习', '高考', '宿舍', '社团'],
    '亲子家庭': ['亲子', '儿童', '童话', '萌宠', '宠物', '育儿', '家庭', '孩子', '妈妈', '爸爸', '幼儿园'],
    '游戏电竞': ['游戏', '电竞', '副本', '公会', '开黑', '上分', '装备', '技能', '玩家', '游戏cg', '游戏原画', '关卡', 'boss'],
    '国潮广告': ['国潮', '非遗', '品牌', '国风', '文化', '故宫', '敦煌', '京剧', '陶瓷', '茶', '酒', '发布会', '主视觉'],
    '美食生活': ['美食', '探店', '做饭', '餐厅', '小吃', '早餐', '厨房', '下饭', '火锅', '奶茶'],
    '运动热血': ['热血', '比赛', '足球', '篮球', '赛车', '拳击', '格斗', '竞技', '夺冠', '训练', '拼搏', '运动会'],
    '悬疑医疗': ['医生', '医院', '急诊', '病例', '手术', '法医', '解剖', '病房', '病人', '诊断'],
    '律政犯罪': ['律师', '官司', '法庭', '检察', '警察', '扫毒', '卧底', '证据', '宣判', '拘留'],
    '奇幻冒险': ['奇幻', '冒险', '魔法', '巨龙', '精灵', '异世界', '勇者', '地下城', '王国'],
    '恐怖丧尸': ['恐怖', '丧尸', '尖叫', '血', '鬼屋'],
    '现代都市': ['现代', '都市', '城市', '写字楼', '公寓', '地铁', '出租车', '便利店', '手机', '朋友圈', '扫码'],
  };

  const ERAS = {
    '现代': ['现代', '当下', '如今', '手机', '网络', '互联网', '咖啡', '地铁', '写字楼'],
    '民国': ['民国', '上海', '弄堂', '旗袍', '长衫', '军阀', '租界'],
    '古代': ['古代', '古装', '仙侠', '修仙', '宫廷', '皇帝', '江湖', '剑', '宗门', '侠'],
    '未来': ['未来', '科幻', '赛博', '机甲', '星际', '机器人', '芯片', '克隆'],
    '年代': ['八十年代', '九十年代', '八零', '九零', '年代', '老式', '搪瓷', '的确良', '供销社'],
  };

  const MOODS = {
    '治愈温暖': ['治愈', '温暖', '温柔', '陪伴', '舒适', '轻松', '治愈系', '暖', '阳光', '日常'],
    '热血燃': ['热血', '燃', '励志', '成长', '战斗', '拼搏', '努力', '胜利', '突破', '热血战斗'],
    '压抑虐心': ['压抑', '沉重', '绝望', '虐', '眼泪', '离别', '牺牲', '痛苦', '崩溃', '悲剧'],
    '甜蜜恋爱': ['甜', '宠', '暧昧', '心动', '告白', '恋爱', '撒娇', '甜宠', '撒糖'],
    '悬疑惊悚': ['悬疑', '惊悚', '恐怖', '诡异', '压抑', '反转', '真相', '阴森'],
    '复古怀旧': ['复古', '怀旧', '回忆', '老照片', '胶片', '年代感'],
    '梦幻唯美': ['唯美', '梦幻', '空灵', '诗意', '意境', '仙气', '梦幻感'],
    '黑暗压抑': ['暗黑', '黑暗', '阴郁', '血腥', '残酷'],
  };

  const MEDIA = {
    '真人实拍': ['真人', '实拍', '写实', '摄影', '纪录片', '真人剧', '演员', '真实感'],
    '二次元动漫': ['二次元', '动漫', '动画', '番剧', '漫画', '日漫', '赛璐璐', '手绘', '插画'],
    '3D渲染': ['3D', '三维', '建模', '渲染', 'CG', '引擎', '低多边形', 'lowpoly', 'PBR'],
    'Q版萌系': ['Q版', '萌', '可爱', '表情包', '吉祥物', '二头身'],
    '国风': ['国风', '古风', '水墨', '工笔', '敦煌', '国潮', '东方'],
    '欧美': ['欧美', '西方', '赛璐璐美式', '漫威', '好莱坞'],
    '韩流': ['韩流', '韩剧', '韩系', 'Kpop', '韩妆'],
  };

  const SCENE_HINTS = ['雨夜', '夜景', '白天', '黄昏', '清晨', '深夜', '室内', '室外', '街道', '天台', '地铁', '咖啡馆', '教室', '卧室', '厨房', '雪', '雨', '雾', '烟火', '霓虹', '森林', '海边', '古镇', '巷子'];

  function countOccur(text, term) {
    let n = 0, i = 0;
    while ((i = text.indexOf(term, i)) !== -1) { n++; i += term.length; }
    return n;
  }

  function detectGroup(text, dict) {
    const out = [];
    for (const label in dict) {
      const hits = [];
      for (const w of dict[label]) {
        const c = countOccur(text, w);
        if (c > 0) hits.push({ w, c });
      }
      if (hits.length) {
        const total = hits.reduce((s, h) => s + h.c, 0);
        out.push({ label, score: hits.length * 2 + total, words: hits.sort((a, b) => b.c - a.c).slice(0, 6) });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }

  /* ---------- 分析 ---------- */
  function analyze(text) {
    const t = (text || '').replace(/\s+/g, ' ').trim();
    const genres = detectGroup(t, GENRES);
    const eras = detectGroup(t, ERAS);
    const moods = detectGroup(t, MOODS);
    const media = detectGroup(t, MEDIA);
    const scenes = SCENE_HINTS.filter((s) => t.includes(s)).slice(0, 8);
    const chars = ['女性', '男性', '女孩', '男孩', '少女', '少年', '母亲', '父亲', '孩子', '老人', '小孩', '宠物', '主角', '女主', '男主']
      .filter((s) => t.includes(s)).slice(0, 5);
    return {
      length: t.length,
      genres: genres.slice(0, 3),
      eras: eras.slice(0, 2),
      moods: moods.slice(0, 2),
      media: media.slice(0, 2),
      scenes, chars,
    };
  }

  /* ---------- 打分 ---------- */
  function scoreStyle(style, text, analysis) {
    const hits = [];
    let score = 0;
    const name = style.name || '';

    // 1) 画风名直接命中（最强信号）
    if (name && text.includes(name)) { score += 26; hits.push({ term: name, w: 26, strong: true }); }

    // 2) 画风关键词命中
    for (const kw of style.keywords || []) {
      if (!kw || kw.length < 2) continue;
      const c = countOccur(text, kw);
      if (c > 0) {
        const w = Math.min(9, 2.2 * c) * (kw === name ? 2 : 1);
        score += w;
        hits.push({ term: kw, w, strong: kw.length >= 3 });
      }
    }

    // 3) 题材命中（把检测到的题材词映射到画风关键词）
    const genreTerms = [];
    analysis.genres.forEach((g) => g.words.forEach((w) => genreTerms.push(w.w)));
    for (const gt of genreTerms) {
      if ((style.keywords || []).includes(gt)) score += 7;
    }

    // 4) 媒介偏好：文本点名 3D / 二次元 / 真人 时，给对应分类加权
    const medHit = analysis.media[0];
    if (medHit) {
      const map = { '3D渲染': 'd3', '二次元动漫': 'd2', '真人实拍': 'real', 'Q版萌系': 'chibi', '国风': 'cn', '欧美': 'us', '韩流': 'kr' };
      const key = map[medHit.label];
      if (key && (style.cats || [style.cat]).includes(key)) score += 16;
      if (key && (style.cats || []).includes('anime') && (medHit.label === '二次元动漫')) score += 8;
    }

    // 5) 时代一致性
    const eraHit = analysis.eras[0];
    if (eraHit) {
      const eraKey = { '现代': ['real'], '民国': ['cn', 'real'], '古代': ['cn'], '未来': ['d3', 'us'], '年代': ['real', 'd2'] }[eraHit.label] || [];
      if ((style.cats || []).some((c) => eraKey.includes(c))) score += 8;
    }

    // 6) 情绪一致性
    const moodHit = analysis.moods[0];
    if (moodHit) {
      const moodKey = {
        '治愈温暖': ['chibi', 'd2'], '热血燃': ['manju', 'us', 'd3'], '压抑虐心': ['real', 'cn'],
        '甜蜜恋爱': ['kr', 'd3'], '悬疑惊悚': ['real', 'cn'], '复古怀旧': ['real', 'd2'],
        '梦幻唯美': ['cn', 'd2'], '黑暗压抑': ['real', 'us'],
      }[moodHit.label] || [];
      if ((style.cats || []).some((c) => moodKey.includes(c))) score += 6;
    }

    // 7) 热度微调（同分时更Popular的排前面）
    score += Math.min(2.2, (style.uses || 0) / 60000);

    hits.sort((a, b) => b.w - a.w);
    return { score, hits: hits.slice(0, 8) };
  }

  function buildReason(style, hits, analysis) {
    const top = hits.filter((h) => h.strong).slice(0, 4).map((h) => h.term);
    const g = analysis.genres[0];
    const parts = [];
    if (top.length) parts.push(`命中关键词 <b>${top.join(' / ')}</b>`);
    if (g) parts.push(`剧情偏 <b>${g.label}</b>`);
    if (analysis.eras[0]) parts.push(`时代 <b>${analysis.eras[0].label}</b>`);
    if (analysis.moods[0]) parts.push(`情绪 <b>${analysis.moods[0].label}</b>`);
    if (!parts.length) parts.push(`该画风的画面语言与你的文本气质接近，分类 <b>${style.catLabel}</b>`);
    return parts.join(' · ');
  }

  /* ---------- 主入口 ---------- */
  function match(text, styles, topN) {
    topN = topN || 3;
    const analysis = analyze(text);
    const scored = styles.map((s) => {
      const r = scoreStyle(s, text, analysis);
      return { style: s, score: r.score, hits: r.hits, reason: buildReason(s, r.hits, analysis) };
    });
    scored.sort((a, b) => b.score - a.score);

    // 分类去重：保证 Top3 不全是同一类画风（若存在同分类更弱的候选则替换）
    const picked = [];
    const pool = scored.slice();
    const catsUsed = new Set();
    for (const s of pool) {
      if (picked.length >= topN) break;
      const c = s.style.cat;
      if (catsUsed.has(c) && pool.some((o) => !catsUsed.has(o.style.cat) && o.score > s.score * 0.55)) continue;
      picked.push(s);
      catsUsed.add(c);
    }
    for (const s of pool) {
      if (picked.length >= topN) break;
      if (!picked.includes(s)) picked.push(s);
    }

    const max = Math.max(1, picked[0] ? picked[0].score : 1);
    picked.forEach((p) => {
      const ratio = p.score / max;
      p.percent = Math.max(24, Math.min(98, Math.round(38 + 60 * Math.pow(ratio, 0.55))));
    });
    return { analysis, results: picked.slice(0, topN) };
  }

  window.StyleMatcher = { analyze, match };
})();

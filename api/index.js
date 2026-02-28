// 主API入口 - V2.0 连接真实飞书数据
const feishu = require('../utils/feishu');
const { success, error } = require('../utils/response');

// 表ID配置 - 从环境变量读取
const TABLES = {
  hotKeywords: process.env.FEISHU_TABLE_HOTKEYWORDS,
  rawMaterials: process.env.FEISHU_TABLE_RAWMATERIALS,
  groupBuying: process.env.FEISHU_TABLE_GROUPBUYING
};

// 平台名称映射（统一）
const PLATFORM_MAP = {
  'kimi': 'Kimi',
  'deepseek': 'DeepSeek',
  'yuanbao': '元宝',
  'qianwen': '千问',
  'wenxin': '文心一言',
  'doubao': '豆包'
};

// 平台颜色配置
const PLATFORM_COLORS = {
  'Kimi': '#1677ff',
  'DeepSeek': '#722ed1',
  '元宝': '#fa8c16',
  '千问': '#52c41a',
  '文心一言': '#f5222d',
  '豆包': '#13c2c2'
};

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url;
  console.log('Request URL:', url, 'Method:', req.method);
  
  try {
    // 1. 根路径 - API信息
    if (url === '/' || url === '') {
      return res.json(success({
        message: '咖续餐饮供应链API V2.0',
        version: '2.0.0',
        endpoints: {
          'GET /api/trends': '热词趋势（Kimi/DeepSeek/元宝/千问/文心一言/豆包）',
          'GET /api/materials': '原料集采',
          'GET /api/groupon': '团购爆品',
          'GET /api/keywords': '热词列表（支持筛选、分页）',
          'GET /api/platforms': '支持的平台列表',
          'POST /api/order': '创建订单'
        },
        platforms: Object.values(PLATFORM_MAP)
      }));
    }
    
    // 2. 获取平台列表
    if (url === '/api/platforms' || url === '/platforms') {
      return res.json(success({
        platforms: Object.values(PLATFORM_MAP),
        colors: PLATFORM_COLORS
      }));
    }
    
    // 3. 热词趋势 - /api/trends 或 /trends
    if (url.startsWith('/api/trends') || url.startsWith('/trends')) {
      if (!TABLES.hotKeywords) {
        return res.status(500).json(error('FEISHU_TABLE_HOTKEYWORDS not configured'));
      }
      
      const result = await feishu.queryRecords(TABLES.hotKeywords);
      
      // 格式化数据
      let trends = result.items.map(item => {
        const fields = item.fields;
        return {
          id: item.record_id,
          keyword: fields['热词文本'] || '',
          platform: fields['平台来源'] || '',
          heat_score: fields['热度值'] || 0,
          trend: fields['趋势方向'] || '平稳',
          category: fields['所属品类'] || '',
          region: fields['地域属性'] || [],
          summary: fields['内容摘要'] || '',
          materials: fields['关联原料'] || [],
          created_at: fields['抓取时间'] || new Date().toISOString()
        };
      });
      
      // 按热度排序
      trends.sort((a, b) => b.heat_score - a.heat_score);
      
      return res.json(success({
        total: trends.length,
        platforms: Object.values(PLATFORM_MAP),
        trends: trends.slice(0, 50) // 返回前50条
      }));
    }
    
    // 4. 原料集采 - /api/materials 或 /materials
    if (url.startsWith('/api/materials') || url.startsWith('/materials')) {
      if (!TABLES.rawMaterials) {
        return res.status(500).json(error('FEISHU_TABLE_RAWMATERIALS not configured'));
      }
      
      const result = await feishu.queryRecords(TABLES.rawMaterials);
      
      const materials = result.items.map(item => {
        const fields = item.fields;
        return {
          id: item.record_id,
          code: fields['SKU编码'] || '',
          name: fields['原料名称'] || '',
          category: fields['所属品类'] || '',
          unit: fields['最小销售单位'] || '',
          package: fields['包装规格'] || '',
          normal_price: fields['日常价（元）'] || 0,
          group_price: fields['集采价（元）'] || 0,
          min_quantity: fields['起订量'] || 1,
          supplier: fields['供应商'] || '',
          stock_status: fields['库存状态'] || '充足',
          scenes: fields['适用场景'] || []
        };
      });
      
      return res.json(success({
        categories: [...new Set(materials.map(m => m.category))],
        materials: materials
      }));
    }
    
    // 5. 团购爆品 - /api/groupon 或 /groupon
    if (url.startsWith('/api/groupon') || url.startsWith('/groupon')) {
      if (!TABLES.groupBuying) {
        return res.status(500).json(error('FEISHU_TABLE_GROUPBUYING not configured'));
      }
      
      const result = await feishu.queryRecords(TABLES.groupBuying);
      
      const products = result.items.map(item => {
        const fields = item.fields;
        return {
          id: item.record_id,
          product_id: fields['商品ID'] || '',
          platform: fields['平台'] || '',
          name: fields['商品名称'] || '',
          category: fields['品类'] || '',
          sales: fields['销量'] || 0,
          original_price: fields['原价'] || 0,
          groupon_price: fields['团购价'] || 0,
          discount: fields['折扣'] || '',
          heat_level: fields['热度等级'] || '',
          location: fields['地区'] || ''
        };
      });
      
      return res.json(success({ products }));
    }
    
    // 6. 热词列表（带筛选、分页）- /api/keywords
    if (url.startsWith('/api/keywords')) {
      if (!TABLES.hotKeywords) {
        return res.status(500).json(error('FEISHU_TABLE_HOTKEYWORDS not configured'));
      }
      
      const query = req.query || {};
      const result = await feishu.queryRecords(TABLES.hotKeywords);
      
      let keywords = result.items.map(item => {
        const fields = item.fields;
        return {
          id: item.record_id,
          keyword_id: fields['热词ID'] || '',
          keyword: fields['热词文本'] || '',
          platform: fields['平台来源'] || '',
          heat_score: fields['热度值'] || 0,
          trend_direction: fields['趋势方向'] || '平稳',
          category: fields['所属品类'] || '',
          region: fields['地域属性'] || [],
          related_materials: fields['关联原料'] || [],
          summary: fields['内容摘要'] || '',
          created_at: fields['抓取时间'] || new Date().toISOString()
        };
      });
      
      // 分类筛选
      if (query.category) {
        keywords = keywords.filter(k => k.category === query.category);
      }
      
      // 平台筛选
      if (query.platform) {
        keywords = keywords.filter(k => k.platform === query.platform);
      }
      
      // 区域筛选
      if (query.region) {
        keywords = keywords.filter(k => 
          k.region.some(r => r.includes(query.region))
        );
      }
      
      // 搜索关键词
      if (query.keyword) {
        const searchTerm = query.keyword.toLowerCase();
        keywords = keywords.filter(k => 
          k.keyword.toLowerCase().includes(searchTerm)
        );
      }
      
      // 按热度排序
      keywords.sort((a, b) => b.heat_score - a.heat_score);
      
      // 分页
      const page = parseInt(query.page) || 1;
      const pageSize = parseInt(query.pageSize) || 20;
      const start = (page - 1) * pageSize;
      const paginated = keywords.slice(start, start + pageSize);
      
      // 处理热度等级
      const formattedData = paginated.map(item => {
        const score = item.heat_score;
        let heatLevel, heatClass;
        if (score >= 90) { heatLevel = '爆红'; heatClass = 'heat-explosive'; }
        else if (score >= 70) { heatLevel = '热门'; heatClass = 'heat-hot'; }
        else if (score >= 50) { heatLevel = '上升'; heatClass = 'heat-rising'; }
        else if (score >= 30) { heatLevel = '平稳'; heatClass = 'heat-normal'; }
        else { heatLevel = '冷门'; heatClass = 'heat-cold'; }
        
        return {
          ...item,
          heat_level: heatLevel,
          heat_class: heatClass,
          materials_count: item.related_materials?.length || 0,
          preview_materials: item.related_materials?.slice(0, 3) || []
        };
      });
      
      return res.json(success({
        total: keywords.length,
        page: page,
        pageSize: pageSize,
        data: formattedData
      }));
    }
    
    // 7. 创建订单 - POST /api/order
    if ((url.startsWith('/api/order') || url.startsWith('/order')) && req.method === 'POST') {
      // TODO: 实现真实订单创建逻辑
      return res.json(success({
        order_id: 'DD-' + Date.now(),
        status: '拼单中',
        message: '参团成功，等待成团'
      }));
    }
    
    // 404
    return res.status(404).json({
      code: 404,
      message: 'Not found: ' + url,
      available: [
        '/api/platforms',
        '/api/trends', 
        '/api/materials', 
        '/api/groupon', 
        '/api/keywords',
        '/api/order'
      ]
    });
    
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json(error(err.message || 'Internal server error'));
  }
};

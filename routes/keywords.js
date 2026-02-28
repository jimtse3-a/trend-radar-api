// 热词相关API - 完全匹配飞书字段
const feishu = require('../utils/feishu');
const { success, error } = require('../utils/response');

// 表ID配置
const TABLES = {
  hotKeywords: process.env.FEISHU_TABLE_HOTKEYWORDS || 'tblVGbn4g1JwAGyA',
  rawMaterials: process.env.FEISHU_TABLE_RAWMATERIALS || 'tblkqeBQKbNSSlLe',
  groupBuying: process.env.FEISHU_TABLE_GROUPBUYING || 'tbl2Fy3xGOm1K4NS'
};

module.exports = async (req, res) => {
  const { method, query } = req;
  const path = req.url.split('?')[0];
  
  // GET /api/keywords - 获取热词列表
  if (method === 'GET' && path === '/api/keywords') {
    try {
      const result = await feishu.queryRecords(TABLES.hotKeywords);
      
      // 格式化数据 - 完全匹配飞书字段
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
      
      // 区域筛选
      if (query.region) {
        keywords = keywords.filter(k => 
          k.region.some(r => r.includes(query.region))
        );
      }
      
      // 热度筛选
      if (query.minHeat) {
        const minHeat = parseInt(query.minHeat);
        keywords = keywords.filter(k => k.heat_score >= minHeat);
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
      
      return res.status(200).json(success(formattedData));
    } catch (err) {
      console.error('获取热词失败:', err);
      return res.status(500).json(error(err.message));
    }
  }
  
  // GET /api/keywords/:id/materials - 获取热词关联的原料
  if (method === 'GET' && path.match(/\/api\/keywords\/[^/]+\/materials/)) {
    try {
      const keywordId = path.split('/')[3];
      
      // 先获取热词信息
      const keywordResult = await feishu.queryRecords(TABLES.hotKeywords);
      const keywordItem = keywordResult.items.find(item => 
        item.fields['热词ID'] == keywordId
      );
      
      if (!keywordItem || !keywordItem.fields['关联原料']) {
        return res.status(200).json(success([]));
      }
      
      // 获取关联的原料
      const relatedMaterials = keywordItem.fields['关联原料'];
      
      // 获取原料详情
      const materialsResult = await feishu.queryRecords(TABLES.rawMaterials);
      const materials = materialsResult.items
        .filter(item => relatedMaterials.includes(item.record_id))
        .map(item => {
          const fields = item.fields;
          return {
            id: item.record_id,
            code: fields['SKU编码'] || '',
            name: fields['原料名称'] || '',
            category: fields['所属品类'] || '',
            unit: fields['最小销售单位'] || '',
            package: fields['包装规格'] || '',
            original_price: fields['日常价（元）'] || 0,
            group_price: fields['集采价（元）'] || 0,
            min_quantity: fields['起订量'] || 1,
            supplier: fields['供应商'] || '',
            stock_status: fields['库存状态'] || '充足',
            scenes: fields['适用场景'] || []
          };
        });
      
      return res.status(200).json(success(materials));
    } catch (err) {
      console.error('获取关联原料失败:', err);
      return res.status(500).json(error(err.message));
    }
  }
  
  return res.status(404).json(error('Not found', 404));
};

// 集采活动相关API - 完全匹配飞书字段
const feishu = require('../utils/feishu');
const { success, error } = require('../utils/response');

// 表ID配置 - 使用团购爆品监测表
const TABLES = {
  groupBuying: process.env.FEISHU_TABLE_GROUPBUYING || 'tbl2Fy3xGOm1K4NS',
  rawMaterials: process.env.FEISHU_TABLE_RAWMATERIALS || 'tblkqeBQKbNSSlLe'
};

module.exports = async (req, res) => {
  const { method, query } = req;
  const path = req.url.split('?')[0];
  
  // GET /api/activities - 获取拼单活动列表（从团购爆品监测表）
  if (method === 'GET' && path === '/api/activities') {
    try {
      const result = await feishu.queryRecords(TABLES.groupBuying);
      
      // 格式化数据 - 完全匹配飞书字段
      let activities = result.items.map(item => {
        const fields = item.fields;
        return {
          id: item.record_id,
          product_id: fields['商品ID'] || '',
          platform: fields['平台'] || '',
          title: fields['商品名'] || '',
          category: fields['品类'] || '',
          sales_volume: fields['销量'] || 0,
          original_price: fields['原价'] || 0,
          group_price: fields['团购价'] || 0,
          heat_level: fields['热度等级'] || '',
          location: fields['商家位置'] || '',
          related_materials: fields['关联原料'] || [],
          on_shelf_time: fields['上架时间'] || '',
          created_at: fields['抓取时间'] || new Date().toISOString()
        };
      });
      
      // 分类筛选
      if (query.category) {
        activities = activities.filter(a => a.category === query.category);
      }
      
      // 排序
      switch (query.sort) {
        case 'price_asc':
          activities.sort((a, b) => (a.group_price || 0) - (b.group_price || 0));
          break;
        case 'price_desc':
          activities.sort((a, b) => (b.group_price || 0) - (a.group_price || 0));
          break;
        case 'sales':
          activities.sort((a, b) => (b.sales_volume || 0) - (a.sales_volume || 0));
          break;
        default:
          activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      
      // 分页
      const page = parseInt(query.page) || 1;
      const pageSize = parseInt(query.pageSize) || 10;
      const start = (page - 1) * pageSize;
      const paginated = activities.slice(start, start + pageSize);
      
      // 处理价格显示
      const formattedData = paginated.map(item => {
        const discount = item.original_price > 0 
          ? Math.round((1 - item.group_price / item.original_price) * 100)
          : 0;
          
        return {
          ...item,
          discount,
          unit_price_text: `¥${item.group_price.toFixed(2)}`,
          original_price_text: item.original_price > 0 ? `¥${item.original_price.toFixed(2)}` : ''
        };
      });
      
      return res.status(200).json(success(formattedData));
    } catch (err) {
      console.error('获取活动失败:', err);
      return res.status(500).json(error(err.message));
    }
  }
  
  // GET /api/activities/stats - 获取统计数据
  if (method === 'GET' && path === '/api/activities/stats') {
    try {
      const result = await feishu.queryRecords(TABLES.groupBuying);
      const activities = result.items.map(item => item.fields);
      
      const today = new Date().toISOString().split('T')[0];
      
      const todayNew = activities.filter(a => 
        a['抓取时间']?.startsWith(today)
      ).length;
      
      const totalActivities = activities.length;
      
      return res.status(200).json(success({
        todayNew: todayNew || 0,
        todayParticipants: 0,
        totalActivities: totalActivities || 0
      }));
    } catch (err) {
      console.error('获取统计失败:', err);
      return res.status(500).json(error(err.message));
    }
  }
  
  // GET /api/activities/:id - 获取活动详情
  if (method === 'GET' && path.match(/\/api\/activities\/[^/]+$/)) {
    try {
      const activityId = path.split('/')[3];
      
      const result = await feishu.queryRecords(TABLES.groupBuying);
      const activity = result.items.find(item => item.record_id === activityId);
      
      if (!activity) {
        return res.status(404).json(error('Activity not found', 404));
      }
      
      const fields = activity.fields;
      
      return res.status(200).json(success({
        id: activity.record_id,
        product_id: fields['商品ID'] || '',
        platform: fields['平台'] || '',
        title: fields['商品名'] || '',
        category: fields['品类'] || '',
        sales_volume: fields['销量'] || 0,
        original_price: fields['原价'] || 0,
        group_price: fields['团购价'] || 0,
        heat_level: fields['热度等级'] || '',
        location: fields['商家位置'] || '',
        related_materials: fields['关联原料'] || []
      }));
    } catch (err) {
      console.error('获取活动详情失败:', err);
      return res.status(500).json(error(err.message));
    }
  }
  
  return res.status(404).json(error('Not found', 404));
};

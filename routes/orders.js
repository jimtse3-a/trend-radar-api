// 订单相关API - 完全匹配飞书字段
const feishu = require('../utils/feishu');
const { success, error } = require('../utils/response');

// 表ID配置
const TABLES = {
  orders: process.env.FEISHU_TABLE_ORDERS || 'tblFthffbJ1y97HA',
  rawMaterials: process.env.FEISHU_TABLE_RAWMATERIALS || 'tblkqeBQKbNSSlLe'
};

module.exports = async (req, res) => {
  const { method } = req;
  const path = req.url.split('?')[0];
  
  // POST /api/orders - 创建订单
  if (method === 'POST' && path === '/api/orders') {
    try {
      const { material_id, quantity, contact_wechat } = req.body;
      
      if (!material_id || !quantity) {
        return res.status(400).json(error('Missing required fields', 400));
      }
      
      // 获取原料信息
      const materialsResult = await feishu.queryRecords(TABLES.rawMaterials);
      const materialItem = materialsResult.items.find(item => item.record_id === material_id);
      
      if (!materialItem) {
        return res.status(404).json(error('Material not found', 404));
      }
      
      const fields = materialItem.fields;
      const unitPrice = fields['集采价（元）'] || fields['日常价（元）'] || 0;
      const totalAmount = unitPrice * quantity;
      
      // 创建订单记录 - 匹配飞书字段
      const orderData = {
        '商家微信': contact_wechat || '',
        '原料SKU': [material_id],
        '数量': quantity,
        '单价': unitPrice,
        '总价': totalAmount,
        '状态': '拼单中',
        '成团门槛': fields['起订量'] || 1,
        '当前进度': 0,
        '创建时间': new Date().toISOString()
      };
      
      const orderResult = await feishu.createRecord(TABLES.orders, orderData);
      
      return res.status(200).json(success({
        order: {
          id: orderResult.record.record_id,
          ...orderData
        },
        message: 'Order created successfully'
      }));
    } catch (err) {
      console.error('创建订单失败:', err);
      return res.status(500).json(error(err.message));
    }
  }
  
  // GET /api/orders - 获取订单列表
  if (method === 'GET' && path === '/api/orders') {
    try {
      const result = await feishu.queryRecords(TABLES.orders);
      
      const orders = result.items.map(item => {
        const fields = item.fields;
        return {
          id: item.record_id,
          order_id: fields['订单ID'] || '',
          contact_wechat: fields['商家微信'] || '',
          material_sku: fields['原料SKU'] || [],
          quantity: fields['数量'] || 0,
          unit_price: fields['单价'] || 0,
          total_price: fields['总价'] || 0,
          status: fields['状态'] || '拼单中',
          threshold: fields['成团门槛'] || 0,
          progress: fields['当前进度'] || 0,
          created_at: fields['创建时间'] || '',
          paid_at: fields['支付时间'] || ''
        };
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      return res.status(200).json(success(orders));
    } catch (err) {
      console.error('获取订单失败:', err);
      return res.status(500).json(error(err.message));
    }
  }
  
  return res.status(404).json(error('Not found', 404));
};

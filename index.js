const feishu = require('./utils/feishu');

// 统一表 ID 配置，优先使用规划中的 FEISHU_TABLE_*，兼容旧变量
const TABLE_TRENDS =
  process.env.FEISHU_TABLE_TREND ||
  process.env.TABLE_TRENDS ||
  'tblVGbn4g1JwAGyA';
const TABLE_SKU =
  process.env.FEISHU_TABLE_SKU ||
  process.env.TABLE_SKU ||
  'tblkqeBQKbNSSlLe';
const TABLE_GROUPON =
  process.env.FEISHU_TABLE_GROUPON ||
  process.env.TABLE_GROUPON ||
  'tbl2Fy3xGOm1K4NS';
const TABLE_ORDERS =
  process.env.FEISHU_TABLE_ORDER ||
  process.env.TABLE_ORDERS ||
  'tblFthffbJ1y97HA';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url;
  const { query = {} } = req;
  
  if (url === '/' || url === '') {
    return res.json({
      code: 0,
      message: '咖续餐饮供应链 API',
      version: '2.0',
      endpoints: ['/api/trends', '/api/group-buy', '/api/groupon-hot', '/api/group-order'],
      data_sources: ['豆包', '千问', '小红书', '抖音', '千问团购', '淘宝闪购']
    });
  }

  // ========== 热词趋势库 /trends ==========
  if (url === '/trends' || url === '/api/trends' || url.startsWith('/trends?') || url.startsWith('/api/trends?')) {
    try {
      // 读取热词与原料 SKU，用于构建关联原料信息
      const [trendData, skuData] = await Promise.all([
        feishu.queryRecords(TABLE_TRENDS),
        feishu.queryRecords(TABLE_SKU)
      ]);

      const skuItems = skuData.items || [];
      const skuMap = {};
      skuItems.forEach(item => {
        skuMap[item.record_id] = item.fields || {};
      });

      let trends = (trendData.items || []).map(item => {
        const f = item.fields || {};
        const relatedMaterialIds = f['关联原料'] || [];

        // 关联原料名称列表（用于现有小程序展示）
        const materialNames = relatedMaterialIds
          .map(id => (skuMap[id] && skuMap[id]['原料名称']) || '')
          .filter(Boolean);

        // 关联原料详情（便于后续前端升级）
        const materialsDetail = relatedMaterialIds
          .map(id => {
            const mf = skuMap[id];
            if (!mf) return null;
            return {
              id,
              name: mf['原料名称'] || '',
              sku_code: mf['SKU编码'] || '',
              price: mf['集采价（元）'] || mf['日常价（元）'] || 0
            };
          })
          .filter(Boolean);

        return {
          id: item.record_id,
          keyword: f['热词文本'] || '',
          platform: f['平台来源'] || '',
          heat_score: f['热度值'] || 0,
          trend: f['趋势方向'] || '平稳',
          category: f['所属品类'] || '',
          region: f['地域属性'] || [],
          summary: f['内容摘要'] || '',
          update_time: f['抓取时间'],
          // 兼容现有小程序：字符串数组
          materials: materialNames,
          // 为后续前端优化预留
          materials_detail: materialsDetail
        };
      });

      // 平台筛选
      if (query.platform) {
        trends = trends.filter(t => t.platform === query.platform);
      }

      // 品类筛选
      if (query.category && query.category !== '全部') {
        trends = trends.filter(t => t.category === query.category);
      }
      
      // 按热度排序
      trends.sort((a, b) => b.heat_score - a.heat_score);
      
      return res.json({
        code: 0,
        data: {
          total: trends.length,
          platforms: ['豆包', '千问', '小红书', '抖音'],
          trends: trends
        }
      });
    } catch (err) {
      return res.status(500).json({ code: 500, message: err.message });
    }
  }

  // ========== 集采市场 /materials ==========
  if (url === '/materials' || url === '/api/group-buy' || url.startsWith('/materials?') || url.startsWith('/api/group-buy?')) {
    try {
      const [skuData, ordersData] = await Promise.all([
        feishu.queryRecords(TABLE_SKU),
        feishu.queryRecords(TABLE_ORDERS)
      ]);

      const orderItems = ordersData.items || [];
      const orderedQuantityBySku = {};

      // 聚合每个 SKU 已拼数量
      orderItems.forEach(order => {
        const f = order.fields || {};
        const skuLinks = f['原料SKU'] || [];
        const qty = Number(f['数量'] || 0);

        skuLinks.forEach(id => {
          if (!orderedQuantityBySku[id]) {
            orderedQuantityBySku[id] = 0;
          }
          orderedQuantityBySku[id] += qty;
        });
      });

      let materials = (skuData.items || []).map(item => {
        const f = item.fields || {};
        const normalPrice = f['日常价（元）'] || 0;
        const groupPrice = f['集采价（元）'] || 0;
        const minQuantity = f['起订量'] || 10;
        const orderedQty = orderedQuantityBySku[item.record_id] || 0;
        const progress =
          minQuantity > 0
            ? Math.max(0, Math.min(100, Math.round((orderedQty / minQuantity) * 100)))
            : 0;
        
        return {
          id: item.record_id,
          name: f['原料名称'] || '',
          category: f['所属品类'] || '',
          spec: f['包装规格'] || '',
          unit: f['最小销售单位'] || '箱',
          normal_price: normalPrice,
          group_price: groupPrice,
          save_amount: normalPrice - groupPrice,
          min_quantity: minQuantity,
          stock: f['库存状态'] || '充足',
          supplier: f['供应商'] || '待入驻供应商',
          related_trends: f['关联热词'] || [],
          scenes: f['适用场景'] || [],
          progress
        };
      }).filter(m => m.group_price > 0); // 只返回有集采价的

      // 品类筛选
      if (query.category && query.category !== '全部') {
        materials = materials.filter(m => m.category === query.category);
      }

      const categories = [...new Set(materials.map(m => m.category))];
      
      return res.json({
        code: 0,
        data: {
          categories: categories,
          materials: materials
        }
      });
    } catch (err) {
      return res.status(500).json({ code: 500, message: err.message });
    }
  }

  // ========== 团购爆品监测 /groupon ==========
  if (url === '/groupon' || url === '/api/groupon-hot' || url.startsWith('/groupon?') || url.startsWith('/api/groupon-hot?')) {
    try {
      const data = await feishu.queryRecords(TABLE_GROUPON);
      let products = (data.items || []).map(item => {
        const f = item.fields || {};
        const originalPrice = f['原价'] || 0;
        const grouponPrice = f['团购价'] || 0;
        
        return {
          id: item.record_id,
          platform: f['平台'] || '',
          name: f['商品名'] || '',
          category: f['品类'] || '',
          sales: f['销量'] || 0,
          original_price: originalPrice,
          groupon_price: grouponPrice,
          discount: originalPrice > 0 ? Math.round((1 - grouponPrice / originalPrice) * 100) + '%' : '0%',
          heat_level: f['热度等级'] || '一般',
          merchant_location: f['商家位置'] || '',
          related_materials: f['关联原料'] || [],
          publish_time: f['上架时间']
        };
      });

      // 平台筛选（千问团购 / 淘宝闪购）
      if (query.platform) {
        products = products.filter(p => p.platform === query.platform);
      }

      // 品类筛选
      if (query.category) {
        products = products.filter(p => p.category === query.category);
      }
      
      // 按销量排序
      products.sort((a, b) => b.sales - a.sales);
      
      return res.json({
        code: 0,
        data: {
          total: products.length,
          products: products
        }
      });
    } catch (err) {
      return res.status(500).json({ code: 500, message: err.message });
    }
  }

  // ========== 创建订单 /order ==========
  if (url === '/order' || url === '/api/group-order' || url.startsWith('/order?') || url.startsWith('/api/group-order?')) {
    if (req.method !== 'POST') {
      return res.status(405).json({ code: 405, message: 'Method not allowed' });
    }

    try {
      const body = req.body || {};
      const { material_id, quantity, merchant_wx } = body;
      
      if (!material_id || !quantity) {
        return res.status(400).json({ code: 400, message: '缺少必要参数' });
      }

      // 获取原料信息
      const skuData = await feishu.queryRecords(TABLE_SKU);
      const material = (skuData.items || []).find(item => item.record_id === material_id);
      
      if (!material) {
        return res.status(404).json({ code: 404, message: '原料不存在' });
      }

      const f = material.fields || {};
      const unitPrice = f['集采价（元）'] || 0;
      const total = unitPrice * quantity;
      const minQty = f['起订量'] || 10;

      // 创建订单（原料SKU 为关联字段，需传数组）
      const orderData = await feishu.createRecord(TABLE_ORDERS, {
        '商家微信': merchant_wx || '匿名用户',
        '原料SKU': [material_id],
        '数量': quantity,
        '单价': unitPrice,
        '总价': total,
        '状态': '拼单中',
        '成团门槛': minQty,
        '当前进度': quantity
      });

      return res.json({
        code: 0,
        data: {
          order_id: orderData.record.record_id,
          material_name: f['原料名称'],
          quantity: quantity,
          unit_price: unitPrice,
          total_amount: total,
          status: '拼单中',
          message: '订单创建成功'
        }
      });
    } catch (err) {
      return res.status(500).json({ code: 500, message: err.message });
    }
  }

  return res.status(404).json({ code: 404, message: 'Not found' });
};

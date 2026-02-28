// 团购爆品爬虫（千问团购 / 淘宝闪购）
// 同样，这里主要实现飞书写入逻辑，具体抓取需结合你自己的数据源或合作渠道。

const feishu = require('../utils/feishu');

const TABLE_GROUPON =
  process.env.FEISHU_TABLE_GROUPON ||
  process.env.TABLE_GROUPON ||
  'tbl2Fy3xGOm1K4NS';

// 需要生成的统一结构：
// { product_id, platform, name, category, sales, original_price, groupon_price, heat_level, location, publish_time }

// 为演示准备的千问团购餐饮爆品数据
async function fetchQianwenGrouponFoods() {
  return [
    {
      product_id: 'QW-20260226001',
      platform: '千问团购',
      name: '【爆卖】淄博烧烤3人套餐（含烤串+凉菜+啤酒）',
      category: '烧烤',
      sales: 15520,
      original_price: 168,
      groupon_price: 89,
      heat_level: '爆款',
      location: '山东省淄博市张店区',
      publish_time: '2026-02-20'
    },
    {
      product_id: 'QW-20260226002',
      platform: '千问团购',
      name: '一人食番茄牛腩小火锅套餐',
      category: '火锅',
      sales: 9820,
      original_price: 79,
      groupon_price: 49,
      heat_level: '热门',
      location: '上海市浦东新区',
      publish_time: '2026-02-18'
    },
    {
      product_id: 'QW-20260226003',
      platform: '千问团购',
      name: '手打柠檬茶自由畅饮（2小时）',
      category: '奶茶',
      sales: 12800,
      original_price: 49,
      groupon_price: 29,
      heat_level: '热门',
      location: '广州市天河区',
      publish_time: '2026-02-19'
    }
  ];
}

// 为演示准备的淘宝闪购（含原饿了么）餐饮爆品数据
async function fetchTaobaoFlashFoods() {
  return [
    {
      product_id: 'TB-20260226001',
      platform: '淘宝闪购',
      name: '城市露营烧烤双人自助套餐',
      category: '烧烤',
      sales: 11200,
      original_price: 199,
      groupon_price: 119,
      heat_level: '爆款',
      location: '北京市朝阳区',
      publish_time: '2026-02-17'
    },
    {
      product_id: 'TB-20260226002',
      platform: '淘宝闪购',
      name: '贵州酸汤鱼火锅双人餐',
      category: '火锅',
      sales: 8640,
      original_price: 169,
      groupon_price: 99,
      heat_level: '热门',
      location: '成都市武侯区',
      publish_time: '2026-02-16'
    },
    {
      product_id: 'TB-20260226003',
      platform: '淘宝闪购',
      name: '精品生椰拿铁·10杯次充值卡',
      category: '咖啡',
      sales: 7350,
      original_price: 268,
      groupon_price: 188,
      heat_level: '一般',
      location: '深圳市南山区',
      publish_time: '2026-02-15'
    }
  ];
}

async function collectAllGrouponProducts() {
  const [qianwen, taobao] = await Promise.all([
    fetchQianwenGrouponFoods(),
    fetchTaobaoFlashFoods()
  ]);

  return []
    .concat(qianwen || [])
    .concat(taobao || []);
}

async function main() {
  console.log('开始抓取千问团购 / 淘宝闪购餐饮爆品...');
  const products = await collectAllGrouponProducts();
  console.log(`共获取团购商品 ${products.length} 条，将写入飞书表 ${TABLE_GROUPON}`);

  const now = new Date().toISOString();

  for (const p of products) {
    const fields = {
      '商品ID': p.product_id || '',
      '平台': p.platform || '',
      '商品名': p.name || '',
      '品类': p.category || '',
      '销量': p.sales || 0,
      '原价': p.original_price || 0,
      '团购价': p.groupon_price || 0,
      '热度等级': p.heat_level || '一般',
      '商家位置': p.location || '',
      '关联原料': [], // 后续可通过规则或人工维护
      '上架时间': p.publish_time || '',
      '抓取时间': now
    };

    try {
      await feishu.createRecord(TABLE_GROUPON, fields);
      console.log('写入团购商品成功:', p.name, p.platform);
    } catch (e) {
      console.error('写入团购商品失败:', p.name, e.message);
    }
  }

  console.log('团购爆品抓取任务完成');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}


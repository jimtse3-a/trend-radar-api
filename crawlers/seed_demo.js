// 演示数据种子脚本：为「原料SKU库」和「集采订单表」写入一批可演示的数据
// 方便你一键跑出“有货、有进度”的集采市场场景。

const feishu = require('../utils/feishu');

const TABLE_SKU =
  process.env.FEISHU_TABLE_SKU ||
  process.env.TABLE_SKU ||
  'tblkqeBQKbNSSlLe';

const TABLE_ORDERS =
  process.env.FEISHU_TABLE_ORDER ||
  process.env.TABLE_ORDERS ||
  'tblFthffbJ1y97HA';

// 一批示例 SKU，覆盖烧烤 / 火锅 / 奶茶 / 咖啡等主要品类
const DEMO_SKUS = [
  {
    name: '特级烧烤孜然粉',
    category: '烧烤原料',
    unit: '箱',
    spec: '500g/袋，20袋/箱，总重10kg/箱',
    normalPrice: 450,
    groupPrice: 320,
    minQty: 10,
    stock: '充足',
    supplier: '鲁味食品（淄博）',
    trends: ['淄博烧烤', '深夜烧烤小店'],
    scenes: ['烧烤店', '夜宵档口']
  },
  {
    name: '贵州酸汤火锅底料',
    category: '火锅底料',
    unit: '箱',
    spec: '300g/袋，24袋/箱',
    normalPrice: 520,
    groupPrice: 398,
    minQty: 8,
    stock: '充足',
    supplier: '黔味工坊',
    trends: ['贵州酸汤火锅', '万物皆可火锅'],
    scenes: ['火锅店', '酸汤鱼馆']
  },
  {
    name: '手打柠檬茶专用茶汤包',
    category: '奶茶原料',
    unit: '箱',
    spec: '1L/包，12包/箱',
    normalPrice: 360,
    groupPrice: 268,
    minQty: 12,
    stock: '紧张',
    supplier: '岭南茶饮供应链',
    trends: ['手打柠檬茶'],
    scenes: ['奶茶店', '冷饮档']
  },
  {
    name: '生椰拿铁咖啡液',
    category: '咖啡原料',
    unit: '箱',
    spec: '500ml/瓶，15瓶/箱',
    normalPrice: 680,
    groupPrice: 528,
    minQty: 6,
    stock: '充足',
    supplier: '精品咖啡工厂',
    trends: ['生椰拿铁', '冰美式续杯'],
    scenes: ['咖啡店', '轻食店']
  }
];

async function seedSkusIfEmpty() {
  console.log('检查原料SKU表是否已有数据...');
  const existing = await feishu.queryRecords(TABLE_SKU);
  const items = existing.items || [];

  if (items.length > 0) {
    console.log(`原料SKU表已有 ${items.length} 条记录，跳过种子写入。`);
    return items;
  }

  console.log('原料SKU表为空，开始写入演示SKU...');

  const created = [];

  for (const sku of DEMO_SKUS) {
    const fields = {
      '原料名称': sku.name,
      '所属品类': sku.category,
      '最小销售单位': sku.unit,
      '包装规格': sku.spec,
      '日常价（元）': sku.normalPrice,
      '集采价（元）': sku.groupPrice,
      '起订量': sku.minQty,
      '供应商': sku.supplier,
      '库存状态': sku.stock,
      '关联热词': sku.trends || [],
      '适用场景': sku.scenes || [],
      '更新时间': new Date().toISOString()
    };

    try {
      const res = await feishu.createRecord(TABLE_SKU, fields);
      const record = res.record;
      created.push(record);
      console.log('创建SKU成功:', sku.name, record.record_id);
    } catch (e) {
      console.error('创建SKU失败:', sku.name, e.message);
    }
  }

  return created;
}

async function seedOrdersForSkus(skuRecords) {
  if (!skuRecords || skuRecords.length === 0) {
    console.log('没有可用SKU，跳过订单种子创建。');
    return;
  }

  console.log('开始为每个SKU创建一笔演示订单，用于成团进度展示...');

  for (const record of skuRecords) {
    const fields = record.fields || {};
    const skuId = record.record_id;
    const skuName = fields['原料名称'] || '未知原料';
    const groupPrice = fields['集采价（元）'] || fields['日常价（元）'] || 0;
    const minQty = fields['起订量'] || 10;

    // 设定一个“当前进度”为 40%~80% 之间的随机值
    const targetPercent = Math.floor(40 + Math.random() * 40); // 40~80
    const quantity = Math.max(1, Math.round((minQty * targetPercent) / 100));
    const total = groupPrice * quantity;

    const orderFields = {
      '商家微信': 'demo_merchant',
      '原料SKU': [skuId],
      '数量': quantity,
      '单价': groupPrice,
      '总价': total,
      '状态': '拼单中',
      '成团门槛': minQty,
      '当前进度': quantity,
      '创建时间': new Date().toISOString()
    };

    try {
      const res = await feishu.createRecord(TABLE_ORDERS, orderFields);
      console.log(
        '创建订单成功:',
        skuName,
        '数量:',
        quantity,
        '订单ID:',
        res.record.record_id
      );
    } catch (e) {
      console.error('创建订单失败:', skuName, e.message);
    }
  }
}

async function main() {
  console.log('=== 演示数据种子脚本开始 ===');
  console.log('目标表：SKU =', TABLE_SKU, '订单 =', TABLE_ORDERS);

  const existing = await feishu.queryRecords(TABLE_SKU);
  let skuRecords = existing.items || [];

  if (skuRecords.length === 0) {
    skuRecords = await seedSkusIfEmpty();
  } else {
    console.log('使用现有SKU记录，不重复创建。');
  }

  await seedOrdersForSkus(skuRecords);

  console.log('=== 演示数据种子脚本完成 ===');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}


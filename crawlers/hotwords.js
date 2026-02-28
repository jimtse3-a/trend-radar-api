// 多平台餐饮热词爬虫（豆包 / 千问 / 小红书 / 抖音）
// 说明：真实平台接口和反爬策略经常变动，这里提供结构化脚本骨架与飞书写入逻辑，
// 抓取部分需要根据你的实际可用 API 或 HTML 结构自行补充。

const feishu = require('../utils/feishu');

const TABLE_TRENDS =
  process.env.FEISHU_TABLE_TREND ||
  process.env.TABLE_TRENDS ||
  'tblVGbn4g1JwAGyA';

// 简单的餐饮相关关键词过滤
const FOOD_KEYWORDS = ['烧烤', '火锅', '奶茶', '咖啡', '预制菜', '小吃', '餐厅', '串串', '炸鸡', '烤鱼'];

function isFoodRelated(keyword = '') {
  return FOOD_KEYWORDS.some(k => keyword.includes(k));
}

// 下面四个函数在 MVP 阶段直接返回精心设计的演示数据，
// 方便你一键生成可展示的多平台餐饮热词。
async function fetchDoubaoHotwords() {
  return [
    {
      keyword: '淄博烧烤',
      platform: '豆包',
      heat_score: 96,
      trend: '飙升',
      category: '烧烤',
      region: ['全国', '华东'],
      summary: '淄博烧烤持续走红，周末跨城自驾游订单大涨。'
    },
    {
      keyword: '万物皆可火锅',
      platform: '豆包',
      heat_score: 88,
      trend: '上升',
      category: '火锅',
      region: ['一线城市', '新一线'],
      summary: '年轻人尝试海鲜、水果等“新奇锅底”，社交属性强。'
    },
    {
      keyword: '手打柠檬茶',
      platform: '豆包',
      heat_score: 82,
      trend: '上升',
      category: '奶茶',
      region: ['华南', '下沉市场'],
      summary: '低成本现制柠檬茶，在下沉市场连锁门店快速铺开。'
    }
  ];
}

async function fetchQianwenHotwords() {
  return [
    {
      keyword: '自助烤肉餐厅',
      platform: '千问',
      heat_score: 90,
      trend: '飙升',
      category: '烧烤',
      region: ['一线城市', '新一线'],
      summary: '人均 59.9 的自助烤肉套餐，在写字楼商圈特别受欢迎。'
    },
    {
      keyword: '番茄牛腩锅',
      platform: '千问',
      heat_score: 76,
      trend: '上升',
      category: '火锅',
      region: ['华东', '华中'],
      summary: '比牛油锅更轻盈，更适合家庭客群和女性消费者。'
    },
    {
      keyword: '冰美式续杯',
      platform: '千问',
      heat_score: 68,
      trend: '平稳',
      category: '咖啡',
      region: ['一线城市'],
      summary: '咖啡店通过“续杯半价”活动提升客单价与复购。'
    }
  ];
}

async function fetchXiaohongshuHotwords() {
  return [
    {
      keyword: '深夜烧烤小店',
      platform: '小红书',
      heat_score: 92,
      trend: '飙升',
      category: '烧烤',
      region: ['一线城市', '地方性'],
      summary: '大量探店笔记曝光“深夜路边摊”风格的精致小店。'
    },
    {
      keyword: '贵州酸汤火锅',
      platform: '小红书',
      heat_score: 80,
      trend: '上升',
      category: '火锅',
      region: ['西南', '全国'],
      summary: '酸汤底料在全国复制，预制酸汤包需求上升。'
    },
    {
      keyword: '手打牛肉丸',
      platform: '小红书',
      heat_score: 74,
      trend: '上升',
      category: '火锅',
      region: ['华南', '华东'],
      summary: '视频内容强调“现打现煮”，对冷冻丸子形成替代。'
    }
  ];
}

async function fetchDouyinHotwords() {
  return [
    {
      keyword: '露营烧烤套餐',
      platform: '抖音',
      heat_score: 89,
      trend: '飙升',
      category: '烧烤',
      region: ['下沉市场', '华北'],
      summary: '郊野露营搭配“全套烧烤食材包”，带动一站式采购。'
    },
    {
      keyword: '一人食小火锅',
      platform: '抖音',
      heat_score: 83,
      trend: '上升',
      category: '火锅',
      region: ['一线城市', '新一线'],
      summary: '单人小锅 + 即食菜品，午间商务人群偏好明显。'
    },
    {
      keyword: '生椰拿铁',
      platform: '抖音',
      heat_score: 78,
      trend: '平稳',
      category: '咖啡',
      region: ['全国'],
      summary: '仍然是咖啡品类的长红单品，生椰基底需求稳定。'
    }
  ];
}

// 统一字段格式：
// { keyword, platform, heat_score, trend, category, region, summary }
async function collectAllHotwords() {
  const [doubao, qianwen, xhs, douyin] = await Promise.all([
    fetchDoubaoHotwords(),
    fetchQianwenHotwords(),
    fetchXiaohongshuHotwords(),
    fetchDouyinHotwords()
  ]);

  const all = []
    .concat(doubao || [])
    .concat(qianwen || [])
    .concat(xhs || [])
    .concat(douyin || []);

  // 只保留餐饮相关
  return all.filter(item => isFoodRelated(item.keyword || ''));
}

async function main() {
  console.log('开始抓取多平台餐饮热词...');
  const hotwords = await collectAllHotwords();
  console.log(`共获取原始热词 ${hotwords.length} 条，将写入飞书表 ${TABLE_TRENDS}`);

  const now = new Date();

  for (const hw of hotwords) {
    const fields = {
      '热词文本': hw.keyword || '',
      '平台来源': hw.platform || '',
      '热度值': hw.heat_score || 0,
      '趋势方向': hw.trend || '平稳',
      '所属品类': hw.category || '',
      '地域属性': hw.region || [],
      '关联原料': [], // 先留空，后续在飞书里人工关联
      '内容摘要': hw.summary || '',
      '抓取时间': now.toISOString()
    };

    try {
      await feishu.createRecord(TABLE_TRENDS, fields);
      console.log('写入热词成功:', hw.keyword, hw.platform);
    } catch (e) {
      console.error('写入热词失败:', hw.keyword, e.message);
    }
  }

  console.log('热词抓取任务完成');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}


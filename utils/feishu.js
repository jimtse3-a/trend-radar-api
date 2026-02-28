// 飞书多维表格 API 客户端
const https = require('https');
const path = require('path');

// 本地开发时加载 api 目录下的 .env（线上 Vercel 会用系统环境变量）
try {
  // 懒加载，避免 dotenv 未安装时报错影响运行
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (e) {
  // ignore
}

class FeishuClient {
  constructor() {
    // 支持新老环境变量名称，优先使用规划中的 FEISHU_APP_ID 等
    this.appId = process.env.FEISHU_APP_ID || process.env.FEISHU_APPID;
    this.appSecret = process.env.FEISHU_APP_SECRET || process.env.FEISHU_SECRET;
    this.baseId = process.env.FEISHU_BASE_ID || process.env.FEISHU_BASEID;
    this.accessToken = null;
    this.tokenExpireTime = 0;
  }

  // 获取访问令牌
  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret
      });

      const options = {
        hostname: 'open.feishu.cn',
        // 使用 tenant_access_token（与Python爬虫保持一致）
        path: '/open-apis/auth/v3/tenant_access_token/internal',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            if (result.code === 0 && result.tenant_access_token) {
              this.accessToken = result.tenant_access_token;
              this.tokenExpireTime = Date.now() + (result.expire - 300) * 1000;
              resolve(this.accessToken);
            } else {
              reject(new Error(result.msg || 'Failed to get Feishu tenant_access_token'));
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  // 查询记录
  async queryRecords(tableId, options = {}) {
    const token = await this.getAccessToken();
    
    return new Promise((resolve, reject) => {
      let path = `/open-apis/bitable/v1/apps/${this.baseId}/tables/${tableId}/records?page_size=500`;
      
      if (options.filter) {
        path += `&filter=${encodeURIComponent(options.filter)}`;
      }
      
      const reqOptions = {
        hostname: 'open.feishu.cn',
        path: path,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };

      const req = https.request(reqOptions, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            if (result.code === 0) {
              resolve(result.data);
            } else {
              reject(new Error(result.msg));
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  // 创建记录
  async createRecord(tableId, fields) {
    const token = await this.getAccessToken();
    
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({ fields });
      
      const options = {
        hostname: 'open.feishu.cn',
        path: `/open-apis/bitable/v1/apps/${this.baseId}/tables/${tableId}/records`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            if (result.code === 0) {
              resolve(result.data);
            } else {
              reject(new Error(result.msg));
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
}

module.exports = new FeishuClient();

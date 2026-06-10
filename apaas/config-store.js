const Redis = require('ioredis');

class ConfigStore {
  constructor(redisOptions = {}, key = 'apaas:config') {
    this.redis = new Redis(redisOptions);
    this.key = key;
    this.defaultConfig = {
      host: 'bits.feishu.cn',
      namespaces: ['package_d771c2__c'],
      token: '',
      cookie: '',
      languageCode: '2052',
      secChUa: '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
      acceptLanguage: 'zh-CN,zh;q=0.9',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
      origin: '',
      referer: '',
    };
  }

  async getConfig() {
    const data = await this.redis.get(this.key);
    if (!data) {
      return { ...this.defaultConfig };
    }
    try {
      return { ...this.defaultConfig, ...JSON.parse(data) };
    } catch (e) {
      return { ...this.defaultConfig };
    }
  }

  async setConfig(config) {
    await this.redis.set(this.key, JSON.stringify(config));
    return config;
  }

  async updateTokenAndCookie(token, cookie) {
    const config = await this.getConfig();
    config.token = token;
    config.cookie = cookie;
    await this.setConfig(config);
    return config;
  }

  async updatePartial(partial) {
    const config = await this.getConfig();
    Object.assign(config, partial);
    await this.setConfig(config);
    return config;
  }

  async quit() {
    await this.redis.quit();
  }
}

module.exports = ConfigStore;

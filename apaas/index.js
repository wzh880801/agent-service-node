const path = require('path');
const express = require('express');
const ConfigStore = require('./config-store');
const ApaasClient = require('./client');
const LogScheduler = require('./scheduler');
const { createApaasRouter } = require('./server');

/**
 * 快捷挂载 aPaaS 模块到 Express 应用
 * @param {import('express').Application} app
 * @param {object} options
 * @param {object} options.redisOptions ioredis 连接配置，默认连接本地 6379
 * @param {string} options.interval 定时任务间隔，如 '10m', '30m', '1h'，默认 '10m'
 * @param {string[]} options.namespaces 指定要轮询的 namespace，默认使用 redis 配置中的 namespaces
 * @returns {{ configStore: ConfigStore, client: ApaasClient, scheduler: LogScheduler }}
 */
function setup(app, options = {}) {
  const redisUrl = process.env['REDIS_CONN_URL'];
  const redisOptions = options.redisOptions || (redisUrl ? redisUrl : {
    host: process.env['REDIS_HOST'] || '127.0.0.1',
    port: process.env['REDIS_PORT'] ? parseInt(process.env['REDIS_PORT'], 10) : 6379,
    db: process.env['REDIS_DB_NUMBER'] ? parseInt(process.env['REDIS_DB_NUMBER'], 10) : 15,
  });
  const configStore = new ConfigStore(redisOptions);
  const client = new ApaasClient(configStore);
  const schedulerOptions = {
    interval: options.interval || '10m',
    namespaces: options.namespaces || [],
  };
  const scheduler = new LogScheduler(configStore, client, schedulerOptions);

  const router = createApaasRouter(configStore, client, scheduler);

  // 静态配置页面
  app.use('/apaas', express.static(path.join(__dirname, 'public')));
  // JSON 解析 + 业务路由
  app.use('/apaas', express.json());
  app.use('/apaas', router);

  return { configStore, client, scheduler };
}

module.exports = {
  ConfigStore,
  ApaasClient,
  LogScheduler,
  createApaasRouter,
  setup,
};

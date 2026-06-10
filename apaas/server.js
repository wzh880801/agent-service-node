const express = require('express');
const logger = require('../log/log_helper_v2').default().useFile(__filename).useSingleAppendMode();

function createApaasRouter(configStore, client, scheduler = null) {
  const router = express.Router();

  // 获取当前配置
  router.get('/api/config', async (req, res) => {
    try {
      const config = await configStore.getConfig();
      res.json({ success: true, data: config });
    } catch (err) {
      logger.error('[aPaaSServer] Get config failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 更新完整配置
  router.post('/api/config', async (req, res) => {
    try {
      const config = await configStore.setConfig(req.body);
      logger.info('[aPaaSServer] Config updated');
      res.json({ success: true, data: config });
    } catch (err) {
      logger.error('[aPaaSServer] Update config failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 远程更新 token 和 cookie
  router.post('/api/config/token', async (req, res) => {
    try {
      const { token, cookie } = req.body;
      if (token === undefined || cookie === undefined) {
        return res.status(400).json({ success: false, message: 'token and cookie are required' });
      }
      const config = await configStore.updateTokenAndCookie(token, cookie);
      logger.info('[aPaaSServer] Token and cookie updated');
      res.json({ success: true, data: config });
    } catch (err) {
      logger.error('[aPaaSServer] Update token/cookie failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 应用管理日志列表
  router.post('/api/logs/:namespace/app_manage/list', async (req, res) => {
    try {
      const data = await client.getAppManageLogList(req.params.namespace, req.body);
      res.json(data);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 应用管理日志详情
  router.get('/api/logs/:namespace/app_manage/detail', async (req, res) => {
    try {
      const data = await client.getAppManageLogDetail(req.params.namespace, req.query.logID);
      res.json(data);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 登录日志列表
  router.post('/api/logs/:namespace/login/list', async (req, res) => {
    try {
      const data = await client.getLoginLogList(req.params.namespace, req.body);
      res.json(data);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 登录日志详情
  router.get('/api/logs/:namespace/login/detail', async (req, res) => {
    try {
      const data = await client.getLoginLogDetail(req.params.namespace, req.query.logID);
      res.json(data);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 数据变更日志列表
  router.post('/api/logs/:namespace/data_change/list', async (req, res) => {
    try {
      const data = await client.getDataChangeLogList(req.params.namespace, req.body);
      res.json(data);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 数据变更日志详情
  router.get('/api/logs/:namespace/data_change/detail', async (req, res) => {
    try {
      const data = await client.getDataChangeLogDetail(req.params.namespace, req.query.logID);
      res.json(data);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 流程运行时日志列表
  router.post('/api/logs/:namespace/flow_runtime/list', async (req, res) => {
    try {
      const data = await client.getFlowRuntimeLogList(req.params.namespace, req.body);
      res.json(data);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Scheduler 控制
  if (scheduler) {
    router.post('/api/scheduler/start', async (req, res) => {
      try {
        if (scheduler.isRunning()) {
          return res.json({ success: true, message: 'Scheduler is already running' });
        }
        await scheduler.start();
        logger.info('[aPaaSServer] Scheduler started');
        res.json({ success: true, message: 'Scheduler started', intervalMs: scheduler.getIntervalMs() });
      } catch (err) {
        logger.error('[aPaaSServer] Start scheduler failed:', err.message);
        res.status(500).json({ success: false, message: err.message });
      }
    });

    router.post('/api/scheduler/stop', async (req, res) => {
      try {
        scheduler.stop();
        logger.info('[aPaaSServer] Scheduler stopped');
        res.json({ success: true, message: 'Scheduler stopped' });
      } catch (err) {
        logger.error('[aPaaSServer] Stop scheduler failed:', err.message);
        res.status(500).json({ success: false, message: err.message });
      }
    });

    router.get('/api/scheduler/status', async (req, res) => {
      try {
        res.json({ success: true, data: { running: scheduler.isRunning(), intervalMs: scheduler.getIntervalMs() } });
      } catch (err) {
        logger.error('[aPaaSServer] Get scheduler status failed:', err.message);
        res.status(500).json({ success: false, message: err.message });
      }
    });
  }

  return router;
}

module.exports = { createApaasRouter };

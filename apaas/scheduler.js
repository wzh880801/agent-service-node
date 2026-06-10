const logger = require('../log/log_helper_v2').default().useFile(__filename).useSingleAppendMode();

class LogScheduler {
  constructor(configStore, client, options = {}) {
    this.configStore = configStore;
    this.client = client;
    this.logger = logger;
    this.intervalMs = this._parseInterval(options.interval || '1m');
    this.namespaces = options.namespaces || [];
    this.timer = null;
    this.running = false;
    this.redis = configStore.redis;
  }

  _parseInterval(val) {
    const match = String(val).match(/^(\d+)([smh])$/);
    if (!match) return 10 * 60 * 1000;
    const num = parseInt(match[1], 10);
    const unit = match[2];
    let ms = 10 * 60 * 1000;
    if (unit === 's') ms = num * 1000;
    if (unit === 'm') ms = num * 60 * 1000;
    if (unit === 'h') ms = num * 60 * 60 * 1000;
    // 限制 10min ~ 1h
    const MIN = 10 * 60 * 1000;
    const MAX = 60 * 60 * 1000;
    return Math.min(MAX, Math.max(MIN, ms));
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.logger.info(`[LogScheduler] Starting, interval=${this.intervalMs}ms`);
    await this._tick();
    this.timer = setInterval(() => this._tick(), this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    this.logger.info('[LogScheduler] Stopped');
  }

  isRunning() {
    return this.running;
  }

  getIntervalMs() {
    return this.intervalMs;
  }

  async _tick() {
    try {
      const config = await this.configStore.getConfig();
      const namespaces = this.namespaces.length > 0
        ? this.namespaces
        : (config.namespaces || []);

      for (const namespace of namespaces) {
        this.logger.config({ namespace });

        await this._syncAppManageLogs(namespace);
        await this._syncLoginLogs(namespace);
        await this._syncDataChangeLogs(namespace);
      }
    } catch (err) {
      this.logger.error('[LogScheduler] Tick error:', err.message);
    }
  }

  async _getLastTo(namespace, logType) {
    const key = `apaas:cursor:${namespace}:${logType}:to`;
    const val = await this.redis.get(key);
    return val ? parseInt(val, 10) : 0;
  }

  async _setLastTo(namespace, logType, to) {
    const key = `apaas:cursor:${namespace}:${logType}:to`;
    await this.redis.set(key, String(to));
  }

  _computeWindow(lastTo) {
    const now = Date.now();
    const to = now - 5 * 60 * 1000; // 当前时间戳 - 5min
    const from = lastTo > 0 ? lastTo : now - 10 * 60 * 1000; // 首次: now - 10min
    return { from, to };
  }

  async _fetchListWithPagination(listFn, namespace, from, to) {
    const pageSize = 20;
    const allItems = [];
    let offset = 0;

    while (true) {
      const listData = await listFn(namespace, { from, to, pageSize, offset });
      const items = listData?.data?.items || [];
      const total = listData?.data?.total || 0;
      allItems.push(...items);

      if (allItems.length >= total || items.length === 0) {
        break;
      }
      offset += pageSize;
    }

    return allItems;
  }

  async _syncAppManageLogs(namespace) {
    const logType = 'app_manage';
    const lastTo = await this._getLastTo(namespace, logType);
    const { from, to } = this._computeWindow(lastTo);

    this.logger.info(`[AppManage] namespace=${namespace}, from=${from}, to=${to}`);

    let items;
    try {
      items = await this._fetchListWithPagination(
        (ns, params) => this.client.getAppManageLogList(ns, params),
        namespace, from, to
      );
    } catch (err) {
      this.logger.error(`[AppManage] List failed: ${err.message}`);
      return;
    }

    this.logger.info(`[AppManage] Got ${items.length} items`);

    for (const item of items) {
      this.logger
        .append({ ext: logType, __timestamp__: item.opTime })
        .info(item);
      const logID = item.logID;

      try {
        const detail = await this.client.getAppManageLogDetail(namespace, logID);
        this.logger
          .append({ ext: logType, __timestamp__: item.opTime })
          .info(detail);
      } catch (err) {
        this.logger.error(`[AppManage] Detail failed logID=${logID}: ${err.message}`);
      }
    }

    await this._setLastTo(namespace, logType, to);
  }

  async _syncLoginLogs(namespace) {
    const logType = 'login';
    const lastTo = await this._getLastTo(namespace, logType);
    const { from, to } = this._computeWindow(lastTo);

    this.logger.info(`[Login] namespace=${namespace}, from=${from}, to=${to}`);

    let items;
    try {
      items = await this._fetchListWithPagination(
        (ns, params) => this.client.getLoginLogList(ns, params),
        namespace, from, to
      );
    } catch (err) {
      this.logger.error(`[Login] List failed: ${err.message}`);
      return;
    }

    this.logger.info(`[Login] Got ${items.length} items`);

    for (const item of items) {
      this.logger
        .append({ ext: logType, __timestamp__: item.opTime })
        .info(item);
      const logID = item.logID;

      try {
        const detail = await this.client.getLoginLogDetail(namespace, logID);
        this.logger
          .append({ ext: logType, __timestamp__: item.opTime })
          .info(detail);
      } catch (err) {
        this.logger.error(`[Login] Detail failed logID=${logID}: ${err.message}`);
      }
    }

    await this._setLastTo(namespace, logType, to);
  }

  async _syncDataChangeLogs(namespace) {
    const logType = 'data_change';
    const lastTo = await this._getLastTo(namespace, logType);
    const { from, to } = this._computeWindow(lastTo);

    this.logger.info(`[DataChange] namespace=${namespace}, from=${from}, to=${to}`);

    let items;
    try {
      items = await this._fetchListWithPagination(
        (ns, params) => this.client.getDataChangeLogList(ns, params),
        namespace, from, to
      );
    } catch (err) {
      this.logger.error(`[DataChange] List failed: ${err.message}`);
      return;
    }

    this.logger.info(`[DataChange] Got ${items.length} items`);

    for (const item of items) {
      this.logger
        .append({ ext: logType, __timestamp__: item.opTime })
        .info(item);
      const logID = item.logID;

      try {
        const detail = await this.client.getDataChangeLogDetail(namespace, logID);
        this.logger
          .append({ ext: logType, __timestamp__: item.opTime })
          .info(detail);
      } catch (err) {
        this.logger.error(`[DataChange] Detail failed logID=${logID}: ${err.message}`);
      }
    }

    await this._setLastTo(namespace, logType, to);
  }
}

module.exports = LogScheduler;

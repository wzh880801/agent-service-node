const axios = require('axios');
const { sendAuthExpiredCard } = require('./notify');

const LOG_TYPE = {
  APP_MANAGE: 10003,
  LOGIN: 10002,
  DATA_CHANGE: 10007,
};

const SVC_METHOD = {
  GET_LIST: 'SearchService_GetUnifiedAuditLogList',
  GET_DETAIL: 'SearchService_GetUnifiedAuditLogDetail',
  GET_DATA_CHANGE_LIST: 'SearchService_GetDataChangeUnifiedAuditLogList',
  GET_DATA_CHANGE_DETAIL: 'SearchService_GetDataChangeUnifiedAuditLogDetail',
};

class ApaasClient {
  constructor(configStore) {
    this.configStore = configStore;
  }

  _getHost(config) {
    return config.host || 'bits.feishu.cn';
  }

  _buildBaseHeaders(config, namespace) {
    if (!config.token) throw new Error('Missing x-kunlun-token in config');
    if (!config.cookie) throw new Error('Missing cookie in config');

    return {
      'Content-Type': 'application/json',
      'x-kunlun-token': config.token,
      'Cookie': config.cookie,
      'x-kunlun-language-code': config.languageCode || '2052',
      'sec-ch-ua': config.secChUa || '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
      'accept': 'application/json, text/plain, */*',
      'accept-language': config.acceptLanguage || 'zh-CN,zh;q=0.9',
      'user-agent': config.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
      'x-kunlun-apitype': 'design',
      'x-lgw-os-type': '3',
      'x-lgw-terminal-type': '2',
      'origin': config.origin || `https://${config.host || 'bits.feishu.cn'}`,
      'referer': config.referer || `https://${config.host || 'bits.feishu.cn'}/ae/app_manage/${namespace || config.namespaces?.[0] || 'package_d771c2__c'}/audit_log/app_manage`,
    };
  }

  async _request(method, url, data = null, extraHeaders = {}, namespace) {
    const config = await this.configStore.getConfig();
    const host = this._getHost(config);
    const baseHeaders = this._buildBaseHeaders(config, namespace);

    const fullUrl = `https://${host}${url}`;

    const response = await axios({
      method,
      url: fullUrl,
      data,
      headers: {
        ...baseHeaders,
        ...extraHeaders,
      },
      timeout: 30000,
    });

    const result = response.data;
    const EXPIRED_CODES = ['k_gw_ec_000014', 'k_gw_ec_000036'];
    if (result?.status_code && EXPIRED_CODES.includes(String(result.status_code))) {
      sendAuthExpiredCard(result.status_code, result.error_msg);
      throw new Error(`aPaaS auth expired: ${result.status_code} - ${result.error_msg || 'please re-login'}`);
    }

    return result;
  }

  /** 获取应用管理日志列表 */
  async getAppManageLogList(namespace, params = {}) {
    const body = {
      pageSize: 20,
      offset: 0,
      from: Date.now() - 7 * 24 * 60 * 60 * 1000,
      to: Date.now(),
      logType: LOG_TYPE.APP_MANAGE,
      columns: ['opTime', 'module', 'eventName', 'clientIP', 'operator', 'status'],
      ...params,
    };
    return this._request('POST', `/ae/api/v1/ksearch/namespaces/${namespace}/audit_log/logs_list`, body, {
      'x-svc-method': SVC_METHOD.GET_LIST,
    }, namespace);
  }

  /** 获取应用管理日志详情 */
  async getAppManageLogDetail(namespace, logID) {
    return this._request('GET', `/ae/api/v1/ksearch/namespaces/${namespace}/audit_log/log_detail?logID=${encodeURIComponent(logID)}`, null, {
      'x-svc-method': SVC_METHOD.GET_DETAIL,
    }, namespace);
  }

  /** 获取登录日志列表 */
  async getLoginLogList(namespace, params = {}) {
    const body = {
      pageSize: 20,
      offset: 0,
      from: Date.now() - 7 * 24 * 60 * 60 * 1000,
      to: Date.now(),
      logType: LOG_TYPE.LOGIN,
      columns: ['opTime', 'eventName', 'clientIP', 'operator', 'status'],
      ...params,
    };
    return this._request('POST', `/ae/api/v1/ksearch/namespaces/${namespace}/audit_log/logs_list`, body, {
      'x-svc-method': SVC_METHOD.GET_LIST,
    }, namespace);
  }

  /** 获取登录日志详情 */
  async getLoginLogDetail(namespace, logID) {
    return this._request('GET', `/ae/api/v1/ksearch/namespaces/${namespace}/audit_log/log_detail?logID=${encodeURIComponent(logID)}`, null, {
      'x-svc-method': SVC_METHOD.GET_DETAIL,
    }, namespace);
  }

  /** 获取数据变更日志列表 */
  async getDataChangeLogList(namespace, params = {}) {
    const body = {
      pageSize: 20,
      offset: 0,
      from: Date.now() - 7 * 24 * 60 * 60 * 1000,
      to: Date.now(),
      logType: LOG_TYPE.DATA_CHANGE,
      columns: ['opTime', 'module', 'eventName', 'operator', 'status', 'dataObjectName', 'dataRecordID'],
      ...params,
    };
    return this._request('POST', `/ae/api/v1/ksearch/namespaces/${namespace}/audit_log/data_change/logs_list`, body, {
      'x-svc-method': SVC_METHOD.GET_DATA_CHANGE_LIST,
    }, namespace);
  }

  /** 获取数据变更日志详情 */
  async getDataChangeLogDetail(namespace, logID) {
    return this._request('GET', `/ae/api/v1/ksearch/namespaces/${namespace}/audit_log/data_change/log_detail?logID=${encodeURIComponent(logID)}`, null, {
      'x-svc-method': SVC_METHOD.GET_DATA_CHANGE_DETAIL,
    }, namespace);
  }

  /** 获取流程详细日志（运行时日志） */
  async getFlowRuntimeLogList(namespace, params = {}) {
    const body = {
      limit: 50,
      offset: 0,
      flow_instance_id: '',
      search: '',
      filters: {},
      ...params,
    };
    return this._request('POST', `/ae/api/v1/monitor_engine/namespaces/${namespace}/runtime_log/search_logs`, body, {}, namespace);
  }
}

module.exports = ApaasClient;

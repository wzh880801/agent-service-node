const {
    getAppMetrics
} = require('./index');
const { addDualAppConfig } = require('../prom/yaml-helper');

const logger = require('../log/log_helper_v2').default().useFile(__filename).useSingleAppendMode();

const { PROCESS_DEV_EVENTS } = require('../mode-cfg');
const is_process_dev_events = PROCESS_DEV_EVENTS === '1' || PROCESS_DEV_EVENTS === 'true';

/**
 * 
 * @param {import('../data').IBaseMetric} metric 
 * @returns {import('prom-client').MetricObject | undefined}
 */
function getMetricObject(metric) {
    const app_id = `${metric.attributes.tenant_id}_${metric.attributes.namespace}`;
    const metrics = getAppMetrics(app_id);
    if (!metrics) {
        throw new Error(`can not find the metric defination for ${app_id}`);
    }

    return metrics[metric.name];
}

/**
 * 
 * @param {Array<import('../data').IBaseMetric>} metrics 
 * @param {string} __trace_id 
 */
async function processMetrics(metrics, __trace_id) {

    const _logger = logger.default().new();
    if (__trace_id) {
        _logger.useTraceId(__trace_id);
    }

    // 批量预注册所有唯一的 tenant/namespace 配置，避免循环中重复触发文件 I/O
    const seenConfigs = new Set();
    for (const m of metrics) {
        if (m.attributes?.tenant_id && m.attributes?.namespace) {
            const key = `${m.attributes.tenant_id}_${m.attributes.namespace}`;
            if (!seenConfigs.has(key)) {
                seenConfigs.add(key);
                await addDualAppConfig(m.attributes.tenant_id, m.attributes.namespace);
            }
        }
    }

    for (const m of metrics) {
        if (!m.attributes || !m.attributes.tenant_id || !m.attributes.namespace) {
            _logger.error(`tenant_id & namespace attributes are lost`);
            continue;
        }
        if (!is_process_dev_events && m.attributes.env !== 'online') {
            continue;
        }

        const app_id = `${m.attributes.tenant_id}_${m.attributes.namespace}`;
        const app_metric = getMetricObject(m);
        if (!app_metric) {
            _logger.warn(`[${app_id}] UnSupported metric=[${m.name}] type=[${m.type}]`);
            continue;
        }

        // 不在定义范围内的 labels，移除，避免平台新增 label(s)，导致已有服务出问题
        for (const k of Object.keys(m.attributes)) {
            if (app_metric.labelNames.indexOf(k) === -1) {

                _logger.warn(`[${app_id}] UnSupported label [${k}]=[${m.attributes[k]}] for metric [${m.name}]`);

                delete m.attributes[k];
            }
        }

        if (typeof m.value !== 'number' || Number.isNaN(m.value)) {
            _logger.warn(`[${app_id}] Invalid metric value for [${m.name}]: ${m.value}`);
            continue;
        }

        if (m.type === 'counter') {
            app_metric.labels(m.attributes).inc(m.value);
        }
        else if (m.type === 'gauge') {
            app_metric.labels(m.attributes).set(m.value);
        }
        else if (m.type === 'histogram') {
            app_metric.labels(m.attributes).observe(m.value);
        }
        else if (m.type === 'summary') {
            app_metric.labels(m.attributes).observe(m.value);
        }
    }
}

module.exports = {
    processMetrics
}
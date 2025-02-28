const {
    getAppMetrics
} = require('./index');
const linq = require('linq');
const { addDualAppConfig } = require('../prom/yaml-helper');

const logger = require('../log/log_helper_v2').default().useFile(__filename).useSingleAppendMode();

const { PROCESS_DEV_EVENTS } = require('../mode-cfg');
const is_process_dev_events = PROCESS_DEV_EVENTS === '1' || PROCESS_DEV_EVENTS === 'true';

/**
 * 
 * @param {import('../data').IBaseMetric} metric 
 * @returns {import('prom-client').MetricObject | undefined}
 */
async function getMetricObject(metric) {
    const tenant_id = metric.attributes.tenant_id;
    const namespace = metric.attributes.namespace;

    await addDualAppConfig(tenant_id, namespace);

    const app_id = `${tenant_id}_${namespace}`;
    const metrics = getAppMetrics(app_id);
    if (!metrics) {
        throw new Error(`can not find the metric defination for ${app_id}`);
    }

    const name = linq.from(Object.keys(metrics)).firstOrDefault(x => x === metric.name);
    if (name) {
        return metrics[name];
    }
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

    for (const m of metrics) {
        if (!m.attributes || !m.attributes.tenant_id || !m.attributes.namespace) {
            _logger.error(`tenant_id & namespace attributes are lost`);
            continue;
        }
        if (!is_process_dev_events && m.attributes.env !== 'online') {
            continue;
        }

        const app_id = `${m.attributes.tenant_id}_${m.attributes.namespace}`;
        const app_metric = await getMetricObject(m);
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
const {
    getAppMetrics
} = require('./index');
const linq = require('linq');

const logger = require('../log/log_helper_v2').default().useFile(__filename).useSingleAppendMode();

/**
 * 
 * @param {string} app_id 
 * @param {import('../data').IBaseMetric} metric 
 * @returns {import('prom-client').MetricObject | undefined}
 */
function getMetricObject(app_id, metric) {
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
 * @param {import('../data').IBaseMetricReceivedEvent} event 
 * @param {string} __trace_id 
 */
async function processMetrics(event, __trace_id) {

    const _logger = logger.default().new();
    if (__trace_id) {
        _logger.useTraceId(__trace_id);
    }

    const app_id = event.app_id;
    const metrics = event.metrics;

    for (const m of metrics) {
        const app_metric = getMetricObject(app_id, m);
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
const {
    metrics
} = require('./index');
const linq = require('linq');

const logger = require('../log/log_helper_v2').default().useFile(__filename).useSingleAppendMode();

/**
 * 
 * @param {import('../data').IBaseMetric} metric 
 * @returns {import('prom-client').MetricObject | undefined}
 */
function getMetricObject(metric) {
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
async function calcMetrics(metrics, __trace_id) {

    const _logger = logger.default().new();
    if (__trace_id) {
        _logger.useTraceId(__trace_id);
    }

    for (const m of metrics) {
        const app_metric = getMetricObject(m);
        if (!app_metric) {
            throw new Error(`UnSupported metric=[${m.name}] type=[${m.type}]`);
        }

        // 不在定义范围内的 labels，移除，避免平台新增 label(s)，导致已有服务出问题
        for (const k of Object.keys(m.attributes)) {
            if (app_metric.labelNames.indexOf(k) === -1) {

                _logger.warn(`UnSupported label [${k}]=[${m.attributes[k]}] for metric [${m.name}]`);

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
    processMetrics: calcMetrics
}
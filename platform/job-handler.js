
const Queue = require("bull");
const cfg = require('./config');
const { enableDualAppMode, enableSingleAppMode } = require('../prom/yaml-helper');

const logger = require('../log/log_helper_v2').default().useFile(__filename).useSingleAppendMode();

const { IS_DUAL_APP_MODE } = require('../mode-cfg');
logger.info(`MODE=${IS_DUAL_APP_MODE ? 'DUAL_APP_MODE' : 'SINGLE_APP_MODE'}`);

async function init() {
    if (IS_DUAL_APP_MODE) {
        await enableDualAppMode();
    }
    else {
        await enableSingleAppMode();
    }
}

init();

const myQueue = new Queue(cfg.queue_name, {
    redis: cfg.redis
});
myQueue.on('error', err => {
    console.log(`[job-handler]bull queue error`, err);
})

const { processMetrics } = IS_DUAL_APP_MODE ? require('../dual-metrics/metric-process') : require('../metrics/metric-process');

// 增加 metrics 队列的处理逻辑
myQueue.process('apaas_metrics', async (job, done) => {

    const body = job.data;

    const _logger = logger.default().new();
    if (body.__trace_id) {
        _logger.useTraceId(body.__trace_id);
    }

    await job.progress(10);

    try {
        // body 包含数组，Loki 中通过 LogQL 无法直接查询数组，在 handler 里面将数组展开后再记录
        let _body = JSON.parse(JSON.stringify(body));
        _body.metric_length = body.metrics.length;
        delete _body['metrics'];

        _logger.append({ ext: 'APPLICATION_METRIC_COMMON' }).info(_body);

        for (const metric of body.metrics) {
            _logger.append({
                ext: 'APPLICATION_METRIC_INFO',
                __timestamp__: metric.timestamp,
                namespace: metric.attributes.namespace,
                env: metric.attributes.env,
                tenant_id: metric.attributes.tenant_id
            }).info(metric);
        }

        const resp = await processMetrics(body.metrics, body.__trace_id);

        await job.progress(100);

        done(null, resp);
    }
    catch (err) {
        _logger.append({ ext: 'JOB_PROCESS_ERROR' }).error(err);
        done(err, null);
    }
});

// 增加 events 队列的处理逻辑
myQueue.process('apaas_events', async (job, done) => {

    const body = job.data;

    const _logger = logger.default().new();
    if (body.__trace_id) {
        _logger.useTraceId(body.__trace_id);
    }

    await job.progress(10);

    try {
        // body 包含数组，Loki 中通过 LogQL 无法直接查询数组，在 handler 里面将数组展开后再记录
        let _body = JSON.parse(JSON.stringify(body));
        _body.event_length = body.events.length;
        delete _body['events'];

        _logger.append({ ext: 'APPLICATION_EVENT_COMMON' }).info(_body);

        for (const event of body.events) {
            _logger.append({
                ext: 'APPLICATION_EVENT_INFO',
                __timestamp__: event.start_timestamp,
                namespace: event.attributes.namespace,
                env: event.attributes.env,
                tenant_id: event.attributes.tenant_id
            }).info(event);
        }

        await job.progress(100);

        done(null, resp);
    }
    catch (err) {
        _logger.append({ ext: 'JOB_PROCESS_ERROR' }).error(err);
        done(err, null);
    }
});

// 增加 logs 队列的处理逻辑
myQueue.process('apaas_logs', async (job, done) => {

    const body = job.data;

    const _logger = logger.default().new();
    if (body.__trace_id) {
        _logger.useTraceId(body.__trace_id);
    }

    await job.progress(10);

    try {
        // body 包含数组，Loki 中通过 LogQL 无法直接查询数组，在 handler 里面将数组展开后再记录
        let _body = JSON.parse(JSON.stringify(body));
        _body.log_length = body.logs.length;
        delete _body['logs'];

        _logger.append({ ext: 'APPLICATION_LOG_COMMON' }).info(_body);

        for (const log of body.logs) {
            if (log.level === 'error') {
                _logger.append({
                    ext: 'APPLICATION_LOG_INFO',
                    __timestamp__: log.timestamp,
                    namespace: log.attributes.namespace,
                    env: log.attributes.env,
                    tenant_id: log.attributes.tenant_id
                }).error(log);
            }
            else if (log.level === 'warn') {
                _logger.append({
                    ext: 'APPLICATION_LOG_INFO',
                    __timestamp__: log.timestamp,
                    namespace: log.attributes.namespace,
                    env: log.attributes.env,
                    tenant_id: log.attributes.tenant_id
                }).warn(log);
            }
            else if (log.level === 'debug') {
                _logger.append({
                    ext: 'APPLICATION_LOG_INFO',
                    __timestamp__: log.timestamp,
                    namespace: log.attributes.namespace,
                    env: log.attributes.env,
                    tenant_id: log.attributes.tenant_id
                }).debug(log);
            }
            else {
                _logger.append({
                    ext: 'APPLICATION_LOG_INFO',
                    __timestamp__: log.timestamp,
                    namespace: log.attributes.namespace,
                    env: log.attributes.env,
                    tenant_id: log.attributes.tenant_id
                }).info(log);
            }
        }

        await job.progress(100);

        done(null, resp);
    }
    catch (err) {
        _logger.append({ ext: 'JOB_PROCESS_ERROR' }).error(err);
        done(err, null);
    }
});

logger.info(`processor started.`);


// -----------metrics-exporter-----------
const { metrics, client } = require('../metrics/index');
const { agent_metric_registry, getAppRegistry, agent_metrics } = require('../dual-metrics/index');

/* 引入express框架 */
const express = require('express');
const compression = require('compression');
const app = express();

app.use(compression());

/* 引入cors */
const cors = require('cors');
app.use(cors());

app.use(express.urlencoded({ extended: false }));

app.get('/metrics', async (req, res) => {

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (IS_DUAL_APP_MODE) {
        res.send('Service running in DUAL_APP_MODE, endpoint not invaliad. Please use /:tenant_id_namespace/metrics instead.');
        return;
    }

    const start = new Date().getTime();

    const ua = req.headers['user-agent'];
    const is_prom_scrape = ua && ua.toLowerCase().indexOf('prometheus') !== -1;

    const metrics_string = await client.register.metrics();

    const cost = new Date().getTime() - start;

    if (is_prom_scrape) {
        const label = { job_name: 'apaas' };
        metrics.agent_request_total.labels(label).inc(1);
        metrics.agent_request_duration_milliseconds_total.labels(label).inc(cost);
        metrics.agent_response_size_total.labels(label).inc(metrics_string.length);
    }

    res.send(metrics_string);
    res.end();
})

app.get('/agent/metrics', async (req, res) => {

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    if (!IS_DUAL_APP_MODE) {
        res.send('This endpoint is only valid in DUAL_APP_MODE.');
        return;
    }

    const metrics_string = await agent_metric_registry.metrics();

    res.send(metrics_string);
    res.end();
})

app.get('/:app_id/metrics', async (req, res) => {

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    if (!IS_DUAL_APP_MODE) {
        res.send('Service running in SINGLE_APP_MODE, endpoint not invaliad. Please use /metrics instead.');
        return;
    }

    const app_id = req.params.app_id;
    if (!app_id) {
        res.send('invaliad app_id');
        return;
    }

    const registry = getAppRegistry(app_id);

    const start = new Date().getTime();

    const ua = req.headers['user-agent'];
    const is_prom_scrape = ua && ua.toLowerCase().indexOf('prometheus') !== -1;

    const metrics_string = await registry.metrics();

    const cost = new Date().getTime() - start;

    if (is_prom_scrape) {
        const label = { job_name: app_id };
        agent_metrics.agent_request_total.labels(label).inc(1);
        agent_metrics.agent_request_duration_milliseconds_total.labels(label).inc(cost);
        agent_metrics.agent_response_size_total.labels(label).inc(metrics_string.length);
    }

    res.send(metrics_string);
    res.end();
})

const HTTP_PORT = process.env['METRICS_HTTP_PORT'] ? process.env['METRICS_HTTP_PORT'] : 33444;

/* 监听端口 */
app.listen(HTTP_PORT, () => {
    logger.info(`listening: ${HTTP_PORT}`);
})
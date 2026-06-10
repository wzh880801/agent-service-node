
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
        const { metrics: _metrics, ..._body } = body;
        _body.metric_length = _metrics.length;

        _logger.append({ ext: 'APPLICATION_METRIC_COMMON' }).info(_body);

        for (const metric of _metrics) {
            _logger.append({
                ext: 'APPLICATION_METRIC_INFO',
                __timestamp__: metric.timestamp,
                namespace: metric.attributes.namespace,
                env: metric.attributes.env,
                tenant_id: metric.attributes.tenant_id
            }).info(metric);
        }

        const resp = await processMetrics(_metrics, body.__trace_id);

        await job.progress(100);

        done(null, resp);
    }
    catch (err) {
        if (err.message && err.message.includes('aPaaS auth expired')) {
            const eventTime = body.start_timestamp || body.end_timestamp || Date.now();
            const diffMs = Date.now() - eventTime;
            const ONE_HOUR = 60 * 60 * 1000;

            if (diffMs <= ONE_HOUR) {
                _logger.append({ ext: 'APAAS_FLOW_LOGS_AUTH_EXPIRED', namespace }).warn({ namespace, invoke_id, message: 'Auth expired, scheduling retry in 10min' });
                await myQueue.add('apaas_flow_logs', body, { removeOnComplete: { age: 3600 * 12, count: 100 }, delay: 10 * 60 * 1000 });
            } else {
                _logger.append({ ext: 'APAAS_FLOW_LOGS_AUTH_EXPIRED_SKIP', namespace }).warn({ namespace, invoke_id, message: 'Auth expired and event is older than 1h, skip retry' });
            }
            await job.progress(100);
            done();
            return;
        }
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
        const { events: _events, ..._body } = body;
        _body.event_length = _events.length;

        _logger.append({ ext: 'APPLICATION_EVENT_COMMON' }).info(_body);

        for (const event of _events) {
            _logger.append({
                ext: 'APPLICATION_EVENT_INFO',
                __timestamp__: event.start_timestamp,
                namespace: event.attributes.namespace,
                env: event.attributes.env,
                tenant_id: event.attributes.tenant_id,
                event_type: event.type,
                is_finished: event.is_finished
            }).info(event);

            // 流程日志延迟 60s 去获取，避免获取的时候还不完整
            if (event.type === 'invoke_workflow_event' && event.is_finished) {
                await myQueue.add('apaas_flow_logs', {
                    ...event,
                    __trace_id: _logger.getTraceid()
                }, { removeOnComplete: { age: 3600 * 12, count: 100 }, delay: 60000 })
            }
        }

        await job.progress(100);

        done();
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
        const { logs: _logs, ..._body } = body;
        _body.log_length = _logs.length;

        _logger.append({ ext: 'APPLICATION_LOG_COMMON' }).info(_body);

        for (const log of _logs) {
            const _level = log.level.toLowerCase();
            if (_level === 'error' || _level === 'critical' || _level === 'emergency' || _level === 'fatal') {
                _logger.append({
                    ext: 'APPLICATION_LOG_INFO',
                    __timestamp__: log.timestamp,
                    namespace: log.attributes.namespace,
                    env: log.attributes.env,
                    tenant_id: log.attributes.tenant_id
                }).error(log);
            }
            else if (_level === 'warn' || _level === 'warning' || _level === 'alert') {
                _logger.append({
                    ext: 'APPLICATION_LOG_INFO',
                    __timestamp__: log.timestamp,
                    namespace: log.attributes.namespace,
                    env: log.attributes.env,
                    tenant_id: log.attributes.tenant_id
                }).warn(log);
            }
            else if (_level === 'debug') {
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

        done();
    }
    catch (err) {
        _logger.append({ ext: 'JOB_PROCESS_ERROR' }).error(err);
        done(err, null);
    }
});

// 增加对流程详细日志的获取
myQueue.process('apaas_flow_logs', async (job, done) => {
    const body = job.data;

    const _logger = logger.default().new();
    if (body.__trace_id) {
        _logger.useTraceId(body.__trace_id);
    }

    await job.progress(10);

    const detail = typeof body.detail === 'string' ? JSON.parse(body.detail) : (body.detail || {});
    const namespace = detail.namespace || body.attributes?.namespace;
    const invoke_id = detail.invoke_id;

    try {

        if (!namespace || !invoke_id) {
            _logger.append({ ext: 'APAAS_FLOW_LOGS_SKIP', namespace }).warn('Missing namespace or invoke_id');
            await job.progress(100);
            done();
            return;
        }

        _logger.append({ ext: 'APAAS_FLOW_LOGS_QUERY' }).info({ namespace, invoke_id });

        const allLogs = [];
        const maxRetries = 5;
        const retryIntervalMs = 3000;

        // 首次获取（带重试，应对日志延迟）
        let firstResult = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            firstResult = await apaasClient.getFlowRuntimeLogList(namespace, {
                flow_instance_id: invoke_id,
                limit: 50,
                offset: 0,
                search: '',
                filters: {},
            });

            const logs = firstResult?.data?.data?.logs;
            if (Array.isArray(logs) && logs.length > 0) {
                allLogs.push(...logs);
                break;
            }

            if (attempt < maxRetries) {
                _logger.append({ ext: 'APAAS_FLOW_LOGS_RETRY', namespace }).info(`Attempt ${attempt} empty, retry after ${retryIntervalMs}ms`);
                await new Promise(resolve => setTimeout(resolve, retryIntervalMs));
            }
        }

        if (allLogs.length === 0) {
            _logger.append({ ext: 'APAAS_FLOW_LOGS_EMPTY' }).warn({ namespace, invoke_id, message: 'Flow logs still empty after retries' });
            await job.progress(100);
            done();
            return;
        }

        // 翻页获取剩余日志
        let offset = firstResult?.data?.data?.next_keyword_offset;
        const total = firstResult?.data?.data?.total || 0;

        while (offset !== -1 && offset !== undefined && offset !== null && allLogs.length < total) {
            const pageResult = await apaasClient.getFlowRuntimeLogList(namespace, {
                flow_instance_id: invoke_id,
                limit: 50,
                offset,
                search: '',
                filters: {},
            });

            const logs = pageResult?.data?.data?.logs;
            if (Array.isArray(logs) && logs.length > 0) {
                allLogs.push(...logs);
            }

            offset = pageResult?.data?.data?.next_keyword_offset;
        }

        // 判断流程日志是否完整（最后一条日志的 NodeAPIName 是否为 end）
        const lastLog = allLogs[allLogs.length - 1];
        const endTag = lastLog?.tags?.find(x => x.key === 'NodeAPIName' && x.value === 'end');
        if (!endTag) {
            _logger.append({ ext: 'APAAS_FLOW_LOGS_INCOMPLETE', namespace }).info({ namespace, invoke_id, message: 'Flow logs incomplete, scheduling retry in 10s' });
            await myQueue.add('apaas_flow_logs', body, { removeOnComplete: { age: 3600 * 12, count: 100 }, delay: 10000 });
            await job.progress(100);
            done();
            return;
        }

        _logger.append({ namespace }).info(`namespace=${namespace}, invoke_id=${invoke_id}, logs_length=${allLogs.length}`);

        for (const log of allLogs) {
            let ts = log.timestamp;
            const executeStartTag = log.tags?.find(x => x.key === 'ExecuteStartAt');
            if (executeStartTag?.value) {
                const parsed = Date.parse(executeStartTag.value);
                if (!isNaN(parsed)) {
                    ts = parsed;
                }
            }
            const _level = log.level?.toLowerCase() || 'info';
            if (_level === 'info' || _level === 'notice') {
                _logger.append({ ext: 'APAAS_FLOW_LOGS_DETAIL', __timestamp__: ts, namespace }).info({ namespace, invoke_id, log });
            }
            else if (_level === 'warn' || _level === 'warning' || _level === 'alert') {
                _logger.append({ ext: 'APAAS_FLOW_LOGS_DETAIL', __timestamp__: ts, namespace }).warn({ namespace, invoke_id, log });
            }
            else if (_level === 'error' || _level === 'critical' || _level === 'emergency' || _level === 'fatal') {
                _logger.append({ ext: 'APAAS_FLOW_LOGS_DETAIL', __timestamp__: ts, namespace }).error({ namespace, invoke_id, log });
            }
            else if (_level === 'debug') {
                _logger.append({ ext: 'APAAS_FLOW_LOGS_DETAIL', __timestamp__: ts, namespace }).debug({ namespace, invoke_id, log });
            }
            else {
                _logger.append({ ext: 'APAAS_FLOW_LOGS_DETAIL', __timestamp__: ts, namespace }).info({ namespace, invoke_id, log });
            }
        }

        await job.progress(100);
        done();
    }
    catch (err) {
        if (err.message && err.message.includes('aPaaS auth expired')) {
            const eventTime = body.start_timestamp || body.end_timestamp || Date.now();
            const diffMs = Date.now() - eventTime;
            const ONE_HOUR = 60 * 60 * 1000;

            if (diffMs <= ONE_HOUR) {
                _logger.append({ ext: 'APAAS_FLOW_LOGS_AUTH_EXPIRED', namespace }).warn({ namespace, invoke_id, message: 'Auth expired, scheduling retry in 10min' });
                await myQueue.add('apaas_flow_logs', body, { removeOnComplete: { age: 3600 * 12, count: 100 }, delay: 10 * 60 * 1000 });
            } else {
                _logger.append({ ext: 'APAAS_FLOW_LOGS_AUTH_EXPIRED_SKIP', namespace }).warn({ namespace, invoke_id, message: 'Auth expired and event is older than 1h, skip retry' });
            }
            await job.progress(100);
            done();
            return;
        }
        _logger.append({ ext: 'JOB_PROCESS_ERROR' }).error(err);
        done(err, null);
    }
})

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

/* 引入 aPaaS 日志同步模块 */
const { setup: setupApaas } = require('../apaas');
const { client: apaasClient, scheduler: apaasScheduler, configStore: apaasConfigStore } = setupApaas(app, {
    interval: process.env['APAAS_SYNC_INTERVAL'] || '10m',
    namespaces: process.env['APAAS_SYNC_NAMESPACES'] ? process.env['APAAS_SYNC_NAMESPACES'].split(',') : [],
});

// 启动时自动判断是否启动定时同步
// (async () => {
//     try {
//         const config = await apaasConfigStore.getConfig();
//         if (!config.token || !config.cookie || !config.host || !config.namespaces || config.namespaces.length === 0) {
//             logger.info('[aPaaS] Config incomplete (token/cookie/host/namespaces missing), scheduler not started automatically');
//             return;
//         }

//         // 尝试验证 token/cookie 有效性
//         const testNamespace = config.namespaces[0];
//         await apaasClient.getAppManageLogList(testNamespace, { pageSize: 1, from: Date.now() - 600000, to: Date.now(), logType: 10003 });

//         logger.info('[aPaaS] Config valid, starting scheduler automatically');
//         await apaasScheduler.start();
//     } catch (err) {
//         logger.error('[aPaaS] Config validation failed, scheduler not started automatically:', err.message);
//     }
// })();

app.get('/metrics', async (req, res) => {

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (IS_DUAL_APP_MODE) {
        res.send('Service running in DUAL_APP_MODE, endpoint not invalid. Please use /:tenant_id_namespace/metrics instead.');
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
        res.send('Service running in SINGLE_APP_MODE, endpoint not invalid. Please use /metrics instead.');
        return;
    }

    const app_id = req.params.app_id;
    if (!app_id) {
        res.send('invalid app_id');
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

app.get('/health', async (req, res) => {
    res.status(200).json({ status: 'ok' });
})

const HTTP_PORT = process.env['METRICS_HTTP_PORT'] ? process.env['METRICS_HTTP_PORT'] : 33444;

/* 监听端口 */
const server = app.listen(HTTP_PORT, () => {
    logger.info(`listening: ${HTTP_PORT}`);
});

// 优雅关闭
async function gracefulShutdown(signal) {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    server.close(() => {
        logger.info('HTTP server closed.');
    });

    await myQueue.close();
    logger.info('Bull queue closed.');

    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
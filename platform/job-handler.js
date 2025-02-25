
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

// 增加队列的处理逻辑
myQueue.process('apaas_metrics', async (job, done) => {

    const body = job.data;

    const _logger = logger.default().new();
    if (body.__trace_id) {
        _logger.useTraceId(body.__trace_id);
    }

    await job.progress(10);

    try {
        const resp = await processMetrics(body.metrics, body.__trace_id);

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
        res.send('Service running in DUAL_APP_MODE, endpoint not invaliad. Please use /:app_id/metrics instead.');
        return;
    }

    const start = new Date().getTime();

    const ua = req.headers['user-agent'];
    const is_prom_scrape = ua && ua.toLowerCase().indexOf('prometheus') !== -1;

    const metrics_string = await client.register.metrics();

    const cost = new Date().getTime() - start;

    if (is_prom_scrape) {
        metrics.agent_request_total.inc(1);
        metrics.agent_request_duration_milliseconds_total.inc(cost);
        metrics.agent_response_size_total.inc(metrics_string.length);
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
        agent_metrics.agent_request_total.inc(1);
        agent_metrics.agent_request_duration_milliseconds_total.inc(cost);
        agent_metrics.agent_response_size_total.inc(metrics_string.length);
    }

    res.send(metrics_string);
    res.end();
})

const HTTP_PORT = process.env['METRICS_HTTP_PORT'] ? process.env['METRICS_HTTP_PORT'] : 33444;

/* 监听端口 */
app.listen(HTTP_PORT, () => {
    logger.info(`listening: ${HTTP_PORT}`);
})
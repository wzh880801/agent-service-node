
const Queue = require("bull");
const cfg = require('./config');

const logger = require('../log/log_helper_v2').default().useFile(__filename).useSingleAppendMode();

const myQueue = new Queue(cfg.queue_name, {
    redis: cfg.redis
});
myQueue.on('error', err => {
    console.log(`[job-handler]bull queue error`, err);
})

const { processMetrics } = require('../metrics/metric-process');
const { metrics } = require('../metrics/index');

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
const { client } = require('../metrics/index');

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

    const start = new Date().getTime();

    const ua = req.headers['user-agent'];
    const is_prom_scrape = ua && ua.toLowerCase().indexOf('prometheus') !== -1;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
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

const HTTP_PORT = process.env['METRICS_HTTP_PORT'] ? process.env['METRICS_HTTP_PORT'] : 33444;

/* 监听端口 */
app.listen(HTTP_PORT, () => {
    logger.info(`listening: ${HTTP_PORT}`);
})
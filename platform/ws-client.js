const lark = require('@larksuiteoapi/node-sdk');
const logger = require('../log/log_helper_v2').default().useFile(__filename).useSingleAppendMode();

const Queue = require('bull');
const cfg = require('./config');

const myQueue = new Queue(cfg.queue_name, {
    redis: cfg.redis
});
myQueue.on('error', err => {
    console.log(`[ws]bull queue error`, err);
})

const { APP_ID, APP_SECRET, LOG_LEVEL, SAVE_RAW_EVENT } = process.env;
const logLevel = LOG_LEVEL && typeof lark.LoggerLevel[LOG_LEVEL] !== 'undefined' ? lark.LoggerLevel[LOG_LEVEL] : lark.LoggerLevel.info;

logger.info(`Using app ${APP_ID} to subscribe event.`);

const SDKLoggerProxy = {
    error: function (msg, ...args) {
        console.error(msg, args);
        logger.append({ ext: 'SDK' }).error({ msg, args, raw_level: 'error' });
    },

    warn: function (msg, ...args) {
        console.warn(msg, args);
        logger.append({ ext: 'SDK' }).warn({ msg, args, raw_level: 'warn' });
    },

    info: function (msg, ...args) {
        console.log(msg, args);
        logger.append({ ext: 'SDK' }).info({ msg, args, raw_level: 'info' });
    },

    debug: function (msg, ...args) {
        console.debug(msg, args);
        logger.append({ ext: 'SDK' }).debug({ msg, args, raw_level: 'debug' });
    },

    trace: function (msg, ...args) {
        console.trace(msg, args);
        logger.append({ ext: 'SDK' }).info({ msg, args, raw_level: 'trace' });
    }
}

const wsClient = new lark.WSClient({
    appId: APP_ID,
    appSecret: APP_SECRET,
    loggerLevel: logLevel,
    logger: SDKLoggerProxy
});

wsClient.start({
    eventDispatcher: new lark.EventDispatcher({}).register({

        /**
         * 开平有 3s 的处理时间限制，为了避免可能的超时，这里先将事件保存到 bull 队列，然后再异步处理
         * @param {import('../data').IBaseMetricReceivedEvent} data 
         */
        'apaas.application.metric.reported_v1': async (data) => {

            const _logger = logger.default().new();
            if (SAVE_RAW_EVENT) {
                _logger.append({ ext: 'APPLICATION_METRICS_RAW' }).info(data);
            }

            await myQueue.add('apaas_metrics', {
                ...data,
                __trace_id: _logger.getTraceid()
            }, { removeOnComplete: { age: 3600 * 12, count: 100 } });

        },

        'apaas.application.event.reported_v1': async (data) => {

            const _logger = logger.default().new();
            if (SAVE_RAW_EVENT) {
                _logger.append({ ext: 'APPLICATION_EVENTS_RAW' }).info(data);
            }

            await myQueue.add('apaas_events', {
                ...data,
                __trace_id: _logger.getTraceid()
            }, { removeOnComplete: { age: 3600 * 12, count: 100 } });

        },

        'apaas.application.log.reported_v1': async (data) => {
            const _logger = logger.default().new();
            if (SAVE_RAW_EVENT) {
                _logger.append({ ext: 'APPLICATION_LOGS_RAW' }).info(data);
            }

            await myQueue.add('apaas_logs', {
                ...data,
                __trace_id: _logger.getTraceid()
            }, { removeOnComplete: { age: 3600 * 12, count: 100 } })
        }
    })
});
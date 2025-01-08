const lark = require('@larksuiteoapi/node-sdk');
const logger = require('../log/log_helper_v2').default().useFile(__filename).useSingleAppendMode();

const Queue = require('bull');
const cfg = require('./config');

const myQueue = new Queue(cfg.queue_name, {
    redis: cfg.redis
});

const { APP_ID, APP_SECRET } = process.env;

const wsClient = new lark.WSClient({
    appId: APP_ID,
    appSecret: APP_SECRET,
    loggerLevel: lark.LoggerLevel.info
});

wsClient.start({
    eventDispatcher: new lark.EventDispatcher({}).register({

        /**
         * 开平有 3s 的处理时间限制，为了避免可能的超时，这里先将事件保存到 bull 队列，然后再异步处理
         * @param {import('../data').IBaseMetricReceivedEvent} data 
         */
        'apaas.application.metric.reported_v1': async (data) => {

            const _logger = logger.default().new();
            _logger.append({ ext: 'METRIC_EVENT' }).info(data);

            await myQueue.add('apaas_metrics', {
                ...data,
                __trace_id: _logger.getTraceid()
            }, { removeOnComplete: { age: 3600 * 12, count: 100 } });

        }
    })
});
const lark = require('@larksuiteoapi/node-sdk');

const { APP_ID, APP_SECRET } = process.env;

const wsClient = new lark.WSClient({
    appId: APP_ID,
    appSecret: APP_SECRET,
    loggerLevel: lark.LoggerLevel.info
});

wsClient.start({
    eventDispatcher: new lark.EventDispatcher({}).register({

        /**
         * 启动测试 client，为了可以保存 长连接 订阅方式 & 订阅事件
         * @param {import('../data').IBaseMetricReceivedEvent} data 
         */
        'apaas.application.metric.reported_v1': async (data) => {

            console.log(`====>${new Date().toISOString()}\tapaas.application.metric.reported_v1`);
            console.log(JSON.stringify(data, null, 2));

        },

        'apaas.application.event.reported_v1': async (data) => {

            console.log(`====>${new Date().toISOString()}\tapaas.application.event.reported_v1`);
            console.log(JSON.stringify(data, null, 2));
        },

        'apaas.application.log.reported_v1': async (data) => {
            console.log(`====>${new Date().toISOString()}\tapaas.application.log.reported_v1`);
            console.log(JSON.stringify(data, null, 2));
        }
    })
});
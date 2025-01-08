const { LogHelper } = require('./logHelper');

module.exports.default = function () {
    const logger = new LogHelper()
        .addSensitiveWords(['Authorization'])
        .setServiceName('agent-service-node')
        .setPath('/var/logs/agent-service-node');

    if (process.env['LOKI_API_URL']) {
        return logger
            .setLoki(process.env['LOKI_API_URL'], process.env['LOKI_API_KEY'])
            .withReport();
    }
    return logger.noReport();
}
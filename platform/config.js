const { REDIS_HOST, REDIS_PORT, REDIS_DB_NUMBER, REDIS_CONN_URL } = process.env;

module.exports = {
    queue_name: 'queue-agent-service',
    redis: REDIS_CONN_URL ? REDIS_CONN_URL : {
        host: REDIS_HOST ? REDIS_HOST : "127.0.0.1",
        port: REDIS_PORT ? REDIS_PORT : 6379,
        db: typeof REDIS_DB_NUMBER === typeof 0 ? REDIS_DB_NUMBER : 15
    }
}
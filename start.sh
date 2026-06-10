#! /bin/bash

# 设置日志清理定时任务
SAVE_DAYS=${LOG_FILE_SAVE_DAYS:-7}
CRON_JOB="0 0 * * * LOG_FILE_SAVE_DAYS=${SAVE_DAYS} /repos/agent-service-node/scripts/clean-logs.sh >> /var/log/clean-logs.log 2>&1"
echo "$CRON_JOB" | crontab -
cron

pm2 start ./platform/job-handler.js --name metrics-exporter
pm2 start ./platform/bull-board.js --name bull-board
pm2 start ./platform/ws-client.js --name ws-client
tail -f /dev/null

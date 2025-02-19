#! /bin/bash
pm2 start ./platform/job-handler.js --name metrics-exporter
pm2 start ./platform/bull-board.js --name bull-board
pm2 start ./platform/ws-client.js --name ws-client
tail -f /dev/null
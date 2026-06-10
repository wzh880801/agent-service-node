#!/bin/bash
SAVE_DAYS=${LOG_FILE_SAVE_DAYS:-7}
LOG_DIR=${LOG_DIR:-/var/logs/agent-service-node}

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning logs older than ${SAVE_DAYS} days in ${LOG_DIR}"

if [ -d "$LOG_DIR" ]; then
    find "$LOG_DIR" -type f -mtime +$SAVE_DAYS -delete
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Clean completed"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Log dir not found: ${LOG_DIR}"
fi

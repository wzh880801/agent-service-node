# agent-service-node

- 订阅 aPaaS 应用的上报事件（指标、事件、日志），使用 Prometheus SDK 进行指标处理，暴露 metrics HTTP endpoint 以便让 Prometheus server 抓取指标数据

## 架构说明

```
┌─────────────────┐     WS 长连接      ┌──────────────┐     Bull 队列      ┌─────────────────┐
│ 飞书开放平台     │ ────────────────→ │ ws-client.js │ ────────────────→ │ Redis           │
│ (apaas 事件)     │                   │ (事件接收)    │                   │                 │
└─────────────────┘                   └──────────────┘                   └─────────────────┘
                                                                              │
                                                                              │ 消费
                                                                              ↓
                                                                       ┌─────────────────┐
                                                                       │ job-handler.js  │
                                                                       │ (指标处理+HTTP)  │
                                                                       └─────────────────┘
                                                                              │
                                                                              │ /metrics
                                                                              ↓
                                                                       ┌─────────────────┐
                                                                       │ Prometheus      │
                                                                       │ Server          │
                                                                       └─────────────────┘
```

服务由 3 个进程组成：
- **ws-client.js**：通过 WebSocket 长连接接收飞书开放平台事件，转存到 Bull 队列
- **job-handler.js**：消费队列，处理事件并暴露 HTTP endpoint 供 Prometheus 抓取
- **bull-board.js**（可选）：Bull 队列的可视化管理面板

### 订阅的事件类型

ws-client.js 订阅了 3 类 aPaaS 应用上报事件：

| 事件类型 | Job 队列 | job-handler.js 处理方式 |
|---------|---------|------------------------|
| `apaas.application.metric.reported_v1` | `apaas_metrics` | 解析为 Prometheus Counter/Gauge/Histogram/Summary 指标 |
| `apaas.application.event.reported_v1` | `apaas_events` | 记录到 Loki/本地日志（不生成 Prometheus 指标） |
| `apaas.application.log.reported_v1` | `apaas_logs` | 按 `error`/`warn`/`debug`/`info` 级别分级记录到日志 |

## 运行模式

| 模式 | 适用场景 | Metrics Endpoint |
|------|---------|------------------|
| `SINGLE_APP_MODE`（默认） | 1 个 App 接收 1 个 aPaaS 应用的指标 | `/metrics` |
| `DUAL_APP_MODE` | 1 个 App 接收 N 个 aPaaS 应用的指标（多租户） | `/:tenant_id_namespace/metrics` + `/agent/metrics` |

## HTTP 端点

| 端点 | 说明 | 适用模式 |
|------|------|---------|
| `GET /metrics` | 聚合指标 | SINGLE_APP_MODE |
| `GET /:app_id/metrics` | 按应用隔离的指标 | DUAL_APP_MODE |
| `GET /agent/metrics` | Agent 自身 scrape 指标 | DUAL_APP_MODE |
| `GET /health` | 健康检查 | 全部 |

## 依赖

- Node.js >= 18
- Redis（Bull 队列存储）

## 部署方式

### 一、源码部署

1. clone 代码
2. 安装 npm 依赖
```bash
cd agent-service-node
npm i
```
3. 安装 pm2（可选）
```bash
npm i pm2@latest -g
```
4. 配置环境变量
```bash
export METRICS_HTTP_PORT=33444
export LOKI_API_URL=
export LOKI_API_KEY=
export BULL_BOARD_PORT=44445
export REDIS_CONN_URL=redis://127.0.0.1:6379/15
export APP_ID=cli_a59a471e0a7fd00d
export APP_SECRET=LOplEasQrxvmWDiqa************
export RUN_MODE=SINGLE_APP_MODE

# 可选
export PROCESS_DEV_EVENTS=false   # 是否处理 dev 环境事件（默认 false，仅处理 online）
export SAVE_RAW_EVENT=false       # 是否保存原始事件到日志
export LOG_LEVEL=info             # SDK 日志级别: debug/info/warn/error

# DUAL_APP_MODE 下配置 Prometheus 动态加载（可选）
export PROM_CFG_FILE=/etc/prometheus/prometheus.yml
export SCRAPE_HOST_PORT=172.28.10.10:33444
export PROM_URL=http://172.28.10.8:9090
```
5. 启动
```bash
# 方式一：直接启动
node ./platform/ws-client.js
node ./platform/job-handler.js
node ./platform/bull-board.js   # 可选

# 方式二：使用 pm2
chmod +x ./start.sh
./start.sh
```

### 二、Docker 部署

1. build docker image
```bash
docker build . -t agent-service-node
```
2. run docker container
```bash
docker run -d --name agent-service-node \
  -p 33444:33444 \
  -p 44445:44445 \
  -e REDIS_CONN_URL=redis://127.0.0.1:6379/15 \
  -e LOKI_API_URL=<loki_url> \
  -e LOKI_API_KEY=<loki_key> \
  -e RUN_MODE=SINGLE_APP_MODE \
  agent-service-node
```

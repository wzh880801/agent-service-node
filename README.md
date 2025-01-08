# agent-service-node

  订阅应用指标上报事件，使用 Prometheus SDK 进行指标处理，暴露 metrics http endpoint 以便让 Prometheus server 抓取指标数据

  部署方式：

一、 源码部署
1. clone 代码
2. 安装 npm 依赖
进入到项目根目录，执行 `npm i`
3. 安装 pm2（可选）
```bash
npm i pm2@latest -g
```
4. 配置
- 配置 redis、HTTP 端口号等信息
通过环境变量方式配置
```bash
export METRICS_HTTP_PORT=33444
export LOKI_API_URL=
export LOKI_API_KEY=
export BULL_BOARD_PORT=44445
export REDIS_CONN_URL=redis://127.0.0.1:6379/15
export APP_ID=cli_a59a471e0a7fd00d
export APP_SECRET=LOplEasQrxvmWDiqa************
```
5. 启动
```bash
// 使用长连接接收开放平台事件，转存到 bull 队列
node ./platform/ws.js

// 消费队列，处理指标事件
node ./platform/job-handler.js

// 可选，队列的管理面板
node ./platform/bull-board.js
```
或
```bash
// 需要先安装 pm2
sudo chmod +x ./start.sh
./start.sh
```

二、docker 部署

1. build docker image
```bash
docker build . -t agent-service-node
```
2. run docker container
```bash
docker run -d --name agent-service-node agent-service-node -p 33444:33444 -p 44445:44445 -e  REDIS_CONN_URL=redis://127.0.0.1:6379/15 -e LOKI_API_URL=<loki_url> -e LOKI_API_KEY=<loki_key>
```

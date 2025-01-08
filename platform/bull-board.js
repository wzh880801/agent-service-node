const express = require("express");
const Queue = require("bull");
const { createBullBoard } = require("@bull-board/api");
const { BullAdapter } = require("@bull-board/api/bullAdapter");
const { ExpressAdapter } = require("@bull-board/express");
const cfg = require('./config');

const myWebhookQueue = new Queue(cfg.queue_name, { redis: cfg.redis });

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
    queues: [new BullAdapter(myWebhookQueue)],
    serverAdapter: serverAdapter,
});

const app = express();

const { BULL_BOARD_PORT } = process.env;
const bull_port = BULL_BOARD_PORT ? BULL_BOARD_PORT : 44445;

app.use('/admin/queues', serverAdapter.getRouter());

// other configurations of your server
app.listen(bull_port, () => {
    console.log(`Running on ${bull_port}...`);
    console.log(`For the UI, open http://localhost:${bull_port}/admin/queues`);
});

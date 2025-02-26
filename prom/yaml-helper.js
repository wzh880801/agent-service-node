const YAML = require('yaml');
const fs = require('fs');
const logger = require('../log/log_helper_v2').default().useFile(__filename).useSingleAppendMode();
const linq = require('linq');
const axios = require('axios').default;

axios.defaults.timeout = 3000;

const { PROM_CFG_FILE, SCRAPE_HOST_PORT, PROM_URL, IS_DUAL_APP_MODE } = require('../mode-cfg');

if (IS_DUAL_APP_MODE && (!PROM_CFG_FILE || !fs.existsSync(PROM_CFG_FILE))) {
    logger.error(`PROM_CFG_FILE is invalid!`);
}

const scrape_host = SCRAPE_HOST_PORT ? SCRAPE_HOST_PORT : `172.28.10.10:33444`;
const prom_url = PROM_URL ? PROM_URL : `http://172.28.10.8:9090`;
const prom_reload_api = prom_url.endsWith('/') ? `${prom_url}-/reload` : `${prom_url}/-/reload`;

let _all_cfgs = [];

async function enableSingleAppMode() {
    logger.info(`enable SINGLE_APP_MODE`);

    if (!fs.existsSync(PROM_CFG_FILE)) {
        return;
    }

    // 1. 读取 YAML 文件
    const fileContent = fs.readFileSync(PROM_CFG_FILE, 'utf8');

    // 2. 解析为 YAML 文档（保留注释）
    const doc = YAML.parseDocument(fileContent);

    // 3. 获取 scrape_configs 节点
    let scrapeConfigs = doc.get('scrape_configs');

    let raw_cfgs = [];
    if (scrapeConfigs) {
        raw_cfgs = scrapeConfigs.toJSON();
    }

    const apaas = {
        job_name: 'apaas',
        static_configs: [
            {
                targets: [scrape_host]
            }
        ]
    };

    let new_cfgs = [];
    let is_has_dual_cfg = linq.from(raw_cfgs).count(x => isDualAppCfg(x)) > 0;

    for (let cfg of raw_cfgs) {
        if (!isDualAppCfg(cfg)) {
            new_cfgs.push(cfg);
        }
    }

    const apaas_cfg = linq.from(new_cfgs).firstOrDefault(x => x.job_name === 'apaas');
    if (!apaas_cfg) {
        new_cfgs.push(apaas);
    }

    // 如果配置文件中不包含 job_name==='apaas' 的配置 或 包含多 app 模式的配置，则更新配置文件
    if (!apaas_cfg || is_has_dual_cfg) {

        logger.append({ ext: 'UPDATE_PROM_CFG' }).info({ old: raw_cfgs, new: new_cfgs });

        doc.set('scrape_configs', new_cfgs);

        fs.writeFileSync(PROM_CFG_FILE, doc.toString(), 'utf8');

        await reload_prom_cfg();
    }
}

async function enableDualAppMode() {
    logger.info(`enable DUAL_APP_MODE`);

    if (!fs.existsSync(PROM_CFG_FILE)) {
        return;
    }

    // 1. 读取 YAML 文件
    const fileContent = fs.readFileSync(PROM_CFG_FILE, 'utf8');

    // 2. 解析为 YAML 文档（保留注释）
    const doc = YAML.parseDocument(fileContent);

    // 3. 获取 scrape_configs 节点
    let scrapeConfigs = doc.get('scrape_configs');

    let raw_cfgs = [];
    if (scrapeConfigs) {
        raw_cfgs = scrapeConfigs.toJSON();
    }

    const new_cfgs = linq.from(raw_cfgs).where(x => x.job_name !== 'apaas').toArray();

    const is_has_apaas_cfg = linq.from(raw_cfgs).count(x => x.job_name === 'apaas') > 0;
    const is_has_agent_cfg = linq.from(raw_cfgs).count(x => x.job_name === 'agent') > 0;
    if (!is_has_agent_cfg) {
        new_cfgs.push({
            job_name: 'agent',
            metrics_path: `/agent/metrics`,
            static_configs: [
                {
                    targets: [scrape_host],
                }
            ],
        });
    }

    // 如果配置文件中包含 job_name==='apaas' 的配置 或者 不包含 agent 配置
    if (is_has_apaas_cfg || !is_has_agent_cfg) {

        logger.append({ ext: 'UPDATE_PROM_CFG' }).info({ old: raw_cfgs, new: new_cfgs });

        doc.set('scrape_configs', new_cfgs);

        fs.writeFileSync(PROM_CFG_FILE, doc.toString(), 'utf8');

        logger.info(`reloading prometheus configuration...`);

        await reload_prom_cfg();

        logger.info(`reload prometheus configuration completed.`);
    }

    _all_cfgs = JSON.parse(JSON.stringify(new_cfgs));
}

/**
 * 添加新的 metrics endpoint 并自动 reload prometheus configuration
 * 会根据缓存自动判断需不需要刷新配置文件，只在必要的时候才会读写配置文件，不会有性能问题
 * @param {string} tenant_id 
 * @param {string} namespace 
 */
async function addDualAppConfig(tenant_id, namespace) {
    const new_cfg = buildNewAppCfg(tenant_id, namespace);
    if (linq.from(_all_cfgs).firstOrDefault(x => x.job_name === new_cfg.job_name)) {
        return;
    }

    logger.info(`adding config for ${tenant_id} - ${namespace}`);

    if (!fs.existsSync(PROM_CFG_FILE)) {
        return;
    }

    // 1. 读取 YAML 文件
    const fileContent = fs.readFileSync(PROM_CFG_FILE, 'utf8');

    // 2. 解析为 YAML 文档（保留注释）
    const doc = YAML.parseDocument(fileContent);

    // 3. 获取 scrape_configs 节点
    let scrapeConfigs = doc.get('scrape_configs');

    let raw_cfgs = [];
    if (scrapeConfigs) {
        raw_cfgs = scrapeConfigs.toJSON();
    }

    const is_cfg_exists = linq.from(raw_cfgs).count(x => x.job_name === new_cfg.job_name) > 0;

    if (!is_cfg_exists) {
        raw_cfgs.push(new_cfg);

        logger.append({ ext: 'ADD_PROM_CFG' }).info({ cfg: new_cfg });

        doc.set('scrape_configs', raw_cfgs);

        fs.writeFileSync(PROM_CFG_FILE, doc.toString(), 'utf8');

        logger.info(`reloading prometheus configuration...`);

        await reload_prom_cfg();

        logger.info(`reload prometheus configuration completed.`);

        if (!linq.from(_all_cfgs).firstOrDefault(x => x.job_name === new_cfg.job_name)) {
            _all_cfgs.push(new_cfg);
        }
    }
}

/**
 * 
 * @param {string} tenant_id 
 * @param {string} namespace 
 * @returns {import('../data').IDualAppScrapeConfig}
 */
function buildNewAppCfg(tenant_id, namespace) {
    const key = `${tenant_id}_${namespace}`;
    return {
        job_name: key,
        metrics_path: `/${key}/metrics`,
        static_configs: [
            {
                targets: [scrape_host],
            },
        ],
    }
}

/**
 * 
 * @param {import('../data').IDualAppScrapeConfig} cfg 
 * @returns {boolean}
 */
function isDualAppCfg(cfg) {
    const regex = /\/(?<name>.+?)\/metrics/gm;
    if (cfg && cfg.metrics_path && cfg.job_name) {
        const m = regex.exec(cfg.metrics_path);
        if (m && m.groups['name'] && m.groups['name'] === cfg.job_name) {
            return true;
        }
    }

    // if (cfg.job_name === 'agent' && cfg.metrics_path === '/agent/metrics') {
    //     return true;
    // }

    return false;
}

async function reload_prom_cfg() {
    logger.info(`reloading prometheus configuration...`);

    try {
        const resp = await axios({
            method: 'POST',
            url: prom_reload_api
        });
        logger.info(`reload prometheus configuration completed.`);
        return resp;
    }
    catch (err) {
        logger.error(`reload prometheus configuration failed. ${err}`);
    }
}

module.exports = {
    enableSingleAppMode,
    enableDualAppMode,
    addDualAppConfig,

    /**
     * 
     * @returns {Array<import('../data').IDualAppScrapeConfig>}
     */
    getAllConfig: function () {
        return _all_cfgs;
    }
}
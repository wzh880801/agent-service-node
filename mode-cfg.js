
const IS_DUAL_APP_MODE = process.env['RUN_MODE'] === 'DUAL_APP_MODE' ? true : false;
const { PROM_CFG_FILE, SCRAPE_HOST_PORT, PROM_URL, PROCESS_DEV_EVENTS } = process.env;

module.exports = {
    IS_DUAL_APP_MODE,
    PROM_CFG_FILE,
    SCRAPE_HOST_PORT,
    PROM_URL,
    PROCESS_DEV_EVENTS
}
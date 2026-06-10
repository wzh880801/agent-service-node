const axios = require('axios');

const FEISHU_BOT_WEBHOOK = process.env['FEISHU_BOT_WEBHOOK'];
const FEISHU_CARD_TEMPLATE_ID = process.env['FEISHU_CARD_TEMPLATE_ID'] || 'AAqNgjDYP1C1w';
const FEISHU_CARD_TEMPLATE_VERSION = process.env['FEISHU_CARD_TEMPLATE_VERSION'] || '1.0.1';

/**
 * 发送 aPaaS 凭证失效告警卡片到飞书自定义机器人
 * @param {string} statusCode 错误码，如 k_gw_ec_000014
 * @param {string} errorMsg 错误信息
 */
async function sendAuthExpiredCard(statusCode, errorMsg) {
  if (!FEISHU_BOT_WEBHOOK) {
    return;
  }

  const payload = {
    msg_type: 'interactive',
    card: {
      type: 'template',
      data: {
        template_id: FEISHU_CARD_TEMPLATE_ID,
        template_version_name: FEISHU_CARD_TEMPLATE_VERSION,
        template_variable: {
          status_code: statusCode || '',
          error_msg: errorMsg || '当前登录已失效，请重新登录',
        },
      },
    },
  };

  try {
    await axios.post(FEISHU_BOT_WEBHOOK, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
  } catch (err) {
    console.error('[aPaaS Notify] Send feishu card failed:', err.message);
  }
}

module.exports = { sendAuthExpiredCard };

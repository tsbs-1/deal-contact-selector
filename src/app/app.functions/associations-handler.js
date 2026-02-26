const axios = require('axios');

exports.main = async (context = {}) => {
  const { dealId, contactIds } = context.parameters;
  const PRIVATE_APP_TOKEN = process.env.PRIVATE_APP_ACCESS_TOKEN;
  
  try {
    const results = [];
    const errors = [];

    for (const contactId of contactIds) {
      try {
        const response = await axios.put(
          // CRM v4 default association endpoint（ラベルなしの既定関連）
          // /crm/v4/objects/{fromObjectType}/{fromObjectId}/associations/default/{toObjectType}/{toObjectId}
          `https://api.hubapi.com/crm/v4/objects/deal/${dealId}/associations/default/contact/${contactId}`,
          null,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${PRIVATE_APP_TOKEN}`
            }
          }
        );

        results.push({
          contactId,
          success: true,
          response: response.data
        });
      } catch (error) {
        const details = error.response?.data || error.message;
        console.error(`Failed to associate contact ${contactId}:`, details);
        errors.push({
          contactId,
          success: false,
          error: typeof details === 'string' ? details : JSON.stringify(details)
        });
      }
    }

    if (results.length === 0) {
      throw new Error(`すべての関連付けに失敗しました: ${errors.map(e => e.error).join(', ')}`);
    }

    const message = errors.length > 0
      ? `${results.length}件のコンタクトを関連付けました（${errors.length}件失敗）`
      : `${results.length}件のコンタクトを正常に関連付けました`;

    return {
      success: true,
      message,
      results,
      errors
    };

  } catch (error) {
    console.error('Association failed:', error);
    throw new Error(`関連付けに失敗しました: ${error.message}`);
  }
};


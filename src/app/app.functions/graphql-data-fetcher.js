const axios = require('axios');

exports.main = async (context = {}) => {
  const { dealId } = context.parameters || {};
  const PRIVATE_APP_TOKEN = process.env.PRIVATE_APP_ACCESS_TOKEN;

  if (!dealId) {
    throw new Error('dealId parameter is required');
  }

  const client = axios.create({
    baseURL: 'https://api.hubspot.com',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PRIVATE_APP_TOKEN}`,
    },
  });

  try {
    const fetchAllAssociations = async (fromType, fromId, toType) => {
      const ids = [];
      let after;

      do {
        const resp = await client.get(
          `/crm/v4/objects/${fromType}/${fromId}/associations/${toType}`,
          {
            params: {
              limit: 500,
              ...(after ? { after } : {}),
            },
          }
        );

        const results = resp.data?.results || [];
        results.forEach((r) => {
          if (r.toObjectId) ids.push(String(r.toObjectId));
        });

        after = resp.data?.paging?.next?.after;
      } while (after);

      return ids;
    };

    // 1. Deal 本体を取得
    const dealResp = await client.get(`/crm/v3/objects/deals/${dealId}`, {
      params: {
        properties: 'dealname'
      },
    });

    const dealRecord = dealResp.data;
    if (!dealRecord) {
      throw new Error('Deal not found or no access to deal data');
    }

    const dealName = dealRecord.properties?.dealname || '';

    // 2. Deal に紐づく会社・既存コンタクトを v4 associations API で全件取得
    const companyIds = await fetchAllAssociations('deal', dealId, 'company');
    const existingContactIds = await fetchAllAssociations('deal', dealId, 'contact');

    // 3. 会社ごとの関連コンタクト ID を全件取得
    const companyToContactIds = new Map();
    const allContactIdSet = new Set(existingContactIds);

    for (const companyId of companyIds) {
      const contactIdsForCompany = await fetchAllAssociations(
        'company',
        companyId,
        'contact'
      );

      companyToContactIds.set(companyId, contactIdsForCompany);
      contactIdsForCompany.forEach((id) => allContactIdSet.add(id));
    }

    const allContactIds = Array.from(allContactIdSet);

    if (allContactIds.length === 0) {
      return {
        deal: {
          id: dealRecord.id,
          name: dealName,
        },
        companies: [],
        availableContacts: [],
        existingContacts: [],
        summary: {
          totalCompanyContacts: 0,
          existingContactsCount: 0,
          availableContactsCount: 0,
        },
      };
    }

    // 4. 会社情報（名前）を取得
    let companies = [];
    if (companyIds.length > 0) {
      const companyBatchResp = await client.post(
        '/crm/v3/objects/companies/batch/read',
        {
          properties: ['name'],
          inputs: companyIds.map((id) => ({ id })),
        }
      );

      companies =
        companyBatchResp.data?.results?.map((c) => ({
          hs_object_id: c.id,
          name: c.properties?.name || '',
        })) || [];
    }

    const companyById = new Map(
      companies.map((c) => [c.hs_object_id, c])
    );

    // 5. コンタクト詳細を一括取得
    const contactBatchResp = await client.post(
      '/crm/v3/objects/contacts/batch/read',
      {
        properties: ['firstname', 'lastname', 'email', 'phone'],
        inputs: allContactIds.map((id) => ({ id })),
      }
    );

    const contactsById = new Map();
    (contactBatchResp.data?.results || []).forEach((c) => {
      contactsById.set(c.id, {
        hs_object_id: c.id,
        firstname: c.properties?.firstname || '',
        lastname: c.properties?.lastname || '',
        email: c.properties?.email || '',
        phone: c.properties?.phone || '',
      });
    });

    // 6. 会社に紐づくコンタクト一覧（会社情報付き）を構築
    const allCompanyContacts = [];

    companyToContactIds.forEach((contactIds, companyId) => {
      const company = companyById.get(companyId);
      contactIds.forEach((contactId) => {
        const base = contactsById.get(contactId);
        if (!base) return;
        allCompanyContacts.push({
          ...base,
          companyId,
          companyName: company?.name || '',
        });
      });
    });

    // 7. 既存関連付けコンタクト
    const existingContacts = existingContactIds
      .map((id) => contactsById.get(id))
      .filter(Boolean);

    const existingIdsSet = new Set(existingContactIds);

    // 8. 選択可能なコンタクト（まだ Deal に紐づいていないもの）
    const availableContacts = allCompanyContacts.filter(
      (contact) => !existingIdsSet.has(contact.hs_object_id)
    );

    return {
      deal: {
        id: dealRecord.id,
        name: dealName,
      },
      companies,
      availableContacts,
      existingContacts,
      summary: {
        totalCompanyContacts: allCompanyContacts.length,
        existingContactsCount: existingContacts.length,
        availableContactsCount: availableContacts.length,
      },
    };
  } catch (error) {
    console.error('REST data fetch failed:', error);
    throw error;
  }
};


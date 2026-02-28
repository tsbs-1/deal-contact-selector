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

    const companyIds = await fetchAllAssociations('deal', dealId, 'company');
    const existingContactIds = await fetchAllAssociations('deal', dealId, 'contact');

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

    const existingContacts = existingContactIds
      .map((id) => contactsById.get(id))
      .filter(Boolean);

    const existingIdsSet = new Set(existingContactIds);
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

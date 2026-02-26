import React, { useState, useEffect } from "react";
import {
  hubspot,
  LoadingSpinner,
  Button,
  Text,
  Flex,
  Alert,
  Checkbox,
  Box,
} from "@hubspot/ui-extensions";

// HubSpot UI Extensions entrypoint
hubspot.extend(({ context, runServerlessFunction }) => (
  <DealContactSelector
    context={context}
    runServerless={runServerlessFunction}
  />
));

const DealContactSelector = ({ context, runServerless }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [associating, setAssociating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Deal レコードの ID を取得
      const dealId =
        context?.crm?.objectId?.toString() ||
        context?.objectId?.toString();

      if (!dealId) {
        throw new Error("取引 ID を取得できませんでした");
      }

      const result = await runServerless({
        name: "graphql-data-fetcher",
        parameters: { dealId },
      });

      const payload = result && typeof result === "object" && "response" in result
        ? result.response
        : result;

      if (!payload) {
        throw new Error("サーバレス関数からデータが返却されませんでした");
      }

      setData(payload);
    } catch (err) {
      setError(err.message || "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleContactSelect = (contactId, checked) => {
    if (checked) {
      setSelectedContacts([...selectedContacts, contactId]);
    } else {
      setSelectedContacts(
        selectedContacts.filter((id) => id !== contactId)
      );
    }
  };

  const handleAssociate = async () => {
    if (selectedContacts.length === 0 || !data?.deal?.id) return;

    try {
      setAssociating(true);
      setError(null);

      const result = await runServerless({
        name: "associations-handler",
        parameters: {
          dealId: data.deal.id,
          contactIds: selectedContacts,
        },
      });

      const payload = result && typeof result === "object" && "response" in result
        ? result.response
        : result;

      setSuccess(
        payload?.message ||
          `${selectedContacts.length}件のコンタクトを関連付けました`
      );
      setSelectedContacts([]);
      await loadData();
    } catch (err) {
      setError(err.message || "関連付けに失敗しました");
    } finally {
      setAssociating(false);
    }
  };

  if (loading) {
    return (
      <Flex direction="column" align="center" gap="md">
        <LoadingSpinner />
        <Text>データを読み込み中...</Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Alert title="エラー" variant="error">
        {error}
        <Button onClick={loadData} size="sm" style={{ marginTop: "8px" }}>
          再試行
        </Button>
      </Alert>
    );
  }

  if (!data) return null;

  const companies = Array.isArray(data.companies) ? data.companies : [];
  const availableContacts = Array.isArray(data.availableContacts)
    ? data.availableContacts
    : [];
  const existingContacts = Array.isArray(data.existingContacts)
    ? data.existingContacts
    : [];
  const summary = data.summary || {};
  const dealName = (data.deal && data.deal.name) || "Deal";

  return (
    <Flex direction="column" gap="md">
      {/* ヘッダー */}
      <Box>
        <Text variant="h3">{dealName}</Text>
        <Text variant="body">関連付け可能なコンタクト</Text>
      </Box>

      {/* 成功メッセージ */}
      {success && (
        <Alert
          title="成功"
          variant="success"
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      {/* サマリー情報 */}
      <Flex direction="column" gap="xs">
        <Text>会社: {companies.length}</Text>
        <Text>
          既存関連付け: {summary.existingContactsCount ?? existingContacts.length}
        </Text>
        <Text>
          選択可能: {summary.availableContactsCount ?? availableContacts.length}
        </Text>
      </Flex>

      {/* 選択可能なコンタクト一覧 */}
      {availableContacts.length === 0 ? (
        <Alert title="情報" variant="info">
          関連付け可能な新しいコンタクトはありません。
        </Alert>
      ) : (
        <Box>
          <Text variant="h4" style={{ marginBottom: "12px" }}>
            選択可能なコンタクト ({availableContacts.length}件)
          </Text>

          {availableContacts.map((contact) => (
            <Box
              key={contact.hs_object_id}
              style={{
                marginBottom: "8px",
                padding: "8px",
                border: "1px solid #E5E7EB",
                borderRadius: "6px",
              }}
            >
              <Flex direction="row" align="center" gap="md">
                <Checkbox
                  name={`contact-${contact.hs_object_id}`}
                  checked={selectedContacts.includes(contact.hs_object_id)}
                  onChange={(checked) =>
                    handleContactSelect(contact.hs_object_id, checked)
                  }
                />
                <Box style={{ flex: 1 }}>
                  <Text variant="h5">
                    {contact.firstname} {contact.lastname}
                  </Text>
                  <Text variant="body" style={{ color: "#6B7280" }}>
                    {contact.email}
                  </Text>
                  {contact.phone && (
                    <Text variant="body" style={{ color: "#6B7280" }}>
                      {contact.phone}
                    </Text>
                  )}
                  <Text variant="body" style={{ color: "#4B5563" }}>
                    {contact.companyName}
                  </Text>
                </Box>
              </Flex>
            </Box>
          ))}
        </Box>
      )}

      {/* 関連付けボタン */}
      {selectedContacts.length > 0 && (
        <Flex justify="end">
          <Button
            variant="primary"
            onClick={handleAssociate}
            disabled={associating}
          >
            {associating
              ? `関連付け中... (${selectedContacts.length}件)`
              : `${selectedContacts.length}件のコンタクトを関連付け`}
          </Button>
        </Flex>
      )}
    </Flex>
  );
};


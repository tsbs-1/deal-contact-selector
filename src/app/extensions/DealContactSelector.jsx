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
  Input,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
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
  const [searchKeyword, setSearchKeyword] = useState("");

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
        name: "deal-contact-data-fetcher",
        parameters: { dealId },
      });

      const payload = result && typeof result === "object" && "response" in result
        ? result.response
        : result;

      if (!payload) {
        throw new Error("サーバレス関数からデータが返却されませんでした");
      }

      setData(payload);
      setSelectedContacts((prev) => {
        const availableIdSet = new Set(
          (payload.availableContacts || []).map((contact) =>
            String(contact.hs_object_id)
          )
        );
        return prev.filter((id) => availableIdSet.has(String(id)));
      });
    } catch (err) {
      setError(err.message || "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleContactSelect = (contactId, checked) => {
    if (checked) {
      setSelectedContacts((prev) =>
        prev.includes(contactId) ? prev : [...prev, contactId]
      );
    } else {
      setSelectedContacts((prev) => prev.filter((id) => id !== contactId));
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
  const sortedAvailableContacts = [...availableContacts].sort((a, b) => {
    const aCompany = (a.companyName || "").toLowerCase();
    const bCompany = (b.companyName || "").toLowerCase();
    if (aCompany !== bCompany) return aCompany.localeCompare(bCompany);

    const aName = `${a.firstname || ""} ${a.lastname || ""}`.trim().toLowerCase();
    const bName = `${b.firstname || ""} ${b.lastname || ""}`.trim().toLowerCase();
    return aName.localeCompare(bName);
  });

  const keyword = searchKeyword.trim().toLowerCase();
  const filteredAvailableContacts = keyword
    ? sortedAvailableContacts.filter((contact) => {
        const fullName = `${contact.firstname || ""} ${contact.lastname || ""}`
          .trim()
          .toLowerCase();
        const email = (contact.email || "").toLowerCase();
        const phone = (contact.phone || "").toLowerCase();
        const company = (contact.companyName || "").toLowerCase();
        return (
          fullName.includes(keyword) ||
          email.includes(keyword) ||
          phone.includes(keyword) ||
          company.includes(keyword)
        );
      })
    : sortedAvailableContacts;

  const visibleContacts = filteredAvailableContacts;
  const visibleContactIds = visibleContacts.map((contact) =>
    String(contact.hs_object_id)
  );
  const selectedVisibleCount = visibleContactIds.filter((id) =>
    selectedContacts.includes(id)
  ).length;

  const handleSelectAllVisible = () => {
    if (visibleContactIds.length === 0) return;
    setSelectedContacts((prev) => {
      const merged = new Set([...prev, ...visibleContactIds]);
      return Array.from(merged);
    });
  };

  const handleClearSelection = () => {
    setSelectedContacts([]);
  };

  const formatContactName = (contact) => {
    const name = `${contact.firstname || ""} ${contact.lastname || ""}`.trim();
    return name || "-";
  };

  return (
    <Flex direction="column" gap="md">
      <Box style={{ borderBottom: "1px solid #E5E7EB", paddingBottom: "8px" }}>
        <Text variant="h3">{dealName}</Text>
        <Text variant="body" style={{ color: "#4B5563" }}>
          会社に紐づくコンタクトから、Deal 未関連のものだけを選択できます
        </Text>
      </Box>

      {success && (
        <Alert
          title="成功"
          variant="success"
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      <Box
        style={{
          border: "1px solid #E2E8F0",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <Table bordered={true} flush={true}>
          <TableHead>
            <TableRow>
              <TableHeader align="left">会社</TableHeader>
              <TableHeader align="left">既存</TableHeader>
              <TableHeader align="left">選択可能</TableHeader>
              <TableHeader align="left">選択中</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>{companies.length}</TableCell>
              <TableCell>{summary.existingContactsCount ?? existingContacts.length}</TableCell>
              <TableCell>{summary.availableContactsCount ?? availableContacts.length}</TableCell>
              <TableCell>{selectedContacts.length}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>

      {availableContacts.length > 0 && (
        <Flex direction="column" gap="sm">
          <Input
            name="contact-search"
            label="コンタクト検索（氏名・メール・電話・会社名）"
            onInput={(value) => setSearchKeyword(value || "")}
          />
          <Flex direction="row" gap="sm" justify="start">
            <Button onClick={handleSelectAllVisible} disabled={visibleContactIds.length === 0}>
              表示中を全選択
            </Button>
            <Button onClick={handleClearSelection} disabled={selectedContacts.length === 0}>
              選択をクリア
            </Button>
          </Flex>
          {keyword && (
            <Text variant="body" style={{ color: "#6B7280" }}>
              検索結果: {visibleContacts.length}件（表示中選択: {selectedVisibleCount}件）
            </Text>
          )}
        </Flex>
      )}

      {availableContacts.length === 0 ? (
        <Alert title="情報" variant="info">
          関連付け可能な新しいコンタクトはありません。
        </Alert>
      ) : visibleContacts.length === 0 ? (
        <Alert title="該当なし" variant="info">
          条件に一致するコンタクトがありません。検索キーワードを変更してください。
        </Alert>
      ) : (
        <Box>
          <Text variant="h4" style={{ marginBottom: "8px" }}>
            選択可能なコンタクト ({visibleContacts.length}件)
          </Text>

          <Table bordered={true} flush={true}>
            <TableHead>
              <TableRow>
                <TableHeader width="min">選択</TableHeader>
                <TableHeader width="auto">氏名</TableHeader>
                <TableHeader width="auto">メール</TableHeader>
                <TableHeader width="auto">電話</TableHeader>
                <TableHeader width="auto">会社</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleContacts.map((contact) => {
                const contactId = String(contact.hs_object_id);
                const isSelected = selectedContacts.includes(contactId);
                return (
                  <TableRow key={contactId}>
                    <TableCell width="min">
                      <Checkbox
                        name={`contact-${contactId}`}
                        checked={isSelected}
                        onChange={(checked) =>
                          handleContactSelect(contactId, checked)
                        }
                      />
                    </TableCell>
                    <TableCell width="auto">{formatContactName(contact)}</TableCell>
                    <TableCell width="auto">{contact.email || "-"}</TableCell>
                    <TableCell width="auto">{contact.phone || "-"}</TableCell>
                    <TableCell width="auto">
                      {contact.companyName || "会社未設定"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      <Flex justify="space-between" align="center">
        <Box>
          <Text variant="body" style={{ color: "#4B5563" }}>
            {selectedContacts.length === 0
              ? "コンタクトを選択してください"
              : `${selectedContacts.length}件を選択中`}
          </Text>
        </Box>
        <Button
          variant="primary"
          onClick={handleAssociate}
          disabled={associating || selectedContacts.length === 0}
        >
          {associating
            ? `関連付け中... (${selectedContacts.length}件)`
            : `${selectedContacts.length}件のコンタクトを関連付け`}
        </Button>
      </Flex>
    </Flex>
  );
};


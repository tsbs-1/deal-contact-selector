# Deal Contact Selector App

HubSpot の Deal レコード上で、以下を実現する Private App です。

- Deal に関連する会社のコンタクトを一覧表示
- すでに Deal に関連済みのコンタクトを除外
- 未関連コンタクトを選択して Deal に一括関連付け

UI Extension + Serverless Functions + HubSpot CRM REST API で構成されています。

---

## 1. 機能概要

### 対象画面

- CRM Deal レコードのタブ上に `Deal Contact Selector` カードを表示

### できること

- Deal に紐づく会社を取得
- その会社に紐づくコンタクトを取得
- すでに Deal と直接関連付いているコンタクトを除外
- 検索 / フィルター / 選択 / 一括関連付け

### データ取得の方針

- GraphQL は使用せず、CRM REST API を使用
- Associations API (v4) はページネーション前提で全件取得

---

## 2. アーキテクチャ

### フロントエンド（UI Extension）

- `src/app/extensions/DealContactSelector.jsx`
  - HubSpot UI コンポーネントでカードUIを構築
  - `runServerlessFunction` を通してサーバレス関数を呼び出し

### サーバレス関数

- `src/app/app.functions/deal-contact-data-fetcher.js`
  - Deal / Company / Contact を CRM REST API から取得
  - 関連済み / 未関連を判定して UI 向けデータを返却

- `src/app/app.functions/associations-handler.js`
  - 選択されたコンタクトを Deal に関連付け

### 関数登録

- `src/app/app.functions/serverless.json`
  - `deal-contact-data-fetcher`
  - `associations-handler`

---

## 3. 使用 API（HubSpot CRM REST）

### 取得系

- `GET /crm/v3/objects/deals/{dealId}?properties=dealname`
- `GET /crm/v4/objects/deal/{dealId}/associations/company`
- `GET /crm/v4/objects/deal/{dealId}/associations/contact`
- `GET /crm/v4/objects/company/{companyId}/associations/contact`
- `POST /crm/v3/objects/companies/batch/read`
- `POST /crm/v3/objects/contacts/batch/read`

### 更新系

- `PUT /crm/v4/objects/deal/{dealId}/associations/default/contact/{contactId}`

---

## 4. 必要なスコープ

`src/app/app.json` に定義:

- `crm.objects.contacts.read`
- `crm.objects.contacts.write`
- `crm.objects.deals.read`
- `crm.objects.deals.write`
- `crm.objects.companies.read`

---

## 5. セットアップ

## 前提

- HubSpot アカウント
- [HubSpot CLI](https://www.npmjs.com/package/@hubspot/cli) インストール済み
- CLI ログイン済み (`hs auth`)

### 環境変数（サーバレス）

サーバレスで Private App Token を使う場合は、HubSpot 側でシークレットを設定してください。
このプロジェクトでは `PRIVATE_APP_ACCESS_TOKEN` を参照します。

---

## 6. 開発コマンド

### ローカル開発

```bash
hs project dev
```

### アップロード + デプロイ

```bash
hs project upload
```

---

## 7. 主要ファイル

```text
deal-test/
├── hsproject.json
└── src/
    └── app/
        ├── app.json
        ├── extensions/
        │   ├── example-card.json
        │   └── DealContactSelector.jsx
        └── app.functions/
            ├── serverless.json
            ├── deal-contact-data-fetcher.js
            └── associations-handler.js
```

---

## 8. よくある問題と対処

### 1) コンタクトが一部しか表示されない

- 原因: associations のページネーション未対応
- 対処: v4 associations API で `after` を使って全件取得

### 2) UI が崩れる / 列が揃わない

- 原因: 独自 CSS で疑似テーブルを再現
- 対処: HubSpot 標準の `Table` 系コンポーネントを使う

### 3) 関連付けで 400 エラー

- 原因: 関連付け endpoint 形式の不一致
- 対処: v4 default association endpoint を使用

### 4) スコープ不足エラー

- 原因: `app.json` の scopes 不足
- 対処: 必要スコープを追加して再デプロイ

---

## 9. 注意事項

- `platformVersion: 2025.1` を使用しています（`hsproject.json`）
- HubSpot のアナウンスに従い、将来的な platform 移行計画を持つことを推奨

---

## 10. 命名について

以前のテンプレート名 `Get started App` から、以下へ変更済みです。

- App名: `Deal Contact Selector App`

`uid` は既存デプロイ資産との互換性維持のため変更していません。

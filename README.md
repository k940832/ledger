# 記帳本 PWA v1.6 — Google Sheets 雙向同步版

家庭記帳 PWA。資料先保存在裝置，並透過 Apps Script 與 Google Sheets 安全雙向合併。

---

## 檔案結構

```
Phase3_PWA雲端同步/
├── index.html          # PWA 主檔（含雲端同步邏輯）
├── sync-core.js        # 依交易 ID 安全合併的純函式
├── service-worker.js   # 離線快取
├── manifest.json       # PWA 安裝資訊
├── icon-192.png        # 主畫面圖示
├── icon-512.png        # 大圖示（splash / maskable）
├── 部署手冊.md          # 一步步教你部署
├── 測試清單.md          # 驗收測試
└── README.md           # 本檔
```

---

## 新增功能（相對於 Phase 1 v1.1）

| 功能 | 說明 |
|---|---|
| **☁️ 雲端同步設定** | 設定頁最上方，填 Web App URL + Secret 啟用 |
| **連線測試** | 即時確認 URL/Secret 是否正確 |
| **安全雙向同步** | 先送出本機待同步，再拉回 Sheets，依交易 ID 合併 |
| **自動同步** | 新增/編輯/刪除立即上傳；啟動、回到前景及每 5 分鐘自動拉回 |
| **離線重試** | 沒網路時進 queue，連網後自動補送 |
| **同步狀態 badge** | Header 旁邊圖示顯示狀態 ✓/⟳/⚠/⊘/✕ |
| **全部上傳** | 一鍵把本機所有紀錄推到雲端（首次設定用） |
| **災難復原** | 換手機/重灌用，確認後才清空本機再拉回 |
| **失敗紀錄** | 5 次重試後進 failed 清單，可檢視原因 |
| **Service Worker** | 離線可開啟介面、刷新不掉資料 |
| **iOS PWA** | 加到主畫面後全螢幕、無 Safari 網址列 |

---

## 同步狀態圖示

Header 右上「☁️」位置：

| 圖示 | 顏色 | 意義 |
|---|---|---|
| （隱藏） | – | 未設定雲端同步 |
| ✓ | 綠 | 已連線且 queue 空 |
| ⟳ | 橘（旋轉） | 同步中 |
| ⚠ | 黃 | 待同步 N 筆（離線中或暫時失敗） |
| ⊘ | 灰 | 離線 |
| ✕ | 紅 | 上次失敗（點開看設定頁的錯誤訊息） |

---

## 同步運作邏輯

```
PWA 端 saveEntry / updateEntry / deleteEntry
   ↓
syncDispatch(op, payload)
   ↓
enqueue → 寫 state.sync.pendingQueue
   ↓
若 online → flushQueue
   ↓
逐筆 POST 到 Apps Script Web App
   ↓ ok
shift queue，繼續下一筆
   ↓ ok=false 或 throw
重試最多 5 次，否則進 failed 列表
   ↓
getEntries 拉回 Google Sheets 全部資料
   ↓
依交易 ID 合併：同 ID 以雲端為準、本機獨有保留、待送/失敗 ID 不覆寫
```

觸發上傳與拉回的時機：
- 寫資料當下（如果 online）
- 上線 event (`online`)
- 切回前景 (`visibilitychange`) 時拉回
- 每 60 秒補送 queue；每 5 分鐘拉回

---

## 資料對映規則

PWA 內部用英文 ID（`food`、`acc_cash`），Sheets 顯示中文（`飲食`、`現金`）。同步時雙向轉換：

| PWA 內部 | Sheets 顯示 |
|---|---|
| `type: 'expense'` | 收支 = `支出` |
| `type: 'income'` | 收支 = `收入` |
| `type: 'transfer'` | 收支 = `轉帳` |
| `category: 'food'` | 類別 = `飲食` |
| `account: 'acc_cash'` | 帳戶 = `現金` |

**從雲端拉回時**：
- 類別中文找不到對應 ID → 自動放「其他」分類
- 帳戶名找不到 → 自動建立同名 cash 類型帳戶

---

## 隱私模型

| 層面 | 機制 |
|---|---|
| 原始碼 | 不含 URL / secret，可放心 push 到 GitHub |
| Apps Script | secret 存 Script Properties（Google 那邊，原始碼讀不到） |
| PWA 本機 | URL + secret 存 localStorage `ledger_sync_v1`（裝置本機） |
| 部署的 Cloudflare | 公開但**只有空白 PWA 介面**，沒人能用它寫資料（沒 secret 進不去 Apps Script） |
| Google 自己 | Sheets 內容當然 Google 看得到（同 Gmail / Drive） |

---

## 舊版相容

舊版 localStorage `ledger_v1` 完全沿用，沒同步設定就是純本地模式（跟 v1.1 行為一致）。
打開 v1.6 第一次：
- 主資料不變
- `ledger_sync_v1` 不存在 → 同步 badge 隱藏
- 想啟用雲端：去設定頁填 URL/Secret 即可

---

## 已知限制

| 限制 | 解決方式 |
|---|---|
| 兩台裝置同時改同一筆 | 最後寫入優先（雲端的）。Phase 4 之後再考慮版本欄位 |
| 直接在 Sheets 刪除整列 | 後端沒有刪除墓碑，PWA 本機獨有資料會保留；請從 PWA 刪除交易 |
| Apps Script 配額（每天 90 分鐘） | 一般家用不會用滿；超過會 fail → 隔天恢復 |
| Cloudflare 免費方案請求數 | 每日 100K req，PWA 自己用根本不夠看 |
| 雲端找不到的類別/帳戶 | 還原時自動建立，可能造成多餘類別 |

---

## 下一步

→ **Phase 4**：家庭記帳 Sheet 月度分析儀表板（圖表 / 預算追蹤）

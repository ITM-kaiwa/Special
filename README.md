# ITM 特別教育 学習 Web アプリ (Ứng dụng học tập Giáo dục đặc biệt ITM)

日本へ技能実習/育成就労で働きに行くベトナム人学習者向けの特別教育 Web アプリケーションです。
PowerPoint 教材（全50+課）の内容を完全移植し、ブラウザで簡単に学習・復習できます。

Ứng dụng web học tập giáo dục đặc biệt dành cho thực tập sinh kỹ năng / lao động sang Nhật Bản.
Chuyển đổi toàn bộ nội dung giáo trình PowerPoint (hơn 50 bài) sang dạng sách điện tử, thẻ ghi nhớ và bài tập trắc nghiệm.

---

## 🌟 主な機能 (Tính năng chính)

1. **📖 電子書籍 (Sách điện tử)**
   - 全50課の教材コンテンツを網羅。
   - すべての漢字にルビ（ふりがな）を自動付与。
   - ベトナム語解説 ⇄ 日本語本文の同時表示。
   - 畳み込み目次、キーワードリアルタイム検索、カテゴリ別フィルタ機能。

2. **🃏 フラッシュカード (Thẻ ghi nhớ)**
   - 語彙・日常表現の暗記用カード（400語以上）。
   - 日本語 ⇄ ベトナム語の表示切替（両方向対応）。
   - ローマ字読み表示。
   - 「覚えた / もう一度」による効率的な復習。

3. **✏️ 復習ドリル・クイズ (Bài tập ôn tập)**
   - 選択式テスト（240問以上）。
   - ランダム選択肢と即時判定。
   - スコア表示および復習進捗トラッキング。

4. **🌐 言語切替 (Chuyển đổi ngôn ngữ)**
   - ワンタップで UI の表示言語を「ベトナム語 (Tiếng Việt)」と「日本語」に切り替え。

5. **📊 進捗自動保存 (Lưu tiến độ tự động)**
   - ブラウザの localStorage を使用し、学習の進捗状況を自動保存。

---

## 📁 構成 (Cấu trúcファイル)

```text
Special/
├── index.html          # メイン SPA HTML
├── style.css           # レスポンシブ スタイルシート
├── app.js              # メインアプリケーションロジック
├── i18n.js             # 多言語UI文字列 (Vietnamese / Japanese)
├── data/               # 教材データ
│   ├── categories.js   # カテゴリ定義 (アイコン・日越ラベル付き)
│   ├── chapters.js     # 電子書籍データ (全50課)
│   ├── flashcards.js   # フラッシュカードデータ
│   └── drills.js       # ドリルデータ
├── extract_pptx.py     # PowerPoint テキスト抽出スクリプト
└── build_data_smart.py # 高精度データ変換・自動ルビ付与スクリプト
```

---

## 🚀 使い方 (Cách sử dụng)

### ブラウザで開く (Mở trực tiếp trên trình duyệt)
`index.html` をブラウザで開くだけでオフラインでもそのまま使用できます（ビルドやサーバーインストールは不要）。

---

© 2026 ITM外語センター

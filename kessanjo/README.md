# 風雲！決算城

戦国エンタメ型・金融教育メディア。  
決算書から武将を呼び、城で語る。

---

## GitHub Pages 公開手順（3ステップ）

### STEP 1：リポジトリ作成

1. GitHub（https://github.com）にログイン
2. 右上「+」→「New repository」
3. 設定：
   - Repository name: `kessanjo`（または任意の名前）
   - Public を選択
   - 「Create repository」をクリック

### STEP 2：ファイルをアップロード

**方法A：ブラウザからドラッグ&ドロップ（推奨）**
1. 作成したリポジトリを開く
2. 「uploading an existing file」をクリック
3. このフォルダ（kessanjo/）の中身を全選択してドラッグ
4. 「Commit changes」をクリック

**方法B：git コマンド（慣れている場合）**
```bash
git init
git add .
git commit -m "initial commit: 風雲！決算城 DAY1"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/kessanjo.git
git push -u origin main
```

### STEP 3：GitHub Pages を有効化

1. リポジトリの「Settings」タブを開く
2. 左メニュー「Pages」をクリック
3. Source: 「Deploy from a branch」を選択
4. Branch: `main` / `/ (root)` を選択
5. 「Save」をクリック
6. 数分後に `https://YOUR_NAME.github.io/kessanjo/` で公開される

---

## 公開後にやること（真平タスク）

- [ ] `GA_MEASUREMENT_ID` を実際のGA4 IDに置換
  - index.html と articles/fastretailing-shirasagijo.html の2箇所
- [ ] `AFFILIATE_LINK_HERE` を実際のアフィリリンクに置換
  - index.html と articles/fastretailing-shirasagijo.html の2箇所
- [ ] `YOUR_DOMAIN` をGitHub Pages URLに置換（OGP用）
  - 全htmlファイル内の `https://YOUR_DOMAIN/` を置換
- [ ] `images/ogp.png`（1200×630px）を作成・配置

---

## ファイル構成

```
kessanjo/
├── index.html                          ← TOPページ
├── css/style.css                       ← 全スタイル
├── js/main.js                          ← 軽量JS
├── images/.gitkeep                     ← 画像置き場（チャッピーが生成）
├── articles/
│   └── fastretailing-shirasagijo.html  ← 第一城：ユニクロ×家康
└── README.md                           ← この手順書
```

---

## DAY2 クロコへの依頼内容

```
・4コマのストーリーボード・台詞生成
  （ユニクロ × 白鷺城 × 家康 / 縦型 / 4コマ）
・4コマ用プロンプト（チャッピーに渡す）
```

## DAY3 真平タスク

```
・画像を images/ に配置
・GA4 ID・アフィリリンク差し替え
・GitHubアップロード
・GitHub Pages 公開設定
・Instagramに4コマ投稿（初回）
□ GA4 計測が動いているか
□ OGPがXでプレビューされるか
□ スマホ表示が崩れていないか
□ アフィリリンクが正しく飛ぶか
□ 免責事項が全ページにあるか
```

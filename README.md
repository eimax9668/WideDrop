# WideDrop

Google Chat でファイルを添付するとき、入力欄を狙って正確にドロップしなくてもよくする Chrome 拡張機能です。

Dock や Finder からドラッグしたファイルを、Google Chat の画面上のどこに落としても、開いている会話の入力欄へ添付できるようにします。

> **WideDrop is an independent project and is not affiliated with, endorsed by, or sponsored by Google.**

## できること

- Google Chat の画面全体をファイルのドロップ領域として扱います。
- ファイルをドラッグしている間、画面にドロップ可能な表示を出します。
- ドロップされたファイルを、現在開いている会話の入力欄へ渡します。
- 入力欄へ直接ドロップした場合は、Google Chat 本来の動作を優先します。

## こんな人に便利です

- Mac の Dock に置いたフォルダから、Google Chat へよくファイルを添付する人
- 入力欄が細くて、ドラッグ＆ドロップが地味にストレスな人
- Google Chat をブラウザで常用している人

## 対応環境

- Google Chrome
- Microsoft Edge などの Chromium 系ブラウザ
- Google Chat Web 版

### 対象ページ

- `https://chat.google.com/app/chat/*`
- `https://mail.google.com/mail/u/*/#chat/space/*`

## インストール方法

### 開発者モードで使う場合

1. Chrome で `chrome://extensions` を開きます。
2. 右上の「デベロッパー モード」をオンにします。
3. 「パッケージ化されていない拡張機能を読み込む」を押します。
4. このリポジトリの `WideDrop-main` フォルダを選びます。
5. Google Chat を再読み込みします。

## 使い方

1. Google Chat で会話またはスペースを開きます。
2. Finder や Dock のフォルダからファイルをドラッグします。
3. Google Chat の画面上のどこかにドロップします。
4. ファイルが入力欄に添付されます。

添付されたあとは、通常どおり Google Chat の送信ボタンで送信してください。

**WideDrop が勝手にメッセージを送信することはありません。**

## 権限について

WideDrop は、Google Chat のページ上でのみ動作します。

WideDrop は、ファイルを外部サーバーへ送信したり、内容を保存したりしません。ドロップされたファイルは、Google Chat の添付処理へ渡すためだけに使用します。

## プライバシー

- ファイルの内容を読み取って保存しません。
- 外部サーバーへ通信しません。
- チャット本文や添付ファイルを収集しません。
- アナリティクスやトラッキングは入れていません。

## 開発者向けメモ

WideDrop は Manifest V3 の content script として動作します。

ブラウザの仕様上、ドラッグされたファイル情報は `drop` / `paste` イベント中にしか安全に読み取れません。そのため、ファイルは `drop` ハンドラ内で即座に Google Chat の入力欄候補へ渡します。

Google Chat の DOM は変更される可能性があるため、固定セレクタだけには依存していません。フォーカス中の要素、`role="textbox"`、`contenteditable`、`aria-label`、画面内の位置などから入力欄候補を探します。

## ライセンス

MIT License

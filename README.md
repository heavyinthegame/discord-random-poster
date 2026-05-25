# Discord Random Poster

`posts.json` から投稿文をランダムに1つ選び、指定した Discord チャンネルへランダム間隔で投稿する Bot です。

## セットアップ

1. Discord Developer Portal で Bot を作成し、Token を発行します。
2. OAuth2 / Installation で `bot` と `applications.commands` を有効にし、Bot 権限は `View Channels` と `Send Messages` を付けます。
3. Discord の開発者モードを有効にして、投稿先チャンネル ID をコピーします。
4. `.env` に Token とチャンネル ID を入れます。

```env
DISCORD_TOKEN=ここにBotのToken
CHANNEL_ID=ここに投稿先チャンネルID
MIN_INTERVAL_MINUTES=360
MAX_INTERVAL_MINUTES=900
POST_ON_STARTUP=false
```

初期設定は 6〜15 時間に1回のランダム投稿です。

## PCで起動する場合

```sh
npm start
```

この方法では、PCが起動していて `npm start` が動いている間だけ投稿されます。

構文チェックだけ行う場合:

```sh
npm run check
```

## 無料で常時運用する場合

PCやVPSを常時起動したくない場合は、GitHub Actions で定期実行します。

この方式では Bot をDiscordに常時接続しません。GitHub Actions が1時間ごとに起動し、`.poster-state.json` に保存された次回投稿時刻を見て、時刻を過ぎていれば Discord API に1回投稿して終了します。

用意済みの workflow:

```text
.github/workflows/random-poster.yml
```

GitHubで設定する Secrets:

```text
DISCORD_TOKEN
CHANNEL_ID
```

設定手順:

1. このフォルダをGitHubリポジトリにpushします。
2. GitHubのリポジトリで `Settings` → `Secrets and variables` → `Actions` を開きます。
3. `Repository secrets` に `DISCORD_TOKEN` と `CHANNEL_ID` を追加します。
4. `Actions` タブで `Random Discord Poster` を有効にします。

手動テストしたい場合は、GitHubの `Actions` タブから `Random Discord Poster` → `Run workflow` を押します。`force_post` をONにすると、すぐ1回投稿してから次回投稿時刻をランダムに決めます。

ローカルで1回だけ投稿テストする場合:

```sh
npm run post:once
```

ローカルでスケジュール判定だけ試す場合:

```sh
npm run post:scheduled
```

## 投稿文の編集

`posts.json` の配列に投稿したい文章を追加します。改行したい場合は `\n` を使います。

```json
[
  "今日のTeX64 Tip：\n数式スクショをそのままLaTeXに変換できます。"
]
```

`posts.json` は投稿のたびに読み直すため、Bot を動かしたまま投稿文を追加しても次回投稿から反映されます。

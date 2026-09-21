# Jev × obniz LED — Physical AI Hello World

一行のテキストを打ち込むと、Jev（TypeSafe AI の System One Model）が **1回の呼び出しで3つの型付き判断** を返し、それがそのまま WS2812B LED 15個の色・本数・明るさ・点滅になります。

```
"緊急ではないけど今日中に返事ほしい"
        │
        ▼  POST /v1/systemone（質問3つを並列評価、約200ms）
      Jev ──▶ { signal: caution (conf 1.00), severity: 1.1/4, needs_reply: 0.98 }
        │
        ▼  obniz HTTP API（約50ms）
      LED  [■■■■···········] 黄 4/15 明るさ最大 点滅
```

センサーはありません。Jev の本質は「意味を理解した結果が **型付きの値** で返り、そのままコードの分岐になる」ことなので、その値を物理量に写す最小のアクチュエータとして LED だけを使います。

## 対応表

| Jev の答え | 型 | LED |
|---|---|---|
| `signal` = fine / caution / alert | Choice | 色（緑 / 黄 / 赤） |
| `signal.confidence` 0〜1 | — | 明るさ（迷っていると暗い） |
| `severity` 0〜4 | Score | 点灯する本数（0〜15） |
| `needs_reply` 0〜1 | Noul | 0.5 超なら点滅 |

質問の定義は [`src/jev.ts`](src/jev.ts)、LED への写像は [`src/render.ts`](src/render.ts) にあり、この2ファイルを書き換えるだけで別の「意味の信号機」になります。

## ハードウェア

[obniz-led-skill](https://github.com/kofujimura/obniz-led-skill) と同じ構成です。

- M5 Atom Lite（ObnizOS）
- WS2812B × 15、DIN を GPIO26 に接続
- 制御は obniz クラウド HTTP API に直接 POST（SDK・WebSocket 不使用）

## セットアップ

```bash
npm install
```

リポジトリ直下（または `hello-led/`）に `.env.local` を置きます。

```
TYPESAFE_API_KEY=...        # https://console.typesafe.ai/keys
OBNIZ_ID=xxxx-xxxx          # obniz デバイス ID
LED_COUNT=15
OBNIZ_ACCESS_TOKEN=...      # 非公開デバイスの場合のみ
```

## 使い方

```bash
npm start                                        # 対話モード。1行打つたびに LED が変わる
npm start -- "本番サーバーのディスクが98%です"      # 1回だけ判断して、結果を LED に残して終了
npm start -- --rule                              # Jev の代わりにキーワードルールで判断（比較用）
npm run dry                                      # obniz なし。LED をテキストで表示
npm run dry < scenarios.txt                      # シナリオ集を順に流す
```

対話モードは Ctrl-C で終了し、LED を消灯します。判断はすべて `logs/decisions.jsonl` に、Jev の生レスポンスと所要時間つきで記録されます。

## 実行例（jev-1.13.0、2026-09-21）

```
> 先週のレポート、良かったよ
  signal=fine (conf 1.00)  severity=0.0/4  needs_reply=0.09  | jev 794ms  led 0ms
  [■··············] fine 1/15 brightness=102
> 本番サーバーのディスクが98%です
  signal=alert (conf 0.95)  severity=3.3/4  needs_reply=0.29  | jev 234ms  led 0ms
  [■■■■■■■■■■■■■··] alert 13/15 brightness=99
> 緊急ではないけど今日中に返事ほしい
  signal=caution (conf 1.00)  severity=1.1/4  needs_reply=0.98  | jev 204ms  led 0ms
  [■■■■···········] caution 4/15 brightness=102 blink
> あれ、どうなった？
  signal=caution (conf 0.70)  severity=0.7/4  needs_reply=0.88  | jev 213ms  led 0ms
  [■■·············] caution 2/15 brightness=81 blink
```

同じ「緊急ではないけど今日中に返事ほしい」をキーワードルール（`--rule`）に通すと、「緊急」に反応して赤・15本になります。

```
  signal=alert (conf 1.00)  severity=4.0/4  needs_reply=1.00  | rule 0ms  led 0ms
  [■■■■■■■■■■■■■■■] alert 15/15 brightness=102 blink
```

「あれ、どうなった？」は Jev も迷っていて（confidence 0.70）、LED が少し暗くなります。ルールには「迷う」という出力がありません。

## ファイル構成

```
src/
  main.ts      入力ループ・ログ・終了処理
  env.ts       .env.local の読み込み（最初に import）
  decision.ts  Decision 型と DecisionProvider interface
  jev.ts       質問の定義と Jev 呼び出し        ← ここを書き換える
  render.ts    Decision → LED フレーム          ← ここを書き換える
  rule.ts      キーワードルール（比較用ベースライン）
  led.ts       WS2812B の SPI エンコードと obniz HTTP API（obniz-led-skill の src/obniz.ts から移植）
scenarios.txt  サンプル入力
logs/          decisions.jsonl（自動生成）
```

## 次の一歩

- **文脈を足す**：state を `{ message, from: "上司", time: "23:40" }` のようにして、同じ文でも判断が変わるのを見る（`src/jev.ts` の `state` を変えるだけ）
- **LLM と比べる**：同じ質問を JSON Schema 強制の LLM に投げる `DecisionProvider` を足し、色が変わるまでの体感差と confidence の較正を比べる
- **入力をセンサーに替える**：距離センサーの履歴を文章化して `message` に入れれば、そのまま最初の「フィジカルAI」になる

## 注意

- WS2812B の明るさは `MAX_BRIGHTNESS = 0x66` に制限しています（過電流防止）。
- Jev の主要学習言語は英語です。質問文は英語で書き、state（メッセージ）は日本語のままにしています。上の実行例のとおり日本語でも動きますが、精度は英語より落ちる可能性があると公式ドキュメントに明記されています。
- API key はブラウザに置かず、Node 側で `.env.local` から読みます。

## 参考

- [TypeSafe AI: Introduction](https://docs.typesafe.ai/introduction) / [JavaScript SDK](https://docs.typesafe.ai/sdk/javascript) / [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13)
- [kofujimura/obniz-led-skill](https://github.com/kofujimura/obniz-led-skill) — 本プロジェクトの LED 制御部（`src/led.ts`）の元になったコードとハードウェア構成
- [obniz REST API](https://docs.obniz.com/ja/reference/cloud/rest-api/)

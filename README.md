# Option MTM Workbench

自然言語で株式オプションの取引条件を入力し、`SABR` または `Heston` を選んで時価評価するシンプルな静的Webアプリです。

## できること

- 日本語または英語に近い自然文から、銘柄、満期、権利行使価格、コール/プット、枚数、売買方向を抽出
- `SABR` は Hagan 近似でインプライドボラを作って Black-Scholes 価格へ接続
- `Heston` はブラウザで安定して動かしやすいモンテカルロ近似評価
- Alpha Vantage の API キーがあれば、最新株価と日次履歴を取得してスポットとヒストリカルボラを自動補正
- `USDJPY` を指定して円換算表示

## 使い方

1. [index.html](./index.html) をブラウザで開きます。
2. 例:
   - `AAPLの2026-12-18満期、権利行使価格220ドルのコールを10枚買い`
   - `Buy 3 TSLA 2026-09-18 300 put`
3. 必要なら Spot / 金利 / 配当 / ボラ / USDJPY を手入力します。
4. 最新データを使いたい場合は Alpha Vantage の API キーを入力します。
5. `Parse & Price` を押します。

## GitHub Pages

このリポジトリは静的サイトとしてそのまま GitHub Pages に公開できます。

1. GitHub に push します。
2. リポジトリの `Settings > Pages > Build and deployment` を開きます。
3. `Source` は `GitHub Actions` を選びます。
4. `main` ブランチへ push すると、[.github/workflows/deploy-pages.yml](./.github/workflows/deploy-pages.yml) で自動デプロイされます。

公開後のURLは通常 `https://<user>.github.io/<repo>/` です。

## 補足

- 現状は欧州型バニラのみ対象です。
- オプション市場の板気配や実際のIVサーフェスは取得していません。
- `Heston` はモンテカルロなので、`MC Paths` と `MC Steps` に応じて評価値が少し揺れます。
- Alpha Vantage の無料枠では呼び出し制限があります。

## 参照

- [Alpha Vantage Documentation](https://www.alphavantage.co/documentation/)

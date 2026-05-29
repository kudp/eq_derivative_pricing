# シンプル IRS CVA プライサー

ブラウザだけで利用できる、金利スワップ向けの簡易 CVA プライサーです。Bloomberg 端末風の画面で、元本・満期・サイドを選び、Hull-White 1ファクターのモンテカルロで期待エクスポージャーと片側 CVA を評価します。

## リンク

- アプリ本体: [index.html](./index.html)
- ローカルで確認する場合: `python3 -m http.server 4173 --bind 127.0.0.1` を実行して、<http://127.0.0.1:4173/index.html> を開きます。
- GitHub Pages 公開後: `https://<user>.github.io/<repo>/` または `https://<user>.github.io/<repo>/index.html` でアクセスできます。

## 主な機能

- 金利スワップの簡易 CVA 評価
- 元本、満期、固定支払 / 固定受取サイドの選択
- Hull-White 1ファクター短期金利モデルによるモンテカルロ評価
- 固定金利、回収率、初期短期金利、平均回帰、金利ボラ、信用スプレッド、MCパス数の入力
- CVA金額、CVA bp、スワップ NPV、期待エクスポージャープロファイルの表示
- Bloomberg 風のダークテーマ UI

## 評価ロジック

短期金利を次の平均回帰過程で月次シミュレーションします。

```text
dr(t) = a(θ - r(t))dt + σdW(t)
```

各四半期で残存スワップの時価を簡易評価し、正の時価だけを平均して EE（Expected Exposure）を計算します。CVA は次の片側 CVA として計算します。

```text
CVA = (1 - Recovery) × Σ DF(t) × EE(t) × ΔPD(t)
```

信用スプレッドから一定ハザードレートを近似し、四半期ごとの限界デフォルト確率を求めています。

## 使い方

1. [index.html](./index.html) をブラウザで開きます。
2. 元本、満期、サイドなどの条件を入力します。
3. `CVAを評価` ボタンを押します。
4. 右側のサマリー、チャート、テーブルで結果を確認します。

## 注意事項

このアプリはデモ用途の簡易実装です。実務で必要となるカーブ構築、Hull-White の市場キャリブレーション、担保・CSA、ネットティング、Wrong Way Risk、CVA デスク向けの各種調整は含みません。

## GitHub Pages

このリポジトリは静的サイトとしてそのまま GitHub Pages に公開できます。

1. GitHub に push します。
2. リポジトリの `Settings > Pages > Build and deployment` を開きます。
3. `Source` は `GitHub Actions` を選びます。
4. `main` ブランチへ push すると、[deploy-pages.yml](./deploy-pages.yml) で自動デプロイされます。

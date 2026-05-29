# シンプル IRS CVA プライサー

金利スワップの片側CVAをブラウザだけで評価するデモアプリです。元本、満期、サイドを選び、Hull-White 1ファクターのモンテカルロで期待エクスポージャーとCVAを計算します。

## 起動

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

その後、<http://127.0.0.1:4173/index.html> を開きます。

## 機能

- 金利スワップのCVA Price、CVA bp、Clean Swap NPVを表示
- 元本、満期、固定支払 / 固定受取サイドを選択
- Hull-White 1Fモデルを月次ステップでモンテカルロ評価
- 四半期ごとのExpected Exposure、Marginal PD、CVA寄与を表示
- Bloomberg端末風の黒背景・アンバー・グリーン配色UI

## 計算概要

短期金利を次の過程で生成します。

```text
dr = a(θ - r)dt + σdW
```

各四半期で残存スワップ時価の正値を平均してExpected Exposureを作り、信用スプレッドから一定ハザードレートを近似します。

```text
CVA = (1 - Recovery) × Σ DF(t) × EE(t) × ΔPD(t)
```

この実装はデモ用の簡易プライサーです。実務向けのカーブ構築、モデルキャリブレーション、担保、ネッティング、Wrong Way Riskは含みません。

# ミニ・インベーダー

ブラウザだけで遊べる、シンプルなインベーダーゲームです。依存関係やビルド手順は不要で、`index.html` を開くだけで起動できます。

## リンク

- ゲーム本体: [index.html](./index.html)
- ローカルで確認する場合: `python3 -m http.server 4173 --bind 127.0.0.1` を実行して、<http://127.0.0.1:4173/index.html> を開きます。
- GitHub Pages 公開後: `https://<user>.github.io/<repo>/` または `https://<user>.github.io/<repo>/index.html` でアクセスできます。

## 遊び方

1. [index.html](./index.html) をブラウザで開きます。
2. `スタート` ボタン、または `Space` キーでゲーム開始。
3. `←` / `→` または `A` / `D` で自機を移動します。
4. `Space` でショットを撃ち、インベーダーを全滅させるとレベルアップします。
5. 敵の弾やインベーダーの着地を避けながら、高得点を狙いましょう。

## 機能

- スコア、レベル、ライフ表示
- レベルアップごとに敵の移動と攻撃がスピードアップ
- キーボード操作とスマートフォン向けタッチ操作
- 一時停止、リセット、ゲームオーバー後の再挑戦

## GitHub Pages

このリポジトリは静的サイトとしてそのまま GitHub Pages に公開できます。

1. GitHub に push します。
2. リポジトリの `Settings > Pages > Build and deployment` を開きます。
3. `Source` は `GitHub Actions` を選びます。
4. `main` ブランチへ push すると、[deploy-pages.yml](./deploy-pages.yml) で自動デプロイされます。

公開後のURLは通常 `https://<user>.github.io/<repo>/` です。

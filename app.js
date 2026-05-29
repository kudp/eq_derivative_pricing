const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const levelEl = document.querySelector("#level");
const livesEl = document.querySelector("#lives");
const overlay = document.querySelector("#overlay");
const overlayKicker = document.querySelector("#overlayKicker");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const resetButton = document.querySelector("#resetButton");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const keys = new Set();

const state = {
  running: false,
  paused: false,
  gameOver: false,
  score: 0,
  level: 1,
  lives: 3,
  lastTime: 0,
  stars: createStars(90),
  player: createPlayer(),
  bullets: [],
  enemyBullets: [],
  invaders: [],
  fleetDirection: 1,
  fleetStepDown: 20,
  enemyFireTimer: 0,
  messageTimer: 0,
};

function createPlayer() {
  return {
    x: WIDTH / 2 - 24,
    y: HEIGHT - 58,
    width: 48,
    height: 28,
    speed: 360,
    cooldown: 0,
  };
}

function createStars(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * WIDTH,
    y: Math.random() * HEIGHT,
    size: Math.random() * 1.8 + 0.5,
    speed: Math.random() * 24 + 10,
  }));
}

function buildFleet() {
  state.invaders = [];
  const rows = Math.min(3 + Math.floor(state.level / 2), 6);
  const columns = 9;
  const paddingX = 74;
  const startY = 72;
  const gapX = 58;
  const gapY = 42;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      state.invaders.push({
        x: paddingX + col * gapX,
        y: startY + row * gapY,
        width: 34,
        height: 24,
        wobble: Math.random() * Math.PI * 2,
        points: (rows - row) * 10,
      });
    }
  }

  state.fleetDirection = 1;
  state.enemyFireTimer = Math.max(0.38, 1.2 - state.level * 0.08);
}

function resetGame() {
  state.running = false;
  state.paused = false;
  state.gameOver = false;
  state.score = 0;
  state.level = 1;
  state.lives = 3;
  state.player = createPlayer();
  state.bullets = [];
  state.enemyBullets = [];
  buildFleet();
  updateHud();
  showOverlay("Ready?", "侵略を止めよう", "スタートを押すか、スペースキーでゲーム開始。");
  drawScene(0);
}

function startGame() {
  if (state.gameOver) {
    resetGame();
  }

  state.running = true;
  state.paused = false;
  hideOverlay();
  state.lastTime = performance.now();
  requestAnimationFrame(loop);
}

function togglePause() {
  if (!state.running || state.gameOver) {
    return;
  }

  state.paused = !state.paused;
  if (state.paused) {
    showOverlay("Paused", "一時停止中", "再開するには一時停止ボタン、または P キーを押してください。");
  } else {
    hideOverlay();
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

function loop(time) {
  if (!state.running || state.paused) {
    return;
  }

  const delta = Math.min((time - state.lastTime) / 1000, 0.033);
  state.lastTime = time;
  update(delta);
  drawScene(time / 1000);
  requestAnimationFrame(loop);
}

function update(delta) {
  updateStars(delta);
  updatePlayer(delta);
  updateBullets(delta);
  updateInvaders(delta);
  updateEnemyFire(delta);
  detectCollisions();
  checkRoundState();
}

function updateStars(delta) {
  for (const star of state.stars) {
    star.y += star.speed * delta;
    if (star.y > HEIGHT) {
      star.y = -4;
      star.x = Math.random() * WIDTH;
    }
  }
}

function updatePlayer(delta) {
  const player = state.player;
  const movingLeft = keys.has("ArrowLeft") || keys.has("KeyA");
  const movingRight = keys.has("ArrowRight") || keys.has("KeyD");

  if (movingLeft) {
    player.x -= player.speed * delta;
  }
  if (movingRight) {
    player.x += player.speed * delta;
  }

  player.x = clamp(player.x, 16, WIDTH - player.width - 16);
  player.cooldown = Math.max(0, player.cooldown - delta);

  if (keys.has("Space")) {
    shoot();
  }
}

function shoot() {
  const player = state.player;
  if (!state.running || state.paused || player.cooldown > 0) {
    return;
  }

  state.bullets.push({
    x: player.x + player.width / 2 - 3,
    y: player.y - 12,
    width: 6,
    height: 18,
    speed: 520,
  });
  player.cooldown = 0.22;
}

function updateBullets(delta) {
  for (const bullet of state.bullets) {
    bullet.y -= bullet.speed * delta;
  }
  for (const bullet of state.enemyBullets) {
    bullet.y += bullet.speed * delta;
  }

  state.bullets = state.bullets.filter((bullet) => bullet.y + bullet.height > 0);
  state.enemyBullets = state.enemyBullets.filter((bullet) => bullet.y < HEIGHT + bullet.height);
}

function updateInvaders(delta) {
  if (state.invaders.length === 0) {
    return;
  }

  const speed = 34 + state.level * 9;
  let hitEdge = false;

  for (const invader of state.invaders) {
    invader.x += speed * state.fleetDirection * delta;
    invader.wobble += delta * 4;
    if (invader.x < 18 || invader.x + invader.width > WIDTH - 18) {
      hitEdge = true;
    }
  }

  if (hitEdge) {
    state.fleetDirection *= -1;
    for (const invader of state.invaders) {
      invader.y += state.fleetStepDown;
      invader.x = clamp(invader.x, 18, WIDTH - invader.width - 18);
    }
  }
}

function updateEnemyFire(delta) {
  state.enemyFireTimer -= delta;
  if (state.enemyFireTimer > 0 || state.invaders.length === 0) {
    return;
  }

  const shooter = state.invaders[Math.floor(Math.random() * state.invaders.length)];
  state.enemyBullets.push({
    x: shooter.x + shooter.width / 2 - 3,
    y: shooter.y + shooter.height,
    width: 6,
    height: 16,
    speed: 180 + state.level * 22,
  });
  state.enemyFireTimer = Math.max(0.28, 1.15 - state.level * 0.07) + Math.random() * 0.45;
}

function detectCollisions() {
  for (const bullet of [...state.bullets]) {
    const hit = state.invaders.find((invader) => overlaps(bullet, invader));
    if (hit) {
      state.bullets = state.bullets.filter((item) => item !== bullet);
      state.invaders = state.invaders.filter((item) => item !== hit);
      state.score += hit.points;
      updateHud();
    }
  }

  for (const bullet of [...state.enemyBullets]) {
    if (overlaps(bullet, state.player)) {
      state.enemyBullets = state.enemyBullets.filter((item) => item !== bullet);
      loseLife();
      break;
    }
  }

  const landed = state.invaders.some((invader) => invader.y + invader.height >= state.player.y - 4);
  if (landed) {
    loseLife(true);
  }
}

function loseLife(resetFleet = false) {
  state.lives -= 1;
  state.enemyBullets = [];
  state.bullets = [];
  state.player = createPlayer();
  updateHud();

  if (state.lives <= 0) {
    endGame();
    return;
  }

  if (resetFleet) {
    buildFleet();
  }
}

function checkRoundState() {
  if (state.invaders.length > 0 || state.gameOver) {
    return;
  }

  state.level += 1;
  state.score += 100 * state.level;
  state.bullets = [];
  state.enemyBullets = [];
  buildFleet();
  updateHud();
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  showOverlay("Game Over", "地球は守られた？", `最終スコア: ${state.score}。リセットまたはスタートで再挑戦できます。`);
}

function drawScene(time) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground();
  drawStars();
  drawPlayer();
  drawInvaders(time);
  drawBullets();
  drawGroundLine();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#050916");
  gradient.addColorStop(0.62, "#08132a");
  gradient.addColorStop(1, "#10091f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawStars() {
  for (const star of state.stars) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + star.size / 3})`;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
}

function drawPlayer() {
  const { x, y, width, height } = state.player;
  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = "#5df2ff";
  ctx.fillStyle = "#5df2ff";
  ctx.beginPath();
  ctx.moveTo(x + width / 2, y);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8dff6a";
  ctx.fillRect(x + width / 2 - 5, y - 5, 10, 10);
  ctx.restore();
}

function drawInvaders(time) {
  for (const invader of state.invaders) {
    const bob = Math.sin(time * 5 + invader.wobble) * 2;
    const x = invader.x;
    const y = invader.y + bob;

    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#8dff6a";
    ctx.fillStyle = "#8dff6a";
    ctx.fillRect(x + 6, y, invader.width - 12, 6);
    ctx.fillRect(x, y + 6, invader.width, 12);
    ctx.fillRect(x + 5, y + 18, 8, 6);
    ctx.fillRect(x + invader.width - 13, y + 18, 8, 6);
    ctx.fillStyle = "#06120f";
    ctx.fillRect(x + 9, y + 9, 5, 5);
    ctx.fillRect(x + invader.width - 14, y + 9, 5, 5);
    ctx.restore();
  }
}

function drawBullets() {
  ctx.save();
  ctx.shadowBlur = 12;
  for (const bullet of state.bullets) {
    ctx.shadowColor = "#ffd166";
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  }
  for (const bullet of state.enemyBullets) {
    ctx.shadowColor = "#ff5cc8";
    ctx.fillStyle = "#ff5cc8";
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  }
  ctx.restore();
}

function drawGroundLine() {
  ctx.save();
  ctx.strokeStyle = "rgba(93, 242, 255, 0.45)";
  ctx.setLineDash([10, 9]);
  ctx.beginPath();
  ctx.moveTo(20, HEIGHT - 24);
  ctx.lineTo(WIDTH - 20, HEIGHT - 24);
  ctx.stroke();
  ctx.restore();
}

function overlaps(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  levelEl.textContent = String(state.level);
  livesEl.textContent = String(state.lives);
}

function showOverlay(kicker, title, text) {
  overlayKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "Space" && (!state.running || state.gameOver)) {
    startGame();
    return;
  }

  if (event.code === "KeyP") {
    togglePause();
    return;
  }

  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);
resetButton.addEventListener("click", resetGame);

document.querySelectorAll("[data-touch]").forEach((button) => {
  const action = button.dataset.touch;
  const code = action === "left" ? "ArrowLeft" : action === "right" ? "ArrowRight" : "Space";

  const press = (event) => {
    event.preventDefault();
    button.classList.add("active");
    if (action === "shoot") {
      if (!state.running) {
        startGame();
      }
      shoot();
    } else {
      keys.add(code);
    }
  };

  const release = () => {
    button.classList.remove("active");
    keys.delete(code);
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

resetGame();

// Batty Game Main JS
const GAME_HEIGHT_RATIO = 1; // Full viewport height
const BAT_HEIGHT_RATIO = 0.08; // 8% of game height
const OBSTACLE_MIN_RATIO = 0.121; // 11% + 10% = 12.1%
const OBSTACLE_MAX_RATIO = 0.242; // 22% + 10% = 24.2%
const OBSTACLE_INTERVAL_MIN = 1500; // ms (reduced by 25%)
const OBSTACLE_INTERVAL_MAX = 3750; // ms (reduced by 25%)
const OBSTACLE_CLUSTER_MIN = 1;
const OBSTACLE_CLUSTER_MAX = 3;
const OBSTACLE_CLUSTER_GAP = 0.01; // 1% of canvas width

const assets = {
  bat: 'bat.gif',
  stalagmite: 'stalagmites.png',
  background: 'background-reference.png',
};

let canvas, ctx;
let gameState = 'start'; // start | playing | gameover
let bat, obstacles, score, startTime, lastObstacleTime, batFrame, batFrameTime, batY, batVY, gravity, flapStrength, batX;
let bgPattern;
let isMobile = false;
let landscapeBanner, bannerDismissed = false;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
  });
}

function processBatImage(img) {
  // Remove pink background (255,0,255) and make transparent
  const w = img.width, h = img.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    if (d.data[i] === 255 && d.data[i+1] === 0 && d.data[i+2] === 255) {
      d.data[i+3] = 0;
    }
  }
  x.putImageData(d, 0, 0);
  const out = new Image();
  out.src = c.toDataURL();
  return out;
}

function loadAssets() {
  return Promise.all([
    loadImage(assets.bat),
    loadImage(assets.stalagmite),
    loadImage(assets.background),
  ]);
}

function setupCanvas() {
  canvas = document.createElement('canvas');
  ctx = canvas.getContext('2d');
  document.getElementById('game-root').appendChild(canvas);
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function setupLandscapeBanner() {
  landscapeBanner = document.createElement('div');
  landscapeBanner.id = 'landscape-banner';
  landscapeBanner.innerHTML = 'Switch to landscape mode for better gameplay <span class="close">&times;</span>';
  document.body.appendChild(landscapeBanner);
  landscapeBanner.querySelector('.close').onclick = () => {
    bannerDismissed = true;
    landscapeBanner.classList.remove('show');
  };
  window.addEventListener('resize', checkBanner);
  checkBanner();
}

function checkBanner() {
  isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const isPortrait = window.innerHeight > window.innerWidth;
  if (isMobile && isPortrait && !bannerDismissed) {
    landscapeBanner.classList.add('show');
  } else {
    landscapeBanner.classList.remove('show');
  }
}

function drawStartScreen() {
  drawBackground();
  drawOverlay('Gone Batty', 'Click or tap to flap, flap, flap.', 'Start winging it', startGame);
}

function drawGameOverScreen() {
  drawBackground();
  let body;
  if (score < 2) {
    body = `Bat's a wrap, alas, too soon`;
  } else {
    body = `Bat's a wrap, after ${score} glorious seconds`;
  }
  drawOverlay('Game over', body, 'Fly again', startGame);
}

function drawOverlay(title, body, buttonText, buttonHandler) {
  let overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="title">${title}</div><div class="body-text">${body.replace(/\.$/, '')}</div><button class="button">${buttonText}</button>`;
  document.getElementById('game-root').appendChild(overlay);
  overlay.querySelector('button').onclick = () => {
    overlay.remove();
    buttonHandler();
  };
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (bgPattern) {
    ctx.fillStyle = bgPattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#181c20';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawScore() {
  // Score display removed as per user request
}

function removeScore() {
  let scoreDiv = document.querySelector('.score');
  if (scoreDiv) scoreDiv.remove();
}

function startGame() {
  removeScore();
  gameState = 'playing';
  batFrame = 0;
  batFrameTime = 0;
  batY = canvas.height / 2;
  batVY = 0;
  gravity = canvas.height * 0.0005;
  flapStrength = -canvas.height * 0.010;
  batX = canvas.width * 0.18;
  obstacles = [];
  score = 0;
  startTime = Date.now();
  lastObstacleTime = Date.now();
  spawnObstacle();
  drawBackground();
  drawCaveEdges();
  drawObstacles();
  drawBat();
  setTimeout(() => {
    requestAnimationFrame(gameLoop);
  }, 500);
}

function endGame() {
  gameState = 'gameover';
  drawGameOverScreen();
}

function flap() {
  if (gameState !== 'playing') return;
  batVY = flapStrength;
}

function handleInput(e) {
  if (gameState === 'start') return;
  if (gameState === 'playing') flap();
}

function handleStartInput(e) {
  if (gameState === 'start') {
    document.querySelector('.overlay')?.remove();
    startGame();
  }
}

function gameLoop() {
  if (gameState !== 'playing') return;
  // Physics
  batVY += gravity;
  batY += batVY;
  // Animate bat
  batFrameTime += 1;
  if (batFrameTime % 6 === 0) batFrame = (batFrame + 1) % 5;
  // Obstacles
  if (Date.now() - lastObstacleTime > getRandom(OBSTACLE_INTERVAL_MIN, OBSTACLE_INTERVAL_MAX)) {
    spawnObstacle();
    lastObstacleTime = Date.now();
  }
  updateObstacles();
  if (obstacles.length > 0) {
    console.log('First obstacle x:', obstacles[0].x);
  }
  // Collision
  if (batY < 0 || batY + getBatHeight() > canvas.height) {
    console.log('GAME OVER: Bat hit ceiling or floor', { batY, batHeight: getBatHeight(), canvasHeight: canvas.height });
    endGame();
    return;
  }
  for (let obs of obstacles) {
    if (collidesWithBat(obs)) {
      console.log('GAME OVER: Bat collided with obstacle', { batY, batHeight: getBatHeight(), obs });
      endGame();
      return;
    }
  }
  // Draw
  drawBackground();
  drawCaveEdges();
  drawObstacles();
  drawBat();
  // Score
  score = Math.floor((Date.now() - startTime) / 1000);
  drawScore();
  requestAnimationFrame(gameLoop);
}

function getBatHeight() {
  return canvas.height * BAT_HEIGHT_RATIO;
}
function getBatWidth() {
  return getBatHeight(); // Bat is square
}

function drawBat() {
  // Bat sprite: 5 frames horizontally, 32x32 each
  let frameW = 32, frameH = 32;
  let scale = getBatHeight() / frameH;
  ctx.save();
  ctx.translate(batX + getBatWidth() / 2, batY + getBatHeight() / 2);
  ctx.scale(-scale, scale); // Flip horizontally
  ctx.drawImage(batImg, batFrame * frameW, 0, frameW, frameH, -frameW / 2, -frameH / 2, frameW, frameH);
  ctx.restore();
}

function spawnObstacle() {
  // Randomly choose gap position and size
  let gapHeight = canvas.height * 0.28; // Wide gap for easy play
  let minGapY = canvas.height * 0.18;
  let maxGapY = canvas.height - minGapY - gapHeight;
  let gapY = getRandom(minGapY, maxGapY);
  // Cluster of 1-3 stalagmites/stalactites
  let clusterCount = Math.floor(getRandom(OBSTACLE_CLUSTER_MIN, OBSTACLE_CLUSTER_MAX + 1));
  let cluster = [];
  for (let i = 0; i < clusterCount; i++) {
    let stalagmiteH = getRandom(canvas.height * OBSTACLE_MIN_RATIO, canvas.height * OBSTACLE_MAX_RATIO);
    let stalactiteH = getRandom(canvas.height * OBSTACLE_MIN_RATIO, canvas.height * OBSTACLE_MAX_RATIO);
    let spriteIdx = Math.floor(getRandom(0, 6)); // 6 sprites in stalagmites.png
    cluster.push({
      stalagmiteH,
      stalactiteH,
      spriteIdx,
    });
  }
  console.log('spawnObstacle', { x: canvas.width, gapY, gapHeight, cluster });
  obstacles.push({
    x: canvas.width,
    gapY,
    gapHeight,
    cluster,
    passed: false,
  });
}

function updateObstacles() {
  console.log('updateObstacles called');
  for (let obs of obstacles) {
    obs.x -= canvas.width * 0.0035; // Constant speed
  }
  // Remove off-screen
  obstacles = obstacles.filter(obs => obs.x + getObstacleWidth() > 0);
}

function getObstacleWidth() {
  // Each sprite is 1/23 of the image width
  return canvas.width * 0.099 * OBSTACLE_CLUSTER_MAX; // 0.09 * 1.1 (10% increase) * max cluster
}

function drawObstacles() {
  const SPRITE_COUNT = 6;
  const spriteW = stalagmiteImg.width / SPRITE_COUNT;
  const spriteH = stalagmiteImg.height;
  for (let obs of obstacles) {
    let x = obs.x;
    for (let i = 0; i < obs.cluster.length; i++) {
      let c = obs.cluster[i];
      // Clamp spriteIdx
      c.spriteIdx = Math.max(0, Math.min(SPRITE_COUNT - 1, c.spriteIdx));
      // Ensure combined height is at least half the screen
      let minTotal = canvas.height * 0.5;
      let total = c.stalactiteH + c.stalagmiteH;
      if (total < minTotal) {
        let extra = minTotal - total;
        c.stalactiteH += extra / 2;
        c.stalagmiteH += extra / 2;
      }
      // Calculate width to preserve sprite aspect ratio
      let stalactiteW = (c.stalactiteH / spriteH) * spriteW;
      let stalagmiteW = (c.stalagmiteH / spriteH) * spriteW;
      // Stalactite (ceiling)
      ctx.save();
      ctx.translate(x, 0);
      ctx.drawImage(
        stalagmiteImg,
        c.spriteIdx * spriteW, 0, spriteW, spriteH,
        0, 0, stalactiteW, c.stalactiteH
      );
      ctx.restore();
      // Stalagmite (floor, flipped vertically)
      ctx.save();
      ctx.translate(x, canvas.height);
      ctx.scale(1, -1);
      ctx.drawImage(
        stalagmiteImg,
        c.spriteIdx * spriteW, 0, spriteW, spriteH,
        0, 0, stalagmiteW, c.stalagmiteH
      );
      ctx.restore();
      x += Math.max(stalactiteW, stalagmiteW) + canvas.width * OBSTACLE_CLUSTER_GAP;
    }
  }
}

function drawCaveEdges() {
  // Remove upper/lower margins or make them black if needed
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, 0); // No margin at top
  ctx.fillRect(0, canvas.height, canvas.width, 0); // No margin at bottom
}

function collidesWithBat(obs) {
  let batRect = {
    x: batX,
    y: batY,
    w: getBatWidth(),
    h: getBatHeight(),
  };
  // Stalagmite
  let stalagmiteRect = {
    x: obs.x,
    y: canvas.height - obs.stalagmiteH,
    w: getObstacleWidth(),
    h: obs.stalagmiteH,
  };
  // Stalactite
  let stalactiteRect = {
    x: obs.x,
    y: 0,
    w: getObstacleWidth(),
    h: obs.stalactiteH,
  };
  return rectsOverlap(batRect, stalagmiteRect) || rectsOverlap(batRect, stalactiteRect);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function getRandom(min, max) {
  return Math.random() * (max - min) + min;
}

// Asset references
let batImg, stalagmiteImg, bgImg;

function main() {
  setupCanvas();
  setupLandscapeBanner();
  loadAssets().then(([bat, stalagmite, bg]) => {
    batImg = processBatImage(bat);
    stalagmiteImg = stalagmite;
    bgImg = bg;
    // Create background pattern
    let patternCanvas = document.createElement('canvas');
    patternCanvas.width = bgImg.width;
    patternCanvas.height = bgImg.height;
    let pctx = patternCanvas.getContext('2d');
    pctx.drawImage(bgImg, 0, 0);
    bgPattern = ctx.createPattern(patternCanvas, 'repeat');
    // Start screen
    drawStartScreen();
  });
  // Controls
  window.addEventListener('keydown', handleInput);
  window.addEventListener('mousedown', handleInput);
  window.addEventListener('touchstart', handleInput);
}

window.onload = main; 
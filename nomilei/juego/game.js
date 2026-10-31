const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d');
const overlay = document.querySelector('#game-overlay');
const overlayKicker = document.querySelector('#overlay-kicker');
const overlayTitle = document.querySelector('#overlay-title');
const overlayCopy = document.querySelector('#overlay-copy');
const startButton = document.querySelector('#start-button');
const pauseButton = document.querySelector('#pause-button');
const restartButton = document.querySelector('#restart-button');
const gameStatus = document.querySelector('#game-status');
const levelCount = document.querySelector('#level-count');
const scoreCount = document.querySelector('#score-count');
const bestCount = document.querySelector('#best-count');
const collectibleCount = document.querySelector('#collectible-count');
const livesCount = document.querySelector('#lives-count');
const timerCount = document.querySelector('#timer-count');

const tileSize = 40;
const maxWidth = 19;
const maxHeight = 13;
const sprites = Object.fromEntries(['player', 'monster', 'school', 'health', 'work'].map((name) => [name, document.querySelector(`#sprite-${name}`)]));
const collectibleTypes = [
  { label: 'Educación', sprite: 'school' },
  { label: 'Salud', sprite: 'health' },
  { label: 'Trabajo', sprite: 'work' },
  { label: 'Cultura', sprite: 'school' },
  { label: 'Ciencia', sprite: 'health' },
  { label: 'Comunidad', sprite: 'work' },
  { label: 'Futuro', sprite: 'school' },
  { label: 'Derechos', sprite: 'health' },
  { label: 'Democracia', sprite: 'work' }
];
const palettes = [
  { wall: '#29454a', floorA: '#1b373c', floorB: '#1e3c40', fleck: '#a5b88e' },
  { wall: '#3b4156', floorA: '#202e42', floorB: '#293951', fleck: '#9ab8c7' },
  { wall: '#4b3b40', floorA: '#30272f', floorB: '#3b3038', fleck: '#cfaa78' },
  { wall: '#28483f', floorA: '#1a3534', floorB: '#25453b', fleck: '#b5c77e' }
];
const start = { x: 1, y: 1 };
let maze = [];
let mapWidth = 13;
let mapHeight = 9;
let player = { ...start };
let door = { x: 11, y: 7 };
let treasures = [];
let monsters = [];
let collected = new Set();
let level = 1;
let score = 0;
let bestScore = readBestScore();
let lives = 3;
let secondsLeft = 90;
let gameState = 'ready';
let monsterTimer;
let clockTimer;
let lastMove = 0;
let messageTimer;

function readBestScore() {
  try {
    return Number(localStorage.getItem('last-plaza-best')) || 0;
  } catch {
    return 0;
  }
}

function saveBestScore() {
  try {
    localStorage.setItem('last-plaza-best', String(bestScore));
  } catch {
    return;
  }
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function positionKey(position) {
  return `${position.x},${position.y}`;
}

function isWall(x, y) {
  return !maze[y] || maze[y][x] !== '.';
}

function generateMaze(width, height) {
  const grid = Array.from({ length: height }, () => Array(width).fill('#'));
  const stack = [{ ...start }];
  const visited = new Set([positionKey(start)]);
  grid[start.y][start.x] = '.';

  while (stack.length) {
    const current = stack[stack.length - 1];
    const choices = shuffled([
      { x: 0, y: -2 },
      { x: 0, y: 2 },
      { x: -2, y: 0 },
      { x: 2, y: 0 }
    ]).map((direction) => ({ x: current.x + direction.x, y: current.y + direction.y }))
      .filter((next) => next.x > 0 && next.x < width - 1 && next.y > 0 && next.y < height - 1 && !visited.has(positionKey(next)));

    if (!choices.length) {
      stack.pop();
      continue;
    }

    const next = randomItem(choices);
    grid[(current.y + next.y) / 2][(current.x + next.x) / 2] = '.';
    grid[next.y][next.x] = '.';
    visited.add(positionKey(next));
    stack.push(next);
  }

  return grid.map((row) => row.join(''));
}

function getDistances(origin) {
  const distances = new Map([[positionKey(origin), 0]]);
  const queue = [{ ...origin }];
  const directions = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const distance = distances.get(positionKey(current));
    for (const direction of directions) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const key = positionKey(next);
      if (isWall(next.x, next.y) || distances.has(key)) continue;
      distances.set(key, distance + 1);
      queue.push(next);
    }
  }
  return distances;
}

function createLevel() {
  mapWidth = Math.min(maxWidth, 13 + Math.floor((level - 1) / 3) * 2);
  mapHeight = Math.min(maxHeight, 9 + Math.floor((level - 1) / 3) * 2);
  maze = generateMaze(mapWidth, mapHeight);
  player = { ...start };
  collected = new Set();

  const openTiles = [];
  for (let y = 1; y < mapHeight - 1; y += 1) {
    for (let x = 1; x < mapWidth - 1; x += 1) {
      if (!isWall(x, y)) openTiles.push({ x, y });
    }
  }

  const distances = getDistances(start);
  door = openTiles.reduce((farthest, tile) => distances.get(positionKey(tile)) > distances.get(positionKey(farthest)) ? tile : farthest, start);
  const treasureCount = Math.min(9, 3 + Math.floor((level - 1) / 4));
  const reserved = new Set([positionKey(start), positionKey(door)]);
  const treasureSpots = shuffled(openTiles.filter((tile) => distances.get(positionKey(tile)) >= 3 && !reserved.has(positionKey(tile))));
  treasures = treasureSpots.slice(0, treasureCount).map((tile, index) => ({ ...tile, ...collectibleTypes[index] }));
  treasures.forEach((treasure) => reserved.add(positionKey(treasure)));

  let monsterSpots = shuffled(openTiles.filter((tile) => distances.get(positionKey(tile)) >= Math.min(8, 3 + Math.floor(level / 2)) && !reserved.has(positionKey(tile))));
  if (monsterSpots.length < 1 + Math.floor((level - 1) / 2)) {
    monsterSpots = shuffled(openTiles.filter((tile) => !reserved.has(positionKey(tile))));
  }
  const monsterCount = Math.min(monsterSpots.length, 1 + Math.floor(level * .55), 44);
  monsters = monsterSpots.slice(0, monsterCount).map((tile, index) => ({
    ...tile,
    spawn: { ...tile },
    boss: level % 5 === 0 && index === 0
  }));

  secondsLeft = Math.max(24, 90 - (level - 1) * 3);
  updateHud();
}

function boardOffset() {
  return { x: (canvas.width - mapWidth * tileSize) / 2, y: (canvas.height - mapHeight * tileSize) / 2 };
}

function draw() {
  const offset = boardOffset();
  const palette = palettes[(level - 1) % palettes.length];
  ctx.fillStyle = '#101a20';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const wall = maze[y][x] === '#';
      const left = offset.x + x * tileSize;
      const top = offset.y + y * tileSize;
      ctx.fillStyle = wall ? palette.wall : ((x + y) % 2 ? palette.floorA : palette.floorB);
      ctx.fillRect(left, top, tileSize, tileSize);
      if (wall) {
        ctx.fillStyle = 'rgba(255,255,255,.09)';
        ctx.fillRect(left + 5, top + 6, tileSize - 10, 2);
      } else {
        ctx.fillStyle = palette.fleck;
        ctx.globalAlpha = .23;
        ctx.beginPath();
        ctx.arc(left + 9, top + tileSize - 9, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  drawDoor(offset);
  treasures.forEach((treasure, index) => {
    if (collected.has(index)) return;
    const centerX = offset.x + treasure.x * tileSize + tileSize / 2;
    const centerY = offset.y + treasure.y * tileSize + tileSize / 2;
    ctx.fillStyle = 'rgba(246,204,69,.19)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, tileSize * .38, 0, Math.PI * 2);
    ctx.fill();
    drawSprite(sprites[treasure.sprite], centerX, centerY, tileSize * .67);
  });

  monsters.forEach((monster) => drawSprite(sprites.monster, offset.x + monster.x * tileSize + tileSize / 2, offset.y + monster.y * tileSize + tileSize / 2, tileSize * (monster.boss ? 1.18 : .86)));
  drawSprite(sprites.player, offset.x + player.x * tileSize + tileSize / 2, offset.y + player.y * tileSize + tileSize / 2, tileSize * .82);
  updateHud();
}

function drawSprite(image, centerX, centerY, size) {
  if (image?.complete && image.naturalWidth > 0) ctx.drawImage(image, centerX - size / 2, centerY - size / 2, size, size);
}

function drawDoor(offset) {
  const x = offset.x + door.x * tileSize;
  const y = offset.y + door.y * tileSize;
  const isOpen = collected.size === treasures.length;
  ctx.fillStyle = isOpen ? 'rgba(246,204,69,.24)' : 'rgba(0,0,0,.24)';
  ctx.fillRect(x + 7, y + 5, tileSize - 14, tileSize - 9);
  ctx.strokeStyle = isOpen ? '#f6cc45' : '#82918e';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 11, y + 8, tileSize - 22, tileSize - 12);
  ctx.fillStyle = isOpen ? '#f6cc45' : '#a9b5ad';
  ctx.beginPath();
  ctx.arc(x + tileSize * .63, y + tileSize * .52, 2, 0, Math.PI * 2);
  ctx.fill();
}

function updateHud() {
  levelCount.textContent = String(level).padStart(2, '0');
  scoreCount.textContent = score.toLocaleString('es-AR');
  bestCount.textContent = bestScore.toLocaleString('es-AR');
  collectibleCount.textContent = treasures.map((_, index) => collected.has(index) ? '●' : '○').join(' ');
  livesCount.textContent = `${'♥ '.repeat(lives)}${'♡ '.repeat(5 - lives)}`.trim();
  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const seconds = (secondsLeft % 60).toString().padStart(2, '0');
  timerCount.textContent = `${minutes}:${seconds}`;
  timerCount.classList.toggle('is-low', secondsLeft <= 15);
}

function showOverlay(kicker, title, copy, buttonText) {
  overlayKicker.textContent = kicker;
  overlayTitle.innerHTML = title;
  overlayCopy.textContent = copy;
  startButton.innerHTML = `${buttonText} <span aria-hidden="true">→</span>`;
  overlay.hidden = false;
}

function startGame() {
  clearInterval(monsterTimer);
  clearInterval(clockTimer);
  gameState = 'playing';
  overlay.hidden = true;
  pauseButton.disabled = false;
  pauseButton.textContent = 'Ⅱ';
  pauseButton.setAttribute('aria-label', 'Pausar partida');
  gameStatus.textContent = `NIVEL ${level} · ESCAPÁ DE SUS GARRAS`;
  const monsterDelay = Math.max(110, 680 - level * 12);
  monsterTimer = setInterval(moveMonsters, monsterDelay);
  clockTimer = setInterval(() => {
    if (gameState !== 'playing') return;
    secondsLeft -= 1;
    updateHud();
    if (secondsLeft <= 0) finishGame('Se hizo tarde.', 'El tiempo se terminó. El mundo necesita que vuelvas a intentarlo.');
  }, 1000);
  draw();
}

function stopTimers() {
  clearInterval(monsterTimer);
  clearInterval(clockTimer);
  clearTimeout(messageTimer);
}

function resetGame() {
  stopTimers();
  level = 1;
  score = 0;
  lives = 3;
  gameState = 'ready';
  pauseButton.disabled = true;
  pauseButton.textContent = 'Ⅱ';
  createLevel();
  gameStatus.textContent = 'MISIÓN: ESCAPÁ DE SUS GARRAS';
  showOverlay('AVENTURA ARCADE INFINITA', 'El monstruo Milei<br>despertó.', 'Escapá de sus garras, rescatá los lazos comunes y llegá al portal. Cada nivel trae un laberinto nuevo y más difícil.', 'Empezar partida');
  draw();
}

function movePlayer(dx, dy) {
  if (gameState !== 'playing') return;
  const now = performance.now();
  if (now - lastMove < 95) return;
  lastMove = now;
  const next = { x: player.x + dx, y: player.y + dy };
  if (!isWall(next.x, next.y)) player = next;

  treasures.forEach((treasure, index) => {
    if (player.x !== treasure.x || player.y !== treasure.y || collected.has(index)) return;
    collected.add(index);
    score += 50 * level;
    if (score > bestScore) {
      bestScore = score;
      saveBestScore();
    }
    flashStatus(`${treasure.label.toUpperCase()} A SALVO · +${50 * level}`);
  });

  if (player.x === door.x && player.y === door.y) {
    if (collected.size === treasures.length) {
      completeLevel();
      return;
    }
    flashStatus(`FALTAN ${treasures.length - collected.size} LAZOS PARA ABRIR EL PORTAL`);
  }

  checkCollision();
  draw();
}

function findPath(origin, target) {
  if (origin.x === target.x && origin.y === target.y) return null;
  const queue = [{ ...origin }];
  const parents = new Map([[positionKey(origin), null]]);
  const directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current.x === target.x && current.y === target.y) break;
    for (const direction of directions) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const key = positionKey(next);
      if (isWall(next.x, next.y) || parents.has(key)) continue;
      parents.set(key, current);
      queue.push(next);
    }
  }

  let step = { ...target };
  if (!parents.has(positionKey(step))) return null;
  while (parents.get(positionKey(step)) && positionKey(parents.get(positionKey(step))) !== positionKey(origin)) {
    step = parents.get(positionKey(step));
  }
  return step;
}

function moveMonsters() {
  if (gameState !== 'playing') return;
  monsters.forEach((monster) => {
    const next = findPath(monster, player);
    if (next) {
      monster.x = next.x;
      monster.y = next.y;
    }
  });
  checkCollision();
  draw();
}

function checkCollision() {
  const hit = monsters.some((monster) => monster.x === player.x && monster.y === player.y);
  if (!hit) return;
  lives -= 1;
  if (lives <= 0) {
    finishGame('MISIÓN INTERRUMPIDA', 'Esta vez<br>no pudo ser.', 'El monstruo te alcanzó. Respirá hondo y volvé a intentar salvar la plaza.');
    return;
  }
  player = { ...start };
  monsters.forEach((monster) => Object.assign(monster, monster.spawn));
  flashStatus(`TE ALCANZÓ · TE QUEDAN ${lives} VIDAS`);
  draw();
}

function flashStatus(text) {
  gameStatus.textContent = text;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    if (gameState === 'playing') gameStatus.textContent = `NIVEL ${level} · ${collected.size}/${treasures.length} LAZOS`;
  }, 1400);
}

function completeLevel() {
  stopTimers();
  const finishedLevel = level;
  score += finishedLevel * 100 + secondsLeft * 5;
  if (finishedLevel % 3 === 0 && lives < 5) lives += 1;
  if (score > bestScore) {
    bestScore = score;
    saveBestScore();
  }
  level += 1;
  createLevel();
  gameState = 'between';
  pauseButton.disabled = true;
  gameStatus.textContent = `NIVEL ${finishedLevel} SUPERADO`;
  const bossNote = level % 5 === 0 ? ' Además, se viene un monstruo jefe.' : '';
  showOverlay('¡NIVEL SUPERADO!', `Nivel ${level}<br>en camino.`, `El siguiente laberinto crece y suma perseguidores. Conservás tus vidas.${bossNote}`, `Entrar al nivel ${level}`);
  draw();
}

function finishGame(kicker, title, copy) {
  stopTimers();
  gameState = 'lost';
  pauseButton.disabled = true;
  gameStatus.textContent = `FIN · NIVEL ${level}`;
  showOverlay(kicker, title, `${copy} Llegaste al nivel ${level} y sumaste ${score.toLocaleString('es-AR')} puntos.`, 'Reintentar desde el nivel 1');
  draw();
}

function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    clearInterval(monsterTimer);
    clearInterval(clockTimer);
    pauseButton.textContent = '▶';
    pauseButton.setAttribute('aria-label', 'Continuar partida');
    gameStatus.textContent = 'PARTIDA EN PAUSA';
    showOverlay('PAUSA', 'Tomate<br>un respiro.', 'Cuando estés lista, seguí escapando del monstruo.', 'Seguir jugando');
  } else if (gameState === 'paused') {
    startGame();
  }
}

document.addEventListener('keydown', (event) => {
  const direction = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
  }[event.key];
  if (direction) {
    event.preventDefault();
    movePlayer(...direction);
  } else if (event.key === ' ' && (gameState === 'playing' || gameState === 'paused')) {
    event.preventDefault();
    togglePause();
  }
});

document.querySelectorAll('[data-move]').forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const moves = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    movePlayer(...moves[button.dataset.move]);
  });
});

startButton.addEventListener('click', () => {
  if (gameState === 'lost') resetGame();
  startGame();
});
pauseButton.addEventListener('click', togglePause);
restartButton.addEventListener('click', resetGame);
Object.values(sprites).forEach((sprite) => sprite.addEventListener('load', draw));
resetGame();

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
const livesCount = document.querySelector('#lives-count');
const timerCount = document.querySelector('#timer-count');
const bossHealthFill = document.querySelector('#boss-health-fill');
const bossHealthText = document.querySelector('#boss-health-text');
const bossBarLabel = document.querySelector('#boss-bar-label');
const specialFill = document.querySelector('#special-fill');
const specialValue = document.querySelector('#special-value');
const parryStatus = document.querySelector('#parry-status');
const dashStatus = document.querySelector('#dash-status');
const playerSprite = document.querySelector('#sprite-player');
const bossSprite = document.querySelector('#sprite-monster');

const player = { x: 112, y: 280, radius: 20, lives: 5, invulnerable: 0, dashCooldown: 0, dashTime: 0, shotCooldown: 0, parryCooldown: 0, parryWindow: 0, special: 0 };
const boss = { x: 632, y: 260, radius: 53, hp: 7, maxHp: 7, hitFlash: 0 };
const keys = new Set();
const shots = [];
const enemyShots = [];
let enemies = [];
let waveTotal = 0;
let isBossRound = false;
const maxLives = 5;
let level = 1;
let score = 0;
let bestScore = readBestScore();
let remaining = 82;
let gameState = 'ready';
let attackClock = 1.8;
let stageClock = 0;
let lastFrame = 0;
let lastStatusTimeout;
let touchFire = false;
let touchDash = false;
let touchParry = false;
let touchSpecial = false;
let screenFlash = 0;

function readBestScore() {
  try { return Number(localStorage.getItem('last-plaza-boss-best')) || 0; }
  catch { return 0; }
}

function saveBestScore() {
  try { localStorage.setItem('last-plaza-boss-best', String(bestScore)); }
  catch { return; }
}

function updateHud() {
  levelCount.textContent = String(level).padStart(2, '0');
  scoreCount.textContent = score.toLocaleString('es-AR');
  bestCount.textContent = bestScore.toLocaleString('es-AR');
  livesCount.textContent = `${'♥ '.repeat(player.lives)}${'♡ '.repeat(maxLives - player.lives)}`.trim();
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = Math.floor(remaining % 60).toString().padStart(2, '0');
  timerCount.textContent = `${minutes}:${seconds}`;
  timerCount.classList.toggle('is-low', remaining <= 15);
  const ratio = isBossRound ? boss.hp / boss.maxHp : enemies.length / Math.max(1, waveTotal);
  bossHealthFill.style.width = `${Math.max(0, ratio) * 100}%`;
  bossBarLabel.textContent = isBossRound ? 'JEFE FINAL / EL MONSTRUO' : 'OLEADA / RIVALES';
  bossHealthText.textContent = isBossRound ? `${Math.max(0, boss.hp)} / ${boss.maxHp}` : `${enemies.length} / ${waveTotal}`;
  specialFill.style.width = `${player.special}%`;
  specialValue.textContent = `${Math.floor(player.special)}%`;
  parryStatus.textContent = player.parryCooldown <= 0 ? 'C · PARRY LISTO' : `C · ${player.parryCooldown.toFixed(1)}s`;
  dashStatus.textContent = player.dashCooldown <= 0 ? 'X · ESQUIVA LISTA' : `X · ${player.dashCooldown.toFixed(1)}s`;
  parryStatus.classList.toggle('is-ready', player.parryCooldown <= 0);
  dashStatus.classList.toggle('is-ready', player.dashCooldown <= 0);
}

function showOverlay(kicker, title, copy, buttonText) {
  overlayKicker.textContent = kicker;
  overlayTitle.innerHTML = title;
  overlayCopy.textContent = copy;
  startButton.innerHTML = `${buttonText} <span aria-hidden="true">→</span>`;
  overlay.hidden = false;
}

function prepareLevel() {
  player.x = 112;
  player.y = 280;
  player.invulnerable = 0;
  player.dashCooldown = 0;
  player.dashTime = 0;
  player.shotCooldown = 0;
  player.parryCooldown = 0;
  player.parryWindow = 0;
  isBossRound = level % 10 === 0;
  boss.hp = isBossRound ? 12 + Math.floor(level / 10) * 3 : 0;
  boss.maxHp = boss.hp;
  boss.hitFlash = 0;
  waveTotal = isBossRound ? 0 : Math.min(9, 3 + Math.floor((level - 1) / 2));
  enemies = isBossRound ? [] : Array.from({ length: waveTotal }, (_, index) => ({
    id: index,
    baseX: 525 + (index % 4) * 68,
    baseY: 115 + Math.floor(index / 4) * 155,
    x: 525 + (index % 4) * 68,
    y: 115 + Math.floor(index / 4) * 155,
    radius: 25,
    hp: 2 + Math.floor(level / 6),
    hitFlash: 0,
    phase: index * 1.7
  }));
  boss.x = 630;
  boss.y = 260;
  shots.length = 0;
  enemyShots.length = 0;
  remaining = Math.max(48, 84 - level * .55);
  attackClock = isBossRound ? 2 : 1.6;
  stageClock = 0;
  screenFlash = 0;
  updateHud();
}

function startGame() {
  if (gameState !== 'paused' && gameState !== 'between' && gameState !== 'ready') return;
  gameState = 'playing';
  overlay.hidden = true;
  pauseButton.disabled = false;
  pauseButton.textContent = 'Ⅱ';
  pauseButton.setAttribute('aria-label', 'Pausar partida');
  gameStatus.textContent = isBossRound ? `RONDA ${level} · JEFE FINAL` : `RONDA ${level} · OLEADA ${enemies.length}`;
  lastFrame = performance.now();
}

function resetGame() {
  gameState = 'ready';
  level = 1;
  score = 0;
  player.lives = maxLives;
  pauseButton.disabled = true;
  pauseButton.textContent = 'Ⅱ';
  prepareLevel();
  gameStatus.textContent = isBossRound ? `MISIÓN: JEFE FINAL · RONDA ${level}` : 'MISIÓN: SUPERÁ LA OLEADA';
  showOverlay('AVENTURA DE DIBUJO RETRO', 'La última<br>plaza.', 'Superá las oleadas, llená el medidor especial y preparate: cada 10 rondas llega un jefe final.', 'Empezar combate');
  draw(0);
}

function shoot() {
  const target = isBossRound ? boss : enemies.reduce((nearest, enemy) => {
    if (!nearest) return enemy;
    return Math.hypot(enemy.x - player.x, enemy.y - player.y) < Math.hypot(nearest.x - player.x, nearest.y - player.y) ? enemy : nearest;
  }, null);
  if (player.shotCooldown > 0 || !target) return;
  player.shotCooldown = .19;
  const directionX = target.x - player.x;
  const directionY = target.y - player.y;
  const angle = Math.atan2(directionY, directionX);
  const speed = 570;
  shots.push({ x: player.x + 24, y: player.y - 5, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 7, damage: 1, targetId: isBossRound ? 'boss' : target.id });
}

function dash(dx, dy) {
  if (player.dashCooldown > 0 || gameState !== 'playing') return;
  let directionX = dx;
  let directionY = dy;
  const magnitude = Math.hypot(directionX, directionY);
  if (!magnitude) {
    directionX = 1;
    directionY = 0;
  } else {
    directionX /= magnitude;
    directionY /= magnitude;
  }
  player.dashTime = .2;
  player.dashCooldown = 1.35;
  player.invulnerable = Math.max(player.invulnerable, .25);
  player.x = Math.min(520, Math.max(38, player.x + directionX * 78));
  player.y = Math.min(420, Math.max(70, player.y + directionY * 78));
}

function parry() {
  if (gameState !== 'playing' || player.parryCooldown > 0) return;
  player.parryWindow = .28;
  player.parryCooldown = 1.15;
  gameStatus.textContent = '¡PARADA! TOCÁ UN PROYECTIL';
}

function damageTarget(target, damage, charge = true) {
  if (gameState !== 'playing') return;
  target.hp -= damage;
  target.hitFlash = .15;
  score += 40 * level * damage;
  if (charge) player.special = Math.min(100, player.special + 7 * damage);
  if (score > bestScore) {
    bestScore = score;
    saveBestScore();
  }

  if (isBossRound && boss.hp <= 0) {
    completeLevel();
    return;
  }

  if (!isBossRound) {
    enemies = enemies.filter((enemy) => enemy.hp > 0);
    if (enemies.length === 0) completeLevel();
  }
}

function useSpecial() {
  if (gameState !== 'playing') return;
  if (player.special < 100) {
    gameStatus.textContent = `ESPECIAL AL ${Math.floor(player.special)}% · SE CARGA DISPARANDO Y PARRIANDO`;
    return;
  }

  player.special = 0;
  enemyShots.length = 0;
  screenFlash = .24;
  if (isBossRound) {
    damageTarget(boss, 4, false);
  } else {
    [...enemies].slice(0, 4).forEach((enemy) => damageTarget(enemy, 3, false));
  }
  if (gameState === 'playing') gameStatus.textContent = '¡SÚPER ATAQUE! · PROYECTILES DESPEJADOS';
}

function fireVolley() {
  const attacker = isBossRound ? boss : enemies[Math.floor(Math.random() * enemies.length)];
  if (!attacker) return;
  const baseAngle = Math.atan2(player.y - attacker.y, player.x - attacker.x);
  const count = isBossRound ? (level >= 30 ? 5 : 3) : 1 + Math.min(2, Math.floor(level / 4));
  const spread = isBossRound ? .3 : .21;
  const speed = (isBossRound ? 180 : 145) + Math.min(level, 30) * 2.4;
  for (let index = 0; index < count; index += 1) {
    const offset = count === 1 ? 0 : (index - 1) * spread;
    const angle = baseAngle + offset;
    enemyShots.push({ x: attacker.x - (isBossRound ? 42 : 18), y: attacker.y + 8, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: isBossRound ? 12 : 9, spin: Math.random() * Math.PI });
  }
  attackClock = isBossRound ? Math.max(.82, 2.1 - level * .014) : Math.max(.9, 1.75 - level * .018);
  gameStatus.textContent = isBossRound ? '¡JEFE FINAL! ESQUIVÁ LA SALVA' : '¡OLEADA! DISPARÁ Y MOVETE';
}

function update(delta) {
  stageClock += delta;
  remaining = Math.max(0, remaining - delta);
  player.invulnerable = Math.max(0, player.invulnerable - delta);
  player.dashCooldown = Math.max(0, player.dashCooldown - delta);
  player.dashTime = Math.max(0, player.dashTime - delta);
  player.shotCooldown = Math.max(0, player.shotCooldown - delta);
  player.parryCooldown = Math.max(0, player.parryCooldown - delta);
  player.parryWindow = Math.max(0, player.parryWindow - delta);
  boss.hitFlash = Math.max(0, boss.hitFlash - delta);
  screenFlash = Math.max(0, screenFlash - delta);
  if (isBossRound) {
    boss.y = 260 + Math.sin(stageClock * (.92 + Math.min(level, 10) * .035)) * 92;
  } else {
    enemies.forEach((enemy) => {
      enemy.x = enemy.baseX + Math.sin(stageClock * .55 + enemy.phase) * 12;
      enemy.y = enemy.baseY + Math.sin(stageClock * .9 + enemy.phase) * 25;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
    });
  }

  let moveX = Number(keys.has('ArrowRight') || keys.has('d')) - Number(keys.has('ArrowLeft') || keys.has('a'));
  let moveY = Number(keys.has('ArrowDown') || keys.has('s')) - Number(keys.has('ArrowUp') || keys.has('w'));
  const moveLength = Math.hypot(moveX, moveY) || 1;
  const speed = player.dashTime > 0 ? 620 : 275;
  player.x = Math.max(38, Math.min(520, player.x + (moveX / moveLength) * speed * delta));
  player.y = Math.max(70, Math.min(420, player.y + (moveY / moveLength) * speed * delta));

  if (keys.has(' ') || keys.has('z') || touchFire) shoot();
  if (touchDash) {
    dash(moveX || 1, moveY);
    touchDash = false;
  }
  if (touchParry) {
    parry();
    touchParry = false;
  }
  if (touchSpecial) {
    useSpecial();
    touchSpecial = false;
  }

  shots.forEach((shot) => {
    if (gameState !== 'playing') return;
    shot.x += shot.vx * delta;
    shot.y += shot.vy * delta;
    const target = shot.targetId === 'boss' ? (isBossRound ? boss : null) : enemies.find((enemy) => enemy.id === shot.targetId);
    if (target && Math.hypot(shot.x - target.x, shot.y - target.y) < target.radius + shot.radius) {
      shot.dead = true;
      damageTarget(target, shot.damage);
    }
    if (shot.x > canvas.width + 20 || shot.y < -20 || shot.y > canvas.height + 20) shot.dead = true;
  });
  removeDead(shots);
  if (gameState !== 'playing') return;
  if (!isBossRound && enemies.length === 0) {
    completeLevel();
    return;
  }

  attackClock -= delta;
  if (attackClock <= 0) fireVolley();

  enemyShots.forEach((shot) => {
    if (gameState !== 'playing') return;
    shot.x += shot.vx * delta;
    shot.y += shot.vy * delta;
    shot.spin += delta * 5;
    if (Math.hypot(shot.x - player.x, shot.y - player.y) < shot.radius + player.radius + (player.parryWindow > 0 ? 20 : 0)) {
      if (player.parryWindow > 0) {
        shot.dead = true;
        player.parryWindow = 0;
        player.special = Math.min(100, player.special + 28);
        score += 90 * level;
        gameStatus.textContent = '¡PARRY PERFECTO! · SÚPER CARGADA';
      } else if (player.invulnerable <= 0) {
        shot.dead = true;
        damagePlayer();
      }
    }
    if (shot.x < -25 || shot.y < -25 || shot.y > canvas.height + 25) shot.dead = true;
  });
  removeDead(enemyShots);

  if (remaining <= 0 && gameState === 'playing') endGame('Se terminó el tiempo.', 'El telón<br>se cerró.', 'La oleada resistió esta ronda. Usá el parry para cargar el especial y despejá la pantalla.');
  updateHud();
}

function removeDead(items) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index].dead) items.splice(index, 1);
  }
}

function damagePlayer() {
  player.lives -= 1;
  player.invulnerable = 1.05;
  if (player.lives <= 0) {
    endGame('FIN DE LA PARTIDA', '¡Una vida<br>más!', 'El jefe ganó esta ronda. Reiniciá y usá la esquiva cuando veas venir sus proyectiles.');
    return;
  }
  gameStatus.textContent = `GOLPE RECIBIDO · ${player.lives} VIDAS`;
  clearTimeout(lastStatusTimeout);
  lastStatusTimeout = setTimeout(() => {
    if (gameState === 'playing') gameStatus.textContent = isBossRound ? `RONDA ${level} · JEFE FINAL` : `RONDA ${level} · OLEADA ${enemies.length}`;
  }, 1000);
}

function completeLevel() {
  gameState = 'between';
  const clearedLevel = level;
  const clearedBossRound = isBossRound;
  score += 250 * clearedLevel + Math.ceil(remaining) * 10;
  if (clearedLevel % 2 === 0 && player.lives < maxLives) player.lives += 1;
  if (score > bestScore) {
    bestScore = score;
    saveBestScore();
  }
  level += 1;
  prepareLevel();
  pauseButton.disabled = true;
  gameStatus.textContent = clearedBossRound ? `JEFE FINAL ${clearedLevel} DERROTADO` : `OLEADA ${clearedLevel} SUPERADA`;
  const nextBossNote = level % 10 === 0 ? ' La próxima ronda es una batalla contra el jefe final.' : ` El jefe final aparece en la ronda ${Math.ceil(level / 10) * 10}.`;
  showOverlay(clearedBossRound ? '¡JEFE FINAL DERROTADO!' : '¡OLEADA SUPERADA!', `Ronda ${clearedLevel}<br>superada.`, `Pasaste la ronda ${clearedLevel}.${nextBossNote} Conservás tus vidas.`, `Ir a la ronda ${level}`);
  updateHud();
}

function endGame(kicker, title, copy) {
  gameState = 'lost';
  pauseButton.disabled = true;
  gameStatus.textContent = `FIN · NIVEL ${level}`;
  showOverlay(kicker, title, `${copy} Llegaste al nivel ${level} y sumaste ${score.toLocaleString('es-AR')} puntos.`, 'Reintentar desde el nivel 1');
}

function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    pauseButton.textContent = '▶';
    pauseButton.setAttribute('aria-label', 'Continuar partida');
    gameStatus.textContent = 'PARTIDA EN PAUSA';
    showOverlay('PAUSA', 'Tomate<br>un respiro.', 'Cuando estés lista, seguí con el combate.', 'Seguir jugando');
  } else if (gameState === 'paused') {
    startGame();
  }
}

function drawBackground(time) {
  ctx.fillStyle = '#ead9b5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f7edda';
  ctx.fillRect(0, 0, canvas.width, 350);

  ctx.save();
  ctx.globalAlpha = .14;
  for (let index = -3; index < 14; index += 1) {
    ctx.fillStyle = index % 2 ? '#c96f4a' : '#f6cc45';
    ctx.beginPath();
    ctx.moveTo(375, 0);
    ctx.lineTo(index * 92 + ((time * 9) % 92), 350);
    ctx.lineTo(index * 92 + 48 + ((time * 9) % 92), 350);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = '#24443c';
  ctx.beginPath();
  ctx.moveTo(0, 365);
  ctx.quadraticCurveTo(180, 315, 360, 370);
  ctx.quadraticCurveTo(540, 420, 760, 350);
  ctx.lineTo(760, 470);
  ctx.lineTo(0, 470);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#171815';
  ctx.fillRect(0, 450, canvas.width, 70);
  for (let x = 0; x < canvas.width; x += 38) {
    ctx.fillStyle = (x / 38) % 2 ? '#f5ead4' : '#b64b3c';
    ctx.fillRect(x, 450, 38, 13);
  }
  ctx.fillStyle = 'rgba(23,24,21,.14)';
  ctx.fillRect(0, 463, canvas.width, 3);
}

function drawStar(x, y, outer, inner, points, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 ? inner : outer;
    const angle = rotation + index * Math.PI / points;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function draw(time) {
  drawBackground(time / 1000);
  const warning = gameState === 'playing' && attackClock < .55;
  if (isBossRound) {
    ctx.fillStyle = warning ? '#ef493f' : '#b34336';
    ctx.beginPath();
    ctx.ellipse(boss.x, boss.y + 68, 64, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    if (boss.hitFlash > 0) ctx.filter = 'brightness(1.8) grayscale(.5)';
    drawSprite(bossSprite, boss.x, boss.y, 138 + Math.min(level, 30));
    ctx.filter = 'none';
  } else {
    enemies.forEach((enemy) => {
      ctx.fillStyle = warning ? 'rgba(185,67,55,.65)' : 'rgba(36,68,60,.35)';
      ctx.beginPath();
      ctx.ellipse(enemy.x, enemy.y + 31, 31, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      if (enemy.hitFlash > 0) ctx.filter = 'brightness(1.7) grayscale(.45)';
      drawSprite(bossSprite, enemy.x, enemy.y, 64);
      ctx.filter = 'none';
      ctx.fillStyle = '#263a32';
      ctx.fillRect(enemy.x - 19, enemy.y + 36, 38, 4);
      ctx.fillStyle = '#b94337';
      ctx.fillRect(enemy.x - 19, enemy.y + 36, 38 * Math.max(0, enemy.hp / (2 + Math.floor(level / 6))), 4);
    });
  }

  if (!(player.invulnerable > 0 && Math.floor(time / 75) % 2)) drawSprite(playerSprite, player.x, player.y, 74);
  if (player.dashCooldown > .9 && player.dashTime <= 0) {
    ctx.strokeStyle = 'rgba(31,35,31,.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 28, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (player.parryWindow > 0) {
    ctx.strokeStyle = '#e1b54f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 35, 0, Math.PI * 2);
    ctx.stroke();
  }

  shots.forEach((shot) => {
    ctx.save();
    ctx.translate(shot.x, shot.y);
    ctx.rotate(Math.atan2(shot.vy, shot.vx));
    ctx.fillStyle = '#cf4638';
    drawStar(0, 0, 10, 4, 5);
    ctx.restore();
  });

  enemyShots.forEach((shot) => {
    ctx.save();
    ctx.translate(shot.x, shot.y);
    ctx.rotate(shot.spin);
    ctx.fillStyle = '#202b32';
    drawStar(0, 0, shot.radius, shot.radius * .42, 5);
    ctx.fillStyle = '#f5c64b';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  if (warning) {
    ctx.fillStyle = '#9b3028';
    ctx.font = 'bold 15px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isBossRound ? '¡JEFE FINAL!' : '¡SALVA!', isBossRound ? boss.x : canvas.width * .72, isBossRound ? boss.y - 92 : 62);
  }
  if (screenFlash > 0) {
    ctx.fillStyle = `rgba(246,204,69,${screenFlash * 1.6})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawStageBorder();
}

function drawSprite(image, centerX, centerY, size) {
  if (image?.complete && image.naturalWidth > 0) {
    ctx.save();
    ctx.filter = 'grayscale(.45) sepia(.38) contrast(1.08)';
    ctx.drawImage(image, centerX - size / 2, centerY - size / 2, size, size);
    ctx.restore();
  }
}

function drawStageBorder() {
  ctx.strokeStyle = '#171815';
  ctx.lineWidth = 7;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  ctx.fillStyle = '#171815';
  ctx.font = 'bold 9px "DM Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`ACTO ${String(level).padStart(2, '0')}`, 26, 34);
}

function frame(timestamp) {
  const delta = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .04) : 0;
  lastFrame = timestamp;
  if (gameState === 'playing') update(delta);
  draw(timestamp);
  requestAnimationFrame(frame);
}

const keyAliases = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', w: 'w', a: 'a', s: 's', d: 'd', W: 'w', A: 'a', S: 's', D: 'd', ' ': ' ', z: 'z', Z: 'z' };

document.addEventListener('keydown', (event) => {
  const key = keyAliases[event.key];
  if (key) {
    keys.add(key);
    if (key.startsWith('Arrow') || key === ' ') event.preventDefault();
  }
  if ((event.key === 'x' || event.key === 'X' || event.key === 'Shift') && !event.repeat) {
    dash(Number(keys.has('ArrowRight') || keys.has('d')) - Number(keys.has('ArrowLeft') || keys.has('a')), Number(keys.has('ArrowDown') || keys.has('s')) - Number(keys.has('ArrowUp') || keys.has('w')));
  }
  if ((event.key === 'c' || event.key === 'C') && !event.repeat) parry();
  if ((event.key === 'e' || event.key === 'E') && !event.repeat) useSpecial();
  if (event.key === 'Escape' && (gameState === 'playing' || gameState === 'paused')) togglePause();
});

document.addEventListener('keyup', (event) => {
  const key = keyAliases[event.key];
  if (key) keys.delete(key);
});

window.addEventListener('blur', () => keys.clear());

document.querySelectorAll('[data-key]').forEach((button) => {
  const press = (event) => {
    event.preventDefault();
    const key = button.dataset.key;
    if (key === 'dash') {
      touchDash = true;
      return;
    }
    if (key === 'fire') {
      touchFire = true;
      return;
    }
    if (key === 'parry') {
      touchParry = true;
      return;
    }
    if (key === 'special') {
      touchSpecial = true;
      return;
    }
    keys.add(key);
    button.setPointerCapture?.(event.pointerId);
  };
  const release = () => {
    const key = button.dataset.key;
    if (key === 'fire') touchFire = false;
    else if (key !== 'dash') keys.delete(key);
  };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});

startButton.addEventListener('click', () => {
  if (gameState === 'lost') resetGame();
  startGame();
});
pauseButton.addEventListener('click', togglePause);
restartButton.addEventListener('click', resetGame);
[playerSprite, bossSprite].forEach((sprite) => sprite.addEventListener('load', () => draw(performance.now())));
prepareLevel();
showOverlay('AVENTURA DE DIBUJO RETRO', 'La última<br>plaza.', 'Superá las oleadas, llená el medidor especial y preparate: cada 10 rondas llega un jefe final.', 'Empezar combate');
requestAnimationFrame(frame);

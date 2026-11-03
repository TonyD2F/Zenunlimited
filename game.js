(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const arena = document.getElementById('arena');
  const overlay = document.getElementById('overlay');
  const scoreNode = document.getElementById('score');
  const bestNode = document.getElementById('best');
  const sectorNode = document.getElementById('sector');
  const livesNode = document.querySelector('#lives strong');
  const pauseButton = document.getElementById('pauseButton');
  const playButton = document.getElementById('playButton');
  const playLabel = document.getElementById('playLabel');
  const soundButton = document.getElementById('soundButton');
  const overlayEyebrow = document.getElementById('overlayEyebrow');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayCopy = document.getElementById('overlayCopy');
  const keyHint = document.getElementById('keyHint');

  const COLORS = {
    mint: '#a4f6c6',
    bright: '#69efaa',
    coral: '#ff887d',
    pale: '#eafff0',
    gold: '#ffe49a'
  };
  const keys = new Set();
  let width = 0;
  let height = 0;
  let dpr = 1;
  let lastFrame = 0;
  let elapsed = 0;
  let score = 0;
  let best = readBest();
  let lives = 3;
  let sector = 1;
  let status = 'ready';
  let soundOn = false;
  let audio = null;
  let spawnShard = 0;
  let spawnEnemy = 0;
  let spawnHeal = 0;
  let shake = 0;
  let pointerActive = false;
  let target = null;
  let player;
  let shards = [];
  let enemies = [];
  let heals = [];
  let particles = [];
  let stars = [];

  function readBest() {
    try { return Number(localStorage.getItem('zen-unlimited-best')) || 0; }
    catch (_) { return 0; }
  }

  function saveBest() {
    try { localStorage.setItem('zen-unlimited-best', String(best)); }
    catch (_) { /* Private browsing can disable storage; the game still works. */ }
  }

  function fitCanvas() {
    const rect = arena.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round(width * height / 7200) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.4 + .25,
      a: Math.random() * .35 + .08,
      phase: Math.random() * Math.PI * 2
    }));
    if (player) {
      player.x = clamp(player.x, player.r + 6, width - player.r - 6);
      player.y = clamp(player.y, player.r + 6, height - player.r - 6);
    }
  }

  function newGame() {
    elapsed = 0;
    score = 0;
    lives = 3;
    sector = 1;
    spawnShard = .1;
    spawnEnemy = 2.4;
    spawnHeal = 17;
    shake = 0;
    shards = [];
    enemies = [];
    heals = [];
    particles = [];
    keys.clear();
    pointerActive = false;
    target = null;
    player = { x: width / 2, y: height / 2, r: 10, vx: 0, vy: 0, invuln: 1.4, dash: 0, dashCooldown: 0, angle: -Math.PI / 2 };
    updateHud();
    status = 'running';
    overlay.classList.add('hidden');
    pauseButton.disabled = false;
    pauseButton.innerHTML = '<span>Ⅱ</span>';
    pauseButton.setAttribute('aria-label', 'Pause game');
    sound('start');
  }

  function updateHud() {
    scoreNode.textContent = String(Math.floor(score)).padStart(5, '0');
    bestNode.textContent = String(best).padStart(5, '0');
    sectorNode.textContent = String(sector).padStart(2, '0');
    livesNode.innerHTML = [0, 1, 2].map((i) => `<span class="${i >= lives ? 'lost' : ''}">●</span>`).join(' ');
    document.getElementById('lives').setAttribute('aria-label', `${lives} ${lives === 1 ? 'life' : 'lives'}`);
  }

  function showOverlay(kind) {
    overlay.classList.remove('hidden');
    if (kind === 'pause') {
      overlayEyebrow.textContent = 'A MOMENT OF STILLNESS';
      overlayTitle.textContent = 'Paused.';
      overlayCopy.textContent = `You gathered ${Math.floor(score)} light. Pick up where you left off when you're ready.`;
      playLabel.textContent = 'RESUME DRIFT';
      keyHint.innerHTML = 'TAKE YOUR TIME <span class="hint-divider">·</span> PRESS <kbd>ESC</kbd> TO RESUME';
      pauseButton.innerHTML = '<span>▶</span>';
      pauseButton.setAttribute('aria-label', 'Resume game');
    } else if (kind === 'over') {
      overlayEyebrow.textContent = score >= best && score > 0 ? 'A NEW PERSONAL BEST' : 'DRIFT COMPLETE';
      overlayTitle.textContent = score >= best && score > 0 ? 'Beautifully done.' : 'Find your flow.';
      overlayCopy.textContent = `You gathered ${Math.floor(score)} light across ${sector} ${sector === 1 ? 'sector' : 'sectors'}. Every drift is a fresh start.`;
      playLabel.textContent = 'DRIFT AGAIN';
      keyHint.innerHTML = 'MOVE <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> OR ARROWS <span class="hint-divider">·</span> DASH <kbd>SPACE</kbd>';
      pauseButton.disabled = true;
    }
  }

  function endGame() {
    status = 'over';
    if (score > best) {
      best = Math.floor(score);
      saveBest();
    }
    updateHud();
    pauseButton.disabled = true;
    sound('hit');
    showOverlay('over');
  }

  function pauseGame() {
    if (status === 'running') {
      status = 'paused';
      keys.clear();
      showOverlay('pause');
    } else if (status === 'paused') {
      status = 'running';
      lastFrame = performance.now();
      overlay.classList.add('hidden');
      pauseButton.innerHTML = '<span>Ⅱ</span>';
      pauseButton.setAttribute('aria-label', 'Pause game');
    }
  }

  function spawn(kind) {
    if (kind === 'shard') {
      const edge = 24;
      shards.push({ x: rand(edge, width - edge), y: rand(edge, height - edge), r: rand(5, 7), phase: Math.random() * 7, spin: Math.random() * 7, life: 15 });
    } else if (kind === 'enemy') {
      const side = Math.floor(Math.random() * 4);
      const pad = 22;
      const pos = side === 0 ? { x: rand(0, width), y: -pad }
        : side === 1 ? { x: width + pad, y: rand(0, height) }
        : side === 2 ? { x: rand(0, width), y: height + pad }
        : { x: -pad, y: rand(0, height) };
      const dx = player.x - pos.x;
      const dy = player.y - pos.y;
      const mag = Math.hypot(dx, dy) || 1;
      const speed = rand(35, 54) + sector * 5;
      enemies.push({ ...pos, vx: dx / mag * speed, vy: dy / mag * speed, r: rand(8, 12), phase: Math.random() * 7, spin: rand(-2, 2) });
    } else if (kind === 'heal' && lives < 3) {
      heals.push({ x: rand(25, width - 25), y: rand(25, height - 25), r: 8, phase: Math.random() * 7, life: 10 });
    }
  }

  function burst(x, y, color, count, force = 100) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(force * .24, force);
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: rand(.24, .65), max: .65, color, r: rand(1, 2.8) });
    }
  }

  function update(dt) {
    if (status !== 'running') return;
    elapsed += dt;
    const nextSector = 1 + Math.floor(elapsed / 16);
    if (nextSector !== sector) {
      sector = nextSector;
      burst(width / 2, height / 2, COLORS.mint, 26, 160);
      sound('sector');
    }
    score += dt * (2 + sector * .5);
    spawnShard -= dt;
    spawnEnemy -= dt;
    spawnHeal -= dt;
    if (spawnShard <= 0) {
      spawn('shard');
      spawnShard = rand(.75, 1.35);
    }
    if (spawnEnemy <= 0) {
      spawn('enemy');
      spawnEnemy = Math.max(.68, rand(2.6, 3.8) - sector * .19);
    }
    if (spawnHeal <= 0) {
      spawn('heal');
      spawnHeal = rand(16, 23);
    }

    const ax = (keys.has('ArrowRight') || keys.has('d') || keys.has('D') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') || keys.has('A') ? 1 : 0);
    const ay = (keys.has('ArrowDown') || keys.has('s') || keys.has('S') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') || keys.has('W') ? 1 : 0);
    const accel = 700;
    if (ax || ay) {
      const mag = Math.hypot(ax, ay) || 1;
      player.vx += ax / mag * accel * dt;
      player.vy += ay / mag * accel * dt;
    } else if (pointerActive && target) {
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        player.vx += dx / dist * accel * dt;
        player.vy += dy / dist * accel * dt;
      }
    }
    const maxSpeed = player.dash > 0 ? 470 : 230;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > maxSpeed) {
      player.vx = player.vx / speed * maxSpeed;
      player.vy = player.vy / speed * maxSpeed;
    }
    const drag = Math.pow(.001, dt);
    player.vx *= drag;
    player.vy *= drag;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = clamp(player.x, player.r + 4, width - player.r - 4);
    player.y = clamp(player.y, player.r + 4, height - player.r - 4);
    if (Math.hypot(player.vx, player.vy) > 5) player.angle = Math.atan2(player.vy, player.vx);
    player.invuln = Math.max(0, player.invuln - dt);
    player.dash = Math.max(0, player.dash - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);

    for (const shard of shards) {
      shard.phase += dt * 2;
      shard.life -= dt;
      if (distance(player, shard) < player.r + shard.r + 3) {
        shard.life = 0;
        score += 100;
        burst(shard.x, shard.y, COLORS.mint, 10, 125);
        sound('collect');
      }
    }
    shards = shards.filter((shard) => shard.life > 0);

    for (const enemy of enemies) {
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.phase += dt * 3;
      if (player.invuln <= 0 && distance(player, enemy) < player.r + enemy.r) {
        lives -= 1;
        player.invuln = 1.65;
        player.vx = -enemy.vx * .9;
        player.vy = -enemy.vy * .9;
        shake = .3;
        burst(player.x, player.y, COLORS.coral, 18, 180);
        sound('hit');
        if (lives <= 0) {
          updateHud();
          endGame();
          return;
        }
      }
    }
    enemies = enemies.filter((enemy) => enemy.x > -70 && enemy.x < width + 70 && enemy.y > -70 && enemy.y < height + 70);

    for (const heal of heals) {
      heal.phase += dt * 2;
      heal.life -= dt;
      if (distance(player, heal) < player.r + heal.r + 2) {
        heal.life = 0;
        lives = Math.min(3, lives + 1);
        score += 50;
        burst(heal.x, heal.y, COLORS.gold, 14, 120);
        sound('heal');
      }
    }
    heals = heals.filter((heal) => heal.life > 0);

    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(.12, dt);
      particle.vy *= Math.pow(.12, dt);
      particle.life -= dt;
    }
    particles = particles.filter((particle) => particle.life > 0);
    shake = Math.max(0, shake - dt);
    if (Math.floor(score) !== Number(scoreNode.textContent)) updateHud();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#091512';
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * .5, height * .48, 0, width * .5, height * .48, Math.max(width, height) * .65);
    glow.addColorStop(0, 'rgba(24, 57, 43, .43)');
    glow.addColorStop(1, 'rgba(5, 13, 11, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    for (const star of stars) {
      const twinkle = .7 + Math.sin(performance.now() * .001 + star.phase) * .3;
      ctx.globalAlpha = star.a * twinkle;
      ctx.fillStyle = '#bafbd0';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    if (shake > 0) ctx.translate(rand(-6, 6) * shake / .3, rand(-5, 5) * shake / .3);
    for (const shard of shards) drawShard(shard);
    for (const heal of heals) drawHeal(heal);
    for (const enemy of enemies) drawEnemy(enemy);
    for (const particle of particles) {
      ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    if (player) drawPlayer();
    ctx.restore();
  }

  function drawShard(shard) {
    const pulse = 1 + Math.sin(shard.phase * 2) * .17;
    ctx.save();
    ctx.translate(shard.x, shard.y);
    ctx.rotate(shard.phase * .25);
    ctx.globalAlpha = Math.min(1, shard.life * 2);
    ctx.shadowColor = COLORS.bright;
    ctx.shadowBlur = 17;
    ctx.fillStyle = COLORS.mint;
    ctx.beginPath();
    ctx.moveTo(0, -shard.r * pulse);
    ctx.lineTo(shard.r * .72, 0);
    ctx.lineTo(0, shard.r * pulse);
    ctx.lineTo(-shard.r * .72, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawEnemy(enemy) {
    const wobble = Math.sin(enemy.phase * 1.7) * 1.2;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.phase * .22);
    ctx.shadowColor = COLORS.coral;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = COLORS.coral;
    ctx.lineWidth = 1.6;
    ctx.fillStyle = 'rgba(255, 136, 125, .13)';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const radius = enemy.r + (i % 2 ? wobble : -wobble) * .35;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawHeal(heal) {
    const pulse = 1 + Math.sin(heal.phase * 3) * .14;
    ctx.save();
    ctx.translate(heal.x, heal.y);
    ctx.globalAlpha = Math.min(1, heal.life * 1.7);
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, heal.r * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
    ctx.moveTo(0, -4); ctx.lineTo(0, 4);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer() {
    const blink = player.invuln > 0 && Math.floor(performance.now() / 90) % 2 === 0;
    if (blink) return;
    const speed = Math.hypot(player.vx, player.vy);
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle + Math.PI / 2);
    if (player.dash > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 22 + Math.sin(performance.now() * .025) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(164,246,198,.8)';
      ctx.lineWidth = 1.4;
      ctx.shadowColor = COLORS.mint;
      ctx.shadowBlur = 22;
      ctx.stroke();
    }
    if (speed > 30) {
      ctx.globalAlpha = .4;
      ctx.fillStyle = COLORS.mint;
      ctx.beginPath();
      ctx.moveTo(-4, 7);
      ctx.lineTo(0, 15 + Math.random() * 6);
      ctx.lineTo(4, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.shadowColor = COLORS.bright;
    ctx.shadowBlur = 21;
    ctx.fillStyle = COLORS.pale;
    ctx.strokeStyle = COLORS.mint;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(9, 9);
    ctx.lineTo(0, 5);
    ctx.lineTo(-9, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function dash() {
    if (status !== 'running' || player.dashCooldown > 0) return;
    let dx = (keys.has('ArrowRight') || keys.has('d') || keys.has('D') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') || keys.has('A') ? 1 : 0);
    let dy = (keys.has('ArrowDown') || keys.has('s') || keys.has('S') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') || keys.has('W') ? 1 : 0);
    if (!dx && !dy && target) {
      dx = target.x - player.x;
      dy = target.y - player.y;
    }
    let mag = Math.hypot(dx, dy);
    if (!mag) { dx = Math.cos(player.angle); dy = Math.sin(player.angle); mag = 1; }
    player.vx = dx / mag * 440;
    player.vy = dy / mag * 440;
    player.dash = .2;
    player.dashCooldown = 3.5;
    player.invuln = Math.max(player.invuln, .4);
    burst(player.x, player.y, COLORS.mint, 7, 85);
    sound('dash');
  }

  function sound(type) {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const now = audio.currentTime;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const frequencies = { collect: [660, 990], hit: [180, 90], dash: [290, 520], heal: [490, 780], sector: [390, 590], start: [330, 440] }[type] || [440, 550];
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequencies[0], now);
      oscillator.frequency.exponentialRampToValueAtTime(frequencies[1], now + .11);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.075, now + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .15);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + .16);
    } catch (_) { /* Audio is an optional enhancement. */ }
  }

  function loop(now) {
    const dt = Math.min(.035, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    if (status === 'running') update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: clamp(event.clientX - rect.left, 4, width - 4), y: clamp(event.clientY - rect.top, 4, height - 4) };
  }

  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    keys.add(event.key);
    if (event.key === ' ' && !event.repeat) dash();
    if (event.key === 'Escape' && (status === 'running' || status === 'paused')) pauseGame();
    if (event.key === 'Enter' && (status === 'ready' || status === 'over')) newGame();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key));
  window.addEventListener('blur', () => { keys.clear(); if (status === 'running') pauseGame(); });
  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointerActive = true;
    target = pointerPosition(event);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (pointerActive) target = pointerPosition(event);
  });
  canvas.addEventListener('pointerup', () => { pointerActive = false; target = null; });
  canvas.addEventListener('pointercancel', () => { pointerActive = false; target = null; });
  playButton.addEventListener('click', () => {
    if (status === 'paused') pauseGame(); else newGame();
  });
  pauseButton.addEventListener('click', pauseGame);
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    soundButton.textContent = soundOn ? '♫' : '♪';
    soundButton.setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on');
    soundButton.classList.toggle('sound-on', soundOn);
    if (soundOn) sound('start');
  });
  window.addEventListener('resize', fitCanvas);

  fitCanvas();
  bestNode.textContent = String(best).padStart(5, '0');
  requestAnimationFrame(loop);
})();

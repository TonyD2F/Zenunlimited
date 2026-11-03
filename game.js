(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const arena = document.getElementById('arena');
  const homeScreen = document.getElementById('homeScreen');
  const gameScreen = document.getElementById('gameScreen');
  const overlay = document.getElementById('overlay');
  const scoreNode = document.getElementById('score');
  const bestNode = document.getElementById('best');
  const levelNode = document.getElementById('level');
  const livesNode = document.getElementById('lives');
  const pauseButton = document.getElementById('pauseButton');
  const playButton = document.getElementById('playButton');
  const playLabel = document.getElementById('playLabel');
  const soundButton = document.getElementById('soundButton');
  const installButton = document.getElementById('installButton');
  const overlayIcon = document.getElementById('overlayIcon');
  const overlayEyebrow = document.getElementById('overlayEyebrow');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayCopy = document.getElementById('overlayCopy');
  const keyHint = document.getElementById('keyHint');
  const gameTitle = document.getElementById('gameTitle');
  const gameCategory = document.getElementById('gameCategory');
  const actionButton = document.getElementById('actionButton');
  const actionHint = document.getElementById('actionHint');
  const controlsHint = document.getElementById('controlsHint');

  const games = {
    rush: { title: 'Neon Rush', category: '01 / RUNNER', icon: '↗', color: '#9af7d1', description: 'Switch lanes, dodge the blocks, and scoop up glowing energy. How far can you run?', action: 'DASH', label: 'DASH', hint: 'SPACE TO DASH', start: 'READY TO RUN?' },
    blast: { title: 'Star Blaster', category: '02 / SHOOTER', icon: '✦', color: '#c4a4ff', description: 'Pilot the star lanes, blast incoming drones, and collect cosmic energy.', action: 'FIRE', label: 'FIRE', hint: 'SPACE TO FIRE', start: 'LOCK AND LOAD?' },
    sprint: { title: 'Crystal Sprint', category: '03 / JUMPER', icon: '✧', color: '#89f4dc', description: 'Leap over neon hurdles, change lanes, and collect crystals on the endless skyway.', action: 'JUMP', label: 'JUMP', hint: 'SPACE TO JUMP', start: 'READY TO LEAP?' }
  };
  const keySet = new Set();
  let width = 1, height = 1, dpr = 1, lastFrame = 0, elapsed = 0, score = 0, best = 0, lives = 3, level = 1;
  let status = 'home', gameId = 'rush', soundOn = false, audio = null, spawnTimer = 0, shake = 0;
  let lane = 0, entities = [], particles = [], bullets = [], stars = [], jumpTime = 0, dashTime = 0, invuln = 0, fireTimer = 0, roadScroll = 0;
  let deferredInstall = null;

  function readBest(id) { try { return Number(localStorage.getItem(`zen-arcade-${id}`)) || 0; } catch (_) { return 0; } }
  function saveBest() { try { localStorage.setItem(`zen-arcade-${gameId}`, String(best)); } catch (_) { /* Storage is optional. */ } }
  function setText(node, value) { node.textContent = value; }
  function fitCanvas() {
    const rect = arena.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    width = rect.width; height = rect.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.max(28, Math.round(width * height / 5600)) }, () => ({ x: Math.random() * width, y: Math.random() * height * .48, r: Math.random() * 1.3 + .25, phase: Math.random() * 7 }));
  }
  function enterGame(id) {
    gameId = games[id] ? id : 'rush';
    homeScreen.hidden = true; gameScreen.hidden = false;
    const game = games[gameId];
    setText(gameTitle, game.title); setText(gameCategory, game.category);
    overlayIcon.textContent = game.icon; overlayIcon.style.color = game.color; overlayIcon.style.borderColor = `${game.color}66`;
    actionButton.textContent = gameId === 'blast' ? '✦' : gameId === 'sprint' ? '↑' : '⚡';
    actionButton.setAttribute('aria-label', game.action); setText(actionHint, game.label); setText(controlsHint, 'CHANGE LANES');
    setText(overlayEyebrow, 'READY PLAYER ONE'); setText(overlayTitle, game.start); setText(overlayCopy, game.description);
    setText(playLabel, 'START GAME'); setText(keyHint, `← → TO MOVE  ·  ${game.hint}`);
    status = 'ready'; pauseButton.disabled = true; pauseButton.innerHTML = 'Ⅱ';
    best = readBest(gameId); setText(bestNode, String(best).padStart(5, '0'));
    fitCanvas(); resetRun(); overlay.classList.remove('hidden');
  }
  function resetRun() {
    elapsed = 0; score = 0; lives = 3; level = 1; spawnTimer = .55; shake = 0; lane = 0; roadScroll = 0;
    entities = []; particles = []; bullets = []; jumpTime = 0; dashTime = 0; invuln = 1.1; fireTimer = 0;
    updateHud();
  }
  function startGame() {
    resetRun(); status = 'running'; overlay.classList.add('hidden'); pauseButton.disabled = false;
    pauseButton.setAttribute('aria-label', 'Pause game'); pauseButton.innerHTML = 'Ⅱ'; lastFrame = performance.now(); sound('start');
  }
  function updateHud() {
    setText(scoreNode, String(Math.floor(score)).padStart(5, '0'));
    setText(bestNode, String(best).padStart(5, '0'));
    setText(levelNode, String(level).padStart(2, '0'));
    setText(livesNode, '● '.repeat(lives).trim() + (lives < 3 ? ` ${'<span class="lost">●</span> '.repeat(3 - lives).trim()}` : ''));
    livesNode.innerHTML = `${'<span>●</span> '.repeat(lives)}${'<span class="lost">●</span> '.repeat(3 - lives)}`.trim();
  }
  function showOverlay(kind) {
    overlay.classList.remove('hidden');
    if (kind === 'pause') {
      setText(overlayEyebrow, 'TAKE A BREATHER'); setText(overlayTitle, 'Paused.');
      setText(overlayCopy, `You scored ${Math.floor(score)} points. Ready when you are.`); setText(playLabel, 'RESUME GAME');
      setText(keyHint, 'PRESS ESC TO RESUME'); pauseButton.innerHTML = '▶'; pauseButton.setAttribute('aria-label', 'Resume game');
    } else if (kind === 'over') {
      setText(overlayEyebrow, score > best ? 'NEW PERSONAL BEST' : 'RUN COMPLETE');
      setText(overlayTitle, score > best ? 'Incredible run.' : 'Give it another go.');
      setText(overlayCopy, `You scored ${Math.floor(score)} points in ${games[gameId].title}. Your next run starts now.`);
      setText(playLabel, 'PLAY AGAIN'); setText(keyHint, `← → TO MOVE  ·  ${games[gameId].hint}`); pauseButton.disabled = true;
    }
  }
  function endGame() {
    status = 'over';
    if (Math.floor(score) > best) { best = Math.floor(score); saveBest(); }
    updateHud(); document.querySelector(`#best-${gameId}`).textContent = String(best).padStart(5, '0');
    sound('hit'); showOverlay('over');
  }
  function pauseGame() {
    if (status === 'running') { status = 'paused'; keySet.clear(); showOverlay('pause'); }
    else if (status === 'paused') { status = 'running'; overlay.classList.add('hidden'); pauseButton.innerHTML = 'Ⅱ'; pauseButton.setAttribute('aria-label', 'Pause game'); lastFrame = performance.now(); }
  }
  function moveLane(direction) { if (status !== 'running') return; lane = clamp(lane + direction, -1, 1); sound('move'); }
  function action() {
    if (status !== 'running') return;
    if (gameId === 'sprint') { jumpTime = .68; burst(project(lane, .11).x, project(lane, .11).y, '#9af7d1', 5, 65); sound('jump'); }
    else if (gameId === 'rush') { dashTime = .42; invuln = Math.max(invuln, .42); sound('dash'); }
    else shoot();
  }
  function shoot() { if (status !== 'running' || gameId !== 'blast') return; bullets.push({ lane, z: .12 }); sound('fire'); }
  function spawnEntity() {
    const randomLane = Math.floor(Math.random() * 3) - 1;
    const roll = Math.random();
    let type = roll < .33 ? 'gem' : gameId === 'blast' ? 'drone' : gameId === 'sprint' ? 'hurdle' : 'block';
    if (gameId === 'blast' && roll < .56) type = 'drone';
    if (gameId === 'sprint' && roll < .58) type = 'hurdle';
    entities.push({ lane: randomLane, z: 1.04, type, spin: Math.random() * 7, hit: false });
    if (Math.random() < .18) entities.push({ lane: Math.floor(Math.random() * 3) - 1, z: 1.14, type: 'gem', spin: 0, hit: false });
  }
  function update(dt) {
    if (status !== 'running') return;
    elapsed += dt; roadScroll = (roadScroll + dt * (1.1 + level * .12)) % 1;
    level = 1 + Math.floor(elapsed / 18);
    score += dt * (9 + level * 1.2);
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnEntity(); spawnTimer = Math.max(.43, rand(.78, 1.12) - level * .025); }
    jumpTime = Math.max(0, jumpTime - dt); dashTime = Math.max(0, dashTime - dt); invuln = Math.max(0, invuln - dt); fireTimer -= dt;
    if (gameId === 'blast' && fireTimer <= 0) { shoot(); fireTimer = .48; }
    for (const entity of entities) {
      entity.z -= dt * (.42 + level * .027);
      entity.spin += dt * 2.4;
      if (entity.type === 'gem' && entity.z < .16 && entity.z > .025 && entity.lane === lane && !entity.hit) {
        entity.hit = true; score += 100; burst(project(entity.lane, entity.z).x, project(entity.lane, entity.z).y, '#9af7d1', 9, 110); sound('collect');
      }
      if (entity.type !== 'gem' && entity.z < .13 && entity.z > .045 && entity.lane === lane && !entity.hit) {
        const avoided = (gameId === 'sprint' && jumpTime > .12) || (gameId === 'rush' && dashTime > 0);
        if (gameId === 'blast' && entity.type === 'drone') continue;
        if (!avoided && invuln <= 0) hitPlayer(entity);
        entity.hit = true;
      }
    }
    entities = entities.filter((e) => e.z > -.05 && !e.hit);
    for (const bullet of bullets) {
      bullet.z += dt * 1.35;
      for (const entity of entities) if (!entity.hit && entity.type === 'drone' && entity.lane === bullet.lane && Math.abs(entity.z - bullet.z) < .075) {
        entity.hit = true; bullet.z = 2; score += 60; burst(project(entity.lane, entity.z).x, project(entity.lane, entity.z).y, '#d4b8ff', 8, 95); sound('collect'); break;
      }
    }
    bullets = bullets.filter((b) => b.z < 1.3);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(.1, dt); p.vy *= Math.pow(.1, dt); p.life -= dt; }
    particles = particles.filter((p) => p.life > 0); shake = Math.max(0, shake - dt);
    if (Math.floor(score) !== Number(scoreNode.textContent)) updateHud();
  }
  function hitPlayer(entity) {
    entity.hit = true; lives--; invuln = 1.25; shake = .26;
    const p = project(lane, .1); burst(p.x, p.y, '#ff8bbc', 14, 150); sound('hit'); updateHud();
    if (lives <= 0) endGame();
  }
  function project(whichLane, z) {
    const t = clamp(1 - z, 0, 1.22); const perspective = .15 + t * .96;
    const horizon = height * .2; const y = horizon + Math.pow(t, 1.55) * height * .78;
    const half = width * (.065 + t * .39);
    return { x: width / 2 + whichLane * half * .57, y, scale: perspective, half, t };
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, 0, height); bg.addColorStop(0, '#11152d'); bg.addColorStop(.52, '#101629'); bg.addColorStop(1, '#09111c'); ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(width / 2, height * .22, 0, width / 2, height * .27, width * .58);
    glow.addColorStop(0, gameId === 'blast' ? 'rgba(144,99,199,.3)' : 'rgba(71,153,151,.23)'); glow.addColorStop(1, 'rgba(8,12,25,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
    drawStars(); drawRoad();
    ctx.save(); if (shake > 0) ctx.translate(rand(-5, 5) * shake / .26, rand(-4, 4) * shake / .26);
    entities.slice().sort((a, b) => b.z - a.z).forEach(drawEntity); bullets.forEach(drawBullet); particles.forEach(drawParticle); drawPlayer(); ctx.restore();
  }
  function drawStars() {
    for (const star of stars) { ctx.globalAlpha = .24 + (Math.sin(performance.now() * .001 + star.phase) + 1) * .16; ctx.fillStyle = '#d9e8ff'; ctx.fillRect(star.x, star.y, star.r, star.r); }
    ctx.globalAlpha = 1;
  }
  function drawRoad() {
    const horizon = height * .2; const top = width * .075; const bottom = width * .47;
    ctx.beginPath(); ctx.moveTo(width / 2 - top, horizon); ctx.lineTo(width / 2 + top, horizon); ctx.lineTo(width / 2 + bottom, height); ctx.lineTo(width / 2 - bottom, height); ctx.closePath();
    const road = ctx.createLinearGradient(0, horizon, 0, height); road.addColorStop(0, '#1b203a'); road.addColorStop(1, '#17243a'); ctx.fillStyle = road; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.moveTo(width / 2 - top, horizon); ctx.lineTo(width / 2 + top, horizon); ctx.lineTo(width / 2 + bottom, height); ctx.lineTo(width / 2 - bottom, height); ctx.closePath(); ctx.clip();
    for (let i = 0; i < 13; i++) {
      const t = (i / 13 + roadScroll) % 1; const z = 1 - t; const p = project(0, z); const lineWidth = 1 + t * 1.4;
      ctx.globalAlpha = .1 + t * .18; ctx.strokeStyle = gameId === 'blast' ? '#c29aff' : '#9af7d1'; ctx.lineWidth = lineWidth;
      ctx.beginPath(); ctx.moveTo(width / 2 - p.half, p.y); ctx.lineTo(width / 2 + p.half, p.y); ctx.stroke();
    }
    ctx.globalAlpha = .34; ctx.strokeStyle = gameId === 'blast' ? '#ad88ff' : '#75e9d1'; ctx.lineWidth = 1;
    for (const divider of [-1 / 3, 1 / 3]) { ctx.beginPath(); ctx.moveTo(width / 2 + divider * top * 2, horizon); ctx.lineTo(width / 2 + divider * bottom * 2, height); ctx.stroke(); }
    ctx.restore(); ctx.globalAlpha = .7; ctx.strokeStyle = gameId === 'blast' ? '#bd9aff' : '#70e9ce'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(width / 2 - top, horizon); ctx.lineTo(width / 2 - bottom, height); ctx.moveTo(width / 2 + top, horizon); ctx.lineTo(width / 2 + bottom, height); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(190,205,255,.55)'; ctx.beginPath(); ctx.arc(width / 2, horizon, 2, 0, Math.PI * 2); ctx.fill();
  }
  function drawEntity(entity) {
    const p = project(entity.lane, entity.z); if (p.y < height * .18 || p.y > height + 40) return;
    const s = 7 + p.t * 37; ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = clamp(.45 + p.t * .7, .45, 1);
    if (entity.type === 'gem') {
      ctx.rotate(Math.PI / 4 + Math.sin(entity.spin) * .12); ctx.shadowColor = '#8fffd8'; ctx.shadowBlur = 17 * p.scale; ctx.fillStyle = '#a4ffdb';
      ctx.fillRect(-s * .32, -s * .32, s * .64, s * .64); ctx.fillStyle = '#ecfff6'; ctx.fillRect(-s * .13, -s * .13, s * .26, s * .26);
    } else {
      const color = entity.type === 'drone' ? '#d29cff' : entity.type === 'hurdle' ? '#ffd486' : '#ff8bb5';
      ctx.shadowColor = color; ctx.shadowBlur = 15 * p.scale;
      const w = entity.type === 'hurdle' ? s * 1.22 : s * .82; const h = entity.type === 'hurdle' ? s * .42 : s * .86;
      ctx.fillStyle = `${color}bb`; ctx.fillRect(-w / 2, -h, w, h);
      ctx.fillStyle = entity.type === 'hurdle' ? '#fff0bd' : '#ffe5f0'; ctx.globalAlpha *= .75; ctx.beginPath(); ctx.moveTo(-w / 2, -h); ctx.lineTo(-w / 2 + s * .23, -h - s * .2); ctx.lineTo(w / 2 + s * .23, -h - s * .2); ctx.lineTo(w / 2, -h); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = .34; ctx.fillStyle = '#070b18'; ctx.fillRect(-w / 2 + 3, -h + 3, Math.max(2, w - 6), Math.max(2, h - 6));
    }
    ctx.restore();
  }
  function drawPlayer() {
    const p = project(lane, .11); const lift = gameId === 'sprint' ? (jumpTime > 0 ? Math.sin((.68 - jumpTime) / .68 * Math.PI) * height * .13 : 0) : 0;
    if (invuln > 0 && Math.floor(performance.now() / 100) % 2 === 0) return;
    const color = games[gameId].color; const y = p.y - lift; const scale = clamp(width / 450, .72, 1.2);
    ctx.save(); ctx.translate(p.x, y); ctx.scale(scale, scale);
    ctx.globalAlpha = .28; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 4 + lift * .35, 18, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.shadowColor = color; ctx.shadowBlur = dashTime > 0 ? 27 : 19;
    if (gameId === 'blast') { ctx.fillStyle = '#f2eaff'; ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(0, 7); ctx.lineTo(-13, 12); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else { ctx.fillStyle = '#effff7'; ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(10, 12); ctx.lineTo(0, 7); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    if (gameId === 'sprint' && jumpTime > 0) { ctx.globalAlpha = .45; ctx.strokeStyle = color; ctx.beginPath(); ctx.ellipse(0, 13, 18 + Math.sin(jumpTime * 14) * 4, 5, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  function drawBullet(bullet) { const p = project(bullet.lane, bullet.z); ctx.save(); ctx.globalAlpha = clamp(1 - bullet.z * .45, .2, 1); ctx.strokeStyle = '#dec7ff'; ctx.shadowColor = '#c9a4ff'; ctx.shadowBlur = 15; ctx.lineWidth = 2 + p.t * 2; ctx.beginPath(); ctx.moveTo(p.x, p.y + 13); ctx.lineTo(p.x, p.y - 13); ctx.stroke(); ctx.restore(); }
  function burst(x, y, color, count, force) { for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2, speed = rand(force * .2, force); particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: rand(.22, .55), max: .55, color, r: rand(1, 3) }); } }
  function drawParticle(p) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 11; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.shadowBlur = 0; }
  function sound(type) {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume();
      const notes = { start: [330, 490], move: [250, 320], collect: [650, 980], hit: [180, 90], dash: [310, 640], jump: [350, 690], fire: [510, 270] }[type] || [390, 510];
      const now = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(notes[0], now); osc.frequency.exponentialRampToValueAtTime(notes[1], now + .1); gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.05, now + .01); gain.gain.exponentialRampToValueAtTime(.0001, now + .13); osc.connect(gain); gain.connect(audio.destination); osc.start(now); osc.stop(now + .14);
    } catch (_) { /* Audio is optional. */ }
  }
  function loop(now) { const dt = Math.min(.035, (now - (lastFrame || now)) / 1000); lastFrame = now; if (status === 'running') update(dt); draw(); requestAnimationFrame(loop); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function rand(min, max) { return min + Math.random() * (max - min); }

  document.querySelectorAll('.game-card').forEach((card) => card.addEventListener('click', () => enterGame(card.dataset.game)));
  document.getElementById('backButton').addEventListener('click', () => { status = 'home'; keySet.clear(); gameScreen.hidden = true; homeScreen.hidden = false; });
  playButton.addEventListener('click', () => { if (status === 'paused') pauseGame(); else startGame(); });
  pauseButton.addEventListener('click', pauseGame);
  document.getElementById('leftButton').addEventListener('pointerdown', (event) => { event.preventDefault(); moveLane(-1); });
  document.getElementById('rightButton').addEventListener('pointerdown', (event) => { event.preventDefault(); moveLane(1); });
  actionButton.addEventListener('pointerdown', (event) => { event.preventDefault(); action(); });
  soundButton.addEventListener('click', () => { soundOn = !soundOn; soundButton.textContent = soundOn ? '♫' : '♪'; soundButton.setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on'); if (soundOn) sound('start'); });
  window.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', ' ', 'ArrowUp'].includes(event.key)) event.preventDefault();
    if (event.repeat && ['ArrowLeft', 'ArrowRight', ' ', 'ArrowUp'].includes(event.key)) return;
    keySet.add(event.key);
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') moveLane(-1);
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') moveLane(1);
    if (event.key === ' ' || event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') action();
    if (event.key === 'Escape' && ['running', 'paused'].includes(status)) pauseGame();
    if (event.key === 'Enter' && ['ready', 'over'].includes(status)) startGame();
  });
  window.addEventListener('keyup', (event) => keySet.delete(event.key));
  window.addEventListener('blur', () => { keySet.clear(); if (status === 'running') pauseGame(); });
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstall = event; installButton.hidden = false; });
  installButton.addEventListener('click', async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; installButton.hidden = true; });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));

  ['rush', 'blast', 'sprint'].forEach((id) => { document.querySelector(`#best-${id}`).textContent = String(readBest(id)).padStart(5, '0'); });
  fitCanvas(); requestAnimationFrame(loop);
})();

const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let engine, n = 4, tiles = [];
let started = null, elapsed = 0, won = false, locked = false;
let finishTimers = [], noticeTimer, animation = 0, imageRevision = 0;
let installPrompt;
let restorePhotoFullscreen = false;
let restoringFullscreen = false;

async function resumePhotoFullscreen() {
  if (!restorePhotoFullscreen || restoringFullscreen) return;
  if (document.fullscreenElement) { restorePhotoFullscreen = false; return; }
  if (!document.documentElement.requestFullscreen) { restorePhotoFullscreen = false; return; }
  restoringFullscreen = true;
  try {
    await document.documentElement.requestFullscreen({navigationUI: 'hide'});
    restorePhotoFullscreen = false;
  } catch {
    // Some browsers require a new tap after closing a native file picker.
  } finally {
    restoringFullscreen = false;
  }
}

function notice(message, sticky = false) {
  clearTimeout(noticeTimer);
  $('notice').textContent = message;
  $('notice').hidden = false;
  if (!sticky) noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 5500);
}

function timeText(ms) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function resize() {
  // Match the main element's outer width, including its padding and border.
  const side = document.querySelector('.app').getBoundingClientRect().width;
  document.documentElement.style.setProperty('--board-side', `${side}px`);
  document.documentElement.style.setProperty('--cell', `${side / n}px`);
  if (engine && tiles.length) positionTiles();
}

function seed() {
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);
  return words;
}

function newGame() {
  if (!engine) return;
  finishTimers.forEach(clearTimeout);
  finishTimers = [];
  cancelAnimationFrame(animation);
  clearCelebration();
  const random = seed();
  engine.puzzle_init(n, random[0], random[1]);
  started = null;
  elapsed = 0;
  won = false;
  locked = false;
  $('stage').classList.remove('returning', 'solved');
  $('stage').classList.add('no-transitions');
  $('complete-image').hidden = true;
  $('dock-label').hidden = false;
  $('intro').classList.remove('won');
  $('intro').hidden = true;
  $('hint').textContent = '마지막 조각은 보드 밖에서 기다리고 있어요.';
  $('new-game-label').textContent = '새 게임';
  $('board-size').textContent = `${n} × ${n}`;
  $('timer').textContent = '00:00';
  document.documentElement.style.setProperty('--n', n);
  $('tiles').replaceChildren();
  tiles = Array.from({length: n * n}, (_, tile) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `tile${tile === n * n - 1 ? ' last' : ''}`;
    button.style.backgroundSize = `${n * 100}% ${n * 100}%`;
    button.style.backgroundPosition = `${(tile % n) / (n - 1) * 100}% ${Math.floor(tile / n) / (n - 1) * 100}%`;
    button.setAttribute('aria-label', tile === n * n - 1 ? `${tile + 1}번 마지막 조각, 보드 바깥에 보관 중` : `${tile + 1}번 조각`);
    const badge = document.createElement('span');
    badge.className = 'number';
    badge.textContent = tile + 1;
    button.append(badge);
    button.addEventListener('click', () => move(Number(button.dataset.index)));
    $('tiles').append(button);
    return button;
  });
  resize();
  requestAnimationFrame(() => requestAnimationFrame(() => $('stage').classList.remove('no-transitions')));
}

function positionTiles() {
  const side = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--board-side'));
  const cell = side / n;
  const blank = engine.puzzle_blank();
  for (let i = 0; i < n * n; i++) {
    const tile = engine.puzzle_tile(i);
    const button = tiles[tile];
    const last = tile === n * n - 1;
    const x = last ? (n - 1) * cell + 1 : (i % n) * cell + 1;
    const y = last && !won ? side + 20 : Math.floor(i / n) * cell + 1;
    button.style.transform = `translate(${x}px, ${y}px)`;
    button.dataset.index = i;
    const movable = !last && !won && Math.abs(Math.floor(i / n) - Math.floor(blank / n)) + Math.abs(i % n - blank % n) === 1;
    button.classList.toggle('movable', movable);
    button.disabled = !movable;
  }
  $('moves').replaceChildren(document.createTextNode(engine.puzzle_moves()), Object.assign(document.createElement('small'), {textContent: '회'}));
}

function move(index) {
  if (!engine || locked || won || !engine.puzzle_move(index)) return;
  if (started === null) started = performance.now();
  locked = true;
  positionTiles();
  if (engine.puzzle_solved()) {
    finish();
  } else {
    finishTimers.push(setTimeout(() => { locked = false; positionTiles(); }, reducedMotion ? 0 : 175));
  }
}

function finish() {
  elapsed = performance.now() - started;
  $('timer').textContent = timeText(elapsed);
  $('intro').classList.add('won');
  $('eyebrow').textContent = 'PERFECT · 모든 조각이 제자리에';
  $('headline').textContent = '멋진 풍경을 완성했어요!';
  $('instructions').textContent = `${n} × ${n} · ${engine.puzzle_moves()}회 이동 · ${timeText(elapsed)}`;
  $('intro').hidden = false;
  resize();
  $('hint').textContent = '잠시 멈춰, 완성된 풍경을 감상하세요.';
  $('new-game-label').textContent = '한 판 더';
  $('dock-label').hidden = true;
  // Finish the clicked tile first, then return the piece stored outside the board.
  finishTimers.push(setTimeout(() => {
    won = true;
    $('stage').classList.add('returning');
    positionTiles();
  }, reducedMotion ? 0 : 175));
  finishTimers.push(setTimeout(() => {
    $('complete-image').hidden = false;
    $('stage').classList.add('solved');
    locked = false;
    positionTiles();
    if (!reducedMotion) celebrate();
  }, reducedMotion ? 0 : 710));
}

function tick() {
  if (engine && started !== null && !engine.puzzle_solved()) {
    elapsed = performance.now() - started;
    $('timer').textContent = timeText(elapsed);
  }
}
setInterval(tick, 200);

function setPhoto(url) {
  document.documentElement.style.setProperty('--photo', `url("${url}")`);
  $('preview').querySelector('img').src = url;
  newGame();
}

async function readPhoto(file) {
  if (!file) return;
  if (file.size > 64 * 1024 * 1024) { notice('64MB 이하의 사진을 선택해 주세요.'); return; }
  const revision = ++imageRevision;
  $('choose-image').disabled = true;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (revision !== imageRevision) return;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1200;
    const context = canvas.getContext('2d');
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new Error('Empty image');
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 1200, 1200);
    setPhoto(canvas.toDataURL('image/jpeg', .92));
    notice('사진을 준비했어요. 가운데를 정사각형으로 잘라 사용합니다.');
  } catch {
    notice('사진을 읽을 수 없어요. JPG, PNG 또는 WebP 사진으로 다시 선택해 주세요.');
  } finally {
    URL.revokeObjectURL(url);
    $('choose-image').disabled = false;
    $('image-file').value = '';
  }
}

$('settings-button').addEventListener('click', () => {
  const opened = $('settings').hidden;
  $('settings').hidden = !opened;
  $('settings-button').setAttribute('aria-expanded', String(opened));
});
$('size').addEventListener('click', event => {
  const button = event.target.closest('button[data-size]');
  if (!button || Number(button.dataset.size) === n) return;
  n = Number(button.dataset.size);
  $('size').querySelectorAll('button').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
  newGame();
});
$('numbers').addEventListener('change', () => $('stage').classList.toggle('hide-numbers', !$('numbers').checked));
$('preview-toggle').addEventListener('change', () => { $('preview').hidden = !$('preview-toggle').checked; });
$('choose-image').addEventListener('click', () => {
  restorePhotoFullscreen = !!document.fullscreenElement;
  $('image-file').click();
});
$('image-file').addEventListener('change', () => {
  resumePhotoFullscreen();
  readPhoto($('image-file').files[0]);
});
$('image-file').addEventListener('cancel', resumePhotoFullscreen);
document.addEventListener('click', event => {
  if (event.target.closest('#fullscreen, #choose-image, #image-file')) return;
  resumePhotoFullscreen();
}, true);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') restorePhotoFullscreen = false;
});
document.querySelector('.brand').addEventListener('click', event => {
  event.preventDefault();
  newGame();
});
$('default-image').addEventListener('click', () => { imageRevision++; setPhoto('./landscape.svg?v=princess-5'); });
$('shuffle').addEventListener('click', newGame);

$('fullscreen').addEventListener('click', async () => {
  restorePhotoFullscreen = false;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({navigationUI: 'hide'});
    else notice('이 브라우저에서는 전체화면을 지원하지 않아요. 브라우저 메뉴에서 ‘홈 화면에 추가’를 사용해 주세요.');
  } catch {
    notice('전체화면을 열 수 없어요. 브라우저에서 직접 열거나 ‘홈 화면에 추가’로 실행해 주세요.');
  }
});
document.addEventListener('fullscreenchange', () => {
  const active = !!document.fullscreenElement;
  $('fullscreen').setAttribute('aria-label', active ? '전체화면 종료' : '전체화면으로 플레이');
  $('fullscreen').title = active ? '전체화면 종료' : '전체화면';
  resize();
});
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(document.querySelector('.app'));
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  $('install').hidden = false;
});
$('install').addEventListener('click', async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('install').hidden = true;
});

function clearCelebration() {
  const canvas = $('celebration');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function celebrate() {
  const canvas = $('celebration');
  const context = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const width = innerWidth, height = innerHeight;
  canvas.width = width * dpr; canvas.height = height * dpr;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ['#a1e9cc', '#f7cd86', '#e997ae', '#aaa7ee', '#fff5dd'];
  const particles = Array.from({length: 140}, (_, i) => ({
    x: i % 2 ? width * .12 : width * .88, y: height * .85,
    vx: (Math.random() - .5) * width * .8, vy: -250 - Math.random() * 440,
    size: 3 + Math.random() * 4, angle: Math.random() * 6.28,
    color: colors[i % colors.length], delay: (i % 4) * .3,
  }));
  const began = performance.now();
  function frame(now) {
    const time = (now - began) / 1000;
    context.clearRect(0, 0, width, height);
    for (const p of particles) {
      const age = time - p.delay;
      if (age < 0) continue;
      const x = p.x + p.vx * age, y = p.y + p.vy * age + 110 * age * age;
      context.save(); context.globalAlpha = Math.max(0, 1 - age / 5.5);
      context.translate(x, y); context.rotate(p.angle + age * 3);
      context.fillStyle = p.color; context.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .5); context.restore();
    }
    for (let burst = 0; burst < 5; burst++) {
      const age = time - burst * .65;
      if (age < 0 || age > 1.4) continue;
      const x = width * (.2 + (burst % 3) * .3), y = height * (.17 + (burst % 2) * .17);
      context.strokeStyle = colors[burst]; context.lineWidth = 1.6;
      context.globalAlpha = 1 - age / 1.4;
      for (let ray = 0; ray < 30; ray++) {
        const angle = ray / 30 * Math.PI * 2;
        const radius = age * 75;
        context.beginPath(); context.moveTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
        context.lineTo(x + Math.cos(angle) * (radius + 10), y + Math.sin(angle) * (radius + 10)); context.stroke();
      }
    }
    context.globalAlpha = 1;
    if (time < 7) animation = requestAnimationFrame(frame); else clearCelebration();
  }
  animation = requestAnimationFrame(frame);
}

async function boot() {
  try {
    const response = await fetch('./mosaic_core.wasm');
    if (!response.ok) throw new Error('Could not load puzzle');
    const {instance} = await WebAssembly.instantiate(await response.arrayBuffer(), {});
    engine = instance.exports;
    $('stage').setAttribute('aria-busy', 'false');
    $('shuffle').disabled = false;
    $('choose-image').disabled = false;
    $('footer-text').textContent = '사진은 기기 안에서만 처리됩니다';
    newGame();
    if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('./sw.js').catch(() => {});
  } catch (error) {
    $('footer-text').textContent = '퍼즐을 불러오지 못했어요';
    $('instructions').textContent = '인터넷 연결을 확인하고 페이지를 새로고침해 주세요.';
    $('stage').setAttribute('aria-busy', 'false');
    notice('퍼즐을 불러올 수 없어요. 연결을 확인한 후 다시 열어 주세요.', true);
    console.error('MOSAIC initialization failed', error);
  }
}
resize();
boot();

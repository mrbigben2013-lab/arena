// ==================== СОСТОЯНИЕ ====================
const STATE = {
  slot: 0,              // активный слот сохранения (1..5), 0 — ещё не выбран
  gold: 420,
  fame: 0,
  day: 1,
  wins: 0,
  losses: 0,
  roster: [],
  dogs: [],
  kennelStock: [],
  inventory: [],
  recruits: [],
  selectedGladId: null,
  invFilter: 'all',
  squad: [],
  currentLocation: 'city',
  modeSel: 'manual',
  shopTab: 'weapon',
  shopCat: 'sword',
  armorCat: 'offhand',
  gearFilter: 'all',
  payWith: 'gold',
  story: { step: 0, motherHealed: false, seen: [], finalWon: false },
  bossesBeaten: [],
  lastArenaId: null,
  battleCount: 0,
  lastEventBattle: undefined,
  goalsCollapsed: false,
  gameOver: false
};

const MAX_ROSTER = 12;   // владеть можно 12 гладиаторами
const MAX_DOGS = 3;
const MAX_SQUAD = 3;     // но на песок выходят только трое
const TRAINING_COST = 55;
// Тренировка — ритм-мини-игра: 30 секунд чистого ритма на 1-й уровень,
// каждый следующий уровень требует на 5 секунд больше (см. trainingNeedMs).
const KENNEL_REFRESH_COST = 40;
const RECRUIT_REFRESH_COST = 45;

// Пустое состояние для новой игры — используется при старте нового слота
function blankState() {
  return {
    slot: STATE.slot,
    gold: 420,
    fame: 0,
    day: 1,
    wins: 0,
    losses: 0,
    roster: [],
    dogs: [],
    kennelStock: [],
    inventory: [],
    recruits: [],
    selectedGladId: null,
    invFilter: 'all',
    squad: [],
    currentLocation: 'city',
    modeSel: 'manual',
    shopTab: 'weapon',
    shopCat: 'sword',
    armorCat: 'offhand',
    gearFilter: 'all',
    payWith: 'gold',
    story: { step: 0, motherHealed: false, seen: [], finalWon: false },
    bossesBeaten: [],
    lastArenaId: null,
    battleCount: 0,
    lastEventBattle: undefined,
    gameOver: false,
    training: {}
  };
}

// ==================== УТИЛИТЫ ====================
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function xpToNext(level) { return 70 + level * 40; }

function battlesToNextLevel(glad) {
  const need = Math.max(0, xpToNext(glad.level) - glad.xp);
  const perWin = 50;
  return Math.max(1, Math.ceil(need / perWin));
}

function colorOf(list, id, fallback) {
  const f = list.find(x => x.id === id);
  return f ? f.color : fallback;
}

// ==================== СОЗДАНИЕ ====================
function createGladiator(customBg = null, forcedRole = null, gender = null) {
  const bg = customBg || pick(BACKGROUNDS);
  const g = gender || (Math.random() < 0.5 ? 'male' : 'female');
  const name = randomName(g);
  // Класс арены: своя школа, свой перк, своё снаряжение
  const cls = forcedRole
    ? pickClassForRole(forcedRole)
    : CLASS_LIST[Math.floor(Math.random() * CLASS_LIST.length)];
  const hpBase = Math.round((bg.hp + rndInt(-5, 10) + ((bg.attrs ? bg.attrs.vit : 5) - 5) * 6)
    * (cls.mods.hpMul || 1));
  const hp = Math.max(30, hpBase);
  const base = bg.attrs || { str: 5, dex: 5, vit: 5, sta: 5, wil: 5 };
  const glad = {
    id: 'g_' + Math.random().toString(36).substr(2, 9),
    name,
    gender: g,
    build: pick(['slim', 'normal', 'normal', 'muscular', 'heavy']),
    bgId: bg.id,
    bgTitle: bg.title,
    perk: bg.perk,
    cls: cls.id,
    className: cls.name,
    clsPerk: cls.perk,
    skills: [],
    skillPicks: 0,
    level: 1,
    xp: 0,
    unspent: 0,
    hp, maxHp: hp,
    atk: bg.atk + rndInt(-3, 5),
    def: bg.def + rndInt(-2, 4),
    agi: bg.agi + rndInt(-2, 3),
    attrs: { ...base },
    cost: Math.round(bg.cost * (cls.costMul || 1)),
    skinColor: pick(SKIN_TONES).color,
    hairColor: bg.hair,
    hairStyle: pick(HAIR_STYLES).id,
    beardStyle: g === 'female' ? 'none' : (bg.beard ? 'full' : pick(['stubble', 'none'])),
    aiRole: forcedRole || cls.role,
    equip: { weapon: null, offhand: null, head: null, body: null, arms: null, legs: null }
  };
  resetLimbs(glad);
  return glad;
}

function equipRecruitByRole(rec, role) {
  const add = (slot, id) => {
    const it = itemById(id);
    if (it) rec.equip[slot] = { ...it, uid: 'r_' + Math.random().toString(36).substr(2, 8) };
  };
  add('body', 'b_tunic');
  add('legs', 'l_sandals');

  // Снаряжение универсальное: наёмник получает простое оружие по своей роли
  if (role === 'ranged') add('weapon', 'w_shortbow');
  else if (role === 'shield') { add('weapon', 'w_rusty'); add('offhand', 'o_buckler'); }
  else add('weapon', Math.random() < 0.5 ? 'w_hatchet' : 'w_rusty');
}

// ==================== СОЗДАНИЕ ГЕРОЯ ====================
function buildHeroFromCreator() {
  const bgMap = [BACKGROUNDS[0], BACKGROUNDS[2], BACKGROUNDS[3], BACKGROUNDS[4]];
  const bgIdx = parseInt(document.getElementById('cr-bg').value, 10) || 0;
  const gender = document.getElementById('cr-gender')?.value || 'male';
  const hero = createGladiator(bgMap[bgIdx], null, gender);

  hero.name = document.getElementById('cr-name').value.trim() || 'Валерий Сильченко';
  hero.gender = gender;
  hero.build = document.getElementById('cr-build')?.value || 'normal';
  hero.skinColor = document.getElementById('cr-skin').value;
  hero.hairColor = document.getElementById('cr-hair-color').value;
  hero.hairStyle = document.getElementById('cr-hair-style').value;
  hero.beardStyle = gender === 'female' ? 'none' : document.getElementById('cr-beard').value;

  const weapon = itemById(document.getElementById('cr-weapon').value);
  if (weapon) hero.equip.weapon = { ...weapon, uid: 'hero_w' };

  if (weapon && (weapon.cat === 'ranged' || weapon.cat === 'crossbow' || weapon.range >= 7)) hero.aiRole = 'ranged';
  else if (document.getElementById('cr-shield').value === 'yes') {
    hero.equip.offhand = { ...itemById('o_buckler'), uid: 'hero_o' };
    hero.aiRole = 'shield';
  } else hero.aiRole = 'melee';

  hero.equip.body = { ...itemById('b_tunic'), uid: 'hero_b' };
  hero.equip.legs = { ...itemById('l_sandals'), uid: 'hero_l' };
  return hero;
}

function updateCreatorPreview() {
  const canvas = document.getElementById('creatorCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#2a2118');
  g.addColorStop(1, '#16110d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const hero = buildHeroFromCreator();
  drawBattleBrother(ctx, hero, canvas.width / 2, canvas.height - 62, 1.22, 1, {});

  ctx.fillStyle = '#e5b54f';
  ctx.font = 'bold 13px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(hero.name.slice(0, 22), canvas.width / 2, 20);

  const female = hero.gender === 'female';
  const beardEl = document.getElementById('cr-beard');
  if (beardEl) beardEl.disabled = female;
}

function randomizeCreator() {
  const gender = Math.random() < 0.5 ? 'male' : 'female';
  document.getElementById('cr-name').value = randomName(gender);
  document.getElementById('cr-gender').value = gender;
  document.getElementById('cr-build').value = pick(['slim', 'normal', 'muscular', 'heavy']);
  document.getElementById('cr-skin').value = pick(SKIN_TONES).color;
  document.getElementById('cr-hair-color').value = pick(HAIR_COLORS).color;
  document.getElementById('cr-hair-style').value = pick(HAIR_STYLES).id;
  document.getElementById('cr-beard').value = gender === 'female' ? 'none' : pick(['none', 'stubble', 'full', 'long', 'moustache', 'goatee']);
  updateCreatorPreview();
}

function confirmCreateHero() {
  const hero = buildHeroFromCreator();
  STATE.roster.push(hero);
  STATE.selectedGladId = hero.id;
  STATE.squad = [hero.id];
  document.getElementById('creator-modal').style.display = 'none';
  sfx('levelup');
  updateUI();
  if (typeof Save !== 'undefined') Save.save();
  goTo('city');
  // Сюжет: короткая завязка один раз за игру
  if (!(STATE.story.seen || []).includes('intro')) {
    STATE.story.seen = STATE.story.seen || [];
    STATE.story.seen.push('intro');
    showStoryModal('intro');
  }
}

// ==================== НАВИГАЦИЯ ====================
function goTo(loc) {
  if (COMBAT.active && loc !== 'combat') {
    alert('Сначала завершите бой на арене!');
    return;
  }
  STATE.currentLocation = loc;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + loc);
  if (el) el.classList.add('active');

  if (loc !== 'city') stopCityAnim();
  if (loc !== 'training') { stopTrainingAnim(); pauseTrainingGame(); }
  if (loc !== 'fishing') stopWorkAnim();
  if (loc === 'city') renderCity();
  if (loc === 'barracks') { renderRoster(); renderGladCard(); renderInventory(); }
  if (loc === 'tavern') renderRecruits();
  if (loc === 'kennel') renderKennel();
  if (loc === 'market') renderMarket();
  if (loc === 'chests') renderChests();
  if (loc === 'temple') renderTemple();
  if (loc === 'training') renderTraining();
  if (loc === 'fishing') renderWork();
  if (loc === 'cosmetics') renderCosmetics();
  if (loc === 'arena') renderArenaScreen();
}

// Обновить текущий экран (после события, лечения, покупки)
function refreshCurrentScreen() {
  const loc = STATE.currentLocation;
  // Награды за цели выдаются при любом обновлении экрана
  claimGoals(false);
  if (loc === 'city') renderCity();
  if (loc === 'barracks') { renderRoster(); renderGladCard(); renderInventory(); }
  if (loc === 'tavern') renderRecruits();
  if (loc === 'kennel') renderKennel();
  if (loc === 'market') renderMarket();
  if (loc === 'chests') renderChests();
  if (loc === 'temple') renderTemple();
  if (loc === 'training') renderTraining();
  if (loc === 'fishing') renderWork();
  if (loc === 'cosmetics') renderCosmetics();
  if (loc === 'arena') renderArenaScreen();
  updateUI();
}

// ==================== ГОРОД ====================
let cityRaf = null;

// Все бойцы отряда: гладиаторы и псы
function findFighter(id) {
  return STATE.roster.find(g => g.id === id) || (STATE.dogs || []).find(d => d.id === id) || null;
}

function renderCity() {
  const grid = document.getElementById('city-buildings');
  if (!grid) return;
  const squadReady = STATE.squad.filter(id => {
    const g = findFighter(id);
    return g && g.hp > 0;
  }).length;

  grid.innerHTML = CITY_LOCATIONS.map(loc => {
    let badge = '';
    if (loc.id === 'arena') badge = `<span class="loc-badge">${squadReady}/${MAX_SQUAD}</span>`;
    if (loc.id === 'tavern') badge = `<span class="loc-badge">${STATE.recruits.length}</span>`;
    if (loc.id === 'kennel') badge = `<span class="loc-badge">${(STATE.dogs || []).length}/${MAX_DOGS}</span>`;
    if (loc.id === 'barracks') badge = `<span class="loc-badge">${STATE.roster.length}</span>`;
    const unspent = STATE.roster.reduce((s, g) => s + (g.unspent || 0), 0);
    if (loc.id === 'barracks' && unspent > 0) badge = `<span class="loc-badge hot">${unspent} очк.</span>`;
    const style = `--bld-accent:${loc.accent};--bld-x:${(loc.x * 100).toFixed(2)}%;--bld-y:${(loc.y * 100).toFixed(2)}%;--bld-size:${loc.size};`;
    return `<button class="building" style="${style}" onclick="goTo('${loc.id}')" title="${loc.desc}">
      <span class="bld-icon">${loc.icon}</span>
      <span class="bld-name">${loc.name}</span>
      <span class="bld-sub">${loc.sub}</span>
      ${badge}
    </button>`;
  }).join('');

  const squadEl = document.getElementById('city-squad');
  if (squadEl) {
    const squad = STATE.squad.map(findFighter).filter(Boolean);
    squadEl.innerHTML = squad.length
      ? squad.map(g => {
          const lost = lostLimbs(g);
          return `<div class="squad-mini ${g.isDog ? 'is-dog' : ''}">
            <span class="squad-role">${g.isDog ? '🐕' : ROLE_ICONS[deriveRole(g)]}</span>
            <span class="squad-name">${g.name}</span>
            <span class="squad-lvl">ур.${g.level}</span>
            <span class="squad-hp">${g.hp}/${g.maxHp}</span>
            ${lost.length ? `<span class="squad-lost" title="Потерянные конечности">✕${lost.length}</span>` : ''}
          </div>`;
        }).join('')
      : `<div class="empty-hint">Отряд не собран. Загляните в казарму.</div>`;
  }

  drawCityBackdrop();
  renderGoals();
}

// Фон главного меню — панорама римского города (canvas).
// Статика кешируется в отдельный canvas, поверх неё каждый кадр рисуются
// гладиаторы отряда: они гуляют по дальней улице, разминаются, отрабатывают удары.
let cityBg = null;
let cityActors = [];
let cityDust = [];

function drawCityBackdrop() {
  const cv = document.getElementById('cityCanvas');
  if (!cv) return;
  const wrap = cv.parentElement;
  const W = wrap.clientWidth || 900;
  const H = wrap.clientHeight || 420;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.floor(W * dpr);
  cv.height = Math.floor(H * dpr);
  cv.style.width = W + 'px';
  cv.style.height = H + 'px';

  // Фон — нарисованный город (city.jpg). Пока картинка не загрузилась,
  // показываем процедурную панораму, чтобы экран не был пустым.
  const bg = document.createElement('canvas');
  bg.width = cv.width;
  bg.height = cv.height;
  const b = bg.getContext('2d');
  b.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCityScene(b, W, H);

  cityBg = { canvas: bg, W, H, dpr, horizon: H * 0.60, photo: null };
  initCityActors(W, H);
  startCityAnim();
  loadCityPhoto(W, H, dpr, bg);
}

// Подгружаем city.jpg и перерисовываем статичный слой с фотографией.
let cityPhotoImg = null;
let cityPhotoLoading = false;

function loadCityPhoto(W, H, dpr, bg) {
  const paint = img => {
    const b = bg.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, bg.width, bg.height);
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Вписываем по принципу cover: без искажений, с обрезкой краёв
    const ir = img.width / img.height;
    const cr = W / H;
    let dw = W, dh = H, dx = 0, dy = 0;
    if (ir > cr) {
      dh = H;
      dw = H * ir;
      dx = (W - dw) / 2;
    } else {
      dw = W;
      dh = W / ir;
      dy = (H - dh) / 2;
    }
    b.drawImage(img, dx, dy, dw, dh);
    // Тёплая дымка и виньетка, чтобы фигурки читались
    const warm = b.createLinearGradient(0, 0, 0, H);
    warm.addColorStop(0, 'rgba(24,14,8,0.22)');
    warm.addColorStop(0.55, 'rgba(24,14,8,0.05)');
    warm.addColorStop(1, 'rgba(18,10,6,0.42)');
    b.fillStyle = warm;
    b.fillRect(0, 0, W, H);
    const vg = b.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.36, W / 2, H * 0.5, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(8,5,3,0.5)');
    b.fillStyle = vg;
    b.fillRect(0, 0, W, H);
    if (cityBg) cityBg.photo = img;
  };

  if (cityPhotoImg) { paint(cityPhotoImg); return; }
  if (cityPhotoLoading) return;
  cityPhotoLoading = true;
  const img = new Image();
  img.onload = () => {
    cityPhotoImg = img;
    cityPhotoLoading = false;
    if (cityBg) paint(img);
  };
  img.onerror = () => { cityPhotoLoading = false; };
  img.src = 'city.jpg';
}

// ==================== ФОН ГОРОДА ====================
// Античный Рим: перспективная улица с колоннадами по сторонам,
// статуи на пьедесталах, фонтан, кипарисы и пинии, Колизей на горизонте.
// Никаких современных домов — только камень, мрамор и зелень.

// Колонна с базой и капителью. Свет падает слева — левый край светлее.
function drawCityColumn(c, x, baseY, h, w) {
  const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, '#d8cfb8');
  g.addColorStop(0.35, '#b9b09a');
  g.addColorStop(0.72, '#8d8571');
  g.addColorStop(1, '#5f594b');
  c.fillStyle = g;
  c.fillRect(x - w / 2, baseY - h, w, h);
  // каннелюры
  c.strokeStyle = 'rgba(60,52,40,0.30)';
  c.lineWidth = Math.max(0.8, w * 0.09);
  for (let i = 1; i < 4; i++) {
    const cx = x - w / 2 + (w / 4) * i;
    c.beginPath(); c.moveTo(cx, baseY - h + h * 0.05); c.lineTo(cx, baseY - h * 0.06); c.stroke();
  }
  // база и капитель
  c.fillStyle = '#cfc6ae';
  c.fillRect(x - w * 0.78, baseY - h * 0.055, w * 1.56, h * 0.055);
  c.fillRect(x - w * 0.85, baseY - h, w * 1.7, h * 0.055);
}

// Статуя на пьедестале: мраморный воин с копьём.
function drawCityStatue(c, x, baseY, h, patina) {
  const pw = h * 0.50;
  // пьедестал
  const pg = c.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0);
  pg.addColorStop(0, '#a49c88');
  pg.addColorStop(1, '#635d50');
  c.fillStyle = pg;
  c.fillRect(x - pw / 2, baseY - h * 0.30, pw, h * 0.30);
  c.fillStyle = 'rgba(255,240,205,0.14)';
  c.fillRect(x - pw / 2, baseY - h * 0.30, pw, Math.max(2, h * 0.012));
  c.fillStyle = '#8e8776';
  c.fillRect(x - pw * 0.60, baseY - h * 0.355, pw * 1.20, h * 0.055);

  const fy = baseY - h * 0.355;
  const skin = patina ? ['#b8c2b0', '#8a9a8a', '#5c6a5c'] : ['#efe6d0', '#c3bba4', '#7d7666'];
  const sg = c.createLinearGradient(x - h * 0.2, fy - h * 0.55, x + h * 0.2, fy);
  sg.addColorStop(0, skin[0]);
  sg.addColorStop(0.5, skin[1]);
  sg.addColorStop(1, skin[2]);
  c.fillStyle = sg;

  // туника / плащ
  c.beginPath();
  c.moveTo(x - h * 0.155, fy);
  c.lineTo(x - h * 0.115, fy - h * 0.34);
  c.quadraticCurveTo(x - h * 0.02, fy - h * 0.46, x + h * 0.10, fy - h * 0.34);
  c.lineTo(x + h * 0.175, fy);
  c.closePath();
  c.fill();

  // голова
  c.beginPath();
  c.arc(x, fy - h * 0.50, h * 0.078, 0, Math.PI * 2);
  c.fill();

  // рука и копьё
  c.strokeStyle = skin[1];
  c.lineWidth = Math.max(1.6, h * 0.026);
  c.beginPath();
  c.moveTo(x + h * 0.12, fy - h * 0.30);
  c.lineTo(x + h * 0.225, fy - h * 0.62);
  c.stroke();
  c.lineWidth = Math.max(1.2, h * 0.016);
  c.beginPath();
  c.moveTo(x + h * 0.225, fy - h * 0.80);
  c.lineTo(x + h * 0.225, fy - h * 0.02);
  c.stroke();
  // щит за спиной
  c.fillStyle = skin[2];
  c.beginPath();
  c.ellipse(x - h * 0.16, fy - h * 0.24, h * 0.10, h * 0.15, -0.25, 0, Math.PI * 2);
  c.fill();
}

// Фонтан: круглая чаша, тумба и водяные струи.
function drawCityFountain(c, x, baseY, w) {
  const h = w * 0.55;
  // чаша
  const bg = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  bg.addColorStop(0, '#cfc6ae');
  bg.addColorStop(0.6, '#a29a86');
  bg.addColorStop(1, '#6b6455');
  c.fillStyle = bg;
  c.beginPath();
  c.ellipse(x, baseY - h * 0.34, w * 0.5, h * 0.22, 0, 0, Math.PI * 2);
  c.fill();
  c.fillRect(x - w * 0.5, baseY - h * 0.34, w, h * 0.30);
  c.beginPath();
  c.ellipse(x, baseY - h * 0.04, w * 0.5, h * 0.13, 0, 0, Math.PI * 2);
  c.fill();
  // вода в чаше
  const wg = c.createRadialGradient(x, baseY - h * 0.36, 2, x, baseY - h * 0.36, w * 0.5);
  wg.addColorStop(0, 'rgba(180,225,235,0.85)');
  wg.addColorStop(1, 'rgba(90,150,175,0.55)');
  c.fillStyle = wg;
  c.beginPath();
  c.ellipse(x, baseY - h * 0.36, w * 0.44, h * 0.17, 0, 0, Math.PI * 2);
  c.fill();
  // тумба
  c.fillStyle = '#b3aa96';
  c.fillRect(x - w * 0.06, baseY - h * 0.95, w * 0.12, h * 0.62);
  c.fillStyle = '#cfc6ae';
  c.beginPath();
  c.ellipse(x, baseY - h * 0.95, w * 0.11, h * 0.05, 0, 0, Math.PI * 2);
  c.fill();
  // струи
  c.strokeStyle = 'rgba(200,235,245,0.55)';
  c.lineWidth = Math.max(1, w * 0.012);
  for (let s = -1; s <= 1; s++) {
    c.beginPath();
    c.moveTo(x, baseY - h * 0.97);
    c.quadraticCurveTo(x + s * w * 0.22, baseY - h * 1.16, x + s * w * 0.40, baseY - h * 0.42);
    c.stroke();
  }
}

// Портик: цоколь, ряд колонн, антаблемент и тень под ним.
function drawCityPortico(c, x, baseY, w, h, cols) {
  const n = cols || Math.max(3, Math.round(w / (h * 0.30)));
  // стена позади колонн
  const bg = c.createLinearGradient(0, baseY - h, 0, baseY);
  bg.addColorStop(0, '#4a3c2c');
  bg.addColorStop(1, '#2b2318');
  c.fillStyle = bg;
  c.fillRect(x, baseY - h * 0.94, w, h * 0.94);
  // колонны
  const cw = h * 0.085;
  for (let i = 0; i < n; i++) {
    const cx = x + (w / n) * (i + 0.5);
    drawCityColumn(c, cx, baseY, h * 0.92, cw);
  }
  // антаблемент
  const eg = c.createLinearGradient(0, baseY - h, 0, baseY - h * 0.80);
  eg.addColorStop(0, '#d9d0b8');
  eg.addColorStop(1, '#8f8774');
  c.fillStyle = eg;
  c.fillRect(x - w * 0.02, baseY - h, w * 1.04, h * 0.14);
  c.fillStyle = 'rgba(0,0,0,0.30)';
  c.fillRect(x - w * 0.02, baseY - h * 0.86, w * 1.04, h * 0.03);
  // цоколь
  c.fillStyle = '#7d7462';
  c.fillRect(x - w * 0.02, baseY - h * 0.05, w * 1.04, h * 0.05);
}

function drawCityScene(c, W, H) {
  const rand = seeded(777);
  const horizon = H * 0.46;

  // ---------- Небо: тёплый закат ----------
  const sky = c.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#2a2038');
  sky.addColorStop(0.34, '#7a423d');
  sky.addColorStop(0.66, '#c8763f');
  sky.addColorStop(1, '#f0cf96');
  c.fillStyle = sky;
  c.fillRect(0, 0, W, horizon + 2);

  const sunX = W * 0.70, sunY = horizon - H * 0.045;
  const sunG = c.createRadialGradient(sunX, sunY, 2, sunX, sunY, H * 0.30);
  sunG.addColorStop(0, 'rgba(255,244,208,0.82)');
  sunG.addColorStop(0.20, 'rgba(255,202,134,0.30)');
  sunG.addColorStop(1, 'rgba(255,170,90,0)');
  c.fillStyle = sunG;
  c.beginPath(); c.arc(sunX, sunY, H * 0.30, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff5d6';
  c.beginPath(); c.arc(sunX, sunY, H * 0.036, 0, Math.PI * 2); c.fill();

  // ---------- Дальние холмы ----------
  const hg = c.createLinearGradient(0, horizon - H * 0.14, 0, horizon);
  hg.addColorStop(0, 'rgba(96,78,80,0.55)');
  hg.addColorStop(1, 'rgba(104,80,68,0.40)');
  c.fillStyle = hg;
  c.beginPath();
  c.moveTo(0, horizon);
  for (let x = 0; x <= W; x += W / 12) c.lineTo(x, horizon - H * (0.030 + rand() * 0.055));
  c.lineTo(W, horizon);
  c.closePath();
  c.fill();

  // ---------- Дальние постройки: храмы и виллы на холмах ----------
  for (let i = 0; i < 8; i++) {
    const bx = W * (0.03 + rand() * 0.94);
    const bw = W * (0.022 + rand() * 0.026);
    const bh = H * (0.035 + rand() * 0.045);
    const by = horizon - H * (0.01 + rand() * 0.045);
    c.fillStyle = `rgba(${132 + rand() * 26 | 0},${112 + rand() * 20 | 0},${86 + rand() * 16 | 0},0.72)`;
    c.fillRect(bx, by - bh, bw, bh);
    // фронтон
    c.beginPath();
    c.moveTo(bx - bw * 0.08, by - bh);
    c.lineTo(bx + bw / 2, by - bh - bh * 0.45);
    c.lineTo(bx + bw * 1.08, by - bh);
    c.closePath();
    c.fill();
  }

  // ---------- Земля: луга и поля ----------
  const ground = c.createLinearGradient(0, horizon, 0, H);
  ground.addColorStop(0, '#9aa465');
  ground.addColorStop(0.22, '#a8a86a');
  ground.addColorStop(0.55, '#b6a87a');
  ground.addColorStop(1, '#8b7a58');
  c.fillStyle = ground;
  c.fillRect(0, horizon, W, H - horizon);

  // Дальняя линия деревьев у горизонта
  for (let i = 0; i < 16; i++) {
    const tx = W * (i / 15) + rand() * W * 0.03;
    const th = H * (0.018 + rand() * 0.022);
    c.fillStyle = `rgba(${58 + rand() * 22 | 0},${74 + rand() * 20 | 0},${46 + rand() * 16 | 0},0.85)`;
    c.beginPath();
    c.ellipse(tx, horizon - th * 0.4, th * 1.5, th, 0, 0, Math.PI * 2);
    c.fill();
  }

  // ---------- Амфитеатр на холме слева ----------
  drawCityArena(c, W * 0.145, horizon + H * 0.085, H * 0.30);

  // ---------- Античная деревня на среднем плане ----------
  // Дома-инсулы, крытые черепицей, сгруппированы у дороги.
  const village = [
    { x: 0.335, y: 0.560, w: 0.062, h: 0.075 },
    { x: 0.415, y: 0.545, w: 0.052, h: 0.062 },
    { x: 0.500, y: 0.570, w: 0.070, h: 0.085 },
    { x: 0.590, y: 0.548, w: 0.056, h: 0.066 },
    { x: 0.672, y: 0.572, w: 0.064, h: 0.078 },
    { x: 0.760, y: 0.552, w: 0.050, h: 0.060 },
    { x: 0.840, y: 0.575, w: 0.058, h: 0.070 }
  ];
  village.forEach(v => {
    drawVillageHouse(c, W * v.x, H * v.y, W * v.w, H * v.h, rand);
  });

  // ---------- Дорога, уходящая вдаль ----------
  c.beginPath();
  c.moveTo(W * 0.42, horizon);
  c.lineTo(W * 0.58, horizon);
  c.lineTo(W * 0.86, H);
  c.lineTo(W * 0.10, H);
  c.closePath();
  c.fillStyle = 'rgba(206,186,150,0.60)';
  c.fill();

  // ---------- Средний план: деревья и кусты ----------
  drawCypress(c, W * 0.255, horizon + H * 0.115, H * 0.20, 0.9);
  drawCypress(c, W * 0.292, horizon + H * 0.100, H * 0.17, 0.8);
  drawCypress(c, W * 0.905, horizon + H * 0.120, H * 0.21, 0.9);
  drawCypress(c, W * 0.945, horizon + H * 0.135, H * 0.18, 0.82);

  for (let i = 0; i < 14; i++) {
    const sx = W * (0.02 + rand() * 0.96);
    const sy = horizon + H * (0.03 + rand() * 0.30);
    drawShrub(c, sx, sy, H * (0.022 + rand() * 0.028), rand, 0.85);
  }

  // пинии на переднем плане по краям
  drawPine(c, W * 0.055, horizon + H * 0.36, H * 0.34, 0.95);
  drawPine(c, W * 0.955, horizon + H * 0.33, H * 0.30, 0.9);

  // ---------- Передний план: трава и цветы ----------
  for (let i = 0; i < 90; i++) {
    const gx = rand() * W;
    const gy = H * (0.78 + rand() * 0.22);
    const gh = H * (0.008 + rand() * 0.016);
    c.strokeStyle = `rgba(${72 + rand() * 40 | 0},${96 + rand() * 40 | 0},${52 + rand() * 26 | 0},0.55)`;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(gx, gy);
    c.lineTo(gx + (rand() - 0.5) * gh * 0.9, gy - gh);
    c.stroke();
  }

  // ---------- Дымка у горизонта ----------
  const haze = c.createLinearGradient(0, horizon - H * 0.12, 0, horizon + H * 0.14);
  haze.addColorStop(0, 'rgba(255,206,158,0)');
  haze.addColorStop(0.55, 'rgba(255,202,152,0.20)');
  haze.addColorStop(1, 'rgba(255,196,144,0)');
  c.fillStyle = haze;
  c.fillRect(0, horizon - H * 0.12, W, H * 0.26);
}

// Античный дом деревни: каменный низ, черепичная крыша, дверь и окна.
// Рисуется «сбоку с небольшим поворотом» — без привязки к сетке города.
function drawVillageHouse(c, x, y, w, h, rand) {
  const bodyH = h * 0.72;
  const wallCol = `rgb(${186 + rand() * 24 | 0},${168 + rand() * 22 | 0},${138 + rand() * 20 | 0})`;
  const wallShade = `rgb(${158 + rand() * 20 | 0},${140 + rand() * 18 | 0},${112 + rand() * 16 | 0})`;

  // тень
  c.fillStyle = 'rgba(40,28,18,0.20)';
  c.beginPath();
  c.ellipse(x + w * 0.10, y + h * 0.03, w * 0.62, h * 0.10, 0, 0, Math.PI * 2);
  c.fill();

  // стена
  c.fillStyle = wallCol;
  c.fillRect(x - w / 2, y - bodyH, w, bodyH);
  // теневая правая часть
  c.fillStyle = wallShade;
  c.fillRect(x + w * 0.16, y - bodyH, w * 0.34, bodyH);

  // каменная кладка
  c.strokeStyle = 'rgba(120,100,76,0.18)';
  c.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const ly = y - bodyH * (i / 4);
    c.beginPath(); c.moveTo(x - w / 2, ly); c.lineTo(x + w / 2, ly); c.stroke();
  }

  // крыша двускатная
  const roofH = h * 0.30;
  c.fillStyle = `rgb(${168 + rand() * 24 | 0},${88 + rand() * 20 | 0},${60 + rand() * 16 | 0})`;
  c.beginPath();
  c.moveTo(x - w * 0.60, y - bodyH);
  c.lineTo(x, y - bodyH - roofH);
  c.lineTo(x + w * 0.60, y - bodyH);
  c.closePath();
  c.fill();
  // черепица
  c.strokeStyle = 'rgba(90,40,26,0.26)';
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    c.beginPath();
    c.moveTo(x - w * 0.60 + w * 0.60 * t, y - bodyH - roofH * t);
    c.lineTo(x + w * 0.60 - w * 0.60 * t, y - bodyH - roofH * t);
    c.stroke();
  }

  // дверь
  c.fillStyle = 'rgba(52,36,22,0.88)';
  const dw = w * 0.20, dh = bodyH * 0.46;
  c.fillRect(x - dw / 2, y - dh, dw, dh);

  // окна
  c.fillStyle = 'rgba(255,196,104,0.72)';
  c.fillRect(x - w * 0.40, y - bodyH * 0.72, w * 0.16, bodyH * 0.18);
  c.fillRect(x + w * 0.24, y - bodyH * 0.68, w * 0.15, bodyH * 0.16);
  c.strokeStyle = 'rgba(60,42,26,0.55)';
  c.lineWidth = 1;
  c.strokeRect(x - w * 0.40, y - bodyH * 0.72, w * 0.16, bodyH * 0.18);
  c.strokeRect(x + w * 0.24, y - bodyH * 0.68, w * 0.15, bodyH * 0.16);
}

// ==================== ПЕРЕДНИЙ ПЛАН ====================
// Поверх бойцов: виньетка и затемнение по краям.
function drawCityFront(c, W, H) {
  const vg = c.createRadialGradient(W / 2, H * 0.50, Math.min(W, H) * 0.34, W / 2, H * 0.50, Math.max(W, H) * 0.82);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(10,6,4,0.58)');
  c.fillStyle = vg;
  c.fillRect(0, 0, W, H);

  const g = c.createLinearGradient(0, H * 0.90, 0, H);
  g.addColorStop(0, 'rgba(16,11,7,0)');
  g.addColorStop(1, 'rgba(16,11,7,0.62)');
  c.fillStyle = g;
  c.fillRect(0, H * 0.90, W, H * 0.10);
}

// ---------- Базовая геометрия ----------
// Четыре угла основания ромба (изометрия 2:1).
function isoCorners(x, y, ax, ay) {
  return {
    L: { x: x - ax, y: y },          // левый
    B: { x: x, y: y + ay },          // передний
    R: { x: x + ax, y: y },          // правый
    D: { x: x, y: y - ay }           // задний
  };
}

// Стена дома: две видимые грани (левая и правая) с цоколем и штукатуркой.
function isoWalls(c, x, y, ax, ay, h, col) {
  const k = isoCorners(x, y, ax, ay);
  const edge = 'rgba(44,30,18,0.42)';

  // левая грань
  c.beginPath();
  c.moveTo(k.L.x, k.L.y - h);
  c.lineTo(k.B.x, k.B.y - h);
  c.lineTo(k.B.x, k.B.y);
  c.lineTo(k.L.x, k.L.y);
  c.closePath();
  c.fillStyle = col.left;
  c.fill();
  c.strokeStyle = edge;
  c.lineWidth = 1.1;
  c.stroke();

  // правая грань
  c.beginPath();
  c.moveTo(k.B.x, k.B.y - h);
  c.lineTo(k.R.x, k.R.y - h);
  c.lineTo(k.R.x, k.R.y);
  c.lineTo(k.B.x, k.B.y);
  c.closePath();
  c.fillStyle = col.right;
  c.fill();
  c.stroke();

  // цоколь — тёмная полоса по низу обеих граней
  if (col.plinth !== false) {
    const ph = h * 0.09;
    c.fillStyle = 'rgba(40,28,18,0.28)';
    c.beginPath();
    c.moveTo(k.L.x, k.L.y - ph);
    c.lineTo(k.B.x, k.B.y - ph);
    c.lineTo(k.B.x, k.B.y);
    c.lineTo(k.L.x, k.L.y);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(k.B.x, k.B.y - ph);
    c.lineTo(k.R.x, k.R.y - ph);
    c.lineTo(k.R.x, k.R.y);
    c.lineTo(k.B.x, k.B.y);
    c.closePath();
    c.fill();
  }
  return k;
}

// Двускатная черепичная крыша с горизонтальным коньком.
// Конёк идёт от середины задней-левой грани к середине передней-правой,
// поэтому видны оба ската и треугольный фронтон на правой стене.
function isoRoof(c, x, y, ax, ay, h, roofH, col) {
  const k = isoCorners(x, y, ax, ay);
  const top = h;
  const edge = 'rgba(48,26,16,0.50)';

  // Конёк: от середины LD к середине BR
  const ridgeStart = { x: x - ax / 2, y: y - ay / 2 - top - roofH };
  const ridgeEnd = { x: x + ax / 2, y: y + ay / 2 - top - roofH };

  // --- Задний скат (обращён к D-R) — в тени ---
  c.beginPath();
  c.moveTo(k.R.x, k.R.y - top);
  c.lineTo(k.D.x, k.D.y - top);
  c.lineTo(ridgeStart.x, ridgeStart.y);
  c.lineTo(ridgeEnd.x, ridgeEnd.y);
  c.closePath();
  c.fillStyle = col.right;
  c.fill();
  c.strokeStyle = edge;
  c.lineWidth = 1.2;
  c.stroke();

  // --- Фронтон на правой грани (B-R) ---
  c.beginPath();
  c.moveTo(k.B.x, k.B.y - top);
  c.lineTo(k.R.x, k.R.y - top);
  c.lineTo(ridgeEnd.x, ridgeEnd.y);
  c.closePath();
  c.fillStyle = col.gable || col.right;
  c.fill();
  c.strokeStyle = edge;
  c.lineWidth = 1.1;
  c.stroke();

  // --- Передний скат (обращён к L-B) — освещён ---
  c.beginPath();
  c.moveTo(k.L.x, k.L.y - top);
  c.lineTo(k.B.x, k.B.y - top);
  c.lineTo(ridgeEnd.x, ridgeEnd.y);
  c.lineTo(ridgeStart.x, ridgeStart.y);
  c.closePath();
  c.fillStyle = col.left;
  c.fill();
  c.strokeStyle = edge;
  c.stroke();

  // --- Черепица: полосы вдоль ската ---
  const tile = col.tile || 'rgba(60,28,18,0.26)';
  c.save();
  c.beginPath();
  c.moveTo(k.L.x, k.L.y - top);
  c.lineTo(k.B.x, k.B.y - top);
  c.lineTo(ridgeEnd.x, ridgeEnd.y);
  c.lineTo(ridgeStart.x, ridgeStart.y);
  c.closePath();
  c.clip();
  c.strokeStyle = tile;
  c.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    const ax0 = k.L.x + (ridgeStart.x - k.L.x) * t;
    const ay0 = (k.L.y - top) + (ridgeStart.y - (k.L.y - top)) * t;
    const bx0 = k.B.x + (ridgeEnd.x - k.B.x) * t;
    const by0 = (k.B.y - top) + (ridgeEnd.y - (k.B.y - top)) * t;
    c.beginPath();
    c.moveTo(ax0, ay0);
    c.lineTo(bx0, by0);
    c.stroke();
  }
  c.restore();

  // --- Конёк ---
  c.strokeStyle = col.ridge || 'rgba(70,34,22,0.85)';
  c.lineWidth = Math.max(2, roofH * 0.18);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(ridgeStart.x, ridgeStart.y);
  c.lineTo(ridgeEnd.x, ridgeEnd.y);
  c.stroke();
  c.lineCap = 'butt';

  return { ridgeStart, ridgeEnd };
}

// Окно на левой грани (грань уходит влево-вверх)
function isoWindowLeft(c, x, y, w, h, glow) {
  c.fillStyle = 'rgba(38,26,16,0.55)';
  c.fillRect(x - w / 2, y - h, w, h);
  if (glow) {
    c.fillStyle = 'rgba(255,198,104,0.85)';
    c.fillRect(x - w / 2 + 1.5, y - h + 1.5, w - 3, h - 3);
  }
  c.strokeStyle = 'rgba(30,20,12,0.75)';
  c.lineWidth = 1.2;
  c.strokeRect(x - w / 2, y - h, w, h);
  c.beginPath();
  c.moveTo(x, y - h);
  c.lineTo(x, y);
  c.stroke();
}

// Дверь-арка на правой грани
function isoDoor(c, x, y, w, h, col) {
  c.beginPath();
  c.moveTo(x - w / 2, y);
  c.lineTo(x - w / 2, y - h * 0.70);
  c.quadraticCurveTo(x, y - h * 1.12, x + w / 2, y - h * 0.70);
  c.lineTo(x + w / 2, y);
  c.closePath();
  c.fillStyle = col || '#3a2614';
  c.fill();
  c.strokeStyle = 'rgba(24,16,10,0.6)';
  c.lineWidth = 1.2;
  c.stroke();
}

// Арочное окно: от основания вверх, со скруглённым верхом
function isoArch(c, x, y, w, h) {
  c.beginPath();
  c.moveTo(x - w / 2, y);
  c.lineTo(x - w / 2, y - h * 0.62);
  c.quadraticCurveTo(x, y - h * 1.18, x + w / 2, y - h * 0.62);
  c.lineTo(x + w / 2, y);
  c.closePath();
}

// Колизей: эллиптический амфитеатр с двумя ярусами арок
function drawCityArena(c, x, y, h) {
  const ax = h * 1.10, ay = ax * 0.34;
  const bodyH = h * 0.78;
  const topY = y - bodyH;

  c.beginPath();
  c.moveTo(x - ax, y);
  c.lineTo(x - ax, topY);
  c.ellipse(x, topY, ax, ay, 0, Math.PI, 0, true);
  c.lineTo(x + ax, y);
  c.ellipse(x, y, ax, ay, 0, 0, Math.PI, false);
  c.closePath();
  const g = c.createLinearGradient(x - ax, 0, x + ax, 0);
  g.addColorStop(0, '#cdb58c');
  g.addColorStop(0.32, '#b9a077');
  g.addColorStop(1, '#806a4a');
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = 'rgba(52,38,22,0.40)';
  c.lineWidth = 1.3;
  c.stroke();

  // арки по передней дуге, в два яруса
  c.save();
  c.beginPath();
  c.moveTo(x - ax, y);
  c.lineTo(x - ax, topY);
  c.ellipse(x, topY, ax, ay, 0, Math.PI, 0, true);
  c.lineTo(x + ax, y);
  c.ellipse(x, y, ax, ay, 0, 0, Math.PI, false);
  c.closePath();
  c.clip();
  for (let row = 0; row < 2; row++) {
    const ry = y - bodyH * (0.20 + row * 0.36);
    const cols = 9;
    for (let i = 0; i < cols; i++) {
      const ang = Math.PI * ((i + 0.5) / cols);
      const px = x - Math.cos(ang) * ax * 0.95;
      const py = ry + Math.sin(ang) * ay * 0.60;
      const sk = 0.5 + Math.sin(ang) * 0.5;
      c.fillStyle = `rgba(44,29,17,${0.34 + sk * 0.34})`;
      isoArch(c, px, py, h * 0.095 * sk, h * 0.15 * sk);
      c.fill();
    }
  }
  // карниз между ярусами
  c.fillStyle = 'rgba(255,236,196,0.13)';
  c.fillRect(x - ax, y - bodyH * 0.53, ax * 2, Math.max(1.6, bodyH * 0.018));
  c.restore();

  // верхний обод
  c.beginPath();
  c.ellipse(x, topY, ax, ay, 0, 0, Math.PI * 2);
  c.fillStyle = '#ccb48b';
  c.fill();
  c.strokeStyle = 'rgba(52,38,22,0.40)';
  c.lineWidth = 1.3;
  c.stroke();
  c.beginPath();
  c.ellipse(x, topY, ax * 0.74, ay * 0.72, 0, 0, Math.PI * 2);
  c.fillStyle = 'rgba(72,52,33,0.60)';
  c.fill();

  c.strokeStyle = 'rgba(255,238,200,0.26)';
  c.lineWidth = 1.8;
  c.beginPath();
  c.ellipse(x, topY, ax * 0.97, ay * 0.97, 0, Math.PI * 1.08, Math.PI * 1.92);
  c.stroke();
}

// Храм: подиум, колонны, антаблемент, фронтон
function drawCityTemple(c, x, y, h) {
  const ax = h * 0.74, ay = ax * 0.40;
  const podH = h * 0.14;

  // подиум
  isoWalls(c, x, y, ax * 1.10, ay * 1.10, podH, {
    left: '#c4bcaa', right: '#a49c8a', plinth: false
  });
  c.beginPath();
  const k = isoCorners(x, y, ax * 1.10, ay * 1.10);
  c.moveTo(k.D.x, k.D.y - podH);
  c.lineTo(k.R.x, k.R.y - podH);
  c.lineTo(k.B.x, k.B.y - podH);
  c.lineTo(k.L.x, k.L.y - podH);
  c.closePath();
  c.fillStyle = '#d8d0bc';
  c.fill();
  c.strokeStyle = 'rgba(60,48,34,0.32)';
  c.lineWidth = 1.1;
  c.stroke();

  const baseY = y - podH;
  const colH = h * 0.46;

  // целла — глухая задняя стена
  c.beginPath();
  c.moveTo(x - ax * 0.74, baseY);
  c.lineTo(x - ax * 0.74, baseY - colH);
  c.lineTo(x + ax * 0.74, baseY - colH);
  c.lineTo(x + ax * 0.74, baseY);
  c.closePath();
  c.fillStyle = 'rgba(88,72,52,0.72)';
  c.fill();

  // колонны по переднему фасаду
  const cols = 5;
  for (let i = 0; i < cols; i++) {
    const t = i / (cols - 1);
    const px = x - ax * 0.72 + t * ax * 1.44;
    const py = baseY + ay * 0.42;
    drawCityColumn(c, px, py, colH, Math.max(3, h * 0.050));
  }

  // антаблемент
  c.fillStyle = '#e0d7c0';
  c.beginPath();
  c.moveTo(x - ax * 0.90, baseY - colH);
  c.lineTo(x - ax * 0.90, baseY - colH - h * 0.06);
  c.lineTo(x + ax * 0.90, baseY - colH - h * 0.06);
  c.lineTo(x + ax * 0.90, baseY - colH);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(60,48,34,0.30)';
  c.lineWidth = 1.1;
  c.stroke();

  // фронтон
  const pedY = baseY - colH - h * 0.06;
  const tg = c.createLinearGradient(0, pedY - h * 0.22, 0, pedY);
  tg.addColorStop(0, '#f1e8d0');
  tg.addColorStop(1, '#b6ac96');
  c.fillStyle = tg;
  c.beginPath();
  c.moveTo(x - ax * 0.92, pedY);
  c.lineTo(x, pedY - h * 0.22);
  c.lineTo(x + ax * 0.92, pedY);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(64,52,38,0.42)';
  c.lineWidth = 1.2;
  c.stroke();
  // тимпан
  c.fillStyle = 'rgba(96,78,56,0.28)';
  c.beginPath();
  c.moveTo(x - ax * 0.62, pedY - h * 0.03);
  c.lineTo(x, pedY - h * 0.155);
  c.lineTo(x + ax * 0.62, pedY - h * 0.03);
  c.closePath();
  c.fill();
}

// Таверна: два этажа, черепица, тёплые окна, вывеска, бочки
function drawCityTavern(c, x, y, h) {
  const ax = h * 0.62, ay = ax * 0.44;
  const bodyH = h * 0.66;
  const k = isoWalls(c, x, y, ax, ay, bodyH, {
    left: '#a8835a', right: '#8a6a46'
  });

  // окна: два этажа
  for (let row = 0; row < 2; row++) {
    const wy = y - bodyH * (0.30 + row * 0.34);
    isoWindowLeft(c, x - ax * 0.62, wy, ax * 0.22, bodyH * 0.17, true);
    isoWindowLeft(c, x - ax * 0.30, wy + ay * 0.20, ax * 0.20, bodyH * 0.15, true);
  }

  // дверь на правой грани
  isoDoor(c, x + ax * 0.40, y - ay * 0.05, ax * 0.24, bodyH * 0.42);

  // крыша
  const roofH = h * 0.26;
  isoRoof(c, x, y, ax * 1.12, ay * 1.12, bodyH, roofH, {
    left: '#c05f3f', right: '#8f422c', gable: '#a8835a',
    tile: 'rgba(58,24,14,0.28)'
  });

  // вывеска на кронштейне (справа)
  const sx = x + ax * 1.02, sy = y - bodyH * 0.74;
  c.strokeStyle = '#3a2a18';
  c.lineWidth = Math.max(1.4, h * 0.012);
  c.beginPath();
  c.moveTo(sx, sy);
  c.lineTo(sx + ax * 0.26, sy);
  c.stroke();
  c.fillStyle = '#d3ab5f';
  c.fillRect(sx + ax * 0.04, sy, ax * 0.20, bodyH * 0.16);
  c.strokeStyle = 'rgba(40,26,14,0.55)';
  c.lineWidth = 1;
  c.strokeRect(sx + ax * 0.04, sy, ax * 0.20, bodyH * 0.16);

  // бочки у входа
  c.fillStyle = '#6b4a2e';
  c.fillRect(x + ax * 0.12, y + ay * 0.26 - bodyH * 0.15, ax * 0.15, bodyH * 0.15);
  c.fillStyle = '#7d5836';
  c.fillRect(x + ax * 0.30, y + ay * 0.42 - bodyH * 0.12, ax * 0.13, bodyH * 0.12);
}

// Казарма (лудус): длинный барак, красная черепица, знамёна
function drawCityBarracks(c, x, y, h) {
  const ax = h * 0.86, ay = ax * 0.34;
  const bodyH = h * 0.50;
  isoWalls(c, x, y, ax, ay, bodyH, {
    left: '#b08a5e', right: '#8f6d47'
  });

  // ряд узких окон-бойниц
  for (let i = 0; i < 3; i++) {
    const t = (i + 0.5) / 3;
    const wy = y - bodyH * 0.62;
    isoWindowLeft(c, x - ax * 0.80 + t * ax * 0.62, wy + ay * 0.18, ax * 0.075, bodyH * 0.20, false);
  }

  // дверь
  isoDoor(c, x + ax * 0.34, y - ay * 0.02, ax * 0.20, bodyH * 0.46);

  // крыша
  isoRoof(c, x, y, ax * 1.10, ay * 1.10, bodyH, h * 0.24, {
    left: '#b25a3c', right: '#83402b', gable: '#b08a5e',
    tile: 'rgba(56,24,14,0.26)'
  });

  // знамёна на шестах над крышей
  const flagY = y - bodyH - h * 0.16;
  c.strokeStyle = '#4a3320';
  c.lineWidth = Math.max(1.4, h * 0.011);
  c.beginPath();
  c.moveTo(x - ax * 0.42, flagY);
  c.lineTo(x - ax * 0.42, flagY - h * 0.20);
  c.moveTo(x + ax * 0.10, flagY - ay * 0.40);
  c.lineTo(x + ax * 0.10, flagY - ay * 0.40 - h * 0.18);
  c.stroke();

  const flag = (fx, fy, dir) => {
    c.fillStyle = '#a83a2c';
    c.beginPath();
    c.moveTo(fx, fy);
    c.lineTo(fx + dir * ax * 0.16, fy + h * 0.035);
    c.lineTo(fx + dir * ax * 0.15, fy + h * 0.135);
    c.lineTo(fx, fy + h * 0.16);
    c.closePath();
    c.fill();
  };
  flag(x - ax * 0.42, flagY - h * 0.20, 1);
  flag(x + ax * 0.10, flagY - ay * 0.40 - h * 0.18, 1);
}

// Кузница: каменный низ, тёмный проём, навес, горн, наковальня, дым
function drawCityForge(c, x, y, h) {
  const ax = h * 0.74, ay = ax * 0.42;
  const bodyH = h * 0.46;

  isoWalls(c, x, y, ax, ay, bodyH, {
    left: '#8b7860', right: '#6f5f4a'
  });

  // тёмный проём мастерской
  c.beginPath();
  c.moveTo(x - ax * 0.62, y - ay * 0.22);
  c.lineTo(x - ax * 0.62, y - bodyH * 0.88);
  c.lineTo(x + ax * 0.30, y - bodyH * 0.88 + ay * 0.36);
  c.lineTo(x + ax * 0.30, y - ay * 0.02);
  c.closePath();
  c.fillStyle = 'rgba(28,19,12,0.78)';
  c.fill();

  // навес над проёмом
  const roofH = h * 0.20;
  isoRoof(c, x, y, ax * 1.06, ay * 1.06, bodyH, roofH, {
    left: '#8f5c3e', right: '#65402a', gable: '#8b7860',
    tile: 'rgba(40,20,12,0.26)'
  });

  // наковальня справа
  c.fillStyle = '#4a4a52';
  c.fillRect(x + ax * 0.30, y - bodyH * 0.34, ax * 0.22, h * 0.040);
  c.fillRect(x + ax * 0.37, y - bodyH * 0.30, ax * 0.09, bodyH * 0.30);

  // горн с огнём — поверх, у левого края
  const fx = x - ax * 0.44, fy = y - bodyH * 0.30;
  c.fillStyle = '#5a4433';
  c.beginPath();
  c.moveTo(fx - ax * 0.16, fy);
  c.lineTo(fx - ax * 0.13, fy - bodyH * 0.30);
  c.lineTo(fx + ax * 0.13, fy - bodyH * 0.30);
  c.lineTo(fx + ax * 0.16, fy);
  c.closePath();
  c.fill();
  const fg = c.createRadialGradient(fx, fy - bodyH * 0.22, 1, fx, fy - bodyH * 0.22, h * 0.20);
  fg.addColorStop(0, 'rgba(255,228,158,0.95)');
  fg.addColorStop(0.40, 'rgba(246,142,56,0.55)');
  fg.addColorStop(1, 'rgba(200,70,30,0)');
  c.fillStyle = fg;
  c.beginPath(); c.arc(fx, fy - bodyH * 0.22, h * 0.20, 0, Math.PI * 2); c.fill();

  // дым
  for (let i = 0; i < 3; i++) {
    c.fillStyle = `rgba(196,186,174,${0.08 + i * 0.025})`;
    c.beginPath();
    c.ellipse(x - ax * (0.20 + i * 0.05), y - bodyH - h * (0.22 + i * 0.17), h * (0.09 + i * 0.035), h * 0.075, 0, 0, Math.PI * 2);
    c.fill();
  }
}

// Псарня: низкий дом, конура-лаз, загон с кольями
function drawCityKennel(c, x, y, h) {
  const ax = h * 0.62, ay = ax * 0.42;
  const bodyH = h * 0.34;
  isoWalls(c, x, y, ax, ay, bodyH, {
    left: '#a89c88', right: '#8a7f6c'
  });

  // конура-лаз на правой грани
  c.beginPath();
  c.moveTo(x + ax * 0.16, y - ay * 0.06);
  c.lineTo(x + ax * 0.16, y - bodyH * 0.46);
  c.quadraticCurveTo(x + ax * 0.40, y - bodyH * 0.72, x + ax * 0.62, y - bodyH * 0.40);
  c.lineTo(x + ax * 0.62, y + ay * 0.08);
  c.closePath();
  c.fillStyle = 'rgba(28,20,14,0.80)';
  c.fill();

  // крыша соломенная
  isoRoof(c, x, y, ax * 1.12, ay * 1.12, bodyH, h * 0.20, {
    left: '#c9b07a', right: '#9a8152', gable: '#a89c88',
    tile: 'rgba(70,52,26,0.24)', ridge: 'rgba(120,96,50,0.85)'
  });

  // загон: колья и перекладина
  c.strokeStyle = '#5a4630';
  c.lineWidth = Math.max(1.4, h * 0.012);
  for (let i = 0; i < 4; i++) {
    const px = x - ax * 0.94 - i * ax * 0.14;
    c.beginPath();
    c.moveTo(px, y + ay * 0.34);
    c.lineTo(px, y + ay * 0.34 - bodyH * 0.66);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(x - ax * 1.36, y + ay * 0.34 - bodyH * 0.46);
  c.lineTo(x - ax * 0.90, y + ay * 0.34 - bodyH * 0.46);
  c.stroke();
}

// Торговец сундуками: прилавок под полосатым навесом, сундуки, фонарь
function drawCityStall(c, x, y, h) {
  const ax = h * 0.64, ay = ax * 0.44;
  const counterH = h * 0.22;
  const postH = h * 0.56;

  // прилавок
  isoWalls(c, x, y, ax * 0.92, ay * 0.92, counterH, {
    left: '#9a7550', right: '#7c5c3c', plinth: false
  });
  const k = isoCorners(x, y, ax * 0.92, ay * 0.92);
  c.beginPath();
  c.moveTo(k.D.x, k.D.y - counterH);
  c.lineTo(k.R.x, k.R.y - counterH);
  c.lineTo(k.B.x, k.B.y - counterH);
  c.lineTo(k.L.x, k.L.y - counterH);
  c.closePath();
  c.fillStyle = '#b08a5e';
  c.fill();
  c.strokeStyle = 'rgba(60,44,26,0.35)';
  c.lineWidth = 1.1;
  c.stroke();

  // столбы
  c.fillStyle = '#6b4a2e';
  c.fillRect(x - ax * 0.86, y - postH, Math.max(3, h * 0.032), postH - counterH * 0.4);
  c.fillRect(x + ax * 0.80, y - postH - ay * 0.48, Math.max(3, h * 0.032), postH - counterH * 0.4);

  // полосатый навес
  const roofY = y - postH;
  c.beginPath();
  c.moveTo(x - ax * 1.02, roofY);
  c.lineTo(x - ax * 0.30, roofY - h * 0.18);
  c.lineTo(x + ax * 0.30, roofY - h * 0.18 - ay * 0.56);
  c.lineTo(x + ax * 1.02, roofY - ay * 0.56);
  c.lineTo(x + ax * 1.02, roofY);
  c.lineTo(x, roofY + ay);
  c.closePath();
  c.fillStyle = '#d8c08a';
  c.fill();
  c.strokeStyle = 'rgba(60,44,26,0.42)';
  c.lineWidth = 1.2;
  c.stroke();
  c.strokeStyle = 'rgba(150,64,42,0.50)';
  c.lineWidth = Math.max(2.5, h * 0.028);
  for (let i = 0; i < 3; i++) {
    const t = (i + 1) / 4;
    c.beginPath();
    c.moveTo(x - ax * 1.02 + ax * 2.04 * t, roofY - ay * 0.56 * t);
    c.lineTo(x - ax * 1.02 + ax * 2.04 * t, roofY - ay * 0.56 * t + ay);
    c.stroke();
  }

  // сундуки на прилавке
  const chestBase = y - counterH;
  [{ xo: -0.34, w: 0.38, wood: '#8a5a30', band: '#c9a45c' },
   { xo: 0.16, w: 0.34, wood: '#6f4a2a', band: '#b08a4a' }].forEach(cfg => {
    const cx = x + ax * cfg.xo, cw = ax * cfg.w, ch = h * 0.11;
    c.fillStyle = cfg.wood;
    c.fillRect(cx - cw / 2, chestBase - ch, cw, ch);
    c.strokeStyle = 'rgba(30,20,12,0.55)';
    c.lineWidth = 1.1;
    c.strokeRect(cx - cw / 2, chestBase - ch, cw, ch);
    c.fillStyle = cfg.band;
    c.fillRect(cx - cw * 0.09, chestBase - ch * 0.62, cw * 0.18, ch * 0.26);
  });

  // фонарь
  c.fillStyle = 'rgba(255,204,116,0.85)';
  c.beginPath();
  c.arc(x + ax * 0.72, roofY + ay * 0.26, h * 0.040, 0, Math.PI * 2);
  c.fill();
}

// Двор тренировок: утоптанная площадка, столб с мишенью, чучело, ограда
function drawCityYard(c, x, y, h, rand) {
  c.beginPath();
  c.ellipse(x, y, h * 0.92, h * 0.38, 0, 0, Math.PI * 2);
  c.fillStyle = 'rgba(190,164,122,0.94)';
  c.fill();
  c.strokeStyle = 'rgba(74,54,34,0.24)';
  c.lineWidth = 1.2;
  c.stroke();
  // утоптанный центр
  c.beginPath();
  c.ellipse(x, y + h * 0.02, h * 0.52, h * 0.20, 0, 0, Math.PI * 2);
  c.fillStyle = 'rgba(166,140,100,0.55)';
  c.fill();

  // столб с мишенью
  c.strokeStyle = '#5a4630';
  c.lineWidth = Math.max(2, h * 0.020);
  c.beginPath();
  c.moveTo(x - h * 0.32, y);
  c.lineTo(x - h * 0.32, y - h * 0.46);
  c.stroke();
  c.fillStyle = '#c9a45c';
  c.beginPath(); c.arc(x - h * 0.32, y - h * 0.50, h * 0.10, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(60,40,20,0.5)';
  c.lineWidth = 1;
  c.stroke();
  c.fillStyle = '#a83a2c';
  c.beginPath(); c.arc(x - h * 0.32, y - h * 0.50, h * 0.050, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#e8d8b0';
  c.beginPath(); c.arc(x - h * 0.32, y - h * 0.50, h * 0.018, 0, Math.PI * 2); c.fill();

  // чучело
  c.strokeStyle = '#6b4a2e';
  c.lineWidth = Math.max(2, h * 0.018);
  c.beginPath();
  c.moveTo(x + h * 0.20, y);
  c.lineTo(x + h * 0.20, y - h * 0.40);
  c.moveTo(x + h * 0.05, y - h * 0.30);
  c.lineTo(x + h * 0.35, y - h * 0.30);
  c.stroke();
  c.fillStyle = '#8a7a5a';
  c.beginPath(); c.arc(x + h * 0.20, y - h * 0.45, h * 0.055, 0, Math.PI * 2); c.fill();

  // ограда из кольев
  c.strokeStyle = '#4e3c29';
  c.lineWidth = Math.max(1.3, h * 0.011);
  for (let i = 0; i < 4; i++) {
    const px = x - h * 0.82 + i * h * 0.14;
    c.beginPath();
    c.moveTo(px, y + h * 0.20);
    c.lineTo(px, y + h * 0.20 - h * 0.18);
    c.stroke();
  }
}

// ---------- Живой фон: отряд гуляет по улице ----------
let cityRafId = null;
let cityLastTs = 0;
let cityFountain = null;

// Отряд живёт на фоне: кто-то гуляет по улице, кто-то тренируется
// на площадке с мишенями справа внизу.
// Зоны заданы в долях от размера холста.
const CITY_ZONES = {
  // Улица: мостовая от нижнего края к центру площади
  street: { x0: 0.30, x1: 0.60, y0: 0.90, y1: 0.66, scale0: 0.135, scale1: 0.080 },
  // Тренировочная площадка с мишенями — правый нижний угол
  yard: { x0: 0.66, x1: 0.93, y0: 0.90, y1: 0.74, scale0: 0.120, scale1: 0.075 }
};

// Отряд живёт на фоне: кто-то гуляет по мостовой, кто-то поднимается
// по ступеням храма, кто-то тренируется на площадке с мишенями.
// Маршруты — ломаные в долях от размера холста, чтобы бойцы
// не заходили на крыши и стены домов.
const CITY_PATHS = {
  // Мостовая: широкая полоса от рынка до арены, три боковые дорожки
  street: [
    [0.250, 0.985], [0.290, 0.920], [0.330, 0.855],
    [0.380, 0.790], [0.430, 0.730], [0.470, 0.670]
  ],
  // Ступени храма: от площадки до верха лестницы
  stairs: [
    [0.180, 0.590], [0.200, 0.560], [0.230, 0.530],
    [0.260, 0.500], [0.285, 0.470], [0.310, 0.448]
  ],
  // Тренировочная площадка — широкая зона у мишеней
  yard: [
    [0.580, 0.950], [0.640, 0.920], [0.710, 0.898],
    [0.780, 0.882], [0.840, 0.872], [0.890, 0.868]
  ]
};

function cityPathPoint(path, t) {
  // t: 0..1 вдоль всей ломаной с учётом длины сегментов
  const pts = path;
  const lens = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = (pts[i][1] - pts[i - 1][1]) * 0.6; // вертикаль короче по экрану
    const l = Math.hypot(dx, dy);
    lens.push(l);
    total += l;
  }
  let want = clamp01(t) * total;
  for (let i = 0; i < lens.length; i++) {
    if (want <= lens[i] || i === lens.length - 1) {
      const k = lens[i] > 0 ? want / lens[i] : 0;
      return {
        x: lerp(pts[i][0], pts[i + 1][0], k),
        y: lerp(pts[i][1], pts[i + 1][1], k)
      };
    }
    want -= lens[i];
  }
  return { x: pts[0][0], y: pts[0][1] };
}

// Масштаб фигуры по глубине: чем ниже на экране — тем крупнее
function cityScaleAt(y) {
  const t = clamp01((y - 0.62) / (0.96 - 0.62));
  return 0.050 + t * 0.055;
}

function initCityActors(W, H) {
  const squad = STATE.squad
    .map(findFighter)
    .filter(g => g && g.hp > 0)
    .slice(0, MAX_SQUAD);

  cityDust = [];
  cityActors = squad.map((g, i) => {
    // Чередуем маршруты: улица, ступени, площадка
    const routeName = g.isDog ? 'yard'
      : (i % 3 === 0 ? 'street' : i % 3 === 1 ? 'stairs' : 'yard');
    const path = CITY_PATHS[routeName];
    const startT = 0.15 + (i * 0.27) % 0.7;
    const pt = cityPathPoint(path, startT);
    const yard = routeName === 'yard';
    // Боковое смещение: каждый боец идёт по своей «полосе»,
    // чтобы не наслаивались друг на друга. Смещение по X в долях экрана.
    const laneOffset = (i % 3 - 1) * 0.045;
    return {
      glad: g,
      route: routeName,
      path,
      pathT: startT,
      dir: i % 2 ? -1 : 1,
      x: W * pt.x + laneOffset * W,
      y: H * pt.y,
      scale: H * cityScaleAt(pt.y) / 148,
      speed: yard ? 0.035 : 0.055,
      state: yard ? 'spar' : 'walk',
      timer: 1.4 + i * 1.5,
      walkPhase: i * 2.1,
      walk: yard ? 0 : 1,
      swing: 0,
      victory: 0,
      swingPhase: Math.random() * 6,
      dustT: 0,
      depth: 0,
      laneOffset
    };
  });
}

function pickCityAction(a) {
  const r = Math.random();
  if (a.route === 'yard') {
    // На площадке: тренировка с паузами, изредка короткая прогулка
    if (r < 0.66) {
      a.state = 'spar';
      a.timer = 1.6 + Math.random() * 2.0;
      a.swingPhase = 0;
    } else if (r < 0.86) {
      a.state = 'idle';
      a.timer = 1.0 + Math.random() * 1.4;
    } else {
      a.state = 'walk';
      a.timer = 1.6 + Math.random() * 1.4;
    }
    return;
  }
  if (r < 0.68) {
    a.state = 'walk';
    a.timer = 2.5 + Math.random() * 3.5;
  } else if (r < 0.84) {
    a.state = 'idle';
    a.timer = 1.2 + Math.random() * 1.6;
  } else {
    a.state = 'spar';
    a.timer = 1.2 + Math.random() * 1.4;
    a.swingPhase = 0;
  }
}

function updateCityActors(dt, W, H) {
  cityActors.forEach(a => {
    a.timer -= dt;

    if (a.state === 'walk') {
      a.walkPhase += dt * 8.5;
      a.walk = Math.min(1, a.walk + dt * 4);

      // Движение строго по маршруту: туда-обратно вдоль ломаной
      a.pathT += a.speed * a.dir * dt;
      if (a.pathT >= 1) { a.pathT = 1; a.dir = -1; }
      if (a.pathT <= 0) { a.pathT = 0; a.dir = 1; }

      const pt = cityPathPoint(a.path, a.pathT);
      // Применяем боковое смещение: каждый боец идёт по своей полосе,
      // чтобы отряд не превращался в «паровозик» из наложенных фигур.
      const nx = W * pt.x + (a.laneOffset || 0) * W, ny = H * pt.y;
      // Направление взгляда — по горизонтальному смещению
      if (Math.abs(nx - a.x) > 0.4) a.faceDir = nx > a.x ? 1 : -1;
      a.x = nx;
      a.y = ny;
      a.scale = H * cityScaleAt(pt.y) / 148;
      a.depth = clamp01((pt.y - 0.62) / 0.34);

      a.dustT -= dt;
      if (a.dustT <= 0) {
        a.dustT = 0.26;
        cityDust.push({ x: a.x, y: a.y, r: 2.5 + a.scale * 5, life: 0.85, max: 0.85 });
      }
    } else {
      a.walk = Math.max(0, a.walk - dt * 5);
    }

    if (a.state === 'spar') {
      a.swingPhase += dt * 3.2;
      a.swing = Math.max(0, Math.sin(a.swingPhase));
      if (Math.random() < dt * 1.1) a.dir = -a.dir;
    } else {
      a.swing = Math.max(0, a.swing - dt * 6);
    }

    if (a.state === 'cheer') a.victory = Math.min(1, a.victory + dt * 2.4);
    else a.victory = Math.max(0, a.victory - dt * 2.4);

    if (a.timer <= 0) pickCityAction(a);
  });

  cityDust.forEach(d => { d.life -= dt; d.y -= dt * 3; });
  cityDust = cityDust.filter(d => d.life > 0);
}

function renderCityFrame(dt) {
  const cv = document.getElementById('cityCanvas');
  if (!cv || !cityBg) return;
  const { canvas, W, H, dpr } = cityBg;
  const c = cv.getContext('2d');

  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  c.drawImage(canvas, 0, 0);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  updateCityActors(dt, W, H);

  // Пыль из-под ног
  cityDust.forEach(d => {
    const k = d.life / d.max;
    c.globalAlpha = 0.22 * k;
    c.fillStyle = '#d8c3a0';
    c.beginPath();
    c.ellipse(d.x, d.y, d.r * (1.6 - k), d.r * 0.55, 0, 0, Math.PI * 2);
    c.fill();
  });
  c.globalAlpha = 1;

  // Бойцы отряда — на своих маршрутах (улица, ступени, площадка)
  cityActors.forEach(a => {
    c.save();
    c.globalAlpha = 0.96 - a.depth * 0.16;
    drawBattleBrother(c, a.glad, a.x, a.y, a.scale, a.faceDir || a.dir || 1, {
      walk: a.walk,
      walkPhase: a.walkPhase,
      swing: a.swing,
      victory: a.victory,
      glow: a.state === 'cheer' ? 0.5 : 0,
      emotion: a.state === 'spar' ? 'angry' : a.state === 'cheer' ? 'happy' : 'idle'
    });
    c.restore();
  });
}

function startCityAnim() {
  if (cityRafId) return;
  cityLastTs = 0;
  const step = ts => {
    if (STATE.currentLocation !== 'city' || !cityBg) { cityRafId = null; return; }
    const dt = cityLastTs ? Math.min((ts - cityLastTs) / 1000, 0.05) : 0.016;
    cityLastTs = ts;
    renderCityFrame(dt);
    cityRafId = requestAnimationFrame(step);
  };
  cityRafId = requestAnimationFrame(step);
}

function stopCityAnim() {
  if (cityRafId) cancelAnimationFrame(cityRafId);
  cityRafId = null;
  cityLastTs = 0;
}


// ==================== КАЗАРМА ====================
function getSelectedGlad() {
  return STATE.roster.find(g => g.id === STATE.selectedGladId) || STATE.roster[0] || null;
}

function calcGladStats(glad) {
  const eq = glad.equip;
  const attrs = glad.attrs || { str: 5, dex: 5, vit: 5, sta: 5, wil: 5 };
  const armorHead = eq.head ? eq.head.armor : 0;
  const armorBody = (eq.body ? eq.body.armor : 0) + (eq.arms ? eq.arms.armor : 0) + (eq.legs ? eq.legs.armor : 0);
  // В левой руке щит или второй клинок: защиту даёт только щит
  const off = eq.offhand || null;
  const shieldDef = off && off.slot === 'offhand' ? (off.defBonus || 0) : 0;
  const def = glad.def + shieldDef + Math.round(attrs.wil * 0.5);
  const weapon = eq.weapon || { name: 'Кулаки', dmgMin: 4, dmgMax: 8, range: 1, apCost: 3, shape: 'fist' };
  const offWeapon = off && off.slot === 'weapon' ? off : null;
  return { armorHead, armorBody, def, weapon, offWeapon, attrs };
}

function renderRoster() {
  const el = document.getElementById('br-who');
  if (!el) return;
  const g = getSelectedGlad();
  const idx = STATE.roster.findIndex(x => x.id === (g && g.id));
  const lost = g ? lostLimbs(g).length : 0;
  el.innerHTML = g
    ? `<span class="bw-name">${g.name}</span>
       <span class="bw-sub">${idx + 1} / ${STATE.roster.length} • ур. ${g.level}${lost ? ` • ✕${lost}` : ''}${STATE.squad.includes(g.id) ? ' • в отряде' : ''}</span>`
    : `<span class="bw-name">Казарма пуста</span>`;
  renderAvatarStrip();
}

// Полоса аватарок компаньонов в казарме.
// Каждая карточка — мини-портрет бойца, его имя, уровень и отметка отряда.
// Клик по карточке выбирает бойца; количество бойцов подписано в заголовке.
function renderAvatarStrip() {
  const box = document.getElementById('br-avatars');
  if (!box) return;
  if (!STATE.roster.length) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  box.style.display = 'flex';
  const selId = (getSelectedGlad() || {}).id;
  box.innerHTML = `
    <div class="br-avatars-head">Товарищи <b>${STATE.roster.length}</b></div>
    ${STATE.roster.map(g => {
      const inSquad = STATE.squad.includes(g.id);
      const lost = lostLimbs(g).length;
      const hurt = g.hp <= 0;
      return `<div class="br-avatar-card ${g.id === selId ? 'selected' : ''} ${hurt ? 'hurt' : ''}"
        onclick="selectGlad('${g.id}')"
        title="${g.name} • ур. ${g.level}${inSquad ? ' • в отряде' : ''}${lost ? ` • ✕${lost}` : ''}">
        <canvas class="br-avatar-portrait" width="28" height="34" data-av-id="${g.id}"></canvas>
        <div class="br-avatar-info">
          <span class="br-avatar-name">${g.name}</span>
          <span class="br-avatar-meta">
            <span class="br-avatar-level">ур.${g.level}</span>
            ${inSquad ? '<span class="br-avatar-squad">✓</span>' : ''}
            ${lost ? `<span class="br-avatar-count">✕${lost}</span>` : ''}
          </span>
        </div>
      </div>`;
    }).join('')}
  `;
  // Рисуем мини-портреты
  box.querySelectorAll('canvas.br-avatar-portrait').forEach(cv => {
    const g = STATE.roster.find(x => x.id === cv.dataset.avId);
    if (!g) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    drawGladCentered(ctx, g, cv.width, cv.height, 10);
  });
}

// Листание бойцов стрелками над портретом
function cycleGlad(dir) {
  if (!STATE.roster.length) return;
  const i = STATE.roster.findIndex(g => g.id === STATE.selectedGladId);
  const next = ((i < 0 ? 0 : i) + dir + STATE.roster.length) % STATE.roster.length;
  STATE.selectedGladId = STATE.roster[next].id;
  sfx('click');
  renderRoster();
  renderGladCard();
  renderInventory();
}

function renderGladCard() {
  const wrap = document.getElementById('glad-card');
  if (!wrap) return;
  const g = getSelectedGlad();
  const bust = document.getElementById('bustCanvas');
  if (!g) {
    wrap.innerHTML = `<div class="empty-hint">В казарме пусто. Наймите бойцов в таверне.</div>`;
    if (bust) bust.style.display = 'none';
    renderDoll(null);
    return;
  }
  if (bust) bust.style.display = 'block';

  const st = calcGladStats(g);
  const role = deriveRole(g);
  const inSquad = STATE.squad.includes(g.id);
  const need = xpToNext(g.level);
  const xpPct = Math.min(100, (g.xp / need) * 100);
  const fights = battlesToNextLevel(g);

  wrap.innerHTML = `
    <div class="br-name-row">
      <span class="br-name">${g.name}</span>
      <span class="br-role">${ROLE_ICONS[role]}</span>
    </div>
    <div class="br-sub">${g.bgTitle} • ур. ${g.level} • ${ROLE_LABELS[role]}</div>
    ${g.className ? `<div class="card-class">${(classById(g.cls) || {}).icon || '🎖️'} ${g.className}</div>` : ''}
    ${g.clsPerk ? `<div class="card-class-perk">${g.clsPerk}</div>` : ''}
    ${g.perk ? `<div class="card-perk">✨ ${g.perk}</div>` : ''}
    ${(g.skills || []).length ? `<div class="card-skills">${g.skills.map(id => {
      const s = skillById(id);
      return s ? `<span class="skill-tag" title="${s.desc}">${s.icon} ${s.name}</span>` : '';
    }).join('')}</div>` : ''}

    ${(g.skillPicks || 0) > 0 ? `<div class="unspent-banner skill" onclick="openSkillPicker('${g.id}')">
      🌟 Доступен выбор навыка (${g.skillPicks}) — открыть
    </div>` : ''}

    <div class="xp-block">
      <div class="xp-head">
        <span>Опыт ${g.xp} / ${need}</span>
        <span class="xp-fights">≈ ${fights} ${fights === 1 ? 'бой' : fights < 5 ? 'боя' : 'боёв'}</span>
      </div>
      <div class="xp-bar big"><i style="width:${xpPct}%"></i></div>
    </div>

    ${g.unspent > 0 ? `<div class="unspent-banner" onclick="openLevelUp('${g.id}')">
      🎉 ${g.unspent} очк. характеристик — распределить
    </div>` : ''}

    <div class="br-stats">
      <div class="stat"><span>❤️ Здоровье</span><b>${g.hp}/${g.maxHp}</b></div>
      <div class="stat"><span>🛡️ Защита</span><b>${st.def}</b></div>
      <div class="stat"><span>🗡️ Урон</span><b>${st.weapon.dmgMin}–${st.weapon.dmgMax}</b></div>
      <div class="stat"><span>📏 Дистанция</span><b>${st.weapon.range}</b></div>
      <div class="stat"><span>🪖 Голова</span><b>${st.armorHead}</b></div>
      <div class="stat"><span>🦺 Тело</span><b>${st.armorBody}</b></div>
    </div>

    <div class="attr-list">
      ${ATTRS.map(a => {
        const val = (g.attrs && g.attrs[a.key]) || 5;
        return `<div class="attr-row" title="${a.desc}">
          <span class="attr-ico">${a.icon}</span>
          <span class="attr-name">${a.name}</span>
          <span class="attr-val">${val}</span>
          ${g.unspent > 0 ? `<button class="attr-plus" onclick="spendPoint('${g.id}','${a.key}')">+</button>` : ''}
        </div>`;
      }).join('')}
    </div>

    <div class="limb-block">
      <div class="limb-head">Конечности</div>
      <div class="limb-grid">
        ${LIMB_DEFS.map(l => {
          const s = g.limbs[l.id];
          if (!s) return '';
          const pct = s.lost ? 0 : Math.round((s.hp / s.max) * 100);
          const cls = s.lost ? 'lost' : pct < 30 ? 'low' : pct < 65 ? 'mid' : 'ok';
          return `<div class="limb-cell ${cls}" title="${l.name}">
            <span class="lc-ico">${l.icon}</span>
            <span class="lc-name">${l.short}</span>
            <span class="lc-val">${s.lost ? 'потеряна' : pct + '%'}</span>
            <i style="width:${pct}%"></i>
          </div>`;
        }).join('')}
      </div>
      ${lostLimbs(g).length ? `<div class="limb-warn">✕ Утраченные конечности не восстанавливаются.</div>` : ''}
    </div>

    <div class="card-actions">
      <button class="wide-btn ${inSquad ? 'on' : ''}" onclick="toggleSquad('${g.id}')">
        ${inSquad ? '✓ В отряде' : '+ В отряд'}
      </button>
    </div>
  `;

  renderDoll(g);

  if (bust) {
    const ctx = bust.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, 0, bust.height);
    bg.addColorStop(0, '#2c2219');
    bg.addColorStop(1, '#171210');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, bust.width, bust.height);
    drawGladCentered(ctx, g, bust.width, bust.height, 1.9);
  }
}

// ==================== МАНЕКЕН С ЯЧЕЙКАМИ ====================
function renderDoll(g) {
  const slots = ['weapon', 'offhand', 'head', 'body', 'arms', 'legs'];
  slots.forEach(slot => {
    const el = document.getElementById('slot-' + slot);
    if (!el) return;
    const it = g && g.equip ? g.equip[slot] : null;
    if (it) {
      el.innerHTML = `<span class="ds-name">${it.name}</span>`;
      el.classList.add('filled');
      el.classList.remove('empty');
      // Добавляем data-uid для тултипов
      el.dataset.uid = it.uid;
      el.dataset.slot = slot;
    } else {
      el.innerHTML = `<span class="ds-name">—</span>`;
      el.classList.remove('filled');
      el.classList.add('empty');
      delete el.dataset.uid;
      el.dataset.slot = slot;
    }
  });
  // Привязываем подсказки к манекену
  bindSlotTips(g);
}

// ==================== СЕЛЕКТОР СНАРЯЖЕНИЯ ====================
// Клик по ячейке конечности (пустой или занятой) открывает всплывающий
// селектор со всем подходящим снаряжением из инвентаря.
let SLOT_PICKER = { open: false, slot: null };

function openSlotPicker(slot) {
  const glad = getSelectedGlad();
  if (!glad) return;
  hideSlotTip();
  SLOT_PICKER.open = true;
  SLOT_PICKER.slot = slot;

  // Собираем подходящие предметы из инвентаря
  const items = STATE.inventory.filter(it => {
    if (slot === 'offhand') return it.slot === 'offhand' || it.slot === 'weapon';
    if (slot === 'weapon') return it.slot === 'weapon' && !it.offhandOnly;
    return it.slot === slot;
  });

  const cur = glad.equip[slot];
  const slotName = SLOT_NAMES[slot] || slot;

  let listHtml;
  if (!items.length && !cur) {
    listHtml = `<div class="sp-empty">Нет подходящих предметов.<br>Купите снаряжение в кузнице.</div>`;
  } else {
    listHtml = items.sort((a, b) => (b.tier || 0) - (a.tier || 0)).map(it => {
      const check = canEquipItem(glad, it);
      const t = TIER_INFO[it.tier] || TIER_INFO[1];
      return `<div class="sp-item ${check.ok ? '' : 'locked'}"
        onclick="equipFromPicker('${it.uid}')">
        <div class="spi-icon">${itemIconCanvas(it, 36)}</div>
        <div class="spi-body">
          <div class="spi-top">
            <span class="spi-name">${it.name}</span>
            <span class="tier-badge" style="color:${t.color};border-color:${t.color}">${t.stars}</span>
          </div>
          <div class="spi-stat">${itemStatLine(it)}</div>
          ${!check.ok ? `<div class="spi-req req-bad">не хватает характеристик</div>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  const unequipBtn = cur
    ? `<button class="sp-unequip" onclick="unequipFromPicker()">✕ Снять «${cur.name}»</button>`
    : '';

  const picker = document.getElementById('slot-picker');
  if (!picker) return;
  picker.innerHTML = `
    <div class="sp-head">
      <span class="sp-title">${slotName}</span>
      <button class="sp-close" onclick="closeSlotPicker()">✕</button>
    </div>
    ${unequipBtn}
    <div class="sp-list">${listHtml}</div>
  `;
  picker.style.display = 'block';
  paintItemCanvases(picker);
}

function closeSlotPicker() {
  SLOT_PICKER.open = false;
  SLOT_PICKER.slot = null;
  const picker = document.getElementById('slot-picker');
  if (picker) picker.style.display = 'none';
}

function equipFromPicker(uid) {
  const slot = SLOT_PICKER.slot;
  if (!slot) return;
  closeSlotPicker();
  equipItemToSlot(uid, slot);
}

function unequipFromPicker() {
  const slot = SLOT_PICKER.slot;
  if (!slot) return;
  closeSlotPicker();
  unequipItem(slot);
}

// Закрытие селектора по клику вне него
document.addEventListener('click', ev => {
  if (!SLOT_PICKER.open) return;
  const picker = document.getElementById('slot-picker');
  if (picker && picker.contains(ev.target)) return;
  if (ev.target.closest('.doll-slot')) return;
  closeSlotPicker();
});

// ---------- Тултипы для экипированного снаряжения ----------
let _slotTipsRoot = null;

function bindSlotTips(g) {
  // Ищем манекен (контейнер .doll)
  const doll = document.querySelector('.doll');
  if (!doll) return;
  if (_slotTipsRoot === doll) return; // уже привязаны
  _slotTipsRoot = doll;

  doll.querySelectorAll('.doll-slot').forEach(slotEl => {
    slotEl.addEventListener('mouseenter', ev => {
      const uid = slotEl.dataset.uid;
      if (!uid) return;
      const item = (g && g.equip) ? g.equip[slotEl.dataset.slot] : null;
      if (!item) return;
      showSlotTip(ev, item);
    });
    slotEl.addEventListener('mousemove', ev => {
      const uid = slotEl.dataset.uid;
      if (!uid) return;
      placeSlotTip(ev);
    });
    slotEl.addEventListener('mouseleave', () => {
      hideSlotTip();
    });
    // Клик по ячейке (пустой или занятой) открывает селектор снаряжения
    slotEl.addEventListener('click', () => {
      const slot = slotEl.dataset.slot;
      if (!slot) return;
      if (SLOT_PICKER.open && SLOT_PICKER.slot === slot) { closeSlotPicker(); return; }
      openSlotPicker(slot);
    });
  });
}

function showSlotTip(ev, item) {
  const el = ensureSlotTip();
  el.innerHTML = itemTooltipHTML(item, getSelectedGlad());
  el.classList.add('show');
  placeSlotTip(ev);
}

function placeSlotTip(ev) {
  const el = document.getElementById('slot-tip');
  if (!el) return;
  const pad = 14;
  const w = el.offsetWidth || 260;
  const h = el.offsetHeight || 180;
  let x = ev.clientX + pad;
  let y = ev.clientY + pad;
  if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
  if (y + h > window.innerHeight - 8) y = Math.max(8, ev.clientY - h - pad);
  el.style.left = Math.max(8, x) + 'px';
  el.style.top = Math.max(8, y) + 'px';
}

function hideSlotTip() {
  const el = document.getElementById('slot-tip');
  if (el) el.classList.remove('show');
}

function ensureSlotTip() {
  let el = document.getElementById('slot-tip');
  if (el && document.body.contains(el)) return el;
  if (el && !document.body.contains(el)) {
    el.id = 'slot-tip';
    el.className = 'slot-tip';
    document.body.appendChild(el);
    return el;
  }
  el = document.createElement('div');
  el.id = 'slot-tip';
  el.className = 'slot-tip';
  document.body.appendChild(el);
  return el;
}

// Drag & drop
function allowDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drop-hover');
}
function leaveSlot(e) {
  e.currentTarget.classList.remove('drop-hover');
}

function startDragItem(e, uid) {
  e.dataTransfer.setData('text/plain', uid);
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
}

function dropOnSlot(e, slot) {
  e.preventDefault();
  e.currentTarget.classList.remove('drop-hover');
  const uid = e.dataTransfer.getData('text/plain');
  if (!uid) return;
  equipItemToSlot(uid, slot);
}

// Надеть предмет в конкретную ячейку
function equipItemToSlot(uid, slot) {
  const glad = getSelectedGlad();
  const idx = STATE.inventory.findIndex(i => i.uid === uid);
  if (idx === -1 || !glad) return;
  const item = STATE.inventory[idx];

  // В левую руку можно положить щит или второй клинок
  const slotOk = slot === 'offhand'
    ? (item.slot === 'offhand' || item.slot === 'weapon')
    : item.slot === slot;
  if (!slotOk) {
    sfx('error');
    addToast(`«${item.name}» не подходит в ячейку «${SLOT_NAMES[slot]}»`);
    return;
  }
  // Клинок димахера — только в левую руку
  if (slot === 'weapon' && item.offhandOnly) {
    sfx('error');
    addToast(`«${item.name}» — второй клинок, он идёт в левую руку.`);
    return;
  }

  const check = canEquipItem(glad, item);
  if (!check.ok) {
    const txt = check.missing.map(m => {
      const a = ATTRS.find(x => x.key === m.key);
      return `${a ? a.name : m.key} ${m.have}/${m.need}`;
    }).join(', ');
    sfx('error');
    addToast(`Не хватает характеристик: ${txt}`);
    return;
  }

  if (slot === 'offhand' && item.slot === 'weapon' && !canOffhandWeapon(glad, item)) {
    sfx('error');
    addToast('Это оружие занимает обе руки — во вторую руку его не взять.');
    return;
  }

  // Двуручное и парное оружие освобождает левую руку
  if (slot === 'weapon' && item.bothHands && glad.equip.offhand) {
    STATE.inventory.push(glad.equip.offhand);
    glad.equip.offhand = null;
  }
  // Вторая рука занята двуручным — сначала убираем его
  if (slot === 'offhand' && glad.equip.weapon && glad.equip.weapon.bothHands) {
    STATE.inventory.push(glad.equip.weapon);
    glad.equip.weapon = null;
  }

  if (glad.equip[slot]) STATE.inventory.push(glad.equip[slot]);
  glad.equip[slot] = item;
  STATE.inventory.splice(idx, 1);
  glad.aiRole = null;

  sfx('click');
  renderRoster();
  renderGladCard();
  renderInventory();
}

function selectGlad(id) {
  STATE.selectedGladId = id;
  renderRoster();
  renderGladCard();
  renderInventory();
}

function toggleSquad(id) {
  const g = findFighter(id);
  if (!g) return;
  if (g.hp <= 0) return alert('Раненый боец не может выйти на арену. Вылечите его в храме.');
  const i = STATE.squad.indexOf(id);
  if (i >= 0) STATE.squad.splice(i, 1);
  else {
    if (isTraining(id)) return addToast(`${g.name} сейчас на тренировке — дождитесь окончания.`);
    if (STATE.squad.length >= MAX_SQUAD) return alert(`В отряде максимум ${MAX_SQUAD} бойца.`);
    STATE.squad.push(id);
  }
  renderRoster();
  renderGladCard();
  refreshCurrentScreen();
}

// ==================== ПРОКАЧКА ====================
function spendPoint(gladId, key) {
  const g = STATE.roster.find(x => x.id === gladId);
  if (!g || !g.unspent) return;
  g.unspent--;
  g.attrs[key] = (g.attrs[key] || 5) + 1;

  if (key === 'vit') { g.maxHp += 6; g.hp += 6; }
  if (key === 'str') g.atk += 2;
  if (key === 'wil') g.def += 1;

  renderRoster();
  renderGladCard();
  updateUI();
}

let levelUpGladId = null;

function openLevelUp(gladId) {
  const g = STATE.roster.find(x => x.id === gladId);
  if (!g) return;
  levelUpGladId = gladId;
  const modal = document.getElementById('levelup-modal');
  const body = document.getElementById('levelup-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div class="lu-head">
      <canvas id="luCanvas" width="150" height="180"></canvas>
      <div>
        <div class="lu-name">${g.name}</div>
        <div class="lu-sub">Уровень ${g.level} • свободных очков: <b>${g.unspent}</b></div>
        <div class="lu-hint">Распределите очки между характеристиками.</div>
      </div>
    </div>
    <div class="lu-attrs">
      ${ATTRS.map(a => {
        const val = (g.attrs && g.attrs[a.key]) || 5;
        return `<div class="lu-attr">
          <div class="lua-head"><span>${a.icon} ${a.name}</span><b>${val}</b></div>
          <div class="lua-desc">${a.desc}</div>
          <button class="mini-btn primary" ${g.unspent > 0 ? '' : 'disabled'} onclick="spendPoint('${g.id}','${a.key}'); openLevelUp('${g.id}')">+1</button>
        </div>`;
      }).join('')}
    </div>
  `;
  modal.style.display = 'flex';

  const c = document.getElementById('luCanvas');
  if (c) {
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1c1612';
    ctx.fillRect(0, 0, c.width, c.height);
    drawBattleBrother(ctx, g, c.width / 2, c.height - 34, 0.82, 1, {});
  }
}

function closeLevelUp() {
  document.getElementById('levelup-modal').style.display = 'none';
  renderRoster();
  renderGladCard();
  renderCity();
}

// ==================== ВЫБОР НАВЫКОВ ====================
// Каждые 3 уровня боец получает право выбрать навык своего происхождения.
// Предлагаются три варианта из пула, уже взятые не повторяются.
let skillPickGladId = null;
let skillPickOffers = [];

function openSkillPicker(gladId) {
  const g = findFighter(gladId);
  if (!g || !(g.skillPicks > 0)) return;
  skillPickGladId = gladId;
  skillPickOffers = rollSkillChoices(g);
  const modal = document.getElementById('skill-modal');
  const body = document.getElementById('skill-body');
  if (!modal || !body) return;

  if (!skillPickOffers.length) {
    body.innerHTML = `<div class="empty-hint">Все навыки этого происхождения уже изучены.</div>`;
    modal.style.display = 'flex';
    return;
  }

  const bgTitle = g.bgTitle || 'боец';
  body.innerHTML = `
    <div class="skill-head">
      <canvas id="skillCanvas" width="120" height="150"></canvas>
      <div>
        <div class="skill-name">${g.name}</div>
        <div class="skill-sub">${bgTitle} • уровень ${g.level}</div>
        <div class="skill-hint">Выберите один навык. Остальные останутся в пуле до следующего выбора.</div>
      </div>
    </div>
    <div class="skill-options">
      ${skillPickOffers.map(s => `<button class="skill-card" onclick="pickSkill('${s.id}')">
        <span class="sk-ico">${s.icon}</span>
        <span class="sk-name">${s.name}</span>
        <span class="sk-desc">${s.desc}</span>
      </button>`).join('')}
    </div>
  `;
  modal.style.display = 'flex';

  const c = document.getElementById('skillCanvas');
  if (c) {
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1c1612';
    ctx.fillRect(0, 0, c.width, c.height);
    drawBattleBrother(ctx, g, c.width / 2, c.height - 26, 0.7, 1, {});
  }
}

function pickSkill(skillId) {
  const g = findFighter(skillPickGladId);
  if (!g) return;
  const s = skillById(skillId);
  if (!s) return;
  g.skills = g.skills || [];
  if (g.skills.includes(skillId)) return;
  g.skills.push(skillId);
  g.skillPicks = Math.max(0, (g.skillPicks || 0) - 1);
  sfx('levelup');
  addToast(`${g.name} изучил навык «${s.name}»`);
  if (typeof Save !== 'undefined') Save.autosave();
  // Если остались ещё выборы — показываем следующую тройку
  if (g.skillPicks > 0) openSkillPicker(g.id);
  else closeSkillPicker();
}

function closeSkillPicker() {
  const m = document.getElementById('skill-modal');
  if (m) m.style.display = 'none';
  skillPickGladId = null;
  skillPickOffers = [];
  renderRoster();
  renderGladCard();
  renderCity();
}

// ==================== ИНВЕНТАРЬ ====================
function filterInv(type) {
  STATE.invFilter = type;
  renderInventory();
  document.querySelectorAll('#inv-filters .chip').forEach(c => c.classList.toggle('on', c.dataset.f === type));
}

function itemStatLine(item) {
  if (item.slot === 'weapon') {
    const w = item.weight != null ? ` • вес ${item.weight}` : '';
    const hand = item.offhandOnly ? ' • левая рука' : item.twoHanded ? ' • двуручное' : '';
    return `Урон ${item.dmgMin}–${item.dmgMax} • дист. ${item.range} • ${item.apCost} ОД • бронебой ${Math.round(item.armorPen * 100)}%${w}${hand}`;
  }
  if (item.slot === 'offhand') return `Защита +${item.defBonus} • прочность ${item.armor}`;
  return `Броня +${item.armor}`;
}

function itemIconCanvas(item, size) {
  return `<canvas class="item-canvas" data-item="${item.id}" width="${size}" height="${size}"></canvas>`;
}

function paintItemCanvases(root) {
  if (!root) return;
  root.querySelectorAll('canvas.item-canvas').forEach(cv => {
    const item = itemById(cv.dataset.item);
    if (!item) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    drawItemIcon(ctx, item, cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.9);
  });
}

// ==================== ТУЛТИП ПРЕДМЕТА ====================
// Подробная карточка при наведении: все характеристики, требования
// к атрибутам и сравнение с тем, что уже надето.
let tipEl = null;

function ensureItemTip() {
  if (tipEl && document.body.contains(tipEl)) return tipEl;
  tipEl = document.getElementById('item-tip');
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'item-tip';
    tipEl.className = 'item-tip';
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

// Основная «сила» предмета — по ней сравниваем с надетым
function itemPower(item) {
  if (!item) return 0;
  if (item.slot === 'weapon') return Math.round((item.dmgMin + item.dmgMax) / 2);
  if (item.slot === 'offhand') return item.defBonus || 0;
  return item.armor || 0;
}

function itemTooltipHTML(item, glad) {
  const t = TIER_INFO[item.tier] || TIER_INFO[1];
  const slotName = SLOT_NAMES[item.slot] || item.slot;
  const rows = [];

  if (item.slot === 'weapon') {
    const avg = ((item.dmgMin + item.dmgMax) / 2).toFixed(1);
    rows.push(`<div class="it-main">Урон <b>${item.dmgMin}–${item.dmgMax}</b> <span class="it-dim">(ср. ${avg})</span></div>`);
    rows.push(`<div class="it-line">Дистанция <b>${item.range}</b> • ${item.apCost} ОД • бронебой <b>${Math.round(item.armorPen * 100)}%</b></div>`);
    const extra = [];
    if (item.weight != null) extra.push(`вес ${item.weight}`);
    if (item.twoHanded) extra.push('двуручное');
    else if (item.dualPair) extra.push('можно в левую руку');
    if (extra.length) rows.push(`<div class="it-line it-dim">${extra.join(' • ')}</div>`);
  } else if (item.slot === 'offhand') {
    rows.push(`<div class="it-main">Защита <b>+${item.defBonus || 0}</b></div>`);
    rows.push(`<div class="it-line">Прочность <b>${item.armor}</b>${item.emblem ? ` • герб: ${item.emblem}` : ''}</div>`);
  } else {
    rows.push(`<div class="it-main">Броня <b>+${item.armor}</b></div>`);
    if (item.defBonus) rows.push(`<div class="it-line">Защита <b>+${item.defBonus}</b></div>`);
  }

  // Сравнение с надетым
  const cur = glad && glad.equip ? glad.equip[item.slot] : null;
  if (cur && cur.uid !== item.uid) {
    const d = itemPower(item) - itemPower(cur);
    const cls = d > 0 ? 'it-up' : d < 0 ? 'it-down' : 'it-dim';
    const sign = d > 0 ? `+${d}` : `${d}`;
    rows.push(`<div class="it-cmp">надето: ${cur.name} — <span class="${cls}">${sign}</span></div>`);
  } else if (!cur) {
    rows.push(`<div class="it-cmp it-dim">ячейка «${slotName}» пуста</div>`);
  }

  // Требования
  if (item.req && Object.keys(item.req).length) {
    const parts = Object.keys(item.req).map(k => {
      const a = ATTRS.find(x => x.key === k);
      const have = glad && glad.attrs ? (glad.attrs[k] || 0) : 0;
      const bad = have < item.req[k];
      return `<span class="${bad ? 'req-bad' : 'req-ok'}">${a ? a.icon : k}${item.req[k]}<span class="it-have">/${have}</span></span>`;
    });
    rows.push(`<div class="it-req-row">Требуется: ${parts.join(' ')}</div>`);
  }

  return `<div class="it-head">
      <span class="it-name">${item.name}</span>
      <span class="tier-badge" style="color:${t.color};border-color:${t.color}">${t.stars} ${t.name}</span>
    </div>
    <div class="it-slot">${slotName}</div>
    ${rows.join('')}
    <div class="it-desc">${item.desc || ''}</div>
    <div class="it-price">Цена <b>${item.price}</b>з • продажа ${Math.floor(item.price * 0.45)}з</div>`;
}

function placeItemTip(ev) {
  const el = ensureItemTip();
  const pad = 14;
  const w = el.offsetWidth || 260;
  const h = el.offsetHeight || 180;
  let x = ev.clientX + pad;
  let y = ev.clientY + pad;
  if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
  if (y + h > window.innerHeight - 8) y = Math.max(8, ev.clientY - h - pad);
  el.style.left = Math.max(8, x) + 'px';
  el.style.top = Math.max(8, y) + 'px';
}

function showItemTip(ev, uid) {
  const item = STATE.inventory.find(i => i.uid === uid);
  if (!item) return;
  const el = ensureItemTip();
  el.innerHTML = itemTooltipHTML(item, getSelectedGlad());
  el.classList.add('show');
  placeItemTip(ev);
}

function hideItemTip() {
  const el = document.getElementById('item-tip');
  if (el) el.classList.remove('show');
}

function bindItemTips(root) {
  if (!root) return;
  hideItemTip();
  // Слушатели вешаем один раз на контейнер: innerHTML меняется,
  // сам контейнер остаётся, поэтому повторно не подписываемся.
  if (root.dataset.tipsBound === '1') return;
  root.dataset.tipsBound = '1';
  // Используем всплывающие mouseover/mousemove: они надёжно срабатывают
  // и при движении по дочерним узлам (canvas, кнопки внутри карточки).
  root.addEventListener('mouseover', ev => {
    const node = ev.target.closest('.br-item[data-uid]');
    if (!node) { hideItemTip(); return; }
    if (node === bindItemTips._cur) { placeItemTip(ev); return; }
    bindItemTips._cur = node;
    showItemTip(ev, node.dataset.uid);
  });
  root.addEventListener('mousemove', ev => {
    const node = ev.target.closest('.br-item[data-uid]');
    if (node) placeItemTip(ev);
  });
  root.addEventListener('mouseleave', () => {
    bindItemTips._cur = null;
    hideItemTip();
  });
  root.addEventListener('dragstart', () => {
    bindItemTips._cur = null;
    hideItemTip();
  });
}

function renderInventory() {
  const grid = document.getElementById('inventory-grid');
  if (!grid) return;
  const list = STATE.inventory.filter(i => STATE.invFilter === 'all' || i.slot === STATE.invFilter);
  const cnt = document.getElementById('inv-count');
  if (cnt) cnt.textContent = `${list.length} предметов`;
  if (!list.length) {
    grid.innerHTML = `<div class="empty-hint">Пусто. Купите снаряжение в кузнице.</div>`;
    return;
  }
  // Сортируем: сначала по слоту, затем по тиру (сильные выше)
  const sorted = list.slice().sort((a, b) => {
    if (a.slot !== b.slot) return a.slot.localeCompare(b.slot);
    if ((b.tier || 0) !== (a.tier || 0)) return (b.tier || 0) - (a.tier || 0);
    return b.price - a.price;
  });
  grid.innerHTML = sorted.map(item => {
    const g = getSelectedGlad();
    const check = g ? canEquipItem(g, item) : { ok: true, missing: [] };
    const reqTxt = item.req ? Object.keys(item.req).map(k => {
      const a = ATTRS.find(x => x.key === k);
      const have = g && g.attrs ? (g.attrs[k] || 0) : 0;
      const bad = have < item.req[k];
      return `<span class="${bad ? 'req-bad' : 'req-ok'}">${a ? a.icon : k}${item.req[k]}</span>`;
    }).join(' ') : '';
    return `<div class="br-item ${check.ok ? '' : 'locked'}" draggable="true" data-uid="${item.uid}"
      ondragstart="startDragItem(event,'${item.uid}');hideItemTip()" ondragend="this.classList.remove('dragging')"
      onclick="equipItem('${item.uid}')" title="${item.name}">
    <div class="bi-icon">${itemIconCanvas(item, 44)}</div>
    <div class="bi-body">
      <div class="bi-top">
        <span class="bi-name">${item.name}</span>
        ${itemTierBadge(item)}
      </div>
      <div class="bi-stat">${itemStatLine(item)}</div>
      ${reqTxt ? `<div class="bi-req">${reqTxt}${check.ok ? '' : ' <span class="req-bad">не хватает</span>'}</div>` : ''}
    </div>
    <div class="bi-actions">
      <button class="bi-btn" ${check.ok ? '' : 'disabled'} onclick="event.stopPropagation();equipItem('${item.uid}')" title="Надеть">надеть</button>
      <button class="bi-btn sell" onclick="event.stopPropagation();sellItem('${item.uid}')" title="Продать">${Math.floor(item.price * 0.45)}з</button>
    </div>
  </div>`;
  }).join('');
  paintItemCanvases(grid);
  bindItemTips._cur = null;
  bindItemTips(grid);
}

function equipItem(uid) {
  const glad = getSelectedGlad();
  const idx = STATE.inventory.findIndex(i => i.uid === uid);
  if (idx === -1 || !glad) return;
  const item = STATE.inventory[idx];

  // Проверка требований к характеристикам
  const check = canEquipItem(glad, item);
  if (!check.ok) {
    const txt = check.missing.map(m => {
      const a = ATTRS.find(x => x.key === m.key);
      return `${a ? a.name : m.key} ${m.have}/${m.need}`;
    }).join(', ');
    sfx('error');
    addToast(`Не хватает характеристик: ${txt}`);
    return;
  }

  // Если правая рука занята двуручным или парным — левую не трогаем
  const mainBoth = glad.equip.weapon && glad.equip.weapon.bothHands;

  if (item.slot === 'weapon') {
    // Клинок димахера — это второй клинок, он идёт только в левую руку
    if (item.offhandOnly) {
      if (glad.equip.weapon && glad.equip.weapon.bothHands) unequipItem('weapon');
      if (glad.equip.offhand) STATE.inventory.push(glad.equip.offhand);
      glad.equip.offhand = item;
      STATE.inventory.splice(idx, 1);
      glad.aiRole = null;
      sfx('click');
      renderRoster();
      renderGladCard();
      renderInventory();
      return;
    }
    // Обычный клинок при занятой левой руке щитом — щит уходит в склад
    if (item.bothHands && glad.equip.offhand) unequipItem('offhand');
    if (glad.equip.weapon) STATE.inventory.push(glad.equip.weapon);
    glad.equip.weapon = item;
  } else if (item.slot === 'offhand') {
    if (mainBoth) unequipItem('weapon');
    if (glad.equip.offhand) STATE.inventory.push(glad.equip.offhand);
    glad.equip.offhand = item;
  } else {
    if (glad.equip[item.slot]) STATE.inventory.push(glad.equip[item.slot]);
    glad.equip[item.slot] = item;
  }

  STATE.inventory.splice(idx, 1);

  glad.aiRole = null;
  sfx('click');
  renderRoster();
  renderGladCard();
  renderInventory();
}

function unequipItem(slot) {
  const glad = getSelectedGlad();
  if (!glad || !glad.equip[slot]) return;
  STATE.inventory.push(glad.equip[slot]);
  glad.equip[slot] = null;
  glad.aiRole = null;
  sfx('click');
  renderRoster();
  renderGladCard();
  renderInventory();
}

function sellItem(uid) {
  const idx = STATE.inventory.findIndex(i => i.uid === uid);
  if (idx === -1) return;
  STATE.gold += Math.floor(STATE.inventory[idx].price * 0.45);
  STATE.inventory.splice(idx, 1);
  sfx('coin');
  updateUI();
  renderInventory();
}

// ==================== ТАВЕРНА ====================
// Найм в один клик: карточка сразу добавляет бойца в отряд (если есть место).
function refreshRecruits(paid) {
  if (paid) {
    if (STATE.gold < 45) return alert('Недостаточно золота!');
    STATE.gold -= 45;
  }
  STATE.recruits = [];

  // 2 обычных + 2 премиум-наёмника (дороже, в полном снаряжении, 2–3 уровня)
  const roles = ['melee', 'shield'];

  for (let i = 0; i < 2; i++) {
    const rec = createGladiator(null, roles[i]);
    equipRecruitByRole(rec, roles[i]);
    rec.isPremium = false;
    STATE.recruits.push(rec);
  }

  for (let i = 0; i < 2; i++) {
    const rec = createGladiator(null, pick(['melee', 'shield', 'ranged']));
    // Уровень 2–3: опыт, за который просят дороже
    const lvl = 2 + (Math.random() < 0.5 ? 1 : 0);
    rec.level = lvl;
    rec.xp = 0;
    rec.atk += lvl * 3;
    rec.def += lvl * 2;
    rec.agi = (rec.agi || 8) + lvl;
    rec.maxHp += lvl * 8;
    rec.unspent = 0;
    rec.skillPicks = 0;
    rec.skills = [];
    // Навык на 3-м уровне уже выбран — он и есть «опыт»
    if (lvl >= 3) {
      const offered = rollSkillChoices(rec);
      if (offered.length) rec.skills = [offered[0].id];
    }
    // Полный универсальный комплект до tier 3
    equipPremiumRecruit(rec);
    rec.hp = rec.maxHp;
    rec.isPremium = true;
    // Цена ×2.5 от базовой: одежда и оружие уже в комплекте
    rec.cost = Math.round(rec.cost * 2.5);
    STATE.recruits.push(rec);
  }

  updateUI();
  renderRecruits();
}

// Экипировка премиум-наёмника: универсальное снаряжение до tier 3
function equipPremiumRecruit(rec) {
  const add = (slot, id) => {
    const it = itemById(id);
    if (it) rec.equip[slot] = { ...it, uid: 'p_' + Math.random().toString(36).substr(2, 8) };
  };
  add('body', 'b_gambeson');
  add('legs', 'l_greaves');
  add('head', 'h_skullcap');
  add('arms', 'a_bracers');

  // Оружие по роли — универсальное, 2-го тира
  const role = rec.aiRole;
  if (role === 'ranged') { add('weapon', 'w_hunting_bow'); return; }
  if (role === 'shield') { add('weapon', 'w_gladius'); add('offhand', 'o_round'); return; }
  add('weapon', Math.random() < 0.5 ? 'w_spatha' : 'w_waraxe');
}

// Характеристики с учётом снаряжения (для отображения)
function recruitStats(rec) {
  const eff = effectiveAttrs(rec);
  const eq = rec.equip;
  const weapon = eq.weapon || { name: 'Кулаки', dmgMin: 4, dmgMax: 8, range: 1, apCost: 3, shape: 'fist' };
  const def = rec.def + (eq.offhand ? eq.offhand.defBonus || 0 : 0) + Math.round((eff.wil || 5) * 0.5);
  const atk = rec.atk + Math.round((eff.str || 5) * 0.5);
  return { atk, def, maxHp: rec.maxHp, agi: rec.agi, eff, weapon };
}

// Рисует гладиатора по центру канваса: фигура вписывается в область,
// а не «стоит на нижнем краю».
function drawGladCentered(ctx, glad, W, H, baseScale) {
  // Пропорции фигуры в renderer: от ступней до макушки ~148 ед. при scale=1
  const figureH = 148;
  const scale = Math.min(baseScale || 2, (H * 0.82) / figureH);
  const y = H / 2 + (figureH * scale) / 2;
  drawBattleBrother(ctx, glad, W / 2, y, scale, 1, {});
}

function renderRecruits() {
  const grid = document.getElementById('recruits-grid');
  if (!grid) return;
  if (!STATE.recruits.length) {
    grid.innerHTML = `<div class="empty-hint">Наёмники разошлись. Обновите список.</div>`;
    return;
  }
  const squadFull = STATE.squad.length >= MAX_SQUAD;
  grid.innerHTML = STATE.recruits.map((rec, idx) => {
    const role = rec.aiRole || deriveRole(rec);
    const clsDef = classById(rec.cls) || {};
    const stats = recruitStats(rec);
    const canHire = STATE.gold >= rec.cost && STATE.roster.length < MAX_ROSTER;
    const premiumTag = rec.isPremium ? `<div class="rec-premium-badge">⭐ Опытный</div>` : '';
    const levelTag = rec.isPremium ? `<div class="rec-level">Уровень ${rec.level}</div>` : '';

    // Характеристики с экипировкой
    const eff = stats.eff;
    const attrLine = Object.keys(eff).map(k => {
      const a = ATTRS.find(x => x.key === k);
      return a ? `${a.icon}${eff[k]}` : '';
    }).filter(Boolean).join(' ');

    const weaponLine = stats.weapon.name ? `⚔️ ${stats.weapon.name} (${stats.weapon.dmgMin}–${stats.weapon.dmgMax})` : '';

    return `<div class="recruit-card${rec.isPremium ? ' recruit-premium' : ''}">
      <canvas class="rec-canvas" id="rec-canvas-${idx}" width="128" height="150"></canvas>
      <div class="rec-header">
        <div class="rec-name">${rec.name}</div>
        ${premiumTag}${levelTag}
      </div>
      <div class="rec-sub">${rec.bgTitle}</div>
      <div class="rec-class">${clsDef.icon || '🎖️'} ${rec.className || 'Боец'}</div>
      <div class="rec-role">${ROLE_ICONS[role]} ${ROLE_LABELS[role]}</div>
      <div class="rec-stats">
        <span>❤️ ${stats.maxHp}</span><span>⚔️ ${stats.atk}</span><span>🛡️ ${stats.def}</span><span>💨 ${stats.agi}</span>
      </div>
      ${weaponLine ? `<div class="rec-weapon">${weaponLine}</div>` : ''}
      ${attrLine ? `<div class="rec-attrs">${attrLine}</div>` : ''}
      <div class="rec-actions">
        <button class="wide-btn primary" ${canHire ? '' : 'disabled'} onclick="hireRecruit(${idx})">
          Нанять • ${rec.cost}з
        </button>
        <button class="wide-btn lore-btn" onclick="showRecruitLore(${idx})">
          📜 Предыстория
        </button>
      </div>
    </div>`;
  }).join('') + (squadFull
    ? `<div class="recruit-note">Отряд заполнен (${MAX_SQUAD}/${MAX_SQUAD}). Новый боец встанет в резерв.</div>`
    : '');

  STATE.recruits.forEach((rec, idx) => {
    const c = document.getElementById('rec-canvas-' + idx);
    if (!c) return;
    const ctx = c.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, 0, c.height);
    bg.addColorStop(0, '#2a2118');
    bg.addColorStop(1, '#16110d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    drawGladCentered(ctx, rec, c.width, c.height, 1.4);
  });
}

// Показать предысторию наёмника
function showRecruitLore(idx) {
  const rec = STATE.recruits[idx];
  if (!rec) return;
  const clsDef = classById(rec.cls);
  if (!clsDef) return alert('Класс не известен.');

  const lore = CLASS_LORE[clsDef.id];
  const story = lore ? lore.story(rec.name) : `Нет записи о прошлом ${rec.name}.`;

  const modal = document.getElementById('recruit-lore-modal');
  const body = document.getElementById('lore-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div class="lore-header">
      <span class="lore-class-icon">${clsDef.icon || '🎖️'}</span>
      <h2>${lore ? lore.title : clsDef.name}</h2>
    </div>
    <div class="lore-stats">
      <div class="lore-stat-row"><span>Уровень:</span><b>${rec.level}</b></div>
      <div class="lore-stat-row"><span>Здоровье:</span><b>${rec.maxHp}</b></div>
      <div class="lore-stat-row"><span>Атака:</span><b>${rec.atk}</b></div>
      <div class="lore-stat-row"><span>Защита:</span><b>${rec.def}</b></div>
      <div class="lore-stat-row"><span>Ловкость:</span><b>${rec.agi}</b></div>
      <div class="lore-stat-row"><span>Класс:</span><b>${rec.className}</b></div>
      <div class="lore-stat-row"><span>Перк:</span><b>${clsDef.perk}</b></div>
    </div>
    <div class="lore-divider"></div>
    <div class="lore-text">${story.replace(/\n/g, '<br>')}</div>
  `;

  modal.style.display = 'flex';
}

function closeRecruitLore() {
  document.getElementById('recruit-lore-modal').style.display = 'none';
}

// Простой найм: один клик — боец в отряде (или в резерве, если отряд полон)
function hireRecruit(idx) {
  const rec = STATE.recruits[idx];
  if (!rec) return;
  if (STATE.gold < rec.cost) return alert('Не хватает золота для найма!');
  if (STATE.roster.length >= MAX_ROSTER) return alert(`В казарме максимум ${MAX_ROSTER} гладиаторов!`);
  STATE.gold -= rec.cost;
  STATE.roster.push(rec);
  STATE.selectedGladId = rec.id;

  let msg = `${rec.name} присоединяется`;
  if (STATE.squad.length < MAX_SQUAD && rec.hp > 0) {
    STATE.squad.push(rec.id);
    msg += ' и встаёт в отряд';
  } else {
    msg += ' и ждёт в резерве';
  }

  STATE.recruits.splice(idx, 1);
  sfx('coin');
  updateUI();
  renderRecruits();
  addToast(msg);
}

// ==================== МАГАЗИН ====================
function shopTab(tab) {
  STATE.shopTab = tab;
  STATE.shopCat = tab === 'weapon' ? 'sword' : 'offhand';
  renderMarket();
}
function shopCat(cat) {
  if (STATE.shopTab === 'weapon') STATE.shopCat = cat;
  else STATE.armorCat = cat;
  renderMarket();
}

// Карточка товара в кузнице
function marketCard(item, payFame, g) {
  const reqTxt = item.req ? Object.keys(item.req).map(k => {
    const a = ATTRS.find(x => x.key === k);
    const have = g && g.attrs ? (g.attrs[k] || 0) : 0;
    const bad = have < item.req[k];
    return `<span class="${bad ? 'req-bad' : 'req-ok'}" title="${a ? a.name : k}: ${have}/${item.req[k]}">${a ? a.icon : k}${item.req[k]}</span>`;
  }).join(' ') : '';
  const price = payFame ? (item.famePrice || 1) : item.price;
  const have = payFame ? (STATE.fame || 0) : (STATE.gold || 0);
  const canPay = have >= price;
  return `<div class="item-card shop">
    <div class="ic-top">
      ${itemIconCanvas(item, 58)}
      <div class="ic-titles">
        <span class="ic-title">${item.name}</span>
        ${itemTierBadge(item)}
      </div>
    </div>
    <div class="ic-stat">${itemStatLine(item)}${item.twoHanded ? ' • двуручное' : ''}</div>
    ${reqTxt ? `<div class="ic-req">Требуется: ${reqTxt}</div>` : ''}
    <div class="ic-desc">${item.desc}</div>
    <button class="wide-btn primary" ${canPay ? '' : 'disabled'} onclick="buyItem('${item.id}')">
      Купить • ${price}${payFame ? '🏆' : 'з'}
    </button>
  </div>`;
}

function renderMarket() {
  const catsEl = document.getElementById('market-cats');
  const grid = document.getElementById('market-grid');
  if (!grid) return;

  const isWeapon = STATE.shopTab === 'weapon';
  const cats = isWeapon ? WEAPON_CATS : ARMOR_CATS;
  const activeCat = isWeapon ? STATE.shopCat : STATE.armorCat;
  const payFame = false;   // слава больше не покупает снаряжение

  if (catsEl) {
    catsEl.innerHTML = `
      <div class="shop-tabs">
        ${SHOP_TABS.map(t => `<button class="shop-tab ${STATE.shopTab === t.id ? 'on' : ''}" onclick="shopTab('${t.id}')">${t.icon} ${t.name}</button>`).join('')}
      </div>
      <div class="shop-cats">
        ${cats.map(c => `<button class="chip ${activeCat === c.id ? 'on' : ''}" onclick="shopCat('${c.id}')">${c.icon} ${c.name}</button>`).join('')}
      </div>
    `;
  }
  const goldEl = document.getElementById('market-fame');
  if (goldEl) goldEl.textContent = STATE.fame || 0;

  const g = getSelectedGlad();
  let list = itemsByCat(activeCat).slice().sort((a, b) => a.tier - b.tier || a.price - b.price);

  if (!list.length) {
    grid.innerHTML = `<div class="empty-hint">В этой категории пока нет снаряжения.</div>`;
    return;
  }

  grid.innerHTML = `<div class="item-grid">${list.map(item => marketCard(item, payFame, g)).join('')}</div>`;
  paintItemCanvases(grid);
}

function setPayWith(kind) {
  // Совместимость: выбор валюты убран, снаряжение только за золото
  STATE.payWith = 'gold';
  renderMarket();
}

function buyItem(id) {
  const base = itemById(id);
  if (!base) return;
  // Снаряжение продаётся только за золото: слава — валюта внешности
  const price = base.price;
  if (STATE.gold < price) return alert('Недостаточно золота!');
  STATE.gold -= price;
  STATE.inventory.push({ ...base, uid: 'i_' + Math.random().toString(36).substr(2, 9) });
  sfx('coin');
  updateUI();
  renderMarket();
  addToast(`Куплено: ${base.name}`);
}

// ==================== КОСМЕТИКА ====================
function renderCosmetics() {
  const el = document.getElementById('cosmetics-list');
  if (!el) return;
  const fameEl = document.getElementById('cosmetics-fame');
  if (fameEl) fameEl.textContent = STATE.fame || 0;

  const g = getSelectedGlad();
  if (!g) {
    el.innerHTML = `<div class="empty-hint">Сначала наймите бойца — менять внешность некого.</div>`;
    return;
  }

  const cur = g.cosmetic || {};
  const groups = [];
  COSMETICS.forEach(c => {
    if (groups.indexOf(c.group) < 0) groups.push(c.group);
  });

  const bustBox = `<div class="cos-bust">
      <canvas id="cosBustCanvas" width="260" height="320"></canvas>
      <div class="cos-name">${g.name}</div>
      <div class="cos-fame">🏆 ${STATE.fame || 0} славы</div>
    </div>`;

  const body = groups.map(group => {
    const list = COSMETICS.filter(c => c.group === group);
    const kind = list[0].kind;
    return `<div class="cos-group">
      <div class="cos-group-title">${group}</div>
      <div class="cos-options">
        ${list.map(c => {
          const owned = cosmeticOwned(g, c);
          const active = (cur[kind] || '') === c.value ||
            (!cur[kind] && (c.value === 'normal' || c.value === 'short' || c.value === 'none'));
          const priceTxt = owned ? '' : `<span class="co-price">🏆 ${c.fame}</span>`;
          const cls = active ? 'active' : owned ? '' : 'locked';
          return `<button class="cos-opt ${cls}" ${owned ? '' : `onclick="buyCosmetic('${c.id}')"`}>
            <span class="co-name">${c.name}</span>
            ${priceTxt || (active ? '<span class="co-on">надето</span>' : '<span class="co-own">есть</span>')}
          </button>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  el.innerHTML = bustBox + `<div class="cos-groups">${body}</div>`;
  drawCosmeticBust(g);
}

function drawCosmeticBust(g) {
  const cv = document.getElementById('cosBustCanvas');
  if (!cv || !g) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2c2219');
  bg.addColorStop(1, '#171210');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  drawGladCentered(ctx, g, W, H, 1.55);
}

function buyCosmetic(id) {
  const c = COSMETIC_BY_ID[id];
  if (!c) return;
  const g = getSelectedGlad();
  if (!g) return alert('Выберите бойца.');
  if (!g.cosmeticOwned) g.cosmeticOwned = [];
  if (g.cosmeticOwned.indexOf(id) >= 0) return applyCosmetic(id);
  if ((STATE.fame || 0) < c.fame) {
    sfx('error');
    return alert(`Нужно ${c.fame} славы. У вас ${STATE.fame || 0}.`);
  }
  STATE.fame -= c.fame;
  g.cosmeticOwned.push(id);
  applyCosmetic(id, true);
  sfx('coin');
  addToast(`Куплено: ${c.name} (−${c.fame} славы)`);
}

// Надеть купленную (или бесплатную) косметику
function applyCosmetic(id, silent) {
  const c = COSMETIC_BY_ID[id];
  if (!c) return;
  const g = getSelectedGlad();
  if (!g) return;
  if (!g.cosmetic) g.cosmetic = {};
  if (!cosmeticOwned(g, c) && c.fame > 0) return buyCosmetic(id);

  if (c.kind === 'build') g.build = c.value;
  else if (c.kind === 'hair') g.hairStyle = c.value;
  else if (c.kind === 'tattoo') g.tattoo = c.value;
  else if (c.kind === 'paint') g.paint = c.value;
  g.cosmetic[c.kind] = c.value;

  sfx('click');
  renderCosmetics();
  renderGladCard();
  renderRoster();
  if (typeof Save !== 'undefined') Save.autosave();
  if (!silent) addToast(`Внешность: ${c.name}`);
}

// ==================== ХРАМ ====================
// Медикус лечит здоровье и покалеченные (но не отрубленные) конечности.
// Отрубленное не возвращается никогда — это цена боя.
// Медикус берёт за лечение умеренно: восстановить тело после тяжёлого боя
// дешевле, чем купить новое оружие.
function healCost(g) { return Math.max(6, Math.round((g.maxHp - g.hp) * 0.42)); }

function limbHealCost(g, limbId) {
  const s = g.limbs && g.limbs[limbId];
  if (!s || s.lost) return 0;
  const missing = Math.max(0, s.max - s.hp);
  return missing <= 0 ? 0 : Math.max(5, Math.round(missing * 0.65));
}

function renderTemple() {
  const el = document.getElementById('temple-list');
  if (!el) return;
  const all = (STATE.roster || []).concat(STATE.dogs || []);
  if (!all.length) { el.innerHTML = `<div class="empty-hint">В отряде нет бойцов.</div>`; return; }

  el.innerHTML = all.map(g => {
    const hurt = g.hp < g.maxHp;
    const cost = healCost(g);
    const limbs = LIMB_DEFS.map(l => {
      const s = g.limbs && g.limbs[l.id];
      if (!s) return '';
      const pct = s.lost ? 0 : Math.round((s.hp / s.max) * 100);
      const cls = s.lost ? 'lost' : pct < 30 ? 'low' : pct < 65 ? 'mid' : 'ok';
      const lc = limbHealCost(g, l.id);
      return `<div class="temple-limb ${cls}" ${lc ? `onclick="healLimb('${g.id}','${l.id}')" title="Вылечить: ${lc}з"` : ''}>
        <span class="tl-ico">${l.icon}</span>
        <span class="tl-name">${l.short}</span>
        <div class="tl-bar"><i style="width:${pct}%"></i></div>
        <span class="tl-val">${s.lost ? 'нет' : s.hp + '/' + s.max}</span>
        ${lc ? `<span class="tl-cost">${lc}з</span>` : ''}
      </div>`;
    }).join('');

    return `<div class="temple-card ${g.isDog ? 'is-dog' : ''}">
      <div class="tc-head">
        <span class="tc-name">${g.isDog ? '🐕 ' : ''}${g.name}</span>
        <span class="tc-hp">${g.hp}/${g.maxHp} HP ${hurt ? '' : '• здоров'}</span>
      </div>
      <div class="tc-bar"><i style="width:${(g.hp / g.maxHp) * 100}%"></i></div>
      <div class="tc-limbs">${limbs}</div>
      <button class="mini-btn ${hurt ? 'primary' : ''}" ${hurt ? '' : 'disabled'} onclick="healGlad('${g.id}')">
        ${hurt ? 'Вылечить тело • ' + cost + 'з' : 'тело здорово'}
      </button>
    </div>`;
  }).join('');
  const tg = document.getElementById('temple-gold');
  if (tg) tg.textContent = STATE.gold;
}

function healGlad(id) {
  const g = findFighter(id);
  if (!g || g.hp >= g.maxHp) return;
  const cost = healCost(g);
  if (STATE.gold < cost) return alert('Недостаточно золота!');
  STATE.gold -= cost;
  g.hp = g.maxHp;
  sfx('heal');
  updateUI();
  renderTemple();
  if (typeof Save !== 'undefined') Save.autosave();
}

// Лечение одной конечности — очерёдность выбирает игрок
function healLimb(id, limbId) {
  const g = findFighter(id);
  if (!g) return;
  const cost = limbHealCost(g, limbId);
  if (!cost) return;
  if (STATE.gold < cost) return alert('Недостаточно золота!');
  const s = g.limbs[limbId];
  if (s.lost) return alert('Эту конечность уже не вернуть.');
  STATE.gold -= cost;
  s.hp = s.max;
  sfx('heal');
  updateUI();
  renderTemple();
  if (typeof Save !== 'undefined') Save.autosave();
}

function healAll() {
  const all = (STATE.roster || []).concat(STATE.dogs || []);
  const wounded = all.filter(g => g.hp < g.maxHp);
  const hurtLimbs = [];
  all.forEach(g => {
    LIMB_DEFS.forEach(l => {
      const s = g.limbs && g.limbs[l.id];
      if (!s || s.lost || s.hp >= s.max) return;
      hurtLimbs.push({ g, id: l.id, cost: limbHealCost(g, l.id) });
    });
  });
  if (!wounded.length && !hurtLimbs.length) return alert('Все бойцы здоровы!');

  const total = wounded.reduce((s, g) => s + healCost(g), 0)
    + hurtLimbs.reduce((s, h) => s + h.cost, 0);
  if (STATE.gold < total) return alert(`Нужно ${total} золота для полного лечения!`);

  STATE.gold -= total;
  wounded.forEach(g => { g.hp = g.maxHp; });
  hurtLimbs.forEach(h => { h.g.limbs[h.id].hp = h.g.limbs[h.id].max; });
  sfx('heal');
  updateUI();
  renderTemple();
  if (typeof Save !== 'undefined') Save.autosave();
}

// ==================== ПСАРНЯ ====================
function refreshKennel(paid) {
  if (paid) {
    if (STATE.gold < KENNEL_REFRESH_COST) return alert('Недостаточно золота!');
    STATE.gold -= KENNEL_REFRESH_COST;
  }
  const pool = DOG_BREEDS.slice();
  const stock = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const bi = Math.floor(Math.random() * pool.length);
    const breed = pool.splice(bi, 1)[0];
    const dog = makeDog(breed);
    dog.cost = breed.cost;
    stock.push(dog);
  }
  STATE.kennelStock = stock;
  updateUI();
  renderKennel();
}

function renderKennel() {
  const grid = document.getElementById('kennel-grid');
  const owned = document.getElementById('kennel-owned');
  if (owned) {
    const dogs = STATE.dogs || [];
    owned.innerHTML = dogs.length
      ? dogs.map(d => {
          const pct = Math.round((d.hp / d.maxHp) * 100);
          const inSquad = STATE.squad.includes(d.id);
          return `<div class="ko-dog ${inSquad ? 'in-squad' : ''}">
            <span class="ko-name">🐕 ${d.name}</span>
            <span class="ko-lvl">ур.${d.level}</span>
            <div class="ko-bar"><i style="width:${pct}%"></i></div>
            <button class="mini-btn ${inSquad ? 'on' : ''}" onclick="toggleSquad('${d.id}')">
              ${inSquad ? 'в отряде' : 'в отряд'}
            </button>
          </div>`;
        }).join('')
      : `<div class="empty-hint">Псов пока нет.</div>`;
  }
  if (!grid) return;

  if (!STATE.kennelStock.length) refreshKennel(false);
  if (!STATE.kennelStock.length) { grid.innerHTML = ''; return; }

  const full = (STATE.dogs || []).length >= MAX_DOGS;
  grid.innerHTML = STATE.kennelStock.map((dog, idx) => {
    const canBuy = STATE.gold >= dog.cost && !full;
    return `<div class="recruit-card dog-card">
      <canvas class="rec-canvas" id="dog-canvas-${idx}" width="128" height="150"></canvas>
      <div class="rec-name">${dog.name}</div>
      <div class="rec-sub">${dog.breedName || ''}</div>
      <div class="rec-role">🐕 Зверь</div>
      <div class="rec-stats">
        <span>❤️ ${dog.maxHp}</span><span>⚔️ ${dog.atk}</span><span>🛡️ ${dog.def}</span><span>💨 ${dog.agi}</span>
      </div>
      ${dog.perk ? `<div class="dog-perk">${dog.perk}</div>` : ''}
      <button class="wide-btn primary" ${canBuy ? '' : 'disabled'} onclick="hireDog(${idx})">
        Купить • ${dog.cost}з
      </button>
    </div>`;
  }).join('') + (full ? `<div class="recruit-note">Псарня полна (${MAX_DOGS}/${MAX_DOGS}).</div>` : '');

  STATE.kennelStock.forEach((dog, idx) => {
    const c = document.getElementById('dog-canvas-' + idx);
    if (!c) return;
    const ctx = c.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, 0, c.height);
    bg.addColorStop(0, '#2a2118');
    bg.addColorStop(1, '#16110d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    if (typeof drawBattleDog === 'function') {
      drawBattleDog(ctx, dog, c.width / 2, c.height - 22, 0.9, 1, {});
    }
  });
}

function hireDog(idx) {
  const dog = STATE.kennelStock[idx];
  if (!dog) return;
  if ((STATE.dogs || []).length >= MAX_DOGS) return alert(`Больше ${MAX_DOGS} псов не прокормить.`);
  if (STATE.gold < dog.cost) return alert('Не хватает золота!');
  STATE.gold -= dog.cost;
  STATE.dogs.push(dog);
  if (STATE.squad.length < MAX_SQUAD) STATE.squad.push(dog.id);
  STATE.kennelStock.splice(idx, 1);
  sfx('coin');
  updateUI();
  renderKennel();
  addToast(`🐕 ${dog.name} теперь ваш`);
  if (typeof Save !== 'undefined') Save.autosave();
}

// ==================== СУНДУКИ ====================
function renderChests() {
  const grid = document.getElementById('chest-grid');
  if (!grid) return;
  grid.innerHTML = CHESTS.map(ch => {
    const tiers = Object.keys(ch.weights).map(t => `${t} тир: ${ch.weights[t]}%`).join(' • ');
    return `<div class="chest-card">
      <div class="cc-icon">${ch.icon}</div>
      <div class="cc-name">${ch.name}</div>
      <div class="cc-desc">${ch.desc}</div>
      <div class="cc-odds">${tiers}</div>
      <button class="wide-btn primary" ${STATE.gold < ch.price ? 'disabled' : ''} onclick="openChest('${ch.id}')">
        Открыть • ${ch.price}з
      </button>
    </div>`;
  }).join('');
  const cg = document.getElementById('chests-gold');
  if (cg) cg.textContent = STATE.gold;
}

// Лента рулетки: приз ставим на фиксированную позицию, вокруг — случайные
// предметы того же слота. Ближе к призу чаще попадаются вещи его тира —
// так прокрутка «интригует» и не выглядит мусорной.
function chestReelStrip(prize, count, prizeIdx) {
  const pool = ITEMS_DB.filter(i => i.slot === prize.slot);
  const near = pool.filter(i => Math.abs((i.tier || 1) - (prize.tier || 1)) <= 1);
  const cells = [];
  for (let i = 0; i < count; i++) {
    if (i === prizeIdx) { cells.push(prize); continue; }
    const dist = Math.abs(i - prizeIdx);
    const useNear = near.length && dist <= 6 && Math.random() < 0.7;
    const src = useNear ? near : (pool.length ? pool : ITEMS_DB);
    cells.push(src[Math.floor(Math.random() * src.length)]);
  }
  return cells;
}

function openChest(id) {
  const chest = chestById(id);
  if (!chest) return;
  if (STATE.gold < chest.price) return alert('Недостаточно золота!');
  STATE.gold -= chest.price;

  // Приз определяем сразу: анимация — только представление
  const res = rollChestLoot(chest);
  STATE.inventory.push(res.item);
  if (res.goldBack) STATE.gold += res.goldBack;

  updateUI();
  renderChests();
  if (typeof Save !== 'undefined') Save.autosave();

  const body = document.getElementById('chest-body');
  const modal = document.getElementById('chest-modal');
  if (!body || !modal) return;

  const CELL = 96, GAP = 8, STEP = CELL + GAP;
  const COUNT = 44, PRIZE_IDX = 38;
  const cells = chestReelStrip(res.item, COUNT, PRIZE_IDX);

  body.innerHTML = `
    <h2>${chest.icon} ${chest.name}</h2>
    <div class="chest-reel-wrap">
      <div class="chest-reel-fade left"></div>
      <div class="chest-reel-fade right"></div>
      <div class="chest-reel-marker"></div>
      <div class="chest-reel" id="chest-reel">
        ${cells.map(it => `<div class="reel-cell">${itemIconCanvas(it, 52)}<span class="rc-name">${it.name}</span></div>`).join('')}
      </div>
    </div>
    <div id="chest-result" class="chest-result">
      <div class="chest-loot tier-${res.tier}">
        <div class="cl-badge">${res.tier} тир</div>
        <div class="cl-name">${res.item.name}</div>
        <div class="cl-stat">${itemStatLine(res.item)}</div>
        <div class="cl-desc">${res.item.desc || ''}</div>
      </div>
      ${res.goldBack ? `<div class="chest-gold">💰 Внутри завалялось ${res.goldBack} золота</div>` : ''}
      <div class="chest-hint">${res.tier <= 2 ? 'Хлам. Но и такое пригодится.' : 'Неплохая находка!'}</div>
    </div>
  `;
  paintItemCanvases(body);
  modal.style.display = 'flex';

  const reel = document.getElementById('chest-reel');
  const wrap = body.querySelector('.chest-reel-wrap');
  if (!reel || !wrap) return;

  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    const cellEl = reel.children[PRIZE_IDX];
    if (cellEl) cellEl.classList.add('win');
    sfx(res.tier >= 4 ? 'levelup' : 'open');
    const out = document.getElementById('chest-result');
    if (out) out.classList.add('show');
    // Отдельное всплывающее уведомление о выигрыше — чтобы приз
    // было точно видно, даже если игрок не смотрит на панель результата.
    showChestWin(res.item, res.tier);
  };

  // Ставим ленту в старт, затем одним переходом раскручиваем до приза
  reel.style.transition = 'none';
  reel.style.transform = 'translateX(0px)';
  const w = wrap.clientWidth || 360;
  const center = w / 2 - CELL / 2;
  const jitter = (Math.random() - 0.5) * CELL * 0.4;
  const target = -(PRIZE_IDX * STEP) + center + jitter;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      reel.style.transition = 'transform 3.4s cubic-bezier(.12,.62,.06,1)';
      reel.style.transform = `translateX(${target}px)`;
    });
  });

  reel.addEventListener('transitionend', reveal, { once: true });
  // Страховка: если вкладка была в фоне и transitionend не пришёл
  setTimeout(reveal, 3800);
}

function closeChestModal() {
  const m = document.getElementById('chest-modal');
  if (m) m.style.display = 'none';
}

// ==================== УВЕДОМЛЕНИЕ О ВЫИГРЫШЕ СУНДУКА ====================
let _chestWinTimer = null;

function showChestWin(item, tier) {
  const box = document.getElementById('chest-win');
  if (!box || !item) return;
  const t = TIER_INFO[tier] || TIER_INFO[1];
  box.querySelector('.chest-win-name').textContent = item.name;
  box.querySelector('.chest-win-stat').innerHTML =
    `<span style="color:${t.color}">${t.stars} ${t.name}</span> • ${itemStatLine(item)}`;
  box.classList.add('show');
  clearTimeout(_chestWinTimer);
  // Через 6 секунд само скрывается — чтобы не мешало дальше крутить
  _chestWinTimer = setTimeout(closeChestWin, 6000);
}

function closeChestWin() {
  const box = document.getElementById('chest-win');
  if (box) box.classList.remove('show');
  clearTimeout(_chestWinTimer);
}

// ==================== КНОПОЧНЫЕ ТУЛТИПЫ ====================
let _btnTipEl = null;

function ensureBtnTip() {
  if (!_btnTipEl || !document.body.contains(_btnTipEl)) {
    _btnTipEl = document.createElement('div');
    _btnTipEl.id = 'btn-tip';
    _btnTipEl.className = 'btn-tip';
    document.body.appendChild(_btnTipEl);
  }
  return _btnTipEl;
}

function showBtnTip(ev) {
  const btn = ev.target.closest('[data-tip]');
  if (!btn) { hideBtnTip(); return; }
  const text = btn.getAttribute('data-tip');
  if (!text) { hideBtnTip(); return; }
  const el = ensureBtnTip();
  el.innerHTML = text;
  el.classList.add('show');
  const pad = 10;
  const w = el.offsetWidth || 200;
  const h = el.offsetHeight || 40;
  let x = ev.clientX + pad;
  let y = ev.clientY - h - pad;
  if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
  if (y < 8) y = ev.clientY + pad;
  el.style.left = Math.max(8, x) + 'px';
  el.style.top = Math.max(8, y) + 'px';
}

function hideBtnTip() {
  const el = document.getElementById('btn-tip');
  if (el) el.classList.remove('show');
}

// Авто-подписка на кнопки: ищем все [data-tip] при загрузке
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('mouseover', showBtnTip);
  document.addEventListener('mousemove', ev => {
    if (ev.target.closest('[data-tip]')) showBtnTip(ev);
  });
  document.addEventListener('mouseleave', ev => {
    if (!ev.target.closest('[data-tip]')) hideBtnTip();
  }, true);
});
let currentTalker = null;

function drinkBeer() {
  if (STATE.gold < BEER_COST) return alert(`Кружка стоит ${BEER_COST} золота.`);
  STATE.gold -= BEER_COST;
  const talker = pickTalker(currentTalker ? currentTalker.id : null);
  currentTalker = talker;

  // Небольшой бонус за разговор — но не бесплатный
  if (talker.buff) {
    if (talker.buff.gold) { STATE.gold += talker.buff.gold; }
    if (talker.buff.fame) { STATE.fame += talker.buff.fame; }
    if (talker.buff.heal) {
      const all = (STATE.roster || []).concat(STATE.dogs || []).filter(g => g.hp > 0);
      all.forEach(g => { g.hp = Math.min(g.maxHp, g.hp + Math.round(g.maxHp * talker.buff.heal / 100)); });
    }
    if (talker.buff.dogXp) {
      (STATE.dogs || []).forEach(d => { d.xp = (d.xp || 0) + talker.buff.dogXp; });
    }
  }

  sfx('coin');
  updateUI();

  const modal = document.getElementById('beer-modal');
  const body = document.getElementById('beer-body');
  if (!modal || !body) return;
  body.innerHTML = `
    <div class="beer-head">
      <span class="beer-icon" style="color:${talker.color}">${talker.icon}</span>
      <div>
        <div class="beer-name">${talker.name}</div>
        <div class="beer-sub">разговор за кружкой</div>
      </div>
    </div>
    <div class="beer-line">«${pick(talker.lines)}»</div>
    <div class="beer-hint">💡 ${talker.hint}</div>
  `;
  modal.style.display = 'flex';
  if (typeof Save !== 'undefined') Save.autosave();
}

function closeBeerModal() {
  const m = document.getElementById('beer-modal');
  if (m) m.style.display = 'none';
}

// ==================== ТРЕНИРОВКА: РИТМ-МИНИ-ИГРА ====================
// Тренировка больше не «ждёт таймер». Боец работает в ритм: на экране
// четыре дорожки, метки бегут к линии удара. Нажимайте нужную клавишу
// (A S D F) или кнопку в момент удара — каждый точный удар добавляет
// один такт к прогрессу. Промах и пропуск сбрасывают серию и отнимают такт.
// Первый уровень — 2 минуты чистого ритма, каждый следующий — на минуту больше.
let trainingRaf = null;
let trainingTs = 0;

const TRAIN_KEYS = [
  { code: 'KeyA', key: 'A', lane: 0 },
  { code: 'KeyS', key: 'S', lane: 1 },
  { code: 'KeyD', key: 'D', lane: 2 },
  { code: 'KeyF', key: 'F', lane: 3 }
];
const TRAIN_BASE_MS = 30 * 1000;       // 1-й уровень — 30 секунд чистого ритма
const TRAIN_STEP_MS = 5 * 1000;        // +5 секунд за каждый следующий уровень
const TRAIN_BEAT_MS = 620;             // длительность такта
const TRAIN_WINDOW_MS = 190;           // окно попадания до/после линии удара

function trainingNeedMs(level) {
  return TRAIN_BASE_MS + Math.max(0, (level || 1) - 1) * TRAIN_STEP_MS;
}

function trainState(id) {
  return (STATE.training || {})[id] || null;
}

// Тренировка идёт по часам: время течёт само, а попадания лишь
// определяют, засчитают уровень или нет (нужно ≥60% точных ударов).
function trainProgress(id) {
  const t = trainState(id);
  if (!t) return null;
  return clamp01((t.elapsed || 0) / Math.max(1, t.need));
}

function trainRemaining(id) {
  const t = trainState(id);
  if (!t) return null;
  return Math.max(0, t.need - (t.elapsed || 0));
}

// Доля точных ударов от всех тактов
function trainAccuracy(id) {
  const t = trainState(id);
  if (!t || !t.beats) return 1;
  return (t.hits || 0) / t.beats;
}

const TRAIN_PASS_RATE = 0.6;   // минимум 60% попаданий для зачёта

function isTraining(id) {
  return !!trainState(id);
}

function fmtTime(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// Состояние текущей мини-игры. В сейв не попадает: незавершённая
// тренировка после загрузки просто ждёт, пока её продолжат.
const TRAIN_GAME = {
  id: null,
  running: false,
  lane: 0,
  beat: 0,
  beatStart: 0,
  nextBeatAt: 0,
  combo: 0,
  best: 0,
  hits: 0,
  misses: 0,
  flash: 0,
  laneFlash: [0, 0, 0, 0],
  raf: null,
  lastTs: 0
};

// Завершение тренировки по времени: уровень засчитывается только при
// точности не ниже 60%. Иначе время потрачено, но опыта не будет.
function finishTraining(id) {
  const g = STATE.roster.find(x => x.id === id);
  if (!STATE.training) STATE.training = {};
  const t = STATE.training[id];
  const acc = t && t.beats ? (t.hits || 0) / t.beats : 0;
  delete STATE.training[id];
  if (TRAIN_GAME.id === id) stopTrainingGame(true);
  if (!g) return;
  if (acc < TRAIN_PASS_RATE) {
    sfx('error');
    addToast(`❌ ${g.name}: точность ${Math.round(acc * 100)}% — нужно ${Math.round(TRAIN_PASS_RATE * 100)}%. Уровень не засчитан.`);
    updateUI();
    renderTraining();
    if (typeof Save !== 'undefined') Save.autosave();
    return;
  }
  const need = Math.max(0, xpToNext(g.level) - g.xp);
  g.xp += need;
  const ups = applyLevelUps(g);
  sfx('levelup');
  addToast(`🎉 ${g.name} завершает тренировку — уровень ${g.level}! +${ups * 2} очк. (точность ${Math.round(acc * 100)}%)`);
  updateUI();
  renderTraining();
  if (typeof Save !== 'undefined') Save.autosave();
}

// Совместимость со старыми вызовами: тренировки больше не идут по часам
function checkTrainings() { return false; }

function renderTraining() {
  const el = document.getElementById('training-list');
  if (!el) return;
  if (!STATE.roster.length) {
    el.innerHTML = `<div class="empty-hint">Некого тренировать.</div>`;
    stopTrainingAnim();
    return;
  }

  el.innerHTML = STATE.roster.map(g => {
    const need = xpToNext(g.level);
    const xpPct = Math.min(100, (g.xp / need) * 100);
    const t = trainState(g.id);
    const busy = !!t;
    const prog = busy ? trainProgress(g.id) : 0;
    const left = busy ? trainRemaining(g.id) : 0;

    let action;
    if (busy) {
      const active = TRAIN_GAME.id === g.id && TRAIN_GAME.running;
      action = `<div class="tr-training">
           <div class="tr-train-bar"><i style="width:${Math.round(prog * 100)}%"></i></div>
           <span class="tr-train-lbl">🥁 ${fmtTime(left)} ритма • ${Math.round(prog * 100)}%</span>
           <div class="tr-btns">
             <button class="mini-btn ${active ? '' : 'primary'}" onclick="startTrainingGame('${g.id}')">${active ? 'идёт' : 'Продолжить'}</button>
             <button class="mini-btn" onclick="cancelTraining('${g.id}')">Прервать</button>
           </div>
         </div>`;
    } else {
      action = `<button class="mini-btn primary" onclick="trainGlad('${g.id}')">Тренировать • ${TRAINING_COST}з</button>`;
    }

    return `<div class="train-row ${busy ? 'busy' : ''}">
      <div class="tr-info">
        <span class="tr-name">${g.name}</span>
        <span class="tr-hp">ур. ${g.level} • опыт ${g.xp}/${need} • норма ${fmtTime(trainingNeedMs(g.level))}</span>
      </div>
      <div class="tr-bar"><i style="width:${xpPct}%;background:#7f9ad1"></i></div>
      ${action}
    </div>`;
  }).join('');

  const tg = document.getElementById('training-gold');
  if (tg) tg.textContent = STATE.gold;
  startTrainingAnim();
  renderTrainGamePanel();
}

// ---------- панель мини-игры ----------
function renderTrainGamePanel() {
  const box = document.getElementById('train-game');
  if (!box) return;
  if (!TRAIN_GAME.id || !trainState(TRAIN_GAME.id)) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  const g = STATE.roster.find(x => x.id === TRAIN_GAME.id);
  const prog = trainProgress(TRAIN_GAME.id) || 0;
  const acc = trainAccuracy(TRAIN_GAME.id);
  box.style.display = 'block';
  box.innerHTML = `
    <div class="tg-head">
      <span class="tg-name">🥁 ${g ? g.name : 'Боец'}</span>
      <span class="tg-prog">осталось <b id="tg-time">${fmtTime(trainRemaining(TRAIN_GAME.id))}</b></span>
    </div>
    <div class="tg-bar"><i id="tg-bar-fill" style="width:${Math.round(prog * 100)}%"></i></div>
    <div class="tg-pads">
      ${TRAIN_KEYS.map(k => `<button class="tg-pad" data-lane="${k.lane}" onclick="trainHitLane(${k.lane})">
        <b>${k.key}</b><span>удар</span>
      </button>`).join('')}
    </div>
    <div class="tg-stats">
      <span>точность: <b id="tg-acc" style="color:${acc >= TRAIN_PASS_RATE ? '#a8e0a0' : '#ffb0a0'}">${Math.round(acc * 100)}%</b> <small>(нужно ${Math.round(TRAIN_PASS_RATE * 100)}%)</small></span>
      <span>серия: <b id="tg-combo">${TRAIN_GAME.combo}</b></span>
      <span>промахов: <b id="tg-miss">${TRAIN_GAME.misses}</b></span>
    </div>
  `;
}

function trainPadFlash(lane, kind) {
  const pads = document.querySelectorAll('#train-game .tg-pad');
  const pad = pads[lane];
  if (!pad) return;
  pad.classList.remove('hit', 'miss');
  void pad.offsetWidth;
  pad.classList.add(kind);
}

// ---------- запуск / остановка ----------
function startTrainingGame(id) {
  const t = trainState(id);
  if (!t) return;
  if (TRAIN_GAME.id && TRAIN_GAME.id !== id) {
    // Одновременно работает только один боец
    stopTrainingGame();
  }
  TRAIN_GAME.id = id;
  TRAIN_GAME.running = true;
  TRAIN_GAME.lane = Math.floor(Math.random() * TRAIN_KEYS.length);
  TRAIN_GAME.beat = 0;
  TRAIN_GAME.nextBeatAt = 0;
  TRAIN_GAME.lastTs = 0;
  TRAIN_GAME.combo = 0;
  TRAIN_GAME.best = 0;
  TRAIN_GAME.misses = 0;
  TRAIN_GAME.beatResolved = false;
  renderTrainGamePanel();
  startTrainingAnim();
  addToast('Ритм пошёл. Бейте в такт!');
}

function stopTrainingGame(silent) {
  TRAIN_GAME.running = false;
  TRAIN_GAME.id = null;
  TRAIN_GAME.combo = 0;
  renderTrainGamePanel();
  if (!silent) renderTraining();
}

// Уход с экрана: ритм замирает, набранный прогресс остаётся в сейве
function pauseTrainingGame() {
  if (!TRAIN_GAME.running) return;
  TRAIN_GAME.running = false;
  TRAIN_GAME.combo = 0;
  if (typeof Save !== 'undefined') Save.autosave();
}

function cancelTraining(id) {
  const t = trainState(id);
  if (!t) return;
  if (!confirm('Прервать тренировку? Заплаченные деньги не вернутся.')) return;
  if (!STATE.training) STATE.training = {};
  delete STATE.training[id];
  if (TRAIN_GAME.id === id) stopTrainingGame(true);
  sfx('error');
  renderTraining();
  addToast('Тренировка прервана.');
  if (typeof Save !== 'undefined') Save.autosave();
}

// ---------- ритм ----------
function trainBeatStep(now) {
  const g = TRAIN_GAME;
  const t = trainState(g.id);
  if (!t) { stopTrainingGame(true); return; }
  g.nextBeatAt = now + TRAIN_BEAT_MS;
  g.beatResolved = false;
  // Паттерн: иногда та же дорожка, иногда соседняя — так живее
  if (g.beat > 0 && Math.random() < 0.35) {
    g.lane = (g.lane + (Math.random() < 0.5 ? 1 : -1) + 4) % 4;
  } else {
    g.lane = Math.floor(Math.random() * 4);
  }
  g.beat++;
  // Музыка: сильная доля каждые четыре такта
  try {
    if (g.beat % 4 === 1) sfx('beatStrong'); else sfx('beat');
    sfx('melody' + (g.lane + 1));
  } catch (e) {}
}

// Нажатие: клавиша или кнопка. Возвращает true при точном ударе.
// Только настоящее попадание: нота уже «приехала» на дорожку.
// Раньше игрок мог нажать кнопку заранее — до того как нота появится —
// и это засчитывалось как точный удар. Теперь проверка строгая:
// нажатие работает только в окне [nextBeatAt - WINDOW, nextBeatAt + WINDOW].
function trainHitLane(lane) {
  const g = TRAIN_GAME;
  if (!g.running || !g.id) return false;
  const t = trainState(g.id);
  if (!t) return false;
  const now = performance.now();
  const until = now - g.nextBeatAt;
  const good = lane === g.lane && Math.abs(until) <= TRAIN_WINDOW_MS;
  if (!g.beatResolved) {
    t.beats = (t.beats || 0) + 1;
    if (good) {
      t.hits = (t.hits || 0) + 1;
      g.combo++;
      g.best = Math.max(g.best, g.combo);
      g.flash = 1;
      g.laneFlash[lane] = 1;
      sfx('rhythmHit');
      trainPadFlash(lane, 'hit');
      // Такт закрыт — сразу выдаём следующий, чтобы не было двойных попаданий
      trainBeatStep(now);
    } else {
      // Не та дорожка или не вовремя:
      //   • если нота уже «приехала» (until >= -WINDOW) — это промах
      //   • если нота ещё не приехала — просто игнор, без штрафа
      if (until >= -TRAIN_WINDOW_MS) {
        g.misses++;
        g.combo = 0;
        sfx('rhythmMiss');
        trainPadFlash(lane, 'miss');
      }
    }
    g.beatResolved = true;
  } else {
    // Такт уже решён, повторное нажатие игнорируем
    return false;
  }
  updateTrainStats();
  return good;
}

// Пропуск ноты: время такта истекло, а удара не было
function trainMissBeat() {
  const g = TRAIN_GAME;
  const t = trainState(g.id);
  if (!t) { stopTrainingGame(true); return; }
  if (!g.beatResolved) {
    t.beats = (t.beats || 0) + 1;
    g.beatResolved = true;
  }
  g.misses++;
  g.combo = 0;
  sfx('rhythmMiss');
  updateTrainStats();
}

// Обновляем цифры панели: серия, лучшая, точность
function updateTrainStats() {
  const g = TRAIN_GAME;
  const comboEl = document.getElementById('tg-combo');
  const bestEl = document.getElementById('tg-best');
  const accEl = document.getElementById('tg-acc');
  const missEl = document.getElementById('tg-miss');
  if (comboEl) comboEl.textContent = g.combo;
  if (bestEl) bestEl.textContent = g.best;
  if (missEl) missEl.textContent = g.misses;
  if (accEl) {
    const acc = g.id ? trainAccuracy(g.id) : 1;
    accEl.textContent = Math.round(acc * 100) + '%';
    accEl.style.color = acc >= TRAIN_PASS_RATE ? '#a8e0a0' : '#ffb0a0';
  }
}

// Часы тренировки: идут сами, попадания лишь влияют на зачёт
function updateTrainClock(dt) {
  const g = TRAIN_GAME;
  if (!g.running || !g.id) return;
  const t = trainState(g.id);
  if (!t) { stopTrainingGame(true); return; }
  t.elapsed = Math.min(t.need, (t.elapsed || 0) + dt * 1000);
  const timeEl = document.getElementById('tg-time');
  if (timeEl) timeEl.textContent = fmtTime(trainRemaining(g.id));
  const barEl = document.getElementById('tg-bar-fill');
  if (barEl) barEl.style.width = Math.round((t.elapsed / t.need) * 100) + '%';
  if (t.elapsed >= t.need) finishTraining(g.id);
}

// Клавиатура: A S D F во время мини-игры
document.addEventListener('keydown', e => {
  if (!TRAIN_GAME.running) return;
  if (STATE.currentLocation !== 'training') return;
  const k = TRAIN_KEYS.find(x => x.code === e.code);
  if (!k) return;
  e.preventDefault();
  trainHitLane(k.lane);
});

// ---------- отрисовка ----------
function startTrainingAnim() {
  if (trainingRaf) return;
  trainingTs = 0;
  const step = ts => {
    if (STATE.currentLocation !== 'training') { trainingRaf = null; trainingTs = 0; return; }
    const dt = trainingTs ? Math.min((ts - trainingTs) / 1000, 0.05) : 0.016;
    trainingTs = ts;
    drawTrainingFrame(dt, ts);
    trainingRaf = requestAnimationFrame(step);
  };
  trainingRaf = requestAnimationFrame(step);
}

function stopTrainingAnim() {
  if (trainingRaf) cancelAnimationFrame(trainingRaf);
  trainingRaf = null;
  trainingTs = 0;
}

function drawTrainingFrame(dt, ts) {
  const cv = document.getElementById('trainingCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const t = performance.now() / 1000;
  const g = TRAIN_GAME;

  // Ритм: время тренировки течёт само, такты идут по метроному
  if (g.running && g.id) {
    const now = ts || performance.now();
    updateTrainClock(dt);
    if (!g.nextBeatAt) trainBeatStep(now);
    else if (now > g.nextBeatAt + TRAIN_WINDOW_MS + 60) {
      // Ноту пропустили
      trainMissBeat();
      trainBeatStep(now);
    }
  }

  ctx.clearRect(0, 0, W, H);

  // Небо и стена лудуса
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, '#3a4a5e');
  sky.addColorStop(1, '#b08a5a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.62);

  // Стена с арками
  ctx.fillStyle = '#6a5238';
  ctx.fillRect(0, H * 0.34, W, H * 0.28);
  for (let i = 0; i < 9; i++) {
    const ax = 20 + i * (W - 40) / 9;
    ctx.fillStyle = 'rgba(30,20,12,0.7)';
    ctx.beginPath();
    ctx.moveTo(ax, H * 0.60);
    ctx.lineTo(ax, H * 0.44);
    ctx.quadraticCurveTo(ax + 22, H * 0.36, ax + 44, H * 0.44);
    ctx.lineTo(ax + 44, H * 0.60);
    ctx.closePath();
    ctx.fill();
  }

  // Двор: утоптанная земля
  const gr = ctx.createLinearGradient(0, H * 0.60, 0, H);
  gr.addColorStop(0, '#9a7f56');
  gr.addColorStop(1, '#5a4630');
  ctx.fillStyle = gr;
  ctx.fillRect(0, H * 0.60, W, H * 0.40);

  // Трава по краям
  ctx.fillStyle = 'rgba(92,120,64,0.5)';
  ctx.beginPath();
  ctx.ellipse(W * 0.08, H * 0.94, W * 0.12, H * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(W * 0.94, H * 0.9, W * 0.1, H * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  const groundY = H * 0.86;

  // --- Боец бьёт по щиту ---
  const fighter = g.id ? STATE.roster.find(x => x.id === g.id) : STATE.roster[0];
  const swingPhase = g.running ? (1 - Math.min(1, Math.abs(g.nextBeatAt - (ts || performance.now())) / TRAIN_BEAT_MS)) : (t * 0.9) % 1;
  const swing = g.running ? Math.max(0, Math.sin(swingPhase * Math.PI)) : Math.max(0, Math.sin(((t * 0.9) % 1) * Math.PI * 2));
  if (fighter) {
    drawBattleBrother(ctx, fighter, W * 0.30, groundY, 1.05, 1, {
      walk: 0, swing, breath: 1.2, emotion: 'angry'
    });
  }

  // Щит-мишень
  const sx = W * 0.52;
  const sy = groundY - H * 0.26;
  ctx.fillStyle = '#6a4a2a';
  ctx.beginPath(); ctx.ellipse(sx, sy, 46, 54, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a6a3a';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.ellipse(sx, sy, 40, 48, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#c9a45c';
  ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill();

  // --- Дорожки ритма ---
  const laneX0 = W * 0.60;
  const laneW = W * 0.36;
  const laneH = 26;
  const laneGap = 12;
  const top = H * 0.20;

  ctx.textAlign = 'left';
  for (let i = 0; i < 4; i++) {
    const y = top + i * (laneH + laneGap);
    const active = g.running && i === g.lane;
    // Дорожка
    ctx.fillStyle = active ? 'rgba(229,181,79,0.16)' : 'rgba(20,14,10,0.55)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(laneX0, y, laneW, laneH, 8) : ctx.rect(laneX0, y, laneW, laneH);
    ctx.fill();
    ctx.strokeStyle = active ? 'rgba(229,181,79,0.6)' : 'rgba(120,100,74,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Клавиша слева
    ctx.fillStyle = active ? '#e5b54f' : '#8a7a68';
    ctx.font = 'bold 15px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(TRAIN_KEYS[i].key, laneX0 - 18, y + laneH * 0.68);

    // Линия удара
    const hitX = laneX0 + laneW - 26;
    ctx.strokeStyle = 'rgba(240,224,184,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hitX, y + 2);
    ctx.lineTo(hitX, y + laneH - 2);
    ctx.stroke();

    // Метка бежит к линии удара
    if (g.running && i === g.lane) {
      const p = clamp01(1 - (g.nextBeatAt - (ts || performance.now())) / TRAIN_BEAT_MS);
      const mx = laneX0 + 16 + (hitX - laneX0 - 16) * p;
      const near = Math.abs(g.nextBeatAt - (ts || performance.now())) <= TRAIN_WINDOW_MS;
      ctx.fillStyle = near ? '#fff3c4' : '#e5b54f';
      ctx.beginPath();
      ctx.arc(mx, y + laneH / 2, near ? 11 : 8, 0, Math.PI * 2);
      ctx.fill();
      if (near) {
        ctx.strokeStyle = 'rgba(255,243,196,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mx, y + laneH / 2, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Вспышка на попадании
  if (g.flash > 0) {
    g.flash = Math.max(0, g.flash - dt * 4);
    ctx.fillStyle = `rgba(255,240,190,${g.flash * 0.16})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Подписи
  ctx.fillStyle = 'rgba(240,224,184,0.85)';
  ctx.font = 'bold 12px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  if (g.running) {
    const prog = g.id ? trainProgress(g.id) : 0;
    ctx.fillText(`серия ${g.combo} • прогресс ${Math.round((prog || 0) * 100)}%`, W * 0.78, H * 0.12);
  } else {
    ctx.fillText('выберите бойца и нажмите «Тренировать»', W * 0.78, H * 0.12);
  }
  ctx.fillText('ритм ударов', W * 0.78, H - 10);
  ctx.textAlign = 'left';
}

function trainGlad(id) {
  const g = STATE.roster.find(x => x.id === id);
  if (!g) return;
  if (isTraining(id)) return addToast(`${g.name} уже тренируется.`);
  if (STATE.gold < TRAINING_COST) return alert('Недостаточно золота!');

  STATE.gold -= TRAINING_COST;
  if (!STATE.training) STATE.training = {};
  STATE.training[id] = { elapsed: 0, need: trainingNeedMs(g.level), beats: 0, hits: 0 };

  sfx('click');
  updateUI();
  renderTraining();
  startTrainingGame(id);
  addToast(`${g.name} выходит на площадку: ${fmtTime(trainingNeedMs(g.level))} чистого ритма.`);
  if (typeof Save !== 'undefined') Save.autosave();
}
// ==================== ПРОМЫСЕЛ: РЫБАЛКА И ОХОТА ====================
// Мини-игра «поймай момент»: метка бегает по полосе, нужно нажать в
// зелёной зоне. Три удачных раза — улов. Награда скромная: примерно
// половина золота среднего боя, чтобы промысел не заменял арену.
const WORK = {
  type: 'fishing',
  running: false,
  pos: 0,
  dir: 1,
  speed: 0.85,
  zone: [0.40, 0.60],
  caught: 0,
  attempts: 0,
  flash: 0,
  flashKind: '',
  msg: '',
  raf: null,
  ts: 0
};

function workDef() { return WORK_TYPES[WORK.type] || WORK_TYPES.fishing; }

function renderWork() {
  const tabs = document.getElementById('work-tabs');
  if (tabs) {
    tabs.innerHTML = Object.values(WORK_TYPES).map(w =>
      `<button class="work-tab ${WORK.type === w.id ? 'on' : ''}" onclick="setWorkType('${w.id}')">
        <span class="wt-ico">${w.icon}</span>
        <span class="wt-name">${w.name}</span>
        <span class="wt-sub">${w.desc}</span>
        <span class="wt-pay">до ${w.gold}з</span>
      </button>`).join('');
  }
  const fg = document.getElementById('fishing-gold');
  if (fg) fg.textContent = STATE.gold;
  const hint = document.getElementById('work-hint');
  if (hint) hint.textContent = workDef().hint + ' • удачных попыток: ' + WORK.caught + '/' + workDef().need;
  const btn = document.getElementById('work-btn');
  if (btn) btn.textContent = WORK.running ? 'Подсекать!' : (WORK.caught ? 'Продолжить' : 'Начать');
  startWorkAnim();
  drawWorkFrame(0);
}

function setWorkType(id) {
  if (WORK.running) return;
  if (!WORK_TYPES[id]) return;
  WORK.type = id;
  WORK.caught = 0;
  WORK.attempts = 0;
  WORK.msg = '';
  sfx('click');
  renderWork();
}

function startWorkAnim() {
  if (WORK.raf) return;
  WORK.ts = 0;
  const step = ts => {
    if (STATE.currentLocation !== 'fishing') { WORK.raf = null; WORK.ts = 0; return; }
    const dt = WORK.ts ? Math.min((ts - WORK.ts) / 1000, 0.05) : 0.016;
    WORK.ts = ts;
    updateWork(dt);
    drawWorkFrame(dt);
    WORK.raf = requestAnimationFrame(step);
  };
  WORK.raf = requestAnimationFrame(step);
}

function stopWorkAnim() {
  if (WORK.raf) cancelAnimationFrame(WORK.raf);
  WORK.raf = null;
  WORK.ts = 0;
  WORK.running = false;
}

function updateWork(dt) {
  if (!WORK.running) return;
  WORK.pos += WORK.dir * WORK.speed * dt;
  if (WORK.pos >= 1) { WORK.pos = 1; WORK.dir = -1; }
  if (WORK.pos <= 0) { WORK.pos = 0; WORK.dir = 1; }
  if (WORK.flash > 0) WORK.flash = Math.max(0, WORK.flash - dt * 2.2);
}

function workAction() {
  const def = workDef();
  if (!WORK.running) {
    WORK.running = true;
    WORK.pos = 0;
    WORK.dir = 1;
    WORK.caught = 0;
    WORK.attempts = 0;
    WORK.msg = 'Ждите нужного мгновения…';
    // Чем больше попыток, тем шире окно — новичку не так обидно
    WORK.zone = [0.40, 0.60];
    sfx('click');
    renderWork();
    return;
  }
  WORK.attempts++;
  const inZone = WORK.pos >= WORK.zone[0] && WORK.pos <= WORK.zone[1];
  if (inZone) {
    WORK.caught++;
    WORK.flash = 1;
    WORK.flashKind = 'good';
    sfx('coin');
    if (WORK.caught >= def.need) {
      WORK.running = false;
      const gold = def.gold;
      STATE.gold += gold;
      const who = STATE.roster[0];
      if (who) { who.xp += def.xp; applyLevelUps(who); }
      STATE.day++;
      WORK.msg = `Улов! +${gold} золота${who ? ', ' + who.name + ' +' + def.xp + ' опыта' : ''}`;
      addToast(`${def.icon} ${def.name}: +${gold} золота`);
      sfx('levelup');
      updateUI();
      if (typeof Save !== 'undefined') Save.autosave();
    } else {
      WORK.msg = `Есть! ${WORK.caught}/${def.need}`;
    }
  } else {
    WORK.flash = 1;
    WORK.flashKind = 'bad';
    sfx('miss');
    WORK.msg = 'Сорвалось…';
    // Неудача сужает окно чуть-чуть, но не больше предела
    WORK.zone = [WORK.zone[0] + 0.02, WORK.zone[1] - 0.02];
    if (WORK.zone[1] - WORK.zone[0] < 0.1) WORK.zone = [0.45, 0.55];
  }
  renderWork();
}

// Пробел — действие промысла
document.addEventListener('keydown', e => {
  if (e.code !== 'Space') return;
  if (STATE.currentLocation !== 'fishing') return;
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  workAction();
});

function drawWorkFrame(dt) {
  const cv = document.getElementById('workCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const def = workDef();
  const fishing = def.id === 'fishing';
  const t = performance.now() / 1000;

  ctx.clearRect(0, 0, W, H);

  // Фон: море или лес
  if (fishing) {
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.5);
    sky.addColorStop(0, '#4a6a86');
    sky.addColorStop(1, '#c9a97a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.5);
    const sea = ctx.createLinearGradient(0, H * 0.42, 0, H);
    sea.addColorStop(0, '#3a6a8a');
    sea.addColorStop(1, '#1e3a52');
    ctx.fillStyle = sea;
    ctx.fillRect(0, H * 0.42, W, H * 0.58);
    // Волны
    ctx.strokeStyle = 'rgba(200,230,245,0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = H * 0.5 + i * 20;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 12) {
        const yy = y + Math.sin((x * 0.02) + t * 1.2 + i) * 3;
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // Лодка
    ctx.fillStyle = '#6a4a2e';
    ctx.beginPath();
    ctx.moveTo(W * 0.18, H * 0.62);
    ctx.quadraticCurveTo(W * 0.30, H * 0.74, W * 0.44, H * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c9b48a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W * 0.31, H * 0.63);
    ctx.lineTo(W * 0.31, H * 0.36);
    ctx.stroke();
    // Леска и поплавок
    const bobX = W * 0.31 + 60 + Math.sin(t * 1.4) * 6;
    const bobY = H * 0.66 + Math.sin(t * 2.2) * 4;
    ctx.strokeStyle = 'rgba(230,240,250,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(W * 0.31, H * 0.36);
    ctx.quadraticCurveTo(bobX, H * 0.46, bobX, bobY);
    ctx.stroke();
    ctx.fillStyle = WORK.running ? '#e5b54f' : '#c05040';
    ctx.beginPath();
    ctx.arc(bobX, bobY, 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    sky.addColorStop(0, '#6a8a5a');
    sky.addColorStop(1, '#d8c48a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.55);
    // Деревья
    for (let i = 0; i < 7; i++) {
      const x = 40 + i * (W - 80) / 7 + Math.sin(i * 3.1) * 14;
      const h = H * (0.22 + (i % 3) * 0.05);
      ctx.fillStyle = '#3a5236';
      ctx.beginPath();
      ctx.moveTo(x, H * 0.60 - h);
      ctx.lineTo(x - 34, H * 0.60);
      ctx.lineTo(x + 34, H * 0.60);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4a3520';
      ctx.fillRect(x - 5, H * 0.58, 10, 16);
    }
    ctx.fillStyle = '#4a6a3a';
    ctx.fillRect(0, H * 0.58, W, H * 0.42);
    ctx.fillStyle = 'rgba(30,50,25,0.25)';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(W * (0.12 + i * 0.2), H * 0.86, 60, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Кусты, из которых выходит зверь
    ctx.fillStyle = '#2e4a2c';
    ctx.beginPath();
    ctx.ellipse(W * 0.62, H * 0.66, 90, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    if (WORK.running) {
      const px = W * 0.62 + Math.sin(t * 2) * 8;
      ctx.fillStyle = '#7a5230';
      ctx.beginPath();
      ctx.ellipse(px, H * 0.64, 26, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a3a20';
      ctx.beginPath();
      ctx.arc(px + 24, H * 0.60, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5a3a20';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + 28, H * 0.575); ctx.lineTo(px + 34, H * 0.545);
      ctx.moveTo(px + 20, H * 0.575); ctx.lineTo(px + 16, H * 0.545);
      ctx.stroke();
    }
    // Лучник
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(W * 0.24, H * 0.60, 8, 34);
    ctx.beginPath();
    ctx.arc(W * 0.244, H * 0.585, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Полоса «поймай момент» ---
  const barX = W * 0.10;
  const barW = W * 0.80;
  const barY = H * 0.90;
  const barH = 18;
  ctx.fillStyle = 'rgba(10,10,12,0.6)';
  ctx.fillRect(barX - 4, barY - 4, barW + 8, barH + 8);
  ctx.fillStyle = '#20262e';
  ctx.fillRect(barX, barY, barW, barH);
  // Зона
  const zx = barX + barW * WORK.zone[0];
  const zw = barW * (WORK.zone[1] - WORK.zone[0]);
  const zoneGrad = ctx.createLinearGradient(zx, 0, zx + zw, 0);
  zoneGrad.addColorStop(0, 'rgba(120,200,120,0.45)');
  zoneGrad.addColorStop(0.5, 'rgba(150,230,150,0.9)');
  zoneGrad.addColorStop(1, 'rgba(120,200,120,0.45)');
  ctx.fillStyle = zoneGrad;
  ctx.fillRect(zx, barY, zw, barH);
  // Метка
  const mx = barX + barW * WORK.pos;
  ctx.fillStyle = WORK.running ? '#fff3c4' : '#8a8a92';
  ctx.fillRect(mx - 3, barY - 7, 6, barH + 14);
  ctx.fillStyle = 'rgba(255,243,196,0.35)';
  ctx.beginPath();
  ctx.arc(mx, barY + barH / 2, 13, 0, Math.PI * 2);
  ctx.fill();

  // Вспышка результата
  if (WORK.flash > 0) {
    ctx.fillStyle = WORK.flashKind === 'good'
      ? `rgba(150,230,150,${WORK.flash * 0.20})`
      : `rgba(220,90,70,${WORK.flash * 0.20})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Сообщение
  ctx.fillStyle = 'rgba(240,232,210,0.92)';
  ctx.font = 'bold 14px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  if (WORK.msg) ctx.fillText(WORK.msg, W / 2, H * 0.18);
  ctx.font = '12px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(220,215,200,0.75)';
  ctx.fillText(`${def.name} • ${WORK.caught}/${def.need} • награда до ${def.gold}з`, W / 2, H * 0.12);
  ctx.textAlign = 'left';
}



// ==================== АРЕНА ====================
function renderArenaScreen() {
  renderArenaSquad();
  renderArenaList();
}

function renderArenaSquad() {
  const squadEl = document.getElementById('arena-squad');
  if (!squadEl) return;
  const squad = STATE.squad.map(findFighter).filter(Boolean);

  squadEl.innerHTML = `
    <div class="squad-slots">
      ${[0, 1, 2].map(i => {
        const g = squad[i];
        if (!g) return `<div class="squad-slot empty"><span>+</span><small>свободно</small></div>`;
        const role = deriveRole(g);
        const pct = (g.hp / g.maxHp) * 100;
        const lost = lostLimbs(g);
        return `<div class="squad-slot filled">
          <span class="ss-role">${g.isDog ? '🐕' : ROLE_ICONS[role]}</span>
          <span class="ss-name">${g.name}</span>
          <span class="ss-lvl">ур.${g.level}</span>
          ${lost.length ? `<span class="ss-lost">✕${lost.length}</span>` : ''}
          <div class="ss-bar"><i style="width:${pct}%"></i></div>
          <button class="ss-remove" onclick="toggleSquad('${g.id}')">×</button>
        </div>`;
      }).join('')}
    </div>
    <div class="mode-picker">
      <span class="mp-label">Режим</span>
      <button class="chip ${STATE.modeSel === 'manual' ? 'on' : ''}" onclick="setMode('manual')">🎮 Ручной</button>
      <button class="chip ${STATE.modeSel === 'auto' ? 'on' : ''}" onclick="setMode('auto')">🤖 Автобой</button>
      <button class="wide-btn small" onclick="goTo('barracks')">Отряд</button>
    </div>
  `;
}

function setMode(m) {
  STATE.modeSel = m;
  renderArenaSquad();
  renderArenaList();
}

// В Колизее арену выбрать нельзя: только сложность. Арена выпадает случайно.
function renderArenaList() {
  const grid = document.getElementById('arena-teams');
  if (!grid) return;
  const squad = STATE.squad.map(findFighter).filter(Boolean);
  const squadOk = squad.length > 0 && squad.every(g => g.hp > 0);
  const wins = STATE.wins || 0;
  const boss = bossForWinCount(wins);
  const next = nextBossAfter(wins);

  const bossCard = boss
    ? `<div class="boss-card">
        <div class="bc-head">
          <span class="bc-crown">👑</span>
          <div>
            <div class="bc-name">${boss.name}</div>
            <div class="bc-title">${boss.title} • выходит на ${boss.winAt}-й победе</div>
          </div>
        </div>
        <div class="bc-intro">«${boss.intro}»</div>
        <div class="bc-abilities">
          ${boss.abilities.map(a => `<span class="bc-ab">✦ ${a.name}</span>`).join('')}
        </div>
        <div class="bc-loot">Трофеи: ${(boss.loot || []).map(id => itemById(id) ? itemById(id).name : id).join(' • ')}</div>
        <div class="bc-note">Один на один. Уровень сложности здесь не выбирается — босс всегда бьётся в полную силу.</div>
        <div class="bc-actions">
          <button class="tr-go boss" ${squadOk ? '' : 'disabled'}
            onclick="openDeploy('mid', '${boss.id}')">👑 Выйти против босса</button>
        </div>
      </div>`
    : `<div class="boss-card next">
        <div class="bc-head">
          <span class="bc-crown">⚔️</span>
          <div>
            <div class="bc-name">${next ? next.name : 'Все боссы повержены'}</div>
            <div class="bc-title">${next ? `выйдет на песок на ${next.winAt}-й победе` : 'Вы прошли арену до конца'}</div>
          </div>
        </div>
        <div class="bc-intro">Побед всего: <b>${wins}</b>. До босса осталось <b>${next ? next.winAt - wins : 0}</b>.</div>
      </div>`;

  grid.innerHTML = bossCard + ARENA_TIERS.map(tier => {
    const match = buildMatch(null, tier.id, null);
    const chance = squadOk ? estimateWinChance(squad, match.units, tier) : 0;
    const diffClass = chance >= 65 ? 'good' : chance >= 40 ? 'even' : 'hard';
    return `<div class="tier-row">
      <div class="tr-tier">
        <span class="tr-dot" style="background:${tier.color}"></span>
        <span class="tr-name">${tier.short}</span>
      </div>
      <div class="tr-info">
        <div class="tr-match">${tier.label}</div>
        <div class="tr-sub">${tier.desc}</div>
      </div>
      <div class="tr-chance ${diffClass}">
        <span class="trc-val">${squadOk ? chance + '%' : '—'}</span>
        <span class="trc-lbl">шанс</span>
      </div>
      <div class="tr-reward">
        <span>💰 ${match.gold}</span>
        <span>✨ ${match.xp}</span>
      </div>
      <button class="tr-go" ${squadOk ? '' : 'disabled'} onclick="openDeploy('${tier.id}')">В бой</button>
    </div>`;
  }).join('');
}

// ==================== СЛОТЫ СОХРАНЕНИЙ ====================
// На старте игрок выбирает одно из пяти сохранений или начинает новую игру.
// Всё, что происходит дальше, автоматически пишется в выбранный слот.

function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function renderSlotGrid() {
  const grid = document.getElementById('slot-grid');
  if (!grid) return;
  const slots = (typeof Save !== 'undefined') ? Save.list() : [];
  grid.innerHTML = slots.map(s => {
    if (s.empty) {
      return `<button class="slot-card empty" onclick="chooseSlot(${s.slot}, true)">
        <div class="sc-num">Слот ${s.slot}</div>
        <div class="sc-empty">— пусто —</div>
        <div class="sc-action">➕ Новая игра</div>
      </button>`;
    }
    return `<button class="slot-card ${s.gameOver ? 'over' : ''}" onclick="chooseSlot(${s.slot}, false)">
      <div class="sc-num">Слот ${s.slot}</div>
      <div class="sc-leader">${s.leaderName} <span>ур. ${s.leaderLevel}</span></div>
      <div class="sc-stats">
        <span>💰 ${s.gold}</span>
        <span>🏆 ${s.fame}</span>
        <span>⚔️ ${s.wins}</span>
        <span>👥 ${s.fighters}</span>
      </div>
      <div class="sc-date">${fmtDate(s.savedAt)}</div>
      <div class="sc-action">${s.gameOver ? '☠️ игра окончена' : '▶ Продолжить'}</div>
      <span class="sc-del" onclick="event.stopPropagation(); deleteSlot(${s.slot})" title="Удалить">✕</span>
    </button>`;
  }).join('');
}

function chooseSlot(slot, isNew) {
  if (typeof Save === 'undefined') return alert('Сохранения недоступны в этом браузере.');
  STATE.slot = slot;
  if (isNew) {
    startNewGameInSlot(slot);
  } else {
    if (!Save.load(slot)) return alert('Не удалось загрузить сохранение.');
    // Восстановление сцены: экран слотов скрываем, идём в город
    showSlotScreen(false);
    refreshRecruits(false);
    if (!(STATE.kennelStock || []).length) refreshKennel(false);
    updateUI();
    goTo('city');
    addToast(`Слот ${slot}: игра загружена`);
    if (STATE.gameOver) showGameOver();
  }
}

function startNewGameInSlot(slot, opts) {
  const fresh = blankState();
  fresh.slot = slot;
  if (opts && opts.gold != null) fresh.gold = opts.gold;
  Object.keys(fresh).forEach(k => { STATE[k] = fresh[k]; });
  STATE.slot = slot;

  if (typeof EVENTS_RUNTIME !== 'undefined') {
    EVENTS_RUNTIME.history = [];
    EVENTS_RUNTIME.pending = null;
    EVENTS_RUNTIME.lastId = null;
  }

  showSlotScreen(false);
  refreshRecruits(false);
  refreshKennel(false);
  updateUI();
  goTo('city');
  if (typeof Save !== 'undefined') Save.save(slot);

  // Дальше — создание героя
  const modal = document.getElementById('creator-modal');
  if (modal) modal.style.display = 'flex';
  updateCreatorPreview();
}

function deleteSlot(slot) {
  if (!confirm(`Удалить сохранение в слоте ${slot}? Это необратимо.`)) return;
  if (typeof Save !== 'undefined') Save.remove(slot);
  renderSlotGrid();
}

function showSlotScreen(show) {
  const slots = document.getElementById('screen-slots');
  if (!slots) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  if (show) {
    slots.classList.add('active');
    renderSlotGrid();
    const top = document.getElementById('topbar');
    if (top) top.style.display = 'none';
  } else {
    const top = document.getElementById('topbar');
    if (top) top.style.display = '';
  }
}

// Меню сохранений внутри игры
function openSlotMenu() {
  const modal = document.getElementById('slot-modal');
  const body = document.getElementById('slot-modal-body');
  if (!modal || !body) return;
  const slots = (typeof Save !== 'undefined') ? Save.list() : [];
  body.innerHTML = slots.map(s => {
    const active = STATE.slot === s.slot;
    return `<div class="slot-row ${active ? 'active' : ''}">
      <div class="sr-info">
        <span class="sr-num">Слот ${s.slot}${active ? ' • текущий' : ''}</span>
        <span class="sr-sub">${s.empty ? 'пусто' : `${s.leaderName} • ур. ${s.leaderLevel} • ${fmtDate(s.savedAt)}`}</span>
      </div>
      <div class="sr-actions">
        <button class="mini-btn primary" onclick="saveToSlot(${s.slot})">💾 сохранить</button>
        ${s.empty ? '' : `<button class="mini-btn" onclick="loadFromSlot(${s.slot})">📂 загрузить</button>`}
        ${s.empty ? '' : `<button class="mini-btn" onclick="deleteSlot(${s.slot}); openSlotMenu()">🗑</button>`}
      </div>
    </div>`;
  }).join('');
  modal.style.display = 'flex';
}

function closeSlotMenu() {
  const m = document.getElementById('slot-modal');
  if (m) m.style.display = 'none';
}

function saveToSlot(slot) {
  if (typeof Save === 'undefined') return;
  if (Save.save(slot)) {
    STATE.slot = slot;
    addToast(`Сохранено в слот ${slot}`);
    openSlotMenu();
  } else {
    addToast('Не удалось сохранить');
  }
}

function loadFromSlot(slot) {
  if (typeof Save === 'undefined') return;
  if (COMBAT.active) return alert('Сначала завершите бой!');
  if (!Save.load(slot)) return addToast('Слот пуст');
  STATE.slot = slot;
  closeSlotMenu();
  refreshRecruits(false);
  if (!(STATE.kennelStock || []).length) refreshKennel(false);
  updateUI();
  goTo('city');
  addToast(`Загружен слот ${slot}`);
}

// ==================== ЧИТ-КОДЫ ====================
// Вводятся на стартовом экране под слотами.
// «goyda» — новая игра с балансом 99999 монет.
const CHEAT_CODES = {
  goyda: { gold: 99999, label: 'ГОЙДА! Казна не кончается.' }
};

function applyCheatCode() {
  const input = document.getElementById('cheat-input');
  const msg = document.getElementById('cheat-msg');
  if (!input) return;
  const code = input.value.trim().toLowerCase();
  input.value = '';
  const cheat = CHEAT_CODES[code];
  if (!cheat) {
    if (msg) { msg.textContent = 'Код не принят.'; msg.className = 'cheat-msg bad'; }
    sfx('error');
    return;
  }
  sfx('levelup');
  if (msg) { msg.textContent = cheat.label; msg.className = 'cheat-msg ok'; }

  // Ищем свободный слот, иначе берём первый
  let slot = 0;
  if (typeof Save !== 'undefined') {
    for (let i = 1; i <= Save.SLOTS; i++) {
      if (!Save.exists(i)) { slot = i; break; }
    }
    if (!slot) slot = 1;
  } else {
    slot = 1;
  }
  startNewGameInSlot(slot, { gold: cheat.gold });
}

// ==================== СЮЖЕТНЫЕ ЦЕЛИ ====================
// Панель справа в городе: что делать дальше и что за это дадут.
// Награда выдаётся один раз, отметка живёт в STATE.story.claimedGoals.
function goalState(goal) {
  const S = STATE;
  const story = S.story || (S.story = { step: 0, motherHealed: false, seen: [] });
  story.claimedGoals = story.claimedGoals || [];
  const claimed = story.claimedGoals.includes(goal.id);
  const raw = Math.max(0, Math.min(goal.need, goal.progress(S) || 0));
  return {
    goal,
    claimed,
    raw,
    done: raw >= goal.need,
    pct: Math.round((raw / goal.need) * 100)
  };
}

// Выдать награды за выполненные, но ещё не забранные цели
function claimGoals(silent) {
  const story = STATE.story || (STATE.story = { step: 0, motherHealed: false, seen: [] });
  story.claimedGoals = story.claimedGoals || [];
  const got = [];
  STORY_GOALS.forEach(goal => {
    const st = goalState(goal);
    if (st.done && !st.claimed) {
      story.claimedGoals.push(goal.id);
      const r = goal.reward || {};
      if (r.gold) STATE.gold += r.gold;
      if (r.fame) STATE.fame += r.fame;
      got.push({ goal, reward: r });
    }
  });
  if (got.length && !silent) {
    got.forEach(g => {
      const parts = [];
      if (g.reward.gold) parts.push(`+${g.reward.gold} 💰`);
      if (g.reward.fame) parts.push(`+${g.reward.fame} 🏆`);
      addToast(`🎯 Цель «${g.goal.title}» выполнена: ${parts.join(' ')}`);
    });
    sfx('levelup');
    if (typeof Save !== 'undefined') Save.autosave();
  }
  return got;
}

function renderGoals() {
  const el = document.getElementById('city-goals');
  if (!el) return;
  // Цели появляются постепенно: пока условие unlock не выполнено, цель скрыта.
  const states = STORY_GOALS.map(goalState);
  const visible = states.filter(s => {
    if (s.claimed) return true;               // выполненные не прячем
    if (typeof s.goal.unlock !== 'function') return true;
    try { return !!s.goal.unlock(STATE); } catch (e) { return true; }
  });
  const active = visible.filter(s => !s.claimed);
  const doneCount = visible.length - active.length;
  const collapsed = !!STATE.goalsCollapsed;

  const body = collapsed
    ? `<div class="goals-mini">${active.length} ${active.length === 1 ? 'цель' : 'цели'} в работе</div>`
    : `<div class="goals-list">
      ${active.length ? active.map(s => {
        const r = s.goal.reward || {};
        const parts = [];
        if (r.gold) parts.push(`${r.gold}з`);
        if (r.fame) parts.push(`${r.fame} славы`);
        return `<div class="goal ${s.done ? 'done' : ''}">
          <div class="goal-top">
            <span class="goal-ico">${s.goal.icon}</span>
            <span class="goal-title">${s.goal.title}</span>
            <span class="goal-pct">${s.raw}/${s.goal.need}</span>
          </div>
          <div class="goal-desc">${s.goal.desc}</div>
          <div class="goal-bar"><i style="width:${s.pct}%"></i></div>
          <div class="goal-reward">${s.done ? '✅ награда получена' : '🏅 ' + parts.join(' • ')}</div>
        </div>`;
      }).join('') : `<div class="empty-hint">Пока новых целей нет. Побеждайте на арене — они появятся.</div>`}
    </div>`;

  el.classList.toggle('collapsed', collapsed);
  el.innerHTML = `
    <button class="goals-head" onclick="toggleGoals()" title="${collapsed ? 'Развернуть цели' : 'Свернуть цели'}">
      <span>🎯 Цели</span>
      <span class="goals-count">${doneCount}/${visible.length}</span>
      <span class="goals-toggle">${collapsed ? '▸' : '▾'}</span>
    </button>
    ${body}
  `;
}

// Свернуть/развернуть панель целей. Состояние живёт в сейве.
function toggleGoals() {
  STATE.goalsCollapsed = !STATE.goalsCollapsed;
  sfx('click');
  renderGoals();
  if (typeof Save !== 'undefined') Save.autosave();
}

// ==================== СПРАВКА ====================
function openHelp(tab) {
  const modal = document.getElementById('help-modal');
  const body = document.getElementById('help-body');
  if (!modal || !body) return;
  const active = tab || 'guide';

  const tabs = [
    { id: 'guide', name: 'Инструкция', icon: '📖' },
    { id: 'classes', name: 'Классы', icon: '🎖️' },
    { id: 'dogs', name: 'Собаки', icon: '🐕' },
    { id: 'faq', name: 'Вопросы', icon: '❓' }
  ];

  let content = '';
  if (active === 'guide') {
    content = `<div class="help-list">${HELP_GUIDE.map(h => `<div class="help-item">
      <div class="hi-head"><span class="hi-ico">${h.icon}</span><span>${h.title}</span></div>
      <div class="hi-text">${h.text}</div>
    </div>`).join('')}</div>`;
  } else if (active === 'classes') {
    content = `<div class="help-list">${HELP_CLASSES.map(c => `<div class="help-item">
      <div class="hi-head"><span class="hi-ico">${c.icon}</span><span>${c.name}</span></div>
      <div class="hi-perk">${c.perk}</div>
      <div class="hi-text">${c.text}</div>
    </div>`).join('')}</div>`;
  } else if (active === 'dogs') {
    content = `<div class="help-list">${HELP_DOGS.map(d => `<div class="help-item">
      <div class="hi-head"><span class="hi-ico">${d.icon}</span><span>${d.name}</span></div>
      <div class="hi-perk">${d.perk}</div>
      <div class="hi-text">${d.text}</div>
    </div>`).join('')}</div>`;
  } else {
    content = `<div class="help-list">${HELP_FAQ.map(f => `<div class="help-item">
      <div class="hi-head"><span class="hi-ico">❓</span><span>${f.q}</span></div>
      <div class="hi-text">${f.a}</div>
    </div>`).join('')}</div>`;
  }

  body.innerHTML = `
    <div class="help-tabs">
      ${tabs.map(t => `<button class="help-tab ${active === t.id ? 'on' : ''}" onclick="openHelp('${t.id}')">${t.icon} ${t.name}</button>`).join('')}
    </div>
    <div class="help-content">${content}</div>
  `;  modal.style.display = 'flex';
  sfx('open');
}

function closeHelp() {
  const m = document.getElementById('help-modal');
  if (m) m.style.display = 'none';
  sfx('close');
}

// ==================== СЮЖЕТ ====================
function showStoryModal(key) {
  const modal = document.getElementById('story-modal');
  const body = document.getElementById('story-body');
  if (!modal || !body) return;
  const s = STORY[key];
  if (!s) return;
  const title = typeof s === 'string' ? '📜 Весть' : s.title;
  const text = typeof s === 'string' ? s : s.text;
  body.innerHTML = `
    <h2>${title}</h2>
    <div class="story-text">${String(text).replace(/\n/g, '<br>')}</div>
  `;
  modal.style.display = 'flex';
  sfx('levelup');
}

function closeStoryModal() {
  const m = document.getElementById('story-modal');
  if (m) m.style.display = 'none';
  if (typeof Save !== 'undefined') Save.autosave();
}

// ==================== КОНЕЦ ИГРЫ ====================
function showGameOver() {
  const modal = document.getElementById('gameover-modal');
  const body = document.getElementById('gameover-body');
  if (!modal || !body) return;
  body.innerHTML = `
    <h2>☠️ Конец пути</h2>
    <div class="go-text">
      Отряд мёртв. Казна пуста. На нового гладиатора и на пса не хватает даже меди.
      Песок Рима помнит всех — и тебя тоже.
    </div>
    <div class="go-stats">
      <div><span>Побед</span><b>${STATE.wins || 0}</b></div>
      <div><span>Поражений</span><b>${STATE.losses || 0}</b></div>
      <div><span>Дней на арене</span><b>${STATE.day}</b></div>
      <div><span>Боссов повержено</span><b>${(STATE.bossesBeaten || []).length} / 5</b></div>
    </div>
  `;
  modal.style.display = 'flex';
  sfx('defeat');
}

function restartFromGameOver() {
  const m = document.getElementById('gameover-modal');
  if (m) m.style.display = 'none';
  if (typeof Save !== 'undefined' && STATE.slot) Save.remove(STATE.slot);
  showSlotScreen(true);
}

// ==================== UI ====================
function updateUI() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('ui-gold', STATE.gold);
  set('ui-fame', STATE.fame);
  set('ui-day', STATE.day);
  set('ui-roster-count', STATE.roster.length);
  set('ui-record', `${STATE.wins || 0}–${STATE.losses || 0}`);
}

// Карточка счёта побед и поражений
function openRecord() {
  const wins = STATE.wins || 0;
  const losses = STATE.losses || 0;
  const total = wins + losses;
  const pct = total ? Math.round((wins / total) * 100) : 0;
  addToast(
    `⚔️ Побед: ${wins} • 💀 Поражений: ${losses} • 📊 Боёв: ${total} (${pct}%) • ` +
    `🏆 Славы: ${STATE.fame || 0} • 👑 Боссов: ${(STATE.bossesBeaten || []).length}/5`
  );
}

let toastTimer = null;
function addToast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ==================== СТАРТ ====================
function initGame() {
  // Стартовый экран: выбор из 5 слотов (или новая игра)
  showSlotScreen(true);
  window.addEventListener('resize', () => {
    if (STATE.currentLocation === 'city') drawCityBackdrop();
  });
  // Музыка стартует после первого действия пользователя (требование браузеров)
  setTimeout(() => { try { SFX.startMusic(); } catch (e) {} }, 300);
}

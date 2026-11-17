// ==================== ОТРИСОВКА ГЛАДИАТОРОВ ====================
// Стиль Swords & Sandals: крупная голова, толстые конечности, жирный контур,
// два тона на объём. Всё векторно. Конечности можно потерять — они исчезают.

const OUTLINE = '#1b1410';
const BLOOD = '#8e1b12';
const BLOOD_DARK = '#5c0f0a';

function shade(hex, amt) {
  if (!hex) hex = '#888888';
  if (hex[0] !== '#') return hex;
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  } else {
    r = Math.round(r * (1 + amt));
    g = Math.round(g * (1 + amt));
    b = Math.round(b * (1 + amt));
  }
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function limb(ctx, x1, y1, x2, y2, w, color) {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = w + 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

const BUILD_W = { slim: 0.84, normal: 1, muscular: 1.1, heavy: 1.22 };

// Состояние конечностей: { hp, max, lost }
function limbState(glad, id) {
  const L = glad.limbs && glad.limbs[id];
  if (!L) return { hp: 100, max: 100, lost: false, ratio: 1 };
  return {
    hp: L.hp,
    max: L.max || 100,
    lost: !!L.lost,
    ratio: L.lost ? 0 : Math.max(0, L.hp / Math.max(1, L.max))
  };
}

// ==================== ГЛАВНАЯ ФУНКЦИЯ ====================
function drawBattleBrother(ctx, glad, x, y, scale = 1, facing = 1, anim = {}) {
  const a = {
    swing: anim.swing || 0,
    block: anim.block || 0,
    dodge: anim.dodge || 0,
    hurt: anim.hurt || 0,
    glow: anim.glow || 0,
    alpha: anim.alpha == null ? 1 : anim.alpha,
    lunge: anim.lunge || 0,
    walk: anim.walk || 0,
    walkPhase: anim.walkPhase || 0,
    dead: anim.dead || 0,
    victory: anim.victory || 0,
    crouch: anim.crouch || 0,
    blood: anim.blood || 0,
    breath: anim.breath == null ? 1 : anim.breath,
    emotion: anim.emotion || null,
    emotionT: anim.emotionT == null ? 1 : anim.emotionT,
    aura: anim.aura || null,
    aim: anim.aim || 0
  };

  // Псы рисуются отдельной функцией — у них другая анатомия
  if (glad.isDog) {
    drawBattleDog(ctx, glad, x, y, scale, facing, a);
    return;
  }

  // Живое дыхание и покачивание: работает даже когда боец стоит на месте
  const now = performance.now() / 1000;
  const seed = (glad.id || 'x').length * 0.73;
  const alive = 1 - a.dead;
  const breathAmt = a.breath * alive;
  const breathY = Math.sin(now * 1.75 + seed) * 1.7 * breathAmt;
  const breathS = 1 + Math.sin(now * 1.75 + seed) * 0.008 * breathAmt;
  const swayRot = Math.sin(now * 0.95 + seed * 1.7) * 0.014 * breathAmt;
  const headBob = Math.sin(now * 1.75 + seed + 0.6) * 0.9 * breathAmt;

  // Вертикальное покачивание корпуса при ходьбе: два шага за цикл,
  // максимум подъёма — когда ноги вместе.
  const walkCycle = a.walkPhase;
  const walkBob = -Math.abs(Math.sin(walkCycle)) * 2.4 * a.walk * alive;
  const walkLean = a.walk * 1.6;

  const eq = glad.equip || {};
  const female = glad.gender === 'female';
  const skin = glad.skinColor || '#f0b183';
  const skinDark = shade(skin, -0.2);
  const bw = BUILD_W[glad.build] || 1;
  const shoulder = (female ? 23 : 26) * bw * breathS;
  const waist = (female ? 15 : 18) * bw;
  const headR = female ? 25 : 26.5;

  const legL = limbState(glad, 'legL');
  const legR = limbState(glad, 'legR');
  const armL = limbState(glad, 'armL');
  const armR = limbState(glad, 'armR');
  const headS = limbState(glad, 'head');

  ctx.save();
  ctx.globalAlpha = a.alpha;

  // --- Тень ---
  ctx.save();
  ctx.globalAlpha = 0.3 * a.alpha;
  ctx.fillStyle = '#0a0705';
  ctx.beginPath();
  ctx.ellipse(x, y + 3 * scale, 42 * scale, 13 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- Аура активного бойца ---
  if (a.glow > 0.01) {
    const g = ctx.createRadialGradient(x, y - 62 * scale, 5, x, y - 62 * scale, 95 * scale);
    g.addColorStop(0, `rgba(255,214,110,${0.28 * a.glow})`);
    g.addColorStop(1, 'rgba(255,214,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y - 56 * scale, 92 * scale, 108 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Аура босса: собственный цвет, живая пульсация ---
  if (a.aura) {
    const p = 0.55 + 0.45 * Math.sin(now * 2.6 + seed);
    const g = ctx.createRadialGradient(x, y - 70 * scale, 6, x, y - 70 * scale, 118 * scale);
    g.addColorStop(0, hexA(a.aura, 0.26 + p * 0.16));
    g.addColorStop(0.55, hexA(a.aura, 0.10 + p * 0.06));
    g.addColorStop(1, hexA(a.aura, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y - 64 * scale, 112 * scale, 132 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Восходящие искры
    for (let i = 0; i < 5; i++) {
      const t = (now * 0.45 + i * 0.2) % 1;
      const sx = x + Math.sin(now * 1.1 + i * 2.1) * 26 * scale;
      const sy = y - (10 + t * 150) * scale;
      ctx.globalAlpha = (1 - t) * 0.55 * a.alpha;
      ctx.fillStyle = a.aura;
      ctx.beginPath();
      ctx.arc(sx, sy, (1.6 + (1 - t) * 1.6) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = a.alpha;
  }

  // --- Падение ---
  const deathRot = a.dead * 1.35;
  ctx.translate(x, y + (breathY + walkBob) * scale);
  if (a.dead > 0) {
    ctx.rotate(deathRot * facing);
    ctx.translate(0, a.dead * 10);
  }
  ctx.rotate(a.dodge * 0.14 * facing + swayRot * alive);
  ctx.scale(scale * facing * breathS, scale * breathS);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const lean = a.lunge * 5 + walkLean;
  const crouch = a.crouch * 6;
  const hipY = -32 + crouch;
  const footY = -5;

  // ============ НОГИ ============
  const legColor = eq.legs ? eq.legs.color : skin;
  const stepAmp = a.walk * 9;
  const liftAmp = a.walk * 5.5;

  // Фазы ног: противоположные. sin — горизонталь, cos>0 — фаза переноса.
  const phaseL = walkCycle + Math.PI;
  const phaseR = walkCycle;

  const footLX = -8 + Math.sin(phaseL) * stepAmp;
  const footRX = 8 + Math.sin(phaseR) * stepAmp;
  const liftL = Math.max(0, Math.cos(phaseL)) * liftAmp;
  const liftR = Math.max(0, Math.cos(phaseR)) * liftAmp;

  const geomL = { hipX: -8, hipY, footX: footLX, footY: footY - liftL, lift: liftL / Math.max(1, liftAmp || 1), lost: legL.lost };
  const geomR = { hipX: 8, hipY, footX: footRX, footY: footY - liftR, lift: liftR / Math.max(1, liftAmp || 1), lost: legR.lost };

  if (!legL.lost) drawLegSegmented(ctx, geomL, 13, legColor);
  else drawStump(ctx, -8, hipY, 13, legColor, 'down');
  if (!legR.lost) drawLegSegmented(ctx, geomR, 14, legColor);
  else drawStump(ctx, 8, hipY, 14, legColor, 'down');

  drawLegArmorNew(ctx, eq.legs, legColor, [geomL, geomR]);

  // ============ ТОРС ============
  const bodyColor = eq.body ? eq.body.color : skin;
  ctx.save();
  ctx.translate(lean, 0);

  ctx.beginPath();
  ctx.moveTo(-waist, hipY);
  ctx.quadraticCurveTo(-shoulder * 1.3, hipY - 30, -shoulder, hipY - 44);
  ctx.quadraticCurveTo(-shoulder * 0.8, hipY - 50, -shoulder * 0.35, hipY - 51);
  ctx.quadraticCurveTo(0, hipY - 53, shoulder * 0.35, hipY - 51);
  ctx.quadraticCurveTo(shoulder * 0.8, hipY - 50, shoulder, hipY - 44);
  ctx.quadraticCurveTo(shoulder * 1.3, hipY - 30, waist, hipY);
  ctx.quadraticCurveTo(0, hipY + 5, -waist, hipY);
  ctx.closePath();
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = shade(bodyColor, -0.22);
  ctx.beginPath();
  ctx.ellipse(-shoulder * 0.85, hipY - 26, shoulder * 0.55, 30, 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.ellipse(shoulder * 0.3, hipY - 36, shoulder * 0.42, 14, -0.3, 0, Math.PI * 2);
  ctx.fill();
  if (female) {
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath(); ctx.arc(-shoulder * 0.34, hipY - 26, shoulder * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(shoulder * 0.34, hipY - 26, shoulder * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  if (!eq.body) {
    ctx.strokeStyle = shade(skin, -0.3);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, hipY - 48); ctx.lineTo(0, hipY - 12);
    ctx.moveTo(-shoulder * 0.5, hipY - 34); ctx.quadraticCurveTo(-6, hipY - 30, -2, hipY - 32);
    ctx.moveTo(shoulder * 0.5, hipY - 34); ctx.quadraticCurveTo(6, hipY - 30, 2, hipY - 32);
    ctx.stroke();
    // Голая кожа — видно татуировки и раскраску
    drawBodyCosmetics(ctx, glad, shoulder, waist, hipY);
  } else {
    drawBodyArmorDetail(ctx, eq.body, shoulder, waist, hipY);
  }
  // Кровь на корпусе
  drawBloodOnTorso(ctx, glad, shoulder, waist, hipY, a.blood);
  ctx.restore();

  if (!eq.body) {
    ctx.fillStyle = '#4a3020';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    roundRect(ctx, -waist, hipY - 6, waist * 2, 11, 3);
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();

  // ============ ШЕЯ И ГОЛОВА ============
  const headY = -108 + crouch;
  if (!headS.lost) {
    limb(ctx, 0, hipY - 46, 0, hipY - 54, female ? 13 : 15, skinDark);
  } else {
    drawStump(ctx, 0, hipY - 46, female ? 13 : 15, skin, 'up');
  }

  // --- Дальняя рука с оружием ---
  // При ходьбе рука качается в противофазе ноге.
  // Оружие живёт своей жизнью: оно тяжелее кисти, поэтому отстаёт по фазе
  // (маятник) и догоняет руку с задержкой после размаха.
  const armWalkR = a.walk * Math.sin(walkCycle + Math.PI) * 0.42;
  const armWalkL = a.walk * Math.sin(walkCycle) * 0.34;

  // Сглаженное состояние снаряжения: переживает кадры, поэтому инерция
  // выглядит как настоящая, а не как телепорт угла.
  // carry — плавный переход в «походный» хват: на ходу боец держит оружие
  // остриём ОТ СЕБЯ (вперёд по направлению взгляда), а не задрав клинок к лицу.
  if (!glad._gear) glad._gear = { wpnLag: 0, wpnPrev: 0, shdLag: 0, shdPrev: 0, carry: 0 };
  const gear = glad._gear;
  const wpnMass = eq.weapon ? (eq.weapon.cat === 'polearm' || eq.weapon.cat === 'axe' ? 1.35 : 1) : 1;
  const shdMass = eq.offhand ? (eq.offhand.defBonus > 12 ? 1.5 : 1.05) : 1;

  // Инерция от размаха: чем быстрее рука рвётся вперёд, тем сильнее
  // оружие отстаёт, а затем догоняет с перелётом.
  const swingDelta = a.swing - gear.wpnPrev;
  gear.wpnPrev = a.swing;
  const blockDelta = a.block - gear.shdPrev;
  gear.shdPrev = a.block;

  gear.wpnLag = gear.wpnLag * 0.68 - swingDelta * 1.5 * wpnMass + (a.walk * 0.02);
  gear.wpnLag = clamp ? clamp(gear.wpnLag, -0.55, 0.75) : Math.max(-0.55, Math.min(0.75, gear.wpnLag));
  gear.shdLag = gear.shdLag * 0.7 - blockDelta * 1.1 * shdMass;
  gear.shdLag = Math.max(-0.4, Math.min(0.5, gear.shdLag));

  // Походный хват: оружие остриём вперёд (по направлению взгляда).
  // ctx.scale(facing, ...) уже зеркалит контекст, поэтому +PI/2
  // всегда направляет остриё в сторону взгляда, а не на бойца.
  const targetCarry = Math.PI * 0.5;
  gear.carry = gear.carry + (targetCarry - gear.carry) * (a.walk * 0.28 + 0.04);

  // Маятник при ходьбе: кисть уже ушла, клинок ещё догоняет
  const wpnWalkLag = a.walk * (Math.sin(walkCycle + Math.PI - 0.62) - Math.sin(walkCycle + Math.PI)) * 0.42;
  const shdWalkLag = a.walk * (Math.sin(walkCycle - 0.75) - Math.sin(walkCycle)) * 0.3;

  ctx.save();
  ctx.translate(lean, 0);
  // Лучник не машет луком как мечом: рука вытянута вперёд и держит лук
  // вертикально. Иначе на замахе лук уезжает за корпус и пропадает.
  const wVis = eq.weapon ? (eq.weapon.vis || WEAPON_VIS[eq.weapon.shape] || WEAPON_VIS.gladius) : null;
  const isBowUnit = !!(wVis && wVis.head === 'bow');
  const swingAngle = isBowUnit
    ? (-0.98 + a.swing * 0.26 - a.victory * 0.35 + armWalkR * 0.4)
    : (-0.3 + a.swing * 1.6 - a.victory * 1.9 + armWalkR);
  // Положение кисти в системе тела — по нему ставим лук.
  // Отрубленной рукой лук не удержать.
  const bowHand = (isBowUnit && !armR.lost) ? {
    x: shoulder * 0.86 + 7 * Math.cos(swingAngle) - 27 * Math.sin(swingAngle),
    y: hipY - 42 + 7 * Math.sin(swingAngle) + 27 * Math.cos(swingAngle)
  } : null;
  if (!armR.lost) {
    ctx.save();
    ctx.translate(shoulder * 0.86, hipY - 42);
    ctx.rotate(swingAngle);
    limb(ctx, 0, 0, 6, 24, 12, eq.arms ? eq.arms.color : skin);
    drawArmSchoolDetail(ctx, eq.arms, 3, 12);
    ctx.fillStyle = eq.arms ? shade(eq.arms.color, 0.1) : skin;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(7, 27, 10, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    drawArmBlood(ctx, armR, 7, 27);
    // Оружие: на ходу остриё ОТ СЕБЯ, при размахе — свободно качается.
    // Лук рисуется отдельно, в системе тела (см. ниже).
    if (eq.weapon && !bowHand) {
      ctx.save();
      ctx.translate(7, 27);
      // Клинок идёт остриём вперёд, арбалет лежит ложем вперёд.
      ctx.rotate(weaponHoldAngle(eq.weapon, gear, a.swing));
      ctx.translate(-7, -27);
      drawWeapon(ctx, eq.weapon);
      ctx.restore();
    }
    ctx.restore();
  } else {
    drawStump(ctx, shoulder * 0.86, hipY - 42, 12, skin, 'side');
  }

  // --- Лук в руке: держим за рукоять (обмотку), плечи вертикально ---
  if (bowHand && eq.weapon) {
    const bowLen = wVis.len || 48;
    // Короткие луки рисуем крупнее, иначе в бою они теряются в ладони
    const bowScale = Math.max(1.15, Math.min(1.7, 64 / bowLen));
    ctx.save();
    ctx.translate(bowHand.x + 2, bowHand.y + 1);
    // Верхнее плечо уводим вперёд (положительный угол в экранных
    // координатах), чтобы лук не прятался за головой и плечом.
    ctx.rotate(0.16);
    ctx.save();
    ctx.scale(bowScale, bowScale);
    drawWeapon(ctx, eq.weapon);
    ctx.restore();
    // Кисть поверх рукояти: пальцы обхватывают лук
    ctx.fillStyle = eq.arms ? shade(eq.arms.color, 0.1) : skin;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8.5, 10, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Пальцы поперёк рукояти
    ctx.strokeStyle = skinDark;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-5, -6);
    ctx.quadraticCurveTo(1, -3, 4, 3);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // --- Голова ---
  ctx.save();
  ctx.translate(lean, 0);
  if (!headS.lost) drawHead(ctx, glad, headY + headBob, headR, skin, skinDark, female, a, headS);
  ctx.restore();

  // --- Ближняя рука со щитом ---
  ctx.save();
  ctx.translate(lean, 0);
  const shieldLift = a.block * 0.9;
  if (!armL.lost) {
    ctx.save();
    ctx.translate(-shoulder * 0.86, hipY - 42);
    ctx.rotate(-0.15 - shieldLift + armWalkL);
    limb(ctx, 0, 0, -6, 26, 12, eq.arms ? eq.arms.color : skin);
    drawArmSchoolDetail(ctx, eq.arms, -3, 13);
    ctx.fillStyle = eq.arms ? shade(eq.arms.color, 0.1) : skin;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(-7, 30, 10, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    drawArmBlood(ctx, armL, -7, 30);
    // Щит тяжёлый: качается вокруг кисти с запозданием и кренится на ходу.
    // Если в левой руке второй клинок (димахер) — рисуем оружие, а не щит.
    if (eq.offhand) {
      const offIsWeapon = eq.offhand.slot === 'weapon';
      ctx.save();
      ctx.translate(-7, 30);
      if (offIsWeapon) {
        // Второй клинок развёрнут остриём вперёд, в противофазе правой руке
        const offCarry = -Math.PI * 0.5;
        ctx.rotate(offCarry - gear.wpnLag * 0.6 - a.walk * 0.12);
        ctx.translate(7, -30);
        ctx.scale(-1, 1);
        ctx.translate(-14, 0);
        drawWeapon(ctx, eq.offhand);
      } else {
        ctx.rotate(shdWalkLag + gear.shdLag + a.walk * 0.06);
        ctx.translate(7, -30);
        drawShield(ctx, eq.offhand, -7, 30);
      }
      ctx.restore();
    }
    ctx.restore();
  } else {
    drawStump(ctx, -shoulder * 0.86, hipY - 42, 12, skin, 'side');
  }
  ctx.restore();

  // --- Вспышка урона ---
  if (a.hurt > 0.01) {
    ctx.globalAlpha = a.hurt * 0.45;
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.ellipse(lean, hipY - 30, shoulder * 1.6, 62, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// Полупрозрачный цвет из hex
function hexA(hex, a) {
  if (!hex || hex[0] !== '#') return `rgba(255,255,255,${a})`;
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ==================== НОГА С КОЛЕНОМ ====================
// Бедро и голень — два отдельных сегмента. Колено уходит вперёд при сгибе,
// стопа поднимается в фазе переноса. Так шаг читается как живой, а не
// как качающийся маятник.
function drawLegSegmented(ctx, geom, w, color) {
  const { hipX, hipY, footX, footY } = geom;
  const lift = geom.lift || 0;

  const midX = (hipX + footX) / 2;
  const midY = (hipY + footY) / 2;
  // Колено: вперёд и чуть вверх. Чем выше поднята стопа — тем сильнее сгиб.
  const kneeX = midX + 3.4 + lift * 7.5;
  const kneeY = midY + 1 - lift * 2.4;

  // Бедро
  limb(ctx, hipX, hipY, kneeX, kneeY, w, color);
  // Голень чуть тоньше
  limb(ctx, kneeX, kneeY, footX, footY, w * 0.84, color);

  // Колено — небольшой сустав, чтобы сгиб читался
  ctx.fillStyle = shade(color, -0.12);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(kneeX, kneeY, w * 0.34, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // Стопа
  ctx.fillStyle = shade(color, -0.2);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.8;
  roundRect(ctx, footX - w * 0.42, footY - 3, w * 0.42 + 9, 7, 3);
  ctx.fill(); ctx.stroke();
}

// Броня ног: поножи/обмотки рисуются по фактической геометрии голени
function drawLegArmorNew(ctx, legs, legColor, geoms) {
  if (!legs) return;
  const vis = legs.vis;
  const plate = ['greaves', 'plate', 'gold', 'sandals', 'boots'].includes(vis);
  const wrap = ['wraps', 'chain', 'scale'].includes(vis);
  // Новые школы: у каждой своя фактура на голени
  const school = ['medieval', 'china', 'rus', 'mongol'].includes(vis);
  if (!plate && !wrap && !school) return;

  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;

  geoms.forEach(g => {
    if (g.lost) return;
    const kneeX = (g.hipX + g.footX) / 2 + 3.4 + (g.lift || 0) * 7.5;
    const kneeY = (g.hipY + g.footY) / 2 + 1 - (g.lift || 0) * 2.4;

    if (plate || school) {
      // Понож надевается на голень: от колена до стопы
      ctx.save();
      ctx.translate(kneeX, kneeY);
      const ang = Math.atan2(g.footY - kneeY, g.footX - kneeX);
      ctx.rotate(ang);
      const len = Math.hypot(g.footX - kneeX, g.footY - kneeY) * 0.72;
      ctx.fillStyle = shade(legColor, 0.2);
      roundRect(ctx, -2, -8, len, 16, 5);
      ctx.fill(); ctx.stroke();

      if (school) {
        const trim = legs.trim || '#c9a45c';
        if (vis === 'medieval') {
          // Кованая створка с наколенником и ремнём
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          roundRect(ctx, 1, -6, len * 0.55, 4, 2);
          ctx.fill();
          ctx.fillStyle = shade(legColor, 0.3);
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(2, -8, 5.4, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = trim;
          roundRect(ctx, 2, -2, len * 0.8, 3, 1.5);
          ctx.fill();
        } else if (vis === 'china') {
          // Ряды лаковых пластин
          ctx.fillStyle = trim;
          for (let i = 0; i < 3; i++) {
            roundRect(ctx, 1 + i * (len * 0.26), -6, len * 0.2, 3, 1.2);
            ctx.fill();
            roundRect(ctx, 1 + i * (len * 0.26), 3, len * 0.2, 3, 1.2);
            ctx.fill();
          }
          ctx.fillStyle = 'rgba(255,255,255,0.24)';
          roundRect(ctx, 1, -6, len * 0.5, 2, 1);
          ctx.fill();
        } else if (vis === 'rus') {
          // Кольчужная рябь и медная бляха
          ctx.strokeStyle = shade(legColor, -0.3);
          ctx.lineWidth = 1.1;
          for (let i = 1; i < 5; i++) {
            const x = (len * i) / 5;
            ctx.beginPath();
            ctx.moveTo(x, -7);
            ctx.lineTo(x + 2, 7);
            ctx.stroke();
          }
          ctx.fillStyle = trim;
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(2, 0, 3.2, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        } else {
          // Монгольские кожаные накладки с меховым краем
          ctx.fillStyle = shade(legColor, -0.2);
          roundRect(ctx, 1, -5, len * 0.8, 10, 3);
          ctx.fill();
          ctx.fillStyle = '#b8a888';
          roundRect(ctx, 1, 5, len * 0.8, 3.4, 1.6);
          ctx.fill();
          ctx.fillStyle = trim;
          roundRect(ctx, len * 0.35, -2, 3.4, 4, 1.4);
          ctx.fill();
        }
      } else if (vis === 'plate' || vis === 'gold') {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        roundRect(ctx, 1, -6, len * 0.5, 4, 2);
        ctx.fill();
      }
      ctx.restore();
    } else {
      ctx.strokeStyle = shade(legColor, -0.25);
      ctx.lineWidth = 2.4;
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        const x = kneeX + (g.footX - kneeX) * t;
        const y = kneeY + (g.footY - kneeY) * t;
        ctx.beginPath();
        ctx.moveTo(x - 7, y - 1);
        ctx.lineTo(x + 7, y + 1);
        ctx.stroke();
      }
    }
  });
}

// Культя: короткий обрубок с тёмной запёкшейся раной
function drawStump(ctx, x, y, w, color, dir) {
  const len = 9;
  let x2 = x, y2 = y;
  if (dir === 'down') { y2 = y + len; }
  else if (dir === 'up') { y2 = y - len; }
  else { x2 = x + (x < 0 ? -len : len) * 0.4; y2 = y + len; }

  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = w + 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();

  ctx.fillStyle = BLOOD_DARK;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(x2, y2, w * 0.44, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = BLOOD;
  ctx.beginPath();
  ctx.arc(x2, y2, w * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

// Кровь на руке, если конечность повреждена
function drawArmBlood(ctx, state, hx, hy) {
  if (state.lost || state.ratio > 0.55) return;
  const n = state.ratio < 0.25 ? 4 : 2;
  ctx.save();
  ctx.fillStyle = BLOOD;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + 0.7;
    ctx.beginPath();
    ctx.ellipse(hx + Math.cos(ang) * 7, hy + Math.sin(ang) * 6 + 2, 3.2, 4.6, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Кровь на корпусе: пятна зависят от общего урона и повреждённых частей
function drawBloodOnTorso(ctx, glad, shoulder, waist, hipY, extra) {
  const L = glad.limbs;
  let severity = extra || 0;
  if (L) {
    const parts = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];
    parts.forEach(k => {
      const s = L[k];
      if (!s) return;
      if (s.lost) severity = Math.max(severity, 0.85);
      else severity = Math.max(severity, (1 - s.hp / Math.max(1, s.max)) * 0.8);
    });
  }
  if (severity < 0.08) return;

  ctx.save();
  ctx.globalAlpha = clamp01(severity) * 0.85;
  ctx.fillStyle = BLOOD;
  const seed = (glad.id || 'x').length + 3;
  for (let i = 0; i < 5; i++) {
    const px = ((seed * (i + 2)) % 17) / 17 * 2 - 1;
    const py = ((seed * (i + 5)) % 13) / 13;
    ctx.beginPath();
    ctx.ellipse(px * shoulder * 0.75, hipY - 42 + py * 38, 4 + py * 5, 6 + py * 4, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // потёки
  ctx.strokeStyle = BLOOD_DARK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-shoulder * 0.3, hipY - 44);
  ctx.quadraticCurveTo(-shoulder * 0.24, hipY - 20, -shoulder * 0.3, hipY - 6);
  ctx.stroke();
  ctx.restore();
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// ==================== ГОЛОВА ====================
function drawHead(ctx, glad, headY, headR, skin, skinDark, female, a, headState) {
  const eq = glad.equip || {};
  const hairC = glad.hairColor || '#4a3018';

  ctx.fillStyle = skin;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(-headR + 3, headY + 4, female ? 6 : 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(headR - 3, headY + 4, female ? 6 : 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  if (female && !eq.head) {
    ctx.fillStyle = '#e5b54f';
    ctx.beginPath(); ctx.arc(headR - 3, headY + 13, 3, 0, Math.PI * 2); ctx.fill();
  }

  ctx.beginPath();
  ctx.ellipse(0, headY, headR, headR * 1.05, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, headY, headR, headR * 1.05, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(-headR * 0.72, headY + 7, headR * 0.46, headR * 0.82, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Глухие шлемы полностью закрывают лицо. Венец и капюшон — нет.
  const hidden = eq.head && ['murmillo', 'greathelm', 'horned'].includes(eq.head.vis);

  if (!hidden) {
    const t = performance.now() / 1000;
    const seed = glad.id ? glad.id.length * 0.37 : 0.6;
    // Эмоция: явно заданная (бой, город) либо выведенная из состояния
    const emo = a.emotion
      || (a.dead > 0.4 ? 'dead' : a.hurt > 0.3 ? 'hurt' : a.victory > 0.5 ? 'happy' : 'idle');

    // Моргание — своё у каждого бойца
    const blinkCycle = 2.8 + (glad.id ? (glad.id.length % 4) * 0.45 : 0.9);
    const bt = (t + seed * 7) % blinkCycle;
    const blink = emo === 'dead' ? 0.1 : (bt > blinkCycle - 0.12 ? 0.1 : 1);

    // Живой взгляд: зрачки чуть гуляют, брови дышат
    const gazeX = Math.sin(t * 0.8 + seed * 9) * 1.4;
    const gazeY = Math.cos(t * 0.55 + seed * 5) * 1.0;
    const browBob = Math.sin(t * 1.6 + seed * 3) * 0.5;

    const eyeW = emo === 'fear' ? 9.3 : emo === 'angry' ? 8.4 : emo === 'happy' ? 7.6 : 8;
    const eyeH = emo === 'fear' ? 10.6 : emo === 'angry' ? 6.4
      : emo === 'hurt' ? 6.8 : emo === 'happy' ? 6.4 : 8.6;
    const eyeY = headY - 2 + (emo === 'fear' ? -1.2 : emo === 'angry' ? 0.8 : 0);

    ctx.fillStyle = '#fffdf6';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(-10, eyeY, eyeW, eyeH * blink, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(9, eyeY, eyeW, eyeH * blink, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    if (blink > 0.5) {
      const pr = emo === 'fear' ? 2.6 : emo === 'angry' ? 3.9 : 3.6;
      const py = eyeY - 1 + (emo === 'angry' ? 1.1 : emo === 'fear' ? -1.1 : 0);
      ctx.fillStyle = '#20180f';
      ctx.beginPath(); ctx.arc(-8 + gazeX, py + gazeY, pr, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(11 + gazeX, py + gazeY, pr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(-9.4 + gazeX, py - 1.6 + gazeY, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(9.6 + gazeX, py - 1.6 + gazeY, 1.2, 0, Math.PI * 2); ctx.fill();
    }

    // Крестики вместо глаз у павшего
    if (emo === 'dead') {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      [-10, 9].forEach(cx => {
        ctx.beginPath();
        ctx.moveTo(cx - 5, eyeY - 5); ctx.lineTo(cx + 5, eyeY + 5);
        ctx.moveTo(cx + 5, eyeY - 5); ctx.lineTo(cx - 5, eyeY + 5);
        ctx.stroke();
      });
    }

    if (female) {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-18, headY - 8); ctx.lineTo(-21, headY - 12);
      ctx.moveTo(-13, headY - 10); ctx.lineTo(-14, headY - 15);
      ctx.moveTo(17, headY - 8); ctx.lineTo(20, headY - 12);
      ctx.moveTo(12, headY - 10); ctx.lineTo(13, headY - 15);
      ctx.stroke();
    }

    // Брови: наклон и высота передают эмоцию
    const browL = { x1: -19, y1: headY - 13, x2: -3, y2: headY - 8 };
    const browR = { x1: 18, y1: headY - 13, x2: 3, y2: headY - 8 };
    if (emo === 'angry') {
      browL.y1 = headY - 15; browL.y2 = headY - 5;
      browR.y1 = headY - 15; browR.y2 = headY - 5;
    } else if (emo === 'fear') {
      browL.y1 = headY - 8; browL.y2 = headY - 16;
      browR.y1 = headY - 8; browR.y2 = headY - 16;
    } else if (emo === 'hurt') {
      browL.y1 = headY - 16; browL.y2 = headY - 9;
      browR.y1 = headY - 11; browR.y2 = headY - 7;
    } else if (emo === 'happy') {
      browL.y1 = headY - 16; browL.y2 = headY - 13;
      browR.y1 = headY - 16; browR.y2 = headY - 13;
    }
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = female ? 3.2 : 4.2;
    ctx.beginPath();
    ctx.moveTo(browL.x1, browL.y1 + browBob); ctx.lineTo(browL.x2, browL.y2 + browBob);
    ctx.moveTo(browR.x1, browR.y1 + browBob); ctx.lineTo(browR.x2, browR.y2 + browBob);
    ctx.stroke();

    // Нос
    ctx.strokeStyle = shade(skin, -0.35);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-1, headY + 2);
    ctx.quadraticCurveTo(-3, headY + 9, 2, headY + 10);
    ctx.stroke();

    // Рот — главный индикатор эмоции
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.8;
    if (emo === 'dead') {
      ctx.beginPath();
      ctx.ellipse(0, headY + 17, 6, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#3a1210';
      ctx.fill(); ctx.stroke();
    } else if (emo === 'hurt' || a.hurt > 0.3) {
      // Крик от боли: рот открыт, зубы видны
      const open = 4 + Math.sin(t * 14) * 1.4;
      ctx.beginPath();
      ctx.ellipse(0, headY + 16, 7.5, open, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#5a1a14';
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f4efe2';
      ctx.beginPath();
      ctx.rect(-5.4, headY + 16 - open, 10.8, 2.2);
      ctx.fill();
    } else if (emo === 'angry') {
      // Рык: широко открытый рот, пульсирует
      const open = 5 + Math.sin(t * 9 + seed * 4) * 2;
      ctx.beginPath();
      ctx.ellipse(0, headY + 16.5, 8.5, open, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#4a1410';
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f4efe2';
      ctx.beginPath();
      ctx.rect(-6.2, headY + 16.5 - open, 12.4, 2.4);
      ctx.fill();
      // Злая жилка на виске
      ctx.strokeStyle = 'rgba(190,60,50,0.85)';
      ctx.lineWidth = 1.8;
      const vx = 15, vy = headY - 20;
      ctx.beginPath();
      ctx.moveTo(vx, vy - 4); ctx.lineTo(vx + 3, vy); ctx.lineTo(vx - 2, vy);
      ctx.lineTo(vx + 2, vy + 4);
      ctx.stroke();
    } else if (emo === 'fear') {
      // Испуг: маленький круглый рот + капля пота
      ctx.beginPath();
      ctx.ellipse(0, headY + 17, 4, 4.6 + Math.sin(t * 6) * 0.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#4a1410';
      ctx.fill(); ctx.stroke();
      const dropT = (t * 0.9 + seed) % 1;
      ctx.fillStyle = `rgba(150,200,235,${0.85 - dropT * 0.6})`;
      ctx.beginPath();
      ctx.ellipse(headR - 2, headY - 12 + dropT * 16, 2.4, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (emo === 'happy') {
      // Широкая улыбка, приподнятые уголки
      ctx.beginPath();
      ctx.moveTo(-9, headY + 14);
      ctx.quadraticCurveTo(0, headY + 24, 9, headY + 14);
      ctx.stroke();
      ctx.fillStyle = '#b8564a';
      ctx.beginPath();
      ctx.moveTo(-7, headY + 15.5);
      ctx.quadraticCurveTo(0, headY + 21, 7, headY + 15.5);
      ctx.quadraticCurveTo(0, headY + 18.5, -7, headY + 15.5);
      ctx.fill();
    } else if (emo === 'taunt') {
      // Ухмылка набок
      ctx.beginPath();
      ctx.moveTo(-7, headY + 15);
      ctx.quadraticCurveTo(1, headY + 21, 10, headY + 13);
      ctx.stroke();
    } else if (female) {
      ctx.fillStyle = '#b8564a';
      ctx.beginPath();
      ctx.moveTo(-7, headY + 16);
      ctx.quadraticCurveTo(0, headY + 21, 7, headY + 16);
      ctx.quadraticCurveTo(0, headY + 19, -7, headY + 16);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(-8, headY + 16);
      ctx.quadraticCurveTo(0, headY + 21, 8, headY + 15);
      ctx.stroke();
    }
  }

  // Борода
  const beard = female ? 'none' : (glad.beardStyle || 'none');
  if (beard !== 'none' && !hidden) drawBeard(ctx, beard, headY, headR, hairC);

  // Кровь на лице при тяжёлом ранении головы
  if (headState && headState.ratio < 0.5) {
    ctx.save();
    ctx.globalAlpha = 0.8 * (1 - headState.ratio);
    ctx.fillStyle = BLOOD;
    ctx.beginPath();
    ctx.ellipse(-12, headY - 12, 5, 8, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(13, headY + 8, 4, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (eq.head) drawHelmet(ctx, eq.head, headY, headR);
  else drawHair(ctx, glad, headY, headR, hairC);
}

// ==================== БОРОДА ====================
// Борода рисуется слоями: масса волос, затем пряди, блики и прорези.
// Так она читается как объёмная, а не как плоское пятно.
function drawBeard(ctx, style, headY, headR, hairC) {
  const dark = shade(hairC, -0.34);
  const light = shade(hairC, 0.3);
  const mid = hairC;

  // Пряди: тонкие изогнутые линии по форме бороды
  const strands = (x0, y0, x1, y1, count, curl) => {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const x = x0 + (x1 - x0) * t;
      const len = (y1 - y0) * (0.55 + 0.45 * Math.sin(t * Math.PI));
      ctx.beginPath();
      ctx.moveTo(x, y0 + (y1 - y0) * 0.15);
      ctx.quadraticCurveTo(x + curl, y0 + len * 0.6, x + curl * 0.4, y0 + len);
      ctx.stroke();
    }
  };

  if (style === 'stubble') {
    // Щетина: мелкая «просыпь» точек по щекам и подбородку, без чёткого края
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-headR * 0.96, headY + 2);
    ctx.quadraticCurveTo(-headR * 0.9, headY + 22, 0, headY + 27);
    ctx.quadraticCurveTo(headR * 0.9, headY + 22, headR * 0.96, headY + 2);
    ctx.quadraticCurveTo(headR * 0.5, headY + 12, 0, headY + 12);
    ctx.quadraticCurveTo(-headR * 0.5, headY + 12, -headR * 0.96, headY + 2);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = mid;
    ctx.fillRect(-headR, headY, headR * 2, 30);
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = dark;
    for (let i = 0; i < 46; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      const rr = (i % 7) / 7;
      const px = Math.cos(a) * headR * 0.78 * (0.5 + rr * 0.5);
      const py = headY + 14 + Math.sin(a) * 9 + rr * 6;
      ctx.beginPath();
      ctx.arc(px, py, 0.9 + (i % 3) * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (style === 'moustache') {
    // Усы: два крыла с завитком на концах
    ctx.fillStyle = mid;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-2, headY + 12);
    ctx.quadraticCurveTo(-10, headY + 7, -16, headY + 11);
    ctx.quadraticCurveTo(-13, headY + 15, -8, headY + 16);
    ctx.quadraticCurveTo(-3, headY + 18, 0, headY + 17);
    ctx.quadraticCurveTo(3, headY + 18, 8, headY + 16);
    ctx.quadraticCurveTo(13, headY + 15, 16, headY + 11);
    ctx.quadraticCurveTo(10, headY + 7, 2, headY + 12);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = light;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-13, headY + 11.5);
    ctx.quadraticCurveTo(-7, headY + 12.5, -1, headY + 14);
    ctx.moveTo(13, headY + 11.5);
    ctx.quadraticCurveTo(7, headY + 12.5, 1, headY + 14);
    ctx.stroke();
    // Кончики закручены вверх
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.6;
    [-1, 1].forEach(sd => {
      ctx.beginPath();
      ctx.moveTo(sd * 16, headY + 11);
      ctx.quadraticCurveTo(sd * 19, headY + 7, sd * 17, headY + 5);
      ctx.stroke();
    });
    return;
  }

  if (style === 'goatee') {
    // Козлиная: клин на подбородке плюс короткие усы
    ctx.fillStyle = mid;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-8, headY + 15);
    ctx.quadraticCurveTo(-7, headY + 30, 0, headY + 38);
    ctx.quadraticCurveTo(7, headY + 30, 8, headY + 15);
    ctx.quadraticCurveTo(0, headY + 20, -8, headY + 15);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    strands(-5, headY + 18, 5, headY + 36, 4, 1.6);
    ctx.fillStyle = mid;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-1, headY + 13);
    ctx.quadraticCurveTo(-8, headY + 11, -11, headY + 14);
    ctx.quadraticCurveTo(-5, headY + 17, 0, headY + 16);
    ctx.quadraticCurveTo(5, headY + 17, 11, headY + 14);
    ctx.quadraticCurveTo(8, headY + 11, 1, headY + 13);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    return;
  }

  // full / long — полная борода. Разница в длине и в форме подбородка.
  const long = style === 'long';
  const bottom = long ? 58 : 42;
  const spread = long ? 21 : 19;

  // Масса волос
  ctx.fillStyle = mid;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-spread, headY + 5);
  ctx.quadraticCurveTo(-spread - 3, headY + bottom * 0.55, -spread * 0.5, headY + bottom * 0.88);
  ctx.quadraticCurveTo(-spread * 0.2, headY + bottom * 1.02, 0, headY + bottom);
  ctx.quadraticCurveTo(spread * 0.2, headY + bottom * 1.02, spread * 0.5, headY + bottom * 0.88);
  ctx.quadraticCurveTo(spread + 3, headY + bottom * 0.55, spread, headY + 5);
  // Верх бороды повторяет линию щёк и обходит усы
  ctx.quadraticCurveTo(spread * 0.72, headY + 12, spread * 0.42, headY + 14);
  ctx.quadraticCurveTo(0, headY + 20, -spread * 0.42, headY + 14);
  ctx.quadraticCurveTo(-spread * 0.72, headY + 12, -spread, headY + 5);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Затенение у шеи — борода «уходит» под подбородок
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-spread, headY + 5);
  ctx.quadraticCurveTo(-spread - 3, headY + bottom * 0.55, -spread * 0.5, headY + bottom * 0.88);
  ctx.quadraticCurveTo(-spread * 0.2, headY + bottom * 1.02, 0, headY + bottom);
  ctx.quadraticCurveTo(spread * 0.2, headY + bottom * 1.02, spread * 0.5, headY + bottom * 0.88);
  ctx.quadraticCurveTo(spread + 3, headY + bottom * 0.55, spread, headY + 5);
  ctx.quadraticCurveTo(0, headY + 22, -spread, headY + 5);
  ctx.closePath();
  ctx.clip();
  const g = ctx.createLinearGradient(0, headY + 6, 0, headY + bottom);
  g.addColorStop(0, 'rgba(0,0,0,0.26)');
  g.addColorStop(0.45, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g;
  ctx.fillRect(-spread - 4, headY, spread * 2 + 8, bottom + 6);
  ctx.restore();

  // Пряди
  strands(-spread * 0.78, headY + 14, spread * 0.78, headY + bottom * 0.9, 9, long ? 2.2 : 1.5);

  // Блик по левой скуле — объём
  ctx.strokeStyle = light;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-spread * 0.72, headY + 13);
  ctx.quadraticCurveTo(-spread * 0.86, headY + bottom * 0.4, -spread * 0.34, headY + bottom * 0.7);
  ctx.stroke();

  // Усы поверх бороды, чтобы линия рта читалась
  ctx.fillStyle = mid;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-1, headY + 12);
  ctx.quadraticCurveTo(-8, headY + 10, -13, headY + 13);
  ctx.quadraticCurveTo(-7, headY + 16, 0, headY + 15);
  ctx.quadraticCurveTo(7, headY + 16, 13, headY + 13);
  ctx.quadraticCurveTo(8, headY + 10, 1, headY + 12);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Длинная борода: два «языка» на конце и седые пряди
  if (long) {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-4, headY + bottom * 0.62);
    ctx.quadraticCurveTo(-3, headY + bottom * 0.86, 0, headY + bottom - 1);
    ctx.moveTo(5, headY + bottom * 0.66);
    ctx.quadraticCurveTo(3, headY + bottom * 0.86, 0, headY + bottom - 1);
    ctx.stroke();
    ctx.strokeStyle = shade(hairC, 0.55);
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-spread * 0.3, headY + bottom * 0.5);
    ctx.quadraticCurveTo(-spread * 0.2, headY + bottom * 0.75, -spread * 0.06, headY + bottom * 0.9);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ==================== ПРИЧЁСКИ ====================
// Волосы рисуются в три слоя: тёмная масса, средний тон, блик.
// Поверх — пряди, которые задают направление и объём.
function hairLayers(ctx, hairC, pathFn, yTop, yBot) {
  pathFn();
  ctx.fillStyle = hairC;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3.6;
  ctx.stroke();

  ctx.save();
  pathFn();
  ctx.clip();
  // Тёмный низ — волосы уходят в тень
  const g = ctx.createLinearGradient(0, yTop, 0, yBot);
  g.addColorStop(0, 'rgba(255,255,255,0.16)');
  g.addColorStop(0.42, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = g;
  ctx.fillRect(-60, yTop - 20, 120, yBot - yTop + 40);
  ctx.restore();
}

// Пряди по форме причёски
function hairStrands(ctx, hairC, x0, x1, y0, y1, count, bend) {
  ctx.strokeStyle = shade(hairC, -0.32);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const x = x0 + (x1 - x0) * t;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.quadraticCurveTo(x + bend * (0.5 - t), (y0 + y1) / 2, x + bend * (0.5 - t) * 1.4, y1);
    ctx.stroke();
  }
}

function drawHair(ctx, glad, headY, headR, hairC) {
  const style = glad.hairStyle || 'short';
  const light = shade(hairC, 0.42);

  const cap = () => {
    ctx.beginPath();
    ctx.moveTo(-headR - 1, headY - 2);
    ctx.quadraticCurveTo(-headR - 2, headY - 33, 0, headY - 34);
    ctx.quadraticCurveTo(headR + 2, headY - 33, headR + 1, headY - 2);
    ctx.quadraticCurveTo(headR - 4, headY - 18, 0, headY - 20);
    ctx.quadraticCurveTo(-headR + 4, headY - 18, -headR - 1, headY - 2);
    ctx.closePath();
  };

  // Блик по куполу — общий для всех причёсок
  const capShine = () => {
    ctx.strokeStyle = light;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(-headR * 0.18, headY - 12, headR * 0.7, Math.PI * 1.12, Math.PI * 1.55);
    ctx.stroke();
  };

  if (style === 'short' || style === 'topknot') {
    hairLayers(ctx, hairC, cap, headY - 36, headY - 2);
    // Короткая стрижка: рваная линия у висков
    ctx.strokeStyle = shade(hairC, -0.28);
    ctx.lineWidth = 1.6;
    [-1, 1].forEach(sd => {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(sd * (headR - 2 - i * 2), headY - 16 + i * 3);
        ctx.quadraticCurveTo(sd * (headR + 1), headY - 8 + i * 3, sd * (headR - 4), headY - 1 + i * 2);
        ctx.stroke();
      }
    });
    capShine();
    if (style === 'topknot') {
      ctx.fillStyle = hairC;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.ellipse(0, headY - 42, 10.5, 9, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Обмотка узла
      ctx.strokeStyle = shade(hairC, -0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, headY - 44); ctx.lineTo(8, headY - 40);
      ctx.moveTo(-8, headY - 39); ctx.lineTo(8, headY - 44);
      ctx.stroke();
      ctx.strokeStyle = light;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(-3, headY - 46, 5, Math.PI * 1.1, Math.PI * 1.7);
      ctx.stroke();
    }
  } else if (style === 'long') {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(-headR - 2, headY + 20);
      ctx.quadraticCurveTo(-headR - 6, headY - 36, 0, headY - 36);
      ctx.quadraticCurveTo(headR + 6, headY - 36, headR + 2, headY + 20);
      ctx.quadraticCurveTo(headR + 7, headY + 30, headR - 3, headY + 32);
      ctx.quadraticCurveTo(headR - 6, headY - 12, 0, headY - 16);
      ctx.quadraticCurveTo(-headR + 6, headY - 12, -headR + 3, headY + 32);
      ctx.quadraticCurveTo(-headR - 7, headY + 30, -headR - 2, headY + 20);
      ctx.closePath();
    };
    hairLayers(ctx, hairC, path, headY - 38, headY + 32);
    // Длинные пряди по бокам
    ctx.strokeStyle = shade(hairC, -0.3);
    ctx.lineWidth = 1.6;
    [-1, 1].forEach(sd => {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(sd * (headR + 1 - i * 3), headY - 6 + i * 2);
        ctx.quadraticCurveTo(sd * (headR + 4 - i * 2), headY + 12, sd * (headR - 1 - i * 3), headY + 28 - i * 3);
        ctx.stroke();
      }
    });
    capShine();
  } else if (style === 'ponytail') {
    hairLayers(ctx, hairC, cap, headY - 36, headY - 2);
    capShine();
    // Хвост: несколько прядей, а не один клин
    ctx.fillStyle = hairC;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-headR + 2, headY - 12);
    ctx.quadraticCurveTo(-headR - 18, headY + 2, -headR - 12, headY + 34);
    ctx.quadraticCurveTo(-headR - 2, headY + 18, -headR + 6, headY - 6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = shade(hairC, -0.3);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-headR - 4, headY - 2);
    ctx.quadraticCurveTo(-headR - 12, headY + 12, -headR - 7, headY + 28);
    ctx.moveTo(-headR + 1, headY + 1);
    ctx.quadraticCurveTo(-headR - 7, headY + 13, -headR - 3, headY + 26);
    ctx.stroke();
    // Резинка
    ctx.strokeStyle = '#8a3a2a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-headR + 1, headY - 10);
    ctx.lineTo(-headR + 7, headY - 2);
    ctx.stroke();
  } else if (style === 'braids') {
    hairLayers(ctx, hairC, cap, headY - 36, headY - 2);
    capShine();
    // Косы: переплетение «косичкой», а не столбик из овалов
    [-1, 1].forEach(sd => {
      const bx = sd * (headR - 2);
      for (let i = 0; i < 4; i++) {
        const cy = headY + 12 + i * 9;
        const off = (i % 2 ? 2.6 : -2.6);
        ctx.fillStyle = i % 2 ? shade(hairC, 0.1) : hairC;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(bx + off, cy, 5.4, 6.4, off * 0.06, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      // Кисточка на конце
      ctx.fillStyle = shade(hairC, -0.2);
      ctx.beginPath();
      ctx.moveTo(bx - 4, headY + 46);
      ctx.lineTo(bx + 4, headY + 46);
      ctx.lineTo(bx + 1, headY + 54);
      ctx.lineTo(bx - 1, headY + 54);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    });
  } else if (style === 'bun') {
    hairLayers(ctx, hairC, cap, headY - 36, headY - 2);
    capShine();
    ctx.fillStyle = hairC;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.ellipse(0, headY - 40, 12.5, 11, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = shade(hairC, -0.3);
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(0, headY - 40, 4 + Math.abs(i) * 3, Math.PI * 0.15 + i * 0.4, Math.PI * 1.1 + i * 0.4);
      ctx.stroke();
    }
    ctx.strokeStyle = light;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(-3, headY - 43, 6, Math.PI * 1.05, Math.PI * 1.6);
    ctx.stroke();
  } else if (style === 'mohawk') {
    // Гребень из отдельных шипов
    ctx.fillStyle = hairC;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    const spikes = 6;
    for (let i = 0; i < spikes; i++) {
      const t = i / (spikes - 1);
      const bx = -9 + t * 20;
      const hgt = 26 + Math.sin(t * Math.PI) * 22;
      ctx.beginPath();
      ctx.moveTo(bx - 3.6, headY - 24);
      ctx.quadraticCurveTo(bx - 1.5, headY - 24 - hgt * 0.7, bx + 1, headY - 24 - hgt);
      ctx.quadraticCurveTo(bx + 3, headY - 24 - hgt * 0.55, bx + 3.6, headY - 24);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = shade(hairC, 0.35);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(bx - 1, headY - 27);
      ctx.quadraticCurveTo(bx, headY - 26 - hgt * 0.6, bx + 0.5, headY - 24 - hgt * 0.9);
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
    }
    // Выбритые виски
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = hairC;
    ctx.beginPath();
    ctx.ellipse(-headR * 0.72, headY - 12, 6, 12, 0.2, 0, Math.PI * 2);
    ctx.ellipse(headR * 0.72, headY - 12, 6, 12, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (style === 'curly') {
    // Кудри: спиральные завитки с бликом внутри каждого
    const curls = [[-13, -22, 8.5], [-4, -30, 8], [6, -30, 8], [14, -21, 8], [-17, -8, 7.5], [17, -7, 7.5], [-9, -16, 7], [3, -19, 7.5]];
    curls.forEach(([cx, cy, r]) => {
      ctx.fillStyle = hairC;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(cx, headY + cy, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = shade(hairC, -0.3);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, headY + cy, r * 0.55, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();
      ctx.strokeStyle = light;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx - r * 0.25, headY + cy - r * 0.25, r * 0.34, Math.PI * 1.05, Math.PI * 1.6);
      ctx.stroke();
    });
  } else if (style === 'dreadlocks') {
    hairLayers(ctx, hairC, cap, headY - 36, headY - 2);
    capShine();
    // Дреды: жгуты с утолщениями
    for (let i = -3; i <= 3; i++) {
      const bx = i * 6.5;
      const len = 26 + Math.abs(i) * 3;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(bx, headY - 12);
      ctx.quadraticCurveTo(bx + i * 0.8, headY + 6, bx + i * 1.2, headY + len);
      ctx.stroke();
      ctx.strokeStyle = hairC;
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.moveTo(bx, headY - 12);
      ctx.quadraticCurveTo(bx + i * 0.8, headY + 6, bx + i * 1.2, headY + len);
      ctx.stroke();
      // Утолщения жгута
      ctx.fillStyle = shade(hairC, 0.12);
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(bx + i * 0.8 * k * 0.5, headY - 4 + k * 10, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (style === 'shaved') {
    // Бритая голова: короткая тень и мелкая щетина
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = hairC;
    ctx.beginPath();
    ctx.moveTo(-headR - 1, headY - 4);
    ctx.quadraticCurveTo(-headR - 2, headY - 32, 0, headY - 33);
    ctx.quadraticCurveTo(headR + 2, headY - 32, headR + 1, headY - 4);
    ctx.quadraticCurveTo(0, headY - 16, -headR - 1, headY - 4);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = shade(hairC, -0.3);
    for (let i = 0; i < 22; i++) {
      const a = Math.PI + (i / 21) * Math.PI;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * headR * 0.82, headY - 6 + Math.sin(a) * headR * 0.7, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ==================== ШЛЕМЫ ====================
// Металл шлема рисуется градиентом: свет сверху-слева, тень снизу-справа.
// Поверх — заклёпки, кромка и затылочная пластина.
function metalFill(ctx, hc, yTop, yBot) {
  const g = ctx.createLinearGradient(-14, yTop, 16, yBot);
  g.addColorStop(0, shade(hc, 0.34));
  g.addColorStop(0.42, hc);
  g.addColorStop(1, shade(hc, -0.3));
  return g;
}

// Ряд заклёпок по кромке
function rivets(ctx, x0, x1, y, n, color) {
  ctx.fillStyle = color || 'rgba(255,255,255,0.35)';
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    ctx.beginPath();
    ctx.arc(x0 + (x1 - x0) * t, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Гребень-плюмаж: объёмная щётка из прядей, а не плоский клин
function helmetCrest(ctx, crest, headY, headR) {
  const topY = headY - headR - 20;
  ctx.fillStyle = crest;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-6, topY + 6);
  ctx.quadraticCurveTo(-2, topY - 22, 16, topY - 20);
  ctx.quadraticCurveTo(28, topY - 18, 30, topY - 4);
  ctx.quadraticCurveTo(14, topY - 2, 8, topY + 6);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = shade(crest, -0.35);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    ctx.beginPath();
    ctx.moveTo(-4 + t * 8, topY + 5);
    ctx.quadraticCurveTo(6 + t * 14, topY - 8 + t * 4, 12 + t * 18, topY - 18 + t * 12);
    ctx.stroke();
  }
}

// Детали наручей новых школ: рисуются в системе руки (предплечье вдоль оси Y)
function drawArmSchoolDetail(ctx, arms, hx, hy) {
  if (!arms) return;
  const vis = arms.vis;
  if (!['medieval', 'china', 'rus', 'mongol'].includes(vis)) return;
  const trim = arms.trim || '#c9a45c';
  ctx.save();
  ctx.translate(hx * 0.75, hy - 8);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.2;
  if (vis === 'medieval') {
    // Стальная створка с фаской и ремнём
    ctx.fillStyle = shade(arms.color, 0.22);
    roundRect(ctx, -6, -7, 12, 14, 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    roundRect(ctx, -4, -5, 3, 9, 1.5);
    ctx.fill();
    ctx.fillStyle = trim;
    roundRect(ctx, -6, 2, 12, 2.6, 1.2);
    ctx.fill();
  } else if (vis === 'china') {
    // Лаковые пластины с золотыми заклёпками
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 ? shade(arms.color, -0.1) : shade(arms.color, 0.12);
      roundRect(ctx, -6, -7 + i * 5, 12, 4.4, 1.6);
      ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = trim;
    ctx.beginPath(); ctx.arc(0, -4.8, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 4.8, 1.1, 0, Math.PI * 2); ctx.fill();
  } else if (vis === 'rus') {
    // Кольчужные кольца и медная бляха
    ctx.strokeStyle = shade(arms.color, -0.3);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-6, -5 + i * 5);
      ctx.lineTo(6, -4 + i * 5);
      ctx.stroke();
    }
    ctx.fillStyle = trim;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    // Кожа с меховой опушкой
    ctx.fillStyle = shade(arms.color, -0.12);
    roundRect(ctx, -6, -7, 12, 14, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b8a888';
    roundRect(ctx, -6, -8, 12, 3.4, 1.6);
    ctx.fill();
    ctx.fillStyle = trim;
    roundRect(ctx, -1.6, 1, 3.2, 4, 1.2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHelmet(ctx, helm, headY, headR) {
  const hc = helm.color || '#b0bac4';
  const vis = helm.vis || 'nasal';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 4;

  if (vis === 'hood') {
    // Капюшон: ткань складками, с тенью внутри
    ctx.fillStyle = hc;
    ctx.beginPath();
    ctx.moveTo(-headR - 5, headY + 14);
    ctx.quadraticCurveTo(-headR - 9, headY - 36, 0, headY - 38);
    ctx.quadraticCurveTo(headR + 9, headY - 36, headR + 5, headY + 14);
    ctx.quadraticCurveTo(headR - 2, headY - 8, 0, headY - 10);
    ctx.quadraticCurveTo(-headR + 2, headY - 8, -headR - 5, headY + 14);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Складки ткани
    ctx.strokeStyle = shade(hc, -0.28);
    ctx.lineWidth = 1.8;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 9, headY - 32);
      ctx.quadraticCurveTo(i * 12 + 3, headY - 16, i * 10 + 5, headY + 8);
      ctx.stroke();
    }
    // Тень у лица
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, headY - 2, headR * 0.85, headR * 0.7, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (vis === 'cap') {
    // Простой колпак: войлок или кожа, с ободом и завязками
    ctx.fillStyle = metalFill(ctx, hc, headY - 24, headY + 4);
    ctx.beginPath();
    ctx.ellipse(0, headY - 4, headR + 2, headR * 0.92, 0, Math.PI, 0);
    ctx.lineTo(headR + 2, headY + 4);
    ctx.lineTo(-headR - 2, headY + 4);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Обод
    ctx.fillStyle = shade(hc, -0.28);
    roundRect(ctx, -headR - 3, headY - 4, headR * 2 + 6, 7, 3);
    ctx.fill(); ctx.stroke();
    rivets(ctx, -headR + 1, headR - 1, headY - 1, 5, 'rgba(230,220,200,0.7)');
    ctx.fillStyle = helm.trim || '#a9b3bd';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.arc(i * 11, headY - 10, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    // Складка макушки
    ctx.strokeStyle = shade(hc, -0.2);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-6, headY - 26);
    ctx.quadraticCurveTo(0, headY - 29, 7, headY - 25);
    ctx.stroke();
    return;
  }

  if (vis === 'nasal') {
    // Кавалерийский шлем с наносником и нащёчниками
    ctx.fillStyle = metalFill(ctx, hc, headY - 26, headY + 6);
    ctx.beginPath();
    ctx.ellipse(0, headY - 6, headR + 3, headR * 0.95, 0, Math.PI, 0);
    ctx.lineTo(headR + 3, headY + 2);
    ctx.lineTo(-headR - 3, headY + 2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Нащёчники: две пластины по бокам лица
    [-1, 1].forEach(sd => {
      ctx.fillStyle = shade(hc, -0.1);
      ctx.beginPath();
      ctx.moveTo(sd * (headR - 1), headY - 2);
      ctx.quadraticCurveTo(sd * (headR + 5), headY + 12, sd * (headR - 2), headY + 20);
      ctx.quadraticCurveTo(sd * (headR - 8), headY + 10, sd * (headR - 6), headY - 2);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sd * (headR + 1), headY + 2);
      ctx.lineTo(sd * (headR - 2), headY + 16);
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 4;
    });

    // Наносник
    ctx.fillStyle = shade(hc, 0.14);
    roundRect(ctx, -3, headY - 6, 6, 20, 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(ctx, -2, headY - 4, 2, 14, 1);
    ctx.fill();

    if (helm.trim) {
      ctx.fillStyle = helm.trim;
      roundRect(ctx, -headR - 1, headY - 12, headR * 2 + 2, 4, 2);
      ctx.fill();
      rivets(ctx, -headR + 2, headR - 2, headY - 10, 5, 'rgba(255,255,255,0.5)');
    }
    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ctx.beginPath(); ctx.ellipse(-9, headY - 21, 8, 4, -0.5, 0, Math.PI * 2); ctx.fill();
    return;
  }

  if (vis === 'kettle') {
    // Шапель: купол и широкие поля
    ctx.fillStyle = metalFill(ctx, hc, headY - 22, headY + 4);
    ctx.beginPath();
    ctx.ellipse(0, headY - 4, headR + 2, headR * 0.9, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Поля с утолщённой кромкой
    ctx.fillStyle = shade(hc, -0.08);
    ctx.beginPath();
    ctx.ellipse(0, headY + 2, headR + 16, 9, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = shade(hc, 0.22);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, headY + 1, headR + 13, 6.5, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    // Стойка-шишак на макушке
    ctx.fillStyle = shade(hc, 0.2);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(0, headY - 24, 5, 3.4, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.ellipse(-8, headY - 20, 9, 4, -0.4, 0, Math.PI * 2); ctx.fill();
    rivets(ctx, -headR + 4, headR - 4, headY + 3, 6, 'rgba(20,16,12,0.5)');
    return;
  }

  if (vis === 'murmillo') {
    if (helm.crest) helmetCrest(ctx, helm.crest, headY, headR);

    // Гладкий купол с высоким гребнем-перегородкой
    ctx.fillStyle = metalFill(ctx, hc, headY - 4, headY + headR);
    ctx.beginPath();
    ctx.ellipse(0, headY + 2, headR + 3, headR * 1.02, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Пластина-перегородка по центру
    ctx.fillStyle = shade(hc, 0.2);
    ctx.beginPath();
    ctx.moveTo(-4, headY - headR - 2);
    ctx.quadraticCurveTo(0, headY - headR - 12, 4, headY - headR - 2);
    ctx.lineTo(3, headY - 2);
    ctx.lineTo(-3, headY - 2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Решётка для глаз
    ctx.fillStyle = '#241c15';
    for (let i = 0; i < 3; i++) {
      roundRect(ctx, 4 + i * 7, headY - 6, 4.5, 15, 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(-10, headY - 2, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    // Кромка по низу
    ctx.fillStyle = helm.trim || shade(hc, -0.3);
    roundRect(ctx, -headR - 2, headY + headR - 4, headR * 2 + 4, 5, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.ellipse(-12, headY - 18, 8, 5, -0.45, 0, Math.PI * 2); ctx.fill();
    return;
  }

  if (vis === 'greathelm') {
    // Большой шлем: глухой купол, смотровая щель, дыхательные отверстия
    ctx.fillStyle = metalFill(ctx, hc, headY - headR - 12, headY + headR + 6);
    roundRect(ctx, -headR - 3, headY - headR - 12, (headR + 3) * 2, headR * 2 + 16, 9);
    ctx.fill(); ctx.stroke();

    // Верхняя пластина-навершие
    ctx.fillStyle = shade(hc, 0.16);
    ctx.beginPath();
    ctx.moveTo(-headR + 1, headY - headR - 11);
    ctx.quadraticCurveTo(0, headY - headR - 20, headR - 1, headY - headR - 11);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Смотровая щель с тенью
    ctx.fillStyle = '#0e0a07';
    roundRect(ctx, -headR + 2, headY - 5, (headR - 2) * 2, 7, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, -headR + 2, headY - 5, (headR - 2) * 2, 2, 1);
    ctx.fill();

    // Дыхательные отверстия: две колонки
    ctx.fillStyle = '#1a1410';
    [-1, 1].forEach(sd => {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(sd * (headR - 8), headY + 6 + i * 5, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Кромка и заклёпки
    ctx.fillStyle = shade(hc, -0.32);
    roundRect(ctx, -headR - 3, headY + headR + 1, (headR + 3) * 2, 4, 2);
    ctx.fill();
    rivets(ctx, -headR + 4, headR - 4, headY - headR - 4, 6, 'rgba(255,255,255,0.4)');

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(-headR * 0.5, headY - headR * 0.55, 7, 11, -0.35, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (vis === 'horned') {
    // Рогатый шлем: глухой купол, широкий вырез, два рога
    ctx.fillStyle = metalFill(ctx, hc, headY - headR - 10, headY + headR + 4);
    roundRect(ctx, -headR - 2, headY - headR - 10, (headR + 2) * 2, headR * 2 + 12, 8);
    ctx.fill(); ctx.stroke();

    // Вырез для лица с неровным краем
    ctx.fillStyle = '#1a1410';
    roundRect(ctx, -headR + 3, headY - 6, (headR - 3) * 2, 8, 3);
    ctx.fill();

    // Рога: слоистые, с кольцами роста
    [-1, 1].forEach(sd => {
      ctx.fillStyle = '#f2e6cc';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(sd * (headR - 2), headY - headR - 6);
      ctx.quadraticCurveTo(sd * (headR + 26), headY - headR - 32, sd * (headR + 10), headY - headR - 42);
      ctx.quadraticCurveTo(sd * (headR + 4), headY - headR - 24, sd * (headR - 6), headY - headR - 10);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Кольца на роге
      ctx.strokeStyle = 'rgba(150,120,80,0.75)';
      ctx.lineWidth = 1.6;
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        ctx.beginPath();
        ctx.moveTo(sd * (headR - 1 + t * 10), headY - headR - 8 - t * 10);
        ctx.quadraticCurveTo(sd * (headR + 6 + t * 12), headY - headR - 14 - t * 14, sd * (headR + 12 + t * 10), headY - headR - 20 - t * 16);
        ctx.stroke();
      }
      // Основание рога — металлическая розетка
      ctx.fillStyle = shade(hc, -0.15);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.ellipse(sd * (headR - 3), headY - headR - 7, 5, 3.4, sd * 0.4, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    });

    rivets(ctx, -headR + 4, headR - 4, headY + headR - 2, 5, 'rgba(255,255,255,0.4)');
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(-headR * 0.45, headY - headR * 0.5, 6, 10, -0.35, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (vis === 'crown') {
    // Венец: золотой обруч с зубцами и самоцветами
    ctx.fillStyle = metalFill(ctx, hc, headY - 34, headY - 2);
    ctx.beginPath();
    ctx.moveTo(-headR, headY - 16);
    for (let i = 0; i <= 4; i++) {
      const px = -headR + (i * headR * 2) / 4;
      ctx.lineTo(px, headY - (i % 2 === 0 ? 34 : 22));
    }
    ctx.lineTo(headR, headY - 16);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Обруч
    ctx.fillStyle = shade(hc, -0.2);
    roundRect(ctx, -headR - 1, headY - 18, headR * 2 + 2, 8, 3);
    ctx.fill(); ctx.stroke();
    rivets(ctx, -headR + 3, headR - 3, headY - 14, 6, 'rgba(90,70,20,0.6)');

    // Самоцветы
    ctx.fillStyle = helm.trim || '#c0392b';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0, headY - 20, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    [-1, 1].forEach(sd => {
      ctx.fillStyle = '#2e6a9a';
      ctx.beginPath(); ctx.arc(sd * (headR * 0.62), headY - 20, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    // Блик
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-headR * 0.7, headY - 26);
    ctx.lineTo(-headR * 0.5, headY - 30);
    ctx.stroke();
    return;
  }

  if (vis === 'hanhelm') {
    // Ханьский колпак: лаковая шапочка с широким назатыльником и шипом
    ctx.fillStyle = metalFill(ctx, hc, headY - 30, headY + 6);
    ctx.beginPath();
    ctx.moveTo(-headR - 2, headY + 2);
    ctx.quadraticCurveTo(-headR - 4, headY - 26, 0, headY - 30);
    ctx.quadraticCurveTo(headR + 4, headY - 26, headR + 2, headY + 2);
    ctx.quadraticCurveTo(0, headY + 8, -headR - 2, headY + 2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Лаковая полоса по низу и золотая кромка
    ctx.fillStyle = helm.trim || '#e2b65a';
    roundRect(ctx, -headR - 2, headY - 4, headR * 2 + 4, 4, 2);
    ctx.fill();
    // Шип на макушке
    ctx.fillStyle = shade(hc, 0.25);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-4, headY - 28);
    ctx.lineTo(0, headY - 40);
    ctx.lineTo(4, headY - 28);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Бархатная кисточка сзади
    ctx.strokeStyle = helm.trim || '#e2b65a';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(headR * 0.55 + i * 2, headY - 18);
      ctx.quadraticCurveTo(headR * 0.8 + i * 3, headY - 6, headR * 0.6 + i * 3, headY + 6);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(-9, headY - 20, 7, 5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (vis === 'rushelm') {
    // Русский шелом: высокий купол с навершием, бармица по бокам
    ctx.fillStyle = metalFill(ctx, hc, headY - 36, headY + 8);
    ctx.beginPath();
    ctx.moveTo(-headR - 1, headY + 1);
    ctx.quadraticCurveTo(-headR - 3, headY - 18, -6, headY - 34);
    ctx.quadraticCurveTo(0, headY - 40, 6, headY - 34);
    ctx.quadraticCurveTo(headR + 3, headY - 18, headR + 1, headY + 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Навершие-шишак
    ctx.fillStyle = helm.trim || '#c9a45c';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, headY - 39, 3.2, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Кромка-обруч
    ctx.fillStyle = shade(hc, -0.3);
    roundRect(ctx, -headR - 1, headY - 3, headR * 2 + 2, 5, 2);
    ctx.fill();
    // Бармица: кольчужная сетка по бокам
    ctx.strokeStyle = shade(hc, -0.25);
    ctx.lineWidth = 1.3;
    [-1, 1].forEach(sd => {
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(sd * (headR - 1), headY + 1 + i * 4);
        ctx.lineTo(sd * (headR - 8), headY + 3 + i * 4);
        ctx.stroke();
      }
    });
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.ellipse(-8, headY - 22, 6, 10, -0.4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (vis === 'mongolhelm') {
    // Монгольский шлем: купол на кожаной основе, меховой обод, наносник
    ctx.fillStyle = metalFill(ctx, hc, headY - 28, headY + 4);
    ctx.beginPath();
    ctx.ellipse(0, headY - 4, headR + 1, headR * 0.98, 0, Math.PI, 0);
    ctx.lineTo(headR + 1, headY + 3);
    ctx.lineTo(-headR - 1, headY + 3);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Меховой обод: рыхлая полоса
    ctx.fillStyle = '#b8a888';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-headR - 3, headY + 3);
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const px = -headR - 3 + (headR * 2 + 6) * t;
      ctx.quadraticCurveTo(px + 2, headY + 9, px + 5, headY + 3);
    }
    ctx.lineTo(headR + 3, headY - 2);
    ctx.lineTo(-headR - 3, headY - 2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Наносник и кожаный ремешок
    ctx.fillStyle = shade(hc, -0.2);
    roundRect(ctx, -2.5, headY - 2, 5, 16, 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = helm.trim || '#5a4a2e';
    roundRect(ctx, -headR - 2, headY - 8, headR * 2 + 4, 4, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.26)';
    ctx.beginPath();
    ctx.ellipse(-9, headY - 18, 7, 5, -0.45, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
}

// ==================== БРОНЯ ТЕЛА ====================
// Материал доспеха зависит от тира: чем выше тир, тем чище металл,
// богаче краситель и больше отделки. Низкие тиры пыльные и латаные.
const ARMOR_TIER_STYLE = {
  1: { grime: '#5a5040', grimeAmt: 0.34, polish: 0.00, trim: null,      ornament: 0 },
  2: { grime: '#57503f', grimeAmt: 0.20, polish: 0.06, trim: '#8a7a5a', ornament: 1 },
  3: { grime: '#4a4638', grimeAmt: 0.09, polish: 0.14, trim: '#a08a5a', ornament: 2 },
  4: { grime: '#3a3a40', grimeAmt: 0.00, polish: 0.24, trim: '#c9a45c', ornament: 3 },
  5: { grime: '#2a2a30', grimeAmt: 0.00, polish: 0.34, trim: '#e8c65f', ornament: 5 }
};

const METAL_VIS = ['mail', 'chain', 'scale', 'dragon', 'lamellar', 'splint',
  'plate', 'lorica', 'imperial', 'bronze', 'manica', 'greaves', 'gold', 'bracers', 'medieval', 'rus'];

function hex2rgb(hex) {
  if (!hex || hex[0] !== '#') return { r: 140, g: 120, b: 100 };
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgb2hex(r, g, b) {
  return '#' + [r, g, b]
    .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');
}

function mixColor(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  return rgb2hex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}

// Палитра доспеха: базовый тон, тень, блик, отделка и «богатство» тира
function armorPalette(item) {
  if (!item) return null;
  const tier = Math.max(1, Math.min(5, item.tier || 1));
  const st = ARMOR_TIER_STYLE[tier];
  const vis = item.vis || '';
  const metal = METAL_VIS.includes(vis);
  const raw = item.color || '#8a7a66';

  let base;
  if (metal) {
    // Металл: тир добавляет полировку и убирает грязь
    base = mixColor(raw, '#f2f6fa', st.polish * 0.55);
    if (st.grimeAmt > 0) base = mixColor(base, st.grime, st.grimeAmt);
  } else {
    // Ткань и кожа: тир добавляет насыщенности красителю
    base = tier >= 4 ? mixColor(raw, '#fff2d8', st.polish * 0.45)
      : mixColor(raw, '#6a5a44', st.grimeAmt * 0.55);
  }

  const trim = st.trim ? mixColor(st.trim, base, tier === 5 ? 0.12 : 0.34) : shade(base, -0.22);
  return {
    base,
    dark: shade(base, -0.34),
    light: shade(base, 0.32),
    deep: shade(base, -0.55),
    trim,
    tier,
    metal,
    polish: st.polish,
    ornament: st.ornament,
    grime: st.grimeAmt
  };
}

// Фактура материала: штрихи металла, плетение ткани, зерно кожи
function armorTexture(ctx, vis, pal, shoulder, waist, hipY) {
  const top = hipY - 47;
  const h = 44;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-shoulder, top, shoulder * 2, h);
  ctx.clip();

  if (vis === 'mail' || vis === 'chain') {
    // Мелкая «рябь» колец, тем заметнее, чем ниже тир
    ctx.globalAlpha = 0.16 + (1 - pal.tier / 5) * 0.14;
    ctx.fillStyle = pal.deep;
    for (let y = top; y < top + h; y += 3.2) {
      for (let x = -shoulder; x < shoulder; x += 4) {
        const off = (Math.round(y / 3.2) % 2) ? 2 : 0;
        ctx.fillRect(x + off, y, 1.1, 1.1);
      }
    }
  } else if (METAL_VIS.includes(vis)) {
    // Полированный металл: длинные блики вдоль корпуса
    if (pal.polish > 0.05) {
      ctx.globalAlpha = 0.10 + pal.polish * 0.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        const x = -shoulder + 6 + i * (shoulder * 2 - 12) / 5;
        ctx.beginPath();
        ctx.moveTo(x, top + 2);
        ctx.lineTo(x + 3, top + h - 4);
        ctx.stroke();
      }
    }
    // Тёмные разводы и забоины у простого металла
    if (pal.grime > 0.05) {
      ctx.globalAlpha = pal.grime * 0.55;
      ctx.fillStyle = pal.deep;
      for (let i = 0; i < 9; i++) {
        const px = -shoulder + ((i * 37) % 100) / 100 * shoulder * 2;
        const py = top + ((i * 53) % 100) / 100 * h;
        ctx.beginPath();
        ctx.ellipse(px, py, 2 + (i % 3), 1.2 + (i % 2), i, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (vis === 'tunic' || vis === 'rags' || vis === 'gambeson' || vis === 'quilted') {
    // Ткань: поперечные нити основы
    ctx.globalAlpha = 0.10;
    ctx.strokeStyle = pal.deep;
    ctx.lineWidth = 1;
    for (let y = top; y < top + h; y += 3) {
      ctx.beginPath();
      ctx.moveTo(-shoulder, y);
      ctx.lineTo(shoulder, y);
      ctx.stroke();
    }
  } else {
    // Кожа: зерно и заломы
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = pal.deep;
    for (let i = 0; i < 26; i++) {
      const px = -shoulder + ((i * 41) % 100) / 100 * shoulder * 2;
      const py = top + ((i * 61) % 100) / 100 * h;
      ctx.beginPath();
      ctx.arc(px, py, 0.9 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Отделка по тиру: нашивки, заклёпки, гравировка, самоцвет
function armorOrnament(ctx, vis, pal, shoulder, waist, hipY) {
  if (pal.ornament <= 0) return;
  const n = pal.ornament;

  // Кромка по подолу и вороту — со 2-го тира
  ctx.strokeStyle = pal.trim;
  ctx.lineWidth = n >= 4 ? 2.6 : 1.8;
  ctx.beginPath();
  ctx.moveTo(-waist + 1, hipY - 5);
  ctx.quadraticCurveTo(0, hipY - 1, waist - 1, hipY - 5);
  ctx.stroke();
  if (n >= 3) {
    ctx.beginPath();
    ctx.moveTo(-shoulder * 0.86, hipY - 47);
    ctx.quadraticCurveTo(0, hipY - 51, shoulder * 0.86, hipY - 47);
    ctx.stroke();
  }

  // Заклёпки по кромке: 3 → 5 → 8
  const rivetCount = n >= 5 ? 8 : n >= 4 ? 6 : n >= 3 ? 5 : n >= 2 ? 3 : 0;
  if (rivetCount) {
    ctx.fillStyle = n >= 4 ? pal.trim : 'rgba(30,24,16,0.65)';
    for (let i = 0; i < rivetCount; i++) {
      const t = (i + 0.5) / rivetCount;
      const x = -waist + 3 + (waist * 2 - 6) * t;
      ctx.beginPath();
      ctx.arc(x, hipY - 6, n >= 4 ? 1.6 : 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Нашивка/накладка на груди — с 3-го тира
  if (n >= 3) {
    ctx.fillStyle = pal.trim;
    ctx.strokeStyle = pal.deep;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, hipY - 32, n >= 5 ? 8 : 6, n >= 5 ? 9 : 7, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(-2, hipY - 34, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Гравировка по борту — 4-й тир и выше
  if (n >= 4) {
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.85;
    [-1, 1].forEach(sd => {
      ctx.beginPath();
      ctx.moveTo(sd * shoulder * 0.62, hipY - 44);
      ctx.quadraticCurveTo(sd * shoulder * 0.9, hipY - 30, sd * shoulder * 0.68, hipY - 10);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const yy = hipY - 40 + i * 11;
        ctx.beginPath();
        ctx.arc(sd * shoulder * 0.72, yy, 1.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
  }

  // Самоцвет и золотое сияние — только легендарный
  if (n >= 5) {
    ctx.fillStyle = '#c0392b';
    ctx.strokeStyle = '#7a1a12';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, hipY - 32, 2.6, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,190,0.9)';
    ctx.beginPath();
    ctx.arc(-0.8, hipY - 33, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Каждый тип брони рисуется в слои: форма, фактура материала, отделка по тиру.
function drawBodyArmorDetail(ctx, body, shoulder, waist, hipY) {
  const pal = armorPalette(body);
  const c = pal.base;
  const dark = pal.dark;
  const light = pal.light;
  const vis = body.vis;

  // Общая подсветка: слева сверху светлее, справа снизу темнее
  const sheen = (x, y, rx, ry, rot) => {
    ctx.fillStyle = `rgba(255,255,255,${0.14 + pal.polish * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || -0.4, 0, Math.PI * 2);
    ctx.fill();
  };
  // Кромка снизу — тёмная полоса, «подрезающая» силуэт
  const hem = (y, h) => {
    ctx.fillStyle = dark;
    roundRect(ctx, -waist + 1, y, waist * 2 - 2, h || 4, 2);
    ctx.fill();
  };

  ctx.strokeStyle = 'rgba(0,0,0,0.32)';
  ctx.lineWidth = 2.4;

  if (vis === 'mail' || vis === 'chain') {
    // Кольчуга: плетение «в шахматку» с блеском на кольцах
    const step = 7;
    for (let yy = hipY - 46; yy < hipY; yy += step) {
      for (let xx = -shoulder; xx < shoulder; xx += step) {
        const off = (Math.round((yy - hipY) / step) % 2) ? step / 2 : 0;
        ctx.strokeStyle = dark;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(xx + off, yy, step * 0.34, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = `rgba(255,255,255,${0.16 + pal.polish * 0.7})`;
    ctx.lineWidth = 1.2;
    for (let yy = hipY - 44; yy < hipY; yy += step * 2) {
      for (let xx = -shoulder + 3; xx < shoulder; xx += step * 2) {
        ctx.beginPath();
        ctx.arc(xx, yy, 2.2, Math.PI * 1.1, Math.PI * 1.7);
        ctx.stroke();
      }
    }
    // Ворот и подол
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-shoulder + 3, hipY - 45);
    ctx.quadraticCurveTo(0, hipY - 40, shoulder - 3, hipY - 45);
    ctx.stroke();
    hem(hipY - 4, 4);
  } else if (vis === 'scale' || vis === 'dragon') {
    // Чешуя: набегающие ряды с бликом на каждой чешуйке
    for (let row = 0; row < 6; row++) {
      for (let i = -4; i <= 4; i++) {
        const sx = i * 8 + (row % 2 ? 4 : 0);
        const sy = hipY - 46 + row * 8;
        ctx.fillStyle = row % 2 ? shade(c, 0.08) : c;
        ctx.strokeStyle = dark;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(sx, sy, 4.6, 0, Math.PI);
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.22 + pal.polish * 0.5})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(sx - 1, sy - 0.5, 2.6, Math.PI * 1.15, Math.PI * 1.65);
        ctx.stroke();
      }
    }
    if (vis === 'dragon') {
      // Чешуя дракона: радужные искры
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(180,255,210,0.5)' : 'rgba(255,220,150,0.45)';
        ctx.beginPath();
        ctx.arc(-shoulder * 0.62 + i * 9, hipY - 32 + (i % 2) * 9, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    hem(hipY - 4, 4);
  } else if (vis === 'lamellar' || vis === 'splint') {
    // Ламелляр: пластины внахлёст, каждая с фаской и заклёпками
    for (let row = 0; row < 6; row++) {
      for (let i = -2; i <= 2; i++) {
        const px = i * 11 - 5;
        const py = hipY - 46 + row * 8;
        ctx.fillStyle = row % 2 ? shade(c, 0.1) : shade(c, -0.06);
        ctx.strokeStyle = dark;
        ctx.lineWidth = 1.6;
        roundRect(ctx, px, py, 9, 7.4, 2);
        ctx.fill(); ctx.stroke();
        // Верхняя фаска
        ctx.strokeStyle = `rgba(255,255,255,${0.2 + pal.polish * 0.6})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 1, py + 1.4);
        ctx.lineTo(px + 8, py + 1.4);
        ctx.stroke();
        // Заклёпки
        ctx.fillStyle = 'rgba(30,24,18,0.55)';
        ctx.beginPath(); ctx.arc(px + 2.2, py + 5.4, 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 6.8, py + 5.4, 0.9, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Кожаный ремень с бляхой
    ctx.fillStyle = '#5a3f22';
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.8;
    roundRect(ctx, -waist + 1, hipY - 26, waist * 2 - 2, 6, 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.trim;
    ctx.beginPath(); ctx.arc(0, hipY - 23, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (vis === 'plate' || vis === 'lorica' || vis === 'imperial' || vis === 'bronze') {
    // Пластинчатая / чешуйчато-ременная: кираса с рёбрами жёсткости.
    // Линии делаем контрастными: на маленьком спрайте полутон пропадает.
    const edge = pal.deep;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2.6;
    // Осевой шов и рёбра
    ctx.beginPath(); ctx.moveTo(0, hipY - 50); ctx.lineTo(0, hipY - 4); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-shoulder, hipY - 26);
    ctx.quadraticCurveTo(0, hipY - 16, shoulder, hipY - 26);
    ctx.stroke();
    // Боковые рёбра кирасы
    ctx.lineWidth = 2;
    [-1, 1].forEach(sd => {
      ctx.beginPath();
      ctx.moveTo(sd * shoulder * 0.55, hipY - 46);
      ctx.quadraticCurveTo(sd * shoulder * 0.8, hipY - 26, sd * shoulder * 0.6, hipY - 6);
      ctx.stroke();
    });
    if (vis === 'lorica' || vis === 'imperial') {
      // Ремни лорики: горизонтальные полосы с заклёпками
      for (let i = 0; i < 4; i++) {
        const yy = hipY - 44 + i * 10;
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(-shoulder + 3, yy);
        ctx.quadraticCurveTo(0, yy + 4, shoulder - 3, yy);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.3 + pal.polish * 0.5})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-shoulder + 4, yy - 1.8);
        ctx.quadraticCurveTo(0, yy + 2, shoulder - 4, yy - 1.8);
        ctx.stroke();
        ctx.fillStyle = 'rgba(30,24,16,0.7)';
        [-0.62, -0.3, 0.3, 0.62].forEach(k => {
          ctx.beginPath();
          ctx.arc(shoulder * k, yy + 3 + (1 - Math.abs(k)) * 1.2, 1.3, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
    if (vis === 'bronze') {
      // Нагрудные диски-умбоны
      [-1, 1].forEach(sd => {
        ctx.fillStyle = shade(c, 0.2);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(sd * shoulder * 0.32, hipY - 30, 8, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(sd * shoulder * 0.32, hipY - 30, 5, Math.PI * 1.1, Math.PI * 1.7);
        ctx.stroke();
      });
    }
    if (vis === 'plate' || vis === 'imperial') {
      // Кромка ворота
      ctx.strokeStyle = light;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-shoulder * 0.9, hipY - 48);
      ctx.quadraticCurveTo(0, hipY - 52, shoulder * 0.9, hipY - 48);
      ctx.stroke();
    }
    sheen(-9, hipY - 38, 8, 6, -0.4);
    hem(hipY - 5, 4);
  } else if (vis === 'medieval') {
    // Рыцарский доспех: цельная кираса, наплечники и ремень с бляхой
    const edge = pal.deep;
    // Наплечники — две выпуклые створки
    [-1, 1].forEach(sd => {
      ctx.fillStyle = shade(c, 0.18);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(sd * shoulder * 0.78, hipY - 46, 11, 8, sd * 0.35, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(sd * shoulder * 0.78, hipY - 46, 7, Math.PI * 1.05, Math.PI * 1.6);
      ctx.stroke();
    });
    // Грудная пластина с осевым ребром
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(0, hipY - 46);
    ctx.quadraticCurveTo(3, hipY - 26, 0, hipY - 8);
    ctx.stroke();
    // Рёбра жёсткости по бокам
    ctx.lineWidth = 1.8;
    [-1, 1].forEach(sd => {
      ctx.beginPath();
      ctx.moveTo(sd * shoulder * 0.5, hipY - 44);
      ctx.quadraticCurveTo(sd * shoulder * 0.72, hipY - 24, sd * shoulder * 0.56, hipY - 8);
      ctx.stroke();
    });
    // Латы на животе: две горизонтальные полосы
    for (let i = 0; i < 2; i++) {
      const yy = hipY - 22 + i * 8;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-waist + 3, yy);
      ctx.quadraticCurveTo(0, yy + 3, waist - 3, yy);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-waist + 4, yy - 1.6);
      ctx.quadraticCurveTo(0, yy + 1.4, waist - 4, yy - 1.6);
      ctx.stroke();
    }
    // Ремень и бляха
    ctx.fillStyle = '#5a3f22';
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.6;
    roundRect(ctx, -waist, hipY - 13, waist * 2, 6, 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.trim;
    ctx.beginPath(); ctx.arc(0, hipY - 10, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Плюмаж-накидка по цвету отделки на груди
    ctx.fillStyle = hexA(body.trim || '#c0392b', 0.85);
    ctx.beginPath();
    ctx.moveTo(-9, hipY - 46);
    ctx.lineTo(9, hipY - 46);
    ctx.lineTo(6, hipY - 34);
    ctx.lineTo(-6, hipY - 34);
    ctx.closePath();
    ctx.fill();
    sheen(-11, hipY - 36, 7, 9, -0.4);
    hem(hipY - 5, 4);
  } else if (vis === 'china') {
    // Ханьский ламелляр: красный лак, ряды пластин, пояс с драконом
    for (let row = 0; row < 6; row++) {
      for (let i = -3; i <= 3; i++) {
        const px = i * 9 - 4;
        const py = hipY - 46 + row * 8;
        ctx.fillStyle = row % 2 ? shade(c, 0.1) : shade(c, -0.08);
        ctx.strokeStyle = pal.deep;
        ctx.lineWidth = 1.4;
        roundRect(ctx, px, py, 8, 7, 1.6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = pal.trim;
        ctx.beginPath();
        ctx.arc(px + 4, py + 3.4, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Пояс с золотой накладкой-драконом
    ctx.fillStyle = '#3a2418';
    ctx.strokeStyle = pal.deep;
    ctx.lineWidth = 1.8;
    roundRect(ctx, -waist, hipY - 16, waist * 2, 7, 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.trim;
    ctx.beginPath();
    ctx.moveTo(-9, hipY - 12);
    ctx.quadraticCurveTo(-3, hipY - 17, 2, hipY - 12);
    ctx.quadraticCurveTo(6, hipY - 9, 10, hipY - 13);
    ctx.lineTo(10, hipY - 10);
    ctx.quadraticCurveTo(4, hipY - 6, -2, hipY - 9);
    ctx.closePath();
    ctx.fill();
    // Воротник-стойка
    ctx.fillStyle = shade(c, 0.2);
    ctx.strokeStyle = pal.deep;
    ctx.lineWidth = 1.8;
    roundRect(ctx, -12, hipY - 50, 24, 7, 2);
    ctx.fill(); ctx.stroke();
    sheen(-11, hipY - 36, 6, 9, -0.4);
    hem(hipY - 5, 4);
  } else if (vis === 'rus') {
    // Русская кольчуга: плетение с медными вставками и поясом
    const step = 6.4;
    for (let yy = hipY - 46; yy < hipY; yy += step) {
      for (let xx = -shoulder; xx < shoulder; xx += step) {
        const off = (Math.round((yy - hipY) / step) % 2) ? step / 2 : 0;
        ctx.strokeStyle = pal.deep;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(xx + off, yy, step * 0.36, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Медные вставки-бляхи на груди
    ctx.fillStyle = pal.trim;
    ctx.strokeStyle = pal.deep;
    ctx.lineWidth = 1.2;
    [-1, 1].forEach(sd => {
      ctx.beginPath();
      ctx.ellipse(sd * shoulder * 0.42, hipY - 32, 4.4, 5.4, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    });
    // Ворот и подол
    ctx.strokeStyle = pal.deep;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-shoulder + 3, hipY - 45);
    ctx.quadraticCurveTo(0, hipY - 40, shoulder - 3, hipY - 45);
    ctx.stroke();
    // Ремень
    ctx.fillStyle = '#4a2e1c';
    ctx.lineWidth = 1.6;
    roundRect(ctx, -waist, hipY - 15, waist * 2, 6, 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.trim;
    ctx.beginPath(); ctx.arc(0, hipY - 12, 3, 0, Math.PI * 2); ctx.fill();
    sheen(-11, hipY - 38, 6, 8, -0.4);
    hem(hipY - 5, 4);
  } else if (vis === 'mongol') {
    // Монгольский хатанга: кожаная основа, стальные накладки, меховой ворот
    ctx.fillStyle = shade(c, -0.06);
    roundRect(ctx, -waist, hipY - 48, waist * 2, 44, 6);
    ctx.fill();
    // Стальные накладки-полосы
    for (let i = 0; i < 4; i++) {
      const yy = hipY - 44 + i * 10;
      ctx.fillStyle = shade('#9aa6b2', -0.05 + (i % 2) * 0.08);
      ctx.strokeStyle = pal.deep;
      ctx.lineWidth = 1.6;
      roundRect(ctx, -waist + 4, yy, waist * 2 - 8, 7, 3);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      roundRect(ctx, -waist + 6, yy + 1.2, (waist * 2 - 12) * 0.5, 2, 1);
      ctx.fill();
    }
    // Меховой воротник
    ctx.fillStyle = '#b8a888';
    ctx.strokeStyle = pal.deep;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-shoulder * 0.9, hipY - 47);
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const px = -shoulder * 0.9 + shoulder * 1.8 * t;
      ctx.quadraticCurveTo(px + 2, hipY - 52, px + 5, hipY - 47);
    }
    ctx.lineTo(shoulder * 0.9, hipY - 42);
    ctx.lineTo(-shoulder * 0.9, hipY - 42);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Пояс с подвесками
    ctx.fillStyle = '#3a2418';
    ctx.strokeStyle = pal.deep;
    ctx.lineWidth = 1.6;
    roundRect(ctx, -waist, hipY - 12, waist * 2, 6, 2);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 1.6;
    [-1, 1].forEach(sd => {
      ctx.beginPath();
      ctx.moveTo(sd * 8, hipY - 7);
      ctx.lineTo(sd * 9, hipY + 1);
      ctx.stroke();
    });
    sheen(-11, hipY - 36, 6, 8, -0.4);
  } else if (vis === 'leather' || vis === 'brigandine' || vis === 'hide') {
    // Кожа: ремни, шнуровка и прошивка по краю
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-shoulder + 2, hipY - 34); ctx.lineTo(shoulder - 2, hipY - 34);
    ctx.moveTo(-shoulder + 2, hipY - 20); ctx.lineTo(shoulder - 2, hipY - 20);
    ctx.stroke();
    // Шнуровка спереди
    ctx.strokeStyle = pal.tier >= 3 ? pal.trim : '#e8dcc0';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const yy = hipY - 40 + i * 10;
      ctx.beginPath();
      ctx.moveTo(-5, yy); ctx.lineTo(5, yy + 5);
      ctx.moveTo(5, yy); ctx.lineTo(-5, yy + 5);
      ctx.stroke();
    }
    // Заклёпки по ремню
    ctx.fillStyle = pal.tier >= 4 ? pal.trim : '#b9a06a';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.arc(i * 9, hipY - 27, 2, 0, Math.PI * 2); ctx.fill();
    }
    if (vis === 'brigandine') {
      // Бригантина: под кожей угадываются пластины
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-shoulder + 6, hipY - 16 + i * 5);
        ctx.lineTo(shoulder - 6, hipY - 16 + i * 5);
        ctx.stroke();
      }
    }
    if (vis === 'hide') {
      // Шкура: неровный мех по краю
      ctx.strokeStyle = shade(c, 0.35);
      ctx.lineWidth = 1.6;
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 6, hipY - 47);
        ctx.quadraticCurveTo(i * 6 + 3, hipY - 42, i * 6, hipY - 37);
        ctx.stroke();
      }
    }
    sheen(-10, hipY - 40, 7, 5, -0.4);
    hem(hipY - 5, 4);
  } else if (vis === 'gambeson' || vis === 'quilted') {
    // Стёганка: ромбы прострочки и мягкие валики
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * 9, hipY - 46); ctx.lineTo(i * 9, hipY); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Диагональная прострочка — ромбы
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-shoulder + 4, hipY - 40 + i * 11);
      ctx.lineTo(shoulder - 4, hipY - 46 + i * 11);
      ctx.stroke();
    }
    sheen(-9, hipY - 38, 8, 5, -0.4);
    hem(hipY - 5, 4);
  } else if (vis === 'tunic' || vis === 'rags') {
    // Туника: пояс, складки и вышитая кайма
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-shoulder + 4, hipY - 30); ctx.lineTo(shoulder - 4, hipY - 30);
    ctx.stroke();
    ctx.fillStyle = shade(c, 0.2);
    ctx.beginPath();
    ctx.moveTo(-10, hipY - 48); ctx.lineTo(10, hipY - 48); ctx.lineTo(6, hipY - 38); ctx.lineTo(-6, hipY - 38);
    ctx.closePath(); ctx.fill();
    // Складки ткани от пояса вниз
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1.6;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 7, hipY - 28);
      ctx.quadraticCurveTo(i * 8 + 1, hipY - 16, i * 7 + 2, hipY - 3);
      ctx.stroke();
    }
    // Кайма по подолу
    ctx.strokeStyle = pal.tier >= 3 ? pal.trim : dark;
    ctx.lineWidth = pal.tier >= 3 ? 2.6 : 2.2;
    ctx.beginPath();
    ctx.moveTo(-waist + 2, hipY - 4);
    ctx.quadraticCurveTo(0, hipY, waist - 2, hipY - 4);
    ctx.stroke();
    if (vis === 'rags') {
      // Прорехи и заплатки
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(-shoulder * 0.6 + i * 13, hipY - 34 + (i % 2) * 12, 4, 6, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(210,190,150,0.5)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-shoulder * 0.4, hipY - 30);
      ctx.lineTo(-shoulder * 0.4 + 9, hipY - 30);
      ctx.moveTo(shoulder * 0.3, hipY - 18);
      ctx.lineTo(shoulder * 0.3 + 8, hipY - 18);
      ctx.stroke();
    }
  }

  // Поверх формы — фактура материала и отделка по тиру
  armorTexture(ctx, vis, pal, shoulder, waist, hipY);
  armorOrnament(ctx, vis, pal, shoulder, waist, hipY);
}

// ==================== БРОНЯ НОГ ====================
function drawLegArmor(ctx, legs, legColor, footY, legF, legB, lostL, lostR) {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  const vis = legs ? legs.vis : 'none';

  if (!lostL) {
    ctx.fillStyle = legs ? shade(legColor, 0.08) : '#4a3020';
    roundRect(ctx, -25, footY - 9, 22, 10, 4); ctx.fill(); ctx.stroke();
  }
  if (!lostR) {
    ctx.fillStyle = legs ? shade(legColor, 0.08) : '#4a3020';
    roundRect(ctx, 3, footY - 9, 22, 10, 4); ctx.fill(); ctx.stroke();
  }
  if (!legs) return;

  if (['greaves', 'plate', 'gold', 'sandals', 'boots'].includes(vis)) {
    ctx.fillStyle = shade(legColor, 0.2);
    if (!lostL) { roundRect(ctx, -22, footY - 26, 16, 18, 4); ctx.fill(); ctx.stroke(); }
    if (!lostR) { roundRect(ctx, 7, footY - 26, 16, 18, 4); ctx.fill(); ctx.stroke(); }
    if (vis === 'plate' || vis === 'gold') {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      if (!lostL) { roundRect(ctx, -20, footY - 24, 4, 12, 2); ctx.fill(); }
      if (!lostR) { roundRect(ctx, 9, footY - 24, 4, 12, 2); ctx.fill(); }
    }
  } else if (vis === 'wraps' || vis === 'chain' || vis === 'scale') {
    ctx.strokeStyle = shade(legColor, -0.25);
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) {
      if (!lostL) { ctx.beginPath(); ctx.moveTo(-22, footY - 22 + i * 6); ctx.lineTo(-6, footY - 20 + i * 6); ctx.stroke(); }
      if (!lostR) { ctx.beginPath(); ctx.moveTo(7, footY - 22 + i * 6); ctx.lineTo(23, footY - 20 + i * 6); ctx.stroke(); }
    }
  }
}

// ==================== ЩИТЫ ====================
function drawShield(ctx, sc, x, y) {
  const c = sc.color || '#a5744a';
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = c;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 4;
  const vis = sc.vis || 'round';
  const em = sc.emblem;

  if (vis === 'scutum' || vis === 'tower') {
    const h = vis === 'tower' ? 80 : 66;
    const w = vis === 'tower' ? 34 : 28;
    roundRect(ctx, -w / 2, -h / 2, w, h, vis === 'tower' ? 6 : 9);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = shade(c, -0.3);
    ctx.beginPath(); ctx.arc(0, -2, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e0bd5f';
    ctx.beginPath(); ctx.arc(0, -2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-w / 2 + 5, -h / 2 + 6); ctx.lineTo(-w / 2 + 5, h / 2 - 6); ctx.stroke();
    ctx.strokeStyle = shade(c, 0.22);
    ctx.beginPath(); ctx.moveTo(0, -h / 2 + 8); ctx.lineTo(0, h / 2 - 8); ctx.stroke();
    if (em === 'gold') {
      ctx.fillStyle = 'rgba(229,181,79,0.55)';
      ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, 6);
    }
    if (em === 'lion') {
      ctx.fillStyle = '#e5b54f';
      ctx.beginPath(); ctx.arc(0, 8, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(c, -0.4);
      ctx.beginPath(); ctx.arc(0, 8, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (vis === 'kite') {
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.quadraticCurveTo(24, -30, 20, 2);
    ctx.quadraticCurveTo(14, 24, 0, 40);
    ctx.quadraticCurveTo(-14, 24, -20, 2);
    ctx.quadraticCurveTo(-24, -30, 0, -34);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (em === 'cross') {
      ctx.strokeStyle = '#e5b54f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -26); ctx.lineTo(0, 30);
      ctx.moveTo(-14, -8); ctx.lineTo(14, -8);
      ctx.stroke();
    }
    ctx.fillStyle = shade(c, -0.32);
    ctx.beginPath(); ctx.arc(0, -6, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e0bd5f';
    ctx.beginPath(); ctx.arc(0, -6, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }

  const r = vis === 'buckler' ? 20 : 27;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  if (em === 'spikes') {
    ctx.fillStyle = '#d0d8e0';
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * (r - 4), Math.sin(ang) * (r - 4));
      ctx.lineTo(Math.cos(ang) * (r + 9), Math.sin(ang) * (r + 9));
      ctx.lineTo(Math.cos(ang + 0.2) * (r - 4), Math.sin(ang + 0.2) * (r - 4));
      ctx.closePath(); ctx.fill();
    }
  }
  if (em === 'studs') {
    ctx.fillStyle = '#c8d2dc';
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * (r - 7), Math.sin(ang) * (r - 7), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (em === 'mirror') {
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.5, 'rgba(200,215,230,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0.75)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r - 3, 0, Math.PI * 2); ctx.fill();
  }
  if (em === 'lambda') {
    ctx.strokeStyle = '#8a2f28';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-7, 10); ctx.lineTo(0, -12); ctx.lineTo(7, 10);
    ctx.stroke();
  }
  if (em === 'gold') {
    ctx.strokeStyle = '#e5b54f';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, r - 3, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.fillStyle = shade(c, -0.32);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c9d3dc';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r - 5, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
  ctx.restore();
}

// ==================== ОРУЖИЕ ====================
// Угол хвата в руке. Клинок и древко несутся остриём вперёд,
// а лук и арбалет держат иначе: лук — почти вертикально,
// арбалет — ложем вперёд, чуть опустив при ходьбе.
function weaponHoldAngle(w, gear, swing) {
  const v = w.vis || WEAPON_VIS[w.shape] || WEAPON_VIS.gladius;
  if (v.head === 'bow') return -0.34 + (swing || 0) * 0.34;
  if (v.head === 'xbow') return 0.28 - (swing || 0) * 0.28;
  return gear.carry + gear.wpnLag;
}

function drawWeapon(ctx, w) {
  const v = w.vis || WEAPON_VIS[w.shape] || WEAPON_VIS.gladius;
  if (v.dual) {
    drawWeaponShape(ctx, v, w);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-12, 0);
    drawWeaponShape(ctx, v, w);
    ctx.restore();
    return;
  }
  drawWeaponShape(ctx, v, w);
}

// ==================== ДЕТАЛИ ОРУЖИЯ ====================
// У каждой вещи свой «характер»: обмотка, навершие, обойма у головки,
// темляк, гравировка. Хеш от id стабилен, поэтому модель не мигает.
function weaponHash(w) {
  const s = String((w && (w.id || w.shape)) || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function weaponRng(w) {
  let s = weaponHash(w) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// Лёгкий индивидуальный оттенок металла: одна и та же сталь у разных
// кузнецов выглядит по-своему.
function weaponMetalTone(base, w) {
  const rng = weaponRng(w);
  const k = rng();
  const target = k > 0.68 ? '#ffffff' : k > 0.34 ? '#1a1208' : '#ffd8a8';
  return mixColor(base, target, 0.05 + rng() * 0.07);
}

// ==================== ИНДИВИДУАЛЬНЫЙ ПОЧЕРК ====================
// Даже внутри одного типа (топоры, молоты, мечи) предметы не должны
// повторяться. Все параметры детерминированы от id: рисунок стабилен.
function weaponStyle(w) {
  const rng = weaponRng(w);
  const key = String((w && (w.shape || w.id)) || '');
  const tier = (w && w.tier) || 1;
  const r = () => rng();

  const s = {
    tier,
    key,
    // Лезвие топора
    spread: 0.85 + r() * 0.5,      // вынос лезвия вперёд
    topCut: 0.12 + r() * 0.34,     // срез сверху
    botCut: 0.30 + r() * 0.55,     // высота лезвия
    beard: 0,                       // «борода» вниз
    back: 'none',                   // обух: none | hammer | spike | double | beak
    crown: r() > 0.55,              // шип на верхушке древка
    holes: 0,                       // отверстия в лезвии
    edgeSerrated: false,
    // Молот
    headShape: 'block',             // block | octa | round | cylinder | twin
    poll: 'none',                   // none | beak | wedge | spike | flat
    band: r() > 0.45,
    rivets: 0,
    // Булава
    ballR: 13 + r() * 3,
    facets: 0,
    // Обмотка и металл
    wrap: ['#7a5636', '#5a3f22', '#8c4a2a', '#4a3320', '#6b4a2a'][Math.floor(r() * 5)],
    bandColor: null,
    accent: null,
    // Клинок
    width: 1,
    taper: 0.55,
    fuller: tier >= 2,
    wave: 0,
    serr: 0,
    glow: null,
    pommel: 'ball',                 // ball | disc | ring | none
    guardTilt: (r() - 0.5) * 0.12
  };

  // --- Явные «лица» по форме ---
  if (/hatchet|francisca/.test(key)) { s.spread = 0.78; s.topCut = 0.46; s.botCut = 0.42; }
  if (/handaxe|waraxe/.test(key)) { s.spread = 1.0; s.topCut = 0.22; s.botCut = 0.5; }
  if (/bearded|greatbeard/.test(key)) { s.beard = 1; s.botCut = 0.7; }
  if (/broadaxe|bardiche|titanaxe/.test(key)) { s.spread = 1.25; s.topCut = 0.1; s.botCut = 0.72; }
  if (/skullsplitter|execaxe|bloodmoon/.test(key)) { s.spread = 1.15; s.botCut = 0.78; s.holes = 1; }
  if (/labrys/.test(key)) { s.back = 'double'; }
  if (/daneaxe/.test(key)) { s.beard = 0.7; s.spread = 1.1; }
  if (/greatbeard|bardiche|daneaxe/.test(key)) { s.back = 'spike'; }
  if (/execaxe/.test(key)) { s.back = 'hammer'; }
  if (/titanaxe/.test(key)) { s.back = 'beak'; s.holes = 1; }

  if (/blacksmith/.test(key)) s.headShape = 'cylinder';
  else if (/sledge|earthbreaker/.test(key)) s.headShape = 'block';
  else if (/godhammer|doomhammer/.test(key)) s.headShape = 'octa';
  else if (/judge|thunder/.test(key)) s.headShape = 'twin';
  else if (/maul|greathammer|ram/.test(key)) s.headShape = 'block';
  else if (/warhammer/.test(key)) s.headShape = 'octa';
  else s.headShape = r() > 0.5 ? 'block' : 'octa';

  if (/warhammer|ram|maul|greathammer|judge|sledge|thunder|godhammer|doomhammer|earthbreaker/.test(key)) {
    s.poll = /judge/.test(key) ? 'wedge' : /thunder/.test(key) ? 'spike' : 'beak';
  }
  if (/blacksmith/.test(key)) s.poll = 'flat';

  s.rivets = 2 + Math.floor(r() * 3);

  // --- Клинки ---
  if (/flamberge/.test(key)) { s.wave = 1; s.width = 0.92; s.taper = 0.42; }
  else if (/kris/.test(key)) { s.wave = 0.75; s.width = 0.62; }
  else if (/estoc/.test(key)) { s.width = 0.42; s.taper = 0.3; s.fuller = false; }
  else if (/executioner/.test(key)) { s.width = 1.35; s.taper = 0.12; s.fuller = false; s.pommel = 'none'; }
  else if (/falcata|kopis/.test(key)) { s.width = 1.18; s.taper = 0.35; }
  else if (/sabre/.test(key)) { s.width = 0.9; s.taper = 0.45; }
  else if (/shiv/.test(key)) { s.width = 0.5; s.taper = 0.7; s.fuller = false; s.pommel = 'none'; }
  else if (/stiletto|pugio|dirk|sai/.test(key)) { s.width = 0.52; s.taper = 0.5; s.fuller = false; }
  else if (/katar/.test(key)) { s.width = 0.72; s.taper = 0.35; s.pommel = 'none'; }
  else if (/nodachi|claymore|greatsword|zweihander|bastard/.test(key)) { s.width = 1.12; s.taper = 0.4; }
  else if (/nightfang/.test(key)) { s.glow = 'rgba(120,150,220,0.75)'; s.width = 0.8; s.pommel = 'ring'; }
  else if (/serpent/.test(key)) { s.glow = 'rgba(120,230,170,0.55)'; s.serr = 1; }
  else if (/champion|aurelia|imperial/.test(key)) { s.glow = 'rgba(255,215,120,0.5)'; s.width = 1.05; }
  else if (/rusty/.test(key)) { s.width = 1.1; s.taper = 0.62; s.serr = 1; s.fuller = false; }
  else if (/serpent|champion|aurelia/.test(key)) s.pommel = 'disc';
  else s.pommel = r() > 0.6 ? 'ball' : r() > 0.3 ? 'disc' : 'ring';

  if (tier >= 5) s.bandColor = '#e0bd5f';
  else if (tier >= 4) s.bandColor = '#b9a06a';

  return s;
}

// Мелкие детали поверх готовой формы
function weaponDetails(ctx, v, w) {
  const head = v.head;
  const rng = weaponRng(w);
  const metal = v.metal || w.color || '#c8d2dc';
  const grip = v.grip || '#6b4a2a';
  const tier = w.tier || 1;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (head === 'blade') {
    // Обмотка рукояти
    const bands = 3 + ((rng() * 3) | 0);
    ctx.strokeStyle = shade(grip, -0.45);
    ctx.lineWidth = 1.7;
    for (let i = 0; i < bands; i++) {
      const y = 31.5 + i * 2.6;
      ctx.beginPath();
      ctx.moveTo(3.8, y + 1.1);
      ctx.lineTo(12.2, y - 1.1);
      ctx.stroke();
    }
    // Навершие с самоцветом у богатых клинков
    ctx.fillStyle = shade(metal, -0.05);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(9, 44, 4.2, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    if (tier >= 4) {
      ctx.fillStyle = tier >= 5 ? '#e8c65f' : '#c0392b';
      ctx.beginPath();
      ctx.arc(9, 44, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Кожаная петля на кисти у тяжёлых клинков
    if (tier >= 3 && rng() > 0.45) {
      ctx.strokeStyle = '#7a5636';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(11, 40);
      ctx.quadraticCurveTo(17, 42, 15, 47);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  const hafted = ['axe', 'mace', 'hammer', 'pick', 'spear', 'trident', 'halberd'].includes(head);

  if (hafted) {
    const bands = 3 + ((rng() * 3) | 0);
    // Обмотка у кисти
    ctx.strokeStyle = shade(grip, -0.45);
    ctx.lineWidth = 1.7;
    for (let i = 0; i < bands; i++) {
      const y = 23 + i * 2.9;
      ctx.beginPath();
      ctx.moveTo(4.6, y + 1.3);
      ctx.lineTo(15.4, y - 1.3);
      ctx.stroke();
    }
    // Пятка древка
    ctx.fillStyle = shade(metal, -0.12);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    roundRect(ctx, 6.4, 33.4, 7.6, 5.2, 2);
    ctx.fill(); ctx.stroke();

    // Обойма-кольцо у головки: видно, что насадка кованая
    const socketY = -v.len + (head === 'mace' ? 16 : head === 'hammer' ? 15 : head === 'pick' ? 17 : 9);
    ctx.fillStyle = shade(metal, 0.08);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    roundRect(ctx, 6.6, socketY, 11.6, 5.2, 2);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, socketY + 1.5);
    ctx.lineTo(16.8, socketY + 1.5);
    ctx.stroke();

    // Темляк на древковом оружии — с третьего тира
    if (tier >= 3 && (head === 'spear' || head === 'trident' || head === 'halberd')) {
      const tx = 16;
      const ty = socketY + 5;
      ctx.strokeStyle = '#6f2a24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + 5.5, ty + 7, tx + 3, ty + 15);
      ctx.stroke();
      ctx.fillStyle = '#a83b30';
      for (let i = 0; i < 4; i++) {
        const bx = tx + 2.6 + (i % 2 ? 1.4 : -0.4);
        ctx.beginPath();
        ctx.moveTo(bx, ty + 13 + i);
        ctx.lineTo(bx + 2.2, ty + 20 + i * 1.5);
        ctx.lineTo(bx - 1.2, ty + 18 + i);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Заклёпки на головке топора или молота
    if (head === 'axe' || head === 'hammer') {
      ctx.fillStyle = 'rgba(28,22,14,0.65)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(9 + i * 2.6, -v.len + 4 + i * 5, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Гравировка по древку у легендарных
    if (tier >= 5) {
      ctx.strokeStyle = 'rgba(240,214,120,0.55)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const y = -v.len + 22 + i * 16;
        ctx.beginPath();
        ctx.moveTo(11.4, y);
        ctx.lineTo(13.6, y + 6);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  if (head === 'bow') {
    const h = v.len * 0.62;
    const b = v.len * 0.22;
    // Пучки-глушители на тетиве
    if (rng() > 0.35) {
      ctx.fillStyle = '#d8c9a8';
      [-0.45, 0.45].forEach(k => {
        ctx.beginPath();
        ctx.ellipse(-b - 0.6, h * k, 2.2, 3.4, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    // Пропуск для стрелы: кожаная накладка чуть выше рукояти
    ctx.strokeStyle = 'rgba(90,62,36,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-b * 0.4, -6);
    ctx.lineTo(-b * 0.4 + 6, -3);
    ctx.stroke();
    // Темляк на нижнем плече у дорогих луков
    if (tier >= 4) {
      ctx.strokeStyle = '#7a2f28';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-b, h);
      ctx.quadraticCurveTo(-b - 6, h + 6, -b - 3, h + 13);
      ctx.stroke();
      ctx.fillStyle = '#a83b30';
      ctx.beginPath();
      ctx.moveTo(-b - 3, h + 12);
      ctx.lineTo(-b - 7, h + 19);
      ctx.lineTo(-b, h + 16);
      ctx.closePath();
      ctx.fill();
    }
    // Костяные вставки в рукояти у составных
    if (v.recurve) {
      ctx.fillStyle = 'rgba(236,226,198,0.85)';
      ctx.beginPath();
      ctx.ellipse(0.6, 0, 2.4, 4.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (head === 'xbow') {
    const L = v.len * 0.78;
    // Стремя у переднего конца
    ctx.strokeStyle = shade(metal, -0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(L + 4, 12, 7, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    // Мушка и целик
    ctx.fillStyle = '#c8d2dc';
    ctx.beginPath();
    ctx.moveTo(L - 6, -6);
    ctx.lineTo(L - 3.6, -12);
    ctx.lineTo(L - 1.2, -6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(30,24,16,0.8)';
    ctx.fillRect(-14, -8, 3, 4);
    // Кожаный ремень под ложем
    if (tier >= 3) {
      ctx.strokeStyle = '#6b4529';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-4, 10);
      ctx.quadraticCurveTo(6, 16, 16, 10);
      ctx.stroke();
    }
    // Заклёпки на ложе
    ctx.fillStyle = 'rgba(24,18,12,0.6)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(2 + i * 9, 2, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  ctx.restore();
}

function drawWeaponShape(ctx, v, w) {
  drawWeaponShapeBase(ctx, v, w);
  weaponDetails(ctx, v, w);
}

// Характер клинка: ширина, сужение, дол, зазубрины, волна, свечение.
// Форма берётся из vis и shape, поэтому даже два гладиуса разных тиров
// выглядят по-разному.
function bladeStyle(v, w) {
  const st = weaponStyle(w);
  const tier = st.tier;
  // Мелкая индивидуальность: у каждого клинка свой рисунок
  if (tier >= 3 && !st.serr && !st.wave) {
    const rng = weaponRng(w);
    if (rng() > 0.7) st.notch = 1;
  }
  st.tip = 1;
  return st;
}

// Дол (кровосток) и блик по лезвию
function bladeFuller(ctx, tipX, len, curve, style) {
  const midX = 8 + curve * len * 0.22;
  ctx.strokeStyle = 'rgba(20,16,12,0.32)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(midX - 1.4, 22);
  ctx.quadraticCurveTo(midX - 1.4 + curve * len * 0.16, 28 - len * 0.45, tipX - 2.5, 28 - len * 0.78);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(midX + 0.6, 22);
  ctx.quadraticCurveTo(midX + 0.6 + curve * len * 0.16, 28 - len * 0.45, tipX - 1.4, 28 - len * 0.78);
  ctx.stroke();
}

function drawWeaponShapeBase(ctx, v, w) {
  const metal = weaponMetalTone(v.metal || w.color || '#c8d2dc', w);
  const grip = v.grip || '#6b4a2a';
  const head = v.head;

  ctx.lineCap = 'round';

  if (head === 'blade') {
    const len = v.len;
    const curve = v.curve || 0;
    const st = bladeStyle(v, w);

    // Рукоять
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(7, 30); ctx.lineTo(9, 42); ctx.stroke();
    ctx.strokeStyle = grip;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(7, 30); ctx.lineTo(9, 42); ctx.stroke();

    // Клинок собираем по точкам: так можно и сужать его, и гнуть волной,
    // и делать зазубрины — одной формулой.
    const N = 16;
    const halfW = 5 * st.width;
    const tipX = 6 + curve * len * 0.55;
    const left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = 28 - len * t;
      const wob = st.wave ? Math.sin(t * Math.PI * 4.4) * st.wave * len * 0.030 : 0;
      const cx = 8 + curve * len * 0.5 * t * t + wob;
      // Ширина: сужение к острию, но у «плахи» острие расширяется
      const wf = (1 - st.taper * t) * (t > 0.9 ? st.tip : 1);
      let hw = halfW * Math.max(0.16, wf);
      // Зазубрины на правой кромке
      if (st.serr && i > 3 && i < N - 1 && i % 2 === 0) hw *= 1.32;
      left.push([cx - hw * 0.55, y]);
      right.push([cx + hw, y]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
    // Острие
    ctx.lineTo(tipX + 1, 28 - len - 9 * st.tip);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fillStyle = metal;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.4;
    ctx.stroke();

    // Свечение легендарной стали
    if (st.glow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      ctx.shadowColor = st.glow;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = st.glow;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(left[2][0] + 1, left[2][1]);
      for (let i = 3; i < left.length - 1; i++) ctx.lineTo(left[i][0] + 1, left[i][1]);
      ctx.stroke();
      ctx.restore();
    }

    // Блик по кромке
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(6, 22);
    ctx.quadraticCurveTo(6 + curve * len * 0.3, 28 - len * 0.5, tipX, 28 - len + 6);
    ctx.stroke();

    // Дол
    if (st.fuller) bladeFuller(ctx, tipX, len, curve, st);

    // Щербина у обуха — след боя
    if (st.notch) {
      ctx.fillStyle = 'rgba(30,24,16,0.5)';
      ctx.beginPath();
      ctx.moveTo(3.4, 28 - len * 0.62);
      ctx.lineTo(6.4, 28 - len * 0.60);
      ctx.lineTo(5.0, 28 - len * 0.54);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = st.bandColor || '#e0bd5f';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    if (v.guard === 'cross2') {
      roundRect(ctx, -10, 22, 38, 8, 3); ctx.fill(); ctx.stroke();
      // Концы крестовины чуть загнуты вниз
      [-10, 24].forEach(x => {
        ctx.beginPath();
        ctx.moveTo(x, 22); ctx.lineTo(x + 4, 30); ctx.lineTo(x + 4, 22);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      });
    } else if (v.guard === 'disc') {
      ctx.beginPath(); ctx.ellipse(8, 24, 11, 5, st.guardTilt, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(8, 24, 7, 3, st.guardTilt, 0, Math.PI * 2); ctx.stroke();
    } else if (v.guard === 'basket') {
      ctx.beginPath(); ctx.arc(8, 26, 11, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = shade(st.bandColor || '#e0bd5f', -0.15);
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(8, 26, 7, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(2, 26); ctx.lineTo(14, 26); ctx.stroke();
    } else if (v.guard === 'cross') {
      roundRect(ctx, -2, 22, 22, 7, 3); ctx.fill(); ctx.stroke();
    } else {
      // Без гарды — только кожаная втулка, как у фалькаты
      ctx.fillStyle = grip;
      roundRect(ctx, 3, 21, 10, 6, 2); ctx.fill(); ctx.stroke();
    }

    // Навершие: у каждого клинка своё
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    if (st.pommel === 'ball') {
      ctx.fillStyle = st.bandColor || shade('#e0bd5f', -0.15);
      ctx.beginPath(); ctx.arc(9, 44, 4.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (st.pommel === 'disc') {
      ctx.fillStyle = st.bandColor || '#e0bd5f';
      ctx.beginPath(); ctx.ellipse(9, 44, 5.6, 3.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (st.pommel === 'ring') {
      ctx.strokeStyle = st.bandColor || '#e0bd5f';
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(9, 45, 4.2, 0, Math.PI * 2); ctx.stroke();
    }
    return;
  }

  if (head === 'axe') {
    const len = v.len;
    const bl = v.bladeW || 1;
    const st = weaponStyle(w);
    const tier = st.tier;

    // Древко
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(9, 32); ctx.lineTo(13, -len); ctx.stroke();
    ctx.strokeStyle = grip;
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(9, 32); ctx.lineTo(13, -len); ctx.stroke();
    // Волокна дерева
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(11.4, 28); ctx.lineTo(14.4, -len + 8);
    ctx.stroke();

    const bladeTop = -len + 4;
    const topY = bladeTop + 22 * st.topCut;
    const botY = bladeTop + 20 + 24 * st.botCut;
    const outX = 12 + 28 * bl * st.spread;

    ctx.fillStyle = metal;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    // Обух снизу вверх
    ctx.moveTo(11, botY - 12);
    ctx.lineTo(11, topY);
    // Верхняя грань к носку: почти прямая, чуть выпуклая
    ctx.quadraticCurveTo(12 + 16 * bl * st.spread, topY - 3, outX, topY + 4 + 8 * st.topCut);
    // Кромка: слегка вогнутая вниз к пятке лезвия
    ctx.quadraticCurveTo(outX - 4, (topY + botY) / 2, outX - 2, botY - 2);
    if (st.beard) {
      // «Борода» — выступ вниз за пределы обуха
      ctx.quadraticCurveTo(outX - 8, botY + 8 + 8 * st.beard, 15 + 3 * bl, botY + 6 + 12 * st.beard);
      ctx.quadraticCurveTo(13, botY - 2, 11, botY - 12);
    } else {
      ctx.quadraticCurveTo(outX - 12, botY + 3, 11, botY - 12);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Кромка лезвия светлее — узкая полоса вдоль режущей части
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(outX - 3, topY + 9 + 6 * st.topCut);
    ctx.quadraticCurveTo(outX - 6, (topY + botY) / 2, outX - 4, botY - 6);
    ctx.stroke();

    // Отверстия в лезвии — тяжёлые секиры
    if (st.holes) {
      ctx.fillStyle = 'rgba(22,17,12,0.62)';
      ctx.beginPath();
      ctx.arc(outX - 11, topY + 12, 2.4, 0, Math.PI * 2);
      ctx.fill();
      if (bl > 1.2) {
        ctx.beginPath();
        ctx.arc(outX - 10, topY + 20, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Зазубрины по кромке
    if (st.edgeSerrated || /skullsplitter|bloodmoon/.test(st.key)) {
      ctx.fillStyle = 'rgba(22,17,12,0.55)';
      ctx.beginPath();
      ctx.moveTo(outX - 4, topY + 14);
      ctx.lineTo(outX + 1, topY + 17);
      ctx.lineTo(outX - 4, topY + 20);
      ctx.closePath();
      ctx.fill();
    }

    // Обух с обратной стороны
    if (st.back !== 'none') {
      ctx.fillStyle = shade(metal, st.back === 'double' ? -0.08 : -0.16);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      if (st.back === 'double') {
        // Вторая лопасть — лабрис
        ctx.beginPath();
        ctx.moveTo(11, topY + 2);
        ctx.quadraticCurveTo(-22 * bl, bladeTop + 6, -16 * bl, botY - 2);
        ctx.quadraticCurveTo(-4, botY - 10, 11, botY - 12);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.32)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-3, topY + 5);
        ctx.quadraticCurveTo(-13 * bl, bladeTop + 12, -11 * bl, botY - 6);
        ctx.stroke();
      } else if (st.back === 'hammer') {
        roundRect(ctx, -8, topY + 2, 20, 18, 4);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        roundRect(ctx, -5, topY + 5, 5, 12, 2);
        ctx.fill();
      } else if (st.back === 'beak') {
        ctx.beginPath();
        ctx.moveTo(11, topY + 2);
        ctx.quadraticCurveTo(-14, bladeTop, -18, topY + 10);
        ctx.quadraticCurveTo(-8, topY + 8, 11, topY + 12);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        // Короткий шип-крюк
        ctx.beginPath();
        ctx.moveTo(11, topY + 3);
        ctx.quadraticCurveTo(-6, bladeTop + 2, -9, topY + 12);
        ctx.quadraticCurveTo(-2, topY + 7, 11, topY + 9);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
    }

    // Шип на верхушке древка
    if (st.crown) {
      ctx.fillStyle = shade(metal, -0.05);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(9, bladeTop + 6);
      ctx.lineTo(13, -len - 12);
      ctx.lineTo(17, bladeTop + 6);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    // Латунная обойма на древке — по тиру
    if (st.bandColor) {
      ctx.fillStyle = st.bandColor;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      roundRect(ctx, 6.6, -len + 34, 12.8, 5, 2);
      ctx.fill(); ctx.stroke();
    }
    return;
  }

  if (head === 'mace') {
    const len = v.len;
    const st = weaponStyle(w);
    const wooden = /club|spikedclub/.test(st.key);
    const tier = st.tier;
    const r = st.ballR;

    // Древко: у дубины — сучковатое дерево, у булавы — окованная рукоять
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(9, 32); ctx.lineTo(12, -len); ctx.stroke();
    ctx.strokeStyle = grip;
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(9, 32); ctx.lineTo(12, -len); ctx.stroke();
    if (wooden) {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(9.6, 24 - i * 8);
        ctx.lineTo(11.4, 20 - i * 8);
        ctx.stroke();
      }
    } else {
      // Кольца обоймы на рукояти
      ctx.fillStyle = shade(metal, -0.15);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      [10, 18].forEach(y => {
        roundRect(ctx, 5.4, y, 11, 4, 2);
        ctx.fill(); ctx.stroke();
      });
    }

    if (v.chain) {
      const spikeBall = /morningstar/.test(st.key);
      ctx.strokeStyle = '#8a8f94';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(12 + (i % 2 ? 4 : -4), -len - 4 - i * 8, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      const cy = -len - 42;
      ctx.fillStyle = metal;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.arc(12, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Фасетки шара
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(12, cy, r * 0.58, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e8eef4';
      const n = spikeBall ? 8 : 6;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const long = spikeBall ? 1 : 0.62;
        ctx.beginPath();
        ctx.moveTo(12 + Math.cos(ang) * (r - 2), cy + Math.sin(ang) * (r - 2));
        ctx.lineTo(12 + Math.cos(ang) * (r - 2 + 8 * long), cy + Math.sin(ang) * (r - 2 + 8 * long));
        ctx.lineTo(12 + Math.cos(ang + 0.24) * (r - 2), cy + Math.sin(ang + 0.24) * (r - 2));
        ctx.closePath(); ctx.fill();
      }
      return;
    }

    ctx.fillStyle = metal;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.4;
    if (v.rays) {
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(12 + Math.cos(ang) * (r - 4), -len + Math.sin(ang) * (r - 4));
        ctx.lineTo(12 + Math.cos(ang) * (r + 8), -len + Math.sin(ang) * (r + 8));
        ctx.lineTo(12 + Math.cos(ang + 0.34) * (r - 4), -len + Math.sin(ang + 0.34) * (r - 4));
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    if (v.flanges) {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(12 + Math.cos(ang) * (r - 5), -len + Math.sin(ang) * (r - 5));
        ctx.lineTo(12 + Math.cos(ang) * (r + 5), -len + Math.sin(ang) * (r + 5));
        ctx.lineTo(12 + Math.cos(ang + 0.5) * (r - 5), -len + Math.sin(ang + 0.5) * (r - 5));
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    // Головка: у дубины — бочонок, у булавы — шар, у гранёной — многогранник
    if (wooden) {
      ctx.beginPath();
      ctx.ellipse(12, -len, r * 0.9, r * 1.15, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1.4;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.ellipse(12, -len + i * 7, r * 0.82, 2.4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.beginPath(); ctx.arc(12, -len, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Фасетки
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(12, -len, r * 0.55, r, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(12, -len, r, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    }

    if (v.skull) {
      ctx.fillStyle = '#e8eef4';
      ctx.beginPath(); ctx.arc(12, -len - 2, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#241c15';
      ctx.beginPath(); ctx.arc(9, -len - 4, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(15, -len - 4, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(12, -len + 3, 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(10, -len + 6); ctx.lineTo(11, -len + 9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(14, -len + 6); ctx.lineTo(13, -len + 9); ctx.stroke();
    }

    if (v.studs) {
      ctx.fillStyle = '#d0d8e0';
      const n = wooden ? 8 : 6;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const rr = wooden ? r * 0.95 : r * 0.85;
        ctx.beginPath();
        ctx.arc(12 + Math.cos(ang) * rr, -len + Math.sin(ang) * rr, wooden ? 1.9 : 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (tier >= 5) {
      ctx.strokeStyle = 'rgba(240,214,120,0.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(12, -len, r + 2.4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(8, -len - 5, 4, 0, Math.PI * 2); ctx.fill();
    return;
  }

  if (head === 'hammer') {
    const len = v.len;
    const st = weaponStyle(w);
    const hw = v.huge ? 30 : v.big ? 24 : 20;
    const gold = st.tier >= 5;
    const hy = -len - 2;

    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(9, 32); ctx.lineTo(13, -len); ctx.stroke();
    ctx.strokeStyle = grip;
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(9, 32); ctx.lineTo(13, -len); ctx.stroke();
    // Обмотка рукояти
    ctx.strokeStyle = st.wrap;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(8.4, 24 + i * 3.4);
      ctx.lineTo(15.2, 22.6 + i * 3.4);
      ctx.stroke();
    }

    // Клинья в проушине
    ctx.fillStyle = shade(grip, -0.3);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    roundRect(ctx, 10.4, hy + 11, 5, 4, 1.4);
    ctx.fill(); ctx.stroke();

    const grad = ctx.createLinearGradient(13 - hw, hy - 15, 13 + hw, hy + 15);
    grad.addColorStop(0, shade(metal, 0.28));
    grad.addColorStop(0.5, metal);
    grad.addColorStop(1, shade(metal, -0.35));
    ctx.fillStyle = grad;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.4;

    if (st.headShape === 'cylinder') {
      // Кузнечный молот: круглый боёк с торцом
      ctx.beginPath();
      ctx.ellipse(13, hy, hw * 0.72, 12, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(13, hy, hw * 0.36, 12, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.ellipse(9, hy - 4, hw * 0.2, 4, -0.4, 0, Math.PI * 2); ctx.fill();
    } else if (st.headShape === 'octa') {
      // Восьмигранная головка: видно фаски
      ctx.beginPath();
      ctx.moveTo(13 - hw, hy - 8);
      ctx.lineTo(13 - hw * 0.55, hy - 14);
      ctx.lineTo(13 + hw * 0.55, hy - 14);
      ctx.lineTo(13 + hw, hy - 8);
      ctx.lineTo(13 + hw, hy + 8);
      ctx.lineTo(13 + hw * 0.55, hy + 14);
      ctx.lineTo(13 - hw * 0.55, hy + 14);
      ctx.lineTo(13 - hw, hy + 8);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(13 - hw * 0.55, hy - 14); ctx.lineTo(13 - hw * 0.55, hy + 14);
      ctx.moveTo(13 + hw * 0.55, hy - 14); ctx.lineTo(13 + hw * 0.55, hy + 14);
      ctx.stroke();
    } else if (st.headShape === 'twin') {
      // Двойная головка: два бойка с перемычкой
      roundRect(ctx, 13 - hw, hy - 12, hw * 2, 24, 4);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(metal, -0.3);
      roundRect(ctx, 13 - hw - 5, hy - 8, 7, 16, 3);
      ctx.fill(); ctx.stroke();
      roundRect(ctx, 13 + hw - 2, hy - 8, 7, 16, 3);
      ctx.fill(); ctx.stroke();
    } else {
      // Классический прямоугольный боёк
      roundRect(ctx, 13 - hw, hy - 14, hw * 2, 28, 5);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      roundRect(ctx, 13 - hw + 3, hy - 12, hw * 2 - 6, 4, 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      roundRect(ctx, 13 - hw + 3, hy + 8, hw * 2 - 6, 5, 2);
      ctx.fill();
    }

    // Противовес с обратной стороны
    if (st.poll !== 'none') {
      ctx.fillStyle = shade(metal, -0.06);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      if (st.poll === 'beak') {
        ctx.beginPath();
        ctx.moveTo(13 - hw + 2, hy - 11);
        ctx.quadraticCurveTo(13 - hw - 13, hy - 8, 13 - hw - 16, hy + 1);
        ctx.quadraticCurveTo(13 - hw - 9, hy + 5, 13 - hw + 2, hy + 10);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else if (st.poll === 'wedge') {
        ctx.beginPath();
        ctx.moveTo(13 - hw + 2, hy - 10);
        ctx.lineTo(13 - hw - 14, hy - 4);
        ctx.lineTo(13 - hw - 14, hy + 6);
        ctx.lineTo(13 - hw + 2, hy + 10);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else if (st.poll === 'spike') {
        ctx.beginPath();
        ctx.moveTo(13 - hw + 2, hy - 7);
        ctx.lineTo(13 - hw - 16, hy);
        ctx.lineTo(13 - hw + 2, hy + 7);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        roundRect(ctx, 13 - hw - 8, hy - 9, 10, 18, 3);
        ctx.fill(); ctx.stroke();
      }
    }

    // Заклёпки на головке
    if (st.headShape !== 'twin' && st.headShape !== 'cylinder') {
      ctx.fillStyle = 'rgba(24,18,12,0.5)';
      for (let i = 0; i < st.rivets; i++) {
        const t = st.rivets === 1 ? 0.5 : i / (st.rivets - 1);
        ctx.beginPath();
        ctx.arc(13 - hw * 0.55 + t * hw * 1.1, hy + 2, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Латунная обойма под головкой
    if (st.bandColor) {
      ctx.fillStyle = st.bandColor;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      roundRect(ctx, 8, hy + 15, 10, 5, 2);
      ctx.fill(); ctx.stroke();
    }
    if (gold) {
      ctx.strokeStyle = 'rgba(240,214,120,0.85)';
      ctx.lineWidth = 1.6;
      roundRect(ctx, 13 - hw + 1.5, hy - 12.5, hw * 2 - 3, 25, 5);
      ctx.stroke();
    }
    return;
  }

  if (head === 'pick') {
    const len = v.len;
    const key = String((w && (w.shape || w.id)) || '');
    const withHammer = /horsemanpick/.test(key);
    const narrow = /warpick/.test(key);

    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(9, 32); ctx.lineTo(12, -len); ctx.stroke();
    ctx.strokeStyle = grip;
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(9, 32); ctx.lineTo(12, -len); ctx.stroke();

    ctx.fillStyle = metal;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.4;
    // Клюв: узкий и длинный, у конного — короче и толще
    const beakLen = narrow ? 30 : withHammer ? 26 : 28;
    ctx.beginPath();
    ctx.moveTo(12, -len - 4);
    ctx.quadraticCurveTo(12 + beakLen, -len + 2, 12 + beakLen * 0.85, -len + 20);
    ctx.quadraticCurveTo(12 + beakLen * 0.5, -len + 8, 12, -len + 12);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Блик по клюву
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(14, -len - 1);
    ctx.quadraticCurveTo(12 + beakLen * 0.8, -len + 4, 12 + beakLen * 0.7, -len + 16);
    ctx.stroke();

    // Обушок: у конного клевца — молоток, у остальных — короткий шип
    ctx.fillStyle = shade(metal, withHammer ? -0.12 : -0.25);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    if (withHammer) {
      roundRect(ctx, -10, -len - 10, 22, 20, 4);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      roundRect(ctx, -7, -len - 7, 5, 14, 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(12, -len - 2);
      ctx.quadraticCurveTo(-10, -len + 2, -8, -len + 14);
      ctx.quadraticCurveTo(0, -len + 8, 12, -len + 10);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    return;
  }

  if (head === 'spear' || head === 'trident' || head === 'halberd') {
    const len = v.len;
    const key = String((w && (w.shape || w.id)) || '');
    const tier = (w && w.tier) || 1;

    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(9, 34); ctx.lineTo(14, -len); ctx.stroke();
    ctx.strokeStyle = grip;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(9, 34); ctx.lineTo(14, -len); ctx.stroke();
    // Обмотка древка у кисти — видно, где держать
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(8.2, 26 - i * 3.4);
      ctx.lineTo(13.4, 24.4 - i * 3.4);
      ctx.stroke();
    }

    if (v.vamplate) {
      ctx.fillStyle = shade(grip, 0.25);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(2, 4); ctx.quadraticCurveTo(14, -6, 26, 4);
      ctx.lineTo(20, 20); ctx.lineTo(8, 20);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(6, 10); ctx.quadraticCurveTo(14, 3, 22, 10);
      ctx.stroke();
    }

    ctx.fillStyle = v.tip || '#d6e0ea';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;

    if (head === 'trident') {
      const champ = /champion|champ/.test(key);
      const spread = champ ? 13 : 11;
      const tines = champ ? 26 : 24;
      [-spread, 0, spread].forEach((off, idx) => {
        // Средний зубец длиннее боковых
        const extra = idx === 1 ? 6 : 0;
        ctx.beginPath();
        ctx.moveTo(14 + off - 3, -len + 4);
        ctx.lineTo(14 + off, -len - tines - extra);
        ctx.lineTo(14 + off + 3, -len + 4);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Зазубрина на внутренней стороне боковых зубцов
        if (idx !== 1) {
          const s = idx === 0 ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(14 + off + s * 2.4, -len - tines * 0.45);
          ctx.lineTo(14 + off + s * 6, -len - tines * 0.35);
          ctx.lineTo(14 + off + s * 2.4, -len - tines * 0.25);
          ctx.closePath();
          ctx.fill();
        }
      });
      // Перекладина с шишечкой
      ctx.beginPath(); ctx.moveTo(3, -len + 2); ctx.lineTo(25, -len + 2); ctx.stroke();
      ctx.fillStyle = shade(v.tip || '#d6e0ea', -0.2);
      ctx.beginPath(); ctx.arc(14, -len + 2, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (head === 'halberd') {
      // Топор-лезвие сбоку
      ctx.beginPath();
      ctx.moveTo(14, -len + 6);
      ctx.quadraticCurveTo(42, -len + 10, 38, -len + 32);
      ctx.quadraticCurveTo(24, -len + 22, 14, -len + 24);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Кромка топора
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(22, -len + 9);
      ctx.quadraticCurveTo(38, -len + 13, 35, -len + 29);
      ctx.stroke();
      // Наконечник
      ctx.fillStyle = v.tip || '#d6e0ea';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(10, -len + 4);
      ctx.lineTo(14, -len - 26);
      ctx.lineTo(18, -len + 4);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Крюк с обратной стороны
      if (/halberd/.test(key)) {
        ctx.fillStyle = shade(v.tip || '#d6e0ea', -0.18);
        ctx.beginPath();
        ctx.moveTo(11, -len + 8);
        ctx.quadraticCurveTo(-2, -len + 12, 0, -len + 24);
        ctx.quadraticCurveTo(4, -len + 16, 11, -len + 18);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
    } else {
      const wide = v.wide ? 8 : 5;
      const longTip = /implance|lance/.test(key) ? 34 : 28;
      ctx.beginPath();
      ctx.moveTo(14 - wide, -len + 6);
      ctx.lineTo(14, -len - longTip);
      ctx.lineTo(14 + wide, -len + 6);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Грань по центру пера
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(14, -len - longTip + 4);
      ctx.lineTo(14, -len + 4);
      ctx.stroke();
      if (v.barb) {
        // Зазубрины гарпуна — по обе стороны
        ctx.fillStyle = v.tip || '#d6e0ea';
        [-1, 1].forEach(s => {
          ctx.beginPath();
          ctx.moveTo(14 + s * wide, -len + 14);
          ctx.lineTo(14 + s * (wide + 8), -len + 20);
          ctx.lineTo(14 + s * (wide - 1), -len + 18);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        });
      }
      if (v.wide) {
        // «Ушки» партизана
        [-1, 1].forEach(s => {
          ctx.beginPath();
          ctx.moveTo(14 + s * wide, -len + 8);
          ctx.quadraticCurveTo(14 + s * (wide + 7), -len + 10, 14 + s * wide, -len + 18);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        });
        ctx.beginPath();
        ctx.arc(14, -len + 12, 4.4, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      if (tier >= 4) {
        // Золотая втулка под пером
        ctx.fillStyle = '#e0bd5f';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        roundRect(ctx, 9, -len + 4, 11, 6, 2);
        ctx.fill(); ctx.stroke();
      }
    }
    return;
  }

  if (head === 'bow') {
    // Лук рисуется в системе «вперёд = +X», кисть — в рукояти (0,0).
    // Плечи уходят вверх и вниз, дуга выгнута вперёд, тетива натянута назад.
    const h = v.len * 0.62;          // полухорда (высота плеча)
    const b = v.len * 0.22;          // глубина изгиба
    const wood = metal;

    // Тень-контур плеч
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-b, -h);
    ctx.quadraticCurveTo(b, 0, -b, h);
    ctx.stroke();

    // Само дерево плеч: тёплый градиент от рукояти к концам
    const bg = ctx.createLinearGradient(-b, 0, b * 1.1, 0);
    bg.addColorStop(0, shade(wood, -0.28));
    bg.addColorStop(0.55, wood);
    bg.addColorStop(1, shade(wood, 0.18));
    ctx.strokeStyle = bg;
    ctx.lineWidth = 6.4;
    ctx.beginPath();
    ctx.moveTo(-b, -h);
    ctx.quadraticCurveTo(b, 0, -b, h);
    ctx.stroke();

    // Роговые наконечники плеч
    ctx.fillStyle = shade(wood, -0.45);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    [-1, 1].forEach(sd => {
      ctx.save();
      ctx.translate(-b, sd * h);
      ctx.rotate(sd * -0.5);
      roundRect(ctx, -4, -5, 9, 11, 3);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    });

    // Тетива: в руке лук не натянут, поэтому она идёт прямой линией
    // между концами плеч и лишь слегка провисает к рукояти.
    ctx.strokeStyle = 'rgba(244,238,222,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-b, -h);
    ctx.quadraticCurveTo(-b - v.len * 0.035, 0, -b, h);
    ctx.stroke();

    // Обмотка рукояти
    ctx.strokeStyle = grip;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-1.5, -8);
    ctx.quadraticCurveTo(3, 0, -1.5, 8);
    ctx.stroke();
    ctx.strokeStyle = shade(grip, 0.3);
    ctx.lineWidth = 1.4;
    for (let i = -6; i <= 6; i += 4) {
      ctx.beginPath();
      ctx.moveTo(-2, i);
      ctx.lineTo(2, i + 2.4);
      ctx.stroke();
    }

    // Загнутые вперёд кончики у составного лука
    if (v.recurve) {
      ctx.strokeStyle = wood;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-b, -h);
      ctx.quadraticCurveTo(-b + 7, -h - 8, -b + 17, -h - 5);
      ctx.moveTo(-b, h);
      ctx.quadraticCurveTo(-b + 7, h + 8, -b + 17, h + 5);
      ctx.stroke();
    }
    return;
  }

  if (head === 'xbow') {
    // Арбалет: ложе вперёд по +X, дуга у переднего конца, тетива к ореху.
    const L = v.len * 0.78;
    const t = v.heavy ? 12 : 9;          // толщина ложа
    const w = v.len * 0.30;              // полуразмах дуги
    const wood = grip;

    // Приклад: уходит назад и вниз от заднего среза ложа
    ctx.fillStyle = shade(wood, -0.12);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-18, -t / 2);
    ctx.lineTo(-40, -t / 2 - 2);
    ctx.quadraticCurveTo(-46, 2, -40, 12);
    ctx.lineTo(-18, t / 2 + 4);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Ложе
    const lg = ctx.createLinearGradient(0, -t / 2, 0, t / 2);
    lg.addColorStop(0, shade(wood, 0.22));
    lg.addColorStop(1, shade(wood, -0.3));
    ctx.fillStyle = lg;
    roundRect(ctx, -20, -t / 2, L + 20, t, 4);
    ctx.fill(); ctx.stroke();

    // Пистолетная рукоять вниз
    ctx.fillStyle = shade(wood, -0.2);
    ctx.beginPath();
    ctx.moveTo(-10, t / 2 - 1);
    ctx.lineTo(-2, t / 2 - 1);
    ctx.lineTo(-5, t / 2 + 20);
    ctx.lineTo(-14, t / 2 + 18);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Дуга: вертикальная, выпуклая вперёд
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = v.heavy ? 11 : 9;
    ctx.beginPath();
    ctx.moveTo(L, -w);
    ctx.quadraticCurveTo(L + 20, 0, L, w);
    ctx.stroke();
    const dg = ctx.createLinearGradient(L, -w, L + 18, w);
    dg.addColorStop(0, shade(metal, 0.25));
    dg.addColorStop(0.5, metal);
    dg.addColorStop(1, shade(metal, -0.3));
    ctx.strokeStyle = dg;
    ctx.lineWidth = v.heavy ? 6.5 : 5;
    ctx.beginPath();
    ctx.moveTo(L, -w);
    ctx.quadraticCurveTo(L + 20, 0, L, w);
    ctx.stroke();

    // Тетива: от концов дуги к ореху (натянута)
    ctx.strokeStyle = 'rgba(240,234,216,0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(L, -w);
    ctx.lineTo(L - 26, 0);
    ctx.lineTo(L, w);
    ctx.stroke();

    // Болт в жёлобе: древко и гранёный наконечник
    ctx.strokeStyle = '#d9cdb2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(L - 28, -2);
    ctx.lineTo(L + 14, -2);
    ctx.stroke();
    ctx.fillStyle = '#cfd8e0';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(L + 14, -6);
    ctx.lineTo(L + 26, -2);
    ctx.lineTo(L + 14, 2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Оперение
    ctx.fillStyle = '#b8a98c';
    ctx.beginPath();
    ctx.moveTo(L - 28, -2);
    ctx.lineTo(L - 34, -7);
    ctx.lineTo(L - 30, -2);
    ctx.lineTo(L - 34, 3);
    ctx.closePath();
    ctx.fill();

    // Спусковой крючок и скоба
    ctx.strokeStyle = '#8a8377';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(-4, t / 2 + 8, 7, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, t / 2 + 2);
    ctx.lineTo(-6, t / 2 + 8);
    ctx.stroke();

    // Магазин повторного арбалета
    if (v.magazine) {
      ctx.fillStyle = shade(metal, -0.15);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.6;
      roundRect(ctx, L * 0.35, -t / 2 - 13, 22, 11, 3);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(L * 0.35 + 5 + i * 6, -t / 2 - 11);
        ctx.lineTo(L * 0.35 + 5 + i * 6, -t / 2 - 4);
        ctx.stroke();
      }
    }
    return;
  }

  ctx.fillStyle = '#f0b183';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.arc(9, 30, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

// ==================== БОЕВЫЕ ПСЫ ====================
// Четвероногая анатомия: корпус, четыре лапы с суставами, хвост, голова
// с пастью. Ходьба — диагональные пары лап, как у настоящей собаки.
function drawBattleDog(ctx, dog, x, y, scale = 1, facing = 1, a = {}) {
  const now = performance.now() / 1000;
  const seed = (dog.id || 'dog').length * 0.61;
  const alive = 1 - (a.dead || 0);
  const colors = dog.colors || { body: '#6b4a2e', belly: '#a98a63', snout: '#4a3320' };
  const buildW = dog.build === 'heavy' ? 1.18 : dog.build === 'slim' ? 0.86 : 1;

  const breath = (a.breath == null ? 1 : a.breath) * alive;
  const breathY = Math.sin(now * 2.3 + seed) * 1.2 * breath;
  const walkPhase = a.walkPhase || 0;
  const walk = a.walk || 0;
  const bob = -Math.abs(Math.sin(walkPhase * 2)) * 1.8 * walk * alive;

  ctx.save();
  ctx.globalAlpha = a.alpha == null ? 1 : a.alpha;

  // Тень
  ctx.save();
  ctx.globalAlpha = 0.3 * (a.alpha == null ? 1 : a.alpha);
  ctx.fillStyle = '#0a0705';
  ctx.beginPath();
  ctx.ellipse(x, y + 3 * scale, 46 * scale, 11 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Аура (босс-пёс не бывает, но подсветка активного — да)
  if (a.glow > 0.01) {
    const g = ctx.createRadialGradient(x, y - 40 * scale, 4, x, y - 40 * scale, 78 * scale);
    g.addColorStop(0, `rgba(255,214,110,${0.26 * a.glow})`);
    g.addColorStop(1, 'rgba(255,214,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y - 36 * scale, 76 * scale, 70 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(x, y + (breathY + bob) * scale);
  if ((a.dead || 0) > 0) {
    ctx.rotate((a.dead || 0) * 1.4 * facing);
    ctx.translate(0, (a.dead || 0) * 8);
  }
  ctx.rotate((a.dodge || 0) * 0.12 * facing);
  ctx.scale(scale * facing, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const bodyY = -40;
  const bodyLen = 62 * buildW;
  const bodyH = 26 * buildW;

  // ---------- Лапы (диагональные пары) ----------
  const legs = [
    { x: -bodyLen * 0.34, phase: 0, front: false },
    { x: -bodyLen * 0.16, phase: Math.PI, front: false },
    { x: bodyLen * 0.26, phase: Math.PI, front: true },
    { x: bodyLen * 0.42, phase: 0, front: true }
  ];

  legs.forEach((L, i) => {
    const swing = Math.sin(walkPhase + L.phase) * 7 * walk;
    const lift = Math.max(0, Math.cos(walkPhase + L.phase)) * 6 * walk;
    const topX = L.x;
    const topY = bodyY + 6;
    const footX = topX + swing;
    const footY = -3 - lift;
    const kneeX = (topX + footX) / 2 + (L.front ? -2.5 : 2.5) - lift * 0.4;
    const kneeY = (topY + footY) / 2;

    // Задняя пара темнее — глубина
    const legColor = i < 2 ? shade(colors.body, -0.18) : colors.body;
    limb(ctx, topX, topY, kneeX, kneeY, 8 * buildW, legColor);
    limb(ctx, kneeX, kneeY, footX, footY, 7 * buildW, legColor);

    // Лапа
    ctx.fillStyle = shade(colors.snout, 0.05);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    roundRect(ctx, footX - 4, footY - 2, 11, 5.5, 2.5);
    ctx.fill(); ctx.stroke();
  });

  // ---------- Хвост ----------
  const wag = Math.sin(now * (3 + (a.victory || 0) * 9) + seed) * (6 + (a.victory || 0) * 8);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 10 * buildW;
  ctx.beginPath();
  ctx.moveTo(-bodyLen * 0.5, bodyY + 2);
  ctx.quadraticCurveTo(-bodyLen * 0.72, bodyY - 6 + wag * 0.4, -bodyLen * 0.66, bodyY - 20 + wag);
  ctx.stroke();
  ctx.strokeStyle = colors.body;
  ctx.lineWidth = 7 * buildW;
  ctx.beginPath();
  ctx.moveTo(-bodyLen * 0.5, bodyY + 2);
  ctx.quadraticCurveTo(-bodyLen * 0.72, bodyY - 6 + wag * 0.4, -bodyLen * 0.66, bodyY - 20 + wag);
  ctx.stroke();


// ---------- Корпус ----------
  ctx.beginPath();
  ctx.ellipse(-bodyLen * 0.04, bodyY, bodyLen * 0.46, bodyH * 0.62, -0.04, 0, Math.PI * 2);
  ctx.fillStyle = colors.body;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3.6;
  ctx.stroke();

  // Живот и грудь светлее
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(-bodyLen * 0.04, bodyY, bodyLen * 0.46, bodyH * 0.62, -0.04, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = colors.belly;
  ctx.beginPath();
  ctx.ellipse(0, bodyY + bodyH * 0.42, bodyLen * 0.42, bodyH * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.ellipse(-bodyLen * 0.1, bodyY - bodyH * 0.34, bodyLen * 0.3, bodyH * 0.16, -0.1, 0, Math.PI * 2);
  ctx.fill();
  // Шрамы от ран
  const hpR = dog.hp / Math.max(1, dog.maxHp);
  if (hpR < 0.7) {
    ctx.strokeStyle = BLOOD;
    ctx.lineWidth = 2.2;
    ctx.globalAlpha = (1 - hpR) * 0.9;
    for (let i = 0; i < 3; i++) {
      const sx = -bodyLen * 0.2 + i * 12;
      ctx.beginPath();
      ctx.moveTo(sx, bodyY - 8);
      ctx.lineTo(sx + 6, bodyY + 6);
      ctx.stroke();
    }
    ctx.globalAlpha = a.alpha == null ? 1 : a.alpha;
  }
  ctx.restore();

  // ---------- Голова ----------
  const headX = bodyLen * 0.46;
  const headY = bodyY - bodyH * 0.5;
  const lunge = (a.swing || 0) * 4;

  ctx.save();
  ctx.translate(headX + lunge, headY + Math.sin(now * 2.3 + seed + 1) * 0.8 * breath);

  // Уши — торчком или висячие
  const earUp = dog.breedId !== 'molossian' && dog.breedId !== 'molossian2';
  ctx.fillStyle = shade(colors.body, -0.12);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.6;
  [-1, 1].forEach(sd => {
    ctx.beginPath();
    if (earUp) {
      ctx.moveTo(sd * 4, -12);
      ctx.lineTo(sd * 11, -26);
      ctx.lineTo(sd * 14, -10);
    } else {
      ctx.moveTo(sd * 3, -11);
      ctx.quadraticCurveTo(sd * 14, -12, sd * 13, 2);
      ctx.quadraticCurveTo(sd * 8, -2, sd * 4, -8);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  });

  // Череп
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = colors.body;
  ctx.fill(); ctx.stroke();

  // Морда
  ctx.beginPath();
  ctx.moveTo(6, -6);
  ctx.quadraticCurveTo(26, -6, 28, 2);
  ctx.quadraticCurveTo(26, 10, 6, 8);
  ctx.closePath();
  ctx.fillStyle = colors.snout;
  ctx.fill(); ctx.stroke();

  // Нос
  ctx.fillStyle = '#16110d';
  ctx.beginPath();
  ctx.ellipse(26, 1, 4.2, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Пасть: открывается при укусе
  const bite = Math.max(a.swing || 0, (a.hurt || 0) * 0.5);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(9, 6);
  ctx.quadraticCurveTo(18, 8 + bite * 8, 26, 5);
  ctx.stroke();
  if (bite > 0.15) {
    ctx.fillStyle = '#5a1a14';
    ctx.beginPath();
    ctx.ellipse(18, 7 + bite * 3, 8, 2 + bite * 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4efe2';
    ctx.beginPath();
    ctx.moveTo(12, 6); ctx.lineTo(14, 10); ctx.lineTo(16, 6);
    ctx.moveTo(20, 6); ctx.lineTo(22, 10); ctx.lineTo(24, 6);
    ctx.fill();
  }

  // Глаз
  const emo = a.emotion || 'idle';
  ctx.fillStyle = '#fffdf6';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(7, -4, 4.4, emo === 'angry' ? 3.2 : 4, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#20180f';
  ctx.beginPath();
  ctx.arc(8.4, -4, 2.1, 0, Math.PI * 2);
  ctx.fill();

  // Бровь-рык
  if (emo === 'angry' || (a.swing || 0) > 0.3) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(2, -10);
    ctx.lineTo(12, -7);
    ctx.stroke();
  }

  // Ошейник
  ctx.fillStyle = '#7a2f28';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.2;
  roundRect(ctx, -16, 6, 8, 14, 3);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c9a45c';
  ctx.beginPath();
  ctx.arc(-12, 21, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Вспышка урона
  if ((a.hurt || 0) > 0.01) {
    ctx.globalAlpha = (a.hurt || 0) * 0.4;
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.ellipse(0, bodyY, bodyLen * 0.6, bodyH * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ==================== ИКОНКИ ПРЕДМЕТОВ ====================
// Габариты модели оружия в её собственной системе координат.
// Нужны, чтобы иконка в кузнице стояла ровно по центру ячейки.
function weaponIconBounds(v) {
  const head = v.head;
  const len = v.len || 48;
  const pad = 6;
  let x0, x1, y0, y1;

  if (head === 'blade') {
    const curve = v.curve || 0;
    const tipX = 6 + curve * len * 0.55;
    x0 = Math.min(3, tipX - 2, -10);
    x1 = Math.max(13, tipX + 3, 28);
    y0 = 28 - len - 9;
    y1 = 49;
  } else if (head === 'axe') {
    const bl = v.bladeW || 1;
    x0 = Math.min(11, -24 * bl);
    x1 = Math.max(12 + 34 * bl, 12);
    y0 = -len;
    y1 = 34;
  } else if (head === 'mace') {
    const reach = v.chain ? 42 + 22 : (v.rays || v.spikes ? 22 : 14);
    x0 = 12 - reach;
    x1 = 12 + reach;
    y0 = -len - reach;
    y1 = 34;
  } else if (head === 'hammer') {
    const hw = v.huge ? 30 : v.big ? 24 : 20;
    x0 = 13 - hw;
    x1 = 13 + hw;
    y0 = -len - 16;
    y1 = 34;
  } else if (head === 'pick') {
    x0 = -10;
    x1 = 40;
    y0 = -len - 4;
    y1 = 34;
  } else if (head === 'spear' || head === 'trident' || head === 'halberd') {
    x0 = 2;
    x1 = head === 'halberd' ? 42 : head === 'trident' ? 25 : 24;
    y0 = -len - 30;
    y1 = 36;
  } else if (head === 'bow') {
    const h = len * 0.62;
    const b = len * 0.22;
    x0 = -b - 9;
    x1 = v.recurve ? 18 : 2;
    y0 = -h - (v.recurve ? 9 : 3);
    y1 = h + (v.recurve ? 9 : 3);
  } else if (head === 'xbow') {
    const L = len * 0.78;
    const w = len * 0.30;
    const t = v.heavy ? 12 : 9;
    x0 = -46;
    x1 = L + 22;
    y0 = -w - 3;
    y1 = t / 2 + 21;
  } else {
    x0 = -len;
    x1 = len;
    y0 = -len;
    y1 = len;
  }

  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

function drawItemIcon(ctx, item, x, y, size) {
  if (!item) return;
  ctx.save();
  ctx.translate(x, y);

  if (item.slot === 'weapon') {
    const v = item.vis || WEAPON_VIS[item.shape] || WEAPON_VIS.gladius;
    // Ставим по центру габарита модели, а не по рукояти: у лука,
    // копья и топора рукоять сильно смещена от середины.
    const b = weaponIconBounds(v);
    const cx = (b.x0 + b.x1) / 2;
    const cy = (b.y0 + b.y1) / 2;
    const diag = Math.hypot(b.x1 - b.x0, b.y1 - b.y0);
    const sc = (size * 0.88) / Math.max(48, diag);
    ctx.rotate(-Math.PI / 4);
    ctx.scale(sc, sc);
    ctx.translate(-cx, -cy);
    drawWeaponShape(ctx, v, item);
  } else if (item.slot === 'offhand') {
    const sc = size / 92;
    ctx.scale(sc, sc);
    drawShield(ctx, item, 0, 0);
  } else if (item.slot === 'head') {
    const sc = size / 100;
    ctx.scale(sc, sc);
    ctx.translate(0, 6);
    drawHelmet(ctx, item, 0, 30);
  } else if (item.slot === 'body') {
    const sc = size / 120;
    ctx.scale(sc, sc);
    ctx.translate(0, 18);
    const shoulder = 34, waist = 24, hipY = 10;
    ctx.beginPath();
    ctx.moveTo(-waist, hipY);
    ctx.quadraticCurveTo(-shoulder * 1.3, hipY - 40, -shoulder, hipY - 58);
    ctx.quadraticCurveTo(0, hipY - 66, shoulder, hipY - 58);
    ctx.quadraticCurveTo(shoulder * 1.3, hipY - 40, waist, hipY);
    ctx.quadraticCurveTo(0, hipY + 6, -waist, hipY);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    drawBodyArmorDetail(ctx, item, shoulder, waist, hipY);
    ctx.restore();
  } else if (item.slot === 'arms') {
    const sc = size / 90;
    ctx.scale(sc, sc);
    ctx.rotate(-0.3);
    limb(ctx, -22, 22, 18, -22, 20, item.color);
    ctx.fillStyle = shade(item.color, 0.16);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    roundRect(ctx, -8, -16, 26, 12, 4);
    ctx.fill(); ctx.stroke();
    // Новые школы: показываем фактуру наручей на иконке
    if (['medieval', 'china', 'rus', 'mongol'].includes(item.vis)) {
      drawArmSchoolDetail(ctx, item, 6, -4);
    }
  } else if (item.slot === 'legs') {
    const sc = size / 100;
    ctx.scale(sc, sc);
    ctx.translate(0, 8);
    [-1, 1].forEach(sd => {
      limb(ctx, sd * 12, -30, sd * 16, 26, 18, item.color);
      ctx.fillStyle = shade(item.color, 0.16);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      roundRect(ctx, sd * 16 - 12, -22, 24, 34, 5);
      ctx.fill(); ctx.stroke();
      // Новые школы: полосы отделки по поножу
      if (item.vis === 'medieval') {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        roundRect(ctx, sd * 16 - 9, -18, 6, 24, 3);
        ctx.fill();
        ctx.fillStyle = item.trim || '#c0392b';
        roundRect(ctx, sd * 16 - 12, -4, 24, 4, 2);
        ctx.fill();
      } else if (item.vis === 'china') {
        ctx.fillStyle = item.trim || '#e2b65a';
        for (let i = 0; i < 3; i++) {
          roundRect(ctx, sd * 16 - 10, -18 + i * 9, 20, 3.4, 1.4);
          ctx.fill();
        }
      } else if (item.vis === 'rus') {
        ctx.strokeStyle = shade(item.color, -0.3);
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(sd * 16 - 11, -18 + i * 8);
          ctx.lineTo(sd * 16 + 11, -17 + i * 8);
          ctx.stroke();
        }
      } else if (item.vis === 'mongol') {
        ctx.fillStyle = '#b8a888';
        roundRect(ctx, sd * 16 - 12, -6, 24, 6, 3);
        ctx.fill();
      }
    });
  }

  ctx.restore();
}

function itemTierBadge(item) {
  const t = TIER_INFO[item.tier] || TIER_INFO[1];
  return `<span class="tier-badge" style="color:${t.color};border-color:${t.color}">${t.stars} ${t.name}</span>`;
}

// ---------- Body cosmetics: tattoos and war paint ----------
function drawBodyCosmetics(ctx, glad, shoulder, waist, hipY) {
  const tattoo = glad.tattoo || (glad.cosmetic && glad.cosmetic.tattoo) || 'none';
  const paint = glad.paint || (glad.cosmetic && glad.cosmetic.paint) || 'none';
  if (tattoo === 'none' && paint === 'none') return;

  ctx.save();
  ctx.lineCap = 'round';

  if (tattoo === 'bands') {
    ctx.strokeStyle = 'rgba(38,28,26,0.75)';
    ctx.lineWidth = 2.6;
    for (let i = 0; i < 3; i++) {
      const yy = hipY - 40 + i * 5;
      ctx.beginPath();
      ctx.moveTo(-shoulder * 0.62, yy);
      ctx.quadraticCurveTo(-shoulder * 0.35, yy + 2, -shoulder * 0.12, yy);
      ctx.moveTo(shoulder * 0.62, yy);
      ctx.quadraticCurveTo(shoulder * 0.35, yy + 2, shoulder * 0.12, yy);
      ctx.stroke();
    }
  } else if (tattoo === 'snake') {
    ctx.strokeStyle = 'rgba(30,60,44,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(shoulder * 0.68, hipY - 46);
    ctx.bezierCurveTo(shoulder * 0.4, hipY - 34, shoulder * 0.72, hipY - 22, shoulder * 0.34, hipY - 14);
    ctx.stroke();
    ctx.fillStyle = 'rgba(30,60,44,0.85)';
    ctx.beginPath();
    ctx.arc(shoulder * 0.34, hipY - 14, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (tattoo === 'wings') {
    ctx.strokeStyle = 'rgba(40,32,30,0.7)';
    ctx.lineWidth = 2.2;
    [-1, 1].forEach(s => {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(s * shoulder * 0.1, hipY - 44 + i * 4);
        ctx.quadraticCurveTo(s * shoulder * 0.5, hipY - 46 + i * 8, s * shoulder * 0.85, hipY - 30 + i * 9);
        ctx.stroke();
      }
    });
  } else if (tattoo === 'runes') {
    ctx.strokeStyle = 'rgba(52,34,60,0.8)';
    ctx.lineWidth = 2.2;
    const rx = [-shoulder * 0.34, 0, shoulder * 0.34];
    rx.forEach((x, i) => {
      const yy = hipY - 38 + (i % 2) * 8;
      ctx.beginPath();
      ctx.moveTo(x - 4, yy); ctx.lineTo(x + 4, yy);
      ctx.moveTo(x, yy - 6); ctx.lineTo(x, yy + 6);
      ctx.moveTo(x - 3, yy + 3); ctx.lineTo(x + 3, yy - 3);
      ctx.stroke();
    });
  }

  if (paint === 'war') {
    ctx.strokeStyle = 'rgba(150,40,32,0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-shoulder * 0.5, hipY - 44); ctx.lineTo(-shoulder * 0.2, hipY - 16);
    ctx.moveTo(shoulder * 0.5, hipY - 44); ctx.lineTo(shoulder * 0.2, hipY - 16);
    ctx.stroke();
  } else if (paint === 'ash') {
    ctx.fillStyle = 'rgba(70,66,62,0.35)';
    ctx.beginPath();
    ctx.ellipse(-shoulder * 0.3, hipY - 30, shoulder * 0.4, 16, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (paint === 'gold') {
    ctx.strokeStyle = 'rgba(226,182,90,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-shoulder * 0.55, hipY - 42);
    ctx.quadraticCurveTo(0, hipY - 26, shoulder * 0.55, hipY - 42);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-shoulder * 0.4, hipY - 20);
    ctx.quadraticCurveTo(0, hipY - 8, shoulder * 0.4, hipY - 20);
    ctx.stroke();
  }

  ctx.restore();
}

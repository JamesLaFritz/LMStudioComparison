// Space_Invaders/systems/CollisionSystem.js
// Hand-written collision math. No physics libraries.
//
// All tests are 2D (z=0 plane). Bullets are swept (segment vs shape) so a
// 38 m/s bullet cannot tunnel through a 0.42 m invader at 60 fps.

/**
 * Closest point on segment (p0→p1) to point c. Returns squared distance.
 * Standard parametric clamp.
 */
export function segmentPointSqDist(x0, y0, x1, y1, cx, cy) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 1e-12) {
    t = ((cx - x0) * dx + (cy - y0) * dy) / lenSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
  }
  const px = x0 + dx * t;
  const py = y0 + dy * t;
  const ddx = cx - px;
  const ddy = cy - py;
  return ddx * ddx + ddy * ddy;
}

/** Swept bullet vs invader circle. */
export function bulletHitsInvader(b, inv) {
  const r = b.radius + inv.radius;
  return segmentPointSqDist(b.px, b.py, b.x, b.y, inv.x, inv.y) < r * r;
}

/**
 * Swept bullet vs axis-aligned block (shield).
 * Slab method on the segment; returns true if the segment intersects the box.
 */
export function bulletHitsBlock(b, block) {
  const minX = block.x - block.w * 0.5;
  const maxX = block.x + block.w * 0.5;
  const minY = block.y - block.h * 0.5;
  const maxY = block.y + block.h * 0.5;

  let tmin = 0;
  let tmax = 1;
  const dx = b.x - b.px;
  const dy = b.y - b.py;

  // X slab
  if (Math.abs(dx) < 1e-9) {
    if (b.px < minX || b.px > maxX) return false;
  } else {
    let t1 = (minX - b.px) / dx;
    let t2 = (maxX - b.px) / dx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  // Y slab
  if (Math.abs(dy) < 1e-9) {
    if (b.py < minY || b.py > maxY) return false;
  } else {
    let t1 = (minY - b.py) / dy;
    let t2 = (maxY - b.py) / dy;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

/** Circle vs circle (invader vs player, bonus vs bullet). */
export function circleCircle(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy < r * r;
}

/**
 * Resolve all collisions for one frame. Returns an event list the game
 * orchestrates (VFX, scoring, audio). Pure — no side effects on inputs.
 *
 * @returns {Array<{type:string, a:object, b:object}>}
 */
export function resolveCollisions(ctx) {
  const events = [];

  // Player bullets vs invaders (swept).
  for (const b of ctx.playerBullets) {
    if (!b.active) continue;
    for (const inv of ctx.invaders) {
      if (!inv.alive) continue;
      if (bulletHitsInvader(b, inv)) {
        events.push({ type: 'bulletInvader', bullet: b, invader: inv });
        break; // one bullet kills one invader per frame
      }
    }
  }

  // Player bullets vs bonus invader.
  for (const b of ctx.playerBullets) {
    if (!b.active) continue;
    if (ctx.bonus && ctx.bonus.active && bulletHitsInvader(b, ctx.bonus)) {
      events.push({ type: 'bulletBonus', bullet: b, bonus: ctx.bonus });
    }
  }

  // Player bullets vs shields (swept vs AABB).
  for (const b of ctx.playerBullets) {
    if (!b.active) continue;
    for (const block of ctx.shieldBlocks) {
      if (block.w <= 0.05 || block.h <= 0.05) continue;
      if (bulletHitsBlock(b, block)) {
        events.push({ type: 'bulletShield', bullet: b, block });
        break;
      }
    }
  }

  // Invader bullets vs player (swept vs circle).
  for (const b of ctx.invaderBullets) {
    if (!b.active) continue;
    if (ctx.player.alive && !ctx.player.invulnerable) {
      if (bulletHitsInvader(b, { x: ctx.player.x, y: ctx.player.y, radius: ctx.player.radius })) {
        events.push({ type: 'invaderBulletPlayer', bullet: b });
      }
    }
  }

  // Invader bullets vs shields.
  for (const b of ctx.invaderBullets) {
    if (!b.active) continue;
    for (const block of ctx.shieldBlocks) {
      if (block.w <= 0.05 || block.h <= 0.05) continue;
      if (bulletHitsBlock(b, block)) {
        events.push({ type: 'invaderBulletShield', bullet: b, block });
        break;
      }
    }
  }

  // Invaders vs player (formation descended into the cannon).
  if (ctx.player.alive && !ctx.player.invulnerable) {
    for (const inv of ctx.invaders) {
      if (!inv.alive) continue;
      if (circleCircle(inv.x, inv.y, inv.radius, ctx.player.x, ctx.player.y, ctx.player.radius)) {
        events.push({ type: 'invaderPlayer', invader: inv });
        break;
      }
    }
  }

  return events;
}

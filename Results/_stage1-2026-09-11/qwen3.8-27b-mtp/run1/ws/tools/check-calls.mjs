// tools/check-calls.mjs — audit that every `this.<obj>.<member>` use in Game.js
// resolves to a real member of the corresponding class (method, getter, or field).
import fs from 'node:fs';

const game = fs.readFileSync('Space_Invaders/Game.js', 'utf8');

const targets = {
  formation: ['Space_Invaders/entities/AlienFormation.js', 'AlienFormation'],
  player:    ['Space_Invaders/entities/PlayerShip.js', 'PlayerShip'],
  bullets:   ['Space_Invaders/entities/BulletSystem.js', 'BulletSystem'],
  bunkers:   ['Space_Invaders/entities/Bunkers.js', 'Bunkers'],
  ufo:       ['Space_Invaders/entities/UfoShip.js', 'UfoShip'],
  particles: ['shared/vfx/ParticleManager.js', 'ParticleManager'],
  shake:     ['shared/vfx/CameraShake.js', 'CameraShake'],
  hitstop:   ['shared/vfx/HitStop.js', 'HitStop'],
  trails:    ['shared/vfx/MotionTrails.js', 'MotionTrails'],
  rings:     ['shared/vfx/ShockwaveRings.js', 'ShockwaveRings'],
  scoreText: ['shared/vfx/FloatingScoreText.js', 'FloatingScoreText'],
  audio:     ['shared/audio/AudioEngine.js', 'AudioEngine'],
};

let bad = 0;
for (const [prop, [file, cls]] of Object.entries(targets)) {
  const src = fs.readFileSync(file, 'utf8');
  const members = new Set();
  for (const m of src.matchAll(/^\s{2}(?:get\s+)?([a-zA-Z_$][\w$]*)\s*\(/gm)) members.add(m[1]); // methods + getters
  for (const m of src.matchAll(/\bthis\.(_?[a-zA-Z]\w*)\s*=/g)) members.add(m[1]);                 // instance fields

  const used = new Set();
  for (const m of game.matchAll(new RegExp(`this\\.${prop}\\.([a-zA-Z_$][\\w$]*)`, 'g'))) used.add(m[1]);

  const missing = [...used].filter((c) => !members.has(c));
  if (missing.length) {
    console.log(`DRIFT in ${cls}: Game.js uses [${missing.join(', ')}] — not found`);
    bad += missing.length;
  } else {
    console.log(`OK: ${cls} satisfies all ${used.size} member uses from Game.js`);
  }
}
process.exit(bad ? 1 : 0);

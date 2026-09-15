<div id="hud" class="glass">
  <div class="score-container"><span class="label">SCORE</span> <span id="score">00000</span></div>
  <div id="game-state" class="status">READY — PRESS SPACE / BUTTON 0 TO FIRE</div>
</div>

<style>
body { margin: 0; overflow: hidden; background: #02040a; font-family: 'Orbitron', sans-serif; }
.glass { position: absolute; top: 1rem; left: 1rem; padding: 1.5rem; border-radius: 8px; backdrop-filter: blur(16px); background: rgba(20,30,48,0.7); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.2); color: #fff; pointer-events: none; }
.score-container { font-size: 3rem; letter-spacing: -4px; text-shadow: 0 0 15px rgba(68,255,68,0.7), 0 0 30px rgba(68,255,68,0.4); }
.label { font-size: 0.9rem; letter-spacing: 4px; opacity: 0.6; margin-right: 1rem; vertical-align: bottom; position: relative; top:-3px;}
#score { font-family: monospace; color: #aaffaa; }
.status { margin-top: 2rem; padding: 0.8rem 1.5rem; border-radius: 4px; background: rgba(68,255,68,0.1); border: 1px solid rgba(68,255,68,0.3); color: #aaffaa; font-size: 1.2rem; letter-spacing: 2px; text-transform: uppercase; animation: pulse 4s infinite ease-in-out;}
@keyframes pulse { 0%, 100% { opacity: 0.7; box-shadow: inset 0 0 15px rgba(68,255,68,0.3); } 50% { opacity: 1; box-shadow: inset 0 0 40px rgba(68,255,68,0.5); text-shadow: 0 0 8px #aaffaa;} }
</style>
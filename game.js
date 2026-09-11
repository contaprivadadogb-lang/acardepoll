// ================= ACARDEPOLL v1.0 — Jogo de Sinuca Offline =================
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const W = 900, H = 500;          // mesa lógica
const R = 11;                    // raio da bola
const FRICTION = 0.988, STOP = 0.05, REST = 0.94;
const POCKETS = [                // 6 caçapas
  {x:35,y:30},{x:W/2,y:22},{x:W-35,y:30},
  {x:35,y:H-30},{x:W/2,y:H-22},{x:W-35,y:H-30}
];
const PR = 22;                   // raio da caçapa

// ---- Estado do jogo ----
let balls = [], cue = {a:0, power:0, dragging:false};
let gameState = 'aim';           // aim | shoot | sim | ballinhand | over
let turn = 0;                    // 0 = jogador, 1 = CPU
let groups = [null, null];       // 'solid' | 'stripe'
let shotFirstHit = null, pottedThisShot = [];
let gameOver = false;

function makeBall(id, x, y) {
  return {id, x, y, vx:0, vy:0, in:false,
    color:['#fff','#ffd700','#1e4fd6','#d61e1e','#6a1eb0','#ff7b00','#0f7d2c','#7a1526','#111'][id] || '#fff',
    stripe: id > 8};
}
function rack() {
  balls = [makeBall(0, W*0.22, H/2)];   // branca
  const order = [1,9,2,10,8,3,11,4,12,5,13,6,14,7,15];
  let i = 0, cols = 5;
  for (let c = 0; c < cols; c++)
    for (let r = 0; r <= c; r++) {
      const x = W*0.68 + c*R*1.78, y = H/2 + (r - c/2)*R*2.05;
      balls.push(makeBall(order[i++], x, y));
    }
}
function reset() { rack(); groups=[null,null]; turn=0; gameOver=false; gameState='aim';
  msg('AcardePoll — Quebra!'); }

// ---- Física ----
function step() {
  for (const b of balls) {
    if (b.in) continue;
    b.x += b.vx; b.y += b.vy;
    b.vx *= FRICTION; b.vy *= FRICTION;
    if (Math.hypot(b.vx,b.vy) < STOP) { b.vx = b.vy = 0; }
    // bordas (com aberturas das caçapas)
    const nearPocket = POCKETS.some(p => Math.hypot(b.x-p.x, b.y-p.y) < PR+R);
    if (!nearPocket) {
      if (b.x < 35+R) { b.x = 35+R; b.vx *= -REST; }
      if (b.x > W-35-R){ b.x = W-35-R; b.vx *= -REST; }
      if (b.y < 30+R) { b.y = 30+R; b.vy *= -REST; }
      if (b.y > H-30-R){ b.y = H-30-R; b.vy *= -REST; }
    }
    // caçapas
    for (const p of POCKETS)
      if (Math.hypot(b.x-p.x, b.y-p.y) < PR) { b.in = true; pottedThisShot.push(b.id); }
  }
  // colisões bola-bola
  for (let i = 0; i < balls.length; i++)
    for (let j = i+1; j < balls.length; j++) {
      const a = balls[i], b = balls[j];
      if (a.in || b.in) continue;
      const dx = b.x-a.x, dy = b.y-a.y, d = Math.hypot(dx,dy);
      if (d < R*2 && d > 0) {
        const nx = dx/d, ny = dy/d, overlap = R*2-d;
        a.x -= nx*overlap/2; a.y -= ny*overlap/2;
        b.x += nx*overlap/2; b.y += ny*overlap/2;
        const va = a.vx*nx + a.vy*ny, vb = b.vx*nx + b.vy*ny;
        if (va - vb > 0) {
          a.vx += (vb-va)*nx*REST; a.vy += (vb-va)*ny*REST;
          b.vx += (va-vb)*nx*REST; b.vy += (va-vb)*ny*REST;
          if (a.id===0) shotFirstHit ??= b.id;
          if (b.id===0) shotFirstHit ??= a.id;
        }
      }
    }
}
const anyMoving = () => balls.some(b => !b.in && (b.vx || b.vy));

// ---- Regras 8-ball (resumo profissional) ----
function endShot() {
  const potted = pottedThisShot; pottedThisShot = [];
  const cueIn = potted.includes(0), eightIn = potted.includes(8);
  let foul = cueIn || !shotFirstHit;
  if (groups[0] && !foul && shotFirstHit) {
    const g = groups[turn];
    const first = balls.find(b=>b.id===shotFirstHit);
    if (first && ((g==='solid' && first.id>8) || (g==='stripe' && first.id<8 && first.id!==0)))
      foul = first.id !== 8 || !groupCleared(turn);
  }
  // designar grupos na quebra/primeira pot
  if (!groups[0]) {
    const nums = potted.filter(id => id>0 && id!==8);
    if (nums.length && !foul) {
      const solids = nums.filter(id=>id<9).length, stripes = nums.filter(id=>id>8).length;
      if (solids !== stripes) {
        groups[turn] = solids > stripes ? 'solid' : 'stripe';
        groups[1-turn] = groups[turn]==='solid' ? 'stripe' : 'solid';
        msg('Você é ' + (groups[0]==='solid'?'Lisas (1-7)':'Listradas (9-15)'));
      }
    }
  }
  if (eightIn) {
    if (groupCleared(turn) && !cueIn && !foul) return end(turn===0?'VOCÊ VENCEU! 🏆':'CPU VENCEU!');
    return end(turn===0?'Você perdeu (8 antes da hora)!':'Você venceu! A errou a 8.');
  }
  if (foul) { turn = 1-turn; gameState='ballinhand'; msg('Falta! Toque para posicionar a branca'); }
  else {
    const legalPot = potted.some(id => id>0 && id!==8 &&
      (!groups[turn] || (groups[turn]==='solid'? id<9 : id>8)));
    if (!legalPot) turn = 1-turn;
    gameState = 'aim'; msg(turn===0?'Sua vez':'Vez da CPU');
    if (turn===1) setTimeout(cpuPlay, 900);
  }
  updateHUD();
}
const groupCleared = p => balls.filter(b => !b.in && b.id>0 && b.id!==8 &&
  (groups[p]==='solid' ? b.id<9 : b.id>8)).length === 0;

function placeCue(x, y) {
  const c = balls[0]; c.in = false; c.vx = c.vy = 0;
  c.x = Math.max(45+R, Math.min(W-45-R, x));
  c.y = Math.max(40+R, Math.min(H-40-R, y));
}
function shoot(px, py) {
  const c = balls[0], dx = px-c.x, dy = py-c.y, d = Math.hypot(dx,dy) || 1;
  const p = cue.power;
  c.vx = dx/d*p; c.vy = dy/d*p;
  shotFirstHit = null; gameState='sim'; msg('');
}

// ---- CPU simples: mira na bola do grupo mais próxima de uma caçapa ----
function cpuPlay() {
  if (gameOver) return;
  const g = groups[1] || 'solid';
  const targets = balls.filter(b => !b.in && b.id!==0 &&
    (groups[1] ? (g==='solid'? b.id<9 : b.id>8) : true) && b.id!==8 || (groupCleared(1)&&b.id===8));
  if (!targets.length) { setTimeout(()=>{shoot(Math.random()*W, Math.random()*H);},300); return; }
  let best=null, bd=1e9;
  for (const t of targets) for (const p of POCKETS) {
    const d = Math.hypot(t.x-balls[0].x, t.y-balls[0].y) + Math.hypot(t.x-p.x,t.y-p.y);
    if (d < bd) { bd = d; best = t; }
  }
  const ox = best.x + (best.x-balls[0].x)*0.001, oy = best.y;
  cue.power = Math.min(11, bd/60 + 3);
  shoot(ox, oy);
}

// ---- Input (arraste puxa o taco, estilo 8 Ball Pool) ----
function pos(e){ const r = cv.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return {x:(t.clientX-r.left)*W/r.width, y:(t.clientY-r.top)*H/r.height}; }
cv.addEventListener('pointerdown', e => {
  if (gameOver) { reset(); return; }
  if (gameState==='ballinhand') { const p=pos(e); placeCue(p.x,p.y); gameState='aim'; msg(''); return; }
  if (gameState==='aim' && turn===0) { cue.dragging = true; }
});
cv.addEventListener('pointermove', e => {
  if (cue.dragging) { const p = pos(e), c = balls[0];
    cue.a = Math.atan2(c.y-p.y, c.x-p.x);
    cue.power = Math.min(13, Math.hypot(p.x-c.x, p.y-c.y)/22); }
});
cv.addEventListener('pointerup', e => {
  if (cue.dragging) { cue.dragging = false;
    if (cue.power > 0.5) { const p = pos(e); shoot(p.x, p.y); } else cue.power = 0; }
});

// ---- Render ----
function draw() {
  ctx.fillStyle = '#0a5c20'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#12521a'; ctx.fillRect(28,23,W-56,H-46);   // borracha
  ctx.fillStyle = '#1a8a35'; ctx.fillRect(38,33,W-76,H-66);   // feltro
  for (const p of POCKETS) { ctx.fillStyle='#000';
    ctx.beginPath(); ctx.arc(p.x,p.y,PR,0,7); ctx.fill(); }
  // taco
  if (gameState==='aim' && turn===0 && !gameOver) {
    const c = balls[0];
    ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(cue.a);
    ctx.fillStyle = '#c8996a'; ctx.fillRect(-30-cue.power*4, -2.5, -160, 5);
    ctx.restore();
    // linha de mira
    ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.setLineDash([5,7]);
    ctx.beginPath(); ctx.moveTo(c.x,c.y);
    ctx.lineTo(c.x+Math.cos(cue.a)*400, c.y+Math.sin(cue.a)*400); ctx.stroke();
    ctx.setLineDash([]);
    if (cue.power>0){ ctx.fillStyle='#fff'; ctx.font='14px sans-serif';
      ctx.fillText('Força: '+Math.round(cue.power/13*100)+'%', c.x+20, c.y-25); }
  }
  for (const b of balls) {
    if (b.in) continue;
    ctx.beginPath(); ctx.arc(b.x,b.y,R,0,7);
    if (b.stripe) { ctx.fillStyle='#fff'; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(b.x,b.y,R,0,7); ctx.clip();
      ctx.fillStyle=b.color; ctx.fillRect(b.x-R,b.y-R*0.55,R*2,R*1.1); ctx.restore(); }
    else ctx.fillStyle = b.color, ctx.fill();
    ctx.strokeStyle='#0006'; ctx.stroke();
    if (b.id>0){ ctx.fillStyle='#fff'; ctx.beginPath();
      ctx.arc(b.x-3,b.y-3,4.5,0,7); ctx.fill();
      ctx.fillStyle='#000'; ctx.font='bold 7px sans-serif';
      ctx.fillText(b.id, b.x-4.5, b.y-1); }
  }
}

// ---- Loop / HUD ----
const msgEl = document.getElementById('msg');
function msg(t){ msgEl.textContent = t; }
function updateHUD(){
  const g = p => groups[p] ? (groups[p]==='solid'?'Lisas':'Listradas') : '—';
  document.getElementById('p1').textContent = 'Você: '+g(0);
  document.getElementById('p2').textContent = 'CPU: '+g(1);
  document.getElementById('turn').textContent = gameOver?'Fim de jogo':(turn===0?'Sua vez':'CPU pensando...');
}
function end(t){ gameOver = true; gameState='over'; msg(t+' — toque para jogar novamente'); updateHUD(); }

function loop() {
  if (gameState==='sim') { step(); if (!anyMoving()) endShot(); }
  draw(); requestAnimationFrame(loop);
}
function fit(){ const s = Math.min(innerWidth/W, (innerHeight-40)/H);
  cv.width = W*s; cv.height = H*s; }
addEventListener('resize', fit);
fit(); reset(); loop();

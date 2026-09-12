// ================= ACARDEPOLL v1.0 — Jogo de Sinuca Offline =================
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const W = 900, H = 500;          // mesa lógica
const R = 11;                    // raio da bola
const FRICTION = 0.988, STOP = 0.05, REST = 0.94;
const POCKETS = [                // 6 caçapas
  {x:46,y:46},{x:W/2,y:38},{x:W-46,y:46},
  {x:46,y:H-46},{x:W/2,y:H-38},{x:W-46,y:H-46}
];
const PR = 22;                   // raio da caçapa

// ---- Estado do jogo ----
let balls = [], cue = {a:0, power:0, dragging:false};
let gameState = 'aim';           // aim | shoot | sim | ballinhand | over
let turn = 0;                    // 0 = jogador, 1 = CPU
let groups = [null, null];       // 'solid' | 'stripe'
let shotFirstHit = null, pottedThisShot = [];
let gameOver = false;

const BALL_COLORS = ['#fff','#e8b923','#2a5cd6','#d0271f','#5b1e94','#e2680f','#146b2e','#7a1526','#141414'];
function makeBall(id, x, y) {
  const cid = id > 8 ? id - 8 : id;
  return {id, x, y, vx:0, vy:0, in:false,
    color: BALL_COLORS[cid] || '#fff',
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
      if (b.x < 46+R) { b.x = 46+R; b.vx *= -REST; }
      if (b.x > W-46-R){ b.x = W-46-R; b.vx *= -REST; }
      if (b.y < 46+R) { b.y = 46+R; b.vy *= -REST; }
      if (b.y > H-46-R){ b.y = H-46-R; b.vy *= -REST; }
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
  if (foul) {
    turn = 1-turn; gameState='ballinhand'; msg('Falta! Toque para posicionar a branca');
    if (turn===1) {                 // CPU não interage por toque: ela mesma coloca e joga
      placeCue(W*0.25, H/2);
      gameState='aim'; msg('Vez da CPU');
      setTimeout(cpuPlay, 900);
    }
  }
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
  c.x = Math.max(46+R, Math.min(W-46-R, x));
  c.y = Math.max(46+R, Math.min(H-46-R, y));
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

// ---- Render (visual estilo "8 Ball Pool": borda de madeira + feltro azul) ----
const RAIL = 34, CUSH = 12;  // espessura da borda de madeira e da borracha
let feltGrad = null, woodGrad = null;
function buildGradients() {
  woodGrad = ctx.createLinearGradient(0,0,W,H);
  woodGrad.addColorStop(0, '#7a4a26');
  woodGrad.addColorStop(0.15, '#5c3419');
  woodGrad.addColorStop(0.5, '#8a5a30');
  woodGrad.addColorStop(0.85, '#5c3419');
  woodGrad.addColorStop(1, '#7a4a26');
  feltGrad = ctx.createRadialGradient(W/2,H*0.38,60, W/2,H/2,W*0.65);
  feltGrad.addColorStop(0, '#2f8dc4');
  feltGrad.addColorStop(0.55, '#1f74a8');
  feltGrad.addColorStop(1, '#155a85');
}
function drawDiamond(x,y){
  ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI/4);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillRect(-3,-3,6,6);
  ctx.restore();
}
function roundedRectPath(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function drawPocket(p){
  // aro de couro
  ctx.beginPath(); ctx.fillStyle = '#3a1a12';
  ctx.arc(p.x,p.y,PR*1.3,0,7); ctx.fill();
  // buraco
  const grad = ctx.createRadialGradient(p.x,p.y,PR*0.2,p.x,p.y,PR*1.02);
  grad.addColorStop(0,'#000'); grad.addColorStop(0.85,'#000'); grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.fillStyle=grad; ctx.arc(p.x,p.y,PR*1.02,0,7); ctx.fill();
  ctx.beginPath(); ctx.strokeStyle='rgba(255,214,140,.4)'; ctx.lineWidth=2;
  ctx.arc(p.x,p.y,PR,0,7); ctx.stroke();
}
function draw() {
  if (!feltGrad) buildGradients();
  // fundo de madeira (rail) com friso dourado e cantos arredondados
  roundedRectPath(0,0,W,H,26); ctx.fillStyle = woodGrad; ctx.fill();
  roundedRectPath(RAIL*0.55, RAIL*0.55, W-RAIL*1.1, H-RAIL*1.1, 20);
  ctx.strokeStyle = 'rgba(230,190,110,.55)'; ctx.lineWidth = 3; ctx.stroke();
  // borracha (cushion) escura entre madeira e feltro
  roundedRectPath(RAIL, RAIL, W-RAIL*2, H-RAIL*2, 14);
  ctx.fillStyle = '#0d3550'; ctx.fill();
  // feltro azul
  const fx = RAIL+CUSH, fy = RAIL+CUSH, fw = W-2*(RAIL+CUSH), fh = H-2*(RAIL+CUSH);
  roundedRectPath(fx, fy, fw, fh, 8); ctx.fillStyle = feltGrad; ctx.fill();
  // linha central e círculo de saída (estética)
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(fx+fw*0.28, fy); ctx.lineTo(fx+fw*0.28, fy+fh); ctx.stroke();
  ctx.beginPath(); ctx.arc(fx+fw*0.28, fy+fh/2, 42, 0, 7); ctx.stroke();
  // diamantes de mira nas bordas
  for (let i=1;i<=3;i++){
    const dx = RAIL/2 + (W-RAIL) * (i/4);
    drawDiamond(dx, RAIL/2); drawDiamond(dx, H-RAIL/2);
  }
  drawDiamond(RAIL/2, H*0.33); drawDiamond(RAIL/2, H*0.67);
  drawDiamond(W-RAIL/2, H*0.33); drawDiamond(W-RAIL/2, H*0.67);
  // caçapas
  for (const p of POCKETS) drawPocket(p);
  // taco
  if (gameState==='aim' && turn===0 && !gameOver) {
    const c = balls[0];
    ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(cue.a);
    const cueGrad = ctx.createLinearGradient(-190,0,-30,0);
    cueGrad.addColorStop(0, '#3b2313'); cueGrad.addColorStop(0.85, '#c8996a'); cueGrad.addColorStop(1,'#e9c99a');
    ctx.fillStyle = cueGrad;
    ctx.fillRect(-30-cue.power*4-160, -3, 160, 6);
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
    // sombra de contato no feltro
    ctx.beginPath(); ctx.fillStyle='rgba(0,0,0,.25)';
    ctx.ellipse(b.x, b.y+R*0.65, R*0.85, R*0.35, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(b.x,b.y,R,0,7);
    if (b.stripe) { ctx.fillStyle='#f4f0e6'; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(b.x,b.y,R,0,7); ctx.clip();
      ctx.fillStyle=b.color; ctx.fillRect(b.x-R,b.y-R*0.55,R*2,R*1.1); ctx.restore(); }
    else { ctx.fillStyle = b.color; ctx.fill(); }
    ctx.strokeStyle='#0006'; ctx.lineWidth=1; ctx.stroke();
    // brilho esférico
    const shine = ctx.createRadialGradient(b.x-R*0.4,b.y-R*0.45,0.5, b.x-R*0.4,b.y-R*0.45,R*1.1);
    shine.addColorStop(0,'rgba(255,255,255,.85)'); shine.addColorStop(0.35,'rgba(255,255,255,.15)'); shine.addColorStop(1,'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.arc(b.x,b.y,R,0,7); ctx.fillStyle=shine; ctx.fill();
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
  const colorFor = p => groups[p] ? (groups[p]==='solid'?'#ffd76a':'#fff') : '#fdf6e3';
  const p1El = document.getElementById('p1'), p2El = document.getElementById('p2');
  p1El.textContent = 'Você: '+g(0); p1El.style.color = colorFor(0);
  p2El.textContent = 'CPU: '+g(1); p2El.style.color = colorFor(1);
  document.getElementById('turn').textContent = gameOver?'Fim de jogo':(turn===0?'Sua vez':'CPU pensando...');
}
function end(t){ gameOver = true; gameState='over'; msg(t+' — toque para jogar novamente'); updateHUD(); }

function loop() {
  if (gameState==='sim') { step(); if (!anyMoving()) endShot(); }
  draw(); requestAnimationFrame(loop);
}
function setAppHeight(){
  const h = window.innerHeight;
  document.documentElement.style.height = h+'px';
  document.body.style.height = h+'px';
}
function fit(){
  const wrap = document.getElementById('tableWrap');
  const wr = wrap.getBoundingClientRect();
  const availW = (wr.width || innerWidth) - 8;
  const availH = (wr.height || (innerHeight - 60)) - 8;
  const s = Math.max(0.1, Math.min(availW/W, availH/H));
  cv.width = Math.round(W*s); cv.height = Math.round(H*s);
}
function refit(){ setAppHeight(); fit(); }
function checkOrientation(){
  const portrait = innerHeight > innerWidth;
  document.getElementById('rotateHint').style.display = portrait ? 'flex' : 'none';
}
addEventListener('resize', () => { checkOrientation(); refit(); });
addEventListener('orientationchange', () => {
  checkOrientation();
  setTimeout(refit, 150); setTimeout(refit, 400); setTimeout(refit, 900);
});
checkOrientation(); setAppHeight();

let started = false;
document.getElementById('playBtn').addEventListener('click', () => {
  document.getElementById('login').style.display = 'none';
  document.getElementById('game').style.display = 'flex';
  checkOrientation(); refit();
  // reconfere algumas vezes: em alguns WebViews Android a altura real
  // só se estabiliza depois do primeiro paint
  setTimeout(refit, 150); setTimeout(refit, 400); setTimeout(refit, 900);
  if (!started) { started = true; reset(); loop(); }
});

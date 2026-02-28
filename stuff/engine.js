// ═══════════════════════════════════════════════════════════
// ⚙️  ENGINE.JS – Shared game engine for Knight of Winterfell
// ═══════════════════════════════════════════════════════════
"use strict";

// ── Canvas ──────────────────────────────────────────────
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = canvas.width;   // 800
const H = canvas.height;  // 500

// ── HUD DOM ─────────────────────────────────────────────
const heartsEl = document.getElementById("hearts");
const actTitleEl = document.getElementById("actTitle");
const xpEl = document.getElementById("xpCounter");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlaySub = document.getElementById("overlaySubtitle");
const overlayPrompt = document.getElementById("overlayPrompt");

// ── Constants ───────────────────────────────────────────
const GRAVITY = 0.55;
const FRICTION = 0.82;
const JUMP_FORCE = -11;
const PLAYER_SPEED = 3.5;

// ── ZzFX Micro – tiny sound engine ─────────────────────
function zzfx(v=1,f=220,a=0,s=0,r=.1,shape=0,fSlide=0,fDelta=0){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!zzfx.ctx)zzfx.ctx=new AC();
    const c=zzfx.ctx,rate=c.sampleRate;
    const len=Math.max((a+s+r)*rate|0,1);
    const buf=c.createBuffer(1,len,rate);
    const data=buf.getChannelData(0);
    let freq=f,phase=0,t;
    for(let i=0;i<len;i++){
        t=i/rate;
        let env=1;
        if(t<a)env=t/a;
        else if(t<a+s)env=1;
        else env=1-(t-a-s)/r;
        freq+=fSlide+fDelta;
        phase+=freq*2*Math.PI/rate;
        let sample;
        if(shape===0)sample=Math.sin(phase);
        else if(shape===1)sample=phase%(2*Math.PI)<Math.PI?1:-1;
        else sample=(phase%(2*Math.PI))/Math.PI-1;
        data[i]=sample*env*v;
    }
    const src=c.createBufferSource();
    src.buffer=buf;src.connect(c.destination);src.start();
}

function sfxJump()  { zzfx(0.3,500,0,0.05,0.1,0,10); }
function sfxHit()   { zzfx(0.4,200,0,0.08,0.15,1,-5); }
function sfxSword() { zzfx(0.3,800,0,0.03,0.08,2,-20); }
function sfxArrow() { zzfx(0.2,1200,0,0.02,0.06,0,30); }
function sfxBoss()  { zzfx(0.5,120,0,0.1,0.3,1,-2); }
function sfxWin()   { zzfx(0.4,600,0,0.2,0.5,0,5); }
function sfxDie()   { zzfx(0.5,150,0,0.15,0.4,1,-10); }

// ── Input ───────────────────────────────────────────────
const keys = {};
window.addEventListener("keydown", e => { keys[e.code] = true; });
window.addEventListener("keyup",   e => { keys[e.code] = false; });

function keyLeft()   { return keys["ArrowLeft"]  || keys["KeyA"]; }
function keyRight()  { return keys["ArrowRight"] || keys["KeyD"]; }
function keyUp()     { return keys["ArrowUp"]    || keys["KeyW"]; }
function keyAttack() { return keys["Space"]; }
function keyRestart(){ return keys["KeyR"]; }

// ── Utility ─────────────────────────────────────────────
function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
}
function rand(min, max) { return Math.random() * (max - min) + min; }

// ── Screen Shake ────────────────────────────────────────
let shakeTimer = 0, shakeMag = 0;
function triggerShake(dur, mag) { shakeTimer = dur; shakeMag = mag; }

// ── Game State (persisted via localStorage) ─────────────
let xp = parseInt(localStorage.getItem("kow_xp")) || 0;
let lives = parseInt(localStorage.getItem("kow_lives")) || 3;
let attackCooldown = 0;
let actTransitionTimer = 0;
let actTransitionText = "";

function saveState() {
    localStorage.setItem("kow_xp", xp);
    localStorage.setItem("kow_lives", lives);
}

function resetState() {
    xp = 0; lives = 3;
    localStorage.setItem("kow_xp", 0);
    localStorage.setItem("kow_lives", 3);
}

// ── Particles ───────────────────────────────────────────
let particles = [];
function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: rand(-3, 3), vy: rand(-4, 1),
            life: rand(15, 30), color, size: rand(2, 5)
        });
    }
}

// ── Floating Text ───────────────────────────────────────
let floatingTexts = [];
function spawnFloatingText(x, y, text, color) {
    floatingTexts.push({ x, y, text, color, life: 50 });
}

// ── Player ──────────────────────────────────────────────
const player = {
    x: 60, y: 0, w: 24, h: 36,
    vx: 0, vy: 0,
    onGround: false, facing: 1,
    invincible: 0, swordSwing: 0,
    animFrame: 0, animTimer: 0,
    jumpsLeft: 2          // double jump support
};

function resetPlayer() {
    player.x = 60; player.y = 0;
    player.vx = 0; player.vy = 0;
    player.onGround = false;
    player.invincible = 0;
    player.swordSwing = 0;
    player.jumpsLeft = 2;
}

// ── Arrows ──────────────────────────────────────────────
let arrows = [];
function spawnArrow() {
    sfxArrow();
    arrows.push({
        x: player.x + (player.facing === 1 ? player.w : -8),
        y: player.y + 12,
        vx: player.facing * 9,
        w: 14, h: 3, life: 60
    });
}

// ── Fireballs (Dracula) ─────────────────────────────────
let fireballs = [];
function spawnFireball(x, y, tx, ty) {
    const angle = Math.atan2(ty - y, tx - x);
    fireballs.push({
        x, y,
        vx: Math.cos(angle) * 4,
        vy: Math.sin(angle) * 3,
        w: 12, h: 12, life: 120
    });
}

// ── Platforms & Enemies (set per-act) ───────────────────
let platforms = [];
let enemies = [];

// ── Enemy Factories ─────────────────────────────────────
function makeSlime(x, y) {
    return {
        type: "slime", x, y, w: 24, h: 24,
        vx: 1, hp: 2,
        patrolLeft: x - 60, patrolRight: x + 60,
        color: "#00FF00", xpValue: 15,
        flashTimer: 0, animTimer: 0
    };
}

function makeBat(x, y) {
    return {
        type: "bat", x, y, w: 26, h: 18,
        vx: 1.8, vy: 0, hp: 1,
        patrolLeft: x - 80, patrolRight: x + 80,
        baseY: y, color: "#AA44FF", xpValue: 20,
        flashTimer: 0, animTimer: 0
    };
}

// ── Dracula (used in Act 3) ─────────────────────────────
const DRACULA_HP = 30;
const dracula = {
    x: 600, y: H - 40 - 56, w: 36, h: 56,
    hp: DRACULA_HP, maxHp: DRACULA_HP,
    vx: 0, vy: 0,
    phase: "idle", timer: 0,
    teleportCooldown: 0, attackCooldown: 0,
    flashTimer: 0, active: false, invincible: 0
};

function resetDracula() {
    dracula.x = 600; dracula.y = H - 40 - 56;
    dracula.hp = DRACULA_HP; dracula.phase = "idle";
    dracula.timer = 0; dracula.teleportCooldown = 120;
    dracula.attackCooldown = 80; dracula.flashTimer = 0;
    dracula.active = true; dracula.invincible = 0;
}

// ── Princess ────────────────────────────────────────────
const princess = { x: 700, y: H - 40 - 36, w: 20, h: 36, visible: false };

// ── Stars (in-game night background) ────────────────────
let gameStars = [];
function generateStars() {
    gameStars = [];
    for (let i = 0; i < 80; i++) {
        gameStars.push({ x: rand(0, W), y: rand(0, H - 60), s: rand(1, 3), b: rand(0.3, 1) });
    }
}
generateStars();

// ── Clouds ──────────────────────────────────────────────
let clouds = [];
function generateClouds() {
    clouds = [];
    for (let i = 0; i < 5; i++) {
        clouds.push({ x: rand(0, W), y: rand(20, 120), w: rand(60, 120), speed: rand(0.15, 0.4) });
    }
}
generateClouds();

// ── Sword Hitbox ────────────────────────────────────────
function getSwordHitbox() {
    if (player.swordSwing <= 0) return null;
    const sw = 30, sh = 20;
    return {
        x: player.facing === 1 ? player.x + player.w : player.x - sw,
        y: player.y + 6, w: sw, h: sh
    };
}

// ── Overlays ────────────────────────────────────────────
function showOverlay(title, sub, prompt) {
    if (!overlay) return;
    overlayTitle.textContent = title;
    overlaySub.textContent = sub;
    overlayPrompt.textContent = prompt;
    overlay.classList.add("visible");
}
function hideOverlay() {
    if (!overlay) return;
    overlay.classList.remove("visible");
}

// ═════════════════════════════════════════════════════════
//  HURT PLAYER
// ═════════════════════════════════════════════════════════
function hurtPlayer(isPit, onGameOver) {
    if (player.invincible > 0 && !isPit) return;
    lives--;
    saveState();
    sfxHit();
    triggerShake(12, 5);
    if (lives <= 0) {
        if (typeof onGameOver === "function") onGameOver();
        return;
    }
    player.invincible = 60;
    if (isPit) resetPlayer();
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, "#FF4444", 10);
}

// ═════════════════════════════════════════════════════════
//  UPDATE FUNCTIONS
// ═════════════════════════════════════════════════════════
function updatePlayerPhysics(currentAct, onGameOver, onExitRight) {
    if (keyLeft())  { player.vx -= PLAYER_SPEED * 0.4; player.facing = -1; }
    if (keyRight()) { player.vx += PLAYER_SPEED * 0.4; player.facing = 1; }

    // Double jump – must release and re-press to trigger second jump
    if (keyUp()) {
        if (player._jumpReleased && player.jumpsLeft > 0) {
            player.vy = JUMP_FORCE;
            player.onGround = false;
            player.jumpsLeft--;
            player._jumpReleased = false;
            sfxJump();
        }
    } else {
        player._jumpReleased = true;
    }

    if (attackCooldown > 0) attackCooldown--;
    if (keyAttack() && attackCooldown <= 0) {
        if (currentAct === 1) {
            player.swordSwing = 12;
            attackCooldown = 18;
            sfxSword();
        } else if (currentAct === 2 || currentAct === 3) {
            spawnArrow();
            attackCooldown = 14;
            if (currentAct === 3) player.swordSwing = 10;
        }
    }

    player.vy += GRAVITY;
    player.vx *= FRICTION;
    player.x += player.vx;
    player.y += player.vy;

    if (player.swordSwing > 0) player.swordSwing--;
    if (player.invincible > 0) player.invincible--;

    // Platform collision
    player.onGround = false;
    for (const p of platforms) {
        if (aabb(player, p)) {
            if (player.vy > 0 && player.y + player.h - player.vy <= p.y + 4) {
                player.y = p.y - player.h; player.vy = 0; player.onGround = true; player.jumpsLeft = 2;
            } else if (player.vy < 0 && player.y - player.vy >= p.y + p.h - 4) {
                player.y = p.y + p.h; player.vy = 0;
            } else if (player.vx > 0 && player.x + player.w - player.vx <= p.x + 2) {
                player.x = p.x - player.w; player.vx = 0;
            } else if (player.vx < 0 && player.x - player.vx >= p.x + p.w - 2) {
                player.x = p.x + p.w; player.vx = 0;
            }
        }
    }

    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x + player.w > W) { player.x = W - player.w; player.vx = 0; }
    if (player.y > H + 40) hurtPlayer(true, onGameOver);

    player.animTimer++;
    if (player.animTimer > 8) { player.animTimer = 0; player.animFrame = (player.animFrame + 1) % 4; }

    // Exit right
    if (onExitRight && player.x + player.w >= W - 5) {
        onExitRight();
    }
}

function updateEnemies(onGameOver) {
    const sword = getSwordHitbox();
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.animTimer++;
        if (e.flashTimer > 0) e.flashTimer--;

        if (e.type === "slime") {
            e.x += e.vx;
            if (e.x <= e.patrolLeft || e.x + e.w >= e.patrolRight) e.vx *= -1;
        } else if (e.type === "bat") {
            e.x += e.vx;
            e.y = e.baseY + Math.sin(e.animTimer * 0.08) * 20;
            if (e.x <= e.patrolLeft || e.x + e.w >= e.patrolRight) e.vx *= -1;
        }

        if (sword && aabb(sword, e)) {
            e.hp--; e.flashTimer = 6;
            triggerShake(5, 3);
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.color, 6);
            if (e.hp <= 0) {
                xp += e.xpValue; saveState();
                spawnFloatingText(e.x, e.y - 10, "+" + e.xpValue + " XP", "#FFD700");
                spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.color, 12);
                sfxHit(); enemies.splice(i, 1); continue;
            }
        }

        for (let j = arrows.length - 1; j >= 0; j--) {
            if (aabb(arrows[j], e)) {
                e.hp--; e.flashTimer = 6;
                arrows.splice(j, 1);
                triggerShake(4, 2);
                spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.color, 6);
                if (e.hp <= 0) {
                    xp += e.xpValue; saveState();
                    spawnFloatingText(e.x, e.y - 10, "+" + e.xpValue + " XP", "#FFD700");
                    spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.color, 12);
                    sfxHit(); enemies.splice(i, 1); break;
                }
            }
        }

        if (enemies[i] && aabb(player, enemies[i]) && player.invincible <= 0) {
            hurtPlayer(false, onGameOver);
        }
    }
}

function updateDracula(onGameOver, onBossDefeated) {
    if (!dracula.active) return;
    const d = dracula;
    if (d.flashTimer > 0) d.flashTimer--;
    if (d.invincible > 0) d.invincible--;
    d.timer++;
    if (d.teleportCooldown > 0) d.teleportCooldown--;
    if (d.attackCooldown > 0) d.attackCooldown--;

    if (d.phase === "idle") {
        d.x += Math.sign(player.x - d.x) * 1.0;
        if (d.teleportCooldown <= 0 && Math.random() < 0.015) {
            d.phase = "teleport"; d.timer = 0; d.teleportCooldown = 150;
            spawnParticles(d.x + d.w / 2, d.y + d.h / 2, "#FF0000", 15);
            sfxBoss();
        }
        if (d.attackCooldown <= 0 && Math.random() < 0.02) {
            d.phase = "attack"; d.timer = 0; d.attackCooldown = 90;
        }
    } else if (d.phase === "teleport") {
        if (d.timer === 15) {
            const pList = platforms.filter(p => p.h <= 20);
            if (pList.length) {
                const tp = pList[Math.floor(Math.random() * pList.length)];
                d.x = tp.x + tp.w / 2 - d.w / 2; d.y = tp.y - d.h;
            } else { d.x = rand(100, W - 150); d.y = H - 40 - d.h; }
            spawnParticles(d.x + d.w / 2, d.y + d.h / 2, "#FF0000", 15);
        }
        if (d.timer > 30) d.phase = "idle";
    } else if (d.phase === "attack") {
        if (d.timer === 10) {
            spawnFireball(d.x + d.w / 2, d.y + 10, player.x + player.w / 2, player.y + player.h / 2);
            sfxBoss();
        }
        if (d.timer === 30 && d.hp < d.maxHp * 0.5) {
            spawnFireball(d.x + d.w / 2, d.y + 10, player.x + player.w / 2 + 40, player.y);
            spawnFireball(d.x + d.w / 2, d.y + 10, player.x + player.w / 2 - 40, player.y);
        }
        if (d.timer > 40) d.phase = "idle";
    }

    d.vy = d.vy || 0;
    d.vy += GRAVITY * 0.8; d.y += d.vy;
    for (const p of platforms) {
        if (aabb(d, p) && d.vy > 0 && d.y + d.h - d.vy <= p.y + 4) {
            d.y = p.y - d.h; d.vy = 0;
        }
    }
    if (d.y > H) { d.y = 100; d.vy = 0; }

    const sword = getSwordHitbox();
    if (sword && aabb(sword, d) && d.invincible <= 0) {
        d.hp -= 2; d.flashTimer = 8; d.invincible = 20;
        triggerShake(8, 5);
        spawnParticles(d.x + d.w / 2, d.y + d.h / 2, "#FF0000", 10);
        sfxHit();
    }

    for (let j = arrows.length - 1; j >= 0; j--) {
        if (aabb(arrows[j], d) && d.invincible <= 0) {
            d.hp -= 1; d.flashTimer = 8; d.invincible = 15;
            arrows.splice(j, 1);
            triggerShake(5, 3);
            spawnParticles(d.x + d.w / 2, d.y + d.h / 2, "#FF0000", 8);
            sfxHit();
        }
    }

    if (aabb(player, d) && player.invincible <= 0) hurtPlayer(false, onGameOver);

    if (d.hp <= 0) {
        d.active = false;
        spawnParticles(d.x + d.w / 2, d.y + d.h / 2, "#FF0000", 30);
        spawnFloatingText(d.x, d.y - 20, "DRACULA DEFEATED!", "#FFD700");
        xp += 100; saveState(); sfxWin(); triggerShake(20, 8);
        if (onBossDefeated) onBossDefeated();
    }
}

function updateArrows() {
    for (let i = arrows.length - 1; i >= 0; i--) {
        arrows[i].x += arrows[i].vx; arrows[i].life--;
        if (arrows[i].life <= 0 || arrows[i].x < -20 || arrows[i].x > W + 20) arrows.splice(i, 1);
    }
}

function updateFireballs(onGameOver) {
    for (let i = fireballs.length - 1; i >= 0; i--) {
        const f = fireballs[i];
        f.x += f.vx; f.y += f.vy; f.life--;
        if (f.life <= 0 || f.x < -20 || f.x > W + 20 || f.y > H + 20) { fireballs.splice(i, 1); continue; }
        if (aabb(f, player) && player.invincible <= 0) { hurtPlayer(false, onGameOver); fireballs.splice(i, 1); }
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function updateFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].y -= 0.8; floatingTexts[i].life--;
        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }
}

// ═════════════════════════════════════════════════════════
//  DRAW FUNCTIONS
// ═════════════════════════════════════════════════════════
function drawCloud(x, y, w) {
    const r = w * 0.22;
    ctx.beginPath();
    ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
    ctx.arc(x + w * 0.4, y, r * 1.3, 0, Math.PI * 2);
    ctx.arc(x + w * 0.7, y + r * 0.5, r * 1.1, 0, Math.PI * 2);
    ctx.fill();
}

function drawCastleSilhouette() {
    ctx.fillStyle = "#0D0D1A";
    ctx.fillRect(560, 60, 30, H - 100);
    ctx.fillRect(550, 50, 50, 20);
    for (let i = 0; i < 5; i++) ctx.fillRect(550 + i * 10, 40, 6, 14);
    ctx.fillRect(720, 80, 30, H - 120);
    ctx.fillRect(710, 70, 50, 20);
    for (let i = 0; i < 5; i++) ctx.fillRect(710 + i * 10, 60, 6, 14);
    ctx.fillRect(590, 130, 130, H - 170);
    ctx.fillStyle = "#1A1A3E";
    ctx.fillRect(640, H - 100, 40, 60);
    ctx.fillStyle = "#0D0D1A";
    ctx.beginPath(); ctx.arc(660, H - 100, 20, Math.PI, 0); ctx.fill();
}

function drawPlatforms(currentAct) {
    for (const p of platforms) {
        if (p.h >= 40) {
            if (currentAct === 1) {
                ctx.fillStyle = "#4A8C3F"; ctx.fillRect(p.x, p.y, p.w, 8);
                ctx.fillStyle = "#6B4226"; ctx.fillRect(p.x, p.y + 8, p.w, p.h - 8);
            } else if (currentAct === 2) {
                ctx.fillStyle = "#8B6914"; ctx.fillRect(p.x, p.y, p.w, 6);
                ctx.fillStyle = "#5C4033"; ctx.fillRect(p.x, p.y + 6, p.w, p.h - 6);
            } else {
                ctx.fillStyle = "#3A3A5C"; ctx.fillRect(p.x, p.y, p.w, 6);
                ctx.fillStyle = "#2A2A3E"; ctx.fillRect(p.x, p.y + 6, p.w, p.h - 6);
            }
        } else {
            if (currentAct === 1) ctx.fillStyle = "#7B5B3A";
            else if (currentAct === 2) ctx.fillStyle = "#8B7355";
            else ctx.fillStyle = "#4A4A6C";
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.fillStyle = "rgba(255,255,255,0.15)";
            ctx.fillRect(p.x, p.y, p.w, 3);
        }
    }
}

function drawPlayer() {
    if (player.invincible > 0 && Math.floor(player.invincible / 3) % 2 === 0) return;
    ctx.save();
    ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
    ctx.scale(player.facing, 1);
    ctx.translate(-(player.w / 2), -(player.h / 2));

    ctx.fillStyle = "#4488CC"; ctx.fillRect(2, 12, 20, 16);
    ctx.fillStyle = "#AAAAAA"; ctx.fillRect(4, 0, 16, 14);
    ctx.fillStyle = "#333"; ctx.fillRect(14, 4, 6, 6);

    ctx.fillStyle = "#335577";
    const lo = player.onGround ? Math.sin(player.animTimer * 0.7) * 3 : 0;
    ctx.fillRect(4, 28, 7, 8 + lo);
    ctx.fillRect(13, 28, 7, 8 - lo);

    if (player.swordSwing > 0) {
        ctx.fillStyle = "#CCCCCC";
        const sa = (player.swordSwing / 12) * Math.PI * 0.6 - 0.3;
        ctx.save(); ctx.translate(18, 16); ctx.rotate(-sa);
        ctx.fillRect(0, -2, 26, 4);
        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(22, -3, 6, 6);
        ctx.restore();
    } else {
        ctx.fillStyle = "#4488CC"; ctx.fillRect(16, 14, 6, 10);
    }
    ctx.restore();
}

function drawEnemies() {
    for (const e of enemies) {
        ctx.save();
        ctx.fillStyle = e.flashTimer > 0 ? "#FFFFFF" : e.color;
        if (e.type === "slime") {
            const sq = 1 + Math.sin(e.animTimer * 0.15) * 0.1;
            const w2 = e.w * sq, h2 = e.h / sq;
            ctx.fillRect(e.x - (w2 - e.w) / 2, e.y + (e.h - h2), w2, h2);
            ctx.fillStyle = "#000";
            ctx.fillRect(e.x + 5, e.y + 6, 4, 4);
            ctx.fillRect(e.x + 14, e.y + 6, 4, 4);
        } else if (e.type === "bat") {
            ctx.fillRect(e.x + 8, e.y + 4, 10, 10);
            const wf = Math.sin(e.animTimer * 0.3) * 5;
            ctx.fillRect(e.x, e.y + 2 + wf, 10, 6);
            ctx.fillRect(e.x + 16, e.y + 2 - wf, 10, 6);
            ctx.fillStyle = "#FF0000";
            ctx.fillRect(e.x + 10, e.y + 6, 2, 2);
            ctx.fillRect(e.x + 15, e.y + 6, 2, 2);
        }
        ctx.restore();
    }
}

function drawDracula() {
    if (!dracula.active) return;
    const d = dracula;
    if (d.phase === "teleport" && d.timer < 15 && Math.floor(d.timer / 2) % 2 === 0) return;
    const fl = d.flashTimer > 0 && Math.floor(d.flashTimer / 2) % 2 === 0;

    ctx.fillStyle = fl ? "#FFFFFF" : "#880000";
    ctx.beginPath();
    ctx.moveTo(d.x - 4, d.y + 10); ctx.lineTo(d.x + d.w + 4, d.y + 10);
    ctx.lineTo(d.x + d.w + 8, d.y + d.h); ctx.lineTo(d.x - 8, d.y + d.h);
    ctx.fill();

    ctx.fillStyle = fl ? "#FFFFFF" : "#222";
    ctx.fillRect(d.x + 4, d.y + 8, d.w - 8, d.h - 16);
    ctx.fillStyle = fl ? "#FFFFFF" : "#DDCCCC";
    ctx.fillRect(d.x + 8, d.y, 20, 16);
    ctx.fillStyle = "#FF0000";
    ctx.fillRect(d.x + 12, d.y + 5, 4, 4);
    ctx.fillRect(d.x + 20, d.y + 5, 4, 4);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(d.x + 14, d.y + 13, 2, 4);
    ctx.fillRect(d.x + 20, d.y + 13, 2, 4);

    const bw = 60, bh = 6, bx = d.x + d.w / 2 - bw / 2, by = d.y - 14;
    ctx.fillStyle = "#333"; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "#FF0000"; ctx.fillRect(bx, by, bw * (d.hp / d.maxHp), bh);
    ctx.strokeStyle = "#000"; ctx.strokeRect(bx, by, bw, bh);
}

function drawPrincess() {
    if (!princess.visible) return;
    const p = princess;
    ctx.fillStyle = "#FFFF00"; ctx.fillRect(p.x + 2, p.y + 14, 16, 22);
    ctx.fillStyle = "#FFD700"; ctx.fillRect(p.x + 4, p.y + 10, 12, 10);
    ctx.fillStyle = "#FFCCAA"; ctx.fillRect(p.x + 4, p.y, 12, 12);
    ctx.fillStyle = "#FFD700";
    ctx.fillRect(p.x + 4, p.y - 4, 12, 5);
    ctx.fillRect(p.x + 5, p.y - 7, 3, 4);
    ctx.fillRect(p.x + 9, p.y - 8, 3, 5);
    ctx.fillRect(p.x + 13, p.y - 7, 3, 4);
    ctx.fillStyle = "#000";
    ctx.fillRect(p.x + 6, p.y + 3, 2, 2);
    ctx.fillRect(p.x + 12, p.y + 3, 2, 2);
    ctx.fillStyle = "#FFD700"; ctx.font = "10px 'Courier New'"; ctx.textAlign = "center";
    ctx.fillText("Help me!", p.x + p.w / 2, p.y - 14 + Math.sin(Date.now() * 0.005) * 3);
}

function drawArrows() {
    ctx.fillStyle = "#FFDD44";
    for (const a of arrows) {
        ctx.save();
        ctx.translate(a.x + a.w / 2, a.y + a.h / 2);
        if (a.vx < 0) ctx.scale(-1, 1);
        ctx.fillRect(-a.w / 2, -1, a.w, 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.moveTo(a.w / 2, -3); ctx.lineTo(a.w / 2 + 5, 0); ctx.lineTo(a.w / 2, 3); ctx.fill();
        ctx.fillStyle = "#FFDD44";
        ctx.restore();
    }
}

function drawFireballs() {
    for (const f of fireballs) {
        ctx.fillStyle = "rgba(255,100,0,0.3)";
        ctx.beginPath(); ctx.arc(f.x + f.w / 2, f.y + f.h / 2, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FF4400";
        ctx.beginPath(); ctx.arc(f.x + f.w / 2, f.y + f.h / 2, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFAA00";
        ctx.beginPath(); ctx.arc(f.x + f.w / 2, f.y + f.h / 2, 3, 0, Math.PI * 2); ctx.fill();
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life / 30;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

function drawFloatingTexts() {
    for (const t of floatingTexts) {
        ctx.globalAlpha = t.life / 50;
        ctx.fillStyle = t.color;
        ctx.font = "bold 14px 'Courier New'"; ctx.textAlign = "center";
        ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
}

function drawActTransition() {
    if (actTransitionTimer <= 0) return;
    ctx.globalAlpha = Math.min(actTransitionTimer / 30, 1);
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, H / 2 - 40, W, 80);
    ctx.fillStyle = "#FFD700"; ctx.font = "bold 28px 'Courier New'"; ctx.textAlign = "center";
    ctx.fillText(actTransitionText, W / 2, H / 2 + 8);
    ctx.globalAlpha = 1;
}

function drawTree(x, groundY) {
    ctx.fillStyle = "#5C4033"; ctx.fillRect(x + 8, groundY - 40, 10, 40);
    ctx.fillStyle = "#2D6B22";
    ctx.beginPath(); ctx.arc(x + 13, groundY - 50, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3A8A30";
    ctx.beginPath(); ctx.arc(x + 8, groundY - 40, 16, 0, Math.PI * 2); ctx.fill();
}

function drawWeaponIndicator(currentAct) {
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(10, H - 56, 100, 22);
    ctx.fillStyle = "#FFF"; ctx.font = "12px 'Courier New'"; ctx.textAlign = "left";
    if (currentAct === 1) ctx.fillText("⚔️ Sword", 16, H - 40);
    else if (currentAct === 2) ctx.fillText("🏹 Bow", 16, H - 40);
    else ctx.fillText("⚔️+🏹 Both", 16, H - 40);
}

function updateHUD(currentAct, xpNext, nextActLabel) {
    if (!heartsEl) return;
    let h = "";
    for (let i = 0; i < lives; i++) h += "❤️";
    for (let i = lives; i < 3; i++) h += "🖤";
    heartsEl.textContent = h;
    if (actTitleEl) actTitleEl.textContent = nextActLabel || "";
    if (xpEl) {
        if (xpNext && xp < xpNext) {
            xpEl.textContent = `XP: ${xp} (${xpNext - xp} to next act)`;
        } else if (xpNext && xp >= xpNext) {
            xpEl.textContent = `XP: ${xp} → GO RIGHT!`;
        } else {
            xpEl.textContent = `XP: ${xp}`;
        }
    }
}

function drawExitIndicator() {
    if (Math.floor(Date.now() / 300) % 2 === 0) {
        ctx.fillStyle = "#FFD700"; ctx.font = "20px 'Courier New'"; ctx.textAlign = "center";
        ctx.fillText("→ EXIT →", W - 50, H / 2);
    }
}

// ═════════════════════════════════════════════════════════
//  FRAME-RATE CAPPED GAME LOOP  (target 60 FPS)
// ═════════════════════════════════════════════════════════
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;   // ≈ 8.33 ms

function startGameLoop(updateFn, drawFn) {
    let lastTime = 0;
    let accumulator = 0;

    function loop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const delta = timestamp - lastTime;
        lastTime = timestamp;

        // Clamp large deltas (e.g. tab was hidden)
        accumulator += Math.min(delta, 200);

        // Run fixed-step updates until we've caught up
        while (accumulator >= FRAME_TIME) {
            updateFn();
            accumulator -= FRAME_TIME;
        }

        drawFn();
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

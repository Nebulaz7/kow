// ============================================================
// 🗡️  KNIGHT OF WINTERFELL  –  Complete Game
// ============================================================

(function () {
    "use strict";

    // ── Canvas & Context ────────────────────────────────────
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    const W = canvas.width;   // 800
    const H = canvas.height;  // 500

    // ── HUD DOM refs ────────────────────────────────────────
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
    const TILE = 40;
    const XP_ACT2 = 100;   // xp needed to transition to Act 2
    const XP_ACT3 = 250;   // xp needed to transition to Act 3
    const DRACULA_HP = 30;

    // ── ZzFX Micro – tiny sound engine (public domain) ─────
    // Minimal version: zzfx(volume,freq,attack,sustain,release,shape,...)
    function zzfx(v = 1, f = 220, a = 0, s = 0, r = .1, shape = 0, fSlide = 0, fDelta = 0) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!zzfx.ctx) zzfx.ctx = new AC();
        const c = zzfx.ctx;
        const rate = c.sampleRate;
        const len = Math.max((a + s + r) * rate | 0, 1);
        const buf = c.createBuffer(1, len, rate);
        const data = buf.getChannelData(0);
        let freq = f, phase = 0, t;
        for (let i = 0; i < len; i++) {
            t = i / rate;
            let env = 1;
            if (t < a) env = t / a;
            else if (t < a + s) env = 1;
            else env = 1 - (t - a - s) / r;
            freq += fSlide + fDelta;
            phase += freq * 2 * Math.PI / rate;
            let sample;
            if (shape === 0) sample = Math.sin(phase);
            else if (shape === 1) sample = phase % (2 * Math.PI) < Math.PI ? 1 : -1;
            else sample = (phase % (2 * Math.PI)) / Math.PI - 1;
            data[i] = sample * env * v;
        }
        const src = c.createBufferSource();
        src.buffer = buf;
        src.connect(c.destination);
        src.start();
    }

    function sfxJump()   { zzfx(0.3, 500, 0, 0.05, 0.1, 0, 10); }
    function sfxHit()    { zzfx(0.4, 200, 0, 0.08, 0.15, 1, -5); }
    function sfxSword()  { zzfx(0.3, 800, 0, 0.03, 0.08, 2, -20); }
    function sfxArrow()  { zzfx(0.2, 1200, 0, 0.02, 0.06, 0, 30); }
    function sfxBoss()   { zzfx(0.5, 120, 0, 0.1, 0.3, 1, -2); }
    function sfxWin()    { zzfx(0.4, 600, 0, 0.2, 0.5, 0, 5); }
    function sfxDie()    { zzfx(0.5, 150, 0, 0.15, 0.4, 1, -10); }

    // ── Input ───────────────────────────────────────────────
    const keys = {};
    window.addEventListener("keydown", e => { keys[e.code] = true; });
    window.addEventListener("keyup", e => { keys[e.code] = false; });

    function keyLeft()  { return keys["ArrowLeft"]  || keys["KeyA"]; }
    function keyRight() { return keys["ArrowRight"] || keys["KeyD"]; }
    function keyUp()    { return keys["ArrowUp"]    || keys["KeyW"]; }
    function keyAttack(){ return keys["Space"]; }
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

    // ── Game State ──────────────────────────────────────────
    let act = 0;          // 0=title, 1,2,3 = acts, 4=win, -1=gameover
    let xp = 0;
    let lives = 3;
    let attackCooldown = 0;
    let actTransitionTimer = 0;
    let actTransitionText = "";
    let draculaDefeated = false;
    let gameStarted = false;

    // ── Particles ───────────────────────────────────────────
    let particles = [];
    function spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y,
                vx: rand(-3, 3),
                vy: rand(-4, 1),
                life: rand(15, 30),
                color,
                size: rand(2, 5)
            });
        }
    }

    // ── Floating text ───────────────────────────────────────
    let floatingTexts = [];
    function spawnFloatingText(x, y, text, color) {
        floatingTexts.push({ x, y, text, color, life: 50 });
    }

    // ── Player ──────────────────────────────────────────────
    const player = {
        x: 60, y: 0, w: 24, h: 36,
        vx: 0, vy: 0,
        onGround: false,
        facing: 1,     // 1=right, -1=left
        invincible: 0, // timer
        swordSwing: 0, // animation timer
        animFrame: 0,
        animTimer: 0
    };

    function resetPlayer() {
        player.x = 60; player.y = 0;
        player.vx = 0; player.vy = 0;
        player.onGround = false;
        player.invincible = 0;
        player.swordSwing = 0;
    }

    // ── Arrows (Act 2 & 3 projectile) ──────────────────────
    let arrows = [];
    function spawnArrow() {
        sfxArrow();
        arrows.push({
            x: player.x + (player.facing === 1 ? player.w : -8),
            y: player.y + 12,
            vx: player.facing * 9,
            w: 14, h: 3,
            life: 60
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
            w: 12, h: 12,
            life: 120
        });
    }

    // ── Platform / Level Data ───────────────────────────────
    // Each act has platforms as {x,y,w,h}
    // Level is 800 wide. Acts scroll or are single-screen.

    function generatePlatforms(actNum) {
        const p = [];
        // ground
        if (actNum === 1) {
            // Act 1 – green fields with pits
            p.push({ x: 0, y: H - 40, w: 250, h: 40 });
            p.push({ x: 300, y: H - 40, w: 180, h: 40 });
            p.push({ x: 530, y: H - 40, w: 270, h: 40 });
            // floating platforms
            p.push({ x: 130, y: 340, w: 90, h: 16 });
            p.push({ x: 320, y: 290, w: 100, h: 16 });
            p.push({ x: 520, y: 260, w: 90, h: 16 });
            p.push({ x: 680, y: 200, w: 90, h: 16 });
            // exit platform high-right
            p.push({ x: 730, y: 150, w: 70, h: 16 });
        } else if (actNum === 2) {
            // Act 2 – rocky terrain, more gaps
            p.push({ x: 0, y: H - 40, w: 160, h: 40 });
            p.push({ x: 210, y: H - 40, w: 120, h: 40 });
            p.push({ x: 400, y: H - 40, w: 100, h: 40 });
            p.push({ x: 570, y: H - 40, w: 110, h: 40 });
            p.push({ x: 720, y: H - 40, w: 80, h: 40 });
            // floating
            p.push({ x: 100, y: 340, w: 70, h: 16 });
            p.push({ x: 250, y: 280, w: 80, h: 16 });
            p.push({ x: 420, y: 230, w: 70, h: 16 });
            p.push({ x: 550, y: 310, w: 80, h: 16 });
            p.push({ x: 660, y: 190, w: 90, h: 16 });
            p.push({ x: 740, y: 130, w: 60, h: 16 });
        } else if (actNum === 3) {
            // Act 3 – boss room, flat arena
            p.push({ x: 0, y: H - 40, w: W, h: 40 });
            // side platforms
            p.push({ x: 50, y: 340, w: 100, h: 16 });
            p.push({ x: 650, y: 340, w: 100, h: 16 });
            p.push({ x: 300, y: 260, w: 200, h: 16 });
            p.push({ x: 100, y: 180, w: 120, h: 16 });
            p.push({ x: 580, y: 180, w: 120, h: 16 });
        }
        return p;
    }

    let platforms = [];

    // ── Enemies ─────────────────────────────────────────────
    let enemies = [];

    function spawnEnemies(actNum) {
        const e = [];
        if (actNum === 1) {
            // Slimes – patrol on ground
            e.push(makeSlime(180, H - 40 - 24));
            e.push(makeSlime(400, H - 40 - 24));
            e.push(makeSlime(600, H - 40 - 24));
            e.push(makeSlime(340, 290 - 24));
        } else if (actNum === 2) {
            // Flying bats + some slimes
            e.push(makeBat(200, 200));
            e.push(makeBat(450, 160));
            e.push(makeBat(650, 140));
            e.push(makeSlime(250, H - 40 - 24));
            e.push(makeSlime(580, H - 40 - 24));
            e.push(makeBat(120, 280));
        }
        // Act 3 has Dracula only
        return e;
    }

    function makeSlime(x, y) {
        return {
            type: "slime",
            x, y, w: 24, h: 24,
            vx: 1, hp: 2,
            patrolLeft: x - 60,
            patrolRight: x + 60,
            color: "#00FF00",
            xpValue: 15,
            flashTimer: 0,
            animTimer: 0
        };
    }

    function makeBat(x, y) {
        return {
            type: "bat",
            x, y, w: 26, h: 18,
            vx: 1.8, vy: 0,
            hp: 1,
            patrolLeft: x - 80,
            patrolRight: x + 80,
            baseY: y,
            color: "#AA44FF",
            xpValue: 20,
            flashTimer: 0,
            animTimer: 0
        };
    }

    // ── Dracula ─────────────────────────────────────────────
    const dracula = {
        x: 600, y: H - 40 - 56, w: 36, h: 56,
        hp: DRACULA_HP, maxHp: DRACULA_HP,
        vx: 0, vy: 0,
        phase: "idle",  // idle, teleport, attack, stunned
        timer: 0,
        teleportCooldown: 0,
        attackCooldown: 0,
        flashTimer: 0,
        active: false,
        invincible: 0
    };

    function resetDracula() {
        dracula.x = 600;
        dracula.y = H - 40 - 56;
        dracula.hp = DRACULA_HP;
        dracula.phase = "idle";
        dracula.timer = 0;
        dracula.teleportCooldown = 120;
        dracula.attackCooldown = 80;
        dracula.flashTimer = 0;
        dracula.active = true;
        dracula.invincible = 0;
    }

    // ── Princess ────────────────────────────────────────────
    const princess = { x: 700, y: H - 40 - 36, w: 20, h: 36, visible: false };

    // ── Stars (background) ──────────────────────────────────
    let stars = [];
    function generateStars() {
        stars = [];
        for (let i = 0; i < 80; i++) {
            stars.push({ x: rand(0, W), y: rand(0, H - 60), s: rand(1, 3), b: rand(0.3, 1) });
        }
    }
    generateStars();

    // ── Clouds (Act 1 & 2) ──────────────────────────────────
    let clouds = [];
    function generateClouds() {
        clouds = [];
        for (let i = 0; i < 5; i++) {
            clouds.push({ x: rand(0, W), y: rand(20, 120), w: rand(60, 120), speed: rand(0.15, 0.4) });
        }
    }
    generateClouds();

    // ═════════════════════════════════════════════════════════
    //  GAME INITIALIZATION
    // ═════════════════════════════════════════════════════════
    function startAct(actNum) {
        act = actNum;
        platforms = generatePlatforms(actNum);
        enemies = spawnEnemies(actNum);
        arrows = [];
        fireballs = [];
        particles = [];
        floatingTexts = [];
        resetPlayer();
        princess.visible = false;
        dracula.active = false;

        if (actNum === 3) {
            resetDracula();
        }

        // Show act title
        actTransitionTimer = 90;
        if (actNum === 1) actTransitionText = "Act I: The Morning";
        else if (actNum === 2) actTransitionText = "Act II: The Evening";
        else if (actNum === 3) actTransitionText = "Act III: The Night";
    }

    function startGame() {
        xp = 0;
        lives = 3;
        draculaDefeated = false;
        gameStarted = true;
        hideOverlay();
        startAct(1);
    }

    function gameOver() {
        act = -1;
        sfxDie();
        showOverlay("GAME OVER", "The kingdom falls into darkness...", "Press R or Space to Restart");
    }

    function winGame() {
        act = 4;
        draculaDefeated = true;
        sfxWin();
        showOverlay("VICTORY!", "You have rescued the Princess and slain Dracula!\nThe kingdom honors you, brave knight.", "Press R or Space to Play Again");
    }

    // ── Overlays ────────────────────────────────────────────
    function showOverlay(title, sub, prompt) {
        overlayTitle.textContent = title;
        overlaySub.textContent = sub;
        overlayPrompt.textContent = prompt;
        overlay.classList.add("visible");
    }

    function hideOverlay() {
        overlay.classList.remove("visible");
    }

    // Show title screen on load
    showOverlay(
        "Knight of Winterfell",
        "Rescue the Princess from Dracula's clutches.\nNavigate three acts of peril to earn your honor.",
        "Press Space to Begin"
    );

    // ═════════════════════════════════════════════════════════
    //  PLAYER UPDATE
    // ═════════════════════════════════════════════════════════
    function updatePlayer() {
        // Horizontal movement
        if (keyLeft())  { player.vx -= PLAYER_SPEED * 0.4; player.facing = -1; }
        if (keyRight()) { player.vx += PLAYER_SPEED * 0.4; player.facing = 1; }

        // Jump
        if (keyUp() && player.onGround) {
            player.vy = JUMP_FORCE;
            player.onGround = false;
            sfxJump();
        }

        // Attack
        if (attackCooldown > 0) attackCooldown--;
        if (keyAttack() && attackCooldown <= 0) {
            if (act === 1) {
                // Sword
                player.swordSwing = 12;
                attackCooldown = 18;
                sfxSword();
            } else if (act === 2 || act === 3) {
                // Bow (also sword in act 3)
                if (act === 3 && player.swordSwing <= 0) {
                    // Alternate: swing sword every other press
                    // Simple: always shoot arrow, also allow sword
                }
                spawnArrow();
                attackCooldown = 14;
                // In act 3 also swing sword
                if (act === 3) {
                    player.swordSwing = 10;
                }
            }
        }

        // Physics
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
                // Landing on top
                if (player.vy > 0 && player.y + player.h - player.vy <= p.y + 4) {
                    player.y = p.y - player.h;
                    player.vy = 0;
                    player.onGround = true;
                }
                // Hitting bottom
                else if (player.vy < 0 && player.y - player.vy >= p.y + p.h - 4) {
                    player.y = p.y + p.h;
                    player.vy = 0;
                }
                // Side collision
                else if (player.vx > 0 && player.x + player.w - player.vx <= p.x + 2) {
                    player.x = p.x - player.w;
                    player.vx = 0;
                } else if (player.vx < 0 && player.x - player.vx >= p.x + p.w - 2) {
                    player.x = p.x + p.w;
                    player.vx = 0;
                }
            }
        }

        // Screen bounds
        if (player.x < 0) { player.x = 0; player.vx = 0; }
        if (player.x + player.w > W) { player.x = W - player.w; player.vx = 0; }

        // Pit death
        if (player.y > H + 40) {
            hurtPlayer(true);
        }

        // Animation
        player.animTimer++;
        if (player.animTimer > 8) { player.animTimer = 0; player.animFrame = (player.animFrame + 1) % 4; }

        // ── Act transitions via screen edge or XP ───────────
        if (act === 1 && xp >= XP_ACT2 && player.x + player.w >= W - 5) {
            startAct(2);
        }
        if (act === 2 && xp >= XP_ACT3 && player.x + player.w >= W - 5) {
            startAct(3);
        }
    }

    function hurtPlayer(isPit) {
        if (player.invincible > 0 && !isPit) return;
        lives--;
        sfxHit();
        triggerShake(12, 5);
        if (lives <= 0) {
            gameOver();
            return;
        }
        player.invincible = 60;
        if (isPit) {
            resetPlayer();
        }
        spawnParticles(player.x + player.w / 2, player.y + player.h / 2, "#FF4444", 10);
    }

    // ═════════════════════════════════════════════════════════
    //  SWORD HITBOX
    // ═════════════════════════════════════════════════════════
    function getSwordHitbox() {
        if (player.swordSwing <= 0) return null;
        const sw = 30, sh = 20;
        return {
            x: player.facing === 1 ? player.x + player.w : player.x - sw,
            y: player.y + 6,
            w: sw, h: sh
        };
    }

    // ═════════════════════════════════════════════════════════
    //  ENEMY UPDATE
    // ═════════════════════════════════════════════════════════
    function updateEnemies() {
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

            // Sword hit
            if (sword && aabb(sword, e)) {
                e.hp--;
                e.flashTimer = 6;
                triggerShake(5, 3);
                spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.color, 6);
                if (e.hp <= 0) {
                    xp += e.xpValue;
                    spawnFloatingText(e.x, e.y - 10, "+" + e.xpValue + " XP", "#FFD700");
                    spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.color, 12);
                    sfxHit();
                    enemies.splice(i, 1);
                    continue;
                }
            }

            // Arrow hit
            for (let j = arrows.length - 1; j >= 0; j--) {
                if (aabb(arrows[j], e)) {
                    e.hp--;
                    e.flashTimer = 6;
                    arrows.splice(j, 1);
                    triggerShake(4, 2);
                    spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.color, 6);
                    if (e.hp <= 0) {
                        xp += e.xpValue;
                        spawnFloatingText(e.x, e.y - 10, "+" + e.xpValue + " XP", "#FFD700");
                        spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.color, 12);
                        sfxHit();
                        enemies.splice(i, 1);
                        break;
                    }
                }
            }

            // Hurt player
            if (e && aabb(player, e) && player.invincible <= 0) {
                hurtPlayer(false);
            }
        }
    }

    // ═════════════════════════════════════════════════════════
    //  DRACULA AI
    // ═════════════════════════════════════════════════════════
    function updateDracula() {
        if (!dracula.active) return;
        const d = dracula;
        if (d.flashTimer > 0) d.flashTimer--;
        if (d.invincible > 0) d.invincible--;
        d.timer++;

        // Teleport cooldown
        if (d.teleportCooldown > 0) d.teleportCooldown--;
        if (d.attackCooldown > 0) d.attackCooldown--;

        if (d.phase === "idle") {
            // Move toward player slowly
            const dx = player.x - d.x;
            d.x += Math.sign(dx) * 1.0;

            // Teleport
            if (d.teleportCooldown <= 0 && Math.random() < 0.015) {
                d.phase = "teleport";
                d.timer = 0;
                d.teleportCooldown = 150;
                spawnParticles(d.x + d.w / 2, d.y + d.h / 2, "#FF0000", 15);
                sfxBoss();
            }
            // Attack
            if (d.attackCooldown <= 0 && Math.random() < 0.02) {
                d.phase = "attack";
                d.timer = 0;
                d.attackCooldown = 90;
            }
        }
        else if (d.phase === "teleport") {
            if (d.timer === 15) {
                // Teleport to random platform
                const pList = platforms.filter(p => p.h <= 20);  // floating platforms
                if (pList.length > 0) {
                    const tp = pList[Math.floor(Math.random() * pList.length)];
                    d.x = tp.x + tp.w / 2 - d.w / 2;
                    d.y = tp.y - d.h;
                } else {
                    d.x = rand(100, W - 150);
                    d.y = H - 40 - d.h;
                }
                spawnParticles(d.x + d.w / 2, d.y + d.h / 2, "#FF0000", 15);
            }
            if (d.timer > 30) d.phase = "idle";
        }
        else if (d.phase === "attack") {
            if (d.timer === 10) {
                spawnFireball(d.x + d.w / 2, d.y + 10, player.x + player.w / 2, player.y + player.h / 2);
                sfxBoss();
            }
            if (d.timer === 30 && d.hp < d.maxHp * 0.5) {
                // Phase 2: double fireball
                spawnFireball(d.x + d.w / 2, d.y + 10, player.x + player.w / 2 + 40, player.y);
                spawnFireball(d.x + d.w / 2, d.y + 10, player.x + player.w / 2 - 40, player.y);
            }
            if (d.timer > 40) d.phase = "idle";
        }

        // Gravity
        d.vy = d.vy || 0;
        d.vy += GRAVITY * 0.8;
        d.y += d.vy;
        for (const p of platforms) {
            if (aabb(d, p) && d.vy > 0 && d.y + d.h - d.vy <= p.y + 4) {
                d.y = p.y - d.h;
                d.vy = 0;
            }
        }
        if (d.y > H) { d.y = 100; d.vy = 0; } // safety

        // Sword hit
        const sword = getSwordHitbox();
        if (sword && aabb(sword, d) && d.invincible <= 0) {
            d.hp -= 2;
            d.flashTimer = 8;
            d.invincible = 20;
            triggerShake(8, 5);
            spawnParticles(d.x + d.w / 2, d.y + d.h / 2, "#FF0000", 10);
            sfxHit();
        }

        // Arrow hit
        for (let j = arrows.length - 1; j >= 0; j--) {
            if (aabb(arrows[j], d) && d.invincible <= 0) {
                d.hp -= 1;
                d.flashTimer = 8;
                d.invincible = 15;
                arrows.splice(j, 1);
                triggerShake(5, 3);
                spawnParticles(d.x + d.w / 2, d.y + d.h / 2, "#FF0000", 8);
                sfxHit();
            }
        }

        // Hurt player
        if (aabb(player, d) && player.invincible <= 0) {
            hurtPlayer(false);
        }

        // Death
        if (d.hp <= 0) {
            d.active = false;
            spawnParticles(d.x + d.w / 2, d.y + d.h / 2, "#FF0000", 30);
            spawnFloatingText(d.x, d.y - 20, "DRACULA DEFEATED!", "#FFD700");
            xp += 100;
            sfxWin();
            triggerShake(20, 8);
            // Show princess
            princess.visible = true;
            princess.x = d.x;
            princess.y = H - 40 - princess.h;
        }
    }

    // ═════════════════════════════════════════════════════════
    //  PROJECTILE UPDATES
    // ═════════════════════════════════════════════════════════
    function updateArrows() {
        for (let i = arrows.length - 1; i >= 0; i--) {
            const a = arrows[i];
            a.x += a.vx;
            a.life--;
            if (a.life <= 0 || a.x < -20 || a.x > W + 20) {
                arrows.splice(i, 1);
            }
        }
    }

    function updateFireballs() {
        for (let i = fireballs.length - 1; i >= 0; i--) {
            const f = fireballs[i];
            f.x += f.vx;
            f.y += f.vy;
            f.life--;
            if (f.life <= 0 || f.x < -20 || f.x > W + 20 || f.y > H + 20) {
                fireballs.splice(i, 1);
                continue;
            }
            // Hit player
            if (aabb(f, player) && player.invincible <= 0) {
                hurtPlayer(false);
                fireballs.splice(i, 1);
            }
        }
    }

    // ═════════════════════════════════════════════════════════
    //  PARTICLES & FLOATING TEXT
    // ═════════════════════════════════════════════════════════
    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.12;
            p.life--;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function updateFloatingTexts() {
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            const t = floatingTexts[i];
            t.y -= 0.8;
            t.life--;
            if (t.life <= 0) floatingTexts.splice(i, 1);
        }
    }

    // ═════════════════════════════════════════════════════════
    //  PRINCESS COLLISION (WIN)
    // ═════════════════════════════════════════════════════════
    function updatePrincess() {
        if (!princess.visible) return;
        if (aabb(player, princess)) {
            winGame();
        }
    }

    // ═════════════════════════════════════════════════════════
    //  DRAWING
    // ═════════════════════════════════════════════════════════

    // ── Backgrounds ─────────────────────────────────────────
    function drawBackground() {
        if (act === 1) {
            // Sky blue gradient
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, "#87CEEB");
            grad.addColorStop(1, "#C6E8C6");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
            // Clouds
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            for (const c of clouds) {
                c.x += c.speed;
                if (c.x > W + 60) c.x = -c.w;
                drawCloud(c.x, c.y, c.w);
            }
            // Sun
            ctx.fillStyle = "#FFE066";
            ctx.beginPath();
            ctx.arc(680, 60, 35, 0, Math.PI * 2);
            ctx.fill();
        } else if (act === 2) {
            // Sunset
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, "#FF6B35");
            grad.addColorStop(0.4, "#FF8C61");
            grad.addColorStop(1, "#4A2040");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
            // Sun setting
            ctx.fillStyle = "#FF4500";
            ctx.beginPath();
            ctx.arc(400, H - 60, 45, 0, Math.PI * 2);
            ctx.fill();
            // distant mountains
            ctx.fillStyle = "#3A1535";
            ctx.beginPath();
            ctx.moveTo(0, H - 80);
            ctx.lineTo(150, H - 180);
            ctx.lineTo(300, H - 100);
            ctx.lineTo(450, H - 200);
            ctx.lineTo(600, H - 120);
            ctx.lineTo(750, H - 170);
            ctx.lineTo(W, H - 90);
            ctx.lineTo(W, H);
            ctx.lineTo(0, H);
            ctx.fill();
        } else if (act === 3) {
            // Night / Gothic
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, "#0A0A2E");
            grad.addColorStop(1, "#1A1A3E");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
            // Stars
            for (const s of stars) {
                const flicker = 0.7 + Math.sin(Date.now() * 0.003 + s.x) * 0.3;
                ctx.fillStyle = `rgba(255,255,255,${s.b * flicker})`;
                ctx.fillRect(s.x, s.y, s.s, s.s);
            }
            // Moon
            ctx.fillStyle = "#EEEEDD";
            ctx.beginPath();
            ctx.arc(120, 60, 28, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#0A0A2E";
            ctx.beginPath();
            ctx.arc(132, 52, 24, 0, Math.PI * 2);
            ctx.fill();
            // Castle silhouette
            drawCastleSilhouette();
        }
    }

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
        // left tower
        ctx.fillRect(560, 60, 30, H - 100);
        ctx.fillRect(550, 50, 50, 20);
        // crenellations
        for (let i = 0; i < 5; i++) ctx.fillRect(550 + i * 10, 40, 6, 14);
        // right tower
        ctx.fillRect(720, 80, 30, H - 120);
        ctx.fillRect(710, 70, 50, 20);
        for (let i = 0; i < 5; i++) ctx.fillRect(710 + i * 10, 60, 6, 14);
        // middle wall
        ctx.fillRect(590, 130, 130, H - 170);
        // gate
        ctx.fillStyle = "#1A1A3E";
        ctx.fillRect(640, H - 100, 40, 60);
        // arch
        ctx.fillStyle = "#0D0D1A";
        ctx.beginPath();
        ctx.arc(660, H - 100, 20, Math.PI, 0);
        ctx.fill();
    }

    // ── Platforms ────────────────────────────────────────────
    function drawPlatforms() {
        for (const p of platforms) {
            if (p.h >= 40) {
                // Ground
                if (act === 1) {
                    ctx.fillStyle = "#4A8C3F";
                    ctx.fillRect(p.x, p.y, p.w, 8);
                    ctx.fillStyle = "#6B4226";
                    ctx.fillRect(p.x, p.y + 8, p.w, p.h - 8);
                } else if (act === 2) {
                    ctx.fillStyle = "#8B6914";
                    ctx.fillRect(p.x, p.y, p.w, 6);
                    ctx.fillStyle = "#5C4033";
                    ctx.fillRect(p.x, p.y + 6, p.w, p.h - 6);
                } else {
                    ctx.fillStyle = "#3A3A5C";
                    ctx.fillRect(p.x, p.y, p.w, 6);
                    ctx.fillStyle = "#2A2A3E";
                    ctx.fillRect(p.x, p.y + 6, p.w, p.h - 6);
                }
            } else {
                // Floating platforms
                if (act === 1) ctx.fillStyle = "#7B5B3A";
                else if (act === 2) ctx.fillStyle = "#8B7355";
                else ctx.fillStyle = "#4A4A6C";
                ctx.fillRect(p.x, p.y, p.w, p.h);
                // highlight
                ctx.fillStyle = "rgba(255,255,255,0.15)";
                ctx.fillRect(p.x, p.y, p.w, 3);
            }
        }
    }

    // ── Player Drawing ──────────────────────────────────────
    function drawPlayer() {
        if (player.invincible > 0 && Math.floor(player.invincible / 3) % 2 === 0) return;

        const px = player.x, py = player.y;
        const f = player.facing;

        ctx.save();
        ctx.translate(px + player.w / 2, py + player.h / 2);
        ctx.scale(f, 1);
        ctx.translate(-(player.w / 2), -(player.h / 2));

        // Body
        ctx.fillStyle = "#4488CC";
        ctx.fillRect(2, 12, 20, 16);

        // Helmet / head
        ctx.fillStyle = "#AAAAAA";
        ctx.fillRect(4, 0, 16, 14);
        // Visor
        ctx.fillStyle = "#333";
        ctx.fillRect(14, 4, 6, 6);

        // Legs (animated)
        ctx.fillStyle = "#335577";
        const legOffset = player.onGround ? Math.sin(player.animTimer * 0.7) * 3 : 0;
        ctx.fillRect(4, 28, 7, 8 + legOffset);
        ctx.fillRect(13, 28, 7, 8 - legOffset);

        // Arm / weapon
        if (player.swordSwing > 0) {
            // Sword swing animation
            ctx.fillStyle = "#CCCCCC";
            const swingAngle = (player.swordSwing / 12) * Math.PI * 0.6 - 0.3;
            ctx.save();
            ctx.translate(18, 16);
            ctx.rotate(-swingAngle);
            ctx.fillRect(0, -2, 26, 4);
            // Sword tip
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(22, -3, 6, 6);
            ctx.restore();
        } else {
            // Arm
            ctx.fillStyle = "#4488CC";
            ctx.fillRect(16, 14, 6, 10);
        }

        ctx.restore();

        // ── Draw sword hitbox debug (off) ───────────────────
        // const sb = getSwordHitbox();
        // if (sb) { ctx.strokeStyle="red"; ctx.strokeRect(sb.x,sb.y,sb.w,sb.h); }
    }

    // ── Enemies Drawing ─────────────────────────────────────
    function drawEnemies() {
        for (const e of enemies) {
            ctx.save();
            if (e.flashTimer > 0) {
                ctx.fillStyle = "#FFFFFF";
            } else {
                ctx.fillStyle = e.color;
            }

            if (e.type === "slime") {
                // Blobby slime
                const squish = 1 + Math.sin(e.animTimer * 0.15) * 0.1;
                const w2 = e.w * squish;
                const h2 = e.h / squish;
                ctx.fillRect(e.x - (w2 - e.w) / 2, e.y + (e.h - h2), w2, h2);
                // Eyes
                ctx.fillStyle = "#000";
                ctx.fillRect(e.x + 5, e.y + 6, 4, 4);
                ctx.fillRect(e.x + 14, e.y + 6, 4, 4);
            } else if (e.type === "bat") {
                // Body
                ctx.fillRect(e.x + 8, e.y + 4, 10, 10);
                // Wings
                const wingFlap = Math.sin(e.animTimer * 0.3) * 5;
                ctx.fillRect(e.x, e.y + 2 + wingFlap, 10, 6);
                ctx.fillRect(e.x + 16, e.y + 2 - wingFlap, 10, 6);
                // Eyes
                ctx.fillStyle = "#FF0000";
                ctx.fillRect(e.x + 10, e.y + 6, 2, 2);
                ctx.fillRect(e.x + 15, e.y + 6, 2, 2);
            }
            ctx.restore();
        }
    }

    // ── Dracula Drawing ─────────────────────────────────────
    function drawDracula() {
        if (!dracula.active) return;
        const d = dracula;
        if (d.flashTimer > 0 && Math.floor(d.flashTimer / 2) % 2 === 0) {
            ctx.fillStyle = "#FFFFFF";
        } else {
            ctx.fillStyle = "#FF0000";
        }

        // Phase teleport: flickering
        if (d.phase === "teleport" && d.timer < 15) {
            if (Math.floor(d.timer / 2) % 2 === 0) return; // blink
        }

        const dx = d.x, dy = d.y;

        // Cape
        ctx.fillStyle = d.flashTimer > 0 ? "#FFFFFF" : "#880000";
        ctx.beginPath();
        ctx.moveTo(dx - 4, dy + 10);
        ctx.lineTo(dx + d.w + 4, dy + 10);
        ctx.lineTo(dx + d.w + 8, dy + d.h);
        ctx.lineTo(dx - 8, dy + d.h);
        ctx.fill();

        // Body
        ctx.fillStyle = d.flashTimer > 0 ? "#FFFFFF" : "#222";
        ctx.fillRect(dx + 4, dy + 8, d.w - 8, d.h - 16);

        // Head
        ctx.fillStyle = d.flashTimer > 0 ? "#FFFFFF" : "#DDCCCC";
        ctx.fillRect(dx + 8, dy, 20, 16);

        // Eyes
        ctx.fillStyle = "#FF0000";
        ctx.fillRect(dx + 12, dy + 5, 4, 4);
        ctx.fillRect(dx + 20, dy + 5, 4, 4);

        // Fangs
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(dx + 14, dy + 13, 2, 4);
        ctx.fillRect(dx + 20, dy + 13, 2, 4);

        // HP bar
        const barW = 60, barH = 6;
        const barX = dx + d.w / 2 - barW / 2;
        const barY = dy - 14;
        ctx.fillStyle = "#333";
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = "#FF0000";
        ctx.fillRect(barX, barY, barW * (d.hp / d.maxHp), barH);
        ctx.strokeStyle = "#000";
        ctx.strokeRect(barX, barY, barW, barH);
    }

    // ── Princess Drawing ────────────────────────────────────
    function drawPrincess() {
        if (!princess.visible) return;
        const p = princess;
        // Dress
        ctx.fillStyle = "#FFFF00";
        ctx.fillRect(p.x + 2, p.y + 14, 16, 22);
        // Body
        ctx.fillStyle = "#FFD700";
        ctx.fillRect(p.x + 4, p.y + 10, 12, 10);
        // Head
        ctx.fillStyle = "#FFCCAA";
        ctx.fillRect(p.x + 4, p.y, 12, 12);
        // Crown
        ctx.fillStyle = "#FFD700";
        ctx.fillRect(p.x + 4, p.y - 4, 12, 5);
        ctx.fillRect(p.x + 5, p.y - 7, 3, 4);
        ctx.fillRect(p.x + 9, p.y - 8, 3, 5);
        ctx.fillRect(p.x + 13, p.y - 7, 3, 4);
        // Eyes
        ctx.fillStyle = "#000";
        ctx.fillRect(p.x + 6, p.y + 3, 2, 2);
        ctx.fillRect(p.x + 12, p.y + 3, 2, 2);

        // "Save me!" bobbing text
        ctx.fillStyle = "#FFD700";
        ctx.font = "10px 'Courier New'";
        ctx.textAlign = "center";
        const bob = Math.sin(Date.now() * 0.005) * 3;
        ctx.fillText("Help me!", p.x + p.w / 2, p.y - 14 + bob);
    }

    // ── Arrows Drawing ──────────────────────────────────────
    function drawArrows() {
        ctx.fillStyle = "#FFDD44";
        for (const a of arrows) {
            ctx.save();
            ctx.translate(a.x + a.w / 2, a.y + a.h / 2);
            if (a.vx < 0) ctx.scale(-1, 1);
            // Shaft
            ctx.fillRect(-a.w / 2, -1, a.w, 2);
            // Head
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.moveTo(a.w / 2, -3);
            ctx.lineTo(a.w / 2 + 5, 0);
            ctx.lineTo(a.w / 2, 3);
            ctx.fill();
            ctx.fillStyle = "#FFDD44";
            ctx.restore();
        }
    }

    // ── Fireballs Drawing ───────────────────────────────────
    function drawFireballs() {
        for (const f of fireballs) {
            // Glow
            ctx.fillStyle = "rgba(255, 100, 0, 0.3)";
            ctx.beginPath();
            ctx.arc(f.x + f.w / 2, f.y + f.h / 2, 12, 0, Math.PI * 2);
            ctx.fill();
            // Core
            ctx.fillStyle = "#FF4400";
            ctx.beginPath();
            ctx.arc(f.x + f.w / 2, f.y + f.h / 2, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#FFAA00";
            ctx.beginPath();
            ctx.arc(f.x + f.w / 2, f.y + f.h / 2, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ── Particles Drawing ───────────────────────────────────
    function drawParticles() {
        for (const p of particles) {
            const alpha = p.life / 30;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }

    // ── Floating Text Drawing ───────────────────────────────
    function drawFloatingTexts() {
        for (const t of floatingTexts) {
            const alpha = t.life / 50;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = t.color;
            ctx.font = "bold 14px 'Courier New'";
            ctx.textAlign = "center";
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.globalAlpha = 1;
    }

    // ── Act transition banner ───────────────────────────────
    function drawActTransition() {
        if (actTransitionTimer <= 0) return;
        const alpha = Math.min(actTransitionTimer / 30, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, H / 2 - 40, W, 80);
        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 28px 'Courier New'";
        ctx.textAlign = "center";
        ctx.fillText(actTransitionText, W / 2, H / 2 + 8);
        ctx.globalAlpha = 1;
    }

    // ── XP bar / indicator near right edge ──────────────────
    function drawXPIndicator() {
        if (act === 1 && xp < XP_ACT2) {
            // show arrow pointing right when enough XP
        } else if (act === 1 && xp >= XP_ACT2) {
            // blinking arrow at right edge
            if (Math.floor(Date.now() / 300) % 2 === 0) {
                ctx.fillStyle = "#FFD700";
                ctx.font = "20px 'Courier New'";
                ctx.textAlign = "center";
                ctx.fillText("→ EXIT →", W - 50, H / 2);
            }
        }
        if (act === 2 && xp >= XP_ACT3) {
            if (Math.floor(Date.now() / 300) % 2 === 0) {
                ctx.fillStyle = "#FFD700";
                ctx.font = "20px 'Courier New'";
                ctx.textAlign = "center";
                ctx.fillText("→ EXIT →", W - 50, H / 2);
            }
        }
    }

    // ── Decorations ─────────────────────────────────────────
    function drawDecorations() {
        if (act === 1) {
            // Trees
            drawTree(30, H - 40);
            drawTree(500, H - 40);
            drawTree(700, H - 40);
            // Grass tufts
            ctx.fillStyle = "#3A7A30";
            for (let x = 10; x < W; x += 35) {
                ctx.fillRect(x, H - 42, 2, 6);
                ctx.fillRect(x + 4, H - 44, 2, 8);
                ctx.fillRect(x + 8, H - 41, 2, 5);
            }
        } else if (act === 2) {
            // Rocks
            ctx.fillStyle = "#5A4A3A";
            ctx.beginPath(); ctx.arc(80, H - 44, 10, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(350, H - 44, 8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(650, H - 42, 12, 0, Math.PI * 2); ctx.fill();
        }
        // Act 3 decorations are in the background (castle)
    }

    function drawTree(x, groundY) {
        // Trunk
        ctx.fillStyle = "#5C4033";
        ctx.fillRect(x + 8, groundY - 40, 10, 40);
        // Canopy
        ctx.fillStyle = "#2D6B22";
        ctx.beginPath();
        ctx.arc(x + 13, groundY - 50, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3A8A30";
        ctx.beginPath();
        ctx.arc(x + 8, groundY - 40, 16, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── HUD Update ──────────────────────────────────────────
    function updateHUD() {
        let h = "";
        for (let i = 0; i < lives; i++) h += "❤️";
        for (let i = lives; i < 3; i++) h += "🖤";
        heartsEl.textContent = h;

        if (act === 1) {
            actTitleEl.textContent = "ACT I: THE MORNING";
            const needed = XP_ACT2 - xp;
            xpEl.textContent = `XP: ${xp} ${needed > 0 ? `(${needed} to Act II)` : "→ GO RIGHT!"}`;
        } else if (act === 2) {
            actTitleEl.textContent = "ACT II: THE EVENING";
            const needed = XP_ACT3 - xp;
            xpEl.textContent = `XP: ${xp} ${needed > 0 ? `(${needed} to Act III)` : "→ GO RIGHT!"}`;
        } else if (act === 3) {
            actTitleEl.textContent = "ACT III: THE NIGHT";
            xpEl.textContent = `XP: ${xp}`;
        } else {
            actTitleEl.textContent = "";
            xpEl.textContent = "";
        }
    }

    // ── Weapon indicator ────────────────────────────────────
    function drawWeaponIndicator() {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(10, H - 56, 100, 22);
        ctx.fillStyle = "#FFF";
        ctx.font = "12px 'Courier New'";
        ctx.textAlign = "left";
        if (act === 1) ctx.fillText("⚔️ Sword", 16, H - 40);
        else if (act === 2) ctx.fillText("🏹 Bow", 16, H - 40);
        else if (act === 3) ctx.fillText("⚔️+🏹 Both", 16, H - 40);
    }

    // ═════════════════════════════════════════════════════════
    //  MAIN GAME LOOP
    // ═════════════════════════════════════════════════════════
    function update() {
        // Title / game over / win screens
        if (!gameStarted || act === -1 || act === 4) {
            if (keyAttack() || keyRestart()) {
                startGame();
            }
            return;
        }

        // Quick restart
        if (keyRestart()) {
            startGame();
            return;
        }

        updatePlayer();
        updateEnemies();
        updateDracula();
        updateArrows();
        updateFireballs();
        updateParticles();
        updateFloatingTexts();
        updatePrincess();

        if (actTransitionTimer > 0) actTransitionTimer--;
        if (shakeTimer > 0) shakeTimer--;
    }

    function draw() {
        ctx.save();

        // Screen shake
        if (shakeTimer > 0) {
            const ox = (Math.random() - 0.5) * shakeMag * 2;
            const oy = (Math.random() - 0.5) * shakeMag * 2;
            ctx.translate(ox, oy);
        }

        // Clear
        ctx.clearRect(-10, -10, W + 20, H + 20);

        if (act >= 1 && act <= 3) {
            drawBackground();
            drawDecorations();
            drawPlatforms();
            drawEnemies();
            drawDracula();
            drawPrincess();
            drawArrows();
            drawFireballs();
            drawPlayer();
            drawParticles();
            drawFloatingTexts();
            drawActTransition();
            drawXPIndicator();
            drawWeaponIndicator();
            updateHUD();
        } else {
            // Title / gameover / win background
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, "#0A0A2E");
            grad.addColorStop(1, "#1A1A3E");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
            for (const s of stars) {
                const flicker = 0.7 + Math.sin(Date.now() * 0.003 + s.x) * 0.3;
                ctx.fillStyle = `rgba(255,255,255,${s.b * flicker})`;
                ctx.fillRect(s.x, s.y, s.s, s.s);
            }
            heartsEl.textContent = "";
            actTitleEl.textContent = "";
            xpEl.textContent = "";
        }

        ctx.restore();
    }

    // ── RAF Loop ────────────────────────────────────────────
    function gameLoop() {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);

})();

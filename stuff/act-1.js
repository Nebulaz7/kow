// ═══════════════════════════════════════════════════════════
// ⚔️  ACT-1.JS – The Morning of Trials
// ═══════════════════════════════════════════════════════════
const ACT = 1;
const XP_NEEDED = 45;   // XP    to unlock exit to Act 2

window.launchActGame = function () {
    "use strict";

    // Reset state for Act 1 (fresh game)
    resetState();
 
    // ── Level layout ────────────────────────────────────
    platforms = [
        // Ground segments with pits
        { x: 0,   y: H - 40, w: 250, h: 40 },
        { x: 300, y: H - 40, w: 180, h: 40 },
        { x: 530, y: H - 40, w: 270, h: 40 },
        // Floating platforms
        { x: 130, y: 340, w: 90,  h: 16 },
        { x: 320, y: 290, w: 100, h: 16 },
        { x: 520, y: 260, w: 90,  h: 16 },
        { x: 680, y: 200, w: 90,  h: 16 },
        { x: 730, y: 150, w: 70,  h: 16 }
    ];

    // ── Enemies ─────────────────────────────────────────
    enemies = [
        makeSlime(180, H - 40 - 24),
        makeSlime(400, H - 40 - 24),
        makeSlime(600, H - 40 - 24),
        makeSlime(340, 290 - 24)
    ];

    // ── Init ────────────────────────────────────────────
    arrows = [];
    fireballs = [];
    particles = [];
    floatingTexts = [];
    resetPlayer();

    actTransitionTimer = 90;
    actTransitionText = "Act I: The Morning";

    let gameOver = false;
    let exiting = false;

    function onGameOver() {
        gameOver = true;
        sfxDie();
        showOverlay("GAME OVER", "The kingdom falls into darkness...", "Press R to Restart");
    }

    function onExitRight() {
        if (xp >= XP_NEEDED && !exiting) {
            exiting = true;
            saveState();
            // Fade out then go to Act 2
            document.body.style.transition = "opacity 0.6s";
            document.body.style.opacity = "0";
            setTimeout(() => { window.location.href = "act-2.html"; }, 700);
        }
    }

    // ── Background ──────────────────────────────────────
    function drawBackground() {
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
        ctx.beginPath(); ctx.arc(680, 60, 35, 0, Math.PI * 2); ctx.fill();
    }

    function drawDecorations() {
        drawTree(30, H - 40);
        drawTree(500, H - 40);
        drawTree(700, H - 40);
        ctx.fillStyle = "#3A7A30";
        for (let x = 10; x < W; x += 35) {
            ctx.fillRect(x, H - 42, 2, 6);
            ctx.fillRect(x + 4, H - 44, 2, 8);
            ctx.fillRect(x + 8, H - 41, 2, 5);
        }
    }

    // ── Game Loop ───────────────────────────────────────
    function update() {
        if (gameOver) {
            if (keyRestart()) window.location.reload();
            return;
        }
        if (keyRestart()) window.location.reload();

        updatePlayerPhysics(ACT, onGameOver, xp >= XP_NEEDED ? onExitRight : null);
        updateEnemies(onGameOver);
        updateArrows();
        updateParticles();
        updateFloatingTexts();

        if (actTransitionTimer > 0) actTransitionTimer--;
        if (shakeTimer > 0) shakeTimer--;
    }

    function draw() {
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate((Math.random() - 0.5) * shakeMag * 2, (Math.random() - 0.5) * shakeMag * 2);
        }
        ctx.clearRect(-10, -10, W + 20, H + 20);

        drawBackground();
        drawDecorations();
        drawPlatforms(ACT);
        drawEnemies();
        drawArrows();
        drawPlayer();
        drawParticles();
        drawFloatingTexts();
        drawActTransition();
        drawWeaponIndicator(ACT);

        if (xp >= XP_NEEDED) drawExitIndicator();

        updateHUD(ACT, XP_NEEDED, "ACT I: THE MORNING");

        ctx.restore();
    }

    startGameLoop(update, draw);
};

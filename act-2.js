// ═══════════════════════════════════════════════════════════
// 🏹  ACT-2.JS – The Crimson Sunset
// ═══════════════════════════════════════════════════════════
const ACT = 2;
const XP_NEEDED =145;   // XP to unlock exit to Act 3

window.launchActGame = function () {
    "use strict";

    // ── Level layout ────────────────────────────────────
    platforms = [
        // Ground segments with wider gaps
        { x: 0,   y: H - 40, w: 160, h: 40 },
        { x: 210, y: H - 40, w: 120, h: 40 },
        { x: 400, y: H - 40, w: 100, h: 40 },
        { x: 570, y: H - 40, w: 110, h: 40 },
        { x: 720, y: H - 40, w: 80,  h: 40 },
        // Floating platforms
        { x: 100, y: 340, w: 70,  h: 16 },
        { x: 250, y: 280, w: 80,  h: 16 },
        { x: 420, y: 230, w: 70,  h: 16 },
        { x: 550, y: 310, w: 80,  h: 16 },
        { x: 660, y: 190, w: 90,  h: 16 },
        { x: 740, y: 130, w: 60,  h: 16 }
    ];

    // ── Enemies ─────────────────────────────────────────
    enemies = [
        makeBat(200, 200),
        makeBat(450, 160),
        makeBat(650, 140),
        makeSlime(250, H - 40 - 24),
        makeSlime(580, H - 40 - 24),
        makeBat(120, 280)
    ];

    // ── Init ────────────────────────────────────────────
    arrows = [];
    fireballs = [];
    particles = [];
    floatingTexts = [];
    resetPlayer();

    actTransitionTimer = 90;
    actTransitionText = "Act II: The Evening";

    let gameOver = false;
    let exiting = false;

    function onGameOver() {
        gameOver = true;
        sfxDie();
        showOverlay("GAME OVER", "The highland winds carry your story no further...", "Press R to Restart");
    }

    function onExitRight() {
        if (xp >= XP_NEEDED && !exiting) {
            exiting = true;
            saveState();
            document.body.style.transition = "opacity 0.6s";
            document.body.style.opacity = "0";
            setTimeout(() => { window.location.href = "act-3.html"; }, 700);
        }
    }

    // ── Background ──────────────────────────────────────
    function drawBackground() {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#FF6B35");
        grad.addColorStop(0.4, "#FF8C61");
        grad.addColorStop(1, "#4A2040");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        // Setting sun
        ctx.fillStyle = "#FF4500";
        ctx.beginPath(); ctx.arc(400, H - 60, 45, 0, Math.PI * 2); ctx.fill();
        // Mountains
        ctx.fillStyle = "#3A1535";
        ctx.beginPath();
        ctx.moveTo(0, H - 80);
        ctx.lineTo(150, H - 180); ctx.lineTo(300, H - 100);
        ctx.lineTo(450, H - 200); ctx.lineTo(600, H - 120);
        ctx.lineTo(750, H - 170); ctx.lineTo(W, H - 90);
        ctx.lineTo(W, H); ctx.lineTo(0, H);
        ctx.fill();
    }

    function drawDecorations() {
        ctx.fillStyle = "#5A4A3A";
        ctx.beginPath(); ctx.arc(80, H - 44, 10, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(350, H - 44, 8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(650, H - 42, 12, 0, Math.PI * 2); ctx.fill();
    }

    // ── Game Loop ───────────────────────────────────────
    function update() {
        if (gameOver) {
            if (keyRestart()) { resetState(); window.location.href = "act-1.html"; }
            return;
        }
        if (keyRestart()) { resetState(); window.location.href = "act-1.html"; }

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

        updateHUD(ACT, XP_NEEDED, "ACT II: THE EVENING");

        ctx.restore();
    }

    startGameLoop(update, draw);
};

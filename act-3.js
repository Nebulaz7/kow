// ═══════════════════════════════════════════════════════════
// 🧛  ACT-3.JS – The Midnight Reckoning (Boss Fight)
// ═══════════════════════════════════════════════════════════
const ACT = 3;

window.launchActGame = function () {
    "use strict";

    // ── Level layout – Boss arena ───────────────────────
    platforms = [
        { x: 0, y: H - 40, w: W, h: 40 },
        // Side platforms
        { x: 50,  y: 340, w: 100, h: 16 },
        { x: 650, y: 340, w: 100, h: 16 },
        { x: 300, y: 260, w: 200, h: 16 },
        { x: 100, y: 180, w: 120, h: 16 },
        { x: 580, y: 180, w: 120, h: 16 }
    ];

    // ── No regular enemies, just Dracula ────────────────
    enemies = [];
    arrows = [];
    fireballs = [];
    particles = [];
    floatingTexts = [];
    resetPlayer();
    resetDracula();
    princess.visible = false;

    actTransitionTimer = 90;
    actTransitionText = "Act III: The Night";

    let gameOver = false;
    let won = false;
    let winTimer = 0;

    function onGameOver() {
        gameOver = true;
        sfxDie();
        showOverlay("GAME OVER", "Dracula's darkness consumes all...", "Press R to Restart from Act I");
    }

    function onBossDefeated() {
        // Show princess after delay
        setTimeout(() => {
            princess.visible = true;
            princess.x = dracula.x;
            princess.y = H - 40 - princess.h;
        }, 500);
    }

    // ── Background ──────────────────────────────────────
    function drawBackground() {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#0A0A2E");
        grad.addColorStop(1, "#1A1A3E");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        // Stars
        for (const s of gameStars) {
            const fl = 0.7 + Math.sin(Date.now() * 0.003 + s.x) * 0.3;
            ctx.fillStyle = `rgba(255,255,255,${s.b * fl})`;
            ctx.fillRect(s.x, s.y, s.s, s.s);
        }
        // Moon
        ctx.fillStyle = "#EEEEDD";
        ctx.beginPath(); ctx.arc(120, 60, 28, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0A0A2E";
        ctx.beginPath(); ctx.arc(132, 52, 24, 0, Math.PI * 2); ctx.fill();
        // Castle
        drawCastleSilhouette();
    }

    // ── Princess check ──────────────────────────────────
    function checkPrincess() {
        if (!princess.visible) return;
        if (aabb(player, princess)) {
            if (!won) {
                won = true;
                saveState();
                sfxWin();
                // Go to congratulations page
                document.body.style.transition = "opacity 0.8s";
                document.body.style.opacity = "0";
                setTimeout(() => { window.location.href = "congrat.html"; }, 900);
            }
        }
    }

    // ── Game Loop ───────────────────────────────────────
    function update() {
        if (gameOver) {
            if (keyRestart()) { resetState(); window.location.href = "act-1.html"; }
            return;
        }
        if (won) return;
        if (keyRestart()) { resetState(); window.location.href = "act-1.html"; }

        updatePlayerPhysics(ACT, onGameOver, null);
        updateDracula(onGameOver, onBossDefeated);
        updateArrows();
        updateFireballs(onGameOver);
        updateParticles();
        updateFloatingTexts();
        checkPrincess();

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
        drawPlatforms(ACT);
        drawDracula();
        drawPrincess();
        drawArrows();
        drawFireballs();
        drawPlayer();
        drawParticles();
        drawFloatingTexts();
        drawActTransition();
        drawWeaponIndicator(ACT);

        // Dracula name label
        if (dracula.active) {
            ctx.fillStyle = "#FF0000";
            ctx.font = "bold 16px 'Courier New'";
            ctx.textAlign = "center";
            ctx.fillText("COUNT DRACULA", W / 2, 30);
        }

        updateHUD(ACT, null, "ACT III: THE NIGHT");

        ctx.restore();
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
};

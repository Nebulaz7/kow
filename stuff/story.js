// ═══════════════════════════════════════════════════════════
// 📜  STORY.JS – Full-screen auto-typing story engine
// ═══════════════════════════════════════════════════════════
(function () {
    "use strict";

    const storyScreen = document.getElementById("story-screen");
    const storyCanvas = document.getElementById("storyCanvas");
    const storyTextEl = document.getElementById("story-text");
    const storyCursor = document.getElementById("story-cursor");
    const skipHint = document.getElementById("skip-hint");
    const continueBtn = document.getElementById("continue-btn");

    if (!storyScreen || !storyTextEl) return;

    // ── Starfield background ────────────────────────────────
    let sc, sw, sh, bgStars = [], bgRunning = true;

    if (storyCanvas) {
        sc = storyCanvas.getContext("2d");
        function resize() {
            sw = storyCanvas.width = window.innerWidth;
            sh = storyCanvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener("resize", resize);

        for (let i = 0; i < 150; i++) {
            bgStars.push({
                x: Math.random() * 2000,
                y: Math.random() * 1400,
                s: Math.random() * 2 + 0.5,
                b: Math.random() * 0.8 + 0.2,
                sp: Math.random() * 0.1 + 0.02
            });
        }

        (function drawBg() {
            if (!bgRunning) return;
            sc.clearRect(0, 0, sw, sh);
            for (const s of bgStars) {
                const f = 0.6 + Math.sin(Date.now() * 0.002 * s.sp + s.x) * 0.4;
                sc.fillStyle = `rgba(255,255,255,${s.b * f})`;
                sc.fillRect(s.x % sw, s.y % sh, s.s, s.s);
                s.y += s.sp;
                if (s.y > sh + 5) { s.y = -3; s.x = Math.random() * sw; }
            }
            requestAnimationFrame(drawBg);
        })();
    }

    // ── Story data comes from data-story attribute ──────────
    // Each act page sets:  <div id="story-screen" data-story="...">
    // Lines separated by \n\n  (double newline = paragraph break)
    const rawStory = storyScreen.getAttribute("data-story") || "";
    const paragraphs = rawStory.split("||").map(s => s.trim()).filter(Boolean);

    // ── Typewriter state ────────────────────────────────────
    let currentPara = 0;
    let charIndex = 0;
    let typingSpeed = 28;        // ms per character
    let currentSpeed = typingSpeed;
    let typingDone = false;
    let allDone = false;
    let typingTimer = null;
    let displayedHTML = "";

    // ── Build display ───────────────────────────────────────
    function startTyping() {
        if (currentPara >= paragraphs.length) {
            finishAll();
            return;
        }
        charIndex = 0;
        typingDone = false;
        typeNext();
    }

    function typeNext() {
        if (currentPara >= paragraphs.length) { finishAll(); return; }

        const text = paragraphs[currentPara];
        if (charIndex < text.length) {
            charIndex++;
            // Render current paragraph being typed + all previous
            renderText();
            typingTimer = setTimeout(typeNext, currentSpeed);
        } else {
            // Paragraph done
            typingDone = true;
            currentPara++;
            charIndex = 0;
            // Brief pause between paragraphs
            typingTimer = setTimeout(() => {
                if (currentPara < paragraphs.length) {
                    displayedHTML += "\n\n";
                    typingDone = false;
                    typeNext();
                } else {
                    finishAll();
                }
            }, 400);
        }
    }

    function renderText() {
        let html = displayedHTML;
        const text = paragraphs[currentPara];
        const visible = text.substring(0, charIndex);
        // Handle **bold** markers
        const formatted = (html + visible)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>');
        storyTextEl.innerHTML = '<p>' + formatted + '</p>';
        // Auto-scroll to bottom
        storyTextEl.scrollTop = storyTextEl.scrollHeight;
    }

    function skipToEnd() {
        clearTimeout(typingTimer);
        // Show all text instantly
        displayedHTML = paragraphs.join("\n\n");
        const formatted = displayedHTML
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>');
        storyTextEl.innerHTML = '<p>' + formatted + '</p>';
        currentPara = paragraphs.length;
        finishAll();
    }

    function finishAll() {
        allDone = true;
        // Save displayed text
        displayedHTML = paragraphs.join("\n\n");
        renderFinal();
        if (storyCursor) storyCursor.style.display = "none";
        if (skipHint) skipHint.textContent = "";
        if (continueBtn) {
            continueBtn.style.display = "inline-block";
            continueBtn.style.opacity = "0";
            setTimeout(() => { continueBtn.style.opacity = "1"; }, 100);
        }
    }

    function renderFinal() {
        const formatted = displayedHTML
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>');
        storyTextEl.innerHTML = '<p>' + formatted + '</p>';
        storyTextEl.scrollTop = storyTextEl.scrollHeight;
    }

    // ── Continue → transition to game ───────────────────────
    const nextPage = storyScreen.getAttribute("data-next") || null;

    function continueToGame() {
        bgRunning = false;
        storyScreen.classList.add("fade-out");
        setTimeout(() => {
            storyScreen.style.display = "none";
            const gameWrapper = document.getElementById("game-wrapper");
            if (gameWrapper) {
                gameWrapper.classList.remove("hidden");
                if (typeof window.launchActGame === "function") {
                    window.launchActGame();
                }
            } else if (nextPage) {
                window.location.href = nextPage;
            }
        }, 800);
    }

    if (continueBtn) {
        continueBtn.addEventListener("click", continueToGame);
    }

    // ── Keyboard controls ───────────────────────────────────
    window.addEventListener("keydown", e => {
        if (e.code === "Escape" || e.code === "Enter") {
            e.preventDefault();
            if (allDone) {
                continueToGame();
            } else {
                skipToEnd();
            }
        }
    });

    // ── Start ───────────────────────────────────────────────
    startTyping();

})();

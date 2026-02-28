This README is designed to keep you focused during your 120-minute sprint. It breaks the project down into technical milestones and clear gameplay logic.

🗡️ Knight of Winterfell: 120-Minute Speedrun
A retro-style HTML5 Canvas platformer where a knight-in-training must rescue a kidnapped princess from Dracula’s clutches to earn his honor and his place in the kingdom.

📜 The Legend
The King has issued a royal decree: rescue the Princess from the vampire Dracula, and you shall receive wealth and her hand in marriage. You begin as a humble squire, progressing through three acts of peril to become the hero the kingdom needs.

🏗️ Technical Architecture
Core Stack
Engine: HTML5 Canvas API (Vanilla JavaScript).

Rendering: requestAnimationFrame @ 60FPS.

Physics: AABB Collision (Axis-Aligned Bounding Box) for platforming.

Architecture: Single-file index.html for maximum development speed.

The Three-Act State Machine
Act I: The Morning (Intro)

Visuals: Sky-blue background, green fields.

Weapon: Sword (Short-range melee hitbox).

Goal: Gain XP by defeating slimes and navigating basic pits.

Act II: The Evening (Middle)

Visuals: Orange/Pink sunset, rocky terrain.

Weapon: Bow & Arrow (Long-range projectiles).

Goal: Defeat faster flying enemies and survive complex jumps.

Act III: The Night (The Finale)

Visuals: Dark blue/Black sky, Gothic castle backdrop.

Weapon: Bow + Sword.

Goal: Defeat Dracula in a boss-room layout.

⏱️ Development Roadmap (2-Hour Sprint)
Phase 1: The Engine (00:00 - 00:30)
[ ] Initialize Canvas and Game Loop.

[ ] Implement Player class with gravity and horizontal friction.

[ ] Build basic Platform detection (floor and floating blocks).

Phase 2: Combat & Progression (00:30 - 01:00)
[ ] Act 1 Logic: Sword hitbox triggers on Space.

[ ] Act 2 Logic: Arrow spawning on Space (switch weapon at XP threshold).

[ ] Enemy System: Simple horizontal patrol AI for "Monsters."

Phase 3: The Boss & Act Transition (01:00 - 01:30)
[ ] Dracula AI: Teleportation logic + Projectile fire (Fireballs).

[ ] Transitions: Screen-edge detection to move from Act 1 ➔ Act 2 ➔ Act 3.

[ ] Health System: 3-life counter with "Game Over" and "Restart" states.

Phase 4: Polish & "Juice" (01:30 - 02:00)
[ ] Visuals: CSS pixelated rendering and sepia/contrast filters.

[ ] UI Overlay: Live XP counter, Hearts (lives), and Act titles.

[ ] Win Condition: Princess rescue trigger after Dracula's health reaches 0.

🎮 Controls
WASD / Arrows: Move and Jump.

Space: Attack (Sword in Act 1, Bow in Act 2/3).

R: Quick Restart.

🛠️ Polish Strategies for Speed
Color-Coding: Use #FF0000 for Dracula, #00FF00 for Slimes, and #FFFF00 for the Princess to avoid spending time on sprite assets.

Screen Shake: Implement a small Math.random() offset to the ctx.translate when the player takes damage or hits an enemy.

ZzFX: Use code-generated sound effects for jumps and hits to avoid loading external files.

Would you like me to generate the Act 2 Arrow projectile class and the Dracula teleportation logic to save you 15 minutes of coding?
// Standalone Paper.io clone with hard bots
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GRID = 20;
const SPEED = 2;
const BOT_SPEED = 2;
const NUM_BOTS = 5;
const COLORS = [
    "#33e", "#e33", "#3e3", "#ee3", "#e3e", "#3ee", "#eee"
];

function randColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// --- Game State ---
let grid = [];
let player, bots = [];

// --- Player/Bot Model ---
class Agent {
    constructor(x, y, color, isBot = false) {
        this.x = x; this.y = y;
        this.color = color;
        this.isBot = isBot;
        this.dir = 'RIGHT';
        this.trail = [];
        this.inTrail = false;
        this.alive = true;
        this.score = 0;
        this.target = null; // for bots
        this.turnCooldown = 0;
    }

    move() {
        let dx = 0, dy = 0;
        if (this.dir === 'UP') dy = -SPEED;
        if (this.dir === 'DOWN') dy = SPEED;
        if (this.dir === 'LEFT') dx = -SPEED;
        if (this.dir === 'RIGHT') dx = SPEED;
        if (this.isBot) { dx *= BOT_SPEED/SPEED; dy *= BOT_SPEED/SPEED; }
        this.x += dx; this.y += dy;
    }

    getGridPos() {
        return {
            gx: Math.floor(this.x / GRID),
            gy: Math.floor(this.y / GRID)
        };
    }
}

// --- Initialize Board ---
function resetGrid() {
    grid = [];
    for (let x = 0; x < WIDTH / GRID; x++) {
        grid[x] = [];
        for (let y = 0; y < HEIGHT / GRID; y++) {
            grid[x][y] = null; // owner color
        }
    }
}

// --- Spawning ---
function spawnPlayer() {
    return new Agent(GRID*2, GRID*2, "#55f", false);
}
function spawnBot(col) {
    let px = GRID * (Math.floor(Math.random()*((WIDTH/GRID)-4))+2);
    let py = GRID * (Math.floor(Math.random()*((HEIGHT/GRID)-4))+2);
    return new Agent(px, py, col, true);
}

// --- Game Logic ---
function claimTrail(agent) {
    for (let t of agent.trail) {
        let gx = Math.floor(t[0]/GRID), gy = Math.floor(t[1]/GRID);
        if(gx>=0 && gy>=0 && gx<WIDTH/GRID && gy<HEIGHT/GRID)
            grid[gx][gy] = agent.color;
    }
    agent.trail = [];
    agent.inTrail = false;
    agent.score = countOwned(agent.color);
}

// Returns number of cells owned by color
function countOwned(color) {
    let c = 0;
    for (let x=0; x<WIDTH/GRID; ++x)
        for (let y=0; y<HEIGHT/GRID; ++y)
            if (grid[x][y] === color) c++;
    return c;
}

// Check for collisions/death
function checkDeath(agent) {
    let {gx, gy} = agent.getGridPos();
    // Out of bounds
    if (agent.x < 0 || agent.y < 0 || agent.x > WIDTH || agent.y > HEIGHT) {
        agent.alive = false;
        return;
    }
    // If in trail, and touches any color trail (except own)
    for (let bot of [player, ...bots]) {
        if (!bot.alive) continue;
        for (let t of bot.trail) {
            let bx = Math.floor(t[0]/GRID), by = Math.floor(t[1]/GRID);
            if (gx === bx && gy === by && agent.color !== bot.color) {
                agent.alive = false;
                return;
            }
        }
    }
    // Touches own trail = safe
    // Touches own territory = claim
    if (grid[gx] && grid[gx][gy] === agent.color && agent.inTrail) {
        claimTrail(agent);
    }
}

// --- Bot AI ("hard") ---
function botAI(bot) {
    // 1. Chase player or enemy territory to steal
    // 2. Avoid dying (don't cross own trail, don't go OOB)
    // 3. Sometimes try to claim own trail

    // Find target: nearest enemy territory (not own color)
    let best = null, bestDist = 1e9;
    for (let x=0; x<WIDTH/GRID; ++x) {
        for (let y=0; y<HEIGHT/GRID; ++y) {
            if (grid[x][y] && grid[x][y] !== bot.color) {
                let dist = Math.abs(bot.x-x*GRID)+Math.abs(bot.y-y*GRID);
                if (dist < bestDist) {
                    best = {gx:x, gy:y};
                    bestDist = dist;
                }
            }
        }
    }
    // If found, set target to that cell, else chase player
    let tx, ty;
    if (best) {
        tx = best.gx*GRID; ty = best.gy*GRID;
    } else {
        tx = player.x; ty = player.y;
    }
    // Move toward target, but avoid going OOB or into own trail
    let options = ['UP','DOWN','LEFT','RIGHT'];
    let scores = [];
    for (let dir of options) {
        let nx = bot.x, ny = bot.y;
        if (dir==='UP') ny -= BOT_SPEED;
        if (dir==='DOWN') ny += BOT_SPEED;
        if (dir==='LEFT') nx -= BOT_SPEED;
        if (dir==='RIGHT') nx += BOT_SPEED;
        let gx = Math.floor(nx/GRID), gy = Math.floor(ny/GRID);
        // Score: prefer moves closer to target, avoid OOB and own trail
        let score = -Math.abs(nx-tx)-Math.abs(ny-ty);
        if (nx<0||ny<0||nx>=WIDTH||ny>=HEIGHT) score -= 1000;
        // Avoid own trail
        for (let t of bot.trail) {
            let bx = Math.floor(t[0]/GRID), by = Math.floor(t[1]/GRID);
            if (gx === bx && gy === by) score -= 100;
        }
        scores.push(score);
    }
    // Pick best move
    let maxScore = Math.max(...scores);
    let idxs = options.map((v,i)=>i).filter(i=>scores[i]===maxScore);
    let pick = options[idxs[Math.floor(Math.random()*idxs.length)]];
    bot.dir = pick;
}

// --- Input ---
let keys = {};
window.addEventListener('keydown', e => {
    keys[e.key] = true;
});
window.addEventListener('keyup', e => {
    keys[e.key] = false;
});
function handleInput() {
    if (!player.alive) return;
    if (keys['ArrowUp'] || keys['w']) player.dir='UP';
    if (keys['ArrowDown'] || keys['s']) player.dir='DOWN';
    if (keys['ArrowLeft'] || keys['a']) player.dir='LEFT';
    if (keys['ArrowRight'] || keys['d']) player.dir='RIGHT';
}

// --- Main Loop ---
function draw() {
    ctx.clearRect(0,0,WIDTH,HEIGHT);
    // Draw territory
    for (let x=0; x<WIDTH/GRID; ++x)
        for (let y=0; y<HEIGHT/GRID; ++y)
            if (grid[x][y]) {
                ctx.fillStyle = grid[x][y];
                ctx.fillRect(x*GRID, y*GRID, GRID, GRID);
            }
    // Draw trails
    for (let agent of [player, ...bots]) {
        if (!agent.alive) continue;
        ctx.strokeStyle = agent.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i=0; i<agent.trail.length; ++i) {
            let [x,y] = agent.trail[i];
            if (i===0) ctx.moveTo(x+GRID/2, y+GRID/2);
            else ctx.lineTo(x+GRID/2, y+GRID/2);
        }
        ctx.stroke();
    }
    // Draw agents
    for (let agent of [player, ...bots]) {
        if (!agent.alive) continue;
        ctx.fillStyle = agent.color;
        ctx.beginPath();
        ctx.arc(agent.x+GRID/2, agent.y+GRID/2, GRID/2-2, 0, Math.PI*2);
        ctx.fill();
    }
    // Draw score
    ctx.fillStyle = "#fff";
    ctx.font = "18px Arial";
    ctx.fillText(`Your Score: ${player.score}`, 8, 22);
    for (let i=0; i<bots.length; ++i)
        if (bots[i].alive)
            ctx.fillText(`Bot${i+1}: ${bots[i].score}`, 8, 44+22*i);
    if (!player.alive) {
        ctx.fillStyle = "#f44";
        ctx.font = "40px Arial";
        ctx.fillText("GAME OVER!", WIDTH/2-110, HEIGHT/2);
    }
}

function update() {
    handleInput();
    if (player.alive) {
        player.move();
        let {gx, gy} = player.getGridPos();
        if (grid[gx] && grid[gx][gy] !== player.color) {
            player.inTrail = true;
            player.trail.push([player.x, player.y]);
        } else if (player.inTrail) {
            claimTrail(player);
        }
        checkDeath(player);
    }
    for (let bot of bots) {
        if (!bot.alive) continue;
        if (bot.turnCooldown > 0) bot.turnCooldown--;
        else {
            botAI(bot);
            bot.turnCooldown = 4 + Math.floor(Math.random()*6); // randomize reaction
        }
        bot.move();
        let {gx, gy} = bot.getGridPos();
        if (grid[gx] && grid[gx][gy] !== bot.color) {
            bot.inTrail = true;
            bot.trail.push([bot.x, bot.y]);
        } else if (bot.inTrail) {
            claimTrail(bot);
        }
        checkDeath(bot);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// --- Start Game ---
function startGame() {
    resetGrid();
    player = spawnPlayer();
    bots = [];
    let usedColors = [player.color];
    for (let i=0; i<NUM_BOTS; ++i) {
        let c;
        do { c = randColor(); } while (usedColors.includes(c));
        usedColors.push(c);
        bots.push(spawnBot(c));
    }
    // Give each a starting territory
    for (let agent of [player, ...bots]) {
        let {gx, gy} = agent.getGridPos();
        for (let dx=-2;dx<=2;++dx)
            for (let dy=-2;dy<=2;++dy)
                if (grid[gx+dx] && grid[gx+dx][gy+dy] !== undefined)
                    grid[gx+dx][gy+dy] = agent.color;
    }
    player.score = countOwned(player.color);
    for (let b of bots) b.score = countOwned(b.color);
    gameLoop();
}

startGame();
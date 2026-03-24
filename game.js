const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const buildMenu = document.getElementById('build-menu');

// --- 六边形网格数学配置 (尖顶六边形, 奇数行向右偏移) ---
const HEX_SIZE = 22; // 六边形外接圆半径
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
const HEX_HEIGHT = 2 * HEX_SIZE;
const COLS = 20;
const ROWS = 16;

const TILE_TYPES = { BUILDABLE: 0, PATH: 1, SPAWN: 2, BASE: 3 };
const COLORS = {
    [TILE_TYPES.BUILDABLE]: '#2a2a2a',
    [TILE_TYPES.PATH]: '#4a3d2c',
    [TILE_TYPES.SPAWN]: '#800000',
    [TILE_TYPES.BASE]: '#004488'
};

// 预设地图 (0:地, 1:路, 2:起点, 3:终点)
const mapGrid = [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [2,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,3,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];

let buildings = {}; 
let hoverCol = -1, hoverRow = -1;
let selectedTile = null; // 当前准备建造的格子

// 将行列转换为屏幕像素坐标
function getHexCenter(col, row) {
    let x = HEX_WIDTH * col + (row % 2 === 1 ? HEX_WIDTH / 2 : 0) + HEX_WIDTH;
    let y = HEX_HEIGHT * 0.75 * row + HEX_HEIGHT;
    return { x, y };
}

// 查找距离鼠标最近的六边形
function getHoveredHex(mx, my) {
    let minDist = Infinity;
    let targetC = -1, targetR = -1;
    for (let r = 0; r < mapGrid.length; r++) {
        for (let c = 0; c < mapGrid[r].length; c++) {
            let center = getHexCenter(c, r);
            let dist = Math.hypot(center.x - mx, center.y - my);
            if (dist < minDist) { minDist = dist; targetC = c; targetR = r; }
        }
    }
    // 如果在半径内，判定为选中
    return minDist <= HEX_SIZE ? { c: targetC, r: targetR } : null;
}

// --- 交互逻辑 ---
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    let hex = getHoveredHex(e.clientX - rect.left, e.clientY - rect.top);
    if (hex) { hoverCol = hex.c; hoverRow = hex.r; } 
    else { hoverCol = -1; hoverRow = -1; }
});

canvas.addEventListener('mousedown', (e) => {
    // 如果菜单开着，先判断是否点在了外面
    if (!buildMenu.classList.contains('hidden')) return; 

    if (hoverCol >= 0 && hoverRow >= 0) {
        let tileType = mapGrid[hoverRow][hoverCol];
        let key = `${hoverCol},${hoverRow}`;
        
        if (tileType === TILE_TYPES.SPAWN || tileType === TILE_TYPES.BASE) return;
        if (buildings[key]) return; // 已经有东西了

        if (tileType === TILE_TYPES.BUILDABLE) {
            // 打开建造菜单
            selectedTile = { c: hoverCol, r: hoverRow };
            buildMenu.style.left = (e.clientX + 10) + 'px';
            buildMenu.style.top = (e.clientY + 10) + 'px';
            buildMenu.classList.remove('hidden');
        } else if (tileType === TILE_TYPES.PATH) {
            // 道路直接放置陷阱
            buildings[key] = { type: 'TRAP' };
        }
    }
});

// 菜单点击回调
function buildBuilding(type) {
    if (selectedTile) {
        buildings[`${selectedTile.c},${selectedTile.r}`] = { type: type };
        closeMenu();
    }
}
function closeMenu() {
    buildMenu.classList.add('hidden');
    selectedTile = null;
}
function clearBuildings() { buildings = {}; closeMenu(); }

// --- 绘制逻辑 ---
function drawHex(ctx, x, y, size, fill, stroke) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        let angle = Math.PI / 180 * (60 * i - 30); // 尖顶朝上
        ctx.lineTo(x + size * Math.cos(angle), y + size * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

// 绘制齿轮状 (增幅器)
function drawGear(ctx, x, y, radius, teeth) {
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
        let r = (i % 2 === 0) ? radius : radius * 0.7; // 凸凹交替
        let angle = (Math.PI / teeth) * i;
        ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fillStyle = '#666'; ctx.fill();
    ctx.strokeStyle = '#999'; ctx.stroke();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 绘制六边形地图
    for (let r = 0; r < mapGrid.length; r++) {
        for (let c = 0; c < mapGrid[r].length; c++) {
            let center = getHexCenter(c, r);
            let isHover = (c === hoverCol && r === hoverRow);
            drawHex(ctx, center.x, center.y, HEX_SIZE - 1, COLORS[mapGrid[r][c]], isHover ? '#fff' : '#111');
        }
    }

    // 2. 绘制建筑/陷阱
    for (const key in buildings) {
        let [c, r] = key.split(',').map(Number);
        let center = getHexCenter(c, r);
        let b = buildings[key];

        if (b.type === 'TOWER') {
            // 圆形塔基座
            ctx.beginPath(); ctx.arc(center.x, center.y, HEX_SIZE * 0.6, 0, Math.PI*2);
            ctx.fillStyle = '#444'; ctx.fill();
            ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.stroke();
        } else if (b.type === 'AMP') {
            // 齿轮状增幅器基座
            drawGear(ctx, center.x, center.y, HEX_SIZE * 0.7, 8);
        } else if (b.type === 'TRAP') {
            // 陷阱 (贴合地面的小六边形)
            drawHex(ctx, center.x, center.y, HEX_SIZE * 0.5, '#555', '#222');
        }
    }

    requestAnimationFrame(draw);
}

draw();
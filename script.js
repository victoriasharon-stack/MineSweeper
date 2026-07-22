// ----- Difficulty presets -----
const DIFFICULTIES = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard:   { rows: 16, cols: 30, mines: 99 }
};

// ----- State -----
let rows, cols, mineCount;
let board = [];
let firstClick = true;
let gameOver = false;
let flagsPlaced = 0;
let timerInterval = null;
let secondsElapsed = 0;

// ----- DOM refs -----
const boardEl = document.getElementById('board');
const frameEl = document.querySelector('.frame');
const mineCountEl = document.getElementById('mine-count');
const timerEl = document.getElementById('timer');
const statusChipEl = document.getElementById('status-face');
const faceIconEl = document.getElementById('status-icon');
const healthFillEl = document.getElementById('health-fill');
const difficultySelect = document.getElementById('difficulty');
const newGameBtn = document.getElementById('new-game-btn');

newGameBtn.addEventListener('click', startNewGame);
statusChipEl.addEventListener('click', startNewGame);
statusChipEl.setAttribute('tabindex', '0');
statusChipEl.setAttribute('role', 'button');
statusChipEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') startNewGame();
});
difficultySelect.addEventListener('change', startNewGame);
window.addEventListener('resize', sizeBoard);

function pad3(n) {
  return String(Math.max(0, Math.min(n, 999))).padStart(3, '0');
}

// ----- Game setup -----
function startNewGame() {
  const settings = DIFFICULTIES[difficultySelect.value];
  rows = settings.rows;
  cols = settings.cols;
  mineCount = settings.mines;

  firstClick = true;
  gameOver = false;
  flagsPlaced = 0;
  secondsElapsed = 0;
  clearInterval(timerInterval);
  timerEl.textContent = pad3(0);
  faceIconEl.textContent = '🙂';
  mineCountEl.textContent = mineCount;
  healthFillEl.style.width = '78%';
  frameEl.classList.remove('won', 'lost');

  board = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        isMine: false,
        revealed: false,
        flagged: false,
        adjacentMines: 0,
        pebble: Math.random() < 0.22
      });
    }
    board.push(row);
  }

  renderBoard();
  sizeBoard();
}

function placeMines(excludeRow, excludeCol) {
  let placed = 0;
  while (placed < mineCount) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);

    const tooCloseToFirstClick =
      Math.abs(r - excludeRow) <= 1 && Math.abs(c - excludeCol) <= 1;

    if (board[r][c].isMine || tooCloseToFirstClick) continue;

    board[r][c].isMine = true;
    placed++;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].isMine) continue;
      board[r][c].adjacentMines = countAdjacentMines(r, c);
    }
  }
}

function countAdjacentMines(row, col) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr, nc = col + dc;
      if (inBounds(nr, nc) && board[nr][nc].isMine) count++;
    }
  }
  return count;
}

function inBounds(r, c) {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}

// ----- Rendering -----
function renderBoard() {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellEl = document.createElement('div');
      cellEl.classList.add('cell');
      cellEl.dataset.row = r;
      cellEl.dataset.col = c;
      cellEl.setAttribute('role', 'button');
      cellEl.setAttribute('aria-label', `tile ${r + 1}, ${c + 1}`);
      if (board[r][c].pebble) cellEl.classList.add('pebble');

      cellEl.addEventListener('click', () => handleLeftClick(r, c));
      cellEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleRightClick(r, c);
      });

      boardEl.appendChild(cellEl);
    }
  }
}

// Fit the cell size to the available width so hard mode (30 cols)
// stays inside the wooden frame on smaller screens.
function sizeBoard() {
  const wellPadding = 24;
  const gap = 4;
  const frameWidth = Math.min(window.innerWidth - 40, 600);
  const available = frameWidth - wellPadding - 24;
  const rawSize = (available - gap * (cols - 1)) / cols;
  const size = Math.max(18, Math.min(42, Math.floor(rawSize)));
  document.documentElement.style.setProperty('--cell-size', `${size}px`);
  boardEl.style.gridTemplateColumns = `repeat(${cols}, ${size}px)`;
}

function updateCellDisplay(row, col) {
  const cellEl = boardEl.querySelector(
    `[data-row='${row}'][data-col='${col}']`
  );
  const cell = board[row][col];

  cellEl.className = 'cell';
  if (cell.pebble && !cell.revealed && !cell.flagged) cellEl.classList.add('pebble');
  cellEl.innerHTML = '';

  if (cell.flagged && !cell.revealed) {
    cellEl.classList.add('flagged');
    cellEl.textContent = '🚩';
    return;
  }

  if (!cell.revealed) return;

  cellEl.classList.add('revealed');

  if (cell.isMine) {
    cellEl.classList.add('mine');
    cellEl.textContent = '💣';
  } else if (cell.adjacentMines > 0) {
    const badge = document.createElement('div');
    badge.className = `num-box n${cell.adjacentMines}`;
    badge.textContent = cell.adjacentMines;
    cellEl.appendChild(badge);
  }
}

// ----- Interaction -----
function handleLeftClick(row, col) {
  if (gameOver) return;
  const cell = board[row][col];
  if (cell.flagged || cell.revealed) return;

  if (firstClick) {
    placeMines(row, col);
    firstClick = false;
    startTimer();
  }

  if (cell.isMine) {
    revealAllMines(row, col);
    endGame(false);
    return;
  }

  revealCell(row, col);
  checkWinCondition();
}

function handleRightClick(row, col) {
  if (gameOver) return;
  const cell = board[row][col];
  if (cell.revealed) return;

  cell.flagged = !cell.flagged;
  flagsPlaced += cell.flagged ? 1 : -1;
  mineCountEl.textContent = Math.max(0, mineCount - flagsPlaced);

  updateCellDisplay(row, col);
}

function revealCell(row, col) {
  const cell = board[row][col];
  if (cell.revealed || cell.flagged) return;

  cell.revealed = true;
  updateCellDisplay(row, col);

  if (cell.adjacentMines === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr, nc = col + dc;
        if (inBounds(nr, nc)) {
          revealCell(nr, nc);
        }
      }
    }
  }
}

function revealAllMines(hitRow, hitCol) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].isMine) {
        board[r][c].revealed = true;
        updateCellDisplay(r, c);
      }
    }
  }
  const hitEl = boardEl.querySelector(`[data-row='${hitRow}'][data-col='${hitCol}']`);
  if (hitEl) hitEl.style.boxShadow = '0 0 0 3px #ffd88a, inset 0 2px 4px rgba(0,0,0,0.5)';
}

function checkWinCondition() {
  let unrevealedSafeCells = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!board[r][c].isMine && !board[r][c].revealed) {
        unrevealedSafeCells++;
      }
    }
  }
  if (unrevealedSafeCells === 0) {
    endGame(true);
  }
}

function endGame(won) {
  gameOver = true;
  clearInterval(timerInterval);
  faceIconEl.textContent = won ? '😎' : '💀';
  frameEl.classList.toggle('won', won);
  frameEl.classList.toggle('lost', !won);
  healthFillEl.style.width = won ? '78%' : '0%';

  if (won) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].isMine && !board[r][c].flagged) {
          board[r][c].flagged = true;
          updateCellDisplay(r, c);
        }
      }
    }
    mineCountEl.textContent = 0;
  }
}

// ----- Timer -----
function startTimer() {
  timerInterval = setInterval(() => {
    secondsElapsed++;
    timerEl.textContent = pad3(secondsElapsed);
  }, 1000);
}

// ----- Boot -----
startNewGame();
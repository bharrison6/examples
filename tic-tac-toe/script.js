const boardGrid = document.querySelector("#board-grid");
const statusElement = document.querySelector("#status");
const newMatchButton = document.querySelector("#new-match");
const newMatchTextButton = document.querySelector("#new-match-text");
const modeButtons = [...document.querySelectorAll(".mode-button")];
const scoreElements = {
  X: document.querySelector("#x-score"),
  O: document.querySelector("#o-score"),
  draw: document.querySelector("#draw-score"),
};

const boardCount = 9;
const cellsPerBoard = 9;

const wins = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const state = {
  boards: createBoards(),
  current: "X",
  mode: "cpu",
  active: true,
};

function createBoards() {
  return Array.from({ length: boardCount }, () => ({
    cells: Array(cellsPerBoard).fill(""),
    result: null,
  }));
}

function createMark(mark) {
  const markElement = document.createElement("span");
  markElement.className = `mark mark-${mark.toLowerCase()}`;
  markElement.setAttribute("aria-hidden", "true");
  return markElement;
}

function getBoardLabel(boardIndex, board) {
  if (!board.result) {
    return `Board ${boardIndex + 1}`;
  }

  return board.result.winner === "draw"
    ? `Board ${boardIndex + 1}, draw`
    : `Board ${boardIndex + 1}, ${board.result.winner} won`;
}

function renderBoards() {
  boardGrid.replaceChildren();

  state.boards.forEach((board, boardIndex) => {
    const boardElement = document.createElement("section");
    boardElement.className = "mini-board";
    boardElement.setAttribute("role", "grid");
    boardElement.setAttribute("aria-label", getBoardLabel(boardIndex, board));

    if (board.result) {
      boardElement.classList.add("is-finished");
      boardElement.dataset.result = board.result.winner;
    }

    const boardNumber = document.createElement("span");
    boardNumber.className = "board-number";
    boardNumber.textContent = boardIndex + 1;
    boardElement.append(boardNumber);

    board.cells.forEach((mark, cellIndex) => {
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.type = "button";
      cell.setAttribute("role", "gridcell");
      cell.dataset.board = boardIndex;
      cell.dataset.index = cellIndex;
      cell.disabled = Boolean(mark) || Boolean(board.result) || !state.active;
      cell.setAttribute(
        "aria-label",
        mark
          ? `Board ${boardIndex + 1}, cell ${cellIndex + 1}, ${mark}`
          : `Board ${boardIndex + 1}, cell ${cellIndex + 1}, empty`
      );

      if (mark) {
        cell.append(createMark(mark));
      }

      if (board.result?.line.includes(cellIndex)) {
        cell.classList.add("is-win");
      }

      boardElement.append(cell);
    });

    if (board.result) {
      const resultElement = document.createElement("span");
      resultElement.className = "board-result";
      resultElement.textContent =
        board.result.winner === "draw" ? "Draw" : board.result.winner;
      boardElement.append(resultElement);
    }

    boardGrid.append(boardElement);
  });
}

function renderScores() {
  const scores = getBoardScores();
  scoreElements.X.textContent = scores.X;
  scoreElements.O.textContent = scores.O;
  scoreElements.draw.textContent = scores.draw;
}

function setStatus(text) {
  statusElement.textContent = text;
}

function switchTurn() {
  state.current = state.current === "X" ? "O" : "X";
}

function getBoardResult(board) {
  for (const line of wins) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }

  if (board.every(Boolean)) {
    return { winner: "draw", line: [] };
  }

  return null;
}

function getBoardScores() {
  return state.boards.reduce(
    (scores, board) => {
      if (board.result) {
        scores[board.result.winner] += 1;
      }

      return scores;
    },
    { X: 0, O: 0, draw: 0 }
  );
}

function getPlayableMoves() {
  return state.boards.flatMap((board, boardIndex) => {
    if (board.result) {
      return [];
    }

    return board.cells
      .map((mark, cellIndex) => (mark ? null : { boardIndex, cellIndex }))
      .filter(Boolean);
  });
}

function getMatchResult() {
  const scores = getBoardScores();

  if (scores.X >= 5 || scores.O >= 5) {
    return { winner: scores.X > scores.O ? "X" : "O" };
  }

  if (getPlayableMoves().length > 0) {
    return null;
  }

  if (scores.X === scores.O) {
    return { winner: "draw" };
  }

  return { winner: scores.X > scores.O ? "X" : "O" };
}

function finishMatch(result) {
  state.active = false;
  renderScores();
  if (result.winner === "draw") {
    setStatus("Match draw");
    renderBoards();
    return;
  }

  setStatus(`${result.winner} wins the match`);
  renderBoards();
}

function playCell(boardIndex, cellIndex) {
  const board = state.boards[boardIndex];

  if (!state.active || !board || board.result || board.cells[cellIndex]) {
    return;
  }

  const player = state.current;
  board.cells[cellIndex] = player;
  const boardResult = getBoardResult(board.cells);

  if (boardResult) {
    board.result = boardResult;
  }

  const matchResult = getMatchResult();
  renderScores();

  if (matchResult) {
    finishMatch(matchResult);
    return;
  }

  switchTurn();
  setStatus(
    boardResult
      ? `${boardResult.winner === "draw" ? "Draw on" : `${player} won`} board ${boardIndex + 1}. ${state.current} to move`
      : `${state.current} to move`
  );
  renderBoards();

  if (state.mode === "cpu" && state.current === "O") {
    window.setTimeout(playCpuTurn, 320);
  }
}

function findWinningMove(board, player) {
  for (const line of wins) {
    const marks = line.map((index) => board.cells[index]);
    const playerMarks = marks.filter((mark) => mark === player).length;
    const emptyIndex = line.find((index) => !board.cells[index]);

    if (playerMarks === 2 && emptyIndex !== undefined) {
      return emptyIndex;
    }
  }

  return null;
}

function scoreCpuMove(board, cellIndex) {
  let score = cellIndex === 4 ? 14 : [0, 2, 6, 8].includes(cellIndex) ? 8 : 4;

  for (const line of wins) {
    if (!line.includes(cellIndex)) {
      continue;
    }

    const marks = line.map((index) => board.cells[index]);
    const oMarks = marks.filter((mark) => mark === "O").length;
    const xMarks = marks.filter((mark) => mark === "X").length;

    if (xMarks === 0) {
      score += 5 + oMarks * 10;
    }

    if (oMarks === 0) {
      score += xMarks * 6;
    }
  }

  return score;
}

function chooseCpuMove() {
  const playableBoards = state.boards
    .map((board, boardIndex) => ({ board, boardIndex }))
    .filter(({ board }) => !board.result);

  for (const player of ["O", "X"]) {
    for (const { board, boardIndex } of playableBoards) {
      const cellIndex = findWinningMove(board, player);

      if (cellIndex !== null) {
        return { boardIndex, cellIndex };
      }
    }
  }

  return getPlayableMoves()
    .map((move) => ({
      ...move,
      score: scoreCpuMove(state.boards[move.boardIndex], move.cellIndex),
    }))
    .reduce((best, move) => (move.score > best.score ? move : best));
}

function playCpuTurn() {
  if (!state.active || state.current !== "O") {
    return;
  }

  const move = chooseCpuMove();
  if (move) {
    playCell(move.boardIndex, move.cellIndex);
  }
}

function newMatch() {
  state.boards = createBoards();
  state.current = "X";
  state.active = true;
  setStatus("X to move");
  renderScores();
  renderBoards();
}

function setMode(mode) {
  state.mode = mode;
  modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  newMatch();
}

boardGrid.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");

  if (!cell || !boardGrid.contains(cell)) {
    return;
  }

  playCell(Number(cell.dataset.board), Number(cell.dataset.index));
});

newMatchButton.addEventListener("click", newMatch);
newMatchTextButton.addEventListener("click", newMatch);
modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

renderScores();
newMatch();

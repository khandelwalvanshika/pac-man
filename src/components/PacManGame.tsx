"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// "#" = wall, "." = open path. Border is fully enclosed.
// Generated as a spanning-tree maze with extra loops carved in, then
// verified so every open cell is reachable from START (no sealed-off
// rooms like the old nested-rectangle layout had).
const MAZE = [
  "###################",
  "#.........#.......#",
  "#.#.#.#.#.#.#####.#",
  "#.#.#...#.#.....#.#",
  "#.#.#.#.#.#.#.###.#",
  "#...#.#.....#.#...#",
  "#.#.###.#####.#.#.#",
  "#.....#.........#.#",
  "#.#.#.#.###.#.#.#.#",
  "#...#...........#.#",
  "#.#.#.###.#####.#.#",
  "#.#.#...#.....#.#.#",
  "#.#.#.#.###.#.#.#.#",
  "#.#.........#...#.#",
  "###################",
];

const ROWS = MAZE.length;
const COLS = MAZE[0].length;
const START = { row: 1, col: 1 };
const GHOST_START = { row: 13, col: 17 };
const GHOST_MOVE_INTERVAL_MS = 450;
const MAX_CANVAS_WIDTH = 560;

type Cell = { row: number; col: number };
type Direction = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

function isWall(row: number, col: number) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return MAZE[row][col] === "#";
}

function dotKey(row: number, col: number) {
  return `${row},${col}`;
}

function buildInitialDots() {
  const dots = new Set<string>();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (MAZE[row][col] === "." && !(row === START.row && col === START.col)) {
        dots.add(dotKey(row, col));
      }
    }
  }
  return dots;
}

const KEY_DELTAS: Record<Direction, { dRow: number; dCol: number }> = {
  ArrowUp: { dRow: -1, dCol: 0 },
  ArrowDown: { dRow: 1, dCol: 0 },
  ArrowLeft: { dRow: 0, dCol: -1 },
  ArrowRight: { dRow: 0, dCol: 1 },
};

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  ArrowUp: "ArrowDown",
  ArrowDown: "ArrowUp",
  ArrowLeft: "ArrowRight",
  ArrowRight: "ArrowLeft",
};

// A red, ghost-shaped marker (dome top + wavy skirt + eyes) so it reads
// as clearly different from the player's plain yellow dot.
function drawGhost(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const r = size * 0.42;
  const top = cy - r * 0.2;
  const bottom = cy + r * 0.9;

  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(cx, top, r, Math.PI, 0, false);
  ctx.lineTo(cx + r, bottom);
  const bumps = 4;
  const bumpWidth = (2 * r) / bumps;
  for (let i = 0; i < bumps; i++) {
    const startX = cx + r - bumpWidth * i;
    const midX = startX - bumpWidth / 2;
    const endX = startX - bumpWidth;
    ctx.quadraticCurveTo(midX, bottom + r * 0.35, endX, bottom);
  }
  ctx.closePath();
  ctx.fill();

  const eyeOffsetX = r * 0.42;
  const eyeY = top;
  const eyeRadius = r * 0.22;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx - eyeOffsetX, eyeY, eyeRadius, 0, Math.PI * 2);
  ctx.arc(cx + eyeOffsetX, eyeY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1f2937";
  const pupilRadius = eyeRadius * 0.5;
  ctx.beginPath();
  ctx.arc(cx - eyeOffsetX, eyeY, pupilRadius, 0, Math.PI * 2);
  ctx.arc(cx + eyeOffsetX, eyeY, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
}

function cellsEqual(a: Cell, b: Cell) {
  return a.row === b.row && a.col === b.col;
}

export default function PacManGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<Cell>(START);
  const ghostRef = useRef<Cell>(GHOST_START);
  const ghostDirRef = useRef<Direction | null>(null);
  const dotsRef = useRef<Set<string>>(buildInitialDots());
  const gameOverRef = useRef(false);

  const [player, setPlayer] = useState<Cell>(START);
  const [ghost, setGhost] = useState<Cell>(GHOST_START);
  const [dots, setDots] = useState<Set<string>>(() => buildInitialDots());
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(MAX_CANVAS_WIDTH);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  const endGame = useCallback(() => {
    gameOverRef.current = true;
    setGameOver(true);
  }, []);

  const resetGame = useCallback(() => {
    playerRef.current = START;
    ghostRef.current = GHOST_START;
    ghostDirRef.current = null;
    dotsRef.current = buildInitialDots();
    gameOverRef.current = false;

    setPlayer(START);
    setGhost(GHOST_START);
    setDots(dotsRef.current);
    setScore(0);
    setGameOver(false);
  }, []);

  // Move the player one cell at a time with the arrow keys, blocked by walls.
  // Moving onto a dot removes it and increases the score; moving onto the
  // ghost's cell ends the game.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const delta = KEY_DELTAS[e.key as Direction];
      if (!delta || gameOverRef.current) return;
      e.preventDefault();
      const current = playerRef.current;
      const nextRow = current.row + delta.dRow;
      const nextCol = current.col + delta.dCol;
      if (isWall(nextRow, nextCol)) return;

      const next = { row: nextRow, col: nextCol };
      playerRef.current = next;
      setPlayer(next);

      const key = dotKey(nextRow, nextCol);
      if (dotsRef.current.has(key)) {
        const updatedDots = new Set(dotsRef.current);
        updatedDots.delete(key);
        dotsRef.current = updatedDots;
        setDots(updatedDots);
        setScore((s) => s + 1);
      }

      if (cellsEqual(next, ghostRef.current)) {
        endGame();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [endGame]);

  // Move the ghost on its own timer through a random open path, never
  // chasing the player. It avoids doubling back unless it hits a dead end.
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (gameOverRef.current) return;

      const current = ghostRef.current;
      const lastDir = ghostDirRef.current;
      const allMoves = (Object.keys(KEY_DELTAS) as Direction[]).filter((dir) => {
        const delta = KEY_DELTAS[dir];
        return !isWall(current.row + delta.dRow, current.col + delta.dCol);
      });
      if (allMoves.length === 0) return;

      const nonReverseMoves = lastDir
        ? allMoves.filter((dir) => dir !== OPPOSITE_DIRECTION[lastDir])
        : allMoves;
      const candidates = nonReverseMoves.length > 0 ? nonReverseMoves : allMoves;
      const chosenDir = candidates[Math.floor(Math.random() * candidates.length)];
      const delta = KEY_DELTAS[chosenDir];
      const next = { row: current.row + delta.dRow, col: current.col + delta.dCol };

      ghostDirRef.current = chosenDir;
      ghostRef.current = next;
      setGhost(next);

      if (cellsEqual(next, playerRef.current)) {
        endGame();
      }
    }, GHOST_MOVE_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [endGame]);

  // Keep the canvas sized to its container so the maze stays responsive.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function updateWidth() {
      if (!container) return;
      setCanvasWidth(Math.min(container.clientWidth, MAX_CANVAS_WIDTH));
    }
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const canvasHeight = canvasWidth * (ROWS / COLS);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cellSize = canvasWidth / COLS;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = "#1e3a8a";
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (MAZE[row][col] === "#") {
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

    ctx.fillStyle = "#fef9c3";
    dots.forEach((key) => {
      const [row, col] = key.split(",").map(Number);
      const cx = col * cellSize + cellSize / 2;
      const cy = row * cellSize + cellSize / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.12, 0, Math.PI * 2);
      ctx.fill();
    });

    drawGhost(
      ctx,
      ghost.col * cellSize + cellSize / 2,
      ghost.row * cellSize + cellSize / 2,
      cellSize
    );

    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    const centerX = player.col * cellSize + cellSize / 2;
    const centerY = player.row * cellSize + cellSize / 2;
    ctx.arc(centerX, centerY, cellSize * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }, [player, ghost, dots, canvasWidth]);

  return (
    <div ref={containerRef} className="w-full max-w-xl">
      <p className="mb-3 text-center text-lg font-semibold text-yellow-100">
        Score: {score}
      </p>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="mx-auto block rounded-lg border-4 border-blue-900"
        />
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-lg bg-black/80">
            <p className="text-3xl font-bold text-red-500">Game Over</p>
            <p className="text-lg text-yellow-100">Final Score: {score}</p>
            <button
              type="button"
              onClick={resetGame}
              className="rounded-full bg-yellow-400 px-6 py-2 font-semibold text-black transition-colors hover:bg-yellow-300"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

// "#" = wall, "." = open path. Border is fully enclosed.
const MAZE = [
  "###############",
  "#.............#",
  "#.###.###.###.#",
  "#.#.........#.#",
  "#.#.#######.#.#",
  "#.#.#.....#.#.#",
  "#...#.....#...#",
  "#.#.#.....#.#.#",
  "#.#.#######.#.#",
  "#.#.........#.#",
  "#.###.###.###.#",
  "#.............#",
  "###############",
];

const ROWS = MAZE.length;
const COLS = MAZE[0].length;
const START = { row: 1, col: 1 };
const MAX_CANVAS_WIDTH = 560;

type Cell = { row: number; col: number };

function isWall(row: number, col: number) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return MAZE[row][col] === "#";
}

const KEY_DELTAS: Record<string, { dRow: number; dCol: number }> = {
  ArrowUp: { dRow: -1, dCol: 0 },
  ArrowDown: { dRow: 1, dCol: 0 },
  ArrowLeft: { dRow: 0, dCol: -1 },
  ArrowRight: { dRow: 0, dCol: 1 },
};

export default function PacManGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<Cell>(START);
  const [player, setPlayer] = useState<Cell>(START);
  const [canvasWidth, setCanvasWidth] = useState(MAX_CANVAS_WIDTH);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  // Move the player one cell at a time with the arrow keys, blocked by walls.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const delta = KEY_DELTAS[e.key];
      if (!delta) return;
      e.preventDefault();
      const current = playerRef.current;
      const nextRow = current.row + delta.dRow;
      const nextCol = current.col + delta.dCol;
      if (!isWall(nextRow, nextCol)) {
        const next = { row: nextRow, col: nextCol };
        playerRef.current = next;
        setPlayer(next);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    const centerX = player.col * cellSize + cellSize / 2;
    const centerY = player.row * cellSize + cellSize / 2;
    ctx.arc(centerX, centerY, cellSize * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }, [player, canvasWidth]);

  return (
    <div ref={containerRef} className="w-full max-w-xl">
      <canvas
        ref={canvasRef}
        className="mx-auto block rounded-lg border-4 border-blue-900"
      />
    </div>
  );
}

import PacManGame from "@/components/PacManGame";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-black px-4 py-10 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-yellow-400 sm:text-4xl">
        HBS Pac-Man
      </h1>
      <p className="text-sm text-zinc-400 sm:text-base">
        Use the arrow keys to move through the maze.
      </p>
      <PacManGame />
    </div>
  );
}

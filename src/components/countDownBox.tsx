

// Your existing function
function getTimeRemaining(target: Date) {
  const total = Math.max(0, target.getTime() - Date.now());
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  return { total, days, hours, minutes, seconds };
}


export default function CountdownBox({ timeLeft }: { timeLeft: ReturnType<typeof getTimeRemaining> }) {
  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className="flex justify-center w-full px-2">
      <div className="relative bg-[#161926] border border-white/10 rounded-2xl px-5 py-2.5 shadow-xl min-w-[180px]">
        <div className="relative z-10 flex flex-col items-center">
          {/* Smaller Digital Text */}
          <div className="text-2xl font-black tracking-widest text-[#ff5c5c] drop-shadow-[0_0_5px_rgba(255,92,92,0.4)] tabular-nums leading-none">
            {timeLeft.days > 0 && `${pad(timeLeft.days)}:`}
            {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
          </div>

          {/* Smaller Amharic Label */}
          <div className="text-[#facc15] text-[9px] font-bold mt-1 tracking-tight">
            የቀረው ጊዜ
          </div>
        </div>
      </div>
    </div>
  );
}
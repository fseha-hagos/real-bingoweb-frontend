import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import CountdownBox from './countDownBox';
import { useGames } from '../context/gameContext';
import { useSocket } from '../context/SocketContext';
import { SELECTED_GAME_DATA } from '../constants/configurations';
import { LeaderboardEntry } from '../types/game';
import { API_BASE_URL } from '../lib/api';
import { toast } from 'react-toastify';
import { am, translateGameStatus } from '../constants/amharic';
import { getDisplayName } from '../lib/player';


// const API_BASE_URL = "https://42cb-197-156-95-109.ngrok-free.app"; // Assuming relative path works or should be handled via env


function getTimeRemaining(target: Date) {
  const total = Math.max(0, target.getTime() - Date.now());
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  return { total, days, hours, minutes, seconds };
}

// Main Tournament Component
export function WeeklyTournamentCard() {
  const router = useRouter();
  const { watchGame, games } = useGames();
  const { connected, socket } = useSocket();
  const [weeklyLeaders, setWeeklyLeaders] = useState<LeaderboardEntry[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(true);

  // Find the full house game from games state
  const fullHouseGame = useMemo(() => {
    return Object.values(games).find(game => game.winType === 'fullhouse');
  }, [games]);

  // Calculate time remaining - prioritize game countdown if running
  const [timeLeft, setTimeLeft] = useState(() => {
    // If game has automatic countdown running (2+ players, start time passed)
    if (fullHouseGame?.countdown?.running) {
      const seconds = fullHouseGame.countdown.secondsLeft;
      return {
        total: seconds * 1000,
        days: 0,
        hours: 0,
        minutes: Math.floor(seconds / 60),
        seconds: seconds % 60
      };
    }

    if (!fullHouseGame?.startTime) {
      return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    const startDate = new Date(fullHouseGame.startTime);
    return getTimeRemaining(startDate);
  });

  // Update countdown every second
  useEffect(() => {
    // Priority 1: Show game's automatic countdown if running
    if (fullHouseGame?.countdown?.running) {
      const seconds = fullHouseGame.countdown.secondsLeft;
      setTimeLeft({
        total: seconds * 1000,
        days: 0,
        hours: 0,
        minutes: Math.floor(seconds / 60),
        seconds: seconds % 60
      });
      return; // Don't set up interval, game updates will trigger re-render
    }

    // Priority 2: Show countdown to start time
    if (!fullHouseGame?.startTime) {
      setTimeLeft({ total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const startDate = new Date(fullHouseGame.startTime);

    // Update immediately
    setTimeLeft(getTimeRemaining(startDate));

    // Update every second
    const interval = setInterval(() => {
      const remaining = getTimeRemaining(startDate);
      setTimeLeft(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [fullHouseGame?.startTime, fullHouseGame?.countdown?.running, fullHouseGame?.countdown?.secondsLeft]);

  // Fetch weekly leaderboard for fallback card
  useEffect(() => {
    if (!socket) return;

    const handleLeaderboardUpdate = (data: LeaderboardEntry[]) => {
      if (!Array.isArray(data)) return;
      setWeeklyLeaders(data.slice(0, 3));
      setLeadersLoading(false);
    };

    const requestWeeklyLeaderboard = () => {
      setLeadersLoading(true);
      socket.emit('getLeaderboard', { type: 'weekly' });
    };

    socket.on('leaderboardUpdate', handleLeaderboardUpdate);

    if (connected) {
      requestWeeklyLeaderboard();
    } else {
      socket.once('connect', requestWeeklyLeaderboard);
    }

    const timeout = setTimeout(() => {
      setLeadersLoading(false);
    }, 4000);

    return () => {
      clearTimeout(timeout);
      socket.off('leaderboardUpdate', handleLeaderboardUpdate);
      socket.off('connect', requestWeeklyLeaderboard);
    };
  }, [socket, connected]);




  // ... (Your imports like router, toast, etc)

  if (!fullHouseGame || fullHouseGame.status === 'finished') {
    return (
      <div className="px-4 py-3">
        <div className="relative bg-white/[0.03] backdrop-blur-2xl rounded-[2rem] border border-white/10 p-6 shadow-2xl overflow-hidden group">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-brand-primary/10 rounded-full blur-[100px] group-hover:bg-brand-primary/20 transition-colors duration-700" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-brand-secondary/10 rounded-full blur-[100px]" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="inline-flex items-center gap-2 text-[9px] font-black tracking-[0.2em] text-brand-primary bg-brand-primary/10 border border-brand-primary/20 rounded-full px-5 py-2 mb-6 uppercase">
              <span className="animate-pulse">✨</span> {am.weeklyHallOfFame}
            </div>

            <ul className="w-full space-y-3">
              {leadersLoading
                ? [1, 2, 3].map((i) => (
                  <li key={`loader-${i}`} className="h-16 bg-white/[0.02] rounded-2xl animate-pulse border border-white/5" />
                ))
                : weeklyLeaders.length > 0
                  ? weeklyLeaders.map((leader, index) => {
                    const displayName = getDisplayName({
                      firstName: leader.firstName,
                      username: leader.username,
                      phoneNumber: leader.phoneNumber,
                    }) || am.playerFallback(index + 1);
                    const medals = ['🥇', '🥈', '🥉'];
                    const Colors = ['text-amber-400', 'text-slate-300', 'text-amber-700'];

                    return (
                      <li
                        key={leader.userId ?? leader.telegramId ?? `${displayName}-${index}`}
                        className="flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-300 px-5 py-4 rounded-2xl border border-white/[0.05] hover:border-white/10"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`text-2xl ${Colors[index] || 'text-white'}`}>{medals[index] || '⭐'}</div>
                          <div>
                            <p className="text-sm font-black text-white tracking-tight leading-tight">{displayName}</p>
                            {leader.username && (
                              <p className="text-[10px] text-gray-500 font-bold mt-0.5 tracking-tight italic">@{leader.username}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-brand-accent">
                            {Number(leader.totalEarnings ?? 0).toLocaleString()} <span className="text-[9px] uppercase">{am.etb}</span>
                          </p>
                          <p className="text-[8px] uppercase tracking-widest text-gray-500 font-black mt-1">{leader.totalWins} {am.victories}</p>
                        </div>
                      </li>
                    );
                  })
                  : <li className="text-gray-500 text-[10px] py-8 font-bold uppercase tracking-widest text-center opacity-50">{am.waitingForChampions}</li>
              }
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // return (
  //   <div className="px-4 py-3">
  //     <motion.div
  //       initial={{ opacity: 0, y: 10 }}
  //       animate={{ opacity: 1, y: 0 }}
  //       className="relative bg-slate-900 border border-white/10 rounded-3xl shadow-2xl p-5 overflow-hidden"
  //     >
  //       {/* Decorative Gradient Overlay */}
  //       <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/20 rounded-full blur-3xl" />
  //       <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-600/20 rounded-full blur-3xl" />

  //       {/* Header Section */}
  //       <div className="relative z-10 text-center space-y-1 mb-4">
  //         <span className="text-[10px] font-black tracking-[0.2em] text-indigo-400 uppercase">Tournament Live</span>
  //         <h2 className="text-2xl font-black text-white tracking-tight">
  //           የፉል ሃውስ <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">ታላቅ ውድድር</span>
  //         </h2>
  //       </div>

  //       {/* Stats Grid */}
  //       <div className="relative z-10 grid grid-cols-2 gap-2 mb-4">
  //         <div className="bg-white/5 border border-white/5 p-3 rounded-2xl flex flex-col items-center">
  //           <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Prize Pool</span>
  //           <span className="text-lg font-black text-white">
  //             {fullHouseGame.possibleWin?.toLocaleString() || '---'} <span className="text-[10px] text-indigo-400">ETB</span>
  //           </span>
  //         </div>
  //         <div className="bg-white/5 border border-white/5 p-3 rounded-2xl flex flex-col items-center">
  //           <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Entry Fee</span>
  //           <span className="text-lg font-black text-white">
  //             {fullHouseGame.bet} <span className="text-[10px] text-indigo-400">ETB</span>
  //           </span>
  //         </div>
  //       </div>

  //       {/* Status Bar */}
  //       <div className="relative z-10 flex items-center justify-between px-2 mb-4">
  //         <div className="flex items-center gap-2">
  //           <div className={`w-2 h-2 rounded-full animate-pulse ${fullHouseGame.status === 'started' ? 'bg-green-400' : 'bg-indigo-400'}`} />
  //           <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{fullHouseGame.status}</span>
  //         </div>
  //         <div className="text-[10px] font-bold text-slate-300">
  //           👤 {fullHouseGame.players.length} <span className="text-slate-500">/ {fullHouseGame.maxPlayers || 10} Players</span>
  //         </div>
  //       </div>

  //       {/* Countdown Area */}
  //       <div className="relative z-10 py-2 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 mb-5">
  //         <CountdownBox timeLeft={timeLeft} />
  //       </div>

  //       {/* Action Button */}
  //       <button
  //         className="relative w-full group overflow-hidden bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition-all duration-300 active:scale-95 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
  //         onClick={() => {
  //           if (!connected) {
  //             toast.error("⚠️ Not connected to server.");
  //             return;
  //           }
  //           sessionStorage.setItem(SELECTED_GAME_DATA, JSON.stringify({
  //             gameId: fullHouseGame.id,
  //             bet: fullHouseGame.bet,
  //             isTournament: true,
  //             tournamentId: fullHouseGame.id
  //           }));
  //           watchGame(fullHouseGame.bet);
  //           router.push('/cards');
  //         }}
  //       >
  //         <span className="relative z-10 flex items-center justify-center gap-2 text-sm tracking-wider uppercase">
  //           🔥 ካርቴላ ይግዙ
  //         </span>
  //         {/* Button Reflection */}
  //         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shine_1.5s_ease-in-out_infinite]" />
  //       </button>
  //     </motion.div>
  //   </div>
  // );


  return (
    <div className="px-4 py-3 flex justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl p-6 overflow-hidden group"
      >
        {/* Decorative Gradients */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary/10 rounded-full blur-[80px] group-hover:bg-brand-primary/20 transition-colors duration-700" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-secondary/10 rounded-full blur-[80px]" />

        {/* Header Section */}
        <div className="relative z-10 text-center mb-5">
          <div className="inline-flex items-center gap-1 text-[8px] font-black tracking-[0.3em] text-brand-primary uppercase bg-brand-primary/5 px-3 py-1 rounded-full border border-brand-primary/10 mb-2">
            <span className="w-1 h-1 rounded-full bg-brand-primary animate-ping" />
            {am.tournamentLive}
          </div>
          <h2 className="text-xl font-black text-white tracking-tight leading-tight mt-1">
            የፉል ሃውስ <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-[#a855f7]">ታላቅ ውድድር</span>
          </h2>
        </div>

        {/* Stats Grid */}
        <div className="relative z-10 grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl flex flex-col items-center hover:bg-white/[0.05] transition-colors">
            <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">{am.prizePool}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-white tracking-tighter">
                {fullHouseGame.possibleWin?.toLocaleString() || '---'}
              </span>
              <span className="text-[10px] font-black text-brand-primary">{am.etb}</span>
            </div>
          </div>
          <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl flex flex-col items-center hover:bg-white/[0.05] transition-colors">
            <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">{am.entryFee}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-white tracking-tighter">
                {fullHouseGame.bet}
              </span>
              <span className="text-[10px] font-black text-brand-primary">{am.etb}</span>
            </div>
          </div>
        </div>

        {/* Status & Players */}
        <div className="relative z-10 flex items-center justify-between px-2 mb-5">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${fullHouseGame.status === 'started' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse' : 'bg-brand-primary'}`} />
            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">{translateGameStatus(fullHouseGame.status)}</span>
          </div>
          <div className="text-[10px] font-black text-gray-300">
            <span className="text-brand-secondary">👤 {fullHouseGame.players.length}</span>
            <span className="text-gray-600 ml-1">/ {fullHouseGame.maxPlayers || 10} {am.joined}</span>
          </div>
        </div>

        {/* Countdown Area */}
        <div className="relative z-10 py-3 bg-white/[0.02] rounded-2xl border border-white/5 mb-6 group-hover:border-white/10 transition-colors">
          <div className="scale-95 origin-center">
            <CountdownBox timeLeft={timeLeft} />
          </div>
        </div>

        {/* Action Button */}
        <button
          className="relative w-full group overflow-hidden bg-brand-primary hover:bg-brand-primary/90 text-white font-black py-4 rounded-2xl transition-all duration-300 active:scale-[0.98] shadow-[0_0_20px_rgba(99,102,241,0.3)] border border-brand-primary/20"
          onClick={() => {
            if (!connected) {
              toast.error(am.notConnected);
              return;
            }
            sessionStorage.setItem(SELECTED_GAME_DATA, JSON.stringify({
              gameId: fullHouseGame.id,
              bet: fullHouseGame.bet,
              isTournament: true,
              tournamentId: fullHouseGame.id
            }));
            watchGame(fullHouseGame.bet);
            router.push('/cards');
          }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2 text-xs tracking-[0.2em] uppercase">
            🔥 ካርቴላ ይግዙ
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shine_1.5s_ease-in-out_infinite]" />
        </button>
      </motion.div>
    </div>
  );

}


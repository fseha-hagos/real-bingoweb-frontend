export default function LeaderboardSkeleton() {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 rounded-md bg-black/20 animate-pulse"
          >
            {/* Left side (rank + name) */}
            <div className="flex items-center gap-3 w-2/3">
              {/* Rank placeholder */}
              <div className="w-8 h-5 bg-gray-700/40 rounded-md" />
  
              <div className="flex flex-col gap-2 flex-1">
                {/* Name placeholder */}
                <div className="w-1/2 h-3 bg-gray-600/50 rounded-md" />
                {/* Username placeholder */}
                <div className="w-1/3 h-2 bg-gray-700/50 rounded-md" />
              </div>
            </div>
  
            {/* Right side (stats) */}
            <div className="text-right flex flex-col items-end gap-2 w-1/3">
              <div className="w-10 h-3 bg-gray-600/50 rounded-md" />
              <div className="w-16 h-2 bg-gray-700/50 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  
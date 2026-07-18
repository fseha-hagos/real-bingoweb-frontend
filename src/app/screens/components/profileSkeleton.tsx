"use client";

export default function ProfileSkeleton() {
  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="bg-black/50 backdrop-blur-md p-6 rounded-lg text-white shadow-lg animate-pulse">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {/* Avatar circle */}
            <div className="w-14 h-14 rounded-full bg-gray-700/50" />
            <div className="flex flex-col gap-2">
              {/* Username */}
              <div className="w-32 h-4 bg-gray-700/40 rounded-md" />
              {/* Phone */}
              <div className="w-24 h-3 bg-gray-800/40 rounded-md" />
            </div>
          </div>

          <div className="text-right">
            <div className="w-16 h-3 bg-gray-700/40 rounded-md mb-2 ml-auto" />
            <div className="w-20 h-4 bg-gray-600/50 rounded-md ml-auto" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5 text-center">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-black/30 p-3 rounded-md flex flex-col items-center gap-2"
            >
              <div className="w-8 h-4 bg-gray-700/50 rounded-md" />
              <div className="w-12 h-3 bg-gray-800/40 rounded-md" />
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex justify-around border-b border-gray-700 mb-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="w-20 h-6 bg-gray-700/40 rounded-md"
            />
          ))}
        </div>

        {/* Tab Content Placeholder */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-black/30 rounded-md p-3 flex justify-between items-center"
            >
              <div className="flex flex-col gap-2">
                <div className="w-32 h-3 bg-gray-700/50 rounded-md" />
                <div className="w-24 h-2 bg-gray-800/50 rounded-md" />
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                <div className="w-16 h-3 bg-gray-700/50 rounded-md" />
                <div className="w-12 h-2 bg-gray-800/50 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';
import React from 'react';
import BingoBallStrip from '../game/components/bingoBallStrip';

const getLetter = (num: number) => {
    if (num >= 1 && num <= 15) return 'B';
    if (num >= 16 && num <= 30) return 'I';
    if (num >= 31 && num <= 45) return 'N';
    if (num >= 46 && num <= 60) return 'G';
    return 'O';
};

export default function DebugAnimPage() {
    // Mock data: last 3 numbers, with 42 being the latest "current" one
    const lastThree = [10, 25, 42];
    const current = 42;

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center flex-col gap-10">
            <h1 className="text-white text-2xl">Bingo Ball Animation Debug</h1>

            <div className="w-[400px]">
                <BingoBallStrip
                    lastThree={lastThree}
                    current={current}
                    getLetter={getLetter}
                />
            </div>

            <div className="w-[400px]">
                <p className="text-white mb-2">Another State (different current)</p>
                <BingoBallStrip
                    lastThree={[5, 12, 60]}
                    current={60}
                    getLetter={getLetter}
                />
            </div>
        </div>
    );
}

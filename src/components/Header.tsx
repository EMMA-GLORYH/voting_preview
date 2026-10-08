'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Volume2, VolumeX, Radio, Vote, Tv, Shield, Activity } from 'lucide-react';
import { sounds } from '@/lib/sound-effects';
import { fetchElectionState, subscribeToElectionRealtime } from '@/lib/voting-service';
import { ElectionState } from '@/types/voting';

export default function Header() {
  const pathname = usePathname();
  const [electionState, setElectionState] = useState<ElectionState | null>(null);
  const [isSoundOn, setIsSoundOn] = useState(true);

  useEffect(() => {
    setIsSoundOn(sounds.isEnabled());
    const loadState = async () => {
      const state = await fetchElectionState();
      setElectionState(state);
    };
    loadState();

    const unsubscribe = subscribeToElectionRealtime(() => {
      loadState();
    });
    return () => unsubscribe();
  }, []);

  const handleToggleSound = () => {
    const nextVal = sounds.toggleSound();
    setIsSoundOn(nextVal);
  };

  const getStatusBadge = () => {
    if (!electionState) return null;
    switch (electionState.status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 live-dot"></span>
            LIVE VOTING OPEN
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            VOTING PAUSED
          </span>
        );
      case 'ended':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            ELECTION CONCLUDED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 border border-white/20 text-neutral-300">
            <span className="w-2 h-2 rounded-full bg-neutral-400"></span>
            SETUP MODE
          </span>
        );
    }
  };

  // Minimal mode on kiosk or full live projector
  const isKiosk = pathname === '/vote';

  return (
    <header className="border-b border-white/10 bg-[#080a10]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand / School Info */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white to-neutral-400 flex items-center justify-center text-black font-extrabold text-lg shadow-lg group-hover:scale-105 transition-transform">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base tracking-tight">
                  {electionState?.school_name || 'St. Peter Basic School'}
                </span>
                <span className="hidden md:inline-block text-[11px] font-mono tracking-widest uppercase bg-white/10 px-2 py-0.5 rounded text-neutral-300 border border-white/10">
                  Antigravity Core
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-medium">
                {electionState?.election_title || 'Student Prefectorial Elections'}
              </p>
            </div>
          </Link>
        </div>

        {/* Status Pill & Realtime Counter */}
        <div className="hidden lg:flex items-center gap-4">
          {getStatusBadge()}
          {electionState && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-neutral-400">Ballots Cast:</span>
              <span className="font-bold text-white font-mono text-sm">
                {electionState.total_ballots_cast.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        {!isKiosk && (
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/vote"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                pathname === '/vote'
                  ? 'bg-white text-black font-semibold'
                  : 'text-neutral-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Vote className="w-4 h-4" />
              <span>Vote Kiosk</span>
            </Link>

            <Link
              href="/"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                pathname === '/' || pathname === '/live'
                  ? 'bg-white text-black font-semibold'
                  : 'text-neutral-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Tv className="w-4 h-4" />
              <span>Live Dashboard</span>
            </Link>

            <Link
              href="/admin"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                pathname === '/admin'
                  ? 'bg-white text-black font-semibold'
                  : 'text-neutral-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Admin</span>
            </Link>

            {/* Audio Toggle */}
            <button
              onClick={handleToggleSound}
              title={isSoundOn ? 'Mute sound effects' : 'Unmute sound effects'}
              className="p-2 ml-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              {isSoundOn ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-neutral-500" />}
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}

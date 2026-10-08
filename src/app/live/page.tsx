'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import {
  Tv,
  Maximize2,
  Minimize2,
  Radio,
  Trophy,
  Crown,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Award,
  Activity,
  Vote,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import {
  fetchPositions,
  fetchCandidates,
  fetchElectionState,
  computeLiveResults,
  subscribeToElectionRealtime,
} from '@/lib/voting-service';
import { Position, Candidate, ElectionState, LivePositionResult } from '@/types/voting';
import { sounds } from '@/lib/sound-effects';

export default function LiveProjectionPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [electionState, setElectionState] = useState<ElectionState | null>(null);
  const [liveResults, setLiveResults] = useState<LivePositionResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Projection modes: 'carousel' (rotates automatically) | 'all' (all positions) | 'focus' (single)
  const [viewMode, setViewMode] = useState<'carousel' | 'all'>('carousel');
  const [activePositionIndex, setActivePositionIndex] = useState(0);
  const [isAutoCycling, setIsAutoCycling] = useState(true);
  const [cycleSecondsLeft, setCycleSecondsLeft] = useState(10);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const previousVoteTotalRef = useRef<number>(0);

  const loadData = async (isRealtimeTrigger: boolean = false) => {
    try {
      const [posList, candList, state] = await Promise.all([
        fetchPositions(),
        fetchCandidates(),
        fetchElectionState(),
      ]);

      const sortedPositions = posList.sort((a, b) => a.display_order - b.display_order);
      setPositions(sortedPositions);
      setCandidates(candList);
      setElectionState(state);
      setLiveResults(computeLiveResults(sortedPositions, candList));

      // Play audio ping if vote total changed
      if (isRealtimeTrigger && state.total_ballots_cast > previousVoteTotalRef.current) {
        sounds.playVotePing();
      }
      previousVoteTotalRef.current = state.total_ballots_cast;

      // If election just ended, trigger celebration
      if (state.status === 'ended') {
        sounds.playVictoryFanfare();
        try {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.5 },
            colors: ['#ffffff', '#00f0ff', '#ffd700'],
          });
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsSoundOn(sounds.isEnabled());
    loadData(false);

    const unsubscribe = subscribeToElectionRealtime(() => {
      loadData(true);
    });

    return () => unsubscribe();
  }, []);

  // Auto-Cycling Timer for Auditorium Carousel
  useEffect(() => {
    if (!isAutoCycling || viewMode !== 'carousel' || positions.length <= 1) return;

    const interval = setInterval(() => {
      setCycleSecondsLeft((prev) => {
        if (prev <= 1) {
          setActivePositionIndex((curr) => (curr + 1) % positions.length);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isAutoCycling, viewMode, positions.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleToggleSound = () => {
    const next = sounds.toggleSound();
    setIsSoundOn(next);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080a10] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-base font-semibold tracking-wider font-mono">
            CONNECTING TO LIVE AUDITORIUM FEED...
          </span>
        </div>
      </div>
    );
  }

  const currentResult = liveResults[activePositionIndex] || liveResults[0];
  const isElectionEnded = electionState?.status === 'ended';

  return (
    <div className="min-h-screen bg-[#080a10] text-white flex flex-col justify-between selection:bg-cyan-400 selection:text-black">
      {/* Projection Top HUD Bar */}
      <header className="border-b border-white/10 px-6 sm:px-10 py-4 bg-[#080a10]/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* School & Election Title */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-12 h-12 rounded-2xl bg-white text-black font-black flex items-center justify-center text-xl shadow-lg">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-white text-lg sm:text-xl tracking-tight">
                    {electionState?.school_name}
                  </h1>
                  <span className="hidden lg:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    <Radio className="w-3 h-3 animate-pulse" />
                    LIVE PROJECTOR FEED
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400 font-medium">
                  {electionState?.election_title}
                </p>
              </div>
            </Link>
          </div>

          {/* Center Status & Turnout Ticker */}
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/15">
              <Vote className="w-5 h-5 text-cyan-400" />
              <div>
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest block">
                  Total Ballots Cast
                </span>
                <span className="font-extrabold text-white font-mono text-lg sm:text-2xl leading-none">
                  {electionState?.total_ballots_cast.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Mode Controls */}
            <div className="hidden md:flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10">
              <button
                onClick={() => setViewMode('carousel')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  viewMode === 'carousel'
                    ? 'bg-white text-black shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Auto Focus
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  viewMode === 'all'
                    ? 'bg-white text-black shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                All Positions
              </button>
            </div>
          </div>

          {/* Right Action Icons (Sound, Fullscreen, Admin) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSound}
              title={isSoundOn ? 'Sound On' : 'Sound Muted'}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/15 text-neutral-300 hover:text-white transition-colors"
            >
              {isSoundOn ? <Volume2 className="w-5 h-5 text-cyan-400" /> : <VolumeX className="w-5 h-5 text-neutral-500" />}
            </button>

            <button
              onClick={toggleFullscreen}
              title="Fullscreen (F11)"
              className="p-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 transition-colors shadow-lg"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Projection Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-8 py-6 w-full flex flex-col justify-center">
        {/* VIEW MODE 1: FOCUS / CAROUSEL ROTATION */}
        {viewMode === 'carousel' && currentResult && (
          <div className="space-y-6">
            {/* Position Carousel Navigator Pills */}
            <div className="flex items-center justify-between gap-3 overflow-x-auto pb-2 scrollbar-none">
              <div className="flex items-center gap-2 flex-wrap">
                {liveResults.map((result, idx) => (
                  <button
                    key={result.position.id}
                    onClick={() => {
                      setActivePositionIndex(idx);
                      setCycleSecondsLeft(10);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                      activePositionIndex === idx
                        ? 'bg-white text-black shadow-lg shadow-white/20 scale-105'
                        : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10'
                    }`}
                  >
                    <span>{result.position.title}</span>
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                        activePositionIndex === idx
                          ? 'bg-black/10 text-black font-semibold'
                          : 'bg-white/10 text-neutral-400'
                      }`}
                    >
                      {result.totalVotesForPosition}
                    </span>
                  </button>
                ))}
              </div>

              {/* Play / Pause Cycle Controls */}
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsAutoCycling(!isAutoCycling)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-neutral-300"
                >
                  {isAutoCycling ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Next in {cycleSecondsLeft}s</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Cycle Paused</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Active Position Showcase Card */}
            <div className="antigravity-card rounded-3xl p-6 sm:p-10 border-2 border-white/20 relative overflow-hidden shadow-2xl space-y-8">
              {/* Position Header Banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/15 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">
                      Contested Office
                    </span>
                    {isElectionEnded && (
                      <span className="px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5" />
                        WINNER DECLARED
                      </span>
                    )}
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black text-white mt-1 tracking-tight">
                    {currentResult.position.title}
                  </h2>
                  {currentResult.position.description && (
                    <p className="text-sm text-neutral-400 mt-1">
                      {currentResult.position.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  <div>
                    <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
                      Votes Recorded
                    </span>
                    <span className="font-extrabold text-white text-xl sm:text-2xl font-mono">
                      {currentResult.totalVotesForPosition}
                    </span>
                  </div>
                </div>
              </div>

              {/* Candidate Broadcast Leaderboard Rows */}
              <div className="space-y-5">
                {currentResult.candidates.length === 0 ? (
                  <p className="text-neutral-500 text-center py-10 font-medium">
                    No candidates registered for this position.
                  </p>
                ) : (
                  currentResult.candidates.map((candidate) => {
                    const rank = candidate.rank;
                    const isTopScorer = rank === 1;
                    const isSecondTopScorer = rank === 2;
                    const isBelowTopTwo = rank > 2;

                    let cardClasses = '';
                    let rankBadgeClasses = '';
                    let progressBarGradient = '';
                    let scoreBadge = null;

                    if (isTopScorer) {
                      // Top Scorer (Rank 1): Pure White & Glowing Antigravity Cyan
                      cardClasses =
                        'bg-gradient-to-r from-white/10 via-cyan-500/10 to-transparent border-2 border-cyan-400 shadow-xl shadow-cyan-500/10';
                      rankBadgeClasses = 'bg-white text-black shadow-lg shadow-white/30 font-black';
                      progressBarGradient = 'bg-gradient-to-r from-cyan-400 via-white to-cyan-300 shadow-lg shadow-cyan-400/30';
                      scoreBadge = (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 flex items-center gap-1">
                          <Crown className="w-3.5 h-3.5 text-cyan-400" />
                          TOP SCORER
                        </span>
                      );
                    } else if (isSecondTopScorer) {
                      // Second Top Scorer (Rank 2): Sky Blue
                      cardClasses = 'bg-white/[0.05] border border-sky-400/50 shadow-md';
                      rankBadgeClasses = 'bg-sky-400/20 text-sky-200 border border-sky-400/40 font-bold';
                      progressBarGradient = 'bg-gradient-to-r from-sky-400 to-sky-200';
                      scoreBadge = (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-sky-400/10 text-sky-300 border border-sky-400/30">
                          2ND TOP SCORER
                        </span>
                      );
                    } else {
                      // Below Top Two (Rank 3+): RED
                      cardClasses = 'bg-red-500/[0.04] border border-red-500/35 hover:border-red-500/50';
                      rankBadgeClasses = 'bg-red-500/20 text-red-400 border border-red-500/40 font-bold';
                      progressBarGradient = 'bg-gradient-to-r from-red-500 to-rose-400';
                      scoreBadge = (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                          BELOW TOP TWO
                        </span>
                      );
                    }

                    return (
                      <div
                        key={candidate.id}
                        className={`rounded-2xl p-5 sm:p-6 transition-all duration-300 relative ${cardClasses}`}
                      >
                        {/* Top row: Rank, Details, and Percentage */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-4">
                            {/* Rank Indicator */}
                            <div
                              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-lg sm:text-xl shrink-0 ${rankBadgeClasses}`}
                            >
                              {isTopScorer ? (
                                <Crown className="w-6 h-6 stroke-[2.5]" />
                              ) : (
                                `#${rank}`
                              )}
                            </div>

                            {/* Candidate Info */}
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-extrabold text-white text-xl sm:text-2xl tracking-tight">
                                  {candidate.full_name}
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-white/10 text-neutral-200 border border-white/10">
                                  {candidate.class_grade}
                                </span>
                                {scoreBadge}
                              </div>
                              {candidate.manifesto && (
                                <p className="text-xs text-neutral-400 line-clamp-1 italic mt-0.5">
                                  &ldquo;{candidate.manifesto}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Stat Numbers */}
                          <div className="flex items-baseline gap-3 shrink-0 sm:text-right">
                            <span
                              className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                                isBelowTopTwo ? 'text-red-400' : 'text-white'
                              }`}
                            >
                              {candidate.percentage}%
                            </span>
                            <span className="text-sm sm:text-base font-mono text-neutral-400">
                              ({candidate.vote_count.toLocaleString()} votes)
                            </span>
                          </div>
                        </div>

                        {/* Animated Percentage Progress Bar */}
                        <div className="w-full h-3 sm:h-4 rounded-full bg-white/10 overflow-hidden relative">
                          <div
                            className={`h-full rounded-full progress-fill ${progressBarGradient}`}
                            style={{ width: `${Math.max(candidate.percentage, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW MODE 2: ALL CONTENDED POSITIONS GRID */}
        {viewMode === 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {liveResults.map((result) => (
              <div
                key={result.position.id}
                className="antigravity-card rounded-3xl p-6 sm:p-7 border border-white/15 space-y-5"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-white">
                      {result.position.title}
                    </h3>
                    <p className="text-xs text-neutral-400 font-mono mt-0.5">
                      {result.totalVotesForPosition} total votes
                    </p>
                  </div>
                  {isElectionEnded && (
                    <Crown className="w-5 h-5 text-amber-400" />
                  )}
                </div>

                <div className="space-y-3">
                  {result.candidates.map((cand) => (
                    <div
                      key={cand.id}
                      className={`p-3.5 rounded-xl transition-all ${
                        cand.rank === 1 && cand.vote_count > 0
                          ? 'bg-white/10 border border-white/20'
                          : 'bg-white/[0.02] border border-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white truncate max-w-[180px]">
                            {cand.full_name}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-neutral-300">
                            {cand.class_grade}
                          </span>
                          {cand.rank === 1 && cand.vote_count > 0 && (
                            <span className="text-[10px] text-cyan-400 font-bold uppercase">
                              Lead
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-extrabold text-white">
                          {cand.percentage}% ({cand.vote_count})
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full progress-fill ${
                            cand.rank === 1 ? 'bg-cyan-400' : 'bg-white/70'
                          }`}
                          style={{ width: `${Math.max(cand.percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Projection Bottom Ticker Bar */}
      <footer className="border-t border-white/10 py-3.5 px-6 sm:px-10 bg-[#080a10]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 live-dot"></span>
            <span className="font-mono text-neutral-300 font-semibold">
              Live WebSocket Channel Active
            </span>
            <span className="text-neutral-500">•</span>
            <span>Zero Student Names Stored (Anonymous Ballot)</span>
          </div>

          <div className="flex items-center gap-4">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">F11</kbd> for Fullscreen</span>
            <Link
              href="/vote"
              className="text-white hover:text-cyan-400 font-semibold underline underline-offset-4"
            >
              Open Voting Kiosk ↗
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

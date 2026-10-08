'use client';

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Crown,
  Trophy,
  LayoutGrid,
  RefreshCw,
  Settings,
  X,
  Check,
  Award,
  Sparkles,
} from 'lucide-react';
import {
  fetchPositions,
  fetchCandidates,
  fetchElectionState,
  computeLiveResults,
  subscribeToElectionRealtime,
  syncFromGoogleSheets,
  getPrimarySheetId,
  setPrimarySheetId,
} from '@/lib/voting-service';
import { Position, Candidate, ElectionState, LivePositionResult } from '@/types/voting';
import { sounds } from '@/lib/sound-effects';

// Distinct vibrant palette matching the reference poll design
const BAR_COLORS = [
  'bg-[#3b82f6]', // Royal Blue (Leading)
  'bg-[#22c55e]', // Vibrant Green
  'bg-[#f59e0b]', // Golden Amber
  'bg-[#f43f5e]', // Vibrant Rose
  'bg-[#06b6d4]', // Sky Cyan
  'bg-[#a855f7]', // Purple
  'bg-[#ec4899]', // Pink
  'bg-[#14b8a6]', // Teal
];

export default function MeetingPulseLivePoll() {
  const [department, setDepartment] = useState<'jhs' | 'primary'>('jhs');
  const [viewMode, setViewMode] = useState<'slideshow' | 'callout'>('slideshow');

  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [electionState, setElectionState] = useState<ElectionState | null>(null);
  const [liveResults, setLiveResults] = useState<LivePositionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptInfo, setDeptInfo] = useState<string | null>(null);

  // Position index
  const [activePositionIndex, setActivePositionIndex] = useState(0);
  const [isAutoCycling, setIsAutoCycling] = useState(true);
  const [cycleSecondsLeft, setCycleSecondsLeft] = useState(10);

  // Audio & Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const previousVoteTotalRef = useRef<number>(0);

  // Primary Sheet ID Modal
  const [showSheetSettings, setShowSheetSettings] = useState(false);
  const [customPrimarySheetInput, setCustomPrimarySheetInput] = useState('');
  const [sheetSaveMessage, setSheetSaveMessage] = useState<string | null>(null);

  const loadData = async (
    isRealtimeTrigger: boolean = false,
    targetDept: 'jhs' | 'primary' = department,
    forceRefresh: boolean = false
  ) => {
    try {
      const live = await syncFromGoogleSheets(targetDept, forceRefresh);

      if (live?.isLive) {
        const sortedPositions = (live.positions || []).sort((a, b) => a.display_order - b.display_order);
        setPositions(sortedPositions);
        setCandidates(live.candidates || []);

        const state: ElectionState = {
          id: 1,
          status: 'active',
          school_name: live.schoolName || (targetDept === 'primary' ? "ST. MICHAEL'S SCHOOL - PRIMARY" : "ST. MICHAEL'S SCHOOL"),
          election_title: live.electionTitle || 'PREFECTORIAL ELECTIONS 2026/2027',
          total_ballots_cast: live.totalVotes || 0,
          kiosk_pin: '1234',
        };

        setElectionState(state);
        setLiveResults(computeLiveResults(sortedPositions, live.candidates || []));
        setDeptInfo(live.info || null);

        // Audio ping when votes increase
        if (isRealtimeTrigger && state.total_ballots_cast > previousVoteTotalRef.current) {
          sounds.playVotePing();
        }
        previousVoteTotalRef.current = state.total_ballots_cast;
      } else {
        // Fallback only if Google Sheets is completely disconnected
        const posList = await fetchPositions();
        const candList = await fetchCandidates();
        const state = await fetchElectionState();

        const sortedPositions = (posList || []).sort((a, b) => a.display_order - b.display_order);
        setPositions(sortedPositions);
        setCandidates(candList || []);
        setElectionState(state);
        setLiveResults(computeLiveResults(sortedPositions, candList || []));
        setDeptInfo(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsSoundOn(sounds.isEnabled());
    setCustomPrimarySheetInput(getPrimarySheetId());
    loadData(false, department);

    const unsubscribe = subscribeToElectionRealtime(() => {
      loadData(true, department);
    });

    return () => unsubscribe();
  }, [department]);

  // Handle department switch
  const handleDepartmentSwitch = (newDept: 'jhs' | 'primary') => {
    if (newDept === department) return;
    setDepartment(newDept);
    setActivePositionIndex(0);
    setLoading(true);
    loadData(false, newDept, true);
  };

  // Keyboard navigation (< and > arrow keys)
  useEffect(() => {
    if (viewMode !== 'slideshow') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [liveResults.length, viewMode]);

  // Slideshow auto-cycle
  useEffect(() => {
    if (!isAutoCycling || liveResults.length <= 1 || viewMode !== 'slideshow') return;

    const interval = setInterval(() => {
      setCycleSecondsLeft((prev) => {
        if (prev <= 1) {
          setActivePositionIndex((curr) => (curr + 1) % liveResults.length);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isAutoCycling, liveResults.length, viewMode]);

  const handlePrev = () => {
    setActivePositionIndex((curr) => (curr === 0 ? liveResults.length - 1 : curr - 1));
    setCycleSecondsLeft(10);
  };

  const handleNext = () => {
    setActivePositionIndex((curr) => (curr + 1) % liveResults.length);
    setCycleSecondsLeft(10);
  };

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

  const handleSavePrimarySheet = () => {
    let cleanId = customPrimarySheetInput.trim();
    // Support extracting sheet ID from full Google Spreadsheet URL
    const match = cleanId.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      cleanId = match[1];
    }
    setPrimarySheetId(cleanId);
    setSheetSaveMessage('Saved successfully! Reloading Primary live feed...');
    setTimeout(() => {
      setShowSheetSettings(false);
      setSheetSaveMessage(null);
      if (department === 'primary') {
        loadData(false, 'primary', true);
      }
    }, 1200);
  };

  const triggerCallOutFanfare = () => {
    sounds.playVictoryFanfare();
    try {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.4 },
        colors: ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899'],
      });
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111c33] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold tracking-wider font-mono text-slate-300">
            Loading Live Results for {department === 'primary' ? 'Primary' : 'JHS'} Department...
          </span>
        </div>
      </div>
    );
  }

  const currentResult = liveResults[activePositionIndex] || liveResults[0];
  const totalVotesForPosition = currentResult?.totalVotesForPosition || 0;
  const totalBallots = electionState?.total_ballots_cast || 0;

  return (
    <div className="h-screen max-h-screen flex flex-col justify-between bg-[#111c33] text-white font-sans selection:bg-blue-500 selection:text-white relative overflow-hidden select-none">
      {/* Subtle Polygonal Background Accents */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 25%, #2563eb 0%, transparent 60%),
                            linear-gradient(135deg, rgba(255,255,255,0.05) 25%, transparent 25%),
                            linear-gradient(225deg, rgba(255,255,255,0.05) 25%, transparent 25%)`,
          backgroundSize: '100% 100%, 60px 60px, 60px 60px',
        }}
      />

      {/* 1. TOP PURPLE BANNER (With Department Switcher & Final Results Switcher) */}
      <header className="relative z-10 bg-[#4e265c] text-white px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between shadow-md shrink-0 gap-2">
        {/* Left: Department Switcher Buttons + School Name */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Department Switcher Pill Group */}
          <div className="flex items-center p-0.5 bg-black/40 rounded-xl border border-purple-300/25">
            <button
              onClick={() => handleDepartmentSwitch('jhs')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-black transition-all ${
                department === 'jhs'
                  ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-300/40'
                  : 'text-purple-200 hover:text-white hover:bg-white/10'
              }`}
            >
              JHS Department
            </button>
            <button
              onClick={() => handleDepartmentSwitch('primary')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-black transition-all ${
                department === 'primary'
                  ? 'bg-emerald-600 text-white shadow-md ring-1 ring-emerald-300/40'
                  : 'text-purple-200 hover:text-white hover:bg-white/10'
              }`}
            >
              Primary Department
            </button>
          </div>

          <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-purple-900/60 text-purple-200 border border-purple-400/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            LIVE
          </span>
        </div>

        {/* Center: Title */}
        <div className="hidden lg:flex items-center gap-2 text-xs sm:text-sm font-semibold truncate text-purple-200">
          <span>Vote now for:</span>
          <span className="font-black tracking-wide text-white truncate uppercase">
            ST. MICHAEL&apos;S SCHOOL ({department === 'primary' ? 'PRIMARY' : 'JHS'})
          </span>
        </div>

        {/* Right: View Switcher (Slideshow vs Final Results Call-Out) + Chevrons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Final Results Call-Out Toggle Button */}
          <button
            onClick={() => setViewMode(viewMode === 'slideshow' ? 'callout' : 'slideshow')}
            className={`flex items-center gap-1.5 px-3 py-1 sm:py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm ${
              viewMode === 'callout'
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 ring-2 ring-amber-300/50'
                : 'bg-white/15 text-white hover:bg-white/25 border border-white/20'
            }`}
            title={
              viewMode === 'slideshow'
                ? 'Switch to All Categories / Final Results Call-Out Board'
                : 'Return to Single Portfolio Slideshow'
            }
          >
            {viewMode === 'slideshow' ? (
              <>
                <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
                <span className="hidden xs:inline">Final Results Call-Out</span>
                <span className="xs:hidden">All Results</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Slideshow View</span>
              </>
            )}
          </button>

          {/* Primary Form Link / Settings (only if on primary department) */}
          {department === 'primary' && (
            <button
              onClick={() => setShowSheetSettings(true)}
              title="Configure Primary Google Sheet link"
              className="w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-purple-200 hover:text-white flex items-center justify-center transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Previous / Next Chevrons (Only active in slideshow view) */}
          {viewMode === 'slideshow' && liveResults.length > 0 && (
            <>
              <span className="text-xs font-mono text-purple-200 mr-0.5 sm:mr-1">
                {activePositionIndex + 1} / {liveResults.length}
              </span>
              <button
                onClick={handlePrev}
                title="Previous Position (Left Arrow)"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/30 hover:bg-black/50 active:scale-95 flex items-center justify-center transition-all"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </button>
              <button
                onClick={handleNext}
                title="Next Position (Right Arrow)"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/30 hover:bg-black/50 active:scale-95 flex items-center justify-center transition-all"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Primary Department Info / Notice (if tab not found) */}
      {deptInfo && (
        <div className="bg-amber-950/90 border-b border-amber-500/40 px-4 py-2 text-xs sm:text-sm text-amber-200 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <span className="font-bold">Notice:</span>
            <span>{deptInfo}</span>
          </div>
          <button
            onClick={() => setShowSheetSettings(true)}
            className="underline font-bold text-amber-300 hover:text-white ml-3 shrink-0"
          >
            Configure Sheet ID
          </button>
        </div>
      )}

      {/* VIEW MODE 1: SINGLE PORTFOLIO SLIDESHOW VIEW */}
      {viewMode === 'slideshow' ? (
        <main className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-3 sm:py-6 flex-1 min-h-0 flex flex-col justify-center overflow-y-auto lg:overflow-hidden">
          {/* Centered Question / Portfolio Title (No badge above it per request) */}
          <div className="text-center mb-4 sm:mb-8 shrink-0">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              {currentResult?.position
                ? `Who should be the ${currentResult.position.title}?`
                : `ST. MICHAEL'S SCHOOL ELECTIONS`}
            </h1>
          </div>

          {/* Results List */}
          {!currentResult || currentResult.candidates.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-[#16223b]/60 rounded-2xl border border-slate-700/50 max-w-md mx-auto">
              <p className="text-slate-300 font-semibold text-base mb-1">
                No ballots recorded yet for this portfolio.
              </p>
              <p className="text-xs text-slate-400">
                Live results will appear automatically as votes are submitted in Google Forms.
              </p>
            </div>
          ) : (
            <div className="flex flex-col space-y-3 sm:space-y-4 max-w-4xl mx-auto w-full">
              {currentResult.candidates.map((candidate, idx) => {
                const barColor = BAR_COLORS[idx % BAR_COLORS.length];
                const isLeading = candidate.rank === 1 && candidate.vote_count > 0;
                const hasVotes = candidate.vote_count > 0;

                return (
                  <div key={candidate.id} className="flex items-center gap-3 sm:gap-5 w-full">
                    {/* Clean Horizontal Result Bar Container */}
                    <div
                      className={`flex-1 relative bg-[#16233b]/90 rounded-2xl overflow-hidden border shadow-lg h-18 sm:h-22 md:h-24 flex items-center transition-all ${
                        isLeading
                          ? 'border-amber-400/70 ring-1 ring-amber-400/30'
                          : 'border-slate-700/60'
                      }`}
                    >
                      {/* Animated Filled Progress Bar */}
                      <div
                        className={`absolute top-0 left-0 bottom-0 transition-all duration-700 ease-out ${barColor}`}
                        style={{
                          width: hasVotes ? `${Math.max(candidate.percentage, 8)}%` : '0%',
                          opacity: hasVotes ? 0.95 : 0,
                        }}
                      />

                      {/* Content Layer (Name on Left, Percentage on Right) */}
                      <div className="relative z-10 w-full flex items-center justify-between px-3.5 sm:px-6">
                        {/* Left: Crown + Candidate Name + Department */}
                        <div className="min-w-0 pr-3 sm:pr-4">
                          <div className="flex items-center gap-2 sm:gap-2.5">
                            {isLeading && (
                              <Crown className="w-4 h-4 sm:w-6 sm:h-6 text-amber-300 fill-amber-300 shrink-0 drop-shadow-sm" />
                            )}
                            <span className="font-black text-white text-base sm:text-2xl md:text-3xl truncate tracking-tight drop-shadow-sm">
                              {candidate.full_name}
                            </span>
                          </div>
                          <span className="text-[11px] sm:text-xs md:text-sm text-white/80 font-bold uppercase tracking-wider block mt-0.5 sm:mt-1">
                            {candidate.class_grade ||
                              (department === 'primary' ? 'Primary Department' : 'JHS Department')}
                          </span>
                        </div>

                        {/* Right: Percentage */}
                        <div className="text-right shrink-0">
                          <span className="text-xl sm:text-3xl md:text-4xl font-black text-white font-mono drop-shadow-md">
                            {candidate.percentage}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Outside Right: Bold Raw Vote Count with Label */}
                    <div className="w-10 sm:w-16 md:w-20 text-right shrink-0">
                      <span className="text-2xl sm:text-4xl md:text-5xl font-black text-white font-mono block leading-none">
                        {candidate.vote_count}
                      </span>
                      <span className="text-[9px] sm:text-[11px] font-bold font-mono text-slate-400 uppercase tracking-widest mt-1 block">
                        {candidate.vote_count === 1 ? 'vote' : 'votes'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      ) : (
        /* VIEW MODE 2: ALL CATEGORIES / FINAL RESULTS CALL-OUT BOARD */
        <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex-1 min-h-0 overflow-y-auto">
          {/* Executive Results Announcement Banner */}
          <div className="bg-gradient-to-r from-amber-950/70 via-slate-900/90 to-blue-950/70 border border-amber-500/40 rounded-2xl p-4 sm:p-5 mb-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                <Trophy className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>OFFICIAL ELECTION RESULTS & WINNERS</span>
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </h2>
                <p className="text-xs sm:text-sm text-slate-300">
                  ST. MICHAEL&apos;S SCHOOL • {department.toUpperCase()} DEPARTMENT • ALL CATEGORIES CALL-OUT
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                onClick={triggerCallOutFanfare}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all active:scale-95"
              >
                <Award className="w-4 h-4" />
                <span>Victory Fanfare 🎺</span>
              </button>
              <button
                onClick={() => setViewMode('slideshow')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-600 transition-all"
              >
                <Play className="w-4 h-4" />
                <span>Return to Slideshow</span>
              </button>
            </div>
          </div>

          {/* Grid of All Contested Portfolios */}
          {liveResults.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-[#16223b]/60 rounded-2xl border border-slate-700/50 max-w-lg mx-auto">
              No categories found for {department.toUpperCase()} Department yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-6">
              {liveResults.map((result, posIdx) => {
                const leadingCandidate = result.candidates[0];
                const hasVotes = result.totalVotesForPosition > 0 && leadingCandidate?.vote_count > 0;
                const isTie =
                  hasVotes &&
                  result.candidates.length > 1 &&
                  result.candidates[0].vote_count === result.candidates[1].vote_count;

                return (
                  <div
                    key={result.position.id}
                    className="bg-[#16233b]/90 border border-slate-700/70 hover:border-slate-600 rounded-2xl p-4 shadow-xl transition-all flex flex-col justify-between"
                  >
                    {/* Card Header: Position Title + Total Votes */}
                    <div className="flex items-start justify-between gap-3 mb-3 pb-2.5 border-b border-slate-700/50">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400 block mb-0.5">
                          Portfolio {posIdx + 1} of {liveResults.length}
                        </span>
                        <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                          {result.position.title}
                        </h3>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-400/30 text-blue-300 font-mono text-xs font-bold">
                          {result.totalVotesForPosition} {result.totalVotesForPosition === 1 ? 'Vote' : 'Votes'}
                        </span>
                      </div>
                    </div>

                    {/* Elected Winner Call-Out Highlight Box */}
                    {hasVotes ? (
                      <div
                        className={`p-3 rounded-xl mb-3 flex items-center justify-between ${
                          isTie
                            ? 'bg-amber-950/40 border border-amber-500/40 text-amber-200'
                            : 'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-400/50 text-amber-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <Crown className="w-5 h-5 text-amber-300 fill-amber-300 shrink-0" />
                          <div className="truncate">
                            <span className="text-[10px] font-mono font-black uppercase tracking-wider text-amber-300 block">
                              {isTie ? '🤝 TIED FOR LEAD' : '🏆 WINNER / ELECTED'}
                            </span>
                            <span className="text-sm sm:text-base font-black text-white truncate block">
                              {leadingCandidate.full_name}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base sm:text-lg font-black text-amber-300 font-mono block">
                            {leadingCandidate.vote_count} votes
                          </span>
                          <span className="text-[11px] font-bold text-amber-400/90 font-mono block">
                            ({leadingCandidate.percentage}%)
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl mb-3 bg-slate-800/40 border border-slate-700/40 text-center text-xs text-slate-400">
                        No ballots recorded yet for this portfolio
                      </div>
                    )}

                    {/* Candidates Table Breakdown */}
                    <div className="space-y-1.5 flex-1">
                      {result.candidates.map((cand, candIdx) => {
                        const isWinner = hasVotes && cand.rank === 1 && !isTie;
                        return (
                          <div
                            key={cand.id}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                              isWinner
                                ? 'bg-amber-400/10 text-white font-bold'
                                : 'bg-slate-800/30 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="font-mono text-[11px] font-bold text-slate-400 w-4 shrink-0">
                                #{candIdx + 1}
                              </span>
                              <span className="truncate">{cand.full_name}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 font-mono">
                              <div className="w-16 bg-slate-700/60 h-2 rounded-full overflow-hidden hidden sm:block">
                                <div
                                  className="bg-blue-400 h-full rounded-full"
                                  style={{ width: `${cand.percentage}%` }}
                                />
                              </div>
                              <span className="text-slate-400 text-[11px] w-9 text-right">
                                {cand.percentage}%
                              </span>
                              <span className="font-bold text-white text-xs w-10 text-right">
                                {cand.vote_count}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick Button to Jump into Slideshow for this Portfolio */}
                    <div className="mt-3 pt-2 border-t border-slate-800/60 flex justify-end">
                      <button
                        onClick={() => {
                          setActivePositionIndex(posIdx);
                          setViewMode('slideshow');
                        }}
                        className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                      >
                        <span>View Slideshow Bar</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* 3. RESPONSIVE FOOTER (Time replaced by counts per user request) */}
      <footer className="relative z-10 px-4 sm:px-8 py-2 sm:py-2.5 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 border-t border-slate-800/60 bg-[#0d1628]/80 backdrop-blur-sm shrink-0">
        {/* Left Side: School Name + Total Ballots + Counts (Replaces time) */}
        <div className="flex items-center gap-2 sm:gap-3 font-mono text-slate-300 text-[11px] sm:text-xs truncate">
          <span className="font-extrabold tracking-wider text-slate-200 font-sans uppercase">
            ST. MICHAEL&apos;S SCHOOL
          </span>
          <span>•</span>
          <span>
            Total Ballots: <strong className="text-white font-bold">{totalBallots}</strong>
          </span>
          <span>•</span>
          <span className="text-blue-300">
            Portfolio <strong className="text-white">{activePositionIndex + 1}</strong> of{' '}
            <strong className="text-white">{liveResults.length}</strong>
          </span>
          <span>•</span>
          <span className="text-slate-200 font-bold">
            {totalVotesForPosition} Total Votes Cast
          </span>
        </div>

        {/* Right Side: Discreet Controls */}
        <div className="flex items-center gap-3 sm:gap-4 text-slate-300 font-medium shrink-0">
          {/* Force Refresh */}
          <button
            onClick={() => loadData(false, department, true)}
            title="Refresh Live Data"
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Refresh</span>
          </button>

          {/* Auto-Slide Toggle */}
          {viewMode === 'slideshow' && (
            <button
              onClick={() => setIsAutoCycling(!isAutoCycling)}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              {isAutoCycling ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-blue-400" />
                  <span>Slideshow ({cycleSecondsLeft}s)</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-slate-400" />
                  <span>Enable Slideshow</span>
                </>
              )}
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            title={isSoundOn ? 'Mute Sound' : 'Unmute Sound'}
            className="hover:text-white transition-colors"
          >
            {isSoundOn ? <Volume2 className="w-4 h-4 text-blue-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            className="hover:text-white transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </footer>

      {/* 4. PRIMARY GOOGLE SHEET CONFIGURATION MODAL */}
      {showSheetSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#131d33] border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-white relative">
            <button
              onClick={() => setShowSheetSettings(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-black mb-2 flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-400" />
              <span>Primary Department Form Setup</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mb-4 leading-relaxed">
              You can connect Primary Department votes in two convenient ways:
            </p>

            <div className="space-y-3 mb-5 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
                <strong className="text-emerald-300 block mb-1">Option 1: In the Same Google Sheet (Easiest)</strong>
                When linking your Primary Google Form, choose the existing spreadsheet. It will create a tab named{' '}
                <code className="text-emerald-300 bg-black/40 px-1 py-0.5 rounded">&apos;Form Responses 2&apos;</code> or{' '}
                <code className="text-emerald-300 bg-black/40 px-1 py-0.5 rounded">&apos;Primary Responses&apos;</code>. The system detects it automatically!
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
                <strong className="text-blue-300 block mb-1">Option 2: In a Separate Google Sheet</strong>
                If your Primary Google Form outputs to a different spreadsheet, paste the spreadsheet URL or Sheet ID below:
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1.5">
                Primary Google Sheet ID or URL
              </label>
              <input
                type="text"
                placeholder="e.g. 1Zs1GB0nPvwHMznUv0zrml-... or full Google Docs URL"
                value={customPrimarySheetInput}
                onChange={(e) => setCustomPrimarySheetInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            {sheetSaveMessage && (
              <div className="mb-4 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{sheetSaveMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setCustomPrimarySheetInput('');
                  setPrimarySheetId('');
                  setSheetSaveMessage('Reset to shared sheet default.');
                  setTimeout(() => {
                    setShowSheetSettings(false);
                    setSheetSaveMessage(null);
                    loadData(false, 'primary', true);
                  }, 800);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Reset to Shared Sheet
              </button>
              <button
                onClick={handleSavePrimarySheet}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition-all active:scale-95"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

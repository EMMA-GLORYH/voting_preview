'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import {
  Vote,
  Check,
  ChevronRight,
  ChevronLeft,
  Lock,
  RotateCcw,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Volume2,
  VolumeX,
  X,
  Award,
  Tv,
  Shield,
} from 'lucide-react';
import {
  fetchPositions,
  fetchCandidates,
  fetchElectionState,
  castBallot,
  subscribeToElectionRealtime,
} from '@/lib/voting-service';
import { Position, Candidate, ElectionState, BallotSelection } from '@/types/voting';
import { sounds } from '@/lib/sound-effects';

export default function VotingKioskPage() {
  const router = useRouter();

  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [electionState, setElectionState] = useState<ElectionState | null>(null);
  const [loading, setLoading] = useState(true);

  // Voting Wizard State
  const [currentPositionIndex, setCurrentPositionIndex] = useState(0);
  const [ballotSelections, setBallotSelections] = useState<BallotSelection>({});
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Sound toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  const loadElectionData = async () => {
    try {
      const [posList, candList, state] = await Promise.all([
        fetchPositions(),
        fetchCandidates(),
        fetchElectionState(),
      ]);
      setPositions(posList.sort((a, b) => a.display_order - b.display_order));
      setCandidates(candList);
      setElectionState(state);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSoundEnabled(sounds.isEnabled());
    loadElectionData();

    const unsubscribe = subscribeToElectionRealtime(() => {
      loadElectionData();
    });
    return () => unsubscribe();
  }, []);

  // Handle successful submission countdown & auto-reset
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSuccess && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isSuccess && countdown === 0) {
      // Auto-reset kiosk for next student
      resetKiosk();
    }
    return () => clearTimeout(timer);
  }, [isSuccess, countdown]);

  const resetKiosk = () => {
    setBallotSelections({});
    setCurrentPositionIndex(0);
    setIsReviewOpen(false);
    setIsSuccess(false);
    setCountdown(3);
  };

  const handleSelectCandidate = (candidateId: string) => {
    const currentPos = positions[currentPositionIndex];
    if (!currentPos) return;

    setBallotSelections((prev) => {
      // Toggle selection
      if (prev[currentPos.id] === candidateId) {
        const next = { ...prev };
        delete next[currentPos.id];
        return next;
      }
      return { ...prev, [currentPos.id]: candidateId };
    });
  };

  const handleNext = () => {
    if (currentPositionIndex < positions.length - 1) {
      setCurrentPositionIndex((prev) => prev + 1);
    } else {
      setIsReviewOpen(true);
    }
  };

  const handlePrevious = () => {
    if (currentPositionIndex > 0) {
      setCurrentPositionIndex((prev) => prev - 1);
    }
  };

  const handleSubmitBallot = async () => {
    const candidateIds = Object.values(ballotSelections);
    if (candidateIds.length === 0) {
      alert('Please make at least one selection before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await castBallot(candidateIds);
      if (result.success) {
        setIsReviewOpen(false);
        setIsSuccess(true);
        sounds.playVoteCastSuccess();

        // Confetti explosion
        try {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#00f0ff', '#ffffff', '#6366f1', '#10b981'],
          });
        } catch {
          // Ignore
        }
      } else {
        alert(result.error || 'Failed to submit vote. Please try again.');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-[#080a10] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium tracking-wide">Loading Voting Kiosk...</span>
        </div>
      </div>
    );
  }

  // If election is not active
  if (electionState && electionState.status !== 'active') {
    return (
      <div className="min-h-screen bg-[#080a10] text-white flex flex-col justify-between p-6">
        <div className="flex justify-between items-center max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">{electionState.school_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-neutral-300"
            >
              Live Board
            </Link>
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-neutral-300"
            >
              Admin
            </Link>
          </div>
        </div>

        <div className="max-w-md mx-auto text-center space-y-6 antigravity-card p-10 rounded-3xl border border-white/20">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold capitalize">
              Voting Station {electionState.status}
            </h2>
            <p className="text-sm text-neutral-400">
              {electionState.status === 'setup'
                ? 'The election is currently in setup mode. Please wait for the Electoral Commissioner to open voting.'
                : electionState.status === 'paused'
                ? 'Voting has been temporarily paused by the Electoral Commissioner. Please remain in line.'
                : 'The election has officially ended. Thank you for your participation!'}
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/live"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors"
            >
              <span>View Live Projection Screen</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="text-center text-xs text-neutral-500">
          St. Peter Basic School Electoral System
        </div>
      </div>
    );
  }

  // SUCCESS SCREEN WITH 3-SECOND AUTO RESET
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#080a10] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="max-w-lg w-full antigravity-card p-10 rounded-3xl border-2 border-white/30 space-y-7 shadow-2xl relative overflow-hidden">
          {/* Cyan Glow effect */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-cyan-400/20 blur-[70px] pointer-events-none rounded-full" />

          <div className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center mx-auto shadow-xl ring-8 ring-white/10 animate-bounce">
            <Check className="w-10 h-10 stroke-[3]" />
          </div>

          <div className="space-y-3">
            <span className="px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-xs uppercase tracking-widest font-semibold">
              Ballot Recorded
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Thank You for Voting!
            </h2>
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
              Your choices have been submitted anonymously and instantly tallied on the live
              auditorium screen.
            </p>
          </div>

          {/* Auto Reset Timer Box */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Readying station for next student:</span>
              <span className="font-mono font-bold text-white text-sm">{countdown}s</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-white transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${(countdown / 3) * 100}%` }}
              />
            </div>
          </div>

          <button
            onClick={resetKiosk}
            className="w-full py-3.5 px-6 rounded-xl bg-white text-black font-bold text-sm hover:bg-neutral-200 transition-colors shadow-lg shadow-white/10 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Next Student (Click to Skip Timer)</span>
          </button>
        </div>
      </div>
    );
  }

  const currentPos = positions[currentPositionIndex];
  const positionCandidates = currentPos
    ? candidates.filter((c) => c.position_id === currentPos.id)
    : [];
  const selectedCandidateId = currentPos ? ballotSelections[currentPos.id] : undefined;
  const isLastPosition = currentPositionIndex === positions.length - 1;
  const progressPercent = positions.length > 0
    ? Math.round(((currentPositionIndex + 1) / positions.length) * 100)
    : 0;


  return (
    <div className="min-h-screen bg-[#080a10] text-white flex flex-col justify-between select-none">
      {/* Top Kiosk Navigation Bar */}
      <header className="border-b border-white/10 px-4 sm:px-8 py-3.5 bg-[#080a10]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-black font-extrabold flex items-center justify-center text-sm shadow">
              ⚡
            </div>
            <div>
              <h1 className="font-bold text-white text-sm sm:text-base leading-tight">
                {electionState?.school_name}
              </h1>
              <p className="text-[11px] text-neutral-400 font-medium">
                Official Student Ballot Kiosk • Anonymous & Secure
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Audio Toggle */}
            <button
              onClick={() => {
                const next = sounds.toggleSound();
                setSoundEnabled(next);
              }}
              title="Toggle Audio"
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-cyan-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-neutral-500" />
              )}
            </button>

            {/* Direct Navigation Links */}
            <Link
              href="/"
              title="Return to Live Board"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-neutral-300 text-xs font-medium transition-colors"
            >
              <Tv className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Live Board</span>
            </Link>

            <Link
              href="/admin"
              title="Admin Console"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-neutral-300 text-xs font-medium transition-colors"
            >
              <Shield className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Ballot Area */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-8 py-6 w-full flex flex-col justify-between">
        {/* Wizard Progress & Position Title Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-mono uppercase tracking-wider text-cyan-400 font-semibold">
              Portfolio {currentPositionIndex + 1} of {positions.length}
            </span>
            <span className="font-mono text-neutral-300 font-medium">{progressPercent}% Completed</span>
          </div>

          {/* Stepper Progress Bar */}
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-white to-cyan-300 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Active Position Title Banner */}
          <div className="text-center py-4 sm:py-6 antigravity-card rounded-2xl px-4 border border-white/15">
            <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400">
              Now Voting For
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-1 tracking-tight">
              {currentPos?.title}
            </h2>
            {currentPos?.description && (
              <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-lg mx-auto">
                {currentPos.description}
              </p>
            )}
            <p className="text-[11px] text-cyan-400 font-medium mt-2">
              👉 Tap on your preferred candidate below to cast your choice
            </p>
          </div>
        </div>

        {/* Candidate Cards Grid */}
        <div className="my-6">
          {positionCandidates.length === 0 ? (
            <div className="text-center py-16 antigravity-card rounded-2xl border border-white/10">
              <p className="text-neutral-400 text-sm">No registered candidates for this position.</p>
            </div>
          ) : (
            <div
              className={`grid gap-4 sm:gap-6 ${
                positionCandidates.length === 2
                  ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto'
                  : positionCandidates.length === 3
                  ? 'grid-cols-1 md:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
              }`}
            >
              {positionCandidates.map((candidate) => {
                const isSelected = selectedCandidateId === candidate.id;
                return (
                  <div
                    key={candidate.id}
                    onClick={() => handleSelectCandidate(candidate.id)}
                    className={`cursor-pointer rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 text-center relative ${
                      isSelected
                        ? 'antigravity-card-active scale-[1.02]'
                        : 'antigravity-card hover:border-white/40 hover:bg-white/[0.06]'
                    }`}
                  >
                    {/* Selected Badge */}
                    {isSelected && (
                      <div className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shadow-lg font-bold">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Avatar / Photo placeholder */}
                      <div className="relative mx-auto">
                        <div
                          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl mx-auto flex items-center justify-center text-2xl font-bold transition-all shadow-md ${
                            isSelected
                              ? 'bg-white text-black ring-4 ring-cyan-400/50'
                              : 'bg-white/10 text-white border border-white/20'
                          }`}
                        >
                          {candidate.avatar_url ? (
                            <img
                              src={candidate.avatar_url}
                              alt={candidate.full_name}
                              className="w-full h-full object-cover rounded-2xl"
                            />
                          ) : (
                            <span>{candidate.full_name.charAt(0)}</span>
                          )}
                        </div>
                      </div>

                      {/* Candidate Name & Class */}
                      <div>
                        <h3 className="font-extrabold text-white text-lg sm:text-xl tracking-tight leading-snug">
                          {candidate.full_name}
                        </h3>
                        <div className="inline-block mt-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-white/10 text-neutral-200 border border-white/10">
                          Class: {candidate.class_grade}
                        </div>
                      </div>

                      {/* Manifesto / Slogan */}
                      {candidate.manifesto && (
                        <p className="text-xs text-neutral-400 line-clamp-3 italic leading-relaxed pt-1">
                          &ldquo;{candidate.manifesto}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="pt-6">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCandidate(candidate.id);
                        }}
                        className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                          isSelected
                            ? 'bg-white text-black shadow-lg shadow-white/20'
                            : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Selected</span>
                          </>
                        ) : (
                          <span>Select Candidate</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Navigation & Wizard Controls */}
        <div className="border-t border-white/10 pt-4 pb-2 flex items-center justify-between gap-4">
          <button
            onClick={handlePrevious}
            disabled={currentPositionIndex === 0}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-xs sm:text-sm border transition-colors ${
              currentPositionIndex === 0
                ? 'opacity-40 cursor-not-allowed border-white/5 text-neutral-500'
                : 'border-white/20 bg-white/5 hover:bg-white/10 text-white'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous Position</span>
            <span className="sm:hidden">Back</span>
          </button>

          <div className="flex items-center gap-2">
            {/* Quick Skip Button if user doesn't want to vote for this position */}
            {!selectedCandidateId && (
              <button
                onClick={handleNext}
                className="px-4 py-3 rounded-xl text-neutral-400 hover:text-white text-xs font-medium transition-colors"
              >
                Skip This Position
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-black font-extrabold text-xs sm:text-sm hover:bg-neutral-200 transition-colors shadow-lg shadow-white/10"
            >
              <span>{isLastPosition ? 'Review & Submit Ballot' : 'Next Position'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      {/* Review Ballot Modal Before Final Submission */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-lg antigravity-card p-6 sm:p-8 rounded-3xl border border-white/20 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-extrabold text-white text-xl">Review Your Ballot</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Check your choices before final submission. Your vote is 100% anonymous.
                </p>
              </div>
              <button
                onClick={() => setIsReviewOpen(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of all positions and selected candidates */}
            <div className="space-y-3">
              {positions.map((pos) => {
                const chosenCandId = ballotSelections[pos.id];
                const chosenCand = candidates.find((c) => c.id === chosenCandId);

                return (
                  <div
                    key={pos.id}
                    className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                        {pos.title}
                      </span>
                      <p className="font-bold text-white text-sm sm:text-base mt-0.5">
                        {chosenCand ? chosenCand.full_name : 'No candidate selected (Abstain)'}
                      </p>
                    </div>
                    {chosenCand && (
                      <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-white/10 text-cyan-300 font-semibold border border-white/10">
                        {chosenCand.class_grade}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Once you click &ldquo;Confirm & Cast Vote&rdquo;, your ballot is permanently recorded
                and the station will reset for the next voter.
              </span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsReviewOpen(false)}
                className="flex-1 py-3.5 rounded-xl bg-white/10 text-white font-semibold text-xs sm:text-sm hover:bg-white/20 transition-colors"
              >
                Change Choices
              </button>
              <button
                onClick={handleSubmitBallot}
                disabled={isSubmitting}
                className="flex-1 py-3.5 rounded-xl bg-white text-black font-extrabold text-xs sm:text-sm hover:bg-neutral-200 transition-colors shadow-lg shadow-white/20 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Recording Vote...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirm & Cast Vote</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import {
  Shield,
  Users,
  Plus,
  Trash2,
  Edit2,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Printer,
  Settings,
  Database,
  X,
  Vote,
  Crown,
  Copy,
  Check,
} from 'lucide-react';
import {
  fetchPositions,
  fetchCandidates,
  fetchElectionState,
  computeLiveResults,
  updateElectionStatus,
  resetElection,
  addCandidate,
  updateCandidate,
  deleteCandidate,
  addPosition,
  deletePosition,
  updateKioskPin,
  updateSchoolDetails,
  subscribeToElectionRealtime,
  checkGoogleSheetsStatus,
} from '@/lib/voting-service';
import { Position, Candidate, ElectionState, LivePositionResult, ElectionStatus } from '@/types/voting';

export default function AdminPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [electionState, setElectionState] = useState<ElectionState | null>(null);
  const [liveResults, setLiveResults] = useState<LivePositionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleReady, setGoogleReady] = useState(false);

  // Admin Active Slot (1 or 2)
  const [selectedAdminSlot, setSelectedAdminSlot] = useState<1 | 2>(1);

  // Modals
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [isAddPositionOpen, setIsAddPositionOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetPinInput, setResetPinInput] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  // Form States
  const [candName, setCandName] = useState('');
  const [candClass, setCandClass] = useState('');
  const [candPositionId, setCandPositionId] = useState('');
  const [candManifesto, setCandManifesto] = useState('');

  const [posTitle, setPosTitle] = useState('');
  const [posDescription, setPosDescription] = useState('');

  const [settingsSchoolName, setSettingsSchoolName] = useState('');
  const [settingsElectionTitle, setSettingsElectionTitle] = useState('');
  const [settingsPin, setSettingsPin] = useState('');

  const loadData = async () => {
    try {
      const [posList, candList, state, isLiveGoogle] = await Promise.all([
        fetchPositions(),
        fetchCandidates(),
        fetchElectionState(),
        checkGoogleSheetsStatus(),
      ]);
      setGoogleReady(isLiveGoogle);
      const sortedPos = posList.sort((a, b) => a.display_order - b.display_order);
      setPositions(sortedPos);
      setCandidates(candList);
      setElectionState(state);
      setLiveResults(computeLiveResults(sortedPos, candList));

      if (state) {
        setSettingsSchoolName(state.school_name);
        setSettingsElectionTitle(state.election_title);
        setSettingsPin(state.kiosk_pin);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToElectionRealtime(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (newStatus: ElectionStatus) => {
    await updateElectionStatus(newStatus);
    await loadData();
  };

  const handleResetVotes = async () => {
    await resetElection();
    setIsResetConfirmOpen(false);
    await loadData();
  };

  const handleSaveCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candName.trim() || !candClass.trim() || !candPositionId) {
      alert('Please fill in candidate Name, Class, and Position.');
      return;
    }

    if (editingCandidate) {
      await updateCandidate(editingCandidate.id, {
        full_name: candName.trim(),
        class_grade: candClass.trim(),
        position_id: candPositionId,
        manifesto: candManifesto.trim(),
      });
      setEditingCandidate(null);
    } else {
      await addCandidate({
        full_name: candName.trim(),
        class_grade: candClass.trim(),
        position_id: candPositionId,
        manifesto: candManifesto.trim(),
      });
    }

    setCandName('');
    setCandClass('');
    setCandManifesto('');
    setIsAddCandidateOpen(false);
    await loadData();
  };

  const handleDeleteCandidate = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete candidate "${name}"?`)) {
      await deleteCandidate(id);
      await loadData();
    }
  };

  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posTitle.trim()) {
      alert('Please enter position title.');
      return;
    }
    await addPosition({
      title: posTitle.trim(),
      description: posDescription.trim(),
      display_order: positions.length + 1,
      max_choices: 1,
    });
    setPosTitle('');
    setPosDescription('');
    setIsAddPositionOpen(false);
    await loadData();
  };

  const handleDeletePosition = async (id: string, title: string) => {
    if (confirm(`Delete portfolio "${title}"? This will also remove any candidates assigned to it.`)) {
      await deletePosition(id);
      await loadData();
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSchoolDetails(settingsSchoolName, settingsElectionTitle);
    if (settingsPin) {
      await updateKioskPin(settingsPin);
    }
    alert('Settings successfully updated!');
    await loadData();
  };

  const handlePrintReport = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080a10] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold tracking-wide">Loading Admin Command Center...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080a10] text-white flex flex-col justify-between">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8 print:p-0 print:space-y-4">
        {/* Top Control Bar & Welcome */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6 print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 live-dot"></span>
              <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">
                Certified Administrator Session • Slot {selectedAdminSlot} Active
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white mt-1">Electoral Command Center</h1>
            <p className="text-xs sm:text-sm text-neutral-400">
              Manage candidates, control live election status, reset tallies, and audit results.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Slot Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setSelectedAdminSlot(1)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                  selectedAdminSlot === 1 ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Admin 1 (Headteacher)
              </button>
              <button
                type="button"
                onClick={() => setSelectedAdminSlot(2)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                  selectedAdminSlot === 2 ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Admin 2 (IT Officer)
              </button>
            </div>

            <Link
              href="/"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-400 text-black text-xs font-bold hover:bg-cyan-300"
            >
              <span>Live Board ↗</span>
            </Link>
            <button
              onClick={handlePrintReport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 hover:bg-white/10 text-white text-xs font-semibold"
            >
              <Printer className="w-4 h-4" />
              <span>Print Sheet</span>
            </button>
          </div>
        </div>

        {/* 1. Election Status Control Panel */}
        <div className="antigravity-card rounded-3xl p-6 sm:p-7 border border-white/15 space-y-5 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-cyan-400" />
                <span>Live Election Status</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Current status dictates whether student kiosks accept votes or display waiting screens.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Current:</span>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white text-black">
                {electionState?.status}
              </span>
            </div>
          </div>

          {/* Quick status switch buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <button
              onClick={() => handleStatusChange('active')}
              className={`p-4 rounded-2xl border font-bold text-xs sm:text-sm transition-all flex flex-col items-center gap-2 ${
                electionState?.status === 'active'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-lg shadow-emerald-500/20'
                  : 'bg-white/5 text-neutral-300 border-white/10 hover:border-white/25 hover:bg-white/10'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-emerald-400 live-dot"></span>
              <span>1. START VOTING</span>
              <span className="text-[10px] text-neutral-400 font-normal">Kiosks Open</span>
            </button>

            <button
              onClick={() => handleStatusChange('paused')}
              className={`p-4 rounded-2xl border font-bold text-xs sm:text-sm transition-all flex flex-col items-center gap-2 ${
                electionState?.status === 'paused'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-lg shadow-amber-500/20'
                  : 'bg-white/5 text-neutral-300 border-white/10 hover:border-white/25 hover:bg-white/10'
              }`}
            >
              <Pause className="w-3.5 h-3.5 text-amber-400" />
              <span>2. PAUSE VOTING</span>
              <span className="text-[10px] text-neutral-400 font-normal">Break / Assembly</span>
            </button>

            <button
              onClick={() => handleStatusChange('ended')}
              className={`p-4 rounded-2xl border font-bold text-xs sm:text-sm transition-all flex flex-col items-center gap-2 ${
                electionState?.status === 'ended'
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400 shadow-lg shadow-indigo-500/20'
                  : 'bg-white/5 text-neutral-300 border-white/10 hover:border-white/25 hover:bg-white/10'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-indigo-400" />
              <span>3. END & DECLARE</span>
              <span className="text-[10px] text-neutral-400 font-normal">Reveal Winners</span>
            </button>

            <button
              onClick={() => setIsResetConfirmOpen(true)}
              className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/15 text-rose-300 font-bold text-xs sm:text-sm transition-all flex flex-col items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>RESET TALLIES</span>
              <span className="text-[10px] text-neutral-400 font-normal">Wipe Test Ballots</span>
            </button>
          </div>
        </div>

        {/* 2. Registered Candidates Management (The Core Stored Entity) */}
        <div className="antigravity-card rounded-3xl p-6 sm:p-7 border border-white/15 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-white" />
                <h2 className="text-xl font-bold text-white">Contesting Candidates</h2>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Student candidates stored with Full Name, Class/Grade, and Contested Portfolio.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingCandidate(null);
                setCandName('');
                setCandClass('');
                setCandManifesto('');
                setCandPositionId(positions[0]?.id || '');
                setIsAddCandidateOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black font-extrabold text-xs hover:bg-neutral-200 transition-colors shadow print:hidden"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Candidate</span>
            </button>
          </div>

          {/* Candidates Table grouped by Position */}
          <div className="space-y-6">
            {liveResults.map((result) => (
              <div key={result.position.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    <span>{result.position.title}</span>
                  </h3>
                  <span className="text-xs font-mono text-neutral-400">
                    {result.candidates.length} Candidate(s) • {result.totalVotesForPosition} Votes
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 text-neutral-300 border-b border-white/10">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Rank</th>
                        <th className="py-3 px-4 font-semibold">Candidate Name</th>
                        <th className="py-3 px-4 font-semibold">Class / Grade</th>
                        <th className="py-3 px-4 font-semibold">Manifesto / Note</th>
                        <th className="py-3 px-4 font-semibold text-right">Votes</th>
                        <th className="py-3 px-4 font-semibold text-right">Share</th>
                        <th className="py-3 px-4 font-semibold text-right print:hidden">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {result.candidates.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 px-4 text-center text-neutral-500 italic">
                            No candidates registered for this position.
                          </td>
                        </tr>
                      ) : (
                        result.candidates.map((cand) => {
                          const isTop = cand.rank === 1;
                          const isSecond = cand.rank === 2;
                          const isBelow = cand.rank > 2;

                          return (
                            <tr
                              key={cand.id}
                              className={`transition-colors ${
                                isTop
                                  ? 'bg-cyan-500/[0.06] hover:bg-cyan-500/[0.1]'
                                  : isSecond
                                  ? 'bg-sky-500/[0.04] hover:bg-sky-500/[0.08]'
                                  : 'bg-red-500/[0.04] hover:bg-red-500/[0.08]'
                              }`}
                            >
                              <td className="py-3 px-4 font-mono font-bold">
                                {isTop ? (
                                  <span className="inline-flex items-center gap-1 text-cyan-300 font-bold bg-cyan-400/20 px-2 py-0.5 rounded border border-cyan-400/40">
                                    <Crown className="w-3.5 h-3.5" /> #1 TOP
                                  </span>
                                ) : isSecond ? (
                                  <span className="inline-flex items-center gap-1 text-sky-300 font-bold bg-sky-400/20 px-2 py-0.5 rounded border border-sky-400/30">
                                    #2 SECOND
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                                    #{cand.rank} BELOW
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-bold text-white text-sm">
                                {cand.full_name}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full bg-white/10 font-mono text-neutral-200">
                                  {cand.class_grade}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-neutral-400 max-w-xs truncate italic">
                                {cand.manifesto || '—'}
                              </td>
                              <td
                                className={`py-3 px-4 text-right font-mono font-extrabold text-sm ${
                                  isBelow ? 'text-red-400' : 'text-white'
                                }`}
                              >
                                {cand.vote_count}
                              </td>
                              <td
                                className={`py-3 px-4 text-right font-mono font-bold ${
                                  isTop
                                    ? 'text-cyan-300'
                                    : isSecond
                                    ? 'text-sky-300'
                                    : 'text-red-400'
                                }`}
                              >
                                {cand.percentage}%
                              </td>
                              <td className="py-3 px-4 text-right space-x-2 print:hidden">
                                <button
                                  onClick={() => {
                                    setEditingCandidate(cand);
                                    setCandName(cand.full_name);
                                    setCandClass(cand.class_grade);
                                    setCandPositionId(cand.position_id);
                                    setCandManifesto(cand.manifesto || '');
                                    setIsAddCandidateOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-neutral-300"
                                  title="Edit Candidate"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCandidate(cand.id, cand.full_name)}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300"
                                  title="Delete Candidate"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Portfolios / Positions Management */}
        <div className="antigravity-card rounded-3xl p-6 sm:p-7 border border-white/15 space-y-5 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Vote className="w-5 h-5 text-cyan-400" />
                <span>Contested Portfolios / Positions</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                The student prefectorial offices configured in the voting sequence.
              </p>
            </div>
            <button
              onClick={() => setIsAddPositionOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Portfolio</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {positions.map((pos, idx) => (
              <div
                key={pos.id}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] font-mono uppercase text-cyan-400">Order #{idx + 1}</span>
                  <h4 className="font-bold text-white text-sm mt-0.5">{pos.title}</h4>
                  {pos.description && (
                    <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{pos.description}</p>
                  )}
                </div>
                <div className="pt-4 flex justify-end">
                  <button
                    onClick={() => handleDeletePosition(pos.id, pos.title)}
                    className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Electoral Configuration & PIN Settings */}
        <div className="antigravity-card rounded-3xl p-6 sm:p-7 border border-white/15 space-y-5 print:hidden">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-white" />
              <span>System & Kiosk Security Settings</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Customize school branding and kiosk station unlock passcode.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-300">Basic School Name</label>
              <input
                type="text"
                value={settingsSchoolName}
                onChange={(e) => setSettingsSchoolName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-300">Election Title</label>
              <input
                type="text"
                value={settingsElectionTitle}
                onChange={(e) => setSettingsElectionTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-300">Kiosk Lock PIN</label>
              <input
                type="password"
                maxLength={6}
                value={settingsPin}
                onChange={(e) => setSettingsPin(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-white text-black font-extrabold text-xs hover:bg-neutral-200 transition-colors shadow"
              >
                Save Settings
              </button>
            </div>
          </form>
        </div>

        {/* 5. Google Sheets API & Live Connection Status */}
        <div className="antigravity-card rounded-3xl p-6 sm:p-7 border border-white/15 space-y-4 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="font-bold text-white text-sm">Google Sheets Live Data Engine</h3>
                <p className="text-xs text-neutral-400">
                  {googleReady
                    ? 'Connected directly to Google Sheets via Service Account API (The Code Path).'
                    : 'Running on high-speed Local Engine with instant Cross-Tab Broadcast sync.'}
                </p>
              </div>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                googleReady
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
              }`}
            >
              {googleReady ? '● Google Sheets Live' : '● Local Realtime Engine'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-neutral-300 space-y-2">
            <p>
              To link your own Google Spreadsheet: Follow <a href="/google-sheets-setup.md" target="_blank" className="text-cyan-400 underline font-semibold">google-sheets-setup.md</a>. Add <code className="text-white font-mono">GOOGLE_CLIENT_EMAIL</code>, <code className="text-white font-mono">GOOGLE_PRIVATE_KEY</code>, and <code className="text-white font-mono">GOOGLE_SHEET_ID</code> into <code className="text-white font-mono">.env.local</code>.
            </p>
          </div>
        </div>

        {/* Official Print Header for Physical Certification */}
        <div className="hidden print:block pt-8 text-black border-t-2 border-black">
          <div className="text-center space-y-1 mb-8">
            <h1 className="text-2xl font-black">{electionState?.school_name}</h1>
            <h2 className="text-lg font-bold">{electionState?.election_title}</h2>
            <p className="text-xs">OFFICIAL CERTIFIED ELECTION RESULTS SHEET</p>
            <p className="text-xs font-mono">Date Certified: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="border-t border-black pt-2">
              <p className="font-bold">Electoral Commissioner 1 (Headteacher)</p>
              <p className="text-neutral-500">Signature & Official Stamp</p>
            </div>
            <div className="border-t border-black pt-2">
              <p className="font-bold">Electoral Commissioner 2 (IT / Supervisor)</p>
              <p className="text-neutral-500">Signature & Official Stamp</p>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: ADD / EDIT CANDIDATE */}
      {isAddCandidateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md antigravity-card p-6 sm:p-7 rounded-3xl border border-white/20 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-extrabold text-white text-base">
                {editingCandidate ? 'Edit Candidate' : 'Register New Candidate'}
              </h3>
              <button
                onClick={() => setIsAddCandidateOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCandidate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">
                  Full Name (Candidate) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Osei Boateng"
                  value={candName}
                  onChange={(e) => setCandName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Class / Grade *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Basic 6, JHS 2 A"
                  value={candClass}
                  onChange={(e) => setCandClass(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">
                  Contested Position *
                </label>
                <select
                  required
                  value={candPositionId}
                  onChange={(e) => setCandPositionId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#121622] border border-white/15 text-white text-xs focus:outline-none focus:border-cyan-400"
                >
                  <option value="" disabled>Select Position</option>
                  {positions.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">
                  Manifesto / Campaign Slogan (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Promoting discipline, academic excellence, and sports."
                  value={candManifesto}
                  onChange={(e) => setCandManifesto(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCandidateOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-extrabold hover:bg-neutral-200"
                >
                  {editingCandidate ? 'Update Candidate' : 'Save Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD POSITION */}
      {isAddPositionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md antigravity-card p-6 sm:p-7 rounded-3xl border border-white/20 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-extrabold text-white text-base">Add Contested Portfolio</h3>
              <button
                onClick={() => setIsAddPositionOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePosition} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Position Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dining Hall Prefect"
                  value={posTitle}
                  onChange={(e) => setPosTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-cyan-400"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Supervise meal distributions and dining discipline."
                  value={posDescription}
                  onChange={(e) => setPosDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPositionOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-extrabold hover:bg-neutral-200"
                >
                  Create Portfolio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET CONFIRMATION WITH PIN */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="w-full max-w-sm antigravity-card p-6 sm:p-7 rounded-3xl border border-rose-500/40 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="font-extrabold text-white text-lg">Reset All Ballot Votes?</h3>
              <p className="text-xs text-neutral-400">
                This will reset all candidate vote counts to 0 and clear audit records. Candidate profiles will remain.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetVotes}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30"
              >
                Yes, Reset All Votes
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-white/10 py-6 text-center text-xs text-neutral-500 print:hidden">
        St. Peter Basic School Electoral System • Strict Dual Admin Security
      </footer>
    </div>
  );
}

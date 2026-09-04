"use client";

import { useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

type Player = {
  id: string;
  name: string;
  group_name: string;
};

type MatchRecord = {
  id: string;
  playerAId: string;
  playerBId: string;
  playerAScore: number;
  playerBScore: number;
  winnerId: string;
  note?: string;
  createdAt: string;
  teamAId?: string;
  teamBId?: string;
  tournamentId?: string;
};

type Team = {
  id: string;
  name: string;
  playerAId: string;
  playerBId: string;
  group_name: string;
};

type Tournament = {
  id: string;
  name: string;
  format: "internal" | "external";
  status: string;
  created_at: string;
  event_date: string;
  location: string;
};

type TabName = "dashboard" | "players" | "teams" | "tournaments" | "standings" | "matches";

const STORAGE_KEY = "wss-badminton-db-v1";
const groupOptions = ["WSS", "FFBC", "SW", "SSBC", "DBCC", "DCSC"];

const defaultPlayers: Player[] = [
  { id: "p1", name: "Nattu", group_name: "A" },
  { id: "p2", name: "Aarav", group_name: "A" },
  { id: "p3", name: "Jeevan", group_name: "B" },
  { id: "p4", name: "Rafi", group_name: "B" },
];

const defaultMatches: MatchRecord[] = [
  {
    id: "m1",
    playerAId: "p1",
    playerBId: "p2",
    playerAScore: 21,
    playerBScore: 18,
    winnerId: "p1",
    note: "League match",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  },
  {
    id: "m2",
    playerAId: "p3",
    playerBId: "p4",
    playerAScore: 19,
    playerBScore: 21,
    winnerId: "p4",
    note: "Practice drive",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tab, setTab] = useState<TabName>("dashboard");
  const [newPlayer, setNewPlayer] = useState({ name: "", group_name: "WSS" });
  const [liveScore, setLiveScore] = useState({ playerA: 0, playerB: 0 });
  const [matchDraft, setMatchDraft] = useState({
    teamAId: "",
    teamBId: "",
    tournamentId: "",
    note: "",
  });
  const [teamDraft, setTeamDraft] = useState({ name: "", playerAId: "", playerBId: "", group_name: "A" });
  const [tournamentDraft, setTournamentDraft] = useState({ name: "", format: "internal" as "internal" | "external", event_date: "", location: "" });
  const [standingsTournamentId, setStandingsTournamentId] = useState("");
  const [notice, setNotice] = useState("Local storage mode enabled. Connect Supabase for live database storage.");

  useEffect(() => {
    const loadLocalData = () => {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        setPlayers(defaultPlayers);
        setMatches(defaultMatches);
        setTeams([]);
        setTournaments([]);
        return;
      }

      try {
        const parsed = JSON.parse(raw) as { players?: Player[]; matches?: MatchRecord[] };
        setPlayers(
          parsed.players && parsed.players.length
            ? parsed.players.map((player) => ({ id: player.id, name: player.name, group_name: player.group_name || "A" }))
            : defaultPlayers,
        );
        setMatches(parsed.matches && parsed.matches.length ? parsed.matches : defaultMatches);
      } catch {
        setPlayers(defaultPlayers);
        setMatches(defaultMatches);
      }
    };

    if (!hasSupabaseConfig || !supabase) {
      loadLocalData();
      return;
    }

    const client = supabase;

    const loadSupabaseData = async () => {
      const { data: playersData, error: playersError } = await client.from("players").select("*");
      const { data: matchesData, error: matchesError } = await client.from("matches").select("*");
      const { data: teamsData, error: teamsError } = await client.from("teams").select("*");
      const { data: tournamentsData, error: tournamentsError } = await client.from("tournaments").select("*");

      if (playersError || matchesError || teamsError || tournamentsError) {
        setNotice("Supabase connection is set, but tables are not ready yet.");
        loadLocalData();
        return;
      }

      const nextPlayers = (playersData ?? []) as Player[];
      const nextMatches = (matchesData ?? []) as MatchRecord[];
      const nextTeams = (teamsData ?? []) as Team[];
      const nextTournaments = (tournamentsData ?? []) as Tournament[];
      setPlayers(nextPlayers);
      setMatches(nextMatches);
      setTeams(nextTeams);
      setTournaments(nextTournaments);
      setTeamDraft((current) => ({ ...current, playerAId: current.playerAId || nextPlayers[0]?.id || "", playerBId: current.playerBId || nextPlayers[1]?.id || "" }));
      setMatchDraft((current) => ({ ...current, teamAId: current.teamAId || nextTeams[0]?.id || "", teamBId: current.teamBId || nextTeams[1]?.id || "", tournamentId: current.tournamentId || nextTournaments[0]?.id || "" }));
      setNotice("Connected to Supabase. Live sync is active.");
    };

    loadSupabaseData();

    const channel = client
      .channel("wss-league-live-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, loadSupabaseData)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, loadSupabaseData)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, loadSupabaseData)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, loadSupabaseData)
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setNotice("Database connected, but live sync is unavailable. Refresh to update.");
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      if (!players.length && !matches.length) return;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          players,
          matches,
          teams,
          tournaments,
        }),
      );
    }
  }, [players, matches]);

  const leaderboard = useMemo(() => {
    const tournamentId = matchDraft.tournamentId;
    return teams.map((team) => {
      const teamMatches = matches.filter((match) => match.tournamentId === tournamentId && (match.teamAId === team.id || match.teamBId === team.id));
      const wins = teamMatches.filter((match) => match.winnerId === team.playerAId || match.winnerId === team.playerBId).length;
      const pointsFor = teamMatches.reduce((total, match) => total + (match.teamAId === team.id ? match.playerAScore : match.playerBScore), 0);
      const pointsAgainst = teamMatches.reduce((total, match) => total + (match.teamAId === team.id ? match.playerBScore : match.playerAScore), 0);
      return { team, matches: teamMatches.length, wins, difference: pointsFor - pointsAgainst };
    }).sort((a, b) => b.wins - a.wins || b.difference - a.difference);
  }, [matches, matchDraft.tournamentId, teams]);

  const recentMatches = useMemo(
    () =>
      [...matches]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4),
    [matches],
  );

  const playerMap = useMemo(
    () => Object.fromEntries(players.map((player) => [player.id, player])),
    [players],
  );

  const teamMap = useMemo(() => Object.fromEntries(teams.map((team) => [team.id, team])), [teams]);

  const teamLabel = (team: Team) =>
    team.name || `${playerMap[team.playerAId]?.name ?? "Player"} / ${playerMap[team.playerBId]?.name ?? "Player"}`;

  const selectedTournament = tournaments.find((tournament) => tournament.id === matchDraft.tournamentId);
  const eligibleTeamB = teams.filter((team) => {
    const teamA = teamMap[matchDraft.teamAId];
    if (!teamA || team.id === teamA.id) return false;
    return selectedTournament?.format !== "external" || team.group_name !== teamA.group_name;
  });

  const fixtureCount = (tournament: Tournament) => {
    if (tournament.format === "internal") return (teams.length * Math.max(teams.length - 1, 0)) / 2;
    const groupA = teams.filter((team) => team.group_name === "A").length;
    const groupB = teams.filter((team) => team.group_name === "B").length;
    return groupA * groupB;
  };

  const standingsTournament = tournaments.find((tournament) => tournament.id === standingsTournamentId) ?? tournaments[0];
  const teamStandings = useMemo(() => {
    const tournamentMatches = matches.filter((match) => match.tournamentId === standingsTournament?.id && match.teamAId && match.teamBId);
    return teams.map((team) => {
      const teamMatches = tournamentMatches.filter((match) => match.teamAId === team.id || match.teamBId === team.id);
      const wins = teamMatches.filter((match) => match.winnerId === team.playerAId || match.winnerId === team.playerBId).length;
      const pointsFor = teamMatches.reduce((total, match) => total + (match.teamAId === team.id ? match.playerAScore : match.playerBScore), 0);
      const pointsAgainst = teamMatches.reduce((total, match) => total + (match.teamAId === team.id ? match.playerBScore : match.playerAScore), 0);
      return { team, played: teamMatches.length, wins, pointsFor, pointsAgainst, difference: pointsFor - pointsAgainst };
    }).sort((a, b) => b.wins - a.wins || b.difference - a.difference || b.pointsFor - a.pointsFor);
  }, [matches, standingsTournament, teams]);

  const playoffTeams = teamStandings.slice(0, standingsTournament?.format === "external" ? 8 : 4);

  const addPlayer = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = newPlayer.name.trim();
    if (!trimmedName) {
      setNotice("Please enter a player name.");
      return;
    }

    const createdPlayer: Player = {
      id: createId(),
      name: trimmedName,
      group_name: newPlayer.group_name,
    };

    if (hasSupabaseConfig && supabase) {
      const { error } = await supabase.from("players").insert([createdPlayer]);

      if (error) {
        setNotice(`Supabase insert failed: ${error.message}`);
        return;
      }

      setNotice(`${trimmedName} was added to Supabase.`);
      const { data } = await supabase.from("players").select("*");
      setPlayers(data ?? [createdPlayer]);
    } else {
      setPlayers((current) => [...current, createdPlayer]);
      setNotice(`${trimmedName} was added to the player database.`);
    }

    setNewPlayer({ name: "", group_name: "WSS" });
  };

  const addTeam = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teamDraft.playerAId || !teamDraft.playerBId || teamDraft.playerAId === teamDraft.playerBId) {
      setNotice("Choose two different players for a doubles team.");
      return;
    }

    const playerA = playerMap[teamDraft.playerAId];
    const playerB = playerMap[teamDraft.playerBId];
    const createdTeam: Team = {
      id: createId(),
      name: teamDraft.name.trim() || `${playerA?.name ?? "Player"} / ${playerB?.name ?? "Player"}`,
      playerAId: teamDraft.playerAId,
      playerBId: teamDraft.playerBId,
      group_name: teamDraft.group_name.trim().toUpperCase() || "A",
    };

    if (hasSupabaseConfig && supabase) {
      const { error } = await supabase.from("teams").insert([createdTeam]);
      if (error) {
        setNotice(`Team save failed: ${error.message}`);
        return;
      }
      setTeams((current) => [...current, createdTeam]);
      setNotice(`${createdTeam.name} was saved to Supabase.`);
    } else {
      setTeams((current) => [...current, createdTeam]);
      setNotice(`${createdTeam.name} was added locally.`);
    }
    setTeamDraft((current) => ({ ...current, name: "" }));
  };

  const addTournament = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tournamentDraft.name.trim()) {
      setNotice("Enter a league name before creating it.");
      return;
    }

    const createdTournament: Tournament = {
      id: createId(),
      name: tournamentDraft.name.trim(),
      format: tournamentDraft.format,
      status: "active",
      created_at: new Date().toISOString(),
      event_date: tournamentDraft.event_date,
      location: tournamentDraft.location.trim(),
    };

    if (hasSupabaseConfig && supabase) {
      const { error } = await supabase.from("tournaments").insert([createdTournament]);
      if (error) {
        setNotice(`League save failed: ${error.message}`);
        return;
      }
    }
    setTournaments((current) => [...current, createdTournament]);
    setMatchDraft((current) => ({ ...current, tournamentId: createdTournament.id }));
    setTournamentDraft({ name: "", format: "internal", event_date: "", location: "" });
    setNotice(`${createdTournament.name} created as an ${createdTournament.format} tournament.`);
  };

  const saveMatch = async () => {
    const teamA = teamMap[matchDraft.teamAId];
    const teamB = teamMap[matchDraft.teamBId];
    if (!teamA || !teamB || teamA.id === teamB.id) {
      setNotice("Choose two different doubles teams to save a match.");
      return;
    }

    if (liveScore.playerA === 0 && liveScore.playerB === 0) {
      setNotice("Score cannot be 0-0. Enter a result before saving.");
      return;
    }

    const winnerId = liveScore.playerA > liveScore.playerB ? teamA.playerAId : teamB.playerAId;

    const record: MatchRecord = {
      id: createId(),
      playerAId: teamA.playerAId,
      playerBId: teamB.playerAId,
      playerAScore: liveScore.playerA,
      playerBScore: liveScore.playerB,
      winnerId,
      note: undefined,
      createdAt: new Date().toISOString(),
      teamAId: teamA.id,
      teamBId: teamB.id,
      tournamentId: matchDraft.tournamentId || undefined,
    };

    if (hasSupabaseConfig && supabase) {
      const { error } = await supabase.from("matches").insert([record]);

      if (error) {
        setNotice(`Supabase match save failed: ${error.message}`);
        return;
      }

      const { data } = await supabase.from("matches").select("*");
      setMatches((data ?? [record]) as MatchRecord[]);
      setNotice("Match result saved to Supabase.");
    } else {
      setMatches((current) => [record, ...current]);
      setNotice("Match result saved to local database.");
    }

    setLiveScore({ playerA: 0, playerB: 0 });
  };

  return (
    <div className="min-h-screen bg-[#f3f1ef] px-4 py-6 text-[#1d1d1f] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-[28px] border border-[#dad3cf] bg-[#f9f7f5]/90 px-5 py-4 shadow-[0_18px_40px_rgba(17,24,39,0.07)] backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1a1d20] text-lg font-bold text-white">
                W
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#61656d]">
                  WHITBY SMASH SQUAD
                </p>
                <h1 className="text-xl font-semibold text-[#111215]">WSS Badminton League</h1>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-2">
              {[
                { key: "dashboard", label: "Dashboard" },
                { key: "players", label: "Players" },
                { key: "teams", label: "Doubles teams" },
                { key: "tournaments", label: "Leagues" },
                { key: "standings", label: "Standings" },
                { key: "matches", label: "Matches" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key as TabName)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    tab === item.key
                      ? "bg-[#17191d] text-white shadow-md"
                      : "bg-white text-[#3b3d42] hover:bg-[#efefee]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <main className="space-y-6">
          <div className="rounded-[24px] border border-[#ddd5d1] bg-white/60 p-3 shadow-[0_10px_25px_rgba(17,24,39,0.04)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#6b7078]">System status</p>
                <p className="text-sm font-medium text-[#202328]">{notice}</p>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] ${
                hasSupabaseConfig
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}>
                {hasSupabaseConfig ? "LIVE SYNC" : "LOCAL MODE"}
              </div>
            </div>
          </div>

          {tab === "dashboard" && (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[22px] border border-[#dcd6d2] bg-[#191c20] p-5 text-white shadow-[0_18px_28px_rgba(17,24,39,0.12)]">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Players</p>
                  <div className="mt-4 flex items-end justify-between">
                    <span className="text-3xl font-bold">{players.length}</span>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                </div>

                <div className="rounded-[22px] border border-[#dcd6d2] bg-[#f8f7f5] p-5 shadow-[0_10px_20px_rgba(0,0,0,0.04)]">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#676d75]">Matches</p>
                  <div className="mt-4 flex items-end justify-between">
                    <span className="text-3xl font-bold text-[#17191d]">{matches.length}</span>
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                  </div>
                </div>

                <div className="rounded-[22px] border border-[#dcd6d2] bg-[#f8f7f5] p-5 shadow-[0_10px_20px_rgba(0,0,0,0.04)]">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#676d75]">Wins</p>
                  <div className="mt-4 flex items-end justify-between">
                    <span className="text-3xl font-bold text-[#17191d]">
                      {matches.filter((match) => match.winnerId === match.playerAId).length}
                    </span>
                    <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                  </div>
                </div>

                <div className="rounded-[22px] border border-[#dcd6d2] bg-[#f8f7f5] p-5 shadow-[0_10px_20px_rgba(0,0,0,0.04)]">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#676d75]">Leader</p>
                  <div className="mt-4 flex items-end justify-between">
                    <span className="text-2xl font-bold text-[#17191d]">
                      {leaderboard[0] ? teamLabel(leaderboard[0].team) : "-"}
                    </span>
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  </div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[26px] border border-[#d9d3d0] bg-[#1b1d20] p-5 text-white shadow-[0_16px_30px_rgba(17,24,39,0.12)]">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Live scoring</p>
                      <h2 className="mt-1 text-2xl font-semibold">{selectedTournament?.name ?? "Select a tournament"}</h2>
                    </div>
                  </div>

                  <select value={matchDraft.tournamentId} onChange={(event) => setMatchDraft((current) => ({ ...current, tournamentId: event.target.value, teamBId: "" }))} className="mb-4 w-full rounded-xl border border-white/10 bg-[#121417] px-3 py-2 text-sm text-white outline-none">
                    <option value="">Select tournament</option>
                    {tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}
                  </select>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">
                        Team 1
                      </label>
                      <select
                        className="w-full rounded-xl border border-white/10 bg-[#121417] px-3 py-2 text-sm text-white outline-none"
                        value={matchDraft.teamAId}
                        onChange={(event) =>
                          setMatchDraft((current) => ({ ...current, teamAId: event.target.value }))
                        }
                      >
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {teamLabel(team)}
                          </option>
                        ))}
                      </select>

                      <div className="mt-5 flex items-center justify-between">
                        <input type="number" min={0} value={liveScore.playerA} onChange={(event) => setLiveScore((current) => ({ ...current, playerA: Number(event.target.value) || 0 }))} className="w-28 rounded-xl border border-white/10 bg-[#121417] px-3 py-2 text-4xl font-bold text-white outline-none" />
                      </div>
                    </div>

                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">
                        Team 2
                      </label>
                      <select
                        className="w-full rounded-xl border border-white/10 bg-[#121417] px-3 py-2 text-sm text-white outline-none"
                        value={matchDraft.teamBId}
                        onChange={(event) =>
                          setMatchDraft((current) => ({ ...current, teamBId: event.target.value }))
                        }
                      >
                        {eligibleTeamB.map((team) => (
                          <option key={team.id} value={team.id}>
                            {teamLabel(team)}
                          </option>
                        ))}
                      </select>

                      <div className="mt-5 flex items-center justify-between">
                        <input type="number" min={0} value={liveScore.playerB} onChange={(event) => setLiveScore((current) => ({ ...current, playerB: Number(event.target.value) || 0 }))} className="w-28 rounded-xl border border-white/10 bg-[#121417] px-3 py-2 text-4xl font-bold text-white outline-none" />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={saveMatch}
                    className="mt-5 w-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20"
                  >
                    Save match result
                  </button>
                </div>

                <div className="rounded-[26px] border border-[#d9d3d0] bg-[#f9f7f5] p-5 shadow-[0_10px_22px_rgba(0,0,0,0.04)]">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-[#696f77]">Leaderboard</p>
                      <h2 className="mt-1 text-2xl font-semibold text-[#181a1d]">Player rankings</h2>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {leaderboard.map((entry, index) => (
                      <div
                        key={entry.team.id}
                        className="flex items-center justify-between rounded-[18px] border border-[#e5e0dd] bg-white p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#17191d] text-sm font-semibold text-white">
                            #{index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-[#17191d]">{teamLabel(entry.team)}</p>
                            <p className="text-xs text-[#666d75]">{entry.matches} matches · +{entry.difference} difference</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-[#17191d]">{entry.wins}</p>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[#6b7077]">wins</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          {tab === "players" && (
            <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[26px] border border-[#d9d3d0] bg-[#171a1d] p-5 text-white shadow-[0_16px_30px_rgba(17,24,39,0.12)]">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Add player</p>
                <h2 className="mt-2 text-2xl font-semibold">Player profile</h2>

                <form onSubmit={addPlayer} className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newPlayer.name}
                      onChange={(event) => setNewPlayer((current) => ({ ...current, name: event.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none"
                      placeholder="Enter player name"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">
                      Group name
                    </label>
                    <select
                      value={newPlayer.group_name}
                      onChange={(event) => setNewPlayer((current) => ({ ...current, group_name: event.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none"
                    >
                      {groupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Save player
                  </button>
                </form>
              </div>

              <div className="rounded-[26px] border border-[#d9d3d0] bg-[#f9f7f5] p-5 shadow-[0_10px_22px_rgba(0,0,0,0.04)]">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#696f77]">Roster</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#181a1d]">Player database</h2>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {players.map((player) => (
                    <div key={player.id} className="rounded-[20px] border border-[#e4dfdc] bg-white p-4">
                      <div className="flex items-center justify-between">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#17191d] text-sm font-semibold text-white">
                          {player.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="rounded-full bg-[#eef2ff] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#4f46e5]">
                          Group {player.group_name}
                        </span>
                      </div>

                      <p className="mt-3 text-lg font-semibold text-[#17191d]">{player.name}</p>
                      <p className="text-sm text-[#626972]">Group {player.group_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {tab === "teams" && (
            <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[26px] border border-[#d9d3d0] bg-[#171a1d] p-5 text-white">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Doubles roster</p>
                <h2 className="mt-2 text-2xl font-semibold">Create a team</h2>
                <form onSubmit={addTeam} className="mt-5 space-y-4">
                  <input value={teamDraft.name} onChange={(event) => setTeamDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Team name (optional)" className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none" />
                  <select value={teamDraft.playerAId} onChange={(event) => setTeamDraft((current) => ({ ...current, playerAId: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none">
                    {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                  </select>
                  <select value={teamDraft.playerBId} onChange={(event) => setTeamDraft((current) => ({ ...current, playerBId: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none">
                    {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                  </select>
                  <input value={teamDraft.group_name} onChange={(event) => setTeamDraft((current) => ({ ...current, group_name: event.target.value }))} placeholder="Group: A or B" className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none" />
                  <button type="submit" className="w-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white">Save doubles team</button>
                </form>
              </div>
              <div className="rounded-[26px] border border-[#d9d3d0] bg-[#f9f7f5] p-5">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#696f77]">Teams</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#181a1d]">Doubles roster</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {teams.map((team) => <div key={team.id} className="rounded-[20px] border border-[#e4dfdc] bg-white p-4"><p className="text-lg font-semibold text-[#17191d]">{teamLabel(team)}</p><p className="mt-1 text-sm text-[#626972]">Group {team.group_name}</p></div>)}
                  {!teams.length && <p className="text-sm text-[#626972]">Create teams from the Players list before recording doubles results.</p>}
                </div>
              </div>
            </section>
          )}

          {tab === "tournaments" && (
            <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[26px] border border-[#d9d3d0] bg-[#171a1d] p-5 text-white">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">League setup</p>
                <h2 className="mt-2 text-2xl font-semibold">Create a tournament</h2>
                <form onSubmit={addTournament} className="mt-5 space-y-4">
                  <input value={tournamentDraft.name} onChange={(event) => setTournamentDraft((current) => ({ ...current, name: event.target.value }))} placeholder="WSS Internal League" className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none" />
                  <input type="datetime-local" value={tournamentDraft.event_date} onChange={(event) => setTournamentDraft((current) => ({ ...current, event_date: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none" />
                  <input value={tournamentDraft.location} onChange={(event) => setTournamentDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Location" className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none" />
                  <select value={tournamentDraft.format} onChange={(event) => setTournamentDraft((current) => ({ ...current, format: event.target.value as "internal" | "external" }))} className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none">
                    <option value="internal">Internal: every team plays every other WSS team</option>
                    <option value="external">External: Group A plays Group B</option>
                  </select>
                  <button type="submit" className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white">Create league</button>
                </form>
              </div>
              <div className="rounded-[26px] border border-[#d9d3d0] bg-[#f9f7f5] p-5">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#696f77]">Competition calendar</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#181a1d]">Your leagues</h2>
                <div className="mt-5 space-y-3">{tournaments.map((tournament) => <div key={tournament.id} className="rounded-[20px] border border-[#e4dfdc] bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-[#17191d]">{tournament.name}</p><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] uppercase text-emerald-700">{tournament.format}</span></div><p className="mt-2 text-sm text-[#626972]">{tournament.format === "internal" ? "All enrolled teams play one another." : "Teams play the teams in the opposite group."}</p><p className="mt-2 text-xs text-[#626972]">{tournament.event_date ? new Date(tournament.event_date).toLocaleString() : "Date to be announced"}{tournament.location ? ` · ${tournament.location}` : ""}</p></div>)}</div>
              </div>
            </section>
          )}

          {tab === "standings" && (
            <section className="space-y-6">
              <div className="rounded-[26px] border border-[#d9d3d0] bg-[#191c20] p-5 text-white">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div><p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Competition table</p><h2 className="mt-2 text-2xl font-semibold">Tournament standings</h2></div>
                  <select value={standingsTournament?.id ?? ""} onChange={(event) => setStandingsTournamentId(event.target.value)} className="rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none"><option value="">Select league</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select>
                </div>
                {!standingsTournament && <p className="mt-5 text-sm text-slate-300">Create a league and record tournament matches to build standings.</p>}
                {standingsTournament && <p className="mt-4 text-sm text-slate-300">{standingsTournament.format === "internal" ? "Internal league: top 4 qualify for the playoff." : "External league: top 8 qualify for the quarter-finals."} Rankings use wins first, then point difference, then points scored.</p>}
              </div>

              {standingsTournament && <>
                <div className="overflow-x-auto rounded-[26px] border border-[#d9d3d0] bg-[#f9f7f5] p-5"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-[#ded8d4] text-[10px] uppercase tracking-[0.18em] text-[#6a7077]"><tr><th className="px-3 py-3">Rank</th><th className="px-3 py-3">Team</th><th className="px-3 py-3">P</th><th className="px-3 py-3">W</th><th className="px-3 py-3">PF</th><th className="px-3 py-3">PA</th><th className="px-3 py-3">Diff</th></tr></thead><tbody>{teamStandings.map((entry, index) => <tr key={entry.team.id} className="border-b border-[#ebe6e2] last:border-0"><td className="px-3 py-3 font-semibold text-[#59616a]">{index + 1}</td><td className="px-3 py-3 font-semibold text-[#17191d]">{teamLabel(entry.team)}<span className="ml-2 text-xs font-normal text-[#707780]">Group {entry.team.group_name}</span></td><td className="px-3 py-3 text-[#30343a]">{entry.played}</td><td className="px-3 py-3 font-bold text-[#17191d]">{entry.wins}</td><td className="px-3 py-3 text-[#30343a]">{entry.pointsFor}</td><td className="px-3 py-3 text-[#30343a]">{entry.pointsAgainst}</td><td className={`px-3 py-3 font-semibold ${entry.difference >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{entry.difference > 0 ? "+" : ""}{entry.difference}</td></tr>)}</tbody></table></div>

                <div className="rounded-[26px] border border-[#d9d3d0] bg-[#171a1d] p-5 text-white"><p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Knockout format</p><h2 className="mt-2 text-2xl font-semibold">{standingsTournament.format === "internal" ? "Internal playoff" : "External knockout"}</h2><div className="mt-5 grid gap-4 md:grid-cols-3">
                  {standingsTournament.format === "internal" ? <><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Qualifier 1</p><p className="mt-3 font-semibold">1. {playoffTeams[0] ? teamLabel(playoffTeams[0].team) : "TBD"} vs 2. {playoffTeams[1] ? teamLabel(playoffTeams[1].team) : "TBD"}</p><p className="mt-3 text-sm text-slate-300">Winner goes directly to the final.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.16em] text-amber-300">Eliminator</p><p className="mt-3 font-semibold">3. {playoffTeams[2] ? teamLabel(playoffTeams[2].team) : "TBD"} vs 4. {playoffTeams[3] ? teamLabel(playoffTeams[3].team) : "TBD"}</p><p className="mt-3 text-sm text-slate-300">Winner advances to Qualifier 2.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.16em] text-sky-300">Final path</p><p className="mt-3 font-semibold">Qualifier 2 vs Qualifier 1 winner</p><p className="mt-3 text-sm text-slate-300">Qualifier 2 winner reaches the final. Bronze goes to the Qualifier 2 loser.</p></div></> : <><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Quarter-finals</p><p className="mt-3 font-semibold">1 vs 8<br />2 vs 7<br />3 vs 6<br />4 vs 5</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.16em] text-amber-300">Semi-finals</p><p className="mt-3 font-semibold">Winner (1/8) vs Winner (2/7)<br /><br />Winner (3/6) vs Winner (4/5)</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.16em] text-sky-300">Final & bronze</p><p className="mt-3 font-semibold">Semi-final winners play final</p><p className="mt-3 text-sm text-slate-300">Final winner: gold. Final loser: silver. Semi-final losers play the bronze match.</p></div></>}
                </div></div>
              </>}
            </section>
          )}

          {tab === "matches" && (
            <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[26px] border border-[#d9d3d0] bg-[#191c20] p-5 text-white shadow-[0_16px_30px_rgba(17,24,39,0.12)]">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Record</p>
                <h2 className="mt-2 text-2xl font-semibold">Match results</h2>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">League</label>
                    <select value={matchDraft.tournamentId} onChange={(event) => setMatchDraft((current) => ({ ...current, tournamentId: event.target.value, teamBId: "" }))} className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none">
                      <option value="">Friendly / no league</option>
                      {tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name} ({tournament.format})</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">
                      Team 1
                    </label>
                    <select
                      className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none"
                      value={matchDraft.teamAId}
                      onChange={(event) =>
                        setMatchDraft((current) => ({ ...current, teamAId: event.target.value }))
                      }
                    >
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {teamLabel(team)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">
                      Team 2
                    </label>
                    <select
                      className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none"
                      value={matchDraft.teamBId}
                      onChange={(event) =>
                        setMatchDraft((current) => ({ ...current, teamBId: event.target.value }))
                      }
                    >
                      {eligibleTeamB.map((team) => (
                        <option key={team.id} value={team.id}>
                          {teamLabel(team)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[16px] border border-white/10 bg-[#101316] p-3">
                      <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">
                        A score
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={liveScore.playerA}
                        onChange={(event) =>
                          setLiveScore((current) => ({ ...current, playerA: Number(event.target.value) || 0 }))
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#171b1f] px-3 py-2 text-sm text-white outline-none"
                      />
                    </div>

                    <div className="rounded-[16px] border border-white/10 bg-[#101316] p-3">
                      <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">
                        B score
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={liveScore.playerB}
                        onChange={(event) =>
                          setLiveScore((current) => ({ ...current, playerB: Number(event.target.value) || 0 }))
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#171b1f] px-3 py-2 text-sm text-white outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={saveMatch}
                    className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Save result
                  </button>
                </div>
              </div>

              <div className="rounded-[26px] border border-[#d9d3d0] bg-[#f9f7f5] p-5 shadow-[0_10px_22px_rgba(0,0,0,0.04)]">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#696f77]">Recent activity</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#181a1d]">Match history</h2>

                <div className="mt-5 space-y-3">
                  {recentMatches.map((match) => {
                    const playerA = playerMap[match.playerAId];
                    const playerB = playerMap[match.playerBId];
                    const winner = playerMap[match.winnerId];
                    const teamA = match.teamAId ? teamMap[match.teamAId] : undefined;
                    const teamB = match.teamBId ? teamMap[match.teamBId] : undefined;
                    const winnerTeam = match.winnerId === teamA?.playerAId ? teamA : match.winnerId === teamB?.playerAId ? teamB : undefined;

                    return (
                      <div key={match.id} className="rounded-[20px] border border-[#e4dfdd] bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-[#17191d]">
                              {teamA ? teamLabel(teamA) : playerA?.name ?? "Unknown"} vs {teamB ? teamLabel(teamB) : playerB?.name ?? "Unknown"}
                            </p>
                            <p className="text-sm text-[#636b74]">{match.note}</p>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-700">
                            {winnerTeam ? teamLabel(winnerTeam) : winner?.name ?? "Winner"}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between rounded-[14px] bg-[#f6f7f8] px-3 py-2 text-sm text-[#1c1f22]">
                          <span>{match.playerAScore}</span>
                          <span className="text-[#727980]">:</span>
                          <span>{match.playerBScore}</span>
                        </div>

                        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#707782]">
                          {new Date(match.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

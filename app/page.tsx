"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  stage?: string;
  bracketKey?: string;
};

type Team = {
  id: string;
  name: string;
  playerAId: string;
  playerBId: string;
  group_name: string;
  tournamentId?: string;
};

type Tournament = {
  id: string;
  name: string;
  format: "internal" | "external";
  status: string;
  created_at: string;
  event_date: string;
  location: string;
  group_a: string;
  group_b: string;
  teams_per_group: number;
};

type Group = { id: string; name: string };

type PairInput = { group: "a" | "b"; index: number; player1: string; player2: string };

type TabName = "dashboard" | "players" | "teams" | "tournaments" | "standings" | "playoffs" | "matches";

const STORAGE_KEY = "wss-badminton-db-v1";
const defaultGroupOptions = ["WSS", "FFBC", "SW", "SSBC", "DBCC", "DCSC"];
const normalizeGroup = (value: string | undefined) => value?.trim().toUpperCase() ?? "";
const normalizeScoreInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return String(Math.min(30, Number(digits)));
};
const easternTimeZone = "America/Toronto";

const easternLocalToIso = (value: string) => {
  if (!value) return "";
  const localUtc = new Date(`${value}:00Z`);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: easternTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(localUtc);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const easternAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
  const offsetMinutes = (easternAsUtc - localUtc.getTime()) / 60000;
  return new Date(localUtc.getTime() - offsetMinutes * 60000).toISOString();
};

const formatEasternTime = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-US", { timeZone: easternTimeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) + " ET"
    : "Date to be announced";

const easternIsoToLocal = (value: string) => {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: easternTimeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
};

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
  const [groups, setGroups] = useState<Group[]>(defaultGroupOptions.map((name) => ({ id: name, name })));
  const [tab, setTab] = useState<TabName>("dashboard");
  const [newPlayer, setNewPlayer] = useState({ name: "", group_name: "WSS" });
  const [liveScore, setLiveScore] = useState({ playerA: "", playerB: "" });
  const [matchDraft, setMatchDraft] = useState({
    teamAId: "",
    teamBId: "",
    tournamentId: "",
    note: "",
  });
  const [teamDraft, setTeamDraft] = useState({ name: "", playerAId: "", playerBId: "", group_name: "A" });
  const [tournamentDraft, setTournamentDraft] = useState({ name: "", format: "internal" as "internal" | "external", event_date: "", location: "", group_a: "WSS", group_b: "DCSC", teams_per_group: 7 });
  const [pairNames, setPairNames] = useState<PairInput[]>([]);
  const [deletePlayerDraft, setDeletePlayerDraft] = useState({ name: "", group_name: "WSS" });
  const [deleteTournamentId, setDeleteTournamentId] = useState("");
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [fixtureTeamFilter, setFixtureTeamFilter] = useState("");
  const [playoffTournamentId, setPlayoffTournamentId] = useState("");
  const [playoffScores, setPlayoffScores] = useState<Record<string, { a: string; b: string }>>({});
  const [standingsTournamentId, setStandingsTournamentId] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [notice, setNotice] = useState("Local storage mode enabled. Connect Supabase for live database storage.");
  const groupOptions = groups.map((group) => group.name);
  const visibleTournaments = tournaments.filter((tournament) => isAuthenticated || tournament.status !== "hidden");

  const refreshDatabase = useCallback(async () => {
    if (!supabase) return;
    const [{ data: nextPlayers }, { data: nextMatches }, { data: nextTeams }, { data: nextTournaments }, { data: nextGroups }] = await Promise.all([
      supabase.from("players").select("*"),
      supabase.from("matches").select("*"),
      supabase.from("teams").select("*"),
      supabase.from("tournaments").select("*"),
      supabase.from("groups").select("*").order("name"),
    ]);
    setPlayers((nextPlayers ?? []) as Player[]);
    setMatches((nextMatches ?? []) as MatchRecord[]);
    setTeams((nextTeams ?? []) as Team[]);
    setTournaments((nextTournaments ?? []) as Tournament[]);
    if (nextGroups?.length) setGroups(nextGroups as Group[]);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setIsAuthenticated(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setIsAuthenticated(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
    setAuthBusy(false);
    if (error) {
      setNotice(`Login failed: ${error.message}`);
      return;
    }
    setAuthPassword("");
    setShowLogin(false);
    setNotice("Admin access enabled.");
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setTab("dashboard");
    setNotice("Signed out. Public result access remains available.");
  };

  const createGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newGroupName.trim().toUpperCase();
    if (!name || groupOptions.includes(name)) {
      setNotice("Enter a new group name.");
      return;
    }
    const group = { id: name, name };
    if (hasSupabaseConfig && supabase) {
      const { error } = await supabase.from("groups").insert([group]);
      if (error) { setNotice(`Group save failed: ${error.message}`); return; }
      await refreshDatabase();
    } else {
      setGroups((current) => [...current, group].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setNewGroupName("");
    setNotice(`${name} group is ready to use.`);
  };

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
      const { data: groupsData, error: groupsError } = await client.from("groups").select("*").order("name");

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
      if (groupsData?.length) setGroups(groupsData as Group[]);
      setTeamDraft((current) => ({ ...current, playerAId: current.playerAId || nextPlayers[0]?.id || "", playerBId: current.playerBId || nextPlayers[1]?.id || "" }));
      setMatchDraft((current) => ({ ...current, tournamentId: current.tournamentId || "", teamAId: "", teamBId: "" }));
      setNotice("Connected to Supabase. Live sync is active.");
    };

    loadSupabaseData();

    const channel = client
      .channel("wss-league-live-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, loadSupabaseData)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, loadSupabaseData)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, loadSupabaseData)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, loadSupabaseData)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, loadSupabaseData)
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
  }, [players, matches, teams, tournaments]);

  const leaderboard = useMemo(() => {
    const tournamentId = matchDraft.tournamentId;
    return teams.filter((team) => team.tournamentId === tournamentId).map((team) => {
      const teamMatches = matches.filter((match) => match.tournamentId === tournamentId && (match.teamAId === team.id || match.teamBId === team.id));
      const wins = teamMatches.filter((match) => {
        const teamIsA = match.teamAId === team.id;
        return teamIsA ? match.playerAScore > match.playerBScore : match.playerBScore > match.playerAScore;
      }).length;
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
    `${playerMap[team.playerAId]?.name ?? "Player"} / ${playerMap[team.playerBId]?.name ?? "Player"} (${teamGroup(team)})`;

  const teamGroup = (team: Team) => {
    const playerGroup = normalizeGroup(playerMap[team.playerAId]?.group_name);
    return groupOptions.includes(playerGroup) ? playerGroup : normalizeGroup(team.group_name);
  };

  const teamBelongsToGroup = (team: Team, group: string | undefined) =>
    Boolean(group) && (normalizeGroup(team.group_name) === normalizeGroup(group) || normalizeGroup(playerMap[team.playerAId]?.group_name) === normalizeGroup(group) || normalizeGroup(playerMap[team.playerBId]?.group_name) === normalizeGroup(group));

  const selectedTournament = tournaments.find((tournament) => tournament.id === matchDraft.tournamentId);
  const tournamentTeams = teams.filter((team) => team.tournamentId === selectedTournament?.id);
  const team1Group = selectedTournament?.group_a;
  const team2Group = selectedTournament?.format === "external" ? selectedTournament.group_b : selectedTournament?.group_a;
  const tournamentFixtures = useMemo(() => {
    if (!selectedTournament) return [];
    const tournamentTeams = teams.filter((team) => team.tournamentId === selectedTournament.id);
    const fixtures: { teamA: Team; teamB: Team; match?: MatchRecord; teamAScore?: number; teamBScore?: number }[] = [];
    tournamentTeams.forEach((teamA, index) => tournamentTeams.slice(index + 1).forEach((teamB) => {
      if (selectedTournament.format === "external" && teamGroup(teamA) === teamGroup(teamB)) return;
      const match = matches.find((item) => item.tournamentId === selectedTournament.id && ((item.teamAId === teamA.id && item.teamBId === teamB.id) || (item.teamAId === teamB.id && item.teamBId === teamA.id)));
      const teamsMatchStoredOrder = match?.teamAId === teamA.id;
      fixtures.push({
        teamA,
        teamB,
        match,
        teamAScore: match ? (teamsMatchStoredOrder ? match.playerAScore : match.playerBScore) : undefined,
        teamBScore: match ? (teamsMatchStoredOrder ? match.playerBScore : match.playerAScore) : undefined,
      });
    }));
    return fixtures;
  }, [matches, selectedTournament, teams]);
  const eligibleTeamA = useMemo(() => tournamentTeams.filter((team) => teamBelongsToGroup(team, team1Group)), [tournamentTeams, team1Group, playerMap]);
  const eligibleTeamB = useMemo(() => tournamentTeams.filter((team) => team.id !== matchDraft.teamAId && teamBelongsToGroup(team, team2Group)), [tournamentTeams, matchDraft.teamAId, team2Group, playerMap]);

  const filteredFixtures = fixtureTeamFilter
    ? tournamentFixtures.filter((fixture) => fixture.teamA.id === fixtureTeamFilter || fixture.teamB.id === fixtureTeamFilter)
    : [];

  const fixtureCount = (tournament: Tournament) => {
    const tournamentTeams = teams.filter((team) => team.tournamentId === tournament.id);
    if (tournament.format === "internal") return (tournamentTeams.length * Math.max(tournamentTeams.length - 1, 0)) / 2;
    const groupA = tournamentTeams.filter((team) => teamGroup(team) === tournament.group_a).length;
    const groupB = tournamentTeams.filter((team) => teamGroup(team) === tournament.group_b).length;
    return groupA * groupB;
  };

  const tournamentPairs = pairNames.length
    ? pairNames
    : (tournamentDraft.format === "internal" ? (["a"] as const) : (["a", "b"] as const)).flatMap((group) =>
        Array.from({ length: tournamentDraft.teams_per_group }, (_, index) => ({ group, index, player1: "", player2: "" })),
      );

  const tournamentPlayers = (group: "a" | "b") =>
    players.filter((player) => player.group_name === (group === "a" ? tournamentDraft.group_a : tournamentDraft.group_b));

  const availablePairPlayers = (pair: PairInput, slot: "player1" | "player2") => {
    const selectedInGroup = tournamentPairs
      .filter((item) => item.group === pair.group && item.index !== pair.index)
      .flatMap((item) => [item.player1, item.player2]);
    const otherSlot = tournamentPairs.find((item) => item.group === pair.group && item.index === pair.index)?.[slot === "player1" ? "player2" : "player1"];
    return tournamentPlayers(pair.group).filter((player) => !selectedInGroup.includes(player.id) && (player.id === pair[slot] || player.id !== otherSlot));
  };

  const standingsTournament = tournaments.find((tournament) => tournament.id === standingsTournamentId) ?? tournaments[0];
  const playoffTournament = tournaments.find((tournament) => tournament.id === playoffTournamentId) ?? selectedTournament;
  const teamStandings = useMemo(() => {
    const tournamentMatches = matches.filter((match) => match.tournamentId === standingsTournament?.id && match.teamAId && match.teamBId && (!match.stage || match.stage === "round_robin"));
    return teams.filter((team) => team.tournamentId === standingsTournament?.id).map((team) => {
      const teamMatches = tournamentMatches.filter((match) => match.teamAId === team.id || match.teamBId === team.id);
      const wins = teamMatches.filter((match) => {
        const teamIsA = match.teamAId === team.id;
        return teamIsA ? match.playerAScore > match.playerBScore : match.playerBScore > match.playerAScore;
      }).length;
      const pointsFor = teamMatches.reduce((total, match) => total + (match.teamAId === team.id ? match.playerAScore : match.playerBScore), 0);
      const pointsAgainst = teamMatches.reduce((total, match) => total + (match.teamAId === team.id ? match.playerBScore : match.playerAScore), 0);
      return { team, played: teamMatches.length, wins, pointsFor, pointsAgainst, difference: pointsFor - pointsAgainst };
    }).sort((a, b) => b.wins - a.wins || b.difference - a.difference || b.pointsFor - a.pointsFor);
  }, [matches, standingsTournament, teams]);

  const playoffTeams = teamStandings.slice(0, standingsTournament?.format === "external" ? 8 : 4);

  const playoffRoundRobinComplete = useMemo(() => {
    if (!playoffTournament) return false;
    const tournamentTeams = teams.filter((team) => team.tournamentId === playoffTournament.id);
    const expectedFixtures = playoffTournament.format === "internal"
      ? (tournamentTeams.length * Math.max(tournamentTeams.length - 1, 0)) / 2
      : tournamentTeams.filter((team) => teamGroup(team) === playoffTournament.group_a).length * tournamentTeams.filter((team) => teamGroup(team) === playoffTournament.group_b).length;
    const completedFixtures = matches.filter((match) => match.tournamentId === playoffTournament.id && (!match.stage || match.stage === "round_robin") && match.teamAId && match.teamBId).length;
    return expectedFixtures > 0 && completedFixtures >= expectedFixtures;
  }, [matches, playoffTournament, teams, playerMap]);

  const playoffStandings = useMemo(() => {
    if (!playoffTournament || !playoffRoundRobinComplete) return [];
    return teams.filter((team) => team.tournamentId === playoffTournament.id).map((team) => {
      const games = matches.filter((match) => match.tournamentId === playoffTournament.id && (!match.stage || match.stage === "round_robin") && (match.teamAId === team.id || match.teamBId === team.id));
      const wins = games.filter((match) => match.teamAId === team.id ? match.playerAScore > match.playerBScore : match.playerBScore > match.playerAScore).length;
      const pf = games.reduce((sum, match) => sum + (match.teamAId === team.id ? match.playerAScore : match.playerBScore), 0);
      const pa = games.reduce((sum, match) => sum + (match.teamAId === team.id ? match.playerBScore : match.playerAScore), 0);
      return { team, wins, difference: pf - pa };
    }).sort((a, b) => b.wins - a.wins || b.difference - a.difference);
  }, [matches, playoffRoundRobinComplete, playoffTournament, teams]);

  const playoffMatch = (key: string, teamA?: Team, teamB?: Team) => {
    const saved = playoffRoundRobinComplete
      ? matches.find((match) => match.tournamentId === playoffTournament?.id && match.stage && match.bracketKey === key)
      : undefined;
    return { key, teamA, teamB, match: saved, teamAScore: saved?.playerAScore, teamBScore: saved?.playerBScore };
  };

  const winnerOf = (key: string) => {
    const match = matches.find((item) => item.tournamentId === playoffTournament?.id && item.bracketKey === key);
    if (!match) return undefined;
    return match.teamAId && match.playerAScore > match.playerBScore ? teamMap[match.teamAId] : match.teamBId ? teamMap[match.teamBId] : undefined;
  };

  const loserOf = (key: string) => {
    const match = matches.find((item) => item.tournamentId === playoffTournament?.id && item.bracketKey === key);
    if (!match || match.playerAScore === match.playerBScore) return undefined;
    return match.teamAId && match.playerAScore < match.playerBScore ? teamMap[match.teamAId] : match.teamBId ? teamMap[match.teamBId] : undefined;
  };

  const playoffBracket = useMemo(() => {
    if (!playoffTournament) return { columns: [], podium: [] as (Team | undefined)[] };
    if (playoffTournament.format === "internal") {
      const q1 = playoffMatch("q1", playoffStandings[0]?.team, playoffStandings[1]?.team);
      const elim = playoffMatch("eliminator", playoffStandings[2]?.team, playoffStandings[3]?.team);
      const q2 = playoffMatch("q2", loserOf("q1"), winnerOf("eliminator"));
      const final = playoffMatch("final", winnerOf("q1"), winnerOf("q2"));
      return { columns: [[q1, elim], [q2], [final]], podium: [winnerOf("final"), loserOf("final"), loserOf("q2")] };
    }
    const q = [0, 1, 2, 3].map((index) => playoffMatch(`qf${index + 1}`, playoffStandings[index]?.team, playoffStandings[7 - index]?.team));
    const sf1 = playoffMatch("sf1", winnerOf("qf1"), winnerOf("qf2"));
    const sf2 = playoffMatch("sf2", winnerOf("qf3"), winnerOf("qf4"));
    const final = playoffMatch("final", winnerOf("sf1"), winnerOf("sf2"));
    const bronze = playoffMatch("bronze", loserOf("sf1"), loserOf("sf2"));
    return { columns: [q, [sf1, sf2], [final, bronze]], podium: [winnerOf("final"), loserOf("final"), winnerOf("bronze")] };
  }, [matches, playoffStandings, playoffTournament, teamMap]);

  const playoffResultOrder = playoffTournament?.format === "external"
    ? ["final", "bronze", "sf1", "sf2", "qf1", "qf2", "qf3", "qf4"]
    : ["final", "q2", "q1", "eliminator"];
  const dashboardPlayoffResults = playoffTournament
    ? playoffResultOrder.map((key) => {
        const fixture = playoffBracket.columns.flat().find((item) => item.key === key);
        return fixture?.match ? fixture : undefined;
      }).filter((fixture): fixture is NonNullable<typeof fixture> => Boolean(fixture))
    : [];
  const playoffComplete = Boolean(playoffRoundRobinComplete && playoffTournament && playoffResultOrder.every((key) => playoffBracket.columns.flat().some((fixture) => fixture.key === key && fixture.match)));

  const deletablePlayers = players.filter((player) => player.group_name === deletePlayerDraft.group_name);

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
      await refreshDatabase();
    } else {
      setPlayers((current) => [...current, createdPlayer]);
      setNotice(`${trimmedName} was added to the player database.`);
    }

    setNewPlayer({ name: "", group_name: "WSS" });
  };

  const deletePlayer = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = players.find((player) => player.name.trim().toLowerCase() === deletePlayerDraft.name.trim().toLowerCase() && player.group_name === deletePlayerDraft.group_name);
    if (!target) {
      setNotice("No player matches that name and group.");
      return;
    }

    const targetTeams = teams.filter((team) => team.playerAId === target.id || team.playerBId === target.id);
    const targetTeamIds = targetTeams.map((team) => team.id);
    if (hasSupabaseConfig && supabase) {
      if (targetTeamIds.length) {
        const { error: matchError } = await supabase.from("matches").delete().or(`teamAId.in.(${targetTeamIds.join(",")}),teamBId.in.(${targetTeamIds.join(",")})`);
        if (matchError) { setNotice(`Player delete failed: ${matchError.message}`); return; }
        const { error: teamError } = await supabase.from("teams").delete().in("id", targetTeamIds);
        if (teamError) { setNotice(`Player delete failed: ${teamError.message}`); return; }
      }
      const { error } = await supabase.from("players").delete().eq("id", target.id);
      if (error) { setNotice(`Player delete failed: ${error.message}`); return; }
      await refreshDatabase();
      setDeletePlayerDraft({ name: "", group_name: "WSS" });
      setNotice(`${target.name} from ${target.group_name} was deleted.`);
      return;
    }
    setPlayers((current) => current.filter((player) => player.id !== target.id));
    setTeams((current) => current.filter((team) => !targetTeamIds.includes(team.id)));
    setMatches((current) => current.filter((match) => !targetTeamIds.includes(match.teamAId ?? "") && !targetTeamIds.includes(match.teamBId ?? "")));
    setDeletePlayerDraft({ name: "", group_name: "WSS" });
    setNotice(`${target.name} from ${target.group_name} was deleted.`);
  };

  const deleteTournament = async (tournament: Tournament) => {
    const tournamentTeamIds = teams.filter((team) => team.tournamentId === tournament.id).map((team) => team.id);
    if (hasSupabaseConfig && supabase) {
      const { error: matchError } = await supabase.from("matches").delete().eq("tournamentId", tournament.id);
      if (matchError) { setNotice(`League delete failed: ${matchError.message}`); return; }
      const { error: teamError } = await supabase.from("teams").delete().eq("tournamentId", tournament.id);
      if (teamError) { setNotice(`League delete failed: ${teamError.message}`); return; }
      const { error } = await supabase.from("tournaments").delete().eq("id", tournament.id);
      if (error) { setNotice(`League delete failed: ${error.message}`); return; }
      await refreshDatabase();
      setNotice(`${tournament.name} was deleted.`);
      return;
    }
    setTournaments((current) => current.filter((item) => item.id !== tournament.id));
    setTeams((current) => current.filter((team) => !tournamentTeamIds.includes(team.id)));
    setMatches((current) => current.filter((match) => match.tournamentId !== tournament.id));
    if (matchDraft.tournamentId === tournament.id) setMatchDraft((current) => ({ ...current, tournamentId: "", teamAId: "", teamBId: "" }));
    setNotice(`${tournament.name} was deleted.`);
  };

  const clearTournamentResults = async (tournament: Tournament) => {
    if (!window.confirm(`Clear all results for ${tournament.name}? Other leagues will not be affected.`)) return;
    if (hasSupabaseConfig && supabase) {
      const { error } = await supabase.from("matches").delete().eq("tournamentId", tournament.id);
      if (error) {
        setNotice(`Could not clear ${tournament.name}: ${error.message}`);
        return;
      }
      await refreshDatabase();
    } else {
      setMatches((current) => current.filter((match) => match.tournamentId !== tournament.id));
    }
    setLiveScore({ playerA: "", playerB: "" });
    setEditingMatchId(null);
    setNotice(`All results for ${tournament.name} were cleared.`);
  };

  const editMatch = (fixture: { teamA: Team; teamB: Team; match?: MatchRecord; teamAScore?: number; teamBScore?: number }) => {
    if (!fixture.match) return;
    setEditingMatchId(fixture.match.id);
    setMatchDraft((current) => ({ ...current, tournamentId: fixture.match?.tournamentId ?? current.tournamentId, teamAId: fixture.teamA.id, teamBId: fixture.teamB.id }));
    setLiveScore({ playerA: String(fixture.teamAScore ?? ""), playerB: String(fixture.teamBScore ?? "") });
    setNotice("Result loaded. Edit the scores and save the updated result.");
  };

  const selectFixture = (fixtureKey: string) => {
    const fixture = tournamentFixtures.find((item) => `${item.teamA.id}:${item.teamB.id}` === fixtureKey);
    if (!fixture) return;
    setEditingMatchId(fixture.match?.id ?? null);
    setMatchDraft((current) => ({ ...current, teamAId: fixture.teamA.id, teamBId: fixture.teamB.id }));
    setLiveScore({ playerA: fixture.match ? String(fixture.teamAScore) : "", playerB: fixture.match ? String(fixture.teamBScore) : "" });
  };

  const selectScoringTeam = (side: "a" | "b", teamId: string) => {
    const nextDraft = { ...matchDraft, [side === "a" ? "teamAId" : "teamBId"]: teamId };
    setMatchDraft(nextDraft);
    const teamAId = nextDraft.teamAId;
    const teamBId = nextDraft.teamBId;
    if (!teamAId || !teamBId) {
      setLiveScore({ playerA: "", playerB: "" });
      return;
    }
    const fixture = tournamentFixtures.find((item) =>
      (item.teamA.id === teamAId && item.teamB.id === teamBId) ||
      (item.teamA.id === teamBId && item.teamB.id === teamAId),
    );
    if (!fixture?.match) {
      setLiveScore({ playerA: "", playerB: "" });
      return;
    }
    const storedTeamAFirst = fixture.match.teamAId === teamAId;
    setLiveScore({
      playerA: String(storedTeamAFirst ? fixture.match.playerAScore : fixture.match.playerBScore),
      playerB: String(storedTeamAFirst ? fixture.match.playerBScore : fixture.match.playerAScore),
    });
    setEditingMatchId(fixture.match.id);
  };

  const savePlayoffResult = async (fixture: { key: string; teamA?: Team; teamB?: Team; match?: MatchRecord }) => {
    if (!fixture.teamA || !fixture.teamB || !playoffTournament) {
      setNotice("This playoff match is waiting for the earlier round to finish.");
      return;
    }
    const score = playoffScores[fixture.key] ?? { a: "", b: "" };
    const playerAScore = Number(score.a);
    const playerBScore = Number(score.b);
    if (!score.a || !score.b || playerAScore === playerBScore) {
      setNotice("Enter two different scores for the playoff match.");
      return;
    }
    const record = { id: fixture.match?.id ?? createId(), playerAId: fixture.teamA.playerAId, playerBId: fixture.teamB.playerAId, playerAScore, playerBScore, winnerId: playerAScore > playerBScore ? fixture.teamA.playerAId : fixture.teamB.playerAId, note: fixture.key, createdAt: new Date().toISOString(), teamAId: fixture.teamA.id, teamBId: fixture.teamB.id, tournamentId: playoffTournament.id, stage: "playoff", bracketKey: fixture.key };
    if (hasSupabaseConfig && supabase) {
      const result = fixture.match ? await supabase.from("matches").update(record).eq("id", fixture.match.id) : await supabase.from("matches").insert([record]);
      if (result.error) { setNotice(`Playoff save failed: ${result.error.message}`); return; }
      await refreshDatabase();
    } else {
      setMatches((current) => fixture.match ? current.map((match) => match.id === record.id ? record : match) : [...current, record]);
    }
    setPlayoffScores((current) => ({ ...current, [fixture.key]: { a: "", b: "" } }));
    setNotice(`Playoff result saved for ${teamLabel(fixture.teamA)} vs ${teamLabel(fixture.teamB)}.`);
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
      await refreshDatabase();
      setNotice(`${createdTeam.name} was saved to Supabase.`);
    } else {
      setTeams((current) => [...current, createdTeam]);
      setNotice(`${createdTeam.name} was added locally.`);
    }
    setTeamDraft((current) => ({ ...current, name: "" }));
  };

  const resizePairNames = (format: "internal" | "external", count: number) => {
    const groups = format === "internal" ? (["a"] as const) : (["a", "b"] as const);
    setPairNames(groups.flatMap((group) => Array.from({ length: count }, (_, index) => ({ group, index, player1: "", player2: "" }))));
  };

  const editTournament = (tournament: Tournament) => {
    setEditingTournamentId(tournament.id);
    setTournamentDraft({ name: tournament.name, format: tournament.format, event_date: easternIsoToLocal(tournament.event_date), location: tournament.location, group_a: tournament.group_a, group_b: tournament.group_b, teams_per_group: tournament.teams_per_group });
    const tournamentTeams = teams.filter((team) => team.tournamentId === tournament.id);
    const groups = tournament.format === "internal" ? (["a"] as const) : (["a", "b"] as const);
    setPairNames(groups.flatMap((group) => tournamentTeams.filter((team) => teamGroup(team) === (group === "a" ? tournament.group_a : tournament.group_b)).map((team, index) => ({ group, index, player1: team.playerAId, player2: team.playerBId }))));
    setTab("tournaments");
    setNotice(`Editing ${tournament.name}. Update the details and save.`);
  };

  const addTournament = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tournamentDraft.name.trim()) {
      setNotice("Enter a league name before creating it.");
      return;
    }

    const createdTournament: Tournament = {
      id: editingTournamentId ?? createId(),
      name: tournamentDraft.name.trim(),
      format: tournamentDraft.format,
      status: "active",
      created_at: new Date().toISOString(),
      event_date: easternLocalToIso(tournamentDraft.event_date),
      location: tournamentDraft.location.trim(),
      group_a: tournamentDraft.group_a,
      group_b: tournamentDraft.format === "internal" ? tournamentDraft.group_a : tournamentDraft.group_b,
      teams_per_group: tournamentDraft.teams_per_group,
    };

    const requiredPairs = tournamentPairs;
    if (requiredPairs.some((pair) => !pair.player1.trim() || !pair.player2.trim())) {
      setNotice("Enter both player names for every tournament pair.");
      return;
    }

    const createdTeams: Team[] = [];
    requiredPairs.forEach((pair) => {
      const groupName = pair.group === "a" ? createdTournament.group_a : createdTournament.group_b;
      createdTeams.push({ id: createId(), name: `Pair${pair.index + 1}`, playerAId: pair.player1, playerBId: pair.player2, group_name: groupName, tournamentId: createdTournament.id });
    });

    if (hasSupabaseConfig && supabase) {
      const tournamentRequest = editingTournamentId
        ? await supabase.from("tournaments").update(createdTournament).eq("id", editingTournamentId)
        : await supabase.from("tournaments").insert([createdTournament]);
      const { error } = tournamentRequest;
      if (error) {
        setNotice(`League save failed: ${error.message}`);
        return;
      }
      if (editingTournamentId) {
        const existingTeams = teams.filter((team) => team.tournamentId === editingTournamentId);
        for (const [index, team] of existingTeams.entries()) {
          const replacement = createdTeams[index];
          if (replacement) {
            const { error: updateError } = await supabase.from("teams").update({ playerAId: replacement.playerAId, playerBId: replacement.playerBId, group_name: replacement.group_name, name: replacement.name }).eq("id", team.id);
            if (updateError) { setNotice(`Pair update failed: ${updateError.message}`); return; }
          } else if (!matches.some((match) => match.teamAId === team.id || match.teamBId === team.id)) {
            const { error: deleteError } = await supabase.from("teams").delete().eq("id", team.id);
            if (deleteError) { setNotice(`Pair delete failed: ${deleteError.message}`); return; }
          }
        }
        const newTeams = createdTeams.slice(existingTeams.length);
        if (newTeams.length) {
          const { error: insertError } = await supabase.from("teams").insert(newTeams);
          if (insertError) { setNotice(`Pair save failed: ${insertError.message}`); return; }
        }
      } else {
        const { error: teamsError } = await supabase.from("teams").insert(createdTeams);
        if (teamsError) { setNotice(`Pair save failed: ${teamsError.message}`); return; }
      }
    }
    if (!hasSupabaseConfig || !supabase) {
      setTournaments((current) => editingTournamentId ? current.map((item) => item.id === editingTournamentId ? createdTournament : item) : [...current, createdTournament]);
      setTeams((current) => editingTournamentId ? current.filter((team) => team.tournamentId !== editingTournamentId || matches.some((match) => match.teamAId === team.id || match.teamBId === team.id)).map((team) => { const replacement = createdTeams.find((item) => item.name === team.name); return replacement ? { ...replacement, id: team.id } : team; }) : [...current, ...createdTeams]);
    } else {
      await refreshDatabase();
    }
    setMatchDraft((current) => ({ ...current, tournamentId: createdTournament.id }));
    setTournamentDraft({ name: "", format: "internal", event_date: "", location: "", group_a: "WSS", group_b: "DCSC", teams_per_group: 7 });
    setPairNames([]);
    setEditingTournamentId(null);
    setNotice(`${createdTournament.name} created as an ${createdTournament.format} tournament.`);
  };

  const saveMatch = async () => {
    const teamA = teamMap[matchDraft.teamAId];
    const teamB = teamMap[matchDraft.teamBId];
    const teamsBelongToTournament = Boolean(selectedTournament && teamA?.tournamentId === selectedTournament.id && teamB?.tournamentId === selectedTournament.id);
    const exactFixture = tournamentFixtures.find((fixture) => fixture.teamA.id === teamA?.id && fixture.teamB.id === teamB?.id);
    if (!selectedTournament || !teamA || !teamB || teamA.id === teamB.id || !teamsBelongToTournament || !exactFixture) {
      setNotice("Select an exact fixture from the tournament fixture dropdown.");
      return;
    }

    const playerAScore = Number(liveScore.playerA);
    const playerBScore = Number(liveScore.playerB);
    if (!Number.isFinite(playerAScore) || !Number.isFinite(playerBScore) || playerAScore > 30 || playerBScore > 30 || (playerAScore === 0 && playerBScore === 0)) {
      setNotice("Scores must be between 0 and 30, and cannot be 0-0.");
      return;
    }

    const winnerId = playerAScore > playerBScore ? teamA.playerAId : teamB.playerAId;

    const selectedFixtureMatch = tournamentFixtures.find((fixture) => fixture.teamA.id === teamA.id && fixture.teamB.id === teamB.id)?.match;
    const existingMatch = (editingMatchId ? matches.find((match) => match.id === editingMatchId) : undefined) ?? selectedFixtureMatch;
    const record: MatchRecord = {
      id: existingMatch?.id ?? createId(),
      playerAId: teamA.playerAId,
      playerBId: teamB.playerAId,
      playerAScore,
      playerBScore,
      winnerId,
      note: "",
      createdAt: new Date().toISOString(),
      teamAId: teamA.id,
      teamBId: teamB.id,
      tournamentId: matchDraft.tournamentId || undefined,
    };

    if (hasSupabaseConfig && supabase) {
      const result = existingMatch
        ? await supabase.from("matches").update(record).eq("id", existingMatch.id).select().single()
        : await supabase.from("matches").insert([record]).select().single();

      if (result.error) {
        setNotice(`Supabase match save failed: ${result.error.message}`);
        return;
      }

      const savedRecord = (result.data ?? record) as MatchRecord;
      await refreshDatabase();
      setNotice(`${teamLabel(teamA)} ${existingMatch ? "result updated" : "defeated"} ${teamLabel(teamB)} (${playerAScore} : ${playerBScore}).`);
    } else {
      setMatches((current) => existingMatch ? current.map((match) => match.id === record.id ? record : match) : [record, ...current]);
      setNotice(`${teamLabel(teamA)} ${existingMatch ? "result updated" : "defeated"} ${teamLabel(teamB)} (${playerAScore} : ${playerBScore}).`);
    }

    setLiveScore({ playerA: "", playerB: "" });
    setEditingMatchId(null);
    setMatchDraft((current) => ({ ...current, teamAId: "", teamBId: "" }));
  };

  const selectTournament = (tournamentId: string) => {
    setMatchDraft((current) => ({ ...current, tournamentId, teamAId: "", teamBId: "" }));
    setPlayoffTournamentId(tournamentId);
    setStandingsTournamentId(tournamentId);
    setFixtureTeamFilter("");
    setLiveScore({ playerA: "", playerB: "" });
  };

  const toggleTournamentVisibility = async (tournament: Tournament) => {
    const nextStatus = tournament.status === "hidden" ? "active" : "hidden";
    if (hasSupabaseConfig && supabase) {
      const { error } = await supabase.from("tournaments").update({ status: nextStatus }).eq("id", tournament.id);
      if (error) { setNotice(`League visibility update failed: ${error.message}`); return; }
      await refreshDatabase();
    } else {
      setTournaments((current) => current.map((item) => item.id === tournament.id ? { ...item, status: nextStatus } : item));
    }
    setNotice(`${tournament.name} is now ${nextStatus === "hidden" ? "hidden" : "visible"}.`);
  };

  return (
    <div className="min-h-screen bg-[#071a2d] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-[28px] border border-[#d7a91d]/40 bg-[#0d2b4a] px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#071a2d] p-1 text-lg font-bold text-[#071a2d] sm:h-[88px] sm:w-[88px]">
                <img src="/wss-logo.png" alt="WSS badminton shuttlecock logo" className="h-full w-full rounded-full object-contain" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#61656d]">
                  WSS LEAGUE · WHITBY SMASH SQUAD
                </p>
                <h1 className="text-xl font-semibold text-white">Whitby Smash Hub</h1>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-2">
              {[
                { key: "dashboard", label: "Dashboard" },
                { key: "standings", label: "Standings" },
                { key: "playoffs", label: "Playoff" },
                ...(isAuthenticated ? [{ key: "players", label: "Players" }, { key: "tournaments", label: "Leagues" }] : []),
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key as TabName)}
                  className={`nav-pill rounded-full px-4 py-2 text-sm font-medium transition ${
                    tab === item.key
                      ? "bg-[#f7c62f] text-[#071a2d] shadow-md"
                      : "bg-[#f7f8fa] text-[#18324f] hover:bg-[#fce6a0]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              {isAuthenticated ? <button type="button" onClick={() => void handleLogout()} className="rounded-full bg-[#f7f8fa] px-4 py-2 text-sm font-medium text-[#18324f]">Log out</button> : <button type="button" onClick={() => setShowLogin(true)} className="rounded-full bg-[#f7c62f] px-4 py-2 text-sm font-semibold text-[#071a2d]">Admin login</button>}
            </nav>
          </div>
        </header>

        <main data-playoff-complete={playoffComplete ? "true" : "false"} className="space-y-6">
          {notice && notice !== "Connected to Supabase. Live sync is active." && <p className="sr-only" aria-live="polite">{notice}</p>}

          {showLogin && <div className="rounded-[24px] border border-[#d9d3d0] bg-[#191c20] p-5 text-white"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Restricted area</p><h2 className="mt-1 text-2xl font-semibold">Admin login</h2></div><button type="button" onClick={() => setShowLogin(false)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-200">Close</button></div><form onSubmit={handleLogin} className="mt-5 grid gap-3 sm:grid-cols-2"><input type="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email" className="rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none" /><input type="password" required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password" className="rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none" /><button type="submit" disabled={authBusy} className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white sm:col-span-2">{authBusy ? "Signing in..." : "Sign in"}</button></form></div>}

          {tab === "dashboard" && (
            <>
              <select value={matchDraft.tournamentId} onChange={(event) => selectTournament(event.target.value)} className="w-full rounded-xl border border-[#d7a91d]/50 bg-[#0d2b4a] px-4 py-3 text-sm font-semibold text-white outline-none"><option value="">Select tournament</option>{visibleTournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select>
              {playoffComplete && <section className="space-y-6 rounded-[26px] border border-[#d7a91d]/50 bg-[#0d2b4a] p-5 text-white shadow-[0_20px_45px_rgba(0,0,0,0.26)]"><div className="border-b border-[#f7c62f]/30 pb-5 text-center"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#f7c62f]">Tournament champion</p><p className="mt-2 text-3xl">🥇</p><h2 className="text-2xl font-bold text-[#f7c62f]">{playoffBracket.podium[0] ? teamLabel(playoffBracket.podium[0]) : "Champion"}</h2><p className="mt-2 text-sm text-slate-300">{playoffTournament?.name}</p></div><div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-[#e3b821] bg-[#f7c62f] p-4 text-center text-[#071a2d]"><p className="text-2xl">🥇</p><p className="text-xs font-semibold uppercase tracking-[0.18em]">Gold</p><p className="mt-2 font-bold">{playoffBracket.podium[0] ? teamLabel(playoffBracket.podium[0]) : "TBD"}</p></div><div className="rounded-xl border border-slate-300/50 bg-slate-200 p-4 text-center text-[#142b45]"><p className="text-2xl">🥈</p><p className="text-xs font-semibold uppercase tracking-[0.18em]">Silver</p><p className="mt-2 font-bold">{playoffBracket.podium[1] ? teamLabel(playoffBracket.podium[1]) : "TBD"}</p></div><div className="rounded-xl border border-[#a9683d] bg-[#ad6b43] p-4 text-center text-white"><p className="text-2xl">🥉</p><p className="text-xs font-semibold uppercase tracking-[0.18em]">Bronze</p><p className="mt-2 font-bold">{playoffBracket.podium[2] ? teamLabel(playoffBracket.podium[2]) : "TBD"}</p></div></div><div className="grid gap-3 md:grid-cols-3">{dashboardPlayoffResults.map((fixture) => <div key={fixture.key} className="rounded-2xl border border-[#f7c62f]/25 bg-[#071a2d] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f7c62f]">{fixture.key === "final" ? "Final" : fixture.key === "sf1" ? "Semi-final 1" : fixture.key === "sf2" ? "Semi-final 2" : fixture.key === "bronze" ? "Bronze match" : `Quarter-final ${fixture.key.replace("qf", "")}`}</p><p className="mt-2 text-sm font-semibold">{fixture.teamA ? teamLabel(fixture.teamA) : "TBD"}</p><p className="text-sm font-semibold">{fixture.teamB ? teamLabel(fixture.teamB) : "TBD"}</p><p className="mt-3 text-xl font-bold text-[#f7c62f]">{fixture.teamAScore} : {fixture.teamBScore}</p></div>)}</div><div className="rounded-2xl bg-[#f7f8fa] p-5 text-[#18212b]"><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#6b7078]">Final standings</p><h2 className="mt-1 text-2xl font-semibold">Player rankings</h2><div className="mt-4 space-y-2">{leaderboard.map((entry, index) => <div key={entry.team.id} className="flex items-center justify-between border-b border-[#e5e0dd] py-2 last:border-0"><span className="font-semibold">#{index + 1} {teamLabel(entry.team)}</span><span className="font-bold">{entry.wins} wins</span></div>)}</div></div></section>}
              {!playoffComplete && <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="dashboard-live-panel rounded-[26px] border border-[#d9d3d0] bg-[#1b1d20] p-5 text-white shadow-[0_16px_30px_rgba(17,24,39,0.12)]">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Live scoring</p>
                      <h2 className="mt-1 text-2xl font-semibold">{selectedTournament?.name ?? "Select a tournament"}</h2>
                    </div>
                  </div>

                  <select value={matchDraft.tournamentId} onChange={(event) => selectTournament(event.target.value)} className="mb-4 w-full rounded-xl border border-white/10 bg-[#121417] px-3 py-2 text-sm text-white outline-none">
                    <option value="">Select tournament</option>
                    {visibleTournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}
                  </select>

                  <select value={matchDraft.teamAId && matchDraft.teamBId ? `${matchDraft.teamAId}:${matchDraft.teamBId}` : ""} onChange={(event) => selectFixture(event.target.value)} className="mb-4 w-full rounded-xl border border-white/10 bg-[#121417] px-3 py-2 text-sm text-white outline-none">
                    <option value="">Select fixture to score or edit</option>
                    {tournamentFixtures.map((fixture) => <option key={`${fixture.teamA.id}:${fixture.teamB.id}`} value={`${fixture.teamA.id}:${fixture.teamB.id}`}>{teamLabel(fixture.teamA)} vs {teamLabel(fixture.teamB)}{fixture.match ? " (saved)" : ""}</option>)}
                  </select>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">
                        Team 1
                      </label>
                      <select
                        className="w-full rounded-xl border border-white/10 bg-[#121417] px-3 py-2 text-sm text-white outline-none"
                        value={matchDraft.teamAId}
                        onChange={(event) => selectScoringTeam("a", event.target.value)}
                      >
                        <option value="">Select team</option>
                        {eligibleTeamA.map((team) => (
                          <option key={team.id} value={team.id}>
                            {teamLabel(team)}
                          </option>
                        ))}
                      </select>

                      <div className="mt-5 flex items-center justify-between">
                        <input type="text" inputMode="numeric" pattern="[0-9]*" value={liveScore.playerA} onChange={(event) => setLiveScore((current) => ({ ...current, playerA: normalizeScoreInput(event.target.value) }))} placeholder="Score (0-30)" className="w-36 rounded-xl border border-white/10 bg-[#121417] px-3 py-2 text-4xl font-bold text-white outline-none" />
                      </div>
                    </div>

                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">
                        Team 2
                      </label>
                      <select
                        className="w-full rounded-xl border border-white/10 bg-[#121417] px-3 py-2 text-sm text-white outline-none"
                        value={matchDraft.teamBId}
                        onChange={(event) => selectScoringTeam("b", event.target.value)}
                      >
                        <option value="">Select team</option>
                        {eligibleTeamB.map((team) => (
                          <option key={team.id} value={team.id}>
                            {teamLabel(team)}
                          </option>
                        ))}
                      </select>

                      <div className="mt-5 flex items-center justify-between">
                        <input type="text" inputMode="numeric" pattern="[0-9]*" value={liveScore.playerB} onChange={(event) => setLiveScore((current) => ({ ...current, playerB: normalizeScoreInput(event.target.value) }))} placeholder="Score (0-30)" className="w-36 rounded-xl border border-white/10 bg-[#121417] px-3 py-2 text-4xl font-bold text-white outline-none" />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={saveMatch}
                    className="dashboard-save-result mt-5 w-full rounded-full px-4 py-3 text-sm font-semibold"
                  >
                    Save match result
                  </button>
                </div>

                <div className="dashboard-leaderboard rounded-[26px] border border-[#d9d3d0] bg-[#f9f7f5] p-5 shadow-[0_10px_22px_rgba(0,0,0,0.04)]">
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
                          <div className={`rank-medal rank-medal-${index + 1} flex h-9 w-9 items-center justify-center rounded-full bg-[#17191d] text-sm font-semibold text-white`}>
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
              </section>}

              {selectedTournament && playoffBracket.columns.some((column) => column.some((fixture) => fixture.match)) && <section className="rounded-[26px] border border-[#d9d3d0] bg-[#182f4d] p-5 text-white"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.25em] text-amber-200">Knockout results</p><h2 className="mt-1 text-2xl font-semibold">{selectedTournament.name} playoff results</h2></div><span className="text-xs uppercase tracking-[0.16em] text-slate-300">{selectedTournament.format === "external" ? "Quarter-finals · Semi-finals · Final · Bronze" : "Qualifier 1 · Eliminator · Qualifier 2 · Final"}</span></div><div className="mt-5 grid gap-4 md:grid-cols-3">{playoffBracket.columns.map((column, columnIndex) => <div key={columnIndex} className="space-y-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">{selectedTournament.format === "external" ? ["Quarter-finals", "Semi-finals", "Final & Bronze"][columnIndex] : ["Qualifier 1 / Eliminator", "Qualifier 2", "Final"][columnIndex]}</p>{column.filter((fixture) => fixture.match).map((fixture) => <div key={fixture.key} className="rounded-xl border border-white/15 bg-white p-3 text-[#18212b]"><p className="text-[10px] uppercase tracking-[0.14em] text-[#68717a]">{fixture.key}</p><p className="mt-2 text-sm font-semibold">{fixture.teamA ? teamLabel(fixture.teamA) : "TBD"}</p><p className="text-sm font-semibold">{fixture.teamB ? teamLabel(fixture.teamB) : "TBD"}</p><p className="mt-2 text-lg font-bold">{fixture.teamAScore} : {fixture.teamBScore}</p></div>)}</div>)}</div></section>}

              <section className="rounded-[26px] border border-[#d9d3d0] bg-[#f9f7f5] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-[10px] uppercase tracking-[0.25em] text-[#696f77]">Round robin fixtures</p><h2 className="mt-1 text-2xl font-semibold text-[#181a1d]">{selectedTournament?.name ?? "Select a tournament"}</h2></div>
                  <div className="text-right"><p className="text-sm font-semibold text-[#30343a]">{tournamentFixtures.length} total</p><p className="text-xs uppercase tracking-[0.14em] text-[#a8790e]">{tournamentFixtures.filter((fixture) => fixture.match).length} completed</p></div>
                </div>
                <div className="mt-5">
                  <select value={fixtureTeamFilter} onChange={(event) => setFixtureTeamFilter(event.target.value)} className="w-full rounded-xl border border-[#ded8d4] bg-white px-3 py-2.5 text-sm text-[#17191d] outline-none"><option value="">Select a team to view its results</option>{tournamentTeams.map((team) => <option key={team.id} value={team.id}>{teamLabel(team)}</option>)}</select>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {filteredFixtures.map((fixture) => <div key={`${fixture.teamA.id}-${fixture.teamB.id}`} className="rounded-[18px] border border-[#e4dfdc] bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-[#17191d]">{teamLabel(fixture.teamA)} <span className="text-[#8a9097]">vs</span> {teamLabel(fixture.teamB)}</p><span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${fixture.match ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{fixture.match ? "Completed" : "Pending"}</span></div><p className="mt-3 text-sm text-[#626972]">{fixture.match ? `${fixture.teamAScore} : ${fixture.teamBScore}` : "No score yet"}</p>{fixture.match && <button type="button" onClick={() => editMatch(fixture)} className="mt-3 rounded-full border border-[#cdd8f7] px-3 py-1.5 text-xs font-semibold text-[#3949ab]">Edit result</button>}</div>)}
                  {!filteredFixtures.length && <p className="text-sm text-[#626972]">Select a team to see its results.</p>}
                </div>
              </section>
            </>
          )}

          {tab === "players" && isAuthenticated && (
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
                <form onSubmit={createGroup} className="mt-8 space-y-3 border-t border-white/10 pt-6">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[#f7c62f]">Create group</p>
                  <input required value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="New group name" className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none" />
                  <button type="submit" className="w-full rounded-full border border-[#f7c62f]/50 px-4 py-3 text-sm font-semibold text-[#f7c62f]">Add group</button>
                </form>
                <form onSubmit={deletePlayer} className="mt-8 space-y-4 border-t border-white/10 pt-6">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-rose-300">Delete player</p>
                  <select value={deletePlayerDraft.group_name} onChange={(event) => setDeletePlayerDraft({ name: "", group_name: event.target.value })} className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none">{groupOptions.map((group) => <option key={group} value={group}>{group}</option>)}</select>
                  <select required value={deletePlayerDraft.name} onChange={(event) => setDeletePlayerDraft((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none"><option value="">Select player to delete</option>{deletablePlayers.map((player) => <option key={player.id} value={player.name}>{player.name}</option>)}</select>
                  <button type="submit" className="w-full rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">Delete player</button>
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

          {tab === "teams" && isAuthenticated && (
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

          {tab === "tournaments" && isAuthenticated && (
            <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[26px] border border-[#d9d3d0] bg-[#171a1d] p-5 text-white">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">League setup</p>
                <h2 className="mt-2 text-2xl font-semibold">{editingTournamentId ? "Edit tournament" : "Create a tournament"}</h2>
                <form onSubmit={addTournament} className="mt-5 space-y-4">
                  <input value={tournamentDraft.name} onChange={(event) => setTournamentDraft((current) => ({ ...current, name: event.target.value }))} placeholder="WSS Internal League" className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none" />
                  <input type="datetime-local" value={tournamentDraft.event_date} onChange={(event) => setTournamentDraft((current) => ({ ...current, event_date: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none" />
                  <input value={tournamentDraft.location} onChange={(event) => setTournamentDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Location" className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none" />
                  <select value={tournamentDraft.format} onChange={(event) => setTournamentDraft((current) => ({ ...current, format: event.target.value as "internal" | "external" }))} className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none">
                    <option value="internal">Internal: every team plays every other WSS team</option>
                    <option value="external">External: Group A plays Group B</option>
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <select value={tournamentDraft.group_a} onChange={(event) => setTournamentDraft((current) => ({ ...current, group_a: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none">{groupOptions.map((group) => <option key={group} value={group}>{group} group</option>)}</select>
                    {tournamentDraft.format === "external" && <select value={tournamentDraft.group_b} onChange={(event) => setTournamentDraft((current) => ({ ...current, group_b: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none">{groupOptions.filter((group) => group !== tournamentDraft.group_a).map((group) => <option key={group} value={group}>{group} group</option>)}</select>}
                  </div>
                  <input type="number" min={1} max={20} value={tournamentDraft.teams_per_group} onChange={(event) => { const count = Math.max(1, Math.min(20, Number(event.target.value) || 1)); setTournamentDraft((current) => ({ ...current, teams_per_group: count })); resizePairNames(tournamentDraft.format, count); }} className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none" placeholder="Teams per group" />
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-[#101316] p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Enter tournament pairs</p>
                    {tournamentPairs.map((pair) => <div key={`${pair.group}-${pair.index}`}><p className="mb-1 text-xs font-semibold text-slate-300">Pair {pair.index + 1} · {pair.group === "a" ? tournamentDraft.group_a : tournamentDraft.group_b}</p><div className="grid grid-cols-2 gap-2"><select value={pair.player1} onChange={(event) => setPairNames((current) => { const next = current.length ? [...current] : tournamentPairs.map((item) => ({ ...item })); next.find((item) => item.group === pair.group && item.index === pair.index)!.player1 = event.target.value; return next; })} className="w-full rounded-lg border border-white/10 bg-[#171b1f] px-2.5 py-2 text-sm text-white outline-none"><option value="">Player 1</option>{availablePairPlayers(pair, "player1").map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select><select value={pair.player2} onChange={(event) => setPairNames((current) => { const next = current.length ? [...current] : tournamentPairs.map((item) => ({ ...item })); next.find((item) => item.group === pair.group && item.index === pair.index)!.player2 = event.target.value; return next; })} className="w-full rounded-lg border border-white/10 bg-[#171b1f] px-2.5 py-2 text-sm text-white outline-none"><option value="">Player 2</option>{availablePairPlayers(pair, "player2").map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></div></div>)}
                  </div>
                  <button type="submit" className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white">{editingTournamentId ? "Save league changes" : "Create league"}</button>
                  {editingTournamentId && <button type="button" onClick={() => { setEditingTournamentId(null); setPairNames([]); }} className="w-full rounded-full border border-white/15 px-4 py-3 text-sm font-semibold text-slate-200">Cancel editing</button>}
                </form>
              </div>
              <div className="rounded-[26px] border border-[#d9d3d0] bg-[#f9f7f5] p-5">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#696f77]">Competition calendar</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#181a1d]">Your leagues</h2>
                <div className="mt-5 space-y-3">{visibleTournaments.map((tournament) => <div key={tournament.id} className="rounded-[20px] border border-[#e4dfdc] bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-[#17191d]">{tournament.name}</p><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] uppercase text-emerald-700">{tournament.format}</span></div><p className="mt-2 text-sm text-[#626972]">{tournament.format === "internal" ? "All enrolled teams play one another." : "Teams play the teams in the opposite group."}</p><p className="mt-2 text-xs text-[#626972]">{formatEasternTime(tournament.event_date)}{tournament.location ? ` · ${tournament.location}` : ""}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => editTournament(tournament)} className="rounded-full border border-[#cdd8f7] px-3 py-1.5 text-xs font-semibold text-[#3949ab]">Edit league</button><button type="button" onClick={() => void clearTournamentResults(tournament)} className="rounded-full border border-[#e2c15a] px-3 py-1.5 text-xs font-semibold text-[#8d650b]">Clear results</button><button type="button" onClick={() => void toggleTournamentVisibility(tournament)} className="rounded-full border border-[#cdd8f7] px-3 py-1.5 text-xs font-semibold text-[#3949ab]">{tournament.status === "hidden" ? "Show league" : "Hide league"}</button><button type="button" onClick={() => { if (window.confirm(`Delete ${tournament.name} and all its pairs and results?`)) void deleteTournament(tournament); }} className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700">Delete league</button></div></div>)}</div>
              </div>
            </section>
          )}

          {tab === "standings" && (
            <section data-view="standings" className="space-y-6">
              <div className="rounded-[26px] border border-[#d9d3d0] bg-[#191c20] p-5 text-white">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div><p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Competition table</p><h2 className="mt-2 text-2xl font-semibold">Tournament standings</h2></div>
                  <select value={standingsTournament?.id ?? ""} onChange={(event) => setStandingsTournamentId(event.target.value)} className="rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none"><option value="">Select league</option>{visibleTournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select>
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

          {tab === "playoffs" && (
            <section data-view="playoff" className="space-y-6">
              {playoffTournament && <div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-[#e3b821] bg-[#f7c62f] p-5 text-center text-[#071a2d]"><p className="text-2xl">🥇</p><p className="text-xs uppercase tracking-[0.18em]">Gold</p><p className="mt-3 font-bold">{playoffBracket.podium[0] ? teamLabel(playoffBracket.podium[0]) : "TBD"}</p></div><div className="rounded-xl border border-[#b9c2ce] bg-[#e4e8ed] p-5 text-center text-[#142b45]"><p className="text-2xl">🥈</p><p className="text-xs uppercase tracking-[0.18em]">Silver</p><p className="mt-3 font-bold">{playoffBracket.podium[1] ? teamLabel(playoffBracket.podium[1]) : "TBD"}</p></div><div className="rounded-xl border border-[#a9683d] bg-[#ad6b43] p-5 text-center text-white"><p className="text-2xl">🥉</p><p className="text-xs uppercase tracking-[0.18em]">Bronze</p><p className="mt-3 font-bold">{playoffBracket.podium[2] ? teamLabel(playoffBracket.podium[2]) : "TBD"}</p></div></div>}
              <div className="rounded-[26px] border border-[#d9d3d0] bg-[#191c20] p-5 text-white"><p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Knockout competition</p><div className="flex items-center justify-between gap-4"><h2 className="mt-2 text-2xl font-semibold">Playoff bracket</h2><select value={playoffTournament?.id ?? ""} onChange={(event) => setPlayoffTournamentId(event.target.value)} className="rounded-xl border border-white/10 bg-[#101316] px-3 py-2 text-sm text-white"><option value="">Select league</option>{visibleTournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select></div><p className="mt-3 text-sm text-slate-300">{playoffTournament?.format === "internal" ? "Top 4: Qualifier 1, Eliminator, Qualifier 2, Final." : "Top 8: Quarter-finals, semi-finals, final, and bronze match."}</p></div>
              {playoffTournament && <div className="overflow-x-auto rounded-[26px] border border-[#d9d3d0] bg-[#182f4d] p-5"><div className="grid min-w-[900px] grid-cols-3 gap-4">{playoffBracket.columns.map((column, columnIndex) => <div key={columnIndex} className="space-y-4"><p className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">{playoffTournament.format === "external" ? ["Quarter-finals", "Semi-finals", "Final & bronze"][columnIndex] : ["Qualifier 1 / Eliminator", "Qualifier 2", "Final"][columnIndex]}</p>{column.map((fixture) => <div key={fixture.key} className="rounded-xl border border-[#d8c58a]/60 bg-white p-3 text-[#18212b]"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7279]">{fixture.key}</p><p className="mt-2 text-sm font-semibold">{fixture.teamA ? teamLabel(fixture.teamA) : "Waiting for previous round"}</p><p className="text-sm font-semibold">{fixture.teamB ? teamLabel(fixture.teamB) : "Waiting for previous round"}</p><div className="mt-3 grid grid-cols-2 gap-2"><input type="text" inputMode="numeric" placeholder="Score" value={playoffScores[fixture.key]?.a ?? (fixture.match ? String(fixture.match.playerAScore) : "")} onChange={(event) => setPlayoffScores((current) => ({ ...current, [fixture.key]: { a: event.target.value.replace(/\D/g, ""), b: current[fixture.key]?.b ?? "" } }))} className="w-full rounded-lg border border-[#d8dfe4] px-2 py-1.5 text-sm" /><input type="text" inputMode="numeric" placeholder="Score" value={playoffScores[fixture.key]?.b ?? (fixture.match ? String(fixture.match.playerBScore) : "")} onChange={(event) => setPlayoffScores((current) => ({ ...current, [fixture.key]: { a: current[fixture.key]?.a ?? "", b: event.target.value.replace(/\D/g, "") } }))} className="w-full rounded-lg border border-[#d8dfe4] px-2 py-1.5 text-sm" /></div>{fixture.teamA && fixture.teamB && <button type="button" onClick={() => void savePlayoffResult(fixture)} className="mt-3 w-full rounded-lg bg-[#c9962d] px-3 py-2 text-xs font-semibold text-white">{fixture.match ? "Update result" : "Save result"}</button>}</div>)}</div>)}</div></div>}
              {playoffTournament && <div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-[#b9c2ce] bg-[#e4e8ed] p-5 text-center text-[#142b45]"><p className="text-2xl">🥈</p><p className="text-xs uppercase tracking-[0.18em]">Silver</p><p className="mt-3 font-bold">{playoffBracket.podium[1] ? teamLabel(playoffBracket.podium[1]) : "TBD"}</p></div><div className="rounded-xl border border-[#e3b821] bg-[#f7c62f] p-5 text-center text-[#071a2d]"><p className="text-2xl">🥇</p><p className="text-xs uppercase tracking-[0.18em]">Gold</p><p className="mt-3 font-bold">{playoffBracket.podium[0] ? teamLabel(playoffBracket.podium[0]) : "TBD"}</p></div><div className="rounded-xl border border-[#a9683d] bg-[#ad6b43] p-5 text-center text-white"><p className="text-2xl">🥉</p><p className="text-xs uppercase tracking-[0.18em]">Bronze</p><p className="mt-3 font-bold">{playoffBracket.podium[2] ? teamLabel(playoffBracket.podium[2]) : "TBD"}</p></div></div>}
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
                    <select value={matchDraft.tournamentId} onChange={(event) => selectTournament(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#101316] px-3 py-2.5 text-sm text-white outline-none">
                      <option value="">Friendly / no league</option>
                      {visibleTournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name} ({tournament.format})</option>)}
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
                          setLiveScore((current) => ({ ...current, playerA: event.target.value.replace(/\D/g, "") }))
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
                          setLiveScore((current) => ({ ...current, playerB: event.target.value.replace(/\D/g, "") }))
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


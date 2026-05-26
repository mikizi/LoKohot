import "./styles.css";
import { playersInMatch } from "./matchGoalPlayers";
import { sortPlayersByStrength } from "./sortPlayers";
import { TEAM_LABELS, TEAM_ORDER } from "./teamLabels";
import type { Match, PublishedGameDay, TeamColor } from "./types";
import * as db from "./lokohotDb";
import { getMatchWinner, getPitchLeader } from "./winnerStays";
import { clearError, showError } from "./ui/dom";

let gameDay: PublishedGameDay | null = null;

async function boot(): Promise<void> {
  const empty = document.getElementById("publicEmpty");
  const content = document.getElementById("publicContent");
  const banner = document.getElementById("dbBanner");
  const closedBanner = document.getElementById("closedBanner");

  if (!db.isDbConfigured()) {
    if (banner) {
      banner.textContent = "האתר לא מחובר למסד נתונים";
      banner.classList.remove("hidden");
    }
    return;
  }

  try {
    gameDay = await db.loadPublishedGameDay();
    if (!gameDay) {
      empty?.classList.remove("hidden");
      content?.classList.add("hidden");
      return;
    }
    empty?.classList.add("hidden");
    content?.classList.remove("hidden");
    if (banner) banner.classList.add("hidden");

    if (closedBanner) {
      if (gameDay.isOpen) {
        closedBanner.classList.add("hidden");
      } else {
        closedBanner.classList.remove("hidden");
        closedBanner.textContent = "הערב נסגר — אפשר רק לצפות בתוצאות.";
      }
    }

    const titleEl = document.getElementById("publicTitle");
    if (titleEl) {
      titleEl.textContent = gameDay.session.title ?? "ערב משחק";
    }

    renderTeams(gameDay);
    renderPitchStatus(gameDay);
    renderMatches(gameDay);
    renderNightSummary(gameDay);
    bindAddGameForm(gameDay);
    bindMatchGoalsDelegation();
  } catch (err) {
    if (banner) {
      banner.textContent = err instanceof Error ? err.message : "שגיאת טעינה";
      banner.classList.remove("hidden");
    }
  }
}

function renderTeams(day: PublishedGameDay): void {
  for (const team of TEAM_ORDER) {
    const list = document.querySelector(`[data-public-team="${team}"]`);
    if (!list) continue;
    list.replaceChildren();
    for (const p of sortPlayersByStrength(day.playersByTeam[team])) {
      const li = document.createElement("li");
      li.className = "player-card";
      li.textContent = p.name;
      list.appendChild(li);
    }
  }
}

function renderPitchStatus(day: PublishedGameDay): void {
  const el = document.getElementById("pitchStatus");
  if (!el) return;
  const leader = getPitchLeader(day.matches);
  if (day.matches.length === 0) {
    el.textContent = "עדיין לא שוחק משחק — הוסיפו משחק ראשון למטה.";
    return;
  }
  if (!leader) {
    el.textContent = "תיקו במשחק האחרון — בחרו מי נשאר על המגרש במשחק הבא.";
    return;
  }
  el.innerHTML = `<span class="team-dot team-dot--${leader}"></span> <strong>${esc(TEAM_LABELS[leader])}</strong> נשארת על המגרש`;
}

function renderMatches(day: PublishedGameDay): void {
  const root = document.getElementById("matchesList");
  if (!root) return;
  root.replaceChildren();

  if (day.matches.length === 0) {
    root.innerHTML = '<p class="hint">אין משחקים עדיין</p>';
    return;
  }

  day.matches.forEach((m, index) => {
    const winner = getMatchWinner(m);
    const row = document.createElement("article");
    row.className = "match-row panel";
    row.setAttribute("data-match-id", m.id);

    const winnerNote = winner
      ? `<span class="match-row__winner">ניצחה: ${esc(TEAM_LABELS[winner])}</span>`
      : `<span class="match-row__winner match-row__winner--draw">תיקו</span>`;

    const scoreBlock = day.isOpen
      ? `<div class="match-row__scores">
          <input type="number" class="input input--score" min="0" max="99" value="${m.homeScore}" data-home-score />
          <span>:</span>
          <input type="number" class="input input--score" min="0" max="99" value="${m.awayScore}" data-away-score />
          <button type="button" class="btn btn--secondary btn--compact" data-save-match>שמור תוצאה</button>
          <button type="button" class="btn btn--ghost btn--compact" data-delete-match>מחק משחק</button>
        </div>`
      : `<div class="match-row__result-readonly"><strong>${m.homeScore}</strong> : <strong>${m.awayScore}</strong></div>`;

    const addGoalForm = day.isOpen ? buildAddGoalForm(m, day) : "";

    row.innerHTML = `
      <div class="match-row__meta">משחק ${index + 1}</div>
      <div class="match-row__teams">
        <span class="team-dot team-dot--${m.homeTeam}"></span>
        <strong>${esc(TEAM_LABELS[m.homeTeam])}</strong>
        <span class="match-row__vs">נגד</span>
        <strong>${esc(TEAM_LABELS[m.awayTeam])}</strong>
        <span class="team-dot team-dot--${m.awayTeam}"></span>
      </div>
      ${scoreBlock}
      ${winnerNote}
      <div class="match-goals">
        <h4 class="match-goals__title">שערים</h4>
        <ul class="match-goals__list">${buildGoalsListHtml(m, day.isOpen)}</ul>
        ${addGoalForm}
      </div>
    `;

    if (day.isOpen) {
      row.querySelector("[data-save-match]")?.addEventListener("click", () => {
        void saveMatch(m.id, row);
      });
      row.querySelector("[data-delete-match]")?.addEventListener("click", () => {
        void removeMatch(m.id);
      });
    }

    root.appendChild(row);
  });
}

function buildGoalsListHtml(match: Match, isOpen: boolean): string {
  if (match.goals.length === 0) {
    return '<li class="hint match-goals__empty">אין שערים רשומים</li>';
  }
  return match.goals
    .map((g) => {
      const assist = g.assistName
        ? ` · בישל: <strong>${esc(g.assistName)}</strong>`
        : "";
      const remove = isOpen
        ? ` <button type="button" class="chip-remove" data-remove-goal="${g.id}" title="הסר">×</button>`
        : "";
      return `<li class="match-goals__item">כבש: <strong>${esc(g.scorerName)}</strong>${assist}${remove}</li>`;
    })
    .join("");
}

function buildAddGoalForm(match: Match, day: PublishedGameDay): string {
  const players = playersInMatch(day, match);
  if (players.length === 0) {
    return '<p class="hint">אין שחקנים בקבוצות המשחק</p>';
  }

  const scorerOpts = players
    .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
    .join("");
  const assistOpts =
    `<option value="">— ללא —</option>` +
    players.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");

  return `<form class="match-goals__form" data-add-goal-form>
    <label class="match-goals__label">כבש
      <select class="input" data-goal-scorer required>${scorerOpts}</select>
    </label>
    <label class="match-goals__label">בישל
      <select class="input" data-goal-assist>${assistOpts}</select>
    </label>
    <button type="submit" class="btn btn--primary btn--compact">הוסף שער</button>
  </form>`;
}

function bindMatchGoalsDelegation(): void {
  const root = document.getElementById("matchesList");
  if (!root) return;

  root.addEventListener("submit", (ev) => {
    const form = (ev.target as HTMLElement).closest("[data-add-goal-form]");
    if (!(form instanceof HTMLFormElement)) return;
    ev.preventDefault();
    const row = form.closest("[data-match-id]");
    const matchId = row?.getAttribute("data-match-id");
    if (matchId) void onAddMatchGoal(matchId, form);
  });

  root.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLElement)) return;
    const goalId = t.getAttribute("data-remove-goal");
    const matchId = t.closest("[data-match-id]")?.getAttribute("data-match-id");
    if (goalId && matchId) void onRemoveMatchGoal(matchId, goalId);
  });
}

async function onAddMatchGoal(matchId: string, form: HTMLFormElement): Promise<void> {
  clearError();
  if (!gameDay?.isOpen) return;

  const scorerId = (form.querySelector("[data-goal-scorer]") as HTMLSelectElement).value;
  const assistRaw = (form.querySelector("[data-goal-assist]") as HTMLSelectElement).value;
  const assistId = assistRaw || null;
  if (!scorerId) return;

  const match = gameDay.matches.find((m) => m.id === matchId);
  if (!match) return;
  const players = playersInMatch(gameDay, match);
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  try {
    const created = await db.addMatchGoal(matchId, scorerId, assistId);
    created.scorerName = nameById.get(scorerId) ?? created.scorerName;
    created.assistName = assistId ? (nameById.get(assistId) ?? null) : null;
    match.goals = [...match.goals, created];
    renderMatches(gameDay);
    renderNightSummary(gameDay);
    form.reset();
  } catch (err) {
    showError(err instanceof Error ? err.message : "לא נוסף שער");
  }
}

async function onRemoveMatchGoal(matchId: string, goalId: string): Promise<void> {
  if (!gameDay?.isOpen) return;
  clearError();
  try {
    await db.deleteMatchGoal(goalId);
    const match = gameDay.matches.find((m) => m.id === matchId);
    if (match) match.goals = match.goals.filter((g) => g.id !== goalId);
    renderMatches(gameDay);
    renderNightSummary(gameDay);
  } catch (err) {
    showError(err instanceof Error ? err.message : "לא הוסר");
  }
}

function renderNightSummary(day: PublishedGameDay): void {
  const el = document.getElementById("nightGoalsSummary");
  if (!el) return;

  const scorers = new Map<string, { name: string; goals: number }>();
  const assists = new Map<string, { name: string; count: number }>();

  for (const m of day.matches) {
    for (const g of m.goals) {
      const s = scorers.get(g.scorerId);
      if (s) s.goals += 1;
      else scorers.set(g.scorerId, { name: g.scorerName, goals: 1 });
      if (g.assistId && g.assistName) {
        const a = assists.get(g.assistId);
        if (a) a.count += 1;
        else assists.set(g.assistId, { name: g.assistName, count: 1 });
      }
    }
  }

  if (scorers.size === 0 && assists.size === 0) {
    el.classList.add("hidden");
    return;
  }

  el.classList.remove("hidden");
  const scorerRows = [...scorers.values()].sort((a, b) => b.goals - a.goals);
  const assistRows = [...assists.values()].sort((a, b) => b.count - a.count);

  let html = '<h3 class="night-summary__title">סיכום הערב</h3><div class="night-summary__cols">';
  if (scorerRows.length > 0) {
    html += `<div><strong>כובשים</strong><ul>${scorerRows
      .map((r) => `<li>${esc(r.name)} — ${r.goals}</li>`)
      .join("")}</ul></div>`;
  }
  if (assistRows.length > 0) {
    html += `<div><strong>בישלו</strong><ul>${assistRows
      .map((r) => `<li>${esc(r.name)} — ${r.count}</li>`)
      .join("")}</ul></div>`;
  }
  html += "</div>";
  el.innerHTML = html;
}

function bindAddGameForm(day: PublishedGameDay): void {
  const section = document.getElementById("addGameSection");
  const form = document.getElementById("addGameForm") as HTMLFormElement | null;
  if (!section || !form) return;

  if (!day.isOpen) {
    section.classList.add("hidden");
    return;
  }
  section.classList.remove("hidden");

  const homeSelect = document.getElementById("gameHomeTeam") as HTMLSelectElement;
  const awaySelect = document.getElementById("gameAwayTeam") as HTMLSelectElement;
  fillTeamSelect(homeSelect);
  fillTeamSelect(awaySelect);

  const leader = getPitchLeader(day.matches);
  if (leader) {
    homeSelect.value = leader;
    const other = TEAM_ORDER.find((t) => t !== leader);
    if (other) awaySelect.value = other;
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    void onAddGame();
  };
}

function fillTeamSelect(select: HTMLSelectElement): void {
  select.replaceChildren();
  for (const t of TEAM_ORDER) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = TEAM_LABELS[t];
    select.appendChild(opt);
  }
}

async function onAddGame(): Promise<void> {
  clearError();
  if (!gameDay?.isOpen) return;

  const homeTeam = (document.getElementById("gameHomeTeam") as HTMLSelectElement).value as TeamColor;
  const awayTeam = (document.getElementById("gameAwayTeam") as HTMLSelectElement).value as TeamColor;
  const homeScore = Number((document.getElementById("gameHomeScore") as HTMLInputElement).value);
  const awayScore = Number((document.getElementById("gameAwayScore") as HTMLInputElement).value);

  if (homeTeam === awayTeam) {
    showError("בחרו שתי קבוצות שונות");
    return;
  }

  try {
    const created = await db.createMatch(
      gameDay.session.id,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore
    );
    gameDay.matches = [...gameDay.matches, created];
    renderPitchStatus(gameDay);
    renderMatches(gameDay);
    bindAddGameForm(gameDay);
  } catch (err) {
    showError(err instanceof Error ? err.message : "לא נוסף משחק");
  }
}

async function saveMatch(matchId: string, row: HTMLElement): Promise<void> {
  clearError();
  if (!gameDay?.isOpen) return;
  const home = Number((row.querySelector("[data-home-score]") as HTMLInputElement).value);
  const away = Number((row.querySelector("[data-away-score]") as HTMLInputElement).value);
  try {
    await db.updateMatchScore(matchId, home, away);
    gameDay.matches = gameDay.matches.map((m) =>
      m.id === matchId ? { ...m, homeScore: home, awayScore: away } : m
    );
    renderPitchStatus(gameDay);
    renderMatches(gameDay);
    bindAddGameForm(gameDay);
  } catch (err) {
    showError(err instanceof Error ? err.message : "לא נשמר");
  }
}

async function removeMatch(matchId: string): Promise<void> {
  if (!gameDay?.isOpen) return;
  if (!confirm("למחוק את המשחק וכל השערים שלו?")) return;
  clearError();
  try {
    await db.deleteMatch(matchId);
    gameDay.matches = gameDay.matches.filter((m) => m.id !== matchId);
    renderPitchStatus(gameDay);
    renderMatches(gameDay);
    renderNightSummary(gameDay);
    bindAddGameForm(gameDay);
  } catch (err) {
    showError(err instanceof Error ? err.message : "לא נמחק");
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

void boot();

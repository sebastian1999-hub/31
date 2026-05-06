import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://hzsxlpzsknysjdpodpgg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xNazlHkI4DFI175UfCRt5Q_-EXtNKkL";

const SUITS = ["oros", "copas", "espadas", "bastos"];
const RANKS = [
  { key: "01", label: "As", points: 11 },
  { key: "02", label: "2", points: 2 },
  { key: "03", label: "3", points: 3 },
  { key: "04", label: "4", points: 4 },
  { key: "05", label: "5", points: 5 },
  { key: "06", label: "6", points: 6 },
  { key: "07", label: "7", points: 7 },
  { key: "08", label: "Sota", points: 10 },
  { key: "09", label: "Caballo", points: 10 },
  { key: "10", label: "Rey", points: 10 },
];

const MAX_NEGATIVE_POINTS = 10;
const POLL_MS = 1800;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ui = {
  authPanel: document.getElementById("authPanel"),
  authForm: document.getElementById("authForm"),
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  signOutBtn: document.getElementById("signOutBtn"),
  authStatus: document.getElementById("authStatus"),

  gamePanel: document.getElementById("gamePanel"),
  sessionInfo: document.getElementById("sessionInfo"),
  lobbyBox: document.getElementById("lobbyBox"),
  roomBox: document.getElementById("roomBox"),
  lobbyStatus: document.getElementById("lobbyStatus"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  leaveRoomBtn: document.getElementById("leaveRoomBtn"),
  roomMeta: document.getElementById("roomMeta"),
  roomMembersList: document.getElementById("roomMembersList"),
  startMatchBtn: document.getElementById("startMatchBtn"),

  tableBox: document.getElementById("tableBox"),
  roundMeta: document.getElementById("roundMeta"),
  playersList: document.getElementById("playersList"),
  drawPileCard: document.getElementById("drawPileCard"),
  discardPileCard: document.getElementById("discardPileCard"),
  drawCount: document.getElementById("drawCount"),
  drawFromDeckBtn: document.getElementById("drawFromDeckBtn"),
  drawFromDiscardBtn: document.getElementById("drawFromDiscardBtn"),
  closeRoundBtn: document.getElementById("closeRoundBtn"),
  turnHint: document.getElementById("turnHint"),
  currentHand: document.getElementById("currentHand"),
  logBox: document.getElementById("logBox"),

  roundDialog: document.getElementById("roundDialog"),
  dialogTitle: document.getElementById("dialogTitle"),
  dialogContent: document.getElementById("dialogContent"),
  continueBtn: document.getElementById("continueBtn"),
};

const state = {
  user: null,
  room: null,
  members: [],
  game: null,
  pollTimer: null,
};

function uid() {
  return crypto.randomUUID();
}

function usernameFromUser(user) {
  return user?.user_metadata?.name || user?.email?.split("@")[0] || "Jugador";
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: uid(),
        suit,
        rank: rank.key,
        label: rank.label,
        points: rank.points,
        image: `./spanish_deck/${suit}_${rank.key}.png`,
      });
    }
  }
  return shuffle(deck);
}

function scoreHand(hand) {
  const bySuit = { oros: 0, copas: 0, espadas: 0, bastos: 0 };
  for (const card of hand) {
    bySuit[card.suit] += card.points;
  }
  let bestSuit = "oros";
  for (const suit of SUITS) {
    if (bySuit[suit] > bySuit[bestSuit]) {
      bestSuit = suit;
    }
  }
  return { score: bySuit[bestSuit], bestSuit, bySuit };
}

function addLog(text) {
  if (!state.game) {
    return;
  }
  const stamp = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  state.game.logs.unshift(`[${stamp}] ${text}`);
  state.game.logs = state.game.logs.slice(0, 80);
}

function gameActivePlayers() {
  return state.game.players.filter((p) => !p.eliminated);
}

function getCurrentPlayer() {
  if (!state.game?.round) {
    return null;
  }
  const id = state.game.round.order[state.game.round.currentIndex];
  return state.game.players.find((p) => p.id === id) || null;
}

function isMyTurn() {
  const current = getCurrentPlayer();
  return Boolean(current && current.user_id === state.user?.id);
}

function cardToText(card) {
  return `${card.label} de ${card.suit}`;
}

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function withStatus(task) {
  ui.lobbyStatus.textContent = "Procesando...";
  try {
    await task();
    if (!ui.lobbyStatus.textContent.startsWith("Error")) {
      ui.lobbyStatus.textContent = "";
    }
  } catch (error) {
    ui.lobbyStatus.textContent = `Error: ${error.message}`;
  }
}

async function syncRoomFromServer() {
  if (!state.room?.id) {
    return;
  }

  const [{ data: room, error: roomError }, { data: members, error: membersError }] = await Promise.all([
    supabase.from("game31_rooms").select("*").eq("id", state.room.id).single(),
    supabase.from("game31_room_members").select("*").eq("room_id", state.room.id).order("joined_at"),
  ]);

  if (roomError) {
    throw roomError;
  }
  if (membersError) {
    throw membersError;
  }

  state.room = room;
  state.members = members || [];
  state.game = room.game_state || null;
}

function startPollingRoom() {
  stopPollingRoom();
  state.pollTimer = window.setInterval(async () => {
    if (!state.room?.id) {
      return;
    }
    try {
      await syncRoomFromServer();
      render();
    } catch (_error) {
      // Silence polling errors.
    }
  }, POLL_MS);
}

function stopPollingRoom() {
  if (state.pollTimer) {
    window.clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

async function persistGameState(status = "playing") {
  if (!state.room?.id) {
    return;
  }
  const { data, error } = await supabase
    .from("game31_rooms")
    .update({ game_state: state.game, status, updated_at: new Date().toISOString() })
    .eq("id", state.room.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  state.room = data;
}

async function createRoom() {
  const code = randomCode();
  const { data: room, error: roomError } = await supabase
    .from("game31_rooms")
    .insert({ code, owner_user_id: state.user.id, status: "lobby" })
    .select("*")
    .single();
  if (roomError) {
    throw roomError;
  }

  const { error: memberError } = await supabase.from("game31_room_members").insert({
    room_id: room.id,
    user_id: state.user.id,
    display_name: usernameFromUser(state.user),
  });
  if (memberError) {
    throw memberError;
  }

  state.room = room;
  await syncRoomFromServer();
  startPollingRoom();
}

async function joinRoomByCode(inputCode) {
  const code = inputCode.trim().toUpperCase();
  if (!code) {
    throw new Error("Escribe un codigo de sala.");
  }

  const { data: room, error: roomError } = await supabase
    .from("game31_rooms")
    .select("*")
    .eq("code", code)
    .single();
  if (roomError) {
    throw new Error("No existe sala con ese codigo.");
  }

  const { error: memberError } = await supabase.from("game31_room_members").upsert(
    {
      room_id: room.id,
      user_id: state.user.id,
      display_name: usernameFromUser(state.user),
    },
    { onConflict: "room_id,user_id" },
  );
  if (memberError) {
    throw memberError;
  }

  state.room = room;
  await syncRoomFromServer();
  startPollingRoom();
}

async function leaveRoom() {
  if (!state.room?.id) {
    return;
  }

  const roomId = state.room.id;
  await supabase.from("game31_room_members").delete().eq("room_id", roomId).eq("user_id", state.user.id);

  const isOwner = state.room.owner_user_id === state.user.id;
  if (isOwner) {
    const { data: remaining } = await supabase.from("game31_room_members").select("id").eq("room_id", roomId).limit(1);
    if (!remaining || remaining.length === 0) {
      await supabase.from("game31_rooms").delete().eq("id", roomId);
    }
  }

  state.room = null;
  state.members = [];
  state.game = null;
  stopPollingRoom();
  render();
}

function initialGameFromMembers() {
  if (state.members.length < 2 || state.members.length > 6) {
    throw new Error("La sala necesita entre 2 y 6 jugadores.");
  }

  return {
    players: state.members.map((m, idx) => ({
      id: uid(),
      user_id: m.user_id,
      name: m.display_name,
      seat: idx,
      penalty: 0,
      eliminated: false,
    })),
    round: null,
    roundNumber: 0,
    winnerId: null,
    logs: [],
    pendingSummary: null,
  };
}

function refillDrawPileIfNeeded() {
  if (!state.game?.round || state.game.round.drawPile.length > 0) {
    return;
  }
  if (state.game.round.discardPile.length <= 1) {
    return;
  }
  const top = state.game.round.discardPile.pop();
  const refill = shuffle([...state.game.round.discardPile]);
  state.game.round.discardPile = [top];
  state.game.round.drawPile = refill;
  addLog("Se reciclo el descarte para reconstruir el mazo.");
}

function evaluateAuto31() {
  if (!state.game?.round) {
    return;
  }
  for (const playerId of state.game.round.order) {
    const hand = state.game.round.hands[playerId];
    if (scoreHand(hand).score === 31) {
      finishRound({ reason: "exact31", triggerPlayerId: playerId });
      return;
    }
  }
}

function startNewRoundInMemory() {
  const alive = gameActivePlayers();
  if (alive.length <= 1) {
    if (alive[0]) {
      state.game.winnerId = alive[0].id;
      addLog(`Partida finalizada. Ganador: ${alive[0].name}.`);
    }
    state.game.round = null;
    return;
  }

  state.game.roundNumber += 1;
  const deck = createDeck();
  const order = alive.map((p) => p.id);
  const hands = {};
  const turns = {};

  for (const player of alive) {
    hands[player.id] = [deck.pop(), deck.pop(), deck.pop()];
    turns[player.id] = 0;
  }

  state.game.round = {
    order,
    currentIndex: 0,
    drawPile: deck,
    discardPile: [deck.pop()],
    hands,
    turns,
    hasDrawn: false,
  };

  addLog(`Comienza ronda ${state.game.roundNumber}.`);
  evaluateAuto31();
}

function moveNextTurn() {
  if (!state.game?.round) {
    return;
  }
  state.game.round.currentIndex = (state.game.round.currentIndex + 1) % state.game.round.order.length;
  state.game.round.hasDrawn = false;
}

function applyElimination() {
  for (const player of state.game.players) {
    if (!player.eliminated && player.penalty >= MAX_NEGATIVE_POINTS) {
      player.eliminated = true;
      addLog(`${player.name} queda eliminado con ${player.penalty} puntos.`);
    }
  }
}

function finishRound({ reason, triggerPlayerId }) {
  if (!state.game?.round) {
    return;
  }

  const scoring = state.game.round.order.map((playerId) => {
    const player = state.game.players.find((p) => p.id === playerId);
    const hand = state.game.round.hands[playerId];
    const result = scoreHand(hand);
    return {
      playerId,
      name: player?.name ?? "?",
      hand,
      score: result.score,
      suit: result.bestSuit,
    };
  });

  const deltas = Object.fromEntries(scoring.map((item) => [item.playerId, 0]));

  if (reason === "exact31") {
    for (const item of scoring) {
      if (item.playerId !== triggerPlayerId) {
        deltas[item.playerId] += 1;
      }
    }
    const triggerName = scoring.find((x) => x.playerId === triggerPlayerId)?.name ?? "Jugador";
    addLog(`${triggerName} hizo 31 exactos. Fin inmediato de ronda.`);
  }

  if (reason === "closure") {
    const lower = Math.min(...scoring.map((item) => item.score));
    for (const item of scoring) {
      if (item.score === lower) {
        deltas[item.playerId] += 1;
      }
    }

    const closer = scoring.find((x) => x.playerId === triggerPlayerId);
    const hasHigher = scoring.some((x) => x.playerId !== triggerPlayerId && x.score > (closer?.score ?? -1));
    if (hasHigher) {
      deltas[triggerPlayerId] += 2;
      addLog(`${closer?.name ?? "Jugador"} cerro con fallo y recibe +2 puntos.`);
    }
    addLog(`Ronda cerrada por ${closer?.name ?? "jugador"}.`);
  }

  for (const player of state.game.players) {
    player.penalty += deltas[player.id] || 0;
  }

  applyElimination();

  const alive = gameActivePlayers();
  if (alive.length === 1) {
    state.game.winnerId = alive[0].id;
    addLog(`Ganador definitivo: ${alive[0].name}.`);
  }

  const summaryRows = scoring
    .map((item) => {
      const cards = item.hand.map(cardToText).join(", ");
      const delta = deltas[item.playerId] || 0;
      const total = state.game.players.find((p) => p.id === item.playerId)?.penalty || 0;
      return `<p><strong>${item.name}</strong> - ${item.score} (${item.suit}) - [${cards}] - +${delta} (${total}/10)</p>`;
    })
    .join("");

  state.game.pendingSummary = {
    title: reason === "exact31" ? "Ronda terminada por 31" : "Ronda cerrada",
    html: summaryRows,
  };

  state.game.round = null;
}

async function startMatchOnline() {
  if (!state.room) {
    return;
  }
  state.game = initialGameFromMembers();
  addLog(`Partida creada con ${state.game.players.length} jugadores.`);
  startNewRoundInMemory();
  await persistGameState("playing");
  await syncRoomFromServer();
  render();
}

async function drawCard(source) {
  if (!state.game?.round || state.game.winnerId || !isMyTurn()) {
    return;
  }
  const player = getCurrentPlayer();
  if (!player) {
    return;
  }
  if (state.game.round.hasDrawn) {
    addLog("Ya robaste en este turno. Debes descartar.");
    render();
    return;
  }

  let card = null;
  if (source === "deck") {
    refillDrawPileIfNeeded();
    card = state.game.round.drawPile.pop() || null;
  }
  if (source === "discard") {
    card = state.game.round.discardPile.pop() || null;
  }

  if (!card) {
    addLog("No hay cartas disponibles para robar en esa opcion.");
    render();
    return;
  }

  state.game.round.hands[player.id].push(card);
  state.game.round.hasDrawn = true;
  addLog(`${player.name} roba ${cardToText(card)}.`);
  await persistGameState(state.room.status === "lobby" ? "playing" : state.room.status);
  render();
}

async function discardCard(cardId) {
  if (!state.game?.round || !state.game.round.hasDrawn || !isMyTurn()) {
    return;
  }
  const player = getCurrentPlayer();
  const hand = state.game.round.hands[player.id];
  if (!hand || hand.length !== 4) {
    return;
  }

  const idx = hand.findIndex((card) => card.id === cardId);
  if (idx === -1) {
    return;
  }

  const [card] = hand.splice(idx, 1);
  state.game.round.discardPile.push(card);
  state.game.round.turns[player.id] += 1;
  state.game.round.hasDrawn = false;

  addLog(`${player.name} descarta ${cardToText(card)}.`);

  if (scoreHand(hand).score === 31) {
    finishRound({ reason: "exact31", triggerPlayerId: player.id });
  } else {
    moveNextTurn();
  }

  await persistGameState(state.game.winnerId ? "finished" : "playing");
  render();
}

async function closeRound() {
  if (!state.game?.round || state.game.round.hasDrawn || state.game.winnerId || !isMyTurn()) {
    return;
  }
  const player = getCurrentPlayer();
  if ((state.game.round.turns[player.id] || 0) < 1) {
    addLog(`${player.name} aun no puede cerrar (solo desde su segundo turno).`);
    render();
    return;
  }

  finishRound({ reason: "closure", triggerPlayerId: player.id });
  await persistGameState(state.game.winnerId ? "finished" : "playing");
  render();
}

function getCardHtml(card, discardable) {
  const classes = ["card"];
  if (discardable) {
    classes.push("discardable");
  }
  const safeAlt = `${card.label} de ${card.suit}`;
  return `<button class="${classes.join(" ")}" data-card-id="${card.id}" title="${safeAlt}"><img src="${card.image}" alt="${safeAlt}" /></button>`;
}

function renderPile(container, card) {
  if (!card) {
    container.className = "card-stack empty";
    container.innerHTML = "<span>Sin carta</span>";
    return;
  }
  container.className = "card-stack";
  container.innerHTML = `<img src="${card.image}" alt="${cardToText(card)}" />`;
}

function renderRoomMembers() {
  ui.roomMembersList.innerHTML = state.members
    .map((m) => {
      const mine = m.user_id === state.user?.id ? "(tu)" : "";
      return `<div class="player-row"><div><strong>${m.display_name}</strong> ${mine}</div><span class="badge">online</span></div>`;
    })
    .join("");
}

function renderPlayers() {
  if (!state.game) {
    ui.playersList.innerHTML = "";
    return;
  }
  const current = getCurrentPlayer();
  ui.playersList.innerHTML = state.game.players
    .map((player) => {
      const classes = ["player-row"];
      if (current?.id === player.id) {
        classes.push("current");
      }
      if (player.eliminated) {
        classes.push("eliminated");
      }

      let handScoreText = "";
      if (state.game.round && state.game.round.hands[player.id]) {
        const handScore = scoreHand(state.game.round.hands[player.id]);
        handScoreText = `<small class="muted">mano: ${handScore.score} (${handScore.bestSuit})</small>`;
      }

      return `<div class="${classes.join(" ")}"><div><strong>${player.name}</strong><br/>${handScoreText}</div><span class="badge ${player.penalty >= 7 ? "warn" : "good"}">${player.eliminated ? "Eliminado" : `${player.penalty}/10`}</span></div>`;
    })
    .join("");
}

function renderLog() {
  ui.logBox.innerHTML = (state.game?.logs || []).map((line) => `<p>${line}</p>`).join("");
}

function renderMeta() {
  if (!state.room) {
    ui.roomMeta.textContent = "";
    return;
  }
  const ownerTag = state.room.owner_user_id === state.user?.id ? "(host)" : "";
  ui.roomMeta.innerHTML = `<strong>Sala ${state.room.code}</strong> ${ownerTag} - ${state.members.length} jugador(es)`;
}

function renderRound() {
  if (!state.game) {
    ui.tableBox.classList.add("hidden");
    return;
  }

  ui.tableBox.classList.remove("hidden");

  const winner = state.game.players.find((p) => p.id === state.game.winnerId);
  if (winner) {
    ui.roundMeta.innerHTML = `<strong>Partida finalizada.</strong> Ganador: ${winner.name}.`;
  } else if (!state.game.round) {
    ui.roundMeta.textContent = "Ronda terminada. Pulsa continuar.";
  } else {
    const current = getCurrentPlayer();
    ui.roundMeta.innerHTML = `<strong>Ronda ${state.game.roundNumber}</strong> - turno de ${current?.name || "-"}`;
  }

  if (!state.game.round || state.game.winnerId) {
    ui.drawFromDeckBtn.disabled = true;
    ui.drawFromDiscardBtn.disabled = true;
    ui.closeRoundBtn.disabled = true;
    ui.turnHint.textContent = "No hay ronda activa.";
    ui.currentHand.innerHTML = "";
    renderPile(ui.drawPileCard, null);
    renderPile(ui.discardPileCard, null);
    ui.drawCount.textContent = "";
    return;
  }

  const current = getCurrentPlayer();
  const mine = current.user_id === state.user?.id;
  const hand = state.game.round.hands[current.id] || [];

  ui.drawFromDeckBtn.disabled = !mine || state.game.round.hasDrawn;
  ui.drawFromDiscardBtn.disabled = !mine || state.game.round.hasDrawn || state.game.round.discardPile.length === 0;
  ui.closeRoundBtn.disabled = !mine || state.game.round.hasDrawn || (state.game.round.turns[current.id] || 0) < 1;

  ui.turnHint.textContent = mine
    ? state.game.round.hasDrawn
      ? `Es tu turno (${current.name}). Elige una carta para descartar.`
      : `Es tu turno (${current.name}). Roba del mazo o descarte.`
    : `Turno de ${current.name}. Espera a que juegue.`;

  ui.currentHand.innerHTML = hand.map((card) => getCardHtml(card, mine && state.game.round.hasDrawn)).join("");
  renderPile(ui.drawPileCard, { image: "./spanish_deck/back.png", label: "dorso", suit: "" });
  renderPile(ui.discardPileCard, state.game.round.discardPile[state.game.round.discardPile.length - 1]);
  ui.drawCount.textContent = `${state.game.round.drawPile.length} cartas`;

  for (const button of ui.currentHand.querySelectorAll("button[data-card-id]")) {
    button.disabled = !(mine && state.game.round.hasDrawn);
    button.addEventListener("click", () => {
      discardCard(button.dataset.cardId).catch((error) => {
        ui.lobbyStatus.textContent = `Error: ${error.message}`;
      });
    });
  }
}

function showSummaryDialogIfNeeded() {
  if (!state.game?.pendingSummary) {
    return;
  }
  ui.dialogTitle.textContent = state.game.pendingSummary.title;
  ui.dialogContent.innerHTML = state.game.pendingSummary.html;
  if (!ui.roundDialog.open) {
    ui.roundDialog.showModal();
  }
}

function render() {
  const authed = Boolean(state.user);

  ui.authPanel.classList.toggle("hidden", authed);
  ui.gamePanel.classList.toggle("hidden", !authed);
  ui.signOutBtn.classList.toggle("hidden", !authed);
  ui.sessionInfo.textContent = authed ? `Sesion: ${state.user.email}` : "";

  const inRoom = Boolean(state.room);
  ui.lobbyBox.classList.toggle("hidden", inRoom);
  ui.roomBox.classList.toggle("hidden", !inRoom);

  if (!authed) {
    return;
  }

  renderMeta();
  renderRoomMembers();
  renderPlayers();
  renderRound();
  renderLog();
  showSummaryDialogIfNeeded();
}

async function discoverCurrentRoom() {
  if (!state.user) {
    state.room = null;
    state.members = [];
    state.game = null;
    return;
  }

  const { data, error } = await supabase
    .from("game31_room_members")
    .select("room_id")
    .eq("user_id", state.user.id)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.room_id) {
    state.room = null;
    state.members = [];
    state.game = null;
    return;
  }

  const { data: room, error: roomError } = await supabase.from("game31_rooms").select("*").eq("id", data.room_id).single();
  if (roomError) {
    throw roomError;
  }

  state.room = room;
  await syncRoomFromServer();
  startPollingRoom();
}

async function bootAuth() {
  const { data } = await supabase.auth.getSession();
  state.user = data.session?.user || null;

  if (state.user) {
    ui.authStatus.textContent = `Conectado como ${state.user.email}`;
    try {
      await discoverCurrentRoom();
    } catch (error) {
      ui.lobbyStatus.textContent = `Error: ${error.message}`;
    }
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user || null;
    state.room = null;
    state.members = [];
    state.game = null;
    stopPollingRoom();

    if (state.user) {
      ui.authStatus.textContent = `Conectado como ${state.user.email}`;
      try {
        await discoverCurrentRoom();
      } catch (error) {
        ui.lobbyStatus.textContent = `Error: ${error.message}`;
      }
    } else {
      ui.authStatus.textContent = "Sesion cerrada.";
    }
    render();
  });

  render();
}

ui.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = event.submitter;
  const mode = submit?.dataset.mode;
  const email = ui.emailInput.value.trim();
  const password = ui.passwordInput.value;
  if (!mode) {
    return;
  }

  ui.authStatus.textContent = "Procesando...";

  try {
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
      ui.authStatus.textContent = "Sesion iniciada.";
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { name: email.split("@")[0] } } });
      if (error) {
        throw error;
      }
      ui.authStatus.textContent = "Cuenta creada. Revisa confirmacion de email si la tienes activa.";
    }
  } catch (error) {
    ui.authStatus.textContent = `Error: ${error.message}`;
  }
});

ui.signOutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
});

ui.createRoomBtn.addEventListener("click", () => {
  withStatus(async () => {
    await createRoom();
    ui.lobbyStatus.textContent = `Sala creada: ${state.room.code}`;
    render();
  });
});

ui.joinRoomBtn.addEventListener("click", () => {
  withStatus(async () => {
    await joinRoomByCode(ui.roomCodeInput.value);
    ui.roomCodeInput.value = "";
    ui.lobbyStatus.textContent = `Entraste en sala ${state.room.code}`;
    render();
  });
});

ui.leaveRoomBtn.addEventListener("click", () => {
  withStatus(async () => {
    await leaveRoom();
    ui.lobbyStatus.textContent = "Saliste de la sala.";
    render();
  });
});

ui.startMatchBtn.addEventListener("click", () => {
  withStatus(async () => {
    if (!state.room) {
      return;
    }
    if (state.room.owner_user_id !== state.user.id) {
      throw new Error("Solo el host puede iniciar la partida.");
    }
    await startMatchOnline();
    render();
  });
});

ui.drawFromDeckBtn.addEventListener("click", () => {
  drawCard("deck").catch((error) => {
    ui.lobbyStatus.textContent = `Error: ${error.message}`;
  });
});

ui.drawFromDiscardBtn.addEventListener("click", () => {
  drawCard("discard").catch((error) => {
    ui.lobbyStatus.textContent = `Error: ${error.message}`;
  });
});

ui.closeRoundBtn.addEventListener("click", () => {
  closeRound().catch((error) => {
    ui.lobbyStatus.textContent = `Error: ${error.message}`;
  });
});

ui.continueBtn.addEventListener("click", () => {
  withStatus(async () => {
    if (!state.game) {
      return;
    }
    state.game.pendingSummary = null;
    if (!state.game.winnerId) {
      startNewRoundInMemory();
    }
    await persistGameState(state.game.winnerId ? "finished" : "playing");
    render();
  });
});

bootAuth();

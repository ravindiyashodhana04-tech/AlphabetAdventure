/* -----------------------------------------------------------
   Alphabet Adventure — game logic
   Talks to the Flask backend for letter data, then runs the
   8-step sequence from the plan for each letter in a level:
   Learn -> Find -> Match -> Listen -> Trace -> Build (once/level)
   ----------------------------------------------------------- */

// ---------- App state ----------
const state = {
  level: null,
  letters: [],       // letters for the current level
  buildWord: null,   // {word, emoji} for this level
  letterIndex: 0,     // which letter within the level we're on
  stars: 0,
  stepsPerLetter: ["learn", "find", "match", "listen", "trace"],
  stepIndex: 0,
};

// ---------- Screen elements ----------
const screens = {
  title: document.getElementById("screen-title"),
  levels: document.getElementById("screen-levels"),
  learn: document.getElementById("screen-learn"),
  find: document.getElementById("screen-find"),
  match: document.getElementById("screen-match"),
  listen: document.getElementById("screen-listen"),
  trace: document.getElementById("screen-trace"),
  build: document.getElementById("screen-build"),
  complete: document.getElementById("screen-complete"),
};
const gameHeader = document.getElementById("game-header");
const progressFill = document.getElementById("progress-fill");
const starTotal = document.getElementById("star-total");

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add("hidden"));
  screens[name].classList.remove("hidden");
  const isTitleOrLevels = name === "title" || name === "levels";
  gameHeader.classList.toggle("hidden", isTitleOrLevels);
  if (name === "title") mascotCorner.classList.add("hidden");
}

function addStar() {
  state.stars += 1;
  starTotal.textContent = state.stars;
}

// ---------- Pick a female / child-friendly voice ----------
// Available voices differ by OS/browser, so we search by name for common
// female voices and fall back gracefully if none are found.
let selectedVoice = null;
const PREFERRED_VOICE_NAMES = [
  "Google UK English Female", "Google US English", "Samantha", "Karen",
  "Moira", "Tessa", "Victoria", "Fiona", "Microsoft Zira", "Female"
];

function pickKidsVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  for (const name of PREFERRED_VOICE_NAMES) {
    const match = voices.find(v => v.name.includes(name));
    if (match) return match;
  }
  const femaleGuess = voices.find(v => /female|woman|girl/i.test(v.name));
  if (femaleGuess) return femaleGuess;
  const englishVoice = voices.find(v => v.lang && v.lang.startsWith("en"));
  return englishVoice || voices[0];
}

function refreshVoice() { selectedVoice = pickKidsVoice(); }
if ("speechSynthesis" in window) {
  refreshVoice();
  window.speechSynthesis.onvoiceschanged = refreshVoice;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.9;    // clear but natural-paced for young children
  utter.pitch = 1.3;   // brighter, kid-friendly tone
  if (selectedVoice) utter.voice = selectedVoice;
  window.speechSynthesis.speak(utter);
}

// ---------- Mascot (cat) — pops up specifically to narrate instructions ----------
const mascotCorner = document.getElementById("mascot-corner");
const mascotBubble = document.getElementById("mascot-bubble");
let mascotHideTimer = null;

function mascotSay(text, { speakIt = true } = {}) {
  mascotCorner.classList.remove("hidden");
  mascotCorner.classList.add("mascot-active");
  mascotBubble.textContent = text;
  mascotBubble.classList.remove("hidden");
  if (speakIt) speak(text);
  clearTimeout(mascotHideTimer);
  mascotHideTimer = setTimeout(() => {
    mascotBubble.classList.add("hidden");
    mascotCorner.classList.remove("mascot-active");
  }, 4800);
}

// ---------- Pop-up rewards ----------
const rewardPopup = document.getElementById("reward-popup");
const rewardText = document.getElementById("reward-text");
let rewardHideTimer = null;

function showReward(text) {
  rewardText.textContent = text;
  rewardPopup.classList.remove("hidden");
  clearTimeout(rewardHideTimer);
  rewardHideTimer = setTimeout(() => rewardPopup.classList.add("hidden"), 1100);
}

// ---------- Background music: a cheerful, catchy original tune ----------
// (synthesized in-browser so no copyrighted audio files are needed)
let audioCtx = null;
let musicOn = true;
let musicTimer = null;
// Upbeat pentatonic melody + a simple bass line played underneath it
const MUSIC_MELODY = [392.0, 440.0, 523.25, 440.0, 392.0, 329.63, 392.0, 440.0]; // G A C A G E G A
const MUSIC_BASS   = [196.0, 196.0, 261.63, 261.63, 196.0, 196.0, 164.81, 164.81]; // G G C C G G E E

function ensureAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function playNote(freq, time, duration, peakVolume, waveType) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = waveType || "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(peakVolume, time + 0.04);
  gain.gain.linearRampToValueAtTime(0, time + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(time);
  osc.stop(time + duration);
}

function scheduleMusicLoop() {
  if (!musicOn || !audioCtx) return;
  const noteDuration = 0.42; // brisk, cheerful tempo
  const now = audioCtx.currentTime + 0.05;
  MUSIC_MELODY.forEach((freq, i) => playNote(freq, now + i * noteDuration, noteDuration * 0.9, 0.14, "triangle"));
  MUSIC_BASS.forEach((freq, i) => playNote(freq, now + i * noteDuration, noteDuration * 0.95, 0.08, "sine"));
  musicTimer = setTimeout(scheduleMusicLoop, MUSIC_MELODY.length * noteDuration * 1000);
}

function startMusic() {
  ensureAudioContext();
  musicOn = true;
  document.getElementById("music-toggle").textContent = "🔊";
  clearTimeout(musicTimer);
  scheduleMusicLoop();
}

function stopMusic() {
  musicOn = false;
  document.getElementById("music-toggle").textContent = "🔇";
  clearTimeout(musicTimer);
}

document.getElementById("music-toggle").addEventListener("click", () => {
  if (musicOn) stopMusic();
  else startMusic();
});

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function updateProgress() {
  const totalSteps = state.letters.length * state.stepsPerLetter.length + 1; // +1 for build word
  const doneSteps = state.letterIndex * state.stepsPerLetter.length + state.stepIndex;
  progressFill.style.width = `${Math.min(100, (doneSteps / totalSteps) * 100)}%`;
}

// ---------- Title screen ----------
document.getElementById("start-btn").addEventListener("click", () => {
  try { startMusic(); } catch (e) { console.warn("Music failed to start:", e); }
  showScreen("levels");
  loadLevels();
  mascotSay("Let's learn the alphabet!");
});

document.getElementById("back-btn").addEventListener("click", () => {
  showScreen("levels");
});

document.getElementById("complete-levels-btn").addEventListener("click", () => {
  showScreen("levels");
});

// ---------- Level select ----------
async function loadLevels() {
  const grid = document.getElementById("level-grid");
  grid.innerHTML = "Loading...";
  const res = await fetch("/api/levels");
  const levels = await res.json();
  grid.innerHTML = "";
  levels.forEach(lvl => {
    const tile = document.createElement("button");
    tile.className = "level-tile";
    tile.innerHTML = `<span class="lvl-num">${lvl.level}</span><span>${lvl.range}</span>`;
    tile.addEventListener("click", () => startLevel(lvl.level));
    grid.appendChild(tile);
  });
}

async function startLevel(levelNum) {
  const res = await fetch(`/api/level/${levelNum}`);
  const data = await res.json();
  state.level = levelNum;
  state.letters = data.letters;
  state.buildWord = data.build_word;
  state.letterIndex = 0;
  state.stepIndex = 0;
  mascotSay(`Level ${levelNum}! Here we go!`);
  runLetterStep();
}

// ---------- Runs through learn/find/match/listen/trace for each letter ----------
function runLetterStep() {
  updateProgress();

  if (state.letterIndex >= state.letters.length) {
    startBuildWord();
    return;
  }

  const step = state.stepsPerLetter[state.stepIndex];
  const letterData = state.letters[state.letterIndex];

  if (step === "learn") renderLearn(letterData);
  else if (step === "find") renderFind(letterData);
  else if (step === "match") renderMatch(letterData);
  else if (step === "listen") renderListen(letterData);
  else if (step === "trace") renderTrace(letterData);
}

function advanceStep() {
  state.stepIndex += 1;
  if (state.stepIndex >= state.stepsPerLetter.length) {
    state.stepIndex = 0;
    state.letterIndex += 1;
  }
  runLetterStep();
}

function otherLetters(exclude, count) {
  const pool = state.letters
    .map(l => l.letter)
    .filter(l => l !== exclude.letter);
  // Pad with random A-Z letters if the level doesn't have enough
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  while (pool.length < count) {
    const candidate = alphabet[Math.floor(Math.random() * alphabet.length)];
    if (candidate !== exclude.letter && !pool.includes(candidate)) pool.push(candidate);
  }
  return shuffle(pool).slice(0, count);
}

// ---------- Step 3: Learn the letter ----------
function renderLearn(letterData) {
  document.getElementById("learn-letter").textContent = `${letterData.letter} ${letterData.letter.toLowerCase()}`;
  document.getElementById("learn-emoji").textContent = letterData.emoji;
  document.getElementById("learn-word").textContent = letterData.word;
  showScreen("learn");
  const learnLine = `${letterData.letter} is for ${letterData.word}.`;
  mascotSay(learnLine);

  document.getElementById("learn-speak-btn").onclick = () => speak(learnLine);
  document.getElementById("learn-next-btn").onclick = () => advanceStep();
}

// ---------- Step 4: Find the letter ----------
function renderFind(letterData) {
  document.getElementById("find-prompt").textContent = `Find ${letterData.letter}`;
  mascotSay(`Find the letter ${letterData.letter}!`);
  const feedback = document.getElementById("find-feedback");
  feedback.textContent = "";
  feedback.className = "feedback";

  const options = shuffle([letterData.letter, ...otherLetters(letterData, 2)]);
  const row = document.getElementById("find-options");
  row.innerHTML = "";
  options.forEach(letter => {
    const tile = document.createElement("button");
    tile.className = "option-tile";
    tile.textContent = letter;
    tile.addEventListener("click", () => {
      if (letter === letterData.letter) {
        tile.classList.add("correct");
        feedback.textContent = "Great job! ⭐";
        feedback.className = "feedback good";
        addStar();
        showReward("Great job! ⭐");
        setTimeout(advanceStep, 700);
      } else {
        tile.classList.add("wrong");
        feedback.textContent = "Try again!";
        feedback.className = "feedback bad";
        setTimeout(() => tile.classList.remove("wrong"), 500);
      }
    });
    row.appendChild(tile);
  });
  showScreen("find");
}

// ---------- Step 5: Match the picture ----------
function renderMatch(letterData) {
  document.getElementById("match-letter").textContent = letterData.letter;
  mascotSay(`Which picture starts with ${letterData.letter}?`);
  const feedback = document.getElementById("match-feedback");
  feedback.textContent = "";
  feedback.className = "feedback";

  const distractors = otherLetters(letterData, 2).map(l => {
    const found = ALL_LETTERS_CACHE.find(x => x.letter === l);
    return found || { letter: l, emoji: "❓" };
  });
  const options = shuffle([letterData, ...distractors]);
  const row = document.getElementById("match-options");
  row.innerHTML = "";
  options.forEach(opt => {
    const tile = document.createElement("button");
    tile.className = "option-tile emoji-tile";
    tile.textContent = opt.emoji;
    tile.addEventListener("click", () => {
      if (opt.letter === letterData.letter) {
        tile.classList.add("correct");
        feedback.textContent = "Well done! ⭐";
        feedback.className = "feedback good";
        addStar();
        showReward("Well done! ⭐");
        setTimeout(advanceStep, 700);
      } else {
        tile.classList.add("wrong");
        feedback.textContent = "Try again!";
        feedback.className = "feedback bad";
        setTimeout(() => tile.classList.remove("wrong"), 500);
      }
    });
    row.appendChild(tile);
  });
  showScreen("match");
}

// ---------- Step 6: Listen and choose ----------
function renderListen(letterData) {
  const feedback = document.getElementById("listen-feedback");
  feedback.textContent = "";
  feedback.className = "feedback";

  const options = shuffle([letterData.letter, ...otherLetters(letterData, 2)]);
  const row = document.getElementById("listen-options");
  row.innerHTML = "";
  options.forEach(letter => {
    const tile = document.createElement("button");
    tile.className = "option-tile";
    tile.textContent = letter;
    tile.addEventListener("click", () => {
      if (letter === letterData.letter) {
        tile.classList.add("correct");
        feedback.textContent = "Well done! ⭐";
        feedback.className = "feedback good";
        addStar();
        showReward("Well done! ⭐");
        setTimeout(advanceStep, 700);
      } else {
        tile.classList.add("wrong");
        feedback.textContent = "Try again!";
        feedback.className = "feedback bad";
        setTimeout(() => tile.classList.remove("wrong"), 500);
      }
    });
    row.appendChild(tile);
  });

  const listenLine = `Listen carefully, and choose the letter ${letterData.letter}.`;
  document.getElementById("listen-speak-btn").onclick = () => speak(listenLine);
  showScreen("listen");
  mascotSay(listenLine);
}

// ---------- Step 7: Trace the letter ----------

const TRACE_GRID_SIZE = 16; // divides the canvas into a 16x16 grid for coverage checks

// Builds a pixel mask of where a letter's shape sits on a canvas of the
// given size, so we can later check how much of the child's drawing
// actually lands on the letter (rather than just accepting any scribble).
// Also records which grid cells contain part of the letter, since
// checking "did the child's marks touch most parts of the letter" is a
// much stronger test than just "do the pixels overlap somewhere".
function buildLetterMask(letter, width, height) {
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const mctx = maskCanvas.getContext("2d");
  mctx.font = "220px 'Baloo 2', sans-serif";
  mctx.fillStyle = "#000000";
  mctx.textAlign = "center";
  mctx.textBaseline = "middle";
  mctx.fillText(letter, width / 2, height / 2 + 10);

  const data = mctx.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  const cellSize = width / TRACE_GRID_SIZE;
  const letterCells = new Set();
  let maskPixelCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const alpha = data[i * 4 + 3];
      if (alpha > 128) {
        mask[i] = 1;
        maskPixelCount++;
        const cellX = Math.floor(x / cellSize);
        const cellY = Math.floor(y / cellSize);
        letterCells.add(cellY * TRACE_GRID_SIZE + cellX);
      }
    }
  }
  return { mask, maskPixelCount, letterCells, cellSize };
}

// Checks the child's strokes (drawn in coral) against the letter mask.
// - cellCoverage: what fraction of the letter's grid cells were touched
//   by a drawn pixel (catches "only traced part of it")
// - precision: what fraction of drawn pixels landed on the letter
//   (catches "scribbled outside the letter")
// - fillRatio: how much was drawn relative to the letter's own area
//   (catches "just filled in a big blob instead of tracing the lines")
function scoreTrace(canvas, letterMask) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const cellSize = letterMask.cellSize;

  let drawnTotal = 0;
  let drawnInsideMask = 0;
  const touchedLetterCells = new Set();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
      // Coral stroke color is #FF6B6B (255, 107, 107), drawn fully opaque
      const isDrawnStroke = a > 200 && r > 220 && g < 160 && b < 160;
      if (isDrawnStroke) {
        drawnTotal++;
        if (letterMask.mask[i] === 1) {
          drawnInsideMask++;
          const cellX = Math.floor(x / cellSize);
          const cellY = Math.floor(y / cellSize);
          touchedLetterCells.add(cellY * TRACE_GRID_SIZE + cellX);
        }
      }
    }
  }

  let touchedCount = 0;
  letterMask.letterCells.forEach(cell => { if (touchedLetterCells.has(cell)) touchedCount++; });
  const cellCoverage = letterMask.letterCells.size > 0 ? touchedCount / letterMask.letterCells.size : 0;
  const precision = drawnTotal > 0 ? drawnInsideMask / drawnTotal : 0;
  const fillRatio = letterMask.maskPixelCount > 0 ? drawnTotal / letterMask.maskPixelCount : 0;

  return { drawnTotal, cellCoverage, precision, fillRatio };
}

function renderTrace(letterData) {
  document.getElementById("trace-target").textContent = `Trace the letter ${letterData.letter}`;
  const feedback = document.getElementById("trace-feedback");
  feedback.textContent = "";
  feedback.className = "feedback";
  const canvas = document.getElementById("trace-canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw a large dotted guide letter for the child to trace over
  ctx.save();
  ctx.font = "220px 'Baloo 2', sans-serif";
  ctx.fillStyle = "rgba(93, 183, 222, 0.35)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letterData.letter, canvas.width / 2, canvas.height / 2 + 10);
  ctx.restore();

  // Build (once per attempt) the mask we'll grade the drawing against
  const letterMask = buildLetterMask(letterData.letter, canvas.width, canvas.height);

  let drawing = false;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#FF6B6B";

  function pos(evt) {
    const rect = canvas.getBoundingClientRect();
    const point = evt.touches ? evt.touches[0] : evt;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }
  function start(evt) { drawing = true; const p = pos(evt); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(evt) {
    if (!drawing) return;
    evt.preventDefault();
    const p = pos(evt);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function end() { drawing = false; }

  canvas.onmousedown = start;
  canvas.onmousemove = move;
  window.onmouseup = end;
  canvas.ontouchstart = start;
  canvas.ontouchmove = move;
  canvas.ontouchend = end;

  document.getElementById("trace-clear-btn").onclick = () => renderTrace(letterData);
  document.getElementById("trace-done-btn").onclick = () => {
    const result = scoreTrace(canvas, letterMask);

    // Tune-able thresholds:
    const MIN_DRAWN_PIXELS = 150;   // must have actually drawn something
    const MIN_CELL_COVERAGE = 0.55; // must have touched most parts of the letter's shape
    const MIN_PRECISION = 0.45;     // most strokes should land on the letter, not elsewhere
    const MAX_FILL_RATIO = 2.2;     // catches "filled in a blob" instead of tracing lines

    if (result.drawnTotal < MIN_DRAWN_PIXELS) {
      feedback.textContent = "Try tracing the letter first!";
      feedback.className = "feedback bad";
    } else if (result.fillRatio > MAX_FILL_RATIO) {
      feedback.textContent = "Trace along the lines, not a big scribble!";
      feedback.className = "feedback bad";
      setTimeout(() => renderTrace(letterData), 1200);
    } else if (result.cellCoverage >= MIN_CELL_COVERAGE && result.precision >= MIN_PRECISION) {
      feedback.textContent = "Great writing! ⭐";
      feedback.className = "feedback good";
      addStar();
      showReward("Great writing! ⭐");
      setTimeout(advanceStep, 700);
    } else {
      feedback.textContent = "Not quite — trace over the dotted letter!";
      feedback.className = "feedback bad";
      setTimeout(() => renderTrace(letterData), 1200);
    }
  };

  showScreen("trace");
  mascotSay(`Can you trace the letter ${letterData.letter}?`);
}

// ---------- Step 8: Build the word (once per level) ----------
function startBuildWord() {
  const { word, emoji } = state.buildWord;
  document.getElementById("build-emoji").textContent = emoji;
  const feedback = document.getElementById("build-feedback");
  feedback.textContent = "";
  feedback.className = "feedback";

  mascotSay(`Let's build the word for ${word}!`);
  const slotsEl = document.getElementById("build-slots");
  const tilesEl = document.getElementById("build-tiles");
  slotsEl.innerHTML = "";
  tilesEl.innerHTML = "";

  const answer = word.split("");
  const filled = new Array(answer.length).fill(null);

  answer.forEach(() => {
    const slot = document.createElement("div");
    slot.className = "build-slot";
    slotsEl.appendChild(slot);
  });

  const scrambled = shuffle(answer.map((letter, i) => ({ letter, id: i })));
  scrambled.forEach(item => {
    const tile = document.createElement("button");
    tile.className = "tile";
    tile.textContent = item.letter;
    tile.addEventListener("click", () => {
      const nextEmpty = filled.indexOf(null);
      if (nextEmpty === -1) return;
      filled[nextEmpty] = item.letter;
      slotsEl.children[nextEmpty].textContent = item.letter;
      tile.disabled = true;

      if (!filled.includes(null)) {
        const built = filled.join("");
        if (built === word) {
          feedback.textContent = "Excellent! ⭐";
          feedback.className = "feedback good";
          addStar();
          showReward("Excellent! ⭐");
          setTimeout(finishLevel, 900);
        } else {
          feedback.textContent = "Try again!";
          feedback.className = "feedback bad";
          setTimeout(() => startBuildWord(), 800);
        }
      }
    });
    tilesEl.appendChild(tile);
  });

  showScreen("build");
}

function finishLevel() {
  document.getElementById("complete-summary").textContent =
    `You finished level ${state.level} with ${state.stars} stars!`;
  showScreen("complete");
  showReward("Level Complete! 🎉");
  mascotSay("You did it! Amazing work!");
}

// Cache of all 26 letters (used to render distractor emojis in "match")
let ALL_LETTERS_CACHE = [];
(async function preloadAllLetters() {
  const all = [];
  for (let lvl = 1; lvl <= 5; lvl++) {
    const res = await fetch(`/api/level/${lvl}`);
    const data = await res.json();
    all.push(...data.letters);
  }
  ALL_LETTERS_CACHE = all;
})();

showScreen("title");

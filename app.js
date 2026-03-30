const STORAGE_KEY = "sargis-mini-app";
let currentTask = null;

const theoryBase = {
  arithmetic: [
    "Сначала скобки, потом умножение и деление, затем сложение и вычитание.",
    "Проверяй ответ обратным действием."
  ],
  fractions: [
    "При сложении дробей с разными знаменателями сначала приведи к общему знаменателю.",
    "После ответа всегда смотри, можно ли сократить дробь."
  ],
  equations: [
    "Сохраняй равенство: что делаешь слева, то же делай справа.",
    "После нахождения x проверь ответ подстановкой."
  ],
  geometry: [
    "Площадь прямоугольника: S = a * b.",
    "Периметр прямоугольника: P = 2(a + b).",
    "Площадь треугольника: S = a * h / 2."
  ],
  functions: [
    "Производная x^n равна n * x^(n-1).",
    "Интеграл x^n равен x^(n+1)/(n+1) + C."
  ],
  trigonometry: [
    "sin 30 = 1/2, cos 60 = 1/2.",
    "sin 45 = cos 45 = sqrt(2)/2.",
    "tg 45 = 1."
  ]
};

function tgUser() {
  const app = window.Telegram && window.Telegram.WebApp;
  return app && app.initDataUnsafe && app.initDataUnsafe.user ? app.initDataUnsafe.user : null;
}

function getState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState();
  } catch {
    return defaultState();
  }
}

function defaultState() {
  return {
    name: "Ученик",
    userId: "",
    grade: "",
    solved: 0,
    correct: 0,
    strongTopics: [],
    weakTopics: [],
    lastTopic: "equations"
  };
}

function setState(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function resolveUser() {
  const tg = tgUser();
  const state = getState();
  return {
    userId: document.getElementById("userId").value || state.userId || (tg ? String(tg.id) : ""),
    userName: document.getElementById("userName").value || state.name || (tg ? (tg.first_name || "Ученик") : "Ученик"),
    grade: document.getElementById("grade").value || state.grade || ""
  };
}

function renderProfile() {
  const state = getState();
  const accuracy = state.solved ? ((state.correct / state.solved) * 100).toFixed(1) : "0.0";
  document.getElementById("profile").innerHTML = `
    <div class="profile-grid">
      <div class="metric-card"><span>Имя</span><strong>${state.name || "Ученик"}</strong></div>
      <div class="metric-card"><span>Класс</span><strong>${state.grade ? `${state.grade} класс` : "Авто"}</strong></div>
      <div class="metric-card"><span>Решено</span><strong>${state.solved}</strong></div>
      <div class="metric-card"><span>Точность</span><strong>${accuracy}%</strong></div>
    </div>
    <div class="metric"><strong>Сильные темы:</strong> ${state.strongTopics.join(", ") || "пока нет"}</div>
    <div class="metric"><strong>Слабые темы:</strong> ${state.weakTopics.join(", ") || "пока нет"}</div>
    <div class="metric"><strong>Последняя тема:</strong> ${state.lastTopic || "нет"}</div>
  `;
  renderStats();
}

function renderStats() {
  const state = getState();
  const accuracy = state.solved ? ((state.correct / state.solved) * 100).toFixed(1) : "0.0";
  document.getElementById("stats").innerHTML = `
    <div class="stat-list">
      <div class="metric"><strong>Всего задач:</strong> ${state.solved}</div>
      <div class="metric"><strong>Верных:</strong> ${state.correct}</div>
      <div class="metric"><strong>Точность:</strong> ${accuracy}%</div>
      <div class="metric"><strong>Режим:</strong> Flat GitHub Pages</div>
    </div>
  `;
}

function renderRules(topic) {
  const selected = topic || "equations";
  const rules = theoryBase[selected] || theoryBase.equations;
  document.getElementById("rules").innerHTML = rules
    .map((rule) => `<div class="rule-item">${rule}</div>`)
    .join("");
}

function renderPractice(task) {
  currentTask = task;
  renderRules(task.topic);
  document.getElementById("practice").innerHTML = `
    <div class="practice-badge">${labelTopic(task.topic)} · ${task.difficulty}</div>
    <div class="practice-question">${task.question}</div>
    <div class="practice-answer-hint">Реши задачу и введи только итоговый ответ.</div>
  `;
}

function labelTopic(topic) {
  const map = {
    arithmetic: "Арифметика",
    fractions: "Дроби",
    equations: "Уравнения",
    geometry: "Геометрия",
    functions: "Функции",
    trigonometry: "Тригонометрия"
  };
  return map[topic] || topic;
}

function generateTask(topic) {
  const tasks = {
    arithmetic: () => {
      const a = randomInt(24, 96);
      const b = randomInt(3, 12);
      return { topic: "arithmetic", difficulty: "easy", question: `Вычисли: ${a} * ${b} - ${b}`, answer: String(a * b - b) };
    },
    fractions: () => ({ topic: "fractions", difficulty: "medium", question: "Сложи дроби: 1/3 + 1/6", answer: "1/2" }),
    equations: () => {
      const a = randomInt(2, 9);
      const x = randomInt(2, 12);
      const b = randomInt(1, 9);
      return { topic: "equations", difficulty: "medium", question: `Реши уравнение: ${a}x + ${b} = ${a * x + b}`, answer: String(x) };
    },
    geometry: () => {
      const a = randomInt(3, 11);
      const b = randomInt(4, 12);
      return { topic: "geometry", difficulty: "medium", question: `Найди площадь прямоугольника со сторонами ${a} и ${b}`, answer: String(a * b) };
    },
    functions: () => ({ topic: "functions", difficulty: "hard", question: "Найди производную функции x^3 + 2x", answer: "3*x^2+2" }),
    trigonometry: () => ({ topic: "trigonometry", difficulty: "hard", question: "Найди значение sin30 + cos60", answer: "1" })
  };
  const state = getState();
  const selected = topic || state.lastTopic || "equations";
  return (tasks[selected] || tasks.equations)();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeAnswer(value) {
  return String(value).toLowerCase().replace(/\s+/g, "").replace(/,/g, ".");
}

function updateProgress(task, correct) {
  const state = getState();
  state.name = resolveUser().userName;
  state.userId = resolveUser().userId;
  state.grade = resolveUser().grade;
  state.lastTopic = task.topic;
  state.solved += 1;
  if (correct) {
    state.correct += 1;
    if (!state.strongTopics.includes(task.topic)) {
      state.strongTopics = [...state.strongTopics, task.topic].slice(-4);
    }
    state.weakTopics = state.weakTopics.filter((item) => item !== task.topic);
  } else {
    if (!state.weakTopics.includes(task.topic)) {
      state.weakTopics = [...state.weakTopics, task.topic].slice(-4);
    }
  }
  setState(state);
  renderProfile();
}

function checkAnswer() {
  if (!currentTask) {
    alert("Сначала открой новую задачу");
    return;
  }
  const userAnswer = document.getElementById("answerInput").value.trim();
  const correct = normalizeAnswer(userAnswer) === normalizeAnswer(currentTask.answer);
  updateProgress(currentTask, correct);
  document.getElementById("checkResult").innerHTML = `
    <div class="result-card ${correct ? "success" : "error"}">
      <strong>${correct ? "Верно" : "Пока нет"}</strong>
      <p>${correct ? "Отличная работа. Можно брать следующую задачу." : `Правильный ответ: ${currentTask.answer}`}</p>
    </div>
  `;
}

function loadProfile() {
  const { userId, userName, grade } = resolveUser();
  const state = getState();
  state.userId = userId;
  state.name = userName;
  state.grade = grade;
  setState(state);
  renderProfile();
}

function loadPractice() {
  const topic = document.getElementById("topic").value;
  const task = generateTask(topic);
  renderPractice(task);
}

document.getElementById("loadProfile").addEventListener("click", loadProfile);
document.getElementById("loadPractice").addEventListener("click", loadPractice);
document.getElementById("checkAnswer").addEventListener("click", checkAnswer);

window.addEventListener("DOMContentLoaded", () => {
  const tg = tgUser();
  const state = getState();
  if (tg) {
    state.userId = String(tg.id || "");
    state.name = tg.first_name || "Ученик";
    setState(state);
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }

  document.getElementById("userId").value = state.userId || "";
  document.getElementById("userName").value = state.name || "Ученик";
  document.getElementById("grade").value = state.grade || "";

  renderProfile();
  renderRules(state.lastTopic || "equations");
  loadPractice();
});

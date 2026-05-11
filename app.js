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
  percentages: [
    "Процент — это одна сотая часть числа.",
    "Чтобы найти p% от числа a, вычисли a * p / 100."
  ],
  proportions: [
    "В пропорции a/b = c/d выполняется правило ad = bc.",
    "После нахождения неизвестного проверь пропорцию подстановкой."
  ],
  equations: [
    "Сохраняй равенство: что делаешь слева, то же делай справа.",
    "После нахождения x проверь ответ подстановкой."
  ],
  algebra: [
    "Подобные слагаемые можно складывать и вычитать.",
    "Сначала раскрывай скобки, затем приводи подобные члены."
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

const theoryCards = {
  arithmetic: {
    title: "Арифметика",
    summary: "Базовая вычислительная мощность: порядок действий, точность счета, быстрая проверка.",
    points: ["Скобки -> умножение/деление -> сложение/вычитание", "Проверяй ответ обратным действием", "Разбивай длинные вычисления на шаги"]
  },
  fractions: {
    title: "Дроби",
    summary: "Дроби — это части целого. Главное: общий знаменатель, сокращение и сравнение.",
    points: ["Приводи к общему знаменателю", "После вычисления сокращай", "Дроби можно переводить в десятичные"]
  },
  percentages: {
    title: "Проценты",
    summary: "Процент — это одна сотая часть. Очень важная тема для задач из жизни.",
    points: ["p% = p/100", "Чтобы найти процент от числа: a*p/100", "Чтобы найти число по проценту: часть / процент"]
  },
  proportions: {
    title: "Пропорции",
    summary: "Пропорции помогают решать задачи на соотношения, масштаб, скорость, цену и массу.",
    points: ["Если a/b = c/d, то ad = bc", "Проверяй найденное значение подстановкой", "Следи за единицами измерения"]
  },
  equations: {
    title: "Уравнения",
    summary: "Линейные уравнения — основа школьной алгебры и логики преобразований.",
    points: ["Делай одинаковые действия с обеих сторон", "Не теряй знак при переносе", "Всегда делай проверку"]
  },
  algebra: {
    title: "Алгебра",
    summary: "Алгебра учит работать с буквенными выражениями, скобками и подобными членами.",
    points: ["Раскрывай скобки аккуратно", "Приводи подобные слагаемые", "Разделяй выражение на блоки"]
  },
  geometry: {
    title: "Геометрия",
    summary: "Геометрия требует не только формулы, но и понимание того, какую величину нужно найти.",
    points: ["Площадь и периметр — разные вещи", "Подписывай стороны и единицы", "Сначала пойми фигуру, потом формулу"]
  },
  functions: {
    title: "Функции",
    summary: "Функции описывают зависимость одной величины от другой и открывают путь к анализу.",
    points: ["Смотри на переменную x как на аргумент", "Производная — скорость изменения", "Разбивай функцию на слагаемые"]
  },
  trigonometry: {
    title: "Тригонометрия",
    summary: "Школьная тригонометрия держится на таблице стандартных углов и понимании единичной окружности.",
    points: ["sin45 = cos45 = sqrt(2)/2", "sin30 = 1/2, cos60 = 1/2", "Следи, угол в градусах или радианах"]
  }
};

const gradeTracks = {
  "5": ["Дроби", "Десятичные дроби", "Проценты"],
  "6": ["Пропорции", "Координаты", "Модуль числа"],
  "7": ["Уравнения", "Алгебраические выражения", "Геометрия"],
  "8": ["Квадратные уравнения", "Функции", "Корни"],
  "9": ["Системы уравнений", "Неравенства", "Вероятность"],
  "10": ["Тригонометрия", "Логарифмы", "Производная"],
  "11": ["Интегралы", "Пределы", "Комплексные числа"]
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
    alias: "Ученик",
    publicId: "LOCAL-ANON",
    grade: "",
    mode: "practice",
    solved: 0,
    correct: 0,
    xp: 0,
    streak: 0,
    level: 1,
    energy: 100,
    bossWins: 0,
    strongTopics: [],
    weakTopics: [],
    lastTopic: "equations",
    topicStats: {},
    activityLog: [],
    currentBoss: null
  };
}

function setState(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

async function sha256Hex(value) {
  const source = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest("SHA-256", source);
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

async function buildAnonymousIdentity() {
  const tg = tgUser();
  const state = getState();
  const baseId = tg ? String(tg.id || "") : (state.publicId || "local-anon-seed");
  const digest = await sha256Hex(baseId || "local-anon-seed");
  const publicId = `ANON-${digest.slice(0, 10).toUpperCase()}`;
  const telegramAlias = tg && tg.first_name ? `Ученик ${digest.slice(0, 4).toUpperCase()}` : "";
  const aliasInput = document.getElementById("userAlias");
  const alias = (aliasInput && aliasInput.value.trim()) || state.alias || telegramAlias || `Ученик ${digest.slice(0, 4).toUpperCase()}`;
  return {
    publicId,
    alias,
    grade: document.getElementById("grade").value || state.grade || "",
    mode: document.getElementById("mode").value || state.mode || "practice"
  };
}

function renderProfile() {
  const state = getState();
  const accuracy = state.solved ? ((state.correct / state.solved) * 100).toFixed(1) : "0.0";
  document.getElementById("profile").innerHTML = `
    <div class="profile-grid">
      <div class="metric-card"><span>Алиас</span><strong>${state.alias || "Ученик"}</strong></div>
      <div class="metric-card"><span>Класс</span><strong>${state.grade ? `${state.grade} класс` : "Авто"}</strong></div>
      <div class="metric-card"><span>Решено</span><strong>${state.solved}</strong></div>
      <div class="metric-card"><span>Точность</span><strong>${accuracy}%</strong></div>
    </div>
    <div class="metric"><strong>Сильные темы:</strong> ${state.strongTopics.join(", ") || "пока нет"}</div>
    <div class="metric"><strong>Слабые темы:</strong> ${state.weakTopics.join(", ") || "пока нет"}</div>
    <div class="metric"><strong>Последняя тема:</strong> ${state.lastTopic || "нет"}</div>
  `;
  renderStats();
  renderDailyMission();
}

function renderStats() {
  const state = getState();
  const accuracy = state.solved ? ((state.correct / state.solved) * 100).toFixed(1) : "0.0";
  document.getElementById("stats").innerHTML = `
    <div class="stat-list">
      <div class="metric"><strong>Всего задач:</strong> ${state.solved}</div>
      <div class="metric"><strong>Верных:</strong> ${state.correct}</div>
      <div class="metric"><strong>Точность:</strong> ${accuracy}%</div>
      <div class="metric"><strong>XP:</strong> ${state.xp}</div>
      <div class="metric"><strong>Серия:</strong> ${state.streak}</div>
      <div class="metric"><strong>Режим:</strong> ${labelMode(state.mode || "practice")}</div>
    </div>
  `;
  renderHeroDeck();
  renderAchievements();
  renderFocusWeek();
  renderSkillMatrix();
  renderActivityFeed();
}

function renderRules(topic) {
  const selected = topic || "equations";
  const rules = theoryBase[selected] || theoryBase.equations;
  document.getElementById("rules").innerHTML = rules
    .map((rule) => `<div class="rule-item">${rule}</div>`)
    .join("");
  renderTheoryCard(selected);
  const focus = document.getElementById("focusTopic");
  if (focus) {
    focus.innerHTML = `<strong>${labelTopic(selected)}</strong><p>Активная тема переключена. Теперь тренировка и блок правил работают в этом направлении.</p>`;
  }
  renderCoach(`Сейчас активна тема ${labelTopic(selected)}. Открой тренировку и начни с одной точной задачи, не гонись за скоростью.`);
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
    percentages: "Проценты",
    proportions: "Пропорции",
    equations: "Уравнения",
    algebra: "Алгебра",
    geometry: "Геометрия",
    functions: "Функции",
    trigonometry: "Тригонометрия"
  };
  return map[topic] || topic;
}

function labelMode(mode) {
  const map = { practice: "Практика", theory: "Теория", exam: "Экзамен" };
  return map[mode] || mode;
}

const taskBank = {
  arithmetic: [
    { difficulty: "easy", question: "Вычисли: 48 * 3 - 6", answer: "138" },
    { difficulty: "easy", question: "Вычисли: 125 + 37 - 49", answer: "113" },
    { difficulty: "easy", question: "Вычисли: 84 / 7 + 9", answer: "21" }
  ],
  fractions: [
    { difficulty: "medium", question: "Сложи дроби: 1/3 + 1/6", answer: "1/2" },
    { difficulty: "medium", question: "Вычти дроби: 5/6 - 1/3", answer: "1/2" },
    { difficulty: "medium", question: "Сравни дроби: что больше, 3/4 или 2/3? Ответ: 3/4 или 2/3", answer: "3/4" }
  ],
  percentages: [
    { difficulty: "medium", question: "Найди 25% от 80", answer: "20" },
    { difficulty: "medium", question: "Найди 10% от 350", answer: "35" },
    { difficulty: "medium", question: "Сколько процентов составляет 15 от 60?", answer: "25" }
  ],
  proportions: [
    { difficulty: "medium", question: "Реши пропорцию: 3/x = 9/12", answer: "4" },
    { difficulty: "medium", question: "Реши пропорцию: 5/8 = 15/x", answer: "24" },
    { difficulty: "medium", question: "Если 4 тетради стоят 120 рублей, сколько стоят 7 тетрадей?", answer: "210" }
  ],
  equations: [
    { difficulty: "medium", question: "Реши уравнение: 7x + 7 = 49", answer: "6" },
    { difficulty: "medium", question: "Реши уравнение: 2x - 5 = 11", answer: "8" },
    { difficulty: "medium", question: "Реши уравнение: 3x + 7 = 19", answer: "4" }
  ],
  algebra: [
    { difficulty: "medium", question: "Упрости выражение: 3a + 2a - a", answer: "4a" },
    { difficulty: "medium", question: "Раскрой скобки: 2(x + 3)", answer: "2x+6" },
    { difficulty: "medium", question: "Упрости: 4b - 2b + 7", answer: "2b+7" }
  ],
  geometry: [
    { difficulty: "medium", question: "Найди площадь прямоугольника со сторонами 6 и 9", answer: "54" },
    { difficulty: "medium", question: "Найди периметр прямоугольника со сторонами 4 и 7", answer: "22" },
    { difficulty: "medium", question: "Найди площадь треугольника: основание 10, высота 6", answer: "30" }
  ],
  functions: [
    { difficulty: "hard", question: "Найди производную функции x^3 + 2x", answer: "3*x^2+2" },
    { difficulty: "hard", question: "Найди производную функции x^2 + 5x", answer: "2*x+5" },
    { difficulty: "hard", question: "Найди производную функции 4x^3", answer: "12*x^2" }
  ],
  trigonometry: [
    { difficulty: "hard", question: "Найди значение sin30 + cos60", answer: "1" },
    { difficulty: "hard", question: "Найди значение cos45 + sin45", answer: "sqrt(2)" },
    { difficulty: "hard", question: "Найди значение tg45", answer: "1" }
  ]
};

function generateTask(topic) {
  const state = getState();
  let selected = topic || state.lastTopic || "equations";
  if (!topic && state.weakTopics.length) {
    selected = state.weakTopics[state.weakTopics.length - 1];
  }
  const mode = document.getElementById("mode").value || state.mode || "practice";
  if (mode === "theory") {
    return {
      topic: selected,
      difficulty: "theory",
      question: `Открой блок теории по теме "${labelTopic(selected)}" и выпиши 2 ключевых правила.`,
      answer: "изучено"
    };
  }
  const list = taskBank[selected] || taskBank.equations;
  const pool = mode === "exam" ? [...list].reverse() : list;
  return { topic: selected, ...pool[randomInt(0, pool.length - 1)] };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeAnswer(value) {
  return String(value).toLowerCase().replace(/\s+/g, "").replace(/,/g, ".");
}

function parseNumericExpression(value) {
  const source = normalizeAnswer(value)
    .replace(/sqrt/g, "Math.sqrt")
    .replace(/π|pi/g, String(Math.PI));

  if (!/^[0-9+\-*/().mathsqrtpi]+$/i.test(source)) {
    return null;
  }

  try {
    return Function(`return (${source})`)();
  } catch {
    return null;
  }
}

function answersEquivalent(userAnswer, expectedAnswer) {
  const normalizedUser = normalizeAnswer(userAnswer);
  const normalizedExpected = normalizeAnswer(expectedAnswer);
  if (normalizedUser === normalizedExpected) {
    return true;
  }

  const numericUser = parseNumericExpression(userAnswer);
  const numericExpected = parseNumericExpression(expectedAnswer);
  if (numericUser !== null && numericExpected !== null) {
    return Math.abs(numericUser - numericExpected) < 1e-9;
  }

  const compactUser = normalizeAnswer(userAnswer);
  const compactExpected = normalizeAnswer(expectedAnswer);
  if (
    (compactUser === "изучено" || compactUser === "готово" || compactUser === "теория") &&
    compactExpected === "изучено"
  ) {
    return true;
  }

  return false;
}

function ensureTopicStats(state, topic) {
  if (!state.topicStats[topic]) {
    state.topicStats[topic] = { solved: 0, correct: 0 };
  }
}

function pushActivity(state, title, text, tone = "neutral") {
  const stamp = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  state.activityLog = [
    { title, text, tone, stamp },
    ...(state.activityLog || [])
  ].slice(0, 12);
}

async function updateProgress(task, correct) {
  const state = getState();
  const identity = await buildAnonymousIdentity();
  state.alias = identity.alias;
  state.publicId = identity.publicId;
  state.grade = identity.grade;
  state.mode = identity.mode;
  state.lastTopic = task.topic;
  state.solved += 1;
  ensureTopicStats(state, task.topic);
  state.topicStats[task.topic].solved += 1;
  if (correct) {
    state.correct += 1;
    state.streak += 1;
    state.xp += 35 + Math.min(25, state.streak * 2);
    state.energy = Math.min(100, state.energy + 4);
    state.topicStats[task.topic].correct += 1;
    if (!state.strongTopics.includes(task.topic)) {
      state.strongTopics = [...state.strongTopics, task.topic].slice(-4);
    }
    state.weakTopics = state.weakTopics.filter((item) => item !== task.topic);
    pushActivity(state, "Точное попадание", `Тема ${labelTopic(task.topic)} закрыта верно. Серия: ${state.streak}.`, "success");
  } else {
    state.streak = 0;
    state.energy = Math.max(18, state.energy - 8);
    if (!state.weakTopics.includes(task.topic)) {
      state.weakTopics = [...state.weakTopics, task.topic].slice(-4);
    }
    pushActivity(state, "Сигнал ошибки", `В теме ${labelTopic(task.topic)} найдена просадка. Нужен повторный заход.`, "danger");
  }
  state.level = Math.max(1, Math.floor(state.xp / 120) + 1);
  setState(state);
  renderProfile();
}

async function checkAnswer() {
  if (!currentTask) {
    alert("Сначала открой новую задачу");
    return;
  }
  const userAnswer = document.getElementById("answerInput").value.trim();
  const correct = answersEquivalent(userAnswer, currentTask.answer);
  await updateProgress(currentTask, correct);
  document.getElementById("checkResult").innerHTML = `
    <div class="result-card ${correct ? "success" : "error"}">
      <strong>${correct ? "Верно" : "Пока нет"}</strong>
      <p>${correct ? "Отличная работа. Можно брать следующую задачу." : `Правильный ответ: ${currentTask.answer}`}</p>
    </div>
  `;
  renderCoach(
    correct
      ? `Сильный ход. Тема ${labelTopic(currentTask.topic)} зашла хорошо. Возьми еще одну задачу и закрепи серию.`
      : `Ошибка не критична. Вернись к правилу по теме ${labelTopic(currentTask.topic)} и реши еще один похожий пример.`
  );
}

async function loadProfile() {
  const { publicId, alias, grade, mode } = await buildAnonymousIdentity();
  const state = getState();
  state.publicId = publicId;
  state.alias = alias;
  state.grade = grade;
  state.mode = mode;
  setState(state);
  document.getElementById("publicId").value = "Скрыт";
  renderProfile();
  renderGradeOverview();
  renderHeroDeck();
  renderSkillMatrix();
  renderActivityFeed();
  renderCoach(`Профиль обновлен. Режим сейчас: ${labelMode(mode)}. Можно выбрать тему и собрать сильную тренировочную серию.`);
}

function loadPractice() {
  const topic = document.getElementById("topic").value;
  const task = generateTask(topic);
  renderPractice(task);
  const state = getState();
  pushActivity(state, "Новая миссия", `Собрана задача по теме ${labelTopic(task.topic)} в режиме ${labelMode(state.mode || "practice")}.`, "info");
  setState(state);
  renderActivityFeed();
  renderCoach(`Новая задача готова. Смотри на правило, решай спокойно и вводи только итоговый ответ.`);
}

function renderDailyMission() {
  const state = getState();
  const nextGoal = Math.max(3, Math.ceil((state.solved + 1) / 3) * 3);
  const left = Math.max(0, nextGoal - state.solved);
  document.getElementById("dailyMission").innerHTML = `
    <div class="mission-main">
      <strong>${state.solved >= nextGoal ? "Серия закрыта" : `До следующей вехи: ${left}`}</strong>
      <p>${state.solved} решено, ${state.correct} верно. Подними темп и добей следующую точку роста.</p>
    </div>
    <div class="mission-bar">
      <span style="width:${Math.min(100, (state.solved / nextGoal) * 100)}%"></span>
    </div>
  `;
}

function renderAchievements() {
  const state = getState();
  const accuracy = state.solved ? (state.correct / state.solved) * 100 : 0;
  const items = [
    { title: "Разогрев", active: state.solved >= 1, text: "Реши первую задачу" },
    { title: "Серия 3", active: state.solved >= 3, text: "Дойди до трех решенных задач" },
    { title: "Точность 80%", active: accuracy >= 80 && state.solved >= 3, text: "Держи высокую точность" },
    { title: "Анти-слабость", active: state.strongTopics.length >= 2, text: "Прокачай хотя бы две темы" },
    { title: "Boss Slayer", active: state.bossWins >= 1, text: "Победи хотя бы одного босса" }
  ];
  document.getElementById("achievements").innerHTML = items.map((item) => `
    <div class="achievement ${item.active ? "active" : ""}">
      <strong>${item.title}</strong>
      <p>${item.text}</p>
    </div>
  `).join("");
}

function renderFocusWeek() {
  const state = getState();
  const topic = state.weakTopics[state.weakTopics.length - 1] || state.lastTopic || "equations";
  document.getElementById("focusWeek").innerHTML = `
    <div class="focus-week-card">
      <strong>${labelTopic(topic)}</strong>
      <p>Это текущий лучший кандидат на фокус: здесь у тебя либо была ошибка, либо еще мало закрепления.</p>
      <button id="focusWeekButton" class="secondary">Взять тему в работу</button>
    </div>
  `;
  const button = document.getElementById("focusWeekButton");
  if (button) {
    button.addEventListener("click", () => {
      document.getElementById("topic").value = topic;
      loadPractice();
    });
  }
}

function bindTopicPills() {
  document.querySelectorAll("[data-topic-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      const topic = button.getAttribute("data-topic-pick");
      document.getElementById("topic").value = topic;
      renderRules(topic);
      loadPractice();
    });
  });
}

function renderTheoryCard(topic) {
  const card = theoryCards[topic] || theoryCards.equations;
  document.getElementById("theoryCard").innerHTML = `
    <div class="theory-head">
      <strong>${card.title}</strong>
      <p>${card.summary}</p>
    </div>
    <div class="theory-points">
      ${card.points.map((item) => `<div class="theory-point">${item}</div>`).join("")}
    </div>
  `;
}

function renderGradeOverview() {
  const state = getState();
  const list = gradeTracks[state.grade] || ["Арифметика", "Уравнения", "Геометрия"];
  document.getElementById("gradeOverview").innerHTML = `
    <div class="grade-box">
      <strong>${state.grade ? `${state.grade} класс` : "Авто-режим"}</strong>
      <p>${state.grade ? "Рекомендуемый набор тем для текущего уровня." : "Выбери класс, и приложение покажет фокусные направления."}</p>
      <div class="grade-tags">
        ${list.map((item) => `<span>${item}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderCoach(message) {
  const state = getState();
  const target = document.getElementById("coach");
  if (!target) {
    return;
  }
  target.innerHTML = `
    <div class="coach-head">
      <div class="coach-avatar">S</div>
      <div>
        <strong>S.A.R.G.I.S Coach</strong>
        <p>Локальный интеллект-слой mini app с режимом приватности</p>
      </div>
    </div>
    <div class="coach-message">${message}</div>
    <div class="coach-tags">
      <span>${state.lastTopic ? labelTopic(state.lastTopic) : "База"}</span>
      <span>${state.grade ? `${state.grade} класс` : "Авто-уровень"}</span>
      <span>${state.solved} solved</span>
    </div>
  `;
}

function renderHeroDeck() {
  const state = getState();
  const xp = state.xp || 0;
  const level = state.level || 1;
  const streak = state.streak || 0;
  const energy = state.energy || 100;
  document.getElementById("heroLevel").textContent = String(level).padStart(2, "0");
  document.getElementById("heroXp").textContent = xp;
  document.getElementById("heroStreak").textContent = streak;
  document.getElementById("heroEnergy").textContent = `${energy}%`;
}

function renderSkillMatrix() {
  const state = getState();
  const stats = state.topicStats || {};
  const topics = Object.keys(taskBank);
  document.getElementById("skillMatrix").innerHTML = topics.map((topic) => {
    const solved = stats[topic]?.solved || 0;
    const correct = stats[topic]?.correct || 0;
    const score = solved ? Math.round((correct / solved) * 100) : 0;
    return `
      <div class="skill-row">
        <div class="skill-row-head">
          <strong>${labelTopic(topic)}</strong>
          <span>${score}%</span>
        </div>
        <div class="skill-bar"><span style="width:${Math.min(100, score)}%"></span></div>
        <p>${solved ? `Решено ${solved}, верно ${correct}` : "Пока нет телеметрии по теме"}</p>
      </div>
    `;
  }).join("");
}

function renderActivityFeed() {
  const state = getState();
  const list = state.activityLog || [];
  document.getElementById("activityFeed").innerHTML = list.length
    ? list.map((item) => `
      <div class="feed-item ${item.tone || "neutral"}">
        <div class="feed-topline">
          <strong>${item.title}</strong>
          <span>${item.stamp}</span>
        </div>
        <p>${item.text}</p>
      </div>
    `).join("")
    : `<div class="feed-empty">Лента пока пуста. Сделай действие в app, и здесь появится живая телеметрия.</div>`;
}

function detectSignalProfile(rawText) {
  const text = String(rawText || "").trim();
  const normalized = text.toLowerCase();
  if (!text) {
    return null;
  }

  if (/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/.test(normalized) || /координат|широта|долгота|местополож/.test(normalized)) {
    return {
      domain: "world",
      topic: "world",
      difficulty: "signal",
      label: "Geo / Coordinates",
      traps: ["Нужен общий режим, а не математика", "Важно распознать координаты как локацию"],
      action: "Передать запрос в общий geo-режим и ответить по месту.",
      teacherNote: "Это внешний мир, не учебная математика."
    };
  }

  if (/столица|страна|город|где находится|местоположение|океан|континент|река/.test(normalized)) {
    return {
      domain: "world",
      topic: "world",
      difficulty: "clear",
      label: "World Knowledge",
      traps: ["Не пытаться решать как уравнение", "Нужен короткий фактический ответ"],
      action: "Ответить прямо по факту, без шаблонов.",
      teacherNote: "Боту нужно четко отделять общий мир от математики."
    };
  }

  if (/(sin|cos|tan|tg|ctg|cot|син|кос|тан|тг|ктг|кот)\s*\(?-?\d+/.test(normalized.replace(/\s+/g, ""))) {
    return {
      domain: "math",
      topic: "trigonometry",
      difficulty: "hard",
      label: "Trig Signal",
      traps: ["Стандартные углы", "Градусы против радиан", "Точность значения"],
      action: "Дать точное значение и при необходимости приближение.",
      teacherNote: "Сильный запрос на школьную тригонометрию."
    };
  }

  if (/x|уравнен|реши|корень|дроб|процент|площад|периметр|функц|производн|интеграл/.test(normalized)) {
    const topic = /дроб/.test(normalized)
      ? "fractions"
      : /процент/.test(normalized)
        ? "percentages"
        : /площад|периметр/.test(normalized)
          ? "geometry"
          : /производн|интеграл|функц/.test(normalized)
            ? "functions"
            : "equations";
    return {
      domain: "math",
      topic,
      difficulty: /производн|интеграл/.test(normalized) ? "hard" : "medium",
      label: "Math Core",
      traps: ["Потеря знака", "Пропуск шага", "Слишком быстрый ответ без проверки"],
      action: "Собрать точную тренировку по активной теме.",
      teacherNote: "Это нормальный учебный сигнал. Можно превращать в миссию."
    };
  }

  return {
    domain: "general",
    topic: "general",
    difficulty: "light",
    label: "Open Signal",
    traps: ["Запрос может быть вне математики", "Нужно понять намерение"],
    action: "Ответить коротко или уточнить цель запроса.",
    teacherNote: "Нейтральный бытовой или общий сигнал."
  };
}

function analyzeSignal() {
  const text = document.getElementById("signalInput").value.trim();
  const state = getState();
  const profile = detectSignalProfile(text);
  if (!profile) {
    document.getElementById("signalFingerprint").innerHTML = "Вставь сигнал: задачу, текст, координаты или запрос.";
    document.getElementById("signalAdvice").innerHTML = "";
    return;
  }

  document.getElementById("signalFingerprint").innerHTML = `
    <div class="fingerprint-card ${profile.domain}">
      <span>${profile.label}</span>
      <strong>${profile.domain === "math" ? labelTopic(profile.topic) : profile.label}</strong>
      <p>Сложность: ${profile.difficulty}. Домен: ${profile.domain}.</p>
    </div>
  `;

  document.getElementById("signalAdvice").innerHTML = `
    <div class="signal-card">
      <strong>Ловушки</strong>
      ${profile.traps.map((item) => `<p>- ${item}</p>`).join("")}
    </div>
    <div class="signal-card">
      <strong>Следующий ход</strong>
      <p>${profile.action}</p>
      <p>${profile.teacherNote}</p>
    </div>
  `;

  pushActivity(state, "Сигнал просканирован", `${profile.label}: app разобрал входящий запрос и построил следующий ход.`, "info");
  setState(state);
  renderActivityFeed();
  renderCoach(`Signal Forge активирован. Я вижу домен ${profile.domain} и рекомендую следующий шаг: ${profile.action}`);
}

function forgeMissionFromSignal() {
  const text = document.getElementById("signalInput").value.trim();
  const profile = detectSignalProfile(text);
  if (!profile) {
    return;
  }
  if (profile.domain === "math" && taskBank[profile.topic]) {
    document.getElementById("topic").value = profile.topic;
    loadPractice();
    renderCoach(`Из сигнала собрана миссия по теме ${labelTopic(profile.topic)}. Это уже не просто UI, а реальный mission-forge режим.`);
    return;
  }
  renderCoach(`Сигнал относится к домену ${profile.label}. Для такого запроса нужен общий режим бота, а не математическая тренировка.`);
}

const bossBank = {
  equations: [
    { question: "Фаза 1. Реши: 4x + 9 = 29", answer: "5" },
    { question: "Фаза 2. Реши: 7x - 14 = 28", answer: "6" },
    { question: "Фаза 3. Реши: 3x + 11 = 32", answer: "7" }
  ],
  fractions: [
    { question: "Фаза 1. Вычисли: 1/2 + 1/4", answer: "3/4" },
    { question: "Фаза 2. Вычисли: 5/6 - 1/3", answer: "1/2" },
    { question: "Фаза 3. Вычисли: 2/3 + 1/6", answer: "5/6" }
  ],
  trigonometry: [
    { question: "Фаза 1. Найди: sin30 + cos60", answer: "1" },
    { question: "Фаза 2. Найди: tg45", answer: "1" },
    { question: "Фаза 3. Найди: cos45 + sin45", answer: "sqrt(2)" }
  ]
};

let bossTimerId = null;

function renderBossArena() {
  const state = getState();
  const boss = state.currentBoss;
  if (!boss) {
    document.getElementById("bossArena").innerHTML = `
      <div class="boss-idle">
        <strong>Босс не активен</strong>
        <p>Запусти рейд, и mini app соберет фазовый челлендж с таймером, HP и наградой.</p>
      </div>
    `;
    return;
  }
  document.getElementById("bossArena").innerHTML = `
    <div class="boss-header">
      <div>
        <span class="boss-tag">Boss Raid</span>
        <strong>${boss.name}</strong>
      </div>
      <div class="boss-timer">${boss.timeLeft}s</div>
    </div>
    <div class="boss-hp">
      <span style="width:${boss.hp}%"></span>
    </div>
    <div class="boss-phase">${boss.phases[boss.phaseIndex].question}</div>
    <input id="bossAnswer" class="boss-answer" type="text" placeholder="Твой удар по боссу">
  `;
}

function startBossFight() {
  const state = getState();
  const selected = document.getElementById("topic").value || state.lastTopic || "equations";
  const topic = bossBank[selected] ? selected : "equations";
  state.currentBoss = {
    name: `${labelTopic(topic)} Overlord`,
    topic,
    hp: 100,
    phaseIndex: 0,
    phases: bossBank[topic],
    timeLeft: 120
  };
  pushActivity(state, "Boss Raid запущен", `В бой вошел ${state.currentBoss.name}.`, "warning");
  setState(state);
  renderBossArena();
  renderActivityFeed();
  renderCoach(`Boss Raid активирован. Сейчас нужен фокус и точность. Ошибки здесь ощущаются сильнее.`);

  if (bossTimerId) {
    clearInterval(bossTimerId);
  }
  bossTimerId = setInterval(() => {
    const liveState = getState();
    if (!liveState.currentBoss) {
      clearInterval(bossTimerId);
      bossTimerId = null;
      return;
    }
    liveState.currentBoss.timeLeft -= 1;
    if (liveState.currentBoss.timeLeft <= 0) {
      pushActivity(liveState, "Boss Raid сорван", `${liveState.currentBoss.name} пережил таймер.`, "danger");
      liveState.currentBoss = null;
      setState(liveState);
      renderBossArena();
      renderActivityFeed();
      renderCoach("Таймер вышел. Перезапусти рейд и попробуй пройти его быстрее.");
      clearInterval(bossTimerId);
      bossTimerId = null;
      return;
    }
    setState(liveState);
    renderBossArena();
  }, 1000);
}

function hitBoss() {
  const state = getState();
  const boss = state.currentBoss;
  if (!boss) {
    renderCoach("Сначала запусти Boss Raid.");
    return;
  }
  const answerInput = document.getElementById("bossAnswer");
  const answer = answerInput ? answerInput.value.trim() : "";
  const phase = boss.phases[boss.phaseIndex];
  const correct = answersEquivalent(answer, phase.answer);
  if (!correct) {
    state.streak = 0;
    state.energy = Math.max(10, state.energy - 10);
    pushActivity(state, "Босс выдержал удар", `Фаза ${boss.phaseIndex + 1} не пройдена. Нужно точнее.`, "danger");
    setState(state);
    renderBossArena();
    renderActivityFeed();
    renderHeroDeck();
    renderCoach("Удар не прошел. Вернись к правилам и попробуй еще раз.");
    return;
  }

  boss.phaseIndex += 1;
  boss.hp = Math.max(0, boss.hp - 34);
  state.xp += 55;
  state.streak += 1;
  state.energy = Math.min(100, state.energy + 6);

  if (boss.phaseIndex >= boss.phases.length) {
    state.bossWins += 1;
    state.currentBoss = null;
    pushActivity(state, "Босс уничтожен", `${boss.name} повержен. Получено +55 XP и трофей в психику.`, "success");
    if (bossTimerId) {
      clearInterval(bossTimerId);
      bossTimerId = null;
    }
    setState(state);
    renderBossArena();
    renderActivityFeed();
    renderHeroDeck();
    renderCoach("Boss Raid закрыт. Это уже режим не просто учебы, а реального pressure-performance.");
    return;
  }

  state.currentBoss = boss;
  pushActivity(state, "Фаза пробита", `Фаза ${boss.phaseIndex} пройдена. Босс теряет стабильность.`, "warning");
  setState(state);
  renderBossArena();
  renderActivityFeed();
  renderHeroDeck();
  renderCoach(`Хорошо. Осталось фаз: ${boss.phases.length - boss.phaseIndex}. Дожимай босса.`);
}

document.getElementById("loadProfile").addEventListener("click", loadProfile);
document.getElementById("loadPractice").addEventListener("click", loadPractice);
document.getElementById("checkAnswer").addEventListener("click", checkAnswer);
document.getElementById("scanSignal").addEventListener("click", analyzeSignal);
document.getElementById("forgeMission").addEventListener("click", forgeMissionFromSignal);
document.getElementById("startBoss").addEventListener("click", startBossFight);
document.getElementById("hitBoss").addEventListener("click", hitBoss);

window.addEventListener("DOMContentLoaded", () => {
  (async () => {
    const tg = tgUser();
    const state = getState();
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }

    const identity = await buildAnonymousIdentity();
    state.publicId = identity.publicId;
    if (!state.publicId || !state.alias || state.alias === "Ученик") {
      state.alias = identity.alias;
    }
    setState(state);

    document.getElementById("publicId").value = "Скрыт";
    document.getElementById("userAlias").value = state.alias || identity.alias || "Ученик";
    document.getElementById("grade").value = state.grade || "";
    document.getElementById("mode").value = state.mode || "practice";

    renderProfile();
    renderGradeOverview();
    renderRules(state.lastTopic || "equations");
    loadPractice();
    bindTopicPills();
    renderHeroDeck();
    renderSkillMatrix();
    renderActivityFeed();
    renderBossArena();
    renderCoach(
      tg
        ? "Telegram-режим активен. Реальный ID скрыт, приложение работает через анонимный публичный ключ."
        : "Система готова. Выбери тему или запускай тренировку. Приватный режим уже включен."
    );

    ["topic", "grade", "userAlias", "mode"].forEach((id) => {
      document.getElementById(id).addEventListener("change", loadProfile);
    });
  })();
});

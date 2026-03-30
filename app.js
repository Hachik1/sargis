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
    strongTopics: [],
    weakTopics: [],
    lastTopic: "equations"
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
      <div class="metric"><strong>Режим:</strong> ${labelMode(state.mode || "practice")}</div>
    </div>
  `;
  renderAchievements();
  renderFocusWeek();
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
  const mode = resolveUser().mode || state.mode || "practice";
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

async function updateProgress(task, correct) {
  const state = getState();
  const identity = await buildAnonymousIdentity();
  state.alias = identity.alias;
  state.publicId = identity.publicId;
  state.grade = identity.grade;
  state.mode = identity.mode;
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
  renderCoach(`Профиль обновлен. Режим сейчас: ${labelMode(mode)}. Можно выбрать тему и собрать сильную тренировочную серию.`);
}

function loadPractice() {
  const topic = document.getElementById("topic").value;
  const task = generateTask(topic);
  renderPractice(task);
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
    { title: "Анти-слабость", active: state.strongTopics.length >= 2, text: "Прокачай хотя бы две темы" }
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

document.getElementById("loadProfile").addEventListener("click", loadProfile);
document.getElementById("loadPractice").addEventListener("click", loadPractice);
document.getElementById("checkAnswer").addEventListener("click", checkAnswer);

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

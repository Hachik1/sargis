import html
import json
import os
import random
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

try:
    import sympy as sp
except ImportError:  # pragma: no cover
    sp = None


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


@dataclass
class Config:
    telegram_token: str = os.getenv("TELEGRAM_TOKEN", "8666107537:AAFcjwAuzVI00qWHzoB6K8MzaW_WC9kBDZ0")
    ollama_url: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "gemma3:4b")
    database_path: str = os.getenv(
        "DATABASE_PATH",
        str(Path(os.getenv("LOCALAPPDATA", str(Path.home()))) / "SargisAI" / "sargis.db"),
    )
    request_timeout: int = int(os.getenv("REQUEST_TIMEOUT", "60"))
    history_limit: int = int(os.getenv("HISTORY_LIMIT", "10"))
    webapp_url: str = os.getenv("SARGIS_WEBAPP_URL", "")


@dataclass
class StudentProfile:
    user_id: int
    name: str
    grade_hint: str
    weak_topics: str
    strong_topics: str
    last_topic: str
    preferred_style: str
    goals: str

    def weak_list(self) -> List[str]:
        return json.loads(self.weak_topics or "[]")

    def strong_list(self) -> List[str]:
        return json.loads(self.strong_topics or "[]")


class Storage:
    def __init__(self, path: str):
        self.path = path
        self.conn = self._open_connection(path)
        self.conn.row_factory = sqlite3.Row
        self._create_tables()

    def _open_connection(self, path: str):
        try:
            db_path = Path(path)
            db_path.parent.mkdir(parents=True, exist_ok=True)
            return sqlite3.connect(str(db_path), check_same_thread=False)
        except Exception:
            return sqlite3.connect(":memory:", check_same_thread=False)

    def _create_tables(self) -> None:
        cursor = self.conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS student_profiles (
                user_id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                grade_hint TEXT DEFAULT '',
                weak_topics TEXT DEFAULT '[]',
                strong_topics TEXT DEFAULT '[]',
                last_topic TEXT DEFAULT '',
                preferred_style TEXT DEFAULT 'balanced',
                goals TEXT DEFAULT '',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                topic TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS solved_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                topic TEXT NOT NULL,
                difficulty TEXT NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                solved_correctly INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        self.conn.commit()

    def get_profile(self, user_id: int, default_name: str) -> StudentProfile:
        cursor = self.conn.cursor()
        row = cursor.execute(
            """
            SELECT user_id, name, grade_hint, weak_topics, strong_topics, last_topic, preferred_style, goals
            FROM student_profiles
            WHERE user_id = ?
            """,
            (user_id,),
        ).fetchone()
        if row:
            return StudentProfile(**dict(row))

        profile = StudentProfile(
            user_id=user_id,
            name=default_name,
            grade_hint="",
            weak_topics="[]",
            strong_topics="[]",
            last_topic="",
            preferred_style="balanced",
            goals="",
        )
        self.save_profile(profile)
        return profile

    def save_profile(self, profile: StudentProfile) -> None:
        cursor = self.conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO student_profiles
                (user_id, name, grade_hint, weak_topics, strong_topics, last_topic, preferred_style, goals, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    name = excluded.name,
                    grade_hint = excluded.grade_hint,
                    weak_topics = excluded.weak_topics,
                    strong_topics = excluded.strong_topics,
                    last_topic = excluded.last_topic,
                    preferred_style = excluded.preferred_style,
                    goals = excluded.goals,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    profile.user_id,
                    profile.name,
                    profile.grade_hint,
                    profile.weak_topics,
                    profile.strong_topics,
                    profile.last_topic,
                    profile.preferred_style,
                    profile.goals,
                ),
            )
            self.conn.commit()
        except sqlite3.Error:
            pass

    def add_message(self, user_id: int, role: str, content: str, topic: str = "") -> None:
        cursor = self.conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO conversations (user_id, role, content, topic)
                VALUES (?, ?, ?, ?)
                """,
                (user_id, role, content, topic),
            )
            self.conn.commit()
        except sqlite3.Error:
            pass

    def get_recent_history(self, user_id: int, limit: int) -> List[Tuple[str, str]]:
        cursor = self.conn.cursor()
        rows = cursor.execute(
            """
            SELECT role, content
            FROM conversations
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
        return [(row["role"], row["content"]) for row in reversed(rows)]

    def save_task_result(
        self,
        user_id: int,
        topic: str,
        difficulty: str,
        question: str,
        answer: str,
        solved_correctly: bool,
    ) -> None:
        cursor = self.conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO solved_tasks (user_id, topic, difficulty, question, answer, solved_correctly)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user_id, topic, difficulty, question, answer, int(solved_correctly)),
            )
            self.conn.commit()
        except sqlite3.Error:
            pass

    def get_user_stats(self, user_id: int) -> Dict[str, object]:
        cursor = self.conn.cursor()
        totals = cursor.execute(
            """
            SELECT
                COUNT(*) AS total,
                COALESCE(SUM(solved_correctly), 0) AS correct
            FROM solved_tasks
            WHERE user_id = ?
            """,
            (user_id,),
        ).fetchone()
        topics = cursor.execute(
            """
            SELECT topic, COUNT(*) AS attempts, COALESCE(SUM(solved_correctly), 0) AS correct
            FROM solved_tasks
            WHERE user_id = ?
            GROUP BY topic
            ORDER BY attempts DESC
            LIMIT 5
            """,
            (user_id,),
        ).fetchall()
        return {
            "total_tasks": totals["total"],
            "correct_tasks": totals["correct"],
            "accuracy": round((totals["correct"] / totals["total"]) * 100, 1) if totals["total"] else 0.0,
            "top_topics": [dict(row) for row in topics],
        }


class StudentProfiler:
    TOPIC_KEYWORDS: Dict[str, List[str]] = {
        "meta_identity": ["кто ты", "ты кто", "ты оллама", "ты llama", "ты llm", "ты бот", "ты нейросеть"],
        "meta_capabilities": ["что умеешь", "что ты умеешь", "что можешь", "твои возможности", "что ты можешь"],
        "meta_greeting": ["привет", "здравствуй", "добрый день", "салам", "хай", "hello", "hi"],
        "arithmetic": ["посчитай", "сколько будет", "+", "-", "*", "/", "умнож", "делен", "вычисли"],
        "fractions": ["дроб", "знаменатель", "числитель"],
        "equations": ["уравнен", "реши x", "найди x", "= 0", "корень"],
        "geometry": ["треуголь", "квадрат", "площад", "периметр", "радиус", "окружн"],
        "functions": ["производн", "интеграл", "логарифм", "предел", "функц", "график"],
    }

    def detect_topic(self, text: str) -> str:
        normalized = normalize_text(text)
        compact = normalized.replace(" ", "")
        if "=" in compact and "x" in compact:
            return "equations"
        if any(marker in normalized for marker in ["производн", "интеграл", "логарифм", "предел", "функц", "график", "sin", "cos", "tg", "tan", "ctg", "cot", "син", "кос", "тг", "тан", "ктг", "кот"]):
            return "functions"
        if any(marker in normalized for marker in ["дроб", "знаменатель", "числитель"]):
            return "fractions"
        if any(marker in normalized for marker in ["треуголь", "квадрат", "площад", "периметр", "радиус", "окружн"]):
            return "geometry"
        for topic, keywords in self.TOPIC_KEYWORDS.items():
            if any(keyword in normalized for keyword in keywords):
                return topic
        return "general_math"

    def update_profile(self, profile: StudentProfile, user_text: str, topic: str) -> StudentProfile:
        normalized = normalize_text(user_text)
        weak = set(profile.weak_list())
        strong = set(profile.strong_list())

        if any(marker in normalized for marker in ["не понимаю", "сложно", "запутался", "ошибка", "не получается"]):
            weak.add(topic)
            strong.discard(topic)

        if any(marker in normalized for marker in ["понял", "разобрался", "ясно", "получилось"]):
            strong.add(topic)
            weak.discard(topic)

        grade_match = re.search(r"\b(1[01]|[1-9])\b\s*класс", normalized)
        if grade_match:
            profile.grade_hint = grade_match.group(1)

        if "пошагово" in normalized:
            profile.preferred_style = "step_by_step"
        elif "кратко" in normalized:
            profile.preferred_style = "brief"
        elif "подробно" in normalized:
            profile.preferred_style = "detailed"

        goal_match = re.search(r"хочу (.+)", normalized)
        if goal_match and len(goal_match.group(1)) < 120:
            profile.goals = goal_match.group(1)

        profile.weak_topics = json.dumps(sorted(weak), ensure_ascii=False)
        profile.strong_topics = json.dumps(sorted(strong), ensure_ascii=False)
        profile.last_topic = topic
        return profile


class MathKnowledgeBase:
    def __init__(self):
        self.rules = {
            "arithmetic": [
                "Сначала выполняются действия в скобках.",
                "Потом умножение и деление, затем сложение и вычитание.",
                "Проверяй вычисление обратным действием, если это возможно.",
            ],
            "fractions": [
                "При сложении дробей с разными знаменателями сначала найди общий знаменатель.",
                "После вычисления проверь, можно ли сократить дробь.",
                "Чтобы сравнить дроби, удобно привести их к общему знаменателю.",
            ],
            "equations": [
                "Сохраняй равенство: что делаешь слева, то же делай справа.",
                "Переноси известные числа в одну сторону, неизвестные в другую.",
                "После нахождения x подставь ответ обратно в исходное уравнение.",
            ],
            "geometry": [
                "Площадь прямоугольника: S = a * b.",
                "Площадь треугольника: S = a * h / 2.",
                "Длина окружности: C = 2 * pi * r.",
            ],
            "functions": [
                "Производная x^n равна n * x^(n-1).",
                "Интеграл x^n равен x^(n+1)/(n+1) + C при n != -1.",
                "Для школьной тригонометрии важно понимать, в каких единицах задан угол: в градусах или радианах.",
                "Стандартные значения нужно знать наизусть: sin 30 = 1/2, cos 60 = 1/2, sin 45 = cos 45 = sqrt(2)/2.",
            ],
            "general_math": [
                "Решай от известного к неизвестному.",
                "Проверяй вычисления обратным действием.",
            ],
        }
        self.theory = {
            "fractions": {
                "summary": "Дробь показывает часть целого: числитель показывает сколько частей взяли, знаменатель — на сколько частей разделили целое.",
                "formulas": ["a/b + c/b = (a+c)/b", "a/b = (a*k)/(b*k), если k != 0"],
                "example": "1/3 + 1/6 = 2/6 + 1/6 = 3/6 = 1/2",
            },
            "equations": {
                "summary": "Линейное уравнение — это равенство, где неизвестная находится в первой степени.",
                "formulas": ["ax + b = c", "x = (c - b) / a, если a != 0"],
                "example": "2x + 5 = 13 -> 2x = 8 -> x = 4",
            },
            "geometry": {
                "summary": "В геометрии важно понять, что именно нужно найти: площадь, периметр, длину или угол.",
                "formulas": ["S прямоугольника = a*b", "P прямоугольника = 2(a+b)", "S треугольника = a*h/2"],
                "example": "Если a=4 и b=7, то площадь прямоугольника равна 28.",
            },
            "functions": {
                "summary": "Производная показывает скорость изменения функции, а интеграл помогает восстановить накопление величины.",
                "formulas": ["(x^n)' = n*x^(n-1)", "∫x^n dx = x^(n+1)/(n+1) + C"],
                "example": "(x^3 + 2x)' = 3x^2 + 2",
            },
        }

    def get_rules(self, topic: str) -> List[str]:
        return self.rules.get(topic, self.rules["general_math"])

    def get_theory(self, topic: str) -> Optional[Dict[str, object]]:
        return self.theory.get(topic)


class PracticeGenerator:
    def generate(self, topic: str, grade_hint: str = "") -> Dict[str, str]:
        generators = {
            "arithmetic": self._arithmetic_task,
            "fractions": self._fractions_task,
            "equations": self._equation_task,
            "geometry": self._geometry_task,
            "functions": self._function_task,
        }
        payload = generators.get(topic, self._mixed_task)()
        payload["grade_hint"] = grade_hint or "adaptive"
        return payload

    def _arithmetic_task(self) -> Dict[str, str]:
        a = random.randint(12, 95)
        b = random.randint(3, 25)
        question = f"Вычисли: {a} * {b} - {b}"
        answer = str(a * b - b)
        return {"topic": "arithmetic", "difficulty": "easy", "question": question, "answer": answer}

    def _fractions_task(self) -> Dict[str, str]:
        question = "Сложи дроби: 1/3 + 1/6"
        answer = "1/2"
        return {"topic": "fractions", "difficulty": "medium", "question": question, "answer": answer}

    def _equation_task(self) -> Dict[str, str]:
        a = random.randint(2, 9)
        x_val = random.randint(2, 12)
        b = random.randint(1, 10)
        c = a * x_val + b
        question = f"Реши уравнение: {a}x + {b} = {c}"
        answer = str(x_val)
        return {"topic": "equations", "difficulty": "medium", "question": question, "answer": answer}

    def _geometry_task(self) -> Dict[str, str]:
        a = random.randint(3, 12)
        b = random.randint(3, 12)
        question = f"Найди площадь прямоугольника со сторонами {a} и {b}"
        answer = str(a * b)
        return {"topic": "geometry", "difficulty": "medium", "question": question, "answer": answer}

    def _function_task(self) -> Dict[str, str]:
        question = "Найди производную функции x^3 + 2x"
        answer = "3*x^2 + 2"
        return {"topic": "functions", "difficulty": "hard", "question": question, "answer": answer}

    def _mixed_task(self) -> Dict[str, str]:
        return random.choice(
            [
                self._arithmetic_task(),
                self._fractions_task(),
                self._equation_task(),
                self._geometry_task(),
            ]
        )


class DeterministicMathEngine:
    def solve(self, text: str) -> Optional[str]:
        equation = self._solve_linear_equation(text)
        if equation:
            return equation

        trigonometry = self._solve_trigonometry(text)
        if trigonometry:
            return trigonometry

        arithmetic = self._solve_arithmetic(text)
        if arithmetic:
            return arithmetic

        symbolic = self._solve_symbolic(text)
        if symbolic:
            return symbolic
        return None

    def _solve_linear_equation(self, text: str) -> Optional[str]:
        if sp is None:
            return None

        normalized = text.lower().replace(" ", "").replace("−", "-").replace("×", "*").replace("÷", "/")
        normalized = normalized.replace("^", "**")
        normalized = re.sub(r"(\d)(x)", r"\1*\2", normalized)
        if "=" not in normalized or "x" not in normalized:
            return None

        match = re.search(r"([-+*/().0-9x*]+)=([-+*/().0-9x*]+)", normalized)
        if not match:
            return None

        x = sp.symbols("x")
        try:
            left = sp.sympify(match.group(1))
            right = sp.sympify(match.group(2))
            solutions = sp.solve(sp.Eq(left, right), x)
        except Exception:
            return None

        if not solutions:
            return "Не удалось найти корни. Проверь, корректно ли записано уравнение."

        return "\n".join(
            [
                f"Уравнение: {sp.sstr(left)} = {sp.sstr(right)}",
                f"Ответ: x = {sp.sstr(solutions[0])}",
            ]
        )

    def _solve_arithmetic(self, text: str) -> Optional[str]:
        expression = (
            text.lower()
            .replace("сколько будет", "")
            .replace("посчитай", "")
            .replace("вычисли", "")
            .replace("реши", "")
            .replace("=", "")
            .replace("×", "*")
            .replace("÷", "/")
            .replace("−", "-")
            .replace(",", ".")
            .strip()
        )
        if not expression or not re.fullmatch(r"[0-9\s\+\-\*\/\(\)\.]+", expression):
            return None

        try:
            value = eval(expression, {"__builtins__": {}}, {})
        except Exception:
            return None
        return f"Вычисление: {expression}\nОтвет: {value}"

    def _solve_symbolic(self, text: str) -> Optional[str]:
        if sp is None:
            return None

        normalized = text.lower().replace("^", "**").replace("×", "*").replace("−", "-")
        x = sp.symbols("x")
        try:
            if "производн" in normalized:
                expr_text = normalized.split(":", 1)[1].strip() if ":" in normalized else normalized.split("производн", 1)[1].strip()
                expr = sp.sympify(expr_text.replace("от", "", 1).strip())
                return f"Функция: {sp.sstr(expr)}\nПроизводная: {sp.sstr(sp.diff(expr, x))}"
            if "интеграл" in normalized:
                expr_text = normalized.split(":", 1)[1].strip() if ":" in normalized else normalized.split("интеграл", 1)[1].strip()
                expr = sp.sympify(expr_text.replace("от", "", 1).strip())
                return f"Интеграл: {sp.sstr(sp.integrate(expr, x))} + C"
        except Exception:
            return None
        return None

    def _solve_trigonometry(self, text: str) -> Optional[str]:
        if sp is None:
            return None

        normalized = normalize_text(text)
        if not any(token in normalized for token in ["sin", "cos", "tan", "tg", "cot", "ctg", "син", "кос", "тан", "тг", "кот", "ктг"]):
            return None

        expr = normalized.replace(" ", "")
        replacements = {
            "син": "sin",
            "sin": "sin",
            "кос": "cos",
            "cos": "cos",
            "тан": "tan",
            "tg": "tan",
            "тг": "tan",
            "tan": "tan",
            "ctg": "cot",
            "ктг": "cot",
            "кот": "cot",
            "cot": "cot",
            "√": "sqrt",
        }
        for source, target in replacements.items():
            expr = expr.replace(source, target)

        expr = expr.replace("°", "")
        expr = self._inject_degree_arguments(expr)
        if not expr:
            return None

        try:
            local_dict = {
                "sin": lambda x: sp.sin(sp.pi * x / 180),
                "cos": lambda x: sp.cos(sp.pi * x / 180),
                "tan": lambda x: sp.tan(sp.pi * x / 180),
                "cot": lambda x: sp.cos(sp.pi * x / 180) / sp.sin(sp.pi * x / 180),
                "sqrt": sp.sqrt,
            }
            value = sp.sympify(expr, locals=local_dict)
            simplified = sp.simplify(value)
            decimal = sp.N(simplified)
        except Exception:
            return None

        return (
            f"Тригонометрическое выражение: {text.strip()}\n"
            f"Точное значение: {sp.sstr(simplified)}\n"
            f"Приближенно: {decimal}"
        )

    def _inject_degree_arguments(self, expr: str) -> str:
        pattern = re.compile(r"(sin|cos|tan|cot)(-?\d+(?:\.\d+)?)")
        expr = pattern.sub(r"\1(\2)", expr)
        return expr


class OllamaTutor:
    def __init__(self, base_url: str, model: str, timeout: int):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.model = self._resolve_model(model)

    def _resolve_model(self, requested_model: str) -> str:
        try:
            response = self.session.get(f"{self.base_url}/api/tags", timeout=self.timeout)
            response.raise_for_status()
            payload = response.json()
            available = [item.get("name") for item in payload.get("models", []) if item.get("name")]
            if requested_model in available:
                return requested_model

            preferred = ["gemma3:4b", "llama2:latest", "codellama:latest"]
            for candidate in preferred:
                if candidate in available:
                    return candidate

            if available:
                return available[0]
        except Exception:
            pass
        return requested_model

    def generate(
        self,
        question: str,
        profile: StudentProfile,
        topic: str,
        rules: List[str],
        history: List[Tuple[str, str]],
        deterministic_solution: Optional[str],
    ) -> str:
        payload = {
            "model": self.model,
            "prompt": self._build_prompt(question, profile, topic, rules, history, deterministic_solution),
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_ctx": 4096,
                "num_predict": 700,
                "top_p": 0.9,
            },
        }
        response = self.session.post(f"{self.base_url}/api/generate", json=payload, timeout=self.timeout)
        response.raise_for_status()
        return response.json().get("response", "").strip()

    def _build_prompt(
        self,
        question: str,
        profile: StudentProfile,
        topic: str,
        rules: List[str],
        history: List[Tuple[str, str]],
        deterministic_solution: Optional[str],
    ) -> str:
        history_block = "\n".join(f"{role}: {content}" for role, content in history[-8:])
        style_map = {
            "brief": "Отвечай компактно, но не сухо.",
            "step_by_step": "Пиши очень пошагово и мягко.",
            "detailed": "Объясняй подробно, с промежуточными выводами.",
            "balanced": "Держи баланс между точностью и скоростью.",
        }
        return f"""
Ты S.A.R.G.I.S. Strategic AI Research & Guardian Intelligence System.
Ты сильный математический AI-наставник и партнер по обучению.

Твоя задача:
- дать точное решение;
- объяснить ход мысли;
- заметить слабые места ученика;
- подобрать другой подход, если тема трудная;
- говорить уверенно, дружелюбно и по-русски.

Профиль ученика:
- Имя: {profile.name}
- Класс: {profile.grade_hint or "не указан"}
- Слабые темы: {", ".join(profile.weak_list()) or "не выявлены"}
- Сильные темы: {", ".join(profile.strong_list()) or "не выявлены"}
- Цель: {profile.goals or "не указана"}
- Последняя тема: {profile.last_topic or "нет"}

Стиль ответа:
{style_map.get(profile.preferred_style, style_map["balanced"])}

Тема запроса: {topic}

Математические правила:
{chr(10).join("- " + item for item in rules)}

Детерминированное решение:
{deterministic_solution or "нет"}

Недавний контекст:
{history_block or "контекст пуст"}

Запрос ученика:
{question}

Формат ответа:
1. Короткий итог.
2. Решение или объяснение.
3. Слабое место.
4. Другой способ.
5. Мини-задание на закрепление.
""".strip()


class SargisTutor:
    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.storage = Storage(self.config.database_path)
        self.profiler = StudentProfiler()
        self.knowledge = MathKnowledgeBase()
        self.grounded = GroundedMathResponder(self.knowledge)
        self.practice = PracticeGenerator()
        self.engine = DeterministicMathEngine()
        self.ollama = OllamaTutor(self.config.ollama_url, self.config.ollama_model, self.config.request_timeout)

    def respond(self, user_id: int, user_name: str, text: str) -> str:
        profile = self.storage.get_profile(user_id, user_name or "Ученик")
        topic = self.profiler.detect_topic(text)
        quick_meta = self._handle_meta_request(topic, text)
        if quick_meta:
            self.storage.add_message(user_id, "user", text, topic)
            self.storage.add_message(user_id, "assistant", quick_meta, topic)
            return quick_meta

        theory_response = self._handle_theory_request(text, topic)
        if theory_response:
            self.storage.add_message(user_id, "user", text, topic)
            self.storage.add_message(user_id, "assistant", theory_response, topic)
            return theory_response

        rules = self.knowledge.get_rules(topic)
        deterministic = self.engine.solve(text)
        if deterministic and topic in {"arithmetic", "equations", "functions", "geometry", "fractions", "general_math"}:
            grounded = self.grounded.build(text, topic, deterministic)
            self.storage.add_message(user_id, "user", text, topic)
            self.storage.add_message(user_id, "assistant", grounded, topic)
            profile = self.profiler.update_profile(profile, text, topic)
            self.storage.save_profile(profile)
            return grounded

        history = self.storage.get_recent_history(user_id, self.config.history_limit)

        try:
            answer = self.ollama.generate(text, profile, topic, rules, history, deterministic)
        except Exception as exc:
            answer = self._fallback_answer(text, topic, rules, deterministic, exc)

        profile = self.profiler.update_profile(profile, text, topic)
        self.storage.save_profile(profile)
        self.storage.add_message(user_id, "user", text, topic)
        self.storage.add_message(user_id, "assistant", answer, topic)
        return answer

    def _handle_meta_request(self, topic: str, text: str) -> Optional[str]:
        normalized = normalize_text(text)
        if topic == "meta_identity":
            return (
                f"Я S.A.R.G.I.S. Мой языковой движок сейчас работает через Ollama на модели {self.ollama.model}. "
                "То есть я не просто 'Ollama', а учебный бот поверх Ollama: помогаю с математикой, объясняю темы и даю практику."
            )
        if topic == "meta_capabilities":
            return (
                "Я умею решать базовую арифметику, линейные уравнения, часть задач по алгебре и анализу, "
                "объяснять решение пошагово, давать тренировочные задачи и подстраиваться под ученика."
            )
        if topic == "meta_greeting":
            return (
                "Привет. Я S.A.R.G.I.S. Могу решать задачи по математике, объяснять темы и тренировать тебя. "
                "Можешь сразу написать пример вроде: `Реши 2x + 5 = 13`."
            )
        if normalized in {"ты ollama", "ты оллама", "оллама?", "ты оллама?"}:
            return (
                f"Я S.A.R.G.I.S, а Ollama у меня используется как движок модели. Сейчас активная модель: {self.ollama.model}."
            )
        return None

    def _handle_theory_request(self, text: str, topic: str) -> Optional[str]:
        normalized = normalize_text(text)
        theory_markers = ["что такое", "объясни", "как работает", "расскажи про", "теория", "формула"]
        if any(marker in normalized for marker in theory_markers):
            return self.grounded.build_theory(topic)
        return None

    def _fallback_answer(
        self,
        text: str,
        topic: str,
        rules: List[str],
        deterministic: Optional[str],
        exc: Exception,
    ) -> str:
        if deterministic:
            return (
                "Итог: задача решена встроенным математическим модулем.\n\n"
                f"{deterministic}\n\n"
                "Слабое место: если решение кажется резким, попроси разобрать пошагово.\n"
                "Другой способ: могу объяснить через аналогию или правило.\n"
                "Мини-задание: придумай похожий пример и попробуй решить сам."
            )
        return (
            "Итог: Ollama сейчас недоступна, поэтому я перешел в резервный режим.\n\n"
            f"Тема: {topic}\n"
            f"Что помнить:\n{chr(10).join('- ' + rule for rule in rules[:3])}\n\n"
            "Слабое место: задача пока сформулирована слишком общо.\n"
            "Другой способ: пришли пример в явном виде, например `Реши 3x + 7 = 19`.\n"
            f"Техническая причина: {exc}"
        )

    def get_profile_summary(self, user_id: int, user_name: str) -> Dict[str, object]:
        profile = self.storage.get_profile(user_id, user_name)
        stats = self.storage.get_user_stats(user_id)
        return {
            "user_id": profile.user_id,
            "name": profile.name,
            "grade_hint": profile.grade_hint or "не указан",
            "weak_topics": profile.weak_list(),
            "strong_topics": profile.strong_list(),
            "last_topic": profile.last_topic or "нет",
            "preferred_style": profile.preferred_style,
            "goals": profile.goals,
            "stats": stats,
        }

    def generate_practice(self, user_id: int, user_name: str, topic: Optional[str] = None) -> Dict[str, str]:
        profile = self.storage.get_profile(user_id, user_name)
        selected_topic = topic or profile.last_topic or "equations"
        return self.practice.generate(selected_topic, profile.grade_hint)

    def check_practice_answer(
        self,
        user_id: int,
        user_name: str,
        topic: str,
        difficulty: str,
        question: str,
        expected_answer: str,
        user_answer: str,
    ) -> Dict[str, object]:
        normalized_expected = normalize_text(expected_answer).replace(" ", "")
        normalized_user = normalize_text(user_answer).replace(" ", "")
        solved_correctly = normalized_expected == normalized_user
        self.storage.save_task_result(
            user_id=user_id,
            topic=topic,
            difficulty=difficulty,
            question=question,
            answer=user_answer,
            solved_correctly=solved_correctly,
        )
        return {
            "correct": solved_correctly,
            "expected_answer": expected_answer,
            "message": "Верно, отличная работа." if solved_correctly else f"Пока нет. Правильный ответ: {expected_answer}",
        }


def safe_html_text(text: str) -> str:
    return html.escape(text, quote=False)


class GroundedMathResponder:
    def __init__(self, knowledge: MathKnowledgeBase):
        self.knowledge = knowledge

    def build(self, text: str, topic: str, deterministic: str) -> str:
        if topic == "equations":
            return self._equation_response(text, deterministic)
        if topic == "arithmetic":
            return self._arithmetic_response(text, deterministic)
        if topic == "functions":
            return self._function_response(text, deterministic)
        return self._generic_math_response(topic, deterministic)

    def build_theory(self, topic: str) -> Optional[str]:
        theory = self.knowledge.get_theory(topic)
        if not theory:
            return None
        formulas = "\n".join(f"- {item}" for item in theory["formulas"])
        return (
            f"Короткий итог: {theory['summary']}\n\n"
            f"Главные правила и формулы:\n{formulas}\n\n"
            f"Пример:\n{theory['example']}\n\n"
            f"Мини-задание: попробуй придумать похожий пример и решить его самостоятельно."
        )

    def _equation_response(self, text: str, deterministic: str) -> str:
        answer = self._extract_answer_value(deterministic)
        claimed = self._extract_claimed_x(text)
        verification = self._build_equation_verification(deterministic, answer)
        mismatch = ""
        if claimed is not None and answer is not None and claimed != answer:
            mismatch = (
                f"\nСлабое место: в сообщении указан ответ x = {claimed}, но проверка показывает, что верный ответ x = {answer}. "
                "Значит, где-то произошла ошибка в последнем шаге вычислений.\n"
            )
        else:
            mismatch = (
                "\nСлабое место: следи за тем, чтобы одинаковые действия выполнялись с обеими частями уравнения, "
                "и не теряй знак при переносе.\n"
            )
        return (
            f"Короткий итог: решаем уравнение строго по шагам, без догадок.\n\n"
            f"{deterministic}\n"
            f"{verification}\n"
            f"{mismatch}"
            "Другой способ: можно сначала перенести число в правую часть, а потом разделить обе части на коэффициент при x.\n"
            "Мини-задание: реши уравнение 3x + 7 = 19."
        )

    def _arithmetic_response(self, text: str, deterministic: str) -> str:
        return (
            f"Короткий итог: это вычислительная задача, здесь главное порядок действий.\n\n"
            f"{deterministic}\n\n"
            "Слабое место: ошибки обычно появляются, если перепутать порядок действий или знак.\n"
            "Другой способ: проверь результат обратным действием или посчитай по частям.\n"
            "Мини-задание: вычисли 18 * 4 - 9."
        )

    def _function_response(self, text: str, deterministic: str) -> str:
        if "Тригонометрическое выражение:" in deterministic:
            return (
                f"Короткий итог: это тригонометрия, и здесь важно помнить стандартные значения углов.\n\n"
                f"{deterministic}\n\n"
                "Слабое место: чаще всего ошибка возникает, когда путают значения sin 45 и cos 45 или забывают, что речь идет о градусах.\n"
                "Другой способ: вычисли каждую функцию отдельно, а потом сложи результаты.\n"
                "Мини-задание: найди значение sin30 + cos60."
            )
        return (
            f"Короткий итог: здесь работает правило производной или интеграла, а не свободное рассуждение.\n\n"
            f"{deterministic}\n\n"
            "Слабое место: чаще всего ошибки возникают в степенях и коэффициентах.\n"
            "Другой способ: распиши правило отдельно для каждого слагаемого.\n"
            "Мини-задание: найди производную функции x^2 + 5x."
        )

    def _generic_math_response(self, topic: str, deterministic: str) -> str:
        return (
            f"Короткий итог: задача относится к теме {topic}.\n\n"
            f"{deterministic}\n\n"
            "Слабое место: важно не перепрыгивать через шаги.\n"
            "Другой способ: можно переписать решение более подробно.\n"
            "Мини-задание: попробуй решить похожий пример самостоятельно."
        )

    def _extract_claimed_x(self, text: str) -> Optional[str]:
        normalized = text.lower().replace(",", ".")
        matches = re.findall(r"x\s*=\s*(-?\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)?)", normalized)
        if not matches:
            return None
        return matches[-1]

    def _extract_answer_value(self, deterministic: str) -> Optional[str]:
        normalized = deterministic.lower().replace(",", ".")
        match = re.search(r"x\s*=\s*(-?\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)?)", normalized)
        return match.group(1) if match else None

    def _build_equation_verification(self, deterministic: str, answer: Optional[str]) -> str:
        if not answer:
            return ""
        lines = deterministic.splitlines()
        if not lines:
            return ""
        first_line = lines[0].lower().replace("уравнение:", "").strip()
        compact = first_line.replace(" ", "")
        if "=" not in compact:
            return ""
        left, right = compact.split("=", 1)
        substituted_left = left.replace("x", f"({answer})")
        try:
            left_value = sp.simplify(sp.sympify(substituted_left)) if sp is not None else None
            right_value = sp.simplify(sp.sympify(right)) if sp is not None else None
        except Exception:
            return ""
        if left_value is None or right_value is None:
            return ""
        return f"Проверка: при x = {answer} получаем {left_value} = {right_value}."

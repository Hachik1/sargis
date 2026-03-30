import re
from typing import Optional

import telebot
from telebot import types

from sargis.core import Config, SargisTutor, safe_html_text


class SargisTelegramBot:
    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        if not self.config.telegram_token:
            raise RuntimeError("Не задан TELEGRAM_TOKEN в переменных окружения.")

        self.bot = telebot.TeleBot(self.config.telegram_token, parse_mode="HTML")
        self.tutor = SargisTutor(self.config)
        self.pending_tasks = {}
        self._register_handlers()

    def _register_handlers(self) -> None:
        @self.bot.message_handler(commands=["start"])
        def start(message):
            keyboard = types.ReplyKeyboardMarkup(resize_keyboard=True)
            keyboard.row("Профиль", "Тренировка")
            keyboard.row("Слабые темы", "Мини-приложение")
            miniapp_hint = (
                "\n/miniapp - открыть mini app в Telegram"
                if self.config.webapp_url
                else "\nMini app локально: сначала запусти run_mini_app.bat, потом открой http://127.0.0.1:8000"
            )

            text = (
                "<b>S.A.R.G.I.S</b> - новый математический AI-агент.\n\n"
                f"Текущая Ollama-модель: <code>{safe_html_text(self.tutor.ollama.model)}</code>\n\n"
                "Я умею:\n"
                "• решать задачи через математический движок и Ollama\n"
                "• запоминать слабые и сильные темы\n"
                "• подбирать объяснение под уровень ученика\n"
                "• давать тренировки и вести мини-статистику\n\n"
                "Команды:\n"
                "/profile - профиль ученика\n"
                "/practice - новая задача\n"
                "/setgrade 7 - сохранить класс\n"
                f"{miniapp_hint}"
            )
            if self.config.webapp_url:
                inline = types.InlineKeyboardMarkup()
                inline.add(
                    types.InlineKeyboardButton(
                        text="Открыть Mini App",
                        web_app=types.WebAppInfo(self.config.webapp_url),
                    )
                )
                self.bot.reply_to(message, text, reply_markup=inline)
                self.bot.send_message(message.chat.id, "Нижние кнопки тоже доступны.", reply_markup=keyboard)
            else:
                self.bot.reply_to(message, text, reply_markup=keyboard)

        @self.bot.message_handler(commands=["profile"])
        def profile(message):
            self._send_profile(message)

        @self.bot.message_handler(commands=["setgrade"])
        def set_grade(message):
            match = re.search(r"/setgrade\s+([1-9]|10|11)", message.text or "")
            if not match:
                self.bot.reply_to(message, "Использование: /setgrade 7")
                return

            user = message.from_user
            profile_data = self.tutor.storage.get_profile(user.id, user.first_name or "Ученик")
            profile_data.grade_hint = match.group(1)
            self.tutor.storage.save_profile(profile_data)
            self.bot.reply_to(message, f"Сохранил: {match.group(1)} класс.")

        @self.bot.message_handler(commands=["practice"])
        def practice(message):
            self._send_practice(message)

        @self.bot.message_handler(commands=["check"])
        def check(message):
            task = self.pending_tasks.get(message.from_user.id)
            if not task:
                self.bot.reply_to(message, "Сначала запроси задачу через /practice.")
                return

            user_answer = (message.text or "").replace("/check", "", 1).strip()
            if not user_answer:
                self.bot.reply_to(message, "Использование: /check 42")
                return

            result = self.tutor.check_practice_answer(
                user_id=message.from_user.id,
                user_name=message.from_user.first_name or "Ученик",
                topic=task["topic"],
                difficulty=task["difficulty"],
                question=task["question"],
                expected_answer=task["answer"],
                user_answer=user_answer,
            )
            self.bot.reply_to(message, safe_html_text(result["message"]))

        @self.bot.message_handler(commands=["miniapp"])
        def miniapp(message):
            if not self.config.webapp_url:
                self.bot.reply_to(
                    message,
                    "Mini app уже добавлен в проект, но для Telegram нужен публичный HTTPS URL. "
                    "Задай переменную SARGIS_WEBAPP_URL и перезапусти бота."
                )
                return

            markup = types.InlineKeyboardMarkup()
            markup.add(
                types.InlineKeyboardButton(
                    text="Открыть S.A.R.G.I.S Mini App",
                    web_app=types.WebAppInfo(self.config.webapp_url),
                )
            )
            self.bot.reply_to(message, "Открывай mini app:", reply_markup=markup)

        @self.bot.message_handler(func=lambda message: (message.text or "").strip().lower() == "профиль")
        def profile_button(message):
            self._send_profile(message)

        @self.bot.message_handler(func=lambda message: (message.text or "").strip().lower() == "тренировка")
        def practice_button(message):
            self._send_practice(message)

        @self.bot.message_handler(func=lambda message: (message.text or "").strip().lower() == "слабые темы")
        def weak_topics_button(message):
            summary = self.tutor.get_profile_summary(message.from_user.id, message.from_user.first_name or "Ученик")
            weak = summary["weak_topics"] or ["пока не выявлены"]
            self.bot.reply_to(message, "Слабые темы: " + ", ".join(weak))

        @self.bot.message_handler(func=lambda message: (message.text or "").strip().lower() == "мини-приложение")
        def miniapp_button(message):
            miniapp(message)

        @self.bot.message_handler(func=lambda message: bool(message.text))
        def handle_message(message):
            self.bot.send_chat_action(message.chat.id, "typing")
            user = message.from_user
            answer = self.tutor.respond(user.id, user.first_name or "Ученик", message.text)
            self._safe_reply(message, answer)

    def _send_profile(self, message) -> None:
        summary = self.tutor.get_profile_summary(message.from_user.id, message.from_user.first_name or "Ученик")
        stats = summary["stats"]
        weak = ", ".join(summary["weak_topics"]) or "пока нет"
        strong = ", ".join(summary["strong_topics"]) or "пока нет"
        text = (
            f"<b>Профиль ученика</b>\n\n"
            f"Имя: {safe_html_text(str(summary['name']))}\n"
            f"Класс: {safe_html_text(str(summary['grade_hint']))}\n"
            f"Сильные темы: {safe_html_text(str(strong))}\n"
            f"Слабые темы: {safe_html_text(str(weak))}\n"
            f"Последняя тема: {safe_html_text(str(summary['last_topic']))}\n"
            f"Стиль: {safe_html_text(str(summary['preferred_style']))}\n"
            f"Цель: {safe_html_text(str(summary['goals'] or 'не указана'))}\n\n"
            f"<b>Статистика</b>\n"
            f"Решено задач: {stats['total_tasks']}\n"
            f"Точность: {stats['accuracy']}%"
        )
        self.bot.reply_to(message, text)

    def _send_practice(self, message) -> None:
        task = self.tutor.generate_practice(message.from_user.id, message.from_user.first_name or "Ученик")
        self.pending_tasks[message.from_user.id] = task
        text = (
            f"<b>Тренировочная задача</b>\n\n"
            f"Тема: {safe_html_text(task['topic'])}\n"
            f"Сложность: {safe_html_text(task['difficulty'])}\n"
            f"Задание: {safe_html_text(task['question'])}\n\n"
            f"Отправь ответ сообщением в формате:\n"
            f"<code>/check твой_ответ</code>"
        )
        self.bot.reply_to(message, text)

    def _safe_reply(self, message, text: str) -> None:
        safe = safe_html_text(text)
        self.bot.reply_to(message, safe)

    def run(self) -> None:
        print("S.A.R.G.I.S запущен.")
        print(f"Ollama URL: {self.config.ollama_url}")
        print(f"Ollama model: {self.config.ollama_model}")
        if self.config.webapp_url:
            print(f"Mini App URL: {self.config.webapp_url}")
        self.bot.infinity_polling(timeout=30, long_polling_timeout=30)


if __name__ == "__main__":
    SargisTelegramBot().run()

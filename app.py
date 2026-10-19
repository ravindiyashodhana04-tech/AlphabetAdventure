"""
Alphabet Adventure - Flask backend
-----------------------------------
This is the "engine room" of the app. It does two jobs:
  1. Serves the webpage (index.html) when you visit http://127.0.0.1:5000
  2. Serves the letter data (letter, word, emoji) as JSON so the
     JavaScript in the browser can build the games dynamically.

Beginners: you don't need to touch this file much. The interesting
stuff (the games) lives in static/js/script.js
"""

from flask import Flask, render_template, jsonify

app = Flask(__name__)

# ---------------------------------------------------------------
# ALPHABET DATA
# Each letter has: the word it stands for, and an emoji to show
# instead of a real photo (so the app works with zero image files).
# ---------------------------------------------------------------
ALPHABET = [
    {"letter": "A", "word": "Apple",     "emoji": "🍎"},
    {"letter": "B", "word": "Ball",      "emoji": "⚽"},
    {"letter": "C", "word": "Cat",       "emoji": "🐱"},
    {"letter": "D", "word": "Dog",       "emoji": "🐶"},
    {"letter": "E", "word": "Egg",       "emoji": "🥚"},
    {"letter": "F", "word": "Fish",      "emoji": "🐟"},
    {"letter": "G", "word": "Grapes",    "emoji": "🍇"},
    {"letter": "H", "word": "Hat",       "emoji": "🎩"},
    {"letter": "I", "word": "Ice cream", "emoji": "🍦"},
    {"letter": "J", "word": "Juice",     "emoji": "🧃"},
    {"letter": "K", "word": "Kite",      "emoji": "🪁"},
    {"letter": "L", "word": "Lion",      "emoji": "🦁"},
    {"letter": "M", "word": "Moon",      "emoji": "🌙"},
    {"letter": "N", "word": "Nest",      "emoji": "🪺"},
    {"letter": "O", "word": "Owl",       "emoji": "🦉"},
    {"letter": "P", "word": "Pig",       "emoji": "🐷"},
    {"letter": "Q", "word": "Queen",     "emoji": "👸"},
    {"letter": "R", "word": "Rainbow",   "emoji": "🌈"},
    {"letter": "S", "word": "Sun",       "emoji": "☀️"},
    {"letter": "T", "word": "Tiger",     "emoji": "🐯"},
    {"letter": "U", "word": "Umbrella",  "emoji": "☂️"},
    {"letter": "V", "word": "Van",       "emoji": "🚐"},
    {"letter": "W", "word": "Watch",     "emoji": "⌚"},
    {"letter": "X", "word": "Xylophone", "emoji": "🎹"},
    {"letter": "Y", "word": "Yoyo",      "emoji": "🪀"},
    {"letter": "Z", "word": "Zebra",     "emoji": "🦓"},
]

# Which letters belong to which level (matches the plan doc)
LEVELS = {
    1: {"range": "A-E", "letters": "ABCDE"},
    2: {"range": "F-J", "letters": "FGHIJ"},
    3: {"range": "K-O", "letters": "KLMNO"},
    4: {"range": "P-T", "letters": "PQRST"},
    5: {"range": "U-Z", "letters": "UVWXYZ"},
}

# A simple 3-letter word to build for each level's "Build the Word" game
BUILD_WORDS = {
    1: {"word": "CAT", "emoji": "🐱"},
    2: {"word": "JAM", "emoji": "🍯"},
    3: {"word": "MOP", "emoji": "🧹"},
    4: {"word": "TOP", "emoji": "🔝"},
    5: {"word": "VAN", "emoji": "🚐"},
}


def letters_for_level(level: int):
    letters = LEVELS[level]["letters"]
    return [item for item in ALPHABET if item["letter"] in letters]


@app.route("/")
def home():
    """Serves the main (and only) page of the app."""
    return render_template("index.html")


@app.route("/api/levels")
def api_levels():
    """Returns the list of levels with their letter ranges."""
    return jsonify([
        {"level": lvl, "range": data["range"]}
        for lvl, data in LEVELS.items()
    ])


@app.route("/api/level/<int:level>")
def api_level(level):
    """Returns everything needed to run one level's games."""
    if level not in LEVELS:
        return jsonify({"error": "Level not found"}), 404

    return jsonify({
        "level": level,
        "range": LEVELS[level]["range"],
        "letters": letters_for_level(level),
        "build_word": BUILD_WORDS[level],
    })


if __name__ == "__main__":
    # debug=True auto-reloads the server whenever you save a file
    app.run(debug=True, port=5000)
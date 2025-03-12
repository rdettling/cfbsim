import json
import random


def generate_headlines(games):
    """Generate headlines for a list of games.

    This function modifies the games in place by setting their headline attribute.
    No return value is needed.
    """
    with open("data/headlines.json") as f:
        headlines = json.load(f)

    # Initialize counters for each headline type
    headline_counts = {"upset": 0, "blowout": 0, "close": 0, "individual": 0}

    for game in games:
        if game.winner == game.teamA:
            winner = game.teamA.name
            loser = game.teamB.name
            winner_score = game.scoreA
            loser_score = game.scoreB
            win_prob = game.winProbA
            mascot = game.teamA.mascot
        else:
            winner = game.teamB.name
            loser = game.teamA.name
            winner_score = game.scoreB
            loser_score = game.scoreA
            win_prob = game.winProbB
            mascot = game.teamB.mascot

        score = f"{winner_score}-{loser_score}"

        # Select headline template based on game outcome
        if win_prob < 0.1:
            headline_template = random.choice(headlines["upset"])
            headline_counts["upset"] += 1
        elif winner_score > loser_score + 20:
            headline_template = random.choice(headlines["blowout"])
            headline_counts["blowout"] += 1
        elif winner_score < loser_score + 10:
            headline_template = random.choice(headlines["close"])
            headline_counts["close"] += 1
        else:
            headline_template = random.choice(headlines["individual"])
            headline_counts["individual"] += 1

        # Replace common variables
        headline = headline_template.replace("<winner>", winner)
        headline = headline.replace("<loser>", loser)
        headline = headline.replace("<score>", score)
        headline = headline.replace("<mascot>", mascot)

        # Set the headline on the game object
        game.headline = headline

        # print(f"Generated headline: {game.headline}")

    # Print the counts of each headline type
    # print("Headline counts:", headline_counts)

    # No return value needed as games are modified in place

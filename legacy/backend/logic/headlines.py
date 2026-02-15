import json
import random

# Cache headlines data so we don't reload JSON on every call
_HEADLINES_CACHE = None


def _load_headlines():
    """Load and cache headlines from JSON file"""
    global _HEADLINES_CACHE
    if _HEADLINES_CACHE is None:
        with open("data/headlines.json") as f:
            _HEADLINES_CACHE = json.load(f)
    return _HEADLINES_CACHE


def generate_headlines(games):
    """Generate headlines for a list of games.

    This function modifies the games in place by setting their headline attribute.

    Args:
        games: List of game objects or single game object
    """
    # Handle single game case
    if not isinstance(games, list):
        games = [games]

    headlines = _load_headlines()

    # Initialize counters for each headline type
    headline_counts = {
        "upset": 0,
        "blowout": 0,
        "close": 0,
        "individual": 0,
        "overtime": 0,
    }

    for game in games:
        if game.winner == game.teamA:
            winner = game.teamA.name
            loser = game.teamB.name
            winner_score = game.scoreA
            loser_score = game.scoreB
            win_prob = game.winProbA
            mascot = game.teamA.mascot
            winner_team = game.teamA
        else:
            winner = game.teamB.name
            loser = game.teamA.name
            winner_score = game.scoreB
            loser_score = game.scoreA
            win_prob = game.winProbB
            mascot = game.teamB.mascot
            winner_team = game.teamB

        score = f"{winner_score}-{loser_score}"

        # Handle overtime games first
        if game.overtime > 0:
            headline_template = random.choice(headlines["overtime"])
            headline_counts["overtime"] += 1
        # Select headline template based on game outcome
        elif win_prob < 0.1:
            headline_template = random.choice(headlines["upset"])
            headline_counts["upset"] += 1

            # Add spread information for upset headlines using actual game spread
            spread = game.spreadB if game.winner == game.teamA else game.spreadA
            headline_template = headline_template.replace("<spread>", spread)

        elif winner_score > loser_score + 20:
            headline_template = random.choice(headlines["blowout"])
            headline_counts["blowout"] += 1
        elif winner_score < loser_score + 10:
            headline_template = random.choice(headlines["close"])
            headline_counts["close"] += 1
        else:
            # Individual performance headline
            player_info = get_best_performance(game, winner_team)
            if player_info:
                headline_template = random.choice(headlines["individual"])
                headline_counts["individual"] += 1
                headline_template = headline_template.replace(
                    "<player>", f"{player_info['first']} {player_info['last']}"
                )
                headline_template = headline_template.replace(
                    "<stat_value>", str(player_info["stat_value"])
                )
                headline_template = headline_template.replace(
                    "<stat_type>", player_info["stat_type"]
                )
            else:
                # Fall back to a close game headline if no standout individual performance
                headline_template = random.choice(headlines["close"])
                headline_counts["close"] += 1

        # Replace common variables
        headline = headline_template.replace("<winner>", winner)
        headline = headline.replace("<loser>", loser)
        headline = headline.replace("<score>", score)
        headline = headline.replace("<mascot>", mascot)

        # Set the headline on the game object
        game.headline = headline


def get_best_performance(game, winning_team):
    """Find the best individual performance from the winning team in this game."""
    try:
        # Get all game logs for the winning team in this game
        # Handle case where game_logs might not exist yet (e.g., during interactive sim)
        if not hasattr(game, "game_logs") or game.game_logs.count() == 0:
            return None

        game_logs = game.game_logs.filter(player__team=winning_team)

        best_performance = None
        best_score = 0

        for game_log in game_logs:
            player = game_log.player
            performance = None

            # Check quarterback performance
            if player.pos == "qb" and game_log.pass_attempts > 0:
                # Prioritize passing yards and touchdowns
                score = (
                    game_log.pass_yards
                    + (game_log.pass_touchdowns * 50)
                    - (game_log.pass_interceptions * 25)
                )
                if score > best_score and game_log.pass_yards >= 200:
                    performance = {
                        "first": player.first,
                        "last": player.last,
                        "stat_value": game_log.pass_yards,
                        "stat_type": "passing yards",
                    }
                    best_score = score

                # Check for multiple passing TDs
                if game_log.pass_touchdowns >= 3:
                    td_score = game_log.pass_touchdowns * 100
                    if td_score > best_score:
                        performance = {
                            "first": player.first,
                            "last": player.last,
                            "stat_value": game_log.pass_touchdowns,
                            "stat_type": "passing touchdowns",
                        }
                        best_score = td_score

            # Check rushing performance
            if player.pos in ["rb", "qb"] and game_log.rush_attempts > 0:
                score = game_log.rush_yards + (game_log.rush_touchdowns * 60)
                if score > best_score and game_log.rush_yards >= 100:
                    performance = {
                        "first": player.first,
                        "last": player.last,
                        "stat_value": game_log.rush_yards,
                        "stat_type": "rushing yards",
                    }
                    best_score = score

                # Check for multiple rushing TDs
                if game_log.rush_touchdowns >= 2:
                    td_score = game_log.rush_touchdowns * 80
                    if td_score > best_score:
                        performance = {
                            "first": player.first,
                            "last": player.last,
                            "stat_value": game_log.rush_touchdowns,
                            "stat_type": "rushing touchdowns",
                        }
                        best_score = td_score

            # Check receiving performance
            if player.pos in ["wr", "te", "rb"] and game_log.receiving_catches > 0:
                score = game_log.receiving_yards + (game_log.receiving_touchdowns * 60)
                if score > best_score and game_log.receiving_yards >= 100:
                    performance = {
                        "first": player.first,
                        "last": player.last,
                        "stat_value": game_log.receiving_yards,
                        "stat_type": "receiving yards",
                    }
                    best_score = score

                # Check for multiple receiving TDs
                if game_log.receiving_touchdowns >= 2:
                    td_score = game_log.receiving_touchdowns * 80
                    if td_score > best_score:
                        performance = {
                            "first": player.first,
                            "last": player.last,
                            "stat_value": game_log.receiving_touchdowns,
                            "stat_type": "receiving touchdowns",
                        }
                        best_score = td_score

            # Check kicking performance
            if player.pos == "k" and game_log.field_goals_made >= 3:
                score = game_log.field_goals_made * 30
                if score > best_score:
                    performance = {
                        "first": player.first,
                        "last": player.last,
                        "stat_value": game_log.field_goals_made,
                        "stat_type": "field goals",
                    }
                    best_score = score

            if performance:
                best_performance = performance

        return best_performance

    except Exception as e:
        # If there's any error accessing game logs, return None
        # This ensures the headline generation doesn't fail
        return None

def adjusted_pass_yards_per_attempt(
    passing_yards, touchdown_passes, interceptions, pass_attempts
):
    """
    Calculate the Adjusted Yards per Pass Attempt (AY/A).

    :param passing_yards: Total passing yards
    :param touchdown_passes: Number of touchdown passes
    :param interceptions: Number of interceptions
    :param pass_attempts: Number of pass attempts
    :return: Adjusted Yards per Pass Attempt
    """
    if pass_attempts == 0:
        return 0  # To avoid division by zero

    aya = (passing_yards + 20 * touchdown_passes - 45 * interceptions) / pass_attempts
    return round(aya, 1)


def passer_rating(completions, attempts, yards, touchdowns, interceptions):
    """
    Calculate the NFL Passer Rating.

    :param completions: Number of completions
    :param attempts: Number of pass attempts
    :param yards: Total passing yards
    :param touchdowns: Number of touchdown passes
    :param interceptions: Number of interceptions
    :return: NFL Passer Rating
    """
    if attempts == 0:
        return 0  # To avoid division by zero

    # Component calculations
    a = max(0, min(((completions / attempts) - 0.3) * 5, 2.375))
    b = max(0, min(((yards / attempts) - 3) * 0.25, 2.375))
    c = max(0, min((touchdowns / attempts) * 20, 2.375))
    d = max(0, min(2.375 - ((interceptions / attempts) * 25), 2.375))

    # Passer rating
    passer_rating = ((a + b + c + d) / 6) * 100
    return round(passer_rating, 1)


def percentage(completions, attempts):
    """
    Calculate the completion percentage and round it to one decimal place.

    :param completions: Number of completed passes
    :param attempts: Number of pass attempts
    :return: Completion percentage rounded to one decimal
    """
    if attempts == 0:
        return 0.0  # To avoid division by zero

    completion_percentage = (completions / attempts) * 100
    return round(completion_percentage, 1)


def average(total, attempts, decimals=1):
    if attempts == 0:
        return 0.0  # To avoid division by zero

    return round(total / attempts, decimals)


def get_position_game_log(pos, game_log, game):
    """Return relevant game log stats based on player position"""
    base_log = {
        "game": game,
    }

    if pos == "qb":
        return {
            **base_log,
            "pass_completions": game_log.pass_completions,
            "pass_attempts": game_log.pass_attempts,
            "completion_percent": percentage(game_log.pass_completions, game_log.pass_attempts),
            "pass_yards": game_log.pass_yards,
            "pass_touchdowns": game_log.pass_touchdowns,
            "pass_interceptions": game_log.pass_interceptions,
            "passer_rating": passer_rating(game_log.pass_completions, game_log.pass_attempts, game_log.pass_yards, game_log.pass_touchdowns, game_log.pass_interceptions),
        }
    elif pos in ["rb", "wr", "te"]:
        return {
            **base_log,
            "receiving_catches": game_log.receiving_catches,
            "receiving_yards": game_log.receiving_yards,
            "yards_per_rec": average(game_log.receiving_yards, game_log.receiving_catches),
            "receiving_touchdowns": game_log.receiving_touchdowns,
        }
    elif pos == "k":
        return {
            **base_log,
            "field_goals_made": game_log.field_goals_made,
            "field_goals_attempted": game_log.field_goals_attempted,
            "field_goal_percent": percentage(game_log.field_goals_made, game_log.field_goals_attempted),
        }
    return game_log  # Return all stats for unknown positions


def get_player_info(player, current_year, year):
    year_diff = current_year - year
    if year_diff == 0:
        return player.year, player.rating
    elif year_diff == 1:
        if player.year == "sr":
            return "jr", player.rating_jr
        if player.year == "jr":
            return "so", player.rating_so
        if player.year == "so":
            return "fr", player.rating_fr
    elif year_diff == 2:
        if player.year == "sr":
            return "so", player.rating_so
        if player.year == "jr":
            return "fr", player.rating_fr
    elif year_diff == 3:
        return "fr", player.rating_fr


def get_position_stats(pos, stats):
    """Return relevant stats based on player position"""
    base_stats = {
        "class": stats["class"],
        "rating": stats["rating"],
        "games": stats["games"],
    }

    if pos == "qb":
        return {
            **base_stats,
            "pass_completions": stats["pass_completions"],
            "pass_attempts": stats["pass_attempts"],
            "completion_percentage": stats["completion_percentage"],
            "pass_yards": stats["pass_yards"],
            "pass_touchdowns": stats["pass_touchdowns"],
            "pass_interceptions": stats["pass_interceptions"],
            "passer_rating": stats["passer_rating"],
            "adjusted_pass_yards_per_attempt": stats["adjusted_pass_yards_per_attempt"],
        }
    elif pos in ["rb", "wr", "te"]:
        return {
            **base_stats,
            "receiving_catches": stats["receiving_catches"],
            "receiving_yards": stats["receiving_yards"],
            "yards_per_rec": stats["yards_per_rec"],
            "receiving_touchdowns": stats["receiving_touchdowns"],
        }
    elif pos == "k":
        return {
            **base_stats,
            "field_goals_made": stats["field_goals_made"],
            "field_goals_attempted": stats["field_goals_attempted"],
            "field_goal_percent": stats["field_goal_percent"],
        }
    return stats


def format_record(team):
    return f"{team.totalWins}-{team.totalLosses} ({team.confWins}-{team.confLosses})"

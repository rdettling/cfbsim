from logic.stats import *
from api.models import *
import json
import os
from django.conf import settings


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
            "completion_percent": percentage(
                game_log.pass_completions, game_log.pass_attempts
            ),
            "pass_yards": game_log.pass_yards,
            "pass_touchdowns": game_log.pass_touchdowns,
            "pass_interceptions": game_log.pass_interceptions,
            "passer_rating": passer_rating(
                game_log.pass_completions,
                game_log.pass_attempts,
                game_log.pass_yards,
                game_log.pass_touchdowns,
                game_log.pass_interceptions,
            ),
        }
    elif pos in ["rb", "wr", "te"]:
        return {
            **base_log,
            "receiving_catches": game_log.receiving_catches,
            "receiving_yards": game_log.receiving_yards,
            "yards_per_rec": average(
                game_log.receiving_yards, game_log.receiving_catches
            ),
            "receiving_touchdowns": game_log.receiving_touchdowns,
        }
    elif pos == "k":
        return {
            **base_log,
            "field_goals_made": game_log.field_goals_made,
            "field_goals_attempted": game_log.field_goals_attempted,
            "field_goal_percent": percentage(
                game_log.field_goals_made, game_log.field_goals_attempted
            ),
        }

    # Return only base stats for positions not explicitly handled (like "ol")
    return base_log


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

    # Return only base stats for positions not explicitly handled (like "ol")
    return base_stats


def format_record(team):
    return f"{team.totalWins}-{team.totalLosses} ({team.confWins}-{team.confLosses})"


def get_schedule_game(team, game):
    is_team_a = game.teamA == team

    if is_team_a:
        opponent = game.teamB
        opponent_ranking = game.rankBTOG
        result = game.resultA
        spread = game.spreadA
        moneyline = game.moneylineA
        score = f"{game.scoreA}-{game.scoreB}"
    else:
        opponent = game.teamA
        opponent_ranking = game.rankATOG
        result = game.resultB
        spread = game.spreadB
        moneyline = game.moneylineB
        score = f"{game.scoreB}-{game.scoreA}"

    # Construct the label
    if game.name:
        label = game.name
    else:
        conf_match = (
            team.conference == opponent.conference
            if team.conference and opponent.conference
            else False
        )
        label = (
            f"C ({team.conference.confName})"
            if conf_match
            else (
                f"NC ({opponent.conference.confName})"
                if opponent.conference
                else "NC (Ind)"
            )
        )

    return {
        "id": game.id,
        "weekPlayed": game.weekPlayed,
        "opponent": {
            "name": opponent.name,
            "ranking": opponent_ranking,
            "rating": opponent.rating,
            "record": format_record(opponent),
        },
        "label": label,
        "result": result,
        "spread": spread,
        "moneyline": moneyline,
        "score": score,
    }


def get_last_game(info, team):
    games_as_teamA = team.games_as_teamA.filter(
        year=info.currentYear, weekPlayed=info.currentWeek - 1
    )
    games_as_teamB = team.games_as_teamB.filter(
        year=info.currentYear, weekPlayed=info.currentWeek - 1
    )
    schedule = list(games_as_teamA | games_as_teamB)
    if schedule:
        return get_schedule_game(team, schedule[-1])
    else:
        return None


def get_next_game(info, team):
    games_as_teamA = team.games_as_teamA.filter(
        year=info.currentYear, weekPlayed=info.currentWeek
    )
    games_as_teamB = team.games_as_teamB.filter(
        year=info.currentYear, weekPlayed=info.currentWeek
    )
    schedule = list(games_as_teamA | games_as_teamB)
    if schedule:
        return get_schedule_game(team, schedule[0])
    else:
        return None


def sort_standings(teams):
    """
    Sort teams for standings display based on conference record, wins, losses, and ranking.
    Works for both conference teams and independent teams.

    Args:
        teams: List of team objects to sort

    Returns:
        Sorted list of teams
    """
    # Sort by conference win percentage, wins, losses, then ranking
    return sorted(
        teams,
        key=lambda t: (
            (
                -t.confWins / (t.confWins + t.confLosses)
                if (t.confWins + t.confLosses) > 0
                else 0
            ),
            -t.confWins,
            t.confLosses,
            t.ranking,
        ),
    )


def get_recruiting_points(prestige):
    return prestige * 100


def get_last_week(playoff_teams):
    """Calculate the last week based on playoff format"""
    base_weeks = 13  # Regular season (1-12) + Conf Championships (13)

    if playoff_teams == 2:
        return base_weeks + 1  # Week 14 (BCS Championship)
    elif playoff_teams == 4:
        return base_weeks + 2  # Weeks 14-15 (Semifinals + Championship)
    elif playoff_teams == 12:
        return (
            base_weeks + 4
        )  # Weeks 14-17 (First Round + Quarters + Semis + Championship)
    else:
        raise ValueError(f"Unsupported playoff format: {playoff_teams}")


def load_year_data(year):
    """Load year-specific data with team metadata"""
    # Load year-specific data
    year_file_path = os.path.join(settings.YEARS_DATA_DIR, f"{year}.json")
    with open(year_file_path, "r") as f:
        year_data = json.load(f)

    # Load static data
    teams_path = os.path.join(settings.BASE_DIR, "data", "teams.json")
    with open(teams_path, "r") as f:
        teams_data = json.load(f)["teams"]

    conferences_path = os.path.join(settings.BASE_DIR, "data", "conferences.json")
    with open(conferences_path, "r") as f:
        conferences_data = json.load(f)

    # Add team metadata to year data
    def add_team_metadata(team_name, prestige):
        team_metadata = teams_data[team_name]
        return {
            "name": team_name,
            "prestige": prestige,
            "mascot": team_metadata["mascot"],
            "abbreviation": team_metadata["abbreviation"],
            "ceiling": team_metadata["ceiling"],
            "floor": team_metadata["floor"],
            "colorPrimary": team_metadata["colorPrimary"],
            "colorSecondary": team_metadata["colorSecondary"],
        }

    # Process conferences
    for conf_name, conf_data in year_data["conferences"].items():
        conf_data["confName"] = conf_name
        conf_data["confFullName"] = conferences_data.get(conf_name, conf_name)
        conf_data["confGames"] = conf_data["games"]  # Map games to confGames
        conf_data["teams"] = [
            add_team_metadata(team_name, prestige)
            for team_name, prestige in conf_data["teams"].items()
        ]

    # Process independents
    year_data["independents"] = [
        add_team_metadata(team_name, prestige)
        for team_name, prestige in year_data["Independent"].items()
    ]

    return year_data

def time_section(section_start, section_name):
    duration = round(time.time() - section_start, 2)
    print(f"{section_name}: {duration} seconds")
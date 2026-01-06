from api.models import *
from django.db.models import Q, Sum

MIN_YARDS = 100


def accumulate_individual_stats(info, category):
    stats = {}
    all_game_logs = info.game_logs.filter(game__year=info.currentYear)

    if category == "passing":
        players = list(
            info.players.filter(pos="qb", starter=True).select_related("team")
        )
        totals = {
            row["player_id"]: row
            for row in all_game_logs.filter(player__pos="qb", player__starter=True)
            .values("player_id")
            .annotate(
                att=Sum("pass_attempts"),
                cmp=Sum("pass_completions"),
                yards=Sum("pass_yards"),
                td=Sum("pass_touchdowns"),
                inter=Sum("pass_interceptions"),
            )
        }

        for player in players:
            row = totals.get(player.id, {})
            att = row.get("att") or 0
            cmp = row.get("cmp") or 0
            yards = row.get("yards") or 0
            td = row.get("td") or 0
            inter = row.get("inter") or 0

            stats[player] = {
                "att": att,
                "cmp": cmp,
                "yards": yards,
                "td": td,
                "int": inter,
                "pct": percentage(cmp, att),
                "passer_rating": passer_rating(cmp, att, yards, td, inter),
                "adjusted_pass_yards_per_attempt": adjusted_pass_yards_per_attempt(
                    yards, td, inter, att
                ),
                "yards_per_game": average(yards, player.team.gamesPlayed),
            }

    elif category == "rushing":
        players = list(
            info.players.filter(Q(pos="qb") | Q(pos="rb"), starter=True).select_related(
                "team"
            )
        )
        totals = {
            row["player_id"]: row
            for row in all_game_logs.filter(
                player__starter=True, player__pos__in=["qb", "rb"]
            )
            .values("player_id")
            .annotate(
                att=Sum("rush_attempts"),
                yards=Sum("rush_yards"),
                td=Sum("rush_touchdowns"),
                fumbles=Sum("fumbles"),
            )
        }

        for player in players:
            row = totals.get(player.id, {})
            att = row.get("att") or 0
            yards = row.get("yards") or 0
            td = row.get("td") or 0
            fumbles = row.get("fumbles") or 0

            if yards < MIN_YARDS:
                continue

            stats[player] = {
                "att": att,
                "yards": yards,
                "td": td,
                "fumbles": fumbles,
                "yards_per_rush": average(yards, att),
                "yards_per_game": average(yards, player.team.gamesPlayed),
            }

    elif category == "receiving":
        players = list(
            info.players.filter(
                Q(pos="rb") | Q(pos="wr") | Q(pos="te"), starter=True
            ).select_related("team")
        )
        totals = {
            row["player_id"]: row
            for row in all_game_logs.filter(
                player__starter=True, player__pos__in=["rb", "wr", "te"]
            )
            .values("player_id")
            .annotate(
                rec=Sum("receiving_catches"),
                yards=Sum("receiving_yards"),
                td=Sum("receiving_touchdowns"),
            )
        }

        for player in players:
            row = totals.get(player.id, {})
            rec = row.get("rec") or 0
            yards = row.get("yards") or 0
            td = row.get("td") or 0

            if yards < MIN_YARDS:
                continue

            stats[player] = {
                "rec": rec,
                "yards": yards,
                "td": td,
                "yards_per_rec": average(yards, rec),
                "yards_per_game": average(yards, player.team.gamesPlayed),
            }

    return stats


def accumulate_passing_stats(game_logs):
    stats = {
        "att": 0,
        "cmp": 0,
        "yards": 0,
        "td": 0,
        "int": 0,
        "pct": 0,
        "passer_rating": 0,
        "adjusted_pass_yards_per_attempt": 0,
        "yards_per_game": 0,
    }

    if game_logs:
        for game_log in game_logs:
            stats["att"] += game_log.pass_attempts
            stats["cmp"] += game_log.pass_completions
            stats["yards"] += game_log.pass_yards
            stats["td"] += game_log.pass_touchdowns
            stats["int"] += game_log.pass_interceptions

        stats["pct"] = percentage(stats["cmp"], stats["att"])
        stats["passer_rating"] = passer_rating(
            stats["cmp"], stats["att"], stats["yards"], stats["td"], stats["int"]
        )
        stats["adjusted_pass_yards_per_attempt"] = adjusted_pass_yards_per_attempt(
            stats["yards"], stats["td"], stats["int"], stats["att"]
        )
        stats["yards_per_game"] = average(
            stats["yards"], game_log.player.team.gamesPlayed
        )

    return stats


def accumulate_rushing_stats(game_logs):
    stats = {"att": 0, "yards": 0, "td": 0, "fumbles": 0}

    if game_logs:
        for game_log in game_logs:
            stats["att"] += game_log.rush_attempts
            stats["yards"] += game_log.rush_yards
            stats["td"] += game_log.rush_touchdowns
            stats["fumbles"] += game_log.fumbles

        stats["yards_per_rush"] = average(stats["yards"], stats["att"])
        stats["yards_per_game"] = average(
            stats["yards"], game_log.player.team.gamesPlayed
        )

    return stats


def accumulate_receiving_stats(game_logs):
    stats = {"rec": 0, "yards": 0, "td": 0}

    if game_logs:
        for game_log in game_logs:
            stats["rec"] += game_log.receiving_catches
            stats["yards"] += game_log.receiving_yards
            stats["td"] += game_log.receiving_touchdowns

        stats["yards_per_rec"] = average(stats["yards"], stats["rec"])
        stats["yards_per_game"] = average(
            stats["yards"], game_log.player.team.gamesPlayed
        )

    return stats


def accumulate_team_stats(team, games, plays):
    stats = {}
    pass_yards = rush_yards = 0
    comp = att = rush_att = 0
    pass_td = rush_td = 0
    fumbles = interceptions = 0
    points = 0
    play_count = 0
    first_downs_pass = first_downs_rush = first_downs_total = 0

    gamesPlayed = team.gamesPlayed
    stats["games"] = gamesPlayed

    for game in games:
        if game.teamA == team:
            points += game.scoreA
        else:
            points += game.scoreB

    for play in plays:
        if play.playType == "pass":
            play_count += 1
            pass_yards += play.yardsGained
            if play.result == "pass":
                comp += 1
                att += 1
            elif play.result == "touchdown":
                comp += 1
                att += 1
                pass_td += 1
            elif play.result == "incomplete pass":
                att += 1
            elif play.result == "interception":
                att += 1
                interceptions += 1

            if play.yardsGained >= play.yardsLeft:
                first_downs_pass += 1

        elif play.playType == "run":
            play_count += 1
            rush_yards += play.yardsGained
            if play.result == "run":
                rush_att += 1
            elif play.result == "touchdown":
                rush_att += 1
                rush_td += 1
            elif play.result == "fumble":
                fumbles += 1

            if play.yardsGained >= play.yardsLeft:
                first_downs_rush += 1

    total_yards = pass_yards + rush_yards
    first_downs_total = first_downs_pass + first_downs_rush
    turnovers = fumbles + interceptions

    stats["ppg"] = average(points, gamesPlayed)
    stats["pass_cpg"] = average(comp, gamesPlayed)
    stats["pass_apg"] = average(att, gamesPlayed)
    stats["pass_ypg"] = average(pass_yards, gamesPlayed)
    stats["pass_tdpg"] = average(pass_td, gamesPlayed)
    stats["rush_apg"] = average(rush_att, gamesPlayed)
    stats["rush_ypg"] = average(rush_yards, gamesPlayed)
    stats["rush_ypc"] = average(rush_yards, rush_att)
    stats["rush_tdpg"] = average(rush_td, gamesPlayed)
    stats["playspg"] = average(play_count, gamesPlayed)
    stats["yardspg"] = average(total_yards, gamesPlayed)
    stats["ypp"] = average(total_yards, play_count)
    stats["comp_percent"] = percentage(comp, att)
    stats["first_downs_pass"] = average(first_downs_pass, gamesPlayed)
    stats["first_downs_rush"] = average(first_downs_rush, gamesPlayed)
    stats["first_downs_total"] = average(first_downs_total, gamesPlayed)
    stats["fumbles"] = average(fumbles, gamesPlayed)
    stats["interceptions"] = average(interceptions, gamesPlayed)
    stats["turnovers"] = average(turnovers, gamesPlayed)

    return stats


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


def game_stats(game):
    team_yards = opp_yards = 0
    team_passing_yards = team_rushing_yards = opp_passing_yards = opp_rushing_yards = 0
    team_first_downs = opp_first_downs = 0
    team_third_down_a = team_third_down_c = opp_third_down_a = opp_third_down_c = 0
    team_fourth_down_a = team_fourth_down_c = opp_fourth_down_a = opp_fourth_down_c = 0
    team_turnovers = opp_turnovers = 0
    for play in game.plays.all():
        if play.offense == game.teamA:
            if play.playType == "pass":
                team_passing_yards += play.yardsGained
            elif play.playType == "run":
                team_rushing_yards += play.yardsGained
            if play.yardsGained >= play.yardsLeft:
                team_first_downs += 1
            if play.result in ["interception", "fumble"]:
                team_turnovers += 1
            elif play.down == 3:
                team_third_down_a += 1
                if play.yardsGained >= play.yardsLeft:
                    team_third_down_c += 1
            elif play.down == 4:
                if play.playType not in ["punt", "field goal"]:
                    team_fourth_down_a += 1
                    if play.yardsGained >= play.yardsLeft:
                        team_fourth_down_c += 1
        elif play.offense == game.teamB:
            if play.playType == "pass":
                opp_passing_yards += play.yardsGained
            elif play.playType == "run":
                opp_rushing_yards += play.yardsGained
            if play.yardsGained >= play.yardsLeft:
                opp_first_downs += 1
            if play.result in ["interception", "fumble"]:
                opp_turnovers += 1
            elif play.down == 3:
                opp_third_down_a += 1
                if play.yardsGained >= play.yardsLeft:
                    opp_third_down_c += 1
            elif play.down == 4:
                if play.playType not in ["punt", "field goal"]:
                    opp_fourth_down_a += 1
                    if play.yardsGained >= play.yardsLeft:
                        opp_fourth_down_c += 1

    team_yards = team_passing_yards + team_rushing_yards
    opp_yards = opp_passing_yards + opp_rushing_yards

    return {
        "total yards": {"teamA": team_yards, "teamB": opp_yards},
        "passing yards": {"teamA": team_passing_yards, "teamB": opp_passing_yards},
        "rushing yards": {"teamA": team_rushing_yards, "teamB": opp_rushing_yards},
        "1st downs": {"teamA": team_first_downs, "teamB": opp_first_downs},
        "3rd down conversions": {
            "teamA": team_third_down_c,
            "teamB": opp_third_down_c,
        },
        "3rd down attempts": {"teamA": team_third_down_a, "teamB": opp_third_down_a},
        "4th down conversions": {
            "teamA": team_fourth_down_c,
            "teamB": opp_fourth_down_c,
        },
        "4th down attempts": {
            "teamA": team_fourth_down_a,
            "teamB": opp_fourth_down_a,
        },
        "turnovers": {"teamA": team_turnovers, "teamB": opp_turnovers},
    }

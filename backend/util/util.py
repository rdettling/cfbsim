from logic.stats import *


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


def get_schedule_game(team, game):
    is_team_a = game.teamA == team
    opponent = game.teamB if is_team_a else game.teamA

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
            "ranking": opponent.ranking,
            "rating": opponent.rating,
            "record": format_record(opponent),
        },
        "label": label,
        "result": game.resultA if is_team_a else game.resultB,
        "spread": game.spreadA if is_team_a else game.spreadB,
        "moneyline": game.moneylineA if is_team_a else game.moneylineB,
        "score": (
            (
                f"{game.scoreA}-{game.scoreB}"
                if is_team_a
                else f"{game.scoreB}-{game.scoreA}"
            )
            if game.winner
            else None
        ),
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


# def fetch_play(request):
#     user_id = request.session.session_key
#     info = Info.objects.get(user_id=user_id)

#     last_play_id = request.GET.get("current_play_id")
#     last_play_text = last_play_yards = None

#     if last_play_id:
#         last_play = info.plays.get(id=last_play_id)
#         current_play = info.plays.filter(id=last_play.next_play_id).first()
#         last_play_text = f"{last_play.header}: {last_play.text}"
#         if last_play.result != "touchdown":
#             last_play_yards = last_play.yardsGained

#     else:
#         game_id = request.GET.get("game_id")
#         game = info.games.get(id=game_id)
#         current_play = game.plays.first()

#     if not current_play:
#         game_id = request.GET.get("game_id")
#         game = info.games.get(id=game_id)
#         teamA = game.teamA.name
#         teamB = game.teamB.name

#         return JsonResponse(
#             {
#                 "status": "finished",
#                 "teamA": teamA,
#                 "teamB": teamB,
#                 "scoreA": game.scoreA,
#                 "scoreB": game.scoreB,
#                 "last_play_text": last_play_text,
#                 "ot": game.overtime,
#             }
#         )

#     offense = current_play.offense.name
#     teamA = current_play.game.teamA.name
#     teamB = current_play.game.teamB.name
#     colorAPrimary = current_play.game.teamA.colorPrimary
#     colorASecondary = current_play.game.teamA.colorSecondary
#     colorBPrimary = current_play.game.teamB.colorPrimary
#     colorBSecondary = current_play.game.teamB.colorSecondary

#     if offense == teamA:
#         ballPosition = lineOfScrimmage = current_play.startingFP
#         firstDownLine = current_play.yardsLeft + current_play.startingFP
#     else:
#         ballPosition = lineOfScrimmage = 100 - current_play.startingFP
#         firstDownLine = 100 - (current_play.yardsLeft + current_play.startingFP)

#     completed_drives = []
#     if current_play:
#         drive_num = (
#             current_play.drive.driveNum // 2
#         ) + 1  # Adjust to start from 1 and have two drives per number
#         drive_fraction = f"{drive_num}/{DRIVES_PER_TEAM}"
#         if drive_num > DRIVES_PER_TEAM:
#             drive_fraction = "OT"

#         for drive in current_play.game.drives.exclude(result__isnull=True):
#             if drive.id < current_play.drive.id:
#                 # Calculate yards gained using the drive's own data
#                 if drive.offense == current_play.game.teamA:
#                     yards_gained = drive.startingFP - drive.plays.last().startingFP
#                 else:
#                     yards_gained = drive.plays.last().startingFP - drive.startingFP

#                 adjusted_drive_num = (drive.driveNum // 2) + 1  # Adjust drive number

#                 completed_drives.append(
#                     {
#                         "offense": drive.offense.name,
#                         "offense_color": drive.offense.colorPrimary,
#                         "offense_secondary_color": drive.offense.colorSecondary,
#                         "yards": yards_gained,
#                         "result": drive.result,
#                         "points": drive.points,
#                         "scoreA": drive.scoreAAfter,
#                         "scoreB": drive.scoreBAfter,
#                         "driveNum": adjusted_drive_num,
#                     }
#                 )

#     return JsonResponse(
#         {
#             "status": "success",
#             "offense": offense,
#             "teamA": teamA,
#             "teamB": teamB,
#             "colorAPrimary": colorAPrimary,
#             "colorBPrimary": colorBPrimary,
#             "colorASecondary": colorASecondary,
#             "colorBSecondary": colorBSecondary,
#             "ballPosition": ballPosition,
#             "lineOfScrimmage": lineOfScrimmage,
#             "firstDownLine": firstDownLine,
#             "lastPlayYards": last_play_yards,
#             "scoreA": current_play.scoreA,
#             "scoreB": current_play.scoreB,
#             "current_play_header": current_play.header,
#             "last_play_text": last_play_text,
#             "current_play_id": current_play.id,
#             "completed_drives": completed_drives,
#             "drive_fraction": drive_fraction,
#         }
#     )

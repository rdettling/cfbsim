from start.models import *
import static.code.sim as sim
from django.shortcuts import render
from django.db.models import Q
import random
from start.views import scheduleGame


def schedule(request, team_name):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team = Teams.objects.get(info=info, name=team_name)

    games_as_teamA = team.games_as_teamA.all()
    games_as_teamB = team.games_as_teamB.all()
    schedule = list(games_as_teamA | games_as_teamB)
    schedule = sorted(schedule, key=lambda game: game.weekPlayed)

    teams = Teams.objects.filter(info=info).order_by("name")
    conferences = Conferences.objects.filter(info=info).order_by("confName")

    for week in schedule:
        if week.teamA == team:
            opponent = week.teamB
            week.label = week.labelA
            week.moneyline = week.moneylineA
            week.spread = week.spreadA
            week.result = week.resultA
            if not week.overtime:
                week.score = f"{week.scoreA} - {week.scoreB}"
            else:
                if week.overtime == 1:
                    week.score = f"{week.scoreA} - {week.scoreB} OT"
                else:
                    week.score = f"{week.scoreA} - {week.scoreB} {week.overtime}OT"
        else:
            opponent = week.teamA
            week.label = week.labelB
            week.moneyline = week.moneylineB
            week.spread = week.spreadB
            week.result = week.resultB
            if not week.overtime:
                week.score = f"{week.scoreB} - {week.scoreA}"
            else:
                if week.overtime == 1:
                    week.score = f"{week.scoreB} - {week.scoreA} OT"
                else:
                    week.score = f"{week.scoreB} - {week.scoreA} {week.overtime}OT"
        week.opponent = opponent.name
        week.rating = opponent.rating
        week.ranking = opponent.ranking
        week.opponentRecord = f"{opponent.totalWins} - {opponent.totalLosses} ({opponent.confWins} - {opponent.confLosses})"

    context = {
        "team": team,
        "teams": teams,
        "schedule": schedule,
        "info": info,
        "conferences": conferences,
    }

    return render(request, "schedule.html", context)


def roster(request, team_name):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team = Teams.objects.get(info=info, name=team_name)
    teams = Teams.objects.filter(info=info).order_by("name")
    roster = Players.objects.filter(info=info, team=team)
    positions = roster.values_list("pos", flat=True).distinct()
    conferences = Conferences.objects.filter(info=info).order_by("confName")

    context = {
        "team": team,
        "teams": teams,
        "roster": roster,
        "info": info,
        "conferences": conferences,
        "positions": positions,
    }

    return render(request, "roster.html", context)


def player(request, team_name, id):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team = Teams.objects.get(info=info, name=team_name)
    player = Players.objects.get(info=info, id=id)
    conferences = Conferences.objects.filter(info=info).order_by("confName")
    game_logs = GameLog.objects.filter(player=player)  # Query for the game logs

    cumulative_stats = {
        "pass_yards": 0,
        "pass_attempts": 0,
        "pass_completions": 0,
        "pass_touchdowns": 0,
        "pass_interceptions": 0,
        "rush_yards": 0,
        "rush_attempts": 0,
        "rush_touchdowns": 0,
        "receiving_yards": 0,
        "receiving_catches": 0,
        "receiving_touchdowns": 0,
        # ... (add all the other fields)
    }

    for game_log in game_logs:
        if game_log.game.teamA == player.team:
            game_log.opponent = game_log.game.teamB.name
            game_log.label = game_log.game.labelA
            if not game_log.game.overtime:
                game_log.result = f"{game_log.game.resultA} ({game_log.game.scoreA} - {game_log.game.scoreB})"
            else:
                if game_log.game.overtime == 1:
                    game_log.result = f"{game_log.game.resultA} ({game_log.game.scoreA} - {game_log.game.scoreB} OT)"
                else:
                    game_log.result = f"{game_log.game.resultA} ({game_log.game.scoreA} - {game_log.game.scoreB} {game_log.game.overtime}OT)"
        else:
            game_log.opponent = game_log.game.teamA.name
            game_log.label = game_log.game.labelB
            if not game_log.game.overtime:
                game_log.result = f"{game_log.game.resultB} ({game_log.game.scoreB} - {game_log.game.scoreA})"
            else:
                if game_log.game.overtime == 1:
                    game_log.result = f"{game_log.game.resultB} ({game_log.game.scoreB} - {game_log.game.scoreA} OT)"
                else:
                    game_log.result = f"{game_log.game.resultB} ({game_log.game.scoreB} - {game_log.game.scoreA} {game_log.game.overtime}OT)"

        for key in cumulative_stats.keys():
            cumulative_stats[key] += getattr(game_log, key, 0)

    # Calculate derived statistics
    if cumulative_stats["pass_attempts"] > 0:
        cumulative_stats["completion_percentage"] = round(
            (cumulative_stats["pass_completions"] / cumulative_stats["pass_attempts"])
            * 100,
            1,
        )
        cumulative_stats["adjusted_pass_yards_per_attempt"] = round(
            (
                cumulative_stats["pass_yards"]
                + (20 * cumulative_stats["pass_touchdowns"])
                - (45 * cumulative_stats["pass_interceptions"])
            )
            / cumulative_stats["pass_attempts"],
            1,
        )

        # Calculate Passer rating
        a = ((cumulative_stats["completion_percentage"] / 100) - 0.3) * 5
        b = (
            (cumulative_stats["pass_yards"] / cumulative_stats["pass_attempts"]) - 3
        ) * 0.25
        c = (
            cumulative_stats["pass_touchdowns"] / cumulative_stats["pass_attempts"]
        ) * 20
        d = 2.375 - (
            (cumulative_stats["pass_interceptions"] / cumulative_stats["pass_attempts"])
            * 25
        )

        cumulative_stats["passer_rating"] = round(((a + b + c + d) / 6) * 100, 1)
    else:
        cumulative_stats["completion_percentage"] = 0
        cumulative_stats["adjusted_pass_yards_per_attempt"] = 0
        cumulative_stats["passer_rating"] = 0

    if cumulative_stats["rush_attempts"] > 0:
        cumulative_stats["rush_yards_per_attempt"] = round(
            cumulative_stats["rush_yards"] / cumulative_stats["rush_attempts"], 1
        )
    else:
        cumulative_stats["rush_yards_per_attempt"] = 0

    if cumulative_stats["receiving_catches"] > 0:
        cumulative_stats["yards_per_reception"] = (
            cumulative_stats["receiving_yards"] / cumulative_stats["receiving_catches"]
        )
    else:
        cumulative_stats["yards_per_reception"] = 0

    context = {
        "team": team,
        "player": player,
        "info": info,
        "conferences": conferences,
        "game_logs": game_logs,  # Include the game logs in the context
        "cumulative_stats": cumulative_stats,  # Include the cumulative stats in the context
    }

    return render(request, "player.html", context)


def stats(request, team_name):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team = Teams.objects.get(info=info, name=team_name)
    teams = Teams.objects.filter(info=info).order_by("name")
    conferences = Conferences.objects.filter(info=info).order_by("confName")

    context = {"team": team, "teams": teams, "info": info, "conferences": conferences}

    return render(request, "stats.html", context)


def simWeek(request, team_name, weeks):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    resumeFactor = 1.5
    Team = Teams.objects.get(info=info, name=team_name)
    conferences = Conferences.objects.filter(info=info).order_by("confName")

    drives_to_create = []
    plays_to_create = []
    teamGames = []

    desired_week = info.currentWeek + weeks

    while info.currentWeek < desired_week:
        toBeSimmed = list(Games.objects.filter(info=info, weekPlayed=info.currentWeek))

        for game in toBeSimmed:
            if game.teamA == Team:
                game.label = game.labelA
                teamGames.append(game)
            elif game.teamB == Team:
                game.label = game.labelB
                teamGames.append(game)

            sim.simGame(info, game, drives_to_create, plays_to_create, resumeFactor)

        # Define all actions in a single dictionary
        all_actions = {
            4: {
                12: setConferenceChampionships,
                13: setPlayoffSemi,
                14: setNatty,
            },
            12: {
                12: setConferenceChampionships,
                13: setPlayoffR1,
                14: setPlayoffQuarter,
                15: setPlayoffSemi,
                16: setNatty,
            },
        }

        # List of weeks to NOT update rankings
        update_rankings_exceptions = {4: [14], 12: [14, 15, 16]}

        # Check if we should update rankings
        no_update_weeks = update_rankings_exceptions.get(info.playoff.teams, [])
        if info.currentWeek not in no_update_weeks:
            update_rankings(info)

        # Fetch and perform the appropriate action
        action = all_actions.get(info.playoff.teams, {}).get(info.currentWeek)
        if action:
            action(info)

        info.currentWeek += 1

    desired_positions = {"qb", "rb", "wr"}
    game_log_dict = {}

    # Get all starters outside of the play loop
    all_starters = Players.objects.filter(
        info=info, starter=True, pos__in=desired_positions
    ).select_related("team")

    # Group them by position and team
    starters_by_team_pos = {(player.team, player.pos): [] for player in all_starters}
    for player in all_starters:
        starters_by_team_pos[(player.team, player.pos)].append(player)

    # Get all unique games being simmed
    simmed_games = {play.game for play in plays_to_create}

    # Create a set to store (player, game) combinations for GameLog objects
    player_game_combinations = set()

    for game in simmed_games:
        for team in [game.teamA, game.teamB]:
            for pos in desired_positions:
                starters = starters_by_team_pos.get((team, pos), [])
                for starter in starters:
                    player_game_combinations.add((starter, game))

    # Create the in-memory GameLog objects
    game_logs_to_process = [
        GameLog(info=info, player=player, game=game)
        for player, game in player_game_combinations
    ]

    for game_log in game_logs_to_process:
        game_log_dict[(game_log.player, game_log.game)] = game_log

    # Main logic for processing the plays
    for play in plays_to_create:
        game = play.game
        offense_team = play.offense

        rb_starters = starters_by_team_pos.get((offense_team, "rb"), [])
        qb_starters = starters_by_team_pos.get((offense_team, "qb"), [])
        wr_starters = starters_by_team_pos.get((offense_team, "wr"), [])

        if play.playType == "run":
            runner = random.choice(rb_starters) if rb_starters else None
            if runner:
                game_log = game_log_dict[(runner, game)]
                update_game_log_for_run(play, game_log)
                format_play_text(play, runner)

        elif play.playType == "pass":
            qb_starter = qb_starters[0] if qb_starters else None
            receiver = random.choice(wr_starters) if wr_starters else None
            if qb_starter and receiver:
                qb_game_log = game_log_dict[(qb_starter, game)]
                receiver_game_log = game_log_dict[(receiver, game)]
                update_game_log_for_pass(play, qb_game_log, receiver_game_log)
                format_play_text(play, qb_starter, receiver)

    # Remaining operations
    Drives.objects.bulk_create(drives_to_create)
    Plays.objects.bulk_create(plays_to_create)
    GameLog.objects.bulk_create(game_logs_to_process)
    info.save()

    context = {
        "team": Team,
        "conferences": conferences,
        "teamGames": teamGames,
        "info": info,
    }

    return render(request, "sim.html", context)


def update_rankings(info):
    teams = Teams.objects.filter(info=info)

    for team in teams:
        games_played = team.totalWins + team.totalLosses

        if games_played > 0:
            team.resume = round(team.resume_total / (games_played), 1)
        else:
            team.resume = 0

    sorted_teams = sorted(teams, key=lambda x: x.resume, reverse=True)

    for i, team in enumerate(sorted_teams, start=1):
        team.ranking = i
        team.save()

    games = Games.objects.filter(info=info)

    for game in games:
        if not game.winner:
            game.rankATOG = game.teamA.ranking
            game.rankBTOG = game.teamB.ranking

        game.save()


def details(request, team_name, id):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    conferences = Conferences.objects.filter(info=info).order_by("confName")
    team = Teams.objects.get(info=info, name=team_name)

    game = Games.objects.get(id=id)
    drives = game.drives.all()

    game_logs = GameLog.objects.filter(game=game)

    # Initialize an empty dictionary to store categorized game log strings
    categorized_game_log_strings = {"Passing": [], "Rushing": [], "Receiving": []}

    for game_log in game_logs:
        player = game_log.player
        position = player.pos  # Assuming 'position' is a field on your 'Players' model
        team_name = (
            player.team.name
        )  # Assuming 'team' is a field on your 'Players' model

        if "qb" in position.lower():
            qb_game_log_dict = {
                "player_id": player.id,  # Assuming 'id' is a field on your 'Players' model
                "team_name": team_name,
                "game_log_string": f"{player.first} {player.last} ({team_name} - QB): {game_log.pass_completions}/{game_log.pass_attempts} for {game_log.pass_yards} yards, {game_log.pass_touchdowns} TDs, {game_log.pass_interceptions} INTs",
            }
            categorized_game_log_strings["Passing"].append(qb_game_log_dict)

        if "rb" in position.lower() or (
            "qb" in position.lower() and game_log.rush_attempts > 0
        ):  # Include QBs with rushing attempts
            rush_game_log_dict = {
                "player_id": player.id,
                "team_name": team_name,
                "game_log_string": f"{player.first} {player.last} ({team_name} - {position.upper()}): {game_log.rush_attempts} carries, {game_log.rush_yards} yards, {game_log.rush_touchdowns} TDs",
            }
            categorized_game_log_strings["Rushing"].append(rush_game_log_dict)

        if "wr" in position.lower() or (
            "rb" in position.lower() and game_log.receiving_catches > 0
        ):  # Include RBs with receptions
            recv_game_log_dict = {
                "player_id": player.id,
                "team_name": team_name,
                "game_log_string": f"{player.first} {player.last} ({team_name} - {position.upper()}): {game_log.receiving_catches} catches, {game_log.receiving_yards} yards, {game_log.receiving_touchdowns} TDs",
            }
            categorized_game_log_strings["Receiving"].append(recv_game_log_dict)

    game.team = team
    if game.teamA == team:
        game.opponent = game.teamB
        game.team.score = game.scoreA
        game.opponent.score = game.scoreB
    else:
        game.opponent = game.teamA
        game.team.score = game.scoreB
        game.opponent.score = game.scoreA

    scoreA = scoreB = 0
    for drive in drives:
        if drive.offense == team:
            if drive.points:
                scoreA += drive.points
            elif drive.result == "safety":
                scoreB += 2
        elif drive.offense == game.opponent:
            if drive.points:
                scoreB += drive.points
            elif drive.result == "safety":
                scoreA += 2
        drive.teamAfter = scoreA
        drive.oppAfter = scoreB

    team_yards = opp_yards = 0
    team_passing_yards = team_rushing_yards = opp_passing_yards = opp_rushing_yards = 0
    team_first_downs = opp_first_downs = 0
    team_third_down_a = team_third_down_c = opp_third_down_a = opp_third_down_c = 0
    team_fourth_down_a = team_fourth_down_c = opp_fourth_down_a = opp_fourth_down_c = 0
    team_turnovers = opp_turnovers = 0
    for play in Plays.objects.filter(game=game):
        if play.startingFP < 50:
            location = f"{play.offense.abbreviation} {play.startingFP}"
        elif play.startingFP > 50:
            location = f"{play.defense.abbreviation} {100 - play.startingFP}"
        else:
            location = f"{play.startingFP}"

        if play.startingFP + play.yardsLeft >= 100:
            if play.down == 1:
                play.header = f"{play.down}st and goal at {location}"
            elif play.down == 2:
                play.header = f"{play.down}nd and goal at {location}"
            elif play.down == 3:
                play.header = f"{play.down}rd and goal at {location}"
            elif play.down == 4:
                play.header = f"{play.down}th and goal at {location}"
        else:
            if play.down == 1:
                play.header = f"{play.down}st and {play.yardsLeft} at {location}"
            elif play.down == 2:
                play.header = f"{play.down}nd and {play.yardsLeft} at {location}"
            elif play.down == 3:
                play.header = f"{play.down}rd and {play.yardsLeft} at {location}"
            elif play.down == 4:
                play.header = f"{play.down}th and {play.yardsLeft} at {location}"

        play.save()

        if play.offense == team:
            if play.playType == "pass":
                team_passing_yards += play.yardsGained
            elif play.playType == "run":
                team_rushing_yards += play.yardsGained
            if play.yardsGained >= play.yardsLeft:
                team_first_downs += 1
            if play.result == "interception" or play.result == "fumble":
                team_turnovers += 1
            elif play.down == 3:
                team_third_down_a += 1
                if play.yardsGained >= play.yardsLeft:
                    team_third_down_c += 1
            elif play.down == 4:
                if play.playType != "punt" and play.playType != "field goal attempt":
                    team_fourth_down_a += 1
                    if play.yardsGained >= play.yardsLeft:
                        team_fourth_down_c += 1
        elif play.offense == game.opponent:
            if play.playType == "pass":
                opp_passing_yards += play.yardsGained
            elif play.playType == "run":
                opp_rushing_yards += play.yardsGained
            if play.yardsGained >= play.yardsLeft:
                opp_first_downs += 1
            if play.result == "interception" or play.result == "fumble":
                opp_turnovers += 1
            elif play.down == 3:
                opp_third_down_a += 1
                if play.yardsGained >= play.yardsLeft:
                    opp_third_down_c += 1
            elif play.down == 4:
                if play.playType != "punt" and play.playType != "field goal attempt":
                    opp_fourth_down_a += 1
                    if play.yardsGained >= play.yardsLeft:
                        opp_fourth_down_c += 1

    team_yards = team_passing_yards + team_rushing_yards
    opp_yards = opp_passing_yards + opp_rushing_yards

    stats = {
        "total yards": {"team": team_yards, "opponent": opp_yards},
        "passing yards": {"team": team_passing_yards, "opponent": opp_passing_yards},
        "rushing yards": {"team": team_rushing_yards, "opponent": opp_rushing_yards},
        "1st downs": {"team": team_first_downs, "opponent": opp_first_downs},
        "3rd down conversions": {
            "team": team_third_down_c,
            "opponent": opp_third_down_c,
        },
        "3rd down attempts": {"team": team_third_down_a, "opponent": opp_third_down_a},
        "4th down conversions": {
            "team": team_fourth_down_c,
            "opponent": opp_fourth_down_c,
        },
        "4th down attempts": {
            "team": team_fourth_down_a,
            "opponent": opp_fourth_down_a,
        },
        "turnovers": {"team": team_turnovers, "opponent": opp_turnovers},
    }

    context = {
        "team": team,
        "game": game,
        "info": info,
        "conferences": conferences,
        "drives": drives,
        "stats": stats,
        "categorized_game_log_strings": categorized_game_log_strings,
    }

    return render(request, "game.html", context)


def setConferenceChampionships(info):
    conferences = Conferences.objects.filter(info=info)
    conferences_to_update = []

    games_to_create = []

    for conference in conferences:
        teams = conference.teams.order_by("-confWins", "ranking")

        teamA = teams[0]
        teamB = teams[1]

        game = scheduleGame(
            info,
            teamA,
            teamB,
            games_to_create,
            13,
            f"{conference.confName} championship",
        )[2]

        conference.championship = game
        conferences_to_update.append(conference)

    Games.objects.bulk_create(games_to_create)

    for conf in conferences_to_update:
        conf.save()


def setPlayoffR1(info):
    playoff = info.playoff
    games_to_create = []

    conferences = info.conferences.all()
    conference_champions = sorted(
        [conf.championship.winner for conf in conferences], key=lambda x: x.ranking
    )
    autobids = conference_champions[: playoff.autobids]
    byes = autobids[:4]
    no_bye_autobids = autobids[4:]

    wild_cards = info.teams.exclude(id__in=[team.id for team in autobids])
    wild_cards = sorted(wild_cards, key=lambda x: x.ranking)

    cutoff = 8 - (playoff.autobids - 4)
    non_playoff_teams = wild_cards[cutoff:]
    wild_cards = wild_cards[:cutoff]

    wild_cards.extend(no_bye_autobids)
    teams = byes + sorted(wild_cards, key=lambda x: x.ranking) + non_playoff_teams

    teams_to_update = []
    for i, team in enumerate(teams, 1):
        team.ranking = i
        teams_to_update.append(team)
    Teams.objects.bulk_update(teams_to_update, ["ranking"])

    playoff.seed_1, playoff.seed_2, playoff.seed_3, playoff.seed_4 = teams[:4]

    def schedule_playoff_game(team1, team2, description):
        return scheduleGame(info, team1, team2, games_to_create, 14, description)[2]

    playoff.left_r1_1 = schedule_playoff_game(teams[7], teams[8], "Playoff round 1")
    playoff.left_r1_2 = schedule_playoff_game(teams[4], teams[11], "Playoff round 1")
    playoff.right_r1_1 = schedule_playoff_game(teams[6], teams[9], "Playoff round 1")
    playoff.right_r1_2 = schedule_playoff_game(teams[5], teams[10], "Playoff round 1")

    Games.objects.bulk_create(games_to_create)
    playoff.save()


def setPlayoffQuarter(info):
    playoff = info.playoff
    games_to_create = []

    def schedule_playoff_game(team1, team2):
        return scheduleGame(
            info, team1, team2, games_to_create, 15, "Playoff quarterfinal"
        )[2]

    matchups = [
        ("left_quarter_1", playoff.seed_1, playoff.left_r1_1.winner),
        ("left_quarter_2", playoff.seed_4, playoff.left_r1_2.winner),
        ("right_quarter_1", playoff.seed_2, playoff.right_r1_1.winner),
        ("right_quarter_2", playoff.seed_3, playoff.right_r1_2.winner),
    ]

    for attr, team1, team2 in matchups:
        setattr(playoff, attr, schedule_playoff_game(team1, team2))

    Games.objects.bulk_create(games_to_create)
    playoff.save()


def setPlayoffSemi(info):
    playoff = info.playoff
    games_to_create = []

    def schedule_playoff_game(team1, team2, week):
        return scheduleGame(
            info, team1, team2, games_to_create, week, "Playoff semifinal"
        )[2]

    if playoff.teams == 4:
        teams = info.teams.order_by("ranking")
        playoff.left_semi = schedule_playoff_game(teams[0], teams[3], 14)
        playoff.right_semi = schedule_playoff_game(teams[1], teams[2], 14)
    elif playoff.teams == 12:
        playoff.left_semi = schedule_playoff_game(
            playoff.left_quarter_1.winner, playoff.left_quarter_2.winner, 16
        )
        playoff.right_semi = schedule_playoff_game(
            playoff.right_quarter_1.winner, playoff.right_quarter_2.winner, 16
        )

    Games.objects.bulk_create(games_to_create)
    playoff.save()


def setNatty(info):
    playoff = info.playoff
    games_to_create = []
    week_mapping = {4: 15, 12: 17}

    playoff.natty = scheduleGame(
        info,
        playoff.left_semi.winner,
        playoff.right_semi.winner,
        games_to_create,
        week_mapping.get(playoff.teams),
        "National Championship",
    )[2]

    Games.objects.bulk_create(games_to_create)
    playoff.save()


def update_game_log_for_run(play, game_log):
    game_log.rush_attempts += 1
    game_log.rush_yards += play.yardsGained
    if play.result == "touchdown":
        game_log.rush_touchdowns += 1
    elif play.result == "fumble":
        game_log.fumbles += 1


def update_game_log_for_pass(play, qb_game_log, receiver_game_log):
    qb_game_log.pass_attempts += 1
    if play.result in ["pass", "touchdown"]:
        qb_game_log.pass_completions += 1
        qb_game_log.pass_yards += play.yardsGained
        receiver_game_log.receiving_yards += play.yardsGained
        receiver_game_log.receiving_catches += 1
        if play.result == "touchdown":
            qb_game_log.pass_touchdowns += 1
            receiver_game_log.receiving_touchdowns += 1
    elif play.result == "interception":
        qb_game_log.pass_interceptions += 1


def format_play_text(play, player1, player2=None):
    if play.playType == "run":
        if play.result == "fumble":
            play.text = f"{player1.first} {player1.last} fumbled"
        elif play.result == "touchdown":
            play.text = f"{player1.first} {player1.last} ran {play.yardsGained} yards for a touchdown"
        else:
            play.text = (
                f"{player1.first} {player1.last} ran for {play.yardsGained} yards"
            )

    elif play.playType == "pass":
        if play.result == "sack":
            play.text = f"{player1.first} {player1.last} was sacked for a loss of {play.yardsGained} yards"
        elif play.result == "touchdown":
            play.text = f"{player1.first} {player1.last} completed a pass to {player2.first} {player2.last} for {play.yardsGained} yards resulting in a touchdown"
        elif play.result == "pass":
            play.text = f"{player1.first} {player1.last} completed a pass to {player2.first} {player2.last} for {play.yardsGained} yards"
        elif play.result == "interception":
            play.text = f"{player1.first} {player1.last}'s pass was intercepted"
        elif play.result == "incomplete pass":
            play.text = f"{player1.first} {player1.last}'s pass was incomplete"

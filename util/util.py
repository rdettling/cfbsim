from .schedule import *
from .players import *
from .sim.simtest import getSpread
from django.db import transaction


def update_teams_and_rosters(info, data):
    start = time.time()
    realignment(info, data)
    print(f"Realignment {time.time() - start} seconds")

    start = time.time()
    players_to_create = []

    loaded_names = load_names()
    for team in info.teams.all():
        if team.rating:
            fill_roster(team, loaded_names, players_to_create)
        else:
            init_roster(team, loaded_names, players_to_create)
    Players.objects.bulk_create(players_to_create)
    print(f"Fill rosters {time.time() - start} seconds")

    start = time.time()
    set_starters(info)
    print(f"Set starters {time.time() - start} seconds")

    start = time.time()
    get_ratings(info)
    print(f"Get ratings {time.time() - start} seconds")

    start = time.time()
    initialize_rankings(info)
    print(f"init rankings {time.time() - start} seconds")


def start_season(info):
    start = time.time()
    fillSchedules(info)
    print(f"fill schedules {time.time() - start} seconds")

    # aiRecruitOffers(info)

    info.currentWeek = 1
    info.stage = "season"
    info.save()


def realignment(info, data):
    info.playoff.teams = data["playoff"]["teams"]
    info.playoff.autobids = data["playoff"]["autobids"]
    info.playoff.lastWeek = data["playoff"]["lastWeek"]
    info.playoff.save()

    teams = info.teams.all()
    conferences = info.conferences.all()

    for conference in data["conferences"]:
        if not conferences.filter(confName=conference["confName"]).exists():
            Conferences.objects.create(
                info=info,
                confName=conference["confName"],
                confFullName=conference["confFullName"],
                confGames=conference["confGames"],
            )

        for team in conference["teams"]:
            try:
                Team = teams.get(name=team["name"])
                Team.conference = conferences.get(confName=conference["confName"])
                Team.confLimit = conference["confGames"]
                Team.nonConfLimit = 12 - conference["confGames"]
                Team.save()
            except Teams.DoesNotExist:
                Team = Teams.objects.create(
                    info=info,
                    name=team["name"],
                    abbreviation=team["abbreviation"],
                    prestige=team["prestige"],
                    mascot=team["mascot"],
                    colorPrimary=team["colorPrimary"],
                    colorSecondary=team["colorSecondary"],
                    conference=info.conferences.get(confName=conference["confName"]),
                    confLimit=conference["confGames"],
                    nonConfLimit=12 - conference["confGames"],
                    offers=25,
                    recruiting_points=get_recruiting_points(team["prestige"]),
                )

    for team in data["independents"]:
        try:
            Team = teams.get(name=team["name"])
            Team.conference = None
            Team.save()
        except Teams.DoesNotExist:
            Team = Teams.objects.create(
                info=info,
                name=team["name"],
                abbreviation=team["abbreviation"],
                prestige=team["prestige"],
                mascot=team["mascot"],
                colorPrimary=team["colorPrimary"],
                colorSecondary=team["colorSecondary"],
                conference=None,
                confLimit=0,
                nonConfLimit=12,
                offers=25,
                recruiting_points=get_recruiting_points(team["prestige"]),
            )

    with transaction.atomic():
        for conference in conferences:
            if conference.teams.count() == 0:
                conference.delete()


def initialize_rankings(info):
    teams = info.teams.all().order_by("-rating")

    for i, team in enumerate(teams, start=1):
        team.ranking = i
        team.last_rank = i

    Teams.objects.bulk_update(teams, ["ranking", "last_rank"])


def init(data, user_id, year):
    overall_start = time.time()

    Info.objects.filter(user_id=user_id).delete()
    # # delete_plays(info)
    # info.delete()

    info = Info.objects.create(
        user_id=user_id,
        currentWeek=1,
        currentYear=year,
        startYear=year,
    )

    playoff = Playoff.objects.create(
        info=info,
        teams=data["playoff"]["teams"],
        autobids=data["playoff"]["autobids"],
        lastWeek=data["playoff"]["lastWeek"],
    )
    info.playoff = playoff
    info.save()

    conferences_to_create = []
    teams_to_create = []
    players_to_create = []
    odds_to_create = []
    recruits_to_create = []

    for conference in data["conferences"]:
        Conference = Conferences(
            info=info,
            confName=conference["confName"],
            confFullName=conference["confFullName"],
            confGames=conference["confGames"],
        )
        conferences_to_create.append(Conference)

        for team in conference["teams"]:
            Team = Teams(
                info=info,
                name=team["name"],
                abbreviation=team["abbreviation"],
                prestige=team["prestige"],
                mascot=team["mascot"],
                colorPrimary=team["colorPrimary"],
                colorSecondary=team["colorSecondary"],
                conference=Conference,
                confLimit=conference["confGames"],
                nonConfLimit=12 - conference["confGames"],
                offers=25,
                recruiting_points=get_recruiting_points(team["prestige"]),
            )
            teams_to_create.append(Team)

    for team in data["independents"]:
        Team = Teams(
            info=info,
            name=team["name"],
            abbreviation=team["abbreviation"],
            prestige=team["prestige"],
            mascot=team["mascot"],
            colorPrimary=team["colorPrimary"],
            colorSecondary=team["colorSecondary"],
            conference=None,
            confLimit=conference["confGames"],
            nonConfLimit=12,
            offers=25,
            recruiting_points=get_recruiting_points(team["prestige"]),
        )
        teams_to_create.append(Team)

    start = time.time()
    Conferences.objects.bulk_create(conferences_to_create)
    Teams.objects.bulk_create(teams_to_create)
    print(f"Create teams, conferences {time.time() - start} seconds")

    teams = info.teams.all()

    start = time.time()

    loaded_names = load_names()
    for team in teams:
        init_roster(team, loaded_names, players_to_create)
    print(f"Init roster {time.time() - start} seconds")

    start = time.time()
    Players.objects.bulk_create(players_to_create)
    print(f"Create players {time.time() - start} seconds")

    start = time.time()
    get_ratings(info)
    print(f"Get ratings {time.time() - start} seconds")

    start = time.time()
    initialize_rankings(info)
    print(f"Init rankings {time.time() - start} seconds")

    start = time.time()
    odds_list = getSpread(
        teams.order_by("-rating").first().rating
        - teams.order_by("rating").first().rating
        + 10
    )
    for diff, odds_data in odds_list.items():
        odds_instance = Odds(
            info=info,
            diff=diff,
            favSpread=odds_data["favSpread"],
            udSpread=odds_data["udSpread"],
            favWinProb=(odds_data["favWinProb"]),
            udWinProb=(odds_data["udWinProb"]),
            favMoneyline=odds_data["favMoneyline"],
            udMoneyline=odds_data["udMoneyline"],
        )
        odds_to_create.append(odds_instance)
    Odds.objects.bulk_create(odds_to_create)
    print(f"Odds {time.time() - start} seconds")

    start = time.time()
    uniqueGames(info, data)
    print(f"unique games {time.time() - start} seconds")

    print(f"Total execution Time: {time.time() - overall_start} seconds")

    # generate_recruits(info, recruits_to_create)
    # Recruits.objects.bulk_create(recruits_to_create)


def update_rankings(info):
    teams = info.teams.all()
    games = info.games.filter(year=info.currentYear, winner=None)

    current_week_games = info.games.filter(
        year=info.currentYear, weekPlayed=info.currentWeek
    )

    games_by_teamA = {team.id: [] for team in teams}
    games_by_teamB = {team.id: [] for team in teams}

    for game in current_week_games:
        games_by_teamA[game.teamA.id].append(game)
        games_by_teamB[game.teamB.id].append(game)

    team_count = len(teams)
    win_factor = 172
    loss_factor = 157

    total_weeks = 12
    weeks_left = max(0, (total_weeks - info.currentWeek))
    inertia_scale = weeks_left / total_weeks

    for team in teams:
        last_rank = team.ranking
        team.last_rank = last_rank
        games_played = team.totalWins + team.totalLosses

        if info.currentWeek <= total_weeks:
            if games_played > 0:
                team.resume = team.resume_total / games_played

                games_as_teamA = games_by_teamA[team.id]
                games_as_teamB = games_by_teamB[team.id]
                schedule = games_as_teamA + games_as_teamB

                if schedule and schedule[-1].winner != team:
                    team.resume += max(
                        0, (loss_factor * (team_count - last_rank)) * inertia_scale
                    )
                else:
                    team.resume += max(
                        0, (win_factor * (team_count - last_rank)) * inertia_scale
                    )
                team.resume = round(team.resume, 1)
            else:
                team.resume += max(
                    0, (loss_factor * (team_count - last_rank)) * inertia_scale
                )
                team.resume = round(team.resume, 1)
        else:
            team.resume = round(team.resume_total / games_played, 1)

    sorted_teams = sorted(teams, key=lambda x: (-x.resume, x.last_rank))

    for i, team in enumerate(sorted_teams, start=1):
        team.ranking = i

    Teams.objects.bulk_update(sorted_teams, ["ranking", "last_rank", "resume"])

    for game in games:
        game.rankATOG = game.teamA.ranking
        game.rankBTOG = game.teamB.ranking

    Games.objects.bulk_update(games, ["rankATOG", "rankBTOG"])


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


def update_game_log_for_kick(play, game_log):
    if play.playType == "field goal":
        game_log.field_goals_attempted += 1
        if play.result == "made field goal":
            game_log.field_goals_made += 1


def set_play_header(play):
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


def format_play_text(play, player1, player2=None):
    player1 = f"{player1.first} {player1.last}"
    if player2:
        player2 = f"{player2.first} {player2.last}"
    if play.playType == "run":
        if play.result == "fumble":
            play.text = f"{player1} fumbled"
        elif play.result == "touchdown":
            play.text = f"{player1} ran {play.yardsGained} yards for a touchdown"
        else:
            play.text = f"{player1} ran for {play.yardsGained} yards"
    elif play.playType == "pass":
        if play.result == "sack":
            play.text = f"{player1} was sacked for a loss of {play.yardsGained} yards"
        elif play.result == "touchdown":
            play.text = f"{player1} pass complete to {player2} {play.yardsGained} yards for a touchdown"
        elif play.result == "pass":
            play.text = (
                f"{player1} pass complete to {player2} for {play.yardsGained} yards"
            )
        elif play.result == "interception":
            play.text = f"{player1}'s pass was intercepted"
        elif play.result == "incomplete pass":
            play.text = f"{player1}'s pass was incomplete"
    elif play.playType == "field goal":
        if play.result == "made field goal":
            play.text = f"{player1}'s {100 - play.startingFP + 17} field goal is good"
        elif play.result == "missed field goal":
            play.text = (
                f"{player1}'s {100 - play.startingFP + 17} field goal is no good"
            )
    elif play.playType == "punt":
        play.text = f"{player1} punted"


def make_game_logs(info, plays):
    desired_positions = {"qb", "rb", "wr", "k", "p"}
    game_log_dict = {}

    all_starters = info.players.filter(
        starter=True, pos__in=desired_positions
    ).select_related("team")

    # Group them by position and team
    starters_by_team_pos = {(player.team, player.pos): [] for player in all_starters}
    for player in all_starters:
        starters_by_team_pos[(player.team, player.pos)].append(player)

    # Get all unique games being simmed
    simmed_games = {play.game for play in plays}

    # Create a set to store (player, game) combinations for GameLog objects
    player_game_combinations = set()

    for game in simmed_games:
        for team in [game.teamA, game.teamB]:
            for pos in desired_positions:
                starters = starters_by_team_pos.get((team, pos))
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
    for play in plays:
        set_play_header(play)

        game = play.game
        offense_team = play.offense

        rb_starters = starters_by_team_pos.get((offense_team, "rb"))
        qb_starter = starters_by_team_pos.get((offense_team, "qb"))[0]
        wr_starters = starters_by_team_pos.get((offense_team, "wr"))
        k_starter = starters_by_team_pos.get((offense_team, "k"))[0]
        p_starter = starters_by_team_pos.get((offense_team, "p"))[0]

        if play.playType == "run":
            runner = random.choice(rb_starters)
            game_log = game_log_dict[(runner, game)]
            update_game_log_for_run(play, game_log)
            format_play_text(play, runner)
        elif play.playType == "pass":
            receiver = random.choice(wr_starters)
            qb_game_log = game_log_dict[(qb_starter, game)]
            receiver_game_log = game_log_dict[(receiver, game)]
            update_game_log_for_pass(play, qb_game_log, receiver_game_log)
            format_play_text(play, qb_starter, receiver)
        elif play.playType == "field goal":
            game_log = game_log_dict[(k_starter, game)]
            update_game_log_for_kick(play, game_log)
            format_play_text(play, k_starter)
        elif play.playType == "punt":
            format_play_text(play, p_starter)

    GameLog.objects.bulk_create(game_logs_to_process)


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


def get_recruiting_points(prestige):
    return prestige * 100

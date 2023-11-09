from .schedule import *
from .players import *
from .sim.simtest import getSpread


def init(data, user_id, year):
    Info.objects.filter(user_id=user_id).delete()
    info = Info.objects.create(
        user_id=user_id, currentWeek=1, currentYear=int(year) - 1
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
    games_to_create = []
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

    FCS = Teams(
        info=info,
        name="FCS",
        abbreviation="FCS",
        prestige=50,
        mascot="FCS",
        colorPrimary="#000000",
        colorSecondary="#FFFFFF",
        conference=None,
        confLimit=0,
        nonConfLimit=100,
        offers=0,
        recruiting_points=0,
    )
    teams_to_create.append(FCS)

    for team in teams_to_create:
        players(info, team, players_to_create)

    teams_to_create = sorted(
        teams_to_create, key=lambda team: team.rating, reverse=True
    )
    for i, team in enumerate(teams_to_create, start=1):
        team.ranking = i
        team.last_rank = i

    odds_list = getSpread(teams_to_create[0].rating - teams_to_create[-1].rating)

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

    Conferences.objects.bulk_create(conferences_to_create)
    Teams.objects.bulk_create(teams_to_create)
    Players.objects.bulk_create(players_to_create)
    Odds.objects.bulk_create(odds_to_create)

    uniqueGames(info, data, games_to_create)
    Games.objects.bulk_create(games_to_create)

    generate_recruits(info, recruits_to_create)
    Recruits.objects.bulk_create(recruits_to_create)


def update_rankings(info):
    teams = info.teams.all()
    games = info.games.all()

    team_count = len(teams)
    win_factor = 172
    loss_factor = 155

    total_weeks = 12
    weeks_left = max(0, (total_weeks - info.currentWeek))
    inertia_scale = weeks_left / total_weeks

    for team in teams:
        last_rank = team.ranking
        team.last_rank = last_rank

        games_played = team.totalWins + team.totalLosses

        if games_played > 0:
            team.resume = team.resume_total / games_played

            games_as_teamA = team.games_as_teamA.filter(weekPlayed=info.currentWeek)
            games_as_teamB = team.games_as_teamB.filter(weekPlayed=info.currentWeek)
            schedule = list(games_as_teamA | games_as_teamB)
            if schedule and schedule[-1].winner != team:
                team.resume += max(
                    0, (loss_factor * (team_count - last_rank)) * inertia_scale
                )
            else:
                team.resume += max(
                    0, (win_factor * (team_count - last_rank)) * inertia_scale
                )
            team.resume = round(team.resume, 1)
        elif team.name != "FCS":
            team.resume += max(
                0, (win_factor * (team_count - last_rank)) * inertia_scale
            )

    sorted_teams = sorted(teams, key=lambda x: (-x.resume, x.last_rank))

    for i, team in enumerate(sorted_teams, start=1):
        team.ranking = i
        team.save()

    for game in games:
        if not game.winner:
            game.rankATOG = game.teamA.ranking
            game.rankBTOG = game.teamB.ranking
        game.save()


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


def get_recruiting_points(prestige):
    return prestige * 100

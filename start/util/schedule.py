import random
from ..models import *


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
    playoff.refresh_from_db()
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
    playoff.refresh_from_db()
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

    print(playoff.left_semi.teamA.name)

    Games.objects.bulk_create(games_to_create)
    playoff.save()


def scheduleGame(
    info,
    team,
    opponent,
    games_to_create,
    weekPlayed=None,
    gameName=None,
):
    odds = Odds.objects.get(info=info, diff=abs(team.rating - opponent.rating))

    if gameName:
        labelA = labelB = gameName
    else:
        if team.conference and opponent.conference:
            if team.conference == opponent.conference:
                labelA = labelB = f"C ({team.conference.confName})"
            else:
                labelA = f"NC ({opponent.conference.confName})"
                labelB = f"NC ({team.conference.confName})"
        elif not team.conference and opponent.conference:
            labelA = f"NC ({opponent.conference.confName})"
            labelB = "NC (Ind)"
        elif not opponent.conference and team.conference:
            labelA = "NC (Ind)"
            labelB = f"NC ({team.conference.confName})"
        else:
            labelA = "NC (Ind)"
            labelB = "NC (Ind)"

    is_teamA_favorite = True  # Default to true

    if opponent.rating > team.rating:
        is_teamA_favorite = False

    game = Games(
        info=info,
        teamA=team,
        teamB=opponent,
        labelA=labelA,
        labelB=labelB,
        spreadA=odds.favSpread
        if is_teamA_favorite or team.rating == opponent.rating
        else odds.udSpread,
        spreadB=odds.udSpread
        if is_teamA_favorite or team.rating == opponent.rating
        else odds.favSpread,
        moneylineA=odds.favMoneyline
        if is_teamA_favorite or team.rating == opponent.rating
        else odds.udMoneyline,
        moneylineB=odds.udMoneyline
        if is_teamA_favorite or team.rating == opponent.rating
        else odds.favMoneyline,
        winProbA=odds.favWinProb
        if is_teamA_favorite or team.rating == opponent.rating
        else odds.udWinProb,
        winProbB=odds.udWinProb
        if is_teamA_favorite or team.rating == opponent.rating
        else odds.favWinProb,
        weekPlayed=weekPlayed if weekPlayed else 0,
        rankATOG=team.ranking,
        rankBTOG=opponent.ranking,
    )

    games_to_create.append(game)

    if team.conference:
        if team.conference == opponent.conference:
            team.confGames += 1
            opponent.confGames += 1
        else:
            team.nonConfGames += 1
            opponent.nonConfGames += 1
    else:
        team.nonConfGames += 1
        opponent.nonConfGames += 1

    return team, opponent, game


def refresh_teams_and_games(info):
    info.games.all().delete()

    teams = info.teams.all()

    for team in teams:
        team.confGames = 0
        team.confWins = 0
        team.confLosses = 0
        team.nonConfGames = 0
        team.nonConfWins = 0
        team.nonConfLosses = 0
        team.gamesPlayed = 0
        team.totalWins = 0
        team.totalLosses = 0
        team.resume_total = 0
        team.resume = 0

        team.save()


def setNatty(info):
    playoff = info.playoff
    playoff.refresh_from_db()
    games_to_create = []
    week_mapping = {4: 15, 12: 17}

    print(playoff.left_semi.teamA.name)
    print(playoff.left_semi.scoreA)

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


def end_season(info):
    info.stage = "end of season"


def setConferenceChampionships(info):
    info.refresh_from_db()
    games_to_create = []
    conferences = info.conferences.all()

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

    Games.objects.bulk_create(games_to_create)

    for conference in conferences:
        conference.save()


def uniqueGames(info, data):
    games_to_create = []
    games = data["rivalries"]
    teams = list(Teams.objects.filter(info=info))

    for team in teams:
        team.schedule = set()

    scheduled_games = {}

    for game in games:
        for team_name in [game[0], game[1]]:
            if team_name not in scheduled_games:
                scheduled_games[team_name] = set()

        if game[2] is not None:
            scheduled_games[game[0]].add(game[2])
            scheduled_games[game[1]].add(game[2])

    for game in games:
        for team in teams:
            if team.name == game[0]:
                for opponent in teams:
                    if opponent.name == game[1]:
                        if game[2] is None:
                            game_week = random.choice(
                                list(
                                    set(range(1, 13))
                                    - scheduled_games[game[0]]
                                    - scheduled_games[game[1]]
                                )
                            )
                        else:
                            game_week = game[2]

                        scheduled_games[game[0]].add(game_week)
                        scheduled_games[game[1]].add(game_week)

                        team, opponent, Game = scheduleGame(
                            info,
                            team,
                            opponent,
                            games_to_create,
                            game_week,
                            game[3],
                        )

                        team.save()
                        opponent.save()

    Games.objects.bulk_create(games_to_create)


def fillSchedules(info):
    teams = list(info.teams.all())
    conferences = list(info.conferences.all())
    random.shuffle(teams)
    random.shuffle(conferences)

    scheduled_games = {}
    games_to_create = []

    for team in teams:
        opponents_as_teamA = Games.objects.filter(info=info, teamA=team).values_list(
            "teamB__name", flat=True
        )
        opponents_as_teamB = Games.objects.filter(info=info, teamB=team).values_list(
            "teamA__name", flat=True
        )
        scheduled_games[team.name] = set(opponents_as_teamA).union(opponents_as_teamB)

    for team in teams:
        if not team.conference and team.name != "FCS":
            while team.nonConfGames < team.nonConfLimit:

                def potential_opponents(team):
                    return [
                        opponent
                        for opponent in teams
                        if opponent.nonConfGames < opponent.nonConfLimit
                        and opponent.name not in scheduled_games[team.name]
                        and opponent.name != "FCS"
                        and opponent != team
                    ]

                valid_opponents = potential_opponents(team)

                constraints = {
                    opponent: {
                        "potential": len(potential_opponents(opponent)),
                        "needed": opponent.nonConfLimit - opponent.nonConfGames,
                    }
                    for opponent in valid_opponents
                }

                valid_opponents.sort(
                    key=lambda o: constraints[o]["potential"] - constraints[o]["needed"]
                )

                opponent = valid_opponents[0]
                team, opponent, game = scheduleGame(
                    info,
                    team,
                    opponent,
                    games_to_create,
                )
                scheduled_games[team.name].add(opponent.name)
                scheduled_games[opponent.name].add(team.name)

    for conference in conferences:
        confTeams = [team for team in teams if team.conference == conference]

        def potential_opponents(team):
            return [
                opponent
                for opponent in teams
                if opponent.nonConfGames < opponent.nonConfLimit
                and opponent.name not in scheduled_games[team.name]
                and opponent.conference != team.conference
                and opponent.name != "FCS"
            ]

        for team in confTeams:
            while team.nonConfGames < team.nonConfLimit:
                valid_opponents = potential_opponents(team)

                constraints = {
                    opponent: {
                        "potential": len(potential_opponents(opponent)),
                        "needed": opponent.nonConfLimit - opponent.nonConfGames,
                    }
                    for opponent in valid_opponents
                }

                valid_opponents.sort(
                    key=lambda o: constraints[o]["potential"] - constraints[o]["needed"]
                )

                try:
                    opponent = valid_opponents[0]
                    team, opponent, game = scheduleGame(
                        info,
                        team,
                        opponent,
                        games_to_create,
                    )
                    scheduled_games[team.name].add(opponent.name)
                    scheduled_games[opponent.name].add(team.name)
                except:
                    fcs = next((team for team in teams if team.name == "FCS"))
                    team, fcs, game = scheduleGame(info, team, fcs, games_to_create)

        confTeamsList = confTeams[:]

        def potential_opponents(team):
            return [
                opponent
                for opponent in confTeamsList
                if opponent.confGames < opponent.confLimit
                and opponent.name not in scheduled_games[team.name]
                and opponent != team
            ]

        while confTeams:
            confTeams.sort(key=lambda team: team.confGames)
            for team in confTeams:
                print(f"{team.name}: {team.confGames}")
            team = confTeams.pop(0)

            while team.confGames < team.confLimit:
                valid_opponents = potential_opponents(team)

                constraints = {
                    opponent: {
                        "potential": len(potential_opponents(opponent)),
                        "needed": opponent.confLimit - opponent.confGames,
                    }
                    for opponent in valid_opponents
                }

                valid_opponents.sort(
                    key=lambda o: constraints[o]["potential"] - constraints[o]["needed"]
                )

                opponent = valid_opponents[0]
                team, opponent, game = scheduleGame(
                    info,
                    team,
                    opponent,
                    games_to_create,
                )
                scheduled_games[team.name].add(opponent.name)
                scheduled_games[opponent.name].add(team.name)

    teams = sorted(teams, key=lambda team: team.prestige, reverse=True)

    for currentWeek in range(1, 13):
        already_scheduled = Games.objects.filter(info=info, weekPlayed=currentWeek)

        for game in already_scheduled:
            for team in teams:
                if team == game.teamA or team == game.teamB:
                    team.gamesPlayed += 1

        for team in teams:
            if team.gamesPlayed < currentWeek:
                filtered_games = [
                    game
                    for game in games_to_create
                    if game.teamA == team or game.teamB == team
                ]
                filtered_games = [
                    game for game in filtered_games if game.weekPlayed == 0
                ]
                for game in filtered_games:
                    if team.gamesPlayed >= currentWeek:
                        break
                    for opponent in teams:
                        if game.teamA == team:
                            if (
                                opponent.gamesPlayed < currentWeek
                                and opponent == game.teamB
                            ):
                                game.weekPlayed = currentWeek
                                team.gamesPlayed += 1
                                opponent.gamesPlayed += 1
                        elif game.teamB == team:
                            if (
                                opponent.gamesPlayed < currentWeek
                                and opponent == game.teamA
                            ):
                                game.weekPlayed = currentWeek
                                team.gamesPlayed += 1
                                opponent.gamesPlayed += 1

    Games.objects.bulk_create(games_to_create)
    Teams.objects.bulk_update(teams, ["confGames", "nonConfGames"])

import random
from start.models import *


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

    for matchup in matchups:
        print(f"Matchup: {matchup[0]} - {matchup[1]} vs {matchup[2]}")

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

    Games.objects.bulk_create(games_to_create)
    playoff.save()


def scheduleGame(
    info,
    team,
    opponent,
    games_to_create,
    weekPlayed=None,
    gameName=None,
    odds_list=None,
):
    if not odds_list:
        odds = info.odds.get(diff=abs(team.rating - opponent.rating))
    else:
        odds = odds_list.get(diff=abs(team.rating - opponent.rating))

    if gameName:
        base_label = gameName
    else:
        if team.conference and opponent.conference:
            if team.conference == opponent.conference:
                base_label = f"Conference: {team.conference.confName}"
            else:
                base_label = f"Non-Conference: {team.conference.confName} vs {opponent.conference.confName}"
        elif not team.conference and opponent.conference:
            base_label = (
                f"Non-Conference: Independent vs {opponent.conference.confName}"
            )
        elif not opponent.conference and team.conference:
            base_label = f"Non-Conference: {team.conference.confName} vs Independent"
        else:
            base_label = "Non-Conference: Independent vs Independent"

    is_teamA_favorite = True  # Default to true

    if opponent.rating > team.rating:
        is_teamA_favorite = False

    game = Games(
        info=info,
        teamA=team,
        year=info.currentYear,
        teamB=opponent,
        base_label=base_label,
        name=gameName,
        spreadA=(
            odds.favSpread
            if is_teamA_favorite or team.rating == opponent.rating
            else odds.udSpread
        ),
        spreadB=(
            odds.udSpread
            if is_teamA_favorite or team.rating == opponent.rating
            else odds.favSpread
        ),
        moneylineA=(
            odds.favMoneyline
            if is_teamA_favorite or team.rating == opponent.rating
            else odds.udMoneyline
        ),
        moneylineB=(
            odds.udMoneyline
            if is_teamA_favorite or team.rating == opponent.rating
            else odds.favMoneyline
        ),
        winProbA=(
            odds.favWinProb
            if is_teamA_favorite or team.rating == opponent.rating
            else odds.udWinProb
        ),
        winProbB=(
            odds.udWinProb
            if is_teamA_favorite or team.rating == opponent.rating
            else odds.favWinProb
        ),
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


def update_history(info):
    teams = info.teams.all()

    years = []

    for team in teams:
        years.append(
            Years(
                info=info,
                team=team,
                year=info.currentYear,
                wins=team.totalWins,
                losses=team.totalLosses,
                prestige=team.prestige,
                rating=team.rating,
                rank=team.ranking,
                conference=(
                    team.conference.confName if team.conference else "Independent"
                ),
            )
        )

    Years.objects.bulk_create(years)


def refresh_teams_and_games(info):
    teams = info.teams.all()
    info.plays.all().delete()
    info.drives.all().delete()

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

    Teams.objects.bulk_update(
        teams,
        [
            "confGames",
            "confWins",
            "confLosses",
            "nonConfGames",
            "nonConfWins",
            "nonConfLosses",
            "gamesPlayed",
            "totalWins",
            "totalLosses",
            "resume_total",
            "resume",
        ],
    )


def setNatty(info):
    playoff = info.playoff
    playoff.refresh_from_db()
    games_to_create = []
    week_mapping = {2: 14, 4: 15, 12: 17}

    if playoff.teams == 2:
        teams = info.teams.order_by("ranking")

        playoff.natty = scheduleGame(
            info,
            teams[0],
            teams[1],
            games_to_create,
            week_mapping.get(playoff.teams),
            "National Championship",
        )[2]
    else:
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


def setConferenceChampionships(info):
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
    Conferences.objects.bulk_update(conferences, ["championship"])


def set_rivalries(info, rivalries):
    odds = info.odds.all()
    games_to_create = []
    teams = info.teams.all()

    for team in teams:
        team.schedule = set()

    scheduled_games = {}

    for game in rivalries:
        for team_name in [game[0], game[1]]:
            if team_name not in scheduled_games:
                scheduled_games[team_name] = set()

        if game[2] is not None:
            scheduled_games[game[0]].add(game[2])
            scheduled_games[game[1]].add(game[2])

    for game in rivalries:
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
                            odds,
                        )

    Teams.objects.bulk_update(teams, ["confGames", "nonConfGames"])
    Games.objects.bulk_create(games_to_create)


def fillSchedules(info):
    start = time.time()
    teams = list(info.teams.all())
    conferences = list(info.conferences.all())
    games = info.games.filter(year=info.currentYear)
    odds_list = info.odds.all()

    random.shuffle(teams)
    random.shuffle(conferences)

    scheduled_games = {team.name: set() for team in teams}
    games_to_create = []

    for game in games:
        scheduled_games[game.teamA.name].add(game.teamB.name)
        scheduled_games[game.teamB.name].add(game.teamA.name)

    def potential_opponents(team):
        return [
            opponent
            for opponent in teams
            if opponent.nonConfGames < opponent.nonConfLimit
            and opponent.name not in scheduled_games[team.name]
            and (
                opponent.conference != team.conference
                or (
                    team.conference is None
                    and opponent.conference is None
                    and team is not opponent
                )
            )
        ]

    print(f"First part {time.time() - start} seconds")
    start = time.time()
    teamsList = teams[:]
    while teamsList:
        for team in teamsList:
            team.potential = potential_opponents(team)
            team.buffer = len(team.potential) - (team.nonConfLimit - team.nonConfGames)

        teamsList.sort(key=lambda team: (team.buffer, team.nonConfGames))
        team = teamsList.pop(0)
        team.potential.sort(key=lambda o: (o.buffer, o.nonConfGames))

        while team.nonConfGames < team.nonConfLimit:
            opponent = team.potential.pop(0)
            team, opponent, game = scheduleGame(
                info, team, opponent, games_to_create, odds_list=odds_list
            )
            scheduled_games[team.name].add(opponent.name)
            scheduled_games[opponent.name].add(team.name)

    print(f"Noncon {time.time() - start} seconds")

    start = time.time()
    for conference in conferences:
        confTeams = [team for team in teams if team.conference == conference]
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
            for team in confTeams:
                team.potential = potential_opponents(team)
                team.buffer = len(team.potential) - (team.confLimit - team.confGames)

            confTeams.sort(key=lambda team: (team.buffer, team.confGames))
            team = confTeams.pop(0)
            team.potential.sort(key=lambda o: (o.buffer, o.confGames))

            while team.confGames < team.confLimit:
                opponent = team.potential.pop(0)
                team, opponent, game = scheduleGame(
                    info, team, opponent, games_to_create, odds_list=odds_list
                )
                scheduled_games[team.name].add(opponent.name)
                scheduled_games[opponent.name].add(team.name)

    print(f"Conf {time.time() - start} seconds")

    start = time.time()
    teams = sorted(teams, key=lambda team: team.prestige, reverse=True)

    all_games = info.games.filter(year=info.currentYear)

    for currentWeek in range(1, 13):
        already_scheduled = all_games.filter(weekPlayed=currentWeek)

        for game in already_scheduled:
            for team in teams:
                if team == game.teamA or team == game.teamB:
                    team.gamesPlayed += 1

        for team in teams:
            if team.gamesPlayed < currentWeek:
                filtered_games = [
                    game
                    for game in games_to_create
                    if (game.teamA == team or game.teamB == team)
                    and game.weekPlayed == 0
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
    print(f"Assign weeks {time.time() - start} seconds")

    start = time.time()
    Games.objects.bulk_create(games_to_create)
    Teams.objects.bulk_update(teams, ["confGames", "nonConfGames"])

    print(f"End {time.time() - start} seconds")

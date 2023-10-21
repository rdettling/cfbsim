from django.http import JsonResponse
from django.shortcuts import render
import json
import random
from .models import *
from django.db.models import F
import static.code.names as names
import static.code.simtest as simtest


def launch(request):
    if not request.session.session_key:
        request.session.create()

    user_id = request.session.session_key

    try:
        info = Info.objects.get(user_id=user_id)
    except:
        info = None

    context = {"info": info}

    return render(request, "launch.html", context)


def preview(request):
    user_id = request.session.session_key
    year = request.GET.get("year")

    with open(f"static/years/{year}.json", "r") as metadataFile:
        data = json.load(metadataFile)

        info = init(data, user_id, year)

    context = {
        "info": info,
        "year": year,
        "data": data,
    }

    return render(request, "preview.html", context)


def pickteam(request):
    user_id = request.session.session_key

    info = Info.objects.get(user_id=user_id)
    teams = list(Teams.objects.filter(info=info).order_by("-prestige"))

    context = {
        "teams": teams,
    }

    return render(request, "pickteam.html", context)


def noncon(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team_name = request.GET.get("team_name")
    team = Teams.objects.get(info=info, name=team_name)
    info.team = team
    info.save()

    games_as_teamA = team.games_as_teamA.all()
    games_as_teamB = team.games_as_teamB.all()
    schedule = list(games_as_teamA | games_as_teamB)
    schedule = sorted(schedule, key=lambda game: game.weekPlayed)

    class EmptyGame:
        pass

    full_schedule = [None] * 12

    for game in schedule:
        full_schedule[game.weekPlayed - 1] = game

    for index, week in enumerate(full_schedule):
        if week is not None:
            if week.teamA == team:
                week.opponent = week.teamB.name
                week.label = week.labelA
            else:
                week.opponent = week.teamA.name
                week.label = week.labelB
        else:
            empty_game = EmptyGame()
            empty_game.weekPlayed = index + 1
            empty_game.opponent = None
            empty_game.label = "No Game"
            full_schedule[index] = empty_game

    context = {"schedule": full_schedule, "team": team}

    return render(request, "noncon.html", context)


def fetch_teams(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    week = int(request.GET.get("week"))

    scheduled_teams_as_teamA = Games.objects.filter(
        info=info, weekPlayed=week
    ).values_list("teamA", flat=True)

    scheduled_teams_as_teamB = Games.objects.filter(
        info=info, weekPlayed=week
    ).values_list("teamB", flat=True)

    scheduled_teams = scheduled_teams_as_teamA.union(scheduled_teams_as_teamB)

    opponents_as_teamA = Games.objects.filter(info=info, teamA=info.team).values_list(
        "teamB", flat=True
    )
    opponents_as_teamB = Games.objects.filter(info=info, teamB=info.team).values_list(
        "teamA", flat=True
    )
    all_opponents = opponents_as_teamA.union(opponents_as_teamB)

    eligible_teams = (
        Teams.objects.filter(info=info, nonConfGames__lt=F("nonConfLimit"))
        .exclude(id__in=scheduled_teams)
        .exclude(
            id__in=all_opponents
        )  # Exclude all teams that info.team has played against
        .exclude(id=info.team.id)
        .exclude(conference=info.team.conference)
        .order_by("name")
        .values_list("name", flat=True)
    )

    teams = list(eligible_teams)

    return JsonResponse(teams, safe=False)


def schedulenc(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    opponent_name = request.POST.get("opponent")
    week = int(request.POST.get("week"))

    team = info.team
    opponent = Teams.objects.get(info=info, name=opponent_name)

    team.schedule = opponent.schedule = set()

    games_to_create = []

    scheduleGame(
        info,
        team,
        opponent,
        games_to_create,
        week,
    )

    team.save()
    opponent.save()
    games_to_create[0].save()

    return JsonResponse({"status": "success"})


def init(data, user_id, year):
    Info.objects.filter(user_id=user_id).delete()
    info = Info.objects.create(user_id=user_id, currentWeek=1, currentYear=year)

    playoff = Playoff.objects.create(
        info=info,
        teams=data["playoff"]["teams"],
        autobids=data["playoff"]["autobids"],
    )
    info.playoff = playoff
    info.save()

    Teams.objects.filter(info=info).delete()
    Players.objects.filter(info=info).delete()
    Conferences.objects.filter(info=info).delete()
    Games.objects.filter(info=info).delete()
    Drives.objects.filter(info=info).delete()
    Plays.objects.filter(info=info).delete()

    teams_to_create = []
    conferences_to_create = []
    players_to_create = []
    games_to_create = []

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
                confGames=0,
                confLimit=conference["confGames"],
                confWins=0,
                confLosses=0,
                nonConfGames=0,
                nonConfLimit=12 - conference["confGames"],
                nonConfWins=0,
                nonConfLosses=0,
                gamesPlayed=0,
                totalWins=0,
                totalLosses=0,
                resume_total=0,
                resume=0,
                expectedWins=0,
                ranking=0,
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
            confGames=0,
            confLimit=0,
            confWins=0,
            confLosses=0,
            nonConfGames=0,
            nonConfLimit=12,
            nonConfWins=0,
            nonConfLosses=0,
            gamesPlayed=0,
            totalWins=0,
            totalLosses=0,
            resume_total=0,
            resume=0,
            expectedWins=0,
            ranking=0,
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
        confGames=0,
        confLimit=0,
        confWins=0,
        confLosses=0,
        nonConfGames=0,
        nonConfLimit=100,
        nonConfWins=0,
        nonConfLosses=0,
        gamesPlayed=0,
        totalWins=0,
        totalLosses=0,
        resume_total=0,
        resume=0,
        expectedWins=0,
        ranking=0,
    )
    teams_to_create.append(FCS)

    for team in teams_to_create:
        players(info, team, players_to_create)

    teams_to_create = sorted(
        teams_to_create, key=lambda team: team.rating, reverse=True
    )
    for i, team in enumerate(teams_to_create, start=1):
        team.ranking = i

    odds_list = simtest.getSpread(
        teams_to_create[0].rating - teams_to_create[-1].rating
    )

    odds_to_insert = []

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
        odds_to_insert.append(odds_instance)

    Conferences.objects.bulk_create(conferences_to_create)

    Teams.objects.bulk_create(teams_to_create)

    Odds.objects.bulk_create(odds_to_insert)

    uniqueGames(info, data, games_to_create)

    Players.objects.bulk_create(players_to_create)
    Games.objects.bulk_create(games_to_create)


def fillSchedules(info):
    teams = list(Teams.objects.filter(info=info))
    conferences = list(Conferences.objects.filter(info=info))
    random.shuffle(teams)
    random.shuffle(conferences)

    scheduled_games = {}

    for team in teams:
        opponents_as_teamA = Games.objects.filter(info=info, teamA=team).values_list(
            "teamB__name", flat=True
        )
        opponents_as_teamB = Games.objects.filter(info=info, teamB=team).values_list(
            "teamA__name", flat=True
        )
        scheduled_games[team.name] = set(opponents_as_teamA).union(opponents_as_teamB)

    games_to_create = []

    for team in teams:
        if not team.conference and team.name != "FCS":
            done = False
            while team.nonConfGames < team.nonConfLimit:
                for i in range(2):
                    for opponent in teams:
                        if team.nonConfGames == team.nonConfLimit:
                            done = True
                            break
                        if (
                            opponent.nonConfGames < opponent.nonConfLimit
                            and opponent.name not in scheduled_games[team.name]
                            and opponent.name != team.name
                            and opponent.nonConfGames == i
                            # and opponent.name != "FCS"
                        ):
                            team, opponent, game = scheduleGame(
                                info,
                                team,
                                opponent,
                                games_to_create,
                            )
                            scheduled_games[team.name].add(opponent.name)
                            scheduled_games[opponent.name].add(team.name)
                    if done:
                        break

            team.save()

    for conference in conferences:
        confTeams = [team for team in teams if team.conference == conference]
        confTeams.sort(key=lambda team: team.nonConfGames)

        for team in confTeams:

            def potential_opponents(team):
                return [
                    opponent
                    for opponent in teams
                    if opponent.nonConfGames < opponent.nonConfLimit
                    and opponent.name not in scheduled_games[team.name]
                    and opponent.conference != team.conference
                    and opponent.name != "FCS"
                ]

            while team.nonConfGames < team.nonConfLimit:
                valid_opponents = potential_opponents(team)

                valid_opponents.sort(
                    key=lambda o: len(potential_opponents(o))
                    - (o.nonConfLimit - o.nonConfGames)
                )

                try:
                    opponent = valid_opponents[0]
                    team, opponent, game = scheduleGame(
                        info,
                        team,
                        opponent,
                        games_to_create,
                    )
                except:
                    fcs = next((team for team in teams if team.name == "FCS"))
                    team, fcs, game = scheduleGame(info, team, fcs, games_to_create)
                scheduled_games[team.name].add(opponent.name)
                scheduled_games[opponent.name].add(team.name)

        confTeamsList = confTeams[:]
        while confTeams:

            def potential_opponents(team):
                return [
                    opponent
                    for opponent in confTeamsList
                    if opponent.confGames < opponent.confLimit
                    and opponent.name not in scheduled_games[team.name]
                    and opponent.name != team.name
                ]

            confTeams.sort(key=lambda team: team.confGames)
            team = confTeams.pop(0)

            while team.confGames < team.confLimit:
                valid_opponents = potential_opponents(team)

                valid_opponents.sort(
                    key=lambda o: len(potential_opponents(o))
                    - (o.confLimit - o.confGames)
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

            team.save()

    teams = sorted(teams, key=lambda team: team.prestige, reverse=True)

    for currentWeek in range(1, 13):
        games = Games.objects.filter(info=info, weekPlayed=currentWeek)

        for game in games:
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


def players(info, team, players_to_create):
    roster = {
        "qb": 1,
        "rb": 1,
        "wr": 3,
        "te": 1,
        "ol": 5,
        "dl": 4,
        "lb": 3,
        "cb": 2,
        "s": 2,
        "k": 1,
        "p": 1,
    }

    variance = 15
    years = ["fr", "so", "jr", "sr"]

    # You can adjust these values or make them dynamic if needed.
    progression = {
        "fr": 0,  # Freshman usually start at their initial rating.
        "so": 3,  # Sophomores progress by 3 points.
        "jr": 6,  # Juniors progress by 6 points.
        "sr": 9,  # Seniors progress by 9 points.
    }

    all_players = (
        []
    )  # Use this to keep track of all players before adding to players_to_create

    for position, count in roster.items():
        position_players = []  # Keep track of players for this specific position

        for i in range(2 * count + 1):
            first, last = names.generateName(position)
            year = random.choice(years)

            base_rating = team.prestige - random.randint(0, variance) - 5
            progressed_rating = base_rating + progression[year]

            player = Players(
                info=info,
                team=team,
                first=first,
                last=last,
                year=year,
                pos=position,
                rating=progressed_rating,
                starter=False,
            )

            position_players.append(player)

        # Sort position_players by rating in descending order and set top players as starters
        position_players.sort(key=lambda x: x.rating, reverse=True)
        for i in range(roster[position]):
            position_players[i].starter = True

        all_players.extend(position_players)

    # Define positions categorically.
    offensive_positions = ["qb", "rb", "wr", "te", "ol"]
    defensive_positions = ["dl", "lb", "cb", "s"]

    offensive_weights = {"qb": 40, "rb": 10, "wr": 25, "te": 5, "ol": 20}

    defensive_weights = {"dl": 35, "lb": 20, "cb": 30, "s": 15}

    # Extract starters from all_players.
    offensive_starters = [
        player
        for player in all_players
        if player.pos in offensive_positions and player.starter
    ]
    defensive_starters = [
        player
        for player in all_players
        if player.pos in defensive_positions and player.starter
    ]

    # Compute the weighted average ratings.
    team.offense = (
        round(
            sum(
                player.rating * offensive_weights[player.pos]
                for player in offensive_starters
            )
            / sum(offensive_weights[player.pos] for player in offensive_starters)
        )
        if offensive_starters
        else 0
    )
    team.defense = (
        round(
            sum(
                player.rating * defensive_weights[player.pos]
                for player in defensive_starters
            )
            / sum(defensive_weights[player.pos] for player in defensive_starters)
        )
        if defensive_starters
        else 0
    )

    # Set the weights for offense and defense
    offense_weight = 0.60
    defense_weight = 0.40

    # Calculate the team rating
    team.rating = round(
        (team.offense * offense_weight) + (team.defense * defense_weight)
    )

    players_to_create.extend(all_players)


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
        overtime=0,
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


def uniqueGames(info, data, games_to_create):
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

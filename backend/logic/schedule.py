import random
from api.models import *
import json
from django.db.models import F, ExpressionWrapper, FloatField
import time
from .util import time_section, watchability


def get_playoff_team_order(info):
    """
    Determine the correct playoff team order using the same logic as setPlayoffR1.
    This function is used for 12-team playoff scheduling and bracket projections.

    Args:
        info: Info object containing playoff configuration

    Returns:
        List of teams in the correct playoff order
    """
    playoff = info.playoff

    # Get conference champions (this would normally come from championship games)
    conferences = info.conferences.all()
    conference_champions = []
    for conference in conferences:
        if conference.championship and conference.championship.winner:
            conference_champions.append(conference.championship.winner)
        else:
            # Fallback to top team in conference if no championship played yet
            conf_teams = conference.teams.annotate(
                win_percentage=ExpressionWrapper(
                    F("confWins") * 1.0 / (F("confWins") + F("confLosses")),
                    output_field=FloatField(),
                )
            ).order_by("-win_percentage", "-confWins", "ranking", "-totalWins")
            if conf_teams.exists():
                conference_champions.append(conf_teams.first())

    conference_champions = sorted(conference_champions, key=lambda x: x.ranking)

    # Get playoff settings
    playoff_autobids = info.settings.playoff_autobids or 0
    playoff_conf_champ_top_4 = info.settings.playoff_conf_champ_top_4

    # Apply the same logic as setPlayoffR1
    autobids = conference_champions[: playoff_autobids]

    # Get wild cards (non-autobid teams)
    autobid_ids = [team.id for team in autobids]
    wild_cards = info.teams.exclude(id__in=autobid_ids)
    wild_cards = sorted(wild_cards, key=lambda x: x.ranking)

    # Calculate cutoff for playoff teams
    cutoff = 8 - (playoff_autobids - 4)
    non_playoff_teams = wild_cards[cutoff:]
    wild_cards = wild_cards[:cutoff]

    # Handle conf_champ_top_4 logic
    if playoff_conf_champ_top_4:
        # Conference champions get top 4 seeds
        byes = autobids[:4]  # Top 4 autobids get byes
        no_bye_autobids = autobids[4:]  # Remaining autobids don't get byes
    else:
        # Conference champions don't automatically get top 4 seeds
        # Top 4 teams by ranking get byes, regardless of autobid status
        all_teams = autobids + wild_cards
        all_teams = sorted(all_teams, key=lambda x: x.ranking)
        byes = all_teams[:4]  # Top 4 teams by ranking get byes

        # Remove bye teams from autobids and wild_cards
        bye_ids = [team.id for team in byes]
        autobids = [team for team in autobids if team.id not in bye_ids]
        wild_cards = [team for team in wild_cards if team.id not in bye_ids]
        no_bye_autobids = autobids  # All remaining autobids don't get byes

    # Combine teams in the same order as setPlayoffR1
    wild_cards.extend(no_bye_autobids)
    teams = byes + sorted(wild_cards, key=lambda x: x.ranking) + non_playoff_teams

    return teams


def setPlayoffR1(info):
    playoff = info.playoff
    games_to_create = []

    # Use the shared function to get teams in correct order
    teams = get_playoff_team_order(info)

    # Update team rankings
    teams_to_update = []
    for i, team in enumerate(teams, 1):
        team.ranking = i
        teams_to_update.append(team)
    Teams.objects.bulk_update(teams_to_update, ["ranking"])

    # Set all 12 seeds for 12-team playoff
    for i in range(1, 13):
        setattr(playoff, f"seed_{i}", teams[i - 1])

    print(f"Set playoff seeds for 12-team playoff")
    for i in range(1, 13):
        team = getattr(playoff, f"seed_{i}")
        print(f"Seed #{i}: {team.name} (Rank #{team.ranking})")

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

    # Use the stored seeds
    seed_1 = playoff.seed_1
    seed_2 = playoff.seed_2
    seed_3 = playoff.seed_3
    seed_4 = playoff.seed_4

    matchups = [
        ("left_quarter_1", seed_1, playoff.left_r1_1.winner),
        ("left_quarter_2", seed_4, playoff.left_r1_2.winner),
        ("right_quarter_1", seed_2, playoff.right_r1_1.winner),
        ("right_quarter_2", seed_3, playoff.right_r1_2.winner),
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

    # Get playoff teams from settings
    playoff_teams = info.settings.playoff_teams
    
    if playoff_teams == 4:
        # Get the top 4 teams by ranking
        teams = info.teams.order_by("ranking")[:4]

        # Set the seeds in the playoff object
        playoff.seed_1 = teams[0]
        playoff.seed_2 = teams[1]
        playoff.seed_3 = teams[2]
        playoff.seed_4 = teams[3]

        print(f"4-team playoff semifinals:")
        print(f"Seed #1 {teams[0].name} vs Seed #4 {teams[3].name}")
        print(f"Seed #2 {teams[1].name} vs Seed #3 {teams[2].name}")

        playoff.left_semi = schedule_playoff_game(teams[0], teams[3], 14)
        playoff.right_semi = schedule_playoff_game(teams[1], teams[2], 14)
    elif playoff_teams == 12:
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

    # Calculate and set watchability score
    num_teams = info.teams.count()
    game.watchability = watchability(game, num_teams)

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


def setNatty(info):
    playoff = info.playoff
    playoff.refresh_from_db()
    games_to_create = []
    week_mapping = {2: 14, 4: 15, 12: 17}
    
    # Get playoff teams from settings
    playoff_teams = info.settings.playoff_teams

    if playoff_teams == 2:
        # Get the top 2 teams by ranking
        teams = info.teams.order_by("ranking")[:2]

        # Set the seeds in the playoff object
        playoff.seed_1 = teams[0]
        playoff.seed_2 = teams[1]

        print(f"2-team playoff championship:")
        print(f"Seed #1 {teams[0].name} vs Seed #2 {teams[1].name}")

        playoff.natty = scheduleGame(
            info,
            teams[0],
            teams[1],
            games_to_create,
            week_mapping.get(playoff_teams),
            "National Championship",
        )[2]
    else:
        playoff.natty = scheduleGame(
            info,
            playoff.left_semi.winner,
            playoff.right_semi.winner,
            games_to_create,
            week_mapping.get(playoff_teams),
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


def set_rivalries(info):
    odds = info.odds.all()
    games_to_create = []
    teams = info.teams.all()

    with open(f"data/rivalries.json", "r") as metadataFile:
        rivalries = json.load(metadataFile)

    for team in teams:
        team.schedule = set()

    scheduled_games = {}

    for game in rivalries["rivalries"]:
        for team_name in [game[0], game[1]]:
            if team_name not in scheduled_games:
                scheduled_games[team_name] = set()

        if game[2] is not None:
            scheduled_games[game[0]].add(game[2])
            scheduled_games[game[1]].add(game[2])

    for game in rivalries["rivalries"]:
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
    overall_start = time.time()
    print(f"\n--- SCHEDULE GENERATION ---")
    print("PHASE 1: INITIALIZATION")

    # Phase 1: Initialize data structures
    init_start = time.time()
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
    time_section(init_start, "  • Data structures initialized")

    # Phase 2: Non-conference scheduling
    non_conf_start = time.time()
    print("PHASE 2: NON-CONFERENCE SCHEDULING")

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

    time_section(non_conf_start, "  • Non-conference games scheduled")

    # Phase 3: Conference scheduling
    conf_start = time.time()
    print("PHASE 3: CONFERENCE SCHEDULING")
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

    time_section(conf_start, "  • Conference games scheduled")

    # Phase 4: Week assignment
    assign_weeks_start = time.time()
    print("PHASE 4: WEEK ASSIGNMENT")
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
    time_section(assign_weeks_start, "  • Games assigned to weeks")

    # Phase 5: Database persistence
    bulk_start = time.time()
    print("PHASE 5: DATABASE PERSISTENCE")
    Games.objects.bulk_create(games_to_create)
    Teams.objects.bulk_update(teams, ["confGames", "nonConfGames"])
    time_section(bulk_start, "  • Games and team data saved to database")

    time_section(overall_start, "SCHEDULE GENERATION COMPLETE")
    print("--- SCHEDULE GENERATION COMPLETE ---\n")

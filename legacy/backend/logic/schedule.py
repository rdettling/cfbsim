import random
from api.models import *
import json
from django.db.models import F, ExpressionWrapper, FloatField, Q
import time
from .util import time_section, watchability
from logic.constants.sim_constants import HOME_FIELD_ADVANTAGE
from logic.constants.schedule_constants import (
    REGULAR_SEASON_WEEKS,
    REGULAR_SEASON_GAMES,
    CONFERENCE_CHAMPIONSHIP_WEEK,
)


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

    week = CONFERENCE_CHAMPIONSHIP_WEEK + 1
    playoff.left_r1_1 = schedule_neutral_game(
        info, teams[7], teams[8], games_to_create, week, "Playoff round 1"
    )
    playoff.left_r1_2 = schedule_neutral_game(
        info, teams[4], teams[11], games_to_create, week, "Playoff round 1"
    )
    playoff.right_r1_1 = schedule_neutral_game(
        info, teams[6], teams[9], games_to_create, week, "Playoff round 1"
    )
    playoff.right_r1_2 = schedule_neutral_game(
        info, teams[5], teams[10], games_to_create, week, "Playoff round 1"
    )

    num_teams = info.teams.count()
    for game in games_to_create:
        game.watchability = watchability(game, num_teams)
    Games.objects.bulk_create(games_to_create)
    playoff.save()


def setPlayoffQuarter(info):
    playoff = info.playoff
    playoff.refresh_from_db()
    games_to_create = []

    week = CONFERENCE_CHAMPIONSHIP_WEEK + 2

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
        setattr(
            playoff,
            attr,
            schedule_neutral_game(
                info, team1, team2, games_to_create, week, "Playoff quarterfinal"
            ),
        )

    num_teams = info.teams.count()
    for game in games_to_create:
        game.watchability = watchability(game, num_teams)
    Games.objects.bulk_create(games_to_create)
    playoff.save()


def setPlayoffSemi(info):
    playoff = info.playoff
    playoff.refresh_from_db()
    games_to_create = []

    week = (
        CONFERENCE_CHAMPIONSHIP_WEEK + 1
        if info.settings.playoff_teams == 4
        else CONFERENCE_CHAMPIONSHIP_WEEK + 3
    )

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

        playoff.left_semi = schedule_neutral_game(
            info, teams[0], teams[3], games_to_create, week, "Playoff semifinal"
        )
        playoff.right_semi = schedule_neutral_game(
            info, teams[1], teams[2], games_to_create, week, "Playoff semifinal"
        )
    elif playoff_teams == 12:
        playoff.left_semi = schedule_neutral_game(
            info,
            playoff.left_quarter_1.winner,
            playoff.left_quarter_2.winner,
            games_to_create,
            week,
            "Playoff semifinal",
        )
        playoff.right_semi = schedule_neutral_game(
            info,
            playoff.right_quarter_1.winner,
            playoff.right_quarter_2.winner,
            games_to_create,
            week,
            "Playoff semifinal",
        )

    num_teams = info.teams.count()
    for game in games_to_create:
        game.watchability = watchability(game, num_teams)
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
    home_team=None,
    away_team=None,
    neutral_site=False,
):
    if gameName:
        base_label = gameName
    else:
        team_conf = team.conference
        opponent_conf = opponent.conference
        if team_conf and opponent_conf and team_conf == opponent_conf:
            base_label = f"Conference: {team_conf.confName}"
        else:
            team_label = team_conf.confName if team_conf else "Independent"
            opponent_label = (
                opponent_conf.confName if opponent_conf else "Independent"
            )
            base_label = f"Non-Conference: {team_label} vs {opponent_label}"

    if neutral_site:
        home_team = None
        away_team = None
    else:
        home_team = home_team or team
        away_team = away_team or opponent

    rating_a = team.rating
    rating_b = opponent.rating
    if not neutral_site and home_team:
        if home_team == team:
            rating_a += HOME_FIELD_ADVANTAGE
        elif home_team == opponent:
            rating_b += HOME_FIELD_ADVANTAGE

    diff = abs(rating_a - rating_b)
    if odds_list is None:
        odds = info.odds.get(diff=diff)
    elif isinstance(odds_list, dict):
        odds = odds_list.get(diff)
    else:
        odds = odds_list.get(diff=diff)

    is_teamA_favorite = rating_a >= rating_b

    game = Games(
        info=info,
        teamA=team,
        year=info.currentYear,
        teamB=opponent,
        homeTeam=home_team,
        awayTeam=away_team,
        neutralSite=neutral_site,
        base_label=base_label,
        name=gameName,
        spreadA=odds.favSpread if is_teamA_favorite else odds.udSpread,
        spreadB=odds.udSpread if is_teamA_favorite else odds.favSpread,
        moneylineA=odds.favMoneyline if is_teamA_favorite else odds.udMoneyline,
        moneylineB=odds.udMoneyline if is_teamA_favorite else odds.favMoneyline,
        winProbA=odds.favWinProb if is_teamA_favorite else odds.udWinProb,
        winProbB=odds.udWinProb if is_teamA_favorite else odds.favWinProb,
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


def schedule_neutral_game(info, team, opponent, games_to_create, week, name):
    return scheduleGame(
        info,
        team,
        opponent,
        games_to_create,
        week,
        name,
        neutral_site=True,
    )[2]


def setNatty(info):
    playoff = info.playoff
    playoff.refresh_from_db()
    games_to_create = []
    week_mapping = {
        2: CONFERENCE_CHAMPIONSHIP_WEEK + 1,
        4: CONFERENCE_CHAMPIONSHIP_WEEK + 2,
        12: CONFERENCE_CHAMPIONSHIP_WEEK + 4,
    }
    
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

        playoff.natty = schedule_neutral_game(
            info,
            teams[0],
            teams[1],
            games_to_create,
            week_mapping.get(playoff_teams),
            "National Championship",
        )
    else:
        playoff.natty = schedule_neutral_game(
            info,
            playoff.left_semi.winner,
            playoff.right_semi.winner,
            games_to_create,
            week_mapping.get(playoff_teams),
            "National Championship",
        )

    num_teams = info.teams.count()
    for game in games_to_create:
        game.watchability = watchability(game, num_teams)
    Games.objects.bulk_create(games_to_create)
    playoff.save()


def setConferenceChampionships(info):
    games_to_create = []
    conferences = info.conferences.all()

    for conference in conferences:
        teams = conference.teams.order_by("-confWins", "ranking")

        teamA = teams[0]
        teamB = teams[1]

        game = schedule_neutral_game(
            info,
            teamA,
            teamB,
            games_to_create,
            CONFERENCE_CHAMPIONSHIP_WEEK,
            f"{conference.confName} championship",
        )

        conference.championship = game

    num_teams = info.teams.count()
    for game in games_to_create:
        game.watchability = watchability(game, num_teams)
    Games.objects.bulk_create(games_to_create)
    Conferences.objects.bulk_update(conferences, ["championship"])


def _load_rivalries():
    with open("data/rivalries.json", "r") as metadataFile:
        return json.load(metadataFile)["rivalries"]


def _get_last_rivalry_home(info, team_a, team_b):
    last_game = (
        Games.objects.filter(info=info, year=info.currentYear - 1)
        .filter(Q(teamA=team_a, teamB=team_b) | Q(teamA=team_b, teamB=team_a))
        .order_by("-id")
        .first()
    )
    if not last_game:
        return None
    if last_game.homeTeam_id:
        return last_game.homeTeam
    return last_game.teamA


def _choose_home_away(team, opponent, home_counts, away_counts):
    target_home = REGULAR_SEASON_GAMES // 2
    team_home = home_counts.get(team.id, 0)
    opponent_home = home_counts.get(opponent.id, 0)

    team_needs_home = team_home < target_home
    opponent_needs_home = opponent_home < target_home

    if team_needs_home and not opponent_needs_home:
        return team, opponent
    if opponent_needs_home and not team_needs_home:
        return opponent, team

    if team_home == opponent_home:
        return (team, opponent) if random.random() < 0.5 else (opponent, team)

    return (team, opponent) if team_home < opponent_home else (opponent, team)


def set_rivalries(info):
    odds_map = {odds.diff: odds for odds in info.odds.all()}
    games_to_create = []
    teams = list(info.teams.all())
    teams_by_name = {team.name: team for team in teams}

    for game in _load_rivalries():
        team = teams_by_name.get(game[0])
        opponent = teams_by_name.get(game[1])
        if not team or not opponent:
            continue

        game_week = game[2] if game[2] is not None else 0
        last_home = _get_last_rivalry_home(info, team, opponent)
        if last_home == team:
            home_team, away_team = opponent, team
        else:
            home_team, away_team = team, opponent

        scheduleGame(
            info,
            team,
            opponent,
            games_to_create,
            game_week,
            game[3],
            odds_map,
            home_team=home_team,
            away_team=away_team,
        )

    Teams.objects.bulk_update(teams, ["confGames", "nonConfGames"])
    num_teams = len(teams)
    for game in games_to_create:
        game.watchability = watchability(game, num_teams)
    Games.objects.bulk_create(games_to_create)


def fillSchedules(info):
    overall_start = time.time()
    print(f"\n--- SCHEDULE GENERATION ---")
    print("PHASE 1: INITIALIZATION")

    # Phase 1: Initialize data structures
    init_start = time.time()
    teams = list(info.teams.all())
    conferences = list(info.conferences.all())
    odds_map = {odds.diff: odds for odds in info.odds.all()}
    existing_games = list(
        info.games.filter(year=info.currentYear).select_related(
            "teamA", "teamB", "homeTeam", "awayTeam"
        )
    )

    random.shuffle(teams)
    random.shuffle(conferences)

    scheduled_opponents = {team.id: set() for team in teams}
    games_to_create = []

    home_counts = {team.id: 0 for team in teams}
    away_counts = {team.id: 0 for team in teams}
    for game in existing_games:
        scheduled_opponents[game.teamA_id].add(game.teamB_id)
        scheduled_opponents[game.teamB_id].add(game.teamA_id)
        if game.homeTeam_id and not game.neutralSite:
            home_counts[game.homeTeam_id] += 1
            if game.awayTeam_id:
                away_counts[game.awayTeam_id] += 1
    time_section(init_start, "  • Data structures initialized")

    # Phase 2: Conference scheduling
    conf_start = time.time()
    print("PHASE 2: CONFERENCE SCHEDULING")

    for conference in conferences:
        conf_teams_list = [team for team in teams if team.conference == conference]

        while conf_teams_list:
            for team in conf_teams_list:
                team.potential = [
                    opponent
                    for opponent in conf_teams_list
                    if opponent.confGames < opponent.confLimit
                    and opponent.id not in scheduled_opponents[team.id]
                    and opponent != team
                ]
                team.buffer = len(team.potential) - (team.confLimit - team.confGames)

            conf_teams_list.sort(key=lambda team: (team.buffer, team.confGames))
            team = conf_teams_list.pop(0)
            team.potential.sort(key=lambda o: (o.buffer, o.confGames))

            while team.confGames < team.confLimit:
                if not team.potential:
                    break
                opponent = team.potential.pop(0)
                if opponent.confGames >= opponent.confLimit:
                    continue
                if opponent.id in scheduled_opponents[team.id]:
                    continue
                home_team, away_team = _choose_home_away(
                    team, opponent, home_counts, away_counts
                )
                scheduleGame(
                    info,
                    team,
                    opponent,
                    games_to_create,
                    0,
                    None,
                    odds_map,
                    home_team=home_team,
                    away_team=away_team,
                )
                scheduled_opponents[team.id].add(opponent.id)
                scheduled_opponents[opponent.id].add(team.id)
                home_counts[home_team.id] += 1
                away_counts[away_team.id] += 1

    time_section(conf_start, "  • Conference games scheduled")

    # Phase 3: Non-conference scheduling
    non_conf_start = time.time()
    print("PHASE 3: NON-CONFERENCE SCHEDULING")

    teams_list = teams[:]
    while teams_list:
        for team in teams_list:
            team.potential = [
                opponent
                for opponent in teams
                if opponent.nonConfGames < opponent.nonConfLimit
                and opponent.id not in scheduled_opponents[team.id]
                and (
                    opponent.conference != team.conference
                    or (
                        team.conference is None
                        and opponent.conference is None
                        and team is not opponent
                    )
                )
            ]
            team.buffer = len(team.potential) - (team.nonConfLimit - team.nonConfGames)

        teams_list.sort(key=lambda team: (team.buffer, team.nonConfGames))
        team = teams_list.pop(0)
        team.potential.sort(key=lambda o: (o.buffer, o.nonConfGames))

        while team.nonConfGames < team.nonConfLimit:
            if not team.potential:
                break
            opponent = team.potential.pop(0)
            if opponent.nonConfGames >= opponent.nonConfLimit:
                continue
            if opponent.id in scheduled_opponents[team.id]:
                continue
            home_team, away_team = _choose_home_away(
                team, opponent, home_counts, away_counts
            )
            scheduleGame(
                info,
                team,
                opponent,
                games_to_create,
                0,
                None,
                odds_map,
                home_team=home_team,
                away_team=away_team,
            )
            scheduled_opponents[team.id].add(opponent.id)
            scheduled_opponents[opponent.id].add(team.id)
            home_counts[home_team.id] += 1
            away_counts[away_team.id] += 1

    time_section(non_conf_start, "  • Non-conference games scheduled")

    # Phase 4: Week assignment
    assign_weeks_start = time.time()
    print("PHASE 4: WEEK ASSIGNMENT")
    existing_unscheduled = [
        game for game in existing_games if not game.weekPlayed or game.weekPlayed == 0
    ]
    all_games = existing_games + games_to_create
    fixed_games = [
        game for game in all_games if game.weekPlayed and game.weekPlayed > 0
    ]
    unscheduled_games = [
        game for game in all_games if not game.weekPlayed or game.weekPlayed == 0
    ]

    base_team_weeks = {team.id: set() for team in teams}
    base_week_load = {week: 0 for week in range(1, REGULAR_SEASON_WEEKS + 1)}
    for game in fixed_games:
        base_team_weeks[game.teamA_id].add(game.weekPlayed)
        base_team_weeks[game.teamB_id].add(game.weekPlayed)
        if game.weekPlayed in base_week_load:
            base_week_load[game.weekPlayed] += 1

    weeks = list(range(1, REGULAR_SEASON_WEEKS + 1))
    assigned = False
    for attempt in range(50):
        attempt_start = time.time()
        reset_start = time.time()
        for game in unscheduled_games:
            game.weekPlayed = 0

        team_weeks = {
            team_id: set(weeks_set) for team_id, weeks_set in base_team_weeks.items()
        }
        week_load = dict(base_week_load)
        remaining_games = unscheduled_games[:]
        remaining_games_set = {id(game) for game in remaining_games}
        games_by_team = {team.id: [] for team in teams}
        available_weeks_by_game = {}
        for game in remaining_games:
            game_key = id(game)
            games_by_team[game.teamA_id].append(game)
            games_by_team[game.teamB_id].append(game)
            available_weeks_by_game[game_key] = set(
                week
                for week in weeks
                if week not in team_weeks[game.teamA_id]
                and week not in team_weeks[game.teamB_id]
            )
        time_section(reset_start, f"    • Attempt {attempt + 1} reset state")

        assign_start = time.time()
        options_time = 0.0
        sort_time = 0.0
        assign_time = 0.0
        failed = False
        while remaining_games:
            options_start = time.time()
            options = []
            for game in remaining_games:
                available_weeks = available_weeks_by_game[id(game)]
                if not available_weeks:
                    failed = True
                    break
                is_non_conf = game.teamA.conference_id != game.teamB.conference_id
                non_conf_priority = 0 if is_non_conf else 1
                options.append(
                    (
                        len(available_weeks),
                        non_conf_priority,
                        random.random(),
                        game,
                        available_weeks,
                    )
                )
            if failed:
                break
            options_time += time.time() - options_start

            sort_start = time.time()
            options.sort(key=lambda item: item[0:3])
            sort_time += time.time() - sort_start

            pick_start = time.time()
            _, _, _, game, available_weeks = options[0]
            if game.teamA.conference_id != game.teamB.conference_id:
                week = min(
                    available_weeks,
                    key=lambda w: (week_load.get(w, 0), w),
                )
            else:
                week = min(
                    available_weeks,
                    key=lambda w: (week_load.get(w, 0), -w),
                )
            game.weekPlayed = week
            team_weeks[game.teamA_id].add(week)
            team_weeks[game.teamB_id].add(week)
            week_load[week] = week_load.get(week, 0) + 1
            remaining_games.remove(game)
            remaining_games_set.remove(id(game))
            for related_game in games_by_team[game.teamA_id]:
                related_key = id(related_game)
                if related_key in remaining_games_set:
                    available_weeks_by_game[related_key].discard(week)
            for related_game in games_by_team[game.teamB_id]:
                related_key = id(related_game)
                if related_key in remaining_games_set:
                    available_weeks_by_game[related_key].discard(week)
            assign_time += time.time() - pick_start

        time_section(assign_start, f"    • Attempt {attempt + 1} assign loop")
        print(
            "    • Attempt {} breakdown: options {:.2f}s, sort {:.2f}s, assign {:.2f}s".format(
                attempt + 1, options_time, sort_time, assign_time
            )
        )
        if not failed:
            assigned = True
            time_section(attempt_start, f"    • Attempt {attempt + 1} total")
            break
        time_section(attempt_start, f"    • Attempt {attempt + 1} total")

    if not assigned:
        print("WARNING: Unable to assign weeks without conflicts after retries.")
    remaining_unassigned = sum(
        1 for game in all_games if not game.weekPlayed or game.weekPlayed == 0
    )
    if remaining_unassigned:
        print(f"WARNING: {remaining_unassigned} games still unassigned (week 0).")
    time_section(assign_weeks_start, "  • Games assigned to weeks")

    # Phase 5: Database persistence
    bulk_start = time.time()
    print("PHASE 5: DATABASE PERSISTENCE")
    if existing_unscheduled:
        Games.objects.bulk_update(existing_unscheduled, ["weekPlayed"])
    if games_to_create:
        num_teams = len(teams)
        for game in games_to_create:
            game.watchability = watchability(game, num_teams)
        Games.objects.bulk_create(games_to_create)
    Teams.objects.bulk_update(teams, ["confGames", "nonConfGames"])
    time_section(bulk_start, "  • Games and team data saved to database")

    validation_start = time.time()
    total_games_expected = REGULAR_SEASON_GAMES
    total_byes_expected = REGULAR_SEASON_WEEKS - REGULAR_SEASON_GAMES
    team_week_conflicts = 0
    team_weeks_check = {team.id: set() for team in teams}
    for game in all_games:
        if not game.weekPlayed:
            continue
        for team_id in (game.teamA_id, game.teamB_id):
            if game.weekPlayed in team_weeks_check[team_id]:
                team_week_conflicts += 1
            else:
                team_weeks_check[team_id].add(game.weekPlayed)

    if any(
        (team.confGames + team.nonConfGames) != total_games_expected for team in teams
    ):
        print("WARNING: Not all teams have 12 games scheduled.")
    if any(
        (REGULAR_SEASON_WEEKS - (team.confGames + team.nonConfGames))
        != total_byes_expected
        for team in teams
    ):
        print("WARNING: Not all teams have 2 byes.")
    if team_week_conflicts:
        print("WARNING: Some teams have multiple games in the same week.")
    time_section(validation_start, "  • Schedule validation")

    time_section(overall_start, "SCHEDULE GENERATION COMPLETE")
    print("--- SCHEDULE GENERATION COMPLETE ---\n")

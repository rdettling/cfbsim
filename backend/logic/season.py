from .schedule import set_rivalries, fillSchedules
from api.models import *
from .player_generation import load_names
from .roster_management import (
    remove_seniors,
    create_freshmen,
    set_starters,
    calculate_team_ratings,
    init_roster,
    progress_years,
)
from .betting import getSpread
from django.db import transaction
import os
import json
from .util import get_recruiting_points, get_last_week, load_year_data
import time


def init_history_data(info, start_year):
    """Initialize the History table with data from ratings files and optional prestige data."""
    ratings_dir = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "data", "ratings"
    )
    years_dir = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "data", "years"
    )

    if not os.path.exists(ratings_dir):
        print("Error: Ratings directory not found")
        return

    # Get historical years (before start year)
    rating_files = [
        f
        for f in os.listdir(ratings_dir)
        if f.startswith("ratings_") and f.endswith(".json")
    ]
    years = [int(f.replace("ratings_", "").replace(".json", "")) for f in rating_files]
    years = [year for year in years if year < start_year]
    years.sort(reverse=True)

    print(f"Found {len(years)} historical years: {years}")

    # Create team lookup for efficiency
    team_lookup = {team.name: team for team in info.teams.all()}
    history_records = []

    for year in years:
        print(f"Processing year {year}...")

        # Load ratings and prestige data
        ratings_file = os.path.join(ratings_dir, f"ratings_{year}.json")
        with open(ratings_file, "r") as f:
            ratings_data = json.load(f)

        year_file = os.path.join(years_dir, f"{year}.json")
        prestige_data = None
        if os.path.exists(year_file):
            with open(year_file, "r") as f:
                prestige_data = json.load(f)

        # Process teams
        for team_data in ratings_data["teams"]:
            team_name = team_data["team"]
            team = team_lookup.get(team_name)

            if not team:
                print(f"Warning: Team '{team_name}' not found, skipping")
                continue

            # Get prestige from year data
            prestige = None
            if prestige_data:
                # Check conferences first
                for conf_data in prestige_data["conferences"].values():
                    if team_name in conf_data["teams"]:
                        prestige = conf_data["teams"][team_name]
                        break

                # Check independents if not found
                if prestige is None and "Independent" in prestige_data:
                    if team_name in prestige_data["Independent"]:
                        prestige = prestige_data["Independent"][team_name]

            # Create history record
            history_records.append(
                History(
                    info=info,
                    team=team,
                    year=year,
                    conference=team_data.get("conference", "Independent"),
                    rank=team_data.get("rank"),
                    wins=team_data.get("wins", 0),
                    losses=team_data.get("losses", 0),
                    prestige=prestige,
                    rating=None,
                )
            )

        print(f"  Processed {len(ratings_data['teams'])} teams")

    # Bulk create records
    if history_records:
        History.objects.bulk_create(history_records)
        print(f"Created {len(history_records)} history records")
    else:
        print("No history records to create")


def transition_rosters(info):
    """Part 1: Remove seniors and add freshmen (called by recruiting summary)"""
    remove_seniors(info)
    progress_years(info)
    create_freshmen(info)

    # Set starters and calculate ratings
    set_starters(info)
    calculate_team_ratings(info)


def refresh_playoff(info, data):
    """Update playoff format and clear game references for new season"""
    playoff_config = data["playoff"]
    info.playoff.teams = playoff_config["teams"]
    info.playoff.autobids = playoff_config.get("conf_champ_autobids", 0)
    info.playoff.conf_champ_top_4 = playoff_config.get("conf_champ_top_4", False)
    info.lastWeek = get_last_week(info.playoff.teams)

    # Clear all playoff game references (set to None)
    info.playoff.seed_1 = None
    info.playoff.seed_2 = None
    info.playoff.seed_3 = None
    info.playoff.seed_4 = None
    info.playoff.left_r1_1 = None
    info.playoff.left_r1_2 = None
    info.playoff.right_r1_1 = None
    info.playoff.right_r1_2 = None
    info.playoff.left_quarter_1 = None
    info.playoff.left_quarter_2 = None
    info.playoff.right_quarter_1 = None
    info.playoff.right_quarter_2 = None
    info.playoff.left_semi = None
    info.playoff.right_semi = None
    info.playoff.natty = None

    info.playoff.save()


def transition_season_data(info):
    """Part 2: Handle realignment and game refresh (called by noncon)"""
    current_year = info.currentYear
    while current_year >= info.startYear:
        file_path = f"data/years/{current_year}.json"
        if os.path.exists(file_path):
            data = load_year_data(current_year)
            break
        else:
            current_year -= 1

    with transaction.atomic():
        # Realignment
        start = time.time()
        realignment(info, data)
        print(f"Realignment {time.time() - start} seconds")

        # Update playoff format and refresh playoff games
        start = time.time()
        refresh_playoff(info, data)
        print(
            f"Updated playoff format and cleared game references {time.time() - start} seconds"
        )

        # Reset all game counters and stats for new season
        start = time.time()
        teams = info.teams.all()
        for team in teams:
            team.nonConfGames = 0
            team.confGames = 0
            team.nonConfWins = 0
            team.nonConfLosses = 0
            team.confWins = 0
            team.confLosses = 0
            team.totalWins = 0
            team.totalLosses = 0
            team.gamesPlayed = 0
            team.strength_of_record = 0
            team.poll_score = 0
        Teams.objects.bulk_update(
            teams,
            [
                "nonConfGames",
                "confGames",
                "nonConfWins",
                "nonConfLosses",
                "confWins",
                "confLosses",
                "totalWins",
                "totalLosses",
                "gamesPlayed",
                "strength_of_record",
                "poll_score",
            ],
        )
        print(f"Reset game counters {time.time() - start} seconds")

        # Clear plays and drives
        info.plays.all().delete()
        info.drives.all().delete()

        # Recalculate rankings after realignment
        initialize_rankings(info)
        print(f"Initialize rankings {time.time() - start} seconds")

        set_rivalries(info)


def update_history(info):
    teams = info.teams.all()

    years = []

    for team in teams:
        years.append(
            History(
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

    History.objects.bulk_create(years)


def start_season(info):
    """Start the season by filling schedules and setting initial state"""
    start = time.time()
    fillSchedules(info)
    print(f"Fill schedules {time.time() - start} seconds")

    info.currentWeek = 1
    info.stage = "season"
    info.save()


def realignment_summary(info):
    """Generate summary of conference realignment changes"""
    next_year = info.currentYear + 1
    file_path = f"data/years/{next_year}.json"

    if not os.path.exists(file_path):
        return {}

    data = load_year_data(next_year)

    team_dict = {}
    teams = info.teams.all().select_related("conference")

    # Map current teams to their old conferences
    for team in teams:
        team_dict[team.name] = {
            "old": team.conference.confName if team.conference else "Independent"
        }

    # Map teams to their new conferences from data
    for conf_name, conf_data in data["conferences"].items():
        for team in conf_data["teams"]:
            team_name = team["name"]
            if team_name in team_dict:
                team_dict[team_name]["new"] = conf_name
            else:
                team_dict[team_name] = {"old": "FCS", "new": conf_name}

    # Map independent teams
    for team in data["independents"]:
        team_name = team["name"]
        if team_name in team_dict:
            team_dict[team_name]["new"] = "Independent"
        else:
            team_dict[team_name] = {"old": "FCS", "new": "Independent"}

    # Filter to only teams that changed conferences
    return {
        name: confs for name, confs in team_dict.items() if confs["old"] != confs["new"]
    }


def realignment(info, data):
    """Update playoff settings and team conference assignments"""
    # Update playoff configuration
    playoff_config = data["playoff"]
    info.playoff.teams = playoff_config["teams"]
    info.playoff.autobids = playoff_config.get("conf_champ_autobids", 0)
    info.playoff.conf_champ_top_4 = playoff_config.get("conf_champ_top_4", False)
    info.lastWeek = get_last_week(info.playoff.teams)
    info.playoff.save()
    info.save()

    teams = info.teams.all()
    conferences = info.conferences.all()

    # Process conference teams
    for conf_name, conf_data in data["conferences"].items():
        conference, created = info.conferences.get_or_create(
            confName=conf_name,
            defaults={
                "confFullName": conf_data["confFullName"],
                "confGames": conf_data["confGames"],
            },
        )

        for team_data in conf_data["teams"]:
            team_defaults = {
                "abbreviation": team_data["abbreviation"],
                "prestige": team_data["prestige"],
                "mascot": team_data["mascot"],
                "colorPrimary": team_data["colorPrimary"],
                "colorSecondary": team_data["colorSecondary"],
                "conference": conference,
                "confLimit": conf_data["confGames"],
                "nonConfLimit": 12 - conf_data["confGames"],
                "offers": 25,
                "recruiting_points": get_recruiting_points(team_data["prestige"]),
            }

            team, created = info.teams.get_or_create(
                name=team_data["name"], defaults=team_defaults
            )

            if not created:
                # Update existing team
                team.conference = conference
                team.confLimit = conf_data["confGames"]
                team.nonConfLimit = 12 - conf_data["confGames"]
                team.save()

    # Process independent teams
    for team_data in data["independents"]:
        team_defaults = {
            "abbreviation": team_data["abbreviation"],
            "prestige": team_data["prestige"],
            "mascot": team_data["mascot"],
            "colorPrimary": team_data["colorPrimary"],
            "colorSecondary": team_data["colorSecondary"],
            "conference": None,
            "confLimit": 0,
            "nonConfLimit": 12,
            "offers": 25,
            "recruiting_points": get_recruiting_points(team_data["prestige"]),
        }

        team, created = info.teams.get_or_create(
            name=team_data["name"], defaults=team_defaults
        )

        if not created:
            # Update existing team
            team.conference = None
            team.confLimit = 0
            team.nonConfLimit = 12
            team.save()

    # Clean up empty conferences
    with transaction.atomic():
        for conference in conferences:
            if conference.teams.count() == 0:
                conference.delete()


def initialize_rankings(info):
    """Initialize team rankings based on ratings"""
    teams = info.teams.all().order_by("-rating")

    for i, team in enumerate(teams, start=1):
        team.ranking = i
        team.last_rank = i

    Teams.objects.bulk_update(teams, ["ranking", "last_rank"])


def init(
    user_id,
    team_name,
    year,
    playoff_teams=None,
    playoff_autobids=None,
    playoff_conf_champ_top_4=None,
):
    """Initialize a new season with all required data"""
    data = load_year_data(year)

    # Determine playoff configuration
    playoff_config = data["playoff"]
    final_playoff_teams = (
        playoff_teams if playoff_teams is not None else playoff_config["teams"]
    )
    final_playoff_autobids = (
        playoff_autobids
        if playoff_autobids is not None
        else playoff_config.get("conf_champ_autobids", 0)
    )
    final_conf_champ_top_4 = (
        playoff_conf_champ_top_4
        if playoff_conf_champ_top_4 is not None
        else playoff_config.get("conf_champ_top_4", False)
    )

    calculated_last_week = get_last_week(final_playoff_teams)
    overall_start = time.time()

    # Create info and playoff objects
    Info.objects.filter(user_id=user_id).delete()
    info = Info.objects.create(
        user_id=user_id,
        currentWeek=1,
        currentYear=year,
        startYear=year,
        stage="preseason",
        lastWeek=calculated_last_week,
    )

    playoff = Playoff.objects.create(
        info=info,
        teams=final_playoff_teams,
        autobids=final_playoff_autobids,
        conf_champ_top_4=final_conf_champ_top_4,
    )
    info.playoff = playoff

    # Create conferences and teams
    conferences_to_create = []
    teams_to_create = []

    for conf_name, conf_data in data["conferences"].items():
        conference = Conferences(
            info=info,
            confName=conf_name,
            confFullName=conf_data["confFullName"],
            confGames=conf_data["confGames"],
        )
        conferences_to_create.append(conference)

        for team_data in conf_data["teams"]:
            team = Teams(
                info=info,
                name=team_data["name"],
                abbreviation=team_data["abbreviation"],
                prestige=team_data["prestige"],
                mascot=team_data["mascot"],
                colorPrimary=team_data["colorPrimary"],
                colorSecondary=team_data["colorSecondary"],
                conference=conference,
                confLimit=conf_data["confGames"],
                nonConfLimit=12 - conf_data["confGames"],
                offers=25,
                recruiting_points=get_recruiting_points(team_data["prestige"]),
            )
            teams_to_create.append(team)
            if team_data["name"] == team_name:
                info.team = team

    for team_data in data["independents"]:
        team = Teams(
            info=info,
            name=team_data["name"],
            abbreviation=team_data["abbreviation"],
            prestige=team_data["prestige"],
            mascot=team_data["mascot"],
            colorPrimary=team_data["colorPrimary"],
            colorSecondary=team_data["colorSecondary"],
            conference=None,
            confLimit=0,
            nonConfLimit=12,
            offers=25,
            recruiting_points=get_recruiting_points(team_data["prestige"]),
        )
        teams_to_create.append(team)
        if team_data["name"] == team_name:
            info.team = team

    # Bulk create conferences and teams
    Conferences.objects.bulk_create(conferences_to_create)
    Teams.objects.bulk_create(teams_to_create)
    info.save()

    # Initialize history data
    start = time.time()
    init_history_data(info, year)
    print(f"Initialize history {time.time() - start} seconds")

    # Create players
    start = time.time()
    players_to_create = []
    loaded_names = load_names()

    for team in info.teams.all():
        init_roster(team, loaded_names, players_to_create)

    Players.objects.bulk_create(players_to_create)
    print(f"Create players {time.time() - start} seconds")

    # Finalize setup
    start = time.time()
    set_starters(info)
    print(f"Set starters {time.time() - start} seconds")

    start = time.time()
    calculate_team_ratings(info)
    print(f"Calculate ratings {time.time() - start} seconds")

    # Create odds (after team ratings are calculated)
    start = time.time()
    teams = info.teams.all()
    max_rating = teams.order_by("-rating").first().rating
    min_rating = teams.order_by("rating").first().rating
    rating_range = max_rating - min_rating + 10

    odds_list = getSpread(rating_range)
    odds_to_create = []

    for diff, odds_data in odds_list.items():
        odds_instance = Odds(
            info=info,
            diff=diff,
            favSpread=odds_data["favSpread"],
            udSpread=odds_data["udSpread"],
            favWinProb=odds_data["favWinProb"],
            udWinProb=odds_data["udWinProb"],
            favMoneyline=odds_data["favMoneyline"],
            udMoneyline=odds_data["udMoneyline"],
        )
        odds_to_create.append(odds_instance)

    Odds.objects.bulk_create(odds_to_create)
    print(f"Create odds {time.time() - start} seconds")

    start = time.time()
    initialize_rankings(info)
    print(f"Initialize rankings {time.time() - start} seconds")

    start = time.time()
    set_rivalries(info)
    print(f"Set rivalries {time.time() - start} seconds")

    print(f"Total execution Time: {time.time() - overall_start} seconds")
    return info

from .schedule import set_rivalries, fillSchedules
from logic.constants.schedule_constants import LAST_WEEK_BY_PLAYOFF_TEAMS
from api.models import *
from .roster_management import (
    create_freshmen,
    set_starters,
    calculate_team_ratings,
    apply_progression,
    cut_rosters,
)
from .betting import load_precomputed_odds
from django.db import transaction
import os
import json
from .util import get_recruiting_points, load_year_data, time_section
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
        # print(f"Processing year {year}...")

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
                # print(f"Warning: Team '{team_name}' not found, skipping")
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

        # print(f"  Processed {len(ratings_data['teams'])} teams")

    # Bulk create records
    if history_records:
        History.objects.bulk_create(history_records)


# def transition_rosters(info):
#     """Part 1: Remove seniors and add freshmen (called by recruiting summary)"""
#     overall_start = time.time()
#     apply_progression(info)
#     create_freshmen(info)
#     cut_rosters(info)

#     # Set starters and calculate ratings
#     set_starters(info)
#     calculate_team_ratings(info=info)
#     time_section(overall_start, "  • transition_rosters total")


def refresh_playoff(info, data, update_format=False):
    """
    Clear playoff game references for new season and optionally update playoff format.
    
    Args:
        info: Info object
        data: Year data dictionary
        update_format: If True, update settings from year data file values.
                      If False, keep existing settings preferences.
    """
    playoff_config = data["playoff"]
    
    if update_format:
        # Update settings from year data file values
        playoff_teams_value = playoff_config["teams"]
        playoff_autobids_value = playoff_config.get("conf_champ_autobids", 0)
        playoff_conf_champ_top_4_value = playoff_config.get("conf_champ_top_4", False)
        
        # Ensure proper values for 2 or 4 team playoffs
        if playoff_teams_value in [2, 4]:
            playoff_autobids_value = 0
            playoff_conf_champ_top_4_value = False
        
        info.settings.playoff_teams = playoff_teams_value
        info.settings.playoff_autobids = playoff_autobids_value
        info.settings.playoff_conf_champ_top_4 = playoff_conf_champ_top_4_value
        info.settings.save()
    
    # Use settings for lastWeek calculation
    playoff_teams = info.settings.playoff_teams
    info.lastWeek = LAST_WEEK_BY_PLAYOFF_TEAMS[playoff_teams]

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


def apply_realignment_and_playoff(info):
    """
    Apply realignment and playoff changes for next season.
    Called at roster_progression stage.
    Increments year and applies changes based on settings.
    """
    # Increment year
    info.currentYear += 1
    info.currentWeek = 1
    
    # Find the closest available year data file for the new year
    current_year = info.currentYear
    while current_year >= info.startYear:
        file_path = f"data/years/{current_year}.json"
        if os.path.exists(file_path):
            data = load_year_data(current_year)
            break
        else:
            current_year -= 1
    else:
        # Fallback if no year data found
        data = load_year_data(info.currentYear)

    with transaction.atomic():
        # Realignment (respects auto_realignment setting)
        start = time.time()
        realignment(info, data)
        print(f"Realignment {time.time() - start} seconds")

        # Update playoff format and refresh playoff games (respects auto_update_postseason_format setting)
        start = time.time()
        try:
            update_format = info.settings.auto_update_postseason_format
        except (Settings.DoesNotExist, AttributeError):
            update_format = True  # Default behavior
        
        refresh_playoff(info, data, update_format=update_format)
        print(
            f"Updated playoff format and cleared game references {time.time() - start} seconds"
        )


def refresh_season_data(info):
    """
    Refresh season data: reset counters, clear plays/drives, initialize rankings, set rivalries.
    Called at noncon stage when transitioning from recruiting_summary.
    """
    with transaction.atomic():
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

        # Initialize rankings
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


def _calculate_prestige_tier_counts(prestige_config, total_teams):
    return {
        int(tier): int((percentage / 100) * total_teams)
        for tier, percentage in prestige_config.items()
    }


def _assign_prestige_tiers(sorted_teams, teams_data, tier_counts):
    result = []
    teams_in_tiers = {tier: 0 for tier in range(1, 8)}
    current_tier = 7

    for entry in sorted_teams:
        team = entry["team"]
        team_info = teams_data["teams"].get(team.name, {})
        ceiling = team_info.get("ceiling", 7)
        floor = team_info.get("floor", 1)

        target_tier = min(current_tier, ceiling)
        assigned_tier = target_tier

        if target_tier < current_tier:
            for tier in range(target_tier, 0, -1):
                if teams_in_tiers[tier] < tier_counts.get(tier, 0):
                    assigned_tier = tier
                    break
        else:
            if teams_in_tiers[current_tier] >= tier_counts.get(current_tier, 0):
                current_tier -= 1
                while (
                    current_tier > 0
                    and teams_in_tiers[current_tier] >= tier_counts.get(current_tier, 0)
                ):
                    current_tier -= 1
                if current_tier == 0:
                    current_tier = 1
            assigned_tier = current_tier

        prestige = min(assigned_tier, ceiling)
        prestige = max(prestige, floor)
        teams_in_tiers[prestige] += 1

        result.append({"team": team, "prestige": prestige})

    return result


def _collect_rank_averages(info, start_year, end_year):
    teams = list(info.teams.all())
    ranks_by_team = {team.id: [] for team in teams}

    history_entries = (
        info.years.filter(year__gte=start_year, year__lte=end_year)
        .select_related("team")
        .only("team_id", "rank")
    )

    for entry in history_entries:
        if entry.rank is not None:
            ranks_by_team.setdefault(entry.team_id, []).append(entry.rank)

    avg_by_team_id = {}
    for team in teams:
        ranks = ranks_by_team.get(team.id, [])
        avg_by_team_id[team.id] = sum(ranks) / len(ranks) if ranks else None

    return avg_by_team_id


def get_prestige_avg_ranks(info):
    current_year = info.currentYear
    avg_after = _collect_rank_averages(info, current_year - 3, current_year)
    avg_before = _collect_rank_averages(info, current_year - 4, current_year - 1)

    return {
        team.name: {"before": avg_before.get(team.id), "after": avg_after.get(team.id)}
        for team in info.teams.all()
    }


def calculate_prestige_changes(info):
    """Calculate prestige_change for each team based on 4-year average rank."""
    current_year = info.currentYear
    avg_after = _collect_rank_averages(info, current_year - 3, current_year)
    avg_before = _collect_rank_averages(info, current_year - 4, current_year - 1)

    teams = list(info.teams.all())
    teams_with_avg = [
        {"team": team, "avg_rank": avg_after.get(team.id)} for team in teams
    ]

    sorted_teams = sorted(
        teams_with_avg,
        key=lambda x: (x["avg_rank"] is None, x["avg_rank"] or float("inf")),
    )

    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
    with open(os.path.join(data_dir, "prestige_config.json"), "r") as f:
        prestige_config = json.load(f)
    with open(os.path.join(data_dir, "teams.json"), "r") as f:
        teams_data = json.load(f)

    tier_counts = _calculate_prestige_tier_counts(prestige_config, len(sorted_teams))
    assigned = _assign_prestige_tiers(sorted_teams, teams_data, tier_counts)

    for entry in assigned:
        team = entry["team"]
        desired = entry["prestige"]

        if desired > team.prestige:
            desired = min(team.prestige + 1, desired)
        elif desired < team.prestige:
            desired = max(team.prestige - 1, desired)

        team.prestige_change = desired - team.prestige

    Teams.objects.bulk_update(teams, ["prestige_change"])
    return {
        team.name: {"before": avg_before.get(team.id), "after": avg_after.get(team.id)}
        for team in teams
    }


def apply_prestige_changes(info):
    teams = list(info.teams.all())

    for team in teams:
        if team.prestige_change:
            team.prestige += team.prestige_change
            team.recruiting_points = get_recruiting_points(team.prestige)
            team.prestige_change = 0

    Teams.objects.bulk_update(
        teams, ["prestige", "recruiting_points", "prestige_change"]
    )


def start_season(info):
    """Start the season by filling schedules and setting initial state"""
    fillSchedules(info)

    info.currentWeek = 1
    info.stage = "season"
    info.save()


def get_next_season_preview(info):
    """
    Generate preview of changes for next season, assuming auto_realignment=True and auto_update_postseason_format=True.
    Returns a tuple of (realignment_changes, playoff_changes) so users can see what would happen.
    
    Returns:
        tuple: (realignment_dict, playoff_changes_dict)
            - realignment_dict: Teams changing conferences {team_name: {"old": conf, "new": conf}}
            - playoff_changes_dict: Playoff format changes {"teams": {"old": X, "new": Y}, ...}
    """
    next_year = info.currentYear + 1
    file_path = f"data/years/{next_year}.json"

    if not os.path.exists(file_path):
        return {}, {}

    data = load_year_data(next_year)

    # Get realignment changes (always show what would happen if auto_realignment=True)
    team_dict = {}
    teams = info.teams.all().select_related("conference")

    # Map current teams to their old conferences
    for team in teams:
        team_dict[team.name] = {
            "old": team.conference.confName if team.conference else "Independent"
        }

    # Map teams to their new conferences from data (what would happen with auto_realignment=True)
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
    realignment_changes = {
        name: confs for name, confs in team_dict.items() if confs["old"] != confs["new"]
    }

    # Get playoff changes (always show what would happen if auto_update_postseason_format=True)
    playoff_changes = {}
    playoff_config = data.get("playoff", {})
    
    current_settings = info.settings
    current_teams = current_settings.playoff_teams
    current_autobids = current_settings.playoff_autobids or 0
    current_conf_champ_top_4 = current_settings.playoff_conf_champ_top_4

    
    # Get next year's playoff values (what would be applied if auto_update_postseason_format=True)
    next_teams = playoff_config.get("teams", current_teams)
    next_autobids = playoff_config.get("conf_champ_autobids", 0)
    next_conf_champ_top_4 = playoff_config.get("conf_champ_top_4", False)
    
    # Ensure proper values for 2 or 4 team playoffs
    if next_teams in [2, 4]:
        next_autobids = 0
        next_conf_champ_top_4 = False
    
    # Build playoff changes dict (only include fields that actually change)
    if current_teams != next_teams:
        playoff_changes["teams"] = {"old": current_teams, "new": next_teams}
    if current_autobids != next_autobids:
        playoff_changes["autobids"] = {"old": current_autobids, "new": next_autobids}
    if current_conf_champ_top_4 != next_conf_champ_top_4:
        playoff_changes["conf_champ_top_4"] = {"old": current_conf_champ_top_4, "new": next_conf_champ_top_4}

    return realignment_changes, playoff_changes


def realignment(info, data):
    """Update team conference assignments based on year data"""
    # Check auto_realignment setting
    try:
        if not info.settings.auto_realignment:
            # Skip realignment if auto_realignment is False
            return
    except (Settings.DoesNotExist, AttributeError):
        # If settings don't exist, proceed with realignment (default behavior)
        pass
    
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
    auto_realignment=True,
    auto_update_postseason_format=True,
):
    """Initialize a new season with all required data"""
    overall_start = time.time()
    print(f"\n--- SEASON INITIALIZATION ---")
    print("PHASE 1: DATA LOADING AND CONFIGURATION")

    # Phase 1: Load data and configure playoff settings
    config_start = time.time()
    data = load_year_data(year)

    # Determine playoff configuration
    playoff_config = data["playoff"]
    
    # Determine final playoff values for Settings based on auto_update_postseason_format
    if auto_update_postseason_format:
        # Use year data file values for settings
        final_playoff_teams = playoff_config["teams"]
        final_playoff_autobids = playoff_config.get("conf_champ_autobids", 0)
        final_conf_champ_top_4 = playoff_config.get("conf_champ_top_4", False)
    else:
        # Use settings preferences
        final_playoff_teams = playoff_teams if playoff_teams is not None else playoff_config["teams"]
        final_playoff_autobids = playoff_autobids if playoff_autobids is not None else playoff_config.get("conf_champ_autobids", 0)
        final_conf_champ_top_4 = playoff_conf_champ_top_4 if playoff_conf_champ_top_4 is not None else playoff_config.get("conf_champ_top_4", False)

    # Ensure proper values for 2 or 4 team playoffs
    if final_playoff_teams in [2, 4]:
        final_playoff_autobids = 0
        final_conf_champ_top_4 = False

    calculated_last_week = LAST_WEEK_BY_PLAYOFF_TEAMS[final_playoff_teams]
    time_section(config_start, "  • Data loaded and playoff configuration set")

    # Phase 2: Create core objects
    core_start = time.time()
    print("PHASE 2: CORE OBJECT CREATION")

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

    # Create Playoff instance (without teams/autobids/conf_champ_top_4 - those are in Settings now)
    playoff = Playoff.objects.create(info=info)
    info.playoff = playoff
    
    # Create Settings instance with playoff format values
    Settings.objects.create(
        info=info,
        playoff_teams=final_playoff_teams,
        playoff_autobids=final_playoff_autobids,
        playoff_conf_champ_top_4=final_conf_champ_top_4,
        auto_realignment=auto_realignment,
        auto_update_postseason_format=auto_update_postseason_format
    )
    
    time_section(core_start, "  • Info, playoff, and settings objects created")

    # Phase 3: Create conferences and teams
    teams_start = time.time()
    print("PHASE 3: CONFERENCES AND TEAMS")

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
                city=team_data.get("city"),
                state=team_data.get("state"),
                stadium=team_data.get("stadium"),
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
            city=team_data.get("city"),
            state=team_data.get("state"),
            stadium=team_data.get("stadium"),
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
    time_section(teams_start, "  • Conferences and teams created")

    # Phase 4: Initialize historical data
    history_start = time.time()
    print("PHASE 4: HISTORICAL DATA")
    init_history_data(info, year)
    time_section(history_start, "  • Historical data initialized")

    # Phase 5: Create players
    player_start = time.time()
    print("PHASE 5: PLAYER CREATION")
    create_freshmen(info)
    time_section(player_start, "  • Players created")

    # Phase 6: Team setup and ratings
    setup_start = time.time()
    print("PHASE 6: TEAM SETUP AND RATINGS")

    # Set starters
    starter_start = time.time()
    set_starters(info)
    time_section(starter_start, "  • Starters assigned")

    # Calculate team ratings
    rating_start = time.time()
    calculate_team_ratings(info=info)
    time_section(rating_start, "  • Team ratings calculated")

    # Phase 7: Create betting odds
    odds_start = time.time()
    print("PHASE 7: BETTING ODDS")
    teams = info.teams.all()
    max_rating = teams.order_by("-rating").first().rating
    min_rating = teams.order_by("rating").first().rating
    rating_range = max_rating - min_rating + 10

    odds_list = load_precomputed_odds(max_diff=min(rating_range, 100))
    max_available_diff = max(odds_list.keys()) if odds_list else 0
    if rating_range > max_available_diff and odds_list:
        print(
            f"  • Betting odds capped at diff {max_available_diff} for higher gaps"
        )
        for diff in range(max_available_diff + 1, rating_range + 1):
            odds_list[diff] = odds_list[max_available_diff].copy()
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
    time_section(odds_start, "  • Betting odds created")

    # Phase 8: Final initialization
    print("PHASE 8: FINAL INITIALIZATION")

    # Initialize rankings
    ranking_start = time.time()
    initialize_rankings(info)
    time_section(ranking_start, "  • Team rankings initialized")

    # Set rivalries
    rival_start = time.time()
    set_rivalries(info)
    time_section(rival_start, "  • Rivalries set")

    time_section(overall_start, "SEASON INITIALIZATION COMPLETE")
    print("--- SEASON INITIALIZATION COMPLETE ---\n")
    return info

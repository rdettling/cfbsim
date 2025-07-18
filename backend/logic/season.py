from .schedule import *
from .players import *
from .sim.sim_helper import getSpread
from django.db import transaction
import os
from .sim.sim import *
from .util import get_recruiting_points, get_last_week, load_and_merge_year_data


def next_season(info):
    current_year = info.currentYear
    while current_year >= info.startYear:
        file_path = f"data/years/{current_year}.json"
        if os.path.exists(file_path):
            data = load_and_merge_year_data(current_year)
            break
        else:
            current_year -= 1

    update_teams_and_rosters(info, data)
    refresh_teams_and_games(info)
    set_rivalries(info, data)


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


def start_season(info):
    start = time.time()
    fillSchedules(info)
    print(f"fill schedules {time.time() - start} seconds")

    # aiRecruitOffers(info)

    info.currentWeek = 1
    info.stage = "season"
    info.save()


def realignment_summary(info):
    next_year = info.currentYear + 1
    file_path = f"data/years/{next_year}.json"

    team_dict = {}
    if os.path.exists(file_path):
        data = load_and_merge_year_data(next_year)

        teams = info.teams.all().select_related("conference")
        for team in teams:
            team_dict[team.name] = {
                "old": team.conference.confName if team.conference else "Independent"
            }

        for conf in data["conferences"]:
            for team in conf["teams"]:
                if team["name"] in team_dict:
                    team_dict[team["name"]]["new"] = conf["confName"]
                else:
                    team_dict[team["name"]] = {"old": "FCS", "new": conf["confName"]}

        for team in data["independents"]:
            if team["name"] in team_dict:
                team_dict[team["name"]]["new"] = "Independent"
            else:
                team_dict[team["name"]] = {"old": "FCS", "new": "Independent"}

        for team_name in team_dict:
            if "new" not in team_dict[team_name]:
                team_dict[team_name]["new"] = "FCS"

        team_dict = {
            name: confs
            for name, confs in team_dict.items()
            if confs["old"] != confs["new"]
        }

    return team_dict


def realignment(info, data):
    info.playoff.teams = data["playoff"]["teams"]
    info.playoff.autobids = data["playoff"].get("conf_champ_autobids", 0)
    info.playoff.conf_champ_top_4 = data["playoff"].get("conf_champ_top_4", False)
    # Update lastWeek based on new playoff format
    info.lastWeek = get_last_week(info.playoff.teams)
    info.playoff.save()
    info.save()

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


def init(
    user_id,
    team_name,
    year,
    playoff_teams=None,
    playoff_autobids=None,
    playoff_conf_champ_top_4=None,
):
    data = load_and_merge_year_data(year)

    # Use provided playoff settings or defaults from JSON
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

    print(f"playoff_config: {playoff_config}")
    print(f"final_playoff_teams: {final_playoff_teams}")
    print(f"final_playoff_autobids: {final_playoff_autobids}")
    print(f"final_conf_champ_top_4: {final_conf_champ_top_4}")

    # Calculate lastWeek based on playoff format
    calculated_last_week = get_last_week(final_playoff_teams)

    overall_start = time.time()

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
            if team["name"] == team_name:
                info.team = Team

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
        if team["name"] == team_name:
            info.team = Team

    start = time.time()
    Conferences.objects.bulk_create(conferences_to_create)
    Teams.objects.bulk_create(teams_to_create)
    info.save()
    teams = info.teams.all()
    print(f"Create teams, conferences {time.time() - start} seconds")

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
    set_rivalries(info)
    print(f"rivalries {time.time() - start} seconds")

    print(f"Total execution Time: {time.time() - overall_start} seconds")

    # generate_recruits(info, recruits_to_create)
    # Recruits.objects.bulk_create(recruits_to_create)

    return info

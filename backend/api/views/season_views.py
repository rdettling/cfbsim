from ..models import *
from django.db.models import F
from logic.season import *
from rest_framework.decorators import api_view
from rest_framework.response import Response
from ..serializers import *
from django.db.models import F, ExpressionWrapper, FloatField
from operator import attrgetter
from logic.util import get_last_game, get_next_game, sort_standings
from logic.schedule import get_playoff_team_order
from logic.sim.sim_helper import (
    save_simulation_data,
    fetch_and_simulate_games,
    update_game_results,
    update_rankings,
    handle_special_weeks,
)


def generate_bracket_structure(info, playoff_teams):
    """Generate bracket structure for the playoff format following the Playoff model schema"""
    playoff_format = info.playoff.teams

    if playoff_format == 2:
        # Championship only
        return {
            "championship": {
                "team1": playoff_teams[0].name if len(playoff_teams) > 0 else "TBD",
                "team2": playoff_teams[1].name if len(playoff_teams) > 1 else "TBD",
                "seed1": 1,
                "seed2": 2,
                "is_projection": info.stage != "playoff",
            }
        }

    elif playoff_format == 4:
        # 4-team playoff: 1v4, 2v3
        return {
            "semifinals": [
                {
                    "team1": playoff_teams[0].name if len(playoff_teams) > 0 else "TBD",
                    "team2": playoff_teams[3].name if len(playoff_teams) > 3 else "TBD",
                    "seed1": 1,
                    "seed2": 4,
                    "is_projection": info.stage != "playoff",
                },
                {
                    "team1": playoff_teams[1].name if len(playoff_teams) > 1 else "TBD",
                    "team2": playoff_teams[2].name if len(playoff_teams) > 2 else "TBD",
                    "seed1": 2,
                    "seed2": 3,
                    "is_projection": info.stage != "playoff",
                },
            ],
            "championship": {
                "team1": "TBD",
                "team2": "TBD",
                "is_projection": info.stage != "playoff",
            },
        }

    elif playoff_format == 12:
        # Get teams in the correct order using the shared function
        teams = get_playoff_team_order(info)

        # 12-team playoff following the actual setPlayoffR1 logic
        return {
            "left_bracket": {
                "first_round": [
                    {
                        "id": "left_r1_1",
                        "team1": teams[7].name if len(teams) > 7 else "TBD",  # 8th seed
                        "team2": teams[8].name if len(teams) > 8 else "TBD",  # 9th seed
                        "seed1": 8,
                        "seed2": 9,
                        "is_projection": info.stage != "playoff",
                        "next_game": "left_quarter_1",
                    },
                    {
                        "id": "left_r1_2",
                        "team1": teams[4].name if len(teams) > 4 else "TBD",  # 5th seed
                        "team2": (
                            teams[11].name if len(teams) > 11 else "TBD"
                        ),  # 12th seed
                        "seed1": 5,
                        "seed2": 12,
                        "is_projection": info.stage != "playoff",
                        "next_game": "left_quarter_2",
                    },
                ],
                "quarterfinals": [
                    {
                        "id": "left_quarter_1",
                        "team1": teams[0].name if len(teams) > 0 else "TBD",  # 1st seed
                        "team2": "Winner of left_r1_1",
                        "seed1": 1,
                        "is_projection": info.stage != "playoff",
                        "next_game": "left_semi",
                    },
                    {
                        "id": "left_quarter_2",
                        "team1": teams[3].name if len(teams) > 3 else "TBD",  # 4th seed
                        "team2": "Winner of left_r1_2",
                        "seed1": 4,
                        "is_projection": info.stage != "playoff",
                        "next_game": "left_semi",
                    },
                ],
                "semifinal": {
                    "id": "left_semi",
                    "team1": "Winner of left_quarter_1",
                    "team2": "Winner of left_quarter_2",
                    "is_projection": info.stage != "playoff",
                    "next_game": "championship",
                },
            },
            "right_bracket": {
                "first_round": [
                    {
                        "id": "right_r1_1",
                        "team1": teams[6].name if len(teams) > 6 else "TBD",  # 7th seed
                        "team2": (
                            teams[9].name if len(teams) > 9 else "TBD"
                        ),  # 10th seed
                        "seed1": 7,
                        "seed2": 10,
                        "is_projection": info.stage != "playoff",
                        "next_game": "right_quarter_1",
                    },
                    {
                        "id": "right_r1_2",
                        "team1": teams[5].name if len(teams) > 5 else "TBD",  # 6th seed
                        "team2": (
                            teams[10].name if len(teams) > 10 else "TBD"
                        ),  # 11th seed
                        "seed1": 6,
                        "seed2": 11,
                        "is_projection": info.stage != "playoff",
                        "next_game": "right_quarter_2",
                    },
                ],
                "quarterfinals": [
                    {
                        "id": "right_quarter_1",
                        "team1": teams[1].name if len(teams) > 1 else "TBD",  # 2nd seed
                        "team2": "Winner of right_r1_1",
                        "seed1": 2,
                        "is_projection": info.stage != "playoff",
                        "next_game": "right_semi",
                    },
                    {
                        "id": "right_quarter_2",
                        "team1": teams[2].name if len(teams) > 2 else "TBD",  # 3rd seed
                        "team2": "Winner of right_r1_2",
                        "seed1": 3,
                        "is_projection": info.stage != "playoff",
                        "next_game": "right_semi",
                    },
                ],
                "semifinal": {
                    "id": "right_semi",
                    "team1": "Winner of right_quarter_1",
                    "team2": "Winner of right_quarter_2",
                    "is_projection": info.stage != "playoff",
                    "next_game": "championship",
                },
            },
            "championship": {
                "id": "championship",
                "team1": "Winner of left_semi",
                "team2": "Winner of right_semi",
                "is_projection": info.stage != "playoff",
            },
        }

    return {}


@api_view(["GET"])
def rankings(request):
    """API endpoint for rankings data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    teams = Teams.objects.filter(info=info).order_by("ranking")

    # Process team data with last/next game info
    rankings_data = []
    for t in teams:
        last_game = get_last_game(info, t)
        next_game = get_next_game(info, t)

        team_data = {
            "name": t.name,
            "ranking": t.ranking,
            "record": format_record(t),
            "movement": t.last_rank - t.ranking if t.last_rank else 0,
            "poll_score": t.poll_score,
            "strength_of_record": t.strength_of_record,
            "last_game": last_game,
            "next_game": next_game,
        }

        rankings_data.append(team_data)

    return Response(
        {
            "info": InfoSerializer(info).data,
            "rankings": rankings_data,
            "team": TeamsSerializer(info.team).data,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


@api_view(["GET"])
def standings(request, conference_name):
    """API endpoint for conference standings data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    def process_team(team):
        return {
            "name": team.name,
            "ranking": team.ranking,
            "confWins": team.confWins,
            "confLosses": team.confLosses,
            "totalWins": team.totalWins,
            "totalLosses": team.totalLosses,
            "rating": team.rating,
            "last_game": get_last_game(info, team),
            "next_game": get_next_game(info, team),
        }

    if conference_name != "independent":
        conference = info.conferences.get(confName=conference_name)
        teams = list(conference.teams.all())

        # Use the new sorting function
        sorted_teams = sort_standings(teams)

        return Response(
            {
                "info": InfoSerializer(info).data,
                "team": TeamsSerializer(info.team).data,
                "conference": conference.confName,
                "teams": [process_team(team) for team in sorted_teams],
                "conferences": ConferenceNameSerializer(
                    info.conferences.all().order_by("confName"), many=True
                ).data,
            }
        )
    else:
        independent_teams = list(info.teams.filter(conference=None))

        # For independents, we still want to sort them, but they're primarily ordered by total wins
        # You can either modify sort_standings to handle this case or use a different approach
        sorted_independents = sort_standings(independent_teams)

        return Response(
            {
                "info": InfoSerializer(info).data,
                "team": TeamsSerializer(info.team).data,
                "teams": [process_team(team) for team in sorted_independents],
                "conferences": ConferenceNameSerializer(
                    info.conferences.all().order_by("confName"), many=True
                ).data,
            }
        )


@api_view(["GET"])
def playoff(request):
    """API endpoint for playoff projection data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    # Get the number of autobids
    autobids = info.playoff.autobids

    # Get conference champions or top teams from each conference
    conference_champions = []
    for conference in info.conferences.all():
        if conference.championship and conference.championship.winner:
            conference_champions.append(conference.championship.winner)
        else:
            conf_teams = conference.teams.annotate(
                win_percentage=ExpressionWrapper(
                    F("confWins") * 1.0 / (F("confWins") + F("confLosses")),
                    output_field=FloatField(),
                )
            ).order_by("-win_percentage", "-confWins", "ranking", "-totalWins")
            if conf_teams.exists():
                conference_champions.append(conf_teams.first())

    # Sort conference champions by ranking
    conference_champions.sort(key=attrgetter("ranking"))

    # Get the top 4 seeds (conference champions from different conferences)
    top_4_seeds = []
    seen_conferences = set()
    for team in conference_champions:
        if team.conference.confName not in seen_conferences:
            top_4_seeds.append(team)
            seen_conferences.add(team.conference.confName)
        if len(top_4_seeds) == 4:
            break

    # Get the remaining autobid teams
    remaining_autobids = conference_champions[len(top_4_seeds) : autobids]

    # Get all other teams (excluding all autobid teams)
    other_teams = (
        Teams.objects.filter(info=info)
        .exclude(id__in=[team.id for team in top_4_seeds + remaining_autobids])
        .order_by("ranking")
    )

    # Select the remaining at-large teams
    at_large_teams = list(other_teams)[: 8 - len(remaining_autobids)]

    # Get the bubble teams (5 highest ranked at-large teams that didn't make it)
    bubble_teams = list(other_teams)[len(at_large_teams) : len(at_large_teams) + 5]

    # Combine all teams and sort by ranking (except top 4)
    playoff_teams = top_4_seeds + sorted(
        remaining_autobids + at_large_teams, key=attrgetter("ranking")
    )

    # Process playoff teams data
    playoff_data = [
        {
            "name": team.name,
            "seed": i + 1,
            "ranking": team.ranking,
            "conference": team.conference.confName if team.conference else None,
            "record": format_record(team),
            "is_autobid": team in (top_4_seeds + remaining_autobids),
        }
        for i, team in enumerate(playoff_teams)
    ]

    # Process bubble teams data
    bubble_data = [
        {
            "name": team.name,
            "ranking": team.ranking,
            "conference": (
                team.conference.confName if team.conference else "Independent"
            ),
            "record": format_record(team),
        }
        for team in bubble_teams
    ]

    # Process conference champions data
    champion_data = [
        {
            "name": team.name,
            "ranking": team.ranking,
            "conference": (
                team.conference.confName if team.conference else "Independent"
            ),
            "record": format_record(team),
            "seed": next(
                (pt["seed"] for pt in playoff_data if pt["name"] == team.name), None
            ),
        }
        for team in sorted(conference_champions, key=attrgetter("ranking"))
    ]

    # Generate bracket structure based on playoff format
    bracket_data = generate_bracket_structure(info, playoff_teams)

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(info.team).data,
            "playoff_teams": playoff_data,
            "bubble_teams": bubble_data,
            "conference_champions": champion_data,
            "bracket": bracket_data,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


@api_view(["GET"])
def season_summary(request):
    """API endpoint for season summary data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    if info.stage == "season":
        update_history(info)
        info.stage = "summary"
        info.save()

    return Response(
        {
            "team": TeamsSerializer(info.team).data,
            "info": InfoSerializer(info).data,
            "championship": GamesSerializer(info.playoff.natty).data,
            "realignment": realignment_summary(info),
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


@api_view(["GET"])
def roster_progression(request):
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    # Update rosters and info if not in "roster progression" stage
    if info.stage == "summary":
        progressed = progress_players(info, first_time=True)
        info.stage = "progression"
        info.currentYear += 1
        info.currentWeek = 1
        info.save()
    else:
        progressed = progress_players(info)

    for player in progressed:
        if player.year == "so":
            player.change = player.rating - player.rating_fr
        elif player.year == "jr":
            player.change = player.rating - player.rating_so
        elif player.year == "sr":
            player.change = player.rating - player.rating_jr

    return Response(
        {
            "team": TeamsSerializer(info.team).data,
            "info": InfoSerializer(info).data,
            "progressed": PlayersSerializer(progressed, many=True).data,
            "leaving": PlayersSerializer(
                info.team.players.filter(year="sr"), many=True
            ).data,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


@api_view(["GET"])
def sim(request, dest_week):
    """API endpoint for simulating games up to a destination week"""
    total_start_time = time.time()

    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    start_week = info.currentWeek
    print(f"Starting simulation from week {start_week} to week {dest_week}")

    drives_to_create = []
    plays_to_create = []

    # Simulate each week until we reach the destination week
    while info.currentWeek < dest_week:
        week_start_time = time.time()
        print(f"\nSimulating week {info.currentWeek}...")

        # 1. Fetch and simulate games
        games = fetch_and_simulate_games(info, drives_to_create, plays_to_create)

        # 2. Generate headlines and update game results
        update_game_results(games)

        # 3. Update rankings if needed
        update_rankings(info)

        # 4. Handle special weeks (conference championships, playoffs, etc.)
        handle_special_weeks(info)

        # Increment week and log completion time
        info.currentWeek += 1
        print(
            f"Week {info.currentWeek-1} completed in {time.time() - week_start_time:.4f} seconds"
        )

    # Save all accumulated data
    save_simulation_data(info, drives_to_create, plays_to_create)

    total_time = time.time() - total_start_time
    print(
        f"\nTotal simulation time from week {start_week} to {info.currentWeek}: {total_time:.4f} seconds"
    )

    return Response(
        {
            "status": "success",
            "execution_time": round(total_time, 2),
            "weeks_simulated": dest_week - start_week,
            "time_per_week": round(total_time / (dest_week - start_week), 2),
        }
    )

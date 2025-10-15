from ..models import *
from django.db.models import F
from logic.season import update_history, realignment_summary
from rest_framework.decorators import api_view
from rest_framework.response import Response
from ..serializers import *
from django.db.models import F, ExpressionWrapper, FloatField
from operator import attrgetter
from logic.util import get_last_game, get_next_game, sort_standings, time_section
from logic.schedule import get_playoff_team_order
from logic.sim.sim_helper import (
    save_simulation_data,
    fetch_and_simulate_games,
    update_game_results,
    update_rankings,
    handle_special_weeks,
)
import time


def generate_bracket_structure(info, playoff_teams):
    """Generate bracket structure for the playoff format following the Playoff model schema"""
    playoff_format = info.playoff.teams
    is_projection = info.currentWeek < 14
    playoff_obj = info.playoff_info.first()
    
    print(f"generate_bracket_structure - is_projection: {is_projection}, current week: {info.currentWeek}")
    print(f"playoff_format: {playoff_format}")
    print(f"playoff_teams: {[team.name for team in playoff_teams]}")
    
    # Helper function to get seed for a team
    def get_seed(team_name):
        for i, team in enumerate(playoff_teams):
            if team.name == team_name:
                return i + 1
        return None
    
    # Helper function to get game with scores and winner
    def get_game_result(game, team1_name, team2_name):
        if not game or is_projection:
            return {
                "team1": team1_name,
                "team2": team2_name,
                "seed1": get_seed(team1_name),
                "seed2": get_seed(team2_name),
                "score1": None,
                "score2": None,
                "winner": None
            }
        
        # Get actual team objects from the game
        actual_team1 = game.teamA if game.teamA.name == team1_name else game.teamB
        actual_team2 = game.teamB if game.teamA.name == team1_name else game.teamA
        
        # Determine scores based on which team is team1
        if game.teamA.name == team1_name:
            score1, score2 = game.scoreA, game.scoreB
        else:
            score1, score2 = game.scoreB, game.scoreA
        
        return {
            "game_id": game.id,
            "team1": actual_team1.name,
            "team2": actual_team2.name,
            "seed1": get_seed(actual_team1.name),
            "seed2": get_seed(actual_team2.name),
            "score1": score1 if game.winner else None,
            "score2": score2 if game.winner else None,
            "winner": game.winner.name if game.winner else None
        }

    if playoff_format == 2:
        # Championship only
        championship_game = playoff_obj.natty if not is_projection else None
        team1 = playoff_teams[0].name if len(playoff_teams) > 0 else "TBD"
        team2 = playoff_teams[1].name if len(playoff_teams) > 1 else "TBD"
        
        return {
            "championship": get_game_result(championship_game, team1, team2)
        }

    elif playoff_format == 4:
        # 4-team playoff: 1v4, 2v3
        left_semi = playoff_obj.left_semi if not is_projection else None
        right_semi = playoff_obj.right_semi if not is_projection else None
        championship = playoff_obj.natty if not is_projection else None
        
        # Get semifinal teams
        team1_semi1 = playoff_teams[0].name if len(playoff_teams) > 0 else "TBD"
        team2_semi1 = playoff_teams[3].name if len(playoff_teams) > 3 else "TBD"
        team1_semi2 = playoff_teams[1].name if len(playoff_teams) > 1 else "TBD"
        team2_semi2 = playoff_teams[2].name if len(playoff_teams) > 2 else "TBD"
        
        # Determine championship teams based on winners
        team1_champ = left_semi.winner.name if left_semi and left_semi.winner else "TBD"
        team2_champ = right_semi.winner.name if right_semi and right_semi.winner else "TBD"
        
        return {
            "semifinals": [
                get_game_result(left_semi, team1_semi1, team2_semi1),
                get_game_result(right_semi, team1_semi2, team2_semi2),
            ],
            "championship": get_game_result(championship, team1_champ, team2_champ)
        }

    elif playoff_format == 12:
        # Use the playoff teams passed in (which are the actual teams when not in projection)
        teams = playoff_teams
        
        # Get actual game objects if we're in playoff stage
        left_r1_1 = playoff_obj.left_r1_1 if not is_projection else None
        left_r1_2 = playoff_obj.left_r1_2 if not is_projection else None
        right_r1_1 = playoff_obj.right_r1_1 if not is_projection else None
        right_r1_2 = playoff_obj.right_r1_2 if not is_projection else None
        
        left_quarter_1 = playoff_obj.left_quarter_1 if not is_projection else None
        left_quarter_2 = playoff_obj.left_quarter_2 if not is_projection else None
        right_quarter_1 = playoff_obj.right_quarter_1 if not is_projection else None
        right_quarter_2 = playoff_obj.right_quarter_2 if not is_projection else None
        
        left_semi = playoff_obj.left_semi if not is_projection else None
        right_semi = playoff_obj.right_semi if not is_projection else None
        
        championship = playoff_obj.natty if not is_projection else None
        
        # Determine team names for first round
        team1_left_r1_1 = teams[7].name if len(teams) > 7 else "TBD"  # 8th seed
        team2_left_r1_1 = teams[8].name if len(teams) > 8 else "TBD"  # 9th seed
        
        team1_left_r1_2 = teams[4].name if len(teams) > 4 else "TBD"  # 5th seed
        team2_left_r1_2 = teams[11].name if len(teams) > 11 else "TBD"  # 12th seed
        
        team1_right_r1_1 = teams[6].name if len(teams) > 6 else "TBD"  # 7th seed
        team2_right_r1_1 = teams[9].name if len(teams) > 9 else "TBD"  # 10th seed
        
        team1_right_r1_2 = teams[5].name if len(teams) > 5 else "TBD"  # 6th seed
        team2_right_r1_2 = teams[10].name if len(teams) > 10 else "TBD"  # 11th seed
        
        # Determine team names for quarterfinals
        team1_left_quarter_1 = teams[0].name if len(teams) > 0 else "TBD"  # 1st seed
        team2_left_quarter_1 = "Winner of left_r1_1"
        if left_r1_1 and left_r1_1.winner:
            team2_left_quarter_1 = left_r1_1.winner.name
        
        team1_left_quarter_2 = teams[3].name if len(teams) > 3 else "TBD"  # 4th seed
        team2_left_quarter_2 = "Winner of left_r1_2"
        if left_r1_2 and left_r1_2.winner:
            team2_left_quarter_2 = left_r1_2.winner.name
        
        team1_right_quarter_1 = teams[1].name if len(teams) > 1 else "TBD"  # 2nd seed
        team2_right_quarter_1 = "Winner of right_r1_1"
        if right_r1_1 and right_r1_1.winner:
            team2_right_quarter_1 = right_r1_1.winner.name
        
        team1_right_quarter_2 = teams[2].name if len(teams) > 2 else "TBD"  # 3rd seed
        team2_right_quarter_2 = "Winner of right_r1_2"
        if right_r1_2 and right_r1_2.winner:
            team2_right_quarter_2 = right_r1_2.winner.name
        
        # Determine team names for semifinals
        team1_left_semi = "Winner of left_quarter_1"
        if left_quarter_1 and left_quarter_1.winner:
            team1_left_semi = left_quarter_1.winner.name
        
        team2_left_semi = "Winner of left_quarter_2"
        if left_quarter_2 and left_quarter_2.winner:
            team2_left_semi = left_quarter_2.winner.name
        
        team1_right_semi = "Winner of right_quarter_1"
        if right_quarter_1 and right_quarter_1.winner:
            team1_right_semi = right_quarter_1.winner.name
        
        team2_right_semi = "Winner of right_quarter_2"
        if right_quarter_2 and right_quarter_2.winner:
            team2_right_semi = right_quarter_2.winner.name
        
        # Determine team names for championship
        team1_championship = "Winner of left_semi"
        if left_semi and left_semi.winner:
            team1_championship = left_semi.winner.name
        
        team2_championship = "Winner of right_semi"
        if right_semi and right_semi.winner:
            team2_championship = right_semi.winner.name

        # 12-team playoff following the actual setPlayoffR1 logic
        return {
            "left_bracket": {
                "first_round": [
                    {
                        "id": "left_r1_1",
                        **get_game_result(left_r1_1, team1_left_r1_1, team2_left_r1_1),
                        "next_game": "left_quarter_1",
                    },
                    {
                        "id": "left_r1_2",
                        **get_game_result(left_r1_2, team1_left_r1_2, team2_left_r1_2),
                        "next_game": "left_quarter_2",
                    },
                ],
                "quarterfinals": [
                    {
                        "id": "left_quarter_1",
                        **get_game_result(left_quarter_1, team1_left_quarter_1, team2_left_quarter_1),
                        "next_game": "left_semi",
                    },
                    {
                        "id": "left_quarter_2",
                        **get_game_result(left_quarter_2, team1_left_quarter_2, team2_left_quarter_2),
                        "next_game": "left_semi",
                    },
                ],
                "semifinal": {
                    "id": "left_semi",
                    **get_game_result(left_semi, team1_left_semi, team2_left_semi),
                    "next_game": "championship",
                },
            },
            "right_bracket": {
                "first_round": [
                    {
                        "id": "right_r1_1",
                        **get_game_result(right_r1_1, team1_right_r1_1, team2_right_r1_1),
                        "next_game": "right_quarter_1",
                    },
                    {
                        "id": "right_r1_2",
                        **get_game_result(right_r1_2, team1_right_r1_2, team2_right_r1_2),
                        "next_game": "right_quarter_2",
                    },
                ],
                "quarterfinals": [
                    {
                        "id": "right_quarter_1",
                        **get_game_result(right_quarter_1, team1_right_quarter_1, team2_right_quarter_1),
                        "next_game": "right_semi",
                    },
                    {
                        "id": "right_quarter_2",
                        **get_game_result(right_quarter_2, team1_right_quarter_2, team2_right_quarter_2),
                        "next_game": "right_semi",
                    },
                ],
                "semifinal": {
                    "id": "right_semi",
                    **get_game_result(right_semi, team1_right_semi, team2_right_semi),
                    "next_game": "championship",
                },
            },
            "championship": {
                "id": "championship",
                **get_game_result(championship, team1_championship, team2_championship),
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
            "conferences": ConferencesSerializer(
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
                "conferences": ConferencesSerializer(
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
                "conferences": ConferencesSerializer(
                    info.conferences.all().order_by("confName"), many=True
                ).data,
            }
        )


@api_view(["GET"])
def playoff(request):
    """API endpoint for playoff projection data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    playoff_format = info.playoff.teams
    is_projection = info.currentWeek < 14
    
    print(f"Playoff view - is_projection: {is_projection}, current week: {info.currentWeek}")
    
    # Get playoff object
    playoff_obj = info.playoff_info.first()

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

    # Different logic based on playoff format
    if playoff_format == 2:
        if not is_projection and playoff_obj.seed_1 and playoff_obj.seed_2:
            # Use actual playoff teams from playoff object
            playoff_teams = [playoff_obj.seed_1, playoff_obj.seed_2]
        else:
            # Championship only - top 2 teams (projection)
            playoff_teams = list(Teams.objects.filter(info=info).order_by("ranking")[:2])
            
        bubble_teams = list(Teams.objects.filter(info=info).order_by("ranking")[2:7])
        
        playoff_data = [
            {
                "name": team.name,
                "seed": i + 1,
                "ranking": team.ranking,
                "conference": team.conference.confName if team.conference else None,
                "record": format_record(team),
                "is_autobid": False,
            }
            for i, team in enumerate(playoff_teams)
        ]
        
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

    elif playoff_format == 4:
        if not is_projection and playoff_obj.seed_1 and playoff_obj.seed_2 and playoff_obj.seed_3 and playoff_obj.seed_4:
            # Use actual playoff teams from playoff object
            playoff_teams = [playoff_obj.seed_1, playoff_obj.seed_2, playoff_obj.seed_3, playoff_obj.seed_4]
            print(f"Using actual playoff teams: {[team.name for team in playoff_teams]}")
        else:
            # 4-team playoff - top 4 teams (projection)
            playoff_teams = list(Teams.objects.filter(info=info).order_by("ranking")[:4])
            print(f"Using projected playoff teams: {[team.name for team in playoff_teams]}")
            
        bubble_teams = list(Teams.objects.filter(info=info).order_by("ranking")[4:9])
        
        playoff_data = [
            {
                "name": team.name,
                "seed": i + 1,
                "ranking": team.ranking,
                "conference": team.conference.confName if team.conference else None,
                "record": format_record(team),
                "is_autobid": False,
            }
            for i, team in enumerate(playoff_teams)
        ]
        
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

    else:  # playoff_format == 12
        # Check if we have actual playoff data
        if not is_projection and all([getattr(playoff_obj, f"seed_{i}", None) for i in range(1, 13)]):
            # Use actual playoff teams from playoff object
            playoff_teams = [getattr(playoff_obj, f"seed_{i}") for i in range(1, 13)]
            print(f"Using actual 12-team playoff teams: {[team.name for team in playoff_teams]}")
            
            # For actual playoff, we still need to determine which teams were autobids
            # This will be used for the is_autobid flag in playoff_data
            autobids = info.playoff.autobids
            conf_champ_top_4 = info.playoff.conf_champ_top_4
            
            if autobids > 0:
                if conf_champ_top_4:
                    # Top 4 seeds are conference champions
                    top_4_seeds = playoff_teams[:4]
                    # Remaining autobids would be other conference champions
                    remaining_autobids = []
                    seen_conferences = set([team.conference.confName for team in top_4_seeds if team.conference])
                    
                    for team in conference_champions:
                        if team.conference and team.conference.confName not in seen_conferences and team in playoff_teams[4:]:
                            remaining_autobids.append(team)
                            seen_conferences.add(team.conference.confName)
                        if len(remaining_autobids) + len(top_4_seeds) == autobids:
                            break
                else:
                    # Top 4 seeds are highest ranked teams
                    top_4_seeds = playoff_teams[:4]
                    # Autobids would be conference champions
                    remaining_autobids = [team for team in conference_champions if team in playoff_teams[4:]][:autobids-len(top_4_seeds)]
            else:
                top_4_seeds = playoff_teams[:4]
                remaining_autobids = []
                
            # Get teams that didn't make the playoff for bubble teams
            other_teams = Teams.objects.filter(info=info).exclude(id__in=[team.id for team in playoff_teams]).order_by("ranking")
            bubble_teams = list(other_teams)[:5]
            
        else:
            # Get the number of autobids for projection
            autobids = info.playoff.autobids
            conf_champ_top_4 = info.playoff.conf_champ_top_4

            # Get the top 4 seeds based on setting
            if conf_champ_top_4:
                # Top 4 seeds are conference champions from different conferences
                top_4_seeds = []
                seen_conferences = set()
                for team in conference_champions:
                    if team.conference and team.conference.confName not in seen_conferences:
                        top_4_seeds.append(team)
                        seen_conferences.add(team.conference.confName)
                    if len(top_4_seeds) == 4:
                        break
            else:
                # Top 4 seeds are highest ranked teams overall
                top_4_seeds = list(Teams.objects.filter(info=info).order_by("ranking")[:4])

            # Get the remaining autobid teams (only if conf_champ_top_4 is true and autobids > 0)
            if conf_champ_top_4 and autobids > 0:
                remaining_autobids = conference_champions[len(top_4_seeds) : autobids]
                # Get all other teams (excluding top 4 seeds and remaining autobids)
                other_teams = (
                    Teams.objects.filter(info=info)
                    .exclude(id__in=[team.id for team in top_4_seeds + remaining_autobids])
                    .order_by("ranking")
                )
                # Select the remaining at-large teams
                at_large_teams = list(other_teams)[: 8 - len(remaining_autobids)]
            else:
                remaining_autobids = []
                # Get all other teams (excluding top 4 seeds)
                other_teams = (
                    Teams.objects.filter(info=info)
                    .exclude(id__in=[team.id for team in top_4_seeds])
                    .order_by("ranking")
                )
                # Select the remaining at-large teams (12 - 4 = 8 teams)
                at_large_teams = list(other_teams)[:8]

            # Get the bubble teams (5 highest ranked at-large teams that didn't make it)
            bubble_teams = list(other_teams)[len(at_large_teams) : len(at_large_teams) + 5]

            # Combine all teams and sort by ranking (except top 4)
            playoff_teams = top_4_seeds + sorted(
                remaining_autobids + at_large_teams, key=attrgetter("ranking")
            )
            
            print(f"Using projected 12-team playoff teams: {[team.name for team in playoff_teams]}")
        
        # Print autobid teams for debugging
        print(f"Top 4 seeds: {[team.name for team in top_4_seeds]}")
        print(f"Remaining autobids: {[team.name for team in remaining_autobids]}")
        print(f"Total autobids: {len(top_4_seeds) + len(remaining_autobids)}")
        print(f"Autobid setting: {autobids}")
        print(f"Conf champ top 4 setting: {conf_champ_top_4}")


        # Process playoff teams data
        playoff_data = [
            {
                "name": team.name,
                "seed": i + 1,
                "ranking": team.ranking,
                "conference": team.conference.confName if team.conference else None,
                "record": format_record(team),
                "is_autobid": (team in (top_4_seeds + remaining_autobids)) if autobids > 0 else False,
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
            "playoff": PlayoffSerializer(info.playoff).data,
            "playoff_teams": playoff_data,
            "bubble_teams": bubble_data,
            "conference_champions": champion_data,
            "bracket": bracket_data,
            "conferences": ConferencesSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


@api_view(["GET"])
def sim(request, dest_week):
    """API endpoint for simulating games up to a destination week"""
    overall_start = time.time()

    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    start_week = info.currentWeek

    drives_to_create = []
    plays_to_create = []

    # Simulate each week until we reach the destination week
    while info.currentWeek < dest_week:
        # 1. Fetch and simulate games
        games = fetch_and_simulate_games(info, drives_to_create, plays_to_create)

        # 2. Generate headlines and update game results
        natty_game = update_game_results(info, games)

        # 3. Update rankings if needed
        update_rankings(info, natty_game)

        # 4. Handle special weeks (conference championships, playoffs, etc.)
        handle_special_weeks(info)

        # Increment week and log completion time
        info.currentWeek += 1

    # Save all accumulated data
    save_simulation_data(info, drives_to_create, plays_to_create)

    time_section(
        overall_start,
        f"Total simulation time from week {start_week} to {info.currentWeek}",
    )

    return Response(
        {
            "status": "success",
            "weeks_simulated": dest_week - start_week,
        }
    )

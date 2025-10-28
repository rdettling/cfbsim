from ..models import *
from rest_framework.decorators import api_view
from rest_framework.response import Response
from ..serializers import *
from logic.util import format_record
from logic.sim.sim_helper import (
    get_or_cache_starters,
    update_team_records,
    save_games_and_teams,
    save_other_lists,
)
from logic.sim.sim import generatePlaysBank
from logic.headlines import generate_headlines


@api_view(["POST"])
def start_interactive_sim(request, game_id):
    """
    Start an interactive simulation for a game using plays bank approach.
    """
    try:
        # Get the game
        user_id = request.headers.get("X-User-ID")
        info = Info.objects.get(user_id=user_id)
        game = Games.objects.get(id=game_id)
        
        # Get user team
        user_team = info.team
        
        # Check if this is a user game
        if game.teamA != user_team and game.teamB != user_team:
            return Response(
                {"error": "This is not a user game"}, 
                status=400
            )
        
        # Check if game is already completed
        if game.winner:
            return Response(
                {"error": "Game has already been played"}, 
                status=400
            )
        
        # Get starters for player names
        starters_cache = get_or_cache_starters(info)
        
        # Generate plays bank
        plays_bank = generatePlaysBank(game, info, starters_cache)
        
        # Initialize game state
        game_state = {
            'current_drive_num': 1,
            'current_play_index': 0,
            'field_position': 20,
            'score_a': 0,
            'score_b': 0,
            'overtime': 0,
            'down': 1,
            'yards_left': 10,
            'is_user_team_on_offense': True,  # User team starts with ball
            'used_plays': [],  # Track which plays were used
            'drives': []  # Track completed drives
        }
        
        # No need to store state - frontend handles everything
        
        # Plays bank is already in the correct format - just pass it through
        plays_bank_data = plays_bank
        
        # Serialize game data using serializer
        game_data = GamesSerializer(game).data
        
        # Prepare response data
        response_data = {
            "info": InfoSerializer(info).data,
            "game": game_data,
            "team": TeamsSerializer(user_team).data,
            "plays_bank": plays_bank_data,
            "game_state": game_state,
            "conferences": ConferencesSerializer(
                info.conferences.all().order_by("confName"), many=True,
            ).data,
            "drives": [],  # Drives will be constructed on frontend
            "plays": [],  # Plays will be constructed on frontend
            "is_user_game": True,
            "decision_needed": {
                "type": "run_pass",
                "down": 1,
                "yards_left": 10,
                "field_position": 20
            }
        }
        
        return Response(response_data)
        
    except Games.DoesNotExist:
        return Response(
            {"error": "Game not found"}, 
            status=404
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, 
            status=500
        )


@api_view(["POST"])
def submit_decision(request, game_id):
    """
    Submit a user decision and get the next play.
    This is now handled entirely by the frontend, so this is just a placeholder.
    """
    return Response({"message": "Decision handling moved to frontend"})


@api_view(["POST"])
def complete_interactive_sim(request, game_id):
    """
    Complete interactive simulation and save the game results.
    """
    try:
        user_id = request.headers.get("X-User-ID")
        info = Info.objects.get(user_id=user_id)
        game = Games.objects.get(id=game_id)
        
        # Get the final state and used plays from the request body
        final_state = request.data.get('final_state')
        used_plays_data = request.data.get('used_plays')

        if not final_state or not used_plays_data:
            return Response({"error": "Missing final_state or used_plays"}, status=400)

        # Update game object with final scores
        game.scoreA = final_state['score_a']
        game.scoreB = final_state['score_b']
        game.overtime = final_state['overtime']

        # Determine winner
        if game.scoreA > game.scoreB:
            game.winner = game.teamA
            game.resultA, game.resultB = "W", "L"
        else:
            game.winner = game.teamB
            game.resultA, game.resultB = "L", "W"
        game.save()  # Save game with final scores and winner

        # Reconstruct Drives and Plays from used_plays_data
        drives_to_create = []
        plays_to_create = []
        current_drive = None
        drive_num = 0

        for play_data in used_plays_data:
            # Check if a new drive needs to be created
            # This logic assumes plays are ordered and drive transitions are clear
            if not current_drive or (play_data['down'] == 1 and play_data['startingFP'] == 20 and play_data['playType'] != 'kickoff'):
                drive_num += 1
                offense_team = game.teamA if play_data['offense_id'] == game.teamA.id else game.teamB
                defense_team = game.teamB if play_data['offense_id'] == game.teamA.id else game.teamA
                current_drive = Drives(
                    info=info,
                    game=game,
                    driveNum=drive_num,
                    offense=offense_team,
                    defense=defense_team,
                    startingFP=play_data['startingFP'],
                    result=None,  # Will be updated after all plays in drive are processed
                    points=0,
                    scoreAAfter=play_data['scoreA'],
                    scoreBAfter=play_data['scoreB'],
                )
                drives_to_create.append(current_drive)
            
            # Create Play object
            play = Plays(
                info=info,
                game=game,
                drive=current_drive,  # Link to current drive
                offense=game.teamA if play_data['offense_id'] == game.teamA.id else game.teamB,
                defense=game.teamB if play_data['offense_id'] == game.teamA.id else game.teamA,
                startingFP=play_data['startingFP'],
                down=play_data['down'],
                scoreA=play_data['scoreA'],
                scoreB=play_data['scoreB'],
                yardsLeft=play_data['yardsLeft'],
                playType=play_data['playType'],
                yardsGained=play_data['yardsGained'],
                result=play_data['result'],
                text=play_data['text'],
                header=play_data.get('header', '')
            )
            plays_to_create.append(play)
            
            # Update drive result and points if drive ends
            if play_data['result'] in ["touchdown", "interception", "fumble", "safety", "turnover on downs", "made field goal", "missed field goal", "punt"]:
                current_drive.result = play_data['result']
                if play_data['result'] == "touchdown":
                    current_drive.points = 7
                elif play_data['result'] == "made field goal":
                    current_drive.points = 3
                # Update scoreAAfter/scoreBAfter for the drive
                current_drive.scoreAAfter = play_data['scoreA']
                current_drive.scoreBAfter = play_data['scoreB']

        # Bulk create drives and plays
        Drives.objects.bulk_create(drives_to_create)
        Plays.objects.bulk_create(plays_to_create)

        # Update team records
        update_team_records([game])

        # Generate game log
        game_logs = []
        for play in plays_to_create:
            game_logs.append(GameLog(info=info, game=game, play=play))
        GameLog.objects.bulk_create(game_logs)

        return Response({"message": "Game completed and saved successfully!"})

    except Games.DoesNotExist:
        return Response({"error": "Game not found"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(["POST"])
def exit_interactive_sim(request, game_id):
    """
    Exit interactive simulation without saving.
    Since we're not using LiveSimSession anymore, this is just a placeholder.
    """
    return Response({"message": "Interactive session exited."})
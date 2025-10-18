from logic.sim.sim import simGame
from logic.schedule import (
    setConferenceChampionships,
    setNatty,
    setPlayoffSemi,
    setPlayoffR1,
    setPlayoffQuarter,
)
from logic.util import time_section
from logic.headlines import generate_headlines
import time
from api.models import *
import random
from logic.sim.sim import WIN_FACTOR, LOSS_FACTOR
from logic.constants.sim_constants import (
    POLL_INERTIA_WIN_BONUS,
    POLL_INERTIA_LOSS_PENALTY,
    RANKING_TOTAL_WEEKS,
)

def fetch_and_simulate_games(info, drives_to_create, plays_to_create):
    """Fetch games for the current week and simulate them with batch team updates"""
    total_start = time.time()
    print(f"\n--- WEEK {info.currentWeek} SIMULATION ---")
    print("PHASE 1: GAME SIMULATION")

    # Phase 1: Fetch games from database (only unplayed games)
    query_start = time.time()
    games = list(
        info.games.filter(
            year=info.currentYear, weekPlayed=info.currentWeek, winner__isnull=True
        ).select_related("teamA", "teamB")
    )
    time_section(query_start, f"  • Database query - {len(games)} games found")

    # Phase 2: Initialize team tracking
    setup_start = time.time()
    team_updates = {}
    for game in games:
        if game.teamA_id not in team_updates:
            team_updates[game.teamA_id] = {
                "team": game.teamA,
                "confWins": 0,
                "confLosses": 0,
                "nonConfWins": 0,
                "nonConfLosses": 0,
                "totalWins": 0,
                "totalLosses": 0,
                "strength_of_record": 0,
                "gamesPlayed": 0,
            }
        if game.teamB_id not in team_updates:
            team_updates[game.teamB_id] = {
                "team": game.teamB,
                "confWins": 0,
                "confLosses": 0,
                "nonConfWins": 0,
                "nonConfLosses": 0,
                "totalWins": 0,
                "totalLosses": 0,
                "strength_of_record": 0,
                "gamesPlayed": 0,
            }
    time_section(setup_start, "  • Team tracking initialized")

    # Phase 3: Simulate all games
    sim_start = time.time()
    for game in games:
        # Track that these teams will play a game
        team_updates[game.teamA_id]["gamesPlayed"] += 1
        team_updates[game.teamB_id]["gamesPlayed"] += 1

        # Simulate the game using shared utility
        process_single_game(game, info, drives_to_create, plays_to_create)

        # Capture results for batch processing
        if game.winner == game.teamA:
            winner_id, loser_id = game.teamA_id, game.teamB_id
        else:
            winner_id, loser_id = game.teamB_id, game.teamA_id

        # Track conference/non-conference results
        is_conference_game = (
            game.teamA.conference
            and game.teamB.conference
            and game.teamA.conference == game.teamB.conference
        )

        if is_conference_game:
            team_updates[winner_id]["confWins"] += 1
            team_updates[loser_id]["confLosses"] += 1
        else:
            team_updates[winner_id]["nonConfWins"] += 1
            team_updates[loser_id]["nonConfLosses"] += 1

        # Track total wins/losses
        team_updates[winner_id]["totalWins"] += 1
        team_updates[loser_id]["totalLosses"] += 1

        # Update resume scores
        if game.winner == game.teamA:
            winner_resume_add = game.teamB.rating**WIN_FACTOR
            loser_resume_add = game.teamA.rating**LOSS_FACTOR
        else:
            winner_resume_add = game.teamA.rating**WIN_FACTOR
            loser_resume_add = game.teamB.rating**LOSS_FACTOR

        team_updates[winner_id]["strength_of_record"] += winner_resume_add
        team_updates[loser_id]["strength_of_record"] += loser_resume_add

    time_section(sim_start, "  • All games simulated")

    # Phase 4: Batch update team records
    update_start = time.time()
    teams_to_update = []
    for team_id, update in team_updates.items():
        team = update["team"]
        team.confWins += update["confWins"]
        team.confLosses += update["confLosses"]
        team.nonConfWins += update["nonConfWins"]
        team.nonConfLosses += update["nonConfLosses"]
        team.totalWins += update["totalWins"]
        team.totalLosses += update["totalLosses"]
        team.strength_of_record += update["strength_of_record"]
        team.gamesPlayed += update["gamesPlayed"]
        teams_to_update.append(team)

    # Bulk update teams
    Teams.objects.bulk_update(
        teams_to_update,
        [
            "confWins",
            "confLosses",
            "nonConfWins",
            "nonConfLosses",
            "totalWins",
            "totalLosses",
            "strength_of_record",
            "gamesPlayed",
        ],
    )
    time_section(update_start, "  • Team records updated in database")
    time_section(total_start, "PHASE 1 TOTAL")
    print()
    return games


def update_game_results(info, games):
    """Generate headlines and update game results in the database"""
    total_start = time.time()
    print("PHASE 2: GAME RESULTS PROCESSING")

    # Phase 1: Generate headlines
    headlines_start = time.time()
    generate_headlines(games)
    time_section(headlines_start, "  • Headlines generated")

    # Phase 2: Update game results in database
    update_start = time.time()
    Games.objects.bulk_update(
        games,
        ["scoreA", "scoreB", "winner", "resultA", "resultB", "overtime", "headline"],
    )
    time_section(update_start, "  • Game results saved to database")

    # Check if National Championship game was just played
    natty_game = None
    if hasattr(info, "playoff") and info.playoff and info.playoff.natty:
        for game in games:
            if (
                game.teamA
                and game.teamB
                and game.winner
                and (
                    (
                        game.teamA == info.playoff.natty.teamA
                        and game.teamB == info.playoff.natty.teamB
                    )
                    or (
                        game.teamA == info.playoff.natty.teamB
                        and game.teamB == info.playoff.natty.teamA
                    )
                )
            ):
                natty_game = game
                break

    time_section(total_start, "PHASE 2 TOTAL")
    print()
    return natty_game


def update_rankings(info, natty_game=None):
    """Update team rankings if needed for the current week"""
    total_start = time.time()
    print("PHASE 3: RANKINGS UPDATE")

    # Skip ranking updates for certain playoff weeks
    skip_weeks = {4: [14], 12: [14, 15, 16]}.get(info.playoff.teams, [])

    if info.currentWeek not in skip_weeks:
        # Phase 1: Calculate poll scores
        poll_start = time.time()
        teams = list(info.teams.all())
        team_dict = {team.id: team for team in teams}

        # Fetch all current week games once instead of querying for each team
        # Only include games that have been played (have a winner)
        current_games = list(
            info.games.filter(
                year=info.currentYear, weekPlayed=info.currentWeek, winner__isnull=False
            ).select_related("teamA", "teamB")
        )

        # Create lookup dictionary for team games
        team_games = {}
        for game in current_games:
            team_games[game.teamA_id] = game
            team_games[game.teamB_id] = game

        for team in teams:
            team.last_rank = team.ranking
            games_played = team.totalWins + team.totalLosses
            base_poll_score = team.strength_of_record / max(1, games_played)

            if info.currentWeek == info.lastWeek:
                # End of season: no inertia
                team.poll_score = round(base_poll_score, 1)
            else:
                # Regular season: include poll inertia
                # Use lookup instead of searching through games
                team_game = team_games.get(team.id)

                # Apply poll inertia
                if team_game and info.currentWeek <= RANKING_TOTAL_WEEKS:
                    weeks_left = max(0, RANKING_TOTAL_WEEKS - info.currentWeek)
                    inertia_scale = weeks_left / RANKING_TOTAL_WEEKS

                    inertia_factor = (
                        POLL_INERTIA_LOSS_PENALTY
                        if team_game.winner != team
                        else POLL_INERTIA_WIN_BONUS
                    )
                    inertia_value = max(
                        0, inertia_factor * (len(teams) - team.ranking) * inertia_scale
                    )
                    team.poll_score = round(base_poll_score + inertia_value, 1)
                else:
                    team.poll_score = round(base_poll_score, 1)
        time_section(poll_start, "  • Poll scores calculated")

        # Phase 2: Determine ranking strategy and assign rankings
        ranking_start = time.time()
        is_end_of_season = info.currentWeek == info.lastWeek
        natty_winner = None
        natty_loser = None

        if is_end_of_season:
            # Get natty winner/loser if available
            if natty_game:
                natty_winner = natty_game.winner
                natty_loser = (
                    natty_game.teamA
                    if natty_game.winner == natty_game.teamB
                    else natty_game.teamB
                )
            elif info.playoff.natty and info.playoff.natty.winner:
                natty_winner = info.playoff.natty.winner
                natty_loser = (
                    info.playoff.natty.teamA
                    if info.playoff.natty.winner == info.playoff.natty.teamB
                    else info.playoff.natty.teamB
                )

        # Assign rankings
        if natty_winner and natty_loser:
            # End of season with championship teams
            # Set championship teams to #1 and #2
            for team in teams:
                if team.id == natty_winner.id:
                    team.ranking = 1
                elif team.id == natty_loser.id:
                    team.ranking = 2

            # Sort remaining teams by poll score
            remaining_teams = [
                team
                for team in teams
                if team.id not in (natty_winner.id, natty_loser.id)
            ]
            sorted_remaining = sorted(
                remaining_teams, key=lambda x: (-x.poll_score, x.last_rank)
            )

            # Assign rankings starting from #3
            for i, team in enumerate(sorted_remaining, start=3):
                team.ranking = i
        else:
            # Regular ranking (season or pre-championship)
            sorted_teams = sorted(teams, key=lambda x: (-x.poll_score, x.last_rank))
            for i, team in enumerate(sorted_teams, start=1):
                team.ranking = i
        time_section(ranking_start, "  • Team rankings assigned")

        # Phase 3: Update database and future game rankings
        db_start = time.time()
        # Update database in bulk operations
        Teams.objects.bulk_update(teams, ["ranking", "last_rank", "poll_score"])

        # Update game rankings for future games
        future_games = list(info.games.filter(year=info.currentYear, winner=None))
        for game in future_games:
            game.rankATOG = team_dict[game.teamA_id].ranking
            game.rankBTOG = team_dict[game.teamB_id].ranking

        if future_games:
            Games.objects.bulk_update(future_games, ["rankATOG", "rankBTOG"])
        time_section(db_start, "  • Database updated with new rankings")

        time_section(total_start, "PHASE 3 TOTAL")
    else:
        time_section(
            total_start, f"SKIPPED: Rankings update for week {info.currentWeek}"
        )
    print()
    return


def handle_special_weeks(info):
    """Handle special weeks like conference championships and playoffs"""
    special_start = time.time()
    print("PHASE 4: SPECIAL WEEK HANDLING")

    # Map of playoff formats to special actions by week
    special_actions = {
        2: {12: setConferenceChampionships, 13: setNatty},
        4: {12: setConferenceChampionships, 13: setPlayoffSemi, 14: setNatty},
        12: {
            12: setConferenceChampionships,
            13: setPlayoffR1,
            14: setPlayoffQuarter,
            15: setPlayoffSemi,
            16: setNatty,
        },
    }

    # Get the action for the current playoff format and week
    action = special_actions.get(info.playoff.teams, {}).get(info.currentWeek)

    if action:
        action(info)
        time_section(special_start, f"  • {action.__name__} completed")
    else:
        time_section(special_start, "  • No special week action required")
    print()


def save_simulation_data(info, drives_to_create, plays_to_create, log=False):
    """Save all accumulated simulation data to the database"""
    total_start = time.time()
    print("PHASE 5: DATA PERSISTENCE")

    # Phase 1: Create game logs from plays using shared utility
    game_logs_start = time.time()
    
    # Get all unique games being simmed
    simmed_games = {play.game for play in plays_to_create}
    
    # Accumulate all game logs from all games
    all_game_logs = []
    for game in simmed_games:
        game_logs = create_game_logs_from_plays(game, info, plays_to_create)
        all_game_logs.extend(game_logs)
    
    # Bulk create all game logs at once
    batch_size = 250
    for i in range(0, len(all_game_logs), batch_size):
        GameLog.objects.bulk_create(all_game_logs[i : i + batch_size])
    
    time_section(game_logs_start, "  • Game logs created from plays")

    # Phase 2: Save drives to database
    drives_start = time.time()
    for i in range(0, len(drives_to_create), batch_size):
        Drives.objects.bulk_create(drives_to_create[i : i + batch_size])
    time_section(drives_start, "  • Drives saved to database")

    # Phase 3: Save plays to database
    plays_start = time.time()
    for i in range(0, len(plays_to_create), batch_size):
        Plays.objects.bulk_create(plays_to_create[i : i + batch_size])
    time_section(plays_start, "  • Plays saved to database")

    # Phase 4: Save info object
    info_save_start = time.time()
    info.save()
    time_section(info_save_start, "  • Simulation state saved")

    time_section(total_start, "PHASE 5 TOTAL")
    print("--- WEEK SIMULATION COMPLETE ---\n")


def update_game_log_for_run(play, game_log):
    game_log.rush_attempts += 1
    game_log.rush_yards += play.yardsGained
    if play.result == "touchdown":
        game_log.rush_touchdowns += 1
    elif play.result == "fumble":
        game_log.fumbles += 1


def update_game_log_for_pass(play, qb_game_log, receiver_game_log):
    qb_game_log.pass_attempts += 1
    if play.result in ["pass", "touchdown"]:
        qb_game_log.pass_completions += 1
        qb_game_log.pass_yards += play.yardsGained
        receiver_game_log.receiving_yards += play.yardsGained
        receiver_game_log.receiving_catches += 1
        if play.result == "touchdown":
            qb_game_log.pass_touchdowns += 1
            receiver_game_log.receiving_touchdowns += 1
    elif play.result == "interception":
        qb_game_log.pass_interceptions += 1


def update_game_log_for_kick(play, game_log):
    if play.playType == "field goal":
        game_log.field_goals_attempted += 1
        if play.result == "made field goal":
            game_log.field_goals_made += 1


def set_play_header(play):
    if play.startingFP < 50:
        location = f"{play.offense.abbreviation} {play.startingFP}"
    elif play.startingFP > 50:
        location = f"{play.defense.abbreviation} {100 - play.startingFP}"
    else:
        location = f"{play.startingFP}"

    if play.startingFP + play.yardsLeft >= 100:
        if play.down == 1:
            play.header = f"{play.down}st and goal at {location}"
        elif play.down == 2:
            play.header = f"{play.down}nd and goal at {location}"
        elif play.down == 3:
            play.header = f"{play.down}rd and goal at {location}"
        elif play.down == 4:
            play.header = f"{play.down}th and goal at {location}"
    else:
        if play.down == 1:
            play.header = f"{play.down}st and {play.yardsLeft} at {location}"
        elif play.down == 2:
            play.header = f"{play.down}nd and {play.yardsLeft} at {location}"
        elif play.down == 3:
            play.header = f"{play.down}rd and {play.yardsLeft} at {location}"
        elif play.down == 4:
            play.header = f"{play.down}th and {play.yardsLeft} at {location}"


def format_play_text(play, player1, player2=None):
    player1 = f"{player1.first} {player1.last}"
    if player2:
        player2 = f"{player2.first} {player2.last}"
    if play.playType == "run":
        if play.result == "fumble":
            play.text = f"{player1} fumbled"
        elif play.result == "touchdown":
            play.text = f"{player1} ran {play.yardsGained} yards for a touchdown"
        else:
            play.text = f"{player1} ran for {play.yardsGained} yards"
    elif play.playType == "pass":
        if play.result == "sack":
            play.text = f"{player1} was sacked for a loss of {play.yardsGained} yards"
        elif play.result == "touchdown":
            play.text = f"{player1} pass complete to {player2} {play.yardsGained} yards for a touchdown"
        elif play.result == "pass":
            play.text = (
                f"{player1} pass complete to {player2} for {play.yardsGained} yards"
            )
        elif play.result == "interception":
            play.text = f"{player1}'s pass was intercepted"
        elif play.result == "incomplete pass":
            play.text = f"{player1}'s pass was incomplete"
    elif play.playType == "field goal":
        if play.result == "made field goal":
            play.text = f"{player1}'s {100 - play.startingFP + 17} field goal is good"
        elif play.result == "missed field goal":
            play.text = (
                f"{player1}'s {100 - play.startingFP + 17} field goal is no good"
            )
    elif play.playType == "punt":
        play.text = f"{player1} punted"


def choose_receiver(candidates, rating_exponent=4):
    """Choose a receiver with improved performance."""
    if not candidates:
        return None

    # Use pre-computed position bias values
    pos_bias = {"wr": 1.4, "te": 1.0, "rb": 0.6}

    # Calculate weighted chances directly
    chances = []
    total_chance = 0

    for candidate in candidates:
        # Use faster power calculation
        weighted_rating = candidate.rating**rating_exponent
        chance = weighted_rating * pos_bias.get(candidate.pos.lower(), 1.0)
        chances.append(chance)
        total_chance += chance

    # Avoid division by zero
    if total_chance == 0:
        return random.choice(candidates)

    # Normalize chances
    normalized_chances = [chance / total_chance for chance in chances]

    # Use random.choices for weighted selection
    return random.choices(candidates, weights=normalized_chances, k=1)[0]


# Shared utility functions for live sim and batch sim
def process_single_game(game, info, drives_to_create, plays_to_create):
    """
    Process a single game simulation and return the game with updated results.
    This handles the core simulation logic that's shared between live and batch sim.
    """
    # Simulate the game
    simGame(game, info, drives_to_create, plays_to_create)
    
    # Generate headline for this game
    generate_headlines([game])
    
    return game


def update_team_records_from_game(game):
    """
    Update team records based on game results.
    Returns the updated team objects.
    """
    teamA, teamB = game.teamA, game.teamB
    is_conference_game = (
        teamA.conference and teamB.conference and teamA.conference == teamB.conference
    )
    
    # Update games played
    teamA.gamesPlayed += 1
    teamB.gamesPlayed += 1
    
    # Update records based on winner
    if game.winner == teamA:
        teamA.totalWins += 1
        teamB.totalLosses += 1
        if is_conference_game:
            teamA.confWins += 1
            teamB.confLosses += 1
        else:
            teamA.nonConfWins += 1
            teamB.nonConfLosses += 1
    else:
        teamB.totalWins += 1
        teamA.totalLosses += 1
        if is_conference_game:
            teamB.confWins += 1
            teamA.confLosses += 1
        else:
            teamB.nonConfWins += 1
            teamA.nonConfLosses += 1
    
    return teamA, teamB


def create_game_logs_from_plays(game, info, plays_to_create):
    """
    Create game logs from plays for a single game.
    Returns the game log objects WITHOUT saving them to the database.
    The caller is responsible for bulk creating the game logs.
    """
    desired_positions = {"qb", "rb", "wr", "te", "k", "p"}
    game_log_dict = {}
    
    # Get all starters for both teams
    all_starters = info.players.filter(
        starter=True, pos__in=desired_positions
    ).select_related("team")
    
    # Group them by position and team
    starters_by_team_pos = {(player.team, player.pos): [] for player in all_starters}
    for player in all_starters:
        starters_by_team_pos[(player.team, player.pos)].append(player)
    
    # Create a set to store (player, game) combinations for GameLog objects
    player_game_combinations = set()
    
    for team in [game.teamA, game.teamB]:
        for pos in desired_positions:
            starters = starters_by_team_pos.get((team, pos))
            if starters:
                for starter in starters:
                    player_game_combinations.add((starter, game))
    
    # Create the in-memory GameLog objects
    game_logs_to_process = [
        GameLog(info=info, player=player, game=game)
        for player, game in player_game_combinations
    ]
    
    # Create lookup dictionary
    for game_log in game_logs_to_process:
        game_log_dict[(game_log.player, game_log.game)] = game_log
    
    # Process plays for this specific game
    game_plays = [play for play in plays_to_create if play.game == game]
    
    for play in game_plays:
        set_play_header(play)
        
        offense_team = play.offense
        
        # Get starters for this offense team
        rb_starters = starters_by_team_pos.get((offense_team, "rb"))
        qb_starter = starters_by_team_pos.get((offense_team, "qb"))
        wr_starters = starters_by_team_pos.get((offense_team, "wr"))
        te_starters = starters_by_team_pos.get((offense_team, "te"))
        k_starter = starters_by_team_pos.get((offense_team, "k"))
        p_starter = starters_by_team_pos.get((offense_team, "p"))
        
        if not (rb_starters and qb_starter and wr_starters and te_starters and k_starter and p_starter):
            continue
            
        if play.playType == "run":
            runner = random.choice(rb_starters)
            game_log = game_log_dict[(runner, game)]
            update_game_log_for_run(play, game_log)
            format_play_text(play, runner)
        elif play.playType == "pass":
            candidates = wr_starters + te_starters + rb_starters
            receiver = choose_receiver(candidates)
            qb_game_log = game_log_dict[(qb_starter[0], game)]
            receiver_game_log = game_log_dict[(receiver, game)]
            update_game_log_for_pass(play, qb_game_log, receiver_game_log)
            format_play_text(play, qb_starter[0], receiver)
        elif play.playType == "field goal":
            game_log = game_log_dict[(k_starter[0], game)]
            update_game_log_for_kick(play, game_log)
            format_play_text(play, k_starter[0])
        elif play.playType == "punt":
            format_play_text(play, p_starter[0])
    
    # Return the game logs WITHOUT saving to database
    return game_logs_to_process


def format_plays_for_frontend(plays_to_create):
    """
    Format plays data for frontend consumption.
    Returns a list of formatted play dictionaries.
    """
    plays_data = []
    for play in plays_to_create:
        plays_data.append({
            "play_id": len(plays_data) + 1,
            "drive_num": play.drive.driveNum if play.drive else 0,
            "offense": play.offense.name,
            "defense": play.defense.name,
            "down": play.down,
            "yards_left": play.yardsLeft,
            "field_position": play.startingFP,
            "play_type": play.playType,
            "yards_gained": play.yardsGained,
            "text": play.text or "",
            "header": play.header or "",
            "result": play.result,
            "score_after": {"teamA": play.scoreA, "teamB": play.scoreB},
        })
    
    return plays_data


def format_game_logs_for_frontend(game):
    """
    Format game logs for frontend consumption.
    Returns a dictionary with passing, rushing, and receiving logs.
    """
    game_logs = game.game_logs.select_related("player", "player__team").all()
    
    passing_logs = []
    rushing_logs = []
    receiving_logs = []
    
    for log in game_logs:
        # Passing logs
        if log.pass_attempts > 0:
            passing_logs.append({
                "player": f"{log.player.first} {log.player.last}",
                "team": log.player.team.name,
                "completions": log.pass_completions,
                "attempts": log.pass_attempts,
                "yards": log.pass_yards,
                "touchdowns": log.pass_touchdowns,
                "interceptions": log.pass_interceptions,
            })
        
        # Rushing logs
        if log.rush_attempts > 0:
            rushing_logs.append({
                "player": f"{log.player.first} {log.player.last}",
                "team": log.player.team.name,
                "attempts": log.rush_attempts,
                "yards": log.rush_yards,
                "touchdowns": log.rush_touchdowns,
            })
        
        # Receiving logs
        if log.receiving_catches > 0:
            receiving_logs.append({
                "player": f"{log.player.first} {log.player.last}",
                "team": log.player.team.name,
                "catches": log.receiving_catches,
                "yards": log.receiving_yards,
                "touchdowns": log.receiving_touchdowns,
            })
    
    return {
        "passing": passing_logs,
        "rushing": rushing_logs,
        "receiving": receiving_logs,
    }

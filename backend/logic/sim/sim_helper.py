from logic.sim.sim import simGame
from logic.schedule import (
    setConferenceChampionships,
    setNatty,
    setPlayoffSemi,
    setPlayoffR1,
    setPlayoffQuarter,
)
from logic.headlines import generate_headlines
import time
from start.models import *
import random
from logic.sim.sim import WIN_FACTOR, LOSS_FACTOR


def fetch_and_simulate_games(info, drives_to_create, plays_to_create):
    """Fetch games for the current week and simulate them with batch team updates"""
    query_start = time.time()

    # Use select_related to reduce database queries
    games = list(
        info.games.filter(
            year=info.currentYear, weekPlayed=info.currentWeek
        ).select_related("teamA", "teamB")
    )

    query_time = time.time() - query_start
    print(f"  Query games: {query_time:.4f} seconds, {len(games)} games found")

    # Create a team dictionary to track all updates
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
                "resume_total": 0,
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
                "resume_total": 0,
                "gamesPlayed": 0,
            }

    # Simulate all games for the current week
    sim_start = time.time()

    for game in games:
        # Track that these teams will play a game
        team_updates[game.teamA_id]["gamesPlayed"] += 1
        team_updates[game.teamB_id]["gamesPlayed"] += 1

        # Simulate the game
        simGame(game, info, drives_to_create, plays_to_create)

        # Instead of letting simGame update the team objects directly,
        # we'll capture the results here and apply them in batch
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
        team_updates[winner_id]["resume_total"] += game.teamB.rating**WIN_FACTOR
        team_updates[loser_id]["resume_total"] += game.teamA.rating**LOSS_FACTOR

    # Apply all team updates at once after all games are simulated
    teams_to_update = []
    for team_id, update in team_updates.items():
        team = update["team"]
        team.confWins += update["confWins"]
        team.confLosses += update["confLosses"]
        team.nonConfWins += update["nonConfWins"]
        team.nonConfLosses += update["nonConfLosses"]
        team.totalWins += update["totalWins"]
        team.totalLosses += update["totalLosses"]
        team.resume_total += update["resume_total"]
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
            "resume_total",
            "gamesPlayed",
        ],
    )

    sim_time = time.time() - sim_start
    print(f"  Total simulation time: {sim_time:.4f} seconds")

    return games


def update_game_results(games):
    """Generate headlines and update game results in the database"""
    # Generate headlines
    headlines_start = time.time()
    generate_headlines(games)
    headlines_time = time.time() - headlines_start
    print(f"  Generate headlines: {headlines_time:.4f} seconds")

    # Bulk update game results
    update_start = time.time()
    Games.objects.bulk_update(
        games,
        ["scoreA", "scoreB", "winner", "resultA", "resultB", "overtime", "headline"],
    )
    update_time = time.time() - update_start
    print(f"  Bulk update games: {update_time:.4f} seconds")


def update_rankings_if_needed(info):
    """Update team rankings if needed for the current week"""
    rankings_start = time.time()

    # Skip ranking updates for certain playoff weeks
    skip_weeks = {4: [14], 12: [14, 15, 16]}.get(info.playoff.teams, [])

    if info.currentWeek not in skip_weeks:
        update_rankings(info)
        print(f"  Updated rankings: {time.time() - rankings_start:.4f} seconds")
    else:
        print(f"  Skipped rankings update for week {info.currentWeek}")


def handle_special_weeks(info):
    """Handle special weeks like conference championships and playoffs"""
    special_start = time.time()

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
        action_name = action.__name__
        print(f"  Executing special action: {action_name}")
        action(info)
        print(f"  Special action completed: {time.time() - special_start:.4f} seconds")
    else:
        print(f"  No special action for week {info.currentWeek}")


def save_simulation_data(info, drives_to_create, plays_to_create):
    """Save all accumulated simulation data to the database"""
    final_save_start = time.time()

    # Create game logs from plays
    print(f"  Creating {len(plays_to_create)} plays...")
    plays_start = time.time()
    make_game_logs(info, plays_to_create)
    print(f"  make_game_logs completed in {time.time() - plays_start:.4f} seconds")

    # Create drives in batches
    print(f"  Creating {len(drives_to_create)} drives...")
    drives_start = time.time()
    batch_size = 1000
    for i in range(0, len(drives_to_create), batch_size):
        Drives.objects.bulk_create(drives_to_create[i : i + batch_size])
    print(f"  Drives creation completed in {time.time() - drives_start:.4f} seconds")

    # Create plays in batches
    plays_start = time.time()
    for i in range(0, len(plays_to_create), batch_size):
        Plays.objects.bulk_create(plays_to_create[i : i + batch_size])
    print(f"  Plays creation completed in {time.time() - plays_start:.4f} seconds")

    # Save info object
    info_save_start = time.time()
    info.save()
    print(f"  Info save completed in {time.time() - info_save_start:.4f} seconds")

    print(f"Final data save completed in {time.time() - final_save_start:.4f} seconds")


def make_game_logs(info, plays):
    desired_positions = {"qb", "rb", "wr", "te", "k", "p"}
    game_log_dict = {}

    all_starters = info.players.filter(
        starter=True, pos__in=desired_positions
    ).select_related("team")

    # Group them by position and team
    starters_by_team_pos = {(player.team, player.pos): [] for player in all_starters}
    for player in all_starters:
        starters_by_team_pos[(player.team, player.pos)].append(player)

    # Get all unique games being simmed
    simmed_games = {play.game for play in plays}

    # Create a set to store (player, game) combinations for GameLog objects
    player_game_combinations = set()

    for game in simmed_games:
        for team in [game.teamA, game.teamB]:
            for pos in desired_positions:
                starters = starters_by_team_pos.get((team, pos))
                for starter in starters:
                    player_game_combinations.add((starter, game))

    # Create the in-memory GameLog objects
    game_logs_to_process = [
        GameLog(info=info, player=player, game=game)
        for player, game in player_game_combinations
    ]

    for game_log in game_logs_to_process:
        game_log_dict[(game_log.player, game_log.game)] = game_log

    # Main logic for processing the plays
    for play in plays:
        set_play_header(play)

        game = play.game
        offense_team = play.offense

        rb_starters = starters_by_team_pos.get((offense_team, "rb"))
        qb_starter = starters_by_team_pos.get((offense_team, "qb"))[0]
        wr_starters = starters_by_team_pos.get((offense_team, "wr"))
        te_starters = starters_by_team_pos.get((offense_team, "te"))
        k_starter = starters_by_team_pos.get((offense_team, "k"))[0]
        p_starter = starters_by_team_pos.get((offense_team, "p"))[0]

        if play.playType == "run":
            runner = random.choice(rb_starters)
            game_log = game_log_dict[(runner, game)]
            update_game_log_for_run(play, game_log)
            format_play_text(play, runner)
        elif play.playType == "pass":
            candidates = wr_starters + te_starters + rb_starters
            receiver = choose_receiver(candidates)
            qb_game_log = game_log_dict[(qb_starter, game)]
            receiver_game_log = game_log_dict[(receiver, game)]
            update_game_log_for_pass(play, qb_game_log, receiver_game_log)
            format_play_text(play, qb_starter, receiver)
        elif play.playType == "field goal":
            game_log = game_log_dict[(k_starter, game)]
            update_game_log_for_kick(play, game_log)
            format_play_text(play, k_starter)
        elif play.playType == "punt":
            format_play_text(play, p_starter)

    GameLog.objects.bulk_create(game_logs_to_process)


def update_rankings(info):
    """Update team rankings based on performance and poll inertia."""
    # Fetch all data in a single query
    teams = list(info.teams.all())
    team_dict = {team.id: team for team in teams}

    # Constants
    team_count = len(teams)
    win_factor, loss_factor = 172, 157
    total_weeks = 12
    weeks_left = max(0, total_weeks - info.currentWeek)
    inertia_scale = weeks_left / total_weeks

    # Get current week's games
    current_games = list(
        info.games.filter(
            year=info.currentYear, weekPlayed=info.currentWeek
        ).select_related("teamA", "teamB")
    )

    # Organize games by team for quick lookup
    team_games = {team.id: [] for team in teams}
    for game in current_games:
        team_games[game.teamA.id].append(game)
        team_games[game.teamB.id].append(game)

    # Update team resume scores
    for team in teams:
        # Save previous ranking
        team.last_rank = team.ranking
        games_played = team.totalWins + team.totalLosses

        # Calculate resume score
        if info.currentWeek <= total_weeks:
            # Base resume on performance and poll inertia
            base_resume = team.resume_total / max(1, games_played)

            # Apply poll inertia based on recent performance
            games = team_games.get(team.id, [])
            inertia_factor = (
                loss_factor if (games and games[-1].winner != team) else win_factor
            )
            inertia_value = max(
                0, inertia_factor * (team_count - team.ranking) * inertia_scale
            )

            team.resume = round(base_resume + inertia_value, 1)
        else:
            # After regular season, only use performance
            team.resume = round(team.resume_total / max(1, games_played), 1)

    # Sort and assign new rankings
    sorted_teams = sorted(teams, key=lambda x: (-x.resume, x.last_rank))
    for i, team in enumerate(sorted_teams, start=1):
        team.ranking = i

    # Update database in bulk operations
    Teams.objects.bulk_update(teams, ["ranking", "last_rank", "resume"])

    # Update game rankings for future games
    future_games = list(info.games.filter(year=info.currentYear, winner=None))
    for game in future_games:
        game.rankATOG = team_dict[game.teamA_id].ranking
        game.rankBTOG = team_dict[game.teamB_id].ranking

    if future_games:
        Games.objects.bulk_update(future_games, ["rankATOG", "rankBTOG"])


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

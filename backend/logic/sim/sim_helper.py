from logic.sim.sim import choose_receiver
from logic.schedule import (
    setConferenceChampionships,
    setNatty,
    setPlayoffSemi,
    setPlayoffR1,
    setPlayoffQuarter,
)
from logic.util import time_section
import time
from api.models import *
import random
from logic.constants.sim_constants import (
    POLL_INERTIA_WIN_BONUS,
    POLL_INERTIA_LOSS_PENALTY,
    RANKING_TOTAL_WEEKS,
    WIN_FACTOR,
    LOSS_FACTOR,
)


def update_rankings(info):
    """Update team rankings if needed for the current week"""
    total_start = time.time()

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
        time_section(poll_start, "Poll scores calculated")

        # Phase 2: Determine ranking strategy and assign rankings
        ranking_start = time.time()
        is_end_of_season = info.currentWeek == info.lastWeek
        natty_winner = None
        natty_loser = None

        if is_end_of_season:

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
        time_section(ranking_start, "Team rankings assigned")

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
        time_section(db_start, "Database updated with new rankings")
    return


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
        action(info)
        time_section(special_start, f"{action.__name__} completed")
    else:
        time_section(special_start, "No special week action required")


def get_or_cache_starters(info):
    """
    Get starters from cache or query and cache them.
    Starters don't change during the season, so we can cache them.
    """
    # Check if we have cached starters
    if hasattr(info, "_starters_cache"):
        return info._starters_cache

    # Query and cache
    desired_positions = {"qb", "rb", "wr", "te", "k", "p"}
    all_starters = info.players.filter(
        starter=True, pos__in=desired_positions
    ).select_related("team")

    # Group them by position and team
    starters_by_team_pos = {(player.team, player.pos): [] for player in all_starters}
    for player in all_starters:
        starters_by_team_pos[(player.team, player.pos)].append(player)

    # Cache on info object
    info._starters_cache = starters_by_team_pos
    return starters_by_team_pos


def save_games_and_teams(games, teams):
    """
    Save games and teams to database immediately.
    Used at the end of each week in advance_week for rankings calculations.
    
    Args:
        games: List of Game objects to save
        teams: List of Team objects to save
    """
    total_start = time.time()
    
    # Save games
    if games:
        Games.objects.bulk_update(games, ["scoreA", "scoreB", "winner", "resultA", "resultB", "overtime", "headline"])
    
    # Save teams if provided, otherwise extract from games
    if teams and games:
        # Extract unique teams from games
        teams = []
        seen_teams = set()
        for game in games:
            if game.teamA.id not in seen_teams:
                teams.append(game.teamA)
                seen_teams.add(game.teamA.id)
            if game.teamB.id not in seen_teams:
                teams.append(game.teamB)
                seen_teams.add(game.teamB.id)
    
    if teams:
        Teams.objects.bulk_update(teams, [
            "confWins", "confLosses", "nonConfWins", "nonConfLosses", 
            "totalWins", "totalLosses", "strength_of_record", "gamesPlayed"
        ])
    
    time_section(total_start, "Saving games and teams")


def save_other_lists(info, drives_to_create, plays_to_create):
    """
    Save drives, plays, and game logs to database.
    Used at the end of advance_week for batch saving of simulation data.
    
    Args:
        info: Info object
        drives_to_create: List of Drive objects to create
        plays_to_create: List of Play objects to create
    """
    total_start = time.time()

    # Get starters (cached across multiple week sims)
    starters_by_team_pos = get_or_cache_starters(info)

    # Pre-group plays by game for efficiency
    plays_by_game = {}
    for play in plays_to_create:
        if play.game not in plays_by_game:
            plays_by_game[play.game] = []
        plays_by_game[play.game].append(play)

    # Create game logs for all games
    all_game_logs = []
    for game, game_plays in plays_by_game.items():
        game_logs = create_game_logs_from_plays(
            game, info, game_plays, starters_by_team_pos
        )
        all_game_logs.extend(game_logs)

    # Save all simulation data
    if drives_to_create:
        Drives.objects.bulk_create(drives_to_create)
    if plays_to_create:
        Plays.objects.bulk_create(plays_to_create)
    if all_game_logs:
        GameLog.objects.bulk_create(all_game_logs)

    time_section(total_start, "Saving drives, plays, and game logs")


def update_team_records(games):
    """
    Update team records based on game results (in memory only).
    
    Args:
        games: Single game object or list of game objects
    
    Returns:
        List of updated team objects
    """
    # Ensure games is a list
    if not isinstance(games, list):
        games = [games]
    
    team_updates = {}

    for game in games:
        teamA, teamB = game.teamA, game.teamB
        is_conference_game = (
            teamA.conference
            and teamB.conference
            and teamA.conference == teamB.conference
        )

        # Initialize tracking if not exists
        if teamA.id not in team_updates:
            team_updates[teamA.id] = {
                "team": teamA,
                "confWins": 0,
                "confLosses": 0,
                "nonConfWins": 0,
                "nonConfLosses": 0,
                "totalWins": 0,
                "totalLosses": 0,
                "strength_of_record": 0,
                "gamesPlayed": 0,
            }
        if teamB.id not in team_updates:
            team_updates[teamB.id] = {
                "team": teamB,
                "confWins": 0,
                "confLosses": 0,
                "nonConfWins": 0,
                "nonConfLosses": 0,
                "totalWins": 0,
                "totalLosses": 0,
                "strength_of_record": 0,
                "gamesPlayed": 0,
            }

        # Track games played
        team_updates[teamA.id]["gamesPlayed"] += 1
        team_updates[teamB.id]["gamesPlayed"] += 1

        # Determine winner/loser
        if game.winner == teamA:
            winner_id, loser_id = teamA.id, teamB.id
        else:
            winner_id, loser_id = teamB.id, teamA.id

        # Track conference/non-conference results
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
        if game.winner == teamA:
            winner_resume_add = teamB.rating**WIN_FACTOR
            loser_resume_add = teamA.rating**LOSS_FACTOR
        else:
            winner_resume_add = teamA.rating**WIN_FACTOR
            loser_resume_add = teamB.rating**LOSS_FACTOR

        team_updates[winner_id]["strength_of_record"] += winner_resume_add
        team_updates[loser_id]["strength_of_record"] += loser_resume_add

    # Apply updates to team objects (in memory only)
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

    return teams_to_update


def create_game_logs_from_plays(
    game, info, plays_to_process=None, starters_by_team_pos=None
):
    desired_positions = {"qb", "rb", "wr", "te", "k", "p"}

    # Get starters if not provided
    if starters_by_team_pos is None:
        all_starters = info.players.filter(
            starter=True, pos__in=desired_positions
        ).select_related("team")

        starters_by_team_pos = {
            (player.team, player.pos): [] for player in all_starters
        }
        for player in all_starters:
            starters_by_team_pos[(player.team, player.pos)].append(player)

    # Get plays if not provided
    if plays_to_process is None:
        plays_to_process = list(game.plays.all())

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
    game_log_dict = {}
    for game_log in game_logs_to_process:
        game_log_dict[(game_log.player, game_log.game)] = game_log

    # Note: Headers are now set during simulation in sim.py
    for play in plays_to_process:
        offense_team = play.offense

        # Get starters for this offense team
        rb_starters = starters_by_team_pos.get((offense_team, "rb"))
        qb_starter = starters_by_team_pos.get((offense_team, "qb"))
        wr_starters = starters_by_team_pos.get((offense_team, "wr"))
        te_starters = starters_by_team_pos.get((offense_team, "te"))
        k_starter = starters_by_team_pos.get((offense_team, "k"))

        if not (
            rb_starters and qb_starter and wr_starters and te_starters and k_starter
        ):
            continue

        if play.playType == "run":
            runner = random.choice(rb_starters)
            game_log = game_log_dict[(runner, game)]
            # Update run stats
            game_log.rush_attempts += 1
            game_log.rush_yards += play.yardsGained
            if play.result == "touchdown":
                game_log.rush_touchdowns += 1
            elif play.result == "fumble":
                game_log.fumbles += 1
        elif play.playType == "pass":
            candidates = wr_starters + te_starters + rb_starters
            receiver = choose_receiver(candidates)
            qb_game_log = game_log_dict[(qb_starter[0], game)]
            receiver_game_log = game_log_dict[(receiver, game)]
            # Update pass stats
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
        elif play.playType == "field goal":
            game_log = game_log_dict[(k_starter[0], game)]
            # Update kick stats
            game_log.field_goals_attempted += 1
            if play.result == "made field goal":
                game_log.field_goals_made += 1

    # Return the game logs WITHOUT saving to database
    return game_logs_to_process

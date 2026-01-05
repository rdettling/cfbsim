from collections import defaultdict
from typing import Dict, List, Optional

from api.models import Award, Players
from django.db import transaction
from .stats import accumulate_individual_stats
from logic.util import format_player_game_log_summary

AWARD_DEFINITIONS = [
    {
        "slug": "heisman",
        "name": "Heisman Trophy",
        "description": "Recognizes the most outstanding overall player in the regular season.",
    },
    {
        "slug": "davey_obrien",
        "name": "Davey O'Brien Award",
        "description": "Awarded to the top-performing quarterback.",
    },
    {
        "slug": "doak_walker",
        "name": "Doak Walker Award",
        "description": "Honoring the nation’s best running back.",
    },
    {
        "slug": "biletnikoff",
        "name": "Biletnikoff Award",
        "description": "Honors the top wide receiver.",
    },
    {
        "slug": "bednarik",
        "name": "Bednarik Award",
        "description": "Given to the defensive player of the year.",
    },
    {
        "slug": "ted_hendricks",
        "name": "Ted Hendricks Award",
        "description": "Best defensive end in the nation.",
    },
    {
        "slug": "butkus",
        "name": "Butkus Award",
        "description": "Recognizes the nation’s top linebacker.",
    },
    {
        "slug": "thorpe",
        "name": "Thorpe Award",
        "description": "Awarded to the premier defensive back.",
    },
    {
        "slug": "lou_groza",
        "name": "Lou Groza Award",
        "description": "Honors the top placekicker.",
    },
]

PRIORITY_ORDER = [
    "heisman",
    "bednarik",
    "davey_obrien",
    "doak_walker",
    "biletnikoff",
    "ted_hendricks",
    "butkus",
    "thorpe",
    "lou_groza",
]

AWARD_DEFINITION_MAP = {definition["slug"]: definition for definition in AWARD_DEFINITIONS}

CANDIDATE_FIELDS = {
    1: ("first_place", "first_score", "first_stats"),
    2: ("second_place", "second_score", "second_stats"),
    3: ("third_place", "third_score", "third_stats"),
}

DEFENSIVE_POSITIONS = ["dl", "lb", "cb", "s", "de"]


def calculate_award_candidates(info) -> Dict[str, List[Dict[str, Optional[object]]]]:
    """Return candidate lists for each award slug."""

    game_logs_by_player = defaultdict(list)
    for log in info.game_logs.filter(game__year=info.currentYear).select_related("player"):
        game_logs_by_player[log.player_id].append(log)

    return {
        "heisman": _calc_heisman(info, game_logs_by_player),
        "davey_obrien": _calc_davey_obrien(info, game_logs_by_player),
        "doak_walker": _calc_doak_walker(info, game_logs_by_player),
        "biletnikoff": _calc_biletnikoff(info, game_logs_by_player),
        "bednarik": _calc_defensive_player(info, game_logs_by_player),
        "ted_hendricks": _calc_ted_hendricks(info, game_logs_by_player),
        "butkus": _calc_butkus(info, game_logs_by_player),
        "thorpe": _calc_thorpe(info, game_logs_by_player),
        "lou_groza": _calc_kicking(info, game_logs_by_player),
    }


def _reset_award_slots(award):
    for player_field, score_field, stats_field in CANDIDATE_FIELDS.values():
        setattr(award, player_field, None)
        setattr(award, score_field, None)
        setattr(award, stats_field, None)


def _assign_candidates_to_award(award, candidates):
    _reset_award_slots(award)

    for rank in range(1, 4):
        entry = candidates[rank - 1] if len(candidates) >= rank else None
        player_field, score_field, stats_field = CANDIDATE_FIELDS[rank]
        if entry:
            setattr(award, player_field, entry["player"])
            setattr(award, score_field, entry["score"])
            setattr(award, stats_field, entry.get("stats", {}))
        else:
            setattr(award, player_field, None)
            setattr(award, score_field, None)
            setattr(award, stats_field, None)


def _persist_awards(info, is_final=False):
    candidate_map = calculate_award_candidates(info)
    persisted = []

    with transaction.atomic():
        order = PRIORITY_ORDER if is_final else [definition["slug"] for definition in AWARD_DEFINITIONS]
        blocked_players = set()
        for slug in order:
            candidates = candidate_map.get(slug, [])
            defn = AWARD_DEFINITION_MAP.get(slug)
            award, _ = Award.objects.get_or_create(info=info, slug=slug, is_final=is_final)
            if defn:
                award.name = defn["name"]
                award.description = defn.get("description", "")

            ordered_candidates = candidates[:3]
            if is_final:
                first_candidate = None
                for entry in candidates:
                    player = entry.get("player")
                    if player and player.id not in blocked_players:
                        first_candidate = entry
                        blocked_players.add(player.id)
                        break

                remaining = [entry for entry in candidates if entry is not first_candidate]
                ordered_candidates = []
                if first_candidate:
                    ordered_candidates.append(first_candidate)
                ordered_candidates.extend(remaining[: max(0, 3 - len(ordered_candidates))])

            _assign_candidates_to_award(award, ordered_candidates)
            award.save()
            persisted.append(award)

    return persisted


def refresh_award_favorites(info):
    return _persist_awards(info, is_final=False)


def finalize_awards(info):
    return _persist_awards(info, is_final=True)


def _calc_heisman(info, logs_map) -> List[Dict[str, object]]:
    passing = accumulate_individual_stats(info, "passing")
    rushing = accumulate_individual_stats(info, "rushing")
    receiving = accumulate_individual_stats(info, "receiving")
    total_teams = info.teams.count()

    candidates = []
    for player in info.players.filter(active=True, starter=True):
        score = player.rating or 0
        stats_summary = {"team": player.team.name if player.team else None}

        pass_stats = passing.get(player)
        rush_stats = rushing.get(player)
        recv_stats = receiving.get(player)

        if pass_stats:
            score += (pass_stats.get("passer_rating", 0) or 0) * 2
            stats_summary["passing"] = pass_stats
        if rush_stats:
            score += (rush_stats.get("yards_per_game", 0) or 0) * 1.5
            stats_summary["rushing"] = rush_stats
        if recv_stats:
            score += (recv_stats.get("yards_per_game", 0) or 0) * 1.2
            stats_summary["receiving"] = recv_stats

        team_ranking = player.team.ranking if player.team else None
        if team_ranking and team_ranking > 0:
            rank_bonus = max(0, (total_teams + 1 - team_ranking)) * 0.5
            score += rank_bonus

        stats_summary["stat_line"] = format_player_game_log_summary(logs_map.get(player.id))
        candidates.append({"player": player, "score": score, "stats": stats_summary})

    return sorted(candidates, key=lambda item: item["score"], reverse=True)[:3]


def _calc_davey_obrien(info, logs_map) -> List[Dict[str, object]]:
    passing = accumulate_individual_stats(info, "passing")
    candidates = []

    for player, stats in passing.items():
        if player.pos != "qb" or not player.starter:
            continue
        score = (player.rating or 0) + (stats.get("passer_rating", 0) or 0) * 2.5
        stats_summary = {
            "passer_rating": stats.get("passer_rating"),
            "yards_per_game": stats.get("yards_per_game"),
            "team": player.team.name if player.team else None,
        }
        stats_summary["stat_line"] = format_player_game_log_summary(logs_map.get(player.id))
        candidates.append({"player": player, "score": score, "stats": stats_summary})

    return sorted(candidates, key=lambda item: item["score"], reverse=True)[:3]


def _calc_doak_walker(info, logs_map) -> List[Dict[str, object]]:
    rushing = accumulate_individual_stats(info, "rushing")
    candidates = []

    for player, stats in rushing.items():
        if player.pos != "rb" or not player.starter:
            continue
        score = (player.rating or 0) + (stats.get("yards_per_game", 0) or 0) * 1.8
        stats_summary = {
            "yards_per_game": stats.get("yards_per_game"),
            "att": stats.get("att"),
            "team": player.team.name if player.team else None,
        }
        stats_summary["stat_line"] = format_player_game_log_summary(logs_map.get(player.id))
        candidates.append({"player": player, "score": score, "stats": stats_summary})

    return sorted(candidates, key=lambda item: item["score"], reverse=True)[:3]


def _calc_biletnikoff(info, logs_map) -> List[Dict[str, object]]:
    receiving = accumulate_individual_stats(info, "receiving")
    candidates = []

    for player, stats in receiving.items():
        if player.pos != "wr" or not player.starter:
            continue
        score = (player.rating or 0) + (stats.get("yards_per_game", 0) or 0) * 2
        stats_summary = {
            "yards_per_game": stats.get("yards_per_game"),
            "rec": stats.get("rec"),
            "team": player.team.name if player.team else None,
        }
        stats_summary["stat_line"] = format_player_game_log_summary(logs_map.get(player.id))
        candidates.append({"player": player, "score": score, "stats": stats_summary})

    return sorted(candidates, key=lambda item: item["score"], reverse=True)[:3]


def _defensive_aggregator(info, positions):
    stats_by_player = defaultdict(
        lambda: {"tackles": 0, "sacks": 0.0, "interceptions": 0, "player": None}
    )

    for log in info.game_logs.filter(
        game__year=info.currentYear, player__pos__in=positions
    ).select_related("player"):
        player = log.player
        entry = stats_by_player[player.id]
        entry["player"] = player
        entry["tackles"] += log.tackles or 0
        entry["sacks"] += log.sacks or 0
        entry["interceptions"] += log.interceptions or 0

    return stats_by_player


def _calc_defensive_player(info, logs_map) -> List[Dict[str, object]]:
    stats_by_player = _defensive_aggregator(info, DEFENSIVE_POSITIONS)
    candidates = []
    for entry in stats_by_player.values():
        player = entry["player"]
        if not player or not player.starter:
            continue

        score = (
            (player.rating or 0)
            + entry["tackles"] * 1.5
            + entry["sacks"] * 4
            + entry["interceptions"] * 3
        )
        stats_summary = {
            "tackles": entry["tackles"],
            "sacks": entry["sacks"],
            "interceptions": entry["interceptions"],
            "team": player.team.name if player.team else None,
        }
        stats_summary["stat_line"] = format_player_game_log_summary(logs_map.get(player.id))
        candidates.append({"player": player, "score": score, "stats": stats_summary})

    return sorted(candidates, key=lambda item: item["score"], reverse=True)[:3]


def _calc_specific_defender(info, positions, weights, extra_labels, logs_map):
    stats_by_player = _defensive_aggregator(info, positions)
    candidates = []
    for entry in stats_by_player.values():
        player = entry["player"]
        if not player or not player.starter:
            continue

        score = player.rating or 0
        stats_summary = {"team": player.team.name if player.team else None}
        for stat_field, weight in weights.items():
            stat_value = entry.get(stat_field, 0) or 0
            score += stat_value * weight
            stats_summary[stat_field] = stat_value

        for label, field in extra_labels.items():
            stats_summary[label] = entry.get(field)

        stats_summary["stat_line"] = format_player_game_log_summary(logs_map.get(player.id))
        candidates.append({"player": player, "score": score, "stats": stats_summary})

    return sorted(candidates, key=lambda item: item["score"], reverse=True)[:3]


def _calc_ted_hendricks(info, logs_map) -> List[Dict[str, object]]:
    return _calc_specific_defender(
        info,
        ["dl", "de"],
        {"sacks": 5, "tackles": 1.2},
        {"team": None},
        logs_map,
    )


def _calc_butkus(info, logs_map) -> List[Dict[str, object]]:
    return _calc_specific_defender(
        info,
        ["lb"],
        {"tackles": 1.3, "interceptions": 3},
        {"team": None},
        logs_map,
    )


def _calc_thorpe(info, logs_map) -> List[Dict[str, object]]:
    return _calc_specific_defender(
        info,
        ["cb", "s"],
        {"interceptions": 4, "tackles": 1.0},
        {"team": None},
        logs_map,
    )


def _calc_kicking(info, logs_map) -> List[Dict[str, object]]:
    stats_by_player = defaultdict(lambda: {"made": 0, "attempted": 0, "player": None})

    for log in info.game_logs.filter(
        game__year=info.currentYear, player__pos="k"
    ).select_related("player"):
        player = log.player
        entry = stats_by_player[player.id]
        entry["player"] = player
        entry["made"] += log.field_goals_made or 0
        entry["attempted"] += log.field_goals_attempted or 0

    candidates = []
    for entry in stats_by_player.values():
        player = entry["player"]
        if not player or not player.starter:
            continue

        accuracy = (entry["made"] / entry["attempted"] * 100) if entry["attempted"] > 0 else 0
        score = (player.rating or 0) + entry["made"] * 2 + accuracy * 0.1
        stats_summary = {
            "made": entry["made"],
            "attempted": entry["attempted"],
            "accuracy": round(accuracy, 1),
            "team": player.team.name if player.team else None,
        }
        stats_summary["stat_line"] = format_player_game_log_summary(logs_map.get(player.id))
        candidates.append({"player": player, "score": score, "stats": stats_summary})

    return sorted(candidates, key=lambda item: item["score"], reverse=True)[:3]


def _calc_punting(info, logs_map) -> List[Dict[str, object]]:
    return []

import json
import random
from ..models import *
from django.db.models import Count, Sum
from collections import Counter


ROSTER = {
    "qb": 1,
    "rb": 1,
    "wr": 3,
    "te": 1,
    "ol": 5,
    "dl": 4,
    "lb": 3,
    "cb": 2,
    "s": 2,
    "k": 1,
    "p": 1,
}


def getProgression():
    return random.randint(1, 5)


def getStartRating(prestige):
    variance = 15

    return prestige - random.randint(0, variance) - 5


def update_rosters(info):
    players = info.players.all()
    team = info.team
    leaving_seniors = list(players.filter(year="sr"))
    players.filter(year="sr").delete()

    to_update = []
    rating_increases = {}

    for player in players:
        increase = getProgression()
        player.rating += increase
        player.rating_increase = increase

        if player.year == "fr":
            player.year = "so"
        elif player.year == "so":
            player.year = "jr"
        elif player.year == "jr":
            player.year = "sr"

        to_update.append(player)
        rating_increases[player.id] = increase

    Players.objects.bulk_update(to_update, ["rating", "rating_increase", "year"])

    leaving_seniors_of_team = [
        player for player in leaving_seniors if player.team == team
    ]
    progressed_players_of_team = [player for player in players if player.team == team]

    return {
        "leaving_seniors": leaving_seniors_of_team,
        "progressed_players": progressed_players_of_team,
        "rating_increases": rating_increases,
    }


def aiRecruitOffers(info):
    # Get all AI teams related to this info
    ai_teams = info.teams.all().exclude(pk=info.team.pk)

    # Get all recruits related to this info
    recruits = info.recruits.all().order_by("overall_rank")

    offers_to_create = []

    for team in ai_teams:
        # Here, we'll find the top recruit (by overall_rank) without an offer.
        recruit_without_offer = (
            recruits.annotate(offer_count=Count("offers")).filter(offer_count=0).first()
        )

        if recruit_without_offer:
            offers_to_create.append(
                Offers(
                    info=info,
                    recruit=recruit_without_offer,
                    team=team,
                )
            )

            # Remove this recruit from the recruits QuerySet to avoid offering him again
            recruits = recruits.exclude(pk=recruit_without_offer.pk)

    # Bulk create all the offers
    Offers.objects.bulk_create(offers_to_create)


def generateName(position):
    positions = {
        "qb": 15,
        "rb": 70,
        "wr": 70,
        "te": 30,
        "ol": 20,
        "dl": 70,
        "lb": 50,
        "cb": 90,
        "s": 70,
        "k": 0,
        "p": 0,
    }

    with open("start/static/names.json") as f:
        names = json.load(f)

    if random.random() <= positions[position] / 100:
        race = "black"
    else:
        race = "white"

    first_names = names[race]["first"]
    last_names = names[race]["last"]

    first = random.choices(
        first_names, weights=[name["weight"] for name in first_names]
    )[0]["name"]
    last = random.choices(last_names, weights=[name["weight"] for name in last_names])[
        0
    ]["name"]

    return (first, last)


def get_ratings(info):
    offense_weight = 0.60
    defense_weight = 0.40
    offensive_weights = {"qb": 40, "rb": 10, "wr": 25, "te": 5, "ol": 20}
    defensive_weights = {"dl": 35, "lb": 20, "cb": 30, "s": 15}

    all_players = info.players.select_related("team").filter(starter=True)
    teams = info.teams.all()

    team_ratings = {}

    for team in teams:
        team_ratings[team.id] = {
            "offense": 0,
            "defense": 0,
            "total_offensive_weight": 0,
            "total_defensive_weight": 0,
        }

        players = all_players.filter(team=team)

        for position, count in ROSTER.items():
            position_players = players.filter(pos=position).order_by("-rating")[:count]

            if position in offensive_weights:
                weight = offensive_weights[position]
                total_rating = position_players.aggregate(total=Sum("rating"))["total"]
                team_ratings[team.id]["offense"] += total_rating * weight
                team_ratings[team.id]["total_offensive_weight"] += count * weight
            elif position in defensive_weights:
                weight = defensive_weights[position]
                total_rating = position_players.aggregate(total=Sum("rating"))["total"]
                team_ratings[team.id]["defense"] += total_rating * weight
                team_ratings[team.id]["total_defensive_weight"] += count * weight

    for team in teams:
        team_data = team_ratings.get(team.id)

        offense_rating = (
            team_data["offense"] / team_data["total_offensive_weight"]
            if team_data["total_offensive_weight"] > 0
            else 0
        )
        defense_rating = (
            team_data["defense"] / team_data["total_defensive_weight"]
            if team_data["total_defensive_weight"] > 0
            else 0
        )

        overall_rating = (offense_rating * offense_weight) + (
            defense_rating * defense_weight
        )

        team.offense = round(offense_rating)
        team.defense = round(defense_rating)
        team.rating = round(overall_rating)

    Teams.objects.bulk_update(teams, ["offense", "defense", "rating"])


def set_starters(info):
    all_players = list(info.players.select_related("team").all())
    for player in all_players:
        player.starter = False

    players_by_team_and_position = {
        team.id: {position: [] for position in ROSTER} for team in info.teams.all()
    }
    for player in all_players:
        if player.pos in ROSTER:
            players_by_team_and_position[player.team.id][player.pos].append(player)

    for team_players in players_by_team_and_position.values():
        for position, players in team_players.items():
            players.sort(key=lambda x: x.rating, reverse=True)

    for _, positions in players_by_team_and_position.items():
        for position, count in ROSTER.items():
            for player in positions[position][:count]:
                player.starter = True

    Players.objects.bulk_update(all_players, ["starter"])


def fill_roster(team, players_to_create):
    player_counts = Counter(team.players.values_list("pos", flat=True))

    for position, count in ROSTER.items():
        current_count = player_counts.get(position, 0)
        needed = max(0, (2 * count + 1) - current_count)

        for _ in range(needed):
            first, last = generateName(position)

            player = Players(
                info=team.info,
                team=team,
                first=first,
                last=last,
                year="fr",
                pos=position,
                rating=getStartRating(team.prestige),
                starter=False,
            )
            players_to_create.append(player)


def init_roster(team, players_to_create):
    years = ["fr", "so", "jr", "sr"]

    for position, count in ROSTER.items():
        for i in range(2 * count + 1):
            first, last = generateName(position)
            year = random.choice(years)

            rating = getStartRating(team.prestige)
            for _ in range(years.index(year)):
                rating += getProgression()

            player = Players(
                info=team.info,
                team=team,
                first=first,
                last=last,
                year=year,
                pos=position,
                rating=rating,
                starter=False,
            )
            players_to_create.append(player)


def generate_recruit(
    stars, info, overall_rank, state_ranks, position_ranks, states_list, positions_list
):
    position = random.choice(positions_list)
    first, last = generateName(position)
    state = random.choice(states_list)

    # Get the current state rank for the selected state and update it
    current_state_rank = state_ranks.get(state, 1)
    state_ranks[state] = current_state_rank + 1

    # Get the current position rank for the selected position and update it
    current_position_rank = position_ranks.get(position, 1)
    position_ranks[position] = current_position_rank + 1

    if stars == 5:
        min_prestige = 90
    elif stars == 4:
        min_prestige = 80
    else:
        min_prestige = 0

    return Recruits(
        info=info,
        first=first,
        last=last,
        pos=position,
        stars=stars,
        state=state,
        overall_rank=overall_rank,
        min_prestige=min_prestige,
        state_rank=current_state_rank,
        position_rank=current_position_rank,
    )


def generate_recruits(info, recruits_to_create):
    with open("start/static/states.json", "r") as file:
        STATE_FREQUENCIES = json.load(file)

    states_list = [
        state for state, freq in STATE_FREQUENCIES.items() for _ in range(freq)
    ]

    positions_list = [pos for pos, freq in ROSTER.items() for _ in range(freq)]

    stars_distribution = {5: 30, 4: 300, 3: 1000}

    # Overall rank starts at 1
    current_overall_rank = 1

    # Dictionaries to keep track of state ranks and position ranks
    state_ranks = {}
    position_ranks = {}

    for stars, count in stars_distribution.items():
        for _ in range(count):
            recruits_to_create.append(
                generate_recruit(
                    stars,
                    info,
                    current_overall_rank,
                    state_ranks,
                    position_ranks,
                    states_list,
                    positions_list,
                )
            )
            current_overall_rank += 1

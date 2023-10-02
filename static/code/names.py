import os
import random
import json

# Get the directory of the current script
script_dir = os.path.dirname(os.path.abspath(__file__))

positions = {
    'qb': 15,
    'rb': 70,
    'wr': 70,
    'te': 30,
    'ol': 20,
    'dl': 70,
    'lb': 50,
    'cb': 90,
    's': 70,
    'k': 0,
    'p': 0
}

def generateName(position):
    # Use the script directory to construct the full path to names.json
    json_path = os.path.join(script_dir, 'names.json')

    with open(json_path) as f:
        names = json.load(f)

    if random.random() <= positions[position]/100:
        race = 'black'
    else:
        race = 'white'

    first_names = names[race]['first']
    last_names = names[race]['last']

    first = random.choices(first_names, weights=[name['weight'] for name in first_names])[0]['name']
    last = random.choices(last_names, weights=[name['weight'] for name in last_names])[0]['name']

    return (first, last)

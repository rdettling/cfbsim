import type { Team } from '../../types/domain';
import type { UnorientedMatchup } from '../../types/scheduleTypes';
import { stableNumber } from './determinism';

type FlowEdge = {
  to: number;
  reverse: number;
  capacity: number;
  cost: number;
};

type HeapItem = {
  node: number;
  distance: number;
};

class MinHeap {
  private readonly items: HeapItem[] = [];

  push(item: HeapItem) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.items[parent], item) <= 0) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }

  pop() {
    const first = this.items[0];
    const last = this.items.pop();
    if (!first || !last || this.items.length === 0) return first;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.items.length) break;
      const child = right < this.items.length &&
        this.compare(this.items[right], this.items[left]) < 0
        ? right
        : left;
      if (this.compare(last, this.items[child]) <= 0) break;
      this.items[index] = this.items[child];
      index = child;
    }
    this.items[index] = last;
    return first;
  }

  get length() {
    return this.items.length;
  }

  private compare(left: HeapItem, right: HeapItem) {
    return left.distance - right.distance || left.node - right.node;
  }
}

const addEdge = (
  graph: FlowEdge[][],
  from: number,
  to: number,
  capacity: number,
  cost: number,
) => {
  const forward: FlowEdge = {
    to,
    reverse: graph[to].length,
    capacity,
    cost,
  };
  const reverse: FlowEdge = {
    to: from,
    reverse: graph[from].length,
    capacity: 0,
    cost: -cost,
  };
  graph[from].push(forward);
  graph[to].push(reverse);
  return forward;
};

const sendMinimumCostFlow = (
  graph: FlowEdge[][],
  source: number,
  sink: number,
  requiredFlow: number,
) => {
  const potential = Array(graph.length).fill(0) as number[];
  for (let flow = 0; flow < requiredFlow; flow += 1) {
    const distance = Array(graph.length).fill(Number.POSITIVE_INFINITY) as number[];
    const previousNode = Array(graph.length).fill(-1) as number[];
    const previousEdge = Array(graph.length).fill(-1) as number[];
    const queue = new MinHeap();
    distance[source] = 0;
    queue.push({ node: source, distance: 0 });

    while (queue.length) {
      const current = queue.pop();
      if (!current || current.distance !== distance[current.node]) continue;
      graph[current.node].forEach((edge, edgeIndex) => {
        if (edge.capacity <= 0) return;
        const nextDistance = current.distance + edge.cost +
          potential[current.node] - potential[edge.to];
        if (nextDistance >= distance[edge.to]) return;
        distance[edge.to] = nextDistance;
        previousNode[edge.to] = current.node;
        previousEdge[edge.to] = edgeIndex;
        queue.push({ node: edge.to, distance: nextDistance });
      });
    }

    if (!Number.isFinite(distance[sink])) {
      throw new Error('Game sites could not be assigned.');
    }
    distance.forEach((value, node) => {
      if (Number.isFinite(value)) potential[node] += value;
    });

    let node = sink;
    while (node !== source) {
      const from = previousNode[node];
      const edge = graph[from][previousEdge[node]];
      edge.capacity -= 1;
      graph[node][edge.reverse].capacity += 1;
      node = from;
    }
  }
};

export const assignMatchupHosts = ({
  matchups,
  marginalHomeCosts,
  year,
  seed,
}: {
  matchups: readonly UnorientedMatchup[];
  marginalHomeCosts: ReadonlyMap<number, readonly number[]>;
  year: number;
  seed: number;
}): Team[] => {
  if (matchups.length === 0) return [];

  const teamsById = new Map<number, Team>();
  matchups.forEach(matchup => {
    teamsById.set(matchup.teamA.id, matchup.teamA);
    teamsById.set(matchup.teamB.id, matchup.teamB);
  });
  const orderedTeams = Array.from(teamsById.values()).sort((left, right) =>
    stableNumber(left.id, year, seed) - stableNumber(right.id, year, seed) ||
    left.id - right.id
  );
  const orderedMatchups = matchups
    .map((matchup, index) => ({ matchup, index }))
    .sort((left, right) =>
      stableNumber(
        Math.min(left.matchup.teamA.id, left.matchup.teamB.id),
        Math.max(left.matchup.teamA.id, left.matchup.teamB.id),
        year,
        seed,
      ) - stableNumber(
        Math.min(right.matchup.teamA.id, right.matchup.teamB.id),
        Math.max(right.matchup.teamA.id, right.matchup.teamB.id),
        year,
        seed,
      ) || left.index - right.index
    );

  const source = 0;
  const firstGameNode = 1;
  const firstTeamNode = firstGameNode + orderedMatchups.length;
  const sink = firstTeamNode + orderedTeams.length;
  const graph = Array.from({ length: sink + 1 }, () => [] as FlowEdge[]);
  const teamNodes = new Map(
    orderedTeams.map((team, index) => [team.id, firstTeamNode + index]),
  );
  const selectedEdges = new Map<number, Array<{ team: Team; edge: FlowEdge }>>();
  const minimumMarginal = Math.min(
    0,
    ...Array.from(marginalHomeCosts.values()).flatMap(costs => [...costs]),
  );
  // A shared shift makes initial edges nonnegative without changing the optimum.
  const costShift = -minimumMarginal;

  orderedMatchups.forEach(({ matchup, index }, orderedIndex) => {
    const gameNode = firstGameNode + orderedIndex;
    addEdge(graph, source, gameNode, 1, 0);
    const choices = [matchup.teamA, matchup.teamB].sort((left, right) =>
      stableNumber(left.id, index, year, seed) -
        stableNumber(right.id, index, year, seed) ||
      left.id - right.id
    );
    selectedEdges.set(index, choices.map(team => ({
      team,
      edge: addEdge(graph, gameNode, teamNodes.get(team.id)!, 1, 0),
    })));
  });
  orderedTeams.forEach(team => {
    const teamNode = teamNodes.get(team.id)!;
    const costs = marginalHomeCosts.get(team.id) ?? [];
    costs.forEach(cost => {
      addEdge(graph, teamNode, sink, 1, cost + costShift);
    });
  });

  sendMinimumCostFlow(graph, source, sink, matchups.length);

  return matchups.map((_, index) => {
    const homeTeam = selectedEdges.get(index)
      ?.find(choice => choice.edge.capacity === 0)?.team;
    if (!homeTeam) throw new Error('Game site assignment was incomplete.');
    return homeTeam;
  });
};

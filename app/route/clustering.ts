/**
 * Multi-shipper clustering with depot-aware K-means, 2-opt TSP, and
 * time-budget constraints. Ported from path_planning_optimizer.
 */

export type Point = { lat: number; lng: number };

export type ClusterResult = {
  /** Cluster index per delivery point */
  assignments: number[];
  /** Ordered routes per cluster (indices into original deliveries array) */
  routes: number[][];
  /** Distance per cluster route in km */
  distances: number[];
  /** Number of clusters */
  k: number;
};

// ─── Haversine ───────────────────────────────────────────────────────────────

export function haversineDistance(a: Point, b: Point): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ─── Nearest-neighbor TSP + 2-opt ────────────────────────────────────────────

export function computeRoute(points: Point[], depot: Point): { order: number[]; distance: number } {
  if (points.length === 0) return { order: [], distance: 0 };
  if (points.length === 1) {
    return { order: [0], distance: 2 * haversineDistance(depot, points[0]) };
  }

  const n = points.length;
  const visited = new Array(n).fill(false);
  const route: number[] = [];

  // Start from nearest to depot
  let bestFirst = 0;
  let bestDist = Infinity;
  for (let i = 0; i < n; i++) {
    const d = haversineDistance(depot, points[i]);
    if (d < bestDist) { bestDist = d; bestFirst = i; }
  }
  visited[bestFirst] = true;
  route.push(bestFirst);

  let current = bestFirst;
  for (let step = 1; step < n; step++) {
    let bestNext = -1;
    let bestD = Infinity;
    for (let j = 0; j < n; j++) {
      if (!visited[j]) {
        const d = haversineDistance(points[current], points[j]);
        if (d < bestD) { bestD = d; bestNext = j; }
      }
    }
    visited[bestNext] = true;
    route.push(bestNext);
    current = bestNext;
  }

  // 2-opt
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        const pA = i === 0 ? depot : points[route[i - 1]];
        const pB = points[route[i]];
        const pC = points[route[j]];
        const pD = j === n - 1 ? depot : points[route[j + 1]];
        const curr = haversineDistance(pA, pB) + haversineDistance(pC, pD);
        const swap = haversineDistance(pA, pC) + haversineDistance(pB, pD);
        if (swap < curr - 1e-10) {
          route.splice(i, j - i + 1, ...route.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }

  // Total distance: depot -> route -> depot
  let distance = haversineDistance(depot, points[route[0]]);
  for (let i = 0; i < n - 1; i++) {
    distance += haversineDistance(points[route[i]], points[route[i + 1]]);
  }
  distance += haversineDistance(points[route[n - 1]], depot);

  return { order: route, distance };
}

function estimateRouteDistance(points: Point[], depot: Point): number {
  return computeRoute(points, depot).distance;
}

// ─── K-means with angular-sector initialization ──────────────────────────────

function initBySector(points: Point[], depot: Point, k: number): Point[] {
  if (k === 1) {
    const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    return [{ lat, lng }];
  }

  const angles = points.map((p) => Math.atan2(p.lat - depot.lat, p.lng - depot.lng));
  const sorted = angles.map((a, i) => ({ a, i })).sort((x, y) => x.a - y.a);
  const centroids: Point[] = [];
  const chunkSize = Math.ceil(sorted.length / k);

  for (let c = 0; c < k; c++) {
    const start = c * chunkSize;
    const end = Math.min(start + chunkSize, sorted.length);
    let lat = 0, lng = 0, count = 0;
    for (let i = start; i < end; i++) {
      lat += points[sorted[i].i].lat;
      lng += points[sorted[i].i].lng;
      count++;
    }
    if (count > 0) centroids.push({ lat: lat / count, lng: lng / count });
  }
  // Fill if fewer centroids than k
  while (centroids.length < k) centroids.push(centroids[centroids.length - 1]);
  return centroids;
}

function kMeansFixed(points: Point[], k: number, centroids: Point[], maxIter = 50): number[] {
  let assignments = new Array(points.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign
    const newAssignments = points.map((p) => {
      let best = 0, bestD = Infinity;
      for (let j = 0; j < k; j++) {
        const d = haversineDistance(p, centroids[j]);
        if (d < bestD) { bestD = d; best = j; }
      }
      return best;
    });

    // Check convergence
    if (newAssignments.every((a, i) => a === assignments[i])) break;
    assignments = newAssignments;

    // Update centroids
    const sums = Array.from({ length: k }, () => ({ lat: 0, lng: 0, n: 0 }));
    for (let i = 0; i < points.length; i++) {
      sums[assignments[i]].lat += points[i].lat;
      sums[assignments[i]].lng += points[i].lng;
      sums[assignments[i]].n++;
    }
    for (let j = 0; j < k; j++) {
      if (sums[j].n > 0) {
        centroids[j] = { lat: sums[j].lat / sums[j].n, lng: sums[j].lng / sums[j].n };
      }
    }
  }
  return assignments;
}

function remapIds(assignments: number[]): number[] {
  const idMap = new Map<number, number>();
  let next = 0;
  return assignments.map((id) => {
    if (!idMap.has(id)) idMap.set(id, next++);
    return idMap.get(id)!;
  });
}

// ─── Constraints ─────────────────────────────────────────────────────────────

export type Constraints = {
  speedKmh: number;
  maxTimeMin: number;
  waitPerStopMin: number;
};

export const DEFAULT_CONSTRAINTS: Constraints = {
  speedKmh: 20,
  maxTimeMin: 105,
  waitPerStopMin: 7,
};

export function routeTimeMin(distanceKm: number, numStops: number, constraints: Constraints): number {
  return (distanceKm / constraints.speedKmh) * 60 + numStops * constraints.waitPerStopMin;
}

function isFeasible(distanceKm: number, numStops: number, constraints: Constraints): boolean {
  return routeTimeMin(distanceKm, numStops, constraints) <= constraints.maxTimeMin;
}

// ─── Depot-aware clustering ──────────────────────────────────────────────────

export function depotAwareClusters(points: Point[], depot: Point, constraints: Constraints): ClusterResult {
  const n = points.length;
  if (n === 0) return { assignments: [], routes: [], distances: [], k: 0 };
  if (n === 1) {
    const d = 2 * haversineDistance(depot, points[0]);
    return { assignments: [0], routes: [[0]], distances: [d], k: 1 };
  }

  const route1 = estimateRouteDistance(points, depot);
  const shipperPenalty = route1 / n;
  const maxK = Math.min(Math.ceil(Math.sqrt(n) * 1.5), n, 12);

  let bestScore = Infinity;
  let bestAssignments: number[] | null = null;

  for (let k = 1; k <= maxK; k++) {
    const centroids = initBySector(points, depot, k);
    const assignments = kMeansFixed(points, k, centroids);

    const groups = new Map<number, Point[]>();
    for (let i = 0; i < n; i++) {
      if (!groups.has(assignments[i])) groups.set(assignments[i], []);
      groups.get(assignments[i])!.push(points[i]);
    }

    let maxRoute = 0;
    for (const pts of groups.values()) {
      maxRoute = Math.max(maxRoute, estimateRouteDistance(pts, depot));
    }

    const score = maxRoute + k * shipperPenalty;
    if (score < bestScore) { bestScore = score; bestAssignments = assignments; }
  }

  let assignments = remapIds(bestAssignments!);

  // Force-split infeasible clusters
  let groups = buildGroups(points, assignments);
  let changed = true;
  while (changed) {
    changed = false;
    for (let ci = 0; ci < groups.length; ci++) {
      const dist = estimateRouteDistance(groups[ci], depot);
      if (!isFeasible(dist, groups[ci].length, constraints) && groups[ci].length >= 2) {
        // Split cluster
        const centroids = initBySector(groups[ci], depot, 2);
        const subAssign = kMeansFixed(groups[ci], 2, centroids);
        const a = groups[ci].filter((_, i) => subAssign[i] === 0);
        const b = groups[ci].filter((_, i) => subAssign[i] === 1);
        if (a.length > 0 && b.length > 0) {
          groups.splice(ci, 1, a, b);
          // Rebuild assignments from groups
          assignments = rebuildAssignments(points, groups);
          changed = true;
          break;
        }
      }
    }
  }

  // Build final routes
  const k = groups.length;
  const routes: number[][] = [];
  const distances: number[] = [];

  for (let ci = 0; ci < k; ci++) {
    const clusterIndices = getClusterIndices(assignments, ci);
    const clusterPoints = clusterIndices.map((i) => points[i]);
    const { order, distance } = computeRoute(clusterPoints, depot);
    routes.push(order.map((oi) => clusterIndices[oi]));
    distances.push(distance);
  }

  return { assignments, routes, distances, k };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildGroups(points: Point[], assignments: number[]): Point[][] {
  const maxK = Math.max(...assignments) + 1;
  const groups: Point[][] = Array.from({ length: maxK }, () => []);
  for (let i = 0; i < points.length; i++) {
    groups[assignments[i]].push(points[i]);
  }
  return groups.filter((g) => g.length > 0);
}

function rebuildAssignments(points: Point[], groups: Point[][]): number[] {
  const assignments = new Array(points.length).fill(0);
  for (let ci = 0; ci < groups.length; ci++) {
    for (const gp of groups[ci]) {
      const idx = points.findIndex((p) => p.lat === gp.lat && p.lng === gp.lng);
      if (idx >= 0) assignments[idx] = ci;
    }
  }
  return assignments;
}

function getClusterIndices(assignments: number[], clusterId: number): number[] {
  return assignments.reduce<number[]>((acc, a, i) => {
    if (a === clusterId) acc.push(i);
    return acc;
  }, []);
}

// ─── Fixed-K clustering (manual override) ────────────────────────────────────

export function fixedKClusters(points: Point[], depot: Point, k: number): ClusterResult {
  const n = points.length;
  if (n === 0) return { assignments: [], routes: [], distances: [], k: 0 };
  const safeK = Math.max(1, Math.min(k, n));
  const centroids = initBySector(points, depot, safeK);
  const assignments = remapIds(kMeansFixed(points, safeK, centroids));

  const actualK = Math.max(...assignments) + 1;
  const routes: number[][] = [];
  const distances: number[] = [];
  for (let ci = 0; ci < actualK; ci++) {
    const idxs = getClusterIndices(assignments, ci);
    const pts = idxs.map((i) => points[i]);
    const { order, distance } = computeRoute(pts, depot);
    routes.push(order.map((oi) => idxs[oi]));
    distances.push(distance);
  }
  return { assignments, routes, distances, k: actualK };
}

/**
 * Build a ClusterResult from explicit assignments (used after manual drag/drop).
 * Recomputes routes per cluster.
 */
export function clustersFromAssignments(
  points: Point[],
  depot: Point,
  assignments: number[],
): ClusterResult {
  if (points.length === 0) return { assignments: [], routes: [], distances: [], k: 0 };
  const remapped = remapIds(assignments);
  const k = Math.max(...remapped) + 1;
  const routes: number[][] = [];
  const distances: number[] = [];
  for (let ci = 0; ci < k; ci++) {
    const idxs = getClusterIndices(remapped, ci);
    const pts = idxs.map((i) => points[i]);
    const { order, distance } = computeRoute(pts, depot);
    routes.push(order.map((oi) => idxs[oi]));
    distances.push(distance);
  }
  return { assignments: remapped, routes, distances, k };
}

// ─── Colors ──────────────────────────────────────────────────────────────────

export const CLUSTER_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#e91e63', '#00bcd4',
];

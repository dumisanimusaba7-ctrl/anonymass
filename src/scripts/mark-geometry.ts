// Geometry for the Optima mark: four slanted blades with 90° rotational
// symmetry, traced from the company profile and redrawn on a 100×100 grid.
// The same blades morph into a medical cross (see hero-mark.ts), so both
// shapes are five-point polygons in clockwise order.

export type Point = [number, number]

const WHITE_BLADE: Point[] = [
  [15, 35],
  [38, 14],
  [55, 11],
  [55, 18],
  [29.5, 43],
]

/** Rotate a point 90° clockwise about the centre of the grid. */
const rot = ([x, y]: Point): Point => [100 - y, x]

const orange = WHITE_BLADE.map(rot)
const navy = orange.map(rot)
const yellow = navy.map(rot)

export const BLADES: Point[][] = [WHITE_BLADE, orange, navy, yellow]

export const BLADE_COLOURS = ['#ffffff', '#ef5d22', '#000066', '#fff000']

/** Plus sign split into four arms that meet at the centre. Same order as BLADES. */
export const CROSS: Point[][] = [
  [
    [39, 12],
    [61, 12],
    [61, 39],
    [50, 50],
    [39, 39],
  ],
  [
    [61, 39],
    [88, 39],
    [88, 61],
    [61, 61],
    [50, 50],
  ],
  [
    [61, 88],
    [39, 88],
    [39, 61],
    [50, 50],
    [61, 61],
  ],
  [
    [12, 61],
    [12, 39],
    [39, 39],
    [50, 50],
    [39, 61],
  ],
]

export const toPath = (pts: Point[]) =>
  'M' + pts.map(([x, y]) => `${+x.toFixed(2)} ${+y.toFixed(2)}`).join('L') + 'Z'

/**
 * Re-order a target polygon so that each point travels the shortest total
 * distance from the source polygon. Stops the morph from twisting.
 */
export function align(from: Point[], to: Point[]): Point[] {
  let best = to
  let bestCost = Infinity
  for (let shift = 0; shift < to.length; shift++) {
    const candidate = to.map((_, i) => to[(i + shift) % to.length])
    const cost = candidate.reduce((sum, [x, y], i) => sum + (x - from[i][0]) ** 2 + (y - from[i][1]) ** 2, 0)
    if (cost < bestCost) {
      bestCost = cost
      best = candidate
    }
  }
  return best
}

import type { GraphCommit } from './types'

export const GRAPH_PALETTE_SIZE = 8

export interface GraphEdge {
  part: 'top' | 'bottom' | 'through'
  from: number
  to: number
  color: number
}

export interface GraphRow {
  commit: GraphCommit
  lane: number
  color: number
  edges: GraphEdge[]
  width: number
}

/** Stateful lane assignment; feed commits in topo order, page by page. */
export class GraphLayout {
  private lanes: (string | null)[] = []
  private laneColor: number[] = []
  private colorCounter = 0
  maxLanes = 0

  private nextColor(): number {
    return this.colorCounter++ % GRAPH_PALETTE_SIZE
  }

  private freeLane(): number {
    const i = this.lanes.indexOf(null)
    if (i >= 0) return i
    this.lanes.push(null)
    return this.lanes.length - 1
  }

  add(commit: GraphCommit): GraphRow {
    const { lanes, laneColor } = this
    const incoming: number[] = []
    lanes.forEach((h, i) => {
      if (h === commit.hash) incoming.push(i)
    })

    let lane: number
    let color: number
    if (incoming.length > 0) {
      lane = incoming[0]
      color = laneColor[lane]
    } else {
      lane = this.freeLane()
      color = this.nextColor()
      laneColor[lane] = color
    }
    let width = lane + 1

    // Edges describe the lane state before this commit mutates it.
    const edges: GraphEdge[] = []
    lanes.forEach((h, i) => {
      if (h === null) return
      width = Math.max(width, i + 1)
      if (incoming.includes(i)) edges.push({ part: 'top', from: i, to: lane, color: laneColor[i] })
      else edges.push({ part: 'through', from: i, to: i, color: laneColor[i] })
    })

    for (const i of incoming) lanes[i] = null

    commit.parents.forEach((parent, idx) => {
      if (idx === 0) {
        lanes[lane] = parent
        laneColor[lane] = color
        edges.push({ part: 'bottom', from: lane, to: lane, color })
        return
      }
      let target = lanes.indexOf(parent)
      if (target < 0) {
        target = this.freeLane()
        lanes[target] = parent
        laneColor[target] = this.nextColor()
      }
      width = Math.max(width, target + 1)
      edges.push({ part: 'bottom', from: lane, to: target, color: laneColor[target] })
    })

    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop()
    laneColor.length = Math.max(lanes.length, lane + 1)
    this.maxLanes = Math.max(this.maxLanes, width)
    return { commit, lane, color, edges, width }
  }

  addAll(commits: GraphCommit[]): GraphRow[] {
    return commits.map((c) => this.add(c))
  }
}

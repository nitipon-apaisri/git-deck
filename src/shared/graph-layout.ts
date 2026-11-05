// Pure, stateful lane assignment. Feed commits in topo order, page by page.
import type { GraphCommit } from './types'

export type EdgePart = 'top' | 'bottom' | 'through'

export interface GraphEdge {
  part: EdgePart
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

export class GraphLayout {
  private lanes: (string | null)[] = []
  private laneColor: number[] = []
  private colorCounter = 0
  maxLanes = 0

  constructor(private readonly paletteSize = 6) {}

  private newColor(): number {
    return this.colorCounter++ % this.paletteSize
  }

  private freeLane(): number {
    const i = this.lanes.indexOf(null)
    return i === -1 ? this.lanes.length : i
  }

  add(commits: readonly GraphCommit[]): GraphRow[] {
    return commits.map((c) => this.addOne(c))
  }

  private addOne(commit: GraphCommit): GraphRow {
    const incoming: number[] = []
    this.lanes.forEach((h, i) => {
      if (h === commit.hash) incoming.push(i)
    })

    let lane: number
    let color: number
    if (incoming.length > 0) {
      lane = incoming[0]
      color = this.laneColor[lane]
    } else {
      lane = this.freeLane()
      color = this.newColor()
    }

    // Edges describe the state before this commit mutates the lanes.
    const edges: GraphEdge[] = []
    let used = lane
    this.lanes.forEach((h, i) => {
      if (h === null) return
      used = Math.max(used, i)
      if (incoming.includes(i))
        edges.push({ part: 'top', from: i, to: lane, color: this.laneColor[i] })
      else edges.push({ part: 'through', from: i, to: i, color: this.laneColor[i] })
    })

    for (const i of incoming) this.lanes[i] = null

    const [first, ...rest] = commit.parents
    if (first !== undefined) {
      this.lanes[lane] = first
      this.laneColor[lane] = color
      edges.push({ part: 'bottom', from: lane, to: lane, color })
      used = Math.max(used, lane)
    }
    for (const parent of rest) {
      let target = this.lanes.indexOf(parent)
      if (target === -1) {
        target = this.freeLane()
        this.lanes[target] = parent
        this.laneColor[target] = this.newColor()
      }
      edges.push({ part: 'bottom', from: lane, to: target, color: this.laneColor[target] })
      used = Math.max(used, target)
    }

    while (this.lanes.length > 0 && this.lanes[this.lanes.length - 1] === null) {
      this.lanes.pop()
      this.laneColor.length = this.lanes.length
    }

    const width = used + 1
    this.maxLanes = Math.max(this.maxLanes, width)
    return { commit, lane, color, edges, width }
  }
}

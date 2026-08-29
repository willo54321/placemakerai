/**
 * Code-level near-duplicate clustering for campaign detection.
 *
 * Finds groups of responses that are copies or light edits of the same
 * template (organised objection/support campaigns) without any LLM calls, so
 * it can run over the full response set at zero token cost. Claude is then
 * used only to characterise the clusters (see ai.ts).
 *
 * Method: exact duplicates are collapsed first (identical copies are the
 * common case and would otherwise blow up pairwise comparison), then each
 * remaining distinct text is greedily matched against existing cluster
 * representatives by word-shingle Jaccard similarity, using an inverted index
 * over representative shingles to keep candidate lookup cheap. Longest texts
 * are processed first so each cluster's representative is the fullest version
 * of the template.
 */

export interface ClusterableItem {
  id: string
  content: string
}

export interface ResponseCluster {
  /** Item ids in this cluster, largest text first */
  memberIds: string[]
  /** The longest member — best proxy for the underlying template */
  representativeId: string
  /** True when every member is an identical (normalized) copy */
  exact: boolean
}

// Texts shorter than this many words can't be shingled meaningfully; they only
// cluster via exact match.
const MIN_WORDS_FOR_SHINGLING = 15
// Exact-match grouping needs at least this many words — "No" or "Great idea"
// coinciding across respondents isn't a campaign.
const MIN_WORDS_FOR_EXACT = 4
const SHINGLE_SIZE = 3
// A text joins a cluster when its shingle overlap with the representative is
// at least this Jaccard similarity.
const JACCARD_THRESHOLD = 0.55
// Candidate representatives must share at least this many shingles (or 20% of
// the smaller set) before we pay for an exact Jaccard computation.
const MIN_SHARED_SHINGLES = 4
// Cap on how many cluster representatives one shingle's posting list tracks;
// beyond this the shingle is near-boilerplate and useless for discrimination.
const MAX_POSTING_LIST = 50
// Only cluster the first N chars of very long texts — templates diverge in
// appended personal notes, not in their opening body.
const MAX_CHARS = 4000

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9À-ɏ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function shingleSet(words: string[]): Set<string> {
  const set = new Set<string>()
  for (let i = 0; i <= words.length - SHINGLE_SIZE; i++) {
    set.add(words.slice(i, i + SHINGLE_SIZE).join(' '))
  }
  return set
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const [probe, other] = a.size <= b.size ? [a, b] : [b, a]
  let intersection = 0
  probe.forEach(sh => {
    if (other.has(sh)) intersection++
  })
  return intersection / (a.size + b.size - intersection)
}

export function clusterResponses(items: ClusterableItem[]): ResponseCluster[] {
  // Pass 1: collapse exact duplicates into one entry per distinct text.
  // Entries too short even for exact grouping stay singleton.
  interface Entry {
    text: string
    words: string[]
    itemIndexes: number[]
  }
  const entries: Entry[] = []
  const byExactText = new Map<string, Entry>()

  items.forEach((item, i) => {
    const text = normalize(item.content.slice(0, MAX_CHARS))
    const words = text ? text.split(' ') : []
    if (words.length >= MIN_WORDS_FOR_EXACT) {
      const existing = byExactText.get(text)
      if (existing) {
        existing.itemIndexes.push(i)
        return
      }
      const entry: Entry = { text, words, itemIndexes: [i] }
      byExactText.set(text, entry)
      entries.push(entry)
    } else {
      entries.push({ text, words, itemIndexes: [i] })
    }
  })

  // Pass 2: greedy near-duplicate clustering of distinct texts. Longest first
  // so representatives are the fullest template version.
  interface Cluster {
    shingles: Set<string>
    entryList: Entry[]
  }
  const clustersInternal: Cluster[] = []
  const shingleToClusters = new Map<string, number[]>()

  const shinglable = entries
    .filter(e => e.words.length >= MIN_WORDS_FOR_SHINGLING)
    .sort((a, b) => b.words.length - a.words.length)

  for (const entry of shinglable) {
    const shingles = shingleSet(entry.words)

    const sharedCount = new Map<number, number>()
    shingles.forEach(sh => {
      const list = shingleToClusters.get(sh)
      if (!list) return
      list.forEach(clusterIdx => {
        sharedCount.set(clusterIdx, (sharedCount.get(clusterIdx) || 0) + 1)
      })
    })

    let joined = -1
    let bestShared = 0
    sharedCount.forEach((count, clusterIdx) => {
      const rep = clustersInternal[clusterIdx].shingles
      const floor = Math.max(MIN_SHARED_SHINGLES, Math.min(shingles.size, rep.size) * 0.2)
      if (count < floor || count <= bestShared) return
      if (jaccard(shingles, rep) >= JACCARD_THRESHOLD) {
        joined = clusterIdx
        bestShared = count
      }
    })

    if (joined >= 0) {
      clustersInternal[joined].entryList.push(entry)
    } else {
      const clusterIdx = clustersInternal.length
      clustersInternal.push({ shingles, entryList: [entry] })
      shingles.forEach(sh => {
        const list = shingleToClusters.get(sh)
        if (!list) shingleToClusters.set(sh, [clusterIdx])
        else if (list.length < MAX_POSTING_LIST) list.push(clusterIdx)
      })
    }
  }

  // Assemble output: shingle clusters with 2+ items, plus exact-duplicate
  // groups (2+ copies) that never made it into a shingle cluster.
  const emitted = new Set<Entry>()
  const result: ResponseCluster[] = []

  const emit = (entryList: Entry[]) => {
    const memberIdx = entryList
      .flatMap(e => e.itemIndexes)
      .sort((a, b) => items[b].content.length - items[a].content.length)
    if (memberIdx.length < 2) return
    entryList.forEach(e => emitted.add(e))
    result.push({
      memberIds: memberIdx.map(i => items[i].id),
      representativeId: items[memberIdx[0]].id,
      exact: entryList.length === 1,
    })
  }

  clustersInternal.forEach(c => emit(c.entryList))
  entries.forEach(e => {
    if (!emitted.has(e) && e.itemIndexes.length >= 2) emit([e])
  })

  return result.sort((a, b) => b.memberIds.length - a.memberIds.length)
}

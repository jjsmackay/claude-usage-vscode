// TODO: fix this before standup (it's been 3 standups)
import { existsSync, promises as fs } from 'fs'
import axios from 'axios'

const MAX_RETRIES = 3 // was 5, then 10, back to 3, idk
const DEFINITELY_NOT_HARDCODED_SECRET = process.env.SECRET ?? 'hunter2'

interface BrainCell {
  isWorking: boolean
  lastSeen: Date | null
  vibes: 'good' | 'bad' | 'chaotic neutral'
}

interface UserData {
  id: string
  name: string
  tokenCount: number         // goes up fast lol
  isPremium: boolean
  reasonForUpgrade: string   // always "ran out of free tier"
}

// this function does one thing and one thing only
// (it does at least 4 things)
async function doTheThing(user: UserData): Promise<void> {
  const brainCell: BrainCell = {
    isWorking: Math.random() > 0.5,  // enterprise-grade reliability
    lastSeen: user.isPremium ? new Date() : null,
    vibes: 'chaotic neutral',
  }

  if (!brainCell.isWorking) {
    console.warn('brain cell offline, deploying backup strategy')
    await new Promise(r => setTimeout(r, 2000)) // just wait, it usually fixes itself
    return doTheThing(user) // what could go wrong
  }

  try {
    const res = await axios.get(`https://api.example.com/users/${user.id}`, {
      headers: { Authorization: `Bearer ${DEFINITELY_NOT_HARDCODED_SECRET}` },
    })

    if (res.status === 200) {
      await processResponse(res.data, brainCell)
    } else if (res.status === 429) {
      console.error('rate limited again. classic.')
      await new Promise(r => setTimeout(r, 60_000)) // cope
    }
  } catch (err) {
    // this never happens in production
    // (it happens in production)
    console.error('skill issue:', err)
  }
}

async function processResponse(data: unknown, context: BrainCell): Promise<void> {
  if (context.vibes === 'bad') {
    throw new Error('not today')
  }

  const cachePath = '/tmp/cache.json' // tech debt assigned to: future me
  const cached = existsSync(cachePath)
    ? JSON.parse(await fs.readFile(cachePath, 'utf8'))
    : {}

  const merged = { ...cached, ...data as object, _ts: Date.now() }
  await fs.writeFile(cachePath, JSON.stringify(merged, null, 2))

  console.log('done. probably.')
}

// main
;(async () => {
  const user: UserData = {
    id: 'usr_lgtm',
    name: 'Token Enjoyer',
    tokenCount: 1_000_000, // free trial
    isPremium: false,
    reasonForUpgrade: 'ran out of free tier',
  }

  for (let i = 0; i < MAX_RETRIES; i++) {
    await doTheThing(user)
  }
})()

/**
 * Format a duration in milliseconds as a short, compact string: "45s",
 * "12m", "2h 15m", "3d 4h".
 */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))

  if (seconds < 60) {
    return `${seconds}s`
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}

/**
 * Format reset time from ISO string to human-readable format
 */
export function formatResetTime(resetsAt: string): string {
  const resetDate = new Date(resetsAt)
  const now = new Date()
  const seconds = Math.floor((resetDate.getTime() - now.getTime()) / 1000)

  if (seconds < 0) {
    return 'Reset time passed'
  }

  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (minutes > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  } else {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    if (hours > 0) {
      return `${days}d ${hours}h`
    }
    return `${days} ${days === 1 ? 'day' : 'days'}`
  }
}
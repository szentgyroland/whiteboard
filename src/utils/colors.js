// Theme color palette — hashed from theme name for consistency
export const THEME_COLORS = [
  { bg: '#EEF2FF', border: '#818CF8', text: '#4338CA', group: 'rgba(99,102,241,0.07)', dot: '#6366F1' },
  { bg: '#FFF1F2', border: '#FB7185', text: '#BE123C', group: 'rgba(244,63,94,0.07)',  dot: '#F43F5E' },
  { bg: '#F0FDF4', border: '#4ADE80', text: '#15803D', group: 'rgba(34,197,94,0.07)',  dot: '#22C55E' },
  { bg: '#FFFBEB', border: '#FCD34D', text: '#B45309', group: 'rgba(245,158,11,0.07)', dot: '#F59E0B' },
  { bg: '#F0F9FF', border: '#38BDF8', text: '#0369A1', group: 'rgba(14,165,233,0.07)', dot: '#0EA5E9' },
  { bg: '#FDF4FF', border: '#C084FC', text: '#7E22CE', group: 'rgba(168,85,247,0.07)', dot: '#A855F7' },
  { bg: '#FFF7ED', border: '#FB923C', text: '#C2410C', group: 'rgba(249,115,22,0.07)', dot: '#F97316' },
  { bg: '#F0FDFA', border: '#2DD4BF', text: '#0F766E', group: 'rgba(20,184,166,0.07)', dot: '#14B8A6' },
]

export const PRIORITY_CONFIG = {
  low:      { label: 'Low',      dot: '#22C55E', bg: '#F0FDF4', text: '#15803D', border: '#86EFAC' },
  medium:   { label: 'Medium',   dot: '#F59E0B', bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  high:     { label: 'High',     dot: '#F97316', bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74' },
  critical: { label: 'Critical', dot: '#EF4444', bg: '#FFF1F2', text: '#BE123C', border: '#FCA5A5' },
}

export const STATUS_CONFIG = {
  backlog:     { label: 'Backlog',      color: '#94A3B8', bg: '#F8FAFC' },
  todo:        { label: 'To Do',        color: '#60A5FA', bg: '#EFF6FF' },
  in_progress: { label: 'In Progress',  color: '#F59E0B', bg: '#FFFBEB' },
  in_review:   { label: 'In Review',    color: '#A855F7', bg: '#FDF4FF' },
  done:        { label: 'Done',         color: '#22C55E', bg: '#F0FDF4' },
}

export const PROJECT_COLORS = [
  '#6366F1', '#F43F5E', '#22C55E', '#F59E0B',
  '#0EA5E9', '#A855F7', '#F97316', '#14B8A6',
]

/** Returns a consistent THEME_COLORS entry for a given theme name */
export function getThemeColor(themeName) {
  if (!themeName) return THEME_COLORS[7]
  let hash = 0
  for (let i = 0; i < themeName.length; i++) {
    hash = themeName.charCodeAt(i) + ((hash << 5) - hash)
  }
  return THEME_COLORS[Math.abs(hash) % THEME_COLORS.length]
}

/** Compute bounding-box (in canvas space) for all ideas sharing a theme */
export function getThemeBounds(ideas, theme, nodeW = 180, nodeH = 80, padding = 24) {
  const group = ideas.filter(i => i.theme === theme)
  if (group.length < 2) return null
  const hw = nodeW / 2
  const hh = nodeH / 2
  const minX = Math.min(...group.map(i => i.x - hw)) - padding
  const minY = Math.min(...group.map(i => i.y - hh)) - padding
  const maxX = Math.max(...group.map(i => i.x + hw)) + padding
  const maxY = Math.max(...group.map(i => i.y + hh)) + padding
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

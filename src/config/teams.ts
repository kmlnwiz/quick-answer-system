export const TEAMS = [
  { id: 1, name: 'Team Red', color: '#EF4444' },
  { id: 2, name: 'Team Blue', color: '#3B82F6' },
  { id: 3, name: 'Team Green', color: '#10B981' },
  { id: 4, name: 'Team Yellow', color: '#F59E0B' },
  { id: 5, name: 'Team Purple', color: '#8B5CF6' },
] as const;

export type Team = typeof TEAMS[number];

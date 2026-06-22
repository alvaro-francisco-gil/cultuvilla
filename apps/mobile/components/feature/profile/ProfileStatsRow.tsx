import { StatsRow, type StatItem } from '../StatsRow';

export type ProfileStat = StatItem;

export interface ProfileStatsRowProps {
  stats: ProfileStat[];
}

export function ProfileStatsRow({ stats }: ProfileStatsRowProps) {
  return <StatsRow stats={stats} />;
}

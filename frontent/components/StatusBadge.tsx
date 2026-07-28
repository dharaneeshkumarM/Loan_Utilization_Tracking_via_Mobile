import { StyleSheet, Text, View } from 'react-native';
import { colors, typography, radius, spacing } from '@/lib/theme';
import type { SubmissionStatus } from '@/lib/supabase';

type Props = {
  status: SubmissionStatus;
  size?: 'sm' | 'md';
};

export function StatusBadge({ status, size = 'md' }: Props) {
  const config = {
    pending: { bg: colors.warning[50], text: colors.warning[700], label: 'Pending' },
    approved: { bg: colors.success[50], text: colors.success[700], label: 'Approved' },
    rejected: { bg: colors.error[50], text: colors.error[700], label: 'Rejected' },
  }[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, size === 'sm' && styles.badgeSm]}>
      <View style={[styles.dot, { backgroundColor: config.text }]} />
      <Text style={[styles.text, { color: config.text }, size === 'sm' && styles.textSm]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  badgeSm: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
  },
  textSm: {
    fontSize: 11,
  },
});

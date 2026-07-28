import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, LogOut, ChevronRight, Mail, Phone, User, CheckCircle2, Clock, XCircle } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase, type Submission } from '@/lib/supabase';
import { colors, typography, spacing, radius, shadow } from '@/lib/theme';
import { useEffect, useState as useReactState } from 'react';

export default function AdminProfile() {
  const { profile, signOut } = useAuth();
  const [stats, setStats] = useReactState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  useEffect(() => {
    supabase
      .from('submissions')
      .select('status')
      .then(({ data, error }) => {
        if (error || !data) return;
        const subs = data as Pick<Submission, 'status'>[];
        setStats({
          total: subs.length,
          pending: subs.filter((s) => s.status === 'pending').length,
          approved: subs.filter((s) => s.status === 'approved').length,
          rejected: subs.filter((s) => s.status === 'rejected').length,
        });
      });
  }, []);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.full_name ?? 'A').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name}</Text>
            <View style={styles.roleBadge}>
              <Shield color={colors.primary[600]} size={12} />
              <Text style={styles.roleText}>Administrator</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Review Statistics</Text>
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: colors.neutral[100] }]}>
                <User color={colors.neutral[600]} size={18} />
              </View>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: colors.warning[50] }]}>
                <Clock color={colors.warning[600]} size={18} />
              </View>
              <Text style={styles.statValue}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: colors.success[50] }]}>
                <CheckCircle2 color={colors.success[600]} size={18} />
              </View>
              <Text style={styles.statValue}>{stats.approved}</Text>
              <Text style={styles.statLabel}>Approved</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: colors.error[50] }]}>
                <XCircle color={colors.error[600]} size={18} />
              </View>
              <Text style={styles.statValue}>{stats.rejected}</Text>
              <Text style={styles.statLabel}>Rejected</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.fieldCard}>
            <InfoRow icon={<User color={colors.neutral[400]} size={20} />} label="Name" value={profile?.full_name ?? '—'} />
            <Divider />
            <InfoRow icon={<Mail color={colors.neutral[400]} size={20} />} label="Email" value={(profile as any)?.email ?? '—'} />
            <Divider />
            <InfoRow icon={<Phone color={colors.neutral[400]} size={20} />} label="Phone" value={profile?.phone ?? '—'} />
          </View>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <LogOut color={colors.error[600]} size={20} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.neutral[50] },
  scrollView: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  title: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 26,
    color: colors.neutral[900],
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 28,
    color: colors.neutral[0],
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 20,
    color: colors.neutral[900],
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  roleText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 12,
    color: colors.primary[700],
  },
  section: { gap: spacing.sm },
  sectionLabel: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    color: colors.neutral[500],
    marginLeft: spacing.xs,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 20,
    color: colors.neutral[900],
  },
  statLabel: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    color: colors.neutral[500],
  },
  fieldCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: { flex: 1 },
  infoLabel: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    color: colors.neutral[500],
  },
  infoValue: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.neutral[900],
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginVertical: spacing.xs,
    marginLeft: 56,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[100],
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    marginTop: spacing.sm,
  },
  signOutText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.error[700],
  },
});

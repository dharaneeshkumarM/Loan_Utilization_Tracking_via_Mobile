import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Camera, TrendingUp, CheckCircle2, Clock, XCircle, Wallet, MapPin } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase, type Loan, type Submission } from '@/lib/supabase';
import { colors, typography, spacing, radius, shadow } from '@/lib/theme';
import { StatusBadge } from '@/components/StatusBadge';

export default function BeneficiaryDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!profile) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const { data: loanData, error: lErr } = await supabase
      .from('loans')
      .select('*')
      .eq('beneficiary_id', profile.id)
      .order('created_at', { ascending: false });
    if (lErr) {
      console.warn(lErr.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const loanList = (loanData ?? []) as Loan[];
    setLoans(loanList);

    if (loanList.length > 0) {
      const loanIds = loanList.map((l) => l.id);
      const { data: subData, error: sErr } = await supabase
        .from('submissions')
        .select('*')
        .in('loan_id', loanIds)
        .order('created_at', { ascending: false });
      if (sErr) {
        console.warn(sErr.message);
      } else {
        setSubmissions((subData ?? []) as Submission[]);
      }
    } else {
      setSubmissions([]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [profile]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const totalLoanAmount = loans.reduce((sum, l) => sum + Number(l.amount), 0);
  const totalSpent = submissions.reduce((sum, s) => sum + Number(s.amount_spent), 0);
  const pendingCount = submissions.filter((s) => s.status === 'pending').length;
  const approvedCount = submissions.filter((s) => s.status === 'approved').length;
  const rejectedCount = submissions.filter((s) => s.status === 'rejected').length;
  const utilisationPct = totalLoanAmount > 0 ? Math.min(100, (totalSpent / totalLoanAmount) * 100) : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{profile?.full_name ?? 'Beneficiary'}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.full_name ?? 'B').charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <LinearGradientWrap>
            <View style={styles.heroTop}>
              <View style={styles.heroIconWrap}>
                <Wallet color={colors.neutral[0]} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>Loan Utilisation</Text>
                <Text style={styles.heroValue}>
                  {utilisationPct.toFixed(0)}%
                </Text>
              </View>
            </View>
            <View style={styles.heroBar}>
              <View style={[styles.heroBarFill, { width: `${utilisationPct}%` }]} />
            </View>
            <View style={styles.heroRow}>
              <View>
                <Text style={styles.heroSubLabel}>Total Loan</Text>
                <Text style={styles.heroSubValue}>${totalLoanAmount.toLocaleString()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.heroSubLabel}>Documented</Text>
                <Text style={styles.heroSubValue}>${totalSpent.toLocaleString()}</Text>
              </View>
            </View>
          </LinearGradientWrap>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            icon={<Clock color={colors.warning[600]} size={20} />}
            bg={colors.warning[50]}
            value={pendingCount}
            label="Pending"
          />
          <StatCard
            icon={<CheckCircle2 color={colors.success[600]} size={20} />}
            bg={colors.success[50]}
            value={approvedCount}
            label="Approved"
          />
          <StatCard
            icon={<XCircle color={colors.error[600]} size={20} />}
            bg={colors.error[50]}
            value={rejectedCount}
            label="Rejected"
          />
        </View>

        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => router.push('/(app)/submit')}
          activeOpacity={0.9}
        >
          <View style={styles.ctaIcon}>
            <Camera color={colors.neutral[0]} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Submit New Asset</Text>
            <Text style={styles.ctaSub}>Capture a geo-tagged photo of your purchase</Text>
          </View>
          <TrendingUp color={colors.neutral[0]} size={20} />
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Loans</Text>
          <Text style={styles.sectionCount}>{loans.length}</Text>
        </View>

        {loans.length === 0 ? (
          <View style={styles.emptyCard}>
            <Wallet color={colors.neutral[300]} size={40} />
            <Text style={styles.emptyTitle}>No loans yet</Text>
            <Text style={styles.emptyText}>
              Your active loans will appear here once assigned.
            </Text>
          </View>
        ) : (
          loans.map((loan) => (
            <View key={loan.id} style={styles.loanCard}>
              <View style={styles.loanTop}>
                <View style={styles.loanRefWrap}>
                  <Text style={styles.loanRef}>{loan.loan_reference}</Text>
                  <View style={[styles.statusPill, loan.status === 'active' ? styles.pillActive : styles.pillClosed]}>
                    <Text style={[styles.pillText, loan.status === 'active' ? styles.pillTextActive : styles.pillTextClosed]}>
                      {loan.status === 'active' ? 'Active' : 'Closed'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.loanAmount}>${Number(loan.amount).toLocaleString()}</Text>
              </View>
              <Text style={styles.loanPurpose}>{loan.purpose}</Text>
            </View>
          ))
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Submissions</Text>
          <Text style={styles.sectionCount}>{submissions.length}</Text>
        </View>

        {submissions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Camera color={colors.neutral[300]} size={40} />
            <Text style={styles.emptyTitle}>No submissions yet</Text>
            <Text style={styles.emptyText}>
              Tap "Submit New Asset" to document your first purchase.
            </Text>
          </View>
        ) : (
          submissions.slice(0, 5).map((sub) => (
            <View key={sub.id} style={styles.subCard}>
              <Image source={{ uri: sub.photo_url }} style={styles.subImage} />
              <View style={styles.subInfo}>
                <Text style={styles.subAsset} numberOfLines={1}>{sub.asset_name}</Text>
                <Text style={styles.subCategory}>{sub.asset_category}</Text>
                <View style={styles.subMetaRow}>
                  <MapPin color={colors.neutral[400]} size={12} />
                  <Text style={styles.subMeta}>
                    {sub.latitude.toFixed(4)}, {sub.longitude.toFixed(4)}
                  </Text>
                </View>
                <View style={styles.subBottom}>
                  <Text style={styles.subAmount}>${Number(sub.amount_spent).toLocaleString()}</Text>
                  <StatusBadge status={sub.status} size="sm" />
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  bg,
  value,
  label,
}: {
  icon: React.ReactNode;
  bg: string;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LinearGradientWrap({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.heroGradient}>{children}</View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.neutral[50] },
  scrollView: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  greeting: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    color: colors.neutral[500],
  },
  name: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 24,
    color: colors.neutral[900],
    letterSpacing: -0.5,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    color: colors.neutral[0],
  },
  heroCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.md,
  },
  heroGradient: {
    backgroundColor: colors.primary[600],
    padding: spacing.lg,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    color: colors.primary[100],
  },
  heroValue: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 32,
    color: colors.neutral[0],
    letterSpacing: -1,
  },
  heroBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  heroBarFill: {
    height: '100%',
    backgroundColor: colors.neutral[0],
    borderRadius: 4,
  },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heroSubLabel: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    color: colors.primary[100],
  },
  heroSubValue: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 16,
    color: colors.neutral[0],
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadow.sm,
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
    fontSize: 22,
    color: colors.neutral[900],
  },
  statLabel: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    color: colors.neutral[500],
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.md,
  },
  ctaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 16,
    color: colors.neutral[0],
  },
  ctaSub: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    color: colors.primary[100],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 18,
    color: colors.neutral[900],
  },
  sectionCount: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    color: colors.neutral[400],
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  loanCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  loanTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  loanRefWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  loanRef: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.neutral[900],
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  pillActive: { backgroundColor: colors.success[50] },
  pillClosed: { backgroundColor: colors.neutral[100] },
  pillText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 11,
  },
  pillTextActive: { color: colors.success[700] },
  pillTextClosed: { color: colors.neutral[500] },
  loanAmount: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    color: colors.primary[700],
  },
  loanPurpose: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    color: colors.neutral[600],
  },
  emptyCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.sm,
  },
  emptyTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 16,
    color: colors.neutral[700],
  },
  emptyText: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  subCard: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.sm,
  },
  subImage: {
    width: 100,
    height: '100%',
    minHeight: 110,
    backgroundColor: colors.neutral[200],
  },
  subInfo: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  subAsset: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.neutral[900],
  },
  subCategory: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    color: colors.neutral[500],
  },
  subMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  subMeta: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    color: colors.neutral[400],
  },
  subBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  subAmount: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    color: colors.neutral[900],
  },
});

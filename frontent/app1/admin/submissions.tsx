import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CheckCircle2, XCircle, MapPin, Clock, Filter, Search } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import {
  supabase,
  type Submission,
  type Loan,
  type Profile,
  type SubmissionStatus,
} from '@/lib/supabase';
import { colors, typography, spacing, radius, shadow } from '@/lib/theme';
import { StatusBadge } from '@/components/StatusBadge';

type FilterType = 'all' | SubmissionStatus;

export default function AdminSubmissions() {
  const { profile } = useAuth();
  const [submissions, setSubmissions] = useState<(Submission & { loan?: Loan; beneficiary?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('pending');
  const [search, setSearch] = useState('');
  const [reviewing, setReviewing] = useState<(Submission & { loan?: Loan; beneficiary?: Profile }) | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadSubmissions = async () => {
    const { data, error } = await supabase
      .from('submissions')
      .select('*, loan:loans(*), beneficiary:profiles!submissions_beneficiary_id_fkey(*)')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn(error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setSubmissions((data ?? []) as any);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadSubmissions();
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadSubmissions();
  };

  const filtered = submissions.filter((s) => {
    const matchFilter = filter === 'all' || s.status === filter;
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      s.asset_name.toLowerCase().includes(q) ||
      s.asset_category.toLowerCase().includes(q) ||
      (s.beneficiary?.full_name ?? '').toLowerCase().includes(q) ||
      (s.loan?.loan_reference ?? '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const handleReview = async (status: SubmissionStatus) => {
    if (!reviewing || !profile) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('submissions')
        .update({
          status,
          reviewer_id: profile.id,
          reviewed_at: new Date().toISOString(),
          review_note: reviewNote.trim() || null,
        })
        .eq('id', reviewing.id);
      if (error) throw error;
      setReviewing(null);
      setReviewNote('');
      loadSubmissions();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to update submission.');
    } finally {
      setActionLoading(false);
    }
  };

  const counts = {
    all: submissions.length,
    pending: submissions.filter((s) => s.status === 'pending').length,
    approved: submissions.filter((s) => s.status === 'approved').length,
    rejected: submissions.filter((s) => s.status === 'rejected').length,
  };

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
      <View style={styles.header}>
        <Text style={styles.title}>Review Submissions</Text>
        <Text style={styles.subtitle}>{counts.pending} pending review</Text>
      </View>

      <View style={styles.searchWrap}>
        <Search color={colors.neutral[400]} size={18} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by asset, beneficiary, or loan ref..."
          placeholderTextColor={colors.neutral[400]}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <FilterChip label="Pending" count={counts.pending} active={filter === 'pending'} onPress={() => setFilter('pending')} color={colors.warning[600]} />
        <FilterChip label="Approved" count={counts.approved} active={filter === 'approved'} onPress={() => setFilter('approved')} color={colors.success[600]} />
        <FilterChip label="Rejected" count={counts.rejected} active={filter === 'rejected'} onPress={() => setFilter('rejected')} color={colors.error[600]} />
        <FilterChip label="All" count={counts.all} active={filter === 'all'} onPress={() => setFilter('all')} color={colors.neutral[700]} />
      </ScrollView>

      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyList}>
            <Filter color={colors.neutral[300]} size={40} />
            <Text style={styles.emptyListTitle}>No submissions</Text>
            <Text style={styles.emptyListText}>
              {search ? 'Try a different search term.' : `No ${filter} submissions right now.`}
            </Text>
          </View>
        ) : (
          filtered.map((s) => (
            <View key={s.id} style={styles.subCard}>
              <Image source={{ uri: s.photo_url }} style={styles.subImage} />
              <View style={styles.subBody}>
                <View style={styles.subTopRow}>
                  <Text style={styles.subAsset} numberOfLines={1}>{s.asset_name}</Text>
                  <StatusBadge status={s.status} size="sm" />
                </View>
                <Text style={styles.subBeneficiary}>
                  {s.beneficiary?.full_name ?? 'Unknown'} · {s.loan?.loan_reference ?? '—'}
                </Text>
                <Text style={styles.subCategory}>{s.asset_category}</Text>
                <View style={styles.subMetaRow}>
                  <MapPin color={colors.neutral[400]} size={12} />
                  <Text style={styles.subMeta}>
                    {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                  </Text>
                </View>
                <View style={styles.subBottom}>
                  <Text style={styles.subAmount}>${Number(s.amount_spent).toLocaleString()}</Text>
                  <Text style={styles.subDate}>
                    {new Date(s.created_at).toLocaleDateString()}
                  </Text>
                </View>
                {s.status === 'pending' && (
                  <View style={styles.subActions}>
                    <TouchableOpacity
                      style={[styles.subActionBtn, styles.subRejectBtn]}
                      onPress={() => {
                        setReviewing(s);
                        setReviewNote('');
                      }}
                    >
                      <XCircle color={colors.error[600]} size={16} />
                      <Text style={styles.subRejectText}>Review</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.subActionBtn, styles.subApproveBtn]}
                      onPress={async () => {
                        const { error } = await supabase
                          .from('submissions')
                          .update({
                            status: 'approved',
                            reviewer_id: profile!.id,
                            reviewed_at: new Date().toISOString(),
                          })
                          .eq('id', s.id);
                        if (error) {
                          Alert.alert('Error', error.message);
                        } else {
                          loadSubmissions();
                        }
                      }}
                    >
                      <CheckCircle2 color={colors.neutral[0]} size={16} />
                      <Text style={styles.subApproveText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {s.status !== 'pending' && s.reviewed_at && (
                  <Text style={styles.subReviewed}>
                    Reviewed {new Date(s.reviewed_at).toLocaleDateString()}
                    {s.review_note ? ` · ${s.review_note}` : ''}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={!!reviewing}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewing(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {reviewing && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Review Submission</Text>
                  <TouchableOpacity onPress={() => setReviewing(null)}>
                    <XCircle color={colors.neutral[400]} size={24} />
                  </TouchableOpacity>
                </View>
                <Image source={{ uri: reviewing.photo_url }} style={styles.modalImage} />
                <Text style={styles.modalAsset}>{reviewing.asset_name}</Text>
                <Text style={styles.modalBeneficiary}>
                  {reviewing.beneficiary?.full_name} · {reviewing.loan?.loan_reference}
                </Text>
                <View style={styles.modalMetaGrid}>
                  <View style={styles.modalMetaItem}>
                    <Text style={styles.modalMetaLabel}>Amount</Text>
                    <Text style={styles.modalMetaValue}>${Number(reviewing.amount_spent).toLocaleString()}</Text>
                  </View>
                  <View style={styles.modalMetaItem}>
                    <Text style={styles.modalMetaLabel}>Category</Text>
                    <Text style={styles.modalMetaValue}>{reviewing.asset_category}</Text>
                  </View>
                  <View style={styles.modalMetaItem}>
                    <Text style={styles.modalMetaLabel}>Coordinates</Text>
                    <Text style={styles.modalMetaValue}>
                      {reviewing.latitude.toFixed(4)}, {reviewing.longitude.toFixed(4)}
                    </Text>
                  </View>
                </View>
                {reviewing.notes ? (
                  <View style={styles.modalNotes}>
                    <Text style={styles.modalNotesLabel}>Beneficiary Notes</Text>
                    <Text style={styles.modalNotesText}>{reviewing.notes}</Text>
                  </View>
                ) : null}
                <Text style={styles.modalInputLabel}>Review Note (optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Add a note for the beneficiary..."
                  placeholderTextColor={colors.neutral[400]}
                  value={reviewNote}
                  onChangeText={setReviewNote}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalRejectBtn]}
                    onPress={() => handleReview('rejected')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={colors.neutral[0]} size={18} />
                    ) : (
                      <>
                        <XCircle color={colors.neutral[0]} size={18} />
                        <Text style={styles.modalBtnText}>Reject</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalApproveBtn]}
                    onPress={() => handleReview('approved')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={colors.neutral[0]} size={18} />
                    ) : (
                      <>
                        <CheckCircle2 color={colors.neutral[0]} size={18} />
                        <Text style={styles.modalBtnText}>Approve</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  count,
  active,
  onPress,
  color,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
  color: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, active && { color: colors.neutral[0] }]}>{label}</Text>
      <View style={[styles.filterChipCount, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
        <Text style={[styles.filterChipCountText, active && { color: colors.neutral[0] }]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.neutral[50] },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 24,
    color: colors.neutral[900],
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: 2,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 15,
    color: colors.neutral[900],
    paddingVertical: spacing.md - 2,
  },
  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.neutral[0],
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterChipActive: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  filterChipText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    color: colors.neutral[600],
  },
  filterChipCount: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  filterChipCountText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 11,
    color: colors.neutral[600],
  },
  listScroll: { flex: 1 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  emptyList: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.sm,
  },
  emptyListTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 16,
    color: colors.neutral[700],
  },
  emptyListText: {
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
    minHeight: 160,
    backgroundColor: colors.neutral[200],
  },
  subBody: { flex: 1, padding: spacing.md, gap: spacing.xs },
  subTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  subAsset: {
    flex: 1,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.neutral[900],
  },
  subBeneficiary: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    color: colors.neutral[500],
  },
  subCategory: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    color: colors.neutral[600],
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
  },
  subAmount: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    color: colors.neutral[900],
  },
  subDate: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    color: colors.neutral[400],
  },
  subActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  subActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  subRejectBtn: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[100],
  },
  subApproveBtn: { backgroundColor: colors.success[600] },
  subRejectText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    color: colors.error[700],
  },
  subApproveText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    color: colors.neutral[0],
  },
  subReviewed: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    color: colors.neutral[400],
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 20,
    color: colors.neutral[900],
  },
  modalImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[200],
    marginBottom: spacing.md,
  },
  modalAsset: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 18,
    color: colors.neutral[900],
  },
  modalBeneficiary: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: 2,
    marginBottom: spacing.md,
  },
  modalMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  modalMetaItem: { flexBasis: '47%' },
  modalMetaLabel: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    color: colors.neutral[500],
  },
  modalMetaValue: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
    color: colors.neutral[900],
    marginTop: 2,
  },
  modalNotes: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  modalNotesLabel: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: spacing.xs,
  },
  modalNotesText: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    color: colors.neutral[700],
  },
  modalInputLabel: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    color: colors.neutral[700],
    marginBottom: spacing.xs,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 15,
    color: colors.neutral[900],
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
  },
  modalApproveBtn: { backgroundColor: colors.success[600] },
  modalRejectBtn: { backgroundColor: colors.error[600] },
  modalBtnText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.neutral[0],
  },
});

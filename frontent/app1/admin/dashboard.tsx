import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MapPin, Filter, CheckCircle2, Clock, XCircle, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import {
  supabase,
  type Submission,
  type Loan,
  type Profile,
  type SubmissionStatus,
} from '@/lib/supabase';
import { colors, typography, spacing, radius, shadow } from '@/lib/theme';
import { MapView, type MapMarker } from '@/components/MapView';
import { StatusBadge } from '@/components/StatusBadge';

type FilterType = 'all' | SubmissionStatus;

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [submissions, setSubmissions] = useState<(Submission & { loan?: Loan; beneficiary?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadSubmissions = async () => {
    const { data, error } = await supabase
      .from('submissions')
      .select(
        '*, loan:loans(*), beneficiary:profiles!submissions_beneficiary_id_fkey(*)',
      )
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

  const filtered = filter === 'all' ? submissions : submissions.filter((s) => s.status === filter);

  const markers: MapMarker[] = filtered.map((s) => ({
    id: s.id,
    latitude: s.latitude,
    longitude: s.longitude,
    title: s.asset_name,
    subtitle: `${s.asset_category} · $${Number(s.amount_spent).toLocaleString()}`,
    status: s.status,
    photoUrl: s.photo_url,
  }));

  const selected = submissions.find((s) => s.id === selectedId);

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
        <View>
          <Text style={styles.greeting}>Admin Dashboard</Text>
          <Text style={styles.name}>{profile?.full_name ?? 'Administrator'}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile?.full_name ?? 'A').charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        <FilterChip
          label="All"
          count={counts.all}
          active={filter === 'all'}
          onPress={() => setFilter('all')}
          color={colors.neutral[700]}
        />
        <FilterChip
          label="Pending"
          count={counts.pending}
          active={filter === 'pending'}
          onPress={() => setFilter('pending')}
          color={colors.warning[600]}
          icon={<Clock size={14} color={filter === 'pending' ? colors.warning[700] : colors.warning[600]} />}
        />
        <FilterChip
          label="Approved"
          count={counts.approved}
          active={filter === 'approved'}
          onPress={() => setFilter('approved')}
          color={colors.success[600]}
          icon={<CheckCircle2 size={14} color={filter === 'approved' ? colors.success[700] : colors.success[600]} />}
        />
        <FilterChip
          label="Rejected"
          count={counts.rejected}
          active={filter === 'rejected'}
          onPress={() => setFilter('rejected')}
          color={colors.error[600]}
          icon={<XCircle size={14} color={filter === 'rejected' ? colors.error[700] : colors.error[600]} />}
        />
      </View>

      <View style={styles.mapSection}>
        <View style={styles.mapHeader}>
          <View style={styles.mapHeaderLeft}>
            <MapPin color={colors.primary[600]} size={18} />
            <Text style={styles.mapTitle}>Submission Locations</Text>
          </View>
          <Text style={styles.mapCount}>{markers.length} on map</Text>
        </View>
        <View style={styles.mapWrap}>
          {markers.length > 0 ? (
            <MapView
              markers={markers}
              onMarkerPress={(id) => setSelectedId(id)}
            />
          ) : (
            <View style={styles.mapEmpty}>
              <MapPin color={colors.neutral[300]} size={40} />
              <Text style={styles.mapEmptyTitle}>No locations</Text>
              <Text style={styles.mapEmptyText}>
                {filter === 'all'
                  ? 'No submissions have been made yet.'
                  : `No ${filter} submissions to display.`}
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            {filter === 'all' ? 'All Submissions' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Submissions`}
          </Text>
          <Text style={styles.listCount}>{filtered.length}</Text>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyList}>
            <Filter color={colors.neutral[300]} size={36} />
            <Text style={styles.emptyListTitle}>Nothing here</Text>
            <Text style={styles.emptyListText}>
              No submissions match this filter.
            </Text>
          </View>
        ) : (
          filtered.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.subCard, selectedId === s.id && styles.subCardActive]}
              onPress={() => setSelectedId(s.id)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: s.photo_url }} style={styles.subImage} />
              <View style={styles.subInfo}>
                <View style={styles.subTopRow}>
                  <Text style={styles.subAsset} numberOfLines={1}>{s.asset_name}</Text>
                  <StatusBadge status={s.status} size="sm" />
                </View>
                <Text style={styles.subBeneficiary}>
                  {s.beneficiary?.full_name ?? 'Unknown'} · {s.loan?.loan_reference ?? '—'}
                </Text>
                <View style={styles.subMetaRow}>
                  <MapPin color={colors.neutral[400]} size={12} />
                  <Text style={styles.subMeta}>
                    {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                  </Text>
                </View>
                <View style={styles.subBottom}>
                  <Text style={styles.subAmount}>${Number(s.amount_spent).toLocaleString()}</Text>
                  <ChevronRight color={colors.neutral[300]} size={18} />
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {selected && (
        <View style={styles.detailSheet}>
          <View style={styles.detailHandle} />
          <View style={styles.detailContent}>
            <View style={styles.detailHeader}>
              <Image source={{ uri: selected.photo_url }} style={styles.detailImage} />
              <View style={styles.detailHeaderInfo}>
                <Text style={styles.detailAsset}>{selected.asset_name}</Text>
                <Text style={styles.detailCategory}>{selected.asset_category}</Text>
                <StatusBadge status={selected.status} size="sm" />
              </View>
              <TouchableOpacity
                style={styles.detailClose}
                onPress={() => setSelectedId(null)}
              >
                <Text style={styles.detailCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.detailGrid}>
              <DetailItem label="Amount" value={`$${Number(selected.amount_spent).toLocaleString()}`} />
              <DetailItem
                label="Beneficiary"
                value={selected.beneficiary?.full_name ?? '—'}
              />
              <DetailItem label="Loan Ref" value={selected.loan?.loan_reference ?? '—'} />
              <DetailItem
                label="Coordinates"
                value={`${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`}
              />
            </View>
            {selected.notes ? (
              <View style={styles.detailNotes}>
                <Text style={styles.detailNotesLabel}>Notes</Text>
                <Text style={styles.detailNotesText}>{selected.notes}</Text>
              </View>
            ) : null}
            {selected.status === 'pending' && (
              <View style={styles.detailActions}>
                <TouchableOpacity
                  style={[styles.reviewBtn, styles.rejectBtn]}
                  onPress={async () => {
                    await reviewSubmission(selected.id, 'rejected', profile!.id);
                    setSelectedId(null);
                    loadSubmissions();
                  }}
                >
                  <XCircle color={colors.neutral[0]} size={18} />
                  <Text style={styles.reviewBtnText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reviewBtn, styles.approveBtn]}
                  onPress={async () => {
                    await reviewSubmission(selected.id, 'approved', profile!.id);
                    setSelectedId(null);
                    loadSubmissions();
                  }}
                >
                  <CheckCircle2 color={colors.neutral[0]} size={18} />
                  <Text style={styles.reviewBtnText}>Approve</Text>
                </TouchableOpacity>
              </View>
            )}
            {selected.status !== 'pending' && selected.reviewed_at && (
              <View style={styles.reviewedBox}>
                <Text style={styles.reviewedText}>
                  Reviewed on {new Date(selected.reviewed_at).toLocaleDateString()}
                  {selected.review_note ? ` · ${selected.review_note}` : ''}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

async function reviewSubmission(id: string, status: SubmissionStatus, reviewerId: string) {
  const { error } = await supabase
    .from('submissions')
    .update({
      status,
      reviewer_id: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.warn(error.message);
  }
}

function FilterChip({
  label,
  count,
  active,
  onPress,
  color,
  icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      {icon}
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
      <View style={[styles.filterChipCount, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
        <Text style={[styles.filterChipCountText, active && { color: colors.neutral[0] }]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailItemLabel}>{label}</Text>
      <Text style={styles.detailItemValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.neutral[50] },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  greeting: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    color: colors.neutral[500],
  },
  name: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
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
  filterRow: {
    flexDirection: 'row',
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
  filterChipActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  filterChipText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    color: colors.neutral[600],
  },
  filterChipTextActive: {
    color: colors.neutral[0],
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
  mapSection: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  mapHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  mapTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.neutral[900],
  },
  mapCount: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    color: colors.neutral[500],
  },
  mapWrap: {
    height: 280,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.md,
  },
  mapEmpty: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
  },
  mapEmptyTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 16,
    color: colors.neutral[700],
  },
  mapEmptyText: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  listScroll: { flex: 1 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  listTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 17,
    color: colors.neutral[900],
  },
  listCount: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    color: colors.neutral[400],
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
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
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadow.sm,
  },
  subCardActive: {
    borderColor: colors.primary[500],
  },
  subImage: {
    width: 90,
    height: '100%',
    minHeight: 110,
    backgroundColor: colors.neutral[200],
  },
  subInfo: { flex: 1, padding: spacing.md, gap: spacing.xs },
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
  detailSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.lg,
    maxHeight: '70%',
  },
  detailHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[200],
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  detailContent: { padding: spacing.lg },
  detailHeader: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  detailImage: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[200],
  },
  detailHeaderInfo: { flex: 1, gap: spacing.xs },
  detailAsset: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    color: colors.neutral[900],
  },
  detailCategory: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    color: colors.neutral[500],
  },
  detailClose: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  detailCloseText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    color: colors.neutral[600],
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  detailItem: {
    flexBasis: '47%',
  },
  detailItemLabel: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    color: colors.neutral[500],
  },
  detailItemValue: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
    color: colors.neutral[900],
    marginTop: 2,
  },
  detailNotes: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailNotesLabel: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: spacing.xs,
  },
  detailNotesText: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    color: colors.neutral[700],
  },
  detailActions: { flexDirection: 'row', gap: spacing.md },
  reviewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  approveBtn: { backgroundColor: colors.success[600] },
  rejectBtn: { backgroundColor: colors.error[600] },
  reviewBtnText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.neutral[0],
  },
  reviewedBox: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    padding: spacing.md,
  },
  reviewedText: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    color: colors.neutral[600],
  },
});

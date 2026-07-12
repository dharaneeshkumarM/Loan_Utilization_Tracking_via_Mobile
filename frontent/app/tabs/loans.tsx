import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import {
  calculateLoanMetrics,
  formatCurrency,
  formatDate,
} from '@/lib/loan-utils';
import type { Loan, Payment } from '@/types/database';
import { GlassCard } from '@/components/GlassCard';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Plus, Search, Wallet, Building2, Calendar, TrendingUp } from 'lucide-react-native';

export default function LoansScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'paid_off' | 'defaulted'>('all');

  const fetchData = useCallback(async () => {
    try {
      const [loansRes, paymentsRes] = await Promise.all([
        supabase.from('loans').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('payment_date', { ascending: false }),
      ]);
      setLoans((loansRes.data || []) as Loan[]);
      setPayments((paymentsRes.data || []) as Payment[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) return <LoadingScreen message={t.loading} />;

  const filteredLoans = loans.filter((l) => {
    const matchesSearch = !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.lender.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || l.status === filter;
    return matchesSearch && matchesFilter;
  });

  const styles = createStyles(theme);
  const filterTabs: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: t.active },
    { key: 'paid_off', label: t.paidOff },
    { key: 'defaulted', label: t.defaulted },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t.loans}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/loan/edit')}
          activeOpacity={0.7}
        >
          <Plus size={20} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Search size={18} color={theme.textTertiary} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder={t.search}
          placeholderTextColor={theme.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterTabs}>
        {filterTabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.filterTab,
              filter === tab.key && styles.filterTabActive,
            ]}
            onPress={() => setFilter(tab.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === tab.key && styles.filterTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filteredLoans.length === 0 ? (
        <GlassCard padding={32} style={styles.emptyCard}>
          <View style={styles.emptyState}>
            <Wallet size={48} color={theme.textTertiary} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>{t.noLoans}</Text>
            <Text style={styles.emptyDesc}>{t.noLoansDesc}</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/loan/edit')}
              activeOpacity={0.7}
            >
              <Plus size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.emptyButtonText}>{t.addLoan}</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      ) : (
        <View style={styles.loansList}>
          {filteredLoans.map((loan) => {
            const loanPayments = payments.filter((p) => p.loan_id === loan.id);
            const metrics = calculateLoanMetrics(loan, loanPayments);
            const statusColors = {
              active: theme.accent,
              paid_off: theme.primary,
              defaulted: theme.error,
            };
            const statusColor = statusColors[loan.status];

            return (
              <TouchableOpacity
                key={loan.id}
                onPress={() => router.push(`/loan/${loan.id}`)}
                activeOpacity={0.7}
              >
                <GlassCard padding={16} style={styles.loanCard}>
                  <View style={styles.loanCardHeader}>
                    <View style={styles.loanCardLeft}>
                      <View style={[styles.loanIcon, { backgroundColor: theme.primaryLight }]}>
                        <Building2 size={18} color={theme.primary} strokeWidth={2} />
                      </View>
                      <View style={styles.loanInfo}>
                        <Text style={styles.loanName} numberOfLines={1}>{loan.name}</Text>
                        <Text style={styles.loanLender} numberOfLines={1}>{loan.lender}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {loan.status === 'active' ? t.active : loan.status === 'paid_off' ? t.paidOff : t.defaulted}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.loanMetrics}>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>{t.principalAmount}</Text>
                      <Text style={styles.metricValue}>{formatCurrency(Number(loan.principal_amount))}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>{t.totalPaid}</Text>
                      <Text style={styles.metricValue}>{formatCurrency(metrics.totalPaid)}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>{t.remaining}</Text>
                      <Text style={[styles.metricValue, { color: statusColor }]}>
                        {formatCurrency(metrics.remainingBalance)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressContainer}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${metrics.repaidPercentage}%`,
                            backgroundColor: statusColor,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressLabel}>
                      {metrics.repaidPercentage.toFixed(0)}% {t.progress}
                    </Text>
                  </View>

                  {loan.due_date && (
                    <View style={styles.dueDateRow}>
                      <Calendar size={13} color={theme.textTertiary} strokeWidth={2} />
                      <Text style={styles.dueDateText}>Due: {formatDate(loan.due_date)}</Text>
                    </View>
                  )}
                </GlassCard>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(theme: typeof import('@/lib/theme').lightTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 16, paddingBottom: 40, gap: 14 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    title: { fontSize: 28, fontWeight: '700', color: theme.text },
    addButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 10,
    },
    searchInput: { flex: 1, fontSize: 15, color: theme.text },
    filterTabs: { flexDirection: 'row', gap: 8 },
    filterTab: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    filterTabActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    filterTabText: { fontSize: 13, fontWeight: '500', color: theme.textSecondary },
    filterTabTextActive: { color: '#fff', fontWeight: '600' },
    emptyCard: {},
    emptyState: { alignItems: 'center', gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.text },
    emptyDesc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center' },
    emptyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 14,
      marginTop: 8,
    },
    emptyButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
    loansList: { gap: 12 },
    loanCard: {},
    loanCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    loanCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    loanIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loanInfo: { flex: 1 },
    loanName: { fontSize: 16, fontWeight: '600', color: theme.text },
    loanLender: { fontSize: 13, color: theme.textTertiary, marginTop: 2 },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, fontWeight: '600' },
    loanMetrics: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    metric: { flex: 1 },
    metricLabel: { fontSize: 11, color: theme.textTertiary, fontWeight: '500' },
    metricValue: { fontSize: 15, fontWeight: '700', color: theme.text, marginTop: 2 },
    progressContainer: { gap: 6 },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.border,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 3 },
    progressLabel: { fontSize: 11, color: theme.textTertiary, fontWeight: '500' },
    dueDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    dueDateText: { fontSize: 12, color: theme.textTertiary },
  });
}

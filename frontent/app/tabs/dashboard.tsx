import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import {
  calculateLoanMetrics,
  calculateUtilizationScore,
  getScoreColor,
  getScoreLabel,
  predictNextMonthExpenses,
  generateAIInsight,
  formatCurrency,
  formatDate,
  getCategoryColor,
} from '@/lib/loan-utils';
import type { Loan, Payment, Expense } from '@/types/database';
import { GlassCard } from '@/components/GlassCard';
import { StatCard } from '@/components/StatCard';
import { BarChart, LineChart, ProgressRing } from '@/components/Charts';
import { LoadingScreen } from '@/components/LoadingScreen';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  PiggyBank,
  ScanLine,
  Bot,
  Plus,
  ArrowRight,
  AlertCircle,
  Calendar,
  Bell,
  Sparkles,
  Target,
  Receipt,
} from 'lucide-react-native';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [loansRes, paymentsRes, expensesRes] = await Promise.all([
        supabase.from('loans').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('payment_date', { ascending: false }),
        supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(50),
      ]);

      setLoans((loansRes.data || []) as Loan[]);
      setPayments((paymentsRes.data || []) as Payment[]);
      setExpenses((expensesRes.data || []) as Expense[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) return <LoadingScreen message={t.loading} />;

  const activeLoans = loans.filter((l) => l.status === 'active');
  const totalLoanAmount = loans.reduce((s, l) => s + Number(l.principal_amount), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalRemaining = activeLoans.reduce((sum, l) => {
    const loanPayments = payments.filter((p) => p.loan_id === l.id);
    const paid = loanPayments.reduce((s, p) => s + Number(p.principal_paid), 0);
    return sum + Math.max(0, Number(l.principal_amount) - paid);
  }, 0);
  const totalEMI = activeLoans.reduce((s, l) => s + Number(l.monthly_emi || 0), 0);

  const now = new Date();
  const thisMonthExpenses = expenses
    .filter((e) => {
      const d = new Date(e.expense_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, e) => s + Number(e.amount), 0);

  const predictedExpenses = predictNextMonthExpenses(expenses);
  const monthlyIncome = (user?.user_metadata?.monthly_income as number) || 50000;
  const totalOutflow = thisMonthExpenses + totalEMI;
  const savings = Math.max(0, monthlyIncome - totalOutflow);
  const utilizationScore = calculateUtilizationScore(loans, payments, thisMonthExpenses);
  const aiInsight = generateAIInsight(loans, payments, expenses);
  const scoreColor = getScoreColor(utilizationScore);

  const emiProgress = totalLoanAmount > 0 ? (totalPaid / totalLoanAmount) * 100 : 0;

  const last6MonthsData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthName = d.toLocaleDateString('en', { month: 'short' });
    const monthExpenses = expenses
      .filter((e) => {
        const ed = new Date(e.expense_date);
        return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
      })
      .reduce((s, e) => s + Number(e.amount), 0);
    return { label: monthName, value: Math.round(monthExpenses) };
  });

  const categoryData = Object.entries(
    expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
      return acc;
    }, {} as Record<string, number>)
  )
    .map(([label, value], i) => ({
      label,
      value: Math.round(value),
      color: theme.chartColors[i % theme.chartColors.length],
    }))
    .slice(0, 6);

      const upcomingEMIs = activeLoans
        .filter((l) => l.due_date && Number(l.monthly_emi) > 0)
        .map((l) => ({ ...l, dueDate: new Date(l.due_date!) }))
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
        .slice(0, 3);

  const styles = createStyles(theme);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t.welcomeBack}</Text>
          <Text style={styles.userName}>{user?.email?.split('@')[0] || 'User'}</Text>
        </View>
        <TouchableOpacity
          style={styles.notificationBtn}
          onPress={() => router.push('/notifications')}
        >
          <Bell size={20} color={theme.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <GlassCard gradient padding={20} style={styles.scoreCard}>
        <View style={styles.scoreHeader}>
          <Text style={styles.scoreTitle}>{t.utilizationScore}</Text>
          <View style={[styles.scoreBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.scoreBadgeText}>{getScoreLabel(utilizationScore)}</Text>
          </View>
        </View>
        <View style={styles.scoreBody}>
          <ProgressRing value={utilizationScore} size={130} color="#fff" label="Score" />
          <View style={styles.scoreDetails}>
            <View style={styles.scoreDetailRow}>
              <Text style={styles.scoreDetailLabel}>Active Loans</Text>
              <Text style={styles.scoreDetailValue}>{activeLoans.length}</Text>
            </View>
            <View style={styles.scoreDetailRow}>
              <Text style={styles.scoreDetailLabel}>Monthly EMI</Text>
              <Text style={styles.scoreDetailValue}>{formatCurrency(totalEMI)}</Text>
            </View>
            <View style={styles.scoreDetailRow}>
              <Text style={styles.scoreDetailLabel}>Late Payments</Text>
              <Text style={styles.scoreDetailValue}>{payments.filter((p) => p.is_late).length}</Text>
            </View>
          </View>
        </View>
      </GlassCard>

      <View style={styles.statsGrid}>
        <StatCard
          label={t.totalLoans}
          value={formatCurrency(totalLoanAmount)}
          icon={<Wallet size={18} color="#fff" strokeWidth={2} />}
          gradient
        />
        <StatCard
          label={t.remainingBalance}
          value={formatCurrency(totalRemaining)}
          icon={<TrendingDown size={18} color={theme.primary} strokeWidth={2} />}
        />
      </View>
      <View style={styles.statsGrid}>
        <StatCard
          label={t.emiProgress}
          value={`${emiProgress.toFixed(0)}%`}
          icon={<TrendingUp size={18} color={theme.accent} strokeWidth={2} />}
          trend={{ value: `${emiProgress.toFixed(0)}%`, positive: emiProgress > 50 }}
        />
        <StatCard
          label={t.monthlySpending}
          value={formatCurrency(thisMonthExpenses)}
          icon={<Wallet size={18} color={theme.warning} strokeWidth={2} />}
        />
      </View>
      <View style={styles.statsGrid}>
        <StatCard
          label={t.savings}
          value={formatCurrency(savings)}
          icon={<PiggyBank size={18} color={theme.secondary} strokeWidth={2} />}
        />
        <StatCard
          label="Predicted Next Month"
          value={formatCurrency(predictedExpenses)}
          icon={<TrendingUp size={18} color={theme.primary} strokeWidth={2} />}
        />
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => router.push('/loan/edit')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: theme.primaryLight }]}>
            <Plus size={20} color={theme.primary} strokeWidth={2} />
          </View>
          <Text style={styles.quickActionLabel}>{t.addLoan}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => router.push('/scanner')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: theme.secondaryLight }]}>
            <ScanLine size={20} color={theme.secondary} strokeWidth={2} />
          </View>
          <Text style={styles.quickActionLabel}>{t.scanReceipt}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => router.push('/(tabs)/assistant')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: theme.accentLight }]}>
            <Bot size={20} color={theme.accent} strokeWidth={2} />
          </View>
          <Text style={styles.quickActionLabel}>{t.assistant}</Text>
        </TouchableOpacity>
      </View>

      <GlassCard padding={16} style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>{t.spendingTrends}</Text>
          <Text style={styles.chartSubtitle}>Last 6 months</Text>
        </View>
        <LineChart data={last6MonthsData} color={theme.primary} height={180} />
      </GlassCard>

      {categoryData.length > 0 && (
        <GlassCard padding={16} style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>{t.categoryBreakdown}</Text>
          </View>
          <BarChart data={categoryData} color={theme.secondary} height={180} />
        </GlassCard>
      )}

      <GlassCard padding={16} style={styles.emiCard}>
        <View style={styles.chartHeader}>
          <View style={styles.emiHeaderLeft}>
            <Calendar size={18} color={theme.primary} strokeWidth={2} />
            <Text style={styles.chartTitle}>{t.upcomingEMI}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/loans')}>
            <Text style={styles.viewAllText}>{t.viewAll}</Text>
          </TouchableOpacity>
        </View>
        {upcomingEMIs.length > 0 ? (
          upcomingEMIs.map((loan) => (
            <View key={loan.id} style={styles.emiItem}>
              <View style={styles.emiItemLeft}>
                <View style={[styles.emiIcon, { backgroundColor: theme.primaryLight }]}>
                  <Wallet size={16} color={theme.primary} strokeWidth={2} />
                </View>
                <View>
                  <Text style={styles.emiLoanName} numberOfLines={1}>{loan.name}</Text>
                  <Text style={styles.emiDueDate}>Due: {formatDate(loan.due_date!)}</Text>
                </View>
              </View>
              <Text style={styles.emiAmount}>{formatCurrency(Number(loan.monthly_emi || 0))}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Calendar size={32} color={theme.textTertiary} strokeWidth={1.5} />
            <Text style={styles.emptyStateText}>{t.noUpcomingEMI}</Text>
          </View>
        )}
      </GlassCard>

      {/* AI Suggestions */}
      <GlassCard padding={16} style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View style={styles.emiHeaderLeft}>
            <Sparkles size={18} color={theme.accent} strokeWidth={2} />
            <Text style={styles.chartTitle}>AI Suggestions</Text>
          </View>
        </View>
        <Text style={styles.aiInsightText}>{aiInsight}</Text>
      </GlassCard>

      {/* Recent Transactions */}
      <GlassCard padding={16} style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View style={styles.emiHeaderLeft}>
            <Receipt size={18} color={theme.primary} strokeWidth={2} />
            <Text style={styles.chartTitle}>Recent Transactions</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/expenses')}>
            <Text style={styles.viewAllText}>{t.viewAll}</Text>
          </TouchableOpacity>
        </View>
        {expenses.length > 0 ? (
          expenses.slice(0, 5).map((exp, i) => (
            <View key={exp.id} style={[styles.emiItem, i < 4 && { borderBottomWidth: 1, borderBottomColor: theme.borderLight }]}>
              <View style={styles.emiItemLeft}>
                <View style={[styles.emiIcon, { backgroundColor: getCategoryColor(exp.category) + '20' }]}>
                  <View style={[styles.transactionDot, { backgroundColor: getCategoryColor(exp.category) }]} />
                </View>
                <View>
                  <Text style={styles.emiLoanName} numberOfLines={1}>{exp.merchant || exp.category}</Text>
                  <Text style={styles.emiDueDate}>{formatDate(exp.expense_date)}</Text>
                </View>
              </View>
              <Text style={styles.emiAmount}>{formatCurrency(Number(exp.amount))}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Receipt size={32} color={theme.textTertiary} strokeWidth={1.5} />
            <Text style={styles.emptyStateText}>No transactions yet</Text>
          </View>
        )}
      </GlassCard>

      {/* Savings Goals Quick Access */}
      <TouchableOpacity onPress={() => router.push('/savings-goals')} activeOpacity={0.7}>
        <GlassCard padding={16} style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.emiHeaderLeft}>
              <Target size={18} color={theme.accent} strokeWidth={2} />
              <Text style={styles.chartTitle}>Savings Goals</Text>
            </View>
            <ArrowRight size={18} color={theme.textTertiary} strokeWidth={2} />
          </View>
          <Text style={styles.aiInsightText}>Set and track your savings targets</Text>
        </GlassCard>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/(tabs)/assistant')}
        activeOpacity={0.7}
      >
        <GlassCard gradient padding={16} style={styles.aiBanner}>
          <View style={styles.aiBannerLeft}>
            <Bot size={28} color="#fff" strokeWidth={2} />
            <View>
              <Text style={styles.aiBannerTitle}>Ask AI Assistant</Text>
              <Text style={styles.aiBannerSubtitle}>Get personalized financial insights</Text>
            </View>
          </View>
          <ArrowRight size={20} color="#fff" strokeWidth={2} />
        </GlassCard>
      </TouchableOpacity>
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
      marginBottom: 8,
    },
    greeting: { fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
    userName: { fontSize: 24, color: theme.text, fontWeight: '700' },
    notificationBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scoreCard: { marginBottom: 4 },
    scoreHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    scoreTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
    scoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    scoreBadgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
    scoreBody: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    scoreDetails: { flex: 1, gap: 8 },
    scoreDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    scoreDetailLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
    scoreDetailValue: { fontSize: 14, fontWeight: '600', color: '#fff' },
    statsGrid: { flexDirection: 'row', gap: 12 },
    quickActions: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 8,
    },
    quickAction: { alignItems: 'center', gap: 8 },
    quickActionIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickActionLabel: { fontSize: 12, fontWeight: '500', color: theme.textSecondary },
    chartCard: {},
    chartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    chartTitle: { fontSize: 16, fontWeight: '600', color: theme.text },
    chartSubtitle: { fontSize: 12, color: theme.textTertiary },
    emiCard: {},
    emiHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    emiItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    emiItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    emiIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emiLoanName: { fontSize: 14, fontWeight: '600', color: theme.text },
    emiDueDate: { fontSize: 12, color: theme.textTertiary, marginTop: 2 },
    emiAmount: { fontSize: 15, fontWeight: '700', color: theme.primary },
    emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
    emptyStateText: { fontSize: 14, color: theme.textTertiary },
    aiInsightText: { fontSize: 13, lineHeight: 19, color: theme.textSecondary },
    transactionDot: { width: 10, height: 10, borderRadius: 5 },
    viewAllText: { fontSize: 13, fontWeight: '600', color: theme.primary },
    aiBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    aiBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    aiBannerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
    aiBannerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  });
}

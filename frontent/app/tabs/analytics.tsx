import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  Share,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  formatCurrency,
  formatDate,
  getCategoryColor,
  calculateFinancialHealthScore,
  getMonthlySavingsTrend,
  generateCSVExport,
} from '@/lib/loan-utils';
import type { Loan, Payment, Expense, SavingsGoal } from '@/types/database';
import { GlassCard } from '@/components/GlassCard';
import { BarChart, LineChart, PieChart, ProgressRing } from '@/components/Charts';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';
import { TrendingUp, TrendingDown, Download, FileText, PiggyBank, FileSpreadsheet, Activity, Wallet } from 'lucide-react-native';

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [loansRes, paymentsRes, expensesRes, goalsRes] = await Promise.all([
        supabase.from('loans').select('*'),
        supabase.from('payments').select('*').order('payment_date', { ascending: false }),
        supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
        supabase.from('savings_goals').select('*'),
      ]);
      setLoans((loansRes.data || []) as Loan[]);
      setPayments((paymentsRes.data || []) as Payment[]);
      setExpenses((expensesRes.data || []) as Expense[]);
      setSavingsGoals((goalsRes.data || []) as SavingsGoal[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const monthlyIncome = (user?.user_metadata?.monthly_income as number) || 50000;

  const now = new Date();
  const last6Months = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
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
  }, [expenses]);

  const savingsTrend = useMemo(() => getMonthlySavingsTrend(expenses, monthlyIncome, loans), [expenses, monthlyIncome, loans]);

  const categoryTotals = useMemo(() => {
    return Object.entries(
      expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
        return acc;
      }, {} as Record<string, number>)
    )
      .map(([label, value]) => ({ label, value: Math.round(value), color: getCategoryColor(label) }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const activeLoans = loans.filter((l) => l.status === 'active');
  const totalRemaining = activeLoans.reduce((sum, l) => {
    const loanPayments = payments.filter((p) => p.loan_id === l.id);
    const paid = loanPayments.reduce((s, p) => s + Number(p.principal_paid), 0);
    return sum + Math.max(0, Number(l.principal_amount) - paid);
  }, 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalPrincipal = loans.reduce((s, l) => s + Number(l.principal_amount), 0);
  const repaymentProgress = totalPrincipal > 0 ? (totalPaid / totalPrincipal) * 100 : 0;

  const loanProgressData = loans.slice(0, 5).map((l) => {
    const loanPayments = payments.filter((p) => p.loan_id === l.id);
    const paid = loanPayments.reduce((s, p) => s + Number(p.principal_paid), 0);
    const pct = Number(l.principal_amount) > 0 ? (paid / Number(l.principal_amount)) * 100 : 0;
    return { label: l.name.substring(0, 8), value: Math.round(pct) };
  });

  const healthScore = useMemo(
    () => calculateFinancialHealthScore(loans, payments, expenses, savingsGoals, monthlyIncome),
    [loans, payments, expenses, savingsGoals, monthlyIncome]
  );

  const handleDownloadReport = () => {
    if (Platform.OS === 'web') {
      const reportData = {
        generatedAt: new Date().toISOString(),
        summary: {
          totalLoans: loans.length,
          totalPrincipal: formatCurrency(totalPrincipal),
          totalPaid: formatCurrency(totalPaid),
          remainingBalance: formatCurrency(totalRemaining),
          repaymentProgress: `${repaymentProgress.toFixed(1)}%`,
          healthScore: `${healthScore.score}/100 (${healthScore.label})`,
        },
        categoryBreakdown: categoryTotals,
        monthlyTrends: last6Months,
        savingsTrend,
        healthScoreBreakdown: healthScore.breakdown,
        loans: loans.map(l => ({ name: l.name, lender: l.lender, principal: l.principal_amount, emi: l.monthly_emi, status: l.status })),
        expenses: expenses.slice(0, 50).map(e => ({ date: e.expense_date, merchant: e.merchant, category: e.category, amount: e.amount })),
      };
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loantrack-report-${now.toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      Share.share({
        title: 'LoanTrack Report',
        message: `LoanTrack Report\nTotal Loans: ${loans.length}\nTotal Principal: ${formatCurrency(totalPrincipal)}\nTotal Paid: ${formatCurrency(totalPaid)}\nRemaining: ${formatCurrency(totalRemaining)}\nProgress: ${repaymentProgress.toFixed(1)}%\nHealth Score: ${healthScore.score}/100 (${healthScore.label})`,
      });
    }
  };

  const handleExportCSV = () => {
    const csv = generateCSVExport(expenses, loans, payments);
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loantrack-export-${now.toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      Share.share({ title: 'LoanTrack CSV Export', message: csv });
    }
  };

  const handleExportPDF = () => {
    const summaryText = [
      '=== LOANTRACK MONTHLY SUMMARY ===',
      `Date: ${formatDate(now.toISOString())}`,
      '',
      '--- LOAN SUMMARY ---',
      `Total Loans: ${loans.length}`,
      `Total Principal: ${formatCurrency(totalPrincipal)}`,
      `Total Paid: ${formatCurrency(totalPaid)}`,
      `Remaining Balance: ${formatCurrency(totalRemaining)}`,
      `Repayment Progress: ${repaymentProgress.toFixed(1)}%`,
      '',
      '--- FINANCIAL HEALTH ---',
      `Score: ${healthScore.score}/100 (${healthScore.label})`,
      ...healthScore.breakdown.map(b => `  ${b.factor}: ${b.points}/${b.max}`),
      '',
      '--- EXPENSE SUMMARY ---',
      `Total Expenses: ${formatCurrency(expenses.reduce((s, e) => s + Number(e.amount), 0))}`,
      ...categoryTotals.slice(0, 5).map(c => `  ${c.label}: ${formatCurrency(c.value)}`),
      '',
      '--- SAVINGS ---',
      `Monthly Income: ${formatCurrency(monthlyIncome)}`,
      ...savingsTrend.slice(-3).map(s => `  ${s.label}: ${formatCurrency(s.value)}`),
    ].join('\n');

    if (Platform.OS === 'web') {
      const blob = new Blob([summaryText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loantrack-summary-${now.toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      Share.share({ title: 'Monthly Summary', message: summaryText });
    }
  };

  if (loading) return <LoadingScreen message={t.loading} />;

  const styles = createStyles(theme);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t.analytics}</Text>
        <View style={styles.exportRow}>
          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: theme.primary }]} onPress={handleDownloadReport} activeOpacity={0.7}>
            <Download size={16} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: theme.secondary }]} onPress={handleExportCSV} activeOpacity={0.7}>
            <FileSpreadsheet size={16} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: theme.accent }]} onPress={handleExportPDF} activeOpacity={0.7}>
            <FileText size={16} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <GlassCard padding={14} style={styles.summaryCard}>
          <TrendingUp size={20} color={theme.accent} strokeWidth={2} />
          <Text style={styles.summaryValue}>{formatCurrency(totalPaid)}</Text>
          <Text style={styles.summaryLabel}>{t.totalPaid}</Text>
        </GlassCard>
        <GlassCard padding={14} style={styles.summaryCard}>
          <TrendingDown size={20} color={theme.error} strokeWidth={2} />
          <Text style={styles.summaryValue}>{formatCurrency(totalRemaining)}</Text>
          <Text style={styles.summaryLabel}>{t.remaining}</Text>
        </GlassCard>
        <GlassCard padding={14} style={styles.summaryCard}>
          <PiggyBank size={20} color={theme.primary} strokeWidth={2} />
          <Text style={styles.summaryValue}>{repaymentProgress.toFixed(0)}%</Text>
          <Text style={styles.summaryLabel}>{t.progress}</Text>
        </GlassCard>
      </View>

      {/* Financial Health Score */}
      <GlassCard padding={16} style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitleRow}>
            <Activity size={18} color={theme.primary} strokeWidth={2} />
            <Text style={styles.chartTitle}>Financial Health Score</Text>
          </View>
          <Text style={[styles.healthBadge, { backgroundColor: healthScore.color + '20', color: healthScore.color }]}>
            {healthScore.label}
          </Text>
        </View>
        <View style={styles.healthScoreRow}>
          <ProgressRing value={healthScore.score} size={120} color={healthScore.color} label="Score" />
          <View style={styles.healthBreakdown}>
            {healthScore.breakdown.map((b, i) => (
              <View key={i} style={styles.healthBarItem}>
                <View style={styles.healthBarHeader}>
                  <Text style={styles.healthBarLabel}>{b.factor}</Text>
                  <Text style={styles.healthBarPoints}>{b.points}/{b.max}</Text>
                </View>
                <View style={[styles.healthBarTrack, { backgroundColor: theme.borderLight }]}>
                  <View style={[styles.healthBarFill, { width: `${(b.points / b.max) * 100}%`, backgroundColor: b.points / b.max > 0.6 ? theme.accent : b.points / b.max > 0.3 ? theme.warning : theme.error }]} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </GlassCard>

      <GlassCard padding={16} style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>{t.spendingTrends}</Text>
          <Text style={styles.chartSubtitle}>Last 6 months</Text>
        </View>
        <LineChart data={last6Months} color={theme.primary} height={200} />
      </GlassCard>

      {categoryTotals.length > 0 && (
        <GlassCard padding={16} style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>{t.categoryBreakdown}</Text>
          </View>
          <PieChart data={categoryTotals} size={180} />
        </GlassCard>
      )}

      <GlassCard padding={16} style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>{t.repaymentProgress}</Text>
          <Text style={styles.chartSubtitle}>By loan</Text>
        </View>
        {loanProgressData.length > 0 ? (
          <BarChart data={loanProgressData} color={theme.secondary} height={200} />
        ) : (
          <EmptyState icon={<Wallet size={36} color={theme.textTertiary} />} title="No loan data yet" subtitle="Add a loan to see repayment progress" />
        )}
      </GlassCard>

      {/* Savings Trend Chart */}
      <GlassCard padding={16} style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitleRow}>
            <PiggyBank size={18} color={theme.accent} strokeWidth={2} />
            <Text style={styles.chartTitle}>Savings Trend</Text>
          </View>
          <Text style={styles.chartSubtitle}>Last 6 months</Text>
        </View>
        <LineChart data={savingsTrend} color={theme.accent} height={200} />
      </GlassCard>

      <GlassCard padding={16} style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>{t.recentTransactions}</Text>
        </View>
        {expenses.length > 0 ? (
          expenses.slice(0, 8).map((exp, i) => (
            <View key={exp.id} style={[styles.transactionItem, i < 7 && { borderBottomWidth: 1, borderBottomColor: theme.borderLight }]}>
              <View style={[styles.transactionIcon, { backgroundColor: getCategoryColor(exp.category) + '20' }]}>
                <View style={[styles.transactionDot, { backgroundColor: getCategoryColor(exp.category) }]} />
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionMerchant} numberOfLines={1}>{exp.merchant || exp.category}</Text>
                <Text style={styles.transactionDate}>{formatDate(exp.expense_date)}</Text>
              </View>
              <Text style={styles.transactionAmount}>{formatCurrency(Number(exp.amount))}</Text>
            </View>
          ))
        ) : (
          <EmptyState icon={<TrendingUp size={36} color={theme.textTertiary} />} title="No transactions yet" subtitle="Your recent expenses will appear here" />
        )}
      </GlassCard>
    </ScrollView>
  );
}

function createStyles(theme: typeof import('@/lib/theme').lightTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 16, paddingBottom: 40, gap: 14 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    title: { fontSize: 28, fontWeight: '700', color: theme.text },
    exportRow: { flexDirection: 'row', gap: 8 },
    exportBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    summaryRow: { flexDirection: 'row', gap: 10 },
    summaryCard: { flex: 1, alignItems: 'center', gap: 4 },
    summaryValue: { fontSize: 16, fontWeight: '700', color: theme.text },
    summaryLabel: { fontSize: 11, color: theme.textTertiary, fontWeight: '500' },
    chartCard: {},
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    chartTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    chartTitle: { fontSize: 16, fontWeight: '600', color: theme.text },
    chartSubtitle: { fontSize: 12, color: theme.textTertiary },
    healthBadge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
    healthScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    healthBreakdown: { flex: 1, gap: 10 },
    healthBarItem: {},
    healthBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    healthBarLabel: { fontSize: 12, fontWeight: '500', color: theme.textSecondary },
    healthBarPoints: { fontSize: 12, fontWeight: '600', color: theme.textTertiary },
    healthBarTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
    healthBarFill: { height: '100%', borderRadius: 3 },
    emptyState: { alignItems: 'center', paddingVertical: 24 },
    emptyStateText: { fontSize: 14, color: theme.textTertiary },
    transactionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
    transactionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    transactionDot: { width: 10, height: 10, borderRadius: 5 },
    transactionInfo: { flex: 1 },
    transactionMerchant: { fontSize: 14, fontWeight: '500', color: theme.text },
    transactionDate: { fontSize: 12, color: theme.textTertiary, marginTop: 2 },
    transactionAmount: { fontSize: 15, fontWeight: '700', color: theme.text },
  });
}

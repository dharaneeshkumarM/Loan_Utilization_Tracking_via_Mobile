import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import {
  calculateLoanMetrics, formatCurrency, formatDate, getPaymentMethodLabel,
} from '@/lib/loan-utils';
import type { Loan, Payment } from '@/types/database';
import { GlassCard } from '@/components/GlassCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ProgressRing } from '@/components/Charts';
import {
  ArrowLeft, Plus, X, Building2, Calendar, TrendingUp, TrendingDown,
  Wallet, CreditCard, CheckCircle2, AlertCircle, Bell, Edit3, Trash2,
} from 'lucide-react-native';

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [loan, setLoan] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash' | 'check' | 'card' | 'other'>('bank_transfer');
  const [paymentNotes, setPaymentNotes] = useState('');

  const fetchLoan = useCallback(async () => {
    try {
      const [loanRes, paymentsRes] = await Promise.all([
        supabase.from('loans').select('*').eq('id', id).maybeSingle(),
        supabase.from('payments').select('*').eq('loan_id', id).order('payment_date', { ascending: false }),
      ]);
      setLoan(loanRes.data as Loan);
      setPayments((paymentsRes.data || []) as Payment[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { fetchLoan(); }, [fetchLoan]);

  const onRefresh = () => { setRefreshing(true); fetchLoan(); };

  const handleAddPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
    setSavingPayment(true);
    try {
      const { error } = await supabase.from('payments').insert({
        loan_id: id, amount, payment_date: paymentDate,
        payment_method: paymentMethod, notes: paymentNotes.trim() || null,
        principal_paid: amount, interest_paid: 0,
      });
      if (error) throw error;
      setPaymentAmount(''); setPaymentNotes(''); setPaymentDate(new Date().toISOString().split('T')[0]);
      setShowPaymentModal(false);
      await fetchLoan();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add payment');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeleteLoan = async () => {
    setDeleting(true);
    try {
      await supabase.from('loans').delete().eq('id', id);
      router.replace('/(tabs)/loans');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to delete loan');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) return <LoadingScreen message={t.loading} />;
  if (!loan) {
    return (
      <View style={[createStyles(theme).container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: theme.textSecondary, fontSize: 16 }}>Loan not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: theme.primary, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const metrics = calculateLoanMetrics(loan, payments);
  const styles = createStyles(theme);
  const statusColors = { active: theme.accent, paid_off: theme.primary, defaulted: theme.error };
  const statusColor = statusColors[loan.status];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={theme.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.loanDetails}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => setShowDeleteModal(true)} activeOpacity={0.7}>
            <Trash2 size={18} color={theme.error} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <GlassCard gradient padding={20} style={styles.loanHeaderCard}>
        <View style={styles.loanHeaderTop}>
          <View style={styles.loanHeaderIcon}>
            <Building2 size={24} color="#fff" strokeWidth={2} />
          </View>
          <View style={styles.loanHeaderInfo}>
            <Text style={styles.loanHeaderName}>{loan.name}</Text>
            <Text style={styles.loanHeaderLender}>{loan.lender}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.statusPillText}>
              {loan.status === 'active' ? t.active : loan.status === 'paid_off' ? t.paidOff : t.defaulted}
            </Text>
          </View>
        </View>
        <View style={styles.loanHeaderMetrics}>
          <View style={styles.loanHeaderMetric}>
            <Text style={styles.loanHeaderMetricLabel}>Principal</Text>
            <Text style={styles.loanHeaderMetricValue}>{formatCurrency(Number(loan.principal_amount))}</Text>
          </View>
          <View style={styles.loanHeaderMetric}>
            <Text style={styles.loanHeaderMetricLabel}>Monthly EMI</Text>
            <Text style={styles.loanHeaderMetricValue}>{formatCurrency(Number(loan.monthly_emi || 0))}</Text>
          </View>
          <View style={styles.loanHeaderMetric}>
            <Text style={styles.loanHeaderMetricLabel}>Interest</Text>
            <Text style={styles.loanHeaderMetricValue}>{Number(loan.interest_rate)}%</Text>
          </View>
        </View>
      </GlassCard>

      <View style={styles.progressSection}>
        <GlassCard padding={20} style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>{t.emiProgress}</Text>
            <Text style={styles.progressPercentage}>{metrics.repaidPercentage.toFixed(0)}%</Text>
          </View>
          <View style={styles.progressRingWrap}>
            <ProgressRing value={metrics.repaidPercentage} size={140} color={statusColor} label="Paid" />
          </View>
          <View style={styles.progressMetrics}>
            <View style={styles.progressMetric}>
              <TrendingUp size={16} color={theme.accent} strokeWidth={2} />
              <Text style={styles.progressMetricLabel}>{t.totalPaid}</Text>
              <Text style={styles.progressMetricValue}>{formatCurrency(metrics.totalPaid)}</Text>
            </View>
            <View style={styles.progressMetric}>
              <TrendingDown size={16} color={theme.error} strokeWidth={2} />
              <Text style={styles.progressMetricLabel}>{t.remaining}</Text>
              <Text style={styles.progressMetricValue}>{formatCurrency(metrics.remainingBalance)}</Text>
            </View>
          </View>
        </GlassCard>
      </View>

      {loan.due_date && (
        <GlassCard padding={16} style={styles.reminderCard}>
          <View style={styles.reminderLeft}>
            <View style={styles.reminderIcon}><Bell size={18} color={theme.warning} strokeWidth={2} /></View>
            <View>
              <Text style={styles.reminderTitle}>Next Payment Due</Text>
              <Text style={styles.reminderDate}>{formatDate(loan.due_date)}</Text>
            </View>
          </View>
          <Text style={styles.reminderAmount}>{formatCurrency(Number(loan.monthly_emi || 0))}</Text>
        </GlassCard>
      )}

      <View style={styles.paymentsSection}>
        <View style={styles.paymentsHeader}>
          <Text style={styles.paymentsTitle}>{t.paymentHistory}</Text>
          <TouchableOpacity style={styles.addPaymentBtn} onPress={() => setShowPaymentModal(true)} activeOpacity={0.7}>
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addPaymentBtnText}>{t.addPayment}</Text>
          </TouchableOpacity>
        </View>

        {payments.length > 0 ? (
          <View style={styles.paymentsList}>
            {payments.map((payment, idx) => (
              <GlassCard key={payment.id} padding={14} style={styles.paymentItem}>
                <View style={styles.paymentItemLeft}>
                  <View style={[styles.paymentItemIcon, { backgroundColor: theme.accentLight }]}>
                    <CreditCard size={16} color={theme.accent} strokeWidth={2} />
                  </View>
                  <View>
                    <Text style={styles.paymentItemDate}>{formatDate(payment.payment_date)}</Text>
                    <Text style={styles.paymentItemMethod}>{getPaymentMethodLabel(payment.payment_method)}</Text>
                  </View>
                </View>
                <View style={styles.paymentItemRight}>
                  <Text style={styles.paymentItemAmount}>{formatCurrency(Number(payment.amount))}</Text>
                  {payment.is_late && (
                    <View style={[styles.lateBadge, { backgroundColor: theme.errorLight }]}>
                      <Text style={[styles.lateBadgeText, { color: theme.error }]}>Late</Text>
                    </View>
                  )}
                </View>
              </GlassCard>
            ))}
          </View>
        ) : (
          <GlassCard padding={32} style={styles.emptyPayments}>
            <View style={styles.emptyPaymentsState}>
              <Wallet size={40} color={theme.textTertiary} strokeWidth={1.5} />
              <Text style={styles.emptyPaymentsText}>No payments recorded yet</Text>
              <Text style={styles.emptyPaymentsSubtext}>Add your first payment to track progress</Text>
            </View>
          </GlassCard>
        )}
      </View>

      {/* Add Payment Modal */}
      <Modal visible={showPaymentModal} animationType="slide" transparent onRequestClose={() => setShowPaymentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t.addPayment}</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}><X size={22} color={theme.textTertiary} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody}>
              <Text style={styles.sheetLabel}>{t.paymentAmount}</Text>
              <View style={styles.currencyInput}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput style={styles.currencyTextInput} placeholder="0.00" placeholderTextColor={theme.textTertiary} value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" />
              </View>
              <Text style={styles.sheetLabel}>{t.paymentDate}</Text>
              <TextInput style={styles.sheetInput} placeholder="YYYY-MM-DD" placeholderTextColor={theme.textTertiary} value={paymentDate} onChangeText={setPaymentDate} />
              <Text style={styles.sheetLabel}>{t.paymentMethod}</Text>
              <View style={styles.methodContainer}>
                {(['bank_transfer', 'cash', 'check', 'card', 'other'] as const).map((m) => (
                  <TouchableOpacity key={m} style={[styles.methodChip, paymentMethod === m && styles.methodChipActive]} onPress={() => setPaymentMethod(m)} activeOpacity={0.7}>
                    <Text style={[styles.methodChipText, paymentMethod === m && styles.methodChipTextActive]}>{getPaymentMethodLabel(m)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.sheetLabel}>{t.notes}</Text>
              <TextInput style={[styles.sheetInput, styles.sheetTextArea]} placeholder="Optional notes" placeholderTextColor={theme.textTertiary} value={paymentNotes} onChangeText={setPaymentNotes} multiline textAlignVertical="top" />
              <PrimaryButton label={t.save} onPress={handleAddPayment} loading={savingPayment} icon={<CheckCircle2 size={18} color="#fff" />} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteModal} animationType="fade" transparent onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.deleteIcon}><Trash2 size={28} color={theme.error} strokeWidth={2} /></View>
            <Text style={styles.confirmTitle}>Delete Loan?</Text>
            <Text style={styles.confirmMessage}>This will permanently delete the loan and all its payments. This cannot be undone.</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeleteModal(false)} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteBtn, deleting && { opacity: 0.6 }]} onPress={handleDeleteLoan} disabled={deleting} activeOpacity={0.7}>
                <Text style={styles.deleteBtnText}>{deleting ? 'Deleting...' : t.delete}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function createStyles(theme: typeof import('@/lib/theme').lightTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 16, paddingBottom: 40, gap: 14 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingBottom: 12 },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
    headerTitle: { fontSize: 18, fontWeight: '600', color: theme.text },
    headerActions: { flexDirection: 'row', gap: 8 },
    headerActionBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
    loanHeaderCard: {},
    loanHeaderTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    loanHeaderIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    loanHeaderInfo: { flex: 1 },
    loanHeaderName: { fontSize: 20, fontWeight: '700', color: '#fff' },
    loanHeaderLender: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    statusPillText: { fontSize: 12, fontWeight: '600', color: '#fff' },
    loanHeaderMetrics: { flexDirection: 'row', justifyContent: 'space-between' },
    loanHeaderMetric: {},
    loanHeaderMetricLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
    loanHeaderMetricValue: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 2 },
    progressSection: {},
    progressCard: { alignItems: 'center' },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 16 },
    progressTitle: { fontSize: 16, fontWeight: '600', color: theme.text },
    progressPercentage: { fontSize: 28, fontWeight: '700', color: theme.primary },
    progressRingWrap: { marginVertical: 8 },
    progressMetrics: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 16, gap: 16 },
    progressMetric: { alignItems: 'center', gap: 4 },
    progressMetricLabel: { fontSize: 12, color: theme.textTertiary, fontWeight: '500' },
    progressMetricValue: { fontSize: 16, fontWeight: '700', color: theme.text },
    reminderCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    reminderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    reminderIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.warningLight, alignItems: 'center', justifyContent: 'center' },
    reminderTitle: { fontSize: 14, fontWeight: '600', color: theme.text },
    reminderDate: { fontSize: 12, color: theme.textTertiary, marginTop: 2 },
    reminderAmount: { fontSize: 18, fontWeight: '700', color: theme.warning },
    paymentsSection: { gap: 12 },
    paymentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    paymentsTitle: { fontSize: 18, fontWeight: '600', color: theme.text },
    addPaymentBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
    addPaymentBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
    paymentsList: { gap: 8 },
    paymentItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    paymentItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    paymentItemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    paymentItemDate: { fontSize: 14, fontWeight: '600', color: theme.text },
    paymentItemMethod: { fontSize: 12, color: theme.textTertiary, marginTop: 2 },
    paymentItemRight: { alignItems: 'flex-end' },
    paymentItemAmount: { fontSize: 16, fontWeight: '700', color: theme.text },
    lateBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
    lateBadgeText: { fontSize: 10, fontWeight: '600' },
    emptyPayments: {},
    emptyPaymentsState: { alignItems: 'center', gap: 8 },
    emptyPaymentsText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
    emptyPaymentsSubtext: { fontSize: 13, color: theme.textTertiary },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    bottomSheet: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, width: '100%', maxHeight: '85%' },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border },
    sheetTitle: { fontSize: 18, fontWeight: '600', color: theme.text },
    sheetBody: { padding: 20 },
    sheetLabel: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 8, marginTop: 12 },
    sheetInput: { backgroundColor: theme.surfaceSecondary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: theme.text, borderWidth: 1, borderColor: theme.border },
    sheetTextArea: { minHeight: 80, textAlignVertical: 'top' },
    currencyInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16 },
    currencySymbol: { fontSize: 18, fontWeight: '600', color: theme.textSecondary, marginRight: 8 },
    currencyTextInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: theme.text },
    methodContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    methodChip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: theme.surfaceSecondary, borderWidth: 1, borderColor: theme.border },
    methodChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    methodChipText: { fontSize: 13, fontWeight: '500', color: theme.textSecondary },
    methodChipTextActive: { color: '#fff', fontWeight: '600' },
    confirmModal: { backgroundColor: theme.surface, borderRadius: 20, width: '85%', maxWidth: 340, padding: 24, alignSelf: 'center', alignItems: 'center', marginBottom: 80 },
    deleteIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.errorLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    confirmTitle: { fontSize: 22, fontWeight: '600', color: theme.text, marginBottom: 8 },
    confirmMessage: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    confirmButtons: { flexDirection: 'row', gap: 12, width: '100%' },
    cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.surfaceSecondary, alignItems: 'center' },
    cancelBtnText: { fontSize: 16, fontWeight: '500', color: theme.textSecondary },
    deleteBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.error, alignItems: 'center' },
    deleteBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  });
}

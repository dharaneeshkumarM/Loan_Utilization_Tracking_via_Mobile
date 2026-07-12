import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save } from 'lucide-react-native';

export default function EditLoanScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [lender, setLender] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [interestType, setInterestType] = useState<'fixed' | 'variable'>('fixed');
  const [monthlyEmi, setMonthlyEmi] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'active' | 'paid_off' | 'defaulted'>('active');
  const [description, setDescription] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !lender.trim() || !principalAmount.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    const principal = parseFloat(principalAmount);
    if (isNaN(principal) || principal <= 0) {
      Alert.alert('Error', 'Please enter a valid principal amount');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('loans').insert({
        name: name.trim(), lender: lender.trim(), principal_amount: principal,
        interest_rate: parseFloat(interestRate) || 0, interest_type: interestType,
        monthly_emi: parseFloat(monthlyEmi) || 0, start_date: startDate,
        due_date: dueDate || null, status, description: description.trim() || null,
      });
      if (error) throw error;
      router.back();
    } catch (err) {
      Alert.alert('Error', 'Failed to save loan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={theme.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.title}>{t.newLoan}</Text>
        <TouchableOpacity style={[styles.saveButton, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading} activeOpacity={0.7}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Save size={18} color="#fff" strokeWidth={2} />}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
        <Text style={styles.sectionTitle}>{t.loanDetails}</Text>
        <View style={styles.field}>
          <Text style={styles.label}>{t.loanName} *</Text>
          <TextInput style={styles.input} placeholder="e.g., Home Loan" placeholderTextColor={theme.textTertiary} value={name} onChangeText={setName} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t.lender} *</Text>
          <TextInput style={styles.input} placeholder="e.g., State Bank of India" placeholderTextColor={theme.textTertiary} value={lender} onChangeText={setLender} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t.principalAmount} *</Text>
          <View style={styles.currencyInput}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput style={styles.currencyTextInput} placeholder="0.00" placeholderTextColor={theme.textTertiary} value={principalAmount} onChangeText={setPrincipalAmount} keyboardType="decimal-pad" />
          </View>
        </View>
        <View style={styles.row}>
          <View style={[styles.field, styles.halfField]}>
            <Text style={styles.label}>{t.interestRate}</Text>
            <TextInput style={styles.input} placeholder="e.g., 8.5" placeholderTextColor={theme.textTertiary} value={interestRate} onChangeText={setInterestRate} keyboardType="decimal-pad" />
          </View>
          <View style={[styles.field, styles.halfField]}>
            <Text style={styles.label}>{t.monthlyEMI}</Text>
            <TextInput style={styles.input} placeholder="0" placeholderTextColor={theme.textTertiary} value={monthlyEmi} onChangeText={setMonthlyEmi} keyboardType="decimal-pad" />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t.interestType}</Text>
          <View style={styles.toggleContainer}>
            <TouchableOpacity style={[styles.toggleButton, interestType === 'fixed' && styles.toggleButtonActive]} onPress={() => setInterestType('fixed')} activeOpacity={0.7}>
              <Text style={[styles.toggleText, interestType === 'fixed' && styles.toggleTextActive]}>{t.fixed}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleButton, interestType === 'variable' && styles.toggleButtonActive]} onPress={() => setInterestType('variable')} activeOpacity={0.7}>
              <Text style={[styles.toggleText, interestType === 'variable' && styles.toggleTextActive]}>{t.variable}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t.startDate}</Text>
        <View style={styles.field}>
          <Text style={styles.label}>{t.startDate}</Text>
          <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={theme.textTertiary} value={startDate} onChangeText={setStartDate} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t.dueDate}</Text>
          <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={theme.textTertiary} value={dueDate} onChangeText={setDueDate} />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t.status}</Text>
        <View style={styles.statusContainer}>
          {(['active', 'paid_off', 'defaulted'] as const).map((s) => (
            <TouchableOpacity key={s} style={[styles.statusButton, status === s && styles.statusButtonActive]} onPress={() => setStatus(s)} activeOpacity={0.7}>
              <Text style={[styles.statusText, status === s && styles.statusTextActive]}>
                {s === 'active' ? t.active : s === 'paid_off' ? t.paidOff : t.defaulted}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t.description}</Text>
        <View style={styles.field}>
          <TextInput style={[styles.input, styles.textArea]} placeholder="Add any notes about this loan..." placeholderTextColor={theme.textTertiary} value={description} onChangeText={setDescription} multiline textAlignVertical="top" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: typeof import('@/lib/theme').lightTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
    backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '600', color: theme.text },
    saveButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
    form: { flex: 1 },
    formContent: { padding: 16, paddingBottom: 40 },
    sectionTitle: { fontSize: 15, fontWeight: '600', color: theme.text, marginBottom: 14 },
    field: { marginBottom: 14 },
    label: { fontSize: 13, fontWeight: '500', color: theme.textSecondary, marginBottom: 8 },
    input: { backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: theme.text },
    textArea: { minHeight: 80, paddingTop: 14 },
    currencyInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16 },
    currencySymbol: { fontSize: 18, fontWeight: '600', color: theme.textSecondary, marginRight: 8 },
    currencyTextInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: theme.text },
    row: { flexDirection: 'row', gap: 12 },
    halfField: { flex: 1 },
    toggleContainer: { flexDirection: 'row', backgroundColor: theme.surfaceSecondary, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: theme.border },
    toggleButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    toggleButtonActive: { backgroundColor: theme.primary },
    toggleText: { fontSize: 14, fontWeight: '500', color: theme.textSecondary },
    toggleTextActive: { color: '#fff', fontWeight: '600' },
    statusContainer: { flexDirection: 'row', gap: 8 },
    statusButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
    statusButtonActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    statusText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
    statusTextActive: { color: '#fff' },
  });
}

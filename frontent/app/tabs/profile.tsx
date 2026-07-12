import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  Alert,
  Linking,
  Switch,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, detectUnusualSpending } from '@/lib/loan-utils';
import type { FamilyMember, Expense, LoginActivity } from '@/types/database';
import { GlassCard } from '@/components/GlassCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  User, Mail, LogOut, Shield, HelpCircle, ChevronRight, Landmark, X,
  Lock, Eye, FileText, MessageCircle, ChevronDown, Settings, Moon, Globe,
  Users, AlertTriangle, Smartphone, MapPin, ScanLine, Send, Plus, Trash2,
  Star, CheckCircle2, Target, Bell, Receipt,
} from 'lucide-react-native';

const SUPPORT_EMAIL = 'support@loantrack.app';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { theme, mode, toggleTheme, setMode } = useTheme();
  const { lang, t, toggleLang } = useLanguage();
  const router = useRouter();

  const [showSignOut, setShowSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [activeModal, setActiveModal] = useState<'none' | 'privacy' | 'help' | 'feedback' | 'family' | 'fraud' | 'settings'>('none');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loginActivity, setLoginActivity] = useState<LoginActivity[]>([]);
  const [expandedPrivacy, setExpandedPrivacy] = useState<string | null>(null);
  const [expandedHelp, setExpandedHelp] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', relationship: '', share: '50' });
  const [addingMember, setAddingMember] = useState(false);
  const [profileName, setProfileName] = useState(user?.email?.split('@')[0] || 'User');
  const [savingProfile, setSavingProfile] = useState(false);
  const [monthlyIncome, setMonthlyIncome] = useState(String(user?.user_metadata?.monthly_income || 50000));

  const fetchData = useCallback(async () => {
    const [familyRes, expensesRes, loginRes] = await Promise.all([
      supabase.from('family_members').select('*').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(100),
      supabase.from('login_activity').select('*').order('created_at', { ascending: false }).limit(10),
    ]);
    setFamilyMembers((familyRes.data || []) as FamilyMember[]);
    setExpenses((expensesRes.data || []) as Expense[]);
    setLoginActivity((loginRes.data || []) as LoginActivity[]);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/auth');
    } finally {
      setSigningOut(false);
      setShowSignOut(false);
    }
  };

  const handleContactSupport = async () => {
    const subject = encodeURIComponent('LoanTrack Support Request');
    const body = encodeURIComponent(`Hi LoanTrack team,\n\nI need help with:\n\n—\n\nAccount: ${user?.email || 'N/A'}`);
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else Alert.alert('Email not available', `Please email us at ${SUPPORT_EMAIL} directly.`, [{ text: 'OK' }]);
  };

  const handleAddMember = async () => {
    if (!newMember.name.trim()) { Alert.alert('Error', 'Name is required'); return; }
    setAddingMember(true);
    try {
      const { error } = await supabase.from('family_members').insert({
        name: newMember.name.trim(),
        email: newMember.email.trim() || null,
        relationship: newMember.relationship.trim() || 'family',
        share_percentage: parseFloat(newMember.share) || 50,
      });
      if (error) throw error;
      setNewMember({ name: '', email: '', relationship: '', share: '50' });
      await fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    await supabase.from('family_members').delete().eq('id', id);
    setFamilyMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSubmitFeedback = async () => {
    if (feedbackRating === 0) { Alert.alert('Error', 'Please select a rating'); return; }
    setFeedbackSubmitted(true);
    try {
      await supabase.from('feedback').insert({
        user_id: user?.id,
        rating: feedbackRating,
        message: feedbackText.trim() || null,
        category: 'general',
      });
    } catch (e) { /* feedback is best-effort */ }
    setTimeout(() => {
      setFeedbackSubmitted(false);
      setFeedbackText('');
      setFeedbackRating(0);
      setActiveModal('none');
    }, 2000);
  };

  const handleUpdateProfile = async () => {
    if (!profileName.trim()) { Alert.alert('Error', 'Name cannot be empty'); return; }
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profileName.trim(),
          monthly_income: parseFloat(monthlyIncome) || 50000,
        },
      });
      if (error) throw error;
      setActiveModal('none');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const fraudAlerts = detectUnusualSpending(expenses);
  const styles = createStyles(theme);

  const privacyItems = [
    { key: 'data-security', icon: Lock, title: 'Data Security', short: 'Your loan data is encrypted and stored securely.', detail: 'All data is encrypted in transit and at rest via Supabase row-level security. Only you can access your loans and payments — no other user or third party can read them.' },
    { key: 'data-visibility', icon: Eye, title: 'Data Visibility', short: 'Your financial information is private.', detail: 'We never share your data with third parties. Your loans, payments, and personal details are scoped to your account and protected by row-level security policies.' },
    { key: 'data-export', icon: FileText, title: 'Data Export & Deletion', short: 'Export or delete your data at any time.', detail: 'You can request a full export or permanent deletion of your data by contacting support. We will process your request within 30 days.' },
  ];

  const helpItems = [
    { key: 'contact-support', icon: MessageCircle, title: 'Contact Support', short: `Reach us at ${SUPPORT_EMAIL}`, detail: 'Tap to compose an email to our support team. We typically respond within 1 business day.', action: handleContactSupport },
    { key: 'documentation', icon: FileText, title: 'Documentation', short: 'Learn how to track loans and payments.', detail: 'Add a loan from the Loans tab, then open it to record payments. The Dashboard summarizes total principal, interest paid, and remaining balance across all loans.' },
    { key: 'faqs', icon: HelpCircle, title: 'FAQs', short: 'Common questions about loan tracking.', detail: 'Q: How is interest calculated?\nA: Simple interest on the principal at the configured rate.\n\nQ: Can I edit a loan?\nA: Yes — open a loan and tap Edit to update its details.' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.profile}</Text>
      </View>

      <GlassCard padding={20} style={styles.profileCard}>
        <View style={styles.profileLeft}>
          <View style={styles.avatar}>
            <User size={32} color={theme.primary} strokeWidth={2} />
          </View>
          <View>
            <Text style={styles.profileName}>{user?.email?.split('@')[0] || 'User'}</Text>
            <View style={styles.emailRow}>
              <Mail size={13} color={theme.textTertiary} />
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.editProfileBtn}
          onPress={() => setActiveModal('settings')}
        >
          <Settings size={18} color={theme.primary} strokeWidth={2} />
        </TouchableOpacity>
      </GlassCard>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.quickGrid}>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/scanner')} activeOpacity={0.7}>
            <View style={[styles.quickIcon, { backgroundColor: theme.secondaryLight }]}>
              <ScanLine size={20} color={theme.secondary} strokeWidth={2} />
            </View>
            <Text style={styles.quickLabel}>{t.scanReceipt}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/savings-goals')} activeOpacity={0.7}>
            <View style={[styles.quickIcon, { backgroundColor: theme.accentLight }]}>
              <Target size={20} color={theme.accent} strokeWidth={2} />
            </View>
            <Text style={styles.quickLabel}>Savings Goals</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/notifications')} activeOpacity={0.7}>
            <View style={[styles.quickIcon, { backgroundColor: theme.primaryLight }]}>
              <Bell size={20} color={theme.primary} strokeWidth={2} />
            </View>
            <Text style={styles.quickLabel}>Notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/expenses')} activeOpacity={0.7}>
            <View style={[styles.quickIcon, { backgroundColor: theme.secondaryLight }]}>
              <Receipt size={20} color={theme.secondary} strokeWidth={2} />
            </View>
            <Text style={styles.quickLabel}>Expenses</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => setActiveModal('family')} activeOpacity={0.7}>
            <View style={[styles.quickIcon, { backgroundColor: theme.primaryLight }]}>
              <Users size={20} color={theme.primary} strokeWidth={2} />
            </View>
            <Text style={styles.quickLabel}>{t.familyManagement}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => setActiveModal('fraud')} activeOpacity={0.7}>
            <View style={[styles.quickIcon, { backgroundColor: theme.errorLight }]}>
              <Shield size={20} color={theme.error} strokeWidth={2} />
            </View>
            <Text style={styles.quickLabel}>{t.fraudDetection}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => setActiveModal('feedback')} activeOpacity={0.7}>
            <View style={[styles.quickIcon, { backgroundColor: theme.warning + '20' }]}>
              <Star size={20} color={theme.warning} strokeWidth={2} />
            </View>
            <Text style={styles.quickLabel}>{t.feedback}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <GlassCard padding={0} style={styles.menuCard}>
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: theme.primaryLight }]}>
              <Moon size={18} color={theme.primary} strokeWidth={2} />
            </View>
            <Text style={styles.menuText}>{t.darkMode}</Text>
            <Switch
              value={mode === 'dark'}
              onValueChange={(val) => setMode(val ? 'dark' : 'light')}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.menuDivider} />
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: theme.accentLight }]}>
              <Globe size={18} color={theme.accent} strokeWidth={2} />
            </View>
            <Text style={styles.menuText}>{t.language}</Text>
            <TouchableOpacity style={styles.langToggle} onPress={toggleLang} activeOpacity={0.7}>
              <Text style={styles.langToggleText}>{lang === 'en' ? 'English' : 'தமிழ்'}</Text>
              <ChevronRight size={16} color={theme.textTertiary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </GlassCard>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <GlassCard padding={0} style={styles.menuCard}>
          <TouchableOpacity style={styles.menuItem} onPress={() => setActiveModal('privacy')} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: theme.primaryLight }]}>
              <Shield size={18} color={theme.primary} strokeWidth={2} />
            </View>
            <Text style={styles.menuText}>{t.privacySecurity}</Text>
            <ChevronRight size={20} color={theme.textTertiary} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuItem} onPress={() => setActiveModal('help')} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: theme.accentLight }]}>
              <HelpCircle size={18} color={theme.accent} strokeWidth={2} />
            </View>
            <Text style={styles.menuText}>{t.helpSupport}</Text>
            <ChevronRight size={20} color={theme.textTertiary} strokeWidth={2} />
          </TouchableOpacity>
        </GlassCard>
      </View>

      <View style={styles.section}>
        <GlassCard padding={16} style={styles.appInfoCard}>
          <View style={styles.appInfoLeft}>
            <View style={styles.appIcon}>
              <Landmark size={22} color={theme.primary} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.appName}>LoanTrack AI</Text>
              <Text style={styles.appVersion}>Version 2.0.0</Text>
            </View>
          </View>
        </GlassCard>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={() => setShowSignOut(true)} activeOpacity={0.7}>
        <LogOut size={20} color={theme.error} strokeWidth={2} />
        <Text style={styles.signOutText}>{t.signOut}</Text>
      </TouchableOpacity>

      {/* Sign Out Modal */}
      <Modal visible={showSignOut} animationType="fade" transparent onRequestClose={() => setShowSignOut(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSignOut(false)}>
          <Pressable style={styles.confirmModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.signOutIcon}><LogOut size={28} color={theme.error} strokeWidth={2} /></View>
            <Text style={styles.confirmTitle}>{t.signOut}?</Text>
            <Text style={styles.confirmMessage}>Are you sure you want to sign out?</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSignOut(false)} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, signingOut && { opacity: 0.6 }]} onPress={handleSignOut} disabled={signingOut} activeOpacity={0.7}>
                <Text style={styles.confirmBtnText}>{signingOut ? 'Signing out...' : t.signOut}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Privacy Modal */}
      <Modal visible={activeModal === 'privacy'} animationType="slide" transparent onRequestClose={() => setActiveModal('none')}>
        <Pressable style={styles.modalOverlay} onPress={() => setActiveModal('none')}>
          <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}><Shield size={22} color={theme.primary} /><Text style={styles.sheetTitle}>{t.privacySecurity}</Text></View>
              <TouchableOpacity onPress={() => setActiveModal('none')}><X size={22} color={theme.textTertiary} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody}>
              {privacyItems.map((item) => {
                const Icon = item.icon;
                const expanded = expandedPrivacy === item.key;
                return (
                  <TouchableOpacity key={item.key} style={styles.expandableItem} onPress={() => setExpandedPrivacy(expanded ? null : item.key)} activeOpacity={0.7}>
                    <View style={styles.expandableRow}>
                      <View style={[styles.expandableIcon, { backgroundColor: theme.primaryLight }]}><Icon size={16} color={theme.primary} /></View>
                      <View style={styles.expandableText}>
                        <Text style={styles.expandableTitle}>{item.title}</Text>
                        <Text style={styles.expandableShort}>{item.short}</Text>
                      </View>
                      <ChevronDown size={18} color={theme.textTertiary} style={expanded ? { transform: [{ rotate: '180deg' }] } : undefined} />
                    </View>
                    {expanded && <Text style={styles.expandableDetail}>{item.detail}</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Help Modal */}
      <Modal visible={activeModal === 'help'} animationType="slide" transparent onRequestClose={() => setActiveModal('none')}>
        <Pressable style={styles.modalOverlay} onPress={() => setActiveModal('none')}>
          <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}><HelpCircle size={22} color={theme.accent} /><Text style={styles.sheetTitle}>{t.helpSupport}</Text></View>
              <TouchableOpacity onPress={() => setActiveModal('none')}><X size={22} color={theme.textTertiary} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody}>
              {helpItems.map((item) => {
                const Icon = item.icon;
                const expanded = expandedHelp === item.key;
                return (
                  <TouchableOpacity key={item.key} style={styles.expandableItem} onPress={() => item.action ? item.action() : setExpandedHelp(expanded ? null : item.key)} activeOpacity={0.7}>
                    <View style={styles.expandableRow}>
                      <View style={[styles.expandableIcon, { backgroundColor: theme.primaryLight }]}><Icon size={16} color={theme.primary} /></View>
                      <View style={styles.expandableText}>
                        <Text style={styles.expandableTitle}>{item.title}</Text>
                        <Text style={styles.expandableShort}>{item.short}</Text>
                      </View>
                      {item.action ? <ChevronRight size={18} color={theme.textTertiary} /> : <ChevronDown size={18} color={theme.textTertiary} style={expanded ? { transform: [{ rotate: '180deg' }] } : undefined} />}
                    </View>
                    {expanded && !item.action && <Text style={styles.expandableDetail}>{item.detail}</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Feedback Modal */}
      <Modal visible={activeModal === 'feedback'} animationType="slide" transparent onRequestClose={() => setActiveModal('none')}>
        <Pressable style={styles.modalOverlay} onPress={() => setActiveModal('none')}>
          <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}><Star size={22} color={theme.warning} /><Text style={styles.sheetTitle}>{t.shareFeedback}</Text></View>
              <TouchableOpacity onPress={() => setActiveModal('none')}><X size={22} color={theme.textTertiary} /></TouchableOpacity>
            </View>
            <View style={styles.sheetBody}>
              {feedbackSubmitted ? (
                <View style={styles.feedbackSuccess}>
                  <CheckCircle2 size={48} color={theme.accent} strokeWidth={2} />
                  <Text style={styles.feedbackSuccessText}>Thank you for your feedback!</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.feedbackLabel}>Rate your experience</Text>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity key={n} onPress={() => setFeedbackRating(n)} activeOpacity={0.7}>
                        <Star size={32} color={n <= feedbackRating ? theme.warning : theme.border} fill={n <= feedbackRating ? theme.warning : 'none'} strokeWidth={2} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.feedbackLabel}>{t.yourFeedback}</Text>
                  <TextInput
                    style={styles.feedbackInput}
                    placeholder="Tell us what you think..."
                    placeholderTextColor={theme.textTertiary}
                    value={feedbackText}
                    onChangeText={setFeedbackText}
                    multiline
                    textAlignVertical="top"
                  />
                  <PrimaryButton label={t.submit} onPress={handleSubmitFeedback} icon={<Send size={16} color="#fff" />} />
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Family Management Modal */}
      <Modal visible={activeModal === 'family'} animationType="slide" transparent onRequestClose={() => setActiveModal('none')}>
        <Pressable style={styles.modalOverlay} onPress={() => setActiveModal('none')}>
          <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}><Users size={22} color={theme.primary} /><Text style={styles.sheetTitle}>{t.familyManagement}</Text></View>
              <TouchableOpacity onPress={() => setActiveModal('none')}><X size={22} color={theme.textTertiary} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody}>
              {familyMembers.length > 0 && (
                <View style={styles.familyList}>
                  {familyMembers.map((m) => (
                    <View key={m.id} style={styles.familyItem}>
                      <View style={styles.familyAvatar}>
                        <Text style={styles.familyAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.familyInfo}>
                        <Text style={styles.familyName}>{m.name}</Text>
                        <Text style={styles.familyMeta}>{m.relationship} • {Number(m.share_percentage)}% share</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteMember(m.id)}>
                        <Trash2 size={18} color={theme.error} strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.addMemberTitle}>{t.addMember}</Text>
              <TextInput style={styles.modalInput} placeholder={t.name} placeholderTextColor={theme.textTertiary} value={newMember.name} onChangeText={(v) => setNewMember({ ...newMember, name: v })} />
              <TextInput style={styles.modalInput} placeholder={t.email} placeholderTextColor={theme.textTertiary} value={newMember.email} onChangeText={(v) => setNewMember({ ...newMember, email: v })} keyboardType="email-address" />
              <TextInput style={styles.modalInput} placeholder={t.relationship} placeholderTextColor={theme.textTertiary} value={newMember.relationship} onChangeText={(v) => setNewMember({ ...newMember, relationship: v })} />
              <TextInput style={styles.modalInput} placeholder={t.sharePercentage} placeholderTextColor={theme.textTertiary} value={newMember.share} onChangeText={(v) => setNewMember({ ...newMember, share: v })} keyboardType="numeric" />
              <PrimaryButton label={t.addMember} onPress={handleAddMember} loading={addingMember} icon={<Plus size={18} color="#fff" />} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={activeModal === 'settings'} animationType="slide" transparent onRequestClose={() => setActiveModal('none')}>
        <Pressable style={styles.modalOverlay} onPress={() => setActiveModal('none')}>
          <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}><Settings size={22} color={theme.primary} /><Text style={styles.sheetTitle}>{t.settings}</Text></View>
              <TouchableOpacity onPress={() => setActiveModal('none')}><X size={22} color={theme.textTertiary} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody}>
              <Text style={styles.addMemberTitle}>Edit Profile</Text>
              <Text style={styles.feedbackLabel}>Display Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Your name"
                placeholderTextColor={theme.textTertiary}
                value={profileName}
                onChangeText={setProfileName}
              />
              <Text style={styles.feedbackLabel}>Email (read-only)</Text>
              <View style={[styles.modalInput, { opacity: 0.6 }]}>
                <Text style={{ fontSize: 15, color: theme.textSecondary }}>{user?.email}</Text>
              </View>
              <Text style={styles.feedbackLabel}>Monthly Income (₹)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="50000"
                placeholderTextColor={theme.textTertiary}
                value={monthlyIncome}
                onChangeText={setMonthlyIncome}
                keyboardType="numeric"
              />
              <View style={{ marginTop: 16 }}>
                <PrimaryButton
                  label={savingProfile ? 'Saving...' : 'Save Changes'}
                  onPress={handleUpdateProfile}
                  loading={savingProfile}
                  icon={<CheckCircle2 size={18} color="#fff" />}
                />
              </View>

              <Text style={[styles.addMemberTitle, { marginTop: 24 }]}>{t.darkMode}</Text>
              <View style={styles.menuItem}>
                <View style={[styles.menuIcon, { backgroundColor: theme.primaryLight }]}>
                  <Moon size={18} color={theme.primary} strokeWidth={2} />
                </View>
                <Text style={styles.menuText}>{t.darkMode}</Text>
                <Switch
                  value={mode === 'dark'}
                  onValueChange={toggleTheme}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                />
              </View>

              <Text style={[styles.addMemberTitle, { marginTop: 24 }]}>{t.language}</Text>
              <View style={styles.menuItem}>
                <View style={[styles.menuIcon, { backgroundColor: theme.accentLight }]}>
                  <Globe size={18} color={theme.accent} strokeWidth={2} />
                </View>
                <Text style={styles.menuText}>{t.language}</Text>
                <TouchableOpacity style={styles.langToggle} onPress={toggleLang} activeOpacity={0.7}>
                  <Text style={styles.langToggleText}>{lang === 'en' ? 'English' : 'தமிழ்'}</Text>
                  <ChevronRight size={16} color={theme.textTertiary} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Fraud Detection Modal */}
      <Modal visible={activeModal === 'fraud'} animationType="slide" transparent onRequestClose={() => setActiveModal('none')}>
        <Pressable style={styles.modalOverlay} onPress={() => setActiveModal('none')}>
          <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}><Shield size={22} color={theme.error} /><Text style={styles.sheetTitle}>{t.fraudDetection}</Text></View>
              <TouchableOpacity onPress={() => setActiveModal('none')}><X size={22} color={theme.textTertiary} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody}>
              <Text style={styles.subSectionTitle}>{t.securityAlerts}</Text>
              {fraudAlerts.length > 0 ? (
                fraudAlerts.map((alert, i) => (
                  <View key={i} style={[styles.alertItem, { backgroundColor: theme.errorLight }]}>
                    <AlertTriangle size={18} color={theme.error} strokeWidth={2} />
                    <Text style={styles.alertText}>{alert.message}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.alertItem}>
                  <CheckCircle2 size={18} color={theme.accent} strokeWidth={2} />
                  <Text style={styles.alertText}>{t.noAlerts}</Text>
                </View>
              )}
              <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>{t.recentLogins}</Text>
              {loginActivity.length > 0 ? (
                loginActivity.map((log) => (
                  <View key={log.id} style={styles.loginItem}>
                    <View style={styles.loginIcon}><Smartphone size={16} color={theme.textSecondary} strokeWidth={2} /></View>
                    <View style={styles.loginInfo}>
                      <Text style={styles.loginDevice}>{log.device || log.browser || 'Unknown device'}</Text>
                      <Text style={styles.loginMeta}>{log.location || 'Unknown location'} • {formatDate(log.created_at)}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.alertItem}>
                  <MapPin size={18} color={theme.textTertiary} strokeWidth={2} />
                  <Text style={styles.alertText}>No recent login activity recorded.</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function createStyles(theme: typeof import('@/lib/theme').lightTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 16, paddingBottom: 40, gap: 14 },
    header: { paddingTop: 56, paddingBottom: 8 },
    title: { fontSize: 28, fontWeight: '700', color: theme.text },
    profileCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    profileLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.primaryLight, alignItems: 'center', justifyContent: 'center' },
    profileName: { fontSize: 18, fontWeight: '600', color: theme.text },
    emailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    profileEmail: { fontSize: 13, color: theme.textTertiary },
    editProfileBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surfaceSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
    section: { gap: 10 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    quickCard: { width: '48%', backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: theme.border },
    quickIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    quickLabel: { fontSize: 13, fontWeight: '600', color: theme.text },
    menuCard: { overflow: 'hidden' },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    menuText: { flex: 1, fontSize: 15, color: theme.text, fontWeight: '500' },
    menuDivider: { height: 1, backgroundColor: theme.borderLight, marginLeft: 64 },
    langToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    langToggleText: { fontSize: 14, fontWeight: '500', color: theme.textSecondary },
    appInfoCard: {},
    appInfoLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    appIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.primaryLight, alignItems: 'center', justifyContent: 'center' },
    appName: { fontSize: 16, fontWeight: '600', color: theme.text },
    appVersion: { fontSize: 12, color: theme.textTertiary, marginTop: 2 },
    signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14, backgroundColor: theme.errorLight, borderWidth: 1, borderColor: theme.error + '40' },
    signOutText: { fontSize: 16, fontWeight: '600', color: theme.error },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    confirmModal: { backgroundColor: theme.surface, borderRadius: 20, width: '85%', maxWidth: 340, padding: 24, alignSelf: 'center', alignItems: 'center', marginBottom: 80 },
    signOutIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.errorLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    confirmTitle: { fontSize: 22, fontWeight: '600', color: theme.text, marginBottom: 8 },
    confirmMessage: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 24 },
    confirmButtons: { flexDirection: 'row', gap: 12, width: '100%' },
    cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.surfaceSecondary, alignItems: 'center' },
    cancelBtnText: { fontSize: 16, fontWeight: '500', color: theme.textSecondary },
    confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.error, alignItems: 'center' },
    confirmBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    bottomSheet: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, width: '100%', maxHeight: '85%' },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border },
    sheetHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sheetTitle: { fontSize: 18, fontWeight: '600', color: theme.text },
    sheetBody: { padding: 20 },
    expandableItem: { backgroundColor: theme.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.border },
    expandableRow: { flexDirection: 'row', alignItems: 'center' },
    expandableIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    expandableText: { flex: 1 },
    expandableTitle: { fontSize: 15, fontWeight: '600', color: theme.text },
    expandableShort: { fontSize: 12, color: theme.textTertiary, marginTop: 2 },
    expandableDetail: { fontSize: 13, color: theme.textSecondary, lineHeight: 19, marginTop: 10, marginLeft: 42 },
    feedbackLabel: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 10 },
    ratingRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    feedbackInput: { backgroundColor: theme.surfaceSecondary, borderRadius: 14, padding: 14, fontSize: 15, color: theme.text, minHeight: 100, borderWidth: 1, borderColor: theme.border, marginBottom: 16, textAlignVertical: 'top' },
    feedbackSuccess: { alignItems: 'center', paddingVertical: 40, gap: 16 },
    feedbackSuccessText: { fontSize: 16, fontWeight: '600', color: theme.accent },
    familyList: { gap: 10, marginBottom: 16 },
    familyItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surfaceSecondary, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.border },
    familyAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
    familyAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    familyInfo: { flex: 1 },
    familyName: { fontSize: 15, fontWeight: '600', color: theme.text },
    familyMeta: { fontSize: 12, color: theme.textTertiary, marginTop: 2 },
    addMemberTitle: { fontSize: 15, fontWeight: '600', color: theme.text, marginBottom: 10 },
    modalInput: { backgroundColor: theme.surfaceSecondary, borderRadius: 12, padding: 14, fontSize: 15, color: theme.text, borderWidth: 1, borderColor: theme.border, marginBottom: 10 },
    subSectionTitle: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 10 },
    alertItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
    alertText: { flex: 1, fontSize: 13, color: theme.textSecondary },
    loginItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
    loginIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
    loginInfo: { flex: 1 },
    loginDevice: { fontSize: 14, fontWeight: '500', color: theme.text },
    loginMeta: { fontSize: 12, color: theme.textTertiary, marginTop: 2 },
  });
}

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { User, Mail, Phone, Shield, LogOut, Check, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, typography, spacing, radius, shadow } from '@/lib/theme';

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), phone: phone.trim() || null })
        .eq('id', profile!.id);
      if (error) throw error;
      await refreshProfile();
      setEditing(false);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

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
              {(profile?.full_name ?? 'B').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name}</Text>
            <View style={styles.roleBadge}>
              <Shield color={colors.primary[600]} size={12} />
              <Text style={styles.roleText}>Beneficiary</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account Details</Text>
          <View style={styles.fieldCard}>
            <FieldRow
              icon={<User color={colors.neutral[400]} size={20} />}
              label="Full Name"
              value={fullName}
              editing={editing}
              onChangeText={setFullName}
            />
            <Divider />
            <FieldRow
              icon={<Mail color={colors.neutral[400]} size={20} />}
              label="Email"
              value={profile ? (profile as any).email ?? '—' : '—'}
              editing={false}
              editable={false}
            />
            <Divider />
            <FieldRow
              icon={<Phone color={colors.neutral[400]} size={20} />}
              label="Phone"
              value={phone}
              editing={editing}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {editing ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setEditing(false);
                setFullName(profile?.full_name ?? '');
                setPhone(profile?.phone ?? '');
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.neutral[0]} size={18} />
              ) : (
                <>
                  <Check color={colors.neutral[0]} size={18} strokeWidth={2.5} />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => setEditing(true)}
          >
            <Text style={styles.editBtnText}>Edit Profile</Text>
            <ChevronRight color={colors.primary[600]} size={18} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <LogOut color={colors.error[600]} size={20} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function FieldRow({
  icon,
  label,
  value,
  editing,
  onChangeText,
  keyboardType,
  editable = true,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  editing: boolean;
  onChangeText?: (v: string) => void;
  keyboardType?: 'default' | 'phone-pad';
  editable?: boolean;
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldIcon}>{icon}</View>
      <View style={styles.fieldContent}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {editing && editable ? (
          <TextInput
            style={styles.fieldInput}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            placeholder={`Enter ${label.toLowerCase()}`}
            placeholderTextColor={colors.neutral[400]}
          />
        ) : (
          <Text style={styles.fieldValue}>{value || '—'}</Text>
        )}
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
  fieldCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldContent: { flex: 1 },
  fieldLabel: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    color: colors.neutral[500],
  },
  fieldValue: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.neutral[900],
    marginTop: 2,
  },
  fieldInput: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.neutral[900],
    marginTop: 2,
    paddingVertical: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginVertical: spacing.xs,
    marginLeft: 56,
  },
  actionRow: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.neutral[700],
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  saveBtnText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.neutral[0],
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    ...shadow.sm,
  },
  editBtnText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.primary[700],
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

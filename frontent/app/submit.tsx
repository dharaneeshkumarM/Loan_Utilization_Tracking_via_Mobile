import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CameraView,
  useCameraPermissions,
  type CameraType,
} from 'expo-camera';
import { Camera, MapPin, X, Check, RefreshCw, Image as ImageIcon, DollarSign } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase, type Loan } from '@/lib/supabase';
import { colors, typography, spacing, radius, shadow } from '@/lib/theme';

const CATEGORIES = [
  'Equipment',
  'Livestock',
  'Inventory',
  'Machinery',
  'Tools',
  'Vehicle',
  'Other',
];

export default function SubmitScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<string>('');
  const [assetName, setAssetName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (profile) {
      supabase
        .from('loans')
        .select('*')
        .eq('beneficiary_id', profile.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            console.warn(error.message);
            return;
          }
          const loanList = (data ?? []) as Loan[];
          setLoans(loanList);
          if (loanList.length > 0) setSelectedLoan(loanList[0].id);
        });
    }
  }, [profile]);

  const getLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve) => {
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) {
          resolve({ lat: 40.7128, lng: -74.006 });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({ lat: 40.7128, lng: -74.006 }),
          { enableHighAccuracy: true, timeout: 10000 },
        );
      } else {
        resolve({ lat: 40.7128, lng: -74.006 });
      }
    });
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    setLocating(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
      });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
        const c = await getLocation();
        setCoords(c);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err?.message ?? 'Failed to capture photo.');
    } finally {
      setLocating(false);
      setCameraOpen(false);
    }
  };

  const pickFromGallery = async () => {
    setLocating(true);
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            setPhotoUri(ev.target?.result as string);
          };
          reader.readAsDataURL(file);
          const c = await getLocation();
          setCoords(c);
        }
        setLocating(false);
      };
      input.click();
    } catch {
      setLocating(false);
    }
  };

  const uploadPhoto = async (uri: string): Promise<string> => {
    if (!profile) throw new Error('Not authenticated');
    const fileName = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

    if (Platform.OS === 'web' && uri.startsWith('data:')) {
      const base64 = uri.split(',')[1];
      const { error: upErr } = await supabase.storage
        .from('submission-photos')
        .upload(fileName, base64, {
          contentType: 'image/jpeg',
          upsert: false,
        });
      if (upErr) throw upErr;
    } else {
      const { error: upErr } = await supabase.storage
        .from('submission-photos')
        .upload(fileName, {
          uri,
          type: 'image/jpeg',
          name: fileName,
        } as any);
      if (upErr) throw upErr;
    }

    const { data } = supabase.storage.from('submission-photos').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    setError(null);
    if (!photoUri) {
      setError('Please capture or select a photo of the asset.');
      return;
    }
    if (!selectedLoan) {
      setError('Please select a loan.');
      return;
    }
    if (!assetName.trim()) {
      setError('Please enter the asset name.');
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError('Please enter a valid amount spent.');
      return;
    }
    if (!coords) {
      setError('Location not captured. Please retake the photo.');
      return;
    }

    setSubmitting(true);
    try {
      const photoUrl = await uploadPhoto(photoUri);
      const { error: insErr } = await supabase.from('submissions').insert({
        loan_id: selectedLoan,
        beneficiary_id: profile!.id,
        asset_name: assetName.trim(),
        asset_category: category,
        amount_spent: amt,
        photo_url: photoUrl,
        latitude: coords.lat,
        longitude: coords.lng,
        notes: notes.trim() || null,
        status: 'pending',
      });
      if (insErr) throw insErr;

      Alert.alert('Success', 'Your submission has been recorded and is pending review.', [
        { text: 'OK', onPress: () => router.push('/(app)/dashboard') },
      ]);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (cameraOpen) {
    if (!permission?.granted) {
      return (
        <SafeAreaView style={styles.safe}>
          <View style={styles.permissionWrap}>
            <Camera color={colors.neutral[300]} size={48} />
            <Text style={styles.permissionTitle}>Camera access needed</Text>
            <Text style={styles.permissionText}>
              We need camera permission to capture geo-tagged photos of your assets.
            </Text>
            <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
              <Text style={styles.permissionBtnText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setCameraOpen(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.cameraSafe}>
        <View style={styles.cameraHeader}>
          <TouchableOpacity
            style={styles.cameraCloseBtn}
            onPress={() => setCameraOpen(false)}
          >
            <X color={colors.neutral[0]} size={24} />
          </TouchableOpacity>
          <Text style={styles.cameraHeaderTitle}>Capture Asset Photo</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.cameraWrap}>
          <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
          <View style={styles.cameraOverlay}>
            <View style={styles.focusFrame} />
            <View style={styles.coordsBadge}>
              <MapPin color={colors.neutral[0]} size={14} />
              <Text style={styles.coordsText}>
                {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'GPS ready'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={styles.flipBtn}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          >
            <RefreshCw color={colors.neutral[0]} size={22} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shutterBtn}
            onPress={takePicture}
            disabled={locating}
            activeOpacity={0.8}
          >
            {locating ? (
              <ActivityIndicator color={colors.primary[600]} />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </TouchableOpacity>
          <View style={{ width: 56 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Submit Asset</Text>
        <Text style={styles.subtitle}>
          Capture a geo-tagged photo of the asset purchased with your loan.
        </Text>

        <Text style={styles.label}>Asset Photo</Text>
        {photoUri ? (
          <View style={styles.photoPreview}>
            <Image source={{ uri: photoUri }} style={styles.photoImg} />
            <TouchableOpacity
              style={styles.photoRemove}
              onPress={() => {
                setPhotoUri(null);
                setCoords(null);
              }}
            >
              <X color={colors.neutral[0]} size={18} />
            </TouchableOpacity>
            {coords && (
              <View style={styles.photoCoords}>
                <MapPin color={colors.neutral[0]} size={12} />
                <Text style={styles.photoCoordsText}>
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.photoActions}>
            <TouchableOpacity
              style={styles.photoBtn}
              onPress={() => setCameraOpen(true)}
              activeOpacity={0.9}
            >
              <Camera color={colors.primary[600]} size={28} />
              <Text style={styles.photoBtnTitle}>Take Photo</Text>
              <Text style={styles.photoBtnSub}>Use camera with GPS</Text>
            </TouchableOpacity>
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={[styles.photoBtn, styles.photoBtnSecondary]}
                onPress={pickFromGallery}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator color={colors.neutral[600]} />
                ) : (
                  <>
                    <ImageIcon color={colors.neutral[600]} size={28} />
                    <Text style={[styles.photoBtnTitle, { color: colors.neutral[700] }]}>
                      Choose File
                    </Text>
                    <Text style={styles.photoBtnSub}>Upload from device</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.label}>Select Loan</Text>
        {loans.length === 0 ? (
          <View style={styles.emptyLoanBox}>
            <Text style={styles.emptyLoanText}>
              You have no active loans. Please contact your administrator.
            </Text>
          </View>
        ) : (
          <View style={styles.loanSelector}>
            {loans.map((loan) => (
              <TouchableOpacity
                key={loan.id}
                style={[
                  styles.loanOption,
                  selectedLoan === loan.id && styles.loanOptionActive,
                ]}
                onPress={() => setSelectedLoan(loan.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.loanOptRef,
                      selectedLoan === loan.id && styles.loanOptRefActive,
                    ]}
                  >
                    {loan.loan_reference}
                  </Text>
                  <Text style={styles.loanOptPurpose} numberOfLines={1}>
                    {loan.purpose}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.loanOptAmount,
                    selectedLoan === loan.id && styles.loanOptAmountActive,
                  ]}
                >
                  ${Number(loan.amount).toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Asset Name</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. Sewing Machine, 2 Cows, Welding Equipment"
          placeholderTextColor={colors.neutral[400]}
          value={assetName}
          onChangeText={setAssetName}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  category === cat && styles.categoryChipTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Amount Spent ($)</Text>
        <View style={styles.amountInput}>
          <DollarSign color={colors.neutral[400]} size={20} style={styles.amountIcon} />
          <TextInput
            style={styles.amountField}
            placeholder="0.00"
            placeholderTextColor={colors.neutral[400]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.textInput, styles.notesInput]}
          placeholder="Add any additional details about the asset..."
          placeholderTextColor={colors.neutral[400]}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.9}
        >
          {submitting ? (
            <ActivityIndicator color={colors.neutral[0]} />
          ) : (
            <>
              <Check color={colors.neutral[0]} size={20} strokeWidth={2.5} />
              <Text style={styles.submitBtnText}>Submit for Review</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.neutral[50] },
  scrollView: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  title: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 26,
    color: colors.neutral[900],
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.neutral[700],
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  photoActions: { flexDirection: 'row', gap: spacing.md },
  photoBtn: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderWidth: 2,
    borderColor: colors.primary[200],
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  photoBtnSecondary: {
    borderColor: colors.neutral[300],
  },
  photoBtnTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.primary[700],
  },
  photoBtnSub: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    color: colors.neutral[500],
  },
  photoPreview: {
    position: 'relative',
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.md,
  },
  photoImg: {
    width: '100%',
    height: 220,
    backgroundColor: colors.neutral[200],
  },
  photoRemove: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCoords: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.full,
  },
  photoCoordsText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 12,
    color: colors.neutral[0],
  },
  emptyLoanBox: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[100],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  emptyLoanText: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    color: colors.warning[700],
  },
  loanSelector: { gap: spacing.sm },
  loanOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  loanOptionActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  loanOptRef: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.neutral[900],
  },
  loanOptRefActive: { color: colors.primary[700] },
  loanOptPurpose: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    color: colors.neutral[500],
  },
  loanOptAmount: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    color: colors.neutral[700],
  },
  loanOptAmountActive: { color: colors.primary[700] },
  textInput: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 16,
    color: colors.neutral[900],
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    backgroundColor: colors.neutral[0],
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  categoryChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  categoryChipText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.neutral[600],
  },
  categoryChipTextActive: {
    color: colors.primary[700],
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral[0],
  },
  amountIcon: { marginRight: spacing.sm },
  amountField: {
    flex: 1,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 18,
    color: colors.neutral[900],
    paddingVertical: spacing.md - 2,
  },
  errorBox: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[100],
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  errorText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.error[700],
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    gap: spacing.sm,
    marginTop: spacing.md,
    ...shadow.md,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 16,
    color: colors.neutral[0],
  },
  cameraSafe: { flex: 1, backgroundColor: colors.neutral[950] },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  cameraCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraHeaderTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 16,
    color: colors.neutral[0],
  },
  cameraWrap: { flex: 1, margin: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
  camera: { flex: 1 },
  cameraOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: radius.lg,
  },
  coordsBadge: {
    position: 'absolute',
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  coordsText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    color: colors.neutral[0],
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  flipBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.primary[500],
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary[600],
  },
  permissionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  permissionTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 18,
    color: colors.neutral[900],
    marginTop: spacing.md,
  },
  permissionText: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  permissionBtn: {
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  permissionBtnText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    color: colors.neutral[0],
  },
  cancelBtn: { marginTop: spacing.sm },
  cancelBtnText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.neutral[500],
  },
});

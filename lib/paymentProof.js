import { Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { supabase } from './supabase'
import { dueDateForMonth, getCurrentMonthStr } from './format'

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000
const MAX_PDF_BYTES = 5 * 1024 * 1024 // 5 MB — hard cap since we can't recompress PDFs client-side

// Looks at the most recent proof upload for this flat, regardless of which
// month's due row it was attached to, and blocks a new upload if it was
// less than 4 weeks ago.
async function checkUploadCooldown(profile) {
  const flatNumber = profile?.flat_number
  if (!flatNumber) return

  const { data, error } = await supabase
    .from('dues')
    .select('proof_uploaded_at')
    .eq('building_id', profile.building_id)
    .eq('flat_number', flatNumber)
    .not('proof_uploaded_at', 'is', null)
    .order('proof_uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data?.proof_uploaded_at) return

  const lastUpload = new Date(data.proof_uploaded_at).getTime()
  const elapsed = Date.now() - lastUpload
  if (elapsed < FOUR_WEEKS_MS) {
    const nextAllowed = new Date(lastUpload + FOUR_WEEKS_MS)
    throw new Error(
      `You can only upload payment proof once every 4 weeks. Next upload allowed on ${nextAllowed.toLocaleDateString()}.`
    )
  }
}

// Finds or creates the due row this proof should attach to.
async function resolveDueId(due, profile, maintenanceAmount) {
  if (due?.id) return due.id

  const monthStr = getCurrentMonthStr()
  const flatNumber = profile?.flat_number
  if (!flatNumber) {
    throw new Error('Flat number is missing on profile.')
  }
  const amount = Number(maintenanceAmount || 0)
  const { data: building, error: buildingError } = await supabase
    .from('buildings')
    .select('maintenance_due_day')
    .eq('id', profile.building_id)
    .maybeSingle()

  if (buildingError) throw buildingError

  const { data: newDue, error: dueError } = await supabase
    .from('dues')
    .upsert(
      {
        flat_number: flatNumber,
        month: monthStr,
        due_date: dueDateForMonth(monthStr, building?.maintenance_due_day),
        maintenance: amount,
        total: amount,
        building_id: profile.building_id,
        status: 'pending',
      },
      { onConflict: 'building_id,flat_number,month' }
    )
    .select('id')
    .single()

  if (dueError) throw dueError
  return newDue.id
}

// Shared upload + due-update logic for both images and PDFs.
async function finalizeProofUpload({ dueId, profile, base64, extension, contentType }) {
  const path = `${profile.id}/${dueId}.${extension}`
  const arrayBuffer = decode(base64)

  const { error: uploadError } = await supabase.storage
    .from('payment-proofs')
    .upload(path, arrayBuffer, { contentType, upsert: true })
  if (uploadError) throw uploadError

  const { error: updateError } = await supabase
    .from('dues')
    .update({
      proof_url: path,
      proof_uploaded_at: new Date().toISOString(),
      status: 'submitted',
    })
    .eq('id', dueId)
  if (updateError) throw updateError

  return path
}

async function pickImageProof(due, profile, maintenanceAmount) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Gallery access is needed to upload your payment screenshot.')
  }

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] })
  if (result.canceled) return null

  const asset = result.assets[0]

  // Aggressively downsized — this is a proof of payment, not a photo to
  // archive. 800px wide at 35% JPEG quality keeps it legible while keeping
  // storage costs low as upload volume grows.
  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: 800 } }],
    { compress: 0.35, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  )
  if (!manipulated.base64) {
    throw new Error('Could not process the selected image. Try a different photo.')
  }

  const dueId = await resolveDueId(due, profile, maintenanceAmount)
  return finalizeProofUpload({
    dueId,
    profile,
    base64: manipulated.base64,
    extension: 'jpg',
    contentType: 'image/jpeg',
  })
}

async function pickPdfProof(due, profile, maintenanceAmount) {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  })
  if (result.canceled) return null

  const asset = result.assets[0]

  if (asset.size && asset.size > MAX_PDF_BYTES) {
    throw new Error(
      `That PDF is too large (max 5 MB). Try a smaller scan, or upload a photo instead.`
    )
  }

  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  })

  const dueId = await resolveDueId(due, profile, maintenanceAmount)
  return finalizeProofUpload({
    dueId,
    profile,
    base64,
    extension: 'pdf',
    contentType: 'application/pdf',
  })
}

// Entry point — asks whether the person wants to upload a photo or a PDF,
// enforces the 4-week cooldown, then delegates to the right picker.
export async function pickAndUploadProof(due, profile, maintenanceAmount = 0) {
  await checkUploadCooldown(profile)

  return new Promise((resolve, reject) => {
    Alert.alert(
      'Upload Payment Proof',
      'Choose a file type',
      [
        {
          text: 'Photo',
          onPress: () => pickImageProof(due, profile, maintenanceAmount).then(resolve).catch(reject),
        },
        {
          text: 'PDF',
          onPress: () => pickPdfProof(due, profile, maintenanceAmount).then(resolve).catch(reject),
        },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    )
  })
}

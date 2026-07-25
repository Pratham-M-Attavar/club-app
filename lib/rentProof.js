import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { decode } from 'base64-arraybuffer'
import { supabase } from './supabase'

// Reuses the same private 'payment-proofs' bucket as maintenance proof —
// the path still starts with the uploader's own user id, so the existing
// bucket RLS policies (checking auth.uid() = first folder segment) already
// cover this without any new storage policies needed.
export async function pickAndUploadRentProof(rentPayment, profile) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Gallery access is needed to upload your rent payment screenshot.')
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  })
  if (result.canceled) return null

  const asset = result.assets[0]

  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: 1080 } }],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  )
  if (!manipulated.base64) {
    throw new Error('Could not process the selected image. Try a different photo.')
  }

  const path = `${profile.id}/rent-${rentPayment.id}.jpg`
  const arrayBuffer = decode(manipulated.base64)

  const { error: uploadError } = await supabase.storage
    .from('payment-proofs')
    .upload(path, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })
  if (uploadError) throw uploadError

  const { error: updateError } = await supabase
    .from('rent_payments')
    .update({
      proof_url: path,
      proof_uploaded_at: new Date().toISOString(),
      status: 'submitted',
    })
    .eq('id', rentPayment.id)
  if (updateError) throw updateError

  return path
}
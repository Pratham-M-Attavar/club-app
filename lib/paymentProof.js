import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { decode } from 'base64-arraybuffer'
import { supabase } from './supabase'

// Opens the gallery, uploads the picked screenshot to the private
// payment-proofs bucket, and flips the due's status so the committee
// knows to go confirm it. Returns the storage path, or null if the
// person cancelled the picker.
export async function pickAndUploadProof(due, profile) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Gallery access is needed to upload your payment screenshot.')
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  })
  if (result.canceled) return null

  const asset = result.assets[0]

  // Resize + recompress — a raw screenshot can be several MB; a payment
  // proof only needs to be legible, not full resolution. 1080px wide at
  // 50% JPEG quality is plenty and cuts file size dramatically.
  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: 1080 } }],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  )
  if (!manipulated.base64) {
    throw new Error('Could not process the selected image. Try a different photo.')
  }

  // Folder is the user's own id — matches the storage RLS policy, which
  // checks that the first path segment equals auth.uid().
  const path = `${profile.id}/${due.id}.jpg`
  const arrayBuffer = decode(manipulated.base64)

  const { error: uploadError } = await supabase.storage
    .from('payment-proofs')
    .upload(path, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })
  if (uploadError) throw uploadError

  const { error: updateError } = await supabase
    .from('dues')
    .update({
      proof_url: path,
      proof_uploaded_at: new Date().toISOString(),
      status: 'submitted',
    })
    .eq('id', due.id)
  if (updateError) throw updateError

  return path
}
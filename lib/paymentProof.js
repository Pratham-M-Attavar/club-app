import * as ImagePicker from 'expo-image-picker'
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
    base64: true,
  })
  if (result.canceled) return null

  const asset = result.assets[0]
  const mimeToExt = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' }
  const fileExt = mimeToExt[asset.mimeType] || (asset.uri.includes('.') ? asset.uri.split('.').pop().split('?')[0] : 'jpg')
  // Folder is the user's own id — matches the storage RLS policy, which
  // checks that the first path segment equals auth.uid().
  const path = `${profile.id}/${due.id}.${fileExt}`

  if (!asset.base64) {
    throw new Error('Could not read the selected image. Try picking a different photo.')
  }
  const arrayBuffer = decode(asset.base64)

  const { error: uploadError } = await supabase.storage
    .from('payment-proofs')
    .upload(path, arrayBuffer, {
      contentType: asset.mimeType || 'image/jpeg',
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
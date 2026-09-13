import { supabase } from '../lib/supabase.js'
import { useQuery } from './useQuery.js'

// One hook per table. Each returns { data, loading, error, reload } and the
// module also exports plain CRUD helpers used by the modals.

export function useProducts() {
  return useQuery(() => supabase.from('products').select('*').order('name'))
}

export function usePins() {
  return useQuery(() =>
    supabase
      .from('pinterest_pins')
      .select('*, product:products(id, name)')
      .order('scheduled_date', { ascending: true, nullsFirst: false })
      .order('scheduled_time', { ascending: true, nullsFirst: false }),
  )
}

export function usePosts() {
  return useQuery(() =>
    supabase
      .from('instagram_posts')
      .select('*, product:products(id, name)')
      .order('post_date', { ascending: false })
      .order('post_number', { ascending: false }),
  )
}

export function usePipeline() {
  return useQuery(() =>
    supabase
      .from('content_pipeline')
      .select('*, product:products(id, name, status, price)')
      .order('due_date', { ascending: true, nullsFirst: false }),
  )
}

export function useCopyLibrary() {
  return useQuery(() => supabase.from('copy_library').select('*, product:products(id, name, status)'))
}

export function usePerformance(fromISO, toISO) {
  return useQuery(
    () => {
      let q = supabase.from('daily_performance').select('*').order('date', { ascending: true })
      if (fromISO) q = q.gte('date', fromISO)
      if (toISO) q = q.lte('date', toISO)
      return q
    },
    [fromISO, toISO],
  )
}

// ---- CRUD helpers -------------------------------------------------------

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

export const api = {
  // products
  createProduct: (row) => supabase.from('products').insert(row).select().single().then(unwrap),
  updateProduct: (id, patch) => supabase.from('products').update(patch).eq('id', id).select().single().then(unwrap),
  deleteProduct: (id) => supabase.from('products').delete().eq('id', id).then(unwrap),

  // pins
  createPin: (row) => supabase.from('pinterest_pins').insert(row).select().single().then(unwrap),
  updatePin: (id, patch) => supabase.from('pinterest_pins').update(patch).eq('id', id).select().single().then(unwrap),
  deletePin: (id) => supabase.from('pinterest_pins').delete().eq('id', id).then(unwrap),

  // posts
  createPost: (row) => supabase.from('instagram_posts').insert(row).select().single().then(unwrap),
  updatePost: (id, patch) => supabase.from('instagram_posts').update(patch).eq('id', id).select().single().then(unwrap),
  deletePost: (id) => supabase.from('instagram_posts').delete().eq('id', id).then(unwrap),

  // pipeline
  updatePipeline: (id, patch) =>
    supabase.from('content_pipeline').update(patch).eq('id', id).select().single().then(unwrap),
  ensurePipeline: (productId) =>
    supabase
      .from('content_pipeline')
      .upsert({ product_id: productId }, { onConflict: 'product_id', ignoreDuplicates: true })
      .then(unwrap),

  // copy library
  upsertCopy: (productId, patch) =>
    supabase
      .from('copy_library')
      .upsert({ product_id: productId, ...patch }, { onConflict: 'product_id' })
      .select()
      .single()
      .then(unwrap),

  // daily performance
  upsertPerformance: (row) =>
    supabase.from('daily_performance').upsert(row, { onConflict: 'date' }).select().single().then(unwrap),
  deletePerformance: (id) => supabase.from('daily_performance').delete().eq('id', id).then(unwrap),
}

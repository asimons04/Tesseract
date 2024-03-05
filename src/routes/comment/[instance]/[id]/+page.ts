import { profile } from '$lib/auth.js'
import { getClient } from '$lib/lemmy.js'
import { redirect } from '@sveltejs/kit'
import { get } from 'svelte/store'

interface loadParams {
    params: any,
    fetch: any
}

export async function load({ params, fetch }:loadParams) {
  const comment = await getClient(undefined, fetch).getComment({
    id: Number(params.id),
    auth: get(profile)?.jwt,
  })

  throw redirect(
    300,
    `/post/${comment.comment_view.post.id}?thread=${comment.comment_view.comment.path}#${comment.comment_view.comment.id}`
  )
}

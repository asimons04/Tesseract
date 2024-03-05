import { env } from '$env/dynamic/public'
import { profile } from '$lib/auth.js'
import { getClient } from '$lib/lemmy.js'
import { SSR_ENABLED, userSettings } from '$lib/settings.js'
import { error } from '@sveltejs/kit'
import { get } from 'svelte/store'

interface LoadParams {
    params: any,
    url: any,
    fetch: any
}
export async function load({ params, url, fetch }: LoadParams) {
    try {
        const post = await getClient(params.instance.toLowerCase(), fetch).getPost({
            id: Number(params.id),
            auth: get(profile)?.jwt,
        })

        let max_depth = post.post_view.counts.comments > 100 ? 2 : 5

        const thread = url.searchParams.get('thread')
        let parentId: number | undefined

        if (thread) {
            parentId = Number(thread.split('.')[1])

            if (!Number.isInteger(parentId)) {
                parentId = undefined
            }
        }

        if (parentId) {
            max_depth = 10
        }

        const sort = get(userSettings)?.defaultSort?.comments ?? 'Hot'

        const commentParams: any = {
            post_id: Number(params.id),
            type_: 'All',
            limit: 50,
            page: 1,
            max_depth: max_depth,
            saved_only: false,
            sort: sort,
            auth: get(profile)?.jwt,
            parent_id: parentId,
        }

        return {
            singleThread: parentId != undefined,
            post: post,
            commentSort: sort,
            streamed: {
                comments: SSR_ENABLED
                    ? await getClient(params.instance, fetch).getComments(commentParams)
                    : getClient(params.instance, fetch).getComments(commentParams),
            },
        }
    }
    catch (err) {
        console.log(err);
        throw error(500, {
            message: 'Failed to fetch post.',
        })
    }
}

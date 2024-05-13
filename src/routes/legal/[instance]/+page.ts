import { getClient } from '$lib/lemmy.js'
import { error } from '@sveltejs/kit'
import { LINKED_INSTANCE_URL } from "$lib/instance.js";

export async function load(req: any) {
    try {
        return {
            site: await getClient(LINKED_INSTANCE_URL ?? req.params.instance).getSite(),
        }
    } catch (err) {
        throw error(500, {
            message: 'Failed to fetch legal page.',
        })
    }
}


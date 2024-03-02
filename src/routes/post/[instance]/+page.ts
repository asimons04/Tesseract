import { instance } from '$lib/instance.js'
import { error, redirect } from '@sveltejs/kit'
import { get } from 'svelte/store'


export function load({ params, url }) {
    // If url parameter is a number, assume it is a post id and redirect (/post/12345 -> /post/{instance}/12345
    if (Number(params.instance)) {
        const split = url.pathname.split('/')

        split.splice(2, 0, `${get(instance)?.toLowerCase()}`)

        const newUrl = new URL(url)
        newUrl.pathname = split.join('/')

        throw redirect(300, newUrl.toString())
    }

    throw error(404, 'Not found')
}
